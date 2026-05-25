import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

import AvatarPicker from '../components/AvatarPicker';
import BlobLoader from '../components/BlobLoader';
import RoleField from '../components/RoleField';
import AgentBrandIcon from '../components/AgentBrandIcon';
import VelAiOnboardingChat from '../components/VelAiOnboardingChat';
import { OnboardingInfoTabBar } from '../components/OnboardingInfoTabs';
import { isVelAiInfoComplete } from '../lib/velaiOnboarding';
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Cpu, Database, Github, Google } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { curatedAvatarOptions, defaultCuratedAvatar, isCuratedAvatarUrl } from '../lib/avatars';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage } from '../lib/network';
import { supportedAgents } from '../lib/agentRuntime';
import { INTEGRATIONS_COMING_SOON } from '../lib/productFlags';

const ONBOARDING_PANEL_HEIGHT = 420;
const ONBOARDING_CONTENT_HEIGHT = 300;

// --- Configuration & Constants ---
const accountCards = [
  {
    id: 'company',
    eyebrow: 'For teams',
    title: 'Company workspace',
    description: 'Best if you want a shared control plane for engineering teams, repositories, Slack, email, and coding agents.',
    prompt: 'Slack, Google Workspace, and GitHub connections are coming soon. You can finish setup and connect sources later.'
  },
  {
    id: 'individual',
    eyebrow: 'For solo use',
    title: 'Individual workspace',
    description: 'Best for a solo founder or developer setting up a personal coding agent brain.',
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

const teamOnlyStep = { id: 'integrations', label: 'Integrations', title: 'Company sources' };
const trailingSteps = [
  { id: 'agents', label: 'Agents', title: 'Configure your first flow' },
  { id: 'avatar', label: 'Avatar', title: 'Choose your avatar' },
  { id: 'finish', label: 'Finish', title: 'Review & finish' }
];

const providerCards = [
  {
    id: 'slack',
    label: 'Slack',
    description: 'Import channels, threads, and signals so agents see how work actually flows.',
    icon: <img src="https://svgl.app/library/slack.svg" alt="Slack" className="h-5 w-5 object-contain" loading="lazy" />
  },
  {
    id: 'google',
    label: 'Google Workspace',
    description: 'Bring Gmail, Drive, Docs, and Calendar into one searchable company layer.',
    icon: <Google className="h-5 w-5 object-contain" />
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Map repositories, pull requests, and issues directly into your shared memory.',
    icon: <Github className="h-5 w-5" />
  }
];

const ONBOARDING_DRAFT_VERSION = 5;
const INFO_MODES = {
  UNSET: 'unset',
  VELAI: 'velai',
  MANUAL: 'manual'
};

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
    skippedSources: [],
    infoCollectionMode: INFO_MODES.UNSET
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
    notifications: { ...fallback.notifications, ...(draft.notifications || {}) },
    api: { ...fallback.api, ...(draft.api || {}) },
    agents: { ...fallback.agents, ...(draft.agents || {}) },
    companySources: { ...fallback.companySources, ...(draft.companySources || {}) },
    onboardingSelections: {
      ...fallback.onboardingSelections,
      ...(draft.onboardingSelections || {}),
      infoCollectionMode: ['unset', 'velai', 'manual'].includes(draft.onboardingSelections?.infoCollectionMode)
        ? draft.onboardingSelections.infoCollectionMode
        : fallback.onboardingSelections.infoCollectionMode
    }
  };
};

// --- Custom Reusable Components ---

