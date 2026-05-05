import React from 'react';
import axios from 'axios';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, Cpu, Database, Shield, TrendingUp } from '../components/Icons';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage, isBackendUnavailable } from '../lib/network';
import { promptLifecycle, supportedAgents } from '../lib/agentRuntime';
import AgentBrandIcon from '../components/AgentBrandIcon';
import BlobLoader from '../components/BlobLoader';

const chartColors = ['#EA803A', '#f4b183', '#5fd1b3', '#7c9cf5'];

const fallbackStats = {
  totalApiCalls: 0,
  totalSavedTokens: 0,
  apiCallsChange: 0,
  activeApiKeys: 0,
  apiKeysChange: 0,
  documentsProcessed: 0,
  totalSavedUsd: 0,
  documentsChange: 0,
  successRate: 0,
  successRateChange: 0,
  averageSavedPercent: 0,
  requestSuccessRate: 0,
  totalTokens: 0,
  connectedAgents: 0,
  connectedRepos: 0
};

  const fallbackData = {
  apiCallsOverTime: [],
  usageByEndpoint: [],
  recentActivity: [],
  hourlyDistribution: [],
  topReusableRepos: [],
  modelBreakdown: [],
  agentBreakdown: [],
  anomalies: [],
  insights: []
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
    <p className="text-xs text-zinc-500">{detail}</p>
  </div>
);

