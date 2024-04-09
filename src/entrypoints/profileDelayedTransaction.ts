import { TransactionRequest, getAddress } from "ethers";

import { IERC20__factory } from "../../typechain-types";
import deployments from "../deployments";
import { predictBouncerAddress, predictDelayModAddress } from "../parts";

export enum DelayedTransactionType {
  NativeTransfer,
  ERC20Transfer,
  LimitChange,
  AddOwner,
  RemoveOwner,
  Other,
}

/**
 * Given a transaction, presumably one that was or is to be posted to the
 * Delay Mod, it returns a rough transaction type
 *
 * @param {string} account - the account's safe address
 * @param transaction - {@link TransactionRequest}
 * @returns The InnerTransactionType {@link InnerTransactionType}
 *
 */
export default function profileDelayedTransaction(
  account: string,
  { to, value, data }: TransactionRequest
): DelayedTransactionType {
  const erc20 = {
    iface: IERC20__factory.createInterface(),
  };
  const rolesMod = deployments.rolesModMastercopy;

  if ((!data || data == "0x") && value) {
    return DelayedTransactionType.NativeTransfer;
  }

  if (data?.slice(0, 10) == erc20.iface.getFunction("transfer").selector) {
    return DelayedTransactionType.ERC20Transfer;
  }

  if (
    typeof to == "string" &&
    getAddress(to) == predictBouncerAddress(account) &&
    data?.slice(0, 10) == rolesMod.iface.getFunction("setAllowance").selector
  ) {
    return DelayedTransactionType.LimitChange;
  }

  const delayMod = deployments.delayModMastercopy;
  const delayModAddress = predictDelayModAddress(account);

  if (
    typeof to == "string" &&
    getAddress(to) == delayModAddress &&
    data?.slice(0, 10) == delayMod.iface.getFunction("enableModule").selector
  ) {
    return DelayedTransactionType.AddOwner;
  }

  if (
    typeof to == "string" &&
    getAddress(to) == delayModAddress &&
    data?.slice(0, 10) == delayMod.iface.getFunction("disableModule").selector
  ) {
    return DelayedTransactionType.RemoveOwner;
  }

  return DelayedTransactionType.Other;
}
