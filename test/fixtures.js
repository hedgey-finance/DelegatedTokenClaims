const { ethers } = require('hardhat');
// const ethers = require('ethers');
const C = require('./constants');

module.exports = async (fee, tokenDecimals) => {
    const [dao, feeCollector, a, b, c, d, e] = await ethers.getSigners();
    const Lockup = await ethers.getContractFactory('VotingTokenLockupPlans');
    const Vesting = await ethers.getContractFactory('VotingTokenVestingPlans');
    const Token = await ethers.getContractFactory('Token');
    const ClaimContract = await ethers.getContractFactory('DelegatedClaimCampaigns');
    const lockup = await Lockup.deploy('TimeLock', 'TL');
    await lockup.waitForDeployment();
    const vesting = await Vesting.deploy('TimeVest', 'TV');
    await vesting.waitForDeployment();
    let supply = BigInt(10 ** tokenDecimals) * BigInt(1000000);
    const token = await Token.deploy('Token', 'TKN', supply, tokenDecimals);
    await token.waitForDeployment();
    const claimContract = await ClaimContract.deploy(feeCollector.address, fee, lockup.target);
    await claimContract.waitForDeployment();
    await token.approve(claimContract.target, supply);
    const tokenDomain = {
        name: 'Token',
        version: '1',
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: token.target,
    }
    const claimDomain = {
        name: 'DelegatedClaimCampaigns',
        version: '1',
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: claimContract.target,
    }
    return {
        dao,
        feeCollector,
        a,
        b,
        c,
        d,
        e,
        lockup,
        vesting,
        token,
        claimContract,
        tokenDomain,
        claimDomain,
    }
}