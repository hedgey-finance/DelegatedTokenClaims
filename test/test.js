const C = require('./constants');
const { unlockedTests, unlockedErrorTests } = require('./tests/unlockedClaimsTests');
const { lockedTests, lockedErrorTests } = require('./tests/lockedClaimsTests');
const { vestingTests, vestingErrorTests } = require('./tests/vestingClaimsTests');


const numRuns = 1;

describe('Testing the unlocked tests', () => {
  // paramsMatrix.forEach((params) => {
  //   unlockedTests(params);
  // });
  for (let i = 0; i < numRuns; i++) {
    let params = {
      fee: Math.random() * 1000,
      decimals: i + 5,
      totalRecipients: Math.max(Math.random() * 1000, 10),
      nodeA: 0,
      nodeB: 1,
      nodeC: 2,
      nodeD: 3,
      nodeE: 4,
    };
    unlockedTests(params);
  }
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
