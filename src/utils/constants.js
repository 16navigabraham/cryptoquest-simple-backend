// Application Constants
export const APP_CONFIG = {
  VERSION: '4.0.0',
  NAME: 'CryptoQuest Backend',
  DESCRIPTION: 'AI-Powered Quiz Platform with Onchain Rewards'
};

// Contract Configuration
export const CONTRACT_CONFIG = {
  CHAIN_ID: 84532, // Base Sepolia
  NETWORK_NAME: 'Base Sepolia',
  RPC_URL: 'https://sepolia.base.org',
  EXPLORER_URL: 'https://sepolia.basescan.org'
};

// Quiz Configuration
export const QUIZ_CONFIG = {
  QUESTIONS_PER_QUIZ: 5,
  POINTS_PER_QUESTION: 10,
  TIME_LIMIT_SECONDS: 300, // 5 minutes
  PASSING_PERCENTAGE: 70,
  MAX_ATTEMPTS_PER_QUIZ: 1
};

// User Progression
export const LEVEL_THRESHOLDS = {
  beginner: 0,
  intermediate: 250,
  advanced: 500,
  expert: 1000,
  master: 2000
};

export const BADGE_THRESHOLDS = {
  beginner: 100,
  intermediate: 250,
  advanced: 500,
  expert: 1000,
  master: 2000
};

export const XP_REWARDS = {
  CORRECT_ANSWER: 10,
  QUIZ_COMPLETION: 50,
  FIRST_QUIZ: 100,
  PERFECT_SCORE: 100,
  DAILY_STREAK: 25
};

// AI Configuration
export const AI_CONFIG = {
  MODEL: 'gpt-4o-mini',
  MAX_TOKENS: 2000,
  TEMPERATURE: 0.7,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // ms
};

// Rate Limiting
export const RATE_LIMITS = {
  QUIZ_GENERATION: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 5
  },
  QUIZ_SUBMISSION: {
    WINDOW_MS: 60 * 1000, // 1 minute
    MAX_REQUESTS: 10
  },
  GENERAL: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
  }
};

// Error Codes
export const ERROR_CODES = {
  // User Errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVALID_WALLET_FORMAT: 'INVALID_WALLET_FORMAT',
  INVALID_USERNAME_LENGTH: 'INVALID_USERNAME_LENGTH',

  // Quiz Errors
  QUIZ_NOT_FOUND: 'QUIZ_NOT_FOUND',
  QUIZ_ALREADY_COMPLETED: 'QUIZ_ALREADY_COMPLETED',
  INVALID_ANSWERS_FORMAT: 'INVALID_ANSWERS_FORMAT',
  INVALID_QUESTION_STRUCTURE: 'INVALID_QUESTION_STRUCTURE',
  QUIZ_GENERATION_FAILED: 'QUIZ_GENERATION_FAILED',

  // Reward Errors
  REWARD_ALREADY_CLAIMED: 'REWARD_ALREADY_CLAIMED',
  REWARD_NOT_ELIGIBLE: 'REWARD_NOT_ELIGIBLE',
  MINT_FAILED: 'MINT_FAILED',
  INSUFFICIENT_SCORE: 'INSUFFICIENT_SCORE',

  // System Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

// API Endpoints
export const API_ENDPOINTS = {
  QUIZ: {
    GENERATE: '/api/quiz/generate',
    SUBMIT: '/api/quiz/submit',
    GET_BY_ID: '/api/quiz/:quizId',
    GET_BY_LEVEL: '/api/quiz/level/:level',
    VALIDATE: '/api/quiz/validate',
    STATS: '/api/quiz/:quizId/stats'
  },
  USER: {
    CREATE_UPDATE: '/api/users',
    GET_PROFILE: '/api/users/:walletAddress',
    GET_HISTORY: '/api/users/:walletAddress/history',
    GET_ACHIEVEMENTS: '/api/users/:walletAddress/achievements',
    GET_RECOMMENDATIONS: '/api/users/:walletAddress/recommendations',
    LEADERBOARD: '/api/users'
  },
  REWARDS: {
    CLAIM: '/api/rewards/claim',
    MINT: '/api/rewards/mint',
    GET_USER_REWARDS: '/api/rewards/:walletAddress',
    GET_USER_BADGES: '/api/rewards/:walletAddress/badges',
    GET_UNCLAIMED: '/api/rewards/:walletAddress/unclaimed',
    CHECK_ELIGIBILITY: '/api/rewards/:walletAddress/:quizId/eligibility'
  }
};

// Success Messages
export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User profile created successfully',
  USER_UPDATED: 'User profile updated successfully',
  QUIZ_GENERATED: 'Quiz generated successfully',
  QUIZ_SUBMITTED: 'Quiz submitted successfully',
  REWARD_CLAIMED: 'Reward claimed successfully',
  BADGE_MINTED: 'Badge minted successfully'
};

// Validation Patterns
export const VALIDATION_PATTERNS = {
  WALLET_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,30}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

// Topic Categories
export const TOPIC_CATEGORIES = {
  FUNDAMENTALS: ['solidity-basics', 'blockchain-fundamentals', 'smart-contracts'],
  INTERMEDIATE: ['defi', 'security', 'testing', 'gas-optimization'],
  ADVANCED: ['advanced-patterns', 'oracles', 'layer2', 'governance'],
  EXPERT: ['protocol-design', 'mev', 'formal-verification', 'cross-chain']
};

// Badge Levels (for contract mapping)
export const BADGE_LEVELS = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
  master: 5
};

// Default Values
export const DEFAULTS = {
  PAGINATION_LIMIT: 20,
  MAX_PAGINATION_LIMIT: 100,
  QUIZ_TIME_LIMIT: 300, // 5 minutes
  LEADERBOARD_LIMIT: 100,
  HISTORY_LIMIT: 50
};

// Environment Validation
export const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'OPENAI_API_KEY',
  'PRIVATE_KEY',
  'CONTRACT_ADDRESS',
  'RPC_URL'
];

export const OPTIONAL_ENV_VARS = [
  'PORT',
  'NODE_ENV',
  'JWT_SECRET',
  'CHAIN_ID',
  'OPENAI_MODEL'
];

export default {
  APP_CONFIG,
  CONTRACT_CONFIG,
  QUIZ_CONFIG,
  LEVEL_THRESHOLDS,
  BADGE_THRESHOLDS,
  XP_REWARDS,
  AI_CONFIG,
  RATE_LIMITS,
  ERROR_CODES,
  API_ENDPOINTS,
  SUCCESS_MESSAGES,
  VALIDATION_PATTERNS,
  TOPIC_CATEGORIES,
  BADGE_LEVELS,
  DEFAULTS,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
};