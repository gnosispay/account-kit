// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.4;

interface IMultisend {
  function multiSend(bytes memory transactions) external payable;
}
