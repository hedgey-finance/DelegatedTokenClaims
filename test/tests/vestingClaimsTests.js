const C = require('../constants');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { createTree, getProof } = require('../merkleGenerator');
const { ethers } = require('hardhat');
const { v4: uuidv4, parse: uuidParse } = require('uuid');
const { BigNumber } = require('ethers');


const vestingTests = (params) => {

};


const vestingErrorTests = () => {

}

module.exports = {
    vestingTests,
    vestingErrorTests
}