# CryptoQuest Backend v4.0 - AI-Powered Quiz Platform

A complete backend upgrade for CryptoQuest featuring AI-generated quizzes, automated progression tracking, and onchain badge minting on Base.

## 🚀 Features

- **🧠 AI-Powered Quiz Generation**: Dynamic quiz creation using OpenAI GPT-4
- **🏆 Onchain Badge Minting**: Automatic NFT badge rewards on Base blockchain
- **📊 Advanced User Progression**: XP system, levels, and personalized recommendations
- **⚡ Real-time Leaderboards**: Live scoring and ranking system
- **🎯 Smart Recommendations**: AI-driven topic suggestions based on performance
- **🔒 Secure & Scalable**: Built with modern security practices and rate limiting

## 📁 Project Structure

```
src/
├── config/          # Database and environment configuration
├── models/          # Data models (User, Quiz, Attempt)
├── ai/              # AI quiz generation and topic management
├── routes/          # API route handlers
├── services/        # Business logic layer
├── utils/           # Helper functions and constants
├── scripts/         # Utility scripts (quiz generation, etc.)
└── index.js         # Main application entry point
```

## 🛠 Setup Instructions

### 1. Prerequisites

- Node.js 16+ 
- MongoDB (local or Atlas)
- OpenAI API account
- Base Sepolia testnet wallet with ETH

### 2. Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Environment Configuration

Edit `.env` file with your credentials:

```env
# Database
MONGODB_URI=mongodb://localhost:27017
DB_NAME=cryptoquest

# OpenAI (Required)
OPENAI_API_KEY=your_openai_api_key_here

# Blockchain (Base Sepolia)
PRIVATE_KEY=your_wallet_private_key_here
CONTRACT_ADDRESS=your_badge_contract_address_here
RPC_URL=https://sepolia.base.org
```

### 4. Database Setup

Start MongoDB and the application will automatically:
- Create required collections
- Set up proper indexes
- Initialize schema

### 5. Badge Contract Deployment

Deploy an ERC721 contract with these functions:
```solidity
function safeMint(address to, uint256 level) external;
function balanceOf(address owner) external view returns (uint256);
function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
```

Or use our recommended OpenZeppelin implementation.

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Generate Sample Quizzes
```bash
npm run generate-quiz
```

## 📡 API Endpoints

### Quiz Management
- `POST /api/quiz/generate` - Generate AI-powered quiz
- `POST /api/quiz/submit` - Submit quiz answers
- `GET /api/quiz/:id` - Get specific quiz
- `GET /api/quiz/level/:level` - Get quizzes by level

### User Management
- `POST /api/users` - Create/Update user profile
- `GET /api/users/:walletAddress` - Get user profile with stats
- `GET /api/users/:walletAddress/history` - Get quiz history
- `GET /api/users` - Get leaderboard

### Rewards & Badges
- `POST /api/rewards/claim` - Claim XP rewards
- `POST /api/rewards/mint` - Mint achievement badges
- `GET /api/rewards/:walletAddress` - Get user rewards
- `GET /api/rewards/:walletAddress/badges` - Get user badges

### Health & Status
- `GET /health` - System health check
- `GET /` - API documentation

## 🎯 Quiz Generation System

The AI system generates quizzes across 5 difficulty levels:

- **Beginner**: Solidity basics, blockchain fundamentals
- **Intermediate**: DeFi concepts, smart contract security
- **Advanced**: Gas optimization, design patterns
- **Expert**: Protocol design, MEV, oracles
- **Master**: Formal verification, cross-chain development

## 🏆 Progression System

### XP & Levels
- 10 XP per correct answer
- 50 XP bonus for quiz completion
- 100 XP bonus for perfect scores
- Level thresholds: 250, 500, 1000, 2000 XP

### Badge Minting
Automatic NFT badges minted on Base for:
- Beginner (100+ total score)
- Intermediate (250+ total score)  
- Advanced (500+ total score)
- Expert (1000+ total score)
- Master (2000+ total score)

## 🔧 Development

### Key Technologies
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with proper indexing
- **AI**: OpenAI GPT-4 for quiz generation
- **Blockchain**: ethers.js for Base interaction
- **Security**: Helmet, CORS, rate limiting

### Code Organization
- **Models**: Data layer with MongoDB operations
- **Services**: Business logic and external integrations
- **Routes**: API endpoints and request handling
- **Utils**: Shared utilities and helpers

## 🔒 Security Features

- Rate limiting on quiz generation and submission
- Input validation and sanitization
- Secure wallet address handling
- Environment variable protection
- CORS configuration for known origins

## 📊 Monitoring

### Health Checks
- Database connectivity
- Blockchain connection status
- OpenAI API availability
- Service dependencies

### Logging
- Request/response logging
- Error tracking with context
- Performance monitoring
- Automated alerting (configurable)

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production MongoDB URI
- [ ] Set strong JWT secret
- [ ] Deploy badge contract to Base mainnet
- [ ] Configure production RPC URL
- [ ] Set up monitoring and logging
- [ ] Configure automatic backups

### Recommended Infrastructure
- **Hosting**: Railway, Heroku, or DigitalOcean
- **Database**: MongoDB Atlas
- **Monitoring**: LogRocket, Sentry
- **Blockchain**: Alchemy or Infura RPC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For questions or issues:
1. Check the `/health` endpoint
2. Review console logs
3. Verify environment configuration
4. Open an issue on GitHub

---

**Built with ❤️ for the Web3 education community**