// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IClaim {
  enum TokenLockup {
    Unlocked,
    Locked,
    Vesting
  }
  struct Campaign {
    address manager;
    address token;
    uint256 amount;
    uint256 start;
    uint256 end;
    TokenLockup tokenLockup;
    bytes32 root;
    bool delegating;
  }

  struct ClaimLockup {
    address tokenLocker;
    uint256 start;
    uint256 cliff;
    uint256 period;
    uint256 periods;
  }

  function createUnlockedCampaign(bytes16 id, Campaign memory campaign, uint256 totalClaimers) external;

  function createLockedCampaign(
    bytes16 id,
    Campaign memory campaign,
    ClaimLockup memory claimLockup,
    address vestingAdmin,
    uint256 totalClaimers
  ) external;

  function cancelCampaigns(bytes16[] memory campaignIds) external;
}

contract FlashLoanAttack {
  function createUnlockedAndCancel(address claimContract, bytes16 id, IClaim.Campaign memory campaign) public {
    if (IERC20(campaign.token).balanceOf(address(this)) < campaign.amount) {
      IERC20(campaign.token).transferFrom(msg.sender, address(this), campaign.amount);
    }
    IERC20(campaign.token).approve(claimContract, campaign.amount);
    IClaim(claimContract).createUnlockedCampaign(id, campaign, 100);
    bytes16[] memory ids = new bytes16[](1);
    ids[0] = id;
    IClaim(claimContract).cancelCampaigns(ids);
    // try to transfer tokens out of the contract
    IERC20(campaign.token).transferFrom(claimContract, address(this), campaign.amount);
  }

  function createLockedAndCancel(address claimContract, bytes16 id, IClaim.Campaign memory campaign) public {
    if (IERC20(campaign.token).balanceOf(address(this)) < campaign.amount) {
      IERC20(campaign.token).transferFrom(msg.sender, address(this), campaign.amount);
    }
    IERC20(campaign.token).approve(claimContract, campaign.amount);
    IClaim.ClaimLockup memory claimLockup = IClaim.ClaimLockup({
      tokenLocker: address(this),
      start: block.timestamp,
      cliff: block.timestamp,
      period: 1,
      periods: 100
    });
    IClaim(claimContract).createLockedCampaign(id, campaign, claimLockup, address(this), 100);
    bytes16[] memory ids = new bytes16[](1);
    ids[0] = id;
    IClaim(claimContract).cancelCampaigns(ids);
    IERC20(campaign.token).transferFrom(claimContract, address(this), campaign.amount);
  }
}
