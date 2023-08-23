import { Interface } from "ethers/lib/utils.js";
import { TransactionData } from "../../types";
import deployments from "../../deployments";

const AddressZero = "0x0000000000000000000000000000000000000000";

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
      AddressZero, // paymentToken
      0, // payment
      spender,
      signature,
    ]),
    value: 0,
  };
}
