import { ZeroAddress } from "ethers";
import deployments from "../../deployments";
import { TransactionData } from "../../types";

export default function populateAllowanceTransferTransaction(
  safeAddress: string,
  {
    spender,
    token,
    to,
    amount,
  }: { spender: string; token: string; to: string; amount: number | bigint },
  signature: string
): TransactionData {
  const { iface, address } = deployments.allowanceSingleton;
  return {
    to: address,
    data: iface.encodeFunctionData("executeAllowanceTransfer", [
      safeAddress,
      token,
      to,
      amount,
      ZeroAddress, // paymentToken
      0, // payment
      spender,
      signature,
    ]),
    value: 0,
  };
}
