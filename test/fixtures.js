const { ethers } = require('hardhat');
// const ethers = require('ethers');
const C = require('./constants');

module.exports = async (tokenDecimals) => {
    const [dao, a, b, c, d, e] = await ethers.getSigners();
    const Lockup = await ethers.getContractFactory('VotingTokenLockupPlans');
    const Vesting = await ethers.getContractFactory('VotingTokenVestingPlans');
    const Token = await ethers.getContractFactory('Token');
    const NVToken = await ethers.getContractFactory('NonVotingToken');
    const ClaimContract = await ethers.getContractFactory('DelegatedClaimCampaigns');
    const lockup = await Lockup.deploy('TimeLock', 'TL');
    await lockup.waitForDeployment();
    const vesting = await Vesting.deploy('TimeVest', 'TV');
    await vesting.waitForDeployment();
    let supply = BigInt(10 ** tokenDecimals) * BigInt(1000000);
    const token = await Token.deploy('Token', 'TKN', supply, tokenDecimals);
    await token.waitForDeployment();
    const nvToken = await NVToken.deploy('NonVotingToken', 'NVT', BigInt(10 ** 18) * BigInt(1000000));
    await nvToken.waitForDeployment();
    const claimName = 'DelegatedClaimCampaigns'
    const version = '1';
    const claimContract = await ClaimContract.deploy(claimName, version);
    await claimContract.waitForDeployment();
    await token.approve(claimContract.target, supply);
    const tokenDomain = {
        name: 'Token',
        version,
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: token.target,
    }
    const claimDomain = {
        name: claimName,
        version,
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: claimContract.target,
    }
    return {
        dao,
        a,
        b,
        c,
        d,
        e,
        lockup,
        vesting,
        token,
        nvToken,
        claimContract,
        tokenDomain,
        claimDomain,
    }
}