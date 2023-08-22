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
  period: number; // in minutes: the period over which the allowance is reset
};

export type DelayConfig = {
  cooldown: number; // in seconds: the time that should be required before the transaction can be executed
};
