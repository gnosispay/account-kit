// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

interface IDelayMod {
  // event AvatarSet(address indexed previousAvatar, address indexed newAvatar);
  // event ChangedGuard(address guard)
  // event DelaySetup(address indexed initiator, address indexed owner, address indexed avatar, address target)
  // event DisabledModule(address module)
  // event EnabledModule(address module)
  // event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
  // event TargetSet(address indexed previousTarget, address indexed newTarget)
  // event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, address to, uint256 value, bytes data, uint8 operation)
  // function avatar() view returns (address)
  // function disableModule(address prevModule, address module)
  // function enableModule(address module)
  // function execTransactionFromModule(address to, uint256 value, bytes data, uint8 operation) returns (bool success)
  // function execTransactionFromModuleReturnData(address to, uint256 value, bytes data, uint8 operation) returns (bool success, bytes returnData)
  // function executeNextTx(address to, uint256 value, bytes data, uint8 operation)
  // function getGuard() view returns (address _guard)
  // function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)
  // function getTransactionHash(address to, uint256 value, bytes data, uint8 operation) pure returns (bytes32)
  // function getTxCreatedAt(uint256 _nonce) view returns (uint256)
  // function getTxHash(uint256 _nonce) view returns (bytes32)
  // function guard() view returns (address)
  // function isModuleEnabled(address _module) view returns (bool)
  // function owner() view returns (address)
  function queueNonce() external view returns (uint256);

  // function renounceOwnership()
  // function setAvatar(address _avatar)
  // function setGuard(address _guard)
  // function setTarget(address _target)
  function setTxCooldown(uint256 cooldown) external;

  // function setTxExpiration(uint256 expiration)
  // function setTxNonce(uint256 _nonce)
  // function setUp(bytes initParams)
  // function skipExpired()
  // function target() view returns (address)
  // function transferOwnership(address newOwner)
  function txCooldown() external view returns (uint256);

  // function txCreatedAt(uint256) view returns (uint256)
  // function txExpiration() view returns (uint256)
  // function txHash(uint256) view returns (bytes32)
  function txNonce() external view returns (uint256);
}
