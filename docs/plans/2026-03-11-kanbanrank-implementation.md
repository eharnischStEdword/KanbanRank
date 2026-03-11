# KanbanRank Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a team survey tool where members rank 28 kanban items by importance (1-5) and define "Done" for each, with an admin page showing ranked results and AI-generated consensus definitions.

**Architecture:** Node/Express backend with SQLite, vanilla HTML/CSS/JS frontend. Items seeded from CSV. Survey is a single scrolling page. Admin page auto-sorts items by average importance and triggers Claude AI on demand for consensus DoD synthesis.

**Tech Stack:** Node.js 18+, Express 4, better-sqlite3, @anthropic-ai/sdk, uuid, dotenv. Deployed on Render.com with persistent disk.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `render.yaml`
- Create: `db/.gitkeep`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "kanban-rank",
  "version": "1.0.0",
  "description": "Team kanban item ranking and Definition of Done survey tool",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^11.0.0",
    "@anthropic-ai/sdk": "^0.39.0",
    "dotenv": "^16.4.5",
    "uuid": "^9.0.1"
  }
}
```

**Step 2: Create .env.example**

```
ANTHROPIC_API_KEY=your-api-key-here
PORT=3000
NODE_ENV=production
```

**Step 3: Create render.yaml**

```yaml
services:
  - type: web
    name: kanban-rank
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: NODE_ENV
        value: production
      - key: DB_PATH
        value: /opt/render/project/data/kanban.db
    disk:
      name: kanban-data
      mountPath: /opt/render/project/data
      sizeGB: 1
