#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const VALID_MODES = ['off', 'normal', 'lite', 'full', 'ultra'];

function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

function getFlagPath() {
  return path.join(getClaudeDir(), '.velocitybrain-style');
}

function getDefaultMode() {
  const envMode = (process.env.VB_RESPONSE_STYLE || '').trim().toLowerCase();
  if (VALID_MODES.includes(envMode)) {
    return envMode;
  }
  return 'full';
}

function ensureClaudeDir() {
  const dir = getClaudeDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFlag(mode) {
  ensureClaudeDir();
  fs.writeFileSync(getFlagPath(), mode, { encoding: 'utf8' });
}

function clearFlag() {
  try {
    fs.unlinkSync(getFlagPath());
  } catch (_err) {
    // best effort
  }
}

module.exports = {
  VALID_MODES,
  getFlagPath,
  getDefaultMode,
  writeFlag,
  clearFlag,
};
