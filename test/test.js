const C = require('./constants');
const { unlockedDelegatingTests, unlockedDelegatingErrorTests } = require('./tests/unlockedDelegatingTests');
const { lockedDelegatingTests, lockedDelegatingErrorTests } = require('./tests/lockedDelegatingTests');
const { vestingDelegatingTests, vestingDelegatingErrorTests } = require('./tests/vestingDelegatingTests');


const paramsMatrix = [
  {
    decimals: 18,
    totalRecipients: 100,
    nodeA: 0,
    nodeB: 1,
    nodeC: 2,
    nodeD: 8,
    nodeE: 15,
  }
];

const lockupParamsMatrix = [
  {
    start: 1,
    cliff: 0,
    period: 1,
    periods: (60 * 60 * 24 * 30),
  }
]

// describe('Testing the unlocked tests', () => {
//   paramsMatrix.forEach((params) => {
//     unlockedDelegatingTests(params);
//   });
//     unlockedDelegatingErrorTests();
// });

// describe('Testing the locked tests', () => {
//   paramsMatrix.forEach((params) => {
//     lockupParamsMatrix.forEach((lockupParams) => {
//       lockedDelegatingTests(params, lockupParams);
//     });
//   });
//   lockedDelegatingErrorTests();
// });

describe('Testing the vesting tests', () => {
  // paramsMatrix.forEach((params) => {
  //   lockupParamsMatrix.forEach((lockupParams) => {
  //     vestingDelegatingTests(params, lockupParams);
  //   });
  // });
  vestingDelegatingErrorTests();
});
