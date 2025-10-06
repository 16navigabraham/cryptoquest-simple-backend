import express from 'express';
import { UserService } from '../services/userService.js';

const router = express.Router();

// Create or update user profile
router.post('/', async (req, res) => {
  try {
    const { walletAddress, username, profilePictureUrl } = req.body;

    // Validate required fields
    if (!walletAddress || !username) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress and username are required'
      });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    // Validate username length
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 30 characters'
      });
    }

    const user = await UserService.createOrUpdateUser({
      walletAddress,
      username,
      profilePictureUrl
    });

    res.json({
      success: true,
      message: 'User profile updated successfully',
      data: {
        id: user._id,
        walletAddress: user.walletAddress,
        username: user.username,
        profilePictureUrl: user.profilePictureUrl,
        totalScore: user.totalScore,
        xp: user.xp,
        level: user.level,
        badges: user.badges || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    
    if (error.message === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({
        success: false,
        message: 'User with this wallet address already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create or update user profile'
    });
  }
});

// Get user profile with stats
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const userProfile = await UserService.getUserProfile(walletAddress);

    res.json({
      success: true,
      data: userProfile
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile'
    });
  }
});

// Get user quiz history
router.get('/:walletAddress/history', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const history = await UserService.getUserHistory(walletAddress, limit, offset);

    res.json({
      success: true,
      data: {
        history: history.attempts,
        pagination: {
          total: history.total,
          limit,
          offset,
          hasMore: history.hasMore
        }
      }
    });
  } catch (error) {
    console.error('Error getting user history:', error);
    
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user history'
    });
  }
});

// Get user achievements
router.get('/:walletAddress/achievements', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const achievements = await UserService.getUserAchievements(walletAddress);

    res.json({
      success: true,
      data: {
        achievements,
        count: achievements.length
      }
    });
  } catch (error) {
    console.error('Error getting user achievements:', error);
    
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user achievements'
    });
  }
});

// Update user profile
router.put('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { username, profilePictureUrl } = req.body;

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const updateData = {};
    if (username) {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({
          success: false,
          message: 'Username must be between 3 and 30 characters'
        });
      }
      updateData.username = username;
    }

    if (profilePictureUrl !== undefined) {
      updateData.profilePictureUrl = profilePictureUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update'
      });
    }

    const updatedUser = await UserService.createOrUpdateUser({
      walletAddress,
      ...updateData
    });

    res.json({
      success: true,
      message: 'User profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user profile'
    });
  }
});

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const leaderboard = await UserService.getLeaderboard(limit);

    res.json({
      success: true,
      data: {
        leaderboard,
        totalPlayers: leaderboard.length,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

// Get user recommendations
router.get('/:walletAddress/recommendations', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const userProfile = await UserService.getUserProfile(walletAddress);
    
    res.json({
      success: true,
      data: {
        recommendations: userProfile.recommendations
      }
    });
  } catch (error) {
    console.error('Error getting user recommendations:', error);
    
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user recommendations'
    });
  }
});

export default router;