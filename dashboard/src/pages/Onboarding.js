import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

import AvatarPicker from '../components/AvatarPicker';
import BlobLoader from '../components/BlobLoader';
import MinimalSelect from '../components/MinimalSelect';
import RoleField from '../components/RoleField';
import AgentBrandIcon from '../components/AgentBrandIcon';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Cpu, Database, Github, Google } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { curatedAvatarOptions, defaultCuratedAvatar, isCuratedAvatarUrl } from '../lib/avatars';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage } from '../lib/network';
import { supportedAgents } from '../lib/agentRuntime';

const accountCards = [
  {
    id: 'company',
    eyebrow: 'For teams',
    title: 'Company workspace',
    description: 'Best if you want a shared control plane for engineering teams, repositories, Slack, email, and coding agents.',
    prompt: 'We will add a company integrations step so your workspace starts with real systems and not an empty shell.'
  },
  {
    id: 'individual',
    eyebrow: 'For solo use',
    title: 'Individual workspace',
    description: 'Best for a solo founder or developer setting up a personal coding-agent brain.',
    prompt: 'Nice. We will keep setup lightweight and move you straight into agent pairing.'
  }
];

const companySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const workflowOptions = [
  { value: 'coding', label: 'Coding workflows' },
  { value: 'debugging', label: 'Debugging and incident response' },
  { value: 'research', label: 'Research and planning' },
  { value: 'automation', label: 'Internal automation' }
];
const observabilityOptions = [
  { value: 'repository_activity', label: 'Repository activity' },
  { value: 'model_costs', label: 'Model cost and usage' },
  { value: 'task_timeline', label: 'Task timeline and run history' },
  { value: 'anomaly_detection', label: 'Anomalies and optimization' }
];

const baseSteps = [
  { id: 'account', label: 'Account Type', title: 'Who is this for?' },
  { id: 'profile', label: 'Profile', title: 'About you' },
  { id: 'workspace', label: 'Workspace', title: 'Workspace details' }
];
const teamOnlyStep = { id: 'integrations', label: 'Integrations', title: 'Connect your company stack' };
const trailingSteps = [
  { id: 'agents', label: 'Agents', title: 'Configure your first agent flow' },
  { id: 'finish', label: 'Finish', title: 'Ready to connect agents' }
];

const providerCards = [
  {
    id: 'slack',
    label: 'Slack',
    description: 'Import channels, threads, and team signals so agents see how work actually flows.',
    icon: <img src="https://svgl.app/library/slack.svg" alt="Slack" className="h-6 w-6 object-contain" loading="lazy" />
  },
  {
    id: 'google',
    label: 'Google Workspace',
    description: 'Bring Gmail, Drive, Docs, and Calendar into one searchable company context layer.',
    icon: <Google className="h-6 w-6 object-contain" />
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Map repositories, pull requests, and issues directly into your shared engineering memory.',
    icon: <Github className="h-6 w-6" />
  }
];

const ONBOARDING_DRAFT_VERSION = 3;

const createCompanySourceDefaults = () => ({
  slack: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [] },
  google: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [] },
  github: { connected: false, skipped: false, status: 'not_connected', displayName: '', lastSyncAt: null, lastSyncStatus: 'idle', scopesGranted: [] }
});

const createInitialForm = (user) => ({
  accountType: user?.accountType || '',
  name: user?.name || '',
  title: user?.title || '',
  company: user?.company || '',
  workspaceName: '',
  industry: '',
  companySize: '',
  website: '',
  description: '',
  primaryUseCase: '',
  timezone: 'Asia/Calcutta',
  notifications: {
    emailAlerts: true,
    usageWarnings: true,
    monthlyReports: false,
    productUpdates: true
  },
  avatarUrl: user?.avatarUrl || defaultCuratedAvatar,
  workspaceImageUrl: user?.avatarUrl || defaultCuratedAvatar,
  api: {
    responseStyle: 'normal'
  },
  agents: {
    preferredAgent: 'codex',
    preferredSurface: 'mcp',
    primaryWorkflow: 'coding',
    observabilityFocus: 'repository_activity',
    pairingPreference: 'browser_assisted',
    autoOpenAgentManager: true
  },
  companySources: createCompanySourceDefaults(),
  onboardingSelections: {
    integrationsSkipped: false,
    connectedSources: [],
    skippedSources: []
  }
});

