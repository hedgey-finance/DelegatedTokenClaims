const C = require('../constants');
const { getSignature } = require('../helpers');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');

const unlockedTests = (params, delegating) => {
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
    token = delegating ? deployed.token : deployed.nvToken;
    tokenDomain = deployed.tokenDomain;
    claimDomain = deployed.claimDomain;
    claimContract = deployed.claimContract;
    await token.approve(claimContract.target, BigInt(10 ** params.decimals) * BigInt(1000000));
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
      delegating: false,
    };
    await expect(claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length))).to.emit(
      claimContract,
      'CampaignStarted'
    );
    expect(await token.balanceOf(claimContract.target)).to.eq(amount);
    expect(await claimContract.usedIds(id)).to.eq(true);
  });
  it('wallt A claims from the contract', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let tx = await claimContract.connect(a).claim(id, proof, claimA);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, a.address, claimA);
    expect(tx)
      .to.emit(claimContract, 'UnlockedTokensClaimed')
      .withArgs(id, a.address, claimA, amount - claimA);
    expect(await token.balanceOf(a.address)).to.eq(claimA);
    expect(await token.balanceOf(claimContract.target)).to.eq(amount - claimA);
    expect(await claimContract.claimed(id, a.address)).to.eq(true);
  });
  it('wallet b claims from the contract, and if its delegating uses the delagating function', async () => {
    let proof = getProof('./test/trees/tree.json', b.address);
    let tx;
    if (delegating) {
      let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
      const nonce = await token.nonces(b.address);
      expect(nonce).to.eq(0);
      const delegationValues = {
        delegatee: b.address,
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
      tx = await claimContract.connect(b).claimAndDelegate(id, proof, claimB, b.address, delegationSig);
    } else {
      tx = await claimContract.connect(b).claim(id, proof, claimB);
    }
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, b.address, claimB);
    expect(tx)
      .to.emit(claimContract, 'UnlockedTokensClaimed')
      .withArgs(id, b.address, claimB, amount - claimB);
    expect(await token.balanceOf(b.address)).to.eq(claimB);
  });
  it('dao claims from the contract on behalf of wallet c', async () => {
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
    const claimSignature = await getSignature(c, claimDomain, C.claimType, signatureValues);
    const claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };

    let tx = await claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, c.address, claimC);
    expect(tx)
      .to.emit(claimContract, 'UnlockedTokensClaimed')
      .withArgs(id, c.address, claimC, amount - claimC);
    expect(await token.balanceOf(c.address)).to.eq(claimC);
    expect(await claimContract.claimed(id, c.address)).to.eq(true);
  });
  it('DAO creates another claim campaign with a future start date, and claimer can only claim after the start date', async () => {
    let now = BigInt(await time.latest());
    let start = now + BigInt(200);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    campaign.start = start;
    await claimContract.createUnlockedCampaign(id, campaign, BigInt(5));
    let proof = getProof('./test/trees/tree.json', d.address);
    await expect(claimContract.connect(d).claim(id, proof, claimD)).to.be.revertedWith('!started');
    await time.increaseTo(start);
    let tx = await claimContract.connect(d).claim(id, proof, claimD);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, d.address, claimD);
    expect(tx)
      .to.emit(claimContract, 'UnlockedTokensClaimed')
      .withArgs(id, d.address, claimD, amount - claimD);
  });
  it('DAO cancels a claim and tokens are returned back to it, and no one can claim from it after', async () => {
    let campaignDetails = await claimContract.campaigns(id);
    let tx = await claimContract.cancelCampaign(id);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, dao.address, campaignDetails.amount);
    let proof = getProof('./test/trees/tree.json', b.address);
    await expect(claimContract.connect(b).claim(id, proof, claimB)).to.be.revertedWith('campaign ended');
  });
};

const unlockedErrorTests = () => {
  let deployed, dao, a, b, c, d, e, token, nvToken, claimContract, tokenDomain, claimDomain;
  let amount, campaign, claimA, claimB, claimC, claimD, claimE, id;
  it('claim will revert if manager does not have sufficient balance or approval', async () => {
    deployed = await setup(18);
    dao = deployed.dao;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    e = deployed.e;
    token = deployed.token;
    nvToken = deployed.nvToken;
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
    let start = now;
    let end = now + BigInt(200);
    campaign = {
      manager: dao.address,
      token: nvToken.target,
      amount,
      start,
      end,
      tokenLockup: 0,
      root,
      delegating: false,
    };
    await expect(claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length))).to.be.reverted;
    await token.connect(a).approve(claimContract.target, BigInt(10 ** 18) * BigInt(1000000));
    await token.approve(claimContract.target, BigInt(10 ** 18) * BigInt(1000000));
    campaign.token = token.target;
    await expect(claimContract.connect(a).createUnlockedCampaign(id, campaign, BigInt(treevalues.length))).to.be
      .reverted;
    await claimContract.createUnlockedCampaign(id, campaign, BigInt(treevalues.length));
  });
  it('claim will revert if the claimer has already claimed by themselves', async () => {
    let proof = getProof('./test/trees/tree.json', b.address);
    await claimContract.connect(b).claim(id, proof, claimB);
    await expect(claimContract.connect(b).claim(id, proof, claimB)).to.be.revertedWith('already claimed');
  });
  it('claim will revert if the claimer has claimed using the signature on behalf of', async () => {
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
    const claimSignature = await getSignature(c, claimDomain, C.claimType, signatureValues);
    const claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig);
    await expect(claimContract.connect(c).claimWithSig(id, proof, c.address, claimC, claimSig)).to.be.revertedWith(
      'already claimed'
    );
    await expect(claimContract.connect(d).claimWithSig(id, proof, c.address, claimC, claimSig)).to.be.revertedWith(
      'already claimed'
    );
    await expect(claimContract.connect(c).claim(id, proof, claimC)).to.be.revertedWith('already claimed');
  });
  it('claim will revert if it has ended', async () => {
    await time.increase(200);
    let proof = getProof('./test/trees/tree.json', a.address);
    await expect(claimContract.connect(a).claim(id, proof, claimA)).to.be.revertedWith('campaign ended');
  });

  it('claim will revert if the proof provided is invalid', async () => {
    campaign.end = BigInt(await time.latest()) + BigInt(200);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await claimContract.createUnlockedCampaign(id, campaign, BigInt(5));
    let proof = getProof('./test/trees/tree.json', a.address);
    await expect(claimContract.connect(b).claim(id, proof, claimA)).to.be.revertedWith('Invalid proof');
    await expect(claimContract.connect(b).claim(id, proof, claimB)).to.be.revertedWith('Invalid proof');
    await expect(claimContract.connect(a).claim(id, proof, claimB)).to.be.revertedWith('Invalid proof');
  });
  it('claim will revert if the signature given for claimWithSig is invalid', async () => {
    let proof = getProof('./test/trees/tree.json', c.address);
    let nonce = await claimContract.nonces(c.address);
    nonce = nonce - BigInt(1);
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let signatureValues = {
      campaignId: id,
      claimer: c.address,
      claimAmount: claimC,
      nonce,
      expiry,
    };
    let claimSignature = await getSignature(c, claimDomain, C.claimType, signatureValues);
    let claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig)).to.be.reverted;
    nonce = await claimContract.nonces(c.address);
    signatureValues = {
      campaignId: id,
      claimer: b.address,
      claimAmount: claimC,
      nonce,
      expiry,
    };
    claimSignature = await getSignature(c, claimDomain, C.claimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig)).to.be.revertedWith(
      'invalid claim signature'
    );
    signatureValues = {
      campaignId: id,
      claimer: c.address,
      claimAmount: claimB,
      nonce,
      expiry,
    };
    claimSignature = await getSignature(c, claimDomain, C.claimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig)).to.be.revertedWith(
      'invalid claim signature'
    );
    signatureValues = {
      campaignId: id,
      claimer: c.address,
      claimAmount: claimC,
      nonce,
      expiry,
    };
    claimSignature = await getSignature(b, claimDomain, C.claimType, signatureValues);
    claimSig = {
      nonce,
      expiry,
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig)).to.be.revertedWith(
      'invalid claim signature'
    );
    signatureValues = {
      campaignId: id,
      claimer: c.address,
      claimAmount: claimC,
      nonce,
      expiry,
    };
    claimSignature = await getSignature(b, claimDomain, C.claimType, signatureValues);
    claimSig = {
      nonce,
      expiry: BigInt(0),
      v: claimSignature.v,
      r: claimSignature.r,
      s: claimSignature.s,
    };
    await expect(claimContract.connect(dao).claimWithSig(id, proof, c.address, claimC, claimSig)).to.be.revertedWith(
      'claim expired'
    );
  });
  it('cannot cancel the claim if it is not the manager', async () => {
    await expect(claimContract.connect(a).cancelCampaign(id)).to.be.revertedWith('!manager');
  });
  it('claim will revert using a non voting token and trying to claim from the claimAndDelegate function', async () => {
    campaign.token = nvToken.target;
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await nvToken.approve(claimContract.target, BigInt(10 ** 18) * BigInt(1000000));
    await claimContract.createUnlockedCampaign(id, campaign, BigInt(5));
    let proof = getProof('./test/trees/tree.json', b.address);
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    let delegatee = b.address;
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
    await expect(claimContract.connect(b).claimAndDelegate(id, proof, claimB, delegatee, delegationSig)).to.be.reverted;
  });
};

module.exports = {
  unlockedTests,
  unlockedErrorTests,
};
