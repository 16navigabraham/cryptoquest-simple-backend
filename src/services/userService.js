import { User } from '../models/User.js';
import { Attempt } from '../models/Attempt.js';
import { getLevelFromScore, getNextLevel, canAccessLevel } from '../ai/topics.js';
import config from '../config/env.js';

export class UserService {
  static async createOrUpdateUser(userData) {
    try {
      const existingUser = await User.findByWallet(userData.walletAddress);
      
      if (existingUser) {
        // Update existing user
        const updateData = {
          username: userData.username,
          ...(userData.profilePictureUrl && { profilePictureUrl: userData.profilePictureUrl })
        };
        
        const updatedUser = await User.update(userData.walletAddress, updateData);
        return updatedUser;
      } else {
        // Create new user
        const newUser = await User.create(userData);
        return newUser;
      }
    } catch (error) {
      throw error;
    }
  }

  static async getUserProfile(walletAddress) {
    try {
      const user = await User.findByWallet(walletAddress);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const stats = await User.getUserStats(walletAddress);
      const levelProgress = await this.calculateLevelProgress(user);
      const recommendations = await this.getUserRecommendations(walletAddress, user.level);

      return {
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          username: user.username,
          profilePictureUrl: user.profilePictureUrl,
          totalScore: user.totalScore,
          xp: user.xp,
          level: user.level,
          badges: user.badges || [],
          quizesCompleted: user.quizesCompleted,
          streak: user.streak,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        stats,
        levelProgress,
        recommendations
      };
    } catch (error) {
      throw error;
    }
  }

  static async updateUserProgress(walletAddress, scoreEarned, xpEarned) {
    try {
      const user = await User.findByWallet(walletAddress);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Update score and XP
      const updatedUser = await User.updateScore(walletAddress, scoreEarned, xpEarned);
      
      // Check for level progression
      const newLevel = getLevelFromScore(updatedUser.totalScore);
      const levelChanged = newLevel !== updatedUser.level;
      
      if (levelChanged) {
        await User.update(walletAddress, { level: newLevel });
        
        // Check if user qualifies for new badge
        const badgeEarned = await this.checkBadgeEligibility(updatedUser.walletAddress, newLevel);
        
        return {
          user: { ...updatedUser, level: newLevel },
          levelChanged: true,
          newLevel,
          badgeEarned
        };
      }

      return {
        user: updatedUser,
        levelChanged: false
      };
    } catch (error) {
      throw error;
    }
  }

