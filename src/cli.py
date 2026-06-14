import argparse
import asyncio
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from typing import Any

from src.client import VelocityBrainClient
from src.client.exceptions import APIError, AuthenticationError, NetworkError, RateLimitError
from src.core.config import settings
from src.core.db import bootstrap_schema
from src.core.paths import get_velocitybrain_home
from src.services.caveman_compress import caveman_compress_file
from src.services.caveman_ops import caveman_commit, caveman_review
from src.services.adoption_service import AdoptionService
from src.services.identity_spec import IdentitySpecService
from src.services.memory_engine import MemoryEngine
from src.services.openclaw_profile import build_openclaw_profile
from src.services.org_ingest import OrgIngestService
from src.services.response_style import ALLOWED_RESPONSE_STYLES, apply_response_style, normalize_response_style
from src.services.retrieval_engine import RetrievalEngine
from src.services.reuse_validation import ReuseValidationService
from src.services.runtime_status import build_runtime_status
from src.services.reuse_service import ReuseService
from src.services.skill_registry import SkillRegistry
from src.services.skill_validation import validate_skill_inventory
from src.services.sync_service import SyncService

BRAND = 'Velocity Brain'
MAX_INGEST_FILE_BYTES = 2 * 1024 * 1024
DEFAULT_CLOUD_BASE_URL = 'https://velocity.linkitapp.in'
DEFAULT_DASHBOARD_URL = 'https://velocitybrain.vercel.app/login'
CONFIG_DIR = get_velocitybrain_home()
CONFIG_PATH = CONFIG_DIR / 'config.json'
RUNTIME_MODE_AUTO = 'auto'
RUNTIME_MODE_CLOUD = 'cloud'
RUNTIME_MODE_SELF_HOSTED = 'self-hosted'
RUNTIME_MODE_CHOICES = [RUNTIME_MODE_AUTO, RUNTIME_MODE_CLOUD, RUNTIME_MODE_SELF_HOSTED]

# Upgraded 3D Block ASCII Art
BANNER = r"""
██╗   ██╗███████╗██╗      ██████╗  ██████╗██╗████████╗██╗   ██╗
██║   ██║██╔════╝██║     ██╔═══██╗██╔════╝██║╚══██╔══╝╚██╗ ██╔╝
██║   ██║█████╗  ██║     ██║   ██║██║     ██║   ██║    ╚████╔╝ 
╚██╗ ██╔╝██╔══╝  ██║     ██║   ██║██║     ██║   ██║     ╚██╔╝  
 ╚████╔╝ ███████╗███████╗╚██████╔╝╚██████╗██║   ██║      ██║   
  ╚═══╝  ╚══════╝╚══════╝ ╚═════╝  ╚═════╝╚═╝   ╚═╝      ╚═╝   

██████╗ ██████╗  █████╗ ██╗███╗   ██╗
██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║
██████╔╝██████╔╝███████║██║██╔██╗ ██║
██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║
██████╔╝██║  ██║██║  ██║██║██║ ╚████║
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
"""

RESET = '\x1b[0m'
BOLD = '\x1b[1m'
ORANGE = '\x1b[38;2;255;153;102m'
BLUE = '\x1b[38;2;110;168;255m'
WHITE = '\x1b[38;2;245;245;245m'
SLATE = '\x1b[38;2;170;180;195m'


def _load_cli_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
    except Exception:
        return {}


def _save_cli_config(config: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding='utf-8')


def _mask_secret(value: str | None) -> str:
    if not value:
        return 'not-set'
    if len(value) <= 8:
        return '*' * len(value)
    return f"{value[:4]}{'*' * max(len(value) - 8, 4)}{value[-4:]}"


def _is_interactive_terminal() -> bool:
    return sys.stdin.isatty() and sys.stdout.isatty()


def _config_runtime_mode() -> str:
    config = _load_cli_config()
    mode = config.get('runtime_mode')
    if mode in RUNTIME_MODE_CHOICES:
        return mode
    return RUNTIME_MODE_AUTO


def _has_cloud_credentials() -> bool:
    if os.getenv('VELOCITYBRAIN_API_KEY'):
        return True
    return bool(_load_cli_config().get('api_key'))


def _resolve_runtime_mode(args: argparse.Namespace | None = None) -> str:
    requested = getattr(args, 'runtime_mode', None) if args else None
    env_mode = os.getenv('VELOCITYBRAIN_RUNTIME_MODE')
    mode = requested or env_mode or _config_runtime_mode()
    if mode not in RUNTIME_MODE_CHOICES:
        mode = RUNTIME_MODE_AUTO
    if mode == RUNTIME_MODE_AUTO:
        return RUNTIME_MODE_CLOUD if _has_cloud_credentials() else RUNTIME_MODE_SELF_HOSTED
    return mode


def _cloud_config() -> dict[str, Any]:
    config = _load_cli_config()
    return {
        'api_key': os.getenv('VELOCITYBRAIN_API_KEY') or config.get('api_key'),
        'base_url': os.getenv('VELOCITYBRAIN_BASE_URL') or config.get('base_url') or DEFAULT_CLOUD_BASE_URL,
    }


def _agent_credentials(agent_id: str | None = None) -> dict[str, Any]:
    config = _load_cli_config()
    preferred = agent_id or config.get('preferred_agent')
    if not preferred:
        return {}
    credentials = config.get('agent_credentials') or {}
    if not isinstance(credentials, dict):
        return {}
    record = credentials.get(preferred) or {}
    return record if isinstance(record, dict) else {}


def _store_agent_credentials(agent_id: str, payload: dict[str, Any]) -> None:
    config = _load_cli_config()
    credentials = config.get('agent_credentials') or {}
    if not isinstance(credentials, dict):
        credentials = {}
    credentials[agent_id] = payload
    config['agent_credentials'] = credentials
    config['preferred_agent'] = agent_id
    _save_cli_config(config)


def _detect_repo_context(repo_path: str | None = None) -> dict[str, Any]:
    cwd = Path(repo_path).resolve() if repo_path else Path.cwd().resolve()
    current = cwd
    while True:
        if (current / '.git').exists() or (current / 'AGENTS.md').exists() or (current / 'identity.spec.json').exists():
            break
        if current.parent == current:
            break
        current = current.parent

    branch = ''
    try:
        completed = subprocess.run(
            ['git', '-C', str(current), 'rev-parse', '--abbrev-ref', 'HEAD'],
            capture_output=True,
            text=True,
            check=False,
        )
        branch = completed.stdout.strip()
    except Exception:
        branch = ''

    return {
        'repo_id': current.name or 'default-workspace',
        'repo_name': current.name or 'default-workspace',
        'repo_path': str(current),
        'cwd': str(cwd),
        'project_id': current.name or 'default-workspace',
        'branch': branch,
    }


def _cloud_client() -> VelocityBrainClient:
    config = _cloud_config()
    api_key = config.get('api_key')
    preferred_agent = (_load_cli_config().get('preferred_agent') or 'mcp-client')
    agent_creds = _agent_credentials(preferred_agent)
    if not api_key and not agent_creds.get('refresh_token') and not agent_creds.get('access_token'):
        raise ValueError(
            'VelocityBrain API key not found. Run `velocitybrain login --api-key <key>` '
            'or set `VELOCITYBRAIN_API_KEY`, or pair an agent with `velocitybrain connect <client> --pair-code <code>`.'
        )
    return VelocityBrainClient(
        api_key=api_key,
        base_url=config['base_url'],
        access_token=agent_creds.get('access_token'),
        refresh_token=agent_creds.get('refresh_token'),
        token_expires_at=agent_creds.get('token_expires_at'),
    )


def _normalize_cloud_query(result: dict[str, Any], trace_id: str) -> dict[str, Any]:
    reuse = result.get('reuse') or {'hit_type': 'none', 'artifacts_used': [], 'confidence': 0.0}
    savings = result.get('savings') or {
        'avoided_input_tokens': 0,
        'estimated_cost_without_reuse': 0.0,
        'estimated_cost_actual': 0.0,
        'estimated_cost_saved': 0.0,
        'saved_percent': 0.0,
        'estimated_latency_saved_ms': 0,
    }
    return {
        'answer': result.get('answer', 'No answer returned by hosted backend.'),
        'confidence': result.get('confidence', reuse.get('confidence', 0.0)),
        'references': result.get('sources', result.get('references', [])),
        'reasoning_summary': result.get('reasoning_summary', 'Hosted Velocity Brain query completed.'),
        'reuse': reuse,
        'savings': savings,
        'trace_id': result.get('trace_id', trace_id),
    }


def _normalize_cloud_run(result: dict[str, Any], signal: str, trace_id: str) -> dict[str, Any]:
    reuse = result.get('reuse') or {'hit_type': 'none', 'artifacts_used': [], 'confidence': 0.0}
    savings = result.get('savings') or {
        'avoided_input_tokens': 0,
        'estimated_cost_without_reuse': 0.0,
        'estimated_cost_actual': 0.0,
        'estimated_cost_saved': 0.0,
        'saved_percent': 0.0,
        'estimated_latency_saved_ms': 0,
    }
    return {
        'run_id': result.get('run_id', result.get('id', 'cloud-run')),
        'signal': signal,
        'status': result.get('status', 'completed'),
        'intent': result.get('intent', 'cloud-task'),
        'plan': result.get('plan', result.get('steps', [])),
        'actions': result.get('actions', []),
        'memory_updates': result.get('memory_updates', []),
        'confidence': result.get('confidence', 0.0),
        'attention_score': result.get('attention_score', result.get('confidence', 0.0)),
        'reasoning_summary': result.get('result', result.get('reasoning_summary', 'Hosted Velocity Brain run completed.')),
        'references': result.get('references', result.get('sources', [])),
        'reuse': reuse,
        'savings': savings,
        'trace_id': result.get('trace_id', trace_id),
    }


def _normalize_cloud_status(result: dict[str, Any], trace_id: str) -> dict[str, Any]:
    if {'total_runs', 'repeat_rate', 'reuse_hit_rate', 'avg_token_savings'} <= result.keys():
        return {
            'app': BRAND,
            'env': 'cloud',
            'health': {'ok': True},
            'skills': {'count': 0, 'categories': []},
            'openclaw': {'tool_count': 2, 'skill_count': 0},
            'audit': {'available': False, 'count': 0, 'latest_event': None},
            'savings': {
                'run_count': int(result.get('total_runs', 0)),
                'repeat_rate': float(result.get('repeat_rate', 0.0)),
                'reuse_hit_rate': float(result.get('reuse_hit_rate', 0.0)),
                'average_saved_tokens': float(result.get('avg_token_savings', 0.0)),
            },
            'generated_at': 'cloud',
            'trace_id': trace_id,
        }
    return {
        'app': BRAND,
        'env': result.get('environment', 'cloud'),
        'health': {'ok': result.get('status') in {'ok', 'healthy', 'ready', 'up'}},
        'skills': {
            'count': result.get('skill_count', 0),
            'categories': result.get('skill_categories', []),
        },
        'openclaw': {
            'tool_count': result.get('tool_count', 0),
            'skill_count': result.get('skill_count', 0),
        },
        'audit': {
            'available': result.get('audit_available', True),
            'count': result.get('audit_recent_count', 0),
            'latest_event': result.get('latest_event'),
        },
        'savings': result.get('savings_summary', result.get('savings', {})),
        'generated_at': result.get('generated_at', 'cloud'),
        'trace_id': result.get('trace_id', trace_id),
    }


def _normalize_cloud_health(result: dict[str, Any], trace_id: str) -> dict[str, Any]:
    ok = result.get('ok')
    if ok is None:
        ok = result.get('status') in {'ok', 'healthy', 'ready', 'up'}
    checks = result.get('checks') or {
        'api_key': True,
        'backend': bool(ok),
        'workspace': True,
    }
    return {
        'ok': bool(ok),
        'checks': checks,
        'trace_id': result.get('trace_id', trace_id),
    }