const Dashboard = () => {
  const { data, isLoading, isError, error } = useQuery(
    'dashboard-stats',
    async () => {
      const response = await axios.get(resolveApiUrl('/api/dashboard/stats'));
      const payload = response.data || {};
      const usageByEndpoint = (payload.usageByEndpoint || []).map((item) => ({
        ...item,
        percentage: payload.stats?.totalApiCalls
          ? Math.round((item.calls / payload.stats.totalApiCalls) * 100)
          : 0
      }));

      return {
        stats: payload.stats || fallbackStats,
        apiCallsOverTime: payload.apiCallsOverTime || fallbackData.apiCallsOverTime,
        usageByEndpoint,
        recentActivity: payload.recentActivity || fallbackData.recentActivity,
        hourlyDistribution: payload.hourlyDistribution || fallbackData.hourlyDistribution,
        topReusableRepos: payload.topReusableRepos || fallbackData.topReusableRepos,
        modelBreakdown: payload.modelBreakdown || fallbackData.modelBreakdown,
        agentBreakdown: payload.agentBreakdown || fallbackData.agentBreakdown,
        anomalies: payload.anomalies || fallbackData.anomalies,
        insights: payload.insights || fallbackData.insights,
        connectedSources: payload.connectedSources || [],
        sourceCoverage: payload.sourceCoverage || {
          connectedSourceCount: 0,
          connectedSources: [],
          sourceCoverageSummary: 'No company sources connected yet'
        }
      };
    },
    {
      refetchInterval: (_, query) => (isBackendUnavailable(query.state.error) ? false : 30000),
      retry: (failureCount, queryError) => !isBackendUnavailable(queryError) && failureCount < 1
    }
  );

  const stats = data?.stats || fallbackStats;
  const apiCallsOverTime = data?.apiCallsOverTime || fallbackData.apiCallsOverTime;
  const usageByEndpoint = data?.usageByEndpoint || fallbackData.usageByEndpoint;
  const recentActivity = data?.recentActivity || fallbackData.recentActivity;
  const topReusableRepos = data?.topReusableRepos || fallbackData.topReusableRepos;
  const modelBreakdown = data?.modelBreakdown || fallbackData.modelBreakdown;
  const agentBreakdown = data?.agentBreakdown || fallbackData.agentBreakdown;
  const anomalies = data?.anomalies || fallbackData.anomalies;
  const insights = data?.insights || fallbackData.insights;
  const connectedSources = data?.connectedSources || [];
  const sourceCoverage = data?.sourceCoverage || {
    connectedSourceCount: 0,
    connectedSources: [],
    sourceCoverageSummary: 'No company sources connected yet'
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <BlobLoader size={48} label="" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            System Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Hosted control plane for paired agents, coding telemetry, token savings, and repository activity.
          </p>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-red-300 text-sm">
          Failed to load dashboard stats: {getErrorMessage(error, 'Unknown error')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Saved Tokens" value={(stats.totalSavedTokens || 0).toLocaleString()} detail={`${stats.totalApiCalls || 0} observed requests`} icon={Activity} color="text-[#EA803A]" bg="bg-[#EA803A]/10" />
        <StatCard title="Connected Agents" value={stats.connectedAgents || 0} detail={`${stats.connectedRepos || 0} repositories currently linked`} icon={Cpu} color="text-blue-400" bg="bg-blue-400/10" />
        <StatCard title="Active API Keys" value={stats.activeApiKeys || 0} detail="Available for direct API access or agent pairing" icon={Shield} color="text-[#5fd1b3]" bg="bg-[#5fd1b3]/10" />
        <StatCard title="Saved Cost" value={`$${Number(stats.totalSavedUsd || 0).toFixed(2)}`} detail={`${stats.successRate || 0}% reuse hit rate`} icon={TrendingUp} color="text-[#f4b183]" bg="bg-[#f4b183]/10" />
      </div>

      <div className="rounded-2xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#EA803A]" />
              <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Company Source Coverage</h3>
            </div>
            <p className="mt-2 text-sm text-zinc-400">{sourceCoverage.sourceCoverageSummary}</p>
          </div>
          <Link
            to="/dashboard/integrations"
            className="inline-flex items-center gap-2 self-start rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#181818]"
          >
            Manage Integrations
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {connectedSources.length > 0 ? connectedSources.map((source) => (
            <span key={source.provider} className="rounded-full border border-[#202020] bg-[#111] px-3 py-1.5 text-xs text-zinc-300">
              {source.label || source.provider} · {source.lastSyncStatus || 'idle'}
            </span>
          )) : (
            <p className="text-sm text-zinc-500">Connect Slack, Google Workspace, or GitHub to warm up the Company Brain.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>Request Volume (7 Days)</h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={apiCallsOverTime} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#1c1c1c" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Line type="monotone" dataKey="calls" stroke="#EA803A" strokeWidth={2} dot={{ r: 3, fill: '#0d0d0d', stroke: '#EA803A', strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-6 flex flex-col">
          <h3 className="text-base font-semibold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Operation Mix</h3>
          <div className="flex-1 min-h-[200px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={usageByEndpoint} dataKey="calls" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4}>
                  {usageByEndpoint.map((entry, index) => (
                    <Cell key={entry.endpoint} fill={chartColors[index % chartColors.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {usageByEndpoint.length > 0 ? usageByEndpoint.map((item, index) => (
              <div key={item.endpoint} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                  <span className="text-zinc-300 capitalize">{item.endpoint}</span>
                </div>
                <span className="text-zinc-500">{item.percentage}%</span>
              </div>
            )) : (
              <p className="text-zinc-500 text-sm text-center">No endpoint data</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#1c1c1c] flex items-center justify-between">
            <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Connected Agents</h3>
            <Link to="/dashboard/agents" className="text-xs text-[#EA803A] hover:text-[#f0965a] transition-colors flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-[#1c1c1c]">
            {(agentBreakdown.length > 0 ? agentBreakdown : supportedAgents.slice(0, 4).map((agent) => ({ agentId: agent.id, calls: 0, costUsd: 0, totalTokens: 0 }))).slice(0, 4).map((item) => {
              const agent = supportedAgents.find((entry) => entry.id === item.agentId) || { id: item.agentId, name: item.agentId, surface: 'MCP', summary: 'Connected coding agent.' };
              return (
                <div key={agent.id} className="p-4 hover:bg-[#111111] transition-colors">
                  <div className="flex items-center gap-3">
                    <AgentBrandIcon agentId={agent.id} name={agent.name} containerClassName="w-9 h-9 shrink-0" size="h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-white">{agent.name}</h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">{agent.surface}</span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{agent.summary}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-white font-medium">{item.calls || 0} req</p>
                      <p className="text-[10px] text-zinc-500">{Number(item.totalTokens || 0).toLocaleString()} tokens</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#1c1c1c]">
            <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Repository Activity</h3>
          </div>
          <div className="flex-1 overflow-auto max-h-[320px]">
            {topReusableRepos.length > 0 ? (
              <div className="divide-y divide-[#1c1c1c]">
                {topReusableRepos.map((repo) => (
                  <div key={`${repo.repoId}-${repo.branch || 'main'}`} className="p-4 flex items-center justify-between hover:bg-[#111111] transition-colors gap-4">
                    <div className="min-w-0 pr-4">
                      <p className="text-sm font-medium text-zinc-200 truncate">{repo.repoName || repo.repoId}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {(repo.branch || 'default')} • {(repo.agents || []).join(', ') || 'workspace'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-[#EA803A]">{repo.calls || 0}</p>
                      <p className="text-xs text-zinc-500">{Number(repo.saved || 0).toLocaleString()} tokens saved</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">No repository usage recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#1c1c1c]">
            <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Recent Agent Activity</h3>
          </div>
          <div className="flex-1 overflow-auto max-h-[320px]">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-[#1c1c1c]">
                {recentActivity.map((activity, index) => (
                  <div key={`${activity.timestamp}-${index}`} className="p-4 hover:bg-[#111111] transition-colors">
                    <div className="flex items-center justify-between mb-1 gap-3">
                      <p className="text-sm font-medium text-white truncate pr-4">{activity.description}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${activity.status === 'completed' ? 'bg-[#5fd1b3]/10 text-[#5fd1b3]' : 'bg-red-500/10 text-red-400'}`}>
                        {activity.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span>{new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                      <span>{activity.agentId || 'agent'}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                      <span>{activity.repoId || 'workspace'}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                      <span>{activity.modelName || 'unknown model'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">No recent runs recorded.</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Actionable Signals</h3>
            <div className="space-y-3">
              {(anomalies.length > 0 ? anomalies.slice(0, 2) : insights.slice(0, 2)).map((item, index) => (
                <div key={`${item.type || item.title}-${index}`} className={`rounded-lg border p-3 ${item.message ? 'border-red-500/20 bg-red-500/5' : 'border-[#202020] bg-[#111]'}`}>
                  <p className={`text-sm font-medium ${item.message ? 'text-red-300' : 'text-white'}`}>{item.message || item.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">{item.body || `${item.agentId || 'agent'} • ${item.repoId || 'workspace'}`}</p>
                </div>
              ))}
              {anomalies.length === 0 && insights.length === 0 && (
                <p className="text-sm text-zinc-500">Signals will appear here as paired agents start producing telemetry.</p>
              )}
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Model Breakdown</h3>
            <div className="space-y-3">
              {(modelBreakdown.length > 0 ? modelBreakdown : [{ modelName: 'No model data', calls: 0, costUsd: 0 }]).slice(0, 4).map((model) => (
                <div key={model.modelName} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 pr-3">
                    <p className="text-white truncate">{model.modelName}</p>
                    <p className="text-[10px] text-zinc-500">{model.modelProvider || 'provider unknown'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-zinc-200">{model.calls || 0} req</p>
                    <p className="text-[10px] text-zinc-500">${Number(model.costUsd || 0).toFixed(4)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-5 flex-1">
            <h3 className="text-sm font-semibold text-white mb-3">Memory Lifecycle</h3>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#EA803A] before:to-transparent">
              {promptLifecycle.slice(0, 3).map((item, idx) => (
                <div key={idx} className="relative flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#161616] border-2 border-[#EA803A] flex items-center justify-center shrink-0 text-[10px] font-bold text-[#EA803A]">
                    {idx + 1}
                  </div>
                  <p className="text-xs text-zinc-400 leading-tight"><span className="text-zinc-200 font-medium block mb-0.5">{item.title}</span>{item.description.substring(0, 64)}...</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
