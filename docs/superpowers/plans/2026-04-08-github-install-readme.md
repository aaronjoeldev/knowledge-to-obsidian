# GitHub Install & README Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "publish to npm" install flow with a curl-based GitHub install and update the README to reflect the actual installer UX.

**Architecture:** Create a `install.sh` shell script at the repo root that clones the repo to a temp dir and runs `bin/install.cjs`. Update README to use real GitHub URLs, document both the curl one-liner and the manual clone path, and remove stale npm-publish artefacts from `package.json`.

**Tech Stack:** Bash, Node.js ≥ 18, existing `bin/install.cjs`

---

## Files

| File | Operation | Reason |
|---|---|---|
| `install.sh` | Create | Curl-pipeable bootstrap script |
| `README.md` | Modify | Real URLs, new install commands, updated Node version, fix `install.js` → `install.cjs` refs |
| `package.json` | Modify | Remove `prepublishOnly`, remove empty `"dependencies": {}` |

---

### Task 1: Create `install.sh`

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Write `install.sh`**

```bash
#!/usr/bin/env bash
set -e

REPO="https://github.com/aaronjoeldev/knowledge-to-obsidian.git"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading kto..."
git clone --depth 1 --quiet "$REPO" "$TMP/kto"

node "$TMP/kto/bin/install.cjs" "$@"
```

Create at `/Users/clawie/Projects/kto/install.sh`.

- [ ] **Step 2: Make executable**

```bash
chmod +x install.sh
```

- [ ] **Step 3: Smoke-test (non-interactive, dry path)**

```bash
bash install.sh --help 2>&1 | head -5
```

Expected: prints the kto banner / help text without errors. (Will clone from GitHub — requires internet + the repo to be pushed first. If repo is not yet pushed, skip this step and note it.)

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat: add install.sh for curl-based GitHub install"
```

---

### Task 2: Rewrite README installation section

**Files:**
- Modify: `README.md`

The current README has several issues:
- References `node bin/install.js` (file was renamed to `install.cjs`)
- Uses placeholder `dein-username/kto` instead of real GitHub URL
- Has "Option A — aus npm (empfohlen, sobald veröffentlicht)" which is obsolete
- Node.js version requirement says `≥ 22.0.0` but `package.json` now says `≥ 18.0.0`
- Missing the new interactive installer UX (banner, prompts)

- [ ] **Step 1: Fix prerequisites table**

Find this in README.md:
```markdown
| Node.js | ≥ 22.0.0 | Überprüfen mit `node --version` |
```

Replace with:
```markdown
| Node.js | ≥ 18.0.0 | Überprüfen mit `node --version` |
```

- [ ] **Step 2: Rewrite the entire Installation section**

Find this block (from `## Installation` through `### Beide gleichzeitig` ending at `---`):

```markdown
## Installation

kto installiert sich in deine KI-Editor-Konfiguration und registriert dort Slash-Commands und Agenten-Definitionen.

### Installation für Claude Code

**Option A — aus npm (empfohlen, sobald veröffentlicht):**

```bash
npx kto-cc
```

**Option B — aus dem Repository:**

```bash
# Repository klonen
git clone https://github.com/dein-username/kto.git
cd kto

# Abhängigkeiten installieren
npm install

# Für Claude Code installieren (Standard)
node bin/install.js
```
...
```

Replace the entire `## Installation` section with the following (everything from `## Installation` through the `---` before `## Einrichtung eines Projekts`):

```markdown
## Installation

kto installiert sich in deine KI-Editor-Konfiguration und registriert Slash-Commands und Agenten-Definitionen. Der Installer ist interaktiv — er fragt nach Runtime und Installationsort.

### Curl-Installer (empfohlen)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh)
```

> **Hinweis:** `bash <(...)` statt `curl ... | bash` — so bleibt das Terminal interaktiv und die Prompts funktionieren.

Mit Flags (überspringt die interaktiven Prompts):

```bash
# Claude Code, global
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh) --claude --global

# OpenCode, global
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh) --opencode --global

# Beide Runtimes, global
bash <(curl -fsSL https://raw.githubusercontent.com/aaronjoeldev/knowledge-to-obsidian/main/install.sh) --both --global
```

---

