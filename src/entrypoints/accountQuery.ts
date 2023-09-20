import assert from "assert";
import { AbiCoder } from "ethers";

import {
  ALLOWANCE_KEY,
  predictDelayAddress,
  predictRolesAddress,
} from "./predictModuleAddress";
import { predictForwarderAddress } from "./predictSingletonAddress";
import deployments from "../deployments";

import { AccountIntegrityStatus, TransactionData } from "../types";

const AddressOne = "0x0000000000000000000000000000000000000001";

export default function populateAccountQuery(
  safeAddress: string
): TransactionData {
  const safe = {
    address: safeAddress,
    iface: deployments.safeMastercopy.iface,
  };

  const delay = {
    address: predictDelayAddress(safeAddress),
    iface: deployments.delayMastercopy.iface,
  };
  const roles = {
    address: predictRolesAddress(safe.address),
    iface: deployments.rolesMastercopy.iface,
  };

  const multicall = deployments.multicall;

  const data = multicall.iface.encodeFunctionData("aggregate3", [
    [
      {
        target: safe.address,
        allowFailure: true,
        callData: safe.iface.encodeFunctionData("getOwners"),
      },
      {
        target: safe.address,
        allowFailure: true,
        callData: safe.iface.encodeFunctionData("getThreshold"),
      },
      {
        target: safe.address,
        allowFailure: true,
        callData: safe.iface.encodeFunctionData("getModulesPaginated", [
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
        callData: roles.iface.encodeFunctionData("allowances", [ALLOWANCE_KEY]),
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
  { eoa, safe }: { eoa: string; safe: string },
  { spender, cooldown }: { spender: string; cooldown: bigint | number },
  functionResult: string
): {
  status: AccountIntegrityStatus;
  balance: bigint;
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
        balance: BigInt(0),
      };
    }

    if (
      !evaluateOwners({ spender }, ownersResult, thresholdResult) ||
      !evaluateModules({ safe }, modulesResult)
    ) {
      return {
        status: AccountIntegrityStatus.SafeMisconfigured,
        balance: BigInt(0),
      };
    }

    if (rolesOwnerSuccess !== true || allowanceSuccess != true) {
      return {
        status: AccountIntegrityStatus.RolesNotDeployed,
        balance: BigInt(0),
      };
    }

    if (
      !evaluateRolesConfig({ eoa, safe }, rolesOwnerResult, allowanceResult)
    ) {
      return {
        status: AccountIntegrityStatus.RolesMisconfigured,
        balance: BigInt(0),
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
        balance: BigInt(0),
      };
    }

    if (
      !evaluateDelayConfig(
        { safe, cooldown },
        delayOwnerResult,
        txCooldownResult
      )
    ) {
      return {
        status: AccountIntegrityStatus.DelayMisconfigured,
        balance: BigInt(0),
      };
    }

    if (!evaluateDelayQueue(txNonceResult, queueNonceResult)) {
      return {
        status: AccountIntegrityStatus.DelayQueueNotEmpty,
        balance: BigInt(0),
      };
    }

    return {
      status: AccountIntegrityStatus.Ok,
      balance: extractBalance(allowanceResult, blockTimestampResult),
    };
  } catch (e) {
    return {
      status: AccountIntegrityStatus.UnexpectedError,
      balance: BigInt(0),
    };
  }
}

function evaluateOwners(
  { spender }: { spender: string },
  ownersResult: string,
  thresholdResult: string
) {
  if (BigInt(thresholdResult) !== BigInt(2)) {
    return false;
  }

  const { iface } = deployments.safeMastercopy;

  const [owners]: string[][] = iface.decodeFunctionResult(
    "getOwners",
    ownersResult
  );

  return (
    owners.length == 2 &&
    owners.map((m: string) => m.toLowerCase()).includes(spender.toLowerCase())
  );
}

function evaluateModules({ safe }: { safe: string }, result: string) {
  const { iface } = deployments.safeMastercopy;

  let [enabledModules]: string[][] = iface.decodeFunctionResult(
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

function evaluateRolesConfig(
  { eoa, safe }: { eoa: string; safe: string },
  rolesOwnerResult: string,
  allowanceResult: string
) {
  const abi = AbiCoder.defaultAbiCoder();
  const { iface } = deployments.rolesMastercopy;

  const [rolesOwner] = abi.decode(["address"], rolesOwnerResult);
  const forwarder = predictForwarderAddress({ eoa, safe });

  const [refill, maxBalance, period, balance, timestamp] =
    iface.decodeFunctionResult("allowances", allowanceResult);

  assert(typeof refill == "bigint");
  assert(typeof maxBalance == "bigint");
  assert(typeof period == "bigint");
  assert(typeof balance == "bigint");
  assert(typeof timestamp == "bigint");

  return rolesOwner === forwarder && period > 0 && refill > 0;
}

function evaluateDelayConfig(
  { safe, cooldown }: { safe: string; cooldown: bigint | number },
  ownerResult: string,
  cooldownResult: string
) {
  const abi = AbiCoder.defaultAbiCoder();
  const [owner] = abi.decode(["address"], ownerResult);

  // check that the safe is the owner of the delay mod
  return (
    owner.toLowerCase() == safe.toLowerCase() &&
    BigInt(cooldownResult) >= cooldown
  );
}

function evaluateDelayQueue(nonceResult: string, queueResult: string) {
  return nonceResult == queueResult;
}

function extractBalance(allowanceResult: string, blockTimestampResult: string) {
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
