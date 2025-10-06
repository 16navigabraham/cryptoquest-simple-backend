import database from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export class Quiz {
  static async create(quizData) {
    try {
      const quiz = {
        id: uuidv4(),
        title: quizData.title,
        description: quizData.description || '',
        level: quizData.level, // beginner, intermediate, advanced, expert, master
        topic: quizData.topic, // solidity-basics, smart-contracts, defi, etc.
        questions: quizData.questions, // Array of question objects
        maxScore: quizData.questions.length * 10, // 10 points per question
        timeLimit: quizData.timeLimit || 300, // 5 minutes default
        isActive: true,
        aiGenerated: quizData.aiGenerated || false,
        createdBy: quizData.createdBy || 'AI_AGENT',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate questions format
      if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        throw new Error('INVALID_QUESTIONS_FORMAT');
      }

      for (const question of quiz.questions) {
        if (!question.question || !question.options || !question.correctAnswer) {
          throw new Error('INVALID_QUESTION_STRUCTURE');
        }
        if (!Array.isArray(question.options) || question.options.length !== 4) {
          throw new Error('INVALID_QUESTION_OPTIONS');
        }
      }

      const result = await database.db.collection('quizzes').insertOne(quiz);
      return { ...quiz, _id: result.insertedId };
    } catch (error) {
      throw error;
    }
  }

  static async findById(quizId) {
    try {
      const quiz = await database.db.collection('quizzes').findOne({
        $or: [
          { id: quizId },
          { _id: quizId }
        ]
      });
      return quiz;
    } catch (error) {
      throw error;
    }
  }

  static async findByLevel(level, limit = 10) {
    try {
      const quizzes = await database.db.collection('quizzes')
        .find({ 
          level: level,
          isActive: true 
        })
        .limit(limit)
        .toArray();
      
      return quizzes;
    } catch (error) {
      throw error;
    }
  }

  static async findByLevelAndTopic(level, topic, limit = 5) {
    try {
      const quizzes = await database.db.collection('quizzes')
        .find({ 
          level: level,
          topic: topic,
          isActive: true 
        })
        .limit(limit)
        .toArray();
      
      return quizzes;
    } catch (error) {
      throw error;
    }
  }

  static async getRandomQuiz(level, excludeQuizIds = []) {
    try {
      const pipeline = [
        {
          $match: {
            level: level,
            isActive: true,
            id: { $nin: excludeQuizIds }
          }
        },
        { $sample: { size: 1 } }
      ];

      const result = await database.db.collection('quizzes').aggregate(pipeline).toArray();
      return result[0] || null;
    } catch (error) {
      throw error;
    }
  }

  static async update(quizId, updateData) {
    try {
      const updateFields = {
        ...updateData,
        updatedAt: new Date()
      };

      const result = await database.db.collection('quizzes').findOneAndUpdate(
        { 
          $or: [
            { id: quizId },
            { _id: quizId }
          ]
        },
        { $set: updateFields },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      throw error;
    }
  }

  static async deactivate(quizId) {
    try {
      return await this.update(quizId, { isActive: false });
    } catch (error) {
      throw error;
    }
  }

  static async getQuizStats(quizId) {
    try {
      const stats = await database.db.collection('attempts').aggregate([
        { $match: { quizId: quizId } },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            averageScore: { $avg: '$score' },
            averagePercentage: { $avg: '$percentage' },
            passRate: {
              $avg: {
                $cond: [{ $gte: ['$percentage', 70] }, 1, 0]
              }
            }
          }
        }
      ]).toArray();

      return stats[0] || {
        totalAttempts: 0,
        averageScore: 0,
        averagePercentage: 0,
        passRate: 0
      };
    } catch (error) {
      throw error;
    }
  }

  static async getAllQuizzes(filters = {}) {
    try {
      const query = { isActive: true };
      
      if (filters.level) query.level = filters.level;
      if (filters.topic) query.topic = filters.topic;
      if (filters.aiGenerated !== undefined) query.aiGenerated = filters.aiGenerated;

      const quizzes = await database.db.collection('quizzes')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      // Return quizzes without answers for security
      return quizzes.map(quiz => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        level: quiz.level,
        topic: quiz.topic,
        maxScore: quiz.maxScore,
        timeLimit: quiz.timeLimit,
        questionCount: quiz.questions.length,
        aiGenerated: quiz.aiGenerated,
        createdAt: quiz.createdAt
      }));
    } catch (error) {
      throw error;
    }
  }
}