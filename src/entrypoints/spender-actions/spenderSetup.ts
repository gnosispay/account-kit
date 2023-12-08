import { ZeroAddress, getAddress } from "ethers";
import deployments from "../../deployments";
import { typedDataForSafeTransaction } from "../../eip712";
import multisendEncode from "../../multisend";
import {
  populateSpenderModCreation,
  predictSpenderModAddress,
} from "../../parts";

import {
  SafeTransactionRequest,
  SignTypedDataCallback,
  TransactionRequest,
} from "../../types";

type SpenderSetupParameters = {
  /**
   * The address of the Gnosis Pay Spender Safe
   */
  spender: string;
  /*
   * The current nonce value of the Safe that is to be configured
   */
  delegate: string;
  /*
   * ID associated with the current network.
   */
  chainId: number;
  /*
   * The current nonce value of the Safe that is to be configured
   */
  nonce: number;
};

export default async function populateSpenderSetup(
  { spender, delegate, chainId, nonce }: SpenderSetupParameters,
  sign: SignTypedDataCallback
): Promise<TransactionRequest> {
  spender = getAddress(spender);
  delegate = getAddress(delegate);

  const { iface } = deployments.safeMastercopy;

  const { to, data, value, operation } = createInnerTransaction({
    spender,
    delegate,
  });

  const { domain, primaryType, types, message } = typedDataForSafeTransaction(
    { safe: spender, chainId, nonce },
    { to, data, value, operation }
  );

  const signature = await sign({ domain, primaryType, types, message });

  return {
    to: spender,
    value: 0,
    data: iface.encodeFunctionData("execTransaction", [
      to,
      value,
      data,
      operation,
      0, // safeTxGas
      0, // baseGas
      0, // gasPrice
      ZeroAddress, // gasToken
      ZeroAddress, // gasRefund
      signature,
    ]),
  };
}

function createInnerTransaction({
  spender,
  delegate,
}: {
  spender: string;
  delegate: string;
}): SafeTransactionRequest {
  const spenderMod = {
    address: predictSpenderModAddress(spender),
    iface: deployments.spenderModMastercopy.iface,
  };

  return multisendEncode([
    // enable spender modifier in spender safe
    {
      to: spender,
      value: 0,
      data: spenderMod.iface.encodeFunctionData("enableModule", [
        spenderMod.address,
      ]),
    },
    // deploy the spender modifier
    populateSpenderModCreation(spender),
    // enable delegate in spenderModifier
    {
      to: spenderMod.address,
      value: 0,
      data: spenderMod.iface.encodeFunctionData("enableModule", [delegate]),
    },
  ]);
}
