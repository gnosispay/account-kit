// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {Enum, Modifier} from "@gnosis.pm/zodiac/contracts/core/Modifier.sol";

interface IERC20 {
  function transfer(address to, uint256 amount) external returns (bool);
}

interface IRoles {
  function execTransactionWithRole(
    address to,
    uint256 value,
    bytes memory data,
    uint8 operation,
    bytes32 roleKey,
    bool shouldRevert
  ) external returns (bool success);
}

contract Spender is Modifier {
  event Spend(address asset, address account, address receiver, uint256 amount);

  constructor(address _owner) {
    bytes memory initParams = abi.encode(_owner);
    setUp(initParams);
  }

  function setUp(bytes memory initParams) public override initializer {
    address _owner = abi.decode(initParams, (address));
    _transferOwnership(_owner);
    avatar = _owner;
    target = _owner;
    setupModules();
  }

  function execTransactionFromModule(
    address to,
    uint256 value,
    bytes calldata data,
    Enum.Operation operation
  ) public override moduleOnly returns (bool success) {}

  function execTransactionFromModuleReturnData(
    address to,
    uint256 value,
    bytes calldata data,
    Enum.Operation operation
  )
    public
    override
    moduleOnly
    returns (bool success, bytes memory returnData)
  {}

  function spend(
    address asset,
    address account,
    address receiver,
    uint256 amount,
    bytes32 roleKey
  ) public moduleOnly {
    require(
      exec(
        account,
        0,
        abi.encodeWithSelector(
          IRoles.execTransactionWithRole.selector,
          asset,
          0,
          abi.encodeWithSelector(IERC20.transfer.selector, receiver, amount),
          Enum.Operation.Call,
          roleKey,
          true
        ),
        Enum.Operation.Call
      ),
      "Spend Transaction Failed"
    );

    emit Spend(asset, account, receiver, amount);
  }
}
