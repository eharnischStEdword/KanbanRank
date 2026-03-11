const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { generateConsensus } = require('../ai');

// Get ranked items with averages
router.get('/results', (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT
      i.id, i.title, i.category,
      COALESCE(AVG(r.importance), 0) as avg_importance,
      COUNT(r.id) as response_count
    FROM items i
    LEFT JOIN responses r ON i.id = r.item_id
    GROUP BY i.id
    ORDER BY avg_importance DESC, i.title ASC
  `).all();

  const totalRespondents = db.prepare(
    'SELECT COUNT(*) as c FROM respondents WHERE completed_at IS NOT NULL'
  ).get().c;

  res.json({ items, totalRespondents });
});

// Get individual responses for an item
router.get('/items/:itemId/responses', (req, res) => {
  const db = getDb();
  const responses = db.prepare(`
    SELECT r.importance, r.definition_of_done, resp.name
    FROM responses r
    JOIN respondents resp ON r.respondent_id = resp.id
    WHERE r.item_id = ? AND resp.completed_at IS NOT NULL
    ORDER BY r.importance DESC
  `).all(req.params.itemId);
  res.json(responses);
});

// Generate consensus for one item
router.post('/items/:itemId/consensus', async (req, res) => {
  const db = getDb();
  const { itemId } = req.params;

  const item = db.prepare('SELECT id, title FROM items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const responses = db.prepare(`
    SELECT r.importance, r.definition_of_done, resp.name
    FROM responses r
    JOIN respondents resp ON r.respondent_id = resp.id
    WHERE r.item_id = ? AND resp.completed_at IS NOT NULL AND r.definition_of_done IS NOT NULL AND r.definition_of_done != ''
    ORDER BY r.importance DESC
  `).all(itemId);

  if (responses.length < 1) {
    return res.status(400).json({ error: 'No Definition of Done responses for this item.' });
  }

  try {
    const result = await generateConsensus(item.title, responses);
    db.prepare("DELETE FROM ai_results WHERE item_id = ? AND result_type = 'consensus'").run(itemId);
    db.prepare(
      "INSERT INTO ai_results (item_id, result_type, content) VALUES (?, 'consensus', ?)"
    ).run(itemId, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    console.error('Consensus generation error:', err);
    res.status(500).json({ error: 'Failed to generate consensus.' });
  }
});

// Get cached consensus for an item
router.get('/items/:itemId/consensus', (req, res) => {
  const db = getDb();
  const cached = db.prepare(
    "SELECT content FROM ai_results WHERE item_id = ? AND result_type = 'consensus' ORDER BY created_at DESC LIMIT 1"
  ).get(req.params.itemId);
  if (cached) return res.json(JSON.parse(cached.content));
  res.json(null);
});

// Generate consensus for ALL items
router.post('/consensus/all', async (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT id, title FROM items').all();
  const results = {};
  const errors = [];

  for (const item of items) {
    const responses = db.prepare(`
      SELECT r.importance, r.definition_of_done, resp.name
      FROM responses r
      JOIN respondents resp ON r.respondent_id = resp.id
      WHERE r.item_id = ? AND resp.completed_at IS NOT NULL AND r.definition_of_done IS NOT NULL AND r.definition_of_done != ''
      ORDER BY r.importance DESC
    `).all(item.id);

    if (responses.length < 1) continue;

    try {
      const result = await generateConsensus(item.title, responses);
      db.prepare("DELETE FROM ai_results WHERE item_id = ? AND result_type = 'consensus'").run(item.id);
      db.prepare(
        "INSERT INTO ai_results (item_id, result_type, content) VALUES (?, 'consensus', ?)"
      ).run(item.id, JSON.stringify(result));
      results[item.id] = result;
    } catch (err) {
      console.error('Consensus error for item ' + item.id + ':', err);
      errors.push({ itemId: item.id, title: item.title, error: err.message });
    }
  }

  res.json({ generated: Object.keys(results).length, errors });
});

// Delete a respondent
router.delete('/respondents/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM responses WHERE respondent_id = ?').run(id);
    db.prepare('DELETE FROM respondents WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete.' });
  }
});

// List respondents
router.get('/respondents', (req, res) => {
  const db = getDb();
  const respondents = db.prepare(
    'SELECT id, name, created_at, completed_at FROM respondents ORDER BY created_at DESC'
  ).all();
  res.json(respondents);
});

// Clear all entries
router.post('/clear-all', (req, res) => {
  const db = getDb();
  try {
    db.prepare('DELETE FROM ai_results').run();
    db.prepare('DELETE FROM responses').run();
    db.prepare('DELETE FROM respondents').run();
    res.json({ ok: true });
  } catch (err) {
    console.error('Clear all error:', err);
    res.status(500).json({ error: 'Failed to clear.' });
  }
});

module.exports = router;
