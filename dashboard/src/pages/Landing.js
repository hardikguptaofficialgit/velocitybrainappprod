import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Dialog from '../components/ui/Dialog';
import AgentBrandIcon from '../components/AgentBrandIcon';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight,
  Database,
  Github as GithubBrand,
  Lightning,
  List,
  ShieldCheck,
  X,
} from '../components/Icons';
import { supportedAgents } from '../lib/agentRuntime';

const Fade = ({ children, delay = 0, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );

    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const Clay = ({ children, className = '', accent = false }) => (
  <div
    className={`rounded-2xl border ${
      accent
        ? 'border-[#EA803A]/25 bg-[#160b03]'
        : 'border-[#232323] bg-[#0e0e0e]'
    } ${className}`}
    style={{ boxShadow: accent ? '3px 3px 0 rgba(234,128,58,0.06)' : '3px 3px 0 rgba(0,0,0,0.2)' }}
  >
    {children}
  </div>
);

const TL = ({ children, color = 'text-zinc-400' }) => (
  <p className={`${color} text-[11px] md:text-xs leading-relaxed`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
    {children}
  </p>
);

const launchTargets = [
  {
    name: 'ChatGPT',
    icon: 'https://svgl.app/library/openai_dark.svg',
    description: 'A future surface for bringing the Company Brain into the chat tools people already use every day.',
  },
  {
    name: 'Claude',
    icon: 'https://svgl.app/library/claude-ai-icon.svg',
    description: 'A future connector surface so long-running conversations can reuse the right context instead of drifting across sessions.',
  },
];

const launchUseCases = [
  {
    title: 'User A logs calories today',
    description: 'For example, User A logs breakfast and dinner into ChatGPT or Claude today, but later the assistant forgets those entries were for today, mixes the date, or loses the running total.',
  },
  {
    title: 'Daily workflows reset too often',
    description: 'Meal tracking, task follow-ups, habits, notes, and recurring routines often fall apart because the assistant does not keep clean structured memory across sessions.',
  },
  {
    title: 'Thousands of use cases have the same problem',
    description: 'The same pattern shows up in thousands of everyday use cases: health logs, study notes, project memory, personal preferences, follow-ups, plans, and anything else that needs reliable continuity.',
  },
];

const timelinePhases = [
  {
    phase: 'Shipping now',
    date: 'Live product',
    title: 'Company Brain for teams',
    description: 'Velocity Brain now ships as a hosted company brain that connects work sources, coding agents, and team memory into one reusable layer.',
    items: ['Company Brain', 'OAuth integrations', 'MCP agents', 'API keys'],
  },
  {
    phase: 'Expanding now',
    date: 'Current build',
    title: 'More source systems and agent surfaces',
    description: 'The current stack is wired for source sync, hosted APIs, dashboard onboarding, and reusable context across serious AI workflows.',
    items: ['Slack', 'Google Workspace', 'GitHub', 'Integrations dashboard'],
  },
  {
    phase: 'Longer-term roadmap',
    date: 'Exploration',
    title: 'A broader company brain layer',
    description: 'Long term, Velocity Brain can expand from coding workflows into shared operating memory for teams and eventually wider AI automation.',
    items: ['Team memory', 'Workflow continuity', 'Safer execution context', 'Company brain'],
  },
];

const proofPoints = [
  {
    Icon: Database,
    title: 'Company context in one place',
    description: 'Pull workspace facts, repo history, decisions, and integration events into one shared brain layer.',
  },
  {
    Icon: Lightning,
    title: 'Agents start ahead',
    description: 'Codex, Claude Code, Gemini CLI, Cursor, Warp, and other MCP clients can reuse the same context.',
  },
  {
    Icon: ShieldCheck,
    title: 'OAuth-ready control plane',
    description: 'Google, GitHub, and source integrations route through the hosted backend instead of scattered local config.',
  },
];

const JiraBrand = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
  >
    <path
      fill="#2684FF"
      d="M12.04 2.1 21.9 12l-9.86 9.9-3.74-3.75L14.4 12 8.3 5.85l3.74-3.75Z"
    />
    <path
      fill="#0052CC"
      d="M12.04 2.1 8.3 5.85 4.58 9.6 2.1 12l2.48 2.4 3.72 3.75L12.04 21.9 5.92 12l6.12-9.9Z"
    />
    <path
      fill="#4C9AFF"
      d="M8.3 5.85 14.4 12l-6.1 6.15L4.58 14.4 7 12 4.58 9.6 8.3 5.85Z"
    />
  </svg>
);

const companyBrainSources = [
  {
    name: 'Slack',
    detail: 'team messages and channels',
    icon: 'https://svgl.app/library/slack.svg',
  },
  {
    name: 'Google Workspace',
    detail: 'mail, docs, calendar context',
    icon: 'https://svgl.app/library/google.svg',
  },
  {
    name: 'GitHub',
    detail: 'repos, issues, commits, pull requests',
    Icon: GithubBrand,
  },
  {
    name: 'Notion',
    detail: 'docs, decisions, operating notes',
    icon: 'https://svgl.app/library/notion.svg',
  },
  {
    name: 'Linear',
    detail: 'roadmaps, tickets, product loops',
    icon: 'https://svgl.app/library/linear.svg',
  },
  {
    name: 'Jira',
    detail: 'delivery plans and issue history',
    Icon: JiraBrand,
  },
  {
    name: 'Figma',
    detail: 'design context and product surfaces',
    icon: 'https://svgl.app/library/figma.svg',
  },
  {
    name: 'Discord',
    detail: 'community and support memory',
    icon: 'https://svgl.app/library/discord.svg',
  },
  {
    name: 'Dropbox',
    detail: 'files, folders, shared artifacts',
    icon: 'https://svgl.app/library/dropbox.svg',
  },
];

const integrationCardThemes = {
  'claude-code': {
    badge: 'border-[#9b6bff22] bg-[#9b6bff0f] text-[#ceb8ff]',
    setup: 'bg-[#0d0b14] border-[#2a203f]',
    keyword: 'text-[#b794ff]',
    hexColor: '#9b6bff',
  },
  codex: {
    badge: 'border-[#EA803A22] bg-[#EA803A12] text-[#f2b07d]',
    setup: 'bg-[#120d09] border-[#3a2618]',
    keyword: 'text-[#f2b07d]',
    hexColor: '#EA803A',
  },
  hermes: {
    badge: 'border-[#40c4aa22] bg-[#40c4aa12] text-[#98f0dc]',
    setup: 'bg-[#091311] border-[#1a3a34]',
    keyword: 'text-[#7fe3c8]',
    hexColor: '#40c4aa',
  },
  'gemini-cli': {
    badge: 'border-[#5d89ff22] bg-[#5d89ff10] text-[#bdd0ff]',
    setup: 'bg-[#09101a] border-[#1c2d47]',
    keyword: 'text-[#9cb8ff]',
    hexColor: '#5d89ff',
  },
};

const howItWorks = [
  {
    step: '01',
    title: 'Connect company sources',
    description: 'Bring Google Workspace, GitHub, Slack, Notion, Linear, Jira, Figma, Discord, and Dropbox into one brain.',
  },
  {
    step: '02',
    title: 'Normalize team memory',
    description: 'Velocity Brain turns scattered source events into reusable context for dashboards, APIs, and agents.',
  },
  {
    step: '03',
    title: 'Reuse across agents',
    description: 'Every run can start with the right company context instead of rebuilding the same prompt by hand.',
  },
];

const announcementLayers = [
  {
    id: 'company-brain',
    eyebrow: 'Launched',
    title: 'Company Brain is live with source integrations and hosted APIs.',
    cta: 'Open page',
    href: '/company-brain',
    accent: '#EA803A',
  },
  {
    id: 'launch',
    eyebrow: 'Live stack',
    title: 'Connect the tools your company already works inside.',
    cta: 'Launch notes',
    onClick: 'launch',
    accent: '#EA803A',
  },
  {
    id: 'unique',
    eyebrow: 'Why unique',
    title: 'Why we are unique from current agents: one shared brain layer across tools, tasks, and workflows.',
    cta: 'Read comparison',
    href: '/research/why-velocitybrain-is-different',
    accent: '#7fe3c8',
  },
  {
    id: 'workflow',
    eyebrow: 'How it works',
    title: 'Memory runs before generation, reuse happens before waste, and each new session starts ahead.',
    cta: 'Docs',
    href: '/docs',
    accent: '#5d89ff',
  },
];

const comparisonHighlights = [
  {
    name: 'Mem0',
    focus: 'Memory API and retrieval',
    difference: 'Velocity Brain adds timing, reuse, and workflow continuity so memory shows up when it matters, not only when asked.',
    accent: '#EA803A',
  },
  {
    name: 'Zep',
    focus: 'Long-term memory',
    difference: 'Velocity Brain is built around memory plus workflow timing, so the right context shows up before action instead of only sitting in storage.',
    accent: '#5d89ff',
  },
  {
    name: 'Letta',
    focus: 'Stateful agent runtime',
    difference: 'Velocity Brain acts as a shared brain layer across many assistants and tools instead of asking teams to consolidate around one agent runtime.',
    accent: '#f2b07d',
  },
  {
    name: 'Hyperspell',
    focus: 'Workplace memory across tools',
    difference: 'Velocity Brain stays closer to live agent execution, repo work, and recurring user state like today, this task, and this handoff.',
    accent: '#7fe3c8',
  },
  {
    name: 'Hermes',
    focus: 'One autonomous agent with memory',
    difference: 'Velocity Brain is built as a shared brain layer that can sit behind many agents instead of forcing one new default agent.',
    accent: '#5d89ff',
  },
];

const researchFeature = {
  href: '/research/why-velocitybrain-is-different',
  category: 'Comparison',
  title: 'Why Velocity Brain is different from today’s memory and agent products',
  summary:
    'A deeper look at why we position Velocity Brain as a shared memory and reuse layer instead of only a memory API, one agent, or a thin retrieval add-on.',
  displayTitle: "Why Velocity Brain is different from today's memory and agent products",
  readTime: '5 min read',
  points: ['Memory plus timing', 'Shared across agents', 'Less repeated context spend'],
};

const simplifiedAgents = supportedAgents.slice(0, 4);

export default function Landing() {
  const { user, loading } = useAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [HillsComponent, setHillsComponent] = useState(null);
  const [copiedSetup, setCopiedSetup] = useState('');
  const [activeAnnouncement, setActiveAnnouncement] = useState(0);
  const accountHref = user ? (user.onboardingCompleted ? '/dashboard' : '/onboarding') : '/login';
  const accountLabel = loading ? 'Checking...' : user ? (user.onboardingCompleted ? 'Dashboard' : 'Continue Setup') : 'Sign In';
  const primaryCtaLabel = loading ? 'Loading...' : user ? (user.onboardingCompleted ? 'Open Dashboard' : 'Continue Setup') : 'Open Company Brain';
  const footerCtaLabel = loading ? 'Loading...' : user ? (user.onboardingCompleted ? 'Open Dashboard' : 'Continue Setup') : 'Start Company Brain';

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.innerWidth < 768) return undefined;

    let cancelled = false;
    const loadHills = () => {
      import('../components/ui/glsl-hills')
        .then((module) => {
          if (!cancelled) {
            setHillsComponent(() => module.GLSLHills);
          }
        })
        .catch(() => {});
    };

    const idleHandle = window.requestIdleCallback
      ? window.requestIdleCallback(loadHills, { timeout: 1200 })
      : window.setTimeout(loadHills, 250);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle);
      } else {
        window.clearTimeout(idleHandle);
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveAnnouncement((current) => (current + 1) % announcementLayers.length);
    }, 3600);

    return () => window.clearInterval(intervalId);
  }, []);

  const copySetupCommand = async (agentId, command) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedSetup(agentId);
      window.setTimeout(() => setCopiedSetup(''), 1400);
    } catch (_error) {
      setCopiedSetup('');
    }
  };

  const handleAnnouncementAction = (announcement) => {
    if (announcement.onClick === 'launch') {
      setLaunchModalOpen(true);
      return;
    }
    if (announcement.onClick === 'timeline') {
      setTimelineModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');
        ::selection{background:#EA803A;color:#000}
        .px-font{font-family:'Press Start 2P',cursive}
        .syne{font-family:'Syne',sans-serif}
        .mono{font-family:'JetBrains Mono',monospace}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:#0a0a0a}
        ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:6px}
        .announcement-card {
          will-change: transform, opacity;
        }
        @keyframes announcement-progress {
          from { transform: scaleX(0); opacity: 0.55; }
          to { transform: scaleX(1); opacity: 1; }
        }
      `}</style>

      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-4 md:px-5">
        <div
          className="w-full transition-all duration-400"
          style={{
            maxWidth: navScrolled ? 800 : 960,
            background: navScrolled ? 'rgba(8,8,8,0.92)' : 'transparent',
            backdropFilter: navScrolled ? 'blur(12px)' : 'none',
            borderRadius: navScrolled ? 14 : 0,
            border: navScrolled ? '1px solid #1f1f1f' : '1px solid transparent',
            boxShadow: navScrolled ? '2px 2px 0 rgba(0,0,0,0.2)' : 'none',
            padding: navScrolled ? '8px 16px' : '0 16px',
          }}
        >
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <img src="/logo.png" alt="Velocity Brain" className="w-6 h-6 rounded flex-shrink-0" />
              <span className="px-font text-white hidden sm:block" style={{ fontSize: 10 }}>
                Velocity Brain
              </span>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link to="/docs" className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors">
                Docs
              </Link>
              <Link to="/research" className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors">
                Research
              </Link>
              <Link to="/company-brain" className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors">
                Company Brain
              </Link>
              <button
                type="button"
                onClick={() => setTimelineModalOpen(true)}
                className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Timeline
              </button>
              <a
                href="https://github.com/hardikguptaofficialgit/velocitybrainos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <GithubBrand width={13} height={13} />
                <span>GitHub</span>
              
              </a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {!user && (
                <Link to={accountHref} className="text-[12px] font-medium text-zinc-400 hover:text-white transition-colors">
                  {accountLabel}
                </Link>
              )}
              <Link
                to={accountHref}
                className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-black"
                style={{ background: '#EA803A', boxShadow: '2px 2px 0 #c4612a' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0965a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#EA803A')}
              >
                {primaryCtaLabel}
              </Link>
            </div>

            <button
              className="group md:hidden flex items-center justify-center w-8 h-8 rounded border border-[#333] bg-[#111]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <span className="transition-transform duration-300 ease-out group-hover:rotate-180">
                  <X size={16} weight="duotone" color="#ffffff" />
                </span>
              ) : (
                <List size={16} weight="duotone" color="#ffffff" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="md:hidden absolute top-full left-0 right-0 mt-2 mx-4 p-4 rounded-xl border border-[#222] bg-[#0a0a0a] backdrop-blur-xl"
            style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.2)' }}
          >
            <div className="flex flex-col gap-2.5">
              <Link
                to="/docs"
                className="text-[13px] font-medium text-zinc-400 hover:text-white transition-colors py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </Link>
              <Link
                to="/research"
                className="text-[13px] font-medium text-zinc-400 hover:text-white transition-colors py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Research
              </Link>
              <Link
                to="/company-brain"
                className="text-[13px] font-medium text-zinc-400 hover:text-white transition-colors py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Company Brain
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setTimelineModalOpen(true);
                }}
                className="text-left text-[13px] font-medium text-zinc-400 hover:text-white transition-colors py-1"
              >
                Timeline
              </button>
              <a
                href="https://github.com/hardikguptaofficialgit/velocitybrainos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[13px] font-medium text-zinc-400 hover:text-white transition-colors py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                <GithubBrand width={14} height={14} />
                <span>GitHub</span>
              </a>
              <div className="h-px bg-[#222] my-1" />
              {!user && (
                <Link
                  to={accountHref}
                  className="text-[13px] font-medium text-zinc-400 hover:text-white transition-colors py-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {accountLabel}
                </Link>
              )}
              <Link
                to={accountHref}
                className="w-full px-4 py-2 rounded-lg text-[13px] font-bold text-black text-center mt-1"
                style={{ background: '#EA803A', boxShadow: '2px 2px 0 #c4612a' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {primaryCtaLabel}
              </Link>
            </div>
          </div>
        )}
      </nav>

      <Dialog
        isOpen={launchModalOpen}
        onClose={() => setLaunchModalOpen(false)}
        eyebrow="Expansion"
        title={
          <>
            Company Brain is live.
            <br />
            Chat surfaces come next.
          </>
        }
        maxWidth="max-w-xl"
        footer={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link
              to="/docs"
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-[13px] font-bold text-black text-center syne"
              style={{ background: '#EA803A', boxShadow: '2px 2px 0 #c4612a' }}
            >
              Explore Docs
            </Link>
            <button
              type="button"
              onClick={() => setLaunchModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-[13px] font-bold text-zinc-300 border border-[#2a2a2a] bg-[#121212] text-center syne"
            >
              Close
            </button>
          </div>
        }
      >
        <p className="text-zinc-400 text-[13px] leading-relaxed mb-5">
          Velocity Brain is live today as a Company Brain for connected team sources, hosted APIs, and MCP agents. ChatGPT and Claude surfaces are the next expansion path for the same reusable memory layer.
          The same thing happens again and again: you log something, update something, or explain something today, and the assistant later forgets the date, loses the structure, or makes you repeat yourself.
        </p>

        <div className="rounded-xl border border-[#EA803A]/20 bg-[#160c04] p-3.5 mb-5">
          <h4 className="syne text-sm font-bold text-white mb-2">What Velocity Brain fixes</h4>
          <div className="space-y-2">
            {launchUseCases.map((item) => (
              <div key={item.title} className="rounded-lg border border-[#2a1b12] bg-[#0f0a07] px-3 py-2">
                <p className="text-[12px] font-bold text-white mb-0.5">{item.title}</p>
                <p className="text-[12px] leading-relaxed text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {launchTargets.map((target) => (
            <div key={target.name} className="rounded-xl border border-[#232323] bg-[#101010] p-3.5">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2d2d2d] bg-[#181818]">
                  <img src={target.icon} alt={`${target.name} logo`} className="h-4 w-4 object-contain" />
                </div>
                <div>
                  <p className="mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">Expansion</p>
                  <h4 className="syne text-sm font-bold text-white">{target.name}</h4>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-zinc-400">{target.description}</p>
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog
        isOpen={timelineModalOpen}
        onClose={() => setTimelineModalOpen(false)}
        eyebrow="Roadmap"
        title="The roadmap for Velocity Brain"
        maxWidth="max-w-xl"
        footer={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <a
              href="/docs"
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-[13px] font-bold text-black text-center syne"
              style={{ background: '#EA803A', boxShadow: '2px 2px 0 #c4612a' }}
            >
              Read the docs
            </a>
            <button
              type="button"
              onClick={() => setTimelineModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-[13px] font-bold text-zinc-300 border border-[#2a2a2a] bg-[#121212] text-center syne"
            >
              Close
            </button>
          </div>
        }
      >
        <p className="text-zinc-400 text-[13px] leading-relaxed mb-5">
          Velocity Brain now ships as a Company Brain for teams: hosted APIs, source integrations, OAuth sign-in, and MCP-ready agent memory. The roadmap keeps expanding from this live foundation.
        </p>

        <div className="space-y-3">
          {timelinePhases.map((phase) => (
            <div key={`${phase.phase}-${phase.title}`} className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3 rounded-xl border border-[#232323] bg-[#101010] p-3.5">
              <div>
                <div className="inline-flex rounded-full border border-[#EA803A]/30 bg-[#EA803A]/10 px-2 py-0.5 mono text-[8px] uppercase tracking-[0.2em] text-[#f2b07d]">
                  {phase.phase}
                </div>
                <p className="mono mt-1.5 text-[10px] text-zinc-500">
                  {phase.date}
                </p>
              </div>
              <div>
                <h4 className="syne text-base font-bold text-white mb-1">{phase.title}</h4>
                <p className="text-[12px] leading-relaxed text-zinc-400 mb-2.5">{phase.description}</p>
                <div className="flex flex-wrap gap-1">
                  {phase.items.map((item) => (
                    <div key={item} className="rounded-md border border-[#1f1f1f] bg-[#0b0b0b] px-2 py-0.5 text-[10px] text-zinc-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Dialog>

      <section className="relative min-h-[70vh] flex flex-col items-center justify-start overflow-hidden pt-20 md:pt-28 pb-0">
        <div className="absolute inset-0 z-0">
          {HillsComponent ? (
            <HillsComponent width="100%" height="100%" cameraZ={125} planeSize={256} speed={0.35} floatingLogoSrc="/logo.png" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  'radial-gradient(circle at 20% 20%, rgba(234,128,58,0.12), transparent 35%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.04), transparent 28%), linear-gradient(180deg, #0d0d0d 0%, #080808 70%)',
              }}
            />
          )}
        </div>

        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, rgba(8,8,8,0.92) 100%)',
          }}
        />

        <div
          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-0"
          style={{ background: 'linear-gradient(transparent,#080808)' }}
        />

        <div className="relative z-10 max-w-2xl mx-auto px-4 text-center w-full mb-10">
        <Fade delay={60}>
  <div className="mx-auto mb-3 max-w-xl">
    <div className="relative h-[34px] overflow-hidden rounded-full border border-white/10 bg-[rgba(10,10,10,0.78)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {announcementLayers.map((announcement, index) => {
        const isActive = index === activeAnnouncement;

        const cardInner = (
          <div
            className="announcement-card absolute inset-0 flex items-center justify-between gap-3 px-3"
            style={{
              zIndex: isActive ? 2 : 1,
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? 'auto' : 'none',
              transform: isActive ? 'translateY(0)' : 'translateY(9px)',
              transition: 'opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.015), rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
            }}
          >
            <div
              className="absolute inset-x-0 bottom-0 h-px origin-left"
              style={{
                background: `linear-gradient(90deg, ${announcement.accent}, transparent)`,
                animation: isActive ? 'announcement-progress 3600ms linear' : 'none',
              }}
            />

            <div className="flex min-w-0 items-center gap-2">
              <span
                className="shrink-0 rounded-full border px-1.5 py-[1px] text-[7px] uppercase tracking-[0.18em]"
                style={{
                  color: announcement.accent,
                  borderColor: `${announcement.accent}30`,
                  background: `${announcement.accent}10`,
                }}
              >
                {announcement.eyebrow}
              </span>

              <p className="truncate text-[10px] text-zinc-200">
                {announcement.title}
              </p>
            </div>

            <div className="flex h-4 w-4 shrink-0 items-center justify-center text-white/75">
              <ArrowRight size={9} stroke="currentColor" />
            </div>
          </div>
        );

        if (!isActive) return <div key={announcement.id}>{cardInner}</div>;

        if (announcement.href) {
          return (
            <a key={announcement.id} href={announcement.href} className="absolute inset-0">
              {cardInner}
            </a>
          );
        }

        return (
          <button
            key={announcement.id}
            onClick={() => handleAnnouncementAction(announcement)}
            className="absolute inset-0 w-full"
          >
            {cardInner}
          </button>
        );
      })}
    </div>
  </div>
</Fade>
          <Fade delay={120}>
            <h1 className="syne font-extrabold leading-[0.95] tracking-[-0.03em] mb-3 text-4xl sm:text-5xl md:text-6xl">
              Company Brain
              <br />
              <span
                className="inline-block text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(180deg, #ffb06e 0%, #EA803A 42%, #d96522 100%), repeating-linear-gradient(135deg, rgba(0,0,0,0.34) 0 2px, transparent 2px 12px), repeating-linear-gradient(45deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 18px)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '2px 2px 0 rgba(0,0,0,0.28)',
                }}
              >
                just launched.
              </span>
            </h1>
          </Fade>

          <Fade delay={180}>
            <p className="mx-auto mb-5 max-w-xl text-[13px] md:text-base leading-relaxed text-zinc-300">
              Connect Google Workspace, GitHub, Slack, Notion, Linear, Jira, Figma, Discord, Dropbox, and your AI agents into one reusable operating memory for the company.
            </p>
          </Fade>

          <Fade delay={240}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mb-5">
              <a
                href={accountHref}
                className="w-full sm:w-auto px-5 py-2 rounded-xl font-bold text-black text-[13px] flex items-center justify-center gap-1.5 syne"
                style={{ background: '#EA803A', boxShadow: '2px 2px 0 #c4612a' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0965a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#EA803A')}
              >
                Open Company Brain <ArrowRight size={14} stroke="#000000" />
              </a>

              <a
                href="/company-brain"
                className="w-full sm:w-auto px-5 py-2 rounded-xl font-bold text-zinc-300 text-[13px] flex items-center justify-center gap-1.5 border border-[#333] bg-[#111] syne"
                style={{ boxShadow: '2px 2px 0 #000' }}
              >
                <ArrowRight size={14} stroke="#ffffff" /> See the system
              </a>
            </div>
          </Fade>

          <Fade delay={300}>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] md:text-[11px] mono text-zinc-500 mb-6">
              <span className="rounded-full border border-[#2a2a2a] bg-[#0d0d0d]/80 px-2 py-0.5">CLI-first</span>
              <span className="rounded-full border border-[#2a2a2a] bg-[#0d0d0d]/80 px-2 py-0.5">MCP-native</span>
              <span className="rounded-full border border-[#2a2a2a] bg-[#0d0d0d]/80 px-2 py-0.5">OAuth integrations</span>
              <span className="rounded-full border border-[#2a2a2a] bg-[#0d0d0d]/80 px-2 py-0.5">Hosted API</span>
            </div>
          </Fade>

          <Fade delay={360}>
            <Clay className="max-w-lg mx-auto overflow-hidden text-left rounded-xl">
              <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#2a2a2a] bg-[#111]">
                {['#FF5F56', '#FFBD2E', '#27C93F'].map((c) => (
                  <div key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />
                ))}
                <span className="mono text-[10px] text-zinc-500 ml-1.5">Velocity Brain</span>
              </div>

              <div className="p-3 bg-[#0a0a0a] space-y-1">
                <TL color="text-zinc-300">$ velocitybrain company-brain sync --sources all</TL>
                <TL color="text-[#EA803A]">Connected Google Workspace, GitHub, Slack, Notion</TL>
                <TL color="text-zinc-500">Added Linear, Jira, Figma, Discord, Dropbox context</TL>
                <TL color="text-green-400">Company Brain ready for dashboard, API, and agents</TL>
              </div>
            </Clay>
          </Fade>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {proofPoints.map((item, index) => (
            <Fade key={item.title} delay={index * 60}>
              <Clay className="p-4 h-full rounded-[16px]">
               
                <h3 className="syne text-base font-bold text-white mb-1.5">{item.title}</h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">{item.description}</p>
              </Clay>
            </Fade>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-12">
        <Fade>
          <Clay accent className="overflow-hidden rounded-[20px]">
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-[#2a2a2a]">
                <p className="mono text-[#EA803A] text-[10px] uppercase tracking-widest mb-2">Company Brain launched</p>
                <h2 className="syne font-bold text-white text-2xl md:text-3xl mb-3">
                  One hosted brain for the tools your team already trusts.
                </h2>
                <p className="text-zinc-300 text-[13px] md:text-sm leading-relaxed mb-5">
                  Velocity Brain is no longer just an agent memory layer. It is a control plane for company context: source integrations, hosted API keys, OAuth login, and reusable memory for AI work.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['9+', 'sources'],
                    ['11', 'agents'],
                    ['24/7', 'hosted'],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-xl border border-[#2a2a2a] bg-[#0b0b0b] p-3 text-center">
                      <p className="syne text-xl font-extrabold text-white">{value}</p>
                      <p className="mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 md:p-6 bg-[#090909]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {companyBrainSources.map((source) => (
                    <div key={source.name} className="group rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] p-3 transition-colors hover:border-[#333] hover:bg-[#111]">
                      <div className="mb-2 flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#262626] bg-[#151515]">
                          {source.Icon ? (
                            <source.Icon className={source.name === 'GitHub' ? 'h-5 w-5 text-white' : 'h-5 w-5'} />
                          ) : (
                            <img
                              src={source.icon}
                              alt={`${source.name} logo`}
                              className="h-4.5 w-4.5 max-h-5 max-w-5 object-contain"
                              loading="lazy"
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="syne text-sm font-bold text-white">{source.name}</p>
                          <p className="text-[12px] leading-relaxed text-zinc-400">{source.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Clay>
        </Fade>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-12">
        <Fade>
          <Clay accent className="overflow-hidden rounded-[20px]">
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-[#2a2a2a]">
                <p className="mono text-[#EA803A] text-[10px] uppercase tracking-widest mb-2">Why we're unique</p>
                <h2 className="syne font-bold text-white text-xl md:text-2xl mb-3">
                  We are not just another memory wrapper.
                </h2>
                <p className="text-zinc-300 text-[13px] md:text-sm leading-relaxed mb-5">
                  Mem0, Zep, Letta, Hyperspell, and Hermes each solve part of the continuity problem. Velocity Brain is being built as the layer that sits behind the workflow, decides when memory should run, and keeps reuse practical across many agents.
                </p>
                <div className="space-y-2.5">
                  {comparisonHighlights.map((item) => (
                    <div key={item.name} className="rounded-xl border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="syne text-sm font-bold text-white">{item.name}</p>
                        <span
                          className="mono rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]"
                          style={{ color: item.accent, borderColor: `${item.accent}35`, background: `${item.accent}12` }}
                        >
                          {item.focus}
                        </span>
                      </div>
                      <p className="text-[12px] leading-relaxed text-zinc-400">{item.difference}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 md:p-6 bg-[#090909]">
                <p className="mono text-[#7fe3c8] text-[10px] uppercase tracking-widest mb-2">Research blog</p>
                <div className="rounded-[18px] border border-[#1f1f1f] bg-[linear-gradient(180deg,#111,#0a0a0a)] p-5 flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex w-fit rounded-full border border-[#7fe3c8]/30 bg-[#7fe3c8]/10 px-2.5 py-1 mono text-[9px] uppercase tracking-[0.18em] text-[#9debd9]">
                      {researchFeature.category}
                    </span>
                    <span className="mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      {researchFeature.readTime}
                    </span>
                  </div>
                  <div>
                    <h3 className="syne text-xl font-bold text-white mb-3 max-w-[13ch] md:max-w-[16ch]">
                      {researchFeature.displayTitle || researchFeature.title}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-zinc-400">
                      {researchFeature.summary}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#1b3b34] bg-[linear-gradient(180deg,rgba(127,227,200,0.08),rgba(8,15,13,0.85))] p-4">
                    <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#7fe3c8] mb-3">
                      What the piece covers
                    </p>
                    <div className="space-y-2.5">
                      {researchFeature.points.map((point) => (
                        <div key={point} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                          <span className="h-2 w-2 rounded-full bg-[#7fe3c8]" />
                          <span className="text-[12px] text-zinc-200">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <a
                    href={researchFeature.href}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#7fe3c8]/30 bg-[#7fe3c8]/10 px-4 py-2.5 text-[13px] font-bold text-[#baf4e7] transition-colors hover:bg-[#7fe3c8]/15"
                  >
                    Read the full comparison <ArrowRight size={14} stroke="currentColor" />
                  </a>
                </div>
              </div>
            </div>
          </Clay>
        </Fade>
      </section>

      <section className="py-12 border-y border-[#1a1a1a]" style={{ background: '#050505' }}>
        <div className="max-w-5xl mx-auto px-4">
          <Fade>
            <div className="text-center mb-8">
              <p className="mono text-[#EA803A] text-[10px] uppercase tracking-widest mb-1.5">How it works</p>
              <h2 className="syne font-bold text-white text-xl md:text-2xl">
                A simpler brain layer for AI work
              </h2>
              <p className="text-zinc-500 text-[13px] md:text-sm mt-2 max-w-lg mx-auto">
                Connect the AI, retrieve context first, then reuse what has already been learned instead of starting from zero every time.
              </p>
            </div>
          </Fade>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {howItWorks.map((item, index) => (
              <Fade key={item.step} delay={index * 70}>
                <Clay accent className="p-5 h-full rounded-[16px]">
                  <div className="w-8 h-8 rounded-lg bg-[#EA803A] text-black mono text-[11px] font-bold flex items-center justify-center mb-3">
                    {item.step}
                  </div>
                  <h3 className="syne text-base font-bold text-white mb-1.5">{item.title}</h3>
                  <p className="text-[13px] text-zinc-300 leading-relaxed">{item.description}</p>
                </Clay>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-12">
        <Fade>
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 items-start">
            <Clay className="p-5 md:p-6 rounded-[16px]">
              <p className="mono text-[#EA803A] text-[10px] uppercase tracking-widest mb-1.5">Why teams use it</p>
              <h2 className="syne font-bold text-white text-xl md:text-2xl mb-3">
                Built for teams already using AI seriously
              </h2>
              <p className="text-zinc-400 text-[13px] md:text-sm leading-relaxed mb-5">
                The problem is not just model quality. The problem is that every run starts too close to zero.
                Velocity Brain gives teams a shared brain layer so their agents and assistants can start with prior knowledge instead of rebuilding it from scratch.
              </p>
              <div className="space-y-2.5">
                {[
                  'Clearer handoffs across sessions and teammates',
                  'Smaller prompts and less repeated setup work',
                  'More consistent answers from the same codebase',
                  'A better path from experimentation to production use',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] px-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#EA803A] mt-1.5 flex-shrink-0" />
                    <p className="text-[12px] text-zinc-300">{item}</p>
                  </div>
                ))}
              </div>
            </Clay>

            <Clay className="overflow-hidden rounded-[16px]">
              <div className="px-3 py-2.5 border-b border-[#2a2a2a] bg-[#111]">
                <p className="mono text-[10px] text-zinc-400">Quick setup</p>
              </div>
              <div className="p-4 bg-[#0a0a0a] space-y-3">
                <div>
                  <TL color="text-zinc-500"># 1 Install</TL>
                  <TL color="text-zinc-300">$ pip install velocitybrain</TL>
                </div>
                <div>
                  <TL color="text-zinc-500"># 2 Login</TL>
                  <TL color="text-zinc-300">$ velocitybrain login --api-key vb_live_xxx</TL>
                </div>
                <div>
                  <TL color="text-zinc-500"># 3 Connect your agent</TL>
                  <TL color="text-zinc-300">$ velocitybrain connect codex</TL>
                  <TL color="text-zinc-300">$ velocitybrain serve mcp</TL>
                </div>
                <div>
                  <TL color="text-zinc-500"># 4 Verify it works</TL>
                  <TL color="text-zinc-300">$ velocitybrain doctor</TL>
                  <TL color="text-zinc-300">$ velocitybrain smoke</TL>
                </div>
              </div>
            </Clay>
          </div>
        </Fade>
      </section>

      <section className="py-12 border-y border-[#1a1a1a]" style={{ background: '#050505' }}>
        <div className="max-w-5xl mx-auto px-4">
          <Fade>
            <div className="text-center mb-8">
              <p className="mono text-[#EA803A] text-[10px] uppercase tracking-widest mb-1.5">Integrations</p>
              <h2 className="syne font-bold text-white text-xl md:text-2xl">
                Connect once, use it across your agent stack
              </h2>
              <p className="text-zinc-500 text-[13px] md:text-sm mt-2 max-w-lg mx-auto">
                Velocity Brain is meant to sit behind the agents your team already uses, not force a brand new workflow.
              </p>
            </div>
          </Fade>

          {/* Changed from lg:grid-cols-4 to md:grid-cols-2 for significantly wider cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {simplifiedAgents.map((agent, index) => (
              <Fade key={agent.id} delay={index * 60} className="h-full">
                {(() => {
                  const theme = integrationCardThemes[agent.id] || {
                    badge: 'border-[#2a2a2a] bg-[#111] text-zinc-400',
                    setup: 'bg-[#0a0a0a] border-[#1e1e1e]',
                    keyword: 'text-[#EA803A]',
                    hexColor: '#EA803A',
                  };

                  const tokens = agent.setup.split(' ');

                  return (
                    <div className="relative h-full overflow-hidden rounded-[20px] p-[1px] flex bg-[#1a1a1a] shadow-[0_6px_16px_rgba(0,0,0,0.2)]">
                      {/* Spinning Border Element */}
                      <div
                        className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] pointer-events-none"
                        style={{
                          background: `conic-gradient(from 90deg at 50% 50%, transparent 0%, ${theme.hexColor} 50%, transparent 100%)`,
                        }}
                      />
                      
                      {/* Inner Card Element (Removed left border bar, reduced internal padding) */}
                      <div className="relative z-10 flex w-full flex-col overflow-hidden rounded-[19px] bg-[#0f0f0f] p-5 transition-all duration-200">
                        <div className="absolute inset-x-0 top-0 h-8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] pointer-events-none" />
                        
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-2.5">
                                <AgentBrandIcon
                                  agentId={agent.id}
                                  name={agent.name}
                                  containerClassName="h-8 w-8"
                                  size="h-4 w-4"
                                />
                                <div>
                                  <h3 className="syne text-base font-bold tracking-tight text-white leading-tight">{agent.name}</h3>
                                  <span className={`inline-block mt-0.5 rounded border px-1 py-[2px] mono text-[7px] uppercase tracking-[0.15em] ${theme.badge}`}>
                                    {agent.surface}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[13px] leading-relaxed text-zinc-400 mt-1.5">{agent.summary}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {(agent.strengths || []).slice(0, 2).map((strength) => (
                              <span
                                key={strength}
                                className="rounded-md border border-[#212121] bg-[#121212] px-2 py-0.5 text-[10px] text-zinc-400"
                              >
                                {strength}
                              </span>
                            ))}
                          </div>

                          <div className="mt-auto pt-5">
                            <div className={`rounded-xl border p-3 ${theme.setup}`}>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">Setup</p>
                                <button
                                  type="button"
                                  onClick={() => copySetupCommand(agent.id, agent.setup)}
                                  className="rounded border border-[#2a2a2a] bg-[#101010] px-2 py-0.5 mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:border-[#3a3a3a] hover:text-white"
                                >
                                  {copiedSetup === agent.id ? 'Copied' : 'Copy'}
                                </button>
                              </div>

                              <code className="block text-[10px] leading-relaxed text-zinc-300 break-words">
                                {tokens.map((token, tokenIndex) => {
                                  const highlight =
                                    token === 'mcp' ||
                                    token === 'add' ||
                                    token === 'serve' ||
                                    token === 'connect' ||
                                    token === 'velocitybrain';

                                  return (
                                    <span
                                      key={`${agent.id}-${token}-${tokenIndex}`}
                                      className={highlight ? theme.keyword : 'text-zinc-300'}
                                    >
                                      {token}
                                      {tokenIndex < tokens.length - 1 ? ' ' : ''}
                                    </span>
                                  );
                                })}
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Fade>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-12">
        <Fade>
          <Clay accent className="p-6 md:p-8 text-center rounded-[20px]">
            <p className="mono text-[#EA803A] text-[10px] uppercase tracking-widest mb-3">Ready</p>
            <h2 className="syne font-extrabold text-white mb-3 text-2xl md:text-3xl">
              Make your AI work compound.
            </h2>
            <p className="text-zinc-300 text-[13px] md:text-sm mb-6 max-w-lg mx-auto leading-relaxed">
              Velocity Brain helps your AI start with better context, reuse prior work, and waste less money rediscovering the same information over and over again.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={accountHref}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-black text-[13px] syne"
                style={{ background: '#EA803A', boxShadow: '2px 2px 0 #c4612a' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0965a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#EA803A')}
              >
                {footerCtaLabel}
              </Link>
              <Link
                to="/docs"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-zinc-300 text-[13px] border border-[#333] bg-[#111] syne"
                style={{ boxShadow: '2px 2px 0 #000' }}
              >
                Read the Docs
              </Link>
            </div>
          </Clay>
        </Fade>
      </section>

      <footer style={{ borderTop: '1px solid #1a1a1a', background: '#040404' }}>
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Velocity Brain" className="w-6 h-6 rounded flex-shrink-0" />
              <span className="px-font text-white" style={{ fontSize: 10 }}>
                Velocity Brain
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 md:gap-5">
              {[
                ['Documentation', '/docs'],
                ['CLI Reference', '/docs/cli'],
                ['MCP Setup', '/docs/mcp'],
                ['Privacy', '/privacy'],
                ['Terms', '/terms'],
              ].map(([label, path]) => (
                <Link
                  key={label}
                  to={path}
                  className="text-[12px] font-medium text-zinc-500 hover:text-[#EA803A] transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-[#111] text-center">
            <p className="text-[10px] text-zinc-600">
              (c) {new Date().getFullYear()} Velocity Brain. Full stack brain for your AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
