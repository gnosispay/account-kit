import {
  AbiCoder,
  ZeroAddress,
  getBytes,
  keccak256,
  solidityPacked,
  toUtf8Bytes,
} from "ethers";
import deployments from "../../deployments";

/*
 * Until the outcome of this issue https://github.com/safe-global/safe-modules/issues/70
 * isn't merged and deployed, we have to use EIP-191 signature instead of EIP-712
 */
// export default function (
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

/*
 *  This is a workaround implementation until  https://github.com/safe-global/safe-modules/issues/70
 * gets deployed
 */
export default function (
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
        ZeroAddress, //paymentToken
        0, // payment,
        nonce,
      ]
    )
  );

  return {
    message: getBytes(
      keccak256(
        solidityPacked(
          ["bytes1", "bytes1", "bytes32", "bytes32"],
          ["0x19", "0x01", domainSeparator, transferHash]
        )
      )
    ),
  };
}

// https://github.com/safe-global/safe-modules/issues/70
export function signaturePatch(signature: string) {
  const v = parseInt(signature.slice(130, 132), 16);
  return `${signature.slice(0, 130)}${Number(v + 4).toString(16)}`;
}
