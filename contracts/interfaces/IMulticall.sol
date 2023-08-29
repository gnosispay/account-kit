// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/// @title Multicall3
/// @notice Aggregate results from multiple function calls
/// @dev Multicall & Multicall2 backwards-compatible
interface IMulticall {
  struct Call {
    address target;
    bytes callData;
  }

  struct Call3 {
    address target;
    bool allowFailure;
    bytes callData;
  }

  struct Call3Value {
    address target;
    bool allowFailure;
    uint256 value;
    bytes callData;
  }

  struct Result {
    bool success;
    bytes returnData;
  }

  /// @notice Backwards-compatible call aggregation with Multicall
  /// @param calls An array of Call structs
  /// @return blockNumber The block number where the calls were executed
  /// @return returnData An array of bytes containing the responses
  function aggregate(
    Call[] calldata calls
  ) external payable returns (uint256 blockNumber, bytes[] memory returnData);

  /// @notice Backwards-compatible with Multicall2
  /// @notice Aggregate calls without requiring success
  /// @param requireSuccess If true, require all calls to succeed
  /// @param calls An array of Call structs
  /// @return returnData An array of Result structs
  function tryAggregate(
    bool requireSuccess,
    Call[] calldata calls
  ) external payable returns (Result[] memory returnData);

  /// @notice Backwards-compatible with Multicall2
  /// @notice Aggregate calls and allow failures using tryAggregate
  /// @param calls An array of Call structs
  /// @return blockNumber The block number where the calls were executed
  /// @return blockHash The hash of the block where the calls were executed
  /// @return returnData An array of Result structs
  function tryBlockAndAggregate(
    bool requireSuccess,
    Call[] calldata calls
  )
    external
    payable
    returns (
      uint256 blockNumber,
      bytes32 blockHash,
      Result[] memory returnData
    );

  /// @notice Backwards-compatible with Multicall2
  /// @notice Aggregate calls and allow failures using tryAggregate
  /// @param calls An array of Call structs
  /// @return blockNumber The block number where the calls were executed
  /// @return blockHash The hash of the block where the calls were executed
  /// @return returnData An array of Result structs
  function blockAndAggregate(
    Call[] calldata calls
  )
    external
    payable
    returns (
      uint256 blockNumber,
      bytes32 blockHash,
      Result[] memory returnData
    );

  /// @notice Aggregate calls, ensuring each returns success if required
  /// @param calls An array of Call3 structs
  /// @return returnData An array of Result structs
  function aggregate3(
    Call3[] calldata calls
  ) external payable returns (Result[] memory returnData);

  /// @notice Returns the block number
  function getBlockNumber() external view returns (uint256 blockNumber);

  /// @notice Returns the block coinbase
  function getCurrentBlockCoinbase() external view returns (address coinbase);

  /// @notice Returns the block difficulty
  function getCurrentBlockDifficulty()
    external
    view
    returns (uint256 difficulty);

  /// @notice Returns the block gas limit
  function getCurrentBlockGasLimit() external view returns (uint256 gaslimit);

  /// @notice Returns the block timestamp
  function getCurrentBlockTimestamp() external view returns (uint256 timestamp);
}
