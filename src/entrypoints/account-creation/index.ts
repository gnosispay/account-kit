import {
  Interface,
  ZeroAddress,
  ZeroHash,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import deployments from "../../deployments";
import { TransactionData } from "../../types";

export { default as predictSafeAddress } from "./predictSafeAddress";

export function populateAccountCreationTransaction(
  ownerAddress: string,
  seed: string = ZeroHash
): TransactionData {
  const proxyFactoryAddress = deployments.proxyFactory.defaultAddress;
  const mastercopyAddress = deployments.safe.defaultAddress;
  const proxyFactoryInterface = new Interface(deployments.proxyFactory.abi);

  return {
    to: proxyFactoryAddress,
    /*
     * Safe Proxy Creation works by calling proxy factory, and including an
     * embedded setup call (the initializer)
     */
    data: proxyFactoryInterface.encodeFunctionData("createProxyWithNonce", [
      mastercopyAddress,
      initializer(ownerAddress),
      saltNonce(seed),
    ]),
    value: 0,
  };
}

export function initializer(ownerAddress: string) {
  /*
   * The initializer contains the calldata that invokes the setup
   * function. This is what effectively sets up the proxy's storage
   * (owner/threshold etc, other safe config)
   *
   * This calldata will be sent embedded in the the createProxy call
   * at the SafeProxyFactory
   */

  const safeInterface = new Interface(deployments.safe.abi);
  const fallbackHandlerAddress =
    deployments.fallbackHandler.networkAddresses[100];

  const initializer = safeInterface.encodeFunctionData("setup", [
    // owners
    [ownerAddress],
    // threshold
    1,
    // to - for setupModules
    ZeroAddress,
    // data - for setupModules
    "0x",
    // fallbackHandler
    fallbackHandlerAddress,
    // paymentToken
    ZeroAddress,
    // payment
    0,
    // paymentReceiver
    ZeroAddress,
  ]);

  return initializer;
}

/*
 * NOTE seed was formerly process.env.NEXT_PUBLIC_SAFE_SALT_SEED
 */
export function saltNonce(seed: string) {
  return keccak256(toUtf8Bytes(seed));
}
