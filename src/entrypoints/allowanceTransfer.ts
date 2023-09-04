import { ZeroAddress } from "ethers";

import deployments from "../deployments";
import { hashForAllowanceTransfer } from "../eip191";
import { AllowanceTransfer, ExecutionConfig, TransactionData } from "../types";

export default async function populateAllowanceTransfer(
  { account, chainId, nonce }: ExecutionConfig,
  transfer: AllowanceTransfer,
  sign: (message: any) => Promise<string>
): Promise<TransactionData> {
  const { iface, address } = deployments.allowanceSingleton;

  const signature = await sign(
    hashForAllowanceTransfer(account, chainId, nonce, transfer)
  );

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
      signaturePatch(signature),
    ]),
    value: 0,
  };
}

// workaround https://github.com/safe-global/safe-modules/issues/70
function signaturePatch(signature: string) {
  const v = parseInt(signature.slice(130, 132), 16);
  return `${signature.slice(0, 130)}${Number(v + 4).toString(16)}`;
}
