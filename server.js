const express = require('express');
const cors = require('cors');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'CryptoQuest Backend API',
    version: '1.0.0',
    endpoints: [
      'POST /api/users',
      'GET /api/users/:privyDid',
      'POST /api/scores',
      'GET /api/users/:privyDid/history',
      'GET /api/leaderboard'
    ]
  });
});

// =====================================================
// ENDPOINT 1: POST /api/users - Create new user
// =====================================================
app.post('/api/users', (req, res) => {
  const { privyDid, walletAddress, username } = req.body;

  if (!privyDid) {
    return res.status(400).json({
      success: false,
      message: 'privyDid is required'
    });
  }

  // Check if user already exists
  db.get(
    'SELECT * FROM users WHERE privy_did = ?',
    [privyDid],
    (err, existingUser) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists',
          data: existingUser
        });
      }

      // Create new user
      db.run(
        'INSERT INTO users (privy_did, wallet_address, username) VALUES (?, ?, ?)',
        [privyDid, walletAddress, username || 'Anonymous'],
        function(err) {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to create user'
            });
          }

          // Get the created user
          db.get(
            'SELECT * FROM users WHERE privy_did = ?',
            [privyDid],
            (err, user) => {
              if (err) {
                return res.status(500).json({
                  success: false,
                  message: 'User created but failed to retrieve'
                });
              }

              res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: user
              });
            }
          );
        }
      );
    }
  );
});

// =====================================================
// ENDPOINT 2: POST /api/scores - Submit quiz score  
// =====================================================
app.post('/api/scores', (req, res) => {
  const { privyDid, quizId, score, difficulty } = req.body;

  // Validate required fields
  if (!privyDid || !quizId || score === undefined || !difficulty) {
    return res.status(400).json({
      success: false,
      message: 'privyDid, quizId, score, and difficulty are required'
    });
  }

  // Validate score is a number
  if (typeof score !== 'number' || score < 0) {
    return res.status(400).json({
      success: false,
      message: 'Score must be a non-negative number'
    });
  }

  // Check if user exists
  db.get(
    'SELECT * FROM users WHERE privy_did = ?',
    [privyDid],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Insert score (will fail if quiz already completed due to UNIQUE constraint)
      db.run(
        'INSERT INTO scores (privy_did, quiz_id, score, difficulty) VALUES (?, ?, ?, ?)',
        [privyDid, quizId, score, difficulty],
        function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              return res.status(409).json({
                success: false,
                message: 'Quiz already completed'
              });
            }
            console.error('Error saving score:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to save score'
            });
          }

          // Update user's total score
          const newTotalScore = user.total_score + score;
          
          db.run(
            'UPDATE users SET total_score = ? WHERE privy_did = ?',
            [newTotalScore, privyDid],
            (err) => {
              if (err) {
                console.error('Error updating total score:', err);
                return res.status(500).json({
                  success: false,
                  message: 'Score saved but failed to update total'
                });
              }

              res.status(201).json({
                success: true,
                message: 'Score submitted successfully',
                data: {
                  scoreId: this.lastID,
                  score,
                  newTotalScore,
                  difficulty
                }
              });
            }
          );
        }
      );
    }
  );
});

// =====================================================
// ENDPOINT 3: GET /api/leaderboard - Get leaderboard
// =====================================================
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;

  db.all(
    `SELECT 
      privy_did,
      username,
      total_score,
      avatar,
      created_at,
      (SELECT COUNT(*) FROM scores WHERE scores.privy_did = users.privy_did) as quiz_count
     FROM users 
     WHERE total_score > 0 
     ORDER BY total_score DESC 
     LIMIT ?`,
    [limit],
    (err, users) => {
      if (err) {
        console.error('Error fetching leaderboard:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch leaderboard'
        });
      }

      // Add rank to each user
      const leaderboard = users.map((user, index) => ({
        rank: index + 1,
        name: user.username || 'Anonymous',
        score: user.total_score,
        avatar: user.avatar,
        privyDid: user.privy_did,
        quiz_count: user.quiz_count,
        joined_date: user.created_at
      }));

      res.json({
        success: true,
        data: {
          leaderboard,
          total_players: users.length,
          last_updated: new Date().toISOString()
        }
      });
    }
  );
});

// =====================================================
// ENDPOINT 4: GET /api/users/:privyDid - Get user profile
// =====================================================
app.get('/api/users/:privyDid', (req, res) => {
  const privyDid = req.params.privyDid;

  db.get(
    'SELECT * FROM users WHERE privy_did = ?',
    [privyDid],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's quiz count
      db.get(
        'SELECT COUNT(*) as quiz_count FROM scores WHERE privy_did = ?',
        [privyDid],
        (err, stats) => {
          if (err) {
            console.error('Error getting user stats:', err);
          }

          res.json({
            success: true,
            data: {
              ...user,
              quiz_count: stats?.quiz_count || 0
            }
          });
        }
      );
    }
  );
});

// =====================================================
// ENDPOINT 5: GET /api/users/:privyDid/history - Get user quiz history
// =====================================================
app.get('/api/users/:privyDid/history', (req, res) => {
  const privyDid = req.params.privyDid;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  // Check if user exists
  db.get(
    'SELECT privy_did FROM users WHERE privy_did = ?',
    [privyDid],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's quiz history
      db.all(
        'SELECT * FROM scores WHERE privy_did = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [privyDid, limit, offset],
        (err, scores) => {
          if (err) {
            console.error('Error fetching history:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to fetch quiz history'
            });
          }

          // Get total count for pagination
          db.get(
            'SELECT COUNT(*) as total FROM scores WHERE privy_did = ?',
            [privyDid],
            (err, countResult) => {
              const total = countResult?.total || 0;
              const hasMore = total > offset + scores.length;

              res.json({
                success: true,
                data: {
                  history: scores,
                  pagination: {
                    total,
                    limit,
                    offset,
                    hasMore
                  }
                }
              });
            }
          );
        }
      );
    }
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler  
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CryptoQuest Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});