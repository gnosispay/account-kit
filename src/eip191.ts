import {
  AbiCoder,
  getBytes,
  keccak256,
  solidityPacked,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";

import deployments from "./deployments";
import { AllowanceTransfer } from "./types";

/*
 *  This is a workaround implementation until  https://github.com/safe-global/safe-modules/issues/70
 */
export function hashForAllowanceTransfer(
  safe: string,
  chainId: bigint | number,
  nonce: bigint | number,
  { token, to, amount }: AllowanceTransfer
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
        safe,
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
