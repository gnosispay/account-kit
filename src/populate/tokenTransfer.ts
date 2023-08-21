import { BigNumberish } from "ethers";
import { Interface } from "ethers/lib/utils.js";

import deployments from "../deployments";
import { predictSafeAddress } from "./accountCreation";
import { PopulatedTransaction } from "./PopulatedTransaction";
import makeSignatureInput from "../makeSignatureInput";
import { OperationType } from "../multisendEncode";

const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateTransferTokenTransaction(
  ownerAccount: string,
  chainId: number,
  { token, to, amount }: { token: string; to: string; amount: BigNumberish },
  signature: string
): PopulatedTransaction {
  const safeAddress = predictSafeAddress(ownerAccount);
  const safeInterface = new Interface(deployments.safe.abi);

  return {
    chainId,
    to: safeAddress,
    data: safeInterface.encodeFunctionData("execTransaction", [
      token,
      0,
      encodeERC20Transfer(to, amount),
      0,
      0,
      0,
      0,
      AddressZero,
      AddressZero,
      signature,
    ]),
  };
}

/*
 * This function constructs the parameters to be passed to
 * provider._signTypedData(domain, types, values)
 */
export function signTransferTokenParams(
  ownerAccount: string,
  chainId: number,
  { token, to, amount }: { token: string; to: string; amount: BigNumberish },
  nonce: BigNumberish
) {
  return makeSignatureInput(ownerAccount, chainId, {
    to: token,
    data: encodeERC20Transfer(to, amount),
    value: 0,
    operation: OperationType.Call,
    nonce,
  });
}

function encodeERC20Transfer(to: string, amount: BigNumberish) {
  const iface = new Interface([
    "function transfer(address recipient, uint256 amount)",
  ]);
  return iface.encodeFunctionData("transfer", [to, amount]);
}
