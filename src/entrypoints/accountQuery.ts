import assert from "assert";
import { AbiCoder } from "ethers";
import predictDelayAddress from "./predictDelayAddress";
import deployments from "../deployments";

import { AccountIntegrityStatus, TransactionData } from "../types";

const AddressOne = "0x0000000000000000000000000000000000000001";

export default function populateAccountQuery(
  account: string,
  { spender, token }: { spender: string; token: string }
): TransactionData {
  const safe = {
    address: account,
    iface: deployments.safeMastercopy.iface,
  };
  const allowance = deployments.allowanceSingleton;
  const delay = {
    address: predictDelayAddress(account),
    iface: deployments.delayMastercopy.iface,
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
        target: allowance.address,
        allowFailure: true,
        callData: allowance.iface.encodeFunctionData("getTokenAllowance", [
          safe.address,
          spender,
          token,
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
    ],
  ]);

  return {
    to: multicall.address,
    data,
  };
}

export function evaluateAccountQuery(
  account: string,
  { spender, cooldown }: { spender: string; cooldown: bigint | number },
  functionResult: string
): {
  status: AccountIntegrityStatus;
  detail: {
    allowance: { unspent: bigint; nonce: bigint };
  } | null;
} {
  try {
    const multicall = deployments.multicall.iface;

    const [aggregate3Result] = multicall.decodeFunctionResult(
      "aggregate3",
      functionResult
    );

    if (aggregate3Result.length !== 8) {
      return {
        status: AccountIntegrityStatus.UnexpectedError,
        detail: null,
      };
    }

    const [
      [ownersSuccess, ownersResult],
      [thresholdSuccess, thresholdResult],
      [modulesSuccess, modulesResult],
      [, allowanceResult],
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
        detail: null,
      };
    }

    if (!evaluateOwners(ownersResult, thresholdResult, spender)) {
      return {
        status: AccountIntegrityStatus.SafeMisconfigured,
        detail: null,
      };
    }

    if (!evaluateModules(modulesResult, account)) {
      return {
        status: AccountIntegrityStatus.SafeMisconfigured,
        detail: null,
      };
    }

    if (!evaluateAllowance(allowanceResult)) {
      return {
        status: AccountIntegrityStatus.AllowanceMisconfigured,
        detail: null,
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
        detail: null,
      };
    }

    if (
      !evaluateDelayConfig(
        delayOwnerResult,
        txCooldownResult,
        account,
        cooldown
      )
    ) {
      return {
        status: AccountIntegrityStatus.DelayMisconfigured,
        detail: null,
      };
    }

    if (!evaluateDelayQueue(txNonceResult, queueNonceResult)) {
      return {
        status: AccountIntegrityStatus.DelayQueueNotEmpty,
        detail: null,
      };
    }

    return {
      status: AccountIntegrityStatus.Ok,
      detail: extractDetail(allowanceResult),
    };
  } catch (e) {
    return {
      status: AccountIntegrityStatus.UnexpectedError,
      detail: null,
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

function evaluateModules(result: string, safeAddress: string) {
  const { iface } = deployments.safeMastercopy;

  let [enabledModules]: string[][] = iface.decodeFunctionResult(
    "getModulesPaginated",
    result
  );

  if (enabledModules.length !== 2) {
    return false;
  }

  enabledModules = enabledModules.map((m: string) => m.toLowerCase());
  const delayAddress = predictDelayAddress(safeAddress).toLowerCase();
  const allowanceAddress = deployments.allowanceSingleton.address.toLowerCase();

  return (
    enabledModules.includes(delayAddress) &&
    enabledModules.includes(allowanceAddress)
  );
}

function evaluateDelayConfig(
  ownerResult: string,
  cooldownResult: string,
  account: string,
  cooldown: bigint | number
) {
  const abi = AbiCoder.defaultAbiCoder();
  const [owner] = abi.decode(["address"], ownerResult);

  // check that the safe is the owner of the delay mod
  return (
    owner.toLowerCase() == account.toLowerCase() &&
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

function evaluateAllowance(allowanceResult: string) {
  const { iface } = deployments.allowanceSingleton;

  const [[amount, , , , nonce]] = iface.decodeFunctionResult(
    "getTokenAllowance",
    allowanceResult
  );

  assert(typeof amount == "bigint");
  assert(typeof nonce == "bigint");

  // means an allowance exists for spender
  return amount > 0 && nonce > 0;
}

function extractDetail(allowanceResult: string) {
  const { iface } = deployments.allowanceSingleton;

  const [[amount, spent, , , nonce]] = iface.decodeFunctionResult(
    "getTokenAllowance",
    allowanceResult
  );

  return {
    allowance: {
      unspent: (amount as bigint) - (spent as bigint),
      nonce: nonce as bigint,
    },
  };
}
