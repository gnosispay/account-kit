// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

contract TestContract {
  function fnThatMaybeReverts(
    bool maybe
  ) external pure returns (uint256[] memory result) {
    if (maybe) {
      revert();
    }

    result = new uint256[](2);
    result[0] = 1;
    result[1] = 2;
    return result;
  }

  function fnOther() external pure returns (uint256) {
    return 5;
  }
}
