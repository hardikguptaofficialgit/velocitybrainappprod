import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, BarChart3, Cpu, Database, Key, LogOut, Menu, Settings, X } from './Icons';
import Logo from './Logo';
import BlobLoader from './BlobLoader';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Agents', href: '/dashboard/agents', icon: Cpu },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Database },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { name: 'Usage', href: '/dashboard/usage', icon: Activity },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings }
];

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('vb_dashboard_sidebar_collapsed') === 'true';
  });

  React.useEffect(() => {
    window.localStorage.setItem('vb_dashboard_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <BlobLoader size={64} label="" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/80 z-40 lg:hidden cursor-default backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full flex flex-col border-r border-[#1e1e1e] bg-[#0a0a0a] shadow-2xl lg:shadow-none transition-[width,transform] duration-300 ease-in-out lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-56'
        } ${sidebarOpen ? 'translate-x-0 w-56' : '-translate-x-full w-56'}`}
      >
        {/* Sidebar Header with Interactive Toggle */}
        <div className={`flex items-center h-14 border-b border-[#1e1e1e] relative group/header transition-all duration-300 ${
          sidebarCollapsed ? 'justify-center' : 'justify-between px-4'
        }`}>
          <Link 
            to="/" 
            className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ${
              sidebarCollapsed ? 'lg:group-hover/header:opacity-0 lg:group-hover/header:scale-90' : 'opacity-100'
            }`} 
            onClick={() => setSidebarOpen(false)}
          >
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8">
              <Logo size={24} />
            </div>
            <span
              className={`font-semibold text-sm tracking-wide text-white whitespace-nowrap transition-all duration-300 ${
                sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
              }`}
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              VelocityBrain
            </span>
          </Link>
          
          {/* Mobile Close Button */}
          <button
            type="button"
            className={`lg:hidden w-7 h-7 rounded bg-transparent flex items-center justify-center text-[#888] hover:text-white hover:bg-[#1e1e1e] transition-colors ${
              sidebarCollapsed ? 'hidden' : 'block'
            }`}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Desktop Toggle Button */}
          <button
            type="button"
            className={`hidden lg:flex absolute items-center justify-center rounded-md text-[#888]  ${
              sidebarCollapsed
                ? 'w-8 h-8 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/header:opacity-100 scale-75 group-hover/header:scale-100'
                : 'w-7 h-7 right-3 top-1/2 -translate-y-1/2 opacity-100'
            }`}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-hide">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center rounded-md px-2.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#EA803A] text-black shadow-[0_0_12px_rgba(234,128,58,0.15)]'
                    : 'text-[#888] hover:text-[#ededed] hover:bg-[#1a1a1a]'
                } ${sidebarCollapsed ? 'justify-center' : 'justify-start gap-3'}`}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
                <span
                  className={`whitespace-nowrap transition-all duration-300 ${
                    sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-3 border-t border-[#1e1e1e] bg-[#0a0a0a]">
          <div className={`flex items-center mb-3 px-1 transition-all duration-300 ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-md bg-[#1e1e1e] flex items-center justify-center flex-shrink-0 text-xs font-semibold text-[#ededed] border border-[#2a2a2a] shadow-sm">
              {(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className={`overflow-hidden transition-all duration-300 flex-1 ${sidebarCollapsed ? 'opacity-0 w-0 h-0' : 'opacity-100 w-auto h-auto'}`}>
              <p className="text-[13px] font-medium text-[#ededed] leading-tight truncate">
                {user.name || 'User'}
              </p>
              <p className="text-[11px] text-[#666] leading-tight truncate mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {user.email}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleLogout}
            className={`group w-full flex items-center rounded-md px-2.5 py-2 text-sm font-medium text-[#888] hover:text-[#ff4a4a] hover:bg-[#1a1a1a] transition-all duration-200 ${
              sidebarCollapsed ? 'justify-center' : 'justify-start gap-3'
            }`}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span
              className={`whitespace-nowrap transition-all duration-300 ${
                sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
              }`}
            >
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-screen transition-[padding] duration-300 ease-in-out ${
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-56'
      }`}>
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-6 border-b border-[#1e1e1e] bg-[#0a0a0a]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle */}
            <button
              type="button"
              className="lg:hidden w-8 h-8 rounded bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-[#888] hover:text-white transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Link
              to="/docs"
              className="px-4 py-1.5 rounded bg-[#1e1e1e] border border-[#2a2a2a] hover:bg-[#252525] hover:border-[#333] text-xs font-medium text-[#ededed] transition-all duration-200 shadow-sm"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              View Docs
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden p-4 lg:p-8">
          <div className="max-w-[1200px] mx-auto w-full animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;