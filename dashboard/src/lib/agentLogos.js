export const agentLogoCatalog = {
  'claude-code': {
    sources: [
      'https://svgl.app/library/claude-ai-icon.svg',
      'https://svgl.app/claude-ai-icon.svg',
      'https://svgl.app/library/anthropic.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  codex: {
    sources: [
      'https://svgl.app/library/openai_dark.svg',
      'https://svgl.app/library/openai.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  hermes: {
    sources: [
      'https://hermes-agent.nousresearch.com/docs/img/logo.png'
    ],
    frameClassName: 'border-[#d9d9d9] bg-white'
  },
  'gemini-cli': {
    sources: [
      'https://svgl.app/library/gemini.svg',
      'https://svgl.app/gemini.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  openclaw: {
    sources: [
      'https://svgl.app/library/openclaw.svg',
      'https://svgl.app/openclaw.svg',
      'https://svgl.app/library/openai.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  cline: {
    sources: [
      'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-avatar/avatars/cline.webp',
      'https://svgl.app/library/cline.svg',
      'https://svgl.app/cline.svg'
    ],
    frameClassName: 'border-[#2d333b] bg-[#313B43]'
  },
  antigravity: {
    sources: [
      'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/googlegemini.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  warp: {
    sources: [
      'https://svgl.app/library/warp.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  cursor: {
    sources: [
      'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/cursor.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  copilot: {
    sources: [
      'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/githubcopilot.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  },
  windsurf: {
    sources: [
      'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/windsurf.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  }
};

export const getAgentLogoSources = (agentId) => agentLogoCatalog[agentId]?.sources || [];

export const getAgentPrimaryLogo = (agentId) => getAgentLogoSources(agentId)[0] || '';

export const getAgentLogoFrameClassName = (agentId) =>
  agentLogoCatalog[agentId]?.frameClassName || 'border-[#262626] bg-[#161616]';
