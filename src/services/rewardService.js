import { ethers } from 'ethers';
import config from '../config/env.js';
import database from '../config/db.js';
import { User } from '../models/User.js';
import { Attempt } from '../models/Attempt.js';

// Enhanced Badge Contract ABI for CryptoQuest with ERC20 rewards
const BADGE_CONTRACT_ABI = [
  "function mintBadgeWithReward(address to, uint8 level, uint8 badgeType, uint256 quizCount, uint256 score, string memory metadata, uint256 rewardAmount) external returns (uint256)",
  "function mintBadge(address to, uint8 level, uint8 badgeType, uint256 quizCount, uint256 score, string memory metadata) external returns (uint256)",
  "function distributeQuizReward(address to, uint8 level, uint256 baseScore, bool isPerfectScore, uint256 streakCount, bool isLevelCompletion) external",
  "function hasBadge(address user, uint8 level, uint8 badgeType) external view returns (bool)",
  "function getUserBadges(address user) external view returns (uint256[] memory)",
  "function getBadgeDetails(uint256 tokenId) external view returns (tuple(uint8 level, uint8 badgeType, uint256 timestamp, uint256 quizCount, uint256 score, string metadata))",
  "function getUserBadgeCount(address user, uint8 level) external view returns (uint256)",
  "function getUserRewardInfo(address user) external view returns (uint256 earned, uint256 claimed)",
  "function getRewardBalance() external view returns (uint256)",
  "function setRewardToken(address _rewardToken) external",
  "function setBadgeIPFS(uint8 level, uint8 badgeType, string memory ipfsCID) external",
  "function getBadgeIPFS(uint8 level, uint8 badgeType) external view returns (string memory)",
  "function depositRewards(uint256 amount) external",
  "function authorizeMinter(address minter) external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "event BadgeMinted(address indexed user, uint256 indexed tokenId, uint8 level, uint8 badgeType)",
  "event RewardDistributed(address indexed user, uint256 amount, string reason)"
];

// ERC20 Token ABI for reward token interactions
const ERC20_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string memory)",
  "function name() external view returns (string memory)"
];

// Badge type mappings
const BADGE_LEVELS = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4,
  'level1': 0, 'level2': 1, 'level3': 2, 'level4': 3, 'level5': 4
};

const BADGE_TYPES = {
  FIRST_QUIZ: 0,
  STREAK_5: 1,
  STREAK_10: 2,
  LEVEL_MASTER: 3,
  PERFECT_SCORE: 4,
  SPEED_DEMON: 5,
  CONSISTENCY: 6,
  EXPLORER: 7
};

