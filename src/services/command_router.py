from src.services.agent_loop import AgentLoop


class CommandRouter:
    def __init__(self):
        self.agent = AgentLoop()

    def dispatch(self, command: str) -> dict:
        text = command.strip().lower()
        if text.startswith('store this'):
            return self.agent.run(command)
        if text.startswith('what do i know about'):
            return self.agent.run(command)
        if text.startswith('summarize last month'):
            return self.agent.run(command)
        if text.startswith('prepare me for meeting'):
            return self.agent.run(command)
        if text.startswith('what patterns exist'):
            return self.agent.run(command)
        if text.startswith('what should i do next'):
            return self.agent.run(command)
        if text.startswith('run analysis on'):
            return self.agent.run(command)
        if text.startswith('execute this workflow'):
            return self.agent.run(command)
        return self.agent.run(command)
