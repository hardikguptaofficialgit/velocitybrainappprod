import React, { useMemo, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import AvatarPicker from '../components/AvatarPicker';
import BlobLoader from '../components/BlobLoader';
import MinimalSelect from '../components/MinimalSelect';
import RoleField from '../components/RoleField';
import { ArrowLeft, ArrowRight } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { curatedAvatarOptions, defaultCuratedAvatar, isCuratedAvatarUrl } from '../lib/avatars';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage } from '../lib/network';

const accountCards = [
  {
    id: 'company',
    eyebrow: 'For teams',
    title: 'Company workspace',
    description: 'Great if you want a shared brain for a team, a product, or a company workflow.',
    prompt: 'Share a few details about your company to set up your workspace.'
  },
  {
    id: 'individual',
    eyebrow: 'For solo use',
    title: 'Individual workspace',
    description: 'Best for a founder, operator, researcher, or developer setting up a personal brain.',
    prompt: 'Nice. We will keep this lightweight and tailored to your own work.'
  }
];

const companySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

const steps = [
  { id: 'account', label: 'Account Type', title: 'Who is this for?' },
  { id: 'profile', label: 'Profile', title: 'About you' },
  { id: 'workspace', label: 'Workspace', title: 'Workspace details' },
  { id: 'finish', label: 'Finish', title: 'Finishing touches' }
];

const ONBOARDING_DRAFT_VERSION = 1;

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
  }
});

const sanitizeDraftForm = (draft, fallback) => {
  if (!draft || typeof draft !== 'object') return fallback;

  const safeAvatarUrl = isCuratedAvatarUrl(draft.avatarUrl) ? draft.avatarUrl : fallback.avatarUrl;
  const safeWorkspaceImageUrl = isCuratedAvatarUrl(draft.workspaceImageUrl)
    ? draft.workspaceImageUrl
    : fallback.workspaceImageUrl;

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
  const draftKey = useMemo(() => `velocitybrain:onboarding-draft:${user?.id || user?.email || 'anonymous'}`, [user?.email, user?.id]);
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(() => createInitialForm(user));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const hydratedDraftRef = useRef(false);

  // Ref for the mouse tracking animation (preserved as requested)
  const glowRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!glowRef.current) return;
      glowRef.current.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(234, 128, 58, 0.15), transparent 40%)`;
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

      setForm(sanitizeDraftForm(parsed.form, fallback));
      setCurrentStep(
        Number.isInteger(parsed.currentStep)
          ? Math.max(0, Math.min(parsed.currentStep, steps.length - 1))
          : 0
      );
    } catch {
      window.localStorage.removeItem(draftKey);
      setForm(fallback);
    } finally {
      hydratedDraftRef.current = true;
    }
  }, [draftKey, user]);

  useEffect(() => {
    if (!hydratedDraftRef.current) return;

    const payload = {
      version: ONBOARDING_DRAFT_VERSION,
      currentStep,
      form
    };

    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures and keep onboarding usable.
    }

    try {
      window.history.replaceState(
        { ...(window.history.state || {}), onboardingStep: currentStep },
        '',
        window.location.href
      );
    } catch {
      // Ignore history update failures.
    }
  }, [currentStep, draftKey, form]);

  useEffect(() => {
    if (!hydratedDraftRef.current) return;
    if (form.accountType !== 'individual') return;
    if (form.avatarUrl === form.workspaceImageUrl) return;

    setForm((current) => ({
      ...current,
      avatarUrl: current.workspaceImageUrl
    }));
  }, [form.accountType, form.avatarUrl, form.workspaceImageUrl]);

  const defaultWorkspaceName = useMemo(() => {
    if (form.workspaceName.trim()) return form.workspaceName.trim();
    if (form.accountType === 'company' && form.company.trim()) return form.company.trim();
    if (form.name.trim()) return `${form.name.trim()}'s Workspace`;
    return 'Workspace';
  }, [form.accountType, form.company, form.name, form.workspaceName]);

  const completion = useMemo(() => Math.round(((currentStep + 1) / steps.length) * 100), [currentStep]);
  const activeAccountCard = accountCards.find((card) => card.id === form.accountType);

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

  const canGoNext = useMemo(() => {
    if (currentStep === 0) return Boolean(form.accountType);
    if (currentStep === 1) return Boolean(form.name.trim());
    return true;
  }, [currentStep, form.accountType, form.name]);

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
      // Ignore storage cleanup failures during logout.
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
        avatarUrl: form.avatarUrl,
        workspaceImageUrl: form.workspaceImageUrl
      };

      const response = await axios.post(resolveApiUrl('/api/settings/onboarding'), payload);
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Ignore storage cleanup failures after successful onboarding.
      }
      updateUser(response.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to complete onboarding.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;

    if (currentStep < steps.length - 1) {
      if (canGoNext) goNext();
    } else {
      handleSubmit();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
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
                    className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-colors duration-300 ${
                      active
                        ? 'border-[#EA803A] bg-[#EA803A]/10 shadow-[0_0_20px_rgba(234,128,58,0.1)]'
                        : 'border-white/10 bg-[#111111] hover:bg-[#1A1A1A]'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-widest text-zinc-400">{card.eyebrow}</p>
                    <h3 className="mt-2 text-lg font-bold text-white">{card.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{card.description}</p>
                  </button>
                );
              })}
            </div>
            {activeAccountCard && (
              <div className="animate-in fade-in slide-in-from-bottom-2 rounded-xl bg-[#EA803A]/10 p-4 text-sm text-[#EA803A] duration-500 ease-out fill-mode-both">
                {activeAccountCard.prompt}
              </div>
            )}
          </div>
        );

      case 1:
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
              selectClassName=""
              inputClassName="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
            />
            <label className="block space-y-1">
              <span className="text-xs uppercase text-zinc-400">
                {form.accountType === 'company' ? 'Company Name' : 'Personal Brand (Optional)'}
              </span>
              <input
                value={form.company}
                onChange={(e) => handleChange('company', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#EA803A] focus:bg-[#1A1A1A]"
                placeholder={form.accountType === 'company' ? 'Acme Inc.' : 'Your Brand'}
              />
            </label>
          </div>
        );

      case 2:
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

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#111111] p-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#0A0A0A]">
                <img src={form.workspaceImageUrl} alt="Workspace avatar preview" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {form.accountType === 'individual' ? 'Your avatar' : 'Workspace avatar'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Only curated DiceBear avatars are available here, so every workspace keeps a clean consistent look.
                </p>
              </div>
            </div>

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
              helperText="Compact popup with curated choices"
              shape={form.accountType === 'individual' ? 'rounded-full' : 'rounded-3xl'}
            />

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Preferences</p>
              <label className="block space-y-1">
                <MinimalSelect
                  value={form.api.responseStyle}
                  onChange={(value) => setForm((current) => ({ ...current, api: { ...current.api, responseStyle: value } }))}
                  options={[
                    { value: 'normal', label: 'Normal Response Style' },
                    { value: 'lite', label: 'Lite Response Style' },
                    { value: 'full', label: 'Full Response Style' }
                  ]}
                />
              </label>
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
      className="relative flex min-h-screen items-center justify-center bg-[#060606] px-4 py-8 text-white"
      style={{
        backgroundImage: `url('/onboardingbg.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Animated Mouse Tracker Layer (Glow allowed) */}
      <div 
        ref={glowRef}
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300" 
      />

      {/* Main Solid Container. Removed overflow-hidden to allow dropdowns to pop out without getting clipped */}
      <div className="relative z-10 flex w-full max-w-xl flex-col rounded-3xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
        
        {/* Header Section (added rounded-t-3xl to compensate for parent overflow change) */}
        <div className="rounded-t-3xl border-b border-white/10 bg-[#111111] px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-[#EA803A]">Step {currentStep + 1} of {steps.length}</p>
            <button onClick={handleLogout} className="text-xs text-zinc-500 transition-colors hover:text-white">Sign out</button>
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{steps[currentStep].title}</h1>
          
          {/* Progress Bar */}
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#EA803A] transition-all duration-500 ease-out"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Form Wrap allows standard 'Enter' key submission to go next/submit */}
        <form onSubmit={handleFormSubmit} className="flex flex-col">
          {/* Form Body Section */}
          <div className="min-h-[300px] bg-[#0A0A0A] px-6 py-8 sm:px-8">
            {/* Smooth Sliding Animation Wrapper */}
            <div key={currentStep} className="animate-in fade-in slide-in-from-right-4 duration-500 ease-out fill-mode-both">
              {renderStep()}
            </div>

            {error && (
              <div className="animate-in fade-in mt-6 rounded-xl border border-red-900/50 bg-red-900/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Footer Actions Section (added rounded-b-3xl) */}
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
                className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg bg-[#EA803A] px-6 py-2.5 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-[#f39454] disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? <BlobLoader size={20} label="" /> : 'Finish Setup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
