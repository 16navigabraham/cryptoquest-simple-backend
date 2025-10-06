// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CryptoQuestBadges
 * @dev NFT Badge system with ERC20 reward distribution for CryptoQuest platform
 */
contract CryptoQuestBadges is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Badge levels
    enum BadgeLevel { LEVEL1, LEVEL2, LEVEL3, LEVEL4, LEVEL5 }
    
    // Badge types within each level
    enum BadgeType { 
        FIRST_QUIZ,      // First quiz completion
        STREAK_5,        // 5 quiz streak
        STREAK_10,       // 10 quiz streak
        LEVEL_MASTER,    // All topics completed in level
        PERFECT_SCORE,   // 100% score achievement
        SPEED_DEMON,     // Fast completion
        CONSISTENCY,     // Regular participation
        EXPLORER         // Trying different topics
    }
    
    struct Badge {
        BadgeLevel level;
        BadgeType badgeType;
        uint256 timestamp;
        uint256 quizCount;
        uint256 score;
        string metadata;
    }
    
    struct RewardConfig {
        uint256 quizCompletionReward;    // Base reward for completing quiz
        uint256 perfectScoreBonus;       // Bonus for 100% score
        uint256 streakMultiplier;        // Multiplier for streak bonuses
        uint256 levelCompletionBonus;    // Bonus for completing all topics in level
    }
    
    // State variables
    IERC20 public rewardToken;
    mapping(uint256 => Badge) public badges;
    mapping(address => mapping(BadgeLevel => mapping(BadgeType => bool))) public userBadges;
    mapping(address => uint256[]) public userTokens;
    mapping(BadgeLevel => mapping(BadgeType => string)) public badgeURIs; // Pinata IPFS CIDs
    mapping(address => bool) public authorizedMinters;
    mapping(BadgeLevel => RewardConfig) public rewardConfigs;
    mapping(address => uint256) public totalRewardsEarned;
    mapping(address => uint256) public totalRewardsClaimed;
    
    // Events
    event BadgeMinted(address indexed user, uint256 indexed tokenId, BadgeLevel level, BadgeType badgeType);
    event RewardDistributed(address indexed user, uint256 amount, string reason);
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);
    event BadgeURIUpdated(BadgeLevel level, BadgeType badgeType, string ipfsCID);
    event RewardTokenUpdated(address indexed newToken);
    event RewardConfigUpdated(BadgeLevel level, uint256 baseReward, uint256 perfectBonus, uint256 streakMultiplier, uint256 levelBonus);
    event FundsDeposited(address indexed depositor, uint256 amount);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    
    
    constructor() ERC721("CryptoQuest Badges", "CQB") {
        // Initialize default reward configurations for each level
        rewardConfigs[BadgeLevel.LEVEL1] = RewardConfig(100 * 10**18, 50 * 10**18, 2, 200 * 10**18);   // 100 base, 50 perfect bonus, 2x streak, 200 level bonus
        rewardConfigs[BadgeLevel.LEVEL2] = RewardConfig(150 * 10**18, 75 * 10**18, 2, 300 * 10**18);   // 150 base, 75 perfect bonus, 2x streak, 300 level bonus  
        rewardConfigs[BadgeLevel.LEVEL3] = RewardConfig(200 * 10**18, 100 * 10**18, 3, 400 * 10**18);  // 200 base, 100 perfect bonus, 3x streak, 400 level bonus
        rewardConfigs[BadgeLevel.LEVEL4] = RewardConfig(300 * 10**18, 150 * 10**18, 3, 600 * 10**18);  // 300 base, 150 perfect bonus, 3x streak, 600 level bonus
        rewardConfigs[BadgeLevel.LEVEL5] = RewardConfig(500 * 10**18, 250 * 10**18, 4, 1000 * 10**18); // 500 base, 250 perfect bonus, 4x streak, 1000 level bonus
    }
    
    /**
     * @dev Set the reward token contract address
     */
    function setRewardToken(address _rewardToken) external onlyOwner {
        require(_rewardToken != address(0), "Invalid token address");
        rewardToken = IERC20(_rewardToken);
        emit RewardTokenUpdated(_rewardToken);
    }
    
    /**
     * @dev Update reward configuration for a specific level
     */
    function updateRewardConfig(
        BadgeLevel level,
        uint256 baseReward,
        uint256 perfectBonus,
        uint256 streakMultiplier,
        uint256 levelBonus
    ) external onlyOwner {
        rewardConfigs[level] = RewardConfig(baseReward, perfectBonus, streakMultiplier, levelBonus);
        emit RewardConfigUpdated(level, baseReward, perfectBonus, streakMultiplier, levelBonus);
    }
    
    /**
     * @dev Deposit reward tokens into the contract
     */
    function depositRewards(uint256 amount) external {
        require(address(rewardToken) != address(0), "Reward token not set");
        require(amount > 0, "Amount must be greater than 0");
        
        rewardToken.transferFrom(msg.sender, address(this), amount);
        emit FundsDeposited(msg.sender, amount);
    }
    
    /**
     * @dev Get contract's reward token balance
     */
    function getRewardBalance() external view returns (uint256) {
        if (address(rewardToken) == address(0)) return 0;
        return rewardToken.balanceOf(address(this));
    }
    
    /**
     * @dev Authorize an address to mint badges (backend wallet)
     */
    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }
    
    /**
     * @dev Revoke minting authorization
     */
    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }
    
    /**
     * @dev Mint badge and distribute rewards to user (called by authorized backend)
     * @param to User's wallet address
     * @param level Badge level (0-4 for LEVEL1-LEVEL5)
     * @param badgeType Type of achievement (0-7)
     * @param quizCount Number of quizzes completed
     * @param score User's score for this achievement
     * @param metadata Additional metadata
     * @param rewardAmount Token reward amount to transfer
     */
    function mintBadgeWithReward(
        address to,
        BadgeLevel level,
        BadgeType badgeType,
        uint256 quizCount,
        uint256 score,
        string memory metadata,
        uint256 rewardAmount
    ) external nonReentrant returns (uint256) {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        require(to != address(0), "Cannot mint to zero address");
        require(!userBadges[to][level][badgeType], "Badge already earned");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        // Create badge struct
        badges[tokenId] = Badge({
            level: level,
            badgeType: badgeType,
            timestamp: block.timestamp,
            quizCount: quizCount,
            score: score,
            metadata: metadata
        });
        
        // Mark as earned
        userBadges[to][level][badgeType] = true;
        userTokens[to].push(tokenId);
        
        // Mint NFT
        _safeMint(to, tokenId);
        
        // Set token URI from Pinata IPFS CID
        string memory ipfsCID = badgeURIs[level][badgeType];
        if (bytes(ipfsCID).length > 0) {
            string memory fullURI = string(abi.encodePacked("ipfs://", ipfsCID));
            _setTokenURI(tokenId, fullURI);
        }
        
        // Distribute reward tokens if configured and available
        if (address(rewardToken) != address(0) && rewardAmount > 0) {
            uint256 contractBalance = rewardToken.balanceOf(address(this));
            if (contractBalance >= rewardAmount) {
                rewardToken.transfer(to, rewardAmount);
                totalRewardsEarned[to] += rewardAmount;
                totalRewardsClaimed[to] += rewardAmount;
                emit RewardDistributed(to, rewardAmount, "Badge Achievement");
            }
        }
        
        emit BadgeMinted(to, tokenId, level, badgeType);
        return tokenId;
    }
    
    /**
     * @dev Mint badge only (no reward distribution) - for legacy compatibility
     */
    function mintBadge(
        address to,
        BadgeLevel level,
        BadgeType badgeType,
        uint256 quizCount,
        uint256 score,
        string memory metadata
    ) external nonReentrant returns (uint256) {
        return mintBadgeWithReward(to, level, badgeType, quizCount, score, metadata, 0);
    }
    
    /**
     * @dev Distribute rewards without minting badge (for quiz completion rewards)
     */
    function distributeQuizReward(
        address to,
        BadgeLevel level,
        uint256 baseScore,
        bool isPerfectScore,
        uint256 streakCount,
        bool isLevelCompletion
    ) external nonReentrant {
        require(authorizedMinters[msg.sender], "Not authorized to distribute rewards");
        require(to != address(0), "Cannot reward zero address");
        require(address(rewardToken) != address(0), "Reward token not set");
        
        RewardConfig memory config = rewardConfigs[level];
        uint256 totalReward = config.quizCompletionReward;
        
        // Add perfect score bonus
        if (isPerfectScore) {
            totalReward += config.perfectScoreBonus;
        }
        
        // Add streak bonus
        if (streakCount >= 5) {
            uint256 streakBonus = (config.quizCompletionReward * config.streakMultiplier * streakCount) / 100;
            totalReward += streakBonus;
        }
        
        // Add level completion bonus
        if (isLevelCompletion) {
            totalReward += config.levelCompletionBonus;
        }
        
        // Transfer reward if contract has sufficient balance
        uint256 contractBalance = rewardToken.balanceOf(address(this));
        if (contractBalance >= totalReward && totalReward > 0) {
            rewardToken.transfer(to, totalReward);
            totalRewardsEarned[to] += totalReward;
            totalRewardsClaimed[to] += totalReward;
            emit RewardDistributed(to, totalReward, "Quiz Completion");
        }
    }
    
    /**
     * @dev Batch mint multiple badges (for efficiency)
     */
    function batchMintBadges(
        address[] calldata users,
        BadgeLevel[] calldata levels,
        BadgeType[] calldata badgeTypes,
        uint256[] calldata quizCounts,
        uint256[] calldata scores,
        string[] calldata metadatas
    ) external nonReentrant {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        require(
            users.length == levels.length && 
            levels.length == badgeTypes.length &&
            badgeTypes.length == quizCounts.length &&
            quizCounts.length == scores.length &&
            scores.length == metadatas.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < users.length; i++) {
            if (!userBadges[users[i]][levels[i]][badgeTypes[i]]) {
                mintBadge(users[i], levels[i], badgeTypes[i], quizCounts[i], scores[i], metadatas[i]);
            }
        }
    }
    
    /**
     * @dev Set badge IPFS CID from Pinata (owner only)
     * @param level Badge level (0-4)
     * @param badgeType Badge type (0-7)  
     * @param ipfsCID The IPFS CID hash from Pinata (without ipfs:// prefix)
     */
    function setBadgeIPFS(BadgeLevel level, BadgeType badgeType, string memory ipfsCID) external onlyOwner {
        require(bytes(ipfsCID).length > 0, "CID cannot be empty");
        badgeURIs[level][badgeType] = ipfsCID;
        emit BadgeURIUpdated(level, badgeType, ipfsCID);
    }
    
    /**
     * @dev Batch set multiple badge IPFS CIDs for efficiency
     */
    function setBatchBadgeIPFS(
        BadgeLevel[] calldata levels,
        BadgeType[] calldata badgeTypes,
        string[] calldata ipfsCIDs
    ) external onlyOwner {
        require(
            levels.length == badgeTypes.length && 
            badgeTypes.length == ipfsCIDs.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < levels.length; i++) {
            require(bytes(ipfsCIDs[i]).length > 0, "CID cannot be empty");
            badgeURIs[levels[i]][badgeTypes[i]] = ipfsCIDs[i];
            emit BadgeURIUpdated(levels[i], badgeTypes[i], ipfsCIDs[i]);
        }
    }
    
    /**
     * @dev Get IPFS CID for a specific badge
     */
    function getBadgeIPFS(BadgeLevel level, BadgeType badgeType) external view returns (string memory) {
        return badgeURIs[level][badgeType];
    }
    
    /**
     * @dev Get full IPFS URI for a specific badge
     */
    function getBadgeURI(BadgeLevel level, BadgeType badgeType) external view returns (string memory) {
        string memory ipfsCID = badgeURIs[level][badgeType];
        if (bytes(ipfsCID).length > 0) {
            return string(abi.encodePacked("ipfs://", ipfsCID));
        }
        return "";
    }
    
    /**
     * @dev Get all badges owned by user
     */
    function getUserBadges(address user) external view returns (uint256[] memory) {
        return userTokens[user];
    }
    
    /**
     * @dev Check if user has specific badge
     */
    function hasBadge(address user, BadgeLevel level, BadgeType badgeType) external view returns (bool) {
        return userBadges[user][level][badgeType];
    }
    
    /**
     * @dev Get badge details by token ID
     */
    function getBadgeDetails(uint256 tokenId) external view returns (Badge memory) {
        require(_exists(tokenId), "Badge does not exist");
        return badges[tokenId];
    }
    
    /**
     * @dev Get user's badge count by level
     */
    function getUserBadgeCount(address user, BadgeLevel level) external view returns (uint256 count) {
        for (uint256 i = 0; i < 8; i++) { // 8 badge types
            if (userBadges[user][level][BadgeType(i)]) {
                count++;
            }
        }
    }
    
    /**
     * @dev Get user's total earned and claimed rewards
     */
    function getUserRewardInfo(address user) external view returns (uint256 earned, uint256 claimed) {
        return (totalRewardsEarned[user], totalRewardsClaimed[user]);
    }
    
    /**
     * @dev Get reward configuration for a level
     */
    function getRewardConfig(BadgeLevel level) external view returns (RewardConfig memory) {
        return rewardConfigs[level];
    }
    
    /**
     * @dev Emergency reward withdrawal (owner only)
     */
    function withdrawRewards(uint256 amount) external onlyOwner {
        require(address(rewardToken) != address(0), "Reward token not set");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 contractBalance = rewardToken.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient contract balance");
        
        rewardToken.transfer(owner(), amount);
        emit FundsWithdrawn(owner(), amount);
    }
    
    /**
     * @dev Emergency withdrawal of all rewards (owner only)
     */
    function withdrawAllRewards() external onlyOwner {
        require(address(rewardToken) != address(0), "Reward token not set");
        
        uint256 contractBalance = rewardToken.balanceOf(address(this));
        require(contractBalance > 0, "No rewards to withdraw");
        
        rewardToken.transfer(owner(), contractBalance);
        emit FundsWithdrawn(owner(), contractBalance);
    }
    
    /**
     * @dev Emergency ETH withdrawal (owner only)
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner()).transfer(balance);
    }
    
    // Override required functions
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}