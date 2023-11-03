// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

/**
 * @title Bouncer - Allows a specific caller to invoke a single function on a target contract.
 * @author Cristóvão Honorato - <cristovao.honorato@gnosis.io>
 * @author Auryn Macmillan    - <auryn.macmillan@gnosis.io>
 */
contract Bouncer {
  error BouncerBlockedCaller(address caller);
  error BouncerBlockedSelector(bytes4 selector);

  address public immutable from;
  address public immutable to;
  bytes4 public immutable selector;

  constructor(address _from, address _to, bytes4 _selector) {
    from = _from;
    to = _to;
    selector = _selector;
  }

  fallback() external payable virtual {
    if (msg.sender != from) {
      revert BouncerBlockedCaller(msg.sender);
    }

    if (bytes4(msg.data) != selector) {
      revert BouncerBlockedSelector(bytes4(msg.data));
    }

    address to_ = to;
    assembly {
      // Copy msg.data. We take full control of memory because
      // won't return to Solidity code.
      calldatacopy(0, 0, calldatasize())

      let result := call(gas(), to_, callvalue(), 0, calldatasize(), 0, 0)

      returndatacopy(0, 0, returndatasize())
      if eq(result, 0) {
        revert(0, returndatasize())
      }
      return(0, returndatasize())
    }
  }

  receive() external payable {}
}
