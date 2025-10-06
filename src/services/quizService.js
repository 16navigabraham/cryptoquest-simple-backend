import { Quiz } from '../models/Quiz.js';
import { Attempt } from '../models/Attempt.js';
import { QuizAgent } from '../ai/quizAgent.js';
import config from '../config/env.js';

export class QuizService {
  static async generateQuiz(level, topic, mode = 'full', forceNew = false) {
    try {
      // Get level configuration
      const levelConfig = config.QUIZ_LEVELS[level];
      if (!levelConfig) {
        throw new Error('INVALID_LEVEL');
      }

      // Check if we have existing quizzes for this level/topic/mode
      if (!forceNew) {
        const existingQuiz = await Quiz.getRandomQuiz(level, [], topic, mode);
        if (existingQuiz) {
          return this.sanitizeQuizForUser(existingQuiz);
        }
      }

      // Generate new quiz using AI with proper question count and time limit
      const quizConfig = levelConfig[mode + 'Quiz'];
      const quizData = await QuizAgent.generateQuiz(
        level, 
        topic, 
        quizConfig.questions,
        quizConfig.timeLimit
      );
      
      // Add level-specific metadata
      quizData.mode = mode;
      quizData.scoreThreshold = levelConfig.scoreThreshold;
      quizData.levelConfig = levelConfig;
      
      const savedQuiz = await Quiz.create(quizData);
      
      return this.sanitizeQuizForUser(savedQuiz);
    } catch (error) {
      console.error('Error in QuizService.generateQuiz:', error);
      throw error;
    }
  }

  static async generateQuizForLevel(level, mode = 'full') {
    try {
      const levelConfig = config.QUIZ_LEVELS[level];
      if (!levelConfig) {
        throw new Error('INVALID_LEVEL');
      }

      // Pick a random topic from the level's topics
      const topics = levelConfig.topics;
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      
      return await this.generateQuiz(level, randomTopic, mode);
    } catch (error) {
      throw error;
    }
  }

