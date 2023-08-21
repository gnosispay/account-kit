export enum OperationType {
  Call = 0,
  DelegateCall = 1,
}

export interface TransactionData {
  to: string;
  value: bigint | number;
  data: string;
}

export interface SafeTransactionData {
  to: string;
  value: bigint | number;
  data: string;
  operation: OperationType;
}

export type AllowanceConfig = {
  spender: string; // the gnosis signer aka allowance delegate
  token: string; // the address of the ERC20 token we're allowing
  amount: number | bigint; // the allowed amount
  period: number; // the period in minutes over which the allowance is reset
};
