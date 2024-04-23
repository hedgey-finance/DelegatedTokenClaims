const C = require('../constants');
const { getSignature } = require('../helpers');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');

const vestingTests = (params, lockupParams, delegating) => {
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
    lockup = deployed.vesting;
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
      tokenLockup: 2,
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
      dao.address,
      BigInt(treevalues.length)
    );
    expect(tx).to.emit(claimContract, 'ClaimLockupCreated').withArgs(id, claimLockup);
    expect(tx).to.emit(claimContract, 'CampaignCreated').withArgs(id, campaign, BigInt(treevalues.length));
    expect(tx).to.emit(token, 'Transfer').withArgs(dao.target, claimContract.target, amount);
    expect(tx).to.emit(token, 'Approval').withArgs(claimContract.target, lockup.target, amount);
  });
  it('wallet A claims tokens from the locked campaign', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    let expectedStart = lockupParams.start == 0 ? BigInt((await time.latest()) + 1) : start;
    let tx = await claimContract.connect(a).claim(id, proof, claimA);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, lockup.target, claimA);
    expect(await token.balanceOf(lockup.target)).to.eq(claimA);
    expect(await lockup.balanceOf(a.address)).to.eq(1);
    let lockDetails = await lockup.plans(1);
    expect(lockDetails.start).to.eq(expectedStart);
    expect(lockDetails.cliff).to.eq(cliff);
    expect(lockDetails.period).to.eq(period);
    expect(lockDetails.token).to.eq(token.target);
    expect(lockDetails.vestingAdmin).to.eq(dao.address);
    expect(await token.allowance(claimContract.target, lockup.target)).to.eq(0);
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
    expect(await token.allowance(claimContract.target, lockup.target)).to.eq(0);
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
    expect(await token.allowance(claimContract.target, lockup.target)).to.eq(0);
  });
  it('DAO creates another claim campaign with a future start date, and claimer can only claim after the start date', async () => {
    let now = BigInt(await time.latest());
    let start = now + BigInt(200);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    campaign.start = start;
    await claimContract.createLockedCampaign(id, campaign, claimLockup, dao.address, BigInt(10));
    let proof = getProof('./test/trees/tree.json', d.address);
    await expect(claimContract.connect(d).claim(id, proof, claimD)).to.be.revertedWith('!started');
    await time.increaseTo(start);
    let tx = await claimContract.connect(d).claim(id, proof, claimD);
    expect(await token.allowance(claimContract.target, lockup.target)).to.eq(0);
  });
  it('DAO cancels a claim and tokens are returned back to it, and no one can claim from it after', async () => {
    let campaignDetails = await claimContract.campaigns(id);
    let remainder = campaignDetails.amount;
    let tx = await claimContract.connect(dao).cancelCampaigns([id]);
    expect(tx).to.emit(token, 'Transfer').withArgs(claimContract.target, dao.target, remainder);
    let proof = getProof('./test/trees/tree.json', e.address);
    await expect(claimContract.connect(e).claim(id, proof, claimE)).to.be.revertedWith('campaign ended');
    expect(await token.allowance(claimContract.target, lockup.target)).to.eq(0);
  });
};