const SelectDropdown = ({ label, value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="block space-y-1.5" ref={dropdownRef}>
      {label && <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-2xl bg-[#121212] px-4 py-3.5 text-[13px] outline-none transition-colors duration-200 hover:bg-[#18181b] focus:bg-[#18181b]"
        >
          <span className={selectedOption ? 'text-white' : 'text-zinc-500'}>
            {selectedOption ? selectedOption.label : placeholder || 'Select an option...'}
          </span>
          <svg className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-[#121212] py-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-[13px] transition-colors ${
                  value === option.value 
                  ? 'bg-[#EA803A]/10 text-[#EA803A] font-semibold' 
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ToggleRow = ({
  checked = false,
  onChange,
  label,
  description
}) => {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      className="
        flex
        w-full
        items-start
        justify-between
        gap-4
        rounded-2xl
        bg-[#121212]
        px-4
        py-3.5
        text-left
        transition-colors
        duration-200
        hover:bg-[#18181b]
      "
    >
      <div className="min-w-0">
        <p
          className="
            text-[13px]
            font-medium
            tracking-[-0.01em]
            text-zinc-100
          "
        >
          {label}
        </p>

        {description ? (
          <p
            className="
              mt-1
              text-xs
              leading-relaxed
              text-zinc-500
            "
          >
            {description}
          </p>
        ) : null}
      </div>

      <div
        className={`
          relative
          mt-0.5
          flex
          h-6
          w-11
          flex-shrink-0
          items-center
          rounded-full
          px-1
          transition-colors
          duration-300

          ${
            checked
              ? 'bg-[#EA803A]'
              : 'bg-zinc-700/80'
          }
        `}
      >
        <div
          className={`
            h-4
            w-4
            rounded-full
            bg-white
            transition-transform
            duration-300
            ease-out

            ${
              checked
                ? 'translate-x-5'
                : 'translate-x-0'
            }
          `}
        />
      </div>
    </button>
  );
};

const CelebrationOverlay = () => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-[#0A0A0A] animate-in fade-in duration-500">
    <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#EA803A]/20 animate-in zoom-in-50 duration-500 ease-out">
      <div className="absolute inset-0 animate-ping rounded-full bg-[#EA803A]/30 opacity-75 duration-1000" />
      <CheckCircle className="relative z-10 h-10 w-10 text-[#EA803A] animate-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both" />
    </div>
    <h2 className="text-xl font-semibold tracking-tight text-white animate-in slide-in-from-bottom-3 fade-in delay-200 duration-500 fill-mode-both">
      Workspace Created
    </h2>
    <p className="mt-2 text-[13px] text-zinc-400 animate-in slide-in-from-bottom-3 fade-in delay-300 duration-500 fill-mode-both">
      Preparing your environment...
    </p>
  </div>
);

// --- Main Page Component ---

export default function Onboarding() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const draftKey = useMemo(() => `velocitybrain:onboarding-draft:${user?.id || user?.email || 'anonymous'}`, [user?.email, user?.id]);
  
  const [form, setForm] = useState(() => createInitialForm(user));
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [skipIntegrationsConfirmed, setSkipIntegrationsConfirmed] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [error, setError] = useState('');
  const hydratedDraftRef = useRef(false);

  const infoCollectionMode = form.onboardingSelections?.infoCollectionMode || INFO_MODES.UNSET;
  const effectiveInfoMode = infoCollectionMode === INFO_MODES.UNSET ? INFO_MODES.VELAI : infoCollectionMode;
  const velaiInfoComplete = useMemo(() => isVelAiInfoComplete(form), [form]);
  const usingVelAi = effectiveInfoMode === INFO_MODES.VELAI;

  const setInfoCollectionMode = (mode) => {
    setError('');
    setForm((current) => ({
      ...current,
      onboardingSelections: { ...current.onboardingSelections, infoCollectionMode: mode }
    }));
  };

  const steps = useMemo(() => (
    form.accountType === 'company'
      ? [...baseSteps, teamOnlyStep, ...trailingSteps]
      : [...baseSteps, ...trailingSteps]
  ), [form.accountType]);

  const currentStepDef = steps[currentStep] || steps[0];
  const currentStepId = currentStepDef.id;
  const isInfoStep = currentStepId === 'profile' || currentStepId === 'workspace';
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
      window.localStorage.setItem(draftKey, JSON.stringify({ version: ONBOARDING_DRAFT_VERSION, currentStep, form }));
    } catch { /* ignore */ }
  }, [currentStep, draftKey, form]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(Math.max(0, steps.length - 1));
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    if (INTEGRATIONS_COMING_SOON || form.accountType !== 'company') return;

    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const response = await axios.get(resolveApiUrl('/api/integrations/onboarding-status'));
        if (cancelled) return;
        const payload = response.data || {};
        setForm((current) => ({
          ...current,
          companySources: { ...current.companySources, ...(payload.companySources || {}) },
          onboardingSelections: {
            ...current.onboardingSelections,
            connectedSources: payload.connectedSources || Object.entries(payload.companySources || {}).filter(([, value]) => value?.connected).map(([provider]) => provider)
          }
        }));
      } catch {
        if (!cancelled) {
          setStatusBanner({ tone: 'warning', message: 'We could not load integration status. You can continue or retry.' });
        }
      }
    };

    fetchStatus();
    return () => { cancelled = true; };
  }, [form.accountType]);

  useEffect(() => {
    if (INTEGRATIONS_COMING_SOON) return;
    const params = new URLSearchParams(location.search);
    const provider = params.get('provider');
    const status = params.get('status');
    if (!provider || !status) return;

    if (status === 'connected') {
      setStatusBanner({ tone: 'success', message: `${providerCards.find((item) => item.id === provider)?.label || provider} connected successfully. Sync starting.` });
    } else {
      setStatusBanner({ tone: 'warning', message: `Failed to connect ${providerCards.find((item) => item.id === provider)?.label || provider}.` });
    }
  }, [location.search]);

  useEffect(() => {
    if (!INTEGRATIONS_COMING_SOON || form.accountType !== 'company') return;
    setSkipIntegrationsConfirmed(true);
    setForm((current) => ({
      ...current,
      onboardingSelections: {
        ...current.onboardingSelections,
        integrationsSkipped: true,
        integrationsComingSoon: true
      }
    }));
  }, [form.accountType]);

  const handleChange = (key, value) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleToggle = (key) => {
    setError('');
    setForm((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: !current.notifications[key] }
    }));
  };

  const handleAgentSetting = (key, value) => {
    setError('');
    setForm((current) => ({
      ...current,
      agents: { ...current.agents, [key]: value }
    }));
  };

  const workspaceStepIndex = useMemo(() => steps.findIndex((step) => step.id === 'workspace'), [steps]);

  const canGoNext = useMemo(() => {
    if (currentStepId === 'account') return Boolean(form.accountType);
    if (currentStepId === 'profile') {
      if (usingVelAi) return velaiInfoComplete;
      return Boolean(form.name.trim());
    }
    if (currentStepId === 'workspace') {
      if (usingVelAi && velaiInfoComplete) return true;
      return true;
    }
    if (currentStepId === 'integrations') {
      return INTEGRATIONS_COMING_SOON || connectedSourceCount > 0 || skipIntegrationsConfirmed;
    }
    if (currentStepId === 'agents') return Boolean(form.agents.preferredAgent);
    if (currentStepId === 'avatar') return Boolean(form.workspaceImageUrl && isCuratedAvatarUrl(form.workspaceImageUrl));
    return true;
  }, [
    connectedSourceCount,
    currentStepId,
    form.accountType,
    form.agents.preferredAgent,
    form.name,
    form.workspaceImageUrl,
    skipIntegrationsConfirmed,
    usingVelAi,
    velaiInfoComplete
  ]);

  const goNext = () => {
    if (!canGoNext) return;
    if (currentStepId === 'profile' && usingVelAi && velaiInfoComplete && workspaceStepIndex >= 0) {
      setCurrentStep(Math.min(workspaceStepIndex + 1, steps.length - 1));
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const goBack = () => {
    setCurrentStep((step) => {
      const prev = Math.max(step - 1, 0);
      if (usingVelAi && workspaceStepIndex >= 0 && steps[prev]?.id === 'workspace') {
        return Math.max(workspaceStepIndex - 1, 0);
      }
      return prev;
    });
  };

  const handleLogout = async () => {
    try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
    await logout();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        ...form,
        workspaceName: defaultWorkspaceName,
        companySources: { ...form.companySources },
        onboardingSelections: {
          ...form.onboardingSelections,
          integrationsSkipped: form.accountType === 'company'
            ? (INTEGRATIONS_COMING_SOON || (skipIntegrationsConfirmed && connectedSourceCount === 0))
            : false,
          integrationsComingSoon: INTEGRATIONS_COMING_SOON,
          connectedSources,
          skippedSources: Object.entries(form.companySources || {}).filter(([, value]) => value?.skipped).map(([provider]) => provider)
        }
      };

      const response = await axios.post(resolveApiUrl('/api/settings/onboarding'), payload);
      try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
      
      updateUser(response.data.user);
      setIsSuccess(true);
      
      setTimeout(() => {
        navigate(form.agents.autoOpenAgentManager ? '/dashboard/api-keys' : '/dashboard', { replace: true });
      }, 1800);
      
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to complete onboarding.'));
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    if (submitting || isSuccess) return;
    if (currentStep < steps.length - 1) {
      if (canGoNext) goNext();
    } else {
      handleSubmit();
    }
  };

  const renderComingSoonIntegrationCard = (provider) => (
    <div key={provider.id} className="flex flex-col rounded-2xl bg-[#121212] p-4 transition-colors duration-200 hover:bg-[#18181b]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18181b]">
            {provider.icon}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-zinc-100">{provider.label}</p>
            <p className="text-[11px] text-zinc-500">Launching soon</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">{provider.description}</p>
    </div>
  );

  const renderStep = () => {
    switch (currentStepId) {
      case 'account':
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {accountCards.map((card) => {
                const active = form.accountType === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleChange('accountType', card.id)}
                    className={`rounded-2xl p-5 text-left transition-colors duration-200 ${active ? 'bg-[#EA803A]/10' : 'bg-[#121212] hover:bg-[#18181b]'}`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{card.eyebrow}</p>
                    <h3 className="mt-1.5 text-base font-semibold text-zinc-100">{card.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{card.description}</p>
                  </button>
                );
              })}
            </div>
            {activeAccountCard && (
              <div className="rounded-2xl bg-[#EA803A]/10 p-4 text-sm text-[#f0965a]">
                {activeAccountCard.prompt}
                <p className="mt-2 text-xs font-normal text-zinc-400">
                  Next step: chat with <span className="font-semibold text-[#EA803A]">VelAI</span> or enter your profile manually.
                </p>
              </div>
            )}
          </div>
        );
      case 'profile':
        return (
          <div className="flex h-full min-h-0 flex-col">
            <OnboardingInfoTabBar
              activeMode={effectiveInfoMode}
              onModeChange={setInfoCollectionMode}
              velaiMode={INFO_MODES.VELAI}
              manualMode={INFO_MODES.MANUAL}
            />
            <div className="min-h-0 flex-1 overflow-hidden pt-3" style={{ height: ONBOARDING_CONTENT_HEIGHT }}>
              {usingVelAi ? (
                <VelAiOnboardingChat
                  form={form}
                  onFormChange={(nextForm) => setForm((current) => ({
                    ...current,
                    ...nextForm,
                    agents: { ...current.agents, ...(nextForm.agents || {}) },
                    onboardingSelections: {
                      ...current.onboardingSelections,
                      ...(nextForm.onboardingSelections || {}),
                      infoCollectionMode: INFO_MODES.VELAI
                    }
                  }))}
                  onComplete={() => setError('')}
                />
              ) : (
                <div className="h-full overflow-y-auto space-y-3 pr-0.5">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Your Full Name</span>
                    <input
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full rounded-2xl bg-[#121212] px-4 py-3.5 text-[13px] text-white outline-none transition-colors duration-200 placeholder:text-zinc-600 hover:bg-[#18181b] focus:bg-[#18181b]"
                      placeholder="Jane Doe"
                      autoFocus
                    />
                  </label>
                  <RoleField
                    value={form.title}
                    onChange={(value) => handleChange('title', value)}
                    inputClassName="w-full rounded-2xl bg-[#121212] px-4 py-3.5 text-[13px] text-white outline-none transition-colors duration-200 placeholder:text-zinc-600 hover:bg-[#18181b] focus:bg-[#18181b]"
                  />
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{form.accountType === 'company' ? 'Company Name' : 'Personal Brand (Optional)'}</span>
                    <input
                      value={form.company}
                      onChange={(e) => handleChange('company', e.target.value)}
                      className="w-full rounded-2xl bg-[#121212] px-4 py-3.5 text-[13px] text-white outline-none transition-colors duration-200 placeholder:text-zinc-600 hover:bg-[#18181b] focus:bg-[#18181b]"
                      placeholder={form.accountType === 'company' ? 'Acme Inc.' : 'Your Brand'}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        );
      case 'workspace':
        return (
          <div className="flex h-full min-h-0 flex-col">
            <OnboardingInfoTabBar
              activeMode={effectiveInfoMode}
              onModeChange={setInfoCollectionMode}
              velaiMode={INFO_MODES.VELAI}
              manualMode={INFO_MODES.MANUAL}
            />
            <div className="min-h-0 flex-1 overflow-y-auto pt-3" style={{ maxHeight: ONBOARDING_CONTENT_HEIGHT }}>
              {usingVelAi ? (
                velaiInfoComplete ? (
                  <div className="space-y-3 text-[13px] text-zinc-300">
                    <p className="text-zinc-400">Captured by VelAI — switch to Manual to edit fields.</p>
                    <div className="rounded-2xl bg-[#121212] p-4 space-y-1.5">
                      <p><span className="text-zinc-500">Workspace:</span> {form.workspaceName || defaultWorkspaceName}</p>
                      {form.industry && <p><span className="text-zinc-500">Industry:</span> {form.industry}</p>}
                      {form.companySize && <p><span className="text-zinc-500">Size:</span> {form.companySize}</p>}
                      {form.primaryUseCase && <p><span className="text-zinc-500">Use case:</span> {form.primaryUseCase}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-zinc-500">Complete the VelAI tab on the previous step, or use Manual to enter workspace details.</p>
                )
              ) : (
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Workspace Name</span>
                    <input
                      value={form.workspaceName}
                      onChange={(e) => handleChange('workspaceName', e.target.value)}
                      className="w-full rounded-2xl bg-[#121212] px-4 py-3.5 text-[13px] text-white outline-none transition-colors duration-200 placeholder:text-zinc-600 hover:bg-[#18181b] focus:bg-[#18181b]"
                      placeholder={defaultWorkspaceName}
                      autoFocus
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Industry</span>
                      <input
                        value={form.industry}
                        onChange={(e) => handleChange('industry', e.target.value)}
                        className="w-full rounded-2xl bg-[#121212] px-4 py-3.5 text-[13px] text-white outline-none transition-colors duration-200 placeholder:text-zinc-600 hover:bg-[#18181b] focus:bg-[#18181b]"
                        placeholder="Software, Design, etc."
                      />
                    </label>
                    <SelectDropdown
                      label="Company Size"
                      value={form.companySize}
                      onChange={(value) => handleChange('companySize', value)}
                      placeholder="Select size"
                      options={companySizes.map((size) => ({ value: size, label: size }))}
                    />
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Primary Use Case</span>
                    <textarea
                      value={form.primaryUseCase}
                      onChange={(e) => handleChange('primaryUseCase', e.target.value)}
                      className="h-20 w-full resize-y rounded-2xl bg-[#121212] px-4 py-3.5 text-[13px] text-white outline-none transition-colors duration-200 placeholder:text-zinc-600 hover:bg-[#18181b] focus:bg-[#18181b]"
                      placeholder="What will you use this workspace for?"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        );
      case 'integrations':
        return (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#121212] p-4">
              <p className="text-[13px] font-semibold text-zinc-100">Company sources — coming soon</p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Slack, Google Workspace, and GitHub sync are not available yet. Finish onboarding now; we will enable connections from the dashboard when they launch.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {providerCards.map(renderComingSoonIntegrationCard)}
            </div>

            <p className="text-center text-[11px] text-zinc-500">
              Press <span className="font-semibold text-zinc-400">Continue</span> to set up your coding agent.
            </p>
          </div>
        );
      case 'agents':
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {supportedAgents.slice(0, 4).map((agent) => {
                const active = form.agents.preferredAgent === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAgentSetting('preferredAgent', agent.id)}
                    className={`rounded-2xl p-4 text-left transition-colors duration-200 ${active ? 'bg-[#EA803A]/10' : 'bg-[#121212] hover:bg-[#18181b]'}`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <AgentBrandIcon agentId={agent.id} name={agent.name} containerClassName="w-8 h-8 rounded-lg" size="h-4 w-4" />
                      <div>
                        <p className="text-[13px] font-semibold text-zinc-100">{agent.name}</p>
                        <p className="text-[9px] uppercase tracking-widest text-zinc-500">{agent.surface}</p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{agent.summary}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 relative z-20">
              <SelectDropdown
                label="Primary Workflow"
                value={form.agents.primaryWorkflow}
                onChange={(value) => handleAgentSetting('primaryWorkflow', value)}
                options={workflowOptions}
              />
              <SelectDropdown
                label="Observability Focus"
                value={form.agents.observabilityFocus}
                onChange={(value) => handleAgentSetting('observabilityFocus', value)}
                options={observabilityOptions}
              />
            </div>
            <ToggleRow
              checked={form.agents.autoOpenAgentManager}
              onChange={() => handleAgentSetting('autoOpenAgentManager', !form.agents.autoOpenAgentManager)}
              label="Take me straight to setup"
              description="Open the API key dashboard next so you can pair immediately."
            />
          </div>
        );
      case 'avatar':
        return (
          <div className="space-y-4">
            <p className="text-[13px] text-zinc-400">
              Pick a look for {form.accountType === 'individual' ? 'your profile' : 'your workspace'}. This step is separate from VelAI chat.
            </p>
            <AvatarPicker
              value={form.workspaceImageUrl}
              options={curatedAvatarOptions}
              onChange={(url) => setForm((current) => ({
                ...current,
                workspaceImageUrl: url,
                avatarUrl: current.accountType === 'individual' ? url : current.avatarUrl
              }))}
              title={form.accountType === 'individual' ? 'Your avatar' : 'Workspace avatar'}
              description="Choose from our curated set — shown in the dashboard and workspace."
              triggerLabel="Choose avatar"
              helperText="Required to continue"
              shape={form.accountType === 'individual' ? 'rounded-full' : 'rounded-2xl'}
            />
          </div>
        );
      case 'finish':
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#121212] p-3">
              <img
                src={form.workspaceImageUrl || defaultCuratedAvatar}
                alt="Selected avatar"
                className={`h-12 w-12 object-cover ${form.accountType === 'individual' ? 'rounded-full' : 'rounded-xl'}`}
              />
              <div>
                <p className="text-[13px] font-medium text-zinc-100">Avatar selected</p>
                <p className="text-[11px] text-zinc-500">Change it on the previous step if needed.</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-2xl bg-[#121212] p-4 text-center transition-colors duration-200 hover:bg-[#18181b]">
                <Cpu className="mx-auto mb-1 h-4 w-4 text-[#EA803A]" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Agent</p>
                <p className="mt-0.5 text-[13px] font-semibold text-zinc-200 truncate">{preferredAgent.name}</p>
              </div>
              <div className="rounded-2xl bg-[#121212] p-4 text-center transition-colors duration-200 hover:bg-[#18181b]">
                <Database className="mx-auto mb-1 h-4 w-4 text-[#EA803A]" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Sources</p>
                <p className="mt-0.5 text-[13px] font-semibold text-zinc-200">{form.accountType === 'company' ? connectedSourceCount : 0}</p>
              </div>
              <div className="rounded-2xl bg-[#121212] p-4 text-center transition-colors duration-200 hover:bg-[#18181b]">
                <Activity className="mx-auto mb-1 h-4 w-4 text-[#EA803A]" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Workflow</p>
                <p className="mt-0.5 text-[13px] font-semibold text-zinc-200 capitalize truncate">{form.agents.primaryWorkflow.replace(/_/g, ' ')}</p>
              </div>
              <div className="rounded-2xl bg-[#121212] p-4 text-center transition-colors duration-200 hover:bg-[#18181b]">
                <Activity className="mx-auto mb-1 h-4 w-4 text-[#EA803A]" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Focus</p>
                <p className="mt-0.5 text-[13px] font-semibold text-zinc-200 capitalize truncate">{form.agents.observabilityFocus.replace(/_/g, ' ')}</p>
              </div>
            </div>

            {form.accountType === 'company' && connectedSourceCount === 0 && !INTEGRATIONS_COMING_SOON && (
              <div className="rounded-2xl bg-yellow-500/10 p-4 text-xs text-yellow-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="font-semibold">Proceeding without connected systems.</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative z-20">
                <SelectDropdown
                  label="Response Style"
                  value={form.api.responseStyle}
                  onChange={(value) => setForm((current) => ({ ...current, api: { ...current.api, responseStyle: value } }))}
                  options={[
                    { value: 'normal', label: 'Normal Response Style' },
                    { value: 'lite', label: 'Lite Response Style' },
                    { value: 'full', label: 'Full Response Style' }
                  ]}
                />
              </div>
              <ToggleRow
                checked={form.notifications.emailAlerts}
                onChange={() => handleToggle('emailAlerts')}
                label="Email alerts"
                description="Important usage and account events."
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[#050505] px-4 py-6 text-white sm:py-8"
      style={{
        backgroundImage: `url('/onboardingbg.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#0A0A0A] shadow-2xl">
        {isSuccess && <CelebrationOverlay />}
        
        <div className="rounded-t-3xl bg-[#121212] px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#EA803A]">Step {currentStep + 1} of {steps.length}</p>
            <button onClick={handleLogout} className="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-300">Sign out</button>
          </div>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">{currentStepDef.title}</h1>
          <p className="mt-1 text-[13px] text-zinc-400">
            {currentStepId === 'integrations' && INTEGRATIONS_COMING_SOON
              ? 'Coming soon'
              : isInfoStep
                ? (usingVelAi ? 'VelAI · guided setup' : 'Manual · form entry')
                : currentStepDef.label}
          </p>
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-[#EA803A] transition-all duration-500 ease-out" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="flex flex-col">
          <div
            className="relative flex flex-col px-6 py-6 sm:px-8"
            style={{ minHeight: ONBOARDING_PANEL_HEIGHT, height: ONBOARDING_PANEL_HEIGHT }}
          >
            {statusBanner && (
              <div className={`mb-4 rounded-2xl p-4 text-[13px] ${statusBanner.tone === 'success' ? 'bg-[#5fd1b3]/10 text-[#9fe7d6]' : 'bg-yellow-500/10 text-yellow-100'}`}>
                {statusBanner.message}
              </div>
            )}

            <div key={currentStepDef.id} className="min-h-0 flex-1 overflow-y-auto">
              {renderStep()}
            </div>

            {error && (
              <div className="mt-5 rounded-2xl bg-red-900/10 p-4 text-[13px] text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-b-3xl bg-[#121212] px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === 0 || submitting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-zinc-400 disabled:invisible"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                type="submit"
                disabled={!canGoNext || submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-[13px] font-bold text-black disabled:pointer-events-none disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                // This is the "type" attribute for the submit button on the final onboarding step, marking it as a form submission.
                type="submit"
        
                disabled={submitting}
                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-[#EA803A] px-5 py-2.5 text-[13px] font-bold text-black disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? <BlobLoader size={16} label="" /> : 'Finish Setup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}