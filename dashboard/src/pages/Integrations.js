import React, { useMemo } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useLocation } from 'react-router-dom';
import BlobLoader from '../components/BlobLoader';
import { AlertTriangle, ArrowRight, CheckCircle, Database, Github, Google, RefreshCw, X } from '../components/Icons';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage, isBackendUnavailable } from '../lib/network';

const providerMeta = {
  slack: {
    id: 'slack',
    label: 'Slack',
    description: 'Sync channels, threads, and workspace metadata.',
    scopeCopy: 'Channels, threads, members',
    icon: (
      <img
        src="https://svgl.app/library/slack.svg"
        alt="Slack"
        className="h-6 w-6 object-contain drop-shadow-md"
        loading="lazy"
      />
    )
  },
  google: {
    id: 'google',
    label: 'Google Workspace',
    description: 'Sync Gmail, Drive, Docs, and Calendar context.',
    scopeCopy: 'Gmail, Drive, Docs, Calendar',
    icon: <Google className="h-6 w-6 object-contain drop-shadow-md" />
  },
  github: {
    id: 'github',
    label: 'GitHub',
    description: 'Sync repositories, pull requests, and issues.',
    scopeCopy: 'Repos, PRs, issues',
    icon: <Github className="h-6 w-6 drop-shadow-md" />
  }
};

const statusTone = {
  connected: 'border-[#5fd1b3]/30 bg-[#5fd1b3]/10 text-[#5fd1b3]',
  syncing: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  disconnected: 'border-red-500/30 bg-red-500/10 text-red-400',
  failed: 'border-red-500/30 bg-red-500/10 text-red-400',
  not_connected: 'border-zinc-700 bg-zinc-800/40 text-zinc-400'
};

const renderStatusLabel = (integration) => {
  if (!integration) return 'Not connected';
  if (integration.connected && integration.lastSyncStatus === 'queued') return 'Syncing';
  if (integration.connected) return 'Connected';
  if (integration.status === 'disconnected') return 'Disconnected';
  if (integration.status === 'failed') return 'Failed';
  return 'Not connected';
};

