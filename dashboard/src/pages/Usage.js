import React from 'react';
import axios from 'axios';
import { useQuery } from 'react-query';
import { Activity, TrendingUp, AlertTriangle, CheckCircle, Cpu, Database } from '../components/Icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { estimateTokenSavings } from '../lib/agentRuntime';
import { resolveApiUrl } from '../lib/api';
import { isBackendUnavailable } from '../lib/network';
import BlobLoader from '../components/BlobLoader';

// Curly scalloped shape with an engraved styling trick
const CustomShapeIcon = ({ className }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={className} 
    style={{ filter: 'drop-shadow(0 1px 0px rgba(255,255,255,0.12))' }} 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M50 3 C 60 3 63 12 72 12 C 81 12 87 6 92 12 C 97 18 91 26 91 35 C 91 44 98 48 98 50 C 98 52 91 56 91 65 C 91 74 97 82 92 88 C 87 94 81 88 72 88 C 63 88 60 97 50 97 C 40 97 37 88 28 88 C 19 88 13 94 8 88 C 3 82 9 74 9 65 C 9 56 2 52 2 50 C 2 48 9 44 9 35 C 9 26 3 18 8 12 C 13 6 19 12 28 12 C 37 12 40 3 50 3 Z"
      fill="#000000"
      stroke="currentColor"
      strokeOpacity="0.4"
      strokeWidth="3"
    />
  </svg>
);

