const { MongoClient } = require('mongodb');
require('dotenv').config();

class Database {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      // MongoDB connection string from environment variables
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.DB_NAME || 'cryptoquest';

      this.client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      await this.client.connect();
      this.db = this.client.db(dbName);
      
      console.log('Connected to MongoDB database');
      await this.initializeCollections();
      
      return this.db;
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw error;
    }
  }

  async initializeCollections() {
    try {
      // Create collections if they don't exist
      const collections = await this.db.listCollections().toArray();
      const collectionNames = collections.map(col => col.name);

      // Create users collection with indexes
      if (!collectionNames.includes('users')) {
        await this.db.createCollection('users');
        console.log('Users collection created');
      }

      // Create scores collection with indexes
      if (!collectionNames.includes('scores')) {
        await this.db.createCollection('scores');
        console.log('Scores collection created');
      }

      // Create indexes for better performance
      await this.createIndexes();

    } catch (error) {
      console.error('Error initializing collections:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Users collection indexes
      await this.db.collection('users').createIndex(
        { walletAddress: 1 }, 
        { unique: true, name: 'wallet_address_unique' }
      );
      await this.db.collection('users').createIndex(
        { username: 1 }, 
        { name: 'username_index' }
      );
      await this.db.collection('users').createIndex(
        { totalScore: -1 }, 
        { name: 'total_score_desc' }
      );
      await this.db.collection('users').createIndex(
        { createdAt: -1 }, 
        { name: 'created_at_desc' }
      );

      // Scores collection indexes
      await this.db.collection('scores').createIndex(
        { walletAddress: 1, quizId: 1 }, 
        { unique: true, name: 'wallet_quiz_unique' }
      );
      await this.db.collection('scores').createIndex(
        { walletAddress: 1 }, 
        { name: 'wallet_address_scores' }
      );
      await this.db.collection('scores').createIndex(
        { createdAt: -1 }, 
        { name: 'created_at_scores_desc' }
      );
      await this.db.collection('scores').createIndex(
        { difficulty: 1 }, 
        { name: 'difficulty_index' }
      );

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }

  // User operations
  async createUser(userData) {
    try {
      // Sanitize and validate input data
      const user = {
        walletAddress: userData.walletAddress.toLowerCase().trim(),
        username: userData.username.trim(),
        profilePictureUrl: userData.profilePictureUrl ? userData.profilePictureUrl.trim() : null,
        totalScore: 0,
        level: 'beginner',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Additional validation
      if (!user.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('INVALID_WALLET_FORMAT');
      }

      if (user.username.length < 3 || user.username.length > 30) {
        throw new Error('INVALID_USERNAME_LENGTH');
      }

      const result = await this.db.collection('users').insertOne(user);
      return { ...user, _id: result.insertedId };
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('USER_ALREADY_EXISTS');
      }
      if (error.message.startsWith('INVALID_')) {
        throw error;
      }
      console.error('Database error in createUser:', error);
      throw new Error('DATABASE_CREATE_ERROR');
    }
  }

  async getUserByWallet(walletAddress) {
    try {
      const cleanWalletAddress = walletAddress.toLowerCase().trim();
      const user = await this.db.collection('users').findOne({
        walletAddress: cleanWalletAddress
      });
      return user;
    } catch (error) {
      console.error('Database error in getUserByWallet:', error);
      throw new Error('DATABASE_FETCH_ERROR');
    }
  }

  async updateUser(walletAddress, updateData) {
    try {
      // Sanitize update data
      const sanitizedData = {};
      
      if (updateData.username) {
        sanitizedData.username = updateData.username.trim();
        if (sanitizedData.username.length < 3 || sanitizedData.username.length > 30) {
          throw new Error('INVALID_USERNAME_LENGTH');
        }
      }
      
      if (updateData.profilePictureUrl !== undefined) {
        sanitizedData.profilePictureUrl = updateData.profilePictureUrl ? updateData.profilePictureUrl.trim() : null;
      }
      
      const updateFields = {
        ...sanitizedData,
        updatedAt: new Date()
      };

      const result = await this.db.collection('users').findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase().trim() },
        { $set: updateFields },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      if (error.message.startsWith('INVALID_')) {
        throw error;
      }
      console.error('Database error in updateUser:', error);
      throw new Error('DATABASE_UPDATE_ERROR');
    }
  }

  async getUserStats(walletAddress) {
    try {
      const stats = await this.db.collection('scores').aggregate([
        { $match: { walletAddress: walletAddress.toLowerCase() } },
        {
          $group: {
            _id: null,
            quizCount: { $sum: 1 },
            averageScore: { $avg: '$score' },
            bestScore: { $max: '$score' },
            totalScore: { $sum: '$score' }
          }
        }
      ]).toArray();

      return stats[0] || {
        quizCount: 0,
        averageScore: 0,
        bestScore: 0,
        totalScore: 0
      };
    } catch (error) {
      throw error;
    }
  }

  // Score operations
  async createScore(scoreData) {
    try {
      const score = {
        walletAddress: scoreData.walletAddress.toLowerCase(),
        quizId: scoreData.quizId,
        score: scoreData.score,
        difficulty: scoreData.difficulty,
        maxScore: scoreData.maxScore || 20,
        percentage: (scoreData.score / (scoreData.maxScore || 20)) * 100,
        createdAt: new Date()
      };

      const result = await this.db.collection('scores').insertOne(score);
      return { ...score, _id: result.insertedId };
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Quiz already completed by this user');
      }
      throw error;
    }
  }

  async getUserScoreHistory(walletAddress, limit = 20, offset = 0) {
    try {
      const scores = await this.db.collection('scores')
        .find({ walletAddress: walletAddress.toLowerCase() })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const total = await this.db.collection('scores')
        .countDocuments({ walletAddress: walletAddress.toLowerCase() });

      return {
        scores,
        total,
        hasMore: total > offset + scores.length
      };
    } catch (error) {
      throw error;
    }
  }

  // Leaderboard operations
  async getLeaderboard(limit = 100) {
    try {
      const pipeline = [
        { $match: { totalScore: { $gt: 0 } } },
        {
          $lookup: {
            from: 'scores',
            localField: 'walletAddress',
            foreignField: 'walletAddress',
            as: 'userScores'
          }
        },
        {
          $addFields: {
            quizCount: { $size: '$userScores' }
          }
        },
        {
          $project: {
            walletAddress: 1,
            username: 1,
            profilePictureUrl: 1,
            totalScore: 1,
            level: 1,
            createdAt: 1,
            quizCount: 1
          }
        },
        { $sort: { totalScore: -1 } },
        { $limit: limit }
      ];

      const users = await this.db.collection('users').aggregate(pipeline).toArray();
      
      const leaderboard = users.map((user, index) => ({
        rank: index + 1,
        walletAddress: user.walletAddress,
        username: user.username,
        profilePictureUrl: user.profilePictureUrl,
        score: user.totalScore,
        level: user.level,
        quizCount: user.quizCount,
        joinedDate: user.createdAt
      }));

      return leaderboard;
    } catch (error) {
      throw error;
    }
  }

  async updateUserTotalScore(walletAddress, scoreToAdd) {
    try {
      const result = await this.db.collection('users').findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        { 
          $inc: { totalScore: scoreToAdd },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      throw error;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('Database connection closed');
    }
  }
}

// Create and export database instance
const database = new Database();

module.exports = database;