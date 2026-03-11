# KanbanRank

A team survey tool for prioritizing kanban board items. Team members rank items by importance and provide "Definition of Done" descriptions. An admin dashboard shows aggregated results and uses AI to generate consensus definitions.

**Live:** https://kanbanrank.onrender.com

## Features

### Survey (Public)
- 28 kanban items across 4 categories (Facilities, Faith Formation, User Experience, Culture)
- Rate each item's importance on a 1-5 scale
- Provide a "Definition of Done" for each item (or check "I don't know")
- Optional name field at the end before submission
- Progress bar tracks completion
- Single scrolling page grouped by category

### Admin Dashboard (`/admin.html`)
- **Rankings tab** — Items auto-sorted by average importance with expandable details
- **Analysis tab** — Category priority rankings, top/bottom 5 items, DoD coverage ring, IDK report
- Color-coded bars (green = high priority, red = low)
- Click any item to see individual responses and AI consensus
- Generate consensus per item or for all items at once
- Clear all data button (double confirmation)

### AI Consensus (Claude)
- Synthesizes team DoD responses into a consensus definition
- Detects and handles outlier responses (weights toward majority view)
- Identifies common themes and disagreements
- Provides a 0-100 confidence score
- Cached results with regeneration option

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **AI:** Anthropic Claude (claude-sonnet-4-20250514)
- **Frontend:** Vanilla HTML/CSS/JS (no frameworks)
- **Hosting:** Render.com with persistent disk

## Setup

```bash
npm install
```

### Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Required for AI consensus generation |
| `DB_PATH` | SQLite database path (default: `./db/kanban.db`) |
| `PORT` | Server port (default: `3000`) |

### Run

```bash
npm start
```

The database is auto-created and seeded from `data/kanban_items.csv` on first run.

## Project Structure

```
├── data/kanban_items.csv    # 28 kanban items (CSV seed data)
├── public/
│   ├── index.html           # Survey page
│   ├── admin.html           # Admin dashboard
│   ├── css/style.css        # All styles
│   └── js/
│       ├── app.js           # Survey frontend logic
│       └── admin.js         # Admin frontend logic
├── src/
│   ├── server.js            # Express entry point
│   ├── database.js          # SQLite setup and seeding
│   ├── ai.js                # Claude AI consensus generation
│   └── routes/
│       ├── api.js           # Survey API (items, respondents, responses)
│       └── admin.js         # Admin API (results, consensus, analysis)
└── package.json
```

## API Routes

### Survey
- `GET /api/items` — List all kanban items
- `POST /api/respondents` — Create anonymous respondent
- `POST /api/responses/:respondentId` — Submit all responses

### Admin
- `GET /admin/results` — Ranked items with averages
- `GET /admin/items/:id/responses` — Individual responses for an item
- `POST /admin/items/:id/consensus` — Generate AI consensus for one item
- `GET /admin/items/:id/consensus` — Get cached consensus
- `POST /admin/consensus/all` — Generate consensus for all items
- `GET /admin/analysis` — Category stats, top/bottom 5, IDK report, DoD coverage
- `GET /admin/respondents` — List all respondents
- `DELETE /admin/respondents/:id` — Delete a respondent
- `POST /admin/clear-all` — Wipe all data
