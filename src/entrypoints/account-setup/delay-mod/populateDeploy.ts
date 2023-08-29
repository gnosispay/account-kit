import { ZeroHash } from "ethers";
import { encodeSetUp } from "./predictAddress";
import deployments from "../../../deployments";
import { TransactionData } from "../../../types";

export default function populateDelayDeploy(
  safeAddress: string
): TransactionData {
  const { iface, address: factory } = deployments.moduleProxyFactory;
  const mastercopy = deployments.delayMastercopy.address;

  const saltNonce = ZeroHash;

  return {
    to: factory,
    data: iface.encodeFunctionData("deployModule", [
      mastercopy,
      encodeSetUp(safeAddress),
      saltNonce,
    ]),
    value: 0,
  };
}