def _doctor_details(runtime_mode: str) -> dict[str, Any]:
    cloud_cfg = _cloud_config()
    return {
        'runtime_mode': runtime_mode,
        'base_url': cloud_cfg.get('base_url', DEFAULT_CLOUD_BASE_URL),
        'dashboard_url': DEFAULT_DASHBOARD_URL,
        'config_path': str(CONFIG_PATH),
        'api_key': _mask_secret(cloud_cfg.get('api_key')),
    }


def _cloud_connected_sources() -> list[str]:
    try:
        with _cloud_client() as client:
            result = client.get_integrations()
        return result.get('connectedSources') or []
    except Exception:
        return []


def _smoke_cloud(question: str) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []
    with _cloud_client() as client:
        health = client.get_health()
        health_ok = bool(health.get('ok', health.get('status') in {'ok', 'healthy', 'ready', 'up'}))
        steps.append({'name': 'health', 'ok': health_ok, 'detail': health.get('status', 'ok')})

        skills = client.list_skills()
        skill_count = len(skills.get('skills', []))
        steps.append({'name': 'skills', 'ok': skill_count >= 0, 'detail': f'{skill_count} skills visible'})

        query = client.query(question, response_style='lite', max_results=3)
        answer = query.get('answer', '')
        steps.append({'name': 'query', 'ok': bool(answer), 'detail': answer[:80] if answer else 'no answer'})

    passed = sum(1 for step in steps if step['ok'])
    return {
        'runtime_mode': RUNTIME_MODE_CLOUD,
        'ok': passed == len(steps),
        'passed': passed,
        'steps': steps,
        'trace_id': 'smoke-cloud',
    }


def _smoke_self_hosted(question: str) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []
    doctor = _doctor_payload()
    steps.append({'name': 'doctor', 'ok': doctor['ok'], 'detail': 'local checks'})
    skills = SkillRegistry(settings.skills_path).list_skills()
    steps.append({'name': 'skills', 'ok': len(skills) >= 0, 'detail': f'{len(skills)} skills visible'})
    query = _query_payload(question, 3, response_style='lite')
    steps.append({'name': 'query', 'ok': bool(query.get('answer')), 'detail': query.get('answer', '')[:80]})
    passed = sum(1 for step in steps if step['ok'])
    return {
        'runtime_mode': RUNTIME_MODE_SELF_HOSTED,
        'ok': passed == len(steps),
        'passed': passed,
        'steps': steps,
        'trace_id': 'smoke-self-hosted',
    }


def _save_runtime_mode(mode: str) -> None:
    config = _load_cli_config()
    config['runtime_mode'] = mode
    _save_cli_config(config)


def _open_dashboard(url: str = DEFAULT_DASHBOARD_URL) -> bool:
    try:
        return bool(webbrowser.open(url))
    except Exception:
        return False


def _cloud_error_details(exc: Exception) -> dict[str, Any]:
    if isinstance(exc, AuthenticationError):
        return {
            'status': 'authentication_failed',
            'message': 'The hosted API key was rejected.',
            'checks': {'api_key': False, 'backend': True, 'workspace': True},
            'hint': 'Generate a fresh API key in the dashboard and run `velocitybrain login --api-key <key>` again.',
        }
    if isinstance(exc, RateLimitError):
        return {
            'status': 'rate_limited',
            'message': str(exc),
            'checks': {'api_key': True, 'backend': True, 'workspace': True},
            'hint': f"Retry after about {exc.retry_after or 60} seconds.",
        }
    if isinstance(exc, NetworkError):
        return {
            'status': 'network_error',
            'message': str(exc),
            'checks': {'api_key': bool(_cloud_config().get('api_key')), 'backend': False, 'workspace': True},
            'hint': 'Check internet access and confirm the hosted base URL is reachable.',
        }
    if isinstance(exc, APIError):
        backend_ok = False if exc.status_code and exc.status_code >= 500 else True
        return {
            'status': 'api_error',
            'message': str(exc),
            'checks': {'api_key': True, 'backend': backend_ok, 'workspace': True},
            'hint': 'Check the hosted backend logs and verify the expected API endpoints are deployed.',
        }
    return {
        'status': 'cloud_unavailable',
        'message': str(exc),
        'checks': {'api_key': bool(_cloud_config().get('api_key')), 'backend': False, 'workspace': True},
        'hint': 'Retry `velocitybrain doctor` after verifying cloud config and backend availability.',
    }


def _prompt_choice(prompt: str, valid_choices: set[str], default: str | None = None) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"{prompt}{suffix}: ").strip().lower()
        if not value and default:
            value = default
        if value in valid_choices:
            return value
        print(f"Choose one of: {', '.join(sorted(valid_choices))}")


def _interactive_onboarding() -> int:
    print('Velocity Brain setup')
    print('1. Hosted (recommended) - managed reuse backend, savings analytics, no local DB setup')
    print('2. Legacy self-hosted (dev-only) - deprecated local runtime for compatibility work')
    choice = _prompt_choice('Choose mode: 1 for Hosted, 2 for Legacy', {'1', '2'}, default='1')

    if choice == '2':
        _save_runtime_mode(RUNTIME_MODE_SELF_HOSTED)
        print('Saved legacy self-hosted mode.')
        print('This path is deprecated and is no longer the primary product.')
        print('Use it only for compatibility work or internal development.')
        return 0

    config = _load_cli_config()
    api_key = config.get('api_key')
    if not api_key:
        open_dashboard = _prompt_choice('Open the API keys dashboard now? y/n', {'y', 'n'}, default='y')
        if open_dashboard == 'y':
            opened = _open_dashboard()
            if opened:
                print(f'Opened dashboard: {DEFAULT_DASHBOARD_URL}')
            else:
                print(f'Open this URL in your browser: {DEFAULT_DASHBOARD_URL}')
        print('Get your API key from the Velocity Brain dashboard, then paste it here.')
        print(f'Dashboard: {DEFAULT_DASHBOARD_URL}')
        api_key = input('Velocity Brain API key: ').strip()
    if not api_key:
        print('No API key provided. Run `velocitybrain login --api-key <key>` when ready.')
        return 1

    config['api_key'] = api_key
    config['runtime_mode'] = RUNTIME_MODE_CLOUD
    config.setdefault('base_url', DEFAULT_CLOUD_BASE_URL)
    _save_cli_config(config)

    print('Saved hosted mode.')
    print('Next steps:')
    print('  1. Run `velocitybrain doctor` to verify hosted connectivity')
    print('  2. Run `codex mcp add velocitybrain -- velocitybrain serve mcp`')
    print('  3. Open Codex or another MCP client and start using Velocity Brain')
    return 0


def _handle_no_command(parser: argparse.ArgumentParser) -> int:
    config = _load_cli_config()
    if _is_interactive_terminal():
        if not config.get('runtime_mode'):
            return _interactive_onboarding()
        print('Velocity Brain is already configured.')
        print(f"  runtime_mode: {config.get('runtime_mode', _resolve_runtime_mode())}")
        print(f"  base_url: {config.get('base_url', DEFAULT_CLOUD_BASE_URL)}")
        print(f"  api_key: {_mask_secret(config.get('api_key') or os.getenv('VELOCITYBRAIN_API_KEY'))}")
        print('Use `velocitybrain serve mcp` to start the MCP bridge or `velocitybrain about` for more details.')
        return 0

    parser.print_help()
    return 1


def _use_color(args: argparse.Namespace) -> bool:
    if getattr(args, 'color', False):
        return True
    if getattr(args, 'no_color', False):
        return False
    if os.getenv('NO_COLOR'):
        return False
    return sys.stdout.isatty()


def _style(text: str, *styles: str, color: bool = True) -> str:
    if not color:
        return text
    return f"{''.join(styles)}{text}{RESET}"


def _print_json(payload: Any) -> None:
    if isinstance(payload, dict) and '_color' in payload:
        payload = {k: v for k, v in payload.items() if k != '_color'}
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _print_section(title: str, rows: list[str], *, color: bool = False) -> None:
    print(_style(title, BOLD, WHITE, color=color))
    for row in rows:
        print(_style(f'  {row}', SLATE, color=color))


def _emit(args: argparse.Namespace, payload: dict[str, Any], renderer) -> None:
    if getattr(args, 'json', False):
        _print_json(payload)
        return
    renderer(payload)


def _proof_payload(result: dict[str, Any]) -> dict[str, Any]:
    return {
        'result': result.get('result', ''),
        'reused': bool(result.get('reused', False)),
        'reuse_confidence': float(result.get('reuse_confidence', 0.0)),
        'tokens_saved': int(result.get('tokens_saved', 0)),
        'percent_saved': float(result.get('percent_saved', 0.0)),
    }


def _render_banner(banner: str, color: bool) -> None:
    lines = banner.strip('\n').splitlines()
    velocity_split = 6
    ascii_map = str.maketrans({'█': '#', '╗': '+', '╝': '+', '╚': '+', '╔': '+', '═': '-', '║': '|'})
    for i, line in enumerate(lines):
        if not line.strip():
            print('')
            continue
        
        if not color:
            print(line.translate(ascii_map))
            continue
        
        # Apply a multi-color 3D effect: Blocks get primary color, structural borders get white
        base_color = ORANGE if i < velocity_split else BLUE
        
        colored_line = ""
        for char in line:
            if char == '█':
                colored_line += f"{BOLD}{base_color}█{RESET}"
            elif char in '╗╝╚╔═║':
                colored_line += f"{BOLD}{WHITE}{char}{RESET}"
            else:
                colored_line += char
        print(colored_line)


def _render_about(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _render_banner(BANNER, use_color)
    company_sources = payload.get('company_sources') or []
    _print_section(
        BRAND,
        [
            f"mode: {payload['mode']}",
            "positioning: hosted memory and reuse for coding agents",
            "core_value: avoid paying for the same tokens twice",
            f"company_sources: {', '.join(company_sources) if company_sources else 'none'}",
            f"commands: {', '.join(payload['commands'])}",
            f"mcp_entry: {payload['entrypoints']['mcp']}",
            "open_source: sdk + mcp bridge + integrations",
            "proprietary: hosted reuse engine + retrieval + savings analytics",
        ],
        color=use_color,
    )


def _render_init(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        f'{BRAND} init',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"app: {payload['app']}",
            f"status: {payload['status']}",
            f"env: {payload['env']}",
            f"skills_loaded: {payload['skills_loaded']}",
            f"skills_validated: {payload.get('skills_validated', 'n/a')}",
            f"skills_invalid: {payload.get('skills_invalid', 'n/a')}",
            f"database_url: {payload['database_url']}",
            f"identity_source: {payload['identity_source']}",
            f"schema_bootstrap: {payload.get('schema_bootstrap', 'skipped')}",
        ],
        color=use_color,
    )


def _render_ingest(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'ingested',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"slug: {payload.get('slug', 'n/a')}",
            f"title: {payload.get('title', payload.get('source', 'n/a'))}",
            f"type: {payload.get('type', 'batch')}",
            f"sections: {payload.get('sections', 'n/a')}",
            f"ingested_count: {payload.get('ingested', 1)}",
        ],
        color=use_color,
    )


def _render_query(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    refs = payload.get('references', [])
    reuse = payload.get('reuse', {})
    savings = payload.get('savings', {})
    _print_section(
        'query result',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"answer: {payload['answer']}",
            f"confidence: {payload['confidence']}",
            f"references: {len(refs)}",
            f"reuse_hit: {reuse.get('hit_type', 'none')}",
            f"artifacts_used: {len(reuse.get('artifacts_used', []))}",
            f"avoided_tokens: {savings.get('avoided_input_tokens', 0)}",
            f"saved_cost_usd: {savings.get('estimated_cost_saved', 0.0)}",
            f"saved_percent: {savings.get('saved_percent', 0.0)}",
            f"reasoning: {payload['reasoning_summary']}",
        ],
        color=use_color,
    )


