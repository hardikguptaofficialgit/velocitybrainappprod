import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Cpu, Database, Terminal, Zap, Menu, X } from '../components/Icons';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

// --- Markdown Parser ---
function renderInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>');
}

function tokenize(markdown) {
  const tokens = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || 'text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      tokens.push({ type: 'code', lang, raw: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      tokens.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    if (/^[-*_]{3,}\s*$/.test(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      tokens.push({ type: 'blockquote', text: quoteLines.join(' ') });
      continue;
    }

    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s\-|:]+\|/.test(lines[i + 1])) {
      const parseRow = (row) => {
        const cells = row.split('|').map((cell) => cell.trim());
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        return cells;
      };

      const headers = parseRow(line);
      i += 2;
      const rows = [];

      while (i < lines.length && lines[i].includes('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }

      tokens.push({ type: 'table', headers, rows });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].startsWith('```') &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].startsWith('> ') &&
      !/^[-*_]{3,}\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return tokens;
}

function stripDuplicateLeadingHeading(markdown, pageTitle) {
  if (!markdown) return markdown;

  const escapedTitle = pageTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicateHeadingPattern = new RegExp(`^#\\s+${escapedTitle}\\s*\\r?\\n+`, 'i');

  return markdown.replace(duplicateHeadingPattern, '');
}

