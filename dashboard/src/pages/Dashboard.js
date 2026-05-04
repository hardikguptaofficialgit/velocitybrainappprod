import React from 'react';
import axios from 'axios';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, Cpu, Database, Shield, TrendingUp, User as Users } from '../components/Icons';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage, isBackendUnavailable } from '../lib/network';
import { promptLifecycle, supportedAgents } from '../lib/agentRuntime';
import BlobLoader from '../components/BlobLoader';

const chartColors = ['#EA803A', '#f4b183', '#5fd1b3', '#7c9cf5'];

const fallbackStats = {
  totalApiCalls: 0,
  apiCallsChange: 0,
  activeApiKeys: 0,
  apiKeysChange: 0,
  documentsProcessed: 0,
  documentsChange: 0,
  successRate: 0,
  successRateChange: 0,
  averageSavedPercent: 0,
  requestSuccessRate: 0
};

const fallbackData = {
  apiCallsOverTime: [],
  usageByEndpoint: [],
  recentActivity: [],
  hourlyDistribution: [],
  topReusableRepos: []
};

const Dashboard = () => {
  const { data, isLoading, isError, error } = useQuery(
    'dashboard-stats',
    async () => {
      console.info('[Dashboard] Fetching dashboard stats', {
        apiBaseUrl: axios.defaults.baseURL || '(relative /api)',
        hasAuthHeader: Boolean(axios.defaults.headers.common.Authorization)
      });

      const response = await axios.get(resolveApiUrl('/api/dashboard/stats'));
      const payload = response.data || {};
      console.info('[Dashboard] Dashboard stats fetch succeeded', {
        totalApiCalls: payload.stats?.totalApiCalls ?? 0,
        activeApiKeys: payload.stats?.activeApiKeys ?? 0,
        recentActivityCount: payload.recentActivity?.length ?? 0
      });
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
        topReusableRepos: payload.topReusableRepos || fallbackData.topReusableRepos
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
  const hourlyDistribution = data?.hourlyDistribution || fallbackData.hourlyDistribution;
  const topReusableRepos = data?.topReusableRepos || fallbackData.topReusableRepos;

  if (isError) {
    console.error('[Dashboard] Dashboard stats fetch failed', {
      code: error?.code,
      status: error?.response?.status,
      message: error?.message,
      response: error?.response?.data
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <BlobLoader size={72} label="" />
      </div>
    );
  }

  const StatCard = ({ title, value, change, icon: Icon, tint }) => (
    <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{title}</p>
          <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</p>
          <p className={`mt-2 text-xs ${change >= 0 ? 'text-[#f2b07d]' : 'text-red-400'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {change >= 0 ? '+' : ''}{change}% vs last window
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-black flex-shrink-0" style={{ background: tint }}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {isError && (
        <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-red-300 text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          Failed to load dashboard stats: {getErrorMessage(error, 'Unknown error')}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Saved Tokens" value={stats.totalApiCalls || 0} change={stats.apiCallsChange || 0} icon={Activity} tint="#EA803A" />
        <StatCard title="Active API Keys" value={stats.activeApiKeys || 0} change={stats.apiKeysChange || 0} icon={ArrowRight} tint="#f4b183" />
        <StatCard title="Saved USD" value={`$${stats.documentsProcessed || 0}`} change={stats.documentsChange || 0} icon={Users} tint="#5fd1b3" />
        <StatCard title="Reuse Hit Rate" value={`${stats.successRate || 0}%`} change={stats.successRateChange || 0} icon={TrendingUp} tint="#7c9cf5" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_.95fr] gap-6">
        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Savings Curve</p>
              <h3 className="text-lg text-white font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Saved tokens over time</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={apiCallsOverTime}>
              <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }} />
              <Line type="monotone" dataKey="calls" stroke="#EA803A" strokeWidth={2} dot={{ fill: '#EA803A', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Reuse Mix</p>
          <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Runs by reuse hit type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={usageByEndpoint} dataKey="calls" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={4}>
                {usageByEndpoint.map((entry, index) => (
                  <Cell key={entry.endpoint} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {usageByEndpoint.length > 0 ? usageByEndpoint.map((item, index) => (
              <div key={item.endpoint} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: chartColors[index % chartColors.length] }}></span>
                  <span className="text-zinc-300 truncate">{item.endpoint}</span>
                </div>
                <span className="text-zinc-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.percentage}%</span>
              </div>
            )) : (
              <p className="text-zinc-500 text-sm">No endpoint data yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_.95fr] gap-6">
        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Automatic Reuse</p>
              <h3 className="text-lg text-white font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>How hosted memory cuts repeat tokens</h3>
            </div>
            <Link
              to="/dashboard/agents"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111] border border-[#2a2a2a] text-sm text-zinc-300 hover:text-white hover:border-[#EA803A66] transition-colors"
            >
              Open Agent View
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {promptLifecycle.map((item) => (
              <div key={item.step} className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#EA803A] text-black flex items-center justify-center font-bold flex-shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {item.step}
                  </div>
                  <h4 className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{item.title}</h4>
                </div>
                <p className="text-sm text-zinc-400 leading-6">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Supported Agents</p>
          <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>SDK and MCP clients for the hosted reuse layer</h3>
          <div className="space-y-3">
            {supportedAgents.slice(0, 4).map((agent, index) => {
              const icon = index % 3 === 0 ? Cpu : index % 3 === 1 ? Database : Shield;
              const Icon = icon;
              return (
                <div key={agent.id} className="rounded-xl border border-[#202020] bg-[#111] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#EA803A] text-black flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{agent.name}</h4>
                        <span className="inline-flex items-center gap-1 rounded border border-[#EA803A33] bg-[#EA803A14] px-2 py-0.5 text-[10px] text-[#f2b07d]">
                          {agent.surface}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded border border-[#17301f] bg-[#13261d] px-2 py-0.5 text-[10px] text-[#7fe3c8]">
                          {agent.status}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 leading-6 mb-2">{agent.summary}</p>
                      <code className="text-xs text-zinc-500 break-all" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{agent.setup}</code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_.9fr] gap-6">
        <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Recent Runs</p>
          <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Savings proof on recent requests</h3>
          <div className="space-y-2">
            {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
              <div key={`${activity.timestamp}-${index}`} className="rounded-lg border border-[#202020] bg-[#111] px-3 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.status === 'completed' ? 'bg-[#13261d] text-[#5fd1b3]' : 'bg-[#2a1212] text-red-400'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{activity.description}</p>
                    <p className="text-xs text-zinc-500">{new Date(activity.timestamp).toLocaleString()} · {activity.reuseHitType} reuse · {activity.avoidedInputTokens} tokens saved · ${activity.estimatedCostSaved || 0}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.2em] flex-shrink-0 ${activity.status === 'completed' ? 'bg-[#17301f] text-[#7fe3c8]' : 'bg-[#301717] text-red-300'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {activity.status}
                </span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-[#2a2a2a] px-3 py-6 text-center text-zinc-500 text-sm">
                No recent activity yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Window</p>
            <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Recent run frequency</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyDistribution}>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
                <XAxis dataKey="hour" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ background: '#121212', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="calls" fill="#EA803A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Top Reusable Repos</p>
            <h3 className="text-lg text-white font-bold mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Where the most tokens were avoided</h3>
            <div className="space-y-2">
              {topReusableRepos.length > 0 ? topReusableRepos.map((repo) => (
                <div key={repo.repoId} className="rounded-lg border border-[#202020] bg-[#111] px-3 py-3 flex items-center justify-between gap-3">
                  <span className="text-zinc-300 truncate">{repo.repoId}</span>
                  <span className="text-[#f2b07d]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{repo.saved} tokens</span>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-[#2a2a2a] px-3 py-6 text-center text-zinc-500 text-sm">
                  No reusable repo data yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Next Moves</p>
            <div className="space-y-3">
              <Link 
                to="/dashboard/api-keys" 
                className="w-full flex items-center justify-between px-6 py-3 rounded-xl font-bold text-black text-base transition-all"
                style={{ 
                  fontFamily: 'Syne, sans-serif',
                  background: '#EA803A',
                  boxShadow: '4px 4px 0 #c4612a'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
                onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
              >
                <span>Create API key</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link 
                to="/docs" 
                className="w-full flex items-center justify-between px-6 py-3 rounded-xl font-bold text-black text-base transition-all"
                style={{ 
                  fontFamily: 'Syne, sans-serif',
                  background: '#EA803A',
                  boxShadow: '4px 4px 0 #c4612a'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
                onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
              >
                <span>Review docs</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
