export const supportedAgents = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: 'https://svgl.app/library/claude-ai-icon.svg',
    status: 'Ready',
    surface: 'MCP',
    setup: 'claude mcp add velocitybrain -- velocitybrain serve mcp',
    summary: 'Hosted reuse for coding workflows with less repeated prompt context.',
    strengths: ['Memory reuse', 'Saved tokens per run', 'Repo-scoped context recall']
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    icon: 'https://svgl.app/library/openai_dark.svg',
    status: 'Ready',
    surface: 'MCP',
    setup: 'codex mcp add velocitybrain -- velocitybrain serve mcp',
    summary: 'Strong fit for repeated repo analysis and edit-heavy coding loops.',
    strengths: ['Automatic reuse', 'Background retrieval before action', 'Token-efficient coding']
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    icon: 'https://hermes-agent.nousresearch.com/docs/img/logo.png',
    status: 'Ready',
    surface: 'MCP',
    setup: 'velocitybrain connect hermes --apply',
    summary: 'Native Hermes MCP wiring with a tighter tool surface for memory-first agent workflows.',
    strengths: ['Native MCP support', 'Tool allowlisting', 'Good for chat and long-running agent flows']
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    icon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_1920x1920_d13d3bcde5f6c17d4f6ef49f4a1e5d80.png',
    status: 'Ready',
    surface: 'MCP',
    setup: 'velocitybrain serve mcp',
    summary: 'Good for hosted coding-memory workflows across clients.',
    strengths: ['Cross-tool interoperability', 'Simple JSON config', 'Reuse-aware prompts']
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    icon: 'https://svgl.app/library/openai.svg',
    status: 'Profile Export',
    surface: 'MCP',
    setup: 'velocitybrain openclaw',
    summary: 'Exports an OpenClaw-ready profile for the hosted reuse layer.',
    strengths: ['Profile export', 'Capability discovery endpoints', 'Savings-aware smoke flow']
  },
  {
    id: 'cline',
    name: 'Cline',
    icon: 'https://svgl.app/library/visual-studio-code.svg',
    status: 'Ready',
    surface: 'MCP',
    setup: 'velocitybrain serve mcp',
    summary: 'Lightweight MCP wiring for the same hosted memory and savings layer.',
    strengths: ['Simple MCP wiring', 'Shared tool surface', 'Same hosted defaults']
  }
];

export const bundledAgentRuntimeStatus = {
  workspace: {
    agentsMdPresent: true,
    agentsDirectoryPresent: false,
    claudeHooksPresent: true,
    mcpRuntimePresent: true,
    mcpTemplatesPresent: 5,
    integrationDocsPresent: 3,
    setupScriptsPresent: 3,
    workspaceConfigCount: 0,
    readyAgentCount: 6
  },
  agents: supportedAgents.map((agent) => ({
    ...agent,
    status: 'Template ready',
    templateReady: true,
    workspaceConfigured: false,
    extraReadyCount: agent.id === 'claude-code' || agent.id === 'codex' || agent.id === 'openclaw' || agent.id === 'hermes' ? 2 : 1,
    readinessScore: agent.id === 'claude-code' || agent.id === 'codex' || agent.id === 'openclaw' || agent.id === 'hermes' ? 3 : 2,
    template: agent.id === 'claude-code'
      ? { path: 'integrations/mcp/claude-code/mcpServers.velocitybrain.json' }
      : agent.id === 'codex'
        ? { path: 'integrations/mcp/codex/config.velocitybrain.toml' }
        : agent.id === 'hermes'
          ? { path: 'velocitybrain-open-source/integrations/hermes/config.velocitybrain.yaml' }
        : agent.id === 'openclaw'
          ? { path: 'integrations/mcp/openclaw/mcpServers.velocitybrain.json' }
          : { path: 'integrations/mcp/README.md' },
    workspaceConfig: null,
    extras: agent.id === 'claude-code'
      ? [{ path: 'integrations/claude/hooks/README.md' }, { path: 'scripts/install_claude_caveman_hooks.ps1' }]
      : agent.id === 'codex'
        ? [{ path: 'AGENTS.md' }, { path: 'scripts/setup_mcp_plugin.ps1' }]
        : agent.id === 'hermes'
          ? [{ path: 'docs/CLIENT_INTEGRATIONS.md' }, { path: 'scripts/setup_mcp_plugin.ps1' }]
        : agent.id === 'openclaw'
          ? [{ path: 'identity.spec.json' }, { path: 'scripts/verify_mcp_integrations.ps1' }]
          : [{ path: 'docs/CLIENT_INTEGRATIONS.md' }]
  })),
  workspaceFiles: [
    { label: 'AGENTS.md', path: 'AGENTS.md', type: 'instruction' },
    { label: 'claude', path: 'integrations/claude', type: 'directory' },
    { label: 'hooks', path: 'integrations/claude/hooks', type: 'hook' },
    { label: 'claude-code', path: 'integrations/mcp/claude-code', type: 'directory' },
    { label: 'codex', path: 'integrations/mcp/codex', type: 'directory' },
    { label: 'hermes', path: 'velocitybrain-open-source/integrations/hermes', type: 'directory' },
    { label: 'openclaw', path: 'integrations/mcp/openclaw', type: 'directory' },
    { label: 'setup_mcp_plugin.ps1', path: 'scripts/setup_mcp_plugin.ps1', type: 'script' },
    { label: 'verify_mcp_integrations.ps1', path: 'scripts/verify_mcp_integrations.ps1', type: 'script' }
  ]
};

export const promptLifecycle = [
  {
    step: '1',
    title: 'Prompt arrives',
    description: 'The user asks the coding agent to inspect or change a repo.'
  },
  {
    step: '2',
    title: 'Reuse lookup runs first',
    description: 'Hosted retrieval checks for repo maps, prior answers, plans, and debug traces that can be reused.'
  },
  {
    step: '3',
    title: 'Agent runs with smaller context',
    description: 'Only the relevant coding context is injected instead of replaying the full history.'
  },
  {
    step: '4',
    title: 'Savings and artifacts are written back',
    description: 'Useful outputs become reusable memory artifacts and the saved tokens are tracked.'
  }
];

export const valuePillars = [
  {
    title: 'Hosted retrieval',
    description: 'The model does not start cold.'
  },
  {
    title: 'Context reuse',
    description: 'Only the useful context gets forwarded.'
  },
  {
    title: 'Cross-agent consistency',
    description: 'Different agents can share one hosted memory layer.'
  },
  {
    title: 'Writeback savings loop',
    description: 'Good runs improve the next session instead of vanishing in chat.'
  }
];

export const tokenSavingsExamples = [
  {
    label: 'Without memory',
    detail: 'Users keep repeating architecture, repo conventions, and recent decisions.',
    multiplier: 1
  },
  {
    label: 'With Velocity Brain',
    detail: 'The prompt stays short while retrieval and compression happen first.',
    multiplier: 0.42
  }
];

export function estimateTokenSavings(totalCalls = 0) {
  const baselinePromptTokens = 2200;
  const brainPromptTokens = 920;
  const estimatedWithoutBrain = totalCalls * baselinePromptTokens;
  const estimatedWithBrain = totalCalls * brainPromptTokens;
  const saved = Math.max(0, estimatedWithoutBrain - estimatedWithBrain);
  const percentSaved = estimatedWithoutBrain > 0
    ? Math.round((saved / estimatedWithoutBrain) * 100)
    : 58;

  return {
    baselinePromptTokens,
    brainPromptTokens,
    estimatedWithoutBrain,
    estimatedWithBrain,
    saved,
    percentSaved
  };
}
