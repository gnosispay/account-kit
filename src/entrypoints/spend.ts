import { ZeroAddress } from "ethers";

import { IERC20__factory } from "../../typechain-types";
import { ROLE_SPENDING_KEY } from "../constants";

import deployments from "../deployments";
import { typedDataForSafeTransaction } from "../eip712";
import { predictRolesAddress, predictSpenderChannelAddress } from "../parts";

import { OperationType, TransactionData, Transfer } from "../types";

export default async function populateSpend(
  {
    safe,
    spender,
    chainId,
    nonce,
  }: { safe: string; spender: string; chainId: number; nonce: number },
  transfer: Transfer,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const channel = {
    address: predictSpenderChannelAddress({ safe, spender }),
    iface: deployments.safeMastercopy.iface,
  };
  const { to, value = 0, data } = populateSpendTransaction({ safe }, transfer);

  const { domain, types, message } = typedDataForSafeTransaction(
    channel.address,
    chainId,
    nonce,
    { to, value, data, operation: OperationType.Call }
  );

  const signature = await sign(domain, types, message);

  return {
    to: channel.address,
    data: channel.iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      OperationType.Call,
      0,
      0,
      0,
      ZeroAddress,
      ZeroAddress,
      signature,
    ]),
    value: 0,
  };
}

function populateSpendTransaction(
  { safe }: { safe: string },
  { token, to, amount }: Transfer
): TransactionData {
  const roles = {
    address: predictRolesAddress(safe),
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
      ROLE_SPENDING_KEY,
      true, // shouldRevert
    ]),
    value: 0,
  };
}
