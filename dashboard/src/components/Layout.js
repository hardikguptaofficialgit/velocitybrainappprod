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
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <BlobLoader size={76} label="" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full border-r border-[#1c1c1c] bg-[#090909] transform transition-[width,transform] duration-300 ease-out lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-56'
        } ${sidebarOpen ? 'translate-x-0 w-56' : '-translate-x-full w-56'}`}
      >
        <div className="h-full flex flex-col px-3 py-4">
          <div className="flex items-center justify-between mb-6 px-2">
            <Link to="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
              <Logo size={32} className="" />
              <span
                className={`text-white font-bold text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${
                  sidebarCollapsed ? 'hidden lg:block lg:w-0 lg:opacity-0' : 'opacity-100'
                }`}
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                VelocityBrain
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hidden lg:flex w-8 h-8 rounded-lg bg-[#111] items-center justify-center text-zinc-400 transition-all duration-200 hover:bg-[#181818] hover:text-white"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Menu className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
              <button
                type="button"
                className="group lg:hidden w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center text-zinc-400 transition-all duration-200 hover:text-white"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <span className="transition-transform duration-300 ease-out group-hover:rotate-180">
                  <X className="w-4 h-4" />
                </span>
              </button>
            </div>
          </div>

          <nav className="space-y-1 flex-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#EA803A] text-black'
                      : 'text-zinc-400 hover:text-white hover:bg-[#111]'
                  } ${sidebarCollapsed ? 'justify-center lg:px-0' : 'gap-3'}`}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span
                    className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
                      sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'opacity-100'
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-[#1c1c1c]">
            <div className={`px-3 py-2 mb-2 transition-all duration-200 ${sidebarCollapsed ? 'lg:px-0' : ''}`}>
              <p
                className={`text-xs font-medium text-white truncate transition-all duration-200 ${
                  sidebarCollapsed ? 'lg:text-center' : ''
                }`}
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {sidebarCollapsed ? (user.name || user.email || 'U').slice(0, 1).toUpperCase() : (user.name || user.email)}
              </p>
              <p
                className={`text-[10px] text-zinc-500 truncate transition-all duration-200 ${
                  sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'opacity-100'
                }`}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className={`w-full flex items-center rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-[#111] transition-all duration-200 ${
                sidebarCollapsed ? 'justify-center lg:px-0' : 'gap-3'
              }`}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-4 h-4" />
              <span
                className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
                  sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'opacity-100'
                }`}
              >
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className={`relative transition-[padding] duration-300 ease-out ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-56'}`}>
        <header className="sticky top-0 z-30 border-b border-[#1c1c1c] bg-[#090909]">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="lg:hidden w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center text-zinc-400 hover:text-white"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/docs"
                className="px-3 py-1.5 rounded-lg bg-[#EA803A] text-xs font-bold text-black"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                View Docs
              </Link>
            </div>
          </div>
        </header>

        <main className="px-6 py-6">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
