import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GLSLHills } from '../components/ui/glsl-hills';
import {
  ArrowRight,
  ChatCenteredText,
  Clock,
  Code,
  Cpu,
  Database,
  Gear,
  Github as GithubBrand,
  Key,
  Lightning,
  List,
  Package,
  Pulse,
  ShieldCheck,
  Star,
  TerminalWindow,
  X,
} from '../components/Icons';

/* ─────────────────────────────────────────────────────────────────────────────
   FONT STRATEGY
   - "Press Start 2P"  -> pixel / brand name only
   - "Syne"            -> display headings
   - "DM Sans"         -> body copy
   - "JetBrains Mono"  -> code / mono
───────────────────────────────────────────────────────────────────────────── */

const Terminal = ({ content }) => (
  <div className="absolute inset-0 w-full h-full bg-[#0b0b0b] font-mono text-[13px] leading-relaxed text-zinc-300 flex flex-col">
    {/* header */}
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#222] bg-[#111] flex-shrink-0">
      <div className="flex items-center gap-2">
        {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
          <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
        ))}
        <span className="text-xs text-zinc-500 ml-2">
          velocity-brain - bash - 80x24
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-zinc-600">
        <span>UTF-8</span>
        <span>LF</span>
      </div>
    </div>

    {/* body */}
    <div className="flex-1 p-5 space-y-1.5 overflow-hidden flex items-center justify-center">
      <div className="w-full max-w-lg space-y-1.5">
        {content.map(([cls, txt], i) => (
          <div key={i} className={`flex ${cls}`}>
            <span className="whitespace-pre-wrap break-words">{txt}</span>
          </div>
        ))}
      </div>
    </div>

    {/* footer */}
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-[#222] bg-[#0a0a0a] flex-shrink-0">
      <div className="flex items-center gap-4 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          connected
        </span>
        <span>postgres:5432</span>
      </div>
      <div className="text-[10px] text-zinc-600">
        <span className="text-[#EA803A]">velocity-brain</span> v0.1.0
      </div>
    </div>
  </div>
);

