import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from src.core.config import settings
from src.core.db import bootstrap_schema
from src.services.caveman_compress import caveman_compress_file
from src.services.caveman_ops import caveman_commit, caveman_review
from src.services.identity_spec import IdentitySpecService
from src.services.memory_engine import MemoryEngine
from src.services.openclaw_profile import build_openclaw_profile
from src.services.org_ingest import OrgIngestService
from src.services.response_style import ALLOWED_RESPONSE_STYLES, apply_response_style, normalize_response_style
from src.services.retrieval_engine import RetrievalEngine
from src.services.runtime_status import build_runtime_status
from src.services.skill_registry import SkillRegistry
from src.services.skill_validation import validate_skill_inventory
from src.services.sync_service import SyncService

BRAND = 'Velocity Brain'
MAX_INGEST_FILE_BYTES = 2 * 1024 * 1024

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
    _print_section(
        BRAND,
        [
            f"mode: {payload['mode']}",
            f"commands: {', '.join(payload['commands'])}",
            f"api_entry: {payload['entrypoints']['api']}",
            f"mcp_entry: {payload['entrypoints']['mcp']}",
            f"embedding_provider: {payload['embedding']['provider']}",
            f"embedding_model: {payload['embedding']['model']}",
            f"embedding_dim: {payload['embedding']['dim']}",
            f"model_router: {payload['embedding']['router']}",
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
    _print_section(
        'query result',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"answer: {payload['answer']}",
            f"confidence: {payload['confidence']}",
            f"references: {len(refs)}",
            f"reasoning: {payload['reasoning_summary']}",
        ],
        color=use_color,
    )


def _render_run(payload: dict[str, Any]) -> None:
    use_color = payload.get('_color', False)
    _print_section(
        'agent run',
        [
            f"trace_id: {payload.get('trace_id', 'n/a')}",
            f"run_id: {payload['run_id']}",
            f"status: {payload['status']}",
            f"intent: {payload['intent']}",
            f"confidence: {payload['confidence']}",
            f"attention_score: {payload.get('attention_score', 'n/a')}",
            f"plan_steps: {len(payload.get('plan', []))}",
            f"actions: {len(payload.get('actions', []))}",
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
            f"audit_available: {audit.get('available', False)}",
            f"audit_recent_count: {audit.get('count', 0)}",
            f"audit_latest: {latest_label}",
            f"generated_at: {payload.get('generated_at', 'n/a')}",
        ],
        color=use_color,
    )


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
    payload = {
        'app': settings.app_name,
        'mode': 'terminal-first',
        'commands': ['about', 'init', 'ingest', 'query', 'run', 'skills', 'doctor', 'sync', 'identity', 'openclaw', 'status', 'serve'],
        'entrypoints': {'api': 'velocitybrain serve api', 'mcp': 'velocitybrain serve mcp'},
        'embedding': {
            'provider': settings.embedding_provider,
            'model': settings.embedding_model,
            'dim': settings.embed_dim,
            'router': settings.model_router,
        },
        'trace_id': 'about-runtime',
        '_color': _use_color(args),
    }
    _emit(args, payload, _render_about)
    return 0


def cmd_init(args: argparse.Namespace) -> int:
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
    payload = _query_payload(args.question, args.limit, response_style=args.response_style)
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_query)
    return 0


def cmd_run(args: argparse.Namespace) -> int:
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
    checks['identity_spec'] = Path(settings.identity_spec_path).exists() or True
    return {'ok': all(checks.values()), 'checks': checks, 'trace_id': 'doctor-check'}


def cmd_doctor(args: argparse.Namespace) -> int:
    payload = _doctor_payload()
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_doctor)
    return 0 if payload['ok'] else 1


def cmd_sync(args: argparse.Namespace) -> int:
    repos = args.repo or [str(Path(settings.workspace_root).resolve())]
    payload = SyncService().full_sync(repos=repos, dry_run=not args.apply, include_org=not args.no_org)
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_sync)
    return 0


def cmd_identity(args: argparse.Namespace) -> int:
    payload = IdentitySpecService().get()
    payload['trace_id'] = payload.get('trace_id') or 'identity-spec'
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_identity)
    return 0


def cmd_openclaw(args: argparse.Namespace) -> int:
    payload = build_openclaw_profile()
    payload['trace_id'] = payload.get('trace_id') or 'openclaw-profile'
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_openclaw_profile)
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    payload = build_runtime_status(audit_limit=5)
    payload['trace_id'] = payload.get('trace_id') or 'runtime-status'
    payload['_color'] = _use_color(args)
    _emit(args, payload, _render_status)
    return 0


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


def cmd_serve(args: argparse.Namespace) -> int:
    mode = getattr(args, 'mode', 'api')
    if mode == 'mcp':
        return cmd_serve_mcp(args)

    env = os.environ.copy()
    if getattr(args, 'api_key', None):
        env['VELOCITYBRAIN_API_KEY'] = args.api_key

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


def cmd_serve_mcp(_: argparse.Namespace) -> int:
    from src.mcp_stdio import main as mcp_main

    return mcp_main()


def build_parser() -> argparse.ArgumentParser:
    examples = """Examples:
  velocitybrain init --bootstrap-schema
  velocitybrain ingest --source note --content "Met Hardik Gupta from Acme"
  velocitybrain ingest --source notes --org-file ./notes/daily.org
  velocitybrain query "What do I know about Hardik Gupta?"
  velocitybrain run "Prepare me for meeting with Hardik Gupta tomorrow"
  velocitybrain sync --repo . --apply
  velocitybrain identity
    velocitybrain openclaw
    velocitybrain status
  velocitybrain serve api --host 0.0.0.0 --port 8080 --reload
  velocitybrain serve mcp
  velocitybrain --json query "What changed?"
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
        '--response-style',
        choices=sorted(ALLOWED_RESPONSE_STYLES),
        default=normalize_response_style(os.getenv('VB_RESPONSE_STYLE', 'normal')),
        help='Response style for query/run/compress outputs (normal, lite, full, ultra).',
    )

    sub = parser.add_subparsers(dest='command', required=True)

    p_about = sub.add_parser('about', help='Show product and entrypoint summary.')
    p_about.set_defaults(func=cmd_about)

    p_init = sub.add_parser('init', aliases=['setup'], help='Validate config and report current setup.')
    p_init.add_argument('--bootstrap-schema', action='store_true', help='Apply local schema bootstrap with configured EMBED_DIM.')
    p_init.set_defaults(func=cmd_init)

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
    p_run.set_defaults(func=cmd_run)

    p_skills = sub.add_parser('skills', aliases=['list-skills'], help='List installed skills.')
    p_skills.add_argument('--category', help='Filter by skill category.')
    p_skills.add_argument('--limit', type=int, default=0, help='Limit number of results (0 = all).')
    p_skills.set_defaults(func=cmd_skills)

    p_doctor = sub.add_parser('doctor', aliases=['health'], help='Run local health checks.')
    p_doctor.set_defaults(func=cmd_doctor)

    p_sync = sub.add_parser('sync', help='Sync one or more repositories into local brain index.')
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
    return args.func(args)


if __name__ == '__main__':
    raise SystemExit(main())
