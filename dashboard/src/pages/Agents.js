import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { Cpu, Database, ArrowRight, Activity, TrendingUp } from '../components/Icons';
import AgentBrandIcon from '../components/AgentBrandIcon';
import BlobLoader from '../components/BlobLoader';
import { resolveApiUrl } from '../lib/api';
import { bundledAgentRuntimeStatus } from '../lib/agentRuntime';

const tabs = [
  { id: 'connected', label: 'Connected' },
  { id: 'all', label: 'All Agents' },
  { id: 'connect', label: 'Setup Guide' }
];

const formatTime = (value) => {
  if (!value) return 'Never';
  try {
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Unknown';
  }
};

const ConnectionBadge = ({ active, text }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide shrink-0 ${
    active ? 'bg-[#5fd1b3]/10 text-[#5fd1b3]' : 'bg-[#1c1c1c] text-zinc-500'
  }`}>
    {text}
  </span>
);

const KeyPill = ({ apiKey }) => {
  if (!apiKey) {
    return <span className="text-xs text-zinc-500">No key reported</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${
      apiKey.status === 'active' ? 'border-[#5fd1b3]/20 bg-[#5fd1b3]/5 text-[#5fd1b3]' : 'border-red-500/20 bg-red-500/5 text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${apiKey.status === 'active' ? 'bg-[#5fd1b3]' : 'bg-red-400'}`} />
      {apiKey.name}
      {apiKey.keyPrefix ? <span className="text-zinc-500 font-mono text-[10px]">({apiKey.keyPrefix}...)</span> : ''}
    </span>
  );
};

const StatCard = ({ title, value, detail, icon: Icon, color, bg }) => (
  <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors">
    <div className="flex items-center justify-between text-zinc-400 mb-3">
      <span className="text-sm font-medium">{title}</span>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${bg} ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</p>
    <p className="text-xs text-zinc-500 truncate">{detail}</p>
  </div>
);

