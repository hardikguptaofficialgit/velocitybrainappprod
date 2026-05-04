import React from 'react';
import { Link } from 'react-router-dom';

const problemPoints = [
  {
    title: 'Knowledge is fragmented',
    body: 'Critical operating context lives across code, incidents, docs, chats, tickets, and people who vaguely remember what happened last time.',
    accent: '#EA803A',
  },
  {
    title: 'Search is not enough',
    body: 'Search can surface documents, but it does not turn scattered evidence into current truth, known owners, safe steps, and reusable operating context.',
    accent: '#7fe3c8',
  },
  {
    title: 'Agents need execution context',
    body: 'AI systems need structured, current, and auditable context before they can act safely inside real company workflows.',
    accent: '#5d89ff',
  },
];

const systemFlow = [
  'Ingest scattered operating knowledge from repos, incidents, docs, tickets, and meetings.',
  'Structure it into entities, timelines, relationships, decisions, and reusable context.',
  'Compile the useful truth into a company brain that agents can query before acting.',
  'Keep actions approval-aware and auditable so teams can trust what happens next.',
];

const engineeringWedge = [
  'Incident response and postmortem continuity',
  'Runbooks and operational checklists',
  'Architecture decisions and change history',
  'Repo, meeting, and ticket context across sessions',
];

const todayVsNext = [
  {
    label: 'What exists today',
    title: 'A strong memory and execution context layer for agents',
    body: 'Velocity Brain already focuses on memory, retrieval, reuse, workflow continuity, and safer execution context for agent-driven work.',
    tone: 'border-[#EA803A]/25 bg-[#160c04]',
    text: 'text-[#f2b07d]',
  },
  {
    label: 'What we are building next',
    title: 'A Company Brain for engineering teams',
    body: 'Company Brain is how that foundation expands into team operating knowledge: current truth, better handoffs, stronger incident context, and reusable runbook intelligence.',
    tone: 'border-[#7fe3c8]/25 bg-[#081310]',
    text: 'text-[#98f0dc]',
  },
];

const shellStyle = { fontFamily: 'DM Sans, sans-serif' };
const headlineStyle = { fontFamily: 'Syne, sans-serif' };

const CompanyBrain = () => {
  return (
    <div className="min-h-screen bg-[#070707] text-white selection:bg-[#EA803A] selection:text-black" style={shellStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
      `}</style>

      <div className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top,rgba(234,128,58,0.18),transparent_40%),radial-gradient(circle_at_78%_16%,rgba(127,227,200,0.12),transparent_28%),radial-gradient(circle_at_25%_20%,rgba(93,137,255,0.1),transparent_30%)]" />

      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-8">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Velocity Brain" className="h-9 w-9 rounded-xl" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">VelocityBrain</p>
            <p className="text-sm font-semibold text-white">Company Brain</p>
          </div>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/research/why-velocitybrain-is-different" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">
            Research
          </Link>
          <Link to="/docs" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">
            Docs
          </Link>
          <Link to="/login" className="rounded-full bg-[#EA803A] px-5 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90">
            Start Free
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-4">
        <section className="grid gap-10 border-b border-white/10 pb-16 pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-end">
          <div>
            <div className="inline-flex rounded-full border border-[#EA803A]/30 bg-[#EA803A]/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#f2b07d]">
              New business surface
            </div>
            <h1 className="mt-8 max-w-4xl text-4xl font-extrabold leading-[1.03] tracking-[-0.04em] text-white md:text-6xl" style={headlineStyle}>
              Company Brain for
              <br />
              engineering teams.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Velocity Brain starts as the memory and execution context layer for agents. Company Brain is how that
              foundation expands into team operating knowledge: the current truth behind incidents, runbooks, repo
              history, decisions, and handoffs.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/docs"
                className="inline-flex items-center justify-center rounded-full bg-[#EA803A] px-6 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
              >
                Explore docs
              </Link>
              <Link
                to="/research/why-velocitybrain-is-different"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                Read the comparison
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6 md:p-8">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Why this wedge first</p>
            <h2 className="mt-3 text-2xl font-bold text-white" style={headlineStyle}>
              Engineering already creates a dense company graph.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
              Engineering is the first wedge because code, incidents, docs, and decisions already create a dense
              knowledge graph. The pain is clear, the evidence is rich, and the quality bar for trustworthy AI context
              is high enough to matter.
            </p>
            <div className="mt-6 grid gap-3">
              {engineeringWedge.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-[#0b0b0b] px-4 py-3 text-sm text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mb-10 max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Why companies need a brain</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl" style={headlineStyle}>
              Every team knows more than any one system can currently use.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {problemPoints.map((point) => (
              <div key={point.title} className="rounded-3xl border border-white/8 bg-white/[0.02] p-6">
                <div
                  className="mb-5 h-2.5 w-14 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${point.accent}, transparent)` }}
                />
                <h3 className="text-xl font-bold text-white" style={headlineStyle}>
                  {point.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 border-y border-white/10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">How Velocity Brain fits</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl" style={headlineStyle}>
              From scattered evidence to reusable operating context.
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
              Company Brain is not a chatbot over documents. It is the layer that collects evidence, structures it,
              keeps it current, and prepares the context agents need before they act.
            </p>
          </div>

          <div className="space-y-3">
            {systemFlow.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EA803A]/10 text-xs font-bold text-[#f2b07d]">
                  {index + 1}
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16">
          <div className="mb-10 max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Credibility</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl" style={headlineStyle}>
              Forward-looking, but grounded in the product we are already shaping.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-zinc-400">
              We are not claiming that every business workflow is already fully automated. The point is that the core
              layer already exists: memory, retrieval, reuse, workflow continuity, and safer execution context. Company
              Brain is the broader business expression of that foundation.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {todayVsNext.map((item) => (
              <div key={item.label} className={`rounded-3xl border p-6 md:p-8 ${item.tone}`}>
                <p className={`text-[11px] uppercase tracking-[0.24em] ${item.text}`}>{item.label}</p>
                <h3 className="mt-4 text-2xl font-bold text-white" style={headlineStyle}>
                  {item.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(234,128,58,0.12),transparent_60%),#0a0a0c] p-8 md:p-10">
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Next step</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold text-white md:text-4xl" style={headlineStyle}>
            Start with the agent layer now, then grow into the operating brain.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            Velocity Brain already gives teams a serious base for memory, retrieval, and execution context. Company
            Brain is where that base becomes shared team knowledge for engineering workflows that should not restart
            from zero.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full bg-[#EA803A] px-6 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
            >
              Start with Velocity Brain
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Open docs
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CompanyBrain;
