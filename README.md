# Delegated Claim Campaigns

Delegated Claim Campaigns are a contract using merkle trees to create a efficient way to distribute token claims to any number of wallet addreses. The contract is optimized to not only give the ability for users to claim unlocked tokens, but also taps into the Hedgey Vesting and Hedgey Lockup contracts that bake in and automate vesting or token lockup schedules. The contract can be used to distribute tokens where users have to delegate tokens when they claim them, or optionally without delegating, but the creator can define if delegation is required. 

The intent is that for some DAOs, they require an initial amount of token delegations to meet quorum, and this contract is designed to help DAOs launching their token claims / airdrops where users have to delegate such that the quorum will always be met once users have claimed and delegated their tokens. 

## Testing

Clone repistory

``` bash
npm install
npx hardhat compile
npx hardhat test
```

## Deployment
To deploy the DelegatedClaimCampaign contract create a .env file in the main directory with your private key(s), network RPCs and etherscan API keys. Use the scripts/deploy.js file to deploy the contract, you can use hardhat to deploy and verify the contract using the command: 

``` bash
npx hardhat run scripts/deploy.js --network <network-name>
```

## Testnet Deployments
  


## Mainnet Deployments

Deployed address: `0x6F3B39C9bF155930b2C3f024FD714660F44Bbbc3`   
- Ethereum
- BASE
- Optimism
- Binance Smart Chain
- Mode Network
- Zora
- Iota EVM
- Mantle Network
