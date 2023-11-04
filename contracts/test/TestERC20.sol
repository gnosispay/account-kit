// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
  constructor() ERC20("TestERC20", "S-COIN") {}

  function mint(address to, uint256 tokenId) external {
    _mint(to, tokenId);
  }
}