export class RewardService {
  static async initializeBlockchain() {
    try {
      if (!config.PRIVATE_KEY || !config.RPC_URL || !config.CONTRACT_ADDRESS) {
        throw new Error('Missing blockchain configuration');
      }

      this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
      this.signer = new ethers.Wallet(config.PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(config.CONTRACT_ADDRESS, BADGE_CONTRACT_ABI, this.signer);
      
      // Initialize reward token if configured
      if (config.REWARD_TOKEN_ADDRESS) {
        this.rewardToken = new ethers.Contract(config.REWARD_TOKEN_ADDRESS, ERC20_ABI, this.signer);
        console.log('Reward token contract initialized:', config.REWARD_TOKEN_ADDRESS);
      }
      
      console.log('Blockchain connection initialized');
      console.log('Signer address:', this.signer.address);
      console.log('Contract address:', config.CONTRACT_ADDRESS);
    } catch (error) {
      console.error('Failed to initialize blockchain:', error);
      throw error;
    }
  }

  static async setupRewardToken(rewardTokenAddress) {
    try {
      if (!this.contract) {
        await this.initializeBlockchain();
      }

      console.log(`Setting up reward token: ${rewardTokenAddress}`);
      
      // Set the reward token in the badge contract
      const setTokenTx = await this.contract.setRewardToken(rewardTokenAddress);
      await setTokenTx.wait();
      
      // Initialize the reward token contract for backend use
      this.rewardToken = new ethers.Contract(rewardTokenAddress, ERC20_ABI, this.signer);
      
      // Get token info
      const tokenName = await this.rewardToken.name();
      const tokenSymbol = await this.rewardToken.symbol();
      const tokenDecimals = await this.rewardToken.decimals();
      
      console.log(`Reward token set up successfully:`);
      console.log(`  Name: ${tokenName}`);
      console.log(`  Symbol: ${tokenSymbol}`);
      console.log(`  Decimals: ${tokenDecimals}`);
      
      return {
        success: true,
        tokenAddress: rewardTokenAddress,
        name: tokenName,
        symbol: tokenSymbol,
        decimals: tokenDecimals
      };
    } catch (error) {
      console.error('Error setting up reward token:', error);
      throw error;
    }
  }

  static async mintBadge(walletAddress, level, badgeType = 'FIRST_QUIZ', quizCount = 1, score = 0, metadata = '') {
    try {
      if (!this.contract) {
        await this.initializeBlockchain();
      }

      // Convert inputs to contract format
      const levelNumber = BADGE_LEVELS[level];
      const badgeTypeNumber = BADGE_TYPES[badgeType];
      
      if (levelNumber === undefined || badgeTypeNumber === undefined) {
        throw new Error('INVALID_LEVEL_OR_BADGE_TYPE');
      }

      console.log(`Minting badge for ${walletAddress}`);
      console.log(`Level: ${level} (${levelNumber}), Type: ${badgeType} (${badgeTypeNumber})`);

      // Check if user already has this badge
      const hasBadge = await this.contract.hasBadge(walletAddress, levelNumber, badgeTypeNumber);
      if (hasBadge) {
        console.log(`User already has this badge: Level ${level} ${badgeType}`);
        return {
          alreadyOwned: true,
          level,
          badgeType,
          message: 'Badge already owned'
        };
      }

      // Estimate gas
      const gasEstimate = await this.contract.mintBadge.estimateGas(
        walletAddress, 
        levelNumber, 
        badgeTypeNumber, 
        quizCount, 
        score, 
        metadata || ''
      );
      
      const gasPrice = await this.provider.getGasPrice();
      console.log(`Gas estimate: ${gasEstimate.toString()}, Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

      // Execute transaction
      const tx = await this.contract.mintBadge(
        walletAddress, 
        levelNumber, 
        badgeTypeNumber, 
        quizCount, 
        score, 
        metadata || '',
        {
          gasLimit: gasEstimate + BigInt(10000), // Add buffer
          gasPrice: gasPrice
        }
      );

      console.log('Badge minting transaction submitted:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Badge minting confirmed:', receipt.transactionHash);

      // Parse the BadgeMinted event to get token ID
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed.name === 'BadgeMinted';
        } catch {
          return false;
        }
      });

      let tokenId = null;
      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        tokenId = parsed.args.tokenId.toString();
      }

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        tokenId,
        level,
        badgeType,
        mintedAt: new Date()
      };
    } catch (error) {
      console.error('Error minting badge:', error);
      throw new Error(`MINT_FAILED: ${error.message}`);
    }
  }

  static async checkRewardEligibility(walletAddress, quizId) {
    try {
      const attempt = await Attempt.findByWalletAndQuiz(walletAddress, quizId);
      
      if (!attempt) {
        return { eligible: false, reason: 'NO_ATTEMPT_FOUND' };
      }

      if (attempt.rewardClaimed) {
        return { eligible: false, reason: 'REWARD_ALREADY_CLAIMED' };
      }

      // Check if attempt was marked as reward eligible during submission
      if (!attempt.rewardEligible) {
        return { 
          eligible: false, 
          reason: 'SCORE_TOO_LOW',
          details: {
            percentage: attempt.percentage,
            required: attempt.scoreThreshold,
            level: attempt.level
          }
        };
      }

      return { eligible: true, attempt };
    } catch (error) {
      throw error;
    }
  }

  static async claimReward(walletAddress, quizId) {
    try {
      // Check eligibility
      const eligibility = await this.checkRewardEligibility(walletAddress, quizId);
      
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }

      const attempt = eligibility.attempt;

      // Create reward record
      const reward = {
        walletAddress: walletAddress.toLowerCase(),
        quizId,
        attemptId: attempt._id,
        rewardType: 'xp',
        amount: attempt.xpEarned,
        level: attempt.level,
        topic: attempt.topic,
        status: 'claimed',
        claimedAt: new Date(),
        createdAt: new Date()
      };

      const result = await database.db.collection('rewards').insertOne(reward);

      // Mark attempt as claimed
      await Attempt.markRewardClaimed(walletAddress, quizId);

      return {
        rewardId: result.insertedId,
        type: 'xp',
        amount: attempt.xpEarned,
        claimedAt: new Date()
      };
    } catch (error) {
      console.error('Error claiming reward:', error);
      throw error;
    }
  }

  static async processQuizCompletionRewards(walletAddress, attempt) {
    try {
      if (!attempt.rewardEligible) {
        console.log('Quiz attempt not eligible for rewards');
        return { rewards: [], message: 'Score too low for rewards' };
      }

      const rewards = [];
      
      // Get user's quiz history for badge calculations
      const userHistory = await Attempt.getUserHistory(walletAddress, 100);
      const allAttempts = userHistory.attempts;
      const eligibleAttempts = allAttempts.filter(a => a.rewardEligible);
      
      // First, distribute quiz completion reward through contract
      try {
        const levelNumber = BADGE_LEVELS[attempt.level];
        const isPerfectScore = attempt.percentage === 100;
        const streakCount = this.calculateStreakCount(eligibleAttempts);
        const isLevelCompletion = this.checkLevelCompletion(attempt, eligibleAttempts);
        
        await this.contract.distributeQuizReward(
          walletAddress,
          levelNumber,
          attempt.score,
          isPerfectScore,
          streakCount,
          isLevelCompletion
        );
        
        rewards.push({
          type: 'tokens',
          source: 'quiz_completion',
          level: attempt.level,
          details: {
            baseReward: true,
            perfectScore: isPerfectScore,
            streakCount,
            levelCompletion: isLevelCompletion
          }
        });
      } catch (error) {
        console.error('Failed to distribute quiz reward:', error.message);
      }

      // Badge 1: First Quiz Completion
      if (eligibleAttempts.length === 1) {
        try {
          const badgeResult = await this.mintBadge(
            walletAddress, 
            attempt.level, 
            'FIRST_QUIZ', 
            1, 
            attempt.score,
            `First quiz completed in Level ${attempt.level}`
          );
          if (badgeResult.success) {
            rewards.push({
              type: 'badge',
              badge: 'FIRST_QUIZ',
              level: attempt.level,
              ...badgeResult
            });
          }
        } catch (error) {
          console.error('Failed to mint FIRST_QUIZ badge:', error.message);
        }
      }

      // Badge 2: Perfect Score
      if (attempt.percentage === 100) {
        try {
          const badgeResult = await this.mintBadge(
            walletAddress, 
            attempt.level, 
            'PERFECT_SCORE', 
            eligibleAttempts.length, 
            attempt.score,
            `Perfect score achieved in Level ${attempt.level}`
          );
          if (badgeResult.success) {
            rewards.push({
              type: 'badge',
              badge: 'PERFECT_SCORE',
              level: attempt.level,
              ...badgeResult
            });
          }
        } catch (error) {
          console.error('Failed to mint PERFECT_SCORE badge:', error.message);
        }
      }

      // Badge 3: Speed Demon (completed in under 50% of time limit)
      if (attempt.timeSpent && attempt.timeSpent < 150) { // Less than 2.5 minutes for most quizzes
        try {
          const badgeResult = await this.mintBadge(
            walletAddress, 
            attempt.level, 
            'SPEED_DEMON', 
            eligibleAttempts.length, 
            attempt.score,
            `Fast completion in Level ${attempt.level}`
          );
          if (badgeResult.success) {
            rewards.push({
              type: 'badge',
              badge: 'SPEED_DEMON',
              level: attempt.level,
              ...badgeResult
            });
          }
        } catch (error) {
          console.error('Failed to mint SPEED_DEMON badge:', error.message);
        }
      }

      // Badge 4: Streak Badges
      const streakCount = this.calculateStreakCount(eligibleAttempts);
      if (streakCount >= 5) {
        try {
          const badgeType = streakCount >= 10 ? 'STREAK_10' : 'STREAK_5';
          const badgeResult = await this.mintBadge(
            walletAddress, 
            attempt.level, 
            badgeType, 
            eligibleAttempts.length, 
            attempt.score,
            `${streakCount} quiz streak achieved`
          );
          if (badgeResult.success) {
            rewards.push({
              type: 'badge',
              badge: badgeType,
              level: attempt.level,
              ...badgeResult
            });
          }
        } catch (error) {
          console.error('Failed to mint streak badge:', error.message);
        }
      }

      // Badge 5: Level Master (completed all topics in level)
      if (this.checkLevelCompletion(attempt, eligibleAttempts)) {
        try {
          const badgeResult = await this.mintBadge(
            walletAddress, 
            attempt.level, 
            'LEVEL_MASTER', 
            eligibleAttempts.length, 
            attempt.score,
            `Mastered all topics in Level ${attempt.level}`
          );
          if (badgeResult.success) {
            rewards.push({
              type: 'badge',
              badge: 'LEVEL_MASTER',
              level: attempt.level,
              ...badgeResult
            });
          }
        } catch (error) {
          console.error('Failed to mint LEVEL_MASTER badge:', error.message);
        }
      }

      // Record XP reward in database
      const xpReward = {
        walletAddress: walletAddress.toLowerCase(),
        quizId: attempt.quizId,
        attemptId: attempt._id,
        rewardType: 'xp',
        amount: attempt.xpEarned,
        level: attempt.level,
        topic: attempt.topic,
        status: 'claimed',
        claimedAt: new Date(),
        createdAt: new Date()
      };

      await database.db.collection('rewards').insertOne(xpReward);
      
      rewards.push({
        type: 'xp',
        amount: attempt.xpEarned,
        level: attempt.level
      });

      // Mark attempt as claimed
      await Attempt.markRewardClaimed(walletAddress, attempt.quizId);

      return {
        success: true,
        rewards,
        totalRewards: rewards.length,
        xpEarned: attempt.xpEarned
      };

    } catch (error) {
      console.error('Error processing quiz completion rewards:', error);
      throw error;
    }
  }

  static calculateStreakCount(eligibleAttempts) {
    // Count consecutive successful attempts from most recent
    let streak = 0;
    for (const attempt of eligibleAttempts) {
      if (attempt.rewardEligible) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  static checkLevelCompletion(currentAttempt, eligibleAttempts) {
    const levelConfig = config.QUIZ_LEVELS[currentAttempt.level];
    if (!levelConfig) return false;
    
    const completedTopics = new Set(
      eligibleAttempts
        .filter(a => a.level === currentAttempt.level)
        .map(a => a.topic)
    );
    
    return completedTopics.size >= levelConfig.topics.length;
  }

  static async getUserRewards(walletAddress) {
    try {
      const rewards = await database.db.collection('rewards')
        .find({ walletAddress: walletAddress.toLowerCase() })
        .sort({ createdAt: -1 })
        .toArray();

      return rewards;
    } catch (error) {
      throw error;
    }
  }

  static async getUserBadges(walletAddress) {
    try {
      if (!this.contract) {
        await this.initializeBlockchain();
      }

      // Get badge count from contract
      const balance = await this.contract.balanceOf(walletAddress);
      const badges = [];

      // Get all badge token IDs for this user
      for (let i = 0; i < balance; i++) {
        try {
          const tokenId = await this.contract.tokenOfOwnerByIndex(walletAddress, i);
          badges.push({
            tokenId: tokenId.toString(),
            level: this.mapTokenIdToLevel(tokenId),
            ownedAt: new Date() // In a real app, you'd get this from Transfer events
          });
        } catch (error) {
          console.error(`Error getting token ${i} for ${walletAddress}:`, error);
        }
      }

      return badges;
    } catch (error) {
      console.error('Error getting user badges:', error);
      return [];
    }
  }

  static mapTokenIdToLevel(tokenId) {
    // This depends on how your contract maps token IDs to levels
    // This is a simple example - adjust based on your contract logic
    const levelMap = {
      1: 'level1',
      2: 'level2',
      3: 'level3',
      4: 'level4',
      5: 'level5'
    };

    return levelMap[Number(tokenId)] || 'unknown';
  }

  static async getUnclaimedRewards(walletAddress) {
    try {
      const unclaimedAttempts = await Attempt.getUnclaimedRewards(walletAddress);
      
      return unclaimedAttempts.map(attempt => ({
        quizId: attempt.quizId,
        attemptId: attempt._id,
        xpAmount: attempt.xpEarned,
        level: attempt.level,
        topic: attempt.topic,
        completedAt: attempt.createdAt,
        claimable: true
      }));
    } catch (error) {
      throw error;
    }
  }

  static async getRewardStats() {
    try {
      const stats = await database.db.collection('rewards').aggregate([
        {
          $group: {
            _id: '$rewardType',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const badgesByLevel = await database.db.collection('rewards').aggregate([
        { $match: { rewardType: 'badge', status: 'minted' } },
        {
          $group: {
            _id: '$level',
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      return {
        rewardTypes: stats,
        badgesByLevel
      };
    } catch (error) {
      throw error;
    }
  }

  // Utility method to check blockchain connection
  static async checkBlockchainConnection() {
    try {
      if (!this.provider) {
        await this.initializeBlockchain();
      }

      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(this.signer.address);
      
      return {
        connected: true,
        network: network.name,
        chainId: Number(network.chainId),
        signerAddress: this.signer.address,
        signerBalance: ethers.formatEther(balance),
        contractAddress: config.CONTRACT_ADDRESS
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}