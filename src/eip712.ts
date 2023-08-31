import { ZeroAddress } from "ethers";
import { SafeTransactionData } from "./types";

/*
 * produces the parameters to be passed to signer_signTypedData()
 */

export function typedDataForSafeTransaction(
  safe: string,
  chainId: bigint | number,
  nonce: bigint | number,
  { to, value, data, operation }: SafeTransactionData
) {
  const domain = { verifyingContract: safe, chainId };
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
    to,
    value,
    data,
    operation,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ZeroAddress,
    refundReceiver: ZeroAddress,
    nonce,
  };

  return { domain, primaryType, types, message };
}

/*
 * Until the outcome of this issue https://github.com/safe-global/safe-modules/issues/70
 * isn't merged and deployed, we have to use EIP-191 signature instead of EIP-712
 */
// export function typedDataForAllowanceTransfer(
//   safeAddress: string,
//   chainId: number,
//   { token, to, amount }: { token: string; to: string; amount: number | bigint },
//   nonce: number
// ) {
//   const allowanceModAddress = deployments.allowanceSingleton.defaultAddress;

//   const domain = { chainId, verifyingContract: allowanceModAddress };
//   const primaryType = "AllowanceTransfer";
//   const types = {
//     AllowanceTransfer: [
//       { type: "address", name: "safe" },
//       { type: "address", name: "token" },
//       { type: "address", name: "to" },
//       { type: "uint96", name: "amount" },
//       { type: "address", name: "paymentToken" },
//       { type: "uint96", name: "payment" },
//       { type: "uint16", name: "nonce" },
//     ],
//   };
//   const message = {
//     safe: safeAddress,
//     token,
//     to,
//     amount,
//     paymentToken: AddressZero,
//     payment: 0,
//     nonce,
//   };

//   return { domain, primaryType, types, message };
// }
