import deployments from "../../deployments";
import { AccountIntegrityStatus, AccountSetupConfig } from "../../types";
import { predictDelayAddress } from "../account-setup";

const AddressOne = "0x0000000000000000000000000000000000000001";

export function populateAccountIntegrityQuery(
  safeAddress: string,
  { spender, token }: AccountSetupConfig
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

export function evaluateAccountIntegrityQuery(
  resultData: string,
  safeAddress: string,
  config: AccountSetupConfig
): { status: AccountIntegrityStatus; amount: bigint } {
  try {
    const multicall = deployments.multicall.iface;

    const [resultList] = multicall.decodeFunctionResult(
      "aggregate3",
      resultData
    );

    if (resultList.length !== 5) {
      return {
        status: AccountIntegrityStatus.UnexpectedError,
        amount: BigInt(0),
      };
    }

    const [
      [modulesSuccess, modulesResult],
      [txCooldownSuccess, txCooldownResult],
      [txNonceSuccess, txNonceResult],
      [queueNonceSuccess, queueNonceResult],
      [allowanceSuccess, allowanceResult],
    ] = resultList;

    if (modulesSuccess !== true) {
      return {
        status: AccountIntegrityStatus.SafeNotDeployed,
        amount: BigInt(0),
      };
    }
    if (allowanceSuccess !== true) {
      return {
        status: AccountIntegrityStatus.AllowanceNotDeployed,
        amount: BigInt(0),
      };
    }
    if (
      txCooldownSuccess !== true ||
      txNonceSuccess !== true ||
      queueNonceSuccess != true
    ) {
      return {
        status: AccountIntegrityStatus.DelayNotDeployed,
        amount: BigInt(0),
      };
    }

    if (!evaluateModulesCall(modulesResult, safeAddress)) {
      return {
        status: AccountIntegrityStatus.SafeMisconfigured,
        amount: BigInt(0),
      };
    }

    if (!evaluateDelayCooldown(txCooldownResult, config)) {
      return {
        status: AccountIntegrityStatus.DelayMisconfigured,
        amount: BigInt(0),
      };
    }

    if (!evaluateDelayQueue(txNonceResult, queueNonceResult)) {
      return {
        status: AccountIntegrityStatus.DelayQueueNotEmpty,
        amount: BigInt(0),
      };
    }

    return {
      status: AccountIntegrityStatus.Ok,
      amount: extractCurrentAmount(allowanceResult),
    };
  } catch (e) {
    return {
      status: AccountIntegrityStatus.UnexpectedError,
      amount: BigInt(0),
    };
  }
}

function evaluateModulesCall(
  result: string,
  safeAddress: string
  // { spender, token }: AccountSetupConfig
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

function evaluateDelayCooldown(
  cooldownResult: string,
  config: AccountSetupConfig
) {
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

function extractCurrentAmount(allowanceResult: string): bigint {
  const { iface } = deployments.allowanceSingleton;

  const [[amount, spent, , ,]] = iface.decodeFunctionResult(
    "getTokenAllowance",
    allowanceResult
  );

  return (amount as bigint) - (spent as bigint);
}
