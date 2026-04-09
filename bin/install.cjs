#!/usr/bin/env node
'use strict';

// kto installer
// Primary entrypoint for curl/GitHub installer and manual local execution

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const readline = require('readline');

// ─── Colors ───────────────────────────────────────────────────────────────────

const c = {
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  reset:  '\x1b[0m',
};

// ─── Package info ─────────────────────────────────────────────────────────────

const pkg = require('../package.json');
const PACKAGE_ROOT = path.join(__dirname, '..');

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const hasGlobal   = args.includes('--global')   || args.includes('-g');
const hasLocal    = args.includes('--local')    || args.includes('-l');
const hasClaude   = args.includes('--claude');
const hasOpencode = args.includes('--opencode');
const hasBoth     = args.includes('--both')     || args.includes('--all');
const hasHelp     = args.includes('--help')     || args.includes('-h');
const hasUninstall= args.includes('--uninstall')|| args.includes('-u');

// ─── Help ─────────────────────────────────────────────────────────────────────

if (hasHelp) {
  console.log(`
  ${c.bold}kto-cc${c.reset} v${pkg.version} — Knowledge to Obsidian

  ${c.yellow}Usage:${c.reset}
    node bin/install.cjs                 Interactive install
    node bin/install.cjs --claude        Claude Code only
    node bin/install.cjs --opencode      OpenCode only
    node bin/install.cjs --both          Both runtimes
    node bin/install.cjs --global        Skip location prompt (global)
    node bin/install.cjs --local         Install into current project only
    node bin/install.cjs --uninstall     Remove kto files

  ${c.yellow}Examples:${c.reset}
    ${c.dim}# Interactive (recommended)${c.reset}
    node bin/install.cjs

    ${c.dim}# Claude Code, globally${c.reset}
    node bin/install.cjs --claude --global

    ${c.dim}# OpenCode, globally${c.reset}
    node bin/install.cjs --opencode --global

    ${c.dim}# Both runtimes, globally${c.reset}
    node bin/install.cjs --both --global
`);
  process.exit(0);
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner() {
  console.log(`
${c.cyan}${c.bold}  ██╗  ██╗████████╗ ██████╗ ${c.reset}
${c.cyan}${c.bold}  ██║ ██╔╝╚══██╔══╝██╔═══██╗${c.reset}
${c.cyan}${c.bold}  █████╔╝    ██║   ██║   ██║${c.reset}
${c.cyan}${c.bold}  ██╔═██╗    ██║   ██║   ██║${c.reset}
${c.cyan}${c.bold}  ██║  ██╗   ██║   ╚██████╔╝${c.reset}
${c.cyan}${c.bold}  ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ${c.reset}

  ${c.bold}Knowledge to Obsidian${c.reset} — v${pkg.version}
  ${c.dim}AI-powered codebase analysis → Obsidian vault sync${c.reset}
  ${c.dim}Works with Claude Code and OpenCode${c.reset}
`);
}

// ─── Paths ────────────────────────────────────────────────────────────────────

function getClaudeGlobalDir()   { return path.join(os.homedir(), '.claude'); }
function getClaudeLocalDir()    { return path.join(process.cwd(), '.claude'); }

function getOpencodeGlobalDir() {
  if (process.env.OPENCODE_CONFIG_DIR) return process.env.OPENCODE_CONFIG_DIR;
  if (process.env.XDG_CONFIG_HOME)     return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  return path.join(os.homedir(), '.config', 'opencode');
}
function getOpencodeLocalDir()  { return path.join(process.cwd(), '.opencode'); }

// ─── OpenCode conversion ──────────────────────────────────────────────────────

/**
 * Convert a Claude Code agent .md → OpenCode agent .md
 * Strips: tools:, color: from frontmatter
 * Replaces: ~/.claude → ~/.config/opencode, AskUserQuestion → question
 */
function convertAgent(content) {
  let out = content
    .replace(/~\/\.claude\b/g,      '~/.config/opencode')
    .replace(/\$HOME\/\.claude\b/g, '$HOME/.config/opencode')
    .replace(/\bAskUserQuestion\b/g,'question');

  if (!out.startsWith('---')) return out;
  const end = out.indexOf('---', 3);
  if (end === -1) return out;

  const fm   = out.substring(3, end).trim();
  const body = out.substring(end + 3);

  const filtered = fm.split('\n').filter(l => {
    const t = l.trim();
    return !t.startsWith('tools:') && !t.startsWith('color:');
  });

  return `---\n${filtered.join('\n')}\n---${body}`;
}

/**
 * Convert a Claude Code command .md → OpenCode command .md
 * Removes: name: field
 * Converts: allowed-tools: → permission: { allow: [...] }
 * Renames: /kto:x → /kto-x  (flat command structure)
 */
function convertCommand(content) {
  let out = content
    .replace(/~\/\.claude\b/g,      '~/.config/opencode')
    .replace(/\$HOME\/\.claude\b/g, '$HOME/.config/opencode')
    .replace(/\bAskUserQuestion\b/g,'question')
    .replace(/\/kto:/g,             '/kto-');

  if (!out.startsWith('---')) return out;
  const end = out.indexOf('---', 3);
  if (end === -1) return out;

  const fm   = out.substring(3, end).trim();
  const body = out.substring(end + 3);

  const lines       = fm.split('\n');
  const newLines    = [];
  let inTools       = false;
  const tools       = [];

  for (const line of lines) {
    const t = line.trim();

    if (t.startsWith('name:'))          continue; // filename = command name in OC
    if (t.startsWith('allowed-tools:')) { inTools = true; continue; }

    if (inTools) {
      if (t.startsWith('- ')) { tools.push(t.slice(2).trim()); continue; }
      // End of tools array — flush as permission block
      inTools = false;
      if (tools.length) {
        newLines.push('permission:');
        newLines.push('  allow:');
        for (const tool of tools) newLines.push(`    - ${tool}`);
      }
    }

    newLines.push(line);
  }

  // Flush if tools was the last section
  if (inTools && tools.length) {
    newLines.push('permission:');
    newLines.push('  allow:');
    for (const tool of tools) newLines.push(`    - ${tool}`);
  }

  return `---\n${newLines.join('\n')}\n---${body}`;
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function writeText(destPath, content) {
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, content, 'utf-8');
}

function readText(filePath) { return fs.readFileSync(filePath, 'utf-8'); }

// ─── Install: Claude Code ─────────────────────────────────────────────────────

function installClaude(isGlobal) {
  const base = isGlobal ? getClaudeGlobalDir() : getClaudeLocalDir();
  const ktoDir      = path.join(base, 'kto');
  const commandsDir = path.join(base, 'commands', 'kto');

  console.log(`\n  ${c.cyan}Claude Code${c.reset} → ${c.dim}${base}${c.reset}\n`);

  // agents + commands into kto/ subfolder
  copyDir(path.join(PACKAGE_ROOT, 'agents'),   path.join(ktoDir, 'agents'));
  copyDir(path.join(PACKAGE_ROOT, 'commands'), path.join(ktoDir, 'commands'));
  console.log(`    ${c.green}✓${c.reset} agents/`);
  console.log(`    ${c.green}✓${c.reset} commands/`);

  // commands also into ~/.claude/commands/kto/ so Claude Code discovers them
  ensureDir(commandsDir);
  copyDir(path.join(PACKAGE_ROOT, 'commands', 'kto'), commandsDir);
  console.log(`    ${c.green}✓${c.reset} commands/kto/ ${c.dim}(slash commands discoverable)${c.reset}`);

  console.log(`
  ${c.bold}Claude Code commands:${c.reset}
    ${c.cyan}/kto:init${c.reset}    — Configure vault path & project ID
    ${c.cyan}/kto:analyze${c.reset} — Full scan → knowledge graph → vault sync
    ${c.cyan}/kto:diff${c.reset}    — Incremental update for changed files
    ${c.cyan}/kto:sync${c.reset}    — Re-sync vault from existing knowledge
`);
}

// ─── Install: OpenCode ────────────────────────────────────────────────────────

function installOpencode(isGlobal) {
  const base = isGlobal ? getOpencodeGlobalDir() : getOpencodeLocalDir();

  console.log(`\n  ${c.blue}OpenCode${c.reset} → ${c.dim}${base}${c.reset}\n`);

  // Agents (converted: strip tools:, color:)
  const agentsDir = path.join(base, 'agents');
  ensureDir(agentsDir);
  for (const entry of fs.readdirSync(path.join(PACKAGE_ROOT, 'agents'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const converted = convertAgent(readText(path.join(PACKAGE_ROOT, 'agents', entry.name)));
      writeText(path.join(agentsDir, entry.name), converted);
    }
  }
  console.log(`    ${c.green}✓${c.reset} agents/ ${c.dim}(converted for OpenCode)${c.reset}`);

  // Commands (converted + renamed: init.md → kto-init.md)
  const commandsDir = path.join(base, 'commands');
  ensureDir(commandsDir);
  for (const entry of fs.readdirSync(path.join(PACKAGE_ROOT, 'commands', 'kto'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const converted = convertCommand(readText(path.join(PACKAGE_ROOT, 'commands', 'kto', entry.name)));
      writeText(path.join(commandsDir, `kto-${entry.name}`), converted);
    }
  }
  console.log(`    ${c.green}✓${c.reset} commands/ ${c.dim}(kto-init.md, kto-analyze.md, …)${c.reset}`);

  console.log(`
  ${c.bold}OpenCode commands:${c.reset}
    ${c.cyan}/kto-init${c.reset}    — Configure vault path & project ID
    ${c.cyan}/kto-analyze${c.reset} — Full scan → knowledge graph → vault sync
    ${c.cyan}/kto-diff${c.reset}    — Incremental update for changed files
    ${c.cyan}/kto-sync${c.reset}    — Re-sync vault from existing knowledge
`);
}

// ─── Uninstall ────────────────────────────────────────────────────────────────

function uninstall(runtimes, isGlobal) {
  for (const runtime of runtimes) {
    if (runtime === 'claude') {
      const base = isGlobal ? getClaudeGlobalDir() : getClaudeLocalDir();
      const ktoDir      = path.join(base, 'kto');
      const commandsDir = path.join(base, 'commands', 'kto');
      [ktoDir, commandsDir].forEach(d => {
        if (fs.existsSync(d)) { fs.rmSync(d, { recursive: true }); console.log(`  ${c.yellow}✗${c.reset} removed ${d}`); }
      });
    } else if (runtime === 'opencode') {
      const base = isGlobal ? getOpencodeGlobalDir() : getOpencodeLocalDir();
      ['agents', 'commands'].forEach(sub => {
        const dir = path.join(base, sub);
        if (!fs.existsSync(dir)) return;
        for (const f of fs.readdirSync(dir)) {
          if (f.startsWith('kto-') || f.startsWith('kto')) {
            fs.unlinkSync(path.join(dir, f));
            console.log(`  ${c.yellow}✗${c.reset} removed ${path.join(dir, f)}`);
          }
        }
      });
    }
  }
  console.log(`\n  ${c.green}✓${c.reset} kto uninstalled.\n`);
}

// ─── Interactive prompts ──────────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function promptRuntime(callback) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`  ${c.yellow}Which runtime(s) would you like to install for?${c.reset}\n
  ${c.cyan}1${c.reset}) Claude Code  ${c.dim}(~/.claude)${c.reset}
  ${c.cyan}2${c.reset}) OpenCode     ${c.dim}(~/.config/opencode)${c.reset}
  ${c.cyan}3${c.reset}) Both
