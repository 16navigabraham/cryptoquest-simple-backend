import express from 'express';
import { RewardService } from '../services/rewardService.js';
import blockchainService from '../services/blockchain.js';

const router = express.Router();

// Claim XP reward for completed quiz
router.post('/claim', async (req, res) => {
  try {
    const { walletAddress, quizId } = req.body;

    if (!walletAddress || !quizId) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress and quizId are required'
      });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const reward = await RewardService.claimReward(walletAddress, quizId);

    res.json({
      success: true,
      message: 'Reward claimed successfully',
      data: reward
    });
  } catch (error) {
    console.error('Error claiming reward:', error);
    
    const errorMessages = {
      'NO_ATTEMPT_FOUND': 'No quiz attempt found',
      'REWARD_ALREADY_CLAIMED': 'Reward already claimed for this quiz',
      'SCORE_TOO_LOW': 'Score too low to claim reward (minimum 70% required)'
    };

    const message = errorMessages[error.message] || 'Failed to claim reward';
    const statusCode = error.message === 'NO_ATTEMPT_FOUND' ? 404 : 400;

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Mint badge (automatic after level up)
router.post('/mint', async (req, res) => {
  try {
    const { walletAddress, level } = req.body;

    if (!walletAddress || !level) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress and level are required'
      });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    // Validate level
    const validLevels = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid level. Must be one of: ' + validLevels.join(', ')
      });
    }

    const reward = await RewardService.processLevelUpReward(walletAddress, level);

    if (!reward) {
      return res.status(400).json({
        success: false,
        message: 'User not eligible for this badge or already owns it'
      });
    }

    res.json({
      success: true,
      message: 'Badge minted successfully',
      data: reward
    });
  } catch (error) {
    console.error('Error minting badge:', error);
    
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (error.message === 'INVALID_LEVEL') {
      return res.status(400).json({
        success: false,
        message: 'Invalid level specified'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to mint badge',
      error: error.message
    });
  }
});

// Get user's rewards history
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

    const rewards = await RewardService.getUserRewards(walletAddress);

    res.json({
      success: true,
      data: {
        rewards,
        count: rewards.length
      }
    });
  } catch (error) {
    console.error('Error getting user rewards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user rewards'
    });
  }
});

// Get user's badges from blockchain
router.get('/:walletAddress/badges', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const badges = await RewardService.getUserBadges(walletAddress);

    res.json({
      success: true,
      data: {
        badges,
        count: badges.length
      }
    });
  } catch (error) {
    console.error('Error getting user badges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user badges'
    });
  }
});

// Get unclaimed rewards for user
router.get('/:walletAddress/unclaimed', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const unclaimedRewards = await RewardService.getUnclaimedRewards(walletAddress);

    res.json({
      success: true,
      data: {
        rewards: unclaimedRewards,
        count: unclaimedRewards.length,
        totalXP: unclaimedRewards.reduce((sum, reward) => sum + reward.xpAmount, 0)
      }
    });
  } catch (error) {
    console.error('Error getting unclaimed rewards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unclaimed rewards'
    });
  }
});

// Check reward eligibility
router.get('/:walletAddress/:quizId/eligibility', async (req, res) => {
  try {
    const { walletAddress, quizId } = req.params;

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    const eligibility = await RewardService.checkRewardEligibility(walletAddress, quizId);

    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    console.error('Error checking reward eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check reward eligibility'
    });
  }
});

// Admin: Get reward statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const stats = await RewardService.getRewardStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting reward stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reward statistics'
    });
  }
});

// Admin: Get blockchain status
router.get('/admin/blockchain', async (req, res) => {
  try {
    const status = await blockchainService.healthCheck();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get blockchain status'
    });
  }
});

// Admin: Check signer balance
router.get('/admin/balance', async (req, res) => {
  try {
    const balance = await blockchainService.checkBalance();

    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Error checking balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check balance'
    });
  }
});

// Admin: Get contract statistics
router.get('/admin/contract', async (req, res) => {
  try {
    const stats = await blockchainService.getContractStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting contract stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get contract statistics'
    });
  }
});

export default router;