def _render_run(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'agent run',
        [
            f"reused: {payload.get('reused', False)}",
            f"tokens_saved: {payload.get('tokens_saved', 0)}",
            f"percent_saved: {payload.get('percent_saved', 0.0)}",
            f"reuse_confidence: {payload.get('reuse_confidence', 0.0)}",
        ],
        color=use_color,
    )


def _render_skills(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    skills = payload.get('skills', [])
    _print_section('skills', [f"trace_id: {payload.get('trace_id', 'n/a')}", f"count: {payload.get('count', 0)}"], color=use_color)
    for skill in skills:
        print(_style(f"  - [{skill.get('category', 'uncategorized')}] {skill.get('name', 'unnamed-skill')}", SLATE, color=use_color))


def _render_doctor(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    checks = payload.get('checks', {})
    _print_section('doctor', [f"trace_id: {payload.get('trace_id', 'n/a')}", f"ok: {payload.get('ok', False)}"], color=use_color)
    for key in sorted(checks.keys()):
        mark = 'PASS' if checks[key] else 'FAIL'
        tone = ORANGE if checks[key] else BLUE
        print(_style(f'  - {key}: {mark}', tone, color=use_color))
    details = payload.get('details', {})
    if details:
        for key in ['runtime_mode', 'base_url', 'dashboard_url', 'config_path', 'api_key', 'connected_sources']:
            if key in details:
                print(_style(f"  {key}: {details[key]}", SLATE, color=use_color))


def _render_integrations(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'integrations',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"count: {payload.get('connected_source_count', 0)}",
            f"summary: {payload.get('source_coverage_summary', 'No company sources connected yet')}",
        ],
        color=use_color,
    )
    for item in payload.get('integrations', []):
        status = item.get('status') or ('connected' if item.get('connected') else 'not_connected')
        line = f"  - {item.get('provider')}: {status}"
        if item.get('display_name'):
            line += f" ({item['display_name']})"
        print(_style(line, SLATE, color=use_color))


def _render_sync(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'sync',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"operation: {payload.get('operation')}",
            f"status: {payload.get('status')}",
            f"dry_run: {payload.get('dry_run')}",
            f"repos: {len(payload.get('repos', []))}",
            f"ingested_entities: {payload.get('ingested_entities', 0)}",
        ],
        color=use_color,
    )


def _render_identity(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    policies = payload.get('runtime_policies', {})
    _print_section(
        'identity',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"name: {payload.get('name', 'n/a')}",
            f"version: {payload.get('version', 'n/a')}",
            f"source: {payload.get('source', 'n/a')}",
            f"agents_md_present: {payload.get('agents_md', {}).get('present', False)}",
            f"destructive_tools_require_approval: {policies.get('destructive_tools_require_approval', True)}",
        ],
        color=use_color,
    )


def _render_openclaw_profile(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    server = payload.get('server', {})
    defaults = payload.get('defaults', {})
    capabilities = payload.get('capabilities', {})
    _print_section(
        'openclaw profile',
        [
            f"name: {payload.get('name', 'n/a')}",
            f"client: {payload.get('client', 'n/a')}",
            f"server_command: {server.get('command', 'n/a')}",
            f"server_args: {' '.join(server.get('args', []))}",
            f"destructive_tools_allowed: {defaults.get('destructive_tools_allowed', False)}",
            f"traceability: {defaults.get('traceability', True)}",
            f"tool_count: {capabilities.get('tool_count', 0)}",
            f"skill_count: {capabilities.get('skill_count', 0)}",
            f"response_styles: {', '.join(capabilities.get('response_styles', ['normal']))}",
        ],
        color=use_color,
    )
    print(_style('  tools: ' + ', '.join(capabilities.get('tools', [])), SLATE, color=use_color))
    print(_style('  smoke_flow: ' + ' -> '.join(payload.get('recommended_smoke_flow', [])), SLATE, color=use_color))


def _render_status(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    skills = payload.get('skills', {})
    openclaw = payload.get('openclaw', {})
    audit = payload.get('audit', {})
    savings = payload.get('savings', {})
    recent_runs = payload.get('recent_runs', [])
    wedge = payload.get('wedge', {})
    latest = audit.get('latest_event') or {}
    latest_label = 'none'
    if latest:
        latest_label = ' | '.join(str(part) for part in [latest.get('event_type'), latest.get('actor'), latest.get('created_at')] if part)

    _print_section(
        'runtime status',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"app: {payload.get('app', 'n/a')}",
            f"env: {payload.get('env', 'n/a')}",
            f"api_ok: {payload.get('health', {}).get('ok', False)}",
            f"skills_count: {skills.get('count', 0)}",
            f"skill_categories: {', '.join(skills.get('categories', []))}",
            f"openclaw_tool_count: {openclaw.get('tool_count', 0)}",
            f"openclaw_skill_count: {openclaw.get('skill_count', 0)}",
            f"saved_tokens_total: {savings.get('total_saved_tokens', 0)}",
            f"runs_total: {savings.get('run_count', 0)}",
            f"saved_cost_total_usd: {savings.get('total_saved_cost', 0.0)}",
            f"reuse_hit_rate: {savings.get('reuse_hit_rate', 0.0)}",
            f"avg_tokens_saved: {savings.get('average_saved_tokens', 0.0)}",
            f"avg_saved_percent: {savings.get('average_saved_percent', 0.0)}",
            f"repeat_rate: {savings.get('repeat_rate', 0.0)}",
            f"repeat_usage_per_session: {savings.get('repeat_usage_per_session', 0)}",
            f"best_repo: {wedge.get('best_repo', 'n/a')}",
            f"best_repo_savings: {wedge.get('best_savings', 0.0)}",
            f"reuse_trend: {wedge.get('reuse_rate_trend', 0.0)}",
            f"savings_trend: {wedge.get('savings_trend', 0.0)}",
            f"repeat_signal: {'strong' if savings.get('repeat_rate', 0.0) >= 50 else 'weak'}",
            f"failure_count: {savings.get('failure_count', 0)}",
            f"blacklist_size: {savings.get('blacklist_size', 0)}",
            f"audit_available: {audit.get('available', False)}",
            f"audit_recent_count: {audit.get('count', 0)}",
            f"audit_latest: {latest_label}",
            f"generated_at: {payload.get('generated_at', 'n/a')}",
        ],
        color=use_color,
    )
    failure_types = savings.get('top_failure_types', [])
    if failure_types:
        print(_style('  top_failure_types: ' + ', '.join(f"{item.get('failure_type')}={item.get('count')}" for item in failure_types), SLATE, color=use_color))
    top_clusters = savings.get('top_failure_clusters', [])
    if top_clusters:
        print(_style('  top_failure_clusters: ' + ', '.join(f"{item.get('failure_type')}@{item.get('repo_id')}={item.get('count')}" for item in top_clusters), SLATE, color=use_color))
    if recent_runs:
        print(_style('  last_5_runs:', SLATE, color=use_color))
        for run in recent_runs[:5]:
            print(_style(
                f"    reused={run.get('reused', False)} tokens_saved={run.get('tokens_saved', 0)} percent_saved={run.get('percent_saved', 0.0)}",
                SLATE,
                color=use_color,
            ))


def _render_quickstart(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'quickstart',
        [
            f"reused: {payload.get('reused', False)}",
            f"tokens_saved: {payload.get('tokens_saved', 0)}",
            f"percent_saved: {payload.get('percent_saved', 0.0)}",
            f"reuse_confidence: {payload.get('reuse_confidence', 0.0)}",
        ],
        color=use_color,
    )


def _render_share_run(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'share-run',
        [
            'VelocityBrain Run Proof',
            f"reused: {payload.get('reused', False)}",
            f"tokens_saved: {payload.get('tokens_saved', 0)}",
            f"percent_saved: {payload.get('percent_saved', 0.0)}",
            f"reuse_confidence: {payload.get('reuse_confidence', 0.0)}",
        ],
        color=use_color,
    )


def _render_debug_run(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'debug-run',
        [
            f"repo_id: {payload.get('repo_id', 'n/a')}",
            f"repeat_count: {payload.get('repeat_count', 0)}",
            f"reuse_rate: {payload.get('reuse_rate', 0.0)}",
            f"average_saved_percent: {payload.get('average_saved_percent', 0.0)}",
            f"average_tokens_saved: {payload.get('average_tokens_saved', 0.0)}",
            f"failure_cases: {len(payload.get('failure_cases', []))}",
        ],
        color=use_color,
    )
    for scenario in payload.get('scenario_reports', []):
        print(_style(f"  scenario: {scenario.get('scenario_id')} | {scenario.get('title')}", WHITE, color=use_color))
        print(_style(
            f"  summary: reuse_rate={scenario.get('reuse_rate', 0.0)}% | avg_saved={scenario.get('average_saved_percent', 0.0)}%",
            SLATE,
            color=use_color,
        ))
        for run in scenario.get('runs', []):
            debug = run.get('debug', {})
            truth = run.get('truth_report', {})
            savings = run.get('savings', {})
            reuse = run.get('reuse', {})
            print(_style(
                '  '
                + f"run {run.get('run_index')}: hit={reuse.get('hit_type', 'none')} "
                + f"artifact={debug.get('matched_artifact_id') or 'none'} "
                + f"confidence={reuse.get('confidence', 0.0)} "
                + f"saved={truth.get('tokens_saved', 0)} tokens ({truth.get('percent_saved', 0.0)}%) "
                + f"correct={truth.get('correct_reuse', False)}",
                SLATE,
                color=use_color,
            ))
            print(_style(f"    task: {run.get('task', '')}", SLATE, color=use_color))
            print(_style(
                f"    why: {debug.get('why', 'n/a')} | without_reuse={savings.get('input_tokens_without_reuse', 0)} | with_reuse={savings.get('input_tokens_actual', 0)}",
                SLATE,
                color=use_color,
            ))
            skipped = ', '.join(debug.get('skipped', [])) or 'none'
            print(_style(f"    skipped: {skipped}", SLATE, color=use_color))
            if run.get('failures'):
                print(_style(f"    failures: {', '.join(run['failures'])}", BLUE, color=use_color))
    if payload.get('failure_cases'):
        print(_style('  logged_failures:', WHITE, color=use_color))
        for failure in payload['failure_cases']:
            print(_style(
                f"    {failure.get('run_id')}: {', '.join(failure.get('failures', []))} | hit={failure.get('reuse_hit_type', 'none')}",
                BLUE,
                color=use_color,
            ))


def _render_caveman_output(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        payload.get('mode', 'caveman'),
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"output: {payload.get('output', '')}",
        ],
        color=use_color,
    )


def _render_caveman_compress(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'caveman-compress',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"file: {payload.get('file', 'n/a')}",
            f"backup_file: {payload.get('backup_file', 'none')}",
            f"response_style: {payload.get('response_style', 'normal')}",
            f"before_tokens: {payload.get('before_tokens', 0)}",
            f"after_tokens: {payload.get('after_tokens', 0)}",
            f"reduction_ratio: {payload.get('reduction_ratio', 0.0)}",
            f"validation_ok: {payload.get('validation', {}).get('ok', False)}",
        ],
        color=use_color,
    )


def _render_config(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        payload.get('title', 'config'),
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"runtime_mode: {payload.get('runtime_mode', 'n/a')}",
            f"base_url: {payload.get('base_url', DEFAULT_CLOUD_BASE_URL)}",
            f"api_key: {payload.get('api_key', 'not-set')}",
            f"config_path: {payload.get('config_path', str(CONFIG_PATH))}",
            f"status: {payload.get('status', 'ok')}",
        ],
        color=use_color,
    )
    if payload.get('hint'):
        print(_style(f"  hint: {payload['hint']}", SLATE, color=use_color))


