const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'kanban.db');

let db;

function getDb() {
  if (db) return db;

  // Ensure the directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbExists = fs.existsSync(DB_PATH);
  console.log(`[DB] Path: ${DB_PATH}`);
  console.log(`[DB] Database file exists: ${dbExists}`);
  if (dbExists) {
    const stats = fs.statSync(DB_PATH);
    console.log(`[DB] Database size: ${stats.size} bytes, modified: ${stats.mtime.toISOString()}`);
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables(db);
  seedItems(db);

  const respondentCount = db.prepare('SELECT COUNT(*) as c FROM respondents WHERE completed_at IS NOT NULL').get().c;
  console.log(`[DB] Completed respondents: ${respondentCount}`);

  return db;
}

function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS respondents (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      respondent_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      importance INTEGER NOT NULL CHECK(importance BETWEEN 1 AND 5),
      definition_of_done TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (respondent_id) REFERENCES respondents(id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE(respondent_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS ai_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      result_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        fields.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += ch;
      i++;
    }
  }

  fields.push(current.trim());
  return fields;
}

function seedItems(db) {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM items').get();
  if (count.cnt > 0) return;

  const csvPath = path.join(__dirname, '..', 'data', 'kanban_items.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('CSV file not found at', csvPath);
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  // Skip header
  const dataLines = lines.slice(1);

  const insert = db.prepare('INSERT INTO items (title, category) VALUES (?, ?)');
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(row.title, row.category);
    }
  });

  const rows = [];
  for (const line of dataLines) {
    const fields = parseCSVLine(line);
    if (fields.length >= 2) {
      rows.push({ title: fields[0], category: fields[1] });
    }
  }

  insertMany(rows);
  console.log(`Seeded ${rows.length} kanban items`);
}

module.exports = { getDb };
