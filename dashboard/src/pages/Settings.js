import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Bell, Shield, Globe } from '../components/Icons';
import BlobLoader from '../components/BlobLoader';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    usageWarnings: true,
    monthlyReports: false,
    productUpdates: true
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Settings', icon: Globe }
  ];

  const handleNotificationChange = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!user) {
    return <div className="min-h-[60vh] flex items-center justify-center">
      <BlobLoader size={72} label="" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Settings</h1>
      <div className="rounded-xl border border-[#EA803A]/30 bg-[#130a02] px-4 py-3 text-sm text-zinc-300">
        Velocity Brain is currently free for everyone for a limited time. Every workspace has access to the full product, with usage limits and policy controls still enforced.
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-56 flex-shrink-0">
          <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-3">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full ${
                    activeTab === tab.id
                      ? 'bg-[#EA803A] text-black'
                      : 'text-zinc-400 hover:text-white hover:bg-[#111]'
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
            <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-5">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Profile Information</h2>

              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-[#EA803A] rounded-full flex items-center justify-center">
                  <span className="text-black text-lg font-medium" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <button className="px-4 py-1.5 rounded-xl font-bold text-black text-xs transition-all"
                    style={{ 
                      fontFamily: 'Syne, sans-serif',
                      background: '#EA803A',
                      boxShadow: '3px 3px 0 #c4612a'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
                    onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
                  >
                    Change Avatar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.name || ''}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-[#EA803A] focus:outline-none transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email || ''}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-[#EA803A] focus:outline-none transition-colors"
                    placeholder="you@example.com"
                    disabled
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  Company (Optional)
                </label>
                <input
                  type="text"
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-[#EA803A] focus:outline-none transition-colors"
                  placeholder="Your company"
                />
              </div>

              <div className="flex justify-end">
                <button className="px-8 py-3 rounded-xl font-bold text-black text-base transition-all"
                  style={{ 
                    fontFamily: 'Syne, sans-serif',
                    background: '#EA803A',
                    boxShadow: '4px 4px 0 #c4612a'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
                  onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-4">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Notification Preferences</h2>

              <div className="space-y-3">
                {[
                  { key: 'emailAlerts', label: 'Email Alerts', description: 'Receive alerts about API usage and errors' },
                  { key: 'usageWarnings', label: 'Usage Warnings', description: 'Get notified when approaching rate limits' },
                  { key: 'monthlyReports', label: 'Monthly Reports', description: 'Receive monthly usage and analytics reports' },
                  { key: 'productUpdates', label: 'Product Updates', description: 'Get notified about new features and improvements' }
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-[#202020] last:border-0">
                    <div>
                      <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications[item.key]}
                        onChange={() => handleNotificationChange(item.key)}
                        className="sr-only"
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors ${
                        notifications[item.key] ? 'bg-[#EA803A]' : 'bg-[#2a2a2a]'
                      }`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                          notifications[item.key] ? 'translate-x-4' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-4">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Security Settings</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-[#202020] last:border-0">
                  <div>
                    <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Two-Factor Authentication</p>
                    <p className="text-xs text-zinc-500">Add an extra layer of security to your account</p>
                  </div>
                  <button className="px-6 py-2 rounded-xl font-bold text-black text-sm transition-all"
                    style={{ 
                      fontFamily: 'Syne, sans-serif',
                      background: '#EA803A',
                      boxShadow: '4px 4px 0 #c4612a'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
                    onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
                  >
                    Enable 2FA
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-[#202020] last:border-0">
                  <div>
                    <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Change Password</p>
                    <p className="text-xs text-zinc-500">Update your account password</p>
                  </div>
                  <button className="px-6 py-2 rounded-xl font-bold text-black text-sm transition-all"
                    style={{ 
                      fontFamily: 'Syne, sans-serif',
                      background: '#EA803A',
                      boxShadow: '4px 4px 0 #c4612a'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0965a'}
                    onMouseLeave={e => e.currentTarget.style.background = '#EA803A'}
                  >
                    Change
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-[#202020] last:border-0">
                  <div>
                    <p className="font-bold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Active Sessions</p>
                    <p className="text-xs text-zinc-500">Manage your active login sessions</p>
                  </div>
                  <button className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#111] text-zinc-300 text-xs font-bold hover:text-white transition-colors" style={{ fontFamily: 'Syne, sans-serif' }}>
                    View Sessions
                  </button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-bold text-red-400 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Delete Account</p>
                    <p className="text-xs text-zinc-500">Permanently delete your account and all data</p>
                  </div>
                  <button className="bg-red-900/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-900/50 text-xs font-bold hover:bg-red-900/30 transition-colors" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] p-5 space-y-5">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>API Configuration</h2>
              <p className="text-sm text-zinc-500">API access follows the same limited-time free access model as the rest of the platform. Keys get the standard usage-limited quota automatically.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Default Response Style
                  </label>
                  <select className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-[#EA803A] focus:outline-none transition-colors">
                    <option value="normal">Normal</option>
                    <option value="lite">Lite</option>
                    <option value="full">Full</option>
                    <option value="ultra">Ultra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Webhook URL (Optional)
                  </label>
                  <input
                    type="url"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-[#EA803A] focus:outline-none transition-colors"
                    placeholder="https://your-app.com/webhook"
                  />
                  <p className="text-xs text-zinc-500 mt-1.5">Receive real-time notifications about API events</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Allowed Origins (CORS)
                  </label>
                  <textarea
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-[#EA803A] focus:outline-none transition-colors h-20"
                    placeholder="*&#10;https://your-app.com&#10;"
                  />
                  <p className="text-xs text-zinc-500 mt-1.5">One origin per line. Use * for all origins.</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button className="px-4 py-2 rounded-lg bg-[#EA803A] text-sm font-bold text-black" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Save API Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
