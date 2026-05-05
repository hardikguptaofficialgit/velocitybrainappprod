import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity, ArrowRight, BarChart3, Cpu, Database, LogOut, Menu, Settings, X } from './Icons';
import Logo from './Logo';
import BlobLoader from './BlobLoader';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Agents', href: '/dashboard/agents', icon: Cpu },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Database },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: ArrowRight },
  { name: 'Usage', href: '/dashboard/usage', icon: Activity },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings }
];

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

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
        className={`fixed top-0 left-0 z-50 h-full w-56 border-r border-[#1c1c1c] bg-[#090909] transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-full flex flex-col px-3 py-4">
          <div className="flex items-center justify-between mb-6 px-2">
            <Link to="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
              <Logo size={32} className="" />
              <span className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>VelocityBrain</span>
            </Link>
            <button
              type="button"
              className="group lg:hidden w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center text-zinc-400 transition-all duration-200 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="transition-transform duration-300 ease-out group-hover:rotate-180">
                <X className="w-4 h-4" />
              </span>
            </button>
          </div>

          <nav className="space-y-1 flex-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#EA803A] text-black'
                      : 'text-zinc-400 hover:text-white hover:bg-[#111]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-[#1c1c1c]">
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-medium text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>{user.name || user.email}</p>
              <p className="text-[10px] text-zinc-500 truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-[#111] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="relative lg:pl-56">
        <header className="sticky top-0 z-30 border-b border-[#1c1c1c] bg-[#090909]">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="lg:hidden w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center text-zinc-400 hover:text-white"
                onClick={() => setSidebarOpen(true)}
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