def _render_smoke(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'smoke',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"runtime_mode: {payload.get('runtime_mode', 'n/a')}",
            f"ok: {payload.get('ok', False)}",
            f"steps_passed: {payload.get('passed', 0)}/{len(payload.get('steps', []))}",
        ],
        color=use_color,
    )
    for step in payload.get('steps', []):
        status = 'PASS' if step.get('ok') else 'FAIL'
        print(_style(f"  - {step.get('name', 'step')}: {status} | {step.get('detail', '')}", SLATE, color=use_color))


def _render_connect(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'connect',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"client: {payload.get('client', 'n/a')}",
            f"runtime_mode: {payload.get('runtime_mode', 'n/a')}",
            f"applied: {payload.get('applied', False)}",
        ],
        color=use_color,
    )
    if payload.get('command'):
        print(_style(f"  command: {payload['command']}", SLATE, color=use_color))
    if payload.get('config'):
        print(_style('  config:', SLATE, color=use_color))
        print(payload['config'])
    if payload.get('config_path'):
        print(_style(f"  config_path: {payload['config_path']}", SLATE, color=use_color))
    if payload.get('hint'):
        print(_style(f"  hint: {payload['hint']}", SLATE, color=use_color))


def _payload_init(bootstrap: bool = False) -> dict[str, Any]:
    skills = SkillRegistry(settings.skills_path).list_skills()
    validation = validate_skill_inventory(skills)
    payload = {
        'app': settings.app_name,
        'status': 'initialized',
        'env': settings.env,
        'database_url': settings.database_url,
        'skills_loaded': len(skills),
        'skills_validated': validation['valid_count'],
        'skills_invalid': validation['invalid_count'],
        'identity_source': settings.identity_spec_path,
        'trace_id': f'init-{len(skills)}-{settings.env}',
    }
    if bootstrap:
        try:
            payload['schema_bootstrap'] = bootstrap_schema(settings.embed_dim)
        except Exception as exc:
            payload['schema_bootstrap'] = {'ok': False, 'error': str(exc)}
    return payload


def cmd_about(args: argparse.Namespace) -> int:
    runtime_mode = _resolve_runtime_mode(args)
    connected_sources = _cloud_connected_sources() if runtime_mode == RUNTIME_MODE_CLOUD else []
    payload = {
        'app': settings.app_name,
        'mode': runtime_mode,
        'commands': ['quickstart', 'run', 'status', 'share-run'],
        'entrypoints': {'mcp': 'velocitybrain serve mcp'},
        'embedding': {
            'provider': settings.embedding_provider,
            'model': settings.embedding_model,
            'dim': settings.embed_dim,
            'router': settings.model_router,
        },
        'company_sources': connected_sources,
        'trace_id': f'about-{runtime_mode}',
        '_color': _use_color(args),
    }
    _emit(args, payload, _render_about)
    return 0


def cmd_init(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        config = _cloud_config()
        payload = {
            'app': settings.app_name,
            'status': 'initialized' if config.get('api_key') else 'awaiting-api-key',
            'env': 'cloud',
            'database_url': 'managed-by-velocitybrain-cloud',
            'skills_loaded': 0,
            'skills_validated': 0,
            'skills_invalid': 0,
            'identity_source': str(CONFIG_PATH),
            'trace_id': 'init-cloud',
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_init)
        return 0 if config.get('api_key') else 1
    payload = _payload_init(bootstrap=args.bootstrap_schema)
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_init)
    return 0


def _safe_file_path(file_path: str) -> Path:
    p = Path(file_path).expanduser().resolve()
    if settings.allow_unsafe_file_reads:
        return p
    root = Path(settings.workspace_root).resolve()
    if p != root and root not in p.parents:
        raise ValueError(f'file outside workspace root: {p}')
    return p


def _load_content(content: str | None, content_file: str | None) -> str:
    if content is not None:
        return content
    if content_file is None:
        raise ValueError('Provide --content or --content-file')
    p = _safe_file_path(content_file)
    if p.stat().st_size > MAX_INGEST_FILE_BYTES:
        raise ValueError(f'content file too large: {p}')
    return p.read_text(encoding='utf-8')


def cmd_ingest(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        try:
            with _cloud_client() as client:
                if args.org_file:
                    content = _safe_file_path(args.org_file).read_text(encoding='utf-8')
                else:
                    content = _load_content(args.content, args.content_file)
                result = client.ingest(content=content, source=args.source)
        except Exception as exc:
            result = {
                'message': f'Hosted ingest failed: {exc}',
                'document_id': 'n/a',
                'trace_id': 'ingest-cloud-failed',
            }
            exit_code = 1
        else:
            result = {
                'message': result.get('message', 'Content ingested successfully'),
                'document_id': result.get('document_id', 'cloud'),
                'trace_id': result.get('trace_id', f'ingest-cloud-{args.source}'),
            }
            exit_code = 0
        payload = {
            'slug': result.get('document_id', 'cloud'),
            'title': args.source,
            'type': 'cloud',
            'sections': 1,
            'ingested': 1 if exit_code == 0 else 0,
            'trace_id': result.get('trace_id'),
            '_color': _use_color(args),
        }
        payload['title'] = result.get('message', payload['title'])
        _emit(args, payload, _render_ingest)
        return exit_code
    if args.org_file:
        p = _safe_file_path(args.org_file)
        res = OrgIngestService().ingest_file(args.source, str(p), args.access_level)
    else:
        content = _load_content(args.content, args.content_file)
        res = MemoryEngine().upsert_from_text(args.source, content, args.access_level)
    res['trace_id'] = res.get('trace_id') or f'ingest-{args.source}'
    res['_color'] = _use_color(args)
    _emit(args, res, _render_ingest)
    return 0


def _query_payload(question: str, limit: int, response_style: str = 'normal') -> dict[str, Any]:
    try:
        hits = RetrievalEngine().hybrid_search(question, limit=limit)
    except Exception as exc:
        return apply_response_style({
            'answer': 'Query failed because the local database is not ready.',
            'confidence': 0.0,
            'references': [],
            'reasoning_summary': (
                'Database lookup failed. Run velocitybrain doctor after starting the DB (docker compose up db -d). '
                f'DATABASE_URL check failed. error={exc}'
            ),
            'error': 'database_unavailable',
            'trace_id': f'query-unavailable-{limit}',
        }, response_style)
    if not hits:
        return apply_response_style({
            'answer': 'The internal brain does not currently contain sufficient data for this question.',
            'confidence': 0.22,
            'references': [],
            'reasoning_summary': 'Brain-first lookup completed with zero hits. No hallucinated answer returned.',
            'trace_id': f'query-{limit}',
        }, response_style)

    top = hits[0]
    return apply_response_style({
        'answer': f"{top['title']}: {top['compiled_truth_md'][:400]}",
        'confidence': float(top['confidence']),
        'references': [{'type': 'entity', 'slug': h['slug'], 'title': h['title']} for h in hits],
        'reasoning_summary': f'Hybrid retrieval returned {len(hits)} internal matches; top-ranked entity used for synthesis.',
        'trace_id': f'query-{limit}-{len(hits)}',
    }, response_style)


def cmd_query(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        try:
            with _cloud_client() as client:
                result = client.query(args.question, response_style=args.response_style, max_results=args.limit)
            payload = _normalize_cloud_query(result, trace_id=f'query-cloud-{args.limit}')
            exit_code = 0
        except Exception as exc:
            payload = {
                'answer': f'Hosted query failed: {exc}',
                'confidence': 0.0,
                'references': [],
                'reasoning_summary': 'Hosted Velocity Brain request could not be completed.',
                'error': 'cloud_unavailable',
                'trace_id': f'query-cloud-failed-{args.limit}',
            }
            exit_code = 1
        payload['_color'] = _use_color(args)
        _emit(args, payload, _render_query)
        return exit_code
    payload = _query_payload(args.question, args.limit, response_style=args.response_style)
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_query)
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    use_local_proof = getattr(args, 'repo_path', None) or not _has_cloud_credentials()
    if use_local_proof:
        proof = AdoptionService().run_task(args.signal, repo_path=getattr(args, 'repo_path', None))
        payload = _proof_payload(proof)
        payload['_color'] = _use_color(args)
        _emit(args, payload, _render_run)
        if proof.get('failures'):
            print('VelocityBrain logged a proof failure because reuse savings were not clearly visible.')
        return 0 if not proof.get('failures') else 1
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        try:
            with _cloud_client() as client:
                result = client.run(args.signal, response_style=args.response_style)
            payload = _normalize_cloud_run(result, args.signal, trace_id='run-cloud')
            exit_code = 0
        except Exception as exc:
            payload = {
                'run_id': 'n/a',
                'signal': args.signal,
                'status': 'failed',
                'intent': 'cloud-task',
                'plan': [],
                'actions': [],
                'memory_updates': [],
                'confidence': 0.0,
                'attention_score': 0.0,
                'reasoning_summary': f'Hosted Velocity Brain request failed: {exc}',
                'references': [],
                'error': 'cloud_unavailable',
                'trace_id': 'run-cloud-failed',
            }
            exit_code = 1
        payload = apply_response_style(payload, args.response_style)
        payload['_color'] = _use_color(args)
        _emit(args, payload, _render_run)
        return exit_code
    try:
        from src.services.agent_loop import AgentLoop

        payload = AgentLoop().run(args.signal)
    except Exception as exc:
        payload = {
            'run_id': 'n/a',
            'signal': args.signal,
            'status': 'failed',
            'intent': 'unknown',
            'plan': [],
            'actions': [],
            'memory_updates': [],
            'confidence': 0.0,
            'attention_score': 0.0,
            'reasoning_summary': (
                'Agent run failed because required local services are not ready. '
                'Run velocitybrain doctor after starting the DB (docker compose up db -d). '
                f'error={exc}'
            ),
            'references': [],
            'error': 'runtime_unavailable',
            'trace_id': f'run-failed-{args.signal[:20]}',
        }
    payload = apply_response_style(payload, args.response_style)
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_run)
    return 0 if payload.get('status') != 'failed' else 1


