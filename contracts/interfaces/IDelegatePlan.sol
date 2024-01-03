// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

interface IDelegatePlan {
  function delegate(uint256 planId, address delegatee) external;
}