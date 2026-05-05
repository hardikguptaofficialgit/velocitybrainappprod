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
      'https://svgl.app/library/codex.svg',
      'https://svgl.app/codex.svg',
      'https://svgl.app/library/openai_dark.svg'
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
      'https://svgl.app/library/cline.svg',
      'https://svgl.app/cline.svg',
      'https://svgl.app/library/visual-studio-code.svg'
    ],
    frameClassName: 'border-[#262626] bg-[#161616]'
  }
};

export const getAgentLogoSources = (agentId) => agentLogoCatalog[agentId]?.sources || [];

export const getAgentPrimaryLogo = (agentId) => getAgentLogoSources(agentId)[0] || '';

export const getAgentLogoFrameClassName = (agentId) =>
  agentLogoCatalog[agentId]?.frameClassName || 'border-[#262626] bg-[#161616]';
