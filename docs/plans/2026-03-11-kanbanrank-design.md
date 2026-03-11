# KanbanRank Design

## Purpose
Team survey tool where members rank 28 kanban items by importance (1-5) and provide their "Definition of Done" for each. Admin view shows items sorted by average importance with Claude AI-generated consensus definitions.

## Tech Stack
Node.js/Express, SQLite (better-sqlite3), Claude API, vanilla HTML/CSS/JS. Deployed on Render.com.

## Architecture
```
KanbanRank/
├── src/
│   ├── server.js
│   ├── database.js
│   ├── ai.js
│   └── routes/
│       ├── api.js
│       └── admin.js
├── public/
│   ├── index.html
│   ├── admin.html
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       └── admin.js
├── db/.gitkeep
├── package.json
├── .env.example
└── render.yaml
```

## Data Model
- **respondents**: id (UUID), name (optional), created_at, completed_at
- **items**: id, title, category — seeded from CSV on startup
- **responses**: id, respondent_id, item_id, importance (1-5), definition_of_done (text)
- **ai_results**: id, item_id, result_type ('consensus'), content (text), created_at

## Survey Page
1. Landing: intro + optional name field + "Begin"
2. Single scrolling page, all 28 items, category headers
3. Each item: title (category badge) → 1-2-3-4-5 radio buttons → textarea for DoD
4. Submit → save all → confirmation

## Admin Page
- Items ranked by average importance (highest first)
- Each row: rank, title, category, average score, respondent count
- Expandable: individual DoD responses
- "Generate Consensus" per item or "Generate All" — Claude synthesizes consensus DoD
- Response count at top

## AI Synthesis
Per-item: all DoD responses sent to Claude to produce consensus definition capturing common themes, noting disagreements, producing actionable definition. On-demand only.

## Data Source
28 items from kanban_items.csv across 4 categories: Facilities & Operations, Faith Formation, User Experience, Culture.