def cmd_skills(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        try:
            with _cloud_client() as client:
                result = client.list_skills(category=args.category)
            filtered = result.get('skills', [])
            if args.limit:
                filtered = filtered[: args.limit]
            payload = {
                'count': len(filtered),
                'skills': filtered,
                'trace_id': result.get('trace_id', f'skills-cloud-{len(filtered)}'),
                '_color': _use_color(args),
            }
            _emit(args, payload, _render_skills)
            return 0
        except Exception as exc:
            payload = {'count': 0, 'skills': [], 'trace_id': 'skills-cloud-failed', '_color': _use_color(args)}
            _emit(args, payload, _render_skills)
            print(f'Hosted skills lookup failed: {exc}')
            return 1
    all_skills = SkillRegistry(settings.skills_path).list_skills()
    filtered = all_skills
    if args.category:
        filtered = [s for s in filtered if s.get('category') == args.category]
    if args.limit:
        filtered = filtered[: args.limit]
    payload = {'count': len(filtered), 'skills': filtered, 'trace_id': f'skills-{len(filtered)}', '_color': _use_color(args)}
    _emit(args, payload, _render_skills)
    return 0


def _doctor_payload() -> dict[str, Any]:
    checks = {'config': True, 'skills_path': True, 'database': False, 'identity_spec': False}
    try:
        from src.core.db import get_conn

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1 AS ok')
                row = cur.fetchone()
                checks['database'] = bool(row and row.get('ok') == 1)
    except Exception:
        checks['database'] = False

    checks['skills_path'] = SkillRegistry(settings.skills_path).skills_root.exists()
    checks['identity_spec'] = Path(settings.identity_spec_path).exists()
    return {'ok': all(checks.values()), 'checks': checks, 'trace_id': 'doctor-check'}


def _print_legacy_warning(message: str) -> None:
    print(f'Legacy mode notice: {message}')


def cmd_doctor(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        cloud_cfg = _cloud_config()
        try:
            with _cloud_client() as client:
                result = client.get_health()
                integrations = client.get_integrations()
            payload = _normalize_cloud_health(result, trace_id='doctor-cloud')
            payload['checks'].setdefault('api_key', bool(cloud_cfg.get('api_key')))
            payload['checks'].setdefault('base_url', bool(cloud_cfg.get('base_url')))
            payload['checks'].setdefault('company_sources', (integrations.get('connectedSourceCount') or 0) > 0)
            _, sync_note = _flush_pending_integrations()
            payload['integration_sync'] = sync_note
            payload['details'] = {
                **payload.get('details', {}),
                'connected_sources': ', '.join(integrations.get('connectedSources') or []) or 'none'
            }
            exit_code = 0 if payload['ok'] else 1
        except Exception as exc:
            details = _cloud_error_details(exc)
            payload = {
                'ok': False,
                'checks': {
                    **details['checks'],
                    'base_url': bool(cloud_cfg.get('base_url')),
                },
                'error': details['status'],
                'message': details['message'],
                'hint': details['hint'],
                'base_url': cloud_cfg.get('base_url', DEFAULT_CLOUD_BASE_URL),
                'trace_id': 'doctor-cloud-failed',
            }
            exit_code = 1
        if getattr(args, 'verbose', False):
            payload['details'] = _doctor_details(RUNTIME_MODE_CLOUD)
        payload['_color'] = _use_color(args)
        _emit(args, payload, _render_doctor)
        if payload.get('message'):
            print(payload['message'])
        if payload.get('hint'):
            print(payload['hint'])
        return exit_code
    payload = _doctor_payload()
    if getattr(args, 'verbose', False):
        payload['details'] = _doctor_details(RUNTIME_MODE_SELF_HOSTED)
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_doctor)
    _print_legacy_warning('self-hosted checks are deprecated. Prefer hosted mode with `velocitybrain login`.')
    return 0 if payload['ok'] else 1


def cmd_sync(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        payload = {
            'trace_id': 'sync-cloud-disabled',
            'operation': 'sync',
            'status': 'unsupported-in-cloud-cli',
            'dry_run': True,
            'repos': args.repo or [],
            'ingested_entities': 0,
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_sync)
        print('Repository sync is only available in legacy self-hosted mode and is not part of the primary hosted product.')
        return 1
    _print_legacy_warning('repository sync is a deprecated self-hosted workflow.')
    repos = args.repo or [str(Path(settings.workspace_root).resolve())]
    payload = SyncService().full_sync(repos=repos, dry_run=not args.apply, include_org=not args.no_org)
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_sync)
    return 0


def cmd_identity(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        payload = {
            'name': BRAND,
            'version': 'cloud',
            'source': str(CONFIG_PATH),
            'agents_md': {'present': Path('AGENTS.md').exists()},
            'runtime_policies': {'destructive_tools_require_approval': True},
            'trace_id': 'identity-cloud',
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_identity)
        return 0
    payload = IdentitySpecService().get()
    payload['trace_id'] = payload.get('trace_id') or 'identity-spec'
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_identity)
    _print_legacy_warning('local identity output is deprecated. Hosted identity and policy apply by default.')
    return 0


def cmd_openclaw(args: argparse.Namespace) -> int:
    payload = build_openclaw_profile()
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        payload['server'] = {'command': 'velocitybrain', 'args': ['serve', 'mcp']}
        payload.setdefault('defaults', {})['destructive_tools_allowed'] = False
    payload['trace_id'] = payload.get('trace_id') or 'openclaw-profile'
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_openclaw_profile)
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    if _resolve_runtime_mode(args) == RUNTIME_MODE_CLOUD:
        try:
            with _cloud_client() as client:
                result = client.get_status()
            payload = _normalize_cloud_status(result, trace_id='status-cloud')
            user_id = _cloud_config().get('api_key') or 'anonymous'
            service = ReuseService()
            payload['wedge'] = service.get_wedge_insights(user_id)
            payload['recent_runs'] = service.get_recent_runs_for_user(user_id, limit=5)
            payload['savings']['failure_count'] = len([run for run in payload['recent_runs'] if run.get('tokens_saved', 0) == 0 and run.get('reused')])
            payload['savings']['blacklist_size'] = service.get_savings_overview().get('blacklist_size', 0)
            payload['savings']['top_failure_types'] = service.get_savings_overview().get('top_failure_types', [])
            payload['savings']['top_failure_clusters'] = service.get_savings_overview().get('top_failure_clusters', [])
            exit_code = 0
        except Exception as exc:
            payload = _normalize_cloud_status({'status': 'down'}, trace_id='status-cloud-failed')
            local_usage = AdoptionService().usage_summary()
            payload['savings'] = {
                'run_count': local_usage['runs_total'],
                'repeat_rate': local_usage.get('repeat_rate', 0.0),
                'reuse_hit_rate': local_usage['reuse_hit_rate'],
                'average_saved_tokens': local_usage['avg_token_savings'],
                'average_saved_percent': local_usage['avg_token_savings_percent'],
                'failure_count': local_usage['failure_count'],
                'blacklist_size': local_usage['blacklist_size'],
                'top_failure_types': local_usage['top_failure_types'],
                'top_failure_clusters': local_usage['top_failure_clusters'],
            }
            payload['recent_runs'] = local_usage.get('recent_runs', [])
            payload['wedge'] = local_usage.get('wedge_insights', {})
            print(f'Hosted status failed: {exc}')
            exit_code = 1
        payload['_color'] = _use_color(args)
        _emit(args, payload, _render_status)
        return exit_code
    payload = build_runtime_status(audit_limit=5)
    local_usage = AdoptionService().usage_summary()
    payload['savings'].update({
        'run_count': local_usage['runs_total'],
        'repeat_rate': local_usage.get('repeat_rate', 0.0),
        'reuse_hit_rate': local_usage['reuse_hit_rate'],
        'average_saved_tokens': local_usage['avg_token_savings'],
        'average_saved_percent': local_usage['avg_token_savings_percent'],
        'total_saved_tokens': local_usage['saved_tokens_total'],
        'repeat_usage_per_session': local_usage['repeat_usage_per_session'],
        'failure_count': local_usage['failure_count'],
        'blacklist_size': local_usage['blacklist_size'],
        'top_failure_types': local_usage['top_failure_types'],
        'top_failure_clusters': local_usage['top_failure_clusters'],
    })
    payload['recent_runs'] = local_usage.get('recent_runs', [])
    payload['wedge'] = local_usage.get('wedge_insights', {})
    payload['trace_id'] = payload.get('trace_id') or 'runtime-status'
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_status)
    return 0


def _maybe_save_api_key(api_key: str | None) -> None:
    if not api_key:
        return
    config = _load_cli_config()
    config['api_key'] = api_key
    config['runtime_mode'] = RUNTIME_MODE_CLOUD
    config.setdefault('base_url', DEFAULT_CLOUD_BASE_URL)
    _save_cli_config(config)


def _pending_integrations(config: dict[str, Any]) -> list[dict[str, Any]]:
    pending = config.get('pending_integrations') or []
    return pending if isinstance(pending, list) else []


def _remember_registered_agent(agent_id: str) -> None:
    config = _load_cli_config()
    registered = config.get('registered_agents') or []
    if not isinstance(registered, list):
        registered = []
    if agent_id not in registered:
        registered.append(agent_id)
    config['registered_agents'] = registered
    config['preferred_agent'] = agent_id
    _save_cli_config(config)


def _queue_pending_integration(agent_id: str, repo_path: str | None = None, *, status: str = 'connected', metadata: dict[str, Any] | None = None) -> str:
    repo = Path(repo_path).resolve() if repo_path else Path.cwd().resolve()
    repo_name = repo.name or 'default-workspace'
    repo_id = repo_name
    config = _load_cli_config()
    pending = _pending_integrations(config)
    record = {
        'agent_id': agent_id,
        'status': status,
        'repo_id': repo_id,
        'repo_name': repo_name,
        'repo_path': str(repo),
        'metadata': metadata or {},
    }

    dedupe_key = (agent_id, repo_id, str(repo), status)
    filtered = [
        item for item in pending
        if (item.get('agent_id'), item.get('repo_id'), item.get('repo_path'), item.get('status')) != dedupe_key
    ]
    filtered.append(record)
    config['pending_integrations'] = filtered
    _save_cli_config(config)
    return f'Queued {agent_id} integration for repo {repo_name}; it will sync automatically once the API key is available.'


def _flush_pending_integrations() -> tuple[bool, str]:
    config = _load_cli_config()
    pending = _pending_integrations(config)
    if not pending:
        return True, 'No pending Velocity Brain integrations to sync.'

    api_key = _cloud_config().get('api_key')
    if not api_key:
        return False, 'Pending Velocity Brain integrations are waiting for an API key and will sync automatically later.'

    synced = 0
    remaining: list[dict[str, Any]] = []
    try:
        with VelocityBrainClient(api_key, _cloud_config()['base_url']) as client:
            for item in pending:
                try:
                    client.report_integration(
                        agent_id=item['agent_id'],
                        status=item.get('status', 'connected'),
                        repo_id=item.get('repo_id'),
                        repo_name=item.get('repo_name'),
                        repo_path=item.get('repo_path'),
                        metadata=item.get('metadata') or {},
                    )
                    synced += 1
                except Exception:
                    remaining.append(item)
    except Exception as exc:
        return False, f'Pending integration sync failed: {exc}'

    config['pending_integrations'] = remaining
    _save_cli_config(config)
    if remaining:
        return False, f'Synced {synced} pending integrations; {len(remaining)} still waiting to retry.'
    return True, f'Synced {synced} pending integrations to the hosted dashboard.'


def _report_agent_connection(agent_id: str, repo_path: str | None = None, *, status: str = 'connected', metadata: dict[str, Any] | None = None) -> tuple[bool, str]:
    try:
        _remember_registered_agent(agent_id)
        config = _cloud_config()
        api_key = config.get('api_key')
        if not api_key:
            return False, _queue_pending_integration(agent_id, repo_path, status=status, metadata=metadata)

        repo = Path(repo_path).resolve() if repo_path else Path.cwd().resolve()
        repo_name = repo.name
        repo_id = repo_name or 'default-workspace'

        with VelocityBrainClient(api_key, config['base_url']) as client:
            client.report_integration(
                agent_id=agent_id,
                status=status,
                repo_id=repo_id,
                repo_name=repo_name,
                repo_path=str(repo),
                metadata=metadata or {},
            )
        flush_ok, flush_note = _flush_pending_integrations()
        base_note = f'Reported {agent_id} integration for repo {repo_name} to the hosted dashboard.'
        return True, f'{base_note}\n{flush_note}' if flush_note else base_note
    except Exception as exc:
        queued = _queue_pending_integration(agent_id, repo_path, status=status, metadata=metadata)
        return False, f'Velocity Brain integration reporting failed for {agent_id}: {exc}\n{queued}'


