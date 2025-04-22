import { ethers } from "hardhat";
import { MOREToken } from "../typechain-types";
import chalk from "chalk";
import clear from "clear";
import figlet from "figlet";

interface ContractState {
  isPaused: boolean;
  isVestingActive: boolean;
  circulationEnabled: boolean;
  liquidityPool: string;
  remainingVested: string;
  lastUpdate: Date;
}

let previousState: ContractState | null = null;

function displayHeader() {
  clear();
  console.log(
    chalk.yellow(
      figlet.textSync("MOREToken Monitor", { horizontalLayout: "full" })
    )
  );
}

function displayState(state: ContractState) {
  console.log("\n" + chalk.bold("Contract Status") + "\n");
  
  // Contract Status
  console.log(
    chalk.bold("Status: ") +
    (state.isPaused ? chalk.red("PAUSED") : chalk.green("ACTIVE"))
  );
  
  // Vesting Status
  console.log(
    chalk.bold("Vesting: ") +
    (state.isVestingActive ? chalk.green("ACTIVE") : chalk.yellow("INACTIVE"))
  );
  
  // Circulation Status
  console.log(
    chalk.bold("Circulation: ") +
    (state.circulationEnabled ? chalk.green("ENABLED") : chalk.yellow("DISABLED"))
  );
  
  // Liquidity Pool
  console.log(
    chalk.bold("Liquidity Pool: ") +
    (state.liquidityPool === ethers.ZeroAddress ? 
      chalk.yellow("Not Set") : 
      chalk.blue(state.liquidityPool))
  );
  
  // Remaining Vested Amount
  console.log(
    chalk.bold("Remaining Vested: ") +
    chalk.cyan(state.remainingVested + " MORE")
  );
  
  // Last Update
  console.log(
    chalk.bold("\nLast Update: ") +
    chalk.gray(state.lastUpdate.toLocaleString())
  );
}

function displayChanges(current: ContractState, previous: ContractState) {
  console.log(chalk.bold("\nRecent Changes:"));
  
  if (current.isPaused !== previous.isPaused) {
    console.log(chalk.yellow("• Contract " + 
      (current.isPaused ? "PAUSED" : "UNPAUSED")));
  }
  
  if (current.isVestingActive !== previous.isVestingActive) {
    console.log(chalk.yellow("• Vesting status changed to " + 
      (current.isVestingActive ? "ACTIVE" : "INACTIVE")));
  }
  
  if (current.circulationEnabled !== previous.circulationEnabled) {
    console.log(chalk.yellow("• Circulation " + 
      (current.circulationEnabled ? "ENABLED" : "DISABLED")));
  }
  
  if (current.liquidityPool !== previous.liquidityPool) {
    console.log(chalk.yellow("• Liquidity pool updated to " + current.liquidityPool));
  }
  
  if (current.remainingVested !== previous.remainingVested) {
    console.log(chalk.yellow("• Remaining vested amount changed to " + 
      current.remainingVested + " MORE"));
  }
}

async function getContractState(contract: MOREToken): Promise<ContractState> {
  const [circulationEnabled, liquidityPool, ] = await contract.getCirculationStatus();
  
  return {
    isPaused: await contract.paused(),
    isVestingActive: await contract.isVestingActive(),
    circulationEnabled,
    liquidityPool,
    remainingVested: ethers.formatEther(await contract.remainingVestedAmount()),
    lastUpdate: new Date()
  };
}

async function monitorEvents(contract: MOREToken) {
  contract.on("EmergencyPaused", (pauser) => {
    console.log(chalk.red("\n🚨 EMERGENCY PAUSE by " + pauser));
  });

  contract.on("EmergencyUnpaused", (unpauser) => {
    console.log(chalk.green("\n✅ Contract UNPAUSED by " + unpauser));
  });

  contract.on("VestingDistribution", (recipient, amount) => {
    console.log(chalk.blue("\n📊 Vesting Distribution:"));
    console.log("Recipient:", recipient);
    console.log("Amount:", ethers.formatEther(amount), "MORE");
  });

  contract.on("Transfer", (from, to, amount) => {
    console.log(chalk.cyan("\n💸 Transfer:"));
    console.log("From:", from);
    console.log("To:", to);
    console.log("Amount:", ethers.formatEther(amount), "MORE");
  });
}

async function main() {
  // Get contract instance
  const moreToken = await ethers.getContractAt("MOREToken", process.env.TOKEN_ADDRESS || "");
  
  // Start event monitoring
  await monitorEvents(moreToken);
  
  // Update dashboard every 5 seconds
  setInterval(async () => {
    try {
      const currentState = await getContractState(moreToken);
      
      displayHeader();
      displayState(currentState);
      
      if (previousState) {
        displayChanges(currentState, previousState);
      }
      
      previousState = currentState;
      
    } catch (error) {
      console.error(chalk.red("\nError updating dashboard:"), error);
    }
  }, 5000);
  
  // Keep the process running
  process.stdin.resume();
}

// Run the dashboard
console.log(chalk.yellow("Starting MOREToken monitoring dashboard..."));
main().catch((error) => {
  console.error(chalk.red("Dashboard error:"), error);
  process.exitCode = 1;
}); 