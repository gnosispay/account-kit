import assert from "assert";
import { AbiCoder, getAddress } from "ethers";

import { SPENDING_ALLOWANCE_KEY } from "../constants";
import deployments from "../deployments";
import {
  predictBouncerAddress,
  predictDelayAddress,
  predictRolesAddress,
} from "../parts";

import {
  AccountIntegrityStatus,
  AccountQueryResult,
  TransactionData,
} from "../types";

const AddressOne = "0x0000000000000000000000000000000000000001";
const empty = {
  allowance: {
    balance: BigInt(0),
    refill: BigInt(0),
    maxRefill: BigInt(0),
    period: BigInt(0),
    nextRefill: null,
  },
};

export default async function accountQuery(
  {
    account,
    cooldown,
  }: {
    account: string;
    cooldown: number;
  },
  doEthCall: (request: TransactionData) => Promise<string>
): Promise<AccountQueryResult> {
  account = getAddress(account);

  const request = createRequest(account);
  const resultData = await doEthCall(request);
  return evaluateResult(account, cooldown, resultData);
}

function createRequest(account: string): TransactionData {
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
          SPENDING_ALLOWANCE_KEY,
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

function evaluateResult(
  account: string,
  cooldown: number,
  resultData: string
): AccountQueryResult {
  try {
    const multicall = deployments.multicall.iface;

    const [aggregate3Result] = multicall.decodeFunctionResult(
      "aggregate3",
      resultData
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
        ...empty,
        status: AccountIntegrityStatus.SafeNotDeployed,
      };
    }

    if (
      !evaluateOwners(ownersResult, thresholdResult) ||
      !evaluateModules(account, modulesResult)
    ) {
      return {
        ...empty,
        status: AccountIntegrityStatus.SafeMisconfigured,
      };
    }

    if (rolesOwnerSuccess !== true || allowanceSuccess != true) {
      return {
        ...empty,
        status: AccountIntegrityStatus.RolesNotDeployed,
      };
    }

    if (!evaluateRolesConfig(account, rolesOwnerResult)) {
      return {
        ...empty,
        status: AccountIntegrityStatus.RolesMisconfigured,
      };
    }

    if (
      delayOwnerSuccess !== true ||
      txCooldownSuccess !== true ||
      txNonceSuccess !== true ||
      queueNonceSuccess != true
    ) {
      return {
        ...empty,
        status: AccountIntegrityStatus.DelayNotDeployed,
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
        ...empty,
        status: AccountIntegrityStatus.DelayMisconfigured,
      };
    }

    if (!evaluateDelayQueue(txNonceResult, queueNonceResult)) {
      return {
        ...empty,
        status: AccountIntegrityStatus.DelayQueueNotEmpty,
      };
    }

    return {
      ...empty,
      status: AccountIntegrityStatus.Ok,
      allowance: evaluateAllowance(allowanceResult, blockTimestampResult),
    };
  } catch (e) {
    return {
      ...empty,
      status: AccountIntegrityStatus.UnexpectedError,
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
  const bouncer = predictBouncerAddress(safe);

  return rolesOwner === bouncer;
}

function evaluateDelayConfig(
  safe: string,
  cooldown: number,
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

function evaluateAllowance(
  allowanceResult: string,
  blockTimestampResult: string
) {
  const { iface } = deployments.rolesMastercopy;

  const blockTimestamp = BigInt(blockTimestampResult);
  const [refill, maxRefill, period, balance, timestamp]: bigint[] =
    iface.decodeFunctionResult("allowances", allowanceResult);

  assert(typeof refill == "bigint");
  assert(typeof maxRefill == "bigint");
  assert(typeof period == "bigint");
  assert(typeof balance == "bigint");
  assert(typeof timestamp == "bigint");

  const allowance = {
    refill,
    maxRefill,
    period,
    balance,
    timestamp,
    blockTimestamp,
  };

  return {
    balance: accruedBalance(allowance),
    refill,
    maxRefill,
    period,
    nextRefill: nextRefill(allowance),
  };
}

interface AllowanceResult {
  balance: bigint;
  maxRefill: bigint;
  refill: bigint;
  period: bigint;
  timestamp: bigint;
  blockTimestamp: bigint;
}

function accruedBalance({
  refill,
  maxRefill,
  period,
  balance,
  timestamp,
  blockTimestamp,
}: AllowanceResult) {
  if (period == BigInt(0) || blockTimestamp < timestamp + period) {
    return balance;
  }

  if (balance >= maxRefill) {
    return balance;
  }

  const elapsedIntervals = (blockTimestamp - timestamp) / period;
  const balanceUncapped = balance + refill * elapsedIntervals;
  return balanceUncapped < maxRefill ? balanceUncapped : maxRefill;
}

function nextRefill({
  refill,
  period,
  timestamp,
  blockTimestamp,
}: AllowanceResult) {
  if (period == BigInt(0) || refill == BigInt(0)) {
    return null;
  }

  const elapsedIntervals = (blockTimestamp - timestamp) / period;
  return timestamp + (elapsedIntervals + BigInt(1)) * period;
}
