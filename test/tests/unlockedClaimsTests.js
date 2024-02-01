const C = require('../constants');
const {getSignature} = require('../helpers');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');

const unlockedTests = (params) => {
  let deployed, dao, feeCollector, a, b, c, d, e, token, claimContract, tokenDomain, claimDomain;
  let amount, campaign, claimA, claimB, claimC, claimD, claimE, id;
  it(`DAO creates an unlocked claim campaign`, async () => {
    deployed = await setup(params.fee);
    dao = deployed.dao;
    feeCollector = deployed.feeCollector;
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
      let amt = C.randomBigNum(1000, 10);
      // let amt = BigInt(10 ** 18);
      if (i == params.nodeA) {
        wallet = a.address;
        claimA = amt.toString();
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
    let end = BigInt(60 *60 * 24* 7) + now;
    campaign = {
      manager: dao.address,
      token: token.target,
      amount,
      end,
      tokenLockup: 0,
      root,
    };
    const fee = (amount * BigInt(params.fee)) / BigInt(10000);
    await expect(claimContract.createUnlockedCampaign(id, campaign)).to.emit(claimContract, 'CampaignStarted');
    expect(await token.balanceOf(claimContract.target)).to.eq(amount);
    expect(await token.balanceOf(feeCollector.address)).to.eq(fee);
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
      s: delegationSignature.s
    }
    const tx = await claimContract.connect(a).claimAndDelegate(id, proof, claimA, delegatee, delegationSig);
    expect(await token.balanceOf(a.address)).to.eq(claimA);
    expect(await token.delegates(a.address)).to.eq(delegatee);
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
      s: delegationSignature.s
    }
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
      s: delegationSignature.s
    }
    const txValues = {
      campaignId: id,
      claimer: c.address,
      claimAmount: claimC,
      nonce,
      expiry,
    }
    const txSignature = await getSignature(c, claimDomain, C.claimType, txValues);
    const txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s
    }
    await claimContract.connect(dao).claimAndDelegateWithSig(id, proof, c.address, claimC, txSig, delegatee, delegationSig);
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
      s: delegationSignature.s
    }
    const txValues = {
      campaignId: id,
      claimer: d.address,
      claimAmount: claimD,
      nonce,
      expiry,
    }
    const txSignature = await getSignature(d, claimDomain, C.claimType, txValues);
    const txSig = {
      nonce,
      expiry,
      v: txSignature.v,
      r: txSignature.r,
      s: txSignature.s
    }
    await claimContract.connect(dao).claimAndDelegateWithSig(id, proof, d.address, claimD, txSig, delegatee, delegationSig);
    expect(await token.balanceOf(d.address)).to.eq(claimD);
    expect(await token.delegates(d.address)).to.eq(delegatee);
  });
  it('dao creates a new claim contract and then claims on behalf of users to check nonces', async () => {

  });
};


const unlockedErrorTests = () => {
}


module.exports = {
  unlockedTests,
  unlockedErrorTests,
};
