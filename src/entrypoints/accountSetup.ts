import { ZeroAddress, ZeroHash } from "ethers";

import predictDelayAddress, { encodeSetUp } from "./predictDelayAddress";
import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import multisendEncode from "../multisend";

import {
  AccountConfig,
  SafeTransactionData,
  TargetConfig,
  TransactionData,
} from "../types";

export default async function populateAccountSetup(
  target: TargetConfig,
  account: AccountConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const { iface } = deployments.safeMastercopy;

  const { to, data, value, operation } = populateSafeTransaction(
    target,
    account
  );

  const { domain, types, message } = typedDataForSafeTransaction(target, {
    to,
    data,
    value,
    operation,
  });

  const signature = await sign(domain, types, message);

  return {
    to: target.address,
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

function populateSafeTransaction(
  { address: safeAddress }: TargetConfig,
  { owner, spender, token, amount, period, cooldown }: AccountConfig
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
      data: allowanceIface.encodeFunctionData("addDelegate", [spender]),
    },
    // create an allowance entry for safe -> spender -> token
    {
      to: allowanceAddress,
      data: allowanceIface.encodeFunctionData("setAllowance", [
        spender,
        token,
        amount,
        period,
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
      data: delayIface.encodeFunctionData("setTxCooldown", [cooldown]),
    },
    // enable owner on the delay as module
    {
      to: delayAddress,
      data: delayIface.encodeFunctionData("enableModule", [owner]),
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