export default function Integrations() {
  const queryClient = useQueryClient();
  const location = useLocation();
  
  const callbackNotice = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const provider = params.get('provider');
    const status = params.get('status');
    const message = params.get('message');
    if (!provider || !status) return null;
    return { provider, status, message };
  }, [location.search]);

  const { data, isLoading, isError, error } = useQuery(
    'company-integrations',
    async () => {
      const response = await axios.get(resolveApiUrl('/api/integrations'));
      return response.data || {};
    },
    {
      retry: (failureCount, queryError) => !isBackendUnavailable(queryError) && failureCount < 1
    }
  );

  const startMutation = useMutation(
    async ({ provider, from = 'integrations' }) => {
      const response = await axios.post(resolveApiUrl(`/api/integrations/${provider}/start`), { from });
      return response.data;
    },
    {
      onSuccess: (result) => {
        if (result?.authUrl) {
          window.location.assign(result.authUrl);
        }
      }
    }
  );

  const resyncMutation = useMutation(
    async (provider) => {
      const response = await axios.post(resolveApiUrl(`/api/integrations/${provider}/resync`));
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('company-integrations');
      }
    }
  );

  const disconnectMutation = useMutation(
    async (provider) => {
      const response = await axios.post(resolveApiUrl(`/api/integrations/${provider}/disconnect`));
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('company-integrations');
      }
    }
  );

  const integrations = data?.integrations || [];
  const integrationByProvider = Object.fromEntries(integrations.map((item) => [item.provider, item]));
  const connectedSourceCount = data?.connectedSourceCount || 0;
  const connectedSources = data?.connectedSources || [];

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <BlobLoader size={48} label="" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">
      <div className="flex flex-col gap-4 border-b border-[#2a2a2a] pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Company Integrations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Connect your company's platforms to build a live operational context layer.
          </p>
        </div>
      </div>

      <div className="relative">
        {/* Coming Soon Overlay */}
        <div className="absolute inset-0 z-20 flex justify-center pt-24 pb-12">
          <div className="sticky top-24 w-full max-w-md h-fit">
            <div className="relative rounded-2xl p-[1px] bg-gradient-to-b from-[#EA803A] to-zinc-800 shadow-2xl">
              <div className="bg-[#0d0d0d] rounded-2xl p-8 flex flex-col items-center text-center shadow-inner">
               
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Company Brain Launching Soon
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                  We are finalizing the contextual memory layer for Slack, Google Workspace, and GitHub. Get ready to give your agents deep, live operational awareness.
                </p>
                <button className="px-6 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-sm font-semibold text-zinc-400 cursor-not-allowed shadow-inner transition-colors">
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dimmed & Disabled Content */}
        <div className="space-y-8 opacity-20 blur-[2px] pointer-events-none select-none grayscale-[0.5] transition-all duration-500">
          {callbackNotice && (
            <div className={`rounded-xl border p-4 text-sm shadow-inner ${
              callbackNotice.status === 'connected'
                ? 'border-[#5fd1b3]/30 bg-[#5fd1b3]/10 text-[#9fe7d6]'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}>
              {callbackNotice.status === 'connected'
                ? `${providerMeta[callbackNotice.provider]?.label || callbackNotice.provider} connected. Initial sync starting.`
                : `Failed to connect ${providerMeta[callbackNotice.provider]?.label || callbackNotice.provider}${callbackNotice.message ? ` (${callbackNotice.message.replace(/_/g, ' ')})` : ''}.`}
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-sm text-red-300 shadow-inner">
              Failed to load integrations: {getErrorMessage(error, 'Unknown error')}
            </div>
          )}

          {connectedSourceCount === 0 && (
            <div className="rounded-xl border border-[#EA803A]/30 bg-[#EA803A]/10 p-5 shadow-inner">
              <p className="text-sm font-semibold text-white">No sources connected.</p>
              <p className="mt-1 text-sm text-[#f7c7a5]">
                Connect Slack, Google Workspace, or GitHub to enrich your dashboard and agents.
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {Object.values(providerMeta).map((provider) => {
              const integration = integrationByProvider[provider.id];
              const statusLabel = renderStatusLabel(integration);
              const toneKey = integration?.connected
                ? (integration?.lastSyncStatus === 'queued' ? 'syncing' : 'connected')
                : (integration?.status || 'not_connected');
              const connectionMode = integration?.connectionMode || (integration?.isSimulated ? 'demo' : 'live');

              return (
                <div key={provider.id} className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
                  <div className="rounded-xl bg-[#0d0d0d] p-6 h-full flex flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800/50 bg-zinc-900/50 shadow-inner">
                          {provider.icon}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                            {provider.label}
                          </h2>
                          <p className="mt-0.5 text-[10px] text-zinc-500 uppercase tracking-wide">{provider.scopeCopy}</p>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-zinc-400 flex-1">{provider.description}</p>

                    <div className="mt-5 mb-5 flex items-center justify-between">
                      <span className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-inner ${statusTone[toneKey] || statusTone.not_connected}`}>
                        {statusLabel}
                      </span>
                      {connectionMode === 'demo' && (
                        <span className="rounded-md border border-[#EA803A]/30 bg-[#EA803A]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#EA803A]">
                          Demo Mode
                        </span>
                      )}
                    </div>

                    {integration?.connected && (
                      <div className="mb-5 space-y-2 rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-3 shadow-inner">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">Account</span>
                          <span className="text-zinc-300 font-medium truncate max-w-[140px]">{integration?.displayName || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">Last sync</span>
                          <span className="text-zinc-300">
                            {integration?.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 mt-auto">
                      {integration?.connected ? (
                        <>
                          <button
                            onClick={() => resyncMutation.mutate(provider.id)}
                            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Resync
                          </button>
                          <button
                            onClick={() => disconnectMutation.mutate(provider.id)}
                            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            <X className="h-3.5 w-3.5" />
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startMutation.mutate({ provider: provider.id, from: 'integrations' })}
                          className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-gradient-to-b from-[#EA803A] to-[#d66a25] px-4 py-2.5 text-sm font-bold text-black shadow-md shadow-[#EA803A]/20 hover:opacity-90 transition-opacity"
                        >
                          Connect {provider.label}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10">
            <div className="rounded-xl bg-[#0d0d0d] p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-800/50 bg-zinc-900/50 shadow-inner">
                  {connectedSourceCount > 0 ? <CheckCircle className="h-5 w-5 text-[#5fd1b3]" /> : <AlertTriangle className="h-5 w-5 text-[#EA803A]" />}
                </div>
                <div>
                  <h3 className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Next best step
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {connectedSourceCount > 0
                      ? `Pair an agent to see ${connectedSources.join(', ')} data alongside repo and model activity.`
                      : 'Connect a source, then pair an agent to start tracking telemetry.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}