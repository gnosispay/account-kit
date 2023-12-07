import { ZeroAddress, getAddress } from "ethers";

import { IERC20__factory } from "../../../typechain-types";
import { SPENDING_ROLE_KEY } from "../../constants";
import deployments from "../../deployments";
import { typedDataForSafeTransaction } from "../../eip712";
import { predictRolesAddress } from "../../parts";

import {
  TransactionRequest,
  OperationType,
  SignTypedDataCallback,
  Transfer,
} from "../../types";

type SpendParameters = {
  /**
   * The address of the spender Safe
   */
  spender: string;
  /*
   * ID associated with the current network.
   */
  chainId: number;
  /*
   * The current on chain spender safe nonce value
   */
  nonce: number;
};

/**
 * This function generates the spend payload to be submitted to Spender Safe.
 *
 * @param parameters - {@link EnqueueParameters}
 * @param innerTx - {@link TransactionRequest}
 * @param sign - {@link SignTypedDataCallback}
 * @returns The signed transaction payload {@link TransactionRequest}
 *
 * @example
 * import { populateSpend } from "@gnosispay/account-kit";
 *
 * const signer: Signer = {}; // an owner in spender Safe
 * const spendTx = await populateSpend(
 *  { spender: `0x<address>`, chainId: `<number>`, nonce: `<number>` },
 *  { to: `0x<address>`, data: `0x<payload>`, amount: `<bigint>` },
 *  // callback that wraps an eip-712 signature
 *  ({ domain, primaryType, types, message }) =>
 *    spender.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(spendTx);
 */
export default async function populateSpend(
  { spender, chainId, nonce }: SpendParameters,
  { to, value, data }: TransactionRequest,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  spender = getAddress(spender);

  const { domain, primaryType, types, message } = typedDataForSafeTransaction(
    { safe: spender, chainId, nonce },
    { to, value, data, operation: OperationType.Call }
  );

  const signature = await sign({ domain, primaryType, types, message });

  const { iface } = deployments.safeMastercopy;
  return {
    to: spender,
    data: iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      OperationType.Call,
      0,
      0,
      0,
      ZeroAddress,
      ZeroAddress,
      signature,
    ]),
    value: 0,
  };
}

/**
 * This function generates the spend inner transaction that will be submitted to the Roles Mod.
 *
 * @param account - The Gnosis Pay Account Safe
 * @param transfer - {@link TransactionRequest}
 * @returns The inner transaction payload for spend {@link TransactionRequest}
 *
 * @example
 * import { createInnerSpendTransaction } from "@gnosispay/account-kit";
 *
 * const account = `0x<address>`;
 *
 * const spendTx = createInnerSpendTransaction(
 *  account,
 *  { token: `0x<address>`, to: `0x<address>`, amount: `<bigint>` },
 * );
 */
export function createInnerTransaction(
  account: string,
  transfer: Transfer
): TransactionRequest {
  account = getAddress(account);

  const roles = {
    address: predictRolesAddress(account),
    iface: deployments.rolesMastercopy.iface,
  };

  return {
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
}