const Usage = () => {
  const { data: usageData, isLoading } = useQuery(
    'usage-data',
    async () => {
      const response = await axios.get(resolveApiUrl('/api/usage'));
      return response.data;
    },
    {
      refetchInterval: (_, query) => (isBackendUnavailable(query.state.error) ? false : 60000),
      retry: (failureCount, queryError) => !isBackendUnavailable(queryError) && failureCount < 1
    }
  );

  const rawData = usageData || {};
  const data = {
    stats: {
      totalCalls: rawData.stats?.totalCalls ?? 0,
      callsToday: rawData.stats?.callsToday ?? 0,
      avgResponseTime: rawData.stats?.avgResponseTime ?? 0,
      successRate: rawData.stats?.successRate ?? 100,
      errorRate: rawData.stats?.errorRate ?? 0,
      remainingQuota: rawData.stats?.remainingQuota ?? 100,
      quotaLimit: rawData.stats?.quotaLimit ?? 100,
      peakHour: rawData.stats?.peakHour ?? 'N/A',
      avgPerMin: rawData.stats?.avgPerMin ?? 'N/A',
      resetIn: rawData.stats?.resetIn ?? 'N/A',
      savedTokensToday: rawData.stats?.savedTokensToday ?? 0,
      savedCostToday: rawData.stats?.savedCostToday ?? 0,
      reuseHitRate: rawData.stats?.reuseHitRate ?? 0,
      totalTokens: rawData.stats?.totalTokens ?? 0,
      totalCostUsd: rawData.stats?.totalCostUsd ?? 0,
      uniqueAgents: rawData.stats?.uniqueAgents ?? 0,
      uniqueRepos: rawData.stats?.uniqueRepos ?? 0
    },
    usageOverTime: rawData.dailyUsage || [],
    endpointBreakdown: rawData.endpointBreakdown || [],
    repoBreakdown: rawData.repoBreakdown || [],
    modelBreakdown: rawData.modelBreakdown || [],
    agentBreakdown: rawData.agentBreakdown || [],
    taskBreakdown: rawData.taskBreakdown || [],
    recentActivity: rawData.recentActivity || [],
    timeline: rawData.timeline || [],
    anomalies: rawData.anomalies || [],
    insights: rawData.insights || [],
    hourlyDistribution: rawData.hourlyDistribution || []
  };

  const tokenStats = estimateTokenSavings(data.stats.totalCalls);
  const quotaPercentage = Math.min(100, ((data.stats.callsToday || 0) / Math.max(data.stats.quotaLimit || 1, 1)) * 100);

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
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Usage & Observability
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time view of request volume, model spend, repository activity, and coding-agent behavior.
          </p>
        </div>
        <button
          className="px-5 py-2.5 rounded-lg font-semibold text-black text-sm bg-gradient-to-b from-[#EA803A] to-[#d66a25] shadow-lg shadow-[#EA803A]/20 hover:opacity-90 transition-opacity"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Export Report
        </button>
      </div>

      {/* Stats Cards Grid with Curly Engraved Border & ClipText */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total API Calls', value: data.stats.totalCalls.toLocaleString(), detail: `${data.stats.uniqueAgents} active agents`, icon: Activity, color: 'text-blue-400' },
          { label: 'Avg Response Time', value: `${data.stats.avgResponseTime}ms`, detail: `${data.stats.uniqueRepos} repositories observed`, icon: TrendingUp, color: 'text-[#5fd1b3]' },
          { label: 'Success Rate', value: `${data.stats.successRate}%`, detail: `${data.stats.totalTokens.toLocaleString()} total tokens`, icon: CheckCircle, color: 'text-[#EA803A]' },
          { label: 'Error Rate', value: `${data.stats.errorRate}%`, detail: `$${Number(data.stats.totalCostUsd || 0).toFixed(4)} observed spend`, icon: AlertTriangle, color: 'text-red-400' }
        ].map((stat) => (
          <div key={stat.label} className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-700/40 to-zinc-900/10 shadow-md">
            <div className="bg-[#0d0d0d] rounded-xl p-5 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 mb-4">
                <span className="text-sm font-medium tracking-wide">{stat.label}</span>
                <div className={`relative w-9 h-9 flex items-center justify-center ${stat.color}`}>
                  <CustomShapeIcon className="absolute inset-0 w-full h-full" />
                  <stat.icon className="w-4 h-4 relative z-10 opacity-90" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {stat.value}
                </p>
                <p className="text-xs text-zinc-500 mt-2">{stat.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
          <div className="bg-[#0d0d0d] rounded-xl p-6 h-full">
            <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Daily Quota Usage</h3>
            <p className="text-xs text-zinc-500 mb-6">Resets in {data.stats.resetIn} | {rawData.stats?.accessMessage || 'Standard usage caps apply.'}</p>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">
                  <strong className="text-white">{data.stats.callsToday.toLocaleString()}</strong> / {data.stats.quotaLimit.toLocaleString()} requests
                </span>
                <span className="text-sm font-medium text-[#EA803A]">{Math.round(quotaPercentage)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1a1a1a] overflow-hidden border border-[#222]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#EA803A] to-[#f0965a]" style={{ width: `${quotaPercentage}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1c1c1c]">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Peak Hour</p>
                <p className="font-medium text-white text-sm">{data.stats.peakHour}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Avg/Min</p>
                <p className="font-medium text-white text-sm">{data.stats.avgPerMin}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Reuse Rate</p>
                <p className="font-medium text-[#5fd1b3] text-sm">{data.stats.reuseHitRate}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
          <div className="bg-[#0d0d0d] rounded-xl p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Context Efficiency</h3>
                <p className="text-xs text-zinc-500">Savings from memory-backed context retrieval and reuse</p>
              </div>
              <span className="inline-flex items-center rounded-md border border-[#5fd1b3]/20 bg-[#5fd1b3]/10 px-2.5 py-1 text-xs font-medium text-[#5fd1b3]">
                ~{tokenStats.percentSaved}% Saved
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4 flex-1">
              <div className="bg-[#111111] border border-[#202020] rounded-lg p-4 flex flex-col justify-center shadow-inner">
                <p className="text-xs text-zinc-500 mb-1">Standard Prompting</p>
                <p className="text-lg font-bold text-white">{tokenStats.estimatedWithoutBrain.toLocaleString()}</p>
              </div>
              <div className="bg-[#111111] border border-[#202020] rounded-lg p-4 flex flex-col justify-center shadow-inner">
                <p className="text-xs text-zinc-500 mb-1">With Velocity Brain</p>
                <p className="text-lg font-bold text-[#5fd1b3]">{tokenStats.estimatedWithBrain.toLocaleString()}</p>
              </div>
              <div className="bg-[#111111] border border-[#202020] rounded-lg p-4 flex flex-col justify-center shadow-inner">
                <p className="text-xs text-zinc-500 mb-1">Tokens Saved</p>
                <p className="text-lg font-bold text-[#EA803A]">{tokenStats.saved.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#1c1c1c] pt-4">
              <span className="text-sm text-zinc-400">Total cost saved today</span>
              <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-[#5fd1b3]">${Number(data.stats.savedCostToday || 0).toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
          <div className="bg-[#0d0d0d] rounded-xl p-6 h-full">
            <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>Request Volume (7 Days)</h3>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.usageOverTime} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1c1c1c" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#EA803A' }} />
                  <Line type="monotone" dataKey="calls" stroke="#EA803A" strokeWidth={2} dot={{ r: 3, fill: '#0d0d0d', stroke: '#EA803A', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
          <div className="bg-[#0d0d0d] rounded-xl p-6 h-full">
            <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>Hourly Distribution</h3>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourlyDistribution} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1c1c1c" vertical={false} />
                  <XAxis dataKey="hour" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#161616' }} contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="calls" fill="url(#colorCalls)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EA803A" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#d66a25" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
          <div className="bg-[#0d0d0d] rounded-xl overflow-hidden h-full">
            <div className="p-5 border-b border-[#1c1c1c] flex items-center justify-between">
              <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>Agent & Model Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1c1c1c]">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-[#EA803A]/10 border border-[#EA803A]/20 flex items-center justify-center">
                    <Cpu className="w-3.5 h-3.5 text-[#EA803A]" />
                  </div>
                  <p className="text-sm font-medium text-white">Agents</p>
                </div>
                <div className="space-y-3 max-h-[240px] overflow-auto pr-1">
                  {data.agentBreakdown.length > 0 ? data.agentBreakdown.map((agent) => (
                    <div key={agent.agentId} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                      <div className="min-w-0">
                        <p className="text-white truncate">{agent.agentId}</p>
                        <p className="text-[10px] text-zinc-500">{agent.repoCount || 0} repos | {agent.modelCount || 0} models</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-zinc-200">{agent.calls || 0} req</p>
                        <p className="text-[10px] text-zinc-500">${Number(agent.costUsd || 0).toFixed(4)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-zinc-500">No agent telemetry yet.</p>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-[#5fd1b3]/10 border border-[#5fd1b3]/20 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-[#5fd1b3]" />
                  </div>
                  <p className="text-sm font-medium text-white">Models</p>
                </div>
                <div className="space-y-3 max-h-[240px] overflow-auto pr-1">
                  {data.modelBreakdown.length > 0 ? data.modelBreakdown.map((model) => (
                    <div key={`${model.modelProvider}-${model.modelName}`} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                      <div className="min-w-0">
                        <p className="text-white truncate">{model.modelName}</p>
                        <p className="text-[10px] text-zinc-500">{model.modelProvider || 'provider unknown'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-zinc-200">{model.calls || 0} req</p>
                        <p className="text-[10px] text-zinc-500">${Number(model.costUsd || 0).toFixed(4)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-zinc-500">No model telemetry yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
          <div className="bg-[#0d0d0d] rounded-xl overflow-hidden h-full">
            <div className="p-5 border-b border-[#1c1c1c] flex items-center justify-between">
              <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>Repository & Task Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1c1c1c]">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-[#EA803A]/10 border border-[#EA803A]/20 flex items-center justify-center">
                    <Database className="w-3.5 h-3.5 text-[#EA803A]" />
                  </div>
                  <p className="text-sm font-medium text-white">Repositories</p>
                </div>
                <div className="space-y-3 max-h-[240px] overflow-auto pr-1">
                  {data.repoBreakdown.length > 0 ? data.repoBreakdown.map((repo) => (
                    <div key={`${repo.repoId}-${repo.branch || 'default'}`} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                      <div className="min-w-0">
                        <p className="text-white truncate">{repo.repoName || repo.repoId}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{repo.branch || 'default'} | {(repo.agents || []).join(', ') || 'workspace'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-zinc-200">{repo.calls || 0} req</p>
                        <p className="text-[10px] text-zinc-500">{Number(repo.savedTokens || 0).toLocaleString()} saved</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-zinc-500">No repository telemetry yet.</p>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-[#5fd1b3]/10 border border-[#5fd1b3]/20 flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5 text-[#5fd1b3]" />
                  </div>
                  <p className="text-sm font-medium text-white">Task Types</p>
                </div>
                <div className="space-y-3 max-h-[240px] overflow-auto pr-1">
                  {data.taskBreakdown.length > 0 ? data.taskBreakdown.map((task) => (
                    <div key={task.taskType} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                      <div className="min-w-0">
                        <p className="text-white truncate uppercase tracking-wide">{task.taskType}</p>
                        <p className="text-[10px] text-zinc-500">{task.operationType || 'operation unknown'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-zinc-200">{task.calls || 0} req</p>
                        <p className="text-[10px] text-zinc-500">{Math.round(task.avgLatencyMs || 0)}ms avg</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-zinc-500">No task attribution yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
          <div className="bg-[#0d0d0d] rounded-xl overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-[#1c1c1c]">
              <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>Repository Activity Timeline</h3>
            </div>
            <div className="flex-1 overflow-auto max-h-[320px]">
              {data.timeline.length > 0 ? (
                <div className="divide-y divide-[#1c1c1c]">
                  {data.timeline.slice(0, 20).map((item, index) => (
                    <div key={`${item.timestamp}-${index}`} className="p-4 bg-transparent">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm font-medium text-white truncate">{item.description}</p>
                        <span className={`shrink-0 px-2 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide ${item.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-[#5fd1b3]/10 text-[#5fd1b3] border-[#5fd1b3]/20'}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span>{item.repoId || 'workspace'}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span>{item.branch || 'default'}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span>{item.agentId || 'agent'}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span>{item.taskType || item.operationType || 'unknown task'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-zinc-500">No timeline events yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
            <div className="bg-[#0d0d0d] rounded-xl p-5 h-full">
              <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Signals</h3>
              <div className="space-y-3">
                {(data.anomalies.length > 0 ? data.anomalies.slice(0, 2) : data.insights.slice(0, 2)).map((item, index) => (
                  <div key={`${item.type || item.title}-${index}`} className={`rounded-lg border p-3 ${item.message ? 'border-red-500/30 bg-red-500/5' : 'border-[#202020] bg-[#111]'}`}>
                    <p className={`text-sm font-medium ${item.message ? 'text-red-300' : 'text-white'}`}>{item.message || item.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{item.body || `${item.agentId || 'agent'} | ${item.repoId || 'workspace'}`}</p>
                  </div>
                ))}
                {data.anomalies.length === 0 && data.insights.length === 0 && (
                  <p className="text-sm text-zinc-500">No anomalies or optimization insights yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
            <div className="bg-[#0d0d0d] rounded-xl p-5 h-full">
              <h3 className="text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Recent Activity</h3>
              <div className="space-y-3 max-h-[260px] overflow-auto">
                {data.recentActivity.length > 0 ? data.recentActivity.slice(0, 8).map((item, index) => (
                  <div key={`${item.timestamp}-${index}`} className="rounded-lg border border-[#202020] bg-zinc-900/50 p-3 shadow-inner">
                    <p className="text-sm text-white truncate">{item.description}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">{item.repoId || 'workspace'} | {item.modelName || 'unknown model'}</p>
                  </div>
                )) : (
                  <p className="text-sm text-zinc-500">No recent activity to display.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Usage;