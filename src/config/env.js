import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  DB_NAME: process.env.DB_NAME || 'cryptoquest',

  // AI & OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Blockchain & Web3
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL || 'https://mainnet.base.org',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
  REWARD_TOKEN_ADDRESS: process.env.REWARD_TOKEN_ADDRESS, // Your existing ERC20 token
  CHAIN_ID: process.env.CHAIN_ID || 8453, // Base Mainnet

  // JWT & Auth
  JWT_SECRET: process.env.JWT_SECRET || 'cryptoquest-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // CORS Origins
  CORS_ORIGINS: [
    'http://localhost:3000',
    'http://localhost:5173', 
    'http://localhost:3001',
    'https://abrahamnavig-quest.vercel.app'
  ],

  // Rate Limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // 100 requests per window

  // Quiz Settings
  QUIZ_QUESTIONS_PER_SET: 5,
  PASSING_SCORE_PERCENTAGE: 70,
  XP_PER_CORRECT_ANSWER: 10,
  
  // Quiz Level Configuration
  QUIZ_LEVELS: {
    1: {
      name: 'level1',
      displayName: 'Level 1',
      topics: ['Blockchain Fundamentals', 'Basic Trading'],
      quickQuiz: { questions: 10, timeLimit: 120 }, // 2 minutes
      fullQuiz: { questions: 20, timeLimit: 300 },  // 5 minutes
      scoreThreshold: 75, // 75% to claim reward (reduced from 70%)
      description: 'Blockchain Fundamentals & Basic Trading'
    },
    2: {
      name: 'level2',
      displayName: 'Level 2',
      topics: ['Smart Contracts', 'DeFi Protocols', 'NFTs'],
      quickQuiz: { questions: 10, timeLimit: 120 }, // 2 minutes
      fullQuiz: { questions: 25, timeLimit: 300 },  // 5 minutes
      scoreThreshold: 75, // 75% to claim reward (reduced from 75%)
      description: 'Smart Contracts, DeFi Protocols & NFTs'
    },
    3: {
      name: 'level3',
      displayName: 'Level 3',
      topics: ['Solidity', 'Cross-chain concepts', 'MEV', 'Protocol Governance'],
      quickQuiz: { questions: 10, timeLimit: 120 }, // 2 minutes
      fullQuiz: { questions: 30, timeLimit: 300 },  // 5 minutes
      scoreThreshold: 80, // 80% to claim reward (reduced from 80%)
      description: 'Solidity, Cross-chain concepts, MEV, and Protocol Governance'
    },
    4: {
      name: 'level4',
      displayName: 'Level 4',
      topics: ['Advanced Smart Contract Security', 'Yield Farming', 'Flash Loans'],
      quickQuiz: { questions: 10, timeLimit: 120 }, // 2 minutes
      fullQuiz: { questions: 25, timeLimit: 300 },  // 5 minutes
      scoreThreshold: 85, // 85% to claim reward (reduced from 85%)
      description: 'Advanced Smart Contract Security, Yield Farming, and Flash Loans'
    },
    5: {
      name: 'level5',
      displayName: 'Level 5',
      topics: ['Advanced Cryptography', 'Protocol Research', 'Layer 2 Scaling'],
      quickQuiz: { questions: 10, timeLimit: 120 }, // 2 minutes
      fullQuiz: { questions: 20, timeLimit: 300 },  // 5 minutes
      scoreThreshold: 90, // 90% to claim reward (reduced from 90%)
      description: 'Advanced Cryptography, Protocol Research, and Layer 2 Scaling'
    }
  },
  
  // Level Thresholds
  LEVEL_THRESHOLDS: {
    level1: 0,
    level2: 150,      // Complete level 1 successfully
    level3: 400,      // Progress through level 2  
    level4: 800,      // Master level 3
    level5: 1500      // Expert level ready
  },

  // Badge Minting Thresholds
  BADGE_THRESHOLDS: {
    level1: 100,      // First badge after some quizzes
    level2: 250,      // Level 2 mastery
    level3: 500,      // Level 3 mastery
    level4: 1000,     // Level 4 mastery
    level5: 2000      // Level 5 mastery
  }
};

// Validation
const requiredEnvVars = ['OPENAI_API_KEY', 'PRIVATE_KEY', 'CONTRACT_ADDRESS'];

if (config.NODE_ENV === 'production') {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }
}

export default config;