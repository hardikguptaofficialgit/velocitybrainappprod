import React, { useMemo } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useLocation } from 'react-router-dom';
import BlobLoader from '../components/BlobLoader';
import { AlertTriangle, ArrowRight, CheckCircle, Github, Google, RefreshCw, X } from '../components/Icons';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage, isBackendUnavailable } from '../lib/network';

const providerMeta = {
  slack: {
    id: 'slack',
    label: 'Slack',
    description: 'Pull team channels, threads, members, and operational context into the Company Brain.',
    scopeCopy: 'Channels, threads, members, workspace metadata',
    icon: (
      <img
        src="https://svgl.app/library/slack.svg"
        alt="Slack"
        className="h-6 w-6 object-contain"
        loading="lazy"
      />
    )
  },
  google: {
    id: 'google',
    label: 'Google Workspace',
    description: 'Bring Gmail, Drive, Docs, and Calendar signals into a shared operational memory layer.',
    scopeCopy: 'Gmail, Drive metadata, Docs, Calendar',
    icon: <Google className="h-6 w-6 object-contain" />
  },
  github: {
    id: 'github',
    label: 'GitHub',
    description: 'Map repositories, pull requests, issues, and org structure directly into engineering workflows.',
    scopeCopy: 'Repositories, PRs, issues, organization metadata',
    icon: <Github className="h-6 w-6" />
  }
};

const statusTone = {
  connected: 'border-[#5fd1b3]/20 bg-[#5fd1b3]/8 text-[#5fd1b3]',
  syncing: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  disconnected: 'border-red-500/20 bg-red-500/8 text-red-300',
  failed: 'border-red-500/20 bg-red-500/8 text-red-300',
  not_connected: 'border-white/10 bg-[#121212] text-zinc-400'
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
    return {
      provider,
      status,
      message
    };
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
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            Company Integrations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Connect the systems where your company already thinks so Velocity Brain can build a live operational context layer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span className="rounded-full border border-[#202020] bg-[#101010] px-3 py-1.5">
            {connectedSourceCount} connected source{connectedSourceCount === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-[#202020] bg-[#101010] px-3 py-1.5">
            {data?.sourceCoverageSummary || 'No source coverage yet'}
          </span>
        </div>
      </div>

      {callbackNotice && (
        <div className={`rounded-xl border p-4 text-sm ${
          callbackNotice.status === 'connected'
            ? 'border-[#5fd1b3]/20 bg-[#5fd1b3]/8 text-[#9fe7d6]'
            : 'border-red-500/20 bg-red-500/10 text-red-300'
        }`}>
          {callbackNotice.status === 'connected'
            ? `${providerMeta[callbackNotice.provider]?.label || callbackNotice.provider} connected successfully. Initial sync is starting now.`
            : `We could not finish the ${providerMeta[callbackNotice.provider]?.label || callbackNotice.provider} connection${callbackNotice.message ? ` (${callbackNotice.message.replace(/_/g, ' ')})` : ''}.`}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-4 text-sm text-red-300">
          Failed to load integrations: {getErrorMessage(error, 'Unknown error')}
        </div>
      )}

      {connectedSourceCount === 0 && (
        <div className="rounded-2xl border border-[#EA803A33] bg-[#EA803A14] p-5">
          <p className="text-sm font-semibold text-white">Your Company Brain is still cold.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Connect Slack, Google Workspace, or GitHub first so your dashboard, agents, and observability surfaces reflect real company context.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {Object.values(providerMeta).map((provider) => {
          const integration = integrationByProvider[provider.id];
          const statusLabel = renderStatusLabel(integration);
          const toneKey = integration?.connected
            ? (integration?.lastSyncStatus === 'queued' ? 'syncing' : 'connected')
            : (integration?.status || 'not_connected');
          const connectionMode = integration?.connectionMode || (integration?.isSimulated ? 'demo' : 'live');

          return (
            <div key={provider.id} className="rounded-2xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#202020] bg-[#111]">
                    {provider.icon}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                      {provider.label}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">{provider.scopeCopy}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusTone[toneKey] || statusTone.not_connected}`}>
                  {statusLabel}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-400">{provider.description}</p>

              {connectionMode === 'demo' && (
                <div className="mt-4 rounded-xl border border-[#EA803A33] bg-[#EA803A14] p-3 text-xs text-[#f7c7a5]">
                  Demo mode: this connection was created without real provider credentials. It is useful for UI validation, but it is not syncing live source data yet.
                </div>
              )}

              <div className="mt-5 space-y-3 rounded-xl border border-[#1c1c1c] bg-[#101010] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Mode</span>
                  <span className="text-zinc-300">{connectionMode === 'demo' ? 'Demo' : 'Live'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Display name</span>
                  <span className="text-zinc-300">{integration?.displayName || 'Not connected yet'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Last sync</span>
                  <span className="text-zinc-300">
                    {integration?.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-zinc-500">Scopes</span>
                  <span className="text-right text-zinc-300">
                    {(integration?.scopesGranted || []).length > 0 ? integration.scopesGranted.join(', ') : 'Will be requested during connect'}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {integration?.connected ? (
                  <>
                    <button
                      onClick={() => resyncMutation.mutate(provider.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#181818]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Resync
                    </button>
                    <button
                      onClick={() => disconnectMutation.mutate(provider.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10"
                    >
                      <X className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startMutation.mutate({ provider: provider.id, from: 'integrations' })}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#EA803A] px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#f0965a]"
                  >
                    Connect
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#1c1c1c] bg-[#0d0d0d] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#202020] bg-[#111]">
            {connectedSourceCount > 0 ? <CheckCircle className="h-5 w-5 text-[#5fd1b3]" /> : <AlertTriangle className="h-5 w-5 text-[#EA803A]" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Next best step
            </h3>
            <p className="text-sm text-zinc-400">
              {connectedSourceCount > 0
                ? `Pair an agent next so ${connectedSources.join(', ')} can show up alongside repository and model activity in one timeline.`
                : 'Connect at least one company source, then create or select an API key and pair an agent.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
