export const supportedAgents = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    status: 'Ready',
    surface: 'MCP',
    setup: 'claude mcp add velocitybrain -- velocitybrain serve mcp',
    summary: 'Repo-aware coding with memory lookup before action.',
    strengths: ['Repo-aware coding', 'Fast memory retrieval', 'Great planning handoff']
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    status: 'Ready',
    surface: 'MCP',
    setup: 'codex mcp add velocitybrain -- velocitybrain serve mcp',
    summary: 'Strong fit for edit-heavy workflows that need prepared context.',
    strengths: ['Automatic repo memory lookups', 'Background retrieval before action', 'Token-efficient coding']
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    status: 'Ready',
    surface: 'MCP',
    setup: 'velocitybrain serve mcp',
    summary: 'Good for mixed planning, research, and execution flows.',
    strengths: ['Cross-tool interoperability', 'Simple JSON config', 'Good for mixed task flows']
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    status: 'Profile Export',
    surface: 'MCP',
    setup: 'velocitybrain openclaw',
    summary: 'Exports an OpenClaw-ready profile and capability summary.',
    strengths: ['Profile export', 'Capability discovery endpoints', 'Smoke-flow ready']
  },
  {
    id: 'cline',
    name: 'Cline',
    status: 'Ready',
    surface: 'MCP',
    setup: 'velocitybrain serve mcp',
    summary: 'Lightweight MCP wiring with the same shared memory layer.',
    strengths: ['Simple MCP wiring', 'Shared tool surface', 'Same security defaults']
  }
];

export const bundledAgentRuntimeStatus = {
  workspace: {
    agentsMdPresent: true,
    agentsDirectoryPresent: false,
    claudeHooksPresent: true,
    mcpRuntimePresent: true,
    mcpTemplatesPresent: 4,
    integrationDocsPresent: 3,
    setupScriptsPresent: 3,
    workspaceConfigCount: 0,
    readyAgentCount: 5
  },
  agents: supportedAgents.map((agent) => ({
    ...agent,
    status: 'Template ready',
    templateReady: true,
    workspaceConfigured: false,
    extraReadyCount: agent.id === 'claude-code' || agent.id === 'codex' || agent.id === 'openclaw' ? 2 : 1,
    readinessScore: agent.id === 'claude-code' || agent.id === 'codex' || agent.id === 'openclaw' ? 3 : 2,
    template: agent.id === 'claude-code'
      ? { path: 'integrations/mcp/claude-code/mcpServers.velocitybrain.json' }
      : agent.id === 'codex'
        ? { path: 'integrations/mcp/codex/config.velocitybrain.toml' }
        : agent.id === 'openclaw'
          ? { path: 'integrations/mcp/openclaw/mcpServers.velocitybrain.json' }
          : { path: 'integrations/mcp/README.md' },
    workspaceConfig: null,
    extras: agent.id === 'claude-code'
      ? [{ path: 'integrations/claude/hooks/README.md' }, { path: 'scripts/install_claude_caveman_hooks.ps1' }]
      : agent.id === 'codex'
        ? [{ path: 'AGENTS.md' }, { path: 'scripts/setup_mcp_plugin.ps1' }]
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
    { label: 'openclaw', path: 'integrations/mcp/openclaw', type: 'directory' },
    { label: 'setup_mcp_plugin.ps1', path: 'scripts/setup_mcp_plugin.ps1', type: 'script' },
    { label: 'verify_mcp_integrations.ps1', path: 'scripts/verify_mcp_integrations.ps1', type: 'script' }
  ]
};

export const promptLifecycle = [
  {
    step: '1',
    title: 'Prompt arrives',
    description: 'The user talks to the agent normally.'
  },
  {
    step: '2',
    title: 'Velocity Brain runs first',
    description: 'Background retrieval pulls only the repo and memory context that matters.'
  },
  {
    step: '3',
    title: 'Agent executes with prepared context',
    description: 'The agent answers or edits with a smaller, cleaner context package.'
  },
  {
    step: '4',
    title: 'Important results are written back',
    description: 'Useful decisions and findings can be saved for the next run.'
  }
];

export const valuePillars = [
  {
    title: 'Background retrieval',
    description: 'The model does not start cold.'
  },
  {
    title: 'Context compression',
    description: 'Only the useful context gets forwarded.'
  },
  {
    title: 'Cross-agent consistency',
    description: 'Different agents can share one memory layer.'
  },
  {
    title: 'Writeback memory loop',
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