const ImageComparisonSlider = ({
  beforeContent,
  afterContent
}) => {
  const [pos, setPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const updatePosition = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setPos((x / rect.width) * 100);
  }, []);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-[#2a2a2a] select-none"
      style={{
        aspectRatio: '16/6',
        boxShadow: '6px 6px 0 rgba(234,128,58,0.15)',
        cursor: isDragging ? 'grabbing' : 'ew-resize',
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* AFTER */}
      <Terminal content={afterContent} />

      {/* BEFORE (Masked with clip-path to prevent squishing) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <Terminal content={beforeContent} />
      </div>

      {/* DIVIDER */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-[#EA803A] pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-[#EA803A]"
          style={{
            boxShadow: '3px 3px 0 #c4612a',
            border: '2px solid rgba(255,255,255,0.15)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M8 5l-6 7 6 7M16 5l6 7-6 7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════  INTERSECTION FADE  ════════════════════════════════ */
const Fade = ({ children, delay = 0, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.06 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

/* ══════════════════════  DOODLE ICONS WRAPPERS  ═══════════════════════════ */
const IDB = (p) => <Database size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const IShield = (p) => <ShieldCheck size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const IZap = (p) => <Lightning size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const ICpu = (p) => <Cpu size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const IActivity = (p) => <Pulse size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const IArrow = (p) => <ArrowRight size={p.size || 20} color="#ffffff" weight="duotone" {...p} />;
const ITerm = (p) => <TerminalWindow size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const IGear = (p) => <Gear size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const IBox = (p) => <Package size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;
const IKey = (p) => <Key size={p.size || 24} color="#ffffff" weight="duotone" {...p} />;

/* ══════════════════════  CLAY CARD  ════════════════════════════════════════ */
const Clay = ({ children, className = '', accent = false, style = {} }) => (
  <div className={`rounded-xl border ${accent ? 'border-[#EA803A]/30 bg-[#130a02]' : 'border-[#2a2a2a] bg-[#0e0e0e]'} ${className}`}
    style={{ boxShadow: accent ? '4px 4px 0 #EA803A14' : '4px 4px 0 #00000060', ...style }}>
    {children}
  </div>
);

/* ══════════════════════  FLOW ARROW  ═══════════════════════════════════════ */
const FlowArrow = () => (
  <div className="flex items-center justify-center flex-shrink-0 mx-2">
    <svg width="32" height="12" viewBox="0 0 32 12" fill="none">
      <line x1="0" y1="6" x2="24" y2="6" stroke="#EA803A55" strokeWidth="2" strokeDasharray="4 4"/>
      <polyline points="20,2 28,6 20,10" stroke="#EA803A" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

/* ══════════════════════  TERMINAL LINE  ════════════════════════════════════ */
const TL = ({ children, color = 'text-zinc-400', indent = false }) => (
  <p className={`${color} text-sm leading-relaxed ${indent ? 'pl-4' : ''}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{children}</p>
);

/* ══════════════════════  SKILL BADGE  ══════════════════════════════════════ */
const SkillBadge = ({ name, cat }) => {
  const cols = { ingestion: '#3b82f6', query: '#10b981', execution: '#f59e0b', maintenance: '#8b5cf6', brain: '#EA803A' };
  const c = cols[cat] || '#EA803A';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: `${c}40`, background: `${c}10`, color: `${c}ee`, fontFamily: 'JetBrains Mono, monospace' }}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }}/>
      {name}
    </div>
  );
};

/* ══════════════════════  MAIN LANDING  ═════════════════════════════════════ */
export default function Landing() {
  const { user, firebaseUser, loading } = useAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('query');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [githubStars, setGithubStars] = useState(null);

  useEffect(() => {
    const onScroll = () => { setNavScrolled(window.scrollY > 50); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetch('https://api.github.com/repos/hardikguptaofficialgit/velocitybrainos')
      .then(res => res.json())
      .then(data => setGithubStars(data.stargazers_count))
      .catch(() => setGithubStars(0));
  }, []);

  const cliTabs = {
    query: { cmd: 'velocity-brain query "What do I know about Jane?"', lines: [['text-[#EA803A]','⚙ Brain lookup: 4 memory traces found'],['text-zinc-400','  Entity: Hardik Gupta (Linkit App)'],['text-zinc-400','  Context: GTM discussion, follow-up pending'],['text-green-400','✓ Confidence: 0.94 · Citations: 3']] },
    ingest: { cmd: 'velocity-brain ingest --source note --content "Met Jane from Acme"', lines: [['text-[#EA803A]','⚙ Signal detected: contact-mention'],['text-zinc-400','  Entity created: Hardik Gupta'],['text-zinc-400','  Timeline event stored'],['text-green-400','✓ Memory updated in 43ms']] },
    run: { cmd: 'velocity-brain run "Prepare me for meeting with Jane"', lines: [['text-[#EA803A]','⚙ Brain lookup -> 4 traces found'],['text-[#EA803A]','⚙ Plan: [brief, context, actions]'],['text-zinc-400','  Executing deterministic skill...'],['text-green-400','✓ Done · Audit logged']] },
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Global CSS ─────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');
        ::selection{background:#EA803A;color:#000}
        .px-font{font-family:'Press Start 2P',cursive}
        .syne{font-family:'Syne',sans-serif}
        .mono{font-family:'JetBrains Mono',monospace}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0a0a}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:6px}
      `}</style>

      {/* ── NAV ─────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-5">
        <div className="w-full transition-all duration-500"
          style={{
            maxWidth: navScrolled ? 900 : 1200,
            background: navScrolled ? 'rgba(8,8,8,.95)' : 'transparent',
            backdropFilter: navScrolled ? 'blur(16px)' : 'none',
            borderRadius: navScrolled ? 16 : 0,
            border: navScrolled ? '1px solid #222' : '1px solid transparent',
            boxShadow: navScrolled ? '4px 4px 0 #00000055' : 'none',
            padding: navScrolled ? '12px 24px' : '0 24px',
          }}>
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src="/logo.png" alt="Velocity Brain" className="w-8 h-8 rounded-lg flex-shrink-0"/>
              <span className="px-font text-white hidden sm:block" style={{ fontSize: 12 }}>Velocity Brain</span>
            </div>
            {/* Links - Desktop */}
            <div className="hidden md:flex items-center gap-6">
              <a href="https://github.com/hardikguptaofficialgit/velocitybrainos" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                <GithubBrand width={16} height={16} />
                <span>GitHub</span>
                {githubStars !== null && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EA803A]/10 border border-[#EA803A]/30 text-[#EA803A] text-xs font-medium">
                    <Star size={10} weight="duotone" />
                    {githubStars}
                  </span>
                )}
              </a>
              {[['Docs','/docs'],['CLI','/docs/cli'],['MCP','/docs/mcp'],['Security','/docs/security'],['API','/docs/api']].map(([l,p])=>(
                <a key={l} href={p} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">{l}</a>
              ))}
            </div>
            {/* Actions - Desktop */}
            <div className="hidden md:flex items-center gap-4">
              {!loading && user ? (
                <>
                  <a href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-zinc-300 bg-[#111] hover:border-[#EA803A66] transition-colors">
                    {firebaseUser?.photoURL ? (
                      <img src={firebaseUser.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#EA803A] flex items-center justify-center text-xs text-black font-bold">
                        {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <span>{user.name || user.email}</span>
                  </a>
                </>
              ) : (
                <>
                  <a href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Sign In</a>
                  <a href="/login" className="px-5 py-2 rounded-xl text-sm font-bold text-black"
                    style={{ background:'#EA803A', boxShadow:'2px 2px 0 #c4612a' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0965a'}
                    onMouseLeave={e=>e.currentTarget.style.background='#EA803A'}>
                    Start Now
                  </a>
                </>
              )}
            </div>
            {/* Mobile menu button */}
            <button className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-[#333] bg-[#111]" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={20} weight="duotone" color="#ffffff" /> : <List size={20} weight="duotone" color="#ffffff" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 mt-2 mx-4 p-4 rounded-xl border border-[#222] bg-[#0a0a0a] backdrop-blur-xl" style={{ boxShadow: '4px 4px 0 #00000040' }}>
            <div className="flex flex-col gap-4">
              <a href="https://github.com/hardikguptaofficialgit/velocitybrainos" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>
                <GithubBrand width={16} height={16} />
                <span>GitHub</span>
                {githubStars !== null && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EA803A]/10 border border-[#EA803A]/30 text-[#EA803A] text-xs font-medium">
                    <Star size={10} weight="duotone" />
                    {githubStars}
                  </span>
                )}
              </a>
              {[['Docs','/docs'],['CLI','/docs/cli'],['MCP','/docs/mcp'],['Security','/docs/security'],['API','/docs/api']].map(([l,p])=>(
                <a key={l} href={p} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>{l}</a>
              ))}
              <div className="h-px bg-[#222]"/>
              {!loading && user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    {firebaseUser?.photoURL ? (
                      <img src={firebaseUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#EA803A] flex items-center justify-center text-sm text-black font-bold">
                        {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{user.name || user.email}</p>
                    </div>
                  </div>
                  <a href="/dashboard" className="w-full px-5 py-2.5 rounded-xl text-sm font-bold text-black text-center"
                    style={{ background:'#EA803A', boxShadow:'2px 2px 0 #c4612a' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0965a'}
                    onMouseLeave={e=>e.currentTarget.style.background='#EA803A'}
                    onClick={() => setMobileMenuOpen(false)}>
                    Go to Dashboard
                  </a>
                </>
              ) : (
                <>
                  <a href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Sign In</a>
                  <a href="/login" className="w-full px-5 py-2.5 rounded-xl text-sm font-bold text-black text-center"
                    style={{ background:'#EA803A', boxShadow:'2px 2px 0 #c4612a' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0965a'}
                    onMouseLeave={e=>e.currentTarget.style.background='#EA803A'}
                    onClick={() => setMobileMenuOpen(false)}>
                    Start Now
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ══════════  HERO  ══════════════════════════════════════════════════ */}
      {/* Set to min-h-screen, shifted text down with pt-40 md:pt-56, pushed terminal out of view */}
      <section className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden pt-40 md:pt-56 pb-12">
        <div className="absolute inset-0 z-0" style={{ zIndex: 0 }}>
          <GLSLHills width="100%" height="100%" cameraZ={125} planeSize={256} speed={0.35} />
        </div>

        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, rgba(8,8,8,0.9) 100%)",
          }}
        />

        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-0"
          style={{ background: "linear-gradient(transparent,#080808)" }}
        />

        {/* Corner decorations */}
        {[
          ["top-20 left-8", "M0 24L0 0L24 0"],
          ["top-20 right-8", "M24 24L24 0L0 0"],
        ].map(([pos, d], i) => (
          <div
            key={i}
            className={`absolute ${pos} opacity-30 pointer-events-none`}
            style={{ color: "#EA803A" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d={d} />
            </svg>
          </div>
        ))}

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center w-full flex flex-col flex-1">
          <div>
            <Fade delay={100}>
              <h1 className="syne font-extrabold leading-tight mb-4 text-4xl md:text-6xl">
                Your AI agent is capable
                <br />
                <span className="text-zinc-600">but incomplete.</span>
              </h1>
            </Fade>

            <Fade delay={200}>
              <h2 className="syne font-bold text-[#EA803A] mb-6 text-xl md:text-2xl">
                <span className="px-font text-base md:text-lg mr-3">
                  Velocity Brain
                </span>
                gives it a real brain.
              </h2>
            </Fade>

            <Fade delay={360}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <a
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-black text-base flex items-center justify-center gap-2 syne"
                  style={{ background: "#EA803A", boxShadow: "4px 4px 0 #c4612a" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f0965a")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#EA803A")
                  }
                >
                  Get Started Free <IArrow size={18} stroke="#000000" />
                </a>

                <a
                  href="/docs/cli"
                  className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-zinc-300 text-base flex items-center justify-center gap-2 border border-[#333] bg-[#111] syne"
                  style={{ boxShadow: "4px 4px 0 #000" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "#EA803A66")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "#333")
                  }
                >
                  <ITerm size={18} /> View CLI Demo
                </a>
              </div>
            </Fade>
          </div>

          {/* Inline mini terminal preview - Pushed down heavily to hide from first view */}
          <div className="mt-[30vh] md:mt-[40vh] mb-10 w-full">
            <Fade delay={440}>
              <Clay className="text-left overflow-hidden max-w-2xl mx-auto border border-[#2a2a2a]">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2a2a2a] bg-[#111]">
                  {["#FF5F56", "#FFBD2E", "#27C93F"].map((c) => (
                    <div
                      key={c}
                      className="w-3 h-3 rounded-full"
                      style={{ background: c }}
                    />
                  ))}
                  <span className="mono text-xs text-zinc-500 ml-3">
                    Velocity Brain
                  </span>
                </div>

                <div className="p-4 space-y-2 bg-[#0a0a0a]">
                  <TL color="text-zinc-400">
                    $ velocity-brain ingest --source note --content "Met Jane from Acme"
                  </TL>
                  <TL color="text-[#EA803A]" indent>
                    ⚙ Signal detected - entity-mention
                  </TL>
                  <TL color="text-zinc-500" indent>
                    Entity created: Hardik Gupta (Linkit App)
                  </TL>
                  <TL color="text-green-400" indent>
                    ✓ Memory updated · 43ms · Audit logged
                  </TL>
                </div>
              </Clay>
            </Fade>
          </div>
        </div>
      </section>
      
      {/* ══════════  STATS  ════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 pb-20 mt-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { v:'65', l:'JSON Skills', s:'Validated + extensible' },
            { v:'~30m', l:'Setup Time', s:'Local brain running' },
            { v:'100%', l:'Production-Ready', s:'Docker · SSL · Redis' },
            { v:'13', l:'MCP Tools', s:'Policy-gated ops' },
          ].map((s,i)=>(
            <Fade key={i} delay={i*55}>
              <Clay accent className="p-6 text-center border border-[#EA803A]/20 bg-[#150a04]">
                <p className="syne font-extrabold text-white mb-1 text-4xl md:text-5xl">{s.v}</p>
                <p className="text-[#EA803A] font-bold text-sm uppercase tracking-wider mb-1" style={{ fontFamily:'DM Sans,sans-serif' }}>{s.l}</p>
                <p className="text-zinc-500 text-sm">{s.s}</p>
              </Clay>
            </Fade>
          ))}
        </div>
      </section>

      {/* ══════════  IMAGE COMPARISON  ══════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <Fade>
          <div className="text-center mb-8">
            <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// before vs after'}</p>
            <h2 className="syne font-bold text-white text-3xl md:text-4xl">What Velocity Brain Actually Fixes</h2>
          </div>
        </Fade>
       <Fade delay={60}>
  <ImageComparisonSlider
  beforeContent={[
    ['text-zinc-500', '> analyze Hardik Gupta profile'],
    ['text-zinc-400', '● Attempting to understand profile...'],
    ['text-zinc-400', ''],
    ['text-zinc-400', 'No structured context available'],
    ['text-zinc-400', 'Scanning scattered inputs...'],
    ['text-zinc-400', 'Reading: partial data, assumptions, guesses'],
    ['text-zinc-400', ''],
    ['text-red-400', 'Incomplete understanding'],
    ['text-red-400', 'Fragmented insights'],
    ['text-red-400', ''],
    ['text-red-400', '✗ Vague output · Low accuracy'],
    ['text-red-400', '95k tokens · No context · Inefficient']
  ]}
  afterContent={[
    ['text-zinc-500', '> analyze Hardik Gupta profile'],
    ['text-zinc-400', '● Executing with structured context'],
    ['text-[#EA803A]', ''],
    ['text-[#EA803A]', '✦ Velocity Brain MCP engaged'],
    ['text-[#EA803A]', 'Context graph + structured signals loaded'],
    ['text-[#EA803A]', ''],
    ['text-zinc-400', 'Profile synthesized'],
    ['text-zinc-400', 'Extracting key traits...'],
    ['text-zinc-400', ''],
    ['text-green-400', '✓ Clear behavioral patterns'],
    ['text-green-400', '✓ Consistent identity mapping'],
    ['text-green-400', '✓ High-confidence output'],
    ['text-green-400', ''],
    ['text-green-400', '42k tokens· Context-aware · Deterministic']
  ]}
/>
</Fade>
      
      </section>

      {/* ══════════  FLOWCHART  ════════════════════════════════════════════ */}
      <section className="py-20" style={{ background:'#050505', borderTop:'1px solid #1a1a1a', borderBottom:'1px solid #1a1a1a' }}>
        <div className="max-w-6xl mx-auto px-6">
          <Fade>
            <div className="text-center mb-12">
              <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// intelligence routing'}</p>
              <h2 className="syne font-bold text-white text-3xl md:text-4xl">Brain-First. Every Request.</h2>
              <p className="text-zinc-500 text-base md:text-lg mt-4 max-w-2xl mx-auto">Memory retrieval happens before any synthesis or external action. Always.</p>
            </div>
          </Fade>

          <Fade delay={60}>
            <Clay className="p-8 md:p-10 border border-[#2a2a2a]">
              {/* Main flow row */}
              <div className="flex items-center justify-center flex-wrap gap-2 mb-8">
                {[
                  { label:'Signal', sub:'intent', Icon:IZap },
                  null,
                  { label:'Brain Lookup', sub:'memory first', Icon:IDB },
                  null,
                  { label:'Route', sub:'skill dispatch', Icon:IGear },
                  null,
                  { label:'Execute', sub:'deterministic', Icon:ICpu },
                  null,
                  { label:'Audit', sub:'policy-gated', Icon:IShield },
                  null,
                  { label:'Write-back', sub:'memory grows', Icon:IActivity },
                ].map((node,i)=>
                  node === null
                    ? <FlowArrow key={i}/>
                    : (
                      <div key={i} className="flex flex-col items-center gap-3 px-2">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-[#333] bg-[#111]">
                          <node.Icon size={26} />
                        </div>
                        <div className="text-center">
                          <div className="syne font-bold text-white text-sm mb-1">{node.label}</div>
                          <div className="text-zinc-500 text-xs">{node.sub}</div>
                        </div>
                      </div>
                    )
                )}
              </div>

              {/* Category grid */}
              <div className="mt-12 pt-8 border-t border-[#2a2a2a]">
                <p className="text-center mono text-xs text-zinc-500 uppercase tracking-widest mb-6">Skill categories</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                  {[
                    { label:'Always-on', Icon:IZap, desc:'Core system ops' },
                    { label:'Brain Ops', Icon:IDB, desc:'Memory & retrieval' },
                    { label:'Ingestion', Icon:IBox, desc:'Text, PDF, Org, OCR' },
                    { label:'Execution', Icon:ICpu, desc:'Tasks, cron, connectors' },
                    { label:'Maintenance', Icon:IGear, desc:'Health & cleanup' },
                  ].map((cat,i)=>(
                    <div key={i} className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-[#222] bg-[#0c0c0c]">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#1a1a1a] border border-[#333]">
                        <cat.Icon size={22} />
                      </div>
                      <div className="text-center">
                        <div className="syne font-bold text-white text-sm mb-1">{cat.label}</div>
                        <div className="text-zinc-500 text-xs">{cat.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Identity spec layer note */}
              <div className="mt-8 pt-6 border-t border-[#2a2a2a] flex items-center justify-center flex-wrap">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-[#EA803A]/30 bg-[#1a0e05]">
                  <IKey size={20} />
                  <span className="mono text-xs md:text-sm text-zinc-400"><span className="text-[#EA803A] font-bold">identity.spec.json</span> - sits above runtime defaults. Describes agent identity &amp; policy posture.</span>
                </div>
              </div>
            </Clay>
          </Fade>
        </div>
      </section>

      {/* ══════════  FEATURES  ═════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Fade>
          <div className="text-center mb-12">
            <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// architecture'}</p>
            <h2 className="syne font-bold text-white text-3xl md:text-4xl">Production-Hardened by Default</h2>
          </div>
        </Fade>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { Icon:IDB, title:'Brain-First Lookup Protocol', tag:'retrieval',
              desc:'All workflows begin with internal retrieval. The runtime prefers existing knowledge before synthesis or external calls. Citations, compiled truth, and entity data stay consistent across every session.' },
            { Icon:IShield, title:'Enterprise Security Built-in', tag:'security',
              desc:'SQL injection prevention, XSS protection, JWT auth with scope-based authorization, configurable rate limiting, structured audit logging, and policy gates on all destructive operations.' },
            { Icon:IActivity, title:'Full Observability Layer', tag:'monitoring',
              desc:'Health checks across DB, filesystem, memory, and external deps. Prometheus metrics, Grafana dashboards, structured JSON logs. Real-time alerts on degradation, auth failures, and policy violations.' },
            { Icon:ICpu, title:'65 JSON-Defined Skills', tag:'skills',
              desc:'Deterministic ingestion, enrichment, execution, and maintenance skills. Each includes metadata, workflow steps, validation rules, and security checks. Extend without touching the router. Ever.' },
          ].map((f,i)=>(
            <Fade key={i} delay={i*55}>
              <Clay className="p-8 h-full border border-[#2a2a2a]">
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#111] border border-[#333]">
                    <f.Icon size={26} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="syne font-bold text-white text-lg">{f.title}</h3>
                      <span className="mono text-xs px-2.5 py-1 rounded-md border border-[#333] text-zinc-300 bg-[#1a1a1a]">{f.tag}</span>
                    </div>
                    <p className="text-zinc-400 text-sm md:text-base leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Clay>
            </Fade>
          ))}
        </div>
      </section>

      {/* ══════════  CLI TABS  ═════════════════════════════════════════════ */}
      <section className="py-24" style={{ background:'#050505', borderTop:'1px solid #1a1a1a', borderBottom:'1px solid #1a1a1a' }}>
        <div className="max-w-4xl mx-auto px-6">
          <Fade>
            <div className="text-center mb-10">
              <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// cli reference'}</p>
              <h2 className="syne font-bold text-white text-3xl md:text-4xl">Three Core Workflows</h2>
            </div>
          </Fade>
          <Fade delay={60}>
            <Clay className="overflow-hidden border border-[#2a2a2a]">
              <div className="flex items-center gap-2 p-2 border-b border-[#2a2a2a] bg-[#111]">
                {[['query','Query Brain'],['ingest','Ingest'],['run','Run Agent']].map(([k,l])=>(
                  <button key={k} onClick={()=>setActiveTab(k)}
                    className="px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 mono"
                    style={activeTab===k ? { background:'#EA803A', color:'#000', boxShadow:'3px 3px 0 #c4612a' } : { color:'#888' }}
                    onMouseEnter={e=>{if(activeTab!==k)e.currentTarget.style.color='#fff'}}
                    onMouseLeave={e=>{if(activeTab!==k)e.currentTarget.style.color='#888'}}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="p-8 min-h-[200px] bg-[#0a0a0a]">
                <TL color="text-zinc-300"><span className="text-zinc-600 font-bold">$</span> {cliTabs[activeTab].cmd}</TL>
                <div className="mt-5 space-y-2">
                  {cliTabs[activeTab].lines.map(([cls,txt],i)=><TL key={i} color={cls} indent>{txt}</TL>)}
                </div>
              </div>
            </Clay>

            {/* Output styles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[['normal','default output'],['lite','concise logging'],['full','detailed JSON'],['ultra','max compression']].map(([style,desc])=>(
                <Clay key={style} className="p-4 text-center border border-[#222]">
                  <p className="mono text-[#EA803A] text-xs md:text-sm font-bold mb-1">--{style}</p>
                  <p className="text-zinc-500 text-xs md:text-sm">{desc}</p>
                </Clay>
              ))}
            </div>
          </Fade>
        </div>
      </section>

      {/* ══════════  INSTALLATION  ═══════════════════════════════════════ */}
      <section className="py-24" style={{ background:'#050505', borderTop:'1px solid #1a1a1a', borderBottom:'1px solid #1a1a1a' }}>
        <div className="max-w-6xl mx-auto px-6">
          <Fade>
            <div className="text-center mb-12">
              <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// installation'}</p>
              <h2 className="syne font-bold text-white text-3xl md:text-4xl">Install in Your Favorite AI Client</h2>
              <p className="text-zinc-500 text-base md:text-lg mt-4 max-w-2xl mx-auto">Velocity Brain works as an MCP server with Claude Code, OpenAI Codex, Gemini CLI, Cline, and OpenClaw.</p>
            </div>
          </Fade>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Claude Code */}
            <Fade delay={60}>
              <Clay className="p-6 h-full border border-[#2a2a2a]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#111] border border-[#333]">
                    <ITerm size={24} />
                  </div>
                  <h3 className="syne font-bold text-white text-lg">Claude Code</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># One-command setup</p>
                    <code>powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client claude</code>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># Or add manually</p>
                    <code>claude mcp add velocitybrain -- velocitybrain serve mcp</code>
                  </div>
                </div>
              </Clay>
            </Fade>

            {/* OpenAI Codex */}
            <Fade delay={120}>
              <Clay className="p-6 h-full border border-[#2a2a2a]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#111] border border-[#333]">
                    <Clock size={24} weight="duotone" color="#ffffff" />
                  </div>
                  <h3 className="syne font-bold text-white text-lg">OpenAI Codex</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># Add server</p>
                    <code>codex mcp add velocitybrain -- velocitybrain serve mcp</code>
                  </div>
                  <p className="text-zinc-500 text-sm">Use Codex MCP listing command, then run tool calls against query.</p>
                </div>
              </Clay>
            </Fade>

            {/* Gemini CLI */}
            <Fade delay={180}>
              <Clay className="p-6 h-full border border-[#2a2a2a]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#111] border border-[#333]">
                    <ChatCenteredText size={24} weight="duotone" color="#ffffff" />
                  </div>
                  <h3 className="syne font-bold text-white text-lg">Gemini CLI</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># MCP config</p>
                    <code>{"{\n  \"mcpServers\": {\n    \"velocitybrain\": {\n      \"command\": \"velocitybrain\",\n      \"args\": [\"serve\", \"mcp\"]\n    }\n  }\n}"}</code>
                  </div>
                </div>
              </Clay>
            </Fade>

            {/* Cline */}
            <Fade delay={240}>
              <Clay className="p-6 h-full border border-[#2a2a2a]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#111] border border-[#333]">
                    <Code size={24} weight="duotone" color="#ffffff" />
                  </div>
                  <h3 className="syne font-bold text-white text-lg">Cline</h3>
                </div>
                <div className="space-y-3">
                  <p className="text-zinc-500 text-sm">Add Velocity Brain in Cline MCP settings with the same stdio command.</p>
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <code>velocitybrain serve mcp</code>
                  </div>
                </div>
              </Clay>
            </Fade>

            {/* OpenClaw */}
            <Fade delay={300}>
              <Clay className="p-6 h-full border border-[#2a2a2a]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#111] border border-[#333]">
                    <Package size={24} weight="duotone" color="#ffffff" />
                  </div>
                  <h3 className="syne font-bold text-white text-lg">OpenClaw</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># One-command setup</p>
                    <code>powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_mcp_plugin.ps1 -Client openclaw</code>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># Export profile</p>
                    <code>velocitybrain openclaw</code>
                  </div>
                </div>
              </Clay>
            </Fade>

            {/* Quick Install */}
            <Fade delay={360}>
              <Clay className="p-6 h-full border border-[#EA803A]/30 bg-[#130a02]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#EA803A]/10 border border-[#EA803A]/30">
                    <IZap size={24} />
                  </div>
                  <h3 className="syne font-bold text-[#EA803A] text-lg">Quick Install</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># Install via pip</p>
                    <code>pip install velocitybrain</code>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-3 mono text-xs text-zinc-400">
                    <p className="text-[#EA803A] mb-2"># Start MCP server</p>
                    <code>velocitybrain serve mcp</code>
                  </div>
                  <a href="/docs" className="inline-flex items-center gap-2 text-sm font-medium text-[#EA803A] hover:text-white transition-colors">
                    View Full Docs <IArrow size={16} stroke="#EA803A" />
                  </a>
                </div>
              </Clay>
            </Fade>
          </div>
        </div>
      </section>

      {/* ══════════  ACCESS CONTROL + MCP SPLIT  ══════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Access tiers */}
          <Fade>
            <div>
              <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// access control'}</p>
              <h2 className="syne font-bold text-white text-2xl md:text-3xl mb-4">Scoped. Policy-Gated.</h2>
              <p className="text-zinc-400 text-base mb-8 leading-relaxed">Velocity Brain is free for everyone for a limited time. Usage limits, scoped authorization, and full audit trails still apply.</p>
              <div className="space-y-3 mb-8">
                {[
                  { t:'Full', d:'All tools + destructive ops', c:'#EA803A' },
                  { t:'Work', d:'Task, memory & execution', c:'#f0965a' },
                  { t:'Family', d:'Read-only + safe ingestion', c:'#f5b07a' },
                  { t:'None', d:'Public identity only (locked)', c:'#3a3a3a' },
                ].map(({ t,d,c })=>(
                  <Clay key={t} className="flex items-center gap-4 px-5 py-4 border border-[#222]">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background:c }}/>
                    <span className="syne text-white text-base font-bold w-20">{t}</span>
                    <span className="text-zinc-500 text-sm">{d}</span>
                  </Clay>
                ))}
              </div>

              {/* Entity memory model diagram */}
              <Clay className="p-6 border border-[#222]">
                <p className="mono text-sm text-zinc-500 uppercase tracking-widest mb-5">Entity memory model</p>
                {[
                  { label:'Entity Page', color:'#EA803A', desc:'Name · type · compiled truth' },
                  { label:'Timeline Events', color:'#f59e0b', desc:'Dated evidence entries' },
                  { label:'Relationships', color:'#3b82f6', desc:'Cross-entity links' },
                  { label:'Citations', color:'#10b981', desc:'Source + confidence score' },
                ].map((row,i,arr)=>(
                  <div key={i}>
                    <div className="flex items-center gap-4 py-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background:row.color }}/>
                      <span className="syne text-white text-sm font-bold">{row.label}</span>
                      <span className="text-zinc-500 text-xs md:text-sm ml-auto">{row.desc}</span>
                    </div>
                    {i<arr.length-1 && <div className="w-0.5 h-6 bg-[#2a2a2a] ml-[3px]"/>}
                  </div>
                ))}
              </Clay>
            </div>
          </Fade>

          {/* MCP tools */}
          <Fade delay={70}>
            <div>
              <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// mcp tools'}</p>
              <h2 className="syne font-bold text-white text-2xl md:text-3xl mb-4">One Server. All Clients.</h2>
              <p className="text-zinc-400 text-base mb-8 leading-relaxed">Works with Claude Code, OpenAI Codex, Gemini CLI, Cline, and any MCP-compatible client.</p>
              <Clay className="overflow-hidden mb-6 border border-[#2a2a2a]">
                <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center gap-3 bg-[#111]">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EA803A]"/>
                  <span className="mono text-sm text-zinc-400">velocity-brain serve mcp</span>
                </div>
                <div className="p-5 space-y-3 bg-[#0a0a0a]">
                  {[['ingest_text',null],['query',null],['run_agent',null],['caveman_commit',null],['caveman_review',null],['caveman_compress',null],
                    ['sync_brain','policy-gated'],['put_page','policy-gated'],['delete_page','policy-gated'],
                    ['list_skills',null],['get_identity_spec',null],['healthz',null],['google_workspace_action',null],
                  ].map(([name,gate])=>(
                    <div key={name} className="flex items-center justify-between">
                      <span className="mono text-sm text-zinc-300"><span className="text-[#EA803A] mr-2">-</span>{name}</span>
                      {gate && <span className="mono text-xs px-2.5 py-1 rounded border border-red-900/40 text-red-400/80 bg-red-900/10">{gate}</span>}
                    </div>
                  ))}
                </div>
              </Clay>

              {/* Config snippet */}
              <Clay className="overflow-hidden border border-[#2a2a2a]">
                <div className="px-5 py-3 border-b border-[#2a2a2a] bg-[#111]">
                  <span className="mono text-xs text-zinc-500">claude / codex / gemini mcpServers config</span>
                </div>
                <div className="p-5 bg-[#0a0a0a]">
                  {[['text-zinc-500','{'],['text-zinc-400','  "mcpServers": {'],['text-zinc-300','    "velocity-brain": {'],['text-[#EA803A]','      "command": "velocity-brain",'],['text-[#EA803A]','      "args": ["serve", "mcp"]'],['text-zinc-300','    }'],['text-zinc-400','  }'],['text-zinc-500','}']].map(([cls,txt],i)=><TL key={i} color={cls}>{txt}</TL>)}
                </div>
              </Clay>
            </div>
          </Fade>
        </div>
      </section>

      {/* ══════════  SKILL BADGES  ═════════════════════════════════════════ */}
      <section className="py-20" style={{ background:'#050505', borderTop:'1px solid #1a1a1a' }}>
        <div className="max-w-6xl mx-auto px-6">
          <Fade>
            <div className="text-center mb-10">
              <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// skill library'}</p>
              <h2 className="syne font-bold text-white text-3xl md:text-4xl">65 JSON-Defined Skills</h2>
              <p className="text-zinc-400 text-base mt-4 max-w-2xl mx-auto">Each skill has metadata, workflow steps, validation rules, and security checks. Load from <span className="mono text-zinc-300 bg-[#111] px-2 py-1 rounded">skills/**/*.json</span> - extend without touching the router.</p>
            </div>
          </Fade>
          <Fade delay={50}>
            <Clay className="p-8 border border-[#2a2a2a]">
              <div className="flex flex-wrap gap-3">
                {[['ingest-note','ingestion'],['ingest-article','ingestion'],['ingest-pdf','ingestion'],['ingest-video','ingestion'],['ingest-audio','ingestion'],['ingest-org','ingestion'],['brain-query','brain'],['brain-enrich','brain'],['brain-compile','brain'],['brain-relate','brain'],['brain-recall','brain'],['exec-email','execution'],['exec-calendar','execution'],['exec-task','execution'],['exec-cron','execution'],['exec-gworkspace','execution'],['exec-message','execution'],['query-semantic','query'],['query-hybrid','query'],['query-entity','query'],['query-timeline','query'],['query-citation','query'],['maint-health','maintenance'],['maint-backup','maintenance'],['maint-prune','maintenance'],['maint-reindex','maintenance'],['maint-metrics','maintenance'],['caveman-commit','brain'],['caveman-review','brain'],['caveman-compress','brain'],['sync-repo','execution'],['identity-spec','brain'],['skill-list','query']].map(([n,c])=><SkillBadge key={n} name={n} cat={c}/>)}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#333] text-sm text-zinc-500 italic bg-[#111]" style={{ fontFamily:'JetBrains Mono,monospace' }}>+32 more...</div>
              </div>
              <div className="flex flex-wrap gap-6 mt-8 pt-6 border-t border-[#2a2a2a]">
                {[['ingestion','#3b82f6'],['query','#10b981'],['execution','#f59e0b'],['maintenance','#8b5cf6'],['brain','#EA803A']].map(([cat,c])=>(
                  <div key={cat} className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full" style={{background:c}}/>
                    <span className="mono text-sm capitalize" style={{color:`${c}ee`}}>{cat}</span>
                  </div>
                ))}
              </div>
            </Clay>
          </Fade>
        </div>
      </section>

      {/* ══════════  QUICK START  ══════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <Fade>
          <div className="text-center mb-10">
            <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-3">{'// quick start'}</p>
            <h2 className="syne font-bold text-white text-3xl md:text-4xl">Up in ~30 Minutes</h2>
            <p className="text-zinc-400 text-base mt-4">Minimal config beyond Postgres + env vars. Automated schema bootstrap.</p>
          </div>
        </Fade>
        <Fade delay={50}>
          <Clay className="overflow-hidden border border-[#2a2a2a]">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2a2a2a] bg-[#111]">
              {['#FF5F56','#FFBD2E','#27C93F'].map(c=><div key={c} className="w-3 h-3 rounded-full" style={{background:c}}/>)}
              <span className="mono text-sm text-zinc-500 ml-3">bash - velocity-brain</span>
            </div>
            <div className="p-8 space-y-6 bg-[#0a0a0a]">
              {[
                { c:'# 1 · Install', ls:['pip install velocity-brain'] },
                { c:'# 2 · Configure', ls:['cp .env.example .env'] },
                { c:'# 3 · Start DB', ls:['docker compose up db -d','docker compose exec -T db psql -U velocity -d velocity_brain -f /docker-entrypoint-initdb.d/01-schema.sql'] },
                { c:'# 4 · Validate', ls:['velocity-brain init','velocity-brain doctor'] },
                { c:'# 5 · Core workflows', ls:['velocity-brain ingest --source note --content "Met Jane from Acme"','velocity-brain query "What do I know about Jane?"','velocity-brain run "Prepare me for meeting with Jane tomorrow"'] },
              ].map((b,i)=>(
                <div key={i}>
                  <TL color="text-zinc-500"><span className="font-bold">{b.c}</span></TL>
                  {b.ls.map((l,j)=><TL key={j} color="text-zinc-300"><span className="text-[#EA803A] mr-2">$</span>{l}</TL>)}
                </div>
              ))}
            </div>
          </Clay>
        </Fade>
      </section>

      {/* ══════════  CTA  ══════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <Fade>
          <Clay accent className="p-12 md:p-16 text-center relative overflow-hidden border border-[#EA803A]/20 bg-[#160a02]">
            <p className="mono text-[#EA803A] text-sm uppercase tracking-widest mb-6">{'// ready?'}</p>
            <h2 className="syne font-extrabold text-white mb-6 text-4xl md:text-5xl">Give your agent a real brain.</h2>
            <p className="text-zinc-400 text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              Join developers building reliable, context-aware, production-ready AI agents with <span className="px-font text-[#EA803A] text-xs">Velocity Brain</span>. Free for everyone for a limited time, with usage limits in place.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <a href="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-black text-base syne"
                style={{background:'#EA803A',boxShadow:'4px 4px 0 #c4612a'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f0965a'}
                onMouseLeave={e=>e.currentTarget.style.background='#EA803A'}>
                Start Building Now
              </a>
              <a href="/docs" className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-zinc-300 text-base border border-[#333] bg-[#111] syne"
                style={{boxShadow:'4px 4px 0 #000'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#EA803A66'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#333'}>
                Read the Docs
              </a>
            </div>
          </Clay>
        </Fade>
      </section>

      {/* ══════════  FOOTER  ═══════════════════════════════════════════════ */}
      <footer style={{borderTop:'1px solid #1a1a1a',background:'#040404'}}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#EA803A',boxShadow:'2px 2px 0 #c4612a'}}>
                <span className="px-font text-black" style={{fontSize:8}}>VB</span>
              </div>
              <span className="px-font text-white" style={{fontSize:12}}>Velocity Brain</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              {[['Documentation','/docs'],['CLI Reference','/docs/cli'],['MCP Setup','/docs/mcp'],['Security','/docs/security'],['Privacy','/privacy'],['Terms','/terms']].map(([l,p])=>(
                <a key={l} href={p} className="text-sm font-medium text-zinc-500 hover:text-[#EA803A] transition-colors" style={{fontFamily:'DM Sans,sans-serif'}}>{l}</a>
              ))}
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-[#111] text-center">
            <p className="text-xs text-zinc-600" style={{fontFamily:'DM Sans,sans-serif'}}>
              © {new Date().getFullYear()} Velocity Brain - Enterprise-Ready AI Agent Memory & Execution Engine · MIT License
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
