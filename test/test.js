const C = require('./constants');
const { unlockedTests } = require('./tests/unlockedClaimsTests');

describe('Testing the unlocked tests', () => {
    let params = {
        fee: 100,
        totalRecipients: 10,
        nodeA: 1,
        nodeB: 2,
        nodeC: 3,
        nodeD: 4,
        nodeE: 5,
    }
    unlockedTests(params)
})