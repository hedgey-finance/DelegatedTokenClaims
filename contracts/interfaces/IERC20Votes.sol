// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

interface IERC20Votes {
  function delegate(address delegatee) external;

  function delegates(address wallet) external view returns (address delegate);

  function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;
}