# CryptoQuest Badge & Reward System

## 🎯 Overview

Complete gasless badge and reward system with:
- **NFT Badges**: 8 types across 5 levels stored on IPFS via Pinata
- **ERC20 Rewards**: Automatic token distribution from your existing token
- **Gasless Experience**: Backend pays all gas fees for users
- **Base Mainnet**: Deployed on Base for low-cost transactions

## 📋 Setup Instructions

### 1. Deploy Badge Contract

```bash
cd contracts
npm install
npx hardhat run scripts/deploy.js --network base
```

### 2. Set Up Your Existing ERC20 Token

Update `contracts/scripts/setup-rewards.js` with:
- Your deployed badge contract address
- Your existing ERC20 token address

```bash
npx hardhat run scripts/setup-rewards.js --network base
```

### 3. Upload Badge Images to Pinata

Upload 40 badge images (8 types × 5 levels) to Pinata:

**Badge Types:**
- `FIRST_QUIZ` - First quiz completion
- `STREAK_5` - 5 quiz streak  
- `STREAK_10` - 10 quiz streak
- `LEVEL_MASTER` - Complete all topics in level
- `PERFECT_SCORE` - 100% score achievement
- `SPEED_DEMON` - Fast completion
- `CONSISTENCY` - Regular participation
- `EXPLORER` - Trying different topics

**Folder Structure:**
```
badges/
├── level1/
│   ├── first_quiz.json
│   ├── perfect_score.json
│   └── ... (8 files)
├── level2/
│   └── ... (8 files)
└── ... (5 levels total)
```

### 4. Set IPFS CIDs in Contract

After uploading to Pinata, set the IPFS CIDs:

```javascript
// Connect to your deployed contract
const badgeContract = await ethers.getContractAt("CryptoQuestBadges", "YOUR_CONTRACT_ADDRESS");

// Set individual badge CIDs
await badgeContract.setBadgeIPFS(0, 0, "QmYourLevel1FirstQuizHash");
await badgeContract.setBadgeIPFS(0, 4, "QmYourLevel1PerfectScoreHash");
// ... repeat for all 40 badges

// Or use batch setting for efficiency
await badgeContract.setBatchBadgeIPFS(
  [0, 0, 0, 1, 1, 1], // levels
  [0, 1, 2, 0, 1, 2], // badge types  
  ["QmHash1", "QmHash2", "QmHash3", "QmHash4", "QmHash5", "QmHash6"] // IPFS CIDs
);
```

### 5. Fund the Contract with Rewards

```javascript
// Approve and deposit your ERC20 tokens for distribution
const rewardToken = await ethers.getContractAt("IERC20", "YOUR_TOKEN_ADDRESS");

// Approve 100,000 tokens (adjust decimals as needed)
await rewardToken.approve(badgeContractAddress, ethers.parseUnits("100000", 18));

// Deposit tokens into the badge contract
await badgeContract.depositRewards(ethers.parseUnits("100000", 18));
```

### 6. Update Backend Environment

Update your `.env` file:

```env
# Add your deployed contract address
CONTRACT_ADDRESS=0xYourDeployedBadgeContractAddress

# Add your existing ERC20 token address  
REWARD_TOKEN_ADDRESS=0xYourExistingERC20TokenAddress

# Base Mainnet configuration
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
PRIVATE_KEY=0xYourBackendWalletPrivateKey
```

### 7. Start the Backend

```bash
npm start
```

## 🎮 How It Works

### User Experience
1. **Complete Quiz** → User takes quiz and scores above threshold
2. **Auto-Rewards** → Backend automatically processes rewards
3. **Gasless Claiming** → Users receive badges and tokens without paying gas
4. **NFT Collection** → Badges appear in user's wallet as NFTs

### Reward System
- **Base Rewards**: Tokens for each quiz completion
- **Perfect Score Bonus**: Extra tokens for 100% score  
- **Streak Multipliers**: Bonus for consecutive completions
- **Level Completion Bonus**: Big reward for finishing all topics
- **Badge NFTs**: Collectible achievements for milestones

### Scoring Thresholds
- **Level 1**: 75% score required
- **Level 2**: 75% score required  
- **Level 3**: 80% score required
- **Level 4**: 85% score required
- **Level 5**: 90% score required

## 🔧 Management Functions

### Badge Management
```javascript
// Set new badge IPFS CID
await badgeContract.setBadgeIPFS(level, badgeType, "QmNewIPFSHash");

// Check if user has specific badge
await badgeContract.hasBadge(userAddress, level, badgeType);

// Get user's all badges
await badgeContract.getUserBadges(userAddress);
```

### Reward Management  
```javascript
// Check contract reward balance
await badgeContract.getRewardBalance();

// Update reward configuration for a level
await badgeContract.updateRewardConfig(level, baseReward, perfectBonus, streakMultiplier, levelBonus);

// Get user's reward info
await badgeContract.getUserRewardInfo(userAddress);
```

### Emergency Functions
```javascript
// Withdraw excess rewards (owner only)
await badgeContract.withdrawRewards(amount);

// Emergency ETH withdrawal (owner only)  
await badgeContract.emergencyWithdrawETH();
```

## 📊 Monitoring

### API Endpoints
- `GET /api/rewards/:walletAddress` - User's badges and rewards
- `GET /api/levels` - All level configurations
- `POST /api/quiz/submit` - Submit quiz and auto-claim rewards

### Events to Monitor
- `BadgeMinted` - New badge NFT created
- `RewardDistributed` - Tokens sent to user
- `FundsDeposited` - Rewards added to contract
- `BadgeURIUpdated` - New IPFS CID set

## 🚀 Production Checklist

- [ ] Contract deployed on Base Mainnet
- [ ] Reward token configured in contract
- [ ] All 40 badge images uploaded to Pinata
- [ ] All IPFS CIDs set in contract
- [ ] Sufficient reward tokens deposited
- [ ] Backend environment configured
- [ ] Contract verified on BaseScan
- [ ] Monitoring and alerts set up

Your CryptoQuest badge and reward system is now ready for production! 🎉