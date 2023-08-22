// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

interface IAllowanceMod {
  // event AddDelegate(address indexed safe, address delegate)
  // event DeleteAllowance(address indexed safe, address delegate, address token)
  // event ExecuteAllowanceTransfer(address indexed safe, address delegate, address token, address to, uint96 value, uint16 nonce)
  // event PayAllowanceTransfer(address indexed safe, address delegate, address paymentToken, address paymentReceiver, uint96 payment)
  // event RemoveDelegate(address indexed safe, address delegate)
  // event ResetAllowance(address indexed safe, address delegate, address token)
  // event SetAllowance(address indexed safe, address delegate, address token, uint96 allowanceAmount, uint16 resetTime)
  // function ALLOWANCE_TRANSFER_TYPEHASH() view returns (bytes32)
  // function DOMAIN_SEPARATOR_TYPEHASH() view returns (bytes32)
  // function NAME() view returns (string)
  // function VERSION() view returns (string)
  // function allowances(address, address, address) view returns (uint96 amount, uint96 spent, uint16 resetTimeMin, uint32 lastResetMin, uint16 nonce)
  // function delegates(address, uint48) view returns (address delegate, uint48 prev, uint48 next)
  // function delegatesStart(address) view returns (uint48)
  // function tokens(address, address, uint256) view returns (address)
  function setAllowance(
    address delegate,
    address token,
    uint96 allowanceAmount,
    uint16 resetTimeMin,
    uint32 resetBaseMin
  ) external;

  // function resetAllowance(address delegate, address token)
  // function deleteAllowance(address delegate, address token)
  // function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)
  // function getChainId() pure returns (uint256)
  // function generateTransferHash(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, uint16 nonce) view returns (bytes32)
  // function getTokens(address safe, address delegate) view returns (address[])
  function getTokenAllowance(
    address safe,
    address delegate,
    address token
  ) external view returns (uint256[5] memory);

  function addDelegate(address delegate) external;
  // function removeDelegate(address delegate, bool removeAllowances)
  // function getDelegates(address safe, uint48 start, uint8 pageSize) view returns (address[] results, uint48 next)'
}
