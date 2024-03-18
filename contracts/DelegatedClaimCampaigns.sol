// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import './libraries/TransferHelper.sol';
import './libraries/TimelockLibrary.sol';
import './interfaces/IVestingPlans.sol';
import './interfaces/ILockupPlans.sol';
import './interfaces/IDelegatePlan.sol';
import './interfaces/IERC20Votes.sol';

import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol';
import '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/Nonces.sol';

import 'hardhat/console.sol';

/// @title ClaimCampaigns - The smart contract to distribute your tokens to the community via claims
/// @notice This tool allows token projects to safely, securely and efficiently distribute your tokens in large scale to your community, whereby they can claim them based on your criteria of wallet address and amount.

contract DelegatedClaimCampaigns is ERC721Holder, ReentrancyGuard, EIP712, Nonces {
  bytes32 private constant CLAIM_TYPEHASH =
    keccak256('Claim(bytes16 campaignId,address claimer,uint256 claimAmount,uint256 nonce,uint256 expiry)');

  /// @dev an enum defining the different types of claims to be made
  /// @param Unlocked means that tokens claimed are liquid and not locked at all
  /// @param Locked means that the tokens claimed will be locked inside a TokenLockups plan
  /// @param Vesting means the tokens claimed will be locked insite a TokenVesting plan
  enum TokenLockup {
    Unlocked,
    Locked,
    Vesting
  }

  /// @notice the struct that defines the Locked and Vesting parameters for each vesting
  /// @dev this can be ignored for Unlocked claim campaigns
  /// @param tokenLocker is the address of the TokenLockup or TokenVesting plans contract that will lock the tokens
  /// @param rate is the rate which the tokens will unlock / vest at per period. So 10 would indicate 10 tokens unlocking per period.
  /// @param start is the start date when the unlock / vesting begins
  /// @param cliff is the single cliff date for unlocking and vesting plans, when all tokens prior to the cliff remained locked and unvested
  /// @param period is the amount of seconds in each discrete period. A streaming style would have this set to 1, but a period of 1 day would be 86400, tokens only unlock at each discrete period interval
  struct ClaimLockup {
    address tokenLocker;
    uint256 start;
    uint256 cliff;
    uint256 period;
    uint256 periods;
  }

  /// @notice Campaign is the struct that defines a claim campaign in general. The Campaign is related to a one time use, related to a merkle tree that pre defines all of the wallets and amounts those wallets can claim
  /// once the amount is 0, the campaign is ended. The campaign can also be terminated at any time.
  /// @param manager is the address of the campaign manager who is in charge of cancelling the campaign - AND if the campaign is setup for vesting, this address will be used as the vestingAdmin wallet for all of the vesting plans created
  /// the manager is typically the msg.sender wallet, but can be defined as something else in case.
  /// @param token is the address of the token to be claimed by the wallets, which is pulled into the contract during the campaign
  /// @param amount is the total amount of tokens left in the Campaign. this starts out as the entire amount in the campaign, and gets reduced each time a claim is made
  /// @param end is a unix time that can be used as a safety mechanism to put a hard end date for a campaign, this can also be far far in the future to effectively be forever claims
  /// @param tokenLockup is the enum (uint8) that describes how and if the tokens will be locked or vesting when they are claimed. If set to unlocked, claimants will just get the tokens, but if they are Locked / vesting, they will receive the NFT Tokenlockup plan or vesting plan
  /// @param root is the root of the merkle tree used for the claims.
  struct Campaign {
    address manager;
    address token;
    uint256 amount;
    uint256 start;
    uint256 end;
    TokenLockup tokenLockup;
    bytes32 root;
  }

  struct SignatureParams {
    uint256 nonce;
    uint256 expiry;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  /// @dev we use UUIDs or CIDs to map to a specific unique campaign. The UUID or CID is typically generated when the merkle tree is created, and then that id or cid is the identifier of the file in S3 or IPFS
  mapping(bytes16 => Campaign) public campaigns;
  /// @dev the same UUID is maped to the ClaimLockup details for the specific campaign
  mapping(bytes16 => ClaimLockup) public claimLockups;
  /// @dev this maps the UUID that have already been used, so that a campaign cannot be duplicated
  mapping(bytes16 => bool) public usedIds;

  //maps campaign id to a wallet address, which is flipped to true when claimed
  mapping(bytes16 => mapping(address => bool)) public claimed;

  mapping(bytes16 => address) private _vestingAdmins;

  // events
  event CampaignStarted(bytes16 indexed id, Campaign campaign);
  event ClaimLockupCreated(bytes16 indexed id, ClaimLockup claimLockup);
  event CampaignCancelled(bytes16 indexed id);
  event TokensClaimed(bytes16 indexed id, address indexed claimer, uint256 amountClaimed, uint256 amountRemaining);
  event UnlockedTokensClaimed(
    bytes16 indexed id,
    address indexed claimer,
    uint256 amountClaimed,
    uint256 amountRemaining
  );
  event Claimed(address indexed recipient, uint256 indexed amount);

  constructor(string memory name, string memory version) EIP712(name, version) {}

  /**********EXTERNAL CREATE& CANCEL CLAIMS FUNCTIONS********************************************************************************************/

  /// @notice primary function for creating an unlocked claims campaign. This function will pull the amount of tokens in the campaign struct, and map the campaign to the id.
  /// @dev the merkle tree needs to be pre-generated, so that you can upload the root and the uuid for the function
  /// @param id is the uuid or CID of the file that stores the merkle tree
  /// @param campaign is the struct of the campaign info, including the total amount tokens to be distributed via claims, and the root of the merkle tree
  function createUnlockedCampaign(bytes16 id, Campaign memory campaign) external nonReentrant {
    require(!usedIds[id], 'in use');
    usedIds[id] = true;
    require(campaign.token != address(0), '0_address');
    require(campaign.manager != address(0), '0_manager');
    require(campaign.amount > 0, '0_amount');
    require(campaign.end > block.timestamp, 'end error');
    require(campaign.tokenLockup == TokenLockup.Unlocked, 'locked');
    require(IERC20Votes(campaign.token).delegates(address(this)) == (address(0)));
    TransferHelper.transferTokens(campaign.token, msg.sender, address(this), campaign.amount);
    campaigns[id] = campaign;
    emit CampaignStarted(id, campaign);
  }

  /// @notice primary function for creating an locked or vesting claims campaign. This function will pull the amount of tokens in the campaign struct, and map the campaign and claimLockup to the id.
  /// additionally it will check that the lockup details are valid, and perform an allowance increase to the contract for when tokens are claimed they can be pulled.
  /// @dev the merkle tree needs to be pre-generated, so that you can upload the root and the uuid for the function
  /// @param id is the uuid or CID of the file that stores the merkle tree
  /// @param campaign is the struct of the campaign info, including the total amount tokens to be distributed via claims, and the root of the merkle tree, plus the lockup type of either 1 (lockup) or 2 (vesting)
  /// @param claimLockup is the struct that defines the characteristics of the lockup for each token claimed.
  function createLockedCampaign(
    bytes16 id,
    Campaign memory campaign,
    ClaimLockup memory claimLockup,
    address vestingAdmin
  ) external nonReentrant {
    require(!usedIds[id], 'in use');
    usedIds[id] = true;
    require(campaign.token != address(0), '0_address');
    require(campaign.manager != address(0), '0_manager');
    require(campaign.amount > 0, '0_amount');
    require(campaign.end > block.timestamp, 'end error');
    require(campaign.tokenLockup != TokenLockup.Unlocked, '!locked');
    require(IERC20Votes(campaign.token).delegates(address(this)) == (address(0)));
    if (campaign.tokenLockup == TokenLockup.Vesting) {
      require(vestingAdmin != address(0), '0_admin');
      _vestingAdmins[id] = vestingAdmin;
    }
    require(claimLockup.tokenLocker != address(0), 'invalide locker');
    TransferHelper.transferTokens(campaign.token, msg.sender, address(this), campaign.amount);
    claimLockups[id] = claimLockup;
    SafeERC20.safeIncreaseAllowance(IERC20(campaign.token), claimLockup.tokenLocker, campaign.amount);
    campaigns[id] = campaign;
    emit ClaimLockupCreated(id, claimLockup);
    emit CampaignStarted(id, campaign);
  }


   /// @notice this function allows the campaign manager to cancel an ongoing campaign at anytime. Cancelling a campaign will return any unclaimed tokens, and then prevent anyone from claiming additional tokens
  /// @param campaignId is the id of the campaign to be cancelled
  function cancelCampaign(bytes16 campaignId) external nonReentrant {
    Campaign memory campaign = campaigns[campaignId];
    require(campaign.manager == msg.sender, '!manager');
    delete campaigns[campaignId];
    delete claimLockups[campaignId];
    TransferHelper.withdrawTokens(campaign.token, msg.sender, campaign.amount);
    emit CampaignCancelled(campaignId);
  }


  /***************EXTERNAL CLAIMING FUNCTIONS***************************************************************************************************/

  function claimAndDelegate(
    bytes16 campaignId,
    bytes32[] memory proof,
    uint256 claimAmount,
    address delegatee,
    SignatureParams memory delegationSignature
  ) external nonReentrant {
    require(delegatee != address(0), '0_delegatee');
    require(!claimed[campaignId][msg.sender], 'already claimed');
    if (campaigns[campaignId].tokenLockup == TokenLockup.Unlocked) {
      _claimUnlockedAndDelegate(
        campaignId,
        proof,
        msg.sender,
        claimAmount,
        delegatee,
        delegationSignature.nonce,
        delegationSignature.expiry,
        delegationSignature.v,
        delegationSignature.r,
        delegationSignature.s
      );
    } else {
      _claimLockedAndDelegate(campaignId, proof, msg.sender, claimAmount, delegatee);
    }
  }

  // for completely gasless claiming
  function claimAndDelegateWithSig(
    bytes16 campaignId,
    bytes32[] memory proof,
    address claimer,
    uint256 claimAmount,
    SignatureParams memory claimSignature,
    address delegatee,
    SignatureParams memory delegationSignature
  ) external nonReentrant {
    require(delegatee != address(0), '0_delegatee');
    require(!claimed[campaignId][msg.sender], 'already claimed');
    require(claimSignature.expiry > block.timestamp, 'claim expired');
    address signer = ECDSA.recover(
      _hashTypedDataV4(
        keccak256(
          abi.encode(CLAIM_TYPEHASH, campaignId, claimer, claimAmount, claimSignature.nonce, claimSignature.expiry)
        )
      ),
      claimSignature.v,
      claimSignature.r,
      claimSignature.s
    );
    require(signer == claimer, 'invalid claim signature');
    _useCheckedNonce(claimer, claimSignature.nonce);
    if (campaigns[campaignId].tokenLockup == TokenLockup.Unlocked) {
      _claimUnlockedAndDelegate(
        campaignId,
        proof,
        claimer,
        claimAmount,
        delegatee,
        delegationSignature.nonce,
        delegationSignature.expiry,
        delegationSignature.v,
        delegationSignature.r,
        delegationSignature.s
      );
    } else {
      _claimLockedAndDelegate(campaignId, proof,claimer, claimAmount, delegatee);
    }
  }

  /*****INTERNAL CLAIMINIG FUNCTIONS**********************************************************************************************/

  function _claimUnlockedAndDelegate(
    bytes16 campaignId,
    bytes32[] memory proof,
    address claimer,
    uint256 claimAmount,
    address delegatee,
    uint256 nonce,
    uint256 expiry,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) internal {
    Campaign memory campaign = campaigns[campaignId];
    require(campaign.start <= block.timestamp, 'campaign not started');
    require(campaign.end > block.timestamp, 'campaign ended');
    require(verify(campaign.root, proof, claimer, claimAmount), '!eligible');
    require(campaign.amount >= claimAmount, 'campaign unfunded');
    require(campaign.tokenLockup == TokenLockup.Unlocked, '!unlocked');
    claimed[campaignId][claimer] = true;
    campaigns[campaignId].amount -= claimAmount;
    if (campaigns[campaignId].amount == 0) {
      delete campaigns[campaignId];
    }
    TransferHelper.withdrawTokens(campaign.token, claimer, claimAmount);
    IERC20Votes(campaign.token).delegateBySig(delegatee, nonce, expiry, v, r, s);
    address delegatedTo = IERC20Votes(campaign.token).delegates(claimer);
    require(delegatedTo == delegatee, 'delegation failed');
    emit Claimed(claimer, claimAmount);
    emit UnlockedTokensClaimed(campaignId, claimer, claimAmount, campaigns[campaignId].amount);
  }

  function _claimLockedAndDelegate(
    bytes16 campaignId,
    bytes32[] memory proof,
    address claimer,
    uint256 claimAmount,
    address delegatee
  ) internal {
    Campaign memory campaign = campaigns[campaignId];
    require(campaign.start <= block.timestamp, 'campaign not started');
    require(campaign.end > block.timestamp, 'campaign ended');
    require(verify(campaign.root, proof, claimer, claimAmount), '!eligible');
    require(campaign.amount >= claimAmount, 'campaign unfunded');
    claimed[campaignId][claimer] = true;
    campaigns[campaignId].amount -= claimAmount;
    if (campaigns[campaignId].amount == 0) {
      delete campaigns[campaignId];
    }
    ClaimLockup memory c = claimLockups[campaignId];
    uint256 rate;
    if (claimAmount % c.periods == 0) {
      rate = claimAmount / c.periods;
    } else {
      rate = claimAmount / c.periods + 1;
    }
    uint256 start = c.start == 0 ? block.timestamp : c.start;
    uint256 tokenId;
    if (campaign.tokenLockup == TokenLockup.Locked) {
      tokenId = ILockupPlans(c.tokenLocker).createPlan(
        address(this),
        campaign.token,
        claimAmount,
        start,
        c.cliff,
        rate,
        c.period
      );
      IDelegatePlan(c.tokenLocker).delegate(tokenId, delegatee);
      IERC721(c.tokenLocker).transferFrom(address(this), claimer, tokenId);
    } else {
      tokenId = IVestingPlans(c.tokenLocker).createPlan(
        address(this),
        campaign.token,
        claimAmount,
        start,
        c.cliff,
        rate,
        c.period,
        address(this),
        true
      );
      IDelegatePlan(c.tokenLocker).delegate(tokenId, delegatee);
      IERC721(c.tokenLocker).transferFrom(address(this), claimer, tokenId);
      IVestingPlans(c.tokenLocker).changeVestingPlanAdmin(tokenId, _vestingAdmins[campaignId]);
    }
    emit Claimed(claimer, claimAmount);
    emit TokensClaimed(campaignId, claimer, claimAmount, campaigns[campaignId].amount);
  }

  /// @dev the internal verify function from the open zepellin library.
  /// this function inputs the root, proof, wallet address of the claimer, and amount of tokens, and then computes the validity of the leaf with the proof and root.
  /// @param root is the root of the merkle tree
  /// @param proof is the proof for the specific leaf
  /// @param claimer is the address of the claimer used in making the leaf
  /// @param amount is the amount of tokens to be claimed, the other piece of data in the leaf
  function verify(bytes32 root, bytes32[] memory proof, address claimer, uint256 amount) public pure returns (bool) {
    bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(claimer, amount))));
    require(MerkleProof.verify(proof, root, leaf), 'Invalid proof');
    return true;
  }
}
