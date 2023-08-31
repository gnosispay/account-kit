import predictDelayAddress from "./predictDelayAddress";
import deployments from "../deployments";

import { AccountIntegrityStatus, AccountConfig } from "../types";

const AddressOne = "0x0000000000000000000000000000000000000001";

export default function populateAccountIntegrityQuery(
  safeAddress: string,
  { spender, token }: AccountConfig
): string {
  const safe = {
    address: safeAddress,
    iface: deployments.safeMastercopy.iface,
  };
  const allowance = deployments.allowanceSingleton;
  const delay = {
    address: predictDelayAddress(safeAddress),
    iface: deployments.delayMastercopy.iface,
  };

  return deployments.multicall.iface.encodeFunctionData("aggregate3", [
    [
      {
        target: safeAddress,
        allowFailure: true,
        callData: safe.iface.encodeFunctionData("getModulesPaginated", [
          AddressOne,
          10,
        ]),
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
        target: allowance.address,
        allowFailure: true,
        callData: allowance.iface.encodeFunctionData("getTokenAllowance", [
          safeAddress,
          spender,
          token,
        ]),
      },
    ],
  ]);
}

export function evaluateAccountIntegrityResult(
  functionResult: string,
  safeAddress: string,
  account: AccountConfig
): {
  status: AccountIntegrityStatus;
  allowance: { amount: bigint | number; nonce: bigint | number } | null;
} {
  try {
    const multicall = deployments.multicall.iface;

    const [aggregate3Result] = multicall.decodeFunctionResult(
      "aggregate3",
      functionResult
    );

    if (aggregate3Result.length !== 5) {
      return {
        status: AccountIntegrityStatus.UnexpectedError,
        allowance: null,
      };
    }

    const [
      [modulesSuccess, modulesResult],
      [txCooldownSuccess, txCooldownResult],
      [txNonceSuccess, txNonceResult],
      [queueNonceSuccess, queueNonceResult],
      [allowanceSuccess, allowanceResult],
    ] = aggregate3Result;

    if (modulesSuccess !== true) {
      return {
        status: AccountIntegrityStatus.SafeNotDeployed,
        allowance: null,
      };
    }
    if (allowanceSuccess !== true) {
      return {
        status: AccountIntegrityStatus.AllowanceNotDeployed,
        allowance: null,
      };
    }
    if (
      txCooldownSuccess !== true ||
      txNonceSuccess !== true ||
      queueNonceSuccess != true
    ) {
      return {
        status: AccountIntegrityStatus.DelayNotDeployed,
        allowance: null,
      };
    }

    if (!evaluateModulesCall(modulesResult, safeAddress)) {
      return {
        status: AccountIntegrityStatus.SafeMisconfigured,
        allowance: null,
      };
    }

    if (!evaluateDelayCooldown(txCooldownResult, account)) {
      return {
        status: AccountIntegrityStatus.DelayMisconfigured,
        allowance: null,
      };
    }

    if (!evaluateDelayQueue(txNonceResult, queueNonceResult)) {
      return {
        status: AccountIntegrityStatus.DelayQueueNotEmpty,
        allowance: null,
      };
    }

    return {
      status: AccountIntegrityStatus.Ok,
      allowance: extractCurrentAllowance(allowanceResult),
    };
  } catch (e) {
    return {
      status: AccountIntegrityStatus.UnexpectedError,
      allowance: null,
    };
  }
}

function evaluateModulesCall(
  result: string,
  safeAddress: string
  // { spender, token }: AccountConfig
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
  const delayAddress = predictDelayAddress(safeAddress).toLowerCase();
  const allowanceAddress = deployments.allowanceSingleton.address.toLowerCase();

  return (
    enabledModules.includes(delayAddress) &&
    enabledModules.includes(allowanceAddress)
  );
}

function evaluateDelayCooldown(cooldownResult: string, config: AccountConfig) {
  const { iface } = deployments.delayMastercopy;

  const [cooldown]: bigint[] = iface.decodeFunctionResult(
    "txCooldown",
    cooldownResult
  );

  return cooldown >= config.cooldown;
}

function evaluateDelayQueue(nonceResult: string, queueResult: string) {
  const { iface } = deployments.delayMastercopy;

  const [nonce] = iface.decodeFunctionResult("txNonce", nonceResult);
  const [queue] = iface.decodeFunctionResult("queueNonce", queueResult);

  return nonce == queue;
}

function extractCurrentAllowance(allowanceResult: string) {
  const { iface } = deployments.allowanceSingleton;

  const [[amount, spent, , , nonce]] = iface.decodeFunctionResult(
    "getTokenAllowance",
    allowanceResult
  );

  return {
    amount: (amount as bigint) - (spent as bigint),
    nonce: nonce as bigint,
  };
}
