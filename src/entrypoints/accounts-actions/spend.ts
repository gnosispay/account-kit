import { concat, getAddress } from "ethers";

import { saltFromTimestamp } from "./execute";
import { IERC20__factory } from "../../../typechain-types";

import { SPENDING_ROLE_KEY } from "../../constants";
import deployments from "../../deployments";
import typedDataForModifierTransaction from "../../eip712";
import { predictRolesAddress } from "../../parts";

import {
  TransactionRequest,
  OperationType,
  SignTypedDataCallback,
  Transfer,
} from "../../types";

type SpendParameters = {
  /**
   * The address of the account
   */
  account: string;
  /*
   * ID associated with the current network.
   */
  chainId: number;
  /*
   * An optional bytes32 string that will be used for signature replay protection
   * (Should be omitted, and in that case, a random salt will be generated)
   */
  salt?: string;
};

/**
 * This function generates the spend payload to be submitted to the Roles Mod.
 *
 * @param parameters - {@link EnqueueParameters}
 * @param transfer - {@link Transfer}
 * @param sign - {@link SignTypedDataCallback}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateSpend } from "@gnosispay/account-kit";
 *
 * const spender: Signer = {};
 * const spendTx = await populateSpend(
 *  { account: `0x<address>`, chainId: `<number>` },
 *  { token: `0x<address>`, to: `0x<address>`, amount: `<bigint>` },
 *  // callback that wraps an eip-712 signature
 *  ({ domain, primaryType, types, message }) =>
 *    spender.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(spendTx);
 */
export default async function populateSpend(
  { account, chainId, salt }: SpendParameters,
  transfer: Transfer,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);
  salt = salt || saltFromTimestamp();

  const roles = {
    address: predictRolesAddress(account),
    iface: deployments.rolesMastercopy.iface,
  };

  const { to, value, data } = {
    to: roles.address,
    value: 0,
    data: roles.iface.encodeFunctionData("execTransactionWithRole", [
      transfer.token,
      0,
      IERC20__factory.createInterface().encodeFunctionData("transfer", [
        transfer.to,
        transfer.amount,
      ]),
      OperationType.Call,
      SPENDING_ROLE_KEY,
      true, // shouldRevert
    ]),
  };

  const { domain, primaryType, types, message } =
    typedDataForModifierTransaction(
      { modifier: roles.address, chainId },
      { data, salt }
    );

  const signature = await sign({ domain, primaryType, types, message });

  return { to, value, data: concat([data, salt, signature]) };
}
