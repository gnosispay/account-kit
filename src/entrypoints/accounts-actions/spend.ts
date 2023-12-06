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
   * The address of the account Safe
   */
  account: string;
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
 * const signer: Signer = {}; // an owner in spender Safe
 * const spendTx = await populateSpend(
 *  { account: `0x<address>`, spender: `0x<address>`, chainId: `<number>`, nonce: `<number>` },
 *  { token: `0x<address>`, to: `0x<address>`, amount: `<bigint>` },
 *  // callback that wraps an eip-712 signature
 *  ({ domain, primaryType, types, message }) =>
 *    spender.signTypedData(domain, primaryType, types, message)
 * );
 * await relayer.sendTransaction(spendTx);
 */
export default async function populateSpend(
  { account, spender, chainId, nonce }: SpendParameters,
  transfer: Transfer,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  account = getAddress(account);

  const roles = {
    address: predictRolesAddress(account),
    iface: deployments.rolesMastercopy.iface,
  };

  const { to, value, data, operation } = {
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
    operation: OperationType.Call,
  };

  const { domain, primaryType, types, message } = typedDataForSafeTransaction(
    { safe: spender, chainId, nonce },
    { to, value, data, operation }
  );

  const signature = await sign({ domain, primaryType, types, message });

  const { iface } = deployments.safeMastercopy;
  return {
    to: spender,
    data: iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      operation,
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
