import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';

// Import configuration and database
import config from './config/env.js';
import database from './config/db.js';

// Import routes
import quizRoutes from './routes/quizRoutes.js';
import userRoutes from './routes/userRoutes.js';
import rewardRoutes from './routes/rewardRoutes.js';
import levelRoutes from './routes/levelRoutes.js';

// Import services
import { RewardService } from './services/rewardService.js';
import blockchainService from './services/blockchain.js';

// Import utilities
import { createLogger, asyncHandler } from './utils/helpers.js';
import { RATE_LIMITS } from './utils/constants.js';

const logger = createLogger('APP');
const app = express();

// =====================================================
// MIDDLEWARE SETUP
// =====================================================

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.WINDOW_MS,
  max: RATE_LIMITS.GENERAL.MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});

const quizLimiter = rateLimit({
  windowMs: RATE_LIMITS.QUIZ_GENERATION.WINDOW_MS,
  max: RATE_LIMITS.QUIZ_GENERATION.MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many quiz requests, please try again later'
  }
});

const submitLimiter = rateLimit({
  windowMs: RATE_LIMITS.QUIZ_SUBMISSION.WINDOW_MS,
  max: RATE_LIMITS.QUIZ_SUBMISSION.MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many quiz submissions, please try again later'
  }
});

// Apply rate limiting
app.use(generalLimiter);
app.use('/api/quiz/generate', quizLimiter);
app.use('/api/quiz/submit', submitLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  logger.info(`${req.method} ${req.path}`, {
    timestamp,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  if (req.method === 'POST' && req.body) {
    // Log request body but sanitize sensitive data
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.privateKey) sanitizedBody.privateKey = '[REDACTED]';
    if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
    logger.debug('Request body:', sanitizedBody);
  }
  
  next();
});

// =====================================================
// DATABASE & BLOCKCHAIN INITIALIZATION
// =====================================================

let dbReady = false;
let blockchainReady = false;

// Initialize database
database.connect()
  .then(() => {
    dbReady = true;
    logger.info('✅ Database connected successfully');
  })
  .catch(error => {
    logger.error('❌ Failed to connect to database:', error);
    process.exit(1);
  });

// Initialize blockchain connection
blockchainService.initializeBlockchain()
  .then((success) => {
    blockchainReady = success;
    if (success) {
      logger.info('✅ Blockchain connection initialized');
    } else {
      logger.info('⚠️ Blockchain features disabled (configuration incomplete)');
    }
  })
  .catch(error => {
    logger.error('⚠️ Blockchain initialization failed:', error);
    logger.info('🔄 App will continue without blockchain features');
    blockchainReady = false;
  });

// Database connection middleware
const checkDbConnection = (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({
      success: false,
      message: 'Database not ready'
    });
  }
  next();
};

// =====================================================
// HEALTH CHECK & ROOT ENDPOINTS
// =====================================================

app.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: config.VERSION || '4.0.0',
    services: {
      database: dbReady ? 'connected' : 'disconnected',
      blockchain: blockchainReady ? 'connected' : 'disconnected'
    }
  };

  // Add blockchain details if connected
  if (blockchainReady) {
    try {
      const blockchainStatus = await blockchainService.healthCheck();
      health.blockchain = blockchainStatus;
    } catch (error) {
      health.services.blockchain = 'error';
      health.blockchainError = error.message;
    }
  }

  const statusCode = (dbReady && blockchainReady) ? 200 : 503;
  res.status(statusCode).json(health);
}));

