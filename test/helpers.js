const { ethers } = require('hardhat');


const getSignature = async (signer, domain, type, values) => {
    const signature = await signer.signTypedData(domain, type, values);
    return { v, r, s } =  ethers.Signature.from(signature);
}

module.exports = {
    getSignature,
}
