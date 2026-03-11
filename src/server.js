require('dotenv').config();
const express = require('express');
const path = require('path');
const { getDb } = require('./database');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

getDb();

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`KanbanRank running on port ${PORT}`);
});
