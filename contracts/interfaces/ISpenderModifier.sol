// https://github.com/safe-global/safe-deployments/tree/main
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.4;

interface ISpenderModifier {
  type Operation is uint8;

  error AlreadyDisabledModule(address module);
  error AlreadyEnabledModule(address module);
  error HashAlreadyConsumed(bytes32);
  error InvalidInitialization();
  error InvalidModule(address module);
  error InvalidPageSize();
  error NotAuthorized(address sender);
  error NotInitializing();
  error OwnableInvalidOwner(address owner);
  error OwnableUnauthorizedAccount(address account);
  error SetupModulesAlreadyCalled();

  event AvatarSet(address indexed previousAvatar, address indexed newAvatar);
  event DisabledModule(address module);
  event EnabledModule(address module);
  event ExecutionFromModuleFailure(address indexed module);
  event ExecutionFromModuleSuccess(address indexed module);
  event HashExecuted(bytes32);
  event HashInvalidated(bytes32);
  event Initialized(uint64 version);
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );
  event Spend(address asset, address account, address receiver, uint256 amount);
  event TargetSet(address indexed previousTarget, address indexed newTarget);

  function avatar() external view returns (address);
  function consumed(address, bytes32) external view returns (bool);
  function disableModule(address prevModule, address module) external;
  function enableModule(address module) external;
  function execTransactionFromModule(
    address to,
    uint256 value,
    bytes memory data,
    Operation operation
  ) external returns (bool success);
  function execTransactionFromModuleReturnData(
    address to,
    uint256 value,
    bytes memory data,
    Operation operation
  ) external returns (bool success, bytes memory returnData);
  function getModulesPaginated(
    address start,
    uint256 pageSize
  ) external view returns (address[] memory array, address next);
  function invalidate(bytes32 hash) external;
  function isModuleEnabled(address _module) external view returns (bool);
  function moduleTxHash(
    bytes memory data,
    bytes32 salt
  ) external view returns (bytes32);
  function owner() external view returns (address);
  function renounceOwnership() external;
  function setAvatar(address _avatar) external;
  function setTarget(address _target) external;
  function setUp(bytes memory initParams) external;
  function spend(
    address asset,
    address account,
    address receiver,
    uint256 amount,
    bytes32 roleKey
  ) external;
  function target() external view returns (address);
  function transferOwnership(address newOwner) external;
}
