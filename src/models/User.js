import database from '../config/db.js';

export class User {
  static async create(userData) {
    try {
      const user = {
        walletAddress: userData.walletAddress.toLowerCase().trim(),
        username: userData.username.trim(),
        profilePictureUrl: userData.profilePictureUrl ? userData.profilePictureUrl.trim() : null,
        totalScore: 0,
        xp: 0,
        level: 'beginner',
        badges: [],
        quizesCompleted: 0,
        streak: 0,
        lastQuizDate: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validation
      if (!user.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('INVALID_WALLET_FORMAT');
      }

      if (user.username.length < 3 || user.username.length > 30) {
        throw new Error('INVALID_USERNAME_LENGTH');
      }

      const result = await database.db.collection('users').insertOne(user);
      return { ...user, _id: result.insertedId };
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('USER_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  static async findByWallet(walletAddress) {
    try {
      const user = await database.db.collection('users').findOne({
        walletAddress: walletAddress.toLowerCase().trim()
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async update(walletAddress, updateData) {
    try {
      const updateFields = {
        ...updateData,
        updatedAt: new Date()
      };

      const result = await database.db.collection('users').findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase().trim() },
        { $set: updateFields },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      throw error;
    }
  }

  static async updateScore(walletAddress, scoreToAdd, xpToAdd) {
    try {
      const result = await database.db.collection('users').findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        { 
          $inc: { 
            totalScore: scoreToAdd,
            xp: xpToAdd,
            quizesCompleted: 1
          },
          $set: { 
            updatedAt: new Date(),
            lastQuizDate: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      throw error;
    }
  }

  static async addBadge(walletAddress, badgeLevel) {
    try {
      const result = await database.db.collection('users').findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        { 
          $addToSet: { badges: badgeLevel },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      throw error;
    }
  }

  static async getLeaderboard(limit = 100) {
    try {
      const pipeline = [
        { $match: { totalScore: { $gt: 0 } } },
        {
          $project: {
            walletAddress: 1,
            username: 1,
            profilePictureUrl: 1,
            totalScore: 1,
            xp: 1,
            level: 1,
            badges: 1,
            quizesCompleted: 1,
            createdAt: 1
          }
        },
        { $sort: { totalScore: -1, xp: -1 } },
        { $limit: limit }
      ];

      const users = await database.db.collection('users').aggregate(pipeline).toArray();
      
      return users.map((user, index) => ({
        rank: index + 1,
        walletAddress: user.walletAddress,
        username: user.username,
        profilePictureUrl: user.profilePictureUrl,
        score: user.totalScore,
        xp: user.xp,
        level: user.level,
        badges: user.badges,
        quizCount: user.quizesCompleted,
        joinedDate: user.createdAt
      }));
    } catch (error) {
      throw error;
    }
  }

  static async getUserStats(walletAddress) {
    try {
      const user = await this.findByWallet(walletAddress);
      if (!user) return null;

      const attempts = await database.db.collection('attempts').aggregate([
        { $match: { walletAddress: walletAddress.toLowerCase() } },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            averageScore: { $avg: '$score' },
            bestScore: { $max: '$score' },
            passedQuizzes: {
              $sum: {
                $cond: [{ $gte: ['$percentage', 70] }, 1, 0]
              }
            }
          }
        }
      ]).toArray();

      const stats = attempts[0] || {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        passedQuizzes: 0
      };

      return {
        ...stats,
        totalScore: user.totalScore,
        xp: user.xp,
        level: user.level,
        badges: user.badges || [],
        streak: user.streak || 0
      };
    } catch (error) {
      throw error;
    }
  }
}