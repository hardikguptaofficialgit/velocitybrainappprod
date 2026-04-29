#!/usr/bin/env node
const { getDefaultMode, writeFlag, clearFlag } = require('./caveman-config');

const mode = getDefaultMode();
if (mode === 'off') {
  clearFlag();
  process.exit(0);
}

writeFlag(mode);

const output = [
  `VELOCITYBRAIN CAVEMAN ACTIVE - mode: ${mode}`,
  '',
  'Use response_style for MCP tool calls and keep terse technical output.',
  'Allowed: normal | lite | full | ultra',
  'Stop with: "normal mode" or "stop caveman"',
].join('\n');

process.stdout.write(output);
