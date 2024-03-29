const { ethers, run } = require('hardhat');
const { setTimeout } = require('timers/promises');

async function deploy() {
    const Claims = await ethers.getContractFactory('DelegatedClaimCampaigns');
    const claims = await (await Claims.deploy('ClaimCampaigns', '1')).waitForDeployment();
    console.log('Claims deployed to:', claims.target);
    await setTimeout(5000);
    await run('verify:verify', {
        address: claims.target,
        constructorArguments: ['ClaimCampaigns', '1'],
    });
}

deploy();