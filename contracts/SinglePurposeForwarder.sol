// SPDX-License-Identifier: MIT
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
    address caller_ = caller;
    address to_ = to;
    bytes32 selector_ = bytes32(selector) >> 224;

    assembly {
      // only caller allowed
      if eq(eq(caller(), caller_), 0) {
        revert(0, 0)
      }

      // only selector allowed
      if eq(eq(shr(224, calldataload(0)), selector_), 0) {
        revert(0, 0)
      }

      // Copy msg.data. We take full control of memory because
      // won't return to Solidity code. No need to respect conventions,
      // we overwrite the Solidity scratch pad at memory position 0.
      calldatacopy(0, 0, calldatasize())

      let result := call(gas(), to_, callvalue(), 0, calldatasize(), 0, 0)

      // Copy the returned data.
      returndatacopy(0, 0, returndatasize())

      switch result
      // call returns 0 on error.
      case 0 {
        revert(0, returndatasize())
      }
      default {
        return(0, returndatasize())
      }
    }
  }
}
