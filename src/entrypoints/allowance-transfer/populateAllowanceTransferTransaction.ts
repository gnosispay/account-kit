import {
  getBytes,
  solidityPacked,
  keccak256,
  ZeroAddress,
  AbiCoder,
  toUtf8Bytes,
} from "ethers";

import deployments from "../../deployments";
import { TransactionData } from "../../types";

export default function populateAllowanceTransferTransaction(
  safeAddress: string,
  {
    spender,
    token,
    to,
    amount,
  }: { spender: string; token: string; to: string; amount: number | bigint },
  signature: string
): TransactionData {
  const { iface, address } = deployments.allowanceSingleton;
  return {
    to: address,
    data: iface.encodeFunctionData("executeAllowanceTransfer", [
      safeAddress,
      token,
      to,
      amount,
      ZeroAddress, // paymentToken
      0, // payment
      spender,
      signature,
    ]),
    value: 0,
  };
}

export async function signAllowanceTransfer(
  safeAddress: string,
  chainId: number,
  { token, to, amount }: { token: string; to: string; amount: number | bigint },
  nonce: number,
  sign: (message: string | Uint8Array) => Promise<string>
): Promise<string> {
  const hash = transferHash(safeAddress, chainId, { token, to, amount }, nonce);
  const signature = await sign(hash);

  return signaturePatch(signature);
}

/*
 *  This is a workaround implementation until  https://github.com/safe-global/safe-modules/issues/70
 * gets deployed
 */
function transferHash(
  safeAddress: string,
  chainId: number,
  { token, to, amount }: { token: string; to: string; amount: number | bigint },
  nonce: number
) {
  const abi = AbiCoder.defaultAbiCoder();
  const verifyingContract = deployments.allowanceSingleton.address;

  const DOMAIN_SEPARATOR_TYPEHASH = keccak256(
    toUtf8Bytes("EIP712Domain(uint256 chainId,address verifyingContract)")
  );
  const ALLOWANCE_TRANSFER_TYPEHASH = keccak256(
    toUtf8Bytes(
      "AllowanceTransfer(address safe,address token,uint96 amount,address paymentToken,uint96 payment,uint16 nonce)"
    )
  );

  const domainSeparator = keccak256(
    abi.encode(
      ["bytes32", "uint256", "address"],
      [DOMAIN_SEPARATOR_TYPEHASH, chainId, verifyingContract]
    )
  );

  const transferHash = keccak256(
    abi.encode(
      [
        "bytes32",
        "address",
        "address",
        "address",
        "uint96",
        "address",
        "uint96",
        "uint16",
      ],
      [
        ALLOWANCE_TRANSFER_TYPEHASH,
        safeAddress,
        token,
        to,
        amount,
        ZeroAddress,
        0,
        nonce,
      ]
    )
  );

  return getBytes(
    keccak256(
      solidityPacked(
        ["bytes1", "bytes1", "bytes32", "bytes32"],
        ["0x19", "0x01", domainSeparator, transferHash]
      )
    )
  );
}

// https://github.com/safe-global/safe-modules/issues/70
export function signaturePatch(signature: string) {
  const v = parseInt(signature.slice(130, 132), 16);
  return `${signature.slice(0, 130)}${Number(v + 4).toString(16)}`;
}
