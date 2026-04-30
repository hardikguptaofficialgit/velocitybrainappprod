import React from 'react';
import axios from 'axios';
import { useQuery } from 'react-query';
import { CheckCircle, Cpu, Database, Shield, Terminal } from '../components/Icons';
import BlobLoader from '../components/BlobLoader';
import { isBackendUnavailable } from '../lib/network';
import { bundledAgentRuntimeStatus } from '../lib/agentRuntime';

const statusTone = {
  'Workspace config found': 'border-[#17301f] bg-[#13261d] text-[#7fe3c8]',
  'Template ready': 'border-[#EA803A33] bg-[#EA803A14] text-[#f2b07d]',
  'Not detected': 'border-[#2a2a2a] bg-[#0c0c0c] text-zinc-400'
};

const agentIcon = {
  'claude-code': Terminal,
  codex: Cpu,
  'gemini-cli': Database,
  openclaw: Shield,
  cline: Terminal
};

const workspaceMetrics = (workspace, agents) => [
  { label: 'Supported Agents', value: agents.length, detail: 'Tracked integration targets', icon: Cpu },
  { label: 'Ready Templates', value: workspace.readyAgentCount || 0, detail: 'Agents with repo setup assets', icon: Database },
  { label: 'Workspace Configs', value: workspace.workspaceConfigCount || 0, detail: 'Local config paths detected', icon: Shield },
  { label: 'Scripts + Docs', value: (workspace.setupScriptsPresent || 0) + (workspace.integrationDocsPresent || 0), detail: 'Setup and validation assets', icon: Terminal }
];

