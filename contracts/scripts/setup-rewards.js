const hre = require("hardhat");

async function main() {
  // Configuration - UPDATE THESE VALUES
  const BADGE_CONTRACT_ADDRESS = "YOUR_DEPLOYED_BADGE_CONTRACT_ADDRESS";
  const REWARD_TOKEN_ADDRESS = "YOUR_EXISTING_ERC20_TOKEN_ADDRESS";
  
  console.log("Setting up CryptoQuest Badge contract with existing ERC20 token...");
  console.log("Badge Contract:", BADGE_CONTRACT_ADDRESS);
  console.log("Reward Token:", REWARD_TOKEN_ADDRESS);

  // Get contract instance
  const CryptoQuestBadges = await hre.ethers.getContractFactory("CryptoQuestBadges");
  const badgeContract = CryptoQuestBadges.attach(BADGE_CONTRACT_ADDRESS);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Setup by:", deployer.address);

  try {
    // 1. Set the reward token
    console.log("\n1. Setting reward token...");
    const setTokenTx = await badgeContract.setRewardToken(REWARD_TOKEN_ADDRESS);
    await setTokenTx.wait();
    console.log("✅ Reward token set successfully");

    // 2. Get ERC20 token info
    const ERC20_ABI = [
      "function name() external view returns (string memory)",
      "function symbol() external view returns (string memory)",
      "function decimals() external view returns (uint8)",
      "function balanceOf(address owner) external view returns (uint256)"
    ];
    
    const rewardToken = new hre.ethers.Contract(REWARD_TOKEN_ADDRESS, ERC20_ABI, deployer);
    const tokenName = await rewardToken.name();
    const tokenSymbol = await rewardToken.symbol();
    const tokenDecimals = await rewardToken.decimals();
    const deployerBalance = await rewardToken.balanceOf(deployer.address);
    
    console.log(`\n📊 Token Information:`);
    console.log(`   Name: ${tokenName}`);
    console.log(`   Symbol: ${tokenSymbol}`);
    console.log(`   Decimals: ${tokenDecimals}`);
    console.log(`   Your Balance: ${hre.ethers.formatUnits(deployerBalance, tokenDecimals)} ${tokenSymbol}`);

    // 3. Check contract reward balance
    const contractRewardBalance = await badgeContract.getRewardBalance();
    console.log(`   Contract Balance: ${hre.ethers.formatUnits(contractRewardBalance, tokenDecimals)} ${tokenSymbol}`);

  } catch (error) {
    console.error("❌ Error during setup:", error.message);
  }

  console.log("\n=== SETUP COMPLETE ===");
  console.log("\n🔄 Next Steps:");
  console.log("1. Upload badge images to Pinata IPFS");
  console.log("2. Set badge IPFS CIDs using setBadgeIPFS()");
  console.log("3. Deposit reward tokens to contract for distribution");
  console.log("4. Update your backend .env file:");
  console.log(`   CONTRACT_ADDRESS=${BADGE_CONTRACT_ADDRESS}`);
  console.log(`   REWARD_TOKEN_ADDRESS=${REWARD_TOKEN_ADDRESS}`);

  console.log("\n📝 Sample IPFS Setup Commands:");
  console.log("// After uploading to Pinata, run:");
  console.log("await badgeContract.setBadgeIPFS(0, 0, 'QmYourIPFSHashForLevel1FirstQuiz');");
  console.log("await badgeContract.setBadgeIPFS(0, 4, 'QmYourIPFSHashForLevel1PerfectScore');");
  console.log("// Repeat for all badge types and levels");

  console.log("\n💰 Funding the Contract:");
  console.log("// Approve and deposit rewards (example for 10,000 tokens):");
  console.log(`// await rewardToken.approve('${BADGE_CONTRACT_ADDRESS}', ethers.parseUnits('10000', ${tokenDecimals}));`);
  console.log(`// await badgeContract.depositRewards(ethers.parseUnits('10000', ${tokenDecimals}));`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });