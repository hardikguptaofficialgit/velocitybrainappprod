import json
import sys
import traceback
import uuid
from typing import Any

from src.core.logging_config import get_logger
from src.plugins.core_connectors import CoreConnectors
from src.services.caveman_compress import caveman_compress_file
from src.services.caveman_ops import caveman_commit, caveman_review
from src.services.identity_spec import IdentitySpecService
from src.services.memory_engine import MemoryEngine
from src.services.policy_engine import PolicyEngine
from src.services.retrieval_engine import RetrievalEngine
from src.services.response_style import ALLOWED_RESPONSE_STYLES, apply_response_style
from src.services.skill_registry import SkillRegistry
from src.services.sync_service import SyncService

logger = get_logger('mcp_stdio')


class VelocityBrainMCPServer:
    def __init__(self):
        self.memory = MemoryEngine()
        self.retrieval = RetrievalEngine()
        self.skills = SkillRegistry('skills')
        self.policy = PolicyEngine()
        self.sync = SyncService()
        self.identity = IdentitySpecService()
        self.connectors = CoreConnectors()
        self._agent = None
        self._enhanced_tools_cache = None

    def _get_agent(self):
        if self._agent is None:
            from src.services.agent_loop import AgentLoop

            self._agent = AgentLoop()
        return self._agent

    def _get_enhanced_tools(self) -> tuple[Any, Any]:
        if self._enhanced_tools_cache is None:
            from src.mcp.enhanced_tools import call_enhanced_mcp_tool, list_enhanced_mcp_tools

            self._enhanced_tools_cache = (call_enhanced_mcp_tool, list_enhanced_mcp_tools)
        return self._enhanced_tools_cache

    def _read_message(self) -> dict[str, Any] | None:
        header = sys.stdin.buffer.readline()
        if not header:
            return None

        if header.startswith(b'Content-Length:'):
            content_length = int(header.split(b':', 1)[1].strip())
            while True:
                line = sys.stdin.buffer.readline()
                if not line:
                    return None
                if line in (b'\r\n', b'\n'):
                    break
            payload = sys.stdin.buffer.read(content_length)
            if not payload:
                return None
            return json.loads(payload.decode('utf-8'))

        line = header.decode('utf-8').strip()
        if not line:
            return None
        return json.loads(line)

    def _write_message(self, payload: dict[str, Any]) -> None:
        print(json.dumps(payload), flush=True)

    def _ok(self, req_id: Any, result: Any) -> dict[str, Any]:
        return {'jsonrpc': '2.0', 'id': req_id, 'result': result}

    def _err(self, req_id: Any, code: int, message: str) -> dict[str, Any]:
        return {'jsonrpc': '2.0', 'id': req_id, 'error': {'code': code, 'message': message}}

    def _trace_result(self, name: str, result: Any) -> Any:
        if isinstance(result, dict):
            traced = dict(result)
            traced.setdefault('trace_id', f'{name}-{uuid.uuid4()}')
            traced.setdefault('tool', name)
            return traced
        return {'result': result, 'trace_id': f'{name}-{uuid.uuid4()}', 'tool': name}

    def _query_payload(self, question: str, limit: int, response_style: str) -> dict[str, Any]:
        try:
            hits = self.retrieval.hybrid_search(question, limit=limit)
        except Exception as exc:
            return apply_response_style(
                {
                    'answer': 'Velocity Brain could not complete the lookup because the local database is not ready.',
                    'confidence': 0.0,
                    'references': [],
                    'reasoning_summary': (
                        'Brain lookup failed before retrieval completed. Start the local DB, run '
                        '`velocitybrain doctor`, and retry the same question. '
                        f'error={exc}'
                    ),
                    'error': 'database_unavailable',
                },
                response_style,
            )

        if not hits:
            return apply_response_style(
                {
                    'answer': 'The internal brain does not currently contain sufficient data for this question.',
                    'confidence': 0.22,
                    'references': [],
                    'reasoning_summary': 'Brain-first lookup completed with zero hits. No hallucinated answer returned.',
                },
                response_style,
            )

        top = hits[0]
        return apply_response_style(
            {
                'answer': f"{top['title']}: {top['compiled_truth_md'][:400]}",
                'confidence': float(top['confidence']),
                'references': [{'type': 'entity', 'slug': h['slug'], 'title': h['title']} for h in hits],
                'reasoning_summary': (
                    f'Hybrid retrieval returned {len(hits)} internal matches; top-ranked entity used for synthesis.'
                ),
            },
            response_style,
        )

    def _run_agent_payload(self, signal: str, response_style: str) -> dict[str, Any]:
        try:
            output = self._get_agent().run(signal)
        except Exception as exc:
            output = {
                'run_id': 'n/a',
                'signal': signal,
                'status': 'failed',
                'intent': 'unknown',
                'plan': [],
                'actions': [],
                'memory_updates': [],
                'confidence': 0.0,
                'attention_score': 0.0,
                'reasoning_summary': (
                    'Agent execution failed because required local services are not ready. '
                    'Run `velocitybrain doctor` after starting the DB, then retry the same request. '
                    f'error={exc}'
                ),
                'references': [],
                'error': 'runtime_unavailable',
            }
        return apply_response_style(output, response_style)

    def _tool_list(self) -> dict[str, Any]:
        enhanced_tools = []
        try:
            _, list_enhanced_mcp_tools = self._get_enhanced_tools()
            enhanced_tools = list_enhanced_mcp_tools()
        except Exception as exc:
            logger.warning(f"Enhanced MCP tools unavailable during tool listing: {exc}")

        return {
            'tools': [
                {
                    'name': 'ingest_text',
                    'description': 'Store text into Velocity Brain memory.',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'source': {'type': 'string'},
                            'content': {'type': 'string'},
                            'access_level': {'type': 'string'},
                        },
                        'required': ['source', 'content'],
                    },
                },
                {
                    'name': 'query',
                    'description': (
                        'Use for questions about people, companies, projects, meetings, notes, or '
                        '"what do we know about X?". Hybrid query against Velocity Brain memory.'
                    ),
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'question': {'type': 'string'},
                            'limit': {'type': 'integer'},
                            'response_style': {'type': 'string', 'enum': sorted(ALLOWED_RESPONSE_STYLES)},
                        },
                        'required': ['question'],
                    },
                },
                {
                    'name': 'lookup_memory',
                    'description': (
                        'Look up what Velocity Brain knows about a person, company, project, meeting, or topic '
                        'without needing the user to say "use Velocity Brain".'
                    ),
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'question': {'type': 'string'},
                            'limit': {'type': 'integer'},
                            'response_style': {'type': 'string', 'enum': sorted(ALLOWED_RESPONSE_STYLES)},
                        },
                        'required': ['question'],
                    },
                },
                {
                    'name': 'run_agent',
                    'description': (
                        'Use for prep, planning, or execution requests that should retrieve from Velocity Brain '
                        'before reasoning or acting.'
                    ),
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'signal': {'type': 'string'},
                            'response_style': {'type': 'string', 'enum': sorted(ALLOWED_RESPONSE_STYLES)},
                        },
                        'required': ['signal'],
                    },
                },
                {
                    'name': 'sync_brain',
                    'description': 'Sync one or more repositories (destructive-policy gated).',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'repos': {'type': 'array', 'items': {'type': 'string'}},
                            'dry_run': {'type': 'boolean'},
                            'approve': {'type': 'boolean'},
                        },
                    },
                },
                {
                    'name': 'put_page',
                    'description': 'Reserved mutating operation (policy-gated).',
                    'inputSchema': {'type': 'object', 'properties': {'approve': {'type': 'boolean'}}},
                },
                {
                    'name': 'delete_page',
                    'description': 'Reserved destructive operation (policy-gated).',
                    'inputSchema': {'type': 'object', 'properties': {'approve': {'type': 'boolean'}}},
                },
                {
                    'name': 'google_workspace_action',
                    'description': 'Unified Google integration action router.',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'action': {'type': 'string'},
                            'payload': {'type': 'object'},
                        },
                        'required': ['action'],
                    },
                },
                {
                    'name': 'get_identity_spec',
                    'description': 'Return runtime identity specification.',
                    'inputSchema': {'type': 'object', 'properties': {}},
                },
                {
                    'name': 'list_skills',
                    'description': 'List installed skills.',
                    'inputSchema': {'type': 'object', 'properties': {}},
                },
                {
                    'name': 'healthz',
                    'description': 'Return basic process health.',
                    'inputSchema': {'type': 'object', 'properties': {}},
                },
                {
                    'name': 'caveman_commit',
                    'description': 'Generate terse caveman-style commit message.',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'message': {'type': 'string'},
                        },
                        'required': ['message'],
                    },
                },
                {
                    'name': 'caveman_review',
                    'description': 'Generate one-line caveman-style review comment.',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'message': {'type': 'string'},
                        },
                        'required': ['message'],
                    },
                },
                {
                    'name': 'caveman_compress',
                    'description': 'Compress markdown file while preserving code/urls/paths/commands.',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'file_path': {'type': 'string'},
                            'response_style': {'type': 'string', 'enum': sorted(ALLOWED_RESPONSE_STYLES)},
                            'write_backup': {'type': 'boolean'},
                        },
                        'required': ['file_path'],
                    },
                },
            ] + enhanced_tools
        }

    def _tool_call(self, name: str, arguments: dict[str, Any]) -> Any:
        if name in {'delete_page', 'put_page', 'sync_brain'}:
            self.policy.check_tool_call(name, arguments)

        if name == 'ingest_text':
            return self._trace_result(name, self.memory.upsert_from_text(
                source=arguments['source'],
                content=arguments['content'],
                access_level=arguments.get('access_level', 'private'),
            ))

        if name in {'query', 'lookup_memory'}:
            question = arguments['question']
            limit = int(arguments.get('limit', 10))
            response_style = arguments.get('response_style', 'normal')
            return self._trace_result(name, self._query_payload(question, limit, response_style))

        if name == 'run_agent':
            response_style = arguments.get('response_style', 'normal')
            return self._trace_result(name, self._run_agent_payload(arguments['signal'], response_style))

        if name == 'sync_brain':
            repos = arguments.get('repos') or []
            dry_run = bool(arguments.get('dry_run', True))
            return self._trace_result(name, self.sync.full_sync(repos=repos, dry_run=dry_run))

        if name == 'put_page':
            return self._trace_result(name, {'status': 'blocked', 'reason': 'tool not implemented; policy gate active'})

        if name == 'delete_page':
            return self._trace_result(name, {'status': 'blocked', 'reason': 'tool not implemented; policy gate active'})

        if name == 'google_workspace_action':
            return self._trace_result(name, self.connectors.google_workspace(arguments['action'], arguments.get('payload', {})))

        if name == 'get_identity_spec':
            return self._trace_result(name, self.identity.get())

        if name == 'list_skills':
            data = self.skills.list_skills()
            return self._trace_result(name, {'count': len(data), 'skills': data})

        if name == 'healthz':
            return self._trace_result(name, {'ok': True, 'service': 'velocitybrain-mcp'})

        if name == 'caveman_commit':
            return self._trace_result(name, {'output': caveman_commit(arguments['message'])})

        if name == 'caveman_review':
            return self._trace_result(name, {'output': caveman_review(arguments['message'])})

        if name == 'caveman_compress':
            return self._trace_result(
                name,
                caveman_compress_file(
                    arguments['file_path'],
                    style=arguments.get('response_style', 'full'),
                    write_backup=bool(arguments.get('write_backup', True)),
                ),
            )

        # Try enhanced MCP tools
        try:
            import asyncio
            call_enhanced_mcp_tool, _ = self._get_enhanced_tools()
            result = asyncio.run(call_enhanced_mcp_tool(name, **arguments))
            return self._trace_result(name, result)
        except Exception as e:
            # If it's not an enhanced tool, raise the original error
            if "unknown tool" in str(e):
                raise ValueError(f'unknown tool: {name}')
            # Log the error but don't crash
            return self._trace_result(name, {'error': str(e), 'message': f'Enhanced tool {name} failed'})

        raise ValueError(f'unknown tool: {name}')

    def run(self) -> None:
        while True:
            try:
                req = self._read_message()
            except EOFError:
                return
            except Exception:
                return

            if not req:
                continue

            req_id = req.get('id')
            method = req.get('method')
            params = req.get('params', {})

            if method == 'initialize':
                self._write_message(
                    self._ok(
                        req_id,
                        {
                            'protocolVersion': '2024-11-05',
                            'serverInfo': {'name': 'velocitybrain', 'version': '1.1.0'},
                            'capabilities': {'tools': {}},
                        },
                    )
                )
                continue

            if method == 'tools/list':
                self._write_message(self._ok(req_id, self._tool_list()))
                continue

            if method == 'tools/call':
                try:
                    name = params.get('name')
                    args = params.get('arguments', {})
                    result = self._tool_call(name, args)
                    self._write_message(self._ok(req_id, {'content': [{'type': 'text', 'text': json.dumps(result)}]}))
                except Exception as exc:
                    self._write_message(self._err(req_id, -32000, str(exc)))
                continue

            if method == 'shutdown':
                self._write_message(self._ok(req_id, {}))
                return

            if method == 'exit':
                return

            self._write_message(self._err(req_id, -32601, f'method not found: {method}'))


# Backward-compat alias
VelocityXMCPServer = VelocityBrainMCPServer


def main() -> int:
    try:
        VelocityBrainMCPServer().run()
        return 0
    except Exception:
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
