📦 1. SYSTEM OVERVIEW (ARCHITEKTUR)
# AI Project Knowledge Sync System

## Ziel
Ein systemübergreifender Skill, der:
1. Codebases vollständig analysiert
2. Wissen strukturiert extrahiert
3. In eine Obsidian Knowledge Base überführt
4. Bei Code-Änderungen automatisch synchronisiert

## Kernprinzipien
- Read-only Analyse des Codes
- Deterministische Knowledge-Struktur
- Stabile IDs für alle Entitäten
- Trennung von:
  - Code-Analyse
  - Wissensmodell
  - Obsidian-Sync

## Hauptkomponenten

### 1. Project Mapper (Agent)
→ analysiert Repo und erzeugt strukturierte JSON

### 2. Knowledge Graph Builder (Agent)
→ erstellt semantisches Modell (Features, Modules, Dependencies)

### 3. Obsidian Sync Agent
→ schreibt/updated Markdown-Dateien

### 4. Change Detection Agent
→ reagiert auf Codeänderungen

---

## Datenfluss

Repo → Project Mapper → knowledge.json  
→ Graph Builder → enriched_knowledge.json  
→ Obsidian Sync → Markdown Vault

Bei Änderungen:
Changed Files → Change Agent → Partial Update → Obsidian Sync

---

## Tech Stack (Vorschlag)

### Core
- Node.js / TypeScript
- AST Parsing:
  - tree-sitter (multi-language)
  - ts-morph (TS deep parsing)

### Storage
- JSON (v1)
- später optional: SQLite / Graph DB

### Agent Integration
- JSON-RPC oder Tool Interface
- kompatibel mit:
  - Cursor
  - Claude Code
  - OpenCode

### Optional später
- Embeddings (für Suche)
- Vector DB
🧠 2. KNOWLEDGE MODEL (ZENTRALE DATENSTRUKTUR)
# Knowledge Model Specification

## Ziel
Ein einheitliches, agent-freundliches Datenmodell für ALLES Projektwissen.

---

## Root Structure

```json
{
  "project": {},
  "features": [],
  "modules": [],
  "third_parties": [],
  "technologies": [],
  "security": {},
  "relations": []
}
1. Project
{
  "id": "PROJECT-XYZ",
  "name": "",
  "description": "",
  "domain": "",
  "criticality": "low | medium | high"
}
2. Features
{
  "id": "FEAT-001",
  "name": "User Authentication",
  "description": "",
  "status": "planned | implemented",
  "entry_points": ["api/auth/login"],
  "modules": ["MODULE-AuthService"],
  "third_parties": ["THIRD-Auth0"],
  "security_impact": "high"
}
3. Modules
{
  "id": "MODULE-AuthService",
  "path": "services/auth/",
  "language": "typescript",
  "responsibility": "",
  "exports": [],
  "dependencies": [],
  "used_by_features": []
}
4. Third Parties
{
  "id": "THIRD-Stripe",
  "type": "payment",
  "data_access": ["billing", "pii"],
  "criticality": "high",
  "used_in": ["FEAT-002"]
}
5. Technologies
{
  "name": "PostgreSQL",
  "version": "15",
  "usage": "primary database",
  "modules": []
}
6. Security
{
  "threats": [],
  "pii_flows": [],
  "auth_model": "JWT"
}
7. Relations (WICHTIG)
{
  "from": "FEAT-001",
  "to": "MODULE-AuthService",
  "type": "implemented_by"
}
Warum wichtig?

→ Das ist die Single Source of Truth für alle Agents


---

# 🔍 3. PROJECT MAPPER AGENT

```markdown
# Agent: Project Mapper

## Ziel
Analysiert ein bestehendes Repository vollständig und erzeugt `knowledge.json`.

---

## Input

