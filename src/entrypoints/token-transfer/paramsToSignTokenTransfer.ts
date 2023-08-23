import { paramsToSignSafeTransaction } from "../../sign";
import { populateInnerTransaction } from "./populateTokenTransferTransaction";

/*
 * This function constructs the parameters to be passed to
 * provider._signTypedData(domain, types, values)
 */
export default function paramsToSignTokenTransfer(
  ownerAccount: string,
  chainId: number,
  { token, to, amount }: { token: string; to: string; amount: number | bigint },
  nonce: number | bigint
) {
  return paramsToSignSafeTransaction(
    ownerAccount,
    chainId,
    populateInnerTransaction({ token, to, amount }),
    nonce
  );
}
