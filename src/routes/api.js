const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

// Get all items
router.get('/items', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT id, title, category FROM items ORDER BY id').all();
  res.json(items);
});

// Create respondent
router.post('/respondents', (req, res) => {
  const { name } = req.body || {};
  const id = uuidv4();
  const db = getDb();
  db.prepare('INSERT INTO respondents (id, name) VALUES (?, ?)').run(id, name || null);
  res.json({ id });
});

// Submit all responses
router.post('/responses/:respondentId', (req, res) => {
  const { respondentId } = req.params;
  const { responses, name } = req.body;
  if (!responses || !Array.isArray(responses)) {
    return res.status(400).json({ error: 'responses array required' });
  }
  for (const item of responses) {
    if (!Number.isInteger(item.itemId)) {
      return res.status(400).json({ error: 'Invalid itemId' });
    }
    if (!Number.isInteger(item.importance) || item.importance < 1 || item.importance > 5) {
      return res.status(400).json({ error: 'Importance must be 1-5 for item ' + item.itemId });
    }
  }
  const db = getDb();
  const respondent = db.prepare('SELECT id FROM respondents WHERE id = ?').get(respondentId);
  if (!respondent) return res.status(404).json({ error: 'Respondent not found' });

  if (name) {
    db.prepare('UPDATE respondents SET name = ? WHERE id = ?').run(name, respondentId);
  }

  const upsert = db.prepare(
    `INSERT INTO responses (respondent_id, item_id, importance, definition_of_done)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(respondent_id, item_id) DO UPDATE SET
       importance = excluded.importance,
       definition_of_done = excluded.definition_of_done`
  );
  const saveAll = db.transaction((items) => {
    for (const item of items) {
      upsert.run(respondentId, item.itemId, item.importance, item.definitionOfDone || null);
    }
  });
  saveAll(responses);

  db.prepare("UPDATE respondents SET completed_at = datetime('now') WHERE id = ?").run(respondentId);
  res.json({ saved: responses.length });
});

module.exports = router;