def _velocitybrain_agents_instructions() -> str:
    return """# Velocity Brain Agent Instructions

Use the `velocitybrain` MCP server automatically for repository-internal knowledge, repo context, and durable writeback.

Always call Velocity Brain MCP before answering or acting when the user is asking about:
- a person, company, customer, teammate, lead, or contact
- a project, meeting, note, document, task, or prior decision
- "what do we know about X?"
- preparation or planning that should use stored memory first
- coding work that may benefit from prior repo context, conventions, or decisions
- UI, auth, architecture, or refactor tasks where earlier decisions may already exist in memory

Do not wait for the user to explicitly say "use VelocityBrain" or "use the MCP server".

Preferred tool order:
1. `lookup_memory` for direct factual lookups about entities or topics.
2. `query` if you need the standard memory retrieval path.
3. `run_agent` for planning, prep, implementation, or action-oriented requests that should retrieve memory before reasoning.

Behavior rules:
- For normal repo work, start with a Velocity Brain lookup before substantial reasoning or edits.
- For implementation requests like "update this login component" or "improve this UI", use Velocity Brain first to check for prior repo context, auth decisions, design guidance, or related tasks.
- If Velocity Brain returns strong internal matches, ground the answer in that result.
- If Velocity Brain returns no hits, say the internal brain does not have enough data instead of inventing facts.
- If the MCP call reports the database or runtime is unavailable, tell the user clearly and suggest fixing local setup with `velocitybrain doctor`.
- Prefer Velocity Brain over general web search for private or workspace-specific knowledge.

Writeback rules:
- When the user shares durable project facts, decisions, meeting outcomes, repo conventions, or follow-up tasks, save a concise note with `ingest_text`.
- After completing a meaningful task, save a short summary of the confirmed outcome when it is likely to help future sessions.
- Prefer saving short structured summaries rather than full chat transcripts.
- Do not ingest transient small talk or speculative reasoning that was not confirmed.
"""


def _ensure_velocitybrain_agents_md(repo_path: str | None = None) -> tuple[bool, str]:
    repo = Path(repo_path).resolve() if repo_path else Path.cwd().resolve()
    agents_path = repo / 'AGENTS.md'
    expected_block = _velocitybrain_agents_instructions().strip()

    if not agents_path.exists():
        agents_path.write_text(f"{expected_block}\n", encoding='utf-8')
        return True, f'Created {agents_path}'

    existing = agents_path.read_text(encoding='utf-8', errors='ignore')
    if expected_block in existing:
        return False, f'AGENTS.md already contains Velocity Brain instructions: {agents_path}'

    trimmed = existing.rstrip()
    separator = '\n\n' if trimmed else ''
    agents_path.write_text(f"{trimmed}{separator}{expected_block}\n", encoding='utf-8')
    return True, f'Updated AGENTS.md with Velocity Brain instructions: {agents_path}'


def _velocitybrain_identity_spec() -> dict[str, Any]:
    return {
        'name': 'velocitybrain-runtime',
        'version': '1.2',
        'persona': {
            'mission': 'Use brain-first retrieval before repo reasoning and preserve durable project knowledge.',
            'tone': 'clear, accountable, memory-first',
        },
        'runtime_policies': {
            'destructive_tools_require_approval': True,
            'allow_external_file_reads': False,
            'brain_first_for_repo_tasks': True,
            'durable_writeback_after_material_tasks': True,
            'save_transient_chat_by_default': False,
        },
        'capabilities': [
            'ingest_text',
            'query',
            'lookup_memory',
            'run_agent',
            'sync_brain',
            'get_identity_spec',
        ],
    }


def _ensure_velocitybrain_identity_spec(repo_path: str | None = None) -> tuple[bool, str]:
    repo = Path(repo_path).resolve() if repo_path else Path.cwd().resolve()
    spec_path = repo / 'identity.spec.json'
    expected = _velocitybrain_identity_spec()

    if not spec_path.exists():
        spec_path.write_text(json.dumps(expected, indent=2), encoding='utf-8')
        return True, f'Created {spec_path}'

    try:
        current = json.loads(spec_path.read_text(encoding='utf-8'))
    except Exception:
        current = {}

    if not isinstance(current, dict):
        current = {}

    merged = dict(current)
    merged.setdefault('name', expected['name'])
    merged['version'] = expected['version']
    merged['persona'] = {**expected['persona'], **(current.get('persona') or {})}
    merged['runtime_policies'] = {**expected['runtime_policies'], **(current.get('runtime_policies') or {})}

    existing_capabilities = current.get('capabilities') or []
    if not isinstance(existing_capabilities, list):
        existing_capabilities = []
    merged['capabilities'] = list(dict.fromkeys(existing_capabilities + expected['capabilities']))

    if merged == current:
        return False, f'identity.spec.json already contains Velocity Brain defaults: {spec_path}'

    spec_path.write_text(json.dumps(merged, indent=2), encoding='utf-8')
    return True, f'Updated identity.spec.json with Velocity Brain defaults: {spec_path}'


def _try_auto_connect(client_name: str) -> tuple[bool, str]:
    if client_name not in {'codex', 'claude'}:
        return False, 'Automatic MCP connection is supported for Codex and Claude.'
    command = _connect_command_for_client(client_name)
    completed = subprocess.run(command.split(), capture_output=True, text=True)
    output = completed.stdout.strip() or completed.stderr.strip() or 'Command executed.'
    return completed.returncode == 0, output


def cmd_quickstart(args: argparse.Namespace) -> int:
    _maybe_save_api_key(getattr(args, 'api_key', None))
    client_connected = False
    connect_output = 'skipped'
    if not getattr(args, 'skip_connect', False):
        client_connected, connect_output = _try_auto_connect(args.client)
    agents_changed, agents_output = _ensure_velocitybrain_agents_md(args.repo_path)
    identity_changed, identity_output = _ensure_velocitybrain_identity_spec(args.repo_path)
    _, integration_output = _report_agent_connection(
        args.client,
        args.repo_path,
        metadata={
            'source': 'quickstart',
            'agents_md_managed': True,
            'identity_spec_managed': True,
        },
    )
    proof = AdoptionService().quickstart(repo_path=args.repo_path, task=args.task)
    payload = _proof_payload({
        'result': proof['second_run']['result'],
        'reused': proof['truth_report']['reused'],
        'reuse_confidence': proof['reuse']['reuse_confidence'],
        'tokens_saved': proof['truth_report']['tokens_saved'],
        'percent_saved': proof['truth_report']['percent_saved'],
    })
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_quickstart)
    if connect_output and connect_output != 'skipped' and not getattr(args, 'json', False):
        print(connect_output)
    if (agents_changed or agents_output) and not getattr(args, 'json', False):
        print(agents_output)
    if (identity_changed or identity_output) and not getattr(args, 'json', False):
        print(identity_output)
    if integration_output and not getattr(args, 'json', False):
        print(integration_output)
    truth = proof.get('truth_report', {})
    return 0 if truth.get('reused') and truth.get('tokens_saved', 0) > 0 else 1


def cmd_share_run(args: argparse.Namespace) -> int:
    try:
        payload = _proof_payload(AdoptionService().share_last_run())
    except FileNotFoundError as exc:
        print(str(exc))
        return 1
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_share_run)
    return 0


def cmd_export_metrics(args: argparse.Namespace) -> int:
    payload = AdoptionService().export_metrics()
    payload['_color'] = _use_color(args)
    _emit(args, payload, lambda data: print(json.dumps({k: v for k, v in data.items() if k != '_color'}, indent=2)))
    return 0


def cmd_debug_run(args: argparse.Namespace) -> int:
    validator = ReuseValidationService()
    if args.scenario == 'all':
        payload = validator.run_validation_suite(repeat_count=args.repeat_count)
    else:
        payload = validator.run_until_scenario(args.scenario, repeat_count=args.repeat_count)
        payload['failure_cases'] = [
            failure for failure in payload.get('failure_cases', [])
            if failure.get('run_id', '').startswith(args.scenario)
        ]
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_debug_run)
    failures = payload.get('failure_cases', [])
    return 0 if not failures else 1


def cmd_caveman_commit(args: argparse.Namespace) -> int:
    payload = {
        'mode': 'caveman-commit',
        'output': caveman_commit(args.message),
        'trace_id': 'caveman-commit',
        '_color': _use_color(args),
    }
    _emit(args, payload, _render_caveman_output)
    return 0


def cmd_caveman_review(args: argparse.Namespace) -> int:
    payload = {
        'mode': 'caveman-review',
        'output': caveman_review(args.message),
        'trace_id': 'caveman-review',
        '_color': _use_color(args),
    }
    _emit(args, payload, _render_caveman_output)
    return 0


def cmd_caveman_compress(args: argparse.Namespace) -> int:
    target = _safe_file_path(args.file_path)
    payload = caveman_compress_file(target, style=args.response_style, write_backup=not args.no_backup)
    payload['trace_id'] = 'caveman-compress'
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_caveman_compress)
    return 0


def cmd_login(args: argparse.Namespace) -> int:
    api_key = args.api_key
    if not api_key and _is_interactive_terminal():
        if getattr(args, 'open_dashboard', False):
            opened = _open_dashboard()
            if opened:
                print(f'Opened dashboard: {DEFAULT_DASHBOARD_URL}')
            else:
                print(f'Open this URL in your browser: {DEFAULT_DASHBOARD_URL}')
        print('Get your API key from the Velocity Brain dashboard, then paste it here.')
        print(f'Dashboard: {DEFAULT_DASHBOARD_URL}')
        api_key = input('Velocity Brain API key: ').strip()

    config = _load_cli_config()
    if api_key:
        config['api_key'] = api_key
    if args.base_url:
        config['base_url'] = args.base_url
    config['runtime_mode'] = RUNTIME_MODE_CLOUD
    _save_cli_config(config)
    _, sync_note = _flush_pending_integrations()

    payload = {
        'title': 'login',
        'runtime_mode': config['runtime_mode'],
        'base_url': config.get('base_url', DEFAULT_CLOUD_BASE_URL),
        'api_key': _mask_secret(config.get('api_key')),
        'config_path': str(CONFIG_PATH),
        'status': 'saved',
        'hint': f'Run `velocitybrain doctor` next, then `velocitybrain serve mcp` to connect Codex or another MCP client.\n{sync_note}',
        'trace_id': 'login-cloud',
        '_color': _use_color(args),
    }
    _emit(args, payload, _render_config)
    return 0 if config.get('api_key') else 1


def cmd_config(args: argparse.Namespace) -> int:
    config = _load_cli_config()
    changed = False
    if getattr(args, 'set_key', None):
        config['api_key'] = args.set_key
        changed = True
    if getattr(args, 'set_base_url', None):
        config['base_url'] = args.set_base_url
        changed = True
    if getattr(args, 'set_mode', None):
        config['runtime_mode'] = args.set_mode
        changed = True
    if getattr(args, 'clear_key', False):
        config.pop('api_key', None)
        changed = True
    if changed:
        _save_cli_config(config)
    sync_note = ''
    if getattr(args, 'set_key', None):
        _, sync_note = _flush_pending_integrations()

    payload = {
        'title': 'config',
        'runtime_mode': config.get('runtime_mode', RUNTIME_MODE_AUTO),
        'base_url': config.get('base_url', DEFAULT_CLOUD_BASE_URL),
        'api_key': _mask_secret(config.get('api_key')),
        'config_path': str(CONFIG_PATH),
        'status': 'updated' if changed else 'loaded',
        'hint': sync_note or None,
        'trace_id': 'config-show',
        '_color': _use_color(args),
    }
    _emit(args, payload, _render_config)
    return 0


def cmd_smoke(args: argparse.Namespace) -> int:
    runtime_mode = _resolve_runtime_mode(args)
    try:
        if runtime_mode == RUNTIME_MODE_CLOUD:
            payload = _smoke_cloud(args.question)
        else:
            payload = _smoke_self_hosted(args.question)
        exit_code = 0 if payload.get('ok') else 1
    except Exception as exc:
        details = _cloud_error_details(exc) if runtime_mode == RUNTIME_MODE_CLOUD else {
            'status': 'self_hosted_unavailable',
            'message': str(exc),
            'hint': 'Start the local services and rerun `velocitybrain smoke`.',
        }
        payload = {
            'runtime_mode': runtime_mode,
            'ok': False,
            'passed': 0,
            'steps': [{'name': 'smoke', 'ok': False, 'detail': details['message']}],
            'hint': details['hint'],
            'trace_id': f'smoke-{runtime_mode}-failed',
        }
        exit_code = 1
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_smoke)
    if payload.get('hint'):
        print(payload['hint'])
    return exit_code


