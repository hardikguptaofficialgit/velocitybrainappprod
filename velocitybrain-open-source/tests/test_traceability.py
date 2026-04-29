from src.cli import _query_payload
from src.mcp_stdio import VelocityBrainMCPServer
from src.services.agent_loop import AgentLoop


def test_agent_loop_emits_trace_id():
    output = AgentLoop().run('Prepare me for meeting with Hardik Gupta tomorrow')
    assert 'trace_id' in output
    assert output['trace_id']


def test_cli_query_payload_emits_trace_id():
    payload = _query_payload('What do I know about Hardik Gupta?', 5)
    assert 'trace_id' in payload
    assert payload['trace_id']


def test_mcp_tool_list_skills_emits_trace_id():
    server = VelocityBrainMCPServer()
    result = server._tool_call('list_skills', {})

    assert 'trace_id' in result
    assert result['trace_id']
    assert result['tool'] == 'list_skills'