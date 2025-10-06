import database from '../config/db.js';

export class Attempt {
  static async create(attemptData) {
    try {
      const attempt = {
        walletAddress: attemptData.walletAddress.toLowerCase(),
        quizId: attemptData.quizId,
        score: attemptData.score,
        maxScore: attemptData.maxScore,
        percentage: (attemptData.score / attemptData.maxScore) * 100,
        timeSpent: attemptData.timeSpent || 0, // seconds
        answers: attemptData.answers || [], // user's answers
        passed: attemptData.rewardEligible || false, // Use the calculated reward eligibility
        xpEarned: attemptData.xpEarned || 0,
        rewardEligible: attemptData.rewardEligible || false, // Based on level-specific threshold
        rewardClaimed: false,
        level: attemptData.level,
        topic: attemptData.topic,
        mode: attemptData.mode || 'full', // quick or full quiz
        scoreThreshold: attemptData.scoreThreshold, // The threshold used for this level
        createdAt: new Date()
      };

      const result = await database.db.collection('attempts').insertOne(attempt);
      return { ...attempt, _id: result.insertedId };
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('QUIZ_ALREADY_COMPLETED');
      }
      throw error;
    }
  }

  static async findByWalletAndQuiz(walletAddress, quizId) {
    try {
      const attempt = await database.db.collection('attempts').findOne({
        walletAddress: walletAddress.toLowerCase(),
        quizId: quizId
      });
      return attempt;
    } catch (error) {
      throw error;
    }
  }

  static async getUserHistory(walletAddress, limit = 20, offset = 0) {
    try {
      const attempts = await database.db.collection('attempts')
        .find({ walletAddress: walletAddress.toLowerCase() })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const total = await database.db.collection('attempts')
        .countDocuments({ walletAddress: walletAddress.toLowerCase() });

      return {
        attempts,
        total,
        hasMore: total > offset + attempts.length
      };
    } catch (error) {
      throw error;
    }
  }

  static async getRecentAttempts(limit = 10) {
    try {
      const pipeline = [
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'walletAddress',
            foreignField: 'walletAddress',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'quizzes',
            localField: 'quizId',
            foreignField: 'id',
            as: 'quiz'
          }
        },
        {
          $project: {
            walletAddress: 1,
            score: 1,
            percentage: 1,
            passed: 1,
            level: 1,
            topic: 1,
            createdAt: 1,
            username: { $arrayElemAt: ['$user.username', 0] },
            quizTitle: { $arrayElemAt: ['$quiz.title', 0] }
          }
        }
      ];

      const attempts = await database.db.collection('attempts').aggregate(pipeline).toArray();
      return attempts;
    } catch (error) {
      throw error;
    }
  }

  static async getUserStats(walletAddress) {
    try {
      const stats = await database.db.collection('attempts').aggregate([
        { $match: { walletAddress: walletAddress.toLowerCase() } },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            totalScore: { $sum: '$score' },
            averageScore: { $avg: '$score' },
            averagePercentage: { $avg: '$percentage' },
            bestScore: { $max: '$score' },
            bestPercentage: { $max: '$percentage' },
            passedQuizzes: {
              $sum: {
                $cond: [{ $eq: ['$passed', true] }, 1, 0]
              }
            },
            totalXpEarned: { $sum: '$xpEarned' }
          }
        }
      ]).toArray();

      const result = stats[0] || {
        totalAttempts: 0,
        totalScore: 0,
        averageScore: 0,
        averagePercentage: 0,
        bestScore: 0,
        bestPercentage: 0,
        passedQuizzes: 0,
        totalXpEarned: 0
      };

      // Calculate pass rate
      result.passRate = result.totalAttempts > 0 ? 
        (result.passedQuizzes / result.totalAttempts) * 100 : 0;

      return result;
    } catch (error) {
      throw error;
    }
  }

  static async markRewardClaimed(walletAddress, quizId) {
    try {
      const result = await database.db.collection('attempts').findOneAndUpdate(
        {
          walletAddress: walletAddress.toLowerCase(),
          quizId: quizId
        },
        {
          $set: {
            rewardClaimed: true,
            rewardClaimedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      throw error;
    }
  }

  static async getUnclaimedRewards(walletAddress) {
    try {
      const unclaimedAttempts = await database.db.collection('attempts')
        .find({
          walletAddress: walletAddress.toLowerCase(),
          rewardEligible: true,
          rewardClaimed: false
        })
        .toArray();

      return unclaimedAttempts;
    } catch (error) {
      throw error;
    }
  }

  static async getLevelProgress(walletAddress, level) {
    try {
      const progress = await database.db.collection('attempts').aggregate([
        {
          $match: {
            walletAddress: walletAddress.toLowerCase(),
            level: level
          }
        },
        {
          $group: {
            _id: '$topic',
            attemptsCount: { $sum: 1 },
            passedCount: {
              $sum: {
                $cond: [{ $eq: ['$passed', true] }, 1, 0]
              }
            },
            averageScore: { $avg: '$percentage' },
            bestScore: { $max: '$percentage' }
          }
        }
      ]).toArray();

      return progress;
    } catch (error) {
      throw error;
    }
  }
}