import assert from "assert";
import { AbiCoder } from "ethers";

import { ALLOWANCE_SPENDING_KEY } from "../constants";
import deployments from "../deployments";
import {
  predictDelayAddress,
  predictForwarderAddress,
  predictRolesAddress,
} from "../parts";

import { AccountIntegrityStatus, TransactionData } from "../types";

const AddressOne = "0x0000000000000000000000000000000000000001";

export default function populateAccountQuery(account: string): TransactionData {
  const { iface } = deployments.safeMastercopy;
  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
  };
  const roles = {
    address: predictRolesAddress(account),
    iface: deployments.rolesMastercopy.iface,
  };

  const multicall = deployments.multicall;

  const data = multicall.iface.encodeFunctionData("aggregate3", [
    [
      {
        target: account,
        allowFailure: true,
        callData: iface.encodeFunctionData("getOwners"),
      },
      {
        target: account,
        allowFailure: true,
        callData: iface.encodeFunctionData("getThreshold"),
      },
      {
        target: account,
        allowFailure: true,
        callData: iface.encodeFunctionData("getModulesPaginated", [
          AddressOne,
          10,
        ]),
      },
      {
        target: roles.address,
        allowFailure: true,
        callData: roles.iface.encodeFunctionData("owner"),
      },
      {
        target: roles.address,
        allowFailure: true,
        callData: roles.iface.encodeFunctionData("allowances", [
          ALLOWANCE_SPENDING_KEY,
        ]),
      },
      {
        target: delay.address,
        allowFailure: true,
        callData: delay.iface.encodeFunctionData("owner"),
      },
      {
        target: delay.address,
        allowFailure: true,
        callData: delay.iface.encodeFunctionData("txCooldown"),
      },
      {
        target: delay.address,
        allowFailure: true,
        callData: delay.iface.encodeFunctionData("txNonce"),
      },
      {
        target: delay.address,
        allowFailure: true,
        callData: delay.iface.encodeFunctionData("queueNonce"),
      },
      {
        target: multicall.address,
        allowFailure: false,
        callData: multicall.iface.encodeFunctionData(
          "getCurrentBlockTimestamp"
        ),
      },
    ],
  ]);

  return {
    to: multicall.address,
    data,
  };
}

export function evaluateAccountQuery(
  { account, cooldown }: { account: string; cooldown: bigint | number },
  functionResult: string
): {
  status: AccountIntegrityStatus;
  allowance: bigint;
} {
  try {
    const multicall = deployments.multicall.iface;

    const [aggregate3Result] = multicall.decodeFunctionResult(
      "aggregate3",
      functionResult
    );

    const [
      [ownersSuccess, ownersResult],
      [thresholdSuccess, thresholdResult],
      [modulesSuccess, modulesResult],
      [rolesOwnerSuccess, rolesOwnerResult],
      [allowanceSuccess, allowanceResult],
      [delayOwnerSuccess, delayOwnerResult],
      [txCooldownSuccess, txCooldownResult],
      [txNonceSuccess, txNonceResult],
      [queueNonceSuccess, queueNonceResult],
      [, blockTimestampResult],
    ] = aggregate3Result;

    if (
      ownersSuccess !== true ||
      thresholdSuccess !== true ||
      modulesSuccess !== true
    ) {
      return {
        status: AccountIntegrityStatus.SafeNotDeployed,
        allowance: BigInt(0),
      };
    }

    if (
      !evaluateOwners(ownersResult, thresholdResult) ||
      !evaluateModules(account, modulesResult)
    ) {
      return {
        status: AccountIntegrityStatus.SafeMisconfigured,
        allowance: BigInt(0),
      };
    }

    if (rolesOwnerSuccess !== true || allowanceSuccess != true) {
      return {
        status: AccountIntegrityStatus.RolesNotDeployed,
        allowance: BigInt(0),
      };
    }

    if (!evaluateRolesConfig(account, rolesOwnerResult)) {
      return {
        status: AccountIntegrityStatus.RolesMisconfigured,
        allowance: BigInt(0),
      };
    }

    if (
      delayOwnerSuccess !== true ||
      txCooldownSuccess !== true ||
      txNonceSuccess !== true ||
      queueNonceSuccess != true
    ) {
      return {
        status: AccountIntegrityStatus.DelayNotDeployed,
        allowance: BigInt(0),
      };
    }

    if (
      !evaluateDelayConfig(
        account,
        cooldown,
        delayOwnerResult,
        txCooldownResult
      )
    ) {
      return {
        status: AccountIntegrityStatus.DelayMisconfigured,
        allowance: BigInt(0),
      };
    }

    if (!evaluateDelayQueue(txNonceResult, queueNonceResult)) {
      return {
        status: AccountIntegrityStatus.DelayQueueNotEmpty,
        allowance: BigInt(0),
      };
    }

    return {
      status: AccountIntegrityStatus.Ok,
      allowance: accruedBalance(allowanceResult, blockTimestampResult),
    };
  } catch (e) {
    return {
      status: AccountIntegrityStatus.UnexpectedError,
      allowance: BigInt(0),
    };
  }
}

