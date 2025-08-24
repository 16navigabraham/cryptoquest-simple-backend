const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create/connect to SQLite database
const db = new sqlite3.Database('cryptoquest.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      privy_did TEXT UNIQUE NOT NULL,
      wallet_address TEXT,
      username TEXT,
      total_score INTEGER DEFAULT 0,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create scores table
  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      privy_did TEXT NOT NULL,
      quiz_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(privy_did, quiz_id),
      FOREIGN KEY (privy_did) REFERENCES users (privy_did)
    )
  `);

  console.log('Database tables initialized');
}

module.exports = db;