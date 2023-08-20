import { BigNumberish } from "ethers";
import { Interface } from "ethers/lib/utils.js";
import { TransactionRequest } from "@ethersproject/providers";

import deployments from "./deployments";
import { predictSafeAddress } from "./relayAccountCreation";

const AddressZero = "0x0000000000000000000000000000000000000000";

export function populateTransferToken(
  ownerAccount: string,
  { token, to, amount }: { token: string; to: string; amount: BigNumberish },
  signature: string
): TransactionRequest {
  const safeAddress = predictSafeAddress(ownerAccount);
  const safeInterface = new Interface(deployments.safe.abi);

  return {
    chainId: 100,
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
export function signTypedData_parameters(
  ownerAccount: string,
  {
    token,
    to,
    amount,
  }: { token: `0x${string}`; to: `0x${string}`; amount: BigNumberish },
  nonce: BigNumberish
) {
  const safeAddress = predictSafeAddress(ownerAccount);

  const domain = { verifyingContract: safeAddress, chainId: 100 };
  const primaryType = "SafeTx" as const;
  const types = {
    SafeTx: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
      { type: "uint8", name: "operation" },
      { type: "uint256", name: "safeTxGas" },
      { type: "uint256", name: "baseGas" },
      { type: "uint256", name: "gasPrice" },
      { type: "address", name: "gasToken" },
      { type: "address", name: "refundReceiver" },
      { type: "uint256", name: "nonce" },
    ],
  };
  const message = {
    to: token,
    value: 0,
    data: encodeERC20Transfer(to, amount),
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: AddressZero,
    refundReceiver: AddressZero,
    nonce: nonce,
  };

  return { account: ownerAccount, domain, primaryType, types, message };
}

function encodeERC20Transfer(to: string, amount: BigNumberish) {
  const iface = new Interface([
    "function transfer(address recipient, uint256 amount)",
  ]);
  return iface.encodeFunctionData("transfer", [to, amount]);
}
