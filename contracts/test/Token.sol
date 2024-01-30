// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol';
import '@openzeppelin/contracts/utils/cryptography/EIP712.sol';

contract Token is ERC20Votes {

  constructor(uint256 initialSupply, string memory name, string memory symbol) ERC20(name, symbol) EIP712(name, '1') {
    _mint(msg.sender, initialSupply);
  }

  function mint(uint256 amount) public {
    _mint(msg.sender, amount);
  }

}