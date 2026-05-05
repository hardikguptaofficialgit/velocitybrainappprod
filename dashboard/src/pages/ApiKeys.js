import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ArrowRight as Key, Plus, Eye, Copy, RefreshCw, AlertTriangle, X } from '../components/Icons';
import { resolveApiUrl } from '../lib/api';
import { isBackendUnavailable } from '../lib/network';
import BlobLoader from '../components/BlobLoader';
import { supportedAgents } from '../lib/agentRuntime';
import AgentBrandIcon from '../components/AgentBrandIcon';
import { useAuth } from '../contexts/AuthContext';

const formatDateTime = (value) => {
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

const formatCurrency = (value) => `$${Number(value || 0).toFixed(4)}`;

const badgeClassName = (status) => (
  status === 'active'
    ? 'bg-[#5fd1b3]/10 text-[#5fd1b3]'
    : 'bg-red-500/10 text-red-400'
);

const TopInsightCard = ({ title, items, danger = false, emptyMessage }) => (
  <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl p-5">
    <h3 className="text-white font-semibold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>{title}</h3>
    {items.length > 0 ? (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className={`rounded-lg border p-3 ${danger ? 'border-red-500/20 bg-red-500/5' : 'border-[#202020] bg-[#111]'}`}
          >
            <p className={`text-sm font-medium ${danger ? 'text-red-300' : 'text-white'}`}>
              {item.title || item.message}
            </p>
            <p className="text-xs text-zinc-500 mt-1 leading-5">
              {item.body || `${item.agentId || 'agent'} • ${item.repoId || 'workspace'} • ${item.severity || 'info'}`}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#111] p-4 text-sm text-zinc-500">
        {emptyMessage}
      </div>
    )}
  </div>
);

const ApiKeys = () => {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState({});
  const [pairingModal, setPairingModal] = useState({ open: false, key: null, pairing: null });
  const [selectedAgents, setSelectedAgents] = useState({});
  const queryClient = useQueryClient();

  const { data: apiKeysResponse, isLoading } = useQuery(
    'api-keys',
    async () => {
      const response = await axios.get(resolveApiUrl('/api/api-keys'));
      return response.data;
    },
    {
      retry: (failureCount, queryError) => !isBackendUnavailable(queryError) && failureCount < 1
    }
  );

  const apiKeys = apiKeysResponse?.keys ?? [];
  const insights = apiKeysResponse?.insights || [];
  const anomalies = apiKeysResponse?.anomalies || [];

  const { data: integrationsStatus } = useQuery(
    ['api-keys-integrations-status', user?.id],
    async () => {
      const response = await axios.get(resolveApiUrl('/api/integrations/onboarding-status'));
      return response.data || {};
    },
    {
      enabled: Boolean(user?.accountType === 'company'),
      retry: (failureCount, queryError) => !isBackendUnavailable(queryError) && failureCount < 1
    }
  );

  const companyNeedsSources = user?.accountType === 'company' && (integrationsStatus?.connectedSourceCount || 0) === 0;

  const createKeyMutation = useMutation(
    async (keyData) => {
      const response = await axios.post(resolveApiUrl('/api/api-keys'), keyData);
      return response.data;
    },
    {
      onSuccess: (data) => {
        if (data?.apiKey?.id && data?.key) {
          setNewlyCreatedKeys((prev) => ({ ...prev, [data.apiKey.id]: data.key }));
        }
        queryClient.invalidateQueries('api-keys');
        setShowCreateModal(false);
        setNewKeyName('');
      }
    }
  );

  const createPairingMutation = useMutation(
    async ({ keyId, agentId }) => {
      const response = await axios.post(resolveApiUrl(`/api/api-keys/${keyId}/pairing-sessions`), {
        agentId
      });
      return response.data;
    },
    {
      onSuccess: (data, variables) => {
        setPairingModal({
          open: true,
          key: variables.keyId,
          pairing: data?.pairingSession || null
        });
      }
    }
  );

  const rotateKeyMutation = useMutation(
    async (keyId) => {
      const response = await axios.post(resolveApiUrl(`/api/api-keys/${keyId}/rotate`));
      return response.data;
    },
    {
      onSuccess: (data) => {
        if (data?.apiKey?.id && data?.key) {
          setNewlyCreatedKeys((prev) => ({ ...prev, [data.apiKey.id]: data.key }));
        }
        queryClient.invalidateQueries('api-keys');
      }
    }
  );

  const revokeKeyMutation = useMutation(
    async (keyId) => {
      const response = await axios.post(resolveApiUrl(`/api/api-keys/${keyId}/revoke`));
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('api-keys');
      }
    }
  );

  const handleCreateKey = (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createKeyMutation.mutate({ name: newKeyName.trim() });
  };

  const copyToClipboard = async (text, keyId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
            Agent Access Control
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Pair agents without exposing raw keys, then monitor agent, repository, and model activity per credential.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 rounded-lg font-semibold text-black text-sm flex items-center justify-center gap-2 bg-[#EA803A] hover:bg-[#f0965a] transition-colors"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          <Plus className="h-4 w-4" />
          Create New Key
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopInsightCard
          title="Optimization Insights"
          items={insights.slice(0, 3)}
          emptyMessage="No optimization suggestions yet. Once agents begin reporting, Velocity Brain will surface waste, savings, and workflow opportunities."
        />
        <TopInsightCard
          title="Active Anomalies"
          items={anomalies.slice(0, 3)}
          danger
          emptyMessage="No anomalies detected. Sudden usage spikes, repeated failures, or redundant loops will appear here."
        />
      </div>

      {companyNeedsSources && (
        <div className="rounded-2xl border border-[#EA803A33] bg-[#EA803A14] p-5">
          <p className="text-sm font-semibold text-white">Pairing works best after you connect company systems.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Your keys and agent pairing flow are ready, but this workspace still has no Slack, Google Workspace, or GitHub sources connected.
          </p>
          <a
            href="/dashboard/integrations"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#181818]"
          >
            Open Integrations
          </a>
        </div>
      )}

      <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl shadow-sm overflow-hidden">
        {apiKeys.length > 0 ? (
          <div className="divide-y divide-[#1c1c1c]">
            {apiKeys.map((key) => {
              const agentId = selectedAgents[key.id] || 'codex';
              const selectedAgent = supportedAgents.find((item) => item.id === agentId) || supportedAgents[0];
              const isNewlyCreated = newlyCreatedKeys[key.id];
              const maskedKey = `${key.keyPrefix}${'•'.repeat(20)}`;
              const displayKey = isNewlyCreated || maskedKey;

              return (
                <div key={key.id} className="p-5 hover:bg-[#111111] transition-colors flex flex-col gap-5">
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                          {key.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${badgeClassName(key.status)}`}>
                          {key.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span>Created {formatDateTime(key.createdAt)}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span>Last rotated {formatDateTime(key.lastRotatedAt)}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span>Last activity {formatDateTime(key.intelligence?.lastSeen)}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 bg-[#161616] border border-[#2a2a2a] rounded-md px-3 py-2 w-full">
                        <code className="text-sm text-zinc-300 tracking-wider truncate flex-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {displayKey}
                        </code>
                        <button
                          onClick={() => copyToClipboard(displayKey, key.id)}
                          className="p-1.5 rounded hover:bg-[#2a2a2a] text-zinc-400 hover:text-white transition-colors shrink-0"
                          title="Copy key"
                        >
                          {copiedKey === key.id ? <Eye className="h-3.5 w-3.5 text-[#5fd1b3]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {isNewlyCreated && (
                        <span className="text-[10px] text-[#EA803A] mt-1.5 font-medium inline-block">
                          Copy this rotated key now. It will not be shown again.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-[250px]">
                      <div className="flex items-center gap-2 rounded-lg border border-[#202020] bg-[#111] p-2">
                        <AgentBrandIcon
                          agentId={selectedAgent.id}
                          name={selectedAgent.name}
                          containerClassName="w-9 h-9 shrink-0"
                          size="h-5 w-5"
                        />
                        <select
                          value={agentId}
                          onChange={(e) => setSelectedAgents((prev) => ({ ...prev, [key.id]: e.target.value }))}
                          className="bg-transparent text-sm text-white flex-1 outline-none"
                        >
                          {supportedAgents.map((agent) => (
                            <option key={agent.id} value={agent.id} className="bg-[#111]">
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => createPairingMutation.mutate({ keyId: key.id, agentId })}
                        className="px-3 py-2 rounded-lg bg-[#EA803A] hover:bg-[#f0965a] transition-colors text-black text-xs font-semibold"
                      >
                        Connect Your Agent
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => rotateKeyMutation.mutate(key.id)}
                          className="px-3 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] text-xs text-white font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Rotate
                        </button>
                        <button
                          onClick={() => revokeKeyMutation.mutate(key.id)}
                          className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-xs text-red-300 font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Requests</p>
                      <p className="text-sm font-medium text-white">{key.usage?.total || 0}</p>
                    </div>
                    <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Tokens</p>
                      <p className="text-sm font-medium text-white">{Number(key.usage?.totalTokens || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Cost</p>
                      <p className="text-sm font-medium text-white">{formatCurrency(key.usage?.totalCostUsd)}</p>
                    </div>
                    <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Linked Agents</p>
                      <p className="text-sm font-medium text-white">{key.intelligence?.linkedAgentCount || 0}</p>
                    </div>
                    <div className="rounded-lg border border-[#202020] bg-[#111] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Linked Repos</p>
                      <p className="text-sm font-medium text-white">{key.intelligence?.linkedRepoCount || 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[#1c1c1c] bg-[#101010] p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3">Connection Scope</p>
                      <div className="flex flex-wrap gap-2">
                        {(key.scopeDefaults?.agents || []).map((item) => (
                          <span key={`agent-scope-${item}`} className="px-2 py-1 rounded-md border border-[#202020] bg-[#111] text-[10px] text-zinc-300">
                            agent:{item}
                          </span>
                        ))}
                        {(key.scopeDefaults?.repos || []).map((item) => (
                          <span key={`repo-scope-${item}`} className="px-2 py-1 rounded-md border border-[#202020] bg-[#111] text-[10px] text-zinc-300">
                            repo:{item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#1c1c1c] bg-[#101010] p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3">Recent Activity</p>
                      {key.intelligence?.recentActivity?.length > 0 ? (
                        <div className="space-y-2">
                          {key.intelligence.recentActivity.map((activity) => (
                            <div key={activity.id} className="flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <p className="text-white truncate">{activity.description}</p>
                                <p className="text-zinc-500 truncate">{activity.repoId} • {activity.modelName}</p>
                              </div>
                              <span className="text-zinc-500 shrink-0">{formatDateTime(activity.timestamp)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No recent activity yet for this key.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center mb-4">
              <Key className="h-5 w-5 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>No API keys yet</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm">
              Create a key, then pair Codex or Claude Code through a short-lived secure connection flow.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-lg bg-[#EA803A] hover:bg-[#f0965a] transition-colors text-sm font-semibold text-black"
            >
              Generate your first key
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#1c1c1c] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Create new API key</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-md hover:bg-[#1c1c1c] text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-[#161616] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:border-[#EA803A] focus:ring-1 focus:ring-[#EA803A] focus:outline-none transition-all text-sm"
                  placeholder="e.g., Prod agent fabric"
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#2a2a2a] bg-transparent text-sm font-medium text-zinc-300 hover:bg-[#161616] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createKeyMutation.isLoading || !newKeyName.trim()}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#EA803A] hover:bg-[#f0965a] text-sm font-semibold text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                >
                  {createKeyMutation.isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    'Create Key'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pairingModal.open && pairingModal.pairing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#1c1c1c] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Connect Your Agent</h2>
              <button
                onClick={() => setPairingModal({ open: false, key: null, pairing: null })}
                className="p-1.5 rounded-md hover:bg-[#1c1c1c] text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-[#EA803A33] bg-[#EA803A14] p-4">
                <p className="text-sm text-white font-medium">
                  Pairing code expires at {formatDateTime(pairingModal.pairing.expiresAt)}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  This is a short-lived pairing code for one secure token exchange. Your raw API key never leaves the dashboard.
                </p>
              </div>
              <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Pairing Code</p>
                <code className="text-sm text-white break-all">{pairingModal.pairing.pairCode}</code>
              </div>
              <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Local Command</p>
                <code className="text-xs text-zinc-300 break-all">{pairingModal.pairing.command}</code>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => copyToClipboard(pairingModal.pairing.command, 'pairing-command')}
                  className="px-4 py-2 rounded-lg bg-[#EA803A] hover:bg-[#f0965a] transition-colors text-black text-sm font-semibold"
                >
                  {copiedKey === 'pairing-command' ? 'Copied' : 'Copy Command'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeys;
