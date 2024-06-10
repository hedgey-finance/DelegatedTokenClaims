const { ethers, run } = require('hardhat');
const { setTimeout } = require('timers/promises');

async function deploy(lockers) {
    const Claims = await ethers.getContractFactory('DelegatedClaimCampaigns');
    const claims = await (await Claims.deploy('ClaimCampaigns', '1', lockers)).waitForDeployment();
    // const claims = Claims.attach('0x64B8DB3c83E82F77Eb4514d7cB397e0872F33442')
    console.log('Claims deployed to:', claims.target);
    await setTimeout(15000);
    await run('verify:verify', {
        address: claims.target,
        constructorArguments: ['ClaimCampaigns', '1', lockers],
    });
}

const vesting = '0x2CDE9919e81b20B4B33DD562a48a84b54C48F00C';
const votingVesting = '0x1bb64AF7FE05fc69c740609267d2AbE3e119Ef82';
const tokenLockup = '0x1961A23409CA59EEDCA6a99c97E4087DaD752486';
const votingLockup = '0xA600EC7Db69DFCD21f19face5B209a55EAb7a7C0';
const boundTokenLockups = '0x06B6D0AbD9dfC7F04F478B089FD89d4107723264';
const boundVotingTokenLockups = '0x38E74A3DA3bd27dd581d5948ba19F0f684a5272f';

const lockers = [vesting, votingVesting, tokenLockup, votingLockup, boundTokenLockups, boundVotingTokenLockups];
deploy(lockers);