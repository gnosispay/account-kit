import { Interface, ZeroAddress } from "ethers";
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
  const allowanceAddress = deployments.allowanceSingleton.defaultAddress;
  const allowanceInterface = new Interface(deployments.allowanceSingleton.abi);

  return {
    to: allowanceAddress,
    data: allowanceInterface.encodeFunctionData("executeAllowanceTransfer", [
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
