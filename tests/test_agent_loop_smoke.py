from src.services.agent_loop import AgentLoop


def test_agent_loop_detects_planning_intent():
    loop = AgentLoop()
    assert loop._detect_intent('Prepare me for meeting with Hardik Gupta.') == 'planning'


def test_agent_loop_detects_execution_intent():
    loop = AgentLoop()
    assert loop._detect_intent('Execute this workflow and send update') == 'execution'
