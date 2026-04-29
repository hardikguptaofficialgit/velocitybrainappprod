import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ChevronRight, ChevronDown, Terminal, Zap, Shield, Database, Cpu, Activity, ArrowRight } from '../components/Icons';
import Logo from '../components/Logo';

// ─── Inline markdown → HTML string ──────────────────────────────────────────
function renderInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>');
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────
function tokenize(markdown) {
  const tokens = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      tokens.push({ type: 'code', lang, raw: codeLines.join('\n') });
      continue;
    }

    // Heading
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

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      tokens.push({ type: 'blockquote', text: quoteLines.join(' ') });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s\-|:]+\|/.test(lines[i + 1])) {
      const parseRow = (r) => {
        const cells = r.split('|').map((c) => c.trim());
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        return cells;
      };
      const headers = parseRow(line);
      i += 2; // skip separator
      const rows = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      tokens.push({ type: 'table', headers, rows });
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
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

// ─── Markdown Renderer Component ─────────────────────────────────────────────
function MarkdownRenderer({ content, isLightMode }) {
  const tokens = tokenize(content);

  return (
    <div className={`md-body ${isLightMode ? 'light-mode' : ''}`}>
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
              <div key={idx} className="md-code-block">
                {token.lang && <span className="md-code-lang">{token.lang}</span>}
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
                      {token.headers.map((h, j) => (
                        <th key={j} dangerouslySetInnerHTML={{ __html: renderInline(h) }} />
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

// ─── Main Documentation Component ────────────────────────────────────────────
const Documentation = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [isLightMode, setIsLightMode] = useState(false);
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const docMap = {
    '/docs': 'CLIENT_INTEGRATIONS.md',
    '/docs/cli': 'WORKFLOWS.md',
    '/docs/mcp': 'CLIENT_INTEGRATIONS.md',
    '/docs/security': 'ENHANCED_FEATURES.md',
    '/docs/api': 'API_DESIGN.md',
    '/docs/architecture': 'ARCHITECTURE.md',
    '/docs/advanced': 'ADVANCED_FEATURES.md',
    '/docs/production': 'PRODUCTION_DEPLOYMENT.md',
    '/docs/skills': 'SKILL_SYSTEM.md',
    '/docs/agent': 'AGENT_LOOP.md',
  };

  const currentDoc = docMap[location.pathname] || 'CLIENT_INTEGRATIONS.md';

  const navigation = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <Zap className="w-4 h-4" />,
      path: '/docs',
      subsections: ['Integration Model', 'Prerequisites', 'MCP Server Command'],
    },
    {
      id: 'cli-reference',
      title: 'CLI Reference',
      icon: <Terminal className="w-4 h-4" />,
      path: '/docs/cli',
      subsections: ['Ingestion Workflow', 'Query Workflow', 'Enrichment Workflow', 'Execution Workflow'],
    },
    {
      id: 'mcp-setup',
      title: 'MCP Setup',
      icon: <Database className="w-4 h-4" />,
      path: '/docs/mcp',
      subsections: ['Claude Code CLI', 'Verification', 'Setup Script'],
    },
    {
      id: 'architecture',
      title: 'Architecture',
      icon: <Cpu className="w-4 h-4" />,
      path: '/docs/architecture',
      subsections: ['System Topology', 'Core Design Decisions', 'Runtime Boundaries'],
    },
    {
      id: 'advanced',
      title: 'Advanced Features',
      icon: <Activity className="w-4 h-4" />,
      path: '/docs/advanced',
      subsections: ['AI-Powered Intelligence', 'Semantic Understanding', 'Predictive Analytics'],
    },
    {
      id: 'skills',
      title: 'Skill System',
      icon: <Shield className="w-4 h-4" />,
      path: '/docs/skills',
      subsections: ['Skill Contract', 'Runtime Flow', 'Skill Categories'],
    },
    {
      id: 'agent',
      title: 'Agent Loop',
      icon: <Cpu className="w-4 h-4" />,
      path: '/docs/agent',
      subsections: ['Loop Stages', 'Safety Behavior', 'Run Output'],
    },
    {
      id: 'security',
      title: 'Security & API',
      icon: <Shield className="w-4 h-4" />,
      path: '/docs/security',
      subsections: ['Enhanced Features', 'Codebase Indexing', 'Call Graph Analysis'],
    },
    {
      id: 'api',
      title: 'API Design',
      icon: <Activity className="w-4 h-4" />,
      path: '/docs/api',
      subsections: ['Core Runtime', 'OpenClaw Discovery', 'MCP Tool Surface'],
    },
    {
      id: 'production',
      title: 'Production',
      icon: <Activity className="w-4 h-4" />,
      path: '/docs/production',
      subsections: ['Deployment', 'Monitoring', 'Scaling'],
    },
  ];

  const generateTOC = (content) => {
    const headings = content.match(/^#{1,3}\s+.+$/gm) || [];
    return headings.map((heading) => {
      const level = (heading.match(/^#+/) || [''])[0].length;
      const title = heading.replace(/^#+\s+/, '');
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return { id, title, level };
    });
  };

  const tocSections = generateTOC(docContent);

  const toggleSection = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('.md-body [id]');
      let current = '';
      headings.forEach((el) => {
        if (window.scrollY >= el.offsetTop - 120) {
          current = el.id;
        }
      });
      setActiveSection(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      setDocContent('');
      try {
        const response = await fetch(`/docs/${currentDoc}`);
        if (!response.ok) throw new Error(`HTTP ${response.status} – Failed to load documentation`);
        const text = await response.text();
        if (!cancelled) setDocContent(text);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDoc();
    return () => { cancelled = true; };
  }, [currentDoc]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Try to find a heading that contains the text
      const headings = document.querySelectorAll('.md-body [id]');
      for (const heading of headings) {
        if (heading.textContent.toLowerCase().includes(id.replace(/-/g, ' '))) {
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    }
  };

  const filteredNavigation = navigation.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subsections.some((sub) => sub.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentNavItem = navigation.find((item) => item.path === location.pathname);

  return (
    <>
      <style>{`
        /* ── Markdown body ── */
        .md-body {
          color: #c9c9c9;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 15px;
          line-height: 1.8;
        }

        /* Light mode overrides */
        .md-body.light-mode {
          color: #4A4540;
        }

        /* Headings */
        .md-h1 {
          font-family: 'Syne', sans-serif;
          font-size: 2rem;
          font-weight: 800;
          color: #ffffff;
          margin: 2.5rem 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #2a2a2a;
        }
        .md-body.light-mode .md-h1 {
          color: #2D2A26;
          border-bottom-color: #E8D5C4;
        }
        .md-h2 {
          font-family: 'Syne', sans-serif;
          font-size: 1.45rem;
          font-weight: 700;
          color: #f0f0f0;
          margin: 2rem 0 0.75rem;
          padding-bottom: 0.35rem;
          border-bottom: 1px solid #1e1e1e;
        }
        .md-body.light-mode .md-h2 {
          color: #3D3A36;
          border-bottom-color: #E8D5C4;
        }
        .md-h3 {
          font-family: 'Syne', sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          color: #EA803A;
          margin: 1.5rem 0 0.5rem;
        }
        .md-body.light-mode .md-h3 {
          color: #E8A078;
        }
        .md-h4 {
          font-family: 'Syne', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: #c0c0c0;
          margin: 1.25rem 0 0.4rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .md-body.light-mode .md-h4 {
          color: #6B5D52;
        }
        .md-h5, .md-h6 {
          font-size: 0.9rem;
          font-weight: 600;
          color: #909090;
          margin: 1rem 0 0.3rem;
        }
        .md-body.light-mode .md-h5, .md-body.light-mode .md-h6 {
          color: #7A6B60;
        }

        /* Paragraph */
        .md-p {
          margin: 0 0 1rem;
          color: #a8a8a8;
        }
        .md-body.light-mode .md-p {
          color: #5A5148;
        }

        /* Code block */
        .md-code-block {
          position: relative;
          margin: 1.25rem 0;
          background: #0d0d0d;
          border: 1px solid #252525;
          border-radius: 10px;
          overflow: hidden;
        }
        .md-body.light-mode .md-code-block {
          background: #FFF9F5;
          border-color: #E8D5C4;
        }
        .md-code-lang {
          position: absolute;
          top: 10px;
          right: 14px;
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
          color: #EA803A;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.75;
          pointer-events: none;
        }
        .md-body.light-mode .md-code-lang {
          color: #E8A078;
        }
        .md-code-block pre {
          margin: 0;
          padding: 1.25rem 1.5rem;
          overflow-x: auto;
        }
        .md-code-block pre code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #c9d1d9;
          line-height: 1.7;
          background: none;
          padding: 0;
          border: none;
          border-radius: 0;
        }
        .md-body.light-mode .md-code-block pre code {
          color: #3D3A36;
        }
        .md-code-block pre::-webkit-scrollbar { height: 5px; }
        .md-code-block pre::-webkit-scrollbar-track { background: transparent; }
        .md-code-block pre::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .md-body.light-mode .md-code-block pre::-webkit-scrollbar-thumb { background: #E8D5C4; }

        /* Inline code */
        .md-inline-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.82em;
          color: #EA803A;
          background: rgba(234,128,58,0.1);
          border: 1px solid rgba(234,128,58,0.2);
          padding: 0.1em 0.4em;
          border-radius: 4px;
        }
        .md-body.light-mode .md-inline-code {
          color: #E8A078;
          background: rgba(232,160,120,0.15);
          border-color: rgba(232,160,120,0.3);
        }

        /* Lists */
        .md-ul {
          list-style: none;
          padding-left: 1.25rem;
          margin: 0.25rem 0 1rem;
          color: #a8a8a8;
        }
        .md-body.light-mode .md-ul {
          color: #5A5148;
        }
        .md-ul li {
          position: relative;
          margin: 0.3rem 0;
          padding-left: 0.25rem;
        }
        .md-ul li::before {
          content: '›';
          position: absolute;
          left: -1rem;
          color: #EA803A;
          font-weight: bold;
          font-size: 1.1em;
        }
        .md-body.light-mode .md-ul li::before {
          color: #E8A078;
        }
        .md-ol {
          padding-left: 1.5rem;
          margin: 0.25rem 0 1rem;
          color: #a8a8a8;
        }
        .md-body.light-mode .md-ol {
          color: #5A5148;
        }
        .md-ol li {
          margin: 0.3rem 0;
        }
        .md-ol li::marker {
          color: #EA803A;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85em;
        }
        .md-body.light-mode .md-ol li::marker {
          color: #E8A078;
        }

        /* Blockquote */
        .md-blockquote {
          margin: 1rem 0;
          padding: 0.75rem 1.25rem;
          border-left: 3px solid #EA803A;
          background: rgba(234,128,58,0.05);
          border-radius: 0 6px 6px 0;
          color: #888;
          font-style: italic;
        }
        .md-body.light-mode .md-blockquote {
          border-left-color: #E8A078;
          background: rgba(232,160,120,0.1);
          color: #6B5D52;
        }

        /* HR */
        .md-hr {
          border: none;
          border-top: 1px solid #232323;
          margin: 2rem 0;
        }
        .md-body.light-mode .md-hr {
          border-top-color: #E8D5C4;
        }

        /* Link */
        .md-link {
          color: #EA803A;
          text-decoration: none;
          border-bottom: 1px solid rgba(234,128,58,0.3);
          transition: border-color 0.15s;
        }
        .md-body.light-mode .md-link {
          color: #E8A078;
          border-bottom-color: rgba(232,160,120,0.4);
        }
        .md-link:hover { border-color: #EA803A; }
        .md-body.light-mode .md-link:hover { border-color: #E8A078; }

        /* Table */
        .md-table-wrap {
          overflow-x: auto;
          margin: 1.25rem 0;
          border-radius: 8px;
          border: 1px solid #252525;
        }
        .md-body.light-mode .md-table-wrap {
          border-color: #E8D5C4;
        }
        .md-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        .md-table thead tr { background: #111; }
        .md-body.light-mode .md-table thead tr { background: #FFF9F5; }
        .md-table th {
          padding: 10px 14px;
          text-align: left;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #EA803A;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-bottom: 1px solid #252525;
        }
        .md-body.light-mode .md-table th {
          color: #E8A078;
          border-bottom-color: #E8D5C4;
        }
        .md-table td {
          padding: 9px 14px;
          color: #a8a8a8;
          border-bottom: 1px solid #1a1a1a;
        }
        .md-body.light-mode .md-table td {
          color: #5A5148;
          border-bottom-color: #E8D5C4;
        }
        .md-table tr:last-child td { border-bottom: none; }
        .md-table tr:hover td { background: rgba(255,255,255,0.02); }
        .md-body.light-mode .md-table tr:hover td { background: rgba(232,213,196,0.3); }
      `}</style>

      <div className={`min-h-screen transition-colors duration-300 ${isLightMode ? 'bg-[#FDF8F5] text-[#2D2A26]' : 'bg-[#080808] text-white'}`}>

        {/* ── Left Sidebar ── */}
        <aside className={`fixed left-0 top-0 h-full w-64 border-r overflow-y-auto z-20 transition-colors duration-300 ${isLightMode ? 'border-[#E8D5C4] bg-[#FFF9F5]' : 'border-[#1c1c1c] bg-[#090909]'}`}>
          <div className="p-4">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <Logo size={32} />
              <span className={`font-bold text-sm ${isLightMode ? 'text-[#2D2A26]' : 'text-white'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
                VelocityBrain
              </span>
            </Link>

            {/* Search */}
            <div className="relative mb-4">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLightMode ? 'text-[#9A8B7A]' : 'text-zinc-500'}`} />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none transition-colors ${
                  isLightMode 
                    ? 'bg-[#FFF9F5] border-[#E8D5C4] text-[#2D2A26] focus:border-[#E8B4A0]' 
                    : 'bg-[#111] border-[#2a2a2a] text-white focus:border-[#EA803A]'
                }`}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            {/* Light/Dark Mode Toggle */}
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors mb-4 ${
                isLightMode ? 'text-[#6B5D52] hover:bg-[#E8D5C4]/40' : 'text-zinc-400 hover:text-white hover:bg-[#111]'
              }`}
              type="button"
            >
              <span className="text-lg">{isLightMode ? '🌙' : '☀️'}</span>
              {isLightMode ? 'Dark Mode' : 'Light Mode'}
            </button>

            {/* Nav Tree */}
            <nav className="space-y-0.5">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.path;
                const isExpanded = expandedSections[item.id] || false;
                return (
                  <div key={item.id} className="nav-item">
                    <div className="flex items-center">
                      <Link
                        to={item.path}
                        className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? isLightMode ? 'text-[#E8A078] bg-[#FFE8D6]/60' : 'text-[#EA803A] bg-[#EA803A]/10'
                            : isLightMode ? 'text-[#6B5D52] hover:text-[#2D2A26] hover:bg-[#E8D5C4]/40' : 'text-zinc-400 hover:text-white hover:bg-[#111]'
                        }`}
                      >
                        <span className={isActive ? (isLightMode ? 'text-[#E8A078]' : 'text-[#EA803A]') : (isLightMode ? 'text-[#9A8B7A]' : 'text-zinc-500')}>
                          {item.icon}
                        </span>
                        <span>{item.title}</span>
                      </Link>
                      <button
                        onClick={(e) => toggleSection(e, item.id)}
                        className={`p-2 transition-colors focus:outline-none ${isLightMode ? 'text-[#9A8B7A] hover:text-[#6B5D52]' : 'text-zinc-600 hover:text-zinc-400'}`}
                        aria-label="Toggle subsections"
                        type="button"
                      >
                        <ChevronDown
                          className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                        {item.subsections.map((sub) => (
                          <button
                            key={sub}
                            onClick={() => scrollToSection(sub.toLowerCase().replace(/\s+/g, '-'))}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                              isLightMode 
                                ? 'text-[#9A8B7A] hover:text-[#2D2A26] hover:bg-[#E8D5C4]/40' 
                                : 'text-zinc-500 hover:text-white hover:bg-[#111]'
                            }`}
                            type="button"
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="ml-64">
          <div className="flex">
            {/* Reading column */}
            <div className="flex-1 min-w-0 max-w-[820px] mx-auto px-8 py-12">

              {/* Breadcrumb */}
              <div
                className={`text-xs mb-6 flex items-center gap-1.5 ${isLightMode ? 'text-[#9A8B7A]' : 'text-zinc-500'}`}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                <Link to="/" className={`transition-colors ${isLightMode ? 'hover:text-[#E8A078]' : 'hover:text-[#EA803A]'}`}>Home</Link>
                <ChevronRight className="w-3 h-3" />
                <Link to="/docs" className={`transition-colors ${isLightMode ? 'hover:text-[#E8A078]' : 'hover:text-[#EA803A]'}`}>Docs</Link>
                {currentNavItem && location.pathname !== '/docs' && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span className={isLightMode ? 'text-[#6B5D52]' : 'text-zinc-400'}>{currentNavItem.title}</span>
                  </>
                )}
              </div>

              {/* Page header */}
              <div className="mb-10">
                <h1
                  className={`text-4xl font-bold mb-3 ${isLightMode ? 'text-[#2D2A26]' : 'text-white'}`}
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {currentNavItem?.title || 'Documentation'}
                </h1>
                <p className={`text-base ${isLightMode ? 'text-[#6B5D52]' : 'text-zinc-400'}`}>
                  Comprehensive guide to building with VelocityBrain
                </p>
              </div>

              {/* Content */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className={`w-10 h-10 rounded-full border-2 animate-spin ${isLightMode ? 'border-[#E8D5C4] border-t-[#E8A078]' : 'border-[#2a2a2a] border-t-[#EA803A]'}`} />
                  <span
                    className={`text-sm ${isLightMode ? 'text-[#9A8B7A]' : 'text-zinc-500'}`}
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    Loading docs…
                  </span>
                </div>
              ) : error ? (
                <div className={`rounded-xl p-8 text-center ${isLightMode ? 'bg-[#FFE8E8] border border-[#E8B4B4]' : 'bg-red-950/30 border border-red-800/50'}`}>
                  <p className={`font-semibold mb-2 ${isLightMode ? 'text-[#E85D5D]' : 'text-red-400'}`}>Failed to load documentation</p>
                  <p
                    className={`text-sm ${isLightMode ? 'text-[#9A8B7A]' : 'text-zinc-500'}`}
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {error}
                  </p>
                </div>
              ) : (
                <MarkdownRenderer content={docContent} isLightMode={isLightMode} />
              )}

              {/* CTA */}
              {!loading && !error && (
                <div className={`mt-16 pt-10 border-t ${isLightMode ? 'border-[#E8D5C4]' : 'border-[#1c1c1c]'}`}>
                  <h3
                    className={`text-2xl font-bold mb-3 ${isLightMode ? 'text-[#2D2A26]' : 'text-white'}`}
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    Ready to get started?
                  </h3>
                  <p className={`mb-6 text-sm ${isLightMode ? 'text-[#6B5D52]' : 'text-zinc-400'}`}>
                    Start building with VelocityBrain today. It is free for everyone for a limited time, with usage limits in place.
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-black text-sm transition-all"
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      background: isLightMode ? '#E8A078' : '#EA803A',
                      boxShadow: isLightMode ? '4px 4px 0 #C48A5C' : '4px 4px 0 #c4612a',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isLightMode ? '#F0B890' : '#f0965a')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isLightMode ? '#E8A078' : '#EA803A')}
                  >
                    Start Free <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* ── Right TOC Sidebar ── */}
            <aside className="hidden xl:block w-60 shrink-0 p-8">
              <div className="sticky top-8">
                {tocSections.length > 0 && (
                  <>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${isLightMode ? 'text-[#9A8B7A]' : 'text-zinc-500'}`}
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      On this page
                    </p>
                    <nav className="space-y-1">
                      {tocSections.map((section) => (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={`block w-full text-left text-xs leading-snug py-0.5 transition-colors ${
                            activeSection === section.id
                              ? isLightMode ? 'text-[#E8A078] font-semibold' : 'text-[#EA803A] font-semibold'
                              : isLightMode ? 'text-[#9A8B7A] hover:text-[#6B5D52]' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                          style={{
                            paddingLeft: `${(section.level - 1) * 10}px`,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {section.title}
                        </button>
                      ))}
                    </nav>
                  </>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
};

export default Documentation;
