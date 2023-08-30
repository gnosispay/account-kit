import deployments from "../../deployments";
import { AccountIntegrityStatus, AccountSetupConfig } from "../../types";
import { predictDelayAddress } from "../account-setup";

const AddressOne = "0x0000000000000000000000000000000000000001";

export function populateAccountIntegrityQuery(
  safeAddress: string,
  { spender, token }: AccountSetupConfig
): string {
  const multicallIface = deployments.multicall.iface;

  const { iface: safeIface } = deployments.safeMastercopy;
  const allowanceAddress = deployments.allowanceSingleton.address;
  const delayAddress = predictDelayAddress(safeAddress);

  const { iface: delayIface } = deployments.delayMastercopy;
  const { iface: allowanceIface } = deployments.allowanceSingleton;

  return multicallIface.encodeFunctionData("aggregate3", [
    [
      {
        target: safeAddress,
        allowFailure: true,
        callData: safeIface.encodeFunctionData("getModulesPaginated", [
          AddressOne,
          10,
        ]),
      },
      {
        target: delayAddress,
        allowFailure: true,
        callData: delayIface.encodeFunctionData("txCooldown"),
      },
      {
        target: delayAddress,
        allowFailure: true,
        callData: delayIface.encodeFunctionData("txNonce"),
      },
      {
        target: delayAddress,
        allowFailure: true,
        callData: delayIface.encodeFunctionData("queueNonce"),
      },
      {
        target: allowanceAddress,
        allowFailure: true,
        callData: allowanceIface.encodeFunctionData("getTokenAllowance", [
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
      return { status: AccountIntegrityStatus.UnexpectedError, amount: 0n };
    }

    const [
      [modulesSuccess, modulesResult],
      [txCooldownSuccess, txCooldownResult],
      [txNonceSuccess, txNonceResult],
      [queueNonceSuccess, queueNonceResult],
      [allowanceSuccess, allowanceResult],
    ] = resultList;

    if (modulesSuccess !== true) {
      return { status: AccountIntegrityStatus.SafeNotDeployed, amount: 0n };
    }
    if (allowanceSuccess !== true) {
      return {
        status: AccountIntegrityStatus.AllowanceNotDeployed,
        amount: 0n,
      };
    }
    if (
      txCooldownSuccess !== true ||
      txNonceSuccess !== true ||
      queueNonceSuccess != true
    ) {
      return { status: AccountIntegrityStatus.DelayNotDeployed, amount: 0n };
    }

    if (!evaluateModulesCall(modulesResult, safeAddress)) {
      return { status: AccountIntegrityStatus.SafeMisconfigured, amount: 0n };
    }

    if (!evaluateDelayCooldown(txCooldownResult, config)) {
      return { status: AccountIntegrityStatus.DelayMisconfigured, amount: 0n };
    }

    if (!evaluateDelayQueue(txNonceResult, queueNonceResult)) {
      return { status: AccountIntegrityStatus.DelayQueueNotEmpty, amount: 0n };
    }

    return {
      status: AccountIntegrityStatus.Ok,
      amount: extractCurrentAmount(allowanceResult),
    };
  } catch (e) {
    return { status: AccountIntegrityStatus.UnexpectedError, amount: 0n };
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

  return cooldown <= config.cooldown;
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
