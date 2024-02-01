const C = require('./constants');
const { unlockedTests, unlockedErrorTests } = require('./tests/unlockedClaimsTests');
const { lockedTests, lockedErrorTests } = require('./tests/lockedClaimsTests');
const { vestingTests, vestingErrorTests } = require('./tests/vestingClaimsTests');

const paramsMatrix = [
  {
    fee: 100,
    totalRecipients: 10,
    nodeA: 0,
    nodeB: 1,
    nodeC: 2,
    nodeD: 3,
    nodeE: 4,
  },
//   {
//     fee: 700,
//     totalRecipients: 20,
//     nodeA: 1,
//     nodeB: 2,
//     nodeC: 3,
//     nodeD: 4,
//     nodeE: 5,
//   },
//   {
//     fee: 1000,
//     totalRecipients: 100,
//     nodeA: 1,
//     nodeB: 2,
//     nodeC: 3,
//     nodeD: 4,
//     nodeE: 5,
//   },
//   {
//     fee: 100,
//     totalRecipients: 5000,
//     nodeA: 1,
//     nodeB: 2,
//     nodeC: 3,
//     nodeD: 4,
//     nodeE: 5,
//   },
//   {
//     fee: 100,
//     totalRecipients: 330,
//     nodeA: 1,
//     nodeB: 2,
//     nodeC: 3,
//     nodeD: 4,
//     nodeE: 5,
//   },
];

describe('Testing the unlocked tests', () => {
  paramsMatrix.forEach((params) => {
    unlockedTests(params);
  });
//   unlockedErrorTests();
});

// describe('Testing the locked tests', () => {
//   paramsMatrix.forEach((params) => {
//     lockedTests(params);
//   });
//   lockedErrorTests();
// });

// describe('Testing the vesting tests', () => {
//   paramsMatrix.forEach((params) => {
//     vestingTests(params);
//   });
//   vestingErrorTests();
// });
