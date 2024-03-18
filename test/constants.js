const { ethers } = require('hardhat');
const BigNumber = require('bignumber.js');

const bigMin = (a, b) => {
  a = BigInt(a);
  b = BigInt(b);
  if (a < b) return a;
  else return b;
};

const bigMax = (a, b) => {
  a = BigInt(a);
  b = BigInt(b);
  if (a > b) return a;
  else return b;
}

const randomBigNum = (max, min, decimals) => {
  let num = Math.round(Math.random() * max);
  num = BigInt(Math.max(num, min));
  num = BigInt(10 ** decimals) * num;
  return num;
};

const getVal = (amount) => {
  return ethers.utils.formatEther(amount);
};

const delegationtype = {
  Delegation: [
    { name: 'delegatee', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
};
const claimType = {
  Claim: [
    { name: 'campaignId', type: 'bytes16' },
    { name: 'claimer', type: 'address' },
    { name: 'claimAmount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
};

// const planEnd = (start, amount, rate, period) => {
//   const end =
//     BigNumber.from(amount).mod(rate) == 0
//       ? BigNumber.from(amount).div(rate).mul(period).add(start)
//       : BigNumber.from(amount).div(rate).mul(period).add(start).add(period);
//   return end;
// };

// const calcPlanRate = (amount, period, end, start, originalRate, planRate) => {
//   const numerator = BigNumber.from(period).mul(amount);
//   let rateModCheck = BigNumber.from(originalRate).sub(planRate);
//   let denominator = BigNumber.from(end).sub(start);
//   if (amount.mod(rateModCheck) != 0) {
//     denominator = denominator.sub(period);
//   }
//   return numerator.div(denominator);
// }

module.exports = {
  ZERO: BigInt(0),
  ONE: BigInt(1),
  E18_1: BigInt(10 ** 18), // 1e18
  E18_100: BigInt(10 ** 18) * BigInt(100), // 100e18
  E18_1000: BigInt(10 ** 18) * BigInt(1000), // 1000e18
  E18_10000: BigInt(10 ** 18) * BigInt(10000), // 1000e18
  E18_1000000: BigInt(10 ** 18) * BigInt(1000000), // 1000000e18
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  DAY: BigInt(60 * 60 * 24),
  WEEK: BigInt(60 * 60 * 24 * 7),
  MONTH: BigInt(2628000),
  bigMin,
  bigMax,
  randomBigNum,
  getVal,
  delegationtype,
  claimType,
};