function evaluateOwners(ownersResult: string, thresholdResult: string) {
  if (BigInt(thresholdResult) !== BigInt(1)) {
    return false;
  }

  const { iface } = deployments.safeMastercopy;

  const [owners]: string[][] = iface.decodeFunctionResult(
    "getOwners",
    ownersResult
  );

  return (
    owners.length == 1 &&
    owners[0] === "0x0000000000000000000000000000000000000002"
  );
}

function evaluateModules(safe: string, result: string) {
  const { iface } = deployments.safeMastercopy;

  const [enabledModules]: string[][] = iface.decodeFunctionResult(
    "getModulesPaginated",
    result
  );

  if (enabledModules.length !== 2) {
    return false;
  }

  const delayAddress = predictDelayAddress(safe);
  const rolesAddress = predictRolesAddress(safe);

  return (
    enabledModules.includes(delayAddress) &&
    enabledModules.includes(rolesAddress)
  );
}

function evaluateRolesConfig(safe: string, rolesOwnerResult: string) {
  const abi = AbiCoder.defaultAbiCoder();

  const [rolesOwner] = abi.decode(["address"], rolesOwnerResult);
  const forwarder = predictForwarderAddress(safe);

  return rolesOwner === forwarder;
}

function evaluateDelayConfig(
  safe: string,
  cooldown: bigint | number,
  ownerResult: string,
  cooldownResult: string
) {
  const abi = AbiCoder.defaultAbiCoder();
  const [owner] = abi.decode(["address"], ownerResult);

  // check that the safe is the owner of the delay mod
  return (
    owner.toLowerCase() == safe.toLowerCase() &&
    BigInt(cooldownResult) >= BigInt(cooldown)
  );
}

function evaluateDelayQueue(nonceResult: string, queueResult: string) {
  return nonceResult == queueResult;
}

function accruedBalance(allowanceResult: string, blockTimestampResult: string) {
  const { iface } = deployments.rolesMastercopy;

  const blockTimestamp = BigInt(blockTimestampResult);
  const [refill, maxBalance, period, balance, timestamp]: bigint[] =
    iface.decodeFunctionResult("allowances", allowanceResult);

  assert(typeof refill == "bigint");
  assert(typeof maxBalance == "bigint");
  assert(typeof period == "bigint");
  assert(typeof balance == "bigint");
  assert(typeof timestamp == "bigint");

  if (period == BigInt(0) || blockTimestamp < timestamp + period) {
    return balance;
  }

  const elapsedIntervals = (blockTimestamp - timestamp) / period;
  const balanceUncapped = balance + refill * elapsedIntervals;
  return balanceUncapped < maxBalance ? balanceUncapped : maxBalance;
}
