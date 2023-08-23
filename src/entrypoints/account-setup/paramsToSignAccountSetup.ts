import { paramsToSignSafeTransaction } from "../../sign";
import { AllowanceConfig, DelayConfig } from "../../types";

import { populateInnerTransaction } from "./populateAccountSetupTransaction";

const AddressZero = "0x0000000000000000000000000000000000000000";

export default function paramsToSignAccountSetup(
  safeAddress: string,
  chainId: number,
  allowanceConfig: AllowanceConfig,
  delayConfig: DelayConfig,
  nonce: number | bigint
) {
  return paramsToSignSafeTransaction(
    safeAddress,
    chainId,
    populateInnerTransaction(safeAddress, allowanceConfig, delayConfig),
    nonce
  );
}
