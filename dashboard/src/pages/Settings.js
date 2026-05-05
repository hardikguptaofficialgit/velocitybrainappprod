import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import AvatarPicker from '../components/AvatarPicker';
import AgentBrandIcon from '../components/AgentBrandIcon';
import BlobLoader from '../components/BlobLoader';
import MinimalSelect from '../components/MinimalSelect';
import RoleField from '../components/RoleField';
import { Bell, Cpu, Globe, Settings as SettingsIcon, Shield, User } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { supportedAgents } from '../lib/agentRuntime';
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
    className="inline-flex min-w-[148px] items-center justify-center rounded-xl bg-[#EA803A] px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    style={{ fontFamily: 'Syne, sans-serif' }}
  >
    {saving ? 'Saving...' : children}
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

  const initials = useMemo(() => {
    const label = workspace?.name || user?.name || user?.email || 'W';
    return label.charAt(0).toUpperCase();
  }, [workspace?.name, user?.name, user?.email]);

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

  if (!user || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <BlobLoader size={72} label="" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Settings</h1>
     

      {(error || success) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-900/40 bg-red-950/20 text-red-300' : 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300'}`}>
          {error || success}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-56 flex-shrink-0">
          <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-3">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#EA803A] text-black'
                      : 'text-zinc-400 hover:bg-[#111] hover:text-white'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-5">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Profile information</h2>

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#EA803A]">
                  {profileForm.avatarUrl ? (
                    <img src={profileForm.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-medium text-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                      {(user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Profile avatar</p>
                  <p className="mt-2 text-xs text-zinc-500">Choose from our curated DiceBear set instead of uploading custom images.</p>
                </div>
              </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Full name</span>
                  <input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="John Doe"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email</span>
                  <input
                    value={user.email || ''}
                    disabled
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-zinc-500"
                  />
                </label>
                <div className="space-y-2">
                  <RoleField
                    label="Title"
                    value={profileForm.title}
                    onChange={(value) => setProfileForm((current) => ({ ...current, title: value }))}
                    selectClassName="[&_button]:rounded-lg [&_button]:border-[#2a2a2a] [&_button]:bg-[#111] [&_button]:px-3 [&_button]:py-2"
                    inputClassName="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    helperText="Choose a common title fast, or use Other for a custom one."
                  />
                </div>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Company</span>
                  <input
                    value={profileForm.company}
                    onChange={(e) => setProfileForm((current) => ({ ...current, company: e.target.value }))}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="Your company"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <SaveButton saving={savingKey === 'profile'}>Save profile</SaveButton>
              </div>
            </form>
          )}

          {activeTab === 'workspace' && (
            <form onSubmit={handleWorkspaceSubmit} className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Workspace settings</h2>
                  <p className="text-sm text-zinc-500 mt-1">Manage the shared identity and defaults tied to your workspace.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Workspace type</p>
                  <p className="mt-1 text-sm font-semibold text-white">{workspace?.type || user?.accountType || 'individual'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-[#2a2a2a] bg-[#111]">
                  {workspaceForm.imageUrl ? (
                    <img src={workspaceForm.imageUrl} alt="Workspace avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-[#f2b07d]" style={{ fontFamily: 'Syne, sans-serif' }}>{initials}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Workspace avatar</p>
                  <p className="mt-2 text-xs text-zinc-500">Use one of the curated DiceBear marks shown across onboarding and settings.</p>
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
                shape="rounded-3xl"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace name</span>
                  <input
                    value={workspaceForm.name}
                    onChange={(e) => setWorkspaceForm((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="Workspace name"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Industry</span>
                  <input
                    value={workspaceForm.industry}
                    onChange={(e) => setWorkspaceForm((current) => ({ ...current, industry: e.target.value }))}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="Developer tools, fintech..."
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Company size</span>
                  <MinimalSelect
                    value={workspaceForm.companySize}
                    onChange={(value) => setWorkspaceForm((current) => ({ ...current, companySize: value }))}
                    placeholder="Select a range"
                    options={companySizes.map((size) => ({ value: size, label: size }))}
                    className="[&_button]:rounded-lg [&_button]:border-[#2a2a2a] [&_button]:bg-[#111] [&_button]:px-3 [&_button]:py-2"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Website</span>
                  <input
                    value={workspaceForm.website}
                    onChange={(e) => setWorkspaceForm((current) => ({ ...current, website: e.target.value }))}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="https://your-company.com"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Timezone</span>
                  <MinimalSelect
                    value={workspaceForm.timezone}
                    onChange={(value) => setWorkspaceForm((current) => ({ ...current, timezone: value }))}
                    options={timezones.map((timezone) => ({ value: timezone, label: timezone }))}
                    className="[&_button]:rounded-lg [&_button]:border-[#2a2a2a] [&_button]:bg-[#111] [&_button]:px-3 [&_button]:py-2"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Primary use case</span>
                  <textarea
                    value={workspaceForm.primaryUseCase}
                    onChange={(e) => setWorkspaceForm((current) => ({ ...current, primaryUseCase: e.target.value }))}
                    className="h-24 w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="What workflows should the workspace support first?"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</span>
                  <textarea
                    value={workspaceForm.description}
                    onChange={(e) => setWorkspaceForm((current) => ({ ...current, description: e.target.value }))}
                    className="h-28 w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="A short summary of the team, products, or operating context."
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <SaveButton saving={savingKey === 'workspace'}>Save workspace</SaveButton>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <form onSubmit={handleNotificationsSubmit} className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-4">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Notification preferences</h2>

              <div className="space-y-3">
                {[
                  { key: 'emailAlerts', label: 'Email Alerts', description: 'Receive alerts about API usage and errors' },
                  { key: 'usageWarnings', label: 'Usage Warnings', description: 'Get notified when approaching rate limits' },
                  { key: 'monthlyReports', label: 'Monthly Reports', description: 'Receive monthly usage and analytics reports' },
                  { key: 'productUpdates', label: 'Product Updates', description: 'Get notified about new features and improvements' }
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between py-3 border-b border-[#202020] last:border-0">
                    <div>
                      <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.description}</p>
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
                      className="h-4 w-4 accent-[#EA803A]"
                    />
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <SaveButton saving={savingKey === 'notifications'}>Save notifications</SaveButton>
              </div>
            </form>
          )}

          {activeTab === 'agents' && (
            <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Agent integrations</h2>
                <p className="text-sm text-zinc-500 leading-7">
                  Keep one MCP memory layer behind every supported coding agent.
                </p>
              </div>

              <div className="rounded-xl border border-[#EA803A]/30 bg-[#130a02] px-4 py-3 text-sm text-zinc-300 leading-7">
                Ideal flow: prompt arrives, Velocity Brain retrieves context, the agent executes, and useful results can be written back.
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {supportedAgents.map((agent) => (
                  <div key={agent.id} className="rounded-xl border border-[#202020] bg-[#111] p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <AgentBrandIcon
                          agentId={agent.id}
                          name={agent.name}
                          containerClassName="h-9 w-9 shrink-0"
                          size="h-4 w-4"
                        />
                        <h3 className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{agent.name}</h3>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded border border-[#EA803A33] bg-[#EA803A14] px-2 py-0.5 text-[10px] text-[#f2b07d]">
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 leading-6 mb-3">{agent.summary}</p>
                    <div className="rounded-lg border border-[#2a2a2a] bg-[#0c0c0c] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1">
                        Setup command
                      </p>
                      <code className="text-xs text-zinc-300 break-all">
                        {agent.setup}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-4">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Security settings</h2>
              <div className="space-y-3">
                <div className="rounded-xl border border-[#202020] bg-[#111] px-4 py-4">
                  <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Two-factor authentication</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    The backend 2FA endpoints are available, and this workspace now preserves the account metadata needed to manage them safely.
                  </p>
                </div>
                <div className="rounded-xl border border-[#202020] bg-[#111] px-4 py-4">
                  <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Account identity</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Workspace ownership, onboarding completion, avatar URLs, and profile details are all persisted and available through the authenticated backend.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <form onSubmit={handleApiSubmit} className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-5">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>API configuration</h2>
              <p className="text-sm text-zinc-500">These preferences are stored in your user settings document and applied as your workspace defaults.</p>

              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Default response style</span>
                  <MinimalSelect
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
                    className="[&_button]:rounded-lg [&_button]:border-[#2a2a2a] [&_button]:bg-[#111] [&_button]:px-3 [&_button]:py-2"
                  />
                </label>

                <label className="space-y-2">
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
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="https://your-app.com/webhook"
                  />
                </label>

                <label className="space-y-2">
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
                    className="h-24 w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white focus:border-[#EA803A] focus:outline-none"
                    placeholder="https://your-app.com"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <SaveButton saving={savingKey === 'api'}>Save API settings</SaveButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
