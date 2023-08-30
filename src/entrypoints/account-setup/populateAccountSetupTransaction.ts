import { ZeroAddress, ZeroHash } from "ethers";

import deployments from "../../deployments";
import multisendEncode from "../../multisend";
import predictDelayAddress, { encodeSetUp } from "./predictDelayAddress";

import {
  AccountSetupConfig,
  SafeTransactionData,
  TransactionData,
} from "../../types";
import { typedDataForSafeTransaction } from "../../eip712";

export default function populateAccountSetupTransaction(
  safeAddress: string,
  config: AccountSetupConfig,
  signature: string
): TransactionData {
  const { iface } = deployments.safeMastercopy;

  const { to, data, value, operation } = populateSafeTransaction(
    safeAddress,
    config
  );

  return {
    to: safeAddress,
    data: iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      operation,
      0, // safeTxGas
      0, // baseGas
      0, // gasPrice
      ZeroAddress, // gasToken
      ZeroAddress, // gasRefund
      signature,
    ]),
    value: 0,
  };
}

export async function signAccountSetup(
  safeAddress: string,
  chainId: number,
  config: AccountSetupConfig,
  nonce: number | bigint,
  sign: (domain: any, types: any, message: any) => Promise<string>
) {
  const { domain, types, message } = typedDataForSafeTransaction(
    safeAddress,
    chainId,
    populateSafeTransaction(safeAddress, config),
    nonce
  );

  return sign(domain, types, message);
}

function populateSafeTransaction(
  safeAddress: string,
  config: AccountSetupConfig
): SafeTransactionData {
  const factory = deployments.moduleProxyFactory;
  const safeIface = deployments.safeMastercopy.iface;

  const allowanceIface = deployments.allowanceSingleton.iface;
  const allowanceAddress = deployments.allowanceSingleton.address;

  const delayIface = deployments.delayMastercopy.iface;
  const delayAddress = predictDelayAddress(safeAddress);
  const delayMastercopy = deployments.delayMastercopy.address;

  return multisendEncode([
    // configure spender on the allowance mod
    {
      to: allowanceAddress,
      data: allowanceIface.encodeFunctionData("addDelegate", [config.spender]),
    },
    // create an allowance entry for safe -> spender -> token
    {
      to: allowanceAddress,
      data: allowanceIface.encodeFunctionData("setAllowance", [
        config.spender,
        config.token,
        config.amount,
        config.period,
        0,
      ]),
    },
    // deploy the delay mod
    {
      to: factory.address,
      data: factory.iface.encodeFunctionData("deployModule", [
        delayMastercopy,
        encodeSetUp(safeAddress),
        ZeroHash,
      ]),
    },
    // configure cooldown on delay
    {
      to: delayAddress,
      data: delayIface.encodeFunctionData("setTxCooldown", [config.cooldown]),
    },
    // enable owner on the delay as module
    {
      to: delayAddress,
      data: delayIface.encodeFunctionData("enableModule", [config.owner]),
    },
    // enable allowance as module on safe
    {
      to: safeAddress,
      data: safeIface.encodeFunctionData("enableModule", [allowanceAddress]),
    },
    // enable delay as module on safe
    {
      to: safeAddress,
      data: safeIface.encodeFunctionData("enableModule", [delayAddress]),
    },
  ]);
}
