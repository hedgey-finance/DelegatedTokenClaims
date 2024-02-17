const C = require('./constants');
const { unlockedTests, unlockedErrorTests } = require('./tests/unlockedClaimsTests');
const { lockedTests, lockedErrorTests } = require('./tests/lockedClaimsTests');
const { vestingTests, vestingErrorTests } = require('./tests/vestingClaimsTests');

const paramsMatrix = [
  // {
  //   decimals: 1,
  //   totalRecipients: 10,
  //   nodeA: 0,
  //   nodeB: 1,
  //   nodeC: 2,
  //   nodeD: 3,
  //   nodeE: 4,
  // },
  // {
  //   decimals: 2,
  //   totalRecipients: 50,
  //   nodeA: 5,
  //   nodeB: 6,
  //   nodeC: 7,
  //   nodeD: 8,
  //   nodeE: 9,
  // },
  // {
  //   decimals: 3,
  //   totalRecipients: 100,
  //   nodeA: 10,
  //   nodeB: 11,
  //   nodeC: 12,
  //   nodeD: 13,
  //   nodeE: 14,
  // },
  // {
  //   decimals: 6,
  //   totalRecipients: 100,
  //   nodeA: 0,
  //   nodeB: 1,
  //   nodeC: 2,
  //   nodeD: 3,
  //   nodeE: 4,
  // },
  // {
  //   decimals: 10,
  //   totalRecipients: 100,
  //   nodeA: 0,
  //   nodeB: 1,
  //   nodeC: 2,
  //   nodeD: 3,
  //   nodeE: 4,
  // },
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
//     unlockedTests(params);
//   });
//     unlockedErrorTests();
// });

describe('Testing the locked tests', () => {
  paramsMatrix.forEach((params) => {
    lockupParamsMatrix.forEach((lockupParams) => {
      lockedTests(params, lockupParams);
    });
  });
//   lockedErrorTests();
});

describe('Testing the vesting tests', () => {
  paramsMatrix.forEach((params) => {
    lockupParamsMatrix.forEach((lockupParams) => {
      vestingTests(params, lockupParams);
    });
  });
  // vestingErrorTests();
});
