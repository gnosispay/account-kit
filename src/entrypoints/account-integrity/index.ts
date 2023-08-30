import { IMulticall__factory } from "../../../typechain-types";
import deployments from "../../deployments";
import { predictDelayAddress } from "../account-setup";

const AddressOne = "0x0000000000000000000000000000000000000001";

export function populateAccountIntegrityQuery(safeAddress: string): string {
  const mcIface = IMulticall__factory.createInterface();

  const { iface } = deployments.safeMastercopy;
  const allowanceAddress = deployments.allowanceSingleton.address;
  const delayAddress = predictDelayAddress(safeAddress);

  return mcIface.encodeFunctionData("aggregate3", [
    [
      {
        target: safeAddress,
        allowFailure: false,
        callData: iface.encodeFunctionData("getModulesPaginated", [
          AddressOne,
          1,
        ]),
      },
    ],
  ]);
}
