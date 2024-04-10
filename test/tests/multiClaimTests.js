const C = require('../constants');
const { getSignature } = require('../helpers');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');

const multiClaimTests = (params) => {
  let deployed, dao, a, b, c, d, e, token, claimContract, lockup, vesting, claimDomain;
  let start, cliff, period, periods, end;
  let amount,
    root,
    campaign,
    claimLockup,
    claimA,
    claimB,
    claimC,
    claimD,
    claimE,
    firstId,
    secondId,
    thirdId,
    fourthId,
    uuid;
  it('DAO creates two campaigns, one unlocked and one locked and single claimer is able to claim from both', async () => {
    deployed = await setup(params.decimals);
    dao = deployed.dao;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    e = deployed.e;
    token = deployed.token;
    claimContract = deployed.claimContract;
    lockup = deployed.lockup;
    vesting = deployed.vesting;
    claimDomain = deployed.claimDomain;
    await token.approve(claimContract.target, BigInt(10 ** params.decimals) * BigInt(1000000));
    let treevalues = [];
    amount = BigInt(0);
    uuid = uuidv4();
    firstId = uuidParse(uuid);
    for (let i = 0; i < params.totalRecipients; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 10, params.decimals);
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
    root = createTree(treevalues, ['address', 'uint256']);
    let now = BigInt(await time.latest());
    start = now;
    end = BigInt(60 * 60 * 24 * 7) + now;
    campaign = {
      manager: dao.address,
      token: token.target,
      amount,
      start,
      end,
      tokenLockup: 0,
      root,
      delegating: false,
    };
    await claimContract.createUnlockedCampaign(firstId, campaign, BigInt(treevalues.length));
    claimLockup = {
      tokenLocker: lockup.target,
      start: now,
      cliff: now,
      period: BigInt(1),
      periods: BigInt(1000),
    };
    campaign.tokenLockup = 1;
    uuid = uuidv4();
    secondId = uuidParse(uuid);
    await claimContract.createLockedCampaign(secondId, campaign, claimLockup, dao.address, BigInt(treevalues.length));
    let proof = getProof('./test/trees/tree.json', a.address);
    let tx = await claimContract.connect(a).claimMultiple([firstId, secondId], [proof, proof], [claimA, claimA]);
    expect(tx)
      .to.emit(claimContract, 'UnlockedTokensClaimed')
      .withArgs(firstId, a.address, claimA, amount - claimA);
    expect(tx)
      .to.emit(claimContract, 'LockedTokensClaimed')
      .withArgs(secondId, a.address, claimA, amount - claimA);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, a.address, claimA);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, lockup.target, claimA);
    expect(tx).to.emit(lockup, 'PlanCreated');
    expect(await token.balanceOf(a.address)).to.equal(claimA);
    expect(await token.balanceOf(lockup.target)).to.equal(claimA);
    expect(await token.balanceOf(claimContract.target)).to.equal((amount - claimA) * BigInt(2));
    expect(await lockup.ownerOf('1')).to.eq(a.address);
  });
  it('DAO creates another unlocked campaign, and user b is able to claim two unlocked campaigns', async () => {
    campaign.tokenLockup = 0;
    uuid = uuidv4();
    thirdId = uuidParse(uuid);
    await claimContract.createUnlockedCampaign(thirdId, campaign, BigInt(params.totalRecipients));
    let proof = getProof('./test/trees/tree.json', b.address);
    let tx = await claimContract.connect(b).claimMultiple([firstId, thirdId], [proof, proof], [claimB, claimB]);
  });
  it('DAO creates a vesting campaign and user is able to claim from three campaigns', async () => {
    claimLockup.tokenLocker = vesting.target;
    campaign.tokenLockup = 2;
    uuid = uuidv4();
    fourthId = uuidParse(uuid);
    await claimContract.createLockedCampaign(
      fourthId,
      campaign,
      claimLockup,
      dao.address,
      BigInt(params.totalRecipients)
    );
    let proof = getProof('./test/trees/tree.json', c.address);
    let tx = await claimContract
      .connect(c)
      .claimMultiple([firstId, thirdId, fourthId], [proof, proof, proof], [claimC, claimC, claimC]);
  });
  it('final user is able to claim from all 4 campaigns', async () => {
    let proof = getProof('./test/trees/tree.json', d.address);
    let tx = await claimContract
      .connect(d)
      .claimMultiple(
        [firstId, secondId, thirdId, fourthId],
        [proof, proof, proof, proof],
        [claimD, claimD, claimD, claimD]
      );
    let proofA = getProof('./test/trees/tree.json', a.address);
    await expect(
      claimContract.connect(a).claimMultiple([firstId, thirdId], [proofA, proofA], [claimA, claimA])
    ).to.be.revertedWith('already claimed');
    await expect(
      claimContract.connect(a).claimMultiple([secondId, thirdId], [proofA, proofA], [claimA, claimA])
    ).to.be.revertedWith('already claimed');
    await claimContract.connect(a).claimMultiple([thirdId, fourthId], [proofA, proofA], [claimA, claimA]);
  });
  it('user e is able to claim from all 4 campaigns with signature', async () => {
    let proof = getProof('./test/trees/tree.json', e.address);
    let nonce = await claimContract.nonces(e.address);
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let signatureValues = {
      campaignId: firstId,
      claimer: e.address,
      claimAmount: claimE,
      nonce,
      expiry,
      numberOfClaims: 4,
    };
    let claimSignature = await getSignature(e, claimDomain, C.multiClaimType, signatureValues);
    let claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    let tx = await claimContract
      .connect(a)
      .claimMultipleWithSig(
        [firstId, secondId, thirdId, fourthId],
        [proof, proof, proof, proof],
        e.address,
        [claimE, claimE, claimE, claimE],
        claimSig
      );
    nonce = await claimContract.nonces(e.address);
    signatureValues.nonce = nonce;
    claimSignature = await getSignature(e, claimDomain, C.multiClaimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(
      claimContract
        .connect(a)
        .claimMultipleWithSig(
          [firstId, secondId, thirdId, fourthId],
          [proof, proof, proof, proof],
          e.address,
          [claimE, claimE, claimE, claimE],
          claimSig
        )
    ).to.be.revertedWith('already claimed');
    nonce = await claimContract.nonces(e.address);
    signatureValues.nonce = nonce;
    signatureValues.numberOfClaims = 3;
    claimSignature = await getSignature(e, claimDomain, C.multiClaimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(
      claimContract
        .connect(a)
        .claimMultipleWithSig(
          [firstId, secondId, thirdId],
          [proof, proof, proof],
          e.address,
          [claimE, claimE, claimE],
          claimSig
        )
    ).to.be.revertedWith('already claimed');
    nonce = await claimContract.nonces(e.address);
    signatureValues.nonce = nonce;
    signatureValues.numberOfClaims = 2;
    claimSignature = await getSignature(e, claimDomain, C.multiClaimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(
      claimContract
        .connect(a)
        .claimMultipleWithSig([firstId, secondId], [proof, proof], e.address, [claimE, claimE], claimSig)
    ).to.be.revertedWith('already claimed');
    nonce = await claimContract.nonces(e.address);
    signatureValues.nonce = nonce;
    signatureValues.numberOfClaims = 1;
    claimSignature = await getSignature(e, claimDomain, C.multiClaimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(
      claimContract.connect(a).claimMultipleWithSig([firstId], [proof], e.address, [claimE], claimSig)
    ).to.be.revertedWith('already claimed');
    nonce = await claimContract.nonces(e.address);
    signatureValues.nonce = nonce;
    signatureValues.numberOfClaims = 2;
    claimSignature = await getSignature(e, claimDomain, C.multiClaimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(
      claimContract
        .connect(a)
        .claimMultipleWithSig([thirdId, secondId], [proof, proof], e.address, [claimE, claimE], claimSig)
    ).to.be.revertedWith('invalid claim signature');
  });
};

module.exports = {
  multiClaimTests,
};
