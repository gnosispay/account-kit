import { SPENDER_CREATION_NONCE } from "../../constants";
import { _populateSafeCreation } from "../../parts";
import { TransactionRequest } from "../../types";

type SpenderCreationParameters = {
  /**
   * The address of the owner EOA
   */
  owners: string[];
  /*
   * ID associated with the current network.
   */
  threshold: number;
  /*
   * The current nonce value of the Safe that is to be configured
   */
  creationNonce?: bigint;
};

export default function populateSpenderCreation({
  owners,
  threshold,
  creationNonce = SPENDER_CREATION_NONCE,
}: SpenderCreationParameters): TransactionRequest {
  return _populateSafeCreation({ owners, threshold, creationNonce });
}