  static async getQuizById(quizId) {
    try {
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        throw new Error('QUIZ_NOT_FOUND');
      }
      
      return this.sanitizeQuizForUser(quiz);
    } catch (error) {
      throw error;
    }
  }

  static async getQuizzesForLevel(level, limit = 10) {
    try {
      const quizzes = await Quiz.findByLevel(level, limit);
      return quizzes.map(quiz => this.sanitizeQuizForUser(quiz));
    } catch (error) {
      throw error;
    }
  }

  static async getRecommendedQuiz(walletAddress, userLevel, mode = 'full') {
    try {
      // Get user's completed quizzes
      const userHistory = await Attempt.getUserHistory(walletAddress, 100);
      const completedQuizIds = userHistory.attempts.map(attempt => attempt.quizId);
      
      // Get level configuration
      const levelConfig = config.QUIZ_LEVELS[userLevel];
      if (!levelConfig) {
        throw new Error('INVALID_LEVEL');
      }

      // Get completed topics for this level
      const completedTopics = [...new Set(
        userHistory.attempts
          .filter(attempt => attempt.level === userLevel)
          .map(attempt => attempt.topic)
      )];
      
      // Find topics not yet completed for this level
      const availableTopics = levelConfig.topics.filter(topic => 
        !completedTopics.includes(topic)
      );
      
      // Try to find a quiz on uncompleted topics first
      if (availableTopics.length > 0) {
        const randomTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
        const quiz = await Quiz.getRandomQuiz(userLevel, completedQuizIds, randomTopic, mode);
        
        if (quiz) {
          return this.sanitizeQuizForUser(quiz);
        }
      }
      
      // Fallback: get any quiz for user level that hasn't been completed
      const quiz = await Quiz.getRandomQuiz(userLevel, completedQuizIds, null, mode);
      if (quiz) {
        return this.sanitizeQuizForUser(quiz);
      }
      
      // Last resort: generate a new quiz
      return await this.generateQuizForLevel(userLevel, mode);
    } catch (error) {
      console.error('Error getting recommended quiz:', error);
      throw error;
    }
  }

  static async submitQuizAnswers(walletAddress, quizId, answers, timeSpent = 0) {
    try {
      // Check if user already completed this quiz
      const existingAttempt = await Attempt.findByWalletAndQuiz(walletAddress, quizId);
      if (existingAttempt) {
        throw new Error('QUIZ_ALREADY_COMPLETED');
      }

      // Get the quiz with correct answers
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        throw new Error('QUIZ_NOT_FOUND');
      }

      // Get level configuration for scoring threshold
      const levelConfig = config.QUIZ_LEVELS[quiz.level];
      if (!levelConfig) {
        throw new Error('INVALID_QUIZ_LEVEL');
      }

      // Validate answers format
      if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
        throw new Error('INVALID_ANSWERS_FORMAT');
      }

      // Calculate score
      let correctAnswers = 0;
      const detailedResults = [];

      for (let i = 0; i < quiz.questions.length; i++) {
        const question = quiz.questions[i];
        const userAnswer = answers[i];
        const isCorrect = userAnswer === question.correctAnswer;
        
        if (isCorrect) {
          correctAnswers++;
        }

        detailedResults.push({
          questionIndex: i,
          question: question.question,
          userAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect,
          explanation: question.explanation
        });
      }

      const score = correctAnswers * 10; // 10 points per correct answer
      const maxScore = quiz.questions.length * 10;
      const percentage = (score / maxScore) * 100;
      
      // Check if user meets the level-specific threshold for rewards
      const scoreThreshold = levelConfig.scoreThreshold;
      const rewardEligible = percentage >= scoreThreshold;
      const xpEarned = rewardEligible ? correctAnswers * 10 : Math.floor(correctAnswers * 5); // Half XP if below threshold

      // Create attempt record
      const attemptData = {
        walletAddress,
        quizId,
        score,
        maxScore,
        timeSpent,
        answers,
        xpEarned,
        level: quiz.level,
        topic: quiz.topic,
        mode: quiz.mode || 'full',
        rewardEligible,
        scoreThreshold
      };

      const attempt = await Attempt.create(attemptData);

      return {
        attempt,
        quiz: {
          level: quiz.level,
          scoreThreshold
        },
        results: {
          score,
          maxScore,
          percentage: Math.round(percentage),
          correctAnswers,
          totalQuestions: quiz.questions.length,
          passed: rewardEligible,
          rewardEligible,
          scoreThreshold,
          xpEarned,
          timeSpent,
          detailedResults
        }
      };
    } catch (error) {
      console.error('Error submitting quiz answers:', error);
      throw error;
    }
  }

  static async getQuizStats(quizId) {
    try {
      const stats = await Quiz.getQuizStats(quizId);
      return stats;
    } catch (error) {
      throw error;
    }
  }

  static async getAllQuizzes(filters = {}) {
    try {
      return await Quiz.getAllQuizzes(filters);
    } catch (error) {
      throw error;
    }
  }

  // Utility method to remove correct answers from quiz data when sending to users
  static sanitizeQuizForUser(quiz) {
    if (!quiz) return null;

    const sanitizedQuestions = quiz.questions.map(question => ({
      question: question.question,
      options: question.options
      // Note: We don't include correctAnswer or explanation
    }));

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      level: quiz.level,
      topic: quiz.topic,
      questions: sanitizedQuestions,
      maxScore: quiz.maxScore,
      timeLimit: quiz.timeLimit,
      questionCount: quiz.questions.length
    };
  }

  // Admin method to get quiz with answers (protected endpoint)
  static async getQuizWithAnswers(quizId) {
    try {
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        throw new Error('QUIZ_NOT_FOUND');
      }
      return quiz;
    } catch (error) {
      throw error;
    }
  }

  // Bulk generate quizzes for seeding
  static async generateBulkQuizzes(levels, topics, quizzesPerCombination = 2) {
    try {
      console.log('Starting bulk quiz generation...');
      const results = [];
      
      for (const level of levels) {
        for (const topic of topics) {
          console.log(`Generating quizzes for ${level} - ${topic}...`);
          
          for (let i = 0; i < quizzesPerCombination; i++) {
            try {
              const quizData = await QuizAgent.generateQuiz(level, topic);
              const savedQuiz = await Quiz.create(quizData);
              results.push(savedQuiz);
              
              console.log(`✅ Generated quiz ${i + 1}/${quizzesPerCombination} for ${level} - ${topic}`);
              
              // Add delay to respect rate limits
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error(`❌ Failed to generate quiz ${i + 1} for ${level} - ${topic}:`, error.message);
            }
          }
        }
      }
      
      console.log(`Bulk generation completed. Generated ${results.length} quizzes.`);
      return results;
    } catch (error) {
      console.error('Error in bulk quiz generation:', error);
      throw error;
    }
  }
}