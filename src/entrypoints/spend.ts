import { concat, getAddress } from "ethers";

import { IERC20__factory } from "../../typechain-types";

import { SPENDING_ROLE_KEY } from "../constants";
import deployments from "../deployments";
import typedDataForModifierTransaction from "../eip712";
import { predictRolesAddress } from "../parts";

import {
  OperationType,
  SignTypedData,
  TransactionData,
  Transfer,
} from "../types";

export default async function populateSpend(
  {
    account,
    chainId,
    salt,
  }: { account: string; chainId: number; salt: string },
  transfer: Transfer,
  sign: SignTypedData
): Promise<TransactionData> {
  account = getAddress(account);

  const roles = {
    address: predictRolesAddress(account),
    iface: deployments.rolesMastercopy.iface,
  };

  const { to, value = 0, data } = populateSpendTransaction(account, transfer);

  const { domain, primaryType, types, message } =
    typedDataForModifierTransaction(
      { modifier: roles.address, chainId },
      { data, salt }
    );

  const signature = await sign({ domain, primaryType, types, message });

  return { to, value, data: concat([data, salt, signature]) };
}

function populateSpendTransaction(
  account: string,
  { token, to, amount }: Transfer
): TransactionData {
  const roles = {
    address: predictRolesAddress(account),
    iface: deployments.rolesMastercopy.iface,
  };

  return {
    to: roles.address,
    data: roles.iface.encodeFunctionData("execTransactionWithRole", [
      token,
      0,
      IERC20__factory.createInterface().encodeFunctionData("transfer", [
        to,
        amount,
      ]),
      OperationType.Call,
      SPENDING_ROLE_KEY,
      true, // shouldRevert
    ]),
  };
}
