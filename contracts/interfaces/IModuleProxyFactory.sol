// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.4;

interface IModuleProxyFactory {
  error FailedInitialization();
  error TakenAddress(address address_);
  error TargetHasNoCode(address target);
  error ZeroAddress(address target);

  event ModuleProxyCreation(address indexed proxy, address indexed masterCopy);

  function deployModule(
    address masterCopy,
    bytes memory initializer,
    uint256 saltNonce
  ) external returns (address proxy);
}
