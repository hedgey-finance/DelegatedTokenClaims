const C = require('./constants');
const { unlockedDelegatingTests, unlockedDelegatingErrorTests } = require('./tests/unlockedDelegatingTests');
const { lockedDelegatingTests, lockedDelegatingErrorTests } = require('./tests/lockedDelegatingTests');
const { vestingDelegatingTests, vestingDelegatingErrorTests } = require('./tests/vestingDelegatingTests');
const { unlockedTests, unlockedErrorTests } = require('./tests/unlockedClaimTests');
const { lockedTests, lockedErrorTests } = require('./tests/lockedClaimTests');
const { vestingTests, vestingErrorTests } = require('./tests/vestingClaimTest');
const { multiClaimTests } = require('./tests/multiClaimTests');
const flashAttackTests = require('./tests/flashAttackTests');


const paramsMatrix = [
  {
    decimals: 18,
    totalRecipients: 100,
    nodeA: 0,
    nodeB: 1,
    nodeC: 2,
    nodeD: 8,
    nodeE: 15,
  },
  {
    decimals: 6,
    totalRecipients: 100,
    nodeA: 0,
    nodeB: 1,
    nodeC: 2,
    nodeD: 8,
    nodeE: 10,
  }
];

const lockupParamsMatrix = [
  {
    start: 1,
    cliff: 0,
    period: 1,
    periods: (60 * 60 * 24 * 30),
  },
  {
    start: 1,
    cliff: 0,
    period: C.DAY,
    periods: (30),
  },
  {
    start: 0,
    cliff: 0,
    period: 1,
    periods: (60 * 60 * 24 * 30),
  },
  {
    start: 1,
    cliff: 0,
    period: C.MONTH,
    periods: (12),
  }
]

describe('Testing the unlocked tests with delegation', () => {
  paramsMatrix.forEach((params) => {
    unlockedDelegatingTests(params);
  });
    unlockedDelegatingErrorTests();
});

describe('Testing the locked tests with delegation', () => {
  paramsMatrix.forEach((params) => {
    lockupParamsMatrix.forEach((lockupParams) => {
      lockedDelegatingTests(params, lockupParams);
    });
  });
  lockedDelegatingErrorTests();
});

describe('Testing the vesting tests with delegation', () => {
  paramsMatrix.forEach((params) => {
    lockupParamsMatrix.forEach((lockupParams) => {
      vestingDelegatingTests(params, lockupParams);
    });
  });
  vestingDelegatingErrorTests();
});

describe('Testing the unlocked claim tests without delegation', () => {
  paramsMatrix.forEach((params) => {
    unlockedTests(params, true);
    unlockedTests(params, false);
  });
  unlockedErrorTests();
})

describe('Testing the locked claim tests without delegation', () => {
  paramsMatrix.forEach((params) => {
    lockupParamsMatrix.forEach((lockupParams) => {
      lockedTests(params, lockupParams, true);
      lockedTests(params, lockupParams, false);
    });
  });
  lockedErrorTests();
})

describe('Testing the vesting claim tests without delegation', () => {
  paramsMatrix.forEach((params) => {
    lockupParamsMatrix.forEach((lockupParams) => {
      vestingTests(params, lockupParams, true);
      vestingTests(params, lockupParams, false);
    });
  });
  vestingErrorTests();
})

describe('Testing the multi claim tests', () => {
  paramsMatrix.forEach((params) => {
    multiClaimTests(params);
  });
})

describe('Testing the flash loan attack vector', () => {
  flashAttackTests();
})