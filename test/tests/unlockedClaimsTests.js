const C = require('../constants');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');
const { BigNumber, Wallet } = require('ethers');

const unlockedTests = (params) => {
  let deployed, dao, feeCollector, a, b, c, d, e, token, claimContract, domain;
  let amount, campaign, claimA, claimB, claimC, claimD, claimE, id, types;
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
    claimContract = deployed.claimContract;
    let values = [];
    amount = C.ZERO;
    const uuid = uuidv4();
    id = uuidParse(uuid);
    for (let i = 0; i < params.totalRecipients; i++) {
      let wallet;
      let amt = C.randomBigNum(1000, 10);
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
      } else {
        wallet = ethers.Wallet.createRandom().address;
      }
      amount = amt.add(amount);
      values.push([wallet, amt]);
    }
    const root = createTree(values, ['address', 'uint256']);
    let now = await time.latest();
    let end = C.MONTH.add(now);
    campaign = {
      manager: dao.address,
      token: token.address,
      amount,
      end,
      tokenLockup: 0,
      root,
    };
    types = {
      Delegation: [
        // { name: 'hash', type: 'bytes32' },
        { name: 'delegatee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    };
    const fee = amount.mul(params.fee).div(10000);
    expect(await claimContract.createUnlockedCampaign(id, campaign))
      .to.emit('CampaignStarted')
      .withArgs(id, campaign);
    expect(await token.balanceOf(claimContract.address)).to.equal(amount);
    expect(await token.balanceOf(feeCollector.address)).to.equal(fee);
  });
  it('user A claims their own tokens from their own wallet', async () => {
    let proof = getProof('./test/trees/tree.json', a.address);
    // let expiry = BigNumber.from(await time.latest()).add(C.DAY);
    let expiry = '1707536547';
    let hashString = ethers.utils.toUtf8Bytes("Delegation(address delegatee,uint256 nonce,uint256 expiry)");
    let hash = ethers.utils.keccak256(hashString);
    let values = {
      delegatee: a.address,
      nonce: 0,
      expiry: expiry,
    };
    const signature = await a._signTypedData(domain, types, values);
    let { v, r, s } = ethers.utils.splitSignature(signature);
    const recoveredAddress = ethers.utils.verifyTypedData(domain, types, values, { r, s, v });
    expect(recoveredAddress).to.equal(a.address);
    const tx = await claimContract
      .connect(a)
      .claimAndDelegate(id, proof, a.address, claimA, a.address, 0, expiry, v, r, s);
    expect(tx).to.emit('Claimed').withArgs(a.address, claimA);
    expect(await token.balanceOf(a.address)).to.eq(claimA);
    expect(await token.delegates(a.address)).to.eq(a.address);
  });
};

module.exports = {
  unlockedTests,
};
