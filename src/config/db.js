import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.DB_NAME || 'cryptoquest';

      this.client = new MongoClient(uri);

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
      const collections = await this.db.listCollections().toArray();
      const collectionNames = collections.map(col => col.name);

      // Create collections if they don't exist
      const requiredCollections = ['users', 'quizzes', 'attempts', 'rewards'];
      
      for (const collectionName of requiredCollections) {
        if (!collectionNames.includes(collectionName)) {
          await this.db.createCollection(collectionName);
          console.log(`${collectionName} collection created`);
        }
      }

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

      // Quizzes collection indexes
      await this.db.collection('quizzes').createIndex(
        { level: 1, topic: 1 }, 
        { name: 'level_topic_index' }
      );
      await this.db.collection('quizzes').createIndex(
        { isActive: 1 }, 
        { name: 'active_quiz_index' }
      );

      // Attempts collection indexes
      await this.db.collection('attempts').createIndex(
        { walletAddress: 1, quizId: 1 }, 
        { unique: true, name: 'wallet_quiz_unique' }
      );
      await this.db.collection('attempts').createIndex(
        { walletAddress: 1 }, 
        { name: 'wallet_attempts_index' }
      );

      // Rewards collection indexes
      await this.db.collection('rewards').createIndex(
        { walletAddress: 1 }, 
        { name: 'wallet_rewards_index' }
      );
      await this.db.collection('rewards').createIndex(
        { txHash: 1 }, 
        { unique: true, sparse: true, name: 'tx_hash_unique' }
      );

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('Database connection closed');
    }
  }
}

const database = new Database();
export default database;