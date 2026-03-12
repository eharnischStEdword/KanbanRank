# Progress Save, Response Timeline, and Refresh Button Design

**Goal:** Add three quality-of-life features: localStorage progress saving for survey respondents, a response timeline for admins, and a manual refresh button on the admin dashboard.

**Architecture:** All features are frontend-driven with minimal backend changes. Progress save uses localStorage. Timeline requires one new admin endpoint. Refresh button just re-calls existing data fetching.

**Tech Stack:** Vanilla JS, localStorage API, existing Express/SQLite backend

---

## Feature 1: Progress Save (localStorage)

Survey progress is saved to localStorage on every interaction so users can resume if they close the tab.

**Key:** `kanbanrank-progress`

**Stored data:**
```json
{
  "respondentId": "uuid",
  "answers": { "itemId": { "importance": 3, "definitionOfDone": "text", "idk": false } }
}
```

**Behavior:**
- Save to localStorage on every importance click and textarea input (debounce text to 500ms)
- On page load / startSurvey(), check for saved progress
- If found, show a banner: "Welcome back! We found your saved progress." with Resume and Start Fresh buttons
- Resume: restore answers and respondentId, render survey with saved state
- Start Fresh: clear localStorage, create new respondent as normal
- Clear localStorage on successful submission
- No expiration

**Files affected:**
- `public/js/app.js` — save/restore logic, resume banner
- `public/index.html` — banner HTML element (or inject dynamically)
- `public/css/style.css` — banner styling

## Feature 2: Response Timeline

A simple chronological list of who submitted and when, shown as a new admin tab.

**New endpoint:** `GET /admin/timeline`
- Query: `SELECT name, completed_at FROM respondents WHERE completed_at IS NOT NULL ORDER BY completed_at DESC`
- Response: `[{ name, completed_at }]`

**Display:** New "Timeline" tab alongside Rankings and Analysis.
- Each row: **Name** (or "Anonymous") — **formatted timestamp**
- Most recent first

**Files affected:**
- `src/routes/admin.js` — new `/timeline` endpoint
- `public/js/admin.js` — `loadTimeline()`, `renderTimeline()`, update `switchTab()`
- `public/admin.html` — new tab button and container div

## Feature 3: Refresh Button

A manual refresh button in the admin header that re-fetches dashboard data.

**Behavior:**
- Button placed near existing action buttons
- Calls `admin.loadDashboard()` on click
- Brief visual feedback (button text changes to "Refreshing..." then back)

**Files affected:**
- `public/admin.html` — new button element
- `public/js/admin.js` — `refreshDashboard()` method with visual feedback
