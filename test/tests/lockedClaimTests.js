const C = require('../constants');
const { getSignature } = require('../helpers');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');

const lockedTests = (params, lockupParams, delegating) => {
  let deployed, dao, a, b, c, d, e, token, claimContract, lockup, domain;
  let start, cliff, period, periods, end;
  let amount, campaign, claimLockup, claimA, claimB, claimC, claimD, claimE, id;
  it('DAO creates a locked campaign without delegation required', async () => {
    deployed = await setup(params.decimals);
    dao = deployed.dao;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    e = deployed.e;
    token = delegating ? deployed.token : deployed.nvToken;
    claimContract = deployed.claimContract;
    lockup = deployed.lockup;
    domain = deployed.claimDomain;
    let now = BigInt(await time.latest());
    start = lockupParams.start == 0 ? BigInt(0) : BigInt(lockupParams.start) + now;
    cliff = BigInt(lockupParams.cliff) + start;
    period = lockupParams.period;
    periods = BigInt(lockupParams.periods);
    end = start + periods;
    await token.approve(claimContract.target, BigInt(10 ** params.decimals) * BigInt(1000000));
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < params.totalRecipients; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 100, params.decimals);
      if (i == params.nodeA) {
        wallet = a.address;
        claimA = amt;
      } else if (i == params.nodeB) {
        wallet = b.address;
        claimB = amt;
      } else if (i == params.nodeC) {
        wallet = c.address;
        claimC = amt;
      } else if (i == params.nodeD) {
        wallet = d.address;
        claimD = amt;
      } else if (i == params.nodeE) {
        wallet = e.address;
        claimE = amt;
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
    expect(tx).to.emit(claimContract, 'ClaimLockupCreated').withArgs(id, claimLockup);
    expect(tx).to.emit(claimContract, 'CampaignCreated').withArgs(id, campaign, BigInt(treevalues.length));
    expect(tx).to.emit(token, 'Transfer').withArgs(dao.target, claimContract.target, amount);
    expect(tx).to.emit(token, 'Approval').withArgs(claimContract.target, lockup.target, amount);
  });
  it('wallet A claims tokens from the locked campaign', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let tx = await claimContract.connect(a).claim(id, proof, claimA);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, lockup.target, claimA);
    expect(await token.balanceOf(lockup.target)).to.eq(claimA);
    expect(await lockup.balanceOf(a.address)).to.eq(1);
    let lockDetails = await lockup.plans(1);
    expect(lockDetails.start).to.eq(start);
    expect(lockDetails.cliff).to.eq(cliff);
    expect(lockDetails.period).to.eq(period);
    expect(lockDetails.token).to.eq(token.target);
  });
  it('wallet B claims tokens and delegates if the token is ERC20votes', async () => {
    let proof = getProof('./test/trees/tree.json', b.address);
    let tx;
    if (delegating) {
      const bytes = ethers.encodeBytes32String('blank');
      const delegationSig = {
        nonce: 0,
        expiry: 0,
        v: 0,
        r: bytes,
        s: bytes,
      };
      tx = await claimContract.connect(b).claimAndDelegate(id, proof, claimB, b.address, delegationSig);
    } else {
      tx = await claimContract.connect(b).claim(id, proof, claimB);
    }
  });
  it('dao claims on behalf of wallet c', async () => {
    let proof = getProof('./test/trees/tree.json', c.address);
    const nonce = 0;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    const signatureValues = {
      campaignId: id,
      claimer: c.address,
      claimAmount: claimC,
      nonce,
      expiry,
    };
    const claimSignature = await getSignature(c, domain, C.claimType, signatureValues);
    const claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    let tx = await claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig);
  });
  it('DAO creates another claim campaign with a future start date, and claimer can only claim after the start date', async () => {
    let now = BigInt(await time.latest());
    let start = now + BigInt(200);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    campaign.start = start;
    await claimContract.createLockedCampaign(id, campaign, claimLockup, C.ZERO_ADDRESS, BigInt(10));
    let proof = getProof('./test/trees/tree.json', d.address);
    await expect(claimContract.connect(d).claim(id, proof, claimD)).to.be.revertedWith('!started');
    await time.increaseTo(start);
    let tx = await claimContract.connect(d).claim(id, proof, claimD);
  });
};

const lockedErrorTests = () => {};

module.exports = {
  lockedTests,
  lockedErrorTests,
};