def _connect_command_for_client(client: str) -> str:
    if client == 'codex':
        return 'codex mcp add velocitybrain -- velocitybrain serve mcp'
    if client == 'claude':
        return 'claude mcp add velocitybrain -- velocitybrain serve mcp'
    return ''


def _hermes_server_block(command_value: str = 'velocitybrain') -> str:
    safe_command = command_value.replace("'", "''")
    return (
        "  velocitybrain:\n"
        f"    command: '{safe_command}'\n"
        "    args: ['serve', 'mcp']\n"
        "    tools:\n"
        "      include: ['healthz', 'retrieve_reuse_context', 'query', 'run_agent']\n"
        "      prompts: false\n"
        "      resources: false\n"
    )


def _hermes_config_snippet(command_value: str = 'velocitybrain') -> str:
    return f"mcp_servers:\n{_hermes_server_block(command_value)}"


def _write_hermes_config(config_path: Path, command_value: str = 'velocitybrain') -> tuple[bool, str]:
    config_path.parent.mkdir(parents=True, exist_ok=True)
    server_block = _hermes_server_block(command_value)

    if not config_path.exists():
        config_path.write_text(_hermes_config_snippet(command_value), encoding='utf-8')
        return True, 'Created Hermes config with Velocity Brain MCP entry.'

    existing = config_path.read_text(encoding='utf-8')
    if re.search(r'(?m)^\s{2}velocitybrain:\s*$', existing):
        return False, 'Velocity Brain MCP entry already exists in the Hermes config.'

    if re.search(r'(?m)^mcp_servers:\s*$', existing):
        updated = re.sub(r'(?m)^mcp_servers:\s*$', f'mcp_servers:\n{server_block}', existing, count=1)
    else:
        trimmed = existing.rstrip()
        prefix = f'{trimmed}\n\n' if trimmed else ''
        updated = f'{prefix}mcp_servers:\n{server_block}'

    config_path.write_text(updated, encoding='utf-8')
    return True, 'Updated Hermes config with Velocity Brain MCP entry.'


def _run_connect_command(command: str) -> subprocess.CompletedProcess[str]:
    executable = shlex.split(command, posix=False)[0]
    resolved = shutil.which(executable)

    if os.name == 'nt' and resolved and resolved.lower().endswith('.ps1'):
        return subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
            capture_output=True,
            text=True,
        )

    return subprocess.run(shlex.split(command, posix=False), capture_output=True, text=True)


def _complete_pairing_for_client(client_name: str, pair_code: str, repo_path: str | None = None) -> dict[str, Any]:
    repo = _detect_repo_context(repo_path)
    agent_id = 'claude-code' if client_name == 'claude' else client_name
    payload = VelocityBrainClient.complete_agent_pairing(
        pair_code=pair_code,
        base_url=_cloud_config()['base_url'],
        agent_instance_id=f'{agent_id}-{repo["repo_id"]}',
        repo_id=repo['repo_id'],
        repo_name=repo['repo_name'],
        repo_path=repo['repo_path'],
        branch=repo.get('branch'),
        project_id=repo.get('project_id'),
        metadata={
            'cwd': repo['cwd'],
            'paired_via': 'cli_connect',
            'client': client_name,
        },
    )
    _store_agent_credentials(agent_id, {
        'agent_connection_id': payload.get('agent_connection_id'),
        'access_token': payload.get('access_token'),
        'refresh_token': payload.get('refresh_token'),
        'token_expires_at': time.time() + int(payload.get('expires_in', 3600)),
        'paired_at': time.time(),
    })
    return payload


def _open_browser_url(url: str) -> bool:
    try:
        return bool(webbrowser.open(url))
    except Exception:
        return False


def _integration_payload(result: dict[str, Any]) -> dict[str, Any]:
    coverage_summary = result.get('sourceCoverageSummary') or result.get('source_coverage_summary') or 'No company sources connected yet'
    connected_count = result.get('connectedSourceCount', result.get('connected_source_count', 0))
    integrations = result.get('integrations') or []
    return {
        'connected_source_count': connected_count,
        'source_coverage_summary': coverage_summary,
        'integrations': [
            {
                'provider': item.get('provider'),
                'status': item.get('status') or ('connected' if item.get('connected') else 'not_connected'),
                'connected': item.get('connected', False),
                'display_name': item.get('displayName') or item.get('display_name') or '',
            }
            for item in integrations
        ],
        'trace_id': result.get('trace_id', 'integrations-cloud'),
    }


def cmd_integrations_status(args: argparse.Namespace) -> int:
    try:
        with _cloud_client() as client:
            result = client.get_integrations()
        payload = _integration_payload(result)
        payload['_color'] = _use_color(args)
        _emit(args, payload, _render_integrations)
        return 0
    except Exception as exc:
        payload = {
            'connected_source_count': 0,
            'source_coverage_summary': f'Failed to load integrations: {exc}',
            'integrations': [],
            'trace_id': 'integrations-cloud-failed',
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_integrations)
        return 1


def cmd_integrations_connect(args: argparse.Namespace) -> int:
    try:
        with _cloud_client() as client:
            result = client.start_integration(args.provider, from_surface='integrations')
        auth_url = result.get('authUrl') or result.get('auth_url')
        payload = {
            'connected_source_count': 0,
            'source_coverage_summary': f'Started {args.provider} browser-assisted connect flow.',
            'integrations': [{'provider': args.provider, 'status': 'pending', 'connected': False, 'display_name': ''}],
            'trace_id': result.get('trace_id', f'integration-start-{args.provider}'),
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_integrations)
        if auth_url:
            opened = _open_browser_url(auth_url)
            print(auth_url)
            if not opened:
                print('Open the URL above in your browser to finish the OAuth flow.')
        return 0
    except Exception as exc:
        payload = {
            'connected_source_count': 0,
            'source_coverage_summary': f'Failed to start {args.provider}: {exc}',
            'integrations': [],
            'trace_id': f'integration-start-failed-{args.provider}',
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_integrations)
        return 1


def cmd_integrations_resync(args: argparse.Namespace) -> int:
    try:
        with _cloud_client() as client:
            result = client.resync_integration(args.provider)
        payload = {
            'connected_source_count': 0,
            'source_coverage_summary': f'Resync queued for {args.provider}.',
            'integrations': [{'provider': args.provider, 'status': 'queued', 'connected': True, 'display_name': ''}],
            'trace_id': result.get('trace_id', f'integration-resync-{args.provider}'),
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_integrations)
        return 0
    except Exception as exc:
        payload = {
            'connected_source_count': 0,
            'source_coverage_summary': f'Failed to resync {args.provider}: {exc}',
            'integrations': [],
            'trace_id': f'integration-resync-failed-{args.provider}',
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_integrations)
        return 1


def cmd_integrations_disconnect(args: argparse.Namespace) -> int:
    try:
        with _cloud_client() as client:
            result = client.disconnect_integration(args.provider)
        payload = {
            'connected_source_count': 0,
            'source_coverage_summary': f'{args.provider} disconnected.',
            'integrations': [{'provider': args.provider, 'status': 'disconnected', 'connected': False, 'display_name': ''}],
            'trace_id': result.get('trace_id', f'integration-disconnect-{args.provider}'),
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_integrations)
        return 0
    except Exception as exc:
        payload = {
            'connected_source_count': 0,
            'source_coverage_summary': f'Failed to disconnect {args.provider}: {exc}',
            'integrations': [],
            'trace_id': f'integration-disconnect-failed-{args.provider}',
            '_color': _use_color(args),
        }
        _emit(args, payload, _render_integrations)
        return 1


def cmd_connect(args: argparse.Namespace) -> int:
    runtime_mode = _resolve_runtime_mode(args)
    payload: dict[str, Any] = {
        'client': args.client,
        'runtime_mode': runtime_mode,
        'applied': False,
        'trace_id': f'connect-{args.client}',
    }

    if getattr(args, 'pair_code', None):
        try:
            pairing = _complete_pairing_for_client(args.client, args.pair_code, getattr(args, 'repo_path', None))
            payload['paired'] = True
            payload['agent_connection_id'] = pairing.get('agent_connection_id')
            payload['hint'] = 'Agent pairing completed successfully.'
        except Exception as exc:
            payload['hint'] = f'Agent pairing failed: {exc}'
            payload['_color'] = _use_color(args)
            _emit(args, payload, _render_connect)
            return 1

    if args.client in {'codex', 'claude'}:
        command = _connect_command_for_client(args.client)
        payload['command'] = command
        if args.apply:
            completed = _run_connect_command(command)
            payload['applied'] = completed.returncode == 0
            note = completed.stdout.strip() or completed.stderr.strip() or 'Command executed.'
            if completed.returncode == 0:
                _, agents_note = _ensure_velocitybrain_agents_md()
                _, identity_note = _ensure_velocitybrain_identity_spec()
                repo = _detect_repo_context(getattr(args, 'repo_path', None))
                _, integration_note = _report_agent_connection(
                    'claude-code' if args.client == 'claude' else args.client,
                    repo['repo_path'],
                    metadata={
                        'source': 'connect',
                        'agents_md_managed': True,
                        'identity_spec_managed': True,
                        'branch': repo.get('branch'),
                    },
                )
                payload['hint'] = f'{note}\n{agents_note}\n{identity_note}\n{integration_note}'
            else:
                payload['hint'] = note
            exit_code = completed.returncode
        else:
            payload['hint'] = f'Run this command to connect {args.client} to Velocity Brain.'
            exit_code = 0
    elif args.client == 'hermes':
        config_path = Path.home() / '.hermes' / 'config.yaml'
        payload['config'] = _hermes_config_snippet()
        payload['config_path'] = str(config_path)
        if args.apply:
            applied, note = _write_hermes_config(config_path)
            payload['applied'] = applied
            payload['hint'] = f"{note} Start Hermes with `hermes chat` or run `/reload-mcp` in an active Hermes session."
        else:
            payload['hint'] = 'Add this block under `mcp_servers` in ~/.hermes/config.yaml, then start `hermes chat` or run `/reload-mcp`.'
        exit_code = 0
    elif args.client == 'openclaw':
        payload['config'] = json.dumps({
            'mcpServers': {
                'velocitybrain': {
                    'command': 'velocitybrain',
                    'args': ['serve', 'mcp'],
                }
            }
        }, indent=2)
        payload['hint'] = 'Add this MCP entry to the OpenClaw settings file, then restart OpenClaw.'
        exit_code = 0
    elif args.client == 'antigravity':
        payload['config'] = json.dumps({
            'mcpServers': {
                'velocitybrain': {
                    'command': 'velocitybrain',
                    'args': ['serve', 'mcp'],
                }
            }
        }, indent=2)
        payload['hint'] = 'Pairing completed! Configure your Antigravity agent configuration to include the velocitybrain MCP server.'
        exit_code = 0
    else:
        payload['config'] = json.dumps({
            'mcpServers': {
                'velocitybrain': {
                    'command': 'velocitybrain',
                    'args': ['serve', 'mcp'],
                }
            }
        }, indent=2)
        payload['hint'] = 'Use this generic MCP config in your client and then start `velocitybrain serve mcp`.'
        exit_code = 0

    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_connect)
    return exit_code