const AgentConnectionCard = ({ agent }) => {
  const isConnected = agent.accountConnected;
  const observability = agent.observability || {};
  const recentRuns = agent.recentRuns || [];

  return (
    <article className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-colors flex flex-col">
      <div className="p-5 border-b border-[#1c1c1c] flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <AgentBrandIcon
            agentId={agent.id}
            name={agent.name}
            containerClassName="w-10 h-10 shrink-0"
            size="h-5 w-5"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{agent.name}</h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 tracking-wide uppercase">{agent.surface}</span>
            </div>
            <p className="text-xs text-zinc-500 truncate max-w-[320px]">{agent.summary}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConnectionBadge active={isConnected} text={isConnected ? 'Connected' : agent.templateReady ? 'Ready' : 'Offline'} />
          <span className="text-[10px] text-zinc-500">Seen: {formatTime(agent.latestConnectionAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 border-b border-[#1c1c1c]">
        <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Requests</p>
          <p className="text-sm font-medium text-white">{observability.calls || 0}</p>
        </div>
        <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Tokens</p>
          <p className="text-sm font-medium text-white">{Number(observability.totalTokens || 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Cost</p>
          <p className="text-sm font-medium text-white">${Number(observability.costUsd || 0).toFixed(4)}</p>
        </div>
        <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Avg Latency</p>
          <p className="text-sm font-medium text-white">{Math.round(observability.avgLatencyMs || 0)}ms</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1c1c1c] flex-1">
        <div className="p-5 flex flex-col">
          <p className="text-xs font-medium text-zinc-400 mb-3">Connected Repos ({agent.connectedRepos?.length || 0})</p>
          <div className="flex-1 space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {agent.connectedRepos?.length > 0 ? (
              agent.connectedRepos.slice(0, 5).map((repo) => (
                <div key={repo.id} className="p-2.5 rounded-lg bg-[#111111] border border-[#1c1c1c] flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{repo.repoName}</p>
                    <p className="text-[10px] text-zinc-500 font-mono truncate">{repo.repoPath || repo.repoId}</p>
                  </div>
                  <KeyPill apiKey={repo.apiKey} />
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-[#2a2a2a] rounded-lg p-4">
                <p className="text-xs text-zinc-500 text-center">No live repo connections.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col">
          <p className="text-xs font-medium text-zinc-400 mb-3">Task Types</p>
          <div className="flex-1 flex flex-wrap gap-2 content-start">
            {(observability.taskTypes || []).length > 0 ? (
              observability.taskTypes.map((task) => (
                <span key={task} className="px-2 py-1 rounded-md border border-[#202020] bg-[#111] text-[10px] text-zinc-300 uppercase tracking-wide">
                  {task}
                </span>
              ))
            ) : (
              <div className="h-full w-full flex items-center justify-center border border-dashed border-[#2a2a2a] rounded-lg p-4">
                <p className="text-xs text-zinc-500 text-center">No task attribution yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col md:col-span-2 xl:col-span-1">
          <p className="text-xs font-medium text-zinc-400 mb-3">Recent Runs</p>
          <div className="flex-1 space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {recentRuns.length > 0 ? (
              recentRuns.map((run, index) => (
                <div key={`${run.timestamp}-${index}`} className="rounded-lg border border-[#1c1c1c] bg-[#111] p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm text-white truncate">{run.description}</p>
                    <ConnectionBadge active={run.status !== 'failed'} text={run.status || 'completed'} />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {run.repoId || 'workspace'} • {run.modelName || 'unknown model'} • {formatTime(run.timestamp)}
                  </p>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-[#2a2a2a] rounded-lg p-4">
                <p className="text-xs text-zinc-500 text-center">No telemetry runs yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

const ConnectCard = ({ agent, apiKeys }) => (
  <article className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-5 flex flex-col gap-5 hover:border-[#2a2a2a] transition-colors">
    <div className="flex items-start gap-4">
      <AgentBrandIcon
        agentId={agent.id}
        name={agent.name}
        containerClassName="w-10 h-10 shrink-0"
        size="h-5 w-5"
      />
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{agent.name}</h3>
          <ConnectionBadge active={agent.accountConnected} text={agent.accountConnected ? 'Connected' : 'Available'} />
        </div>
        <p className="text-xs text-zinc-400 line-clamp-2">{agent.summary}</p>
      </div>
    </div>

    <div className="bg-[#111111] border border-[#1c1c1c] rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 font-semibold">Bootstrap Command</p>
      <code className="block bg-[#0a0a0a] border border-[#202020] rounded p-2 text-xs text-zinc-300 font-mono overflow-x-auto">
        {agent.setup}
      </code>
    </div>

    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 font-semibold">Velocity Brain Ready Surface</p>
        <div className="flex flex-wrap gap-2">
          {(agent.strengths || []).map((item) => (
            <span key={item} className="px-2 py-1 rounded-md border border-[#202020] bg-[#111] text-[10px] text-zinc-300">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 font-semibold">Available API Keys</p>
        {apiKeys.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {apiKeys.map((apiKey) => <KeyPill key={apiKey.id} apiKey={apiKey} />)}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No active keys. Create one to connect.</p>
        )}
      </div>
    </div>
  </article>
);

const Agents = () => {
  const [activeTab, setActiveTab] = useState('connected');

  const { data, isLoading, error } = useQuery(
    'dashboard-agents',
    async () => {
      const response = await axios.get(resolveApiUrl('/api/dashboard/agents'));
      return response.data || bundledAgentRuntimeStatus;
    },
    { retry: 1, refetchInterval: 30000 }
  );

  const useBundledFallback = Boolean(error);
  const sourceData = useBundledFallback ? bundledAgentRuntimeStatus : (data || bundledAgentRuntimeStatus);
  const workspace = sourceData.workspace || bundledAgentRuntimeStatus.workspace;
  const agents = sourceData.agents || bundledAgentRuntimeStatus.agents;
  const apiKeys = sourceData.apiKeys || [];

  const connectedAgents = useMemo(() => agents.filter((agent) => agent.accountConnected), [agents]);
  const totalAgentCalls = useMemo(
    () => connectedAgents.reduce((sum, agent) => sum + Number(agent.observability?.calls || 0), 0),
    [connectedAgents]
  );
  const totalAgentSpend = useMemo(
    () => connectedAgents.reduce((sum, agent) => sum + Number(agent.observability?.costUsd || 0), 0),
    [connectedAgents]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <BlobLoader size={48} label="" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Agent Manager
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Monitor connected agents, repository scopes, recent coding runs, and the credentials powering them.
          </p>
          {useBundledFallback && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
              Live data unavailable. Showing static fallback.
            </span>
          )}
        </div>
        <Link
          to="/dashboard/api-keys"
          className="px-4 py-2 rounded-lg bg-[#EA803A] hover:bg-[#f0965a] transition-colors text-sm font-semibold text-black flex items-center justify-center gap-2"
        >
          Manage API Keys
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Connected Agents" value={workspace.connectedAgentCount || connectedAgents.length} detail="Agents currently linked to this account" icon={Cpu} color="text-[#EA803A]" bg="bg-[#EA803A]/10" />
        <StatCard title="Connected Repos" value={workspace.connectedRepoCount || 0} detail="Repositories flowing through linked agents" icon={Database} color="text-[#5fd1b3]" bg="bg-[#5fd1b3]/10" />
        <StatCard title="Agent Requests" value={totalAgentCalls.toLocaleString()} detail="Telemetry events attributed to connected agents" icon={Activity} color="text-blue-400" bg="bg-blue-400/10" />
        <StatCard title="Tracked Spend" value={`$${totalAgentSpend.toFixed(3)}`} detail="Observed model spend across connected agents" icon={TrendingUp} color="text-[#f4b183]" bg="bg-[#f4b183]/10" />
      </div>

      <div className="flex items-center gap-1 p-1 bg-[#0d0d0d] border border-[#1c1c1c] rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1a1a1a] text-white shadow-sm border border-[#2a2a2a]'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'connected' && (
          connectedAgents.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {connectedAgents.map((agent) => <AgentConnectionCard key={agent.id} agent={agent} />)}
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl">
              <div className="w-12 h-12 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center mb-4">
                <Cpu className="h-5 w-5 text-zinc-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>No agents connected</h3>
              <p className="text-sm text-zinc-500 mb-6 max-w-sm">
                Start a pairing session from the API key dashboard to enroll Codex, Claude Code, or another MCP-compatible agent.
              </p>
              <button
                onClick={() => setActiveTab('connect')}
                className="px-5 py-2.5 rounded-lg bg-[#EA803A] hover:bg-[#f0965a] transition-colors text-sm font-semibold text-black"
              >
                View Setup Guide
              </button>
            </div>
          )
        )}

        {activeTab === 'all' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {agents.map((agent) => <AgentConnectionCard key={agent.id} agent={agent} />)}
          </div>
        )}

        {activeTab === 'connect' && (
          <div className="space-y-6">
            <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Connection Guide</h2>
                <p className="text-sm text-zinc-400">
                  Create or select an API key, click <span className="text-white font-medium">Connect Your Agent</span>, then run the short-lived pairing command locally.
                  Velocity Brain exchanges the pairing code for scoped agent tokens and starts tracking repos, models, and tasks automatically.
                </p>
              </div>
              <Link
                to="/dashboard/api-keys"
                className="px-5 py-2.5 rounded-lg bg-[#161616] border border-[#2a2a2a] hover:bg-[#202020] transition-colors text-sm font-semibold text-white shrink-0 flex items-center gap-2"
              >
                Generate New Key <ArrowRight className="w-4 h-4 text-zinc-400" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => <ConnectCard key={agent.id} agent={agent} apiKeys={apiKeys} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Agents;
