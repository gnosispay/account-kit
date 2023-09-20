import assert from "assert";
import { AbiCoder } from "ethers";

import deployments from "../deployments";

import { AccountIntegrityStatus, TransactionData } from "../types";
import {
  ALLOWANCE_KEY,
  predictDelayAddress,
  predictRolesAddress,
} from "./predictModuleAddress";
import { predictForwarderAddress } from "./predictSingletonAddress";

const AddressOne = "0x0000000000000000000000000000000000000001";

export default function populateAccountQuery(
  account: string,
  { spender, token }: { spender: string; token: string }
): TransactionData {
  const safe = {
    address: account,
    iface: deployments.safeMastercopy.iface,
  };

  const delay = {
    address: predictDelayAddress(account),
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
    ],
  ]);

  return {
    to: multicall.address,
    data,
  };
}

export function evaluateAccountQuery(
  { owner, safe }: { owner: string; safe: string },
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

    if (aggregate3Result.length != 9) {
      return {
        status: AccountIntegrityStatus.UnexpectedError,
        balance: BigInt(0),
      };
    }

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
      !evaluateOwners(ownersResult, thresholdResult, spender) ||
      !evaluateModules({ owner, safe }, modulesResult)
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
      !evaluateRolesConfig({ owner, safe }, rolesOwnerResult, allowanceResult)
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
      !evaluateDelayConfig(delayOwnerResult, txCooldownResult, safe, cooldown)
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
      balance: extractBalance(allowanceResult),
    };
  } catch (e) {
    return {
      status: AccountIntegrityStatus.UnexpectedError,
      balance: BigInt(0),
    };
  }
}

function evaluateOwners(
  ownersResult: string,
  thresholdResult: string,
  spender: string
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

function evaluateModules(
  { owner, safe }: { owner: string; safe: string },
  result: string
) {
  const { iface } = deployments.safeMastercopy;

  let [enabledModules]: string[][] = iface.decodeFunctionResult(
    "getModulesPaginated",
    result
  );

  if (enabledModules.length !== 2) {
    return false;
  }

  enabledModules = enabledModules.map((m: string) => m.toLowerCase());
  const delayAddress = predictDelayAddress(safe).toLowerCase();
  const rolesAddress = predictRolesAddress(safe).toLowerCase();

  return (
    enabledModules.includes(delayAddress) &&
    enabledModules.includes(rolesAddress)
  );
}

function evaluateRolesConfig(
  { owner, safe }: { owner: string; safe: string },
  rolesOwnerResult: string,
  allowanceResult: string
) {
  const abi = AbiCoder.defaultAbiCoder();
  const { iface } = deployments.rolesMastercopy;

  const [rolesOwner] = abi.decode(["address"], rolesOwnerResult);
  const forwarder = predictForwarderAddress({ owner, safe });

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
  ownerResult: string,
  cooldownResult: string,
  safe: string,
  cooldown: bigint | number
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
  // const { iface } = deployments.delayMastercopy;
  // const [nonce] = iface.decodeFunctionResult("txNonce", nonceResult);
  // const [queue] = iface.decodeFunctionResult("queueNonce", queueResult);
  // return nonce == queue;
  return nonceResult == queueResult;
}

function extractBalance(allowanceResult: string) {
  const { iface } = deployments.allowanceSingleton;

  const [refill, maxBalance, period, balance, timestamp] =
    iface.decodeFunctionResult("allowances", allowanceResult);

  // todo put onchain math heref
  return balance;
}