```

**Step 4: Create .gitignore**

```
node_modules/
.env
db/*.db
```

**Step 5: Create db/.gitkeep**

Empty file.

**Step 6: Install dependencies**

Run: `cd /Users/ericharnisch/KanbanRank && npm install`
Expected: node_modules created, package-lock.json generated

**Step 7: Commit**

```
git add package.json package-lock.json .env.example render.yaml .gitignore db/.gitkeep
git commit -m "feat: project scaffolding with dependencies and render config"
```

---

### Task 2: Database and item seeding

**Files:**
- Create: `src/database.js`
- Create: `data/kanban_items.csv`

**Step 1: Copy CSV into project**

Copy `/Users/ericharnisch/Downloads/kanban_items.csv` to `data/kanban_items.csv` in the project.

**Step 2: Create src/database.js**

Schema:
- `items` table: id (autoincrement), title, category — seeded from CSV on first run
- `respondents` table: id (UUID), name (nullable), created_at, completed_at
- `responses` table: respondent_id, item_id, importance (1-5), definition_of_done (text), UNIQUE(respondent_id, item_id)
- `ai_results` table: item_id, result_type ('consensus'), content (JSON text), created_at

Seed function reads CSV, skips header, parses quoted fields, inserts into items table. Only seeds if items table is empty.

**Step 3: Test seeding works**

Run: `node -e "require('dotenv').config(); const {getDb}=require('./src/database'); const db=getDb(); console.log(db.prepare('SELECT * FROM items').all());"`
Expected: 28 items printed

**Step 4: Commit**

```
git add src/database.js data/kanban_items.csv
git commit -m "feat: database schema and CSV item seeding"
```

---

### Task 3: Express server and API routes

**Files:**
- Create: `src/server.js`
- Create: `src/routes/api.js`

**Step 1: Create src/server.js**

Express app: JSON body parser, static files from public/, health check at /health, mount /api and /admin routes, SPA fallback.

**Step 2: Create src/routes/api.js**

Endpoints:
- `GET /api/items` — returns all items ordered by id
- `POST /api/respondents` — creates respondent with optional name, returns UUID
- `POST /api/responses/:respondentId` — accepts `{ responses: [{ itemId, importance, definitionOfDone }] }`, upserts all responses, marks respondent complete

**Step 3: Commit**

```
git add src/server.js src/routes/api.js
git commit -m "feat: express server and survey API routes"
```

---

### Task 4: Admin routes and AI

**Files:**
- Create: `src/ai.js`
- Create: `src/routes/admin.js`

**Step 1: Create src/ai.js**

- System prompt instructs Claude to synthesize multiple "Definition of Done" responses into consensus
- `generateConsensus(itemTitle, responses)` function sends item title + all DoD responses to Claude
- Returns JSON: `{ commonThemes, disagreements, consensusDefinition, confidence }`
- Uses claude-sonnet-4-20250514, max_tokens 2000

**Step 2: Create src/routes/admin.js**

Endpoints:
- `GET /admin/results` — returns items with AVG importance and response counts, sorted by avg DESC
- `GET /admin/items/:itemId/responses` — returns individual responses for an item
- `POST /admin/items/:itemId/consensus` — generates consensus for one item via AI
- `GET /admin/items/:itemId/consensus` — returns cached consensus
- `POST /admin/consensus/all` — generates consensus for all items sequentially
- `GET /admin/respondents` — lists all respondents
- `DELETE /admin/respondents/:id` — deletes respondent and their responses

**Step 3: Commit**

```
git add src/ai.js src/routes/admin.js
git commit -m "feat: admin routes and AI consensus generation"
```

---

### Task 5: Survey frontend

**Files:**
- Create: `public/index.html`
- Create: `public/js/app.js`

**Step 1: Create public/index.html**

Screens: landing (intro + optional name + Begin button), survey (progress bar + all items + submit), submitting (spinner), done (thank you).

**Step 2: Create public/js/app.js**

- `startSurvey()`: creates respondent, loads items from API, renders survey
- `renderSurvey()`: groups items by category, renders each as a card with category header, importance 1-5 dots, and DoD textarea
- `updateProgress()`: shows "X of 28 items rated" in progress bar
- `submitSurvey()`: validates all items have importance rating, POSTs all responses, shows done screen
- XSS-safe via `esc()` function

**Step 3: Commit**

```
git add public/index.html public/js/app.js
git commit -m "feat: survey frontend"
```

---

### Task 6: Admin frontend

**Files:**
- Create: `public/admin.html`
- Create: `public/js/admin.js`

**Step 1: Create public/admin.html**

Layout: header, respondent count, "Generate All Consensus" button, ranked list container, detail container.

**Step 2: Create public/js/admin.js**

- `loadDashboard()`: fetches /admin/results, renders ranked list sorted by avg importance
- `renderRankedList()`: each row shows rank #, title, category badge, avg score badge, response count. Clickable to expand.
- `toggleItem(itemId)`: expands/collapses detail section
- `loadItemDetail(itemId)`: fetches individual responses + cached consensus, renders both
- `generateConsensus(itemId)`: POSTs to generate consensus for one item, reloads detail
- `generateAll()`: POSTs to generate all, refreshes dashboard
- `renderConsensus(data)`: shows consensus definition, common themes, disagreements, confidence

**Step 3: Commit**

```
git add public/admin.html public/js/admin.js
git commit -m "feat: admin dashboard with ranked items and consensus generation"
```

---

### Task 7: CSS styling

**Files:**
- Create: `public/css/style.css`

**Step 1: Write complete stylesheet**

Base patterns from church-reno adapted with blue/slate palette:
- CSS variables, reset, container, header, screens, buttons, progress bar, spinner
- Item cards with importance dots (reuse scale-dot pattern) and textarea
- Category headers and colored badges (blue=Facilities, purple=Faith, green=UX, amber=Culture)
- Admin ranked list rows with score badges
- Expandable detail sections with response cards
- Consensus box styling
- Mobile responsive

**Step 2: Commit**

```
git add public/css/style.css
git commit -m "feat: complete CSS styling"
```

---

### Task 8: Test end-to-end locally

**Step 1: Create .env with ANTHROPIC_API_KEY**
**Step 2: Start dev server with `npm run dev`**
**Step 3: Test survey flow** — complete a survey, verify all 28 items render, submit works
**Step 4: Test admin flow** — verify ranked list, expand items, test consensus generation
**Step 5: Fix any issues, commit fixes**

---

### Task 9: Push to GitHub and deploy

**Step 1: Push to origin main**
**Step 2: Deploy on Render using render.yaml**
**Step 3: Set ANTHROPIC_API_KEY in Render env vars**
**Step 4: Verify production deployment**