### Manuell aus dem Repository

```bash
git clone https://github.com/aaronjoeldev/knowledge-to-obsidian.git
cd knowledge-to-obsidian
node bin/install.cjs
```

---

### Installationsoptionen

Der Installer fragt interaktiv:

```
  Which runtime(s) would you like to install for?

  1) Claude Code  (~/.claude)
  2) OpenCode     (~/.config/opencode)
  3) Both

  Choice [1]:

  Install globally or into current project?

  1) Global (recommended — available in all projects)
  2) Local  (current project only)

  Choice [1]:
```

**Verfügbare Flags:**

| Flag | Beschreibung |
|------|--------------|
| `--claude` | Nur Claude Code |
| `--opencode` | Nur OpenCode |
| `--both` / `--all` | Beide Runtimes |
| `--global` / `-g` | Global installieren |
| `--local` / `-l` | Nur aktuelles Projekt |
| `--uninstall` / `-u` | kto-Dateien entfernen |
| `--help` / `-h` | Hilfe anzeigen |

---

### Installierte Dateien

**Claude Code:**

| Pfad | Inhalt |
|------|--------|
| `~/.claude/kto/agents/` | Die 4 Agenten-Definitionen |
| `~/.claude/kto/commands/` | Die 4 Slash-Command-Definitionen |
| `~/.claude/commands/kto/` | Kopie für Claude Code Discovery |

**OpenCode:**

| Pfad | Inhalt |
|------|--------|
| `~/.config/opencode/agents/` | Konvertierte Agenten-Definitionen |
| `~/.config/opencode/commands/` | `kto-init.md`, `kto-analyze.md`, … |

kto respektiert Standard-XDG-Pfade für OpenCode:

| Priorität | Pfad |
|-----------|------|
| 1. | `$OPENCODE_CONFIG_DIR` |
| 2. | `$XDG_CONFIG_HOME/opencode` |
| 3. | `~/.config/opencode` (Standard) |

---
```

- [ ] **Step 3: Fix remaining `install.js` references in README**

Search the rest of the README for any remaining occurrences of `bin/install.js` or `node bin/install.js` and replace each with `node bin/install.cjs`.

- [ ] **Step 4: Fix remaining placeholder GitHub URLs**

Search for `dein-username` and `dein-name` — replace any GitHub repo references with `aaronjoeldev/knowledge-to-obsidian`. User-facing path examples like `/Users/dein-name/Notes` can stay as-is (those are illustrative).

- [ ] **Step 5: Verify the README renders correctly**

```bash
grep -n "install\.js\|dein-username\|npx kto-cc\|≥ 22" README.md
```

Expected: no output (all stale references gone).

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: update installation to curl/GitHub flow, fix stale references"
```

---

### Task 3: Clean up package.json

**Files:**
- Modify: `package.json`

Two cleanup changes:
1. Remove `"prepublishOnly"` from scripts (we're not publishing to npm)
2. Remove the empty `"dependencies": {}` key (no runtime dependencies)

- [ ] **Step 1: Remove `prepublishOnly` from scripts**

Find in `package.json`:
```json
    "prepublishOnly": "npm run typecheck"
```
Remove that line (and its trailing comma on the line above if needed).

- [ ] **Step 2: Remove empty `dependencies` block**

Find in `package.json`:
```json
  "dependencies": {}
```
Remove it entirely.

- [ ] **Step 3: Verify**

```bash
node -e "const p = require('./package.json'); console.log(Object.keys(p.scripts), p.dependencies)"
```

Expected: scripts list does NOT contain `prepublishOnly`. `dependencies` is `undefined`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: remove prepublishOnly and empty dependencies (not publishing to npm)"
```

---

## Self-Review

**Spec coverage:**
- ✓ curl install command → Task 1 (`install.sh`) + Task 2 (README)
- ✓ Manual clone command → Task 2 (README)  
- ✓ Fix `install.js` → `install.cjs` references → Task 2 Step 3
- ✓ Real GitHub URL → Task 2 Step 4
- ✓ Remove npm-publish artefacts → Task 3

**Placeholder scan:** No TBD/TODO. All code blocks are complete and runnable.

**Type consistency:** No TypeScript in this plan — shell/JSON only.
