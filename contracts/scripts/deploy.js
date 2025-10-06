const hre = require("hardhat");

async function main() {
  console.log("Deploying CryptoQuest Badges contract...");

  // Get the contract factory
  const CryptoQuestBadges = await hre.ethers.getContractFactory("CryptoQuestBadges");

  // Deploy the contract
  const cryptoQuestBadges = await CryptoQuestBadges.deploy();

  await cryptoQuestBadges.waitForDeployment();

  const contractAddress = await cryptoQuestBadges.getAddress();
  console.log("CryptoQuestBadges deployed to:", contractAddress);

  // Get deployer address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployed by:", deployer.address);

  // Authorize the deployer as a minter (this will be your backend wallet)
  console.log("Authorizing deployer as minter...");
  const authTx = await cryptoQuestBadges.authorizeMinter(deployer.address);
  await authTx.wait();
  console.log("Deployer authorized as minter");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  
  console.log("\n=== NEXT STEPS ===");
  console.log("1. Add this to your .env file:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  
  console.log("\n2. Set your existing ERC20 reward token:");
  console.log(`   Run: cryptoQuestBadges.setRewardToken("YOUR_ERC20_TOKEN_ADDRESS")`);
  
  console.log("\n3. Upload badge images to Pinata and set IPFS CIDs:");
  console.log("   Use setBadgeIPFS() or setBatchBadgeIPFS() functions");
  
  console.log("\n4. Deposit reward tokens into the contract:");
  console.log("   Transfer your ERC20 tokens to the contract for distribution");
  
  console.log("\n5. Update reward configurations if needed:");
  console.log("   Use updateRewardConfig() to set reward amounts per level");

  // Verify on Etherscan if not local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await cryptoQuestBadges.deploymentTransaction().wait(5);
    
    try {
      console.log("Verifying contract on Etherscan...");
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("Contract verified!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });