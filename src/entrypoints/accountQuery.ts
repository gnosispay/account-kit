import predictDelayAddress from "./predictDelayAddress";
import deployments from "../deployments";

import {
  AccountIntegrityStatus,
  AccountConfig,
  TransactionData,
} from "../types";
import { IERC20__factory } from "../../typechain-types";

const AddressOne = "0x0000000000000000000000000000000000000001";

export default function populateAccountQuery(
  safeAddress: string,
  config: AccountConfig
): TransactionData {
  const safe = {
    address: safeAddress,
    iface: deployments.safeMastercopy.iface,
  };
  const allowance = deployments.allowanceSingleton;
  const delay = {
    address: predictDelayAddress(safeAddress),
    iface: deployments.delayMastercopy.iface,
  };

  const multicall = deployments.multicall;

  const data = multicall.iface.encodeFunctionData("aggregate3", [
    [
      {
        target: config.token,
        allowFailure: false,
        callData: IERC20__factory.createInterface().encodeFunctionData(
          "balanceOf",
          [safeAddress]
        ),
      },
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
          config.spender,
          config.token,
        ]),
      },
    ],
  ]);

  return {
    to: multicall.address,
    data,
  };
}

export function evaluateAccountQuery(
  safeAddress: string,
  config: AccountConfig,
  functionResult: string
): {
  status: AccountIntegrityStatus;
  detail: {
    allowance: { unspent: bigint; nonce: bigint };
    balance: bigint;
  } | null;
} {
  try {
    const multicall = deployments.multicall.iface;

    const [aggregate3Result] = multicall.decodeFunctionResult(
      "aggregate3",
      functionResult
    );

    if (aggregate3Result.length !== 6) {
      return {
        status: AccountIntegrityStatus.UnexpectedError,
        detail: null,
      };
    }

    const [
      [, balanceResult],
      [modulesSuccess, modulesResult],
      [txCooldownSuccess, txCooldownResult],
      [txNonceSuccess, txNonceResult],
      [queueNonceSuccess, queueNonceResult],
      [allowanceSuccess, allowanceResult],
    ] = aggregate3Result;

    if (modulesSuccess !== true || modulesSuccess !== true) {
      return {
        status: AccountIntegrityStatus.SafeNotDeployed,
        detail: null,
      };
    }
    if (allowanceSuccess !== true) {
      return {
        status: AccountIntegrityStatus.AllowanceNotDeployed,
        detail: null,
      };
    }
    if (
      txCooldownSuccess !== true ||
      txNonceSuccess !== true ||
      queueNonceSuccess != true
    ) {
      return {
        status: AccountIntegrityStatus.DelayNotDeployed,
        detail: null,
      };
    }

    if (!evaluateModulesCall(modulesResult, safeAddress)) {
      return {
        status: AccountIntegrityStatus.SafeMisconfigured,
        detail: null,
      };
    }

    if (!evaluateDelayCooldown(txCooldownResult, config)) {
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
      detail: extractDetail(balanceResult, allowanceResult),
    };
  } catch (e) {
    return {
      status: AccountIntegrityStatus.UnexpectedError,
      detail: null,
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

function extractDetail(balanceResult: string, allowanceResult: string) {
  const { iface } = deployments.allowanceSingleton;

  const [[amount, spent, , , nonce]] = iface.decodeFunctionResult(
    "getTokenAllowance",
    allowanceResult
  );

  return {
    balance: BigInt(balanceResult),
    allowance: {
      unspent: (amount as bigint) - (spent as bigint),
      nonce: nonce as bigint,
    },
  };
}
