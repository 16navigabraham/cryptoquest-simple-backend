import express from 'express';
import { QuizService } from '../services/quizService.js';
import { UserService } from '../services/userService.js';
import { RewardService } from '../services/rewardService.js';
import config from '../config/env.js';

const router = express.Router();

// Generate or get a quiz
router.post('/generate', async (req, res) => {
  try {
    const { level, topic, walletAddress, mode } = req.body;

    if (!level) {
      return res.status(400).json({
        success: false,
        message: 'Level is required (1-5)'
      });
    }

    // Validate level
    const levelNum = parseInt(level);
    if (levelNum < 1 || levelNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Level must be between 1 and 5'
      });
    }

    // Validate mode (quick or full)
    if (mode && !['quick', 'full'].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Mode must be either "quick" or "full"'
      });
    }

    let quiz;
    
    if (walletAddress) {
      // Get personalized recommendation
      quiz = await QuizService.getRecommendedQuiz(walletAddress, levelNum, mode);
    } else if (topic) {
      // Get quiz for specific topic
      quiz = await QuizService.generateQuiz(levelNum, topic, mode);
    } else {
      // Get any quiz for the level
      quiz = await QuizService.generateQuizForLevel(levelNum, mode);
    }

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz',
      error: error.message
    });
  }
});

// Get a specific quiz by ID
router.get('/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = await QuizService.getQuizById(quizId);

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    console.error('Error getting quiz:', error);
    
    if (error.message === 'QUIZ_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quiz'
    });
  }
});

// Submit quiz answers
router.post('/submit', async (req, res) => {
  try {
    const { walletAddress, quizId, answers, timeSpent } = req.body;

    // Validate required fields
    if (!walletAddress || !quizId || !answers) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress, quizId, and answers are required'
      });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const result = await QuizService.submitQuizAnswers(walletAddress, quizId, answers, timeSpent);

    // Update user progress
    const progressUpdate = await UserService.updateUserProgress(
      walletAddress, 
      result.results.score,
      result.results.xpEarned
    );

    // Process rewards if eligible (this includes badges and XP)
    let rewardResults = null;
    if (result.results.rewardEligible) {
      try {
        rewardResults = await RewardService.processQuizCompletionRewards(walletAddress, result.attempt);
      } catch (error) {
        console.error('Error processing rewards:', error);
        // Don't fail the quiz submission if rewards fail
        rewardResults = { 
          success: false, 
          error: error.message,
          rewards: [],
          xpEarned: result.results.xpEarned
        };
      }
    }

    res.json({
      success: true,
      data: {
        ...result.results,
        userProgress: progressUpdate,
        rewards: rewardResults
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    
    if (error.message === 'QUIZ_ALREADY_COMPLETED') {
      return res.status(409).json({
        success: false,
        message: 'Quiz already completed'
      });
    }

    if (error.message === 'QUIZ_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (error.message === 'INVALID_ANSWERS_FORMAT') {
      return res.status(400).json({
        success: false,
        message: 'Invalid answers format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz'
    });
  }
});

// Get level configuration and available topics
router.get('/levels/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const levelNum = parseInt(level);
    
    if (levelNum < 1 || levelNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Level must be between 1 and 5'
      });
    }

    const levelConfig = config.QUIZ_LEVELS[levelNum];
    
    if (!levelConfig) {
      return res.status(404).json({
        success: false,
        message: 'Level configuration not found'
      });
    }

    res.json({
      success: true,
      data: {
        level: levelNum,
        ...levelConfig
      }
    });
  } catch (error) {
    console.error('Error getting level config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve level configuration'
    });
  }
});

// Get all levels overview
router.get('/levels', async (req, res) => {
  try {
    const levels = Object.keys(config.QUIZ_LEVELS).map(levelNum => {
      const level = config.QUIZ_LEVELS[levelNum];
      return {
        level: parseInt(levelNum),
        ...level
      };
    });

    res.json({
      success: true,
      data: {
        levels,
        totalLevels: levels.length
      }
    });
  } catch (error) {
    console.error('Error getting all levels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve levels'
    });
  }
});

// Get quizzes for a specific level
router.get('/level/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const quizzes = await QuizService.getQuizzesForLevel(level, limit);

    res.json({
      success: true,
      data: {
        level,
        quizzes,
        count: quizzes.length
      }
    });
  } catch (error) {
    console.error('Error getting quizzes for level:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quizzes'
    });
  }
});

// Get all available quizzes with filters
router.get('/', async (req, res) => {
  try {
    const filters = {
      level: req.query.level,
      topic: req.query.topic,
      aiGenerated: req.query.aiGenerated === 'true'
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const quizzes = await QuizService.getAllQuizzes(filters);

    res.json({
      success: true,
      data: {
        quizzes,
        count: quizzes.length,
        filters
      }
    });
  } catch (error) {
    console.error('Error getting all quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quizzes'
    });
  }
});

// Get quiz statistics (admin endpoint)
router.get('/:quizId/stats', async (req, res) => {
  try {
    const { quizId } = req.params;
    const stats = await QuizService.getQuizStats(quizId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting quiz stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quiz statistics'
    });
  }
});

// Validate quiz answers (for practice mode)
router.post('/validate', async (req, res) => {
  try {
    const { quizId, answers } = req.body;

    if (!quizId || !answers) {
      return res.status(400).json({
        success: false,
        message: 'quizId and answers are required'
      });
    }

    // Get quiz with answers (this should be a protected method)
    const quiz = await QuizService.getQuizWithAnswers(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Validate answers
    const results = quiz.questions.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      
      return {
        questionIndex: index,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation
      };
    });

    const correctCount = results.filter(r => r.isCorrect).length;
    const score = correctCount * 10;
    const percentage = (correctCount / quiz.questions.length) * 100;

    res.json({
      success: true,
      data: {
        score,
        maxScore: quiz.questions.length * 10,
        percentage: Math.round(percentage),
        correctAnswers: correctCount,
        totalQuestions: quiz.questions.length,
        results
      }
    });
  } catch (error) {
    console.error('Error validating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate quiz'
    });
  }
});

export default router;