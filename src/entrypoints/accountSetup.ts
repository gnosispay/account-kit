import { ZeroAddress, ZeroHash } from "ethers";

import predictDelayAddress, {
  encodeSetUp as encodeDelaySetUp,
} from "./predictDelayAddress";
import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import multisendEncode from "../multisend";

import {
  AccountConfig,
  SafeTransactionData,
  ExecutionConfig,
  TransactionData,
} from "../types";

export default async function populateAccountSetup(
  { account, chainId, nonce }: ExecutionConfig,
  config: AccountConfig,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const safe = {
    address: account,
    iface: deployments.safeMastercopy.iface,
  };

  const { to, data, value, operation } = populateSafeTransaction(
    safe.address,
    config
  );

  const { domain, types, message } = typedDataForSafeTransaction(
    safe.address,
    chainId,
    nonce,
    { to, data, value, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: safe.address,
    data: safe.iface.encodeFunctionData("execTransaction", [
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
  account: string,
  { owner, spender, token, amount, period, cooldown }: AccountConfig
): SafeTransactionData {
  const moduleProxyFactory = deployments.moduleProxyFactory;
  const safe = {
    address: account,
    iface: deployments.safeMastercopy.iface,
  };
  const allowance = deployments.allowanceSingleton;
  const delay = {
    address: predictDelayAddress(safe.address),
    iface: deployments.delayMastercopy.iface,
  };

  return multisendEncode([
    /**
     * CONFIG SAFE
     */
    // set add the gnosis signer, and set threshold to 2
    {
      to: safe.address,
      data: safe.iface.encodeFunctionData("addOwnerWithThreshold", [
        spender,
        2,
      ]),
    },
    // enable allowance as module on safe
    {
      to: safe.address,
      data: safe.iface.encodeFunctionData("enableModule", [allowance.address]),
    },
    // enable delay as module on safe
    {
      to: safe.address,
      data: safe.iface.encodeFunctionData("enableModule", [delay.address]),
    },
    /**
     * CONFIG ALLOWANCE
     */
    // configure spender on the allowance mod
    {
      to: allowance.address,
      data: allowance.iface.encodeFunctionData("addDelegate", [spender]),
    },
    // create an allowance entry for safe -> spender -> token
    {
      to: allowance.address,
      data: allowance.iface.encodeFunctionData("setAllowance", [
        spender,
        token,
        amount,
        period,
        0,
      ]),
    },
    /**
     * CONFIG DELAY
     */
    // actually deploy the delay mod proxy
    {
      to: moduleProxyFactory.address,
      data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
        deployments.delayMastercopy.address,
        encodeDelaySetUp(safe.address),
        ZeroHash,
      ]),
    },
    // configure cooldown on delay
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("setTxCooldown", [cooldown]),
    },
    // enable owner on the delay as module
    {
      to: delay.address,
      data: delay.iface.encodeFunctionData("enableModule", [owner]),
    },
  ]);
}