`);

  rl.question(`  Choice ${c.dim}[1]${c.reset}: `, answer => {
    rl.close();
    const choice = (answer.trim() || '1');
    if (choice === '1')                   callback(['claude']);
    else if (choice === '2')              callback(['opencode']);
    else if (choice === '3' || choice === 'both') callback(['claude', 'opencode']);
    else                                  callback(['claude']);
  });
}

function promptLocation(runtimes, callback) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n  ${c.yellow}Install globally or into current project?${c.reset}\n
  ${c.cyan}1${c.reset}) Global ${c.dim}(recommended — available in all projects)${c.reset}
  ${c.cyan}2${c.reset}) Local  ${c.dim}(current project only: ${process.cwd()})${c.reset}
`);

  rl.question(`  Choice ${c.dim}[1]${c.reset}: `, answer => {
    rl.close();
    const isGlobal = (answer.trim() || '1') !== '2';
    callback(runtimes, isGlobal);
  });
}

// ─── Install all selected runtimes ────────────────────────────────────────────

function installAll(runtimes, isGlobal) {
  if (hasUninstall) {
    uninstall(runtimes, isGlobal);
    return;
  }

  for (const runtime of runtimes) {
    if (runtime === 'claude')   installClaude(isGlobal);
    if (runtime === 'opencode') installOpencode(isGlobal);
  }

  console.log(`  ${c.green}${c.bold}kto installed successfully!${c.reset}\n`);
  console.log(`  Get started: open any project and run ${c.cyan}/kto:init${c.reset}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

printBanner();

if (hasGlobal && hasLocal) {
  console.error(`  ${c.yellow}Cannot use --global and --local together${c.reset}`);
  process.exit(1);
}

// Resolve runtimes from flags
let runtimes = [];
if (hasBoth)     runtimes = ['claude', 'opencode'];
else if (hasClaude)   runtimes.push('claude');
else if (hasOpencode) runtimes.push('opencode');

// If runtime(s) known and location known — skip prompts
if (runtimes.length > 0 && (hasGlobal || hasLocal)) {
  installAll(runtimes, hasGlobal);
}
// If runtime(s) known but no location — ask location
else if (runtimes.length > 0) {
  promptLocation(runtimes, installAll);
}
// If no runtime specified but location known — ask runtime
else if (hasGlobal || hasLocal) {
  if (!process.stdin.isTTY) {
    installAll(['claude'], hasGlobal); // non-interactive default
  } else {
    promptRuntime(r => installAll(r, hasGlobal));
  }
}
// Fully interactive
else {
  if (!process.stdin.isTTY) {
    console.log(`  ${c.yellow}Non-interactive terminal — defaulting to Claude Code global install${c.reset}\n`);
    installAll(['claude'], true);
  } else {
    promptRuntime(r => promptLocation(r, installAll));
  }
}
