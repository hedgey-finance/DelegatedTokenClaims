const { ethers, run } = require('hardhat');
const { setTimeout } = require('timers/promises');

async function deploy(lockers) {
    const Claims = await ethers.getContractFactory('DelegatedClaimCampaigns');
    // const claims = await (await Claims.deploy('ClaimCampaigns', '1', lockers)).waitForDeployment();
    const claims = Claims.attach('0x64B8DB3c83E82F77Eb4514d7cB397e0872F33442')
    console.log('Claims deployed to:', claims.target);
    // await setTimeout(5000);
    await run('verify:verify', {
        address: claims.target,
        constructorArguments: ['ClaimCampaigns', '1', lockers],
    });
}

const vesting = '0x68b6986416c7A38F630cBc644a2833A0b78b3631';
const votingVesting = '0x8345Cfc7eB639a9178FA9e5FfdeBB62CCF5846A3';
const tokenLockup = '0xb49d0cd3d5290adb4af1eba7a6b90cde8b9265ff';
const votingLockup = '0xB82b292C9e33154636fe8839fDb6d4081Da5c359';

const lockers = [vesting, votingVesting, tokenLockup, votingLockup];
deploy(lockers);