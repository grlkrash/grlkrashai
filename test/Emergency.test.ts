import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MOREToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MOREToken Emergency Procedures", function () {
  let moreToken: MOREToken;
  let authorizedDeployer: SignerWithAddress;
  let seedWallet: SignerWithAddress;
  let liquidityPool: SignerWithAddress;
  let attacker: SignerWithAddress;
  let users: SignerWithAddress[];

  beforeEach(async function () {
    [authorizedDeployer, seedWallet, liquidityPool, attacker, ...users] = await ethers.getSigners();
    
    const MOREToken = await ethers.getContractFactory("MOREToken");
    moreToken = await MOREToken.deploy();
    await moreToken.connect(authorizedDeployer).initialize();
  });

  describe("Emergency Pause Scenarios", function () {
    it("Should handle rapid pause/unpause sequences", async function () {
      // Test rapid pause/unpause to ensure no state corruption
      for (let i = 0; i < 5; i++) {
        await moreToken.connect(authorizedDeployer).pause();
        expect(await moreToken.paused()).to.be.true;
        
        await moreToken.connect(authorizedDeployer).unpause();
        expect(await moreToken.paused()).to.be.false;
      }
    });

    it("Should block all transfers during pause", async function () {
      // Setup: Enable circulation and distribute some tokens
      await moreToken.connect(authorizedDeployer).enableCirculation(liquidityPool.address);
      
      // Pause the contract
      await moreToken.connect(authorizedDeployer).pause();
      
      // Try various transfer scenarios
      await expect(
        moreToken.transfer(users[0].address, 100)
      ).to.be.revertedWith("Pausable: paused");
      
      await expect(
        moreToken.connect(liquidityPool).transfer(users[0].address, 100)
      ).to.be.revertedWith("Pausable: paused");
      
      await expect(
        moreToken.transferFrom(liquidityPool.address, users[0].address, 100)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should prevent vesting distributions during pause", async function () {
      await moreToken.connect(authorizedDeployer).pause();
      
      await expect(
        moreToken.distributeVestedTokens()
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should prevent circulation enabling during pause", async function () {
      await moreToken.connect(authorizedDeployer).pause();
      
      await expect(
        moreToken.connect(authorizedDeployer).enableCirculation(liquidityPool.address)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Emergency Access Control", function () {
    it("Should prevent unauthorized pause attempts", async function () {
      await expect(
        moreToken.connect(attacker).pause()
      ).to.be.revertedWith("Not authorized to deploy");
      
      await expect(
        moreToken.connect(users[0]).pause()
      ).to.be.revertedWith("Not authorized to deploy");
    });

    it("Should prevent unauthorized unpause attempts", async function () {
      await moreToken.connect(authorizedDeployer).pause();
      
      await expect(
        moreToken.connect(attacker).unpause()
      ).to.be.revertedWith("Not authorized to deploy");
      
      await expect(
        moreToken.connect(users[0]).unpause()
      ).to.be.revertedWith("Not authorized to deploy");
    });
  });

  describe("Emergency State Recovery", function () {
    it("Should maintain correct vesting state after pause/unpause", async function () {
      const initialVestingState = await moreToken.isVestingActive();
      const initialRemaining = await moreToken.remainingVestedAmount();
      
      await moreToken.connect(authorizedDeployer).pause();
      await moreToken.connect(authorizedDeployer).unpause();
      
      expect(await moreToken.isVestingActive()).to.equal(initialVestingState);
      expect(await moreToken.remainingVestedAmount()).to.equal(initialRemaining);
    });

    it("Should maintain circulation state after pause/unpause", async function () {
      await moreToken.connect(authorizedDeployer).enableCirculation(liquidityPool.address);
      
      const [initialEnabled, initialPool, initialSupply] = await moreToken.getCirculationStatus();
      
      await moreToken.connect(authorizedDeployer).pause();
      await moreToken.connect(authorizedDeployer).unpause();
      
      const [enabled, pool, supply] = await moreToken.getCirculationStatus();
      expect(enabled).to.equal(initialEnabled);
      expect(pool).to.equal(initialPool);
      expect(supply).to.equal(initialSupply);
    });

    it("Should handle emergency during vesting distribution", async function () {
      // Advance time to allow for vesting
      await time.increase(30 * 24 * 60 * 60); // 30 days
      
      // Start distribution and pause mid-way
      const distributeTx = moreToken.distributeVestedTokens();
      await moreToken.connect(authorizedDeployer).pause();
      
      // Verify distribution was either completed or reverted
      try {
        await distributeTx;
      } catch (error) {
        expect(error.message).to.include("Pausable: paused");
      }
      
      // Verify vesting state is consistent
      const remaining = await moreToken.remainingVestedAmount();
      expect(remaining).to.be.lte(await moreToken.SEED_ALLOCATION());
    });
  });

  describe("Emergency Event Monitoring", function () {
    it("Should emit correct events during emergency", async function () {
      await expect(moreToken.connect(authorizedDeployer).pause())
        .to.emit(moreToken, "EmergencyPaused")
        .withArgs(authorizedDeployer.address);
      
      await expect(moreToken.connect(authorizedDeployer).unpause())
        .to.emit(moreToken, "EmergencyUnpaused")
        .withArgs(authorizedDeployer.address);
    });

    it("Should track all blocked operations during pause", async function () {
      await moreToken.connect(authorizedDeployer).pause();
      
      const operations = [
        moreToken.distributeVestedTokens(),
        moreToken.transfer(users[0].address, 100),
        moreToken.connect(authorizedDeployer).enableCirculation(liquidityPool.address)
      ];
      
      for (const operation of operations) {
        await expect(operation).to.be.revertedWith("Pausable: paused");
      }
    });
  });
}); 