```json
{
  "root_path": "/project"
}
Output
knowledge.json (roh, noch nicht semantisch optimiert)
Aufgaben
1. File Discovery
alle Dateien scannen
Klassifikation:
source
config
docs
tests
2. Language Detection
TS, JS, Python, Go, etc.
3. AST Parsing
Funktionen
Klassen
Exports
Imports
4. Entry Points erkennen
main.ts
index.ts
server.js
CLI tools
5. Dependency Mapping
interne Imports
externe Libraries
Output Beispiel
{
  "files": [],
  "modules": [],
  "imports": []
}
Tools
tree-sitter
ts-morph (für TS Projekte)
WICHTIG
Keine Interpretation
Nur strukturierte Fakten

---

# 🧩 4. KNOWLEDGE GRAPH BUILDER AGENT

```markdown
# Agent: Knowledge Graph Builder

## Ziel
Transformiert rohe Repo-Daten in ein semantisches Modell.

---

## Input
- knowledge.json (vom Mapper)

---

## Output
- enriched_knowledge.json

---

## Aufgaben

### 1. Feature Detection
Heuristiken:
- API routes
- folder structure
- naming (auth, billing, user)

---

### 2. Module Clustering
- gruppiere Dateien zu Modulen
- erkenne Services

---

### 3. Third Party Detection
- package.json
- imports

---

### 4. Relationship Mapping

Beispiele:
- Feature → Module
- Module → Third Party
- Feature → API Endpoint

---

### 5. Security Detection
- auth usage
- payment handling
- PII flows

---

## Output Fokus
- saubere IDs
- klare Beziehungen
- keine Duplikate

---

## Wichtig
→ Das ist der „Brain Layer“
📝 5. OBSIDIAN SYNC AGENT
# Agent: Obsidian Sync

## Ziel
Schreibt und aktualisiert die Knowledge Base in Obsidian.

---

## Input
- enriched_knowledge.json

---

## Output
- Markdown Dateien im Vault

---

## Regeln

### 1. NIEMALS überschreiben
Nur Bereiche:

<!-- AUTO-GENERATED START -->

...

<!-- AUTO-GENERATED END -->

---

### 2. File Mapping

| Type | File |
|------|------|
| Feature | /Features/FEAT-XXX.md |
| Module | /Code_Map/MODULE-XXX.md |
| Third Party | /Third_Party/XXX.md |

---

### 3. Frontmatter Pflicht

```yaml
type: feature
id: FEAT-001
project: XYZ
4. Linking
[[FEAT-001]]
[[MODULE-AuthService]]
5. Index Files generieren
Features_Index.md
Modules_Index.md
Wichtig

→ deterministische Struktur
→ keine kreative Variation


---

# 🔄 6. CHANGE DETECTION AGENT

```markdown
# Agent: Change Detection

## Ziel
Reagiert auf Codeänderungen und updated gezielt Knowledge.

---

## Input

```json
{
  "changed_files": [],
  "diff": "",
  "summary": ""
}
Aufgaben
1. Betroffene Module finden
anhand Pfad
2. Betroffene Features ableiten
mapping über knowledge.json
3. Änderungen klassifizieren
feature change
refactor
bugfix
4. Obsidian Update triggern
nur betroffene Files
Output
{
  "affected_features": [],
  "affected_modules": []
}
Wichtig

→ MUSS schnell sein
→ MUSS deterministisch sein


---

# 🧱 7. OBSIDIAN STRUKTUR (FINAL)

```markdown
# Obsidian Project Structure

## Root

- Facts.md
- Technology.md

---

## Features

- Features_Index.md
- FEAT-001_Auth.md

---

## Code_Map

- MODULE-AuthService.md
- MODULE-Billing.md

---

## Third_Party

- Stripe.md
- Auth0.md

---

## Security

- Security_Overview.md
- Threat_Model.md

---

## Operations

- CI_CD.md
- Runbooks.md

---

## Prinzipien

1. Jede Datei = eine Entität
2. Alles verlinkt
3. IDs sind stabil
4. Maschinenlesbar + Human readable