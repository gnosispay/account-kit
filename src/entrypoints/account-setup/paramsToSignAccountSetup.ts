import { populateInnerTransaction } from "./populateAccountSetupTransaction";
import { paramsToSignSafeTransaction } from "../../sign";
import { AccountSetupConfig } from "../../types";

export default function paramsToSignAccountSetup(
  safeAddress: string,
  chainId: number,
  config: AccountSetupConfig,
  nonce: number | bigint = 0
) {
  return paramsToSignSafeTransaction(
    safeAddress,
    chainId,
    populateInnerTransaction(safeAddress, config),
    nonce
  );
}
