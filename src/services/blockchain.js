import { ethers } from 'ethers';
import config from '../config/env.js';

// Initialize blockchain connection
let provider;
let signer;
let contract;

const BADGE_CONTRACT_ABI = [
  "function safeMint(address to, uint256 level) external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

export async function initializeBlockchain() {
  try {
    if (!config.PRIVATE_KEY || config.PRIVATE_KEY === 'your_private_key_here' || 
        !config.RPC_URL || !config.CONTRACT_ADDRESS || config.CONTRACT_ADDRESS === '0x1234567890123456789012345678901234567890') {
      console.warn('⚠️ Blockchain configuration incomplete. Badge minting will be disabled.');
      console.warn('   Please configure PRIVATE_KEY, RPC_URL, and CONTRACT_ADDRESS in .env file');
      return false;
    }

    provider = new ethers.JsonRpcProvider(config.RPC_URL);
    signer = new ethers.Wallet(config.PRIVATE_KEY, provider);
    contract = new ethers.Contract(config.CONTRACT_ADDRESS, BADGE_CONTRACT_ABI, signer);
    
    // Test connection
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(signer.address);
    
    console.log('✅ Blockchain initialized successfully');
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Signer: ${signer.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Contract: ${config.CONTRACT_ADDRESS}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize blockchain:', error);
    console.warn('⚠️ Continuing without blockchain features...');
    return false;
  }
}

export async function mintBadge(to, level) {
  try {
    if (!contract) {
      console.warn('⚠️ Blockchain not initialized. Cannot mint badge.');
      return {
        txHash: 'mock-tx-hash',
        blockNumber: 0,
        gasUsed: '0',
        level,
        to,
        mock: true
      };
    }

    // Convert level to number
    const levelMap = {
      'beginner': 1,
      'intermediate': 2,
      'advanced': 3,
      'expert': 4,
      'master': 5
    };

    const levelNumber = levelMap[level];
    if (!levelNumber) {
      throw new Error(`Invalid level: ${level}`);
    }

    console.log(`🎯 Minting ${level} badge (level ${levelNumber}) to ${to}...`);

    // Estimate gas
    const gasEstimate = await contract.safeMint.estimateGas(to, levelNumber);
    console.log(`Gas estimate: ${gasEstimate.toString()}`);

    // Execute transaction
    const tx = await contract.safeMint(to, levelNumber, {
      gasLimit: gasEstimate + BigInt(10000) // Add buffer
    });

    console.log(`📝 Transaction submitted: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Badge minted successfully!`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      level,
      to
    };
  } catch (error) {
    console.error(`❌ Mint failed:`, error);
    throw error;
  }
}

export async function getUserBadges(walletAddress) {
  try {
    if (!contract) {
      await initializeBlockchain();
    }

    const balance = await contract.balanceOf(walletAddress);
    const badges = [];

    for (let i = 0; i < balance; i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
        badges.push({
          tokenId: tokenId.toString(),
          level: mapTokenIdToLevel(tokenId)
        });
      } catch (error) {
        console.error(`Error getting token ${i}:`, error);
      }
    }

    return badges;
  } catch (error) {
    console.error('Error getting user badges:', error);
    return [];
  }
}

export async function getContractStats() {
  try {
    if (!contract) {
      await initializeBlockchain();
    }

    const totalSupply = await contract.totalSupply();
    
    return {
      totalBadgesMinted: totalSupply.toString(),
      contractAddress: config.CONTRACT_ADDRESS,
      network: await provider.getNetwork()
    };
  } catch (error) {
    console.error('Error getting contract stats:', error);
    throw error;
  }
}

export async function checkBalance() {
  try {
    if (!provider || !signer) {
      await initializeBlockchain();
    }

    const balance = await provider.getBalance(signer.address);
    return {
      address: signer.address,
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString()
    };
  } catch (error) {
    console.error('Error checking balance:', error);
    throw error;
  }
}

function mapTokenIdToLevel(tokenId) {
  const levelMap = {
    1: 'beginner',
    2: 'intermediate',
    3: 'advanced',
    4: 'expert',
    5: 'master'
  };

  return levelMap[Number(tokenId)] || 'unknown';
}

// Health check function
export async function healthCheck() {
  try {
    if (!provider) {
      await initializeBlockchain();
    }

    const network = await provider.getNetwork();
    const balance = await provider.getBalance(signer.address);
    const blockNumber = await provider.getBlockNumber();

    return {
      status: 'healthy',
      network: {
        name: network.name,
        chainId: Number(network.chainId)
      },
      signer: {
        address: signer.address,
        balance: ethers.formatEther(balance)
      },
      latestBlock: blockNumber,
      contract: config.CONTRACT_ADDRESS
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

export default {
  initializeBlockchain,
  mintBadge,
  getUserBadges,
  getContractStats,
  checkBalance,
  healthCheck
};