import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

const comparisons = [
  {
    name: 'Mem0',
    focus: 'General memory infrastructure for AI apps and agents.',
    angle:
      'VelocityBrain is being positioned one layer higher: memory plus trigger timing, reuse, workflow continuity, and user control.',
  },
  {
    name: 'Zep',
    focus: 'Long-term memory and retrieval for agent applications.',
    angle:
      'VelocityBrain is more focused on when memory should surface in a workflow, not only on storing and recalling context over time.',
  },
  {
    name: 'Letta',
    focus: 'Stateful agent systems with persistent memory and agent orchestration.',
    angle:
      'VelocityBrain is designed as a reusable brain layer behind many assistants and agents rather than a single agent runtime teams must standardize on.',
  },
  {
    name: 'Hyperspell',
    focus: 'Cross-tool memory for workplace agents.',
    angle:
      'VelocityBrain is more focused on daily continuity problems as well as agent workflows: today, this repo, this routine, this open loop.',
  },
  {
    name: 'Hermes',
    focus: 'An autonomous agent with its own persistent memory loop.',
    angle:
      'VelocityBrain is a reusable brain layer that can sit behind many agents instead of asking users to move to one new agent.',
  },
];

const WorkflowVisual = () => {
  const steps = [
    { title: 'User asks again', body: 'Calories, notes, state', bg: 'bg-[#EA803A]/10', border: 'border-[#EA803A]/30', dot: 'bg-[#EA803A]' },
    { title: 'Plain chat drifts', body: 'Starts too close to zero', bg: 'bg-zinc-800/30', border: 'border-zinc-700/50', dot: 'bg-zinc-500' },
    { title: 'Brain injects state', body: 'Today, totals, loops', bg: 'bg-[#7fe3c8]/10', border: 'border-[#7fe3c8]/30', dot: 'bg-[#7fe3c8]' },
    { title: 'Answer starts ahead', body: 'Better continuity', bg: 'bg-[#5d89ff]/10', border: 'border-[#5d89ff]/30', dot: 'bg-[#5d89ff]' },
  ];

  return (
    <div className="my-12 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
      <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4">
        <p className="text-sm font-semibold text-white">Continuity workflow</p>
        <p className="text-sm text-zinc-500">How state flows into the next answer before the model spends context again.</p>
      </div>
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between">
          {steps.map((step, i) => (
            <React.Fragment key={step.title}>
              <div className={`flex flex-1 flex-col justify-center rounded-xl border ${step.border} ${step.bg} p-5 text-center md:text-left`}>
                <div className={`mb-3 hidden h-2 w-2 rounded-full md:block ${step.dot}`} />
                <p className="text-sm font-bold text-white">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{step.body}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center justify-center md:px-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="rotate-90 text-zinc-600 md:rotate-0">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

const StackVisual = () => (
  <div className="my-12 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
    <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4">
      <p className="text-sm font-semibold text-white">Positioning stack</p>
      <p className="text-sm text-zinc-500">Why we say full stack brain instead of only memory API.</p>
    </div>
    <div className="flex flex-col items-center justify-center gap-3 p-8 md:p-12">
      <div className="w-full max-w-sm rounded-xl border border-[#EA803A]/30 bg-[#EA803A]/10 px-6 py-5 text-center shadow-lg shadow-black/20">
        <p className="text-[10px] uppercase tracking-widest text-[#EA803A]">Layer 3</p>
        <p className="mt-1 font-bold text-white">Full stack brain</p>
        <p className="mt-1 text-xs text-zinc-400">Memory, reuse, automation rules & control</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-[#7fe3c8]/30 bg-[#7fe3c8]/10 px-6 py-5 text-center shadow-lg shadow-black/20">
        <p className="text-[10px] uppercase tracking-widest text-[#7fe3c8]">Layer 2</p>
        <p className="mt-1 font-bold text-white">Memory + trigger logic</p>
        <p className="mt-1 text-xs text-zinc-400">Deciding exactly when memory should run</p>
      </div>
      <div className="w-full max-w-lg rounded-xl border border-[#5d89ff]/30 bg-[#5d89ff]/10 px-6 py-5 text-center shadow-lg shadow-black/20">
        <p className="text-[10px] uppercase tracking-widest text-[#5d89ff]">Layer 1</p>
        <p className="mt-1 font-bold text-white">Memory API</p>
        <p className="mt-1 text-xs text-zinc-400">Base storage and factual retrieval</p>
      </div>
    </div>
  </div>
);

const postBodies = {
  'why-velocitybrain-is-different': () => (
    <>
      <p>
        A lot of AI products now say memory. That word is becoming too small for the real problem teams are dealing with.
      </p>
      <p>
        The actual issue is continuity. People do not only need a place to store facts. They need the right state to appear at the right moment, across the right tool, without rebuilding the same context every session.
      </p>
      <p>
        That is why Velocity Brain is being positioned as a full stack brain layer. We care about memory, but we also care about trigger timing, reuse, workflow continuity, and the control surface that decides how much context should show up before the model starts reasoning.
      </p>
      <StackVisual />
      <h3 className="mb-6 mt-12 text-xl font-bold text-white">Where we differ</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {comparisons.map((item) => (
          <div key={item.name} className="flex flex-col rounded-2xl border border-white/5 bg-white/[0.01] p-6">
            <div className="mb-4 text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{item.name}</div>
            <div className="mb-4 flex-1">
              <span className="block text-xs uppercase tracking-widest text-zinc-500">What they do well</span>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{item.focus}</p>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-widest text-[#EA803A]">Why Velocity Brain is different</span>
              <p className="mt-1 text-sm leading-relaxed text-[#f3ba93]">{item.angle}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[#7fe3c8]/20 bg-[#7fe3c8]/5 p-6">
          <p className="text-xs uppercase tracking-widest text-[#7fe3c8]">Why this matters</p>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">
            If memory only exists as a storage primitive, teams still spend time deciding when to retrieve, what to reuse, and how to avoid bloating prompts. We want that layer to feel operational, not theoretical.
          </p>
        </div>
        <div className="rounded-2xl border border-[#5d89ff]/20 bg-[#5d89ff]/5 p-6">
          <p className="text-xs uppercase tracking-widest text-[#5d89ff]">What we are aiming for</p>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">
            One brain behind many agents, better continuity across sessions, smaller context waste, and a clearer path from simple personal memory all the way to repo-aware coding workflows.
          </p>
        </div>
      </div>
    </>
  ),
  'why-chat-assistants-still-lose-the-day': () => (
    <>
      <p>
        The first trust problem in AI is not whether it can remember you forever. It is whether it can stay correct about today.
      </p>
      <p>
        Hardik's calorie example is a simple version of a larger issue. You log breakfast and dinner into ChatGPT or Claude on the same day, and the assistant later forgets whether the entries were for today, loses the running total, or treats the data as a loose preference instead of dated state.
      </p>
      <p>
        That is not mainly a model-intelligence problem. It is a continuity problem. The system does not have a reliable state layer sitting behind the conversation.
      </p>
      <p>
        We think this matters because users feel this failure immediately. If the assistant cannot hold onto today's calories, today's tasks, or the current repo state, confidence breaks very quickly.
      </p>
      <WorkflowVisual />
      <p>
        A strong continuity layer changes the starting point of the next response. The assistant does not need to reconstruct the day from scratch. It begins with the active state already present.
      </p>
    </>
  ),
  'memory-api-vs-full-stack-brain': () => (
    <>
      <p>
        Most memory products stop at storage and retrieval. VelocityBrain is being shaped as the layer that also decides when memory runs, what gets reused, and how continuity stays stable.
      </p>
      <p>
        A memory API is a useful primitive. It can save facts and fetch them back later. But it still leaves a behavior gap: when should memory run, how much should it inject, and what prior outputs should be reused instead of regenerated?
      </p>
      <p>
        That is why we use the phrase full stack brain. The idea is broader than one retrieval call. It includes memory, reuse, timing, automation rules, and user control.
      </p>
      <StackVisual />
      <h3 className="mb-6 mt-12 text-xl font-bold text-white">How we compare to alternatives</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {comparisons.map((item) => (
          <div key={item.name} className="flex flex-col rounded-2xl border border-white/5 bg-white/[0.01] p-6">
            <div className="mb-4 text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{item.name}</div>
            <div className="mb-4 flex-1">
              <span className="block text-xs uppercase tracking-widest text-zinc-500">Their focus</span>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{item.focus}</p>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-widest text-[#EA803A]">Our angle</span>
              <p className="mt-1 text-sm leading-relaxed text-[#f3ba93]">{item.angle}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  ),
  'how-velocitybrain-fits-behind-agents': () => (
    <>
      <p>
        The goal is not to replace every agent. The goal is to become the reusable continuity layer behind the agents and assistants people already use.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <h3 className="text-lg font-bold text-white">Core workflow</h3>
          <div className="mt-6 space-y-4">
            {[
              'The user asks inside ChatGPT, Claude, Codex, Hermes, or another assistant.',
              'VelocityBrain checks whether useful prior state exists.',
              'Only the useful memory is surfaced back into the next reasoning step.',
              'The assistant answers with less repetition and better continuity.',
              'Useful outcomes can be saved again for the next run.',
            ].map((step, index) => (
              <div key={step} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5d89ff]/10 text-xs font-bold text-[#5d89ff]">
                  {index + 1}
                </div>
                <p className="text-[15px] leading-relaxed text-zinc-300">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">Why it matters technically</h3>
          <div className="prose-content mt-6 space-y-6 text-[15px] leading-relaxed text-zinc-400">
            <p>
              Agent quality often looks like a model problem, but part of it is repeated context spend. Every run pays again to rebuild state that could have been preserved.
            </p>
            <p>
              With a dedicated brain layer, the agent can start from a better place without needing the whole conversation or repo history in every prompt.
            </p>
            <p>
              That means lower drift, lower repeated context cost, and better continuity across sessions.
            </p>
          </div>
        </div>
      </div>
    </>
  ),
  'from-calories-to-repo-continuity': () => (
    <>
      <p>
        The same broken-memory pattern appears in personal assistants, study tools, work copilots, and coding agents. That makes the product bigger than one narrow workflow.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 md:p-8">
          <h3 className="text-base font-semibold text-white">Hardik's calorie problem</h3>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Morning</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">Breakfast gets logged in chat.</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-[#EA803A]">Later</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">The assistant forgets it was for today.</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-[#7fe3c8]">With VelocityBrain</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">Today's log, totals, and timeline stay intact.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 md:p-8">
          <h3 className="text-base font-semibold text-white">The pattern repeats everywhere</h3>
          <div className="mt-6 flex flex-wrap gap-2">
            {['Food logs', 'Study plans', 'Weekly goals', 'Open tasks', 'Project continuity', 'Repo context'].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Automatic or explicit</h3>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
            Users should be able to tag VelocityBrain when they want it, or configure it to run automatically on every query. The control layer matters because different workflows need different memory behavior.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Why this compounds</h3>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
            Once continuity works for simple daily problems, the same foundation can support deeper workflows: coding agents, multi-session planning, model-agnostic memory, and reusable project context.
          </p>
        </div>
      </div>
    </>
  ),
};

const posts = [
  {
    slug: 'why-velocitybrain-is-different',
    category: 'Comparison',
    title: 'Why Velocity Brain is different from Mem0, Zep, Letta, Hyperspell, and Hermes',
    summary:
      'The difference is not only memory. It is timing, reuse, continuity, and one shared brain layer across many agents.',
    description:
      'Why we position Velocity Brain as a full stack brain layer instead of only a memory API, a single agent, or a simple retrieval add-on.',
    date: 'May 3, 2026',
    readTime: '5 min read',
    accent: '#7fe3c8',
  },
  {
    slug: 'why-chat-assistants-still-lose-the-day',
    category: 'User memory',
    title: 'Why chat assistants still lose the day',
    summary:
      'The common failure is not intelligence. It is broken day-level state across calories, tasks, routines, and plans.',
    description:
      'The biggest trust failure in AI is not long-term memory. It is short-horizon continuity: what happened today, what is still true, and what should carry forward into the next answer.',
    date: 'May 3, 2026',
    readTime: '4 min read',
    accent: '#EA803A',
    featured: true,
  },
  {
    slug: 'memory-api-vs-full-stack-brain',
    category: 'Positioning',
    title: 'Memory API vs full stack brain',
    summary:
      'Storage and retrieval are useful primitives, but they are not enough to run a trustworthy continuity layer behind AI.',
    description:
      'Why a memory API is only one layer, and why VelocityBrain is being designed as a broader continuity system.',
    date: 'May 2, 2026',
    readTime: '5 min read',
    accent: '#7fe3c8',
  },
  {
    slug: 'how-velocitybrain-fits-behind-agents',
    category: 'Workflow',
    title: 'How VelocityBrain fits behind agents',
    summary:
      'Agents should not be replaced. They should be improved with a brain layer that injects continuity before models spend tokens again.',
    description:
      'A practical model for fitting VelocityBrain behind ChatGPT, Claude, Codex, Hermes, and other assistants.',
    date: 'May 1, 2026',
    readTime: '4 min read',
    accent: '#5d89ff',
  },
  {
    slug: 'from-calories-to-repo-continuity',
    category: 'Use cases',
    title: 'From calories to repo continuity',
    summary:
      'The same memory problem appears in personal assistants, coding agents, study tools, and recurring repo work.',
    description:
      'The continuity problem shows up in food logs, routines, study plans, open tasks, and ongoing code work.',
    date: 'April 30, 2026',
    readTime: '6 min read',
    accent: '#f2b07d',
  },
].map((post) => ({
  ...post,
  renderBody: postBodies[post.slug],
}));

const featuredPost = posts.find((post) => post.featured) || posts[0];

const Shell = ({ children }) => (
  <div className="min-h-screen bg-[#070707] text-white selection:bg-[#EA803A] selection:text-black" style={{ fontFamily: 'DM Sans, sans-serif' }}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
      
      /* Base typography classes for articles to ensure elegant spacing */
      .prose-content p {
        margin-bottom: 1.5rem;
        line-height: 1.8;
      }
      .prose-content p:last-child {
        margin-bottom: 0;
      }
    `}</style>
    <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(234,128,58,0.18),transparent_46%),radial-gradient(circle_at_80%_10%,rgba(93,137,255,0.12),transparent_28%)]" />
    {children}
  </div>
);

const TopNav = () => (
  <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-8">
    <Link to="/" className="flex items-center gap-3">
      <img src="/logo.png" alt="Velocity Brain" className="h-9 w-9 rounded-xl" />
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">VelocityBrain</p>
        <p className="text-sm font-semibold text-white">Research</p>
      </div>
    </Link>
    <div className="flex items-center gap-4">
      <Link
        to="/docs"
        className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
      >
        Docs
      </Link>
      <Link
        to="/login"
        className="rounded-full bg-[#EA803A] px-5 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90"
      >
        Start Free
      </Link>
    </div>
  </nav>
);

const MetaRow = ({ post }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-500">
    <span>{post.date}</span>
    <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
    <span>{post.readTime}</span>
    <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />
    <span>VelocityBrain Research</span>
  </div>
);

const PostCard = ({ post, featured = false }) => (
  <Link
    to={`/research/${post.slug}`}
    className={`group block overflow-hidden rounded-2xl border border-white/5 bg-white/[0.01] transition-colors hover:bg-white/[0.03] ${featured ? 'h-full p-8 md:p-12' : 'h-full p-6 md:p-8'}`}
  >
    <div className="mb-6 flex items-center justify-between gap-3">
      <span
        className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]"
        style={{ borderColor: `${post.accent}40`, color: post.accent, background: `${post.accent}12` }}
      >
        {post.category}
      </span>
      <span className="text-xs text-zinc-500">{post.readTime}</span>
    </div>

    <h2
      className={`${featured ? 'max-w-2xl text-4xl md:text-5xl' : 'text-2xl'} font-extrabold leading-[1.1] tracking-[-0.03em] text-white`}
      style={{ fontFamily: 'Syne, sans-serif' }}
    >
      {post.title}
    </h2>

    <p className={`${featured ? 'mt-6 max-w-xl text-lg' : 'mt-4 text-[15px]'} leading-relaxed text-zinc-400`}>
      {featured ? post.description : post.summary}
    </p>

    <div className="mt-8 flex items-center justify-between gap-4">
      <MetaRow post={post} />
      <span className="text-sm font-semibold text-white">Read</span>
    </div>
  </Link>
);

const ResearchIndex = () => {
  const latestPosts = posts.filter((post) => post.slug !== featuredPost.slug);

  return (
    <Shell>
      <TopNav />

      <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-4">
        <section className="pb-16 pt-4">
          <PostCard post={featuredPost} featured />
        </section>

        <section className="border-t border-white/10 pt-16">
          <div className="mb-10">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Latest posts</p>
            <h2 className="mt-2 text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Research archive
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {latestPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
};

const ResearchArticle = () => {
  const { slug } = useParams();
  const postIndex = posts.findIndex((item) => item.slug === slug);
  const post = postIndex >= 0 ? posts[postIndex] : null;

  if (!post) {
    return <Navigate to="/research" replace />;
  }

  const relatedPosts = posts.filter((item) => item.slug !== post.slug).slice(0, 3);
  const nextPost = posts[(postIndex + 1) % posts.length];
  const Body = post.renderBody;

  return (
    <Shell>
      <TopNav />

      <main className="mx-auto grid w-full max-w-7xl gap-12 px-6 pb-24 pt-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <Link to="/research" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white">
            <span aria-hidden="true">←</span> Back to research
          </Link>

          <header className="mt-8 border-b border-white/10 pb-10">
            <span
              className="inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]"
              style={{ borderColor: `${post.accent}40`, color: post.accent, background: `${post.accent}12` }}
            >
              {post.category}
            </span>
            <h1
              className="mt-8 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] text-white md:text-5xl lg:text-6xl"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {post.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              {post.description}
            </p>
            <div className="mt-8">
              <MetaRow post={post} />
            </div>
          </header>

          <div className="mt-12">
            <div className="prose-content max-w-none text-lg text-zinc-300">
              <Body />
            </div>
          </div>

          <div className="mt-20 flex flex-col gap-5 rounded-2xl border border-white/5 bg-white/[0.01] p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Next article</p>
              <p className="mt-2 text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                {nextPost.title}
              </p>
            </div>
            <Link
              to={`/research/${nextPost.slug}`}
              className="rounded-full bg-[#EA803A] px-6 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
            >
              Continue reading
            </Link>
          </div>
        </article>

        <aside className="space-y-8 lg:sticky lg:top-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">On this page</p>
            <h2 className="mt-2 text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              More research
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {relatedPosts.map((item) => (
                <Link
                  key={item.slug}
                  to={`/research/${item.slug}`}
                  className="group block rounded-xl border border-white/5 bg-white/[0.01] p-4 transition-colors hover:bg-white/[0.03]"
                >
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: item.accent }}>
                    {item.category}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-300 transition-colors group-hover:text-white">
                    {item.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(234,128,58,0.1),transparent_70%),#0a0a0c] p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Explore</p>
            <h2 className="mt-2 text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Build with the docs
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Move from research into implementation with setup guides, integrations, and architecture notes.
            </p>
            <Link
              to="/docs"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-[#EA803A]/30 bg-[#EA803A]/10 px-4 py-2.5 text-sm font-semibold text-[#f3ba93] transition-colors hover:bg-[#EA803A]/20"
            >
              Open docs
            </Link>
          </div>
        </aside>
      </main>
    </Shell>
  );
};

const Research = () => {
  const { slug } = useParams();
  return slug ? <ResearchArticle /> : <ResearchIndex />;
};

export default Research;
