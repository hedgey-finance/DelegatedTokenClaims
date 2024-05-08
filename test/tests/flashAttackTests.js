const C = require('../constants');
const { getSignature } = require('../helpers');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');

module.exports = () => {
  let deployed, dao, a, b, c, d, e, token, claimContract, lockup, domain;
  let start, cliff, period, periods, end;
  let amount, campaign, claimLockup, claimA, claimB, claimC, claimD, claimE, id;
  it('Deploys the contract and a real creator creates a normal claims campaign, whereupon the attacker tries to exploit the contract', async () => {
    deployed = await setup(18);
    dao = deployed.dao;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    e = deployed.e;
    token = deployed.token;
    claimContract = deployed.claimContract;
    lockup = deployed.lockup;
    domain = deployed.claimDomain;
    let now = BigInt(await time.latest());
    start = now;
    cliff = start;
    period = BigInt(1);
    periods = BigInt(365);
    end = start + periods;
    await token.approve(claimContract.target, BigInt(10 ** 18) * BigInt(1000000));
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < 10; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 100, 10);
      if (i == 0) {
        wallet = a.address;
        claimA = amt;
      } else if (i == 1) {
        wallet = b.address;
        claimB = amt;
      } else if (i == 2) {
        wallet = c.address;
        claimC = amt;
      } else if (i == 3) {
        wallet = d.address;
        claimD = amt;
      } else {
        wallet = ethers.Wallet.createRandom().address;
      }
      amount = amt + amount;
      treevalues.push([wallet, amt.toString()]);
    }
    remainder = amount;
    const root = createTree(treevalues, ['address', 'uint256']);
    campaign = {
      manager: dao.address,
      token: token.target,
      amount,
      start: now,
      end: BigInt((await time.latest()) + 60 * 60),
      tokenLockup: 1,
      root,
      delegating: false,
    };
    claimLockup = {
      tokenLocker: lockup.target,
      start,
      cliff,
      period,
      periods,
    };
    const tx = await claimContract.createLockedCampaign(
      id,
      campaign,
      claimLockup,
      C.ZERO_ADDRESS,
      BigInt(treevalues.length)
    );
    // use wallet E as attacker
    const FlashContract = await ethers.getContractFactory('FlashLoanAttack');
    const flash = await FlashContract.connect(e).deploy();
    await flash.waitForDeployment();
    await token.connect(e).mint(C.E18_1000000);
    await token.connect(e).transfer(flash.target, C.E18_1000000);
    let badId = uuidParse(uuidv4());
    let badCampaign = {
      manager: flash.target,
      token: token.target,
      amount: amount,
      start: now,
      end: BigInt((await time.latest()) + 60 * 60),
      tokenLockup: 0,
      root: root,
      delegating: false,
    };
    await expect(flash.connect(e).createUnlockedAndCancel(claimContract.target, badId, badCampaign)).to.be.revertedWith(
      'same block'
    );
    badCampaign.tokenLockup = 1;
    await expect(flash.connect(e).createLockedAndCancel(claimContract.target, badId, badCampaign)).to.be.revertedWith(
        'invalid locker'
      );
  });
};
