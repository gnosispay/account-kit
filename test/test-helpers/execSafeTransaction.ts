import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TransactionRequest, ZeroAddress } from "ethers";

import { ISafe } from "../../typechain-types";

export default async function execSafeTransaction(
  safe: ISafe,
  { to, data, value = 0 }: TransactionRequest,
  signers: SignerWithAddress[]
) {
  const address = await safe.getAddress();
  const chainId = await safe.getChainId();
  const nonce = await safe.nonce();

  const { domain, types, message } = paramsToSign(
    address,
    chainId,
    { to, data, value },
    nonce
  );

  const signatures = await Promise.all(
    [...signers]
      .sort((s1, s2) =>
        s1.address.toLowerCase() < s2.address.toLowerCase() ? -1 : 1
      )
      .map((signer) => signer.signTypedData(domain, types, message))
  );

  const signature = `0x${signatures
    .map((signature) => signature.slice(2))
    .join("")}`;

  return safe.execTransaction(
    to as string,
    value as number | bigint,
    data as string,
    0, // operation
    0,
    0,
    0,
    ZeroAddress,
    ZeroAddress,
    signature
  );
}

function paramsToSign(
  address: string,
  chainId: bigint,
  { to, data, value }: TransactionRequest,
  nonce: bigint | number
) {
  const domain = { verifyingContract: address, chainId };
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
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ZeroAddress,
    refundReceiver: ZeroAddress,
    nonce,
  };

  return { domain, primaryType, types, message };
}
