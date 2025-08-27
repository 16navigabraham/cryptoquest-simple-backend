const express = require('express');
const cors = require('cors');
const database = require('./database');
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

// Initialize database connection
let dbReady = false;

database.connect()
  .then(() => {
    dbReady = true;
    console.log('Database connected successfully');
  })
  .catch(error => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });

// Middleware to check database connection
const checkDbConnection = (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({
      success: false,
      message: 'Database not ready'
    });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: dbReady ? 'connected' : 'disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'CryptoQuest Backend API - MongoDB Version',
    version: '3.0.0',
    endpoints: [
      'POST /api/users - Create/Update user profile',
      'GET /api/users/:walletAddress - Get user profile with stats', 
      'POST /api/scores - Submit quiz score',
      'GET /api/users/:walletAddress/history - Get user quiz history',
      'GET /api/leaderboard - Get leaderboard'
    ]
  });
});

// Utility function to validate wallet address
const isValidWalletAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Utility function to validate IPFS URL
const isValidIPFSUrl = (url) => {
  if (!url) return true; // Optional field
  return url.startsWith('ipfs://') || 
         url.startsWith('https://ipfs.io/ipfs/') || 
         url.startsWith('https://gateway.pinata.cloud/ipfs/') ||
         url.includes('ipfs');
};

// =====================================================
// ENDPOINT 1: POST /api/users - Create or Update User Profile
// =====================================================
app.post('/api/users', checkDbConnection, async (req, res) => {
  try {
    const { walletAddress, username, profilePictureUrl } = req.body;

    // Validate required fields
    if (!walletAddress || !username) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress and username are required'
      });
    }

    // Validate wallet address format
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format. Must be a valid Ethereum address (0x...)'
      });
    }

    // Validate profile picture URL if provided
    if (profilePictureUrl && !isValidIPFSUrl(profilePictureUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile picture URL. Must be a valid IPFS URL'
      });
    }

    // Validate username length
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 30 characters'
      });
    }

    // Check if user already exists
    const existingUser = await database.getUserByWallet(walletAddress);

    if (existingUser) {
      // Update existing user
      const updateData = {
        username,
        ...(profilePictureUrl && { profilePictureUrl })
      };

      const updatedUser = await database.updateUser(walletAddress, updateData);

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update user'
        });
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          id: updatedUser._id,
          walletAddress: updatedUser.walletAddress,
          username: updatedUser.username,
          profilePictureUrl: updatedUser.profilePictureUrl,
          totalScore: updatedUser.totalScore,
          level: updatedUser.level,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt
        }
      });
    } else {
      // Create new user
      const newUser = await database.createUser({
        walletAddress,
        username,
        profilePictureUrl
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          id: newUser._id,
          walletAddress: newUser.walletAddress,
          username: newUser.username,
          profilePictureUrl: newUser.profilePictureUrl,
          totalScore: newUser.totalScore,
          level: newUser.level,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        }
      });
    }

  } catch (error) {
    console.error('Error in POST /api/users:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// ENDPOINT 2: GET /api/users/:walletAddress - Get User Profile
// =====================================================
app.get('/api/users/:walletAddress', checkDbConnection, async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;

    // Validate wallet address format
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const user = await database.getUserByWallet(walletAddress);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user stats
    const stats = await database.getUserStats(walletAddress);

    res.json({
      success: true,
      data: {
        id: user._id,
        walletAddress: user.walletAddress,
        username: user.username,
        profilePictureUrl: user.profilePictureUrl, // This was missing in SQLite version
        totalScore: user.totalScore,
        level: user.level,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        stats: {
          quizzesCompleted: stats.quizCount,
          averageScore: Math.round(stats.averageScore || 0),
          bestScore: stats.bestScore || 0
        }
      }
    });

  } catch (error) {
    console.error('Error in GET /api/users/:walletAddress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// ENDPOINT 3: POST /api/scores - Submit Quiz Score
// =====================================================
app.post('/api/scores', checkDbConnection, async (req, res) => {
  try {
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
    if (typeof score !== 'number' || score < 0 || score > maxScore) {
      return res.status(400).json({
        success: false,
        message: `Score must be a number between 0 and ${maxScore}`
      });
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard', 'beginner', 'intermediate', 'advanced'];
    if (!validDifficulties.includes(difficulty.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty. Must be one of: ' + validDifficulties.join(', ')
      });
    }

    // Check if user exists
    const user = await database.getUserByWallet(walletAddress);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please create profile first.'
      });
    }

    // Create score record
    const scoreData = {
      walletAddress,
      quizId,
      score,
      difficulty: difficulty.toLowerCase(),
      maxScore
    };

    const newScore = await database.createScore(scoreData);
    const percentage = newScore.percentage;

    // Update user's total score
    const updatedUser = await database.updateUserTotalScore(walletAddress, score);

    res.status(201).json({
      success: true,
      message: 'Score submitted successfully',
      data: {
        scoreId: newScore._id,
        score: newScore.score,
        maxScore: newScore.maxScore,
        percentage: Math.round(percentage),
        difficulty: newScore.difficulty,
        newTotalScore: updatedUser.totalScore,
        eligibleForReward: percentage >= 70, // 70% minimum for rewards
        submittedAt: newScore.createdAt
      }
    });

  } catch (error) {
    console.error('Error in POST /api/scores:', error);
    
    if (error.message.includes('already completed')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// ENDPOINT 4: GET /api/users/:walletAddress/history
// =====================================================
app.get('/api/users/:walletAddress/history', checkDbConnection, async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per request
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // Validate wallet address
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    // Check if user exists
    const user = await database.getUserByWallet(walletAddress);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get quiz history
    const historyData = await database.getUserScoreHistory(walletAddress, limit, offset);

    res.json({
      success: true,
      data: {
        history: historyData.scores,
        pagination: {
          total: historyData.total,
          limit,
          offset,
          hasMore: historyData.hasMore
        }
      }
    });

  } catch (error) {
    console.error('Error in GET /api/users/:walletAddress/history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =====================================================
// ENDPOINT 5: GET /api/leaderboard
// =====================================================
app.get('/api/leaderboard', checkDbConnection, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Max 500 per request

    const leaderboard = await database.getLeaderboard(limit);

    res.json({
      success: true,
      data: {
        leaderboard,
        totalPlayers: leaderboard.length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in GET /api/leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
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
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    await database.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));