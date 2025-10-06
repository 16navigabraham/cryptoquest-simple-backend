export const QUIZ_TOPICS = {
  beginner: [
    'solidity-basics',
    'smart-contracts',
    'blockchain-fundamentals'
  ],
  intermediate: [
    'solidity-basics',
    'smart-contracts',
    'defi',
    'security',
    'testing'
  ],
  advanced: [
    'defi',
    'security',
    'gas-optimization',
    'advanced-patterns',
    'testing',
    'oracles'
  ],
  expert: [
    'security',
    'gas-optimization',
    'advanced-patterns',
    'defi',
    'oracles',
    'layer2',
    'governance'
  ],
  master: [
    'advanced-patterns',
    'gas-optimization',
    'security',
    'protocol-design',
    'mev',
    'formal-verification',
    'cross-chain'
  ]
};

export const TOPIC_DESCRIPTIONS = {
  'solidity-basics': {
    title: 'Solidity Basics',
    description: 'Data types, variables, functions, modifiers, events',
    prerequisites: [],
    difficulty: 1
  },
  'smart-contracts': {
    title: 'Smart Contracts',
    description: 'Contract structure, inheritance, interfaces, libraries',
    prerequisites: ['solidity-basics'],
    difficulty: 2
  },
  'blockchain-fundamentals': {
    title: 'Blockchain Fundamentals',
    description: 'Blocks, transactions, consensus, mining, nodes',
    prerequisites: [],
    difficulty: 1
  },
  'defi': {
    title: 'Decentralized Finance (DeFi)',
    description: 'Tokens, DEXs, liquidity pools, yield farming, lending protocols',
    prerequisites: ['smart-contracts'],
    difficulty: 3
  },
  'security': {
    title: 'Smart Contract Security',
    description: 'Vulnerabilities, attack patterns, security best practices, auditing',
    prerequisites: ['smart-contracts'],
    difficulty: 4
  },
  'gas-optimization': {
    title: 'Gas Optimization',
    description: 'Gas costs, optimization techniques, storage patterns',
    prerequisites: ['smart-contracts'],
    difficulty: 4
  },
  'advanced-patterns': {
    title: 'Advanced Design Patterns',
    description: 'Proxy patterns, factory patterns, diamond pattern, upgradeable contracts',
    prerequisites: ['smart-contracts', 'security'],
    difficulty: 5
  },
  'testing': {
    title: 'Smart Contract Testing',
    description: 'Testing frameworks, test patterns, mock contracts, fuzzing',
    prerequisites: ['smart-contracts'],
    difficulty: 3
  },
  'oracles': {
    title: 'Oracles and External Data',
    description: 'Price feeds, oracle patterns, Chainlink integration, MEV',
    prerequisites: ['smart-contracts', 'defi'],
    difficulty: 4
  },
  'layer2': {
    title: 'Layer 2 Solutions',
    description: 'Rollups, sidechains, state channels, cross-chain bridges',
    prerequisites: ['blockchain-fundamentals', 'smart-contracts'],
    difficulty: 4
  },
  'governance': {
    title: 'DAO and Governance',
    description: 'Governance tokens, voting mechanisms, DAO patterns',
    prerequisites: ['smart-contracts', 'defi'],
    difficulty: 4
  },
  'protocol-design': {
    title: 'Protocol Design',
    description: 'Tokenomics, incentive mechanisms, protocol architecture',
    prerequisites: ['defi', 'security', 'advanced-patterns'],
    difficulty: 5
  },
  'mev': {
    title: 'MEV and Front-running',
    description: 'Maximal extractable value, sandwich attacks, flashloans',
    prerequisites: ['defi', 'security'],
    difficulty: 5
  },
  'formal-verification': {
    title: 'Formal Verification',
    description: 'Mathematical proofs, specification languages, verification tools',
    prerequisites: ['security', 'advanced-patterns'],
    difficulty: 5
  },
  'cross-chain': {
    title: 'Cross-chain Development',
    description: 'Bridges, multi-chain protocols, interoperability',
    prerequisites: ['layer2', 'advanced-patterns'],
    difficulty: 5
  }
};

export const LEVEL_REQUIREMENTS = {
  beginner: {
    minScore: 0,
    recommendedTopics: QUIZ_TOPICS.beginner,
    description: 'Learn the fundamentals of Solidity and blockchain development'
  },
  intermediate: {
    minScore: 250,
    recommendedTopics: QUIZ_TOPICS.intermediate,
    description: 'Build practical knowledge with DeFi and security concepts'
  },
  advanced: {
    minScore: 500,
    recommendedTopics: QUIZ_TOPICS.advanced,
    description: 'Master advanced patterns and optimization techniques'
  },
  expert: {
    minScore: 1000,
    recommendedTopics: QUIZ_TOPICS.expert,
    description: 'Develop expertise in protocol design and complex systems'
  },
  master: {
    minScore: 2000,
    recommendedTopics: QUIZ_TOPICS.master,
    description: 'Achieve mastery in cutting-edge blockchain technologies'
  }
};

export const getTopicsForLevel = (level) => {
  return QUIZ_TOPICS[level] || QUIZ_TOPICS.beginner;
};

export const getTopicInfo = (topicId) => {
  return TOPIC_DESCRIPTIONS[topicId] || null;
};

export const getNextLevel = (currentLevel) => {
  const levels = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
  const currentIndex = levels.indexOf(currentLevel);
  
  if (currentIndex === -1 || currentIndex === levels.length - 1) {
    return currentLevel; // Stay at current level if invalid or already at max
  }
  
  return levels[currentIndex + 1];
};

export const getLevelFromScore = (score) => {
  if (score >= 2000) return 'master';
  if (score >= 1000) return 'expert';
  if (score >= 500) return 'advanced';
  if (score >= 250) return 'intermediate';
  return 'beginner';
};

export const canAccessLevel = (userScore, targetLevel) => {
  const requirement = LEVEL_REQUIREMENTS[targetLevel];
  return userScore >= requirement.minScore;
};

export const getRecommendedTopics = (userLevel, completedTopics = []) => {
  const availableTopics = getTopicsForLevel(userLevel);
  const recommended = availableTopics.filter(topic => !completedTopics.includes(topic));
  
  // If all topics completed, suggest topics from next level
  if (recommended.length === 0) {
    const nextLevel = getNextLevel(userLevel);
    if (nextLevel !== userLevel) {
      return getTopicsForLevel(nextLevel).slice(0, 3); // First 3 topics of next level
    }
  }
  
  return recommended;
};