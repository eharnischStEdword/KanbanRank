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
    LEFT JOIN respondents resp ON r.respondent_id = resp.id
    WHERE resp.completed_at IS NOT NULL OR r.id IS NULL
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
    return res.status(400).json({ error: 'Need at least 1 Definition of Done response to generate consensus.' });
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

  let skipped = 0;

  for (const item of items) {
    const responses = db.prepare(`
      SELECT r.importance, r.definition_of_done, resp.name
      FROM responses r
      JOIN respondents resp ON r.respondent_id = resp.id
      WHERE r.item_id = ? AND resp.completed_at IS NOT NULL AND r.definition_of_done IS NOT NULL AND r.definition_of_done != ''
      ORDER BY r.importance DESC
    `).all(item.id);

    if (responses.length < 1) {
      skipped++;
      continue;
    }

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

  res.json({ generated: Object.keys(results).length, skipped, total: items.length, errors });
});

// Get all responses for a single respondent
router.get('/respondents/:id/responses', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const respondent = db.prepare('SELECT id, name, completed_at FROM respondents WHERE id = ?').get(id);
  if (!respondent) return res.status(404).json({ error: 'Respondent not found' });

  const responses = db.prepare(`
    SELECT r.id as response_id, r.item_id, r.importance, r.definition_of_done, i.title, i.category
    FROM responses r
    JOIN items i ON r.item_id = i.id
    WHERE r.respondent_id = ?
    ORDER BY i.category, i.title
  `).all(id);

  res.json({ respondent, responses });
});

