const C = require('../constants');
const { getSignature } = require('../helpers');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');

const unlockedDelegatingTests = (params) => {
  let deployed, dao, a, b, c, d, e, token, claimContract, tokenDomain, claimDomain;
  let amount, campaign, claimA, claimB, claimC, claimD, claimE, id;
  it(`DAO creates an unlocked claim campaign`, async () => {
    deployed = await setup(params.decimals);
    dao = deployed.dao;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    e = deployed.e;
    token = deployed.token;
    tokenDomain = deployed.tokenDomain;
    claimDomain = deployed.claimDomain;
    claimContract = deployed.claimContract;
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
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
    const root = createTree(treevalues, ['address', 'uint256']);
    let now = BigInt(await time.latest());
    let start = now;
    let end = BigInt(60 * 60 * 24 * 7) + now;
    campaign = {
      manager: dao.address,
      token: token.target,
      amount,
      start,
      end,
      tokenLockup: 0,
      root,
      delegating: true,
    };
    await expect(claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length))).to.emit(
      claimContract,
      'CampaignStarted'
    );
    expect(await token.balanceOf(claimContract.target)).to.eq(amount);
    expect(await claimContract.usedIds(id)).to.eq(true);
  });
  it('user A claims their own tokens from their own wallet and self delegates', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);

    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    const tx = await claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig);
    expect(await token.balanceOf(a.address)).to.eq(claimA);
    expect(await token.delegates(a.address)).to.eq(delegatee);
    expect(await claimContract.claimed(id, a.address)).to.eq(true);
  });
  it('user B claims their own tokens and delegates to user C', async () => {
    let proof = getProof('./test/trees/tree.json', b.address);
    let delegatee = c.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(b, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    const tx = await claimContract.connect(b).claimAndDelegate(id, proof, claimB, delegatee, delegationSig);
    expect(await token.balanceOf(b.address)).to.eq(claimB);
    expect(await token.delegates(b.address)).to.eq(delegatee);
  });
  it('dao claims tokens on behalf of user C and delegates to user D', async () => {
    let proof = getProof('./test/trees/tree.json', c.address);
    let delegatee = d.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(c, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    const txValues = {
      campaignId: id,
      claimer: c.address,
      claimAmount: claimC,
      delegatee,
      nonce,
      expiry,
    };
    const txSignature = await getSignature(c, claimDomain, C.delegatingClaimType, txValues);
    const txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await claimContract
      .connect(dao)
      .claimAndDelegateWithSig(id, proof, c.address, claimC, txSig, delegatee, delegationSig);
    expect(await token.balanceOf(c.address)).to.eq(claimC);
    expect(await token.delegates(c.address)).to.eq(delegatee);
  });
  it('dao claims on behalf of user D and delegates to D', async () => {
    let proof = getProof('./test/trees/tree.json', d.address);
    let delegatee = d.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(d, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    const txValues = {
      campaignId: id,
      claimer: d.address,
      claimAmount: claimD,
      delegatee,
      nonce,
      expiry,
    };
    const txSignature = await getSignature(d, claimDomain, C.delegatingClaimType, txValues);
    const txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await claimContract
      .connect(dao)
      .claimAndDelegateWithSig(id, proof, d.address, claimD, txSig, delegatee, delegationSig);
    expect(await token.balanceOf(d.address)).to.eq(claimD);
    expect(await token.delegates(d.address)).to.eq(delegatee);
    const nonces = await token.nonces(d.address);
    expect(nonces).to.eq(1);
    const txNonce = await claimContract.nonces(d.address);
    expect(txNonce).to.eq(1);
  });
  it('dao creates a new claim contract and then claims on behalf of users to check nonces', async () => {
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
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
    const root = createTree(treevalues, ['address', 'uint256']);
    let now = BigInt(await time.latest());
    let end = BigInt(60 * 60 * 24 * 7) + now;
    campaign = {
      manager: dao.address,
      token: token.target,
      amount,
      start: now,
      end,
      tokenLockup: 0,
      root,
      delegating: true,
    };
    await expect(claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length))).to.emit(
      claimContract,
      'CampaignStarted'
    );
    let proofA = getProof('./test/trees/tree.json', a.address);
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    const nonceA = await token.nonces(a.address);
    expect(nonceA).to.eq(1);
    const delegationValuesA = {
      delegatee: a.address,
      nonce: nonceA,
      expiry,
    };
    const delegationSignatureA = await getSignature(a, tokenDomain, C.delegationtype, delegationValuesA);
    const delegationSigA = {
      nonce: nonceA,
      expiry,
      v: delegationSignatureA.v,
      r: delegationSignatureA.r,
      s: delegationSignatureA.s,
    };
    const tx = await claimContract.connect(a).claimAndDelegate(id, proofA, claimA, a.address, delegationSigA);
    expect(tx).to.emit(claimContract, 'Claimed').withArgs(a.address, claimA);

    let proofB = getProof('./test/trees/tree.json', b.address);
    let nonceB = await token.nonces(b.address);
    let txNonceB = await claimContract.nonces(b.address);
    expect(nonceB).to.eq(1);
    expect(txNonceB).to.eq(0);
    let delegateeB = c.address;
    const delegationValuesB = {
      delegatee: delegateeB,
      nonce: nonceB,
      expiry,
    };
    const delegationSignatureB = await getSignature(b, tokenDomain, C.delegationtype, delegationValuesB);
    const delegationSigB = {
      nonce: nonceB,
      expiry,
      v: delegationSignatureB.v,
      r: delegationSignatureB.r,
      s: delegationSignatureB.s,
    };
    const txValuesB = {
      campaignId: id,
      claimer: b.address,
      claimAmount: claimB,
      delegatee: delegateeB,
      nonce: txNonceB,
      expiry,
    };
    const txSignatureB = await getSignature(b, claimDomain, C.delegatingClaimType, txValuesB);
    const txSigB = {
      nonce: txNonceB,
      expiry,
      v: txSignatureB.v,
      r: txSignatureB.r,
      s: txSignatureB.s,
    };
    const txB = await claimContract
      .connect(c)
      .claimAndDelegateWithSig(id, proofB, b.address, claimB, txSigB, delegateeB, delegationSigB);
    expect(txB).to.emit(claimContract, 'Claimed').withArgs(b.address, claimB);
    expect(await token.delegates(b.address)).to.eq(delegateeB);
    expect(await token.nonces(b.address)).to.eq(1);
    expect(await claimContract.nonces(b.address)).to.eq(1);
  });
  it('DAO cancels campgain and unclaimed tokens are returned', async () => {
    expect(await claimContract.usedIds(id)).to.eq(true);
    const remainder = (await claimContract.campaigns(id)).amount;
    const tx = await claimContract.connect(dao).cancelCampaigns([id]);
    expect(tx).to.emit(claimContract, 'CampaignCancelled').withArgs(id);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, dao.address, remainder);
  });
};

