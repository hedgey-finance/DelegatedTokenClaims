const { ethers } = require('hardhat');
const C = require('./constants');

module.exports = async (fee) => {
    const [dao, feeCollector, a, b, c, d, e] = await ethers.getSigners();
    const Lockup = await ethers.getContractFactory('VotingTokenLockupPlans');
    const Vesting = await ethers.getContractFactory('VotingTokenVestingPlans');
    const Token = await ethers.getContractFactory('Token');
    const ClaimContract = await ethers.getContractFactory('DelegatedClaimCampaigns');
    const lockup = await Lockup.deploy('TimeLock', 'TL');
    const vesting = await Vesting.deploy('TimeVest', 'TV');
    const token = await Token.deploy(C.E18_1000000.mul(1000000), 'Token', 'TKN');
    const claimContract = await ClaimContract.deploy(feeCollector.address, fee, lockup.address);
    await token.approve(claimContract.address, C.E18_1000000.mul(1000000));
    const domain = {
        name: 'Token',
        version: '1',
        chainId: await dao.getChainId(),
        verifyingContract: token.address,
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
        domain,
    }
}