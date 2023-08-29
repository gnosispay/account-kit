// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

interface IModuleProxyFactory {
  function deployModule(
    address masterCopy,
    bytes memory initializer,
    uint256 saltNonce
  ) external returns (address proxy);
}