const unlockedDelegatingErrorTests = () => {
  let deployed, dao, a, b, c, d, e, token, claimContract, tokenDomain, claimDomain;
  let amount, campaign, claimA, claimB, claimC, claimD, claimE, id, firstId;
  it('Creation will fail if user does not have enough tokens or insufficient allowance to setup the claim', async () => {
    deployed = await setup(18);
    dao = deployed.dao;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    e = deployed.e;
    token = deployed.token;
    tokenDomain = deployed.tokenDomain;
    claimDomain = deployed.claimDomain;
    claimContract = deployed.claimContract;
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < 10; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 10, 18);
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
      } else if (i == 4) {
        wallet = e.address;
        claimE = amt;
      } else {
        wallet = ethers.Wallet.createRandom().address;
      }
      amount = amt + amount;
      treevalues.push([wallet, amt.toString()]);
    }
    const root = createTree(treevalues, ['address', 'uint256']);
    let now = BigInt(await time.latest());
    let end = BigInt(60 * 60 * 24 * 7) + now;
    campaign = {
      manager: e.address,
      token: token.target,
      amount,
      start: now,
      end,
      tokenLockup: 0,
      root,
      delegating: true,
    };
    await expect(claimContract.connect(e).createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('THL01');
    await token.connect(dao).approve(claimContract.target, 0);
    await expect(claimContract.connect(dao).createUnlockedCampaign(id, campaign, 0)).to.be.reverted;
    await token.connect(dao).approve(claimContract.target, C.E18_1000000);
    await claimContract.connect(dao).createUnlockedCampaign(id, campaign, 0);
    firstId = id;
  });
  it('Creation will fail if a claim ID is already in use or has been used', async () => {
    await expect(claimContract.connect(dao).createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('in use');
  });
  it('Creation will fail with a 0x0 token address', async () => {
    const uuid = uuidv4();
    id = uuidParse(uuid);
    campaign.token = C.ZERO_ADDRESS;
    await expect(claimContract.createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('0_address');
  });
  it('Creation will fail with a 0x0 manager address', async () => {
    campaign.token = token.target;
    campaign.manager = C.ZERO_ADDRESS;
    await expect(claimContract.createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('0_manager');
  });
  it('Creation will fail if amount is 0', async () => {
    campaign.manager = dao.address;
    campaign.amount = 0;
    await expect(claimContract.createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('0_amount');
  });
  it('Creation will fail if the end is in the past', async () => {
    let now = BigInt(await time.latest());
    campaign.amount = amount;
    campaign.end = now - BigInt(10);
    await expect(claimContract.createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('end error');
  });
  it('Creation will fail if the lockup type is not set to Unlocked', async () => {
    let now = BigInt(await time.latest());
    campaign.end = now + BigInt(60 * 60 * 24 * 7);
    campaign.tokenLockup = 1;
    await expect(claimContract.createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('locked');
    campaign.tokenLockup = 2;
    await expect(claimContract.createUnlockedCampaign(id, campaign, 0)).to.be.revertedWith('locked');
    campaign.tokenLockup = 0;
  });
  it('Not the manager cannot cancel a claim', async () => {
    await expect(claimContract.connect(a).cancelCampaigns([firstId])).to.be.revertedWith('!manager');
  });
  it('User cannot claim if the campaign has been cancelled', async () => {
    await claimContract.connect(e).cancelCampaigns([firstId]);
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(firstId, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('campaign ended');
  });
  it('User cannot claim tokens if the claim is ended', async () => {
    const uuid = uuidv4();
    id = uuidParse(uuid);
    campaign.manager = dao.address;
    campaign.amount = amount;
    campaign.end = BigInt(await time.latest()) + BigInt(2);
    await claimContract.connect(dao).createUnlockedCampaign(id, campaign, 0);
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('campaign ended');
  });
  it('User cannot claim a different amount than their allocation', async () => {
    const uuid = uuidv4();
    id = uuidParse(uuid);
    campaign.end = BigInt(await time.latest()) + BigInt(60 * 60 * 24);
    await claimContract.connect(dao).createUnlockedCampaign(id, campaign, 0);
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA + BigInt(1), delegatee, delegationSig)
    ).to.be.revertedWith('Invalid proof');
  });
  it('User cannot claim if they are not in the tree', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('Invalid proof');
  });
  it('User cannot claim tokens with the wrong proof', async () => {
    let proof = getProof('./test/trees/tree.json', b.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('Invalid proof');
  });
  it('User cannot claim tokens with wrong delegation signature', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    let delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    let delegationSignature = await getSignature(a, claimDomain, C.delegationtype, delegationValues);
    let delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('delegation failed');
    delegationSignature = await getSignature(b, tokenDomain, C.delegationtype, delegationValues);
    delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('delegation failed');
    delegationValues = {
      delegatee: b.address,
      nonce,
      expiry,
    };
    delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('delegation failed');
    delegationValues = {
      delegatee: delegatee,
      nonce,
      expiry,
    };
    delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, b.address, delegationSig)
    ).to.be.revertedWith('delegation failed');
    delegationValues = {
      delegatee,
      nonce: 1,
      expiry,
    };
    delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('delegation failed');
    expiry = BigInt(await time.latest()) - BigInt(1);
    delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)).to.be.reverted;
  });
  it('User cannot claim with a 0x0 delegatee address', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = C.ZERO_ADDRESS;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('0_delegatee');
  });
  it('User cannot claim twice for the same claim', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig);
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('already claimed');
  });
  it('DAO cannot claim on behalf of user with wrong signature transaction or values', async () => {
    let proof = getProof('./test/trees/tree.json', b.address);
    let delegatee = b.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    let txValues = {
      campaignId: id,
      claimer: b.address,
      claimAmount: claimB,
      delegatee,
      nonce,
      expiry,
    };
    let txSignature = await getSignature(a, claimDomain, C.delegatingClaimType, txValues);
    let txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    txValues.nonce = 1;
    txSignature = await getSignature(b, claimDomain, C.delegatingClaimType, txValues);
    txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    txValues.nonce = 0;
    txValues.expiry = 0;
    txSignature = await getSignature(b, claimDomain, C.delegatingClaimType, txValues);
    txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    txValues.expiry = expiry;
    txValues.campaignId = firstId;
    txSignature = await getSignature(b, claimDomain, C.delegatingClaimType, txValues);
    txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    txValues.campaignId = id;
    txValues.claimer = a.address;
    txSignature = await getSignature(b, claimDomain, C.delegatingClaimType, txValues);
    txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    txValues.claimer = b.address;
    txValues.claimAmount = claimB + BigInt(1);
    txSignature = await getSignature(b, claimDomain, C.delegatingClaimType, txValues);
    txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    txValues.claimAmount = claimB;
    txSignature = await getSignature(b, tokenDomain, C.delegatingClaimType, txValues);
    txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    txSignature = await getSignature(b, claimDomain, C.delegatingClaimType, txValues);
    txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(
      claimContract.connect(dao).claimAndDelegateWithSig(id, proof, c.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
    await expect(
      claimContract
        .connect(dao)
        .claimAndDelegateWithSig(id, proof, b.address, claimB + BigInt(1), txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
  });
  it('user cannot claim with the non delegating function for a delegating claim campaign', async () => {
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < 10; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 10, 18);
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
      } else if (i == 4) {
        wallet = e.address;
        claimE = amt;
      } else {
        wallet = ethers.Wallet.createRandom().address;
      }
      amount = amt + amount;
      treevalues.push([wallet, amt.toString()]);
    }
    const root = createTree(treevalues, ['address', 'uint256']);
    let now = BigInt(await time.latest());
    let end = BigInt(60 * 60 * 24 * 7) + now;
    campaign = {
      manager: e.address,
      token: token.target,
      amount,
      start: now,
      end,
      tokenLockup: 0,
      root,
      delegating: true,
    };
    await claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length));
    let proof = getProof('./test/trees/tree.json', a.address);
    await expect(claimContract.connect(a).claim(id, proof, claimA)).to.be.revertedWith('must delegate');
  });
  it('cannot claim before the start date', async () => {
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < 10; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 10, 18);
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
      } else if (i == 4) {
        wallet = e.address;
        claimE = amt;
      } else {
        wallet = ethers.Wallet.createRandom().address;
      }
      amount = amt + amount;
      treevalues.push([wallet, amt.toString()]);
    }
    const root = createTree(treevalues, ['address', 'uint256']);
    let now = BigInt(await time.latest());
    let end = BigInt(60 * 60 * 24 * 7) + now;
    campaign = {
      manager: e.address,
      token: token.target,
      amount,
      start: now + BigInt(100),
      end,
      tokenLockup: 0,
      root,
      delegating: true,
    };
    await claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length));
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const delegationValues = {
      delegatee,
      nonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig)
    ).to.be.revertedWith('!started');
  });
  it('will revert if creating a delegating campaign with a ERC20 that isnt ERC20Votes', async () => {
    let nvToken = deployed.nvToken;
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < 10; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 10, 18);
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
      } else if (i == 4) {
        wallet = e.address;
        claimE = amt;
      } else {
        wallet = ethers.Wallet.createRandom().address;
      }
      amount = amt + amount;
      treevalues.push([wallet, amt.toString()]);
    }
    await nvToken.approve(claimContract.target, C.E18_1000000);
    const root = createTree(treevalues, ['address', 'uint256']);
    let now = BigInt(await time.latest());
    let end = BigInt(60 * 60 * 24 * 7) + now;
    campaign = {
      manager: e.address,
      token: nvToken.target,
      amount,
      start: now + BigInt(100),
      end,
      tokenLockup: 0,
      root,
      delegating: true,
    };
    await expect(claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length))).to.be.reverted;
  });
  it('checks that if a claim is done on behalf of a user, that it cannot be done again on behalf of the same user with a different msg.sender', async () => {
    const uuid = uuidv4();
    id = uuidParse(uuid);
    campaign.manager = dao.address;
    campaign.token = token.target;
    campaign.start = BigInt(await time.latest());
    await claimContract.createUnlockedCampaign(id, campaign, 0);
    let proof = getProof('./test/trees/tree.json', a.address);
    let delegatee = a.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let signatureNonce = await claimContract.nonces(a.address);
    let delegationNonce = await token.nonces(a.address);
    const delegationValues = {
      delegatee,
      nonce: delegationNonce,
      expiry,
    };
    const delegationSignature = await getSignature(a, tokenDomain, C.delegationtype, delegationValues);
    const delegationSig = {
      nonce: delegationNonce,
      expiry,
      v: delegationSignature.v,
      r: delegationSignature.r,
      s: delegationSignature.s,
    };
    const txValues = {
      campaignId: id,
      claimer: a.address,
      claimAmount: claimA,
      delegatee,
      nonce: signatureNonce,
      expiry,
    };
    const txSignature = await getSignature(a, claimDomain, C.delegatingClaimType, txValues);
    const txSig = {
      nonce: signatureNonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await claimContract
      .connect(dao)
      .claimAndDelegateWithSig(id, proof, a.address, claimA, txSig, delegatee, delegationSig);
    expect(await claimContract.claimed(id, a.address)).to.eq(true);
    await expect(
      claimContract.connect(b).claimAndDelegateWithSig(id, proof, a.address, claimA, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('already claimed');
  })
};

module.exports = {
  unlockedDelegatingTests,
  unlockedDelegatingErrorTests,
};