const WorkspaceFileList = ({ files }) => {
  if (!files.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#2a2a2a] px-4 py-5 text-sm text-zinc-500">
        No repo-side agent files detected yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div key={`${file.type}-${file.path}`} className="rounded-xl border border-[#202020] bg-[#111] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                {file.label}
              </p>
              <p className="mt-1 break-all text-xs text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {file.path}
              </p>
            </div>
            <span className="rounded-full border border-[#2a2a2a] bg-[#0c0c0c] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
              {file.type}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const Agents = () => {
  const { data, isLoading, error } = useQuery(
    'dashboard-agents',
    async () => {
      const response = await axios.get('/api/dashboard/agents');
      return response.data || bundledAgentRuntimeStatus;
    },
    {
      retry: 1,
      refetchInterval: 30000
    }
  );

  const useBundledFallback = Boolean(error);
  const sourceData = useBundledFallback ? bundledAgentRuntimeStatus : (data || bundledAgentRuntimeStatus);
  const workspace = sourceData.workspace || bundledAgentRuntimeStatus.workspace;
  const agents = sourceData.agents || bundledAgentRuntimeStatus.agents;
  const workspaceFiles = sourceData.workspaceFiles || bundledAgentRuntimeStatus.workspaceFiles;
  const metrics = workspaceMetrics(workspace, agents);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <BlobLoader size={72} label="" />
      </div>
    );
  }

  const sourceLabel = useBundledFallback ? 'Bundled status' : 'Live status';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#EA803A]/20 bg-[radial-gradient(circle_at_top_left,_rgba(234,128,58,0.18),_transparent_45%),linear-gradient(180deg,#130a02_0%,#0e0e0e_100%)] p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-[#f2b07d]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              Agent Runtime
            </p>
            <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'Syne, sans-serif' }}>
              Workspace agent status
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-zinc-300">
              Real repo-backed agent detection: templates, runtime files, setup scripts, docs, and local config paths that are actually present.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[420px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${useBundledFallback ? 'border-[#EA803A33] bg-[#EA803A14] text-[#f2b07d]' : 'border-[#17301f] bg-[#13261d] text-[#7fe3c8]'}`}>
                <span className="h-2 w-2 rounded-full bg-current opacity-90" />
                {sourceLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#111] px-3 py-1.5 text-xs text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-[#5fd1b3]" />
                Updates every 30s
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((card) => (
              <div key={card.label} className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {card.label}
                </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#171717] text-[#EA803A]">
                    <card.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {card.value}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{card.detail}</p>
              </div>
            ))}
            </div>
          </div>
        </div>
        {useBundledFallback && (
          <div className="mt-4 rounded-xl border border-[#EA803A33] bg-[#0f0a06] px-4 py-3 text-sm text-zinc-300">
            Live agent status is unavailable right now. Showing bundled repo status until the backend route is deployed.
            {!isBackendUnavailable(error) && error?.response?.status === 404 ? ' Current backend is missing /api/dashboard/agents.' : ''}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EA803A] text-black">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  Supported Agents
                </p>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                  What is actually wired
                </h2>
              </div>
            </div>
            <span className="rounded-full border border-[#2a2a2a] bg-[#111] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
              {agents.length} entries
            </span>
          </div>

          <div className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-2xl border border-[#202020] bg-[#111] p-4 transition-colors hover:border-[#EA803A33]">
                <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#171717] text-[#EA803A]">
                      {React.createElement(agentIcon[agent.id] || Terminal, { className: 'h-5 w-5' })}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                      {agent.name}
                    </h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">{agent.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {agent.strengths?.slice(0, 3).map((strength) => (
                          <span key={strength} className="rounded-full border border-[#2a2a2a] bg-[#0c0c0c] px-2.5 py-1 text-[11px] text-zinc-400">
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded border border-[#2a2a2a] bg-[#0c0c0c] px-2.5 py-1 text-[10px] text-zinc-400">
                      {agent.surface}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[10px] ${statusTone[agent.status] || statusTone['Not detected']}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {agent.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] p-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      Template
                    </p>
                    <p className={`break-all text-xs ${agent.templateReady ? 'text-[#7fe3c8]' : 'text-zinc-500'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {agent.templateReady ? agent.template?.path : 'not found'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] p-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      Workspace config
                    </p>
                    <p className={`break-all text-xs ${agent.workspaceConfigured ? 'text-[#7fe3c8]' : 'text-zinc-500'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {agent.workspaceConfigured ? agent.workspaceConfig?.path : 'not detected'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] p-3 lg:col-span-2">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      Integration assets
                    </p>
                    <p className="text-xs text-zinc-400">
                      {agent.extraReadyCount || 0} additional repo assets found
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(agent.extras || []).map((extra) => (
                        <span
                          key={extra.path}
                          className={`rounded-full border px-2.5 py-1 text-[10px] ${extra.exists ? 'border-[#17301f] bg-[#13261d] text-[#7fe3c8]' : 'border-[#2a2a2a] bg-[#111] text-zinc-500'}`}
                          style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        >
                          {extra.path}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] p-3 lg:col-span-2">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      Setup command
                    </p>
                    <code className="block break-all text-xs text-zinc-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {agent.setup}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5fd1b3] text-black">
                <Database className="h-5 w-5" />
              </div>
              <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                Workspace Signals
              </p>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                Repo integration surface
              </h2>
            </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  AGENTS.md
                </p>
                <p className={`text-sm font-bold ${workspace.agentsMdPresent ? 'text-[#7fe3c8]' : 'text-white'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
                  {workspace.agentsMdPresent ? 'Present' : 'Missing'}
                </p>
              </div>
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  Claude hooks
                </p>
                <p className={`text-sm font-bold ${workspace.claudeHooksPresent ? 'text-[#7fe3c8]' : 'text-white'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
                  {workspace.claudeHooksPresent ? 'Present' : 'Missing'}
                </p>
              </div>
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  MCP runtime
                </p>
                <p className={`text-sm font-bold ${workspace.mcpRuntimePresent ? 'text-[#7fe3c8]' : 'text-white'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
                  {workspace.mcpRuntimePresent ? 'Present' : 'Missing'}
                </p>
              </div>
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  Setup docs
                </p>
                <p className="text-sm font-bold text-[#7fe3c8]" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {workspace.integrationDocsPresent || 0} found
                </p>
              </div>
            </div>

            <WorkspaceFileList files={workspaceFiles} />

            <div className="mt-4 rounded-xl border border-[#202020] bg-[#111] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#171717] text-[#5fd1b3]">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Status rules
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    `Workspace config found` means a local client path was detected. `Template ready` means this repo ships setup files plus supporting assets. Live connection state still needs explicit runtime heartbeat reporting from the client.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Agents;
