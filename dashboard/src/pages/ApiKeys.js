import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ArrowRight as Key, Plus, Eye, Trash2, Copy, X } from '../components/Icons';
import { resolveApiUrl } from '../lib/api';
import { isBackendUnavailable } from '../lib/network';
import BlobLoader from '../components/BlobLoader';

const ApiKeys = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState({});
  const queryClient = useQueryClient();

  const { data: apiKeys, isLoading } = useQuery(
    'api-keys',
    async () => {
      const response = await axios.get(resolveApiUrl('/api/api-keys'));
      return response.data;
    },
    {
      retry: (failureCount, queryError) => !isBackendUnavailable(queryError) && failureCount < 1
    }
  );

  const createKeyMutation = useMutation(
    async (keyData) => {
      const response = await axios.post(resolveApiUrl('/api/api-keys'), keyData);
      return response.data;
    },
    {
      onSuccess: (data) => {
        // Store the full key so it can be copied once
        if (data?.apiKey?.id && data?.key) {
          setNewlyCreatedKeys(prev => ({ ...prev, [data.apiKey.id]: data.key }));
        }
        queryClient.invalidateQueries('api-keys');
        setShowCreateModal(false);
        setNewKeyName('');
      }
    }
  );

  const deleteKeyMutation = useMutation(
    async (keyId) => {
      const response = await axios.delete(resolveApiUrl(`/api/api-keys/${keyId}`));
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
    
    createKeyMutation.mutate({
      name: newKeyName
    });
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>API Keys</h1>
          <p className="text-sm text-zinc-500 mt-1">Velocity Brain is free for everyone for a limited time. Usage limits still apply to every key.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-3 rounded-xl font-bold text-black text-base flex items-center gap-2 transition-all"
          style={{ 
            fontFamily: 'Syne, sans-serif',
            background: '#EA803A',
            boxShadow: '4px 4px 0 #c4612a'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
          onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
        >
          <Plus className="h-4 w-4" />
          Create New Key
        </button>
      </div>

      <div className="space-y-4">
        {apiKeys?.length > 0 ? (
          apiKeys.map((key) => (
            <div key={key.id} className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-black flex-shrink-0" style={{ background: '#EA803A' }}>
                    <Key className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>{key.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      <span className="inline-flex items-center gap-1 rounded border border-[#EA803A33] bg-[#EA803A14] px-2 py-0.5 text-[10px] text-[#f2b07d]">
                        <span className="w-1 h-1 rounded-full bg-[#EA803A]" />
                        Usage-limited access
                      </span>
                      <span>•</span>
                      <span>Created {formatDate(key.createdAt)}</span>
                      {key.lastUsedAt && (
                        <>
                          <span>•</span>
                          <span>Last used {formatDate(key.lastUsedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="rounded-lg border border-[#2a2a2a] bg-[#111] flex items-center gap-2 px-3 py-2">
                    <code className="text-xs text-zinc-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {key.keyPrefix}{'*'.repeat(24)}
                    </code>
                    {newlyCreatedKeys[key.id] && (
                      <button
                        onClick={() => copyToClipboard(newlyCreatedKeys[key.id], key.id)}
                        className="p-1 rounded hover:bg-[#1a1a1a] text-zinc-400 hover:text-white transition-colors"
                        title="Copy full key"
                      >
                        {copiedKey === key.id ? <Eye className="h-3.5 w-3.5 text-[#5fd1b3]" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                    className="p-2 rounded-lg border border-[#2a2a2a] bg-[#111] hover:border-red-900/50 hover:bg-red-900/10 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Delete API key"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#202020]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Daily Usage</p>
                    <p className="font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{key.usage?.daily || 0}/{key.dailyQuota || 100}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Monthly Usage</p>
                    <p className="font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{key.usage?.monthly || 0}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Total Calls</p>
                    <p className="font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{key.usage?.total || 0}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Status</p>
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ${key.status === 'active' ? 'bg-[#13261d] text-[#5fd1b3]' : 'bg-[#2a1212] text-red-400'}`}>
                      <span className={`w-1 h-1 rounded-full ${key.status === 'active' ? 'bg-[#5fd1b3]' : 'bg-red-400'}`} />
                      {key.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#0d0d0d] p-8 text-center">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 bg-[#111] border border-[#2a2a2a]">
              <Key className="h-6 w-6 text-zinc-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>No API Keys</h3>
            <p className="text-zinc-500 text-sm mb-4">Create your first API key to start using VelocityBrain</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-[#EA803A] text-sm font-bold text-black"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Create Your First API Key
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Create API Key</h2>
              <button onClick={() => setShowCreateModal(false)} className="group p-2 rounded-lg border border-[#2a2a2a] bg-[#111] hover:bg-[#1a1a1a] text-zinc-400 hover:text-white transition-all duration-200">
                <span className="block transition-transform duration-300 ease-out group-hover:rotate-180">
                  <X className="h-4 w-4" />
                </span>
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white focus:border-[#EA803A] focus:outline-none transition-colors text-sm"
                  placeholder="My Application Key"
                  required
                />
              </div>

              <div className="rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-3 text-sm text-zinc-400">
                Free for everyone for a limited time. New keys use the standard usage-limited quota automatically.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#111] text-sm font-bold text-zinc-300 hover:text-white transition-colors"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createKeyMutation.isLoading}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-black text-base transition-all disabled:opacity-50"
                  style={{ 
                    fontFamily: 'Syne, sans-serif',
                    background: '#EA803A',
                    boxShadow: '4px 4px 0 #c4612a'
                  }}
                  onMouseEnter={e => !createKeyMutation.isLoading && (e.currentTarget.style.background = '#f0965a')}
                  onMouseLeave={e => !createKeyMutation.isLoading && (e.currentTarget.style.background = '#EA803A')}
                >
                  {createKeyMutation.isLoading ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeys;