def cmd_serve(args: argparse.Namespace) -> int:
    serve_target = getattr(args, 'mode', 'api')
    runtime_mode = _resolve_runtime_mode(args)
    if getattr(args, 'api_key', None):
        os.environ['VELOCITYBRAIN_API_KEY'] = args.api_key

    if serve_target == 'mcp':
        return cmd_serve_mcp(args)
    if runtime_mode == RUNTIME_MODE_CLOUD:
        print('`velocitybrain serve api` is only available in self-hosted mode. Use `velocitybrain serve mcp` for cloud mode.')
        return 1
    _print_legacy_warning('`serve api` runs the deprecated self-hosted runtime.')

    env = os.environ.copy()

    cmd = [
        sys.executable,
        '-m',
        'uvicorn',
        'src.main:app',
        '--host',
        args.host,
        '--port',
        str(args.port),
    ]
    if args.reload:
        cmd.append('--reload')
    return subprocess.call(cmd, env=env)


def cmd_serve_mcp(args: argparse.Namespace) -> int:
    runtime_mode = _resolve_runtime_mode(args)
    if runtime_mode == RUNTIME_MODE_CLOUD:
        from src.mcp.server import main as cloud_mcp_main

        asyncio.run(cloud_mcp_main())
        return 0

    from src.mcp_stdio import main as mcp_main

    return mcp_main()


def build_parser() -> argparse.ArgumentParser:
    examples = """Examples:
  velocitybrain quickstart
  velocitybrain quickstart --repo-path .
  velocitybrain run "Map the main architecture and likely edit surface for this repo."
  velocitybrain status
  velocitybrain share-run
  velocitybrain serve mcp
"""
    parser = argparse.ArgumentParser(
        prog='velocitybrain',
        description='Velocity Brain CLI for agent-first memory and execution.',
        epilog=examples,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--json', action='store_true', help='Output machine-readable JSON.')
    parser.add_argument('--color', action='store_true', help='Force ANSI color output.')
    parser.add_argument('--no-color', action='store_true', help='Disable ANSI colors and styling.')
    parser.add_argument(
        '--runtime-mode',
        choices=RUNTIME_MODE_CHOICES,
        default=None,
        help='Choose runtime mode. `cloud` is the primary hosted product. `self-hosted` is legacy/dev-only.',
    )
    parser.add_argument(
        '--response-style',
        choices=sorted(ALLOWED_RESPONSE_STYLES),
        default=normalize_response_style(os.getenv('VB_RESPONSE_STYLE', 'normal')),
        help='Response style for query/run/compress outputs (normal, lite, full, ultra).',
    )

    sub = parser.add_subparsers(dest='command')

    p_about = sub.add_parser('about', help='Show product and entrypoint summary.')
    p_about.set_defaults(func=cmd_about)

    p_init = sub.add_parser('init', aliases=['setup'], help='Validate hosted config and report current setup.')
    p_init.add_argument('--bootstrap-schema', action='store_true', help='Apply local schema bootstrap with configured EMBED_DIM.')
    p_init.set_defaults(func=cmd_init)

    p_login = sub.add_parser('login', help='Save hosted Velocity Brain credentials for cloud mode.')
    p_login.add_argument('--api-key', help='Velocity Brain API key from the dashboard.')
    p_login.add_argument('--base-url', default=DEFAULT_CLOUD_BASE_URL, help='Hosted Velocity Brain API base URL.')
    p_login.add_argument('--open-dashboard', action='store_true', help='Open the Velocity Brain dashboard API keys page before prompting.')
    p_login.set_defaults(func=cmd_login)

    p_config = sub.add_parser('config', help='Inspect or update hosted Velocity Brain CLI config.')
    p_config.add_argument('--show', action='store_true', help='Show saved configuration.')
    p_config.add_argument('--set-key', help='Persist a hosted API key.')
    p_config.add_argument('--clear-key', action='store_true', help='Remove the saved hosted API key.')
    p_config.add_argument('--set-base-url', help='Persist a hosted API base URL.')
    p_config.add_argument('--set-mode', choices=RUNTIME_MODE_CHOICES, help='Persist runtime mode preference.')
    p_config.set_defaults(func=cmd_config)

    p_connect = sub.add_parser('connect', help='Show or apply MCP client setup for Codex, Claude, Hermes, OpenClaw, or a generic client.')
    p_connect.add_argument('client', choices=['codex', 'claude', 'hermes', 'openclaw', 'antigravity', 'generic'])
    p_connect.add_argument('--apply', action='store_true', help='Run the client registration command when supported.')
    p_connect.add_argument('--pair-code', help='Complete a browser-issued agent pairing session before applying local MCP setup.')
    p_connect.add_argument('--repo-path', help='Repository path to associate with the pairing and connection flow.')
    p_connect.set_defaults(func=cmd_connect)

    p_integrations = sub.add_parser('integrations', help='Manage hosted company integrations such as Slack, Google Workspace, and GitHub.')
    p_integrations.set_defaults(func=cmd_integrations_status)
    integrations_sub = p_integrations.add_subparsers(dest='integrations_command')

    p_integrations_status = integrations_sub.add_parser('status', help='Show connected company sources.')
    p_integrations_status.set_defaults(func=cmd_integrations_status)

    p_integrations_connect = integrations_sub.add_parser('connect', help='Start a browser-assisted OAuth flow for a company source.')
    p_integrations_connect.add_argument('provider', choices=['slack', 'google', 'github'])
    p_integrations_connect.set_defaults(func=cmd_integrations_connect)

    p_integrations_resync = integrations_sub.add_parser('resync', help='Queue a resync for a connected provider.')
    p_integrations_resync.add_argument('provider', choices=['slack', 'google', 'github'])
    p_integrations_resync.set_defaults(func=cmd_integrations_resync)

    p_integrations_disconnect = integrations_sub.add_parser('disconnect', help='Disconnect a company source without deleting history.')
    p_integrations_disconnect.add_argument('provider', choices=['slack', 'google', 'github'])
    p_integrations_disconnect.set_defaults(func=cmd_integrations_disconnect)

    p_smoke = sub.add_parser('smoke', help='Run a lightweight end-to-end smoke test for the active runtime mode.')
    p_smoke.add_argument('--question', default='What do we know about auth and API keys?', help='Smoke-test query to send.')
    p_smoke.set_defaults(func=cmd_smoke)

    p_ingest = sub.add_parser('ingest', aliases=['put'], help='Ingest a text or Org record into memory.')
    p_ingest.add_argument('--source', required=True, help='Source label (note, meeting, email, etc).')
    ingest_input = p_ingest.add_mutually_exclusive_group(required=True)
    ingest_input.add_argument('--content', help='Inline text content to ingest.')
    ingest_input.add_argument('--content-file', help='Path to UTF-8 text file to ingest.')
    ingest_input.add_argument('--org-file', help='Path to Org-mode (.org) file to ingest.')
    p_ingest.add_argument('--access-level', default='private', choices=['private', 'restricted', 'public'])
    p_ingest.set_defaults(func=cmd_ingest)

    p_query = sub.add_parser('query', aliases=['ask'], help='Query the internal brain using hybrid retrieval.')
    p_query.add_argument('question')
    p_query.add_argument('--limit', type=int, default=10)
    p_query.set_defaults(func=cmd_query)

    p_run = sub.add_parser('run', aliases=['act'], help='Run the autonomous agent loop for a signal.')
    p_run.add_argument('signal')
    p_run.add_argument('--repo-path', help='Repository path for proof mode. Defaults to the current directory.')
    p_run.set_defaults(func=cmd_run)

    p_skills = sub.add_parser('skills', aliases=['list-skills'], help='List installed skills.')
    p_skills.add_argument('--category', help='Filter by skill category.')
    p_skills.add_argument('--limit', type=int, default=0, help='Limit number of results (0 = all).')
    p_skills.set_defaults(func=cmd_skills)

    p_doctor = sub.add_parser('doctor', aliases=['health'], help='Run hosted connectivity checks.')
    p_doctor.add_argument('--verbose', action='store_true', help='Include runtime mode and cloud config details.')
    p_doctor.set_defaults(func=cmd_doctor)

    p_sync = sub.add_parser('sync', help='Legacy self-hosted sync command.')
    p_sync.add_argument('--repo', action='append', help='Repository path (can be provided multiple times).')
    p_sync.add_argument('--apply', action='store_true', help='Execute sync. Default is dry-run only.')
    p_sync.add_argument('--no-org', action='store_true', help='Disable Org-mode file discovery during sync.')
    p_sync.set_defaults(func=cmd_sync)

    p_identity = sub.add_parser('identity', help='Show runtime identity specification.')
    p_identity.set_defaults(func=cmd_identity)

    p_openclaw = sub.add_parser('openclaw', help='Show OpenClaw integration profile.')
    p_openclaw.set_defaults(func=cmd_openclaw)

    p_status = sub.add_parser('status', aliases=['runtime-status'], help='Show unified runtime status summary.')
    p_status.set_defaults(func=cmd_status)

    p_export_metrics = sub.add_parser('export-metrics', help='Export user, repo, and failure metrics as JSON.')
    p_export_metrics.set_defaults(func=cmd_export_metrics)

    p_quickstart = sub.add_parser('quickstart', help='Connect your agent and prove token savings on a repo in minutes.')
    p_quickstart.add_argument('--repo-path', help='Repository path to use. Defaults to the current directory.')
    p_quickstart.add_argument('--task', help='Task to run twice for immediate savings proof.')
    p_quickstart.add_argument('--client', choices=['codex', 'claude'], default='codex')
    p_quickstart.add_argument('--api-key', help='Optional Velocity Brain API key to save during quickstart.')
    p_quickstart.add_argument('--skip-connect', action='store_true', help='Skip automatic MCP client connection.')
    p_quickstart.set_defaults(func=cmd_quickstart)

    p_share = sub.add_parser('share-run', help='Print the most recent run as clean proof text for demos and screenshots.')
    p_share.set_defaults(func=cmd_share_run)

    p_debug_run = sub.add_parser('debug-run', help='Run real repo reuse validation and explain why reuse did or did not happen.')
    p_debug_run.add_argument('--scenario', choices=['all', 'auth-repeat', 'auth-variation', 'auth-change-plan'], default='all')
    p_debug_run.add_argument('--repeat-count', type=int, default=5, help='How many repeated runs to execute per workflow.')
    p_debug_run.set_defaults(func=cmd_debug_run)

    p_caveman_commit = sub.add_parser('caveman-commit', help='Generate terse caveman-style commit message.')
    p_caveman_commit.add_argument('message', help='Commit context to compress.')
    p_caveman_commit.set_defaults(func=cmd_caveman_commit)

    p_caveman_review = sub.add_parser('caveman-review', help='Generate one-line caveman-style review comment.')
    p_caveman_review.add_argument('message', help='Review context to compress.')
    p_caveman_review.set_defaults(func=cmd_caveman_review)

    p_caveman_compress = sub.add_parser('caveman-compress', help='Compress markdown file while preserving code/urls/paths/commands.')
    p_caveman_compress.add_argument('file_path', help='Path to markdown file to compress in-place.')
    p_caveman_compress.add_argument('--no-backup', action='store_true', help='Disable creation of .original.md backup file.')
    p_caveman_compress.set_defaults(func=cmd_caveman_compress)

    p_serve = sub.add_parser('serve', help='Run API server or MCP server.')
    p_serve.add_argument('mode', nargs='?', choices=['api', 'mcp'], default='api')
    p_serve.add_argument('--host', default='0.0.0.0')
    p_serve.add_argument('--port', type=int, default=settings.port)
    p_serve.add_argument('--reload', action='store_true')
    p_serve.add_argument('--api-key', help='API key for authentication with backend')
    p_serve.set_defaults(func=cmd_serve)

    p_mcp = sub.add_parser('serve-mcp', help='Run MCP tools over stdio (legacy alias).')
    p_mcp.set_defaults(func=cmd_serve_mcp)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if not getattr(args, 'command', None):
        return _handle_no_command(parser)
    return args.func(args)


if __name__ == '__main__':
    raise SystemExit(main())
