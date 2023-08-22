import { TransactionData } from "../../types";
import {
  BYTES32_ZERO,
  DELAY_MASTERCOPY_ADDRESS,
  MODULE_FACTORY_ADDRESS,
  MODULE_FACTORY_INTERFACE,
} from "./constants";
import { encodeSetUp } from "./predictAddress";

export default function populateDelayDeploy(
  safeAddress: string
): TransactionData {
  const factoryIface = MODULE_FACTORY_INTERFACE;
  const mastercopy = DELAY_MASTERCOPY_ADDRESS;
  const factory = MODULE_FACTORY_ADDRESS;

  const saltNonce = BYTES32_ZERO;

  return {
    to: factory,
    data: factoryIface.encodeFunctionData("deployModule", [
      mastercopy,
      encodeSetUp(safeAddress),
      saltNonce,
    ]),
    value: 0,
  };
}
