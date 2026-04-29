#!/usr/bin/env node
const { VALID_MODES, getDefaultMode, writeFlag, clearFlag } = require('./caveman-config');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function parsePrompt(raw) {
  try {
    const payload = JSON.parse(raw || '{}');
    return String(payload.prompt || payload.text || '').trim();
  } catch (_err) {
    return String(raw || '').trim();
  }
}

function detectMode(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes('stop caveman') || lower.includes('normal mode')) {
    return 'off';
  }

  const cmd = lower.match(/^\/caveman(?:\s+(\S+))?/);
  if (!cmd) {
    return null;
  }

  const arg = (cmd[1] || '').trim();
  if (!arg) {
    return getDefaultMode();
  }

  if (VALID_MODES.includes(arg)) {
    return arg;
  }

  return getDefaultMode();
}

(async () => {
  const raw = await readStdin();
  const prompt = parsePrompt(raw);
  const mode = detectMode(prompt);

  if (!mode) {
    process.exit(0);
  }

  if (mode === 'off') {
    clearFlag();
    process.exit(0);
  }

  writeFlag(mode);
  process.exit(0);
})();
