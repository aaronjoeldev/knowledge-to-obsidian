#!/usr/bin/env node
// bin/install.js
// Installs kto agents and commands to ~/.claude/ and/or ~/.config/opencode/
//
// Usage:
//   node bin/install.js              — install for Claude Code (default)
//   node bin/install.js --opencode   — install for OpenCode
//   node bin/install.js --both       — install for both
//   node bin/install.js --all        — install for both

import { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const forOpencode = args.includes('--opencode') || args.includes('--both') || args.includes('--all');
const forClaude = !args.includes('--opencode') || args.includes('--both') || args.includes('--all');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function writeFile(destPath, content) {
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content, 'utf-8');
}

// ─── OpenCode conversion ──────────────────────────────────────────────────────

/**
 * Convert a Claude Code agent .md file to OpenCode format:
 * - Strip tools:, color: from YAML frontmatter (not supported)
 * - Replace ~/.claude paths with ~/.config/opencode
 */
function convertAgentForOpencode(content) {
  // Replace path references
  let out = content
    .replace(/~\/\.claude\b/g, '~/.config/opencode')
    .replace(/\$HOME\/\.claude\b/g, '$HOME/.config/opencode')
    .replace(/\bAskUserQuestion\b/g, 'question');

  if (!out.startsWith('---')) return out;
  const endIdx = out.indexOf('---', 3);
  if (endIdx === -1) return out;

  const frontmatter = out.substring(3, endIdx).trim();
  const body = out.substring(endIdx + 3);

  // Strip unsupported fields: tools:, color:
  const filteredLines = frontmatter.split('\n').filter(line => {
    const t = line.trim();
    return !t.startsWith('tools:') && !t.startsWith('color:');
  });

  return `---\n${filteredLines.join('\n')}\n---${body}`;
}

/**
 * Convert a Claude Code command .md file to OpenCode format:
 * - Remove name: field (OpenCode derives command name from filename)
 * - Convert /kto:xxx references to /kto-xxx (colon → dash)
 * - Replace ~/.claude paths with ~/.config/opencode
 * - Replace AskUserQuestion → question
 */
function convertCommandForOpencode(content) {
  let out = content
    .replace(/~\/\.claude\b/g, '~/.config/opencode')
    .replace(/\$HOME\/\.claude\b/g, '$HOME/.config/opencode')
    .replace(/\bAskUserQuestion\b/g, 'question')
    .replace(/\/kto:/g, '/kto-'); // flat command structure for OpenCode

  if (!out.startsWith('---')) return out;
  const endIdx = out.indexOf('---', 3);
  if (endIdx === -1) return out;

  const frontmatter = out.substring(3, endIdx).trim();
  const body = out.substring(endIdx + 3);

  // Remove name: field, convert allowed-tools: array to permission: object
  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const collectedTools = [];

  for (const line of lines) {
    const t = line.trim();

    if (t.startsWith('name:')) continue; // OpenCode uses filename

    if (t.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    if (inAllowedTools) {
      if (t.startsWith('- ')) {
        collectedTools.push(t.slice(2).trim());
        continue;
      } else {
        inAllowedTools = false;
        // Emit permission block
        if (collectedTools.length > 0) {
          newLines.push('permission:');
          newLines.push('  allow:');
          for (const tool of collectedTools) {
            newLines.push(`    - ${tool}`);
          }
        }
      }
    }

    newLines.push(line);
  }

  // Flush pending tools if allowed-tools was the last section
  if (inAllowedTools && collectedTools.length > 0) {
    newLines.push('permission:');
    newLines.push('  allow:');
    for (const tool of collectedTools) {
      newLines.push(`    - ${tool}`);
    }
  }

  return `---\n${newLines.join('\n')}\n---${body}`;
}

// ─── Claude Code install ───────────────────────────────────────────────────────

if (forClaude) {
  const INSTALL_DIR = join(homedir(), '.claude', 'kto');
  console.log(`\nInstalling kto for Claude Code → ${INSTALL_DIR}`);

  copyDir(join(PACKAGE_ROOT, 'agents'), join(INSTALL_DIR, 'agents'));
  console.log('  ✓ agents/');

  copyDir(join(PACKAGE_ROOT, 'commands'), join(INSTALL_DIR, 'commands'));
  console.log('  ✓ commands/');

  // Copy commands to ~/.claude/commands/kto/ (where Claude Code discovers them)
  const CLAUDE_COMMANDS_DIR = join(homedir(), '.claude', 'commands', 'kto');
  mkdirSync(CLAUDE_COMMANDS_DIR, { recursive: true });
  copyDir(join(PACKAGE_ROOT, 'commands', 'kto'), CLAUDE_COMMANDS_DIR);
  console.log('  ✓ ~/.claude/commands/kto/ (slash commands)');
}

// ─── OpenCode install ─────────────────────────────────────────────────────────

if (forOpencode) {
  const OC_CONFIG_DIR =
    process.env.OPENCODE_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME ? join(process.env.XDG_CONFIG_HOME, 'opencode') : null) ||
    join(homedir(), '.config', 'opencode');

  console.log(`\nInstalling kto for OpenCode → ${OC_CONFIG_DIR}`);

  // Install agents (converted)
  const agentsDir = join(OC_CONFIG_DIR, 'agents');
  mkdirSync(agentsDir, { recursive: true });
  for (const entry of readdirSync(join(PACKAGE_ROOT, 'agents'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const raw = readFileSync(join(PACKAGE_ROOT, 'agents', entry.name), 'utf-8');
      writeFileSync(join(agentsDir, entry.name), convertAgentForOpencode(raw), 'utf-8');
    }
  }
  console.log('  ✓ agents/ (converted for OpenCode)');

  // Install commands (converted + renamed: init.md → kto-init.md)
  const commandsDir = join(OC_CONFIG_DIR, 'commands');
  mkdirSync(commandsDir, { recursive: true });
  for (const entry of readdirSync(join(PACKAGE_ROOT, 'commands', 'kto'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const raw = readFileSync(join(PACKAGE_ROOT, 'commands', 'kto', entry.name), 'utf-8');
      const converted = convertCommandForOpencode(raw);
      // Rename: init.md → kto-init.md so command becomes /kto-init
      const destName = `kto-${entry.name}`;
      writeFileSync(join(commandsDir, destName), converted, 'utf-8');
    }
  }
  console.log('  ✓ ~/.config/opencode/commands/ (kto-init.md, kto-analyze.md, ...)');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\nkto installed successfully!');

if (forClaude) {
  console.log('\nClaude Code commands:');
  console.log('  /kto:init    — Initialize kto for a project');
  console.log('  /kto:analyze — Full pipeline: scan → graph → sync');
  console.log('  /kto:sync    — Re-sync vault from existing knowledge');
  console.log('  /kto:diff    — Incremental update for changed files');
}

if (forOpencode) {
  console.log('\nOpenCode commands:');
  console.log('  /kto-init    — Initialize kto for a project');
  console.log('  /kto-analyze — Full pipeline: scan → graph → sync');
  console.log('  /kto-sync    — Re-sync vault from existing knowledge');
  console.log('  /kto-diff    — Incremental update for changed files');
}

console.log('\nGet started: open a project and run /kto:init (Claude Code) or /kto-init (OpenCode)');
