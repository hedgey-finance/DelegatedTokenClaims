const C = require('../constants');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');
const { BigNumber } = require('ethers');


const lockedTests = (params) => {
    let deployed, dao, feeCollector, a, b, c, d, e, token, claimContract, lockup, domain;
    let start, cliff, period, periods, end;
    let amount, campaign, claimA, claimB, claimC, claimD, claimE, id, types;
}

const lockedErrorTests = () => {

}

module.exports = {
    lockedTests,
    lockedErrorTests
}