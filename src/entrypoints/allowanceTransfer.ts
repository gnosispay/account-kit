import { SPENDING_ROLE_KEY, predictRolesAddress } from "./predictModuleAddress";
import { IERC20__factory } from "../../typechain-types";
import deployments from "../deployments";
import { TransactionData, Transfer } from "../types";

export default function populateAllowanceTransfer(
  { safe }: { safe: string },
  { token, to, amount }: Transfer
): TransactionData {
  const { iface } = deployments.rolesMastercopy;
  const address = predictRolesAddress(safe);

  return {
    to: address,
    data: iface.encodeFunctionData("execTransactionWithRole", [
      token,
      0,
      IERC20__factory.createInterface().encodeFunctionData("transfer", [
        to,
        amount,
      ]),
      0, // operation
      SPENDING_ROLE_KEY,
      true, // shouldRevert
    ]),
  };
}