function MarkdownRenderer({ content }) {
  const tokens = tokenize(content);

  return (
    <div className="md-body pb-16">
      {tokens.map((token, idx) => {
        switch (token.type) {
          case 'heading': {
            const id = token.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const sizes = ['', 'md-h1', 'md-h2', 'md-h3', 'md-h4', 'md-h5', 'md-h6'];
            return (
              <div
                key={idx}
                id={id}
                className={sizes[token.level]}
                dangerouslySetInnerHTML={{ __html: renderInline(token.text) }}
              />
            );
          }
          case 'paragraph':
            return (
              <p
                key={idx}
                className="md-p"
                dangerouslySetInnerHTML={{ __html: renderInline(token.text) }}
              />
            );
          case 'code':
            return (
              <div key={idx} className="md-code-block group">
                <div className="md-code-header">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#333] group-hover:bg-[#FF5F56] transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#333] group-hover:bg-[#FFBD2E] transition-colors" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#333] group-hover:bg-[#27C93F] transition-colors" />
                  </div>
                  {token.lang && <span className="md-code-lang">{token.lang}</span>}
                </div>
                <pre><code>{token.raw}</code></pre>
              </div>
            );
          case 'ul':
            return (
              <ul key={idx} className="md-ul">
                {token.items.map((item, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="md-ol">
                {token.items.map((item, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                ))}
              </ol>
            );
          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="md-blockquote"
                dangerouslySetInnerHTML={{ __html: renderInline(token.text) }}
              />
            );
          case 'hr':
            return <hr key={idx} className="md-hr" />;
          case 'table':
            return (
              <div key={idx} className="md-table-wrap">
                <table className="md-table">
                  <thead>
                    <tr>
                      {token.headers.map((header, j) => (
                        <th key={j} dangerouslySetInnerHTML={{ __html: renderInline(header) }} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {token.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} dangerouslySetInnerHTML={{ __html: renderInline(cell) }} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

// --- Configuration ---
const docMap = {
  '/docs': 'getting-started.md',
  '/docs/cli': 'cli-workflows.md',
  '/docs/mcp': 'mcp-setup.md',
  '/docs/integrations': 'agent-integrations.md',
  '/docs/token-efficiency': 'token-efficiency.md',
  '/docs/architecture': 'architecture.md',
};

const navigation = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    path: '/docs',
    icon: <Zap className="w-4 h-4" />,
    description: 'Hosted setup and first connection flow.',
  },
  {
    id: 'cli',
    title: 'CLI Workflows',
    path: '/docs/cli',
    icon: <Terminal className="w-4 h-4" />,
    description: 'Core commands for query, ingest, and run.',
  },
  {
    id: 'mcp',
    title: 'MCP Setup',
    path: '/docs/mcp',
    icon: <Database className="w-4 h-4" />,
    description: 'Connect Codex, Claude, Hermes, and others.',
  },
  {
    id: 'integrations',
    title: 'Agent Integrations',
    path: '/docs/integrations',
    icon: <Cpu className="w-4 h-4" />,
    description: 'How Velocity Brain fits behind your agents.',
  },
  {
    id: 'token-efficiency',
    title: 'Token Efficiency',
    path: '/docs/token-efficiency',
    icon: <Zap className="w-4 h-4" />,
    description: 'Where savings come from and how reuse works.',
  },
  {
    id: 'architecture',
    title: 'Architecture',
    path: '/docs/architecture',
    icon: <Cpu className="w-4 h-4" />,
    description: 'High-level system shape and runtime boundaries.',
  },
];

const pageDescriptions = {
  '/docs': 'Essential setup and onboarding for Velocity Brain.',
  '/docs/cli': 'The minimum command surface you need to use the CLI effectively.',
  '/docs/mcp': 'Practical MCP setup for supported clients.',
  '/docs/integrations': 'How Velocity Brain behaves as a shared brain layer.',
  '/docs/token-efficiency': 'Simple explanation of reuse and token savings.',
  '/docs/architecture': 'A clean overview of how the system is structured.',
};

// --- Main Component ---
const Documentation = () => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentDoc = docMap[location.pathname] || 'CLIENT_INTEGRATIONS.md';
  const currentNavItem = navigation.find((item) => item.path === location.pathname) || navigation[0];
  const pageDescription = pageDescriptions[location.pathname] || pageDescriptions['/docs'];
  const renderedDocContent = useMemo(
    () => stripDuplicateLeadingHeading(docContent, currentNavItem.title),
    [docContent, currentNavItem.title]
  );
  const accountHref = user ? (user.onboardingCompleted ? '/dashboard' : '/onboarding') : '/login';
  const accountLabel = authLoading ? 'Checking...' : user ? (user.onboardingCompleted ? 'Dashboard' : 'Continue Setup') : 'Sign in';
  const primaryCtaLabel = authLoading ? 'Loading...' : user ? (user.onboardingCompleted ? 'Open Dashboard' : 'Continue Setup') : 'Start Free';

  useEffect(() => {
    let cancelled = false;
    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      setDocContent('');
      try {
        const response = await fetch(`/docs-content/${currentDoc}`);
        if (!response.ok) throw new Error(`HTTP ${response.status} - Failed to load documentation`);
        const text = await response.text();
        if (!cancelled) setDocContent(text);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDoc();
    setMobileMenuOpen(false); // Close mobile menu on navigate
    return () => {
      cancelled = true;
    };
  }, [currentDoc]);

  const essentialLinks = useMemo(() => navigation.slice(0, 6), []);

  return (
    <>
      <style>{`
        /* Refined Typography and Markdown Styles */
        .md-body {
          color: #a1a1aa; /* text-zinc-400 */
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
          font-size: 1rem;
          line-height: 1.75;
        }
        .md-body strong {
          color: #e4e4e7; /* text-zinc-200 */
          font-weight: 600;
        }
        .md-h1, .md-h2, .md-h3, .md-h4 {
          font-family: 'Syne', sans-serif;
          color: #ffffff;
          scroll-margin-top: 100px;
        }
        .md-h1 {
          font-size: 2.25rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 3rem 0 1.5rem;
        }
        .md-h2 {
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 2.5rem 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .md-h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #e4e4e7;
          margin: 2rem 0 0.75rem;
        }
        .md-p {
          margin: 0 0 1.25rem;
        }
        .md-code-block {
          margin: 1.5rem 0;
          background: #09090b; /* zinc-950 */
          border: 1px solid #27272a; /* zinc-800 */
          border-radius: 12px;
          overflow: hidden;
        }
        .md-code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #18181b; /* zinc-900 */
          border-bottom: 1px solid #27272a;
        }
        .md-code-lang {
          font-size: 0.7rem;
          font-family: 'JetBrains Mono', monospace;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .md-code-block pre {
          margin: 0;
          padding: 1.25rem 1rem;
          overflow-x: auto;
        }
        .md-code-block pre code {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.875rem;
          color: #d4d4d8;
          line-height: 1.6;
        }
        .md-inline-code {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.85em;
          color: #e4e4e7;
          background: #18181b; /* zinc-900 */
          border: 1px solid #27272a;
          padding: 0.2em 0.4em;
          border-radius: 6px;
        }
        .md-ul, .md-ol {
          margin: 0 0 1.5rem;
          padding-left: 1.5rem;
        }
        .md-ul li {
          list-style-type: disc;
          margin-bottom: 0.5rem;
        }
        .md-ul li::marker {
          color: #52525b; /* zinc-600 */
        }
        .md-ol li {
          list-style-type: decimal;
          margin-bottom: 0.5rem;
        }
        .md-blockquote {
          margin: 1.5rem 0;
          padding: 1rem 1.25rem;
          border-left: 4px solid #EA803A;
          background: linear-gradient(90deg, rgba(234,128,58,0.08) 0%, transparent 100%);
          border-radius: 0 8px 8px 0;
          color: #d4d4d8;
          font-style: italic;
        }
        .md-hr {
          border: none;
          border-top: 1px solid #27272a;
          margin: 3rem 0;
        }
        .md-link {
          color: #EA803A;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }
        .md-link:hover {
          color: #fca5a5;
          text-decoration: underline;
        }
        .md-table-wrap {
          overflow-x: auto;
          margin: 2rem 0;
          border: 1px solid #27272a;
          border-radius: 10px;
        }
        .md-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .md-table thead tr {
          background: #18181b;
        }
        .md-table th {
          padding: 12px 16px;
          text-align: left;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
          color: #e4e4e7;
          border-bottom: 1px solid #27272a;
        }
        .md-table td {
          padding: 12px 16px;
          color: #a1a1aa;
          border-bottom: 1px solid #1f1f22;
        }
        .md-table tr:last-child td {
          border-bottom: none;
        }
      `}</style>

      <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-[#EA803A]/30 selection:text-white">
        {/* Sticky Global Header */}
        <header className="sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-[90rem] mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <Logo size={28} />
              <span className="text-white font-bold text-lg tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                VelocityBrain
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-4">
              <Link to="/research" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                Research
              </Link>
              <div className="w-px h-4 bg-zinc-800" />
              <Link to={accountHref} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                {accountLabel}
              </Link>
              <Link
                to={accountHref}
                className="rounded-full bg-white/10 hover:bg-white/20 px-4 py-1.5 text-sm font-semibold text-white transition-all backdrop-blur-md border border-white/10"
              >
                {primaryCtaLabel}
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 text-zinc-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div className="max-w-[90rem] mx-auto px-6 flex items-start gap-12 pt-8 pb-20">
          
          {/* Left Sidebar (Desktop) */}
          <aside className={`fixed inset-0 z-40 bg-[#09090b] md:bg-transparent md:sticky md:top-24 md:w-64 md:shrink-0 md:block ${mobileMenuOpen ? 'block pt-20 px-6' : 'hidden'}`}>
            <div className="pb-8">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Documentation
              </p>
              <nav className="flex flex-col space-y-1">
                {essentialLinks.map((item) => {
                  const isActive = item.path === location.pathname;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-[#EA803A]/10 text-[#EA803A] font-medium'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-[#EA803A]' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                        {item.icon}
                      </span>
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 max-w-3xl">
            <div className="mb-10">
              <h1
                className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {currentNavItem.title}
              </h1>
              <p className="text-lg text-zinc-400 leading-relaxed">
                {pageDescription}
              </p>
            </div>

            <div className="min-h-[400px]">
              {loading ? (
                <div className="flex items-center gap-3 py-12 text-sm font-medium text-zinc-500 animate-pulse">
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                  Loading content...
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6">
                  <p className="font-medium text-red-400 mb-2">Unable to load documentation</p>
                  <p className="text-sm text-red-400/70 font-mono">
                    {error}
                  </p>
                </div>
              ) : (
                <MarkdownRenderer content={renderedDocContent} />
              )}
            </div>

            {!loading && !error && (
              <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-r from-zinc-900 to-transparent p-8 rounded-2xl border border-white/5">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Ready to implement?
                  </h2>
                  <p className="text-sm text-zinc-400 max-w-md">
                    Connect your client and start mapping memory with the smallest useful surface first.
                  </p>
                </div>
                <Link
                  to={accountHref}
                  className="group flex items-center gap-2 rounded-full bg-[#EA803A] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#f39556] transition-colors whitespace-nowrap shadow-[0_0_20px_rgba(234,128,58,0.2)]"
                >
                  {user ? (user.onboardingCompleted ? 'Open Dashboard' : 'Continue Setup') : 'Start Building'} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            )}
          </main>
          
          {/* Right Sidebar (Table of Contents placeholder for future scaling) */}
          <aside className="hidden xl:block w-48 shrink-0 relative">
            <div className="sticky top-24">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                On this page
              </p>
              <div className="text-sm text-zinc-500 space-y-2">
                <p>Scroll spy / TOC will</p>
                <p>populate here based</p>
                <p>on markdown headers.</p>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </>
  );
};

export default Documentation;
