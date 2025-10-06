import { VALIDATION_PATTERNS, ERROR_CODES } from './constants.js';

// Wallet address validation
export function isValidWalletAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  return VALIDATION_PATTERNS.WALLET_ADDRESS.test(address);
}

// Username validation
export function isValidUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }
  return username.length >= 3 && username.length <= 30 && /^[a-zA-Z0-9_-]+$/.test(username);
}

// Email validation
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return VALIDATION_PATTERNS.EMAIL.test(email);
}

// IPFS URL validation
export function isValidIPFSUrl(url) {
  if (!url) return true; // Optional field
  return url.startsWith('ipfs://') || 
         url.startsWith('https://ipfs.io/ipfs/') || 
         url.startsWith('https://gateway.pinata.cloud/ipfs/') ||
         url.includes('ipfs');
}

// Quiz answers validation
export function validateQuizAnswers(answers, expectedLength) {
  if (!Array.isArray(answers)) {
    return { valid: false, error: 'Answers must be an array' };
  }
  
  if (answers.length !== expectedLength) {
    return { valid: false, error: `Expected ${expectedLength} answers, got ${answers.length}` };
  }
  
  // Check each answer is a valid option (A, B, C, D)
  const validOptions = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < answers.length; i++) {
    if (!validOptions.includes(answers[i])) {
      return { valid: false, error: `Invalid answer at position ${i}: ${answers[i]}` };
    }
  }
  
  return { valid: true };
}

// Sanitize user input
export function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

// Sanitize wallet address
export function sanitizeWalletAddress(address) {
  if (!address || typeof address !== 'string') {
    return null;
  }
  return address.toLowerCase().trim();
}

// Format score percentage
export function formatPercentage(score, maxScore) {
  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}

// Format time duration
export function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

// Generate random string
export function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Shuffle array
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Debounce function
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Retry function with exponential backoff
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Parse pagination parameters
export function parsePagination(query, defaults = { limit: 20, offset: 0 }) {
  const limit = Math.min(
    Math.max(parseInt(query.limit) || defaults.limit, 1),
    100 // Max limit
  );
  
  const offset = Math.max(parseInt(query.offset) || defaults.offset, 0);
  
  return { limit, offset };
}

// Calculate level from score
export function calculateLevel(score) {
  if (score >= 2000) return 'master';
  if (score >= 1000) return 'expert';
  if (score >= 500) return 'advanced';
  if (score >= 250) return 'intermediate';
  return 'beginner';
}

// Calculate progress to next level
export function calculateLevelProgress(score, currentLevel) {
  const thresholds = {
    beginner: { current: 0, next: 250 },
    intermediate: { current: 250, next: 500 },
    advanced: { current: 500, next: 1000 },
    expert: { current: 1000, next: 2000 },
    master: { current: 2000, next: null }
  };
  
  const level = thresholds[currentLevel];
  if (!level || !level.next) {
    return { progress: 100, isMaxLevel: true };
  }
  
  const scoreInLevel = score - level.current;
  const scoreNeeded = level.next - level.current;
  const progress = Math.min((scoreInLevel / scoreNeeded) * 100, 100);
  
  return {
    progress: Math.round(progress),
    scoreNeeded: Math.max(level.next - score, 0),
    isMaxLevel: false
  };
}

// Format blockchain transaction hash
export function formatTxHash(hash, length = 8) {
  if (!hash || hash.length < length * 2) {
    return hash;
  }
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

// Format wallet address for display
export function formatWalletAddress(address, length = 6) {
  if (!address || address.length < length * 2) {
    return address;
  }
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

// Check if value is empty
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// Safe JSON parse
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('JSON parse error:', error);
    return defaultValue;
  }
}

// Create API response
export function createApiResponse(success, data = null, message = '', error = null) {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };
  
  if (message) response.message = message;
  if (data !== null) response.data = data;
  if (error) response.error = error;
  
  return response;
}

// Error response helper
export function createErrorResponse(message, code = null, details = null) {
  return createApiResponse(false, null, message, {
    code,
    details,
    timestamp: new Date().toISOString()
  });
}

// Success response helper
export function createSuccessResponse(data, message = '') {
  return createApiResponse(true, data, message);
}

// Async handler wrapper for Express routes
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Logger utility
export function createLogger(context) {
  return {
    info: (message, data = {}) => {
      console.log(`[${context}] ${message}`, data);
    },
    error: (message, error = null) => {
      console.error(`[${context}] ${message}`, error);
    },
    warn: (message, data = {}) => {
      console.warn(`[${context}] ${message}`, data);
    },
    debug: (message, data = {}) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[${context}] ${message}`, data);
      }
    }
  };
}

export default {
  isValidWalletAddress,
  isValidUsername,
  isValidEmail,
  isValidIPFSUrl,
  validateQuizAnswers,
  sanitizeString,
  sanitizeWalletAddress,
  formatPercentage,
  formatDuration,
  generateRandomString,
  shuffleArray,
  debounce,
  retryWithBackoff,
  parsePagination,
  calculateLevel,
  calculateLevelProgress,
  formatTxHash,
  formatWalletAddress,
  isEmpty,
  safeJsonParse,
  createApiResponse,
  createErrorResponse,
  createSuccessResponse,
  asyncHandler,
  createLogger
};