const vestingErrorTests = () => {
  let deployed, dao, a, b, c, d, e, token, claimContract, lockup, domain, vestingAdmin;
  let start, cliff, period, periods, end;
  let amount, root, campaign, claimLockup, claimA, claimB, claimC, claimD, claimE, id, firstId;
  it('Creation will fail if the user does not have enough tokens', async () => {
    deployed = await setup(18);
    dao = deployed.dao;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    e = deployed.e;
    vestingAdmin = dao.address;
    token = deployed.token;
    claimContract = deployed.claimContract;
    lockup = deployed.vesting;
    domain = deployed.claimDomain;
    let now = BigInt(await time.latest());
    start = now;
    cliff = start;
    period = 1;
    periods = BigInt(86400);
    end = start + periods;
    let treevalues = [];
    amount = BigInt(0);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < 10; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 100, 18);
      if (i == 0) {
        wallet = a.address;
        claimA = amt;
      } else if (i == 1) {
        wallet = b.address;
        claimB = amt;
      } else if (i == 2) {
        wallet = c.address;
        claimC = amt;
      } else {
        wallet = ethers.Wallet.createRandom().address;
      }
      amount = amt + amount;
      treevalues.push([wallet, amt.toString()]);
    }
    root = createTree(treevalues, ['address', 'uint256']);
    campaign = {
      manager: dao.address,
      token: token.target,
      amount,
      start: now,
      end: BigInt((await time.latest()) + 60 * 60),
      tokenLockup: 2,
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
    await token.connect(a).approve(claimContract.target, amount);
    await expect(
      claimContract.connect(a).createLockedCampaign(id, campaign, claimLockup, vestingAdmin, BigInt(treevalues.length))
    ).to.be.revertedWith('THL01');
    firstId = id;
  });
  it('create will revert if the user does not provide approval', async () => {
    await token.connect(dao).approve(claimContract.target, 0);
    await expect(claimContract.connect(dao).createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be
      .reverted;
  });
  it('create will revert if the claim id has already been used', async () => {
    await token.approve(claimContract.target, amount * BigInt(10000));
    await claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0);
    await expect(claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be.revertedWith(
      'in use'
    );
  });
  it('create will revert with a token address of 0x0', async () => {
    campaign.token = C.ZERO_ADDRESS;
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await expect(claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be.revertedWith(
      '0_address'
    );
  });
  it('create will revert when using a vesting admin of 0 address', async () => {
    campaign.token = token.target;
    vestingAdmin = C.ZERO_ADDRESS;
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await expect(claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be.revertedWith(
      '0_admin'
    );
  });
  it('create will revert with a 0x0 manager address', async () => {
    campaign.manager = C.ZERO_ADDRESS;
    campaign.token = token.target;
    await expect(claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be.revertedWith(
      '0_manager'
    );
  });
  it('create will fail if the amount is 0', async () => {
    campaign.manager = dao.address;
    campaign.amount = 0;
    await expect(claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be.revertedWith(
      '0_amount'
    );
  });
  it('create will fail if the end date is in the past', async () => {
    campaign.amount = amount;
    campaign.end = BigInt(await time.latest()) - BigInt(10);
    await expect(claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be.revertedWith(
      'end error'
    );
  });
  it('create will fail if the lockup type is set to unlocked', async () => {
    campaign.end = BigInt(await time.latest()) + BigInt(1000);
    campaign.tokenLockup = 0;
    await expect(claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0)).to.be.revertedWith(
      '!locked'
    );
  });
  it('will revert if a non-manager tries to cancel', async () => {
    campaign.tokenLockup = 1;
    await expect(claimContract.connect(a).cancelCampaigns([id])).to.be.revertedWith('!manager');
  });
  it('user cannot claim if the campaign has not started', async () => {
    campaign.start = BigInt(await time.latest()) + BigInt(1000);
    campaign.end = BigInt(await time.latest()) + BigInt(2000);
    campaign.tokenLockup = 1;
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0);
    let proof = getProof('./test/trees/tree.json', a.address);
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, a.address, delegationSig)
    ).to.be.revertedWith('!started');
    await expect(claimContract.connect(a).claim(id, proof, claimA)).to.be.revertedWith('!started');
  });
  it('user cannot claim if the campaign has ended', async () => {
    campaign.start = BigInt(await time.latest());
    campaign.end = BigInt(await time.latest()) + BigInt(10);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0);
    let proof = getProof('./test/trees/tree.json', a.address);
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await time.increase(11);
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, a.address, delegationSig)
    ).to.be.revertedWith('campaign ended');
    await expect(claimContract.connect(a).claim(id, proof, claimA)).to.be.revertedWith('campaign ended');
  });
  it('user cannot claim if the campaign has been cancelled', async () => {
    campaign.start = BigInt(await time.latest());
    campaign.end = BigInt(await time.latest()) + BigInt(10);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0);
    await claimContract.connect(dao).cancelCampaigns([id]);
    let proof = getProof('./test/trees/tree.json', a.address);
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA, a.address, delegationSig)
    ).to.be.revertedWith('campaign ended');
    await expect(claimContract.connect(a).claim(id, proof, claimA)).to.be.revertedWith('campaign ended');
  });
  it('user cannot claim if the amount provided in the function is wrong', async () => {
    campaign.start = BigInt(await time.latest());
    campaign.end = BigInt(await time.latest()) + BigInt(100);
    const uuid = uuidv4();
    id = uuidParse(uuid);
    await claimContract.createLockedCampaign(id, campaign, claimLockup, vestingAdmin, 0);
    let proof = getProof('./test/trees/tree.json', a.address);
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(id, proof, claimA + BigInt(1), a.address, delegationSig)
    ).to.be.revertedWith('Invalid proof');
    await expect(claimContract.connect(a).claim(id, proof, claimA + BigInt(1))).to.be.revertedWith('Invalid proof');
    proof = getProof('./test/trees/tree.json', b.address);
    await expect(claimContract.connect(a).claim(id, proof, claimA)).to.be.revertedWith('Invalid proof');
  });
  it('user cannot claim if they are not on the merkle tree', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await expect(
      claimContract.connect(e).claimAndDelegate(id, proof, claimA, a.address, delegationSig)
    ).to.be.revertedWith('Invalid proof');
    await expect(claimContract.connect(e).claim(id, proof, claimA)).to.be.revertedWith('Invalid proof');
  });
  it('user cannot claim from a different campaign id', async () => {
    const uuid = uuidv4();
    let fakeId = uuidParse(uuid);
    let proof = getProof('./test/trees/tree.json', a.address);
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await expect(
      claimContract.connect(a).claimAndDelegate(fakeId, proof, claimA, a.address, delegationSig)
    ).to.be.revertedWith('campaign ended');
    await expect(claimContract.connect(a).claim(fakeId, proof, claimA)).to.be.revertedWith('campaign ended');
  });
  it('user cannot claim if they have already claimed', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await claimContract.connect(a).claimAndDelegate(firstId, proof, claimA, a.address, delegationSig);
    await expect(
      claimContract.connect(a).claimAndDelegate(firstId, proof, claimA, a.address, delegationSig)
    ).to.be.revertedWith('already claimed');
    await expect(claimContract.connect(a).claim(firstId, proof, claimA)).to.be.revertedWith('already claimed');
    let txValues = {
      campaignId: firstId,
      claimer: a.address,
      claimAmount: claimA,
      nonce: await claimContract.nonces(a.address),
      expiry: BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7),
    };
    let txSignature = await getSignature(a, domain, C.claimType, txValues);
    let txSig = {
      nonce: txValues.nonce,
      expiry: txValues.expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    await expect(claimContract.connect(a).claimWithSig(firstId, proof, a.address, claimA, txSig)).to.be.revertedWith(
      'already claimed'
    );
    await expect(claimContract.connect(b).claimWithSig(firstId, proof, a.address, claimA, txSig)).to.be.revertedWith(
      'already claimed'
    );
    await expect(
      claimContract
        .connect(a)
        .claimAndDelegateWithSig(firstId, proof, a.address, claimA, txSig, a.address, delegationSig)
    ).to.be.revertedWith('already claimed');
    await expect(
      claimContract
        .connect(dao)
        .claimAndDelegateWithSig(firstId, proof, a.address, claimA, txSig, a.address, delegationSig)
    ).to.be.revertedWith('already claimed');
  });
  it('user cannot claim with the wrong claim signature when claiming on behalf', async () => {
    let proof = getProof('./test/trees/tree.json', b.address);
    let delegatee = c.address;
    let expiry = BigInt(await time.latest()) + BigInt(60 * 60 * 24 * 7);
    let nonce = 0;
    const txValues = {
      campaignId: firstId,
      claimer: c.address,
      claimAmount: claimB,
      nonce,
      expiry,
    };
    const txSignature = await getSignature(b, domain, C.claimType, txValues);
    const txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s,
    };
    const bytes = ethers.encodeBytes32String('blank');
    const delegationSig = {
      nonce: 0,
      expiry: 0,
      v: 0,
      r: bytes,
      s: bytes,
    };
    await expect(
      claimContract
        .connect(dao)
        .claimAndDelegateWithSig(firstId, proof, b.address, claimB, txSig, delegatee, delegationSig)
    ).to.be.revertedWith('invalid claim signature');
  });
};

module.exports = {
  vestingTests,
  vestingErrorTests,
};
