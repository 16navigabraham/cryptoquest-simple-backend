const sqlite3 = require('sqlite3').verbose();

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
  // Create users table - simplified with wallet address as primary identifier
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      profile_picture TEXT,
      total_score INTEGER DEFAULT 0,
      level TEXT DEFAULT 'beginner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create scores table - using wallet address instead of privy_did
  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      quiz_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      max_score INTEGER DEFAULT 20,
      percentage REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(wallet_address, quiz_id),
      FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
    )
  `);

  console.log('Database tables initialized');
}

module.exports = db;