const express = require('express');
const cors = require('cors');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173', 
    'http://localhost:3001',
    'https://abrahamnavig-quest.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'POST') {
    console.log('Request body:', req.body);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'CryptoQuest Backend API - Simplified Version',
    version: '2.0.0',
    endpoints: [
      'POST /api/users - Create/Update user profile',
      'GET /api/users/:walletAddress - Get user profile', 
      'POST /api/scores - Submit quiz score',
      'GET /api/users/:walletAddress/history - Get user quiz history',
      'GET /api/leaderboard - Get leaderboard'
    ]
  });
});

// =====================================================
// ENDPOINT 1: POST /api/users - Create or Update User Profile
// =====================================================
app.post('/api/users', (req, res) => {
  const { walletAddress, username, profilePicture } = req.body;

  // Validate required fields
  if (!walletAddress || !username) {
    return res.status(400).json({
      success: false,
      message: 'walletAddress and username are required'
    });
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid wallet address format'
    });
  }

  // Check if user already exists
  db.get(
    'SELECT * FROM users WHERE wallet_address = ?',
    [walletAddress.toLowerCase()],
    (err, existingUser) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (existingUser) {
        // Update existing user
        db.run(
          'UPDATE users SET username = ?, profile_picture = ? WHERE wallet_address = ?',
          [username, profilePicture || existingUser.profile_picture, walletAddress.toLowerCase()],
          function(err) {
            if (err) {
              console.error('Error updating user:', err);
              return res.status(500).json({
                success: false,
                message: 'Failed to update user'
              });
            }

            // Get updated user
            db.get(
              'SELECT * FROM users WHERE wallet_address = ?',
              [walletAddress.toLowerCase()],
              (err, user) => {
                if (err) {
                  return res.status(500).json({
                    success: false,
                    message: 'User updated but failed to retrieve'
                  });
                }

                res.json({
                  success: true,
                  message: 'User updated successfully',
                  data: user
                });
              }
            );
          }
        );
      } else {
        // Create new user
        db.run(
          'INSERT INTO users (wallet_address, username, profile_picture) VALUES (?, ?, ?)',
          [walletAddress.toLowerCase(), username, profilePicture],
          function(err) {
            if (err) {
              console.error('Error creating user:', err);
              return res.status(500).json({
                success: false,
                message: 'Failed to create user'
              });
            }

            // Get created user
            db.get(
              'SELECT * FROM users WHERE wallet_address = ?',
              [walletAddress.toLowerCase()],
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
    }
  );
});

// =====================================================
// ENDPOINT 2: GET /api/users/:walletAddress - Get User Profile
// =====================================================
app.get('/api/users/:walletAddress', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();

  db.get(
    'SELECT * FROM users WHERE wallet_address = ?',
    [walletAddress],
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

      // Get user stats
      db.all(
        `SELECT 
          COUNT(*) as quiz_count,
          AVG(score) as average_score,
          MAX(score) as best_score
         FROM scores WHERE wallet_address = ?`,
        [walletAddress],
        (err, stats) => {
          const userStats = stats && stats[0] ? stats[0] : {
            quiz_count: 0,
            average_score: 0,
            best_score: 0
          };

          res.json({
            success: true,
            data: {
              ...user,
              stats: {
                quizzes_completed: userStats.quiz_count,
                average_score: Math.round(userStats.average_score || 0),
                best_score: userStats.best_score || 0
              }
            }
          });
        }
      );
    }
  );
});

// =====================================================
// ENDPOINT 3: POST /api/scores - Submit Quiz Score
// =====================================================
app.post('/api/scores', (req, res) => {
  const { walletAddress, quizId, score, difficulty, maxScore = 20 } = req.body;

  // Validate required fields
  if (!walletAddress || !quizId || score === undefined || !difficulty) {
    return res.status(400).json({
      success: false,
      message: 'walletAddress, quizId, score, and difficulty are required',
      received: { walletAddress, quizId, score, difficulty }
    });
  }

  // Validate score
  if (typeof score !== 'number' || score < 0) {
    return res.status(400).json({
      success: false,
      message: 'Score must be a non-negative number'
    });
  }

  const walletAddr = walletAddress.toLowerCase();
  const percentage = (score / maxScore) * 100;

  // Check if user exists
  db.get(
    'SELECT * FROM users WHERE wallet_address = ?',
    [walletAddr],
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
          message: 'User not found. Please create profile first.'
        });
      }

      // Insert score
      db.run(
        'INSERT INTO scores (wallet_address, quiz_id, score, difficulty, max_score, percentage) VALUES (?, ?, ?, ?, ?, ?)',
        [walletAddr, quizId, score, difficulty, maxScore, percentage],
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
            'UPDATE users SET total_score = ? WHERE wallet_address = ?',
            [newTotalScore, walletAddr],
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
                  maxScore,
                  percentage: Math.round(percentage),
                  newTotalScore,
                  difficulty,
                  eligible_for_reward: percentage >= 70 // 70% minimum for rewards
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
// ENDPOINT 4: GET /api/users/:walletAddress/history
// =====================================================
app.get('/api/users/:walletAddress/history', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  db.get(
    'SELECT wallet_address FROM users WHERE wallet_address = ?',
    [walletAddress],
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

      // Get quiz history
      db.all(
        'SELECT * FROM scores WHERE wallet_address = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [walletAddress, limit, offset],
        (err, scores) => {
          if (err) {
            console.error('Error fetching history:', err);
            return res.status(500).json({
              success: false,
              message: 'Failed to fetch quiz history'
            });
          }

          // Get total count
          db.get(
            'SELECT COUNT(*) as total FROM scores WHERE wallet_address = ?',
            [walletAddress],
            (err, countResult) => {
              const total = countResult?.total || 0;

              res.json({
                success: true,
                data: {
                  history: scores,
                  pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: total > offset + scores.length
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

// =====================================================
// ENDPOINT 5: GET /api/leaderboard
// =====================================================
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;

  db.all(
    `SELECT 
      users.wallet_address,
      users.username,
      users.profile_picture,
      users.total_score,
      users.level,
      users.created_at,
      COUNT(scores.id) as quiz_count
     FROM users 
     LEFT JOIN scores ON users.wallet_address = scores.wallet_address
     WHERE users.total_score > 0 
     GROUP BY users.wallet_address
     ORDER BY users.total_score DESC 
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

      const leaderboard = users.map((user, index) => ({
        rank: index + 1,
        wallet_address: user.wallet_address,
        username: user.username,
        profile_picture: user.profile_picture,
        score: user.total_score,
        level: user.level,
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

// Error handling
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
  console.log(`CryptoQuest Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Frontend: https://abrahamnavig-quest.vercel.app`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});