import { ZeroAddress } from "ethers";

import deployments from "../deployments";
import { AllowanceTransfer, TransactionData } from "../types";

export default function populateAllowanceTransfer(
  account: string,
  transfer: AllowanceTransfer
): TransactionData {
  const { iface, address } = deployments.allowanceSingleton;

  return {
    to: address,
    data: iface.encodeFunctionData("executeAllowanceTransfer", [
      account,
      transfer.token,
      transfer.to,
      transfer.amount,
      ZeroAddress, // paymentToken
      0, // payment
      transfer.spender,
      "0x",
    ]),
  };
}

// // workaround https://github.com/safe-global/safe-modules/issues/70
// function signaturePatch(signature: string) {
//   const v = parseInt(signature.slice(130, 132), 16);
//   return `${signature.slice(0, 130)}${Number(v + 4).toString(16)}`;
// }