const sanitizeDraftForm = (draft, fallback) => {
  if (!draft || typeof draft !== 'object') return fallback;

  const safeAvatarUrl = isCuratedAvatarUrl(draft.avatarUrl) ? draft.avatarUrl : fallback.avatarUrl;
  const safeWorkspaceImageUrl = isCuratedAvatarUrl(draft.workspaceImageUrl) ? draft.workspaceImageUrl : fallback.workspaceImageUrl;

  return {
    ...fallback,
    ...draft,
    accountType: draft.accountType === 'company' || draft.accountType === 'individual' ? draft.accountType : fallback.accountType,
    avatarUrl: safeAvatarUrl,
    workspaceImageUrl: safeWorkspaceImageUrl,
    notifications: {
      ...fallback.notifications,
      ...(draft.notifications || {})
    },
    api: {
      ...fallback.api,
      ...(draft.api || {})
    },
    agents: {
      ...fallback.agents,
      ...(draft.agents || {})
    },
    companySources: {
      ...fallback.companySources,
      ...(draft.companySources || {})
    },
    onboardingSelections: {
      ...fallback.onboardingSelections,
      ...(draft.onboardingSelections || {})
    }
  };
};

const ToggleRow = ({ checked, onChange, label, description }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/10 bg-[#111111] px-4 py-4 transition-colors duration-300 hover:bg-[#1A1A1A]">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-zinc-400">{description}</p>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="mt-1 h-4 w-4 flex-shrink-0 accent-[#EA803A]"
    />
  </label>
);

export default function Onboarding() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const draftKey = useMemo(() => `velocitybrain:onboarding-draft:${user?.id || user?.email || 'anonymous'}`, [user?.email, user?.id]);
  const [form, setForm] = useState(() => createInitialForm(user));
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState('');
  const [skipIntegrationsConfirmed, setSkipIntegrationsConfirmed] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [error, setError] = useState('');
  const glowRef = useRef(null);
  const hydratedDraftRef = useRef(false);

  const steps = useMemo(() => (
    form.accountType === 'company'
      ? [...baseSteps, teamOnlyStep, ...trailingSteps]
      : [...baseSteps, ...trailingSteps]
  ), [form.accountType]);

  const currentStepDef = steps[currentStep] || steps[0];
  const preferredAgent = supportedAgents.find((agent) => agent.id === form.agents.preferredAgent) || supportedAgents[0];
  const activeAccountCard = accountCards.find((card) => card.id === form.accountType);
  const connectedSources = Object.entries(form.companySources || {}).filter(([, value]) => value?.connected).map(([provider]) => provider);
  const connectedSourceCount = connectedSources.length;
  const completion = useMemo(() => Math.round(((currentStep + 1) / steps.length) * 100), [currentStep, steps.length]);

  const defaultWorkspaceName = useMemo(() => {
    if (form.workspaceName.trim()) return form.workspaceName.trim();
    if (form.accountType === 'company' && form.company.trim()) return form.company.trim();
    if (form.name.trim()) return `${form.name.trim()}'s Workspace`;
    return 'Workspace';
  }, [form.accountType, form.company, form.name, form.workspaceName]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!glowRef.current) return;
      glowRef.current.style.background = `radial-gradient(600px circle at ${event.clientX}px ${event.clientY}px, rgba(234, 128, 58, 0.15), transparent 40%)`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (hydratedDraftRef.current) return;

    const fallback = createInitialForm(user);
    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) {
        setForm(fallback);
        hydratedDraftRef.current = true;
        return;
      }

      const parsed = JSON.parse(rawDraft);
      if (parsed?.version !== ONBOARDING_DRAFT_VERSION) {
        window.localStorage.removeItem(draftKey);
        setForm(fallback);
        hydratedDraftRef.current = true;
        return;
      }

      const sanitized = sanitizeDraftForm(parsed.form, fallback);
      const derivedSteps = sanitized.accountType === 'company'
        ? [...baseSteps, teamOnlyStep, ...trailingSteps]
        : [...baseSteps, ...trailingSteps];
      setForm(sanitized);
      setCurrentStep(Number.isInteger(parsed.currentStep) ? Math.max(0, Math.min(parsed.currentStep, derivedSteps.length - 1)) : 0);
      setSkipIntegrationsConfirmed(Boolean(sanitized.onboardingSelections?.integrationsSkipped));
    } catch {
      window.localStorage.removeItem(draftKey);
      setForm(fallback);
    } finally {
      hydratedDraftRef.current = true;
    }
  }, [draftKey, user]);

  useEffect(() => {
    if (!hydratedDraftRef.current) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        version: ONBOARDING_DRAFT_VERSION,
        currentStep,
        form
      }));
    } catch {
      // Keep onboarding usable even if persistence fails.
    }
  }, [currentStep, draftKey, form]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(Math.max(0, steps.length - 1));
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    if (form.accountType !== 'company') return;

    let cancelled = false;
    const fetchStatus = async () => {
      setIntegrationsLoading(true);
      try {
        const response = await axios.get(resolveApiUrl('/api/integrations/onboarding-status'));
        if (cancelled) return;
        const payload = response.data || {};
        setForm((current) => ({
          ...current,
          companySources: {
            ...current.companySources,
            ...(payload.companySources || {})
          },
          onboardingSelections: {
            ...current.onboardingSelections,
            connectedSources: payload.connectedSources || Object.entries(payload.companySources || {}).filter(([, value]) => value?.connected).map(([provider]) => provider)
          }
        }));
      } catch {
        if (!cancelled) {
          setStatusBanner({
            tone: 'warning',
            message: 'We could not load integration status yet. You can still continue or retry.'
          });
        }
      } finally {
        if (!cancelled) {
          setIntegrationsLoading(false);
        }
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [form.accountType]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const provider = params.get('provider');
    const status = params.get('status');
    if (!provider || !status) return;

    if (status === 'connected') {
      setStatusBanner({
        tone: 'success',
        message: `${providerCards.find((item) => item.id === provider)?.label || provider} connected successfully. Initial sync is starting now.`
      });
    } else {
      setStatusBanner({
        tone: 'warning',
        message: `We could not finish connecting ${providerCards.find((item) => item.id === provider)?.label || provider}.`
      });
    }
  }, [location.search]);

  const handleChange = (key, value) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleToggle = (key) => {
    setError('');
    setForm((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        [key]: !current.notifications[key]
      }
    }));
  };

  const handleAgentSetting = (key, value) => {
    setError('');
    setForm((current) => ({
      ...current,
      agents: {
        ...current.agents,
        [key]: value
      }
    }));
  };

  const handleConnectProvider = async (provider) => {
    setConnectingProvider(provider);
    setError('');
    try {
      const response = await axios.post(resolveApiUrl(`/api/integrations/${provider}/start`), { from: 'onboarding' });
      if (response.data?.authUrl) {
        window.location.assign(response.data.authUrl);
        return;
      }
      throw new Error('Missing authorization URL');
    } catch (err) {
      setError(getErrorMessage(err, `Failed to start ${provider} connection.`));
    } finally {
      setConnectingProvider('');
    }
  };

  const currentStepId = currentStepDef.id;
  const canGoNext = useMemo(() => {
    if (currentStepId === 'account') return Boolean(form.accountType);
    if (currentStepId === 'profile') return Boolean(form.name.trim());
    if (currentStepId === 'integrations') return connectedSourceCount > 0 || skipIntegrationsConfirmed;
    if (currentStepId === 'agents') return Boolean(form.agents.preferredAgent);
    return true;
  }, [connectedSourceCount, currentStepId, form.accountType, form.agents.preferredAgent, form.name, skipIntegrationsConfirmed]);

  const goNext = () => {
    if (!canGoNext) return;
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const goBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleLogout = async () => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Ignore cleanup issues.
    }
    await logout();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        ...form,
        workspaceName: defaultWorkspaceName,
        companySources: {
          ...form.companySources
        },
        onboardingSelections: {
          ...form.onboardingSelections,
          integrationsSkipped: form.accountType === 'company' ? skipIntegrationsConfirmed && connectedSourceCount === 0 : false,
          connectedSources,
          skippedSources: Object.entries(form.companySources || {}).filter(([, value]) => value?.skipped).map(([provider]) => provider)
        }
      };

      const response = await axios.post(resolveApiUrl('/api/settings/onboarding'), payload);
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Ignore storage cleanup failures after successful onboarding.
      }
      updateUser(response.data.user);
      navigate(form.agents.autoOpenAgentManager ? '/dashboard/api-keys' : '/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to complete onboarding.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;
    if (currentStep < steps.length - 1) {
      if (canGoNext) goNext();
    } else {
      handleSubmit();
    }
  };

  const renderIntegrationCard = (provider) => {
    const state = form.companySources?.[provider.id] || {};
    const isConnected = Boolean(state.connected);
    const isBusy = connectingProvider === provider.id;

    return (
      <div key={provider.id} className={`rounded-2xl border p-5 transition-colors ${isConnected ? 'border-[#5fd1b3]/30 bg-[#5fd1b3]/8' : 'border-white/10 bg-[#111111]'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#202020] bg-[#0d0d0d]">
              {provider.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{provider.label}</p>
              <p className="mt-1 text-xs text-zinc-500">{state.displayName || 'Not connected yet'}</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isConnected ? 'bg-[#5fd1b3]/10 text-[#5fd1b3]' : 'bg-white/10 text-zinc-400'}`}>
            {isConnected ? 'Connected' : 'Optional'}
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-400">{provider.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            {isConnected
              ? `Last sync ${state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : 'starting now'}`
              : 'OAuth stays on the hosted backend. No raw provider tokens are exposed locally.'}
          </div>
          <button
            type="button"
            onClick={() => handleConnectProvider(provider.id)}
            disabled={isBusy}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${isConnected ? 'border border-[#2a2a2a] bg-[#111] text-white hover:bg-[#181818]' : 'bg-[#EA803A] text-black hover:bg-[#f0965a]'}`}
          >
            {isBusy ? <BlobLoader size={14} label="" /> : isConnected ? 'Reconnect' : 'Connect'}
          </button>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStepId) {
      case 'account':
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {accountCards.map((card) => {
                const active = form.accountType === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleChange('accountType', card.id)}
                    className={`rounded-2xl border p-5 text-left transition-colors duration-300 ${active ? 'border-[#EA803A] bg-[#EA803A]/10 shadow-[0_0_20px_rgba(234,128,58,0.1)]' : 'border-white/10 bg-[#111111] hover:bg-[#1A1A1A]'}`}
                  >
                    <p className="text-xs uppercase tracking-widest text-zinc-400">{card.eyebrow}</p>
                    <h3 className="mt-2 text-lg font-bold text-white">{card.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{card.description}</p>
                  </button>
                );
              })}
            </div>
            {activeAccountCard && (
              <div className="rounded-xl bg-[#EA803A]/10 p-4 text-sm text-[#EA803A]">
                {activeAccountCard.prompt}
              </div>
            )}
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs uppercase text-zinc-400">Your Full Name</span>
              <input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
                placeholder="John Doe"
                autoFocus
              />
            </label>
            <RoleField
              value={form.title}
              onChange={(value) => handleChange('title', value)}
              inputClassName="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
            />
            <label className="block space-y-1">
              <span className="text-xs uppercase text-zinc-400">{form.accountType === 'company' ? 'Company Name' : 'Personal Brand (Optional)'}</span>
              <input
                value={form.company}
                onChange={(e) => handleChange('company', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
                placeholder={form.accountType === 'company' ? 'Acme Inc.' : 'Your Brand'}
              />
            </label>
          </div>
        );
      case 'workspace':
        return (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs uppercase text-zinc-400">Workspace Name</span>
              <input
                value={form.workspaceName}
                onChange={(e) => handleChange('workspaceName', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
                placeholder={defaultWorkspaceName}
                autoFocus
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-zinc-400">Industry</span>
                <input
                  value={form.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
                  placeholder="Software, Design, etc."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-zinc-400">Company Size</span>
                <MinimalSelect
                  value={form.companySize}
                  onChange={(value) => handleChange('companySize', value)}
                  placeholder="Select size"
                  options={companySizes.map((size) => ({ value: size, label: size }))}
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs uppercase text-zinc-400">Primary Use Case</span>
              <textarea
                value={form.primaryUseCase}
                onChange={(e) => handleChange('primaryUseCase', e.target.value)}
                className="h-24 w-full resize-y rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
                placeholder="What will you use this workspace for?"
              />
            </label>
          </div>
        );
      case 'integrations':
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#EA803A33] bg-[#EA803A14] p-4">
              <p className="text-sm font-medium text-white">Connect the systems where your company already thinks.</p>
              <p className="mt-1 text-xs text-zinc-400">
                Team workspaces become much more useful once Slack, Google Workspace, or GitHub are connected. You can skip, but we will warn you before moving on.
              </p>
            </div>

            {integrationsLoading && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111111] p-4 text-sm text-zinc-300">
                <BlobLoader size={18} label="" />
                Loading current integration status...
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {providerCards.map(renderIntegrationCard)}
            </div>

            <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#EA803A]" />
                <p className="text-sm font-semibold text-white">Current coverage</p>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {connectedSourceCount > 0
                  ? `${connectedSourceCount} source${connectedSourceCount === 1 ? '' : 's'} connected: ${connectedSources.join(', ')}.`
                  : 'No company sources connected yet.'}
              </p>
            </div>

            <ToggleRow
              checked={skipIntegrationsConfirmed}
              onChange={() => {
                setSkipIntegrationsConfirmed((current) => !current);
                setForm((current) => ({
                  ...current,
                  onboardingSelections: {
                    ...current.onboardingSelections,
                    integrationsSkipped: !skipIntegrationsConfirmed
                  }
                }));
              }}
              label="Continue without connecting company sources"
              description="You can connect them later from the Integrations page, but your Company Brain and observability surfaces will stay colder until then."
            />
          </div>
        );
      case 'agents':
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#EA803A33] bg-[#EA803A14] p-4">
              <p className="text-sm font-medium text-white">Choose the first agent and workflow focus.</p>
              <p className="mt-1 text-xs text-zinc-400">You can change this later in settings, but this helps us hand you into the right control plane next.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {supportedAgents.slice(0, 4).map((agent) => {
                const active = form.agents.preferredAgent === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAgentSetting('preferredAgent', agent.id)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${active ? 'border-[#EA803A] bg-[#EA803A]/10' : 'border-white/10 bg-[#111111] hover:bg-[#1A1A1A]'}`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <AgentBrandIcon agentId={agent.id} name={agent.name} containerClassName="w-10 h-10" size="h-5 w-5" />
                      <div>
                        <p className="text-sm font-semibold text-white">{agent.name}</p>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">{agent.surface}</p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400">{agent.summary}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-zinc-400">Primary Workflow</span>
                <MinimalSelect value={form.agents.primaryWorkflow} onChange={(value) => handleAgentSetting('primaryWorkflow', value)} options={workflowOptions} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-zinc-400">Observability Focus</span>
                <MinimalSelect value={form.agents.observabilityFocus} onChange={(value) => handleAgentSetting('observabilityFocus', value)} options={observabilityOptions} />
              </label>
            </div>
            <ToggleRow
              checked={form.agents.autoOpenAgentManager}
              onChange={() => handleAgentSetting('autoOpenAgentManager', !form.agents.autoOpenAgentManager)}
              label="Take me straight to agent setup after onboarding"
              description="After setup, open the API key dashboard so you can create a key and launch a secure pairing flow immediately."
            />
          </div>
        );
      case 'finish':
        return (
          <div className="space-y-6">
            <AvatarPicker
              value={form.workspaceImageUrl}
              options={curatedAvatarOptions}
              onChange={(url) => setForm((current) => ({
                ...current,
                workspaceImageUrl: url,
                avatarUrl: current.accountType === 'individual' ? url : current.avatarUrl
              }))}
              title={form.accountType === 'individual' ? 'Choose your avatar' : 'Choose a workspace avatar'}
              description={form.accountType === 'individual'
                ? 'Pick one from our curated DiceBear set. Personal accounts use these only.'
                : 'Pick a clean shared mark for the workspace.'}
              triggerLabel="Open picker"
              helperText=""
              shape={form.accountType === 'individual' ? 'rounded-full' : 'rounded-3xl'}
            />

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-[#EA803A]" />
                  <p className="text-sm font-semibold text-white">Preferred Agent</p>
                </div>
                <p className="text-sm text-zinc-300">{preferredAgent.name}</p>
              </div>
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#EA803A]" />
                  <p className="text-sm font-semibold text-white">Company Sources</p>
                </div>
                <p className="text-sm text-zinc-300">{form.accountType === 'company' ? connectedSourceCount : 0}</p>
              </div>
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#EA803A]" />
                  <p className="text-sm font-semibold text-white">Workflow</p>
                </div>
                <p className="text-sm text-zinc-300 capitalize">{form.agents.primaryWorkflow.replace(/_/g, ' ')}</p>
              </div>
              <div className="rounded-xl border border-[#202020] bg-[#111] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#EA803A]" />
                  <p className="text-sm font-semibold text-white">First Focus</p>
                </div>
                <p className="text-sm text-zinc-300 capitalize">{form.agents.observabilityFocus.replace(/_/g, ' ')}</p>
              </div>
            </div>

            {form.accountType === 'company' && connectedSourceCount === 0 && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-300" />
                  <span className="font-semibold text-white">You are finishing without connected company systems.</span>
                </div>
                <p className="mt-2 text-zinc-300">
                  That is okay, but your Company Brain will stay mostly empty until you connect Slack, Google Workspace, or GitHub later from the dashboard.
                </p>
              </div>
            )}

            {form.accountType === 'company' && connectedSourceCount > 0 && (
              <div className="rounded-xl border border-[#5fd1b3]/20 bg-[#5fd1b3]/8 p-4 text-sm text-zinc-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#5fd1b3]" />
                  <span className="font-semibold text-white">Your team workspace is already warming up.</span>
                </div>
                <p className="mt-2 text-zinc-300">
                  {connectedSources.join(', ')} will start syncing immediately, and the next step is to pair an agent so repo activity and company context live in one control plane.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Preferences</p>
              <MinimalSelect
                value={form.api.responseStyle}
                onChange={(value) => setForm((current) => ({ ...current, api: { ...current.api, responseStyle: value } }))}
                options={[
                  { value: 'normal', label: 'Normal Response Style' },
                  { value: 'lite', label: 'Lite Response Style' },
                  { value: 'full', label: 'Full Response Style' }
                ]}
              />
              <ToggleRow
                checked={form.notifications.emailAlerts}
                onChange={() => handleToggle('emailAlerts')}
                label="Email alerts"
                description="Important usage and account events."
              />
            </div>

            <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-4">
              <p className="text-sm font-semibold text-white">What happens next</p>
              <ul className="mt-2 space-y-2 text-xs text-zinc-400">
                <li>1. We create your workspace and save your agent defaults.</li>
                <li>2. We send you to the control plane so you can create or select an API key.</li>
                <li>3. You click <span className="text-white">Connect Your Agent</span> and finish the secure pairing flow locally.</li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[#060606] px-4 py-8 text-white"
      style={{
        backgroundImage: `url('/onboardingbg.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div ref={glowRef} className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col rounded-3xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
        <div className="rounded-t-3xl border-b border-white/10 bg-[#111111] px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-[#EA803A]">Step {currentStep + 1} of {steps.length}</p>
            <button onClick={handleLogout} className="text-xs text-zinc-500 transition-colors hover:text-white">Sign out</button>
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{currentStepDef.title}</h1>
          <p className="mt-2 text-sm text-zinc-500">{currentStepDef.label}</p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#EA803A] transition-all duration-500 ease-out" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="flex flex-col">
          <div className="min-h-[420px] bg-[#0A0A0A] px-6 py-8 sm:px-8">
            {statusBanner && (
              <div className={`mb-5 rounded-xl border p-4 text-sm ${statusBanner.tone === 'success' ? 'border-[#5fd1b3]/20 bg-[#5fd1b3]/8 text-[#9fe7d6]' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-100'}`}>
                {statusBanner.message}
              </div>
            )}

            <div key={currentStepDef.id} className="animate-in fade-in slide-in-from-right-4 duration-500 ease-out fill-mode-both">
              {renderStep()}
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-900/50 bg-red-900/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-b-3xl border-t border-white/10 bg-[#111111] px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === 0 || submitting}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white disabled:invisible"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                type="submit"
                disabled={!canGoNext || submitting}
                className="group inline-flex items-center gap-2 rounded-lg bg-[#EA803A] px-6 py-2.5 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-[#f39454] disabled:pointer-events-none disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg bg-[#EA803A] px-6 py-2.5 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-[#f39454] disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? <BlobLoader size={20} label="" /> : 'Finish and Open Agent Setup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
