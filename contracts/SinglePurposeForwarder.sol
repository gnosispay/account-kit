// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

contract SinglePurposeForwarder {
  address public immutable caller;
  address public immutable to;
  bytes4 public immutable selector;

  constructor(address _caller, address _to, bytes4 _selector) {
    caller = _caller;
    to = _to;
    selector = _selector;
  }

  fallback() external payable virtual {
    if (msg.sender != caller) {
      revert("Unauthorized Caller");
    }

    if (bytes4(msg.data) != selector) {
      revert("Unauthorized Selector");
    }

    address to_ = to;
    assembly {
      // Copy msg.data. We take full control of memory because
      // won't return to Solidity code. No need to respect conventions,
      // we overwrite the Solidity scratch pad at memory position 0.
      calldatacopy(0, 0, calldatasize())

      let result := call(gas(), to_, callvalue(), 0, calldatasize(), 0, 0)

      // Copy the returned data.
      let size := returndatasize()
      returndatacopy(0, 0, size)

      if eq(result, 0) {
        revert(0, size)
      }

      return(0, size)
    }
  }
}
