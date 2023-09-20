import { ZeroAddress } from "ethers";

import { typedDataForSafeTransaction } from "../eip712";
import deployments from "../deployments";

import {
  OperationType,
  SafeTransactionData,
  TransactionData,
  Transfer,
} from "../types";
import { IERC20__factory } from "../../typechain-types";

export default async function populateTokenTransfer(
  { safe, chainId, nonce }: { safe: string; chainId: number; nonce: number },
  transfer: Transfer,
  sign: (domain: any, types: any, message: any) => Promise<string>
): Promise<TransactionData> {
  const { iface } = deployments.safeMastercopy;

  const { to, value, data, operation } = populateSafeTransaction(transfer);

  const { domain, types, message } = typedDataForSafeTransaction(
    safe,
    chainId,
    nonce,
    { to, value, data, operation }
  );

  const signature = await sign(domain, types, message);

  return {
    to: safe,
    data: iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      operation,
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

function populateSafeTransaction({
  token,
  to,
  amount,
}: Transfer): SafeTransactionData {
  const iface = IERC20__factory.createInterface();
  return {
    to: token,
    data: iface.encodeFunctionData("transfer", [to, amount]),
    value: 0,
    operation: OperationType.Call,
  };
}