app.get('/', (req, res) => {
  res.json({
    message: '🚀 CryptoQuest Backend API v4.0 - AI-Powered Quiz Platform',
    version: '4.0.0',
    features: [
      '🧠 AI-generated quizzes with OpenAI',
      '🏆 Onchain badge minting on Base',
      '📊 Advanced user progression system',
      '⚡ Real-time leaderboards',
      '🎯 Personalized recommendations'
    ],
    endpoints: {
      quiz: [
        'POST /api/quiz/generate - Generate AI-powered quiz',
        'POST /api/quiz/submit - Submit quiz answers',
        'GET /api/quiz/:id - Get specific quiz',
        'GET /api/quiz/level/:level - Get quizzes by level'
      ],
      user: [
        'POST /api/users - Create/Update user profile',
        'GET /api/users/:walletAddress - Get user profile with stats',
        'GET /api/users/:walletAddress/history - Get quiz history',
        'GET /api/users - Get leaderboard'
      ],
      rewards: [
        'POST /api/rewards/claim - Claim XP rewards',
        'POST /api/rewards/mint - Mint achievement badges',
        'GET /api/rewards/:walletAddress - Get user rewards',
        'GET /api/rewards/:walletAddress/badges - Get user badges'
      ]
    },
    status: {
      database: dbReady ? '✅ Connected' : '❌ Disconnected',
      blockchain: blockchainReady ? '✅ Connected' : '⚠️ Offline (check configuration)',
      ai: config.OPENAI_API_KEY && config.OPENAI_API_KEY !== 'sk-test-key-replace-with-real-key' ? '✅ Configured' : '⚠️ Demo mode (add API key)'
    }
  });
});

// =====================================================
// API ROUTES
// =====================================================

app.use('/api/quiz', checkDbConnection, quizRoutes);
app.use('/api/users', checkDbConnection, userRoutes);
app.use('/api/rewards', checkDbConnection, rewardRoutes);
app.use('/api/levels', checkDbConnection, levelRoutes);
app.use('/api/levels', checkDbConnection, levelRoutes);

// Legacy endpoint compatibility
app.use('/api/scores', checkDbConnection, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'This endpoint has been moved to /api/quiz/submit',
    newEndpoint: '/api/quiz/submit'
  });
});

// =====================================================
// SCHEDULED TASKS
// =====================================================

// Daily task to check and mint pending badges
cron.schedule('0 2 * * *', async () => {
  logger.info('🕐 Running daily badge check...');
  try {
    // This would be implemented to check users who qualify for new badges
    // and automatically mint them
    logger.info('✅ Daily badge check completed');
  } catch (error) {
    logger.error('❌ Daily badge check failed:', error);
  }
});

// Weekly leaderboard reset/snapshot (if needed)
cron.schedule('0 0 * * 0', async () => {
  logger.info('📊 Weekly leaderboard maintenance...');
  try {
    // Implement any weekly leaderboard logic here
    logger.info('✅ Weekly maintenance completed');
  } catch (error) {
    logger.error('❌ Weekly maintenance failed:', error);
  }
});

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      '/api/quiz/*',
      '/api/users/*',
      '/api/rewards/*',
      '/health'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const isDevelopment = config.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong',
    ...(isDevelopment && { 
      stack: err.stack,
      details: err 
    })
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================

const PORT = config.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info(`🚀 CryptoQuest Backend v4.0 running on port ${PORT}`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
  logger.info(`📖 API docs: http://localhost:${PORT}/`);
  
  if (config.NODE_ENV === 'development') {
    logger.info(`🔧 Development mode enabled`);
  }
  
  // Log configuration status
  logger.info('📋 Configuration Status:');
  logger.info(`   Database: ${config.MONGODB_URI ? '✅' : '❌'}`);
  logger.info(`   OpenAI: ${config.OPENAI_API_KEY && config.OPENAI_API_KEY !== 'sk-test-key-replace-with-real-key' ? '✅' : '⚠️ Demo mode'}`);
  logger.info(`   Blockchain: ${config.PRIVATE_KEY && config.CONTRACT_ADDRESS && config.PRIVATE_KEY !== 'your_private_key_here' && config.CONTRACT_ADDRESS !== '0x1234567890123456789012345678901234567890' ? '✅' : '⚠️ Demo mode'}`);
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close database connection
    await database.close();
    logger.info('Database connection closed');
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;