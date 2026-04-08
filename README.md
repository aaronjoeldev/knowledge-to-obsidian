# kto — Knowledge to Obsidian

**Verwandle jede Codebase automatisch in eine strukturierte Obsidian Knowledge Base.**

kto analysiert ein Repository vollständig, erkennt Features, Module und Abhängigkeiten, und schreibt alles als verlinkte Markdown-Notizen in deinen Obsidian Vault — ohne je deine eigenen Inhalte zu überschreiben.

---

## Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
  - [Claude Code](#installation-für-claude-code)
  - [OpenCode](#installation-für-opencode)
  - [Beide gleichzeitig](#beide-gleichzeitig)
- [Einrichtung eines Projekts](#einrichtung-eines-projekts)
- [Verwendung](#verwendung)
- [Konfiguration](#konfiguration)
  - [config.json Referenz](#configjson-referenz)
  - [Modelle pro Agent anpassen](#modelle-pro-agent-anpassen)
- [Wie kto funktioniert](#wie-kto-funktioniert)
  - [Die Pipeline](#die-pipeline)
  - [Die vier Agenten](#die-vier-agenten)
  - [Das Obsidian-Vault-Layout](#das-obsidian-vault-layout)
  - [AUTO-GENERATED Blöcke](#auto-generated-blöcke)
- [Programmierbare API](#programmierbare-api)
- [Entwicklung](#entwicklung)
- [Häufige Probleme](#häufige-probleme)

---

## Voraussetzungen

| Anforderung | Version | Hinweis |
|-------------|---------|---------|
| Node.js | ≥ 18.0.0 | Überprüfen mit `node --version` |
| Claude Code **oder** OpenCode | aktuell | Mindestens eines der beiden |
| Obsidian | beliebig | Vault muss lokal existieren |
| Git | beliebig | Empfohlen für `/kto:diff` |

---

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

## Einrichtung eines Projekts

Nach der Installation öffnest du ein beliebiges Projekt in Claude Code oder OpenCode und führst einmalig `/kto:init` aus.

### Schritt 1 — `/kto:init` ausführen

```
/kto:init
```

Der Assistent fragt dich interaktiv:

```
1. Was ist der absolute Pfad zu deinem Obsidian Vault?
   → z.B. /Users/dein-name/Notes/MyVault

2. Welche kurze ID soll für dieses Projekt verwendet werden? (GROSSBUCHSTABEN)
   → z.B. MY-APP   (Standard: aktueller Verzeichnisname)

3. In welchem Unterordner im Vault soll kto die Notizen ablegen?
   → z.B. Projects/MY-APP   (Standard: Projects/MY-APP)

4. Willst du die LLM-Modelle pro Agent anpassen? (y/N)
   → Optional, Defaults sind bereits sinnvoll gewählt
```

**Was `/kto:init` erstellt:**

```
mein-projekt/
├── .kto/
│   └── config.json     ← Konfiguration
└── .gitignore          ← .kto/ wird automatisch eingetragen
```

**Beispiel `.kto/config.json`:**

```json
{
  "vault_path": "/Users/dein-name/Notes/MyVault",
  "project_id": "MY-APP",
  "obsidian_subfolder": "Projects/MY-APP",
  "output_dir": ".kto",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001"
  }
}
```

> **Tipp:** Die config-Datei kann jederzeit manuell bearbeitet werden. `/kto:init` kann auch mehrfach ausgeführt werden — bestehende Werte werden angezeigt und können übernommen oder geändert werden.

---

### Schritt 2 — Erste Analyse

```
/kto:analyze
```

Dieser Command führt die gesamte Pipeline aus (dauert je nach Projektgröße 1–5 Minuten):

```
✓ kto analysis complete

  knowledge.json: 247 files scanned
  enriched_knowledge.json: 8 features, 34 modules, 12 third parties
  Obsidian vault: 56 notes written/updated at /Users/dein-name/Notes/MyVault/Projects/MY-APP
```

Der Vault enthält danach vollständig verlinkte Notizen zu allen Features, Modulen und Drittanbietern deines Projekts.

---

## Verwendung

### Täglicher Workflow

| Situation | Command |
|-----------|---------|
| Erstes Setup | `/kto:init` |
| Vollständige Erstanalyse | `/kto:analyze` |
| Nach Code-Änderungen (schnell) | `/kto:diff` |
| Vault neu synchronisieren | `/kto:sync` |

---

### `/kto:analyze` — Vollständige Pipeline

Analysiert das gesamte Projekt von Grund auf. Nutze diesen Command:
- bei der ersten Analyse eines neuen Projekts
- nach großen Refactorings
- wenn `/kto:diff` sich falsch verhält und du einen frischen Start möchtest

```
/kto:analyze
```

Führt intern diese 3 Agenten sequenziell aus:

```
[Project Mapper]  → .kto/knowledge.json
[Graph Builder]   → .kto/enriched_knowledge.json
[Obsidian Sync]   → Obsidian Vault Notizen
```

---

### `/kto:diff` — Inkrementelles Update

Erkennt automatisch welche Dateien sich seit der letzten Analyse geändert haben und aktualisiert nur die betroffenen Entitäten. Deutlich schneller als `/kto:analyze`.

```
# Automatische Erkennung via git diff
/kto:diff

# Explizite Dateien angeben
/kto:diff src/auth/service.ts src/billing/handler.ts
```

**Wann nutzen:** Nach jedem Commit oder nach dem Schreiben einer neuen Feature.

---

### `/kto:sync` — Nur Vault synchronisieren

Schreibt Obsidian-Notizen aus dem bereits vorhandenen `.kto/enriched_knowledge.json` — ohne das Repository erneut zu scannen. Sinnvoll wenn:
- die Vault-Notizen manuell gelöscht/beschädigt wurden
- du die `enriched_knowledge.json` manuell editiert hast
- der Vault-Pfad sich geändert hat

```
/kto:sync
```

---

## Konfiguration

### config.json Referenz

Die Datei `.kto/config.json` im Projekt-Root steuert das gesamte Verhalten:

```json
{
  "vault_path": "/absolute/pfad/zum/vault",
  "project_id": "MEIN-PROJEKT",
  "obsidian_subfolder": "Projects/MEIN-PROJEKT",
  "output_dir": ".kto",
  "agents": {
    "project_mapper": "claude-haiku-4-5-20251001",
    "graph_builder": "claude-sonnet-4-6",
    "obsidian_sync": "claude-haiku-4-5-20251001",
    "change_detector": "claude-haiku-4-5-20251001"
  }
}
```

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `vault_path` | string | **Pflichtfeld für analyze/sync.** Absoluter Pfad zum Obsidian-Vault-Stammverzeichnis. |
| `project_id` | string | Stabile ID für alle Entitäten (z.B. `FEAT-001`, `MODULE-Auth`). Einmal gesetzt, nicht mehr ändern. |
| `obsidian_subfolder` | string | Unterordner im Vault für dieses Projekt. Mehrere Projekte können denselben Vault nutzen. |
| `output_dir` | string | Verzeichnis für interne Dateien (`knowledge.json` etc.). Relativ zum Projekt-Root. Standard: `.kto`. |
| `agents` | object | Modell-ID pro Agent (siehe unten). |

---

### Modelle pro Agent anpassen

Jeder der vier Agenten kann ein anderes LLM-Modell verwenden. Das erlaubt dir, Kosten und Qualität zu balancieren:

| Agent | Standard-Modell | Warum |
|-------|----------------|-------|
| `project_mapper` | `claude-haiku-4-5-20251001` | Mechanisches Dateiscannen, kein Reasoning nötig |
| `graph_builder` | `claude-sonnet-4-6` | Semantisches Reasoning — braucht mehr Fähigkeit |
| `obsidian_sync` | `claude-haiku-4-5-20251001` | Template-basiertes Schreiben, günstig |
| `change_detector` | `claude-haiku-4-5-20251001` | Schnelle, gezielte Updates |

**Beispiel — nur den Graph Builder upgraden:**

```json
{
  "vault_path": "/Users/dein-name/Notes/MyVault",
  "project_id": "MY-APP",
  "agents": {
    "graph_builder": "claude-opus-4-6"
  }
}
```

Felder die weggelassen werden, erhalten automatisch die Standardwerte. Jede gültige Anthropic Model-ID funktioniert.

---

## Wie kto funktioniert

### Die Pipeline

```
Repo-Dateien
    │
    ▼
[kto-project-mapper]         — liest Dateien, Imports, Exports
    │
    ▼
.kto/knowledge.json          — rohe Fakten, keine Interpretation
    │
    ▼
[kto-graph-builder]          — erkennt Features, clustert Module
    │
    ▼
.kto/enriched_knowledge.json — semantisches Wissensmodell
    │
    ▼
[kto-obsidian-sync]          — schreibt Markdown-Notizen
    │
    ▼
Obsidian Vault Notizen
```

Bei Codeänderungen gibt es einen schnellen Pfad:

```
Geänderte Dateien
    │
    ▼
[kto-change-detector]        — nur betroffene Entitäten aktualisieren
    │
    ▼
Partielle Updates in Vault
```

---

### Die vier Agenten

#### `kto-project-mapper` (blau)

Scannt das Repository ohne jede Interpretation und erzeugt `knowledge.json`:

- **Was er tut:** Findet alle Dateien, klassifiziert sie (source/config/docs/tests), erkennt Imports/Exports, identifiziert Entry Points
- **Was er nicht tut:** Keine semantische Analyse, keine Annahmen über Bedeutung
- **Unterstützte Sprachen:** TypeScript, JavaScript, Python, Go, Rust, Java, und weitere
- **Output:** `.kto/knowledge.json`

#### `kto-graph-builder` (lila)

Der "Brain Layer" — transformiert rohe Daten in ein semantisches Modell:

- **Feature-Erkennung:** Anhand von API-Routes, Ordnerstruktur und Dateinamen
- **Module-Clustering:** Gruppiert zusammengehörige Dateien zu Modulen
- **Drittanbieter-Erkennung:** Aus `package.json` und Import-Analyse
- **ID-Vergabe:** Stabile IDs (`FEAT-001`, `MODULE-AuthService`, `THIRD-Stripe`)
- **Wichtig:** Bestehende IDs werden bei Wiederholungsläufen **preserviert** — Obsidian-Links bleiben stabil
- **Output:** `.kto/enriched_knowledge.json`

#### `kto-obsidian-sync` (grün)

Schreibt die Knowledge Base in den Vault:

- **Goldene Regel:** Überschreibt **niemals** Inhalte außerhalb der `<!-- AUTO-GENERATED -->` Blöcke
- **Wikilinks:** Alle Entitäten sind über `[[FEAT-001]]`, `[[MODULE-Auth]]` etc. verlinkt
- **Deterministische Dateinamen:** `FEAT-001_UserAuthentication.md` — keine kreative Variation
- **Bestehende Dateien:** Nur der AUTO-GENERATED-Block wird aktualisiert, eigene Notizen darunter bleiben erhalten
- **Output:** Markdown-Dateien im Vault

#### `kto-change-detector` (gelb)

Schneller Pfad für inkrementelle Updates:

- Findet heraus, welche Module von geänderten Dateien betroffen sind
- Aktualisiert nur diese Entitäten in `enriched_knowledge.json`
- Schreibt nur die betroffenen Vault-Notizen neu
- Ziel: unter 30 Agentic Turns bleiben (schnell!)

---

### Das Obsidian-Vault-Layout

kto erstellt folgende Struktur im Vault-Unterordner:

```
{obsidian_subfolder}/
│
├── Facts.md                          # Projekt-Übersicht (Features, Technologien)
├── Technology.md                     # Tech-Stack-Details
│
├── Features/
│   ├── Features_Index.md             # Tabelle aller Features
│   ├── FEAT-001_UserAuthentication.md
│   ├── FEAT-002_BillingPayments.md
│   └── ...
│
├── Code_Map/
│   ├── Modules_Index.md              # Tabelle aller Module
│   ├── MODULE-AuthService.md
│   ├── MODULE-BillingService.md
│   └── ...
│
├── Third_Party/
│   ├── THIRD-Stripe.md
│   ├── THIRD-Auth0.md
│   └── ...
│
└── Security/
    └── Security_Overview.md          # Auth-Modell, PII-Flows, Bedrohungen
```

**Beispiel-Notiz `FEAT-001_UserAuthentication.md`:**

```markdown
---
type: feature
id: FEAT-001
project: MY-APP
status: implemented
security_impact: high
generated_by: kto
---

# User Authentication

<!-- AUTO-GENERATED START -->
**Status:** implemented
**Security Impact:** high

## Entry Points

- `api/auth/login`
- `api/auth/register`

## Implemented By

- [[MODULE-AuthService]]
- [[MODULE-SessionManager]]

## Third Party Dependencies

- [[THIRD-Auth0]]

*Last synced: 2026-04-07T15:30:00Z*
<!-- AUTO-GENERATED END -->

<!-- Hier kannst du eigene Notizen schreiben — sie werden nie überschrieben -->
```

---

### AUTO-GENERATED Blöcke

Das wichtigste Sicherheitskonzept von kto: Nur der Bereich zwischen den Markierungen wird bei Updates ersetzt.

```markdown
<!-- AUTO-GENERATED START -->
... dieser Bereich wird von kto verwaltet ...
<!-- AUTO-GENERATED END -->

Alles hier gehört dir und wird nie angefasst.
```

**Verhalten:**
- **Datei existiert noch nicht:** kto schreibt die vollständige Datei inkl. Frontmatter und AUTO-GENERATED-Block
- **Datei existiert bereits:** Nur der Inhalt zwischen den Markierungen wird ersetzt
- **Keine Markierungen vorhanden:** kto hängt den Block am Ende der Datei an

---

## Programmierbare API

Für CI-Pipelines oder eigene Tools kann kto auch direkt aus TypeScript/JavaScript genutzt werden:

```typescript
import { KtoRunner } from 'kto-cc';

// Vollständige Analyse
const runner = new KtoRunner({
  projectDir: '/pfad/zum/projekt',
  // Optional: Modell pro Agent überschreiben
  modelOverrides: {
    'kto-graph-builder': 'claude-opus-4-6',
  },
});

const result = await runner.analyze();
console.log(`${result.featuresFound} Features, ${result.modulesFound} Module gefunden`);

// Nur Vault-Sync (kein neuer Scan)
await runner.sync();

// Inkrementelles Update
await runner.diff(['src/auth/service.ts', 'src/billing/handler.ts']);
```

**Konfigurationsvalidierung:**

```typescript
import { loadConfig, validateKnowledgeGraph } from 'kto-cc';

const config = await loadConfig('/pfad/zum/projekt', { requireVault: true });
// Wirft Fehler wenn vault_path nicht gesetzt ist

const graph = JSON.parse(await fs.readFile('.kto/enriched_knowledge.json', 'utf-8'));
const result = validateKnowledgeGraph(graph);
if (!result.valid) {
  console.error(result.errors);
}
```

---

## Entwicklung

### Repository aufsetzen

```bash
git clone https://github.com/aaronjoeldev/knowledge-to-obsidian.git
cd knowledge-to-obsidian
npm install
```

### Tests ausführen

```bash
npm test                # Einmalig ausführen
npm run test:watch      # Watch-Modus
npm run test:coverage   # Mit Coverage-Report
```

```
✓ tests/types.test.ts           (6 Tests)
✓ tests/config.test.ts          (5 Tests)
✓ tests/knowledge-validator.ts  (8 Tests)
──────────────────────────────────────────
  19 Tests passed
```

### TypeScript prüfen

```bash
npm run typecheck   # Nur prüfen (kein Output)
npm run build       # Kompilieren nach dist/
```

### Projektstruktur

```
kto/
├── agents/                         # AI-Agenten-Definitionen (Markdown)
│   ├── kto-project-mapper.md       # Repo-Scanner
│   ├── kto-graph-builder.md        # Semantisches Modell
│   ├── kto-obsidian-sync.md        # Vault-Schreiber
│   └── kto-change-detector.md      # Inkrementelles Update
│
├── commands/kto/                   # Slash-Commands (Markdown)
│   ├── init.md                     # /kto:init
│   ├── analyze.md                  # /kto:analyze
│   ├── sync.md                     # /kto:sync
│   └── diff.md                     # /kto:diff
│
├── src/                            # TypeScript-Quellcode
│   ├── types.ts                    # Knowledge-Model-Typen
│   ├── config.ts                   # Konfigurationsloader
│   ├── knowledge-validator.ts      # Validierung
│   └── index.ts                    # KtoRunner + öffentliche API
│
├── tests/                          # Tests (Vitest)
├── bin/
│   └── install.cjs                 # Installations-Script
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Häufige Probleme

### "kto is not initialized. Run /kto:init first."

Die `.kto/config.json` fehlt im aktuellen Verzeichnis. Stelle sicher dass du im richtigen Projekt-Root bist und führe `/kto:init` aus.

### "vault_path is not set. Run /kto:init to configure."

Die config.json existiert, aber `vault_path` ist leer. Führe `/kto:init` erneut aus und gib den Vault-Pfad an.

### Obsidian zeigt keine neuen Notizen

- Stelle sicher dass der `obsidian_subfolder` im Vault korrekt ist (Groß-/Kleinschreibung beachten)
- Starte Obsidian neu oder führe "Reload vault" aus (Obsidian cached manchmal das Dateisystem)
- Prüfe mit `ls "dein-vault-pfad/Projects/MY-APP"` ob die Dateien wirklich angelegt wurden

### `/kto:diff` findet keine Änderungen

- Das Projekt braucht Git (kto nutzt `git diff` zur Erkennung)
- Alternative: Dateipfade explizit angeben: `/kto:diff src/meine-datei.ts`

### Meine eigenen Notizen wurden überschrieben

Das sollte nicht passieren, da kto nur den AUTO-GENERATED-Block ersetzt. Falls doch etwas verloren gegangen ist:
- Prüfe ob du Inhalte innerhalb der `<!-- AUTO-GENERATED START/END -->` Markierungen geschrieben hast
- Schreibe eigene Notizen immer **außerhalb** dieser Blöcke (am Ende der Datei oder darunter)

### Node.js-Version zu alt

```bash
node --version  # Muss ≥ 18.0.0 sein
```

Mit `nvm`: `nvm install 22 && nvm use 22`

### OpenCode findet die Commands nicht

Prüfe den Config-Pfad:
```bash
ls ~/.config/opencode/commands/ | grep kto
```

Falls leer: `node bin/install.cjs --opencode` erneut ausführen.

---

## Lizenz

MIT