  static async checkBadgeEligibility(walletAddress, level) {
    try {
      const user = await User.findByWallet(walletAddress);
      if (!user) return null;

      const threshold = config.BADGE_THRESHOLDS[level];
      
      // Check if user qualifies for badge and doesn't already have it
      if (user.totalScore >= threshold && !user.badges.includes(level)) {
        // Award badge
        await User.addBadge(walletAddress, level);
        
        return {
          level,
          earned: true,
          threshold
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking badge eligibility:', error);
      return null;
    }
  }

  static async calculateLevelProgress(user) {
    try {
      const currentLevel = user.level;
      const nextLevel = getNextLevel(currentLevel);
      const currentThreshold = config.LEVEL_THRESHOLDS[currentLevel];
      const nextThreshold = config.LEVEL_THRESHOLDS[nextLevel];

      // If already at max level
      if (currentLevel === nextLevel) {
        return {
          currentLevel,
          nextLevel: null,
          progress: 100,
          scoreNeeded: 0,
          currentScore: user.totalScore,
          isMaxLevel: true
        };
      }

      const scoreInCurrentLevel = user.totalScore - currentThreshold;
      const scoreNeededForNextLevel = nextThreshold - currentThreshold;
      const progress = Math.min((scoreInCurrentLevel / scoreNeededForNextLevel) * 100, 100);

      return {
        currentLevel,
        nextLevel,
        progress: Math.round(progress),
        scoreNeeded: Math.max(nextThreshold - user.totalScore, 0),
        currentScore: user.totalScore,
        isMaxLevel: false
      };
    } catch (error) {
      console.error('Error calculating level progress:', error);
      return null;
    }
  }

  static async getUserRecommendations(walletAddress, userLevel) {
    try {
      // Get user's quiz history to understand strengths/weaknesses
      const history = await Attempt.getUserHistory(walletAddress, 50);
      const attempts = history.attempts;

      // Analyze performance by topic
      const topicPerformance = {};
      attempts.forEach(attempt => {
        if (!topicPerformance[attempt.topic]) {
          topicPerformance[attempt.topic] = {
            attempts: 0,
            totalScore: 0,
            passed: 0
          };
        }
        
        topicPerformance[attempt.topic].attempts++;
        topicPerformance[attempt.topic].totalScore += attempt.percentage;
        if (attempt.passed) {
          topicPerformance[attempt.topic].passed++;
        }
      });

      // Calculate averages and identify weak areas
      const weakTopics = [];
      const strongTopics = [];

      Object.keys(topicPerformance).forEach(topic => {
        const performance = topicPerformance[topic];
        const averageScore = performance.totalScore / performance.attempts;
        const passRate = (performance.passed / performance.attempts) * 100;

        if (averageScore < 70 || passRate < 50) {
          weakTopics.push({ topic, averageScore, passRate });
        } else if (averageScore >= 85 && passRate >= 80) {
          strongTopics.push({ topic, averageScore, passRate });
        }
      });

      // Generate recommendations
      const recommendations = [];

      // Recommend improvement in weak areas
      if (weakTopics.length > 0) {
        weakTopics.forEach(weak => {
          recommendations.push({
            type: 'improvement',
            topic: weak.topic,
            reason: `Low average score (${Math.round(weak.averageScore)}%)`,
            priority: 'high'
          });
        });
      }

      // Recommend exploring new topics
      const completedTopics = Object.keys(topicPerformance);
      const availableTopics = await this.getAvailableTopicsForLevel(userLevel);
      const newTopics = availableTopics.filter(topic => !completedTopics.includes(topic));

      if (newTopics.length > 0) {
        recommendations.push({
          type: 'exploration',
          topic: newTopics[0], // Recommend first unexplored topic
          reason: 'New topic to explore',
          priority: 'medium'
        });
      }

      // Recommend level progression if ready
      const nextLevel = getNextLevel(userLevel);
      if (nextLevel !== userLevel && canAccessLevel(user.totalScore, nextLevel)) {
        recommendations.push({
          type: 'progression',
          level: nextLevel,
          reason: 'Ready for next level challenges',
          priority: 'high'
        });
      }

      return recommendations.slice(0, 3); // Return top 3 recommendations
    } catch (error) {
      console.error('Error generating user recommendations:', error);
      return [];
    }
  }

  static async getAvailableTopicsForLevel(level) {
    // This would typically come from your topics configuration
    const topicsByLevel = {
      beginner: ['solidity-basics', 'blockchain-fundamentals', 'smart-contracts'],
      intermediate: ['smart-contracts', 'defi', 'security', 'testing'],
      advanced: ['defi', 'security', 'gas-optimization', 'advanced-patterns'],
      expert: ['security', 'gas-optimization', 'advanced-patterns', 'oracles'],
      master: ['advanced-patterns', 'protocol-design', 'formal-verification']
    };

    return topicsByLevel[level] || topicsByLevel.beginner;
  }

  static async getLeaderboard(limit = 100) {
    try {
      const leaderboard = await User.getLeaderboard(limit);
      return leaderboard;
    } catch (error) {
      throw error;
    }
  }

  static async getUserHistory(walletAddress, limit = 20, offset = 0) {
    try {
      const user = await User.findByWallet(walletAddress);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const history = await Attempt.getUserHistory(walletAddress, limit, offset);
      return history;
    } catch (error) {
      throw error;
    }
  }

  static async updateStreak(walletAddress) {
    try {
      const user = await User.findByWallet(walletAddress);
      if (!user) return;

      const now = new Date();
      const lastQuizDate = user.lastQuizDate ? new Date(user.lastQuizDate) : null;
      
      let newStreak = user.streak || 0;

      if (lastQuizDate) {
        const daysDiff = Math.floor((now - lastQuizDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day - increase streak
          newStreak++;
        } else if (daysDiff > 1) {
          // Streak broken - reset
          newStreak = 1;
        }
        // If same day (daysDiff === 0), keep current streak
      } else {
        // First quiz ever
        newStreak = 1;
      }

      await User.update(walletAddress, {
        streak: newStreak,
        lastQuizDate: now
      });

      return newStreak;
    } catch (error) {
      console.error('Error updating streak:', error);
      return 0;
    }
  }

  static async getUserAchievements(walletAddress) {
    try {
      const user = await User.findByWallet(walletAddress);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const stats = await Attempt.getUserStats(walletAddress);
      const achievements = [];

      // Define achievement criteria
      const achievementCriteria = [
        {
          id: 'first_quiz',
          name: 'First Steps',
          description: 'Complete your first quiz',
          condition: stats.totalAttempts >= 1,
          icon: '🎯'
        },
        {
          id: 'perfect_score',
          name: 'Perfect Score',
          description: 'Get 100% on a quiz',
          condition: stats.bestPercentage === 100,
          icon: '💯'
        },
        {
          id: 'quiz_master',
          name: 'Quiz Master',
          description: 'Complete 10 quizzes',
          condition: stats.totalAttempts >= 10,
          icon: '🏆'
        },
        {
          id: 'high_achiever',
          name: 'High Achiever',
          description: 'Maintain 80%+ average score',
          condition: stats.averagePercentage >= 80,
          icon: '⭐'
        },
        {
          id: 'streak_warrior',
          name: 'Streak Warrior',
          description: 'Complete quizzes 7 days in a row',
          condition: user.streak >= 7,
          icon: '🔥'
        }
      ];

      achievementCriteria.forEach(achievement => {
        if (achievement.condition) {
          achievements.push({
            ...achievement,
            earnedAt: new Date() // In a real app, you'd store when each achievement was earned
          });
        }
      });

      return achievements;
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return [];
    }
  }
}