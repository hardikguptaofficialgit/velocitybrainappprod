import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

import AvatarPicker from '../components/AvatarPicker';
import AgentBrandIcon from '../components/AgentBrandIcon';
import BlobLoader from '../components/BlobLoader';
import DropdownField from '../components/ui/DropdownField';
import RoleField from '../components/RoleField';
import { Bell, Cpu, Globe, Settings as SettingsIcon, Shield, User } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { supportedAgents } from '../lib/agentRuntime';
import { INTEGRATIONS_COMING_SOON } from '../lib/productFlags';
import { curatedAvatarOptions, defaultCuratedAvatar } from '../lib/avatars';
import { resolveApiUrl } from '../lib/api';
import { getErrorMessage } from '../lib/network';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'workspace', label: 'Workspace', icon: SettingsIcon },
  { id: 'agents', label: 'Agent Integrations', icon: Cpu },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api', label: 'API Settings', icon: Globe }
];

const companySizes = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const timezones = ['UTC', 'Asia/Calcutta', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin'];

const SaveButton = ({ saving, children }) => (
  <button
    type="submit"
    disabled={saving}
    className="inline-flex min-w-[148px] items-center justify-center rounded-xl bg-gradient-to-b from-[#EA803A] to-[#d66a25] shadow-lg shadow-[#EA803A]/20 px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    style={{ fontFamily: 'Syne, sans-serif' }}
  >
    {saving ? (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
        Saving...
      </div>
    ) : (
      children
    )}
  </button>
);

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [settings, setSettings] = useState({
    notifications: {
      emailAlerts: true,
      usageWarnings: true,
      monthlyReports: false,
      productUpdates: true
    },
    api: {
      responseStyle: 'normal',
      webhookUrl: '',
      allowedOrigins: []
    },
    agents: {
      preferredAgent: 'codex',
      preferredSurface: 'mcp',
      primaryWorkflow: 'coding',
      observabilityFocus: 'repository_activity',
      pairingPreference: 'browser_assisted',
      autoOpenAgentManager: true
    }
  });

  const [profileForm, setProfileForm] = useState({
    name: '',
    title: '',
    company: '',
    avatarUrl: defaultCuratedAvatar
  });

  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    industry: '',
    companySize: '',
    website: '',
    description: '',
    primaryUseCase: '',
    timezone: 'UTC',
    imageUrl: defaultCuratedAvatar
  });

  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [securityAction, setSecurityAction] = useState('');

  const twoFactorEnabled = useMemo(() => Boolean(user?.twoFactorEnabled), [user?.twoFactorEnabled]);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const response = await axios.get(resolveApiUrl('/api/settings'));
        if (!mounted) return;
        const payload = response.data;
        setWorkspace(payload.workspace);
        setSettings(payload.settings);
        setProfileForm({
          name: payload.user?.name || '',
          title: payload.user?.title || '',
          company: payload.user?.company || '',
          avatarUrl: payload.user?.avatarUrl || defaultCuratedAvatar
        });
        setWorkspaceForm({
          name: payload.workspace?.name || '',
          industry: payload.workspace?.settings?.industry || '',
          companySize: payload.workspace?.settings?.companySize || '',
          website: payload.workspace?.settings?.website || '',
          description: payload.workspace?.settings?.description || '',
          primaryUseCase: payload.workspace?.settings?.primaryUseCase || '',
          timezone: payload.workspace?.settings?.timezone || 'UTC',
          imageUrl: payload.workspace?.imageUrl || defaultCuratedAvatar
        });
        setTwoFactorSetup(null);
        setTwoFactorCode('');
      } catch (err) {
        if (!mounted) return;
        setError(getErrorMessage(err, 'Failed to load settings.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const setBanner = (message) => {
    setSuccess(message);
    setError('');
  };

  const setFailure = (message) => {
    setError(message);
    setSuccess('');
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingKey('profile');
    try {
      const response = await axios.patch(resolveApiUrl('/api/settings/profile'), profileForm);
      updateUser(response.data.user);
      setBanner('Profile saved.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to save profile.'));
    } finally {
      setSavingKey('');
    }
  };

  const handleWorkspaceSubmit = async (event) => {
    event.preventDefault();
    setSavingKey('workspace');
    try {
      const response = await axios.patch(resolveApiUrl('/api/settings/workspace'), workspaceForm);
      setWorkspace(response.data.workspace);
      setWorkspaceForm((current) => ({
        ...current,
        imageUrl: response.data.workspace?.imageUrl || current.imageUrl
      }));
      setBanner('Workspace settings saved.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to save workspace settings.'));
    } finally {
      setSavingKey('');
    }
  };

  const handleNotificationsSubmit = async (event) => {
    event.preventDefault();
    setSavingKey('notifications');
    try {
      const response = await axios.patch(resolveApiUrl('/api/settings/notifications'), settings.notifications);
      setSettings(response.data.settings);
      setBanner('Notification preferences saved.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to save notifications.'));
    } finally {
      setSavingKey('');
    }
  };

  const handleApiSubmit = async (event) => {
    event.preventDefault();
    setSavingKey('api');
    try {
      const response = await axios.patch(resolveApiUrl('/api/settings/api'), {
        responseStyle: settings.api.responseStyle,
        webhookUrl: settings.api.webhookUrl,
        allowedOrigins: settings.api.allowedOrigins
      });
      setSettings(response.data.settings);
      setBanner('API settings saved.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to save API settings.'));
    } finally {
      setSavingKey('');
    }
  };

  const handleAgentSubmit = async (event) => {
    event.preventDefault();
    setSavingKey('agents');
    try {
      const response = await axios.patch(resolveApiUrl('/api/settings/agents'), settings.agents);
      setSettings(response.data.settings);
      setBanner('Agent preferences saved.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to save agent preferences.'));
    } finally {
      setSavingKey('');
    }
  };

  const startTwoFactorSetup = async () => {
    setSecurityAction('setup');
    try {
      const response = await axios.post(resolveApiUrl('/api/auth/2fa/setup'));
      if (response.data.user) {
        updateUser(response.data.user);
      }
      setTwoFactorSetup({
        qrCode: response.data.qrCode,
        secret: response.data.secret
      });
      setTwoFactorCode('');
      setBanner('Scan the QR code, then enter the 6-digit code to finish enabling 2FA.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to start two-factor setup.'));
    } finally {
      setSecurityAction('');
    }
  };

  const verifyTwoFactorSetup = async (event) => {
    event.preventDefault();
    setSecurityAction('verify');
    try {
      const response = await axios.post(resolveApiUrl('/api/auth/2fa/verify'), {
        token: twoFactorCode.trim()
      });
      if (response.data.user) {
        updateUser(response.data.user);
      }
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setBanner('Two-factor authentication is now enabled.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to verify two-factor code.'));
    } finally {
      setSecurityAction('');
    }
  };

  const disableTwoFactor = async (event) => {
    event.preventDefault();
    setSecurityAction('disable');
    try {
      const response = await axios.post(resolveApiUrl('/api/auth/2fa/disable'), {
        token: twoFactorCode.trim()
      });
      if (response.data.user) {
        updateUser(response.data.user);
      }
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setBanner('Two-factor authentication has been disabled.');
    } catch (err) {
      setFailure(getErrorMessage(err, 'Failed to disable two-factor authentication.'));
    } finally {
      setSecurityAction('');
    }
  };

  // -------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------

  const renderProfileTab = () => (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10 h-full">
      <form onSubmit={handleProfileSubmit} className="rounded-xl bg-[#0d0d0d] p-6 space-y-6 h-full">
        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>
          Profile information
        </h2>

        <AvatarPicker
          value={profileForm.avatarUrl}
          options={curatedAvatarOptions}
          onChange={(url) => setProfileForm((current) => ({ ...current, avatarUrl: url }))}
          title="Pick your avatar"
          description="Only avatars from our list are available here."
          triggerLabel="Open picker"
          helperText="Compact popup with curated choices"
          shape="rounded-full"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Full name</span>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm((current) => ({ ...current, name: e.target.value }))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors focus:bg-[#111]"
              placeholder="John Doe"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email</span>
            <input
              value={user.email || ''}
              disabled
              className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/30 px-4 py-2.5 text-sm text-zinc-500 shadow-inner cursor-not-allowed"
            />
          </label>
          <div className="space-y-2">
            <RoleField
              label="Title"
              value={profileForm.title}
              onChange={(value) => setProfileForm((current) => ({ ...current, title: value }))}
              selectClassName="[&_button]:rounded-lg [&_button]:border-[#2a2a2a] [&_button]:bg-zinc-900/50 [&_button]:px-4 [&_button]:py-2.5 [&_button]:shadow-inner [&_button]:transition-colors"
              inputClassName="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors"
              helperText="Choose a common title fast, or use Other for a custom one."
            />
          </div>
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Company</span>
            <input
              value={profileForm.company}
              onChange={(e) => setProfileForm((current) => ({ ...current, company: e.target.value }))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors focus:bg-[#111]"
              placeholder="Your company"
            />
          </label>
        </div>

        <div className="flex justify-end pt-4">
          <SaveButton saving={savingKey === 'profile'}>Save profile</SaveButton>
        </div>
      </form>
    </div>
  );

  const renderWorkspaceTab = () => (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10 h-full">
      <form onSubmit={handleWorkspaceSubmit} className="rounded-xl bg-[#0d0d0d] p-6 space-y-6 h-full">
        <div className="flex items-start justify-between gap-4 border-b border-[#1c1c1c] pb-5">
          <div>
            <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>
              Workspace settings
            </h2>
            <p className="text-sm text-zinc-500 mt-1">Manage the shared identity and defaults tied to your workspace.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Workspace type</p>
            <p className="mt-1 text-sm font-semibold text-white capitalize">{workspace?.type || user?.accountType || 'individual'}</p>
          </div>
        </div>

        <AvatarPicker
          value={workspaceForm.imageUrl}
          options={curatedAvatarOptions}
          onChange={(url) => setWorkspaceForm((current) => ({ ...current, imageUrl: url }))}
          title="Pick a workspace avatar"
          description="Only curated avatars from our list can be used here."
          triggerLabel="Open picker"
          helperText="Compact popup with curated choices"
          shape="rounded-2xl"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="space-y-2 md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace name</span>
            <input
              value={workspaceForm.name}
              onChange={(e) => setWorkspaceForm((current) => ({ ...current, name: e.target.value }))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors"
              placeholder="Workspace name"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Industry</span>
            <input
              value={workspaceForm.industry}
              onChange={(e) => setWorkspaceForm((current) => ({ ...current, industry: e.target.value }))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors"
              placeholder="Developer tools, fintech..."
            />
          </label>
          <DropdownField
            label="Company size"
            value={workspaceForm.companySize}
            onChange={(value) => setWorkspaceForm((current) => ({ ...current, companySize: value }))}
            placeholder="Select a range"
            options={companySizes.map((size) => ({ value: size, label: size }))}
          />
          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Website</span>
            <input
              value={workspaceForm.website}
              onChange={(e) => setWorkspaceForm((current) => ({ ...current, website: e.target.value }))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors"
              placeholder="https://your-company.com"
            />
          </label>
          <DropdownField
            label="Timezone"
            value={workspaceForm.timezone}
            onChange={(value) => setWorkspaceForm((current) => ({ ...current, timezone: value }))}
            options={timezones.map((timezone) => ({ value: timezone, label: timezone }))}
          />
          <label className="space-y-2 md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Primary use case</span>
            <textarea
              value={workspaceForm.primaryUseCase}
              onChange={(e) => setWorkspaceForm((current) => ({ ...current, primaryUseCase: e.target.value }))}
              className="h-24 w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors resize-none"
              placeholder="What workflows should the workspace support first?"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</span>
            <textarea
              value={workspaceForm.description}
              onChange={(e) => setWorkspaceForm((current) => ({ ...current, description: e.target.value }))}
              className="h-28 w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors resize-none"
              placeholder="A short summary of the team, products, or operating context."
            />
          </label>
        </div>

        <div className="flex justify-end pt-4">
          <SaveButton saving={savingKey === 'workspace'}>Save workspace</SaveButton>
        </div>
      </form>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10 h-full">
      <form onSubmit={handleNotificationsSubmit} className="rounded-xl bg-[#0d0d0d] p-6 space-y-6 h-full">
        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>
          Notification preferences
        </h2>

        <div className="space-y-2">
          {[
            { key: 'emailAlerts', label: 'Email Alerts', description: 'Receive alerts about API usage and errors' },
            { key: 'usageWarnings', label: 'Usage Warnings', description: 'Get notified when approaching rate limits' },
            { key: 'monthlyReports', label: 'Monthly Reports', description: 'Receive monthly usage and analytics reports' },
            { key: 'productUpdates', label: 'Product Updates', description: 'Get notified about new features and improvements' }
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors shadow-inner cursor-pointer">
              <div>
                <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{item.label}</p>
                <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.notifications[item.key])}
                onChange={() => setSettings((current) => ({
                  ...current,
                  notifications: {
                    ...current.notifications,
                    [item.key]: !current.notifications[item.key]
                  }
                }))}
                className="h-4 w-4 accent-[#EA803A] cursor-pointer"
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton saving={savingKey === 'notifications'}>Save notifications</SaveButton>
        </div>
      </form>
    </div>
  );

  const renderAgentsTab = () => (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10 h-full">
      <form onSubmit={handleAgentSubmit} className="rounded-xl bg-[#0d0d0d] p-6 space-y-6 h-full">
        <div>
          <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            Agent integrations
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Set your default agent strategy, then jump directly into key creation and secure pairing.
          </p>
        </div>

        <div className="rounded-xl border border-[#EA803A]/30 bg-gradient-to-r from-[#EA803A]/10 to-transparent p-4 text-sm text-zinc-300 leading-relaxed shadow-inner">
          Ideal flow: create or select an API key, click <span className="text-white font-medium">Connect Your Agent</span>, let Velocity Brain exchange the short-lived pairing code, and then watch repo, model, and task telemetry appear automatically.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <DropdownField
            label="Preferred agent"
            value={settings.agents.preferredAgent}
            onChange={(value) => setSettings((current) => ({
              ...current,
              agents: { ...current.agents, preferredAgent: value }
            }))}
            options={supportedAgents.map((agent) => ({ value: agent.id, label: agent.name }))}
          />
          <DropdownField
            label="Primary workflow"
            value={settings.agents.primaryWorkflow}
            onChange={(value) => setSettings((current) => ({
              ...current,
              agents: { ...current.agents, primaryWorkflow: value }
            }))}
            options={[
              { value: 'coding', label: 'Coding workflows' },
              { value: 'debugging', label: 'Debugging and incident response' },
              { value: 'research', label: 'Research and planning' },
              { value: 'automation', label: 'Internal automation' }
            ]}
          />
          <DropdownField
            label="Observability focus"
            value={settings.agents.observabilityFocus}
            onChange={(value) => setSettings((current) => ({
              ...current,
              agents: { ...current.agents, observabilityFocus: value }
            }))}
            options={[
              { value: 'repository_activity', label: 'Repository activity' },
              { value: 'model_costs', label: 'Model costs and token burn' },
              { value: 'task_timeline', label: 'Task timeline and logs' },
              { value: 'anomaly_detection', label: 'Anomalies and inefficiencies' }
            ]}
          />
          <DropdownField
            label="Pairing preference"
            value={settings.agents.pairingPreference}
            onChange={(value) => setSettings((current) => ({
              ...current,
              agents: { ...current.agents, pairingPreference: value }
            }))}
            options={[
              { value: 'browser_assisted', label: 'Browser-assisted secure pairing' },
              { value: 'cli_guided', label: 'CLI-guided token exchange' }
            ]}
          />
        </div>

        <label className="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-4 py-4 shadow-inner cursor-pointer hover:bg-zinc-900/60 transition-colors">
          <div>
            <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Open agent setup after onboarding</p>
            <p className="text-xs text-zinc-500 mt-1">Drop new users straight into the API key and pairing workflow.</p>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settings.agents.autoOpenAgentManager)}
            onChange={() => setSettings((current) => ({
              ...current,
              agents: { ...current.agents, autoOpenAgentManager: !current.agents.autoOpenAgentManager }
            }))}
            className="h-4 w-4 accent-[#EA803A] cursor-pointer"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/dashboard/api-keys"
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-[#EA803A] to-[#d66a25] px-4 py-2.5 text-sm font-bold text-black shadow-md shadow-[#EA803A]/20 hover:opacity-90 transition-opacity"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Open API Keys
          </Link>
          <Link
            to="/dashboard/agents"
            className="inline-flex items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#111] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1a1a] transition-colors"
          >
            Open Agent Manager
          </Link>
          <Link
            to="/dashboard/integrations"
            className="inline-flex items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#111] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1a1a] transition-colors"
          >
            {INTEGRATIONS_COMING_SOON 
              ? `${user?.accountType === 'individual' ? 'Personal' : 'Company'} Integrations (soon)` 
              : `Open ${user?.accountType === 'individual' ? 'Personal' : 'Company'} Integrations`}
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {supportedAgents.map((agent) => (
            <div key={agent.id} className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-5 shadow-inner">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AgentBrandIcon
                    agentId={agent.id}
                    name={agent.name}
                    containerClassName="h-10 w-10 shrink-0 border border-current/10"
                    size="h-5 w-5"
                  />
                  <h3 className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{agent.name}</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded border border-[#EA803A33] bg-[#EA803A14] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#f2b07d]">
                  {agent.status}
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">{agent.summary}</p>
              <div className="rounded-lg border border-[#2a2a2a] bg-[#0c0c0c] px-3 py-2 shadow-inner">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1.5">Setup command</p>
                <code className="text-xs text-zinc-300 break-all font-mono">{agent.setup}</code>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <SaveButton saving={savingKey === 'agents'}>Save agent preferences</SaveButton>
        </div>
      </form>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10 h-full">
      <div className="rounded-xl bg-[#0d0d0d] p-6 space-y-5 h-full">
        <div className="flex flex-col gap-3 border-b border-[#1c1c1c] pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>
              Security settings
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500">Protect this account with two-factor authentication and verify how identity data is being stored.</p>
          </div>
          <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            twoFactorEnabled
              ? 'border-[#5fd1b3]/30 bg-[#5fd1b3]/10 text-[#5fd1b3]'
              : 'border-[#EA803A]/30 bg-[#EA803A]/10 text-[#f2b07d]'
          }`}>
            {twoFactorEnabled ? '2FA Enabled' : '2FA Not Enabled'}
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-5 py-4 shadow-inner">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Two-factor authentication</p>
                  <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                    Add a 6-digit authenticator check on top of your normal sign-in so account access stays protected even if a session token leaks.
                  </p>
                </div>
                {!twoFactorEnabled && !twoFactorSetup && (
                  <button
                    type="button"
                    onClick={startTwoFactorSetup}
                    disabled={securityAction === 'setup'}
                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-[#EA803A] to-[#d66a25] px-4 py-2 text-sm font-bold text-black shadow-md shadow-[#EA803A]/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    {securityAction === 'setup' ? 'Preparing...' : 'Enable 2FA'}
                  </button>
                )}
              </div>

              {twoFactorSetup && !twoFactorEnabled && (
                <form onSubmit={verifyTwoFactorSetup} className="mt-5 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="rounded-xl border border-[#2a2a2a] bg-[#111] p-3">
                      <img src={twoFactorSetup.qrCode} alt="Two-factor authentication QR code" className="h-auto w-full rounded-lg bg-white p-2" />
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 shadow-inner">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Manual setup secret</p>
                        <code className="mt-1 block break-all text-xs text-zinc-300">{twoFactorSetup.secret}</code>
                      </div>
                      <label className="block space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Authenticator code</span>
                        <input
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors"
                          inputMode="numeric"
                          placeholder="123456"
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <SaveButton saving={securityAction === 'verify'}>Verify and enable</SaveButton>
                        <button
                          type="button"
                          onClick={() => {
                            setTwoFactorSetup(null);
                            setTwoFactorCode('');
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#111] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1a1a1a]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {twoFactorEnabled && (
                <form onSubmit={disableTwoFactor} className="mt-5 space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Authenticator code to disable</span>
                    <input
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors"
                      inputMode="numeric"
                      placeholder="123456"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={securityAction === 'disable'}
                      className="inline-flex items-center justify-center rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                      {securityAction === 'disable' ? 'Disabling...' : 'Disable 2FA'}
                    </button>
                  </div>
                </form>
              )}
            </div>

        
          </div>

          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-5 shadow-inner">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Security snapshot</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-500">Signed-in email</dt>
                <dd className="text-right text-white break-all">{user?.email || 'Unknown'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-500">Workspace</dt>
                <dd className="text-right text-white">{workspace?.name || 'Not configured'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-500">Account type</dt>
                <dd className="text-right text-white capitalize">{user?.accountType || 'individual'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-500">2FA status</dt>
                <dd className={twoFactorEnabled ? 'text-[#5fd1b3]' : 'text-[#f2b07d]'}>
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  const renderApiTab = () => (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10 h-full">
      <form onSubmit={handleApiSubmit} className="rounded-xl bg-[#0d0d0d] p-6 space-y-6 h-full">
        <div>
          <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400" style={{ fontFamily: 'Syne, sans-serif' }}>
            API configuration
          </h2>
          <p className="text-sm text-zinc-500 mt-1">These preferences are stored in your user settings document and applied as your workspace defaults.</p>
        </div>

        <div className="space-y-5">
          <DropdownField
            label="Default response style"
            value={settings.api.responseStyle}
            onChange={(value) => setSettings((current) => ({
              ...current,
              api: {
                ...current.api,
                responseStyle: value
              }
            }))}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'lite', label: 'Lite' },
              { value: 'full', label: 'Full' },
              { value: 'ultra', label: 'Ultra' }
            ]}
          />

          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Webhook URL</span>
            <input
              type="url"
              value={settings.api.webhookUrl}
              onChange={(e) => setSettings((current) => ({
                ...current,
                api: {
                  ...current.api,
                  webhookUrl: e.target.value
                }
              }))}
              className="w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors"
              placeholder="https://your-app.com/webhook"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Allowed origins (one per line)</span>
            <textarea
              value={(settings.api.allowedOrigins || []).join('\n')}
              onChange={(e) => setSettings((current) => ({
                ...current,
                api: {
                  ...current.api,
                  allowedOrigins: e.target.value.split(/\r?\n/).filter(Boolean)
                }
              }))}
              className="h-28 w-full rounded-lg border border-[#2a2a2a] bg-zinc-900/50 px-4 py-2.5 text-sm text-white focus:border-[#EA803A] focus:outline-none shadow-inner transition-colors resize-none"
              placeholder="https://your-app.com"
            />
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton saving={savingKey === 'api'}>Save API settings</SaveButton>
        </div>
      </form>
    </div>
  );

  // -------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------

  if (!user || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <BlobLoader size={72} label="" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-12">
      <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
        Settings
      </h1>
      
      {(error || success) && (
        <div className={`rounded-xl border px-4 py-3 text-sm shadow-inner ${error ? 'border-red-900/40 bg-red-950/20 text-red-300' : 'border-[#5fd1b3]/30 bg-[#5fd1b3]/10 text-[#5fd1b3]'}`}>
          {error || success}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-64 flex-shrink-0">
          <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-zinc-800/50 to-zinc-900/10 h-full">
            <div className="bg-[#0d0d0d] rounded-xl p-3 h-full">
              <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex min-w-[140px] lg:min-w-0 lg:w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-b from-[#EA803A] to-[#d66a25] text-black shadow-md shadow-[#EA803A]/20'
                        : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="flex-1">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'workspace' && renderWorkspaceTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'agents' && renderAgentsTab()}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'api' && renderApiTab()}
        </div>
      </div>
    </div>
  );
}