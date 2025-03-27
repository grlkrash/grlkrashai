import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MOREToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MOREToken", function () {
  let moreToken: MOREToken;
  let owner: SignerWithAddress;
  let authorizedDeployer: SignerWithAddress;
  let seedWallet: SignerWithAddress;
  let liquidityPool: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  beforeEach(async function () {
    [owner, authorizedDeployer, seedWallet, liquidityPool, otherAccount] = await ethers.getSigners();
    
    const MOREToken = await ethers.getContractFactory("MOREToken");
    moreToken = await MOREToken.deploy();
  });

  describe("Deployment & Initialization", function () {
    it("Should set the correct token name and symbol", async function () {
      expect(await moreToken.name()).to.equal("MORE Token");
      expect(await moreToken.symbol()).to.equal("MORE");
    });

    it("Should prevent unauthorized initialization", async function () {
      await expect(moreToken.connect(otherAccount).initialize())
        .to.be.revertedWith("Not authorized to deploy");
    });

    it("Should prevent double initialization", async function () {
      await moreToken.connect(authorizedDeployer).initialize();
      await expect(moreToken.connect(authorizedDeployer).initialize())
        .to.be.revertedWith("Already initialized");
    });
  });

  describe("Vesting", function () {
    beforeEach(async function () {
      await moreToken.connect(authorizedDeployer).initialize();
    });

    it("Should distribute vested tokens correctly", async function () {
      const oneMonth = 30 * 24 * 60 * 60;
      await time.increase(oneMonth);
      
      await moreToken.distributeVestedTokens();
      const seedBalance = await moreToken.balanceOf(seedWallet.address);
      expect(seedBalance).to.be.gt(0);
    });

    it("Should not exceed seed allocation", async function () {
      const sevenMonths = 210 * 24 * 60 * 60;
      await time.increase(sevenMonths);
      
      await moreToken.distributeVestedTokens();
      const seedBalance = await moreToken.balanceOf(seedWallet.address);
      expect(seedBalance).to.equal(await moreToken.SEED_ALLOCATION());
    });

    it("Should prevent distribution after vesting period", async function () {
      const sevenMonths = 210 * 24 * 60 * 60;
      await time.increase(sevenMonths);
      
      await moreToken.distributeVestedTokens();
      await expect(moreToken.distributeVestedTokens())
        .to.be.revertedWith("Vesting period ended");
    });
  });

  describe("Circulation", function () {
    beforeEach(async function () {
      await moreToken.connect(authorizedDeployer).initialize();
    });

    it("Should prevent unauthorized circulation enabling", async function () {
      await expect(moreToken.connect(otherAccount).enableCirculation(liquidityPool.address))
        .to.be.revertedWith("Not authorized to deploy");
    });

    it("Should prevent setting zero address as liquidity pool", async function () {
      await expect(moreToken.connect(authorizedDeployer).enableCirculation(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid liquidity pool address");
    });

    it("Should enable circulation correctly", async function () {
      await moreToken.connect(authorizedDeployer).enableCirculation(liquidityPool.address);
      const [enabled, pool, amount] = await moreToken.getCirculationStatus();
      
      expect(enabled).to.be.true;
      expect(pool).to.equal(liquidityPool.address);
      expect(amount).to.equal(await moreToken.CIRCULATION_SUPPLY());
    });

    it("Should transfer circulation supply to liquidity pool", async function () {
      await moreToken.connect(authorizedDeployer).enableCirculation(liquidityPool.address);
      const lpBalance = await moreToken.balanceOf(liquidityPool.address);
      expect(lpBalance).to.equal(await moreToken.CIRCULATION_SUPPLY());
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await moreToken.connect(authorizedDeployer).initialize();
    });

    it("Should return correct remaining vested amount", async function () {
      const remaining = await moreToken.remainingVestedAmount();
      expect(remaining).to.equal(await moreToken.SEED_ALLOCATION());
    });

    it("Should correctly report vesting status", async function () {
      expect(await moreToken.isVestingActive()).to.be.true;
      
      const sevenMonths = 210 * 24 * 60 * 60;
      await time.increase(sevenMonths);
      await moreToken.distributeVestedTokens();
      
      expect(await moreToken.isVestingActive()).to.be.false;
    });
  });
}); 