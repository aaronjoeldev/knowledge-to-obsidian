#!/usr/bin/env node
// bin/install.js
// Installs kto agents and commands to ~/.claude/kto/

import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const INSTALL_DIR = join(homedir(), '.claude', 'kto');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Installing kto to ${INSTALL_DIR}...`);

// Copy agents/
copyDir(join(PACKAGE_ROOT, 'agents'), join(INSTALL_DIR, 'agents'));
console.log('  ✓ agents/');

// Copy commands/
copyDir(join(PACKAGE_ROOT, 'commands'), join(INSTALL_DIR, 'commands'));
console.log('  ✓ commands/');

// Copy commands to Claude Code expected location: ~/.claude/commands/kto/
const CLAUDE_COMMANDS_DIR = join(homedir(), '.claude', 'commands', 'kto');
if (!existsSync(CLAUDE_COMMANDS_DIR)) {
  mkdirSync(CLAUDE_COMMANDS_DIR, { recursive: true });
  copyDir(join(PACKAGE_ROOT, 'commands', 'kto'), CLAUDE_COMMANDS_DIR);
  console.log('  ✓ commands/kto/ → ~/.claude/commands/kto/');
}

console.log('\nkto installed successfully!');
console.log('Available commands:');
console.log('  /kto:init    — Initialize kto for a project');
console.log('  /kto:analyze — Full pipeline: scan → graph → sync');
console.log('  /kto:sync    — Re-sync vault from existing knowledge');
console.log('  /kto:diff    — Incremental update for changed files');
console.log('\nGet started: open a project and run /kto:init');