// Update a single response (importance and/or definition_of_done)
router.patch('/responses/:responseId', (req, res) => {
  const db = getDb();
  const { responseId } = req.params;
  const { importance, definition_of_done } = req.body;

  const existing = db.prepare('SELECT id FROM responses WHERE id = ?').get(responseId);
  if (!existing) return res.status(404).json({ error: 'Response not found' });

  if (importance !== undefined) {
    if (!Number.isInteger(importance) || importance < 1 || importance > 5) {
      return res.status(400).json({ error: 'Importance must be 1-5' });
    }
    db.prepare('UPDATE responses SET importance = ? WHERE id = ?').run(importance, responseId);
  }

  if (definition_of_done !== undefined) {
    db.prepare('UPDATE responses SET definition_of_done = ? WHERE id = ?').run(definition_of_done, responseId);
  }

  res.json({ ok: true });
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

// Analysis dashboard
router.get('/analysis', (req, res) => {
  const db = getDb();

  const categoryStats = db.prepare(`
    SELECT i.category,
      ROUND(AVG(r.importance), 2) as avg_importance,
      COUNT(DISTINCT i.id) as item_count,
      COUNT(r.id) as total_ratings
    FROM items i
    LEFT JOIN responses r ON i.id = r.item_id
    LEFT JOIN respondents resp ON r.respondent_id = resp.id AND resp.completed_at IS NOT NULL
    GROUP BY i.category
    ORDER BY avg_importance DESC
  `).all();

  const itemStats = db.prepare(`
    SELECT i.id, i.title, i.category,
      ROUND(AVG(r.importance), 2) as avg_importance,
      COUNT(r.id) as response_count
    FROM items i
    LEFT JOIN responses r ON i.id = r.item_id
    LEFT JOIN respondents resp ON r.respondent_id = resp.id AND resp.completed_at IS NOT NULL
    GROUP BY i.id
    HAVING response_count > 0
    ORDER BY avg_importance DESC
  `).all();

  const top5 = itemStats.slice(0, 5);
  const bottom5 = itemStats.slice(-5).reverse();

  const idkStats = db.prepare(`
    SELECT i.id, i.title, i.category,
      COUNT(CASE WHEN r.definition_of_done IS NULL OR r.definition_of_done = '' THEN 1 END) as idk_count,
      COUNT(r.id) as total_responses
    FROM items i
    LEFT JOIN responses r ON i.id = r.item_id
    LEFT JOIN respondents resp ON r.respondent_id = resp.id AND resp.completed_at IS NOT NULL
    GROUP BY i.id
    HAVING idk_count > 0
    ORDER BY idk_count DESC
  `).all();

  const coverage = db.prepare(`
    SELECT
      COUNT(CASE WHEN r.definition_of_done IS NOT NULL AND r.definition_of_done != '' THEN 1 END) as with_dod,
      COUNT(r.id) as total
    FROM responses r
    JOIN respondents resp ON r.respondent_id = resp.id AND resp.completed_at IS NOT NULL
  `).get();

  const totalRespondents = db.prepare(
    'SELECT COUNT(*) as c FROM respondents WHERE completed_at IS NOT NULL'
  ).get().c;

  res.json({
    totalRespondents,
    categoryStats,
    top5,
    bottom5,
    idkStats,
    dodCoverage: {
      withDod: coverage.with_dod,
      total: coverage.total,
      pct: coverage.total > 0 ? Math.round((coverage.with_dod / coverage.total) * 100) : 0
    }
  });
});

// Timeline - list of submissions with timestamps
router.get('/timeline', (req, res) => {
  const db = getDb();
  const submissions = db.prepare(
    'SELECT name, completed_at FROM respondents WHERE completed_at IS NOT NULL ORDER BY completed_at DESC'
  ).all();
  res.json(submissions);
});

// === Export Endpoints ===

function csvEscape(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Export rankings + consensus as CSV
router.get('/export/rankings', (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT
      i.id, i.title, i.category,
      COALESCE(AVG(r.importance), 0) as avg_importance,
      COUNT(r.id) as response_count
    FROM items i
    LEFT JOIN responses r ON i.id = r.item_id
    LEFT JOIN respondents resp ON r.respondent_id = resp.id
    WHERE resp.completed_at IS NOT NULL OR r.id IS NULL
    GROUP BY i.id
    ORDER BY avg_importance DESC, i.title ASC
  `).all();

  const rows = [['Rank', 'Title', 'Category', 'Avg Importance', 'Response Count', 'Consensus DoD', 'Confidence %', 'Common Themes', 'Disagreements', 'Outliers']];

  items.forEach((item, idx) => {
    const cached = db.prepare(
      "SELECT content FROM ai_results WHERE item_id = ? AND result_type = 'consensus' ORDER BY created_at DESC LIMIT 1"
    ).get(item.id);
    let consensus = null;
    if (cached) { try { consensus = JSON.parse(cached.content); } catch (e) {} }

    rows.push([
      idx + 1,
      csvEscape(item.title),
      csvEscape(item.category),
      item.avg_importance ? item.avg_importance.toFixed(2) : '0',
      item.response_count,
      csvEscape(consensus ? consensus.consensusDefinition : ''),
      consensus && typeof consensus.confidence === 'number' ? consensus.confidence + '%' : '',
      csvEscape(consensus && consensus.commonThemes ? consensus.commonThemes.join('; ') : ''),
      csvEscape(consensus && consensus.disagreements ? consensus.disagreements.join('; ') : ''),
      csvEscape(consensus && consensus.outliers ? consensus.outliers.join('; ') : '')
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kanbanrank-rankings.csv"');
  res.send(csv);
});

// Export all individual responses as CSV
router.get('/export/responses', (req, res) => {
  const db = getDb();
  const responses = db.prepare(`
    SELECT resp.name, i.title, i.category, r.importance, r.definition_of_done, resp.completed_at
    FROM responses r
    JOIN items i ON r.item_id = i.id
    JOIN respondents resp ON r.respondent_id = resp.id
    WHERE resp.completed_at IS NOT NULL
    ORDER BY resp.name, i.category, i.title
  `).all();

  const rows = [['Respondent', 'Item', 'Category', 'Importance', 'Definition of Done', 'Submitted']];
  responses.forEach(r => {
    rows.push([
      csvEscape(r.name || 'Anonymous'),
      csvEscape(r.title),
      csvEscape(r.category),
      r.importance,
      csvEscape(r.definition_of_done || ''),
      r.completed_at || ''
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kanbanrank-responses.csv"');
  res.send(csv);
});

// Export board update sheet — grouped by category, sorted by priority
router.get('/export/board-update', (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT
      i.id, i.title, i.category,
      COALESCE(AVG(r.importance), 0) as avg_importance,
      COUNT(r.id) as response_count
    FROM items i
    LEFT JOIN responses r ON i.id = r.item_id
    LEFT JOIN respondents resp ON r.respondent_id = resp.id
    WHERE resp.completed_at IS NOT NULL OR r.id IS NULL
    GROUP BY i.id
    ORDER BY i.category, avg_importance DESC
  `).all();

  const totalRespondents = db.prepare(
    'SELECT COUNT(*) as c FROM respondents WHERE completed_at IS NOT NULL'
  ).get().c;

  const rows = [['Category', 'Item', 'Avg Importance', 'Responses', 'Total Respondents', 'Consensus Definition of Done', 'Confidence %']];
  items.forEach(item => {
    const cached = db.prepare(
      "SELECT content FROM ai_results WHERE item_id = ? AND result_type = 'consensus' ORDER BY created_at DESC LIMIT 1"
    ).get(item.id);
    let consensus = null;
    if (cached) { try { consensus = JSON.parse(cached.content); } catch (e) {} }

    rows.push([
      csvEscape(item.category),
      csvEscape(item.title),
      item.avg_importance ? item.avg_importance.toFixed(2) : '0',
      item.response_count,
      totalRespondents,
      csvEscape(consensus ? consensus.consensusDefinition : 'Not generated'),
      consensus && typeof consensus.confidence === 'number' ? consensus.confidence + '%' : ''
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kanbanrank-board-update.csv"');
  res.send(csv);
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
