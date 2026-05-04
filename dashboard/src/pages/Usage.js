import React from 'react';
import axios from 'axios';
import { useQuery } from 'react-query';
import { Activity, TrendingUp, AlertTriangle, CheckCircle } from '../components/Icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { estimateTokenSavings } from '../lib/agentRuntime';
import { resolveApiUrl } from '../lib/api';
import { isBackendUnavailable } from '../lib/network';
import BlobLoader from '../components/BlobLoader';

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

  // Mock data for demonstration
  const mockData = {
    dailyUsage: [
      { date: '2024-03-01', calls: 45 },
      { date: '2024-03-02', calls: 52 },
      { date: '2024-03-03', calls: 38 },
      { date: '2024-03-04', calls: 65 },
      { date: '2024-03-05', calls: 71 },
      { date: '2024-03-06', calls: 43 },
      { date: '2024-03-07', calls: 89 }
    ],
    endpointBreakdown: [
      { endpoint: 'query', calls: 2340, percentage: 45 },
      { endpoint: 'ingest', calls: 1560, percentage: 30 },
      { endpoint: 'run', calls: 780, percentage: 15 },
      { endpoint: 'skills', calls: 520, percentage: 10 }
    ],
    repoBreakdown: [],
    recentActivity: [],
    hourlyDistribution: [
      { hour: '00:00', calls: 12 },
      { hour: '04:00', calls: 8 },
      { hour: '08:00', calls: 45 },
      { hour: '12:00', calls: 78 },
      { hour: '16:00', calls: 92 },
      { hour: '20:00', calls: 56 }
    ],
    stats: {
      totalCalls: 0,
      callsToday: 0,
      avgResponseTime: 0,
      errorRate: 0,
      remainingQuota: 100,
      quotaLimit: 100,
      peakHour: 'N/A',
      avgPerMin: 'N/A',
      resetIn: 'N/A',
      savedTokensToday: 0,
      savedCostToday: 0,
      reuseHitRate: 0
    }
  };

  // Map backend response fields to frontend expected fields
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
      reuseHitRate: rawData.stats?.reuseHitRate ?? 0
    },
    dailyUsage: rawData.dailyUsage || mockData.dailyUsage,
    usageOverTime: rawData.dailyUsage || rawData.apiCallsOverTime || mockData.dailyUsage,
    latencyDistribution: (rawData.hourlyDistribution || mockData.hourlyDistribution).map((item) => ({
      range: item.range || item.hour,
      count: item.count ?? item.calls ?? 0
    })),
    endpointBreakdown: rawData.endpointBreakdown || mockData.endpointBreakdown,
    repoBreakdown: rawData.repoBreakdown || mockData.repoBreakdown,
    recentActivity: rawData.recentActivity || mockData.recentActivity,
    hourlyDistribution: rawData.hourlyDistribution || mockData.hourlyDistribution
  };
  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6'];
  const tokenStats = estimateTokenSavings(data.stats.totalCalls);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <BlobLoader size={72} label="" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Usage</h1>
          <p className="text-sm text-zinc-500 mt-1">All features are currently free for everyone for a limited time. Usage limits still apply and reset daily.</p>
        </div>
        <button
          className="px-8 py-3 rounded-xl font-bold text-black text-base transition-all"
          style={{ 
            fontFamily: 'Syne, sans-serif',
            background: '#EA803A',
            boxShadow: '4px 4px 0 #c4612a'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
          onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
        >
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Total API Calls</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.totalCalls.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-black flex-shrink-0" style={{ background: '#7c9cf5' }}>
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Average Response Time</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.avgResponseTime}ms</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-black flex-shrink-0" style={{ background: '#5fd1b3' }}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Success Rate</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.successRate}%</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-black flex-shrink-0" style={{ background: '#EA803A' }}>
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Error Rate</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.errorRate}%</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-black flex-shrink-0" style={{ background: '#f4b183' }}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Saved Tokens Today</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.savedTokensToday.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-black flex-shrink-0" style={{ background: '#f4b183' }}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Quota Usage */}
      <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Daily Quota Usage</p>
        <p className="text-xs text-zinc-500 mb-3">{rawData.stats?.accessMessage || 'Limited-time free access with standard usage caps.'}</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{data.stats.callsToday} / {data.stats.quotaLimit} requests</span>
          <span className="text-sm font-bold text-[#f2b07d]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{Math.round(((data.stats.callsToday || 0) / Math.max(data.stats.quotaLimit || 1, 1)) * 100)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, ((data.stats.callsToday || 0) / Math.max(data.stats.quotaLimit || 1, 1)) * 100)}%`, background: 'linear-gradient(90deg, #EA803A 0%, #f4b183 100%)' }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Peak Hour</p>
            <p className="font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.peakHour}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Avg/Min</p>
            <p className="font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.avgPerMin}</p>
          </div>
          <div>
            <p className="text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Reset In</p>
            <p className="font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.resetIn}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Saved Cost Today</p>
            <p className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>${Number(data.stats.savedCostToday || 0).toFixed(6)}</p>
          </div>
          <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Reuse Hit Rate</p>
            <p className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{data.stats.reuseHitRate}%</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Token Efficiency</p>
            <h3 className="text-lg text-white font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Why memory-backed prompts cost less context</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#EA803A33] bg-[#EA803A14] px-3 py-2 text-[11px] text-[#f2b07d]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            ~{tokenStats.percentSaved}% estimated prompt-token reduction
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Without Velocity Brain</p>
            <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>{tokenStats.estimatedWithoutBrain.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Estimated prompt tokens if users keep repeating repo context manually.</p>
          </div>
          <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>With Velocity Brain</p>
            <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>{tokenStats.estimatedWithBrain.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Estimated prompt tokens after retrieval, filtering, and compression before execution.</p>
          </div>
          <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Context Saved</p>
            <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>{tokenStats.saved.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Estimated prompt-token waste avoided by using the memory layer first.</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
          <p className="text-sm text-zinc-300 leading-7">
            Velocity Brain lowers prompt cost by retrieving only the relevant memory, repo facts, and prior decisions for each task.
            Instead of asking the user to resend architecture, conventions, and past findings every time, the agent starts with a smaller,
            denser context package.
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Request Volume</p>
          <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Calls over time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.usageOverTime}>
              <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }} />
              <Line type="monotone" dataKey="calls" stroke="#EA803A" strokeWidth={2} dot={{ fill: '#EA803A', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Response Performance</p>
          <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Latency distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.latencyDistribution}>
              <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
              <XAxis dataKey="range" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="count" fill="#7c9cf5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {data.endpointBreakdown.map((item, index) => (
              <div key={item.endpoint} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="text-zinc-300 truncate">{item.endpoint}</span>
                </div>
                <span className="text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Repo Usage</p>
          <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Top connected repos</h3>
          <div className="space-y-3">
            {data.repoBreakdown.length ? data.repoBreakdown.map((repo) => (
              <div key={repo.repoId} className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{repo.repoId}</p>
                  <span className="text-xs text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{repo.calls} calls</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                  <span>Saved tokens: {repo.savedTokens.toLocaleString()}</span>
                  <span>Saved cost: ${Number(repo.savedCost || 0).toFixed(6)}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-zinc-500">No repo-linked usage has been reported yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Recent Activity</p>
          <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Latest query, run, and writeback events</h3>
          <div className="space-y-3">
            {data.recentActivity.length ? data.recentActivity.map((item, index) => (
              <div key={`${item.timestamp}-${index}`} className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{item.description}</p>
                  <span className={`rounded-full border px-2 py-1 text-[10px] ${item.status === 'failed' ? 'border-[#5a1f1f] bg-[#2a1111] text-[#ff9b9b]' : 'border-[#17301f] bg-[#13261d] text-[#7fe3c8]'}`}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-400 sm:grid-cols-2">
                  <span>Repo: {item.repoId || 'default-workspace'}</span>
                  <span>Reuse: {item.reuseHitType || 'none'}</span>
                  <span>Saved tokens: {(item.avoidedInputTokens || 0).toLocaleString()}</span>
                  <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown time'}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-zinc-500">No recent usage activity has been reported yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="rounded-2xl border border-[#242424] bg-[#0d0d0d] p-5" style={{ boxShadow: '4px 4px 0 #00000055' }}>
        <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Hourly Distribution</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.hourlyDistribution}>
            <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
            <XAxis dataKey="hour" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#fff' }} />
            <Bar dataKey="calls" fill="#EA803A" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Usage;
