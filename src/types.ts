export interface TransactionRequest {
  to: string;
  value: bigint | number;
  data: string;
}

export interface SafeTransactionRequest {
  to: string;
  value: bigint | number;
  data: string;
  operation: OperationType;
}

export enum OperationType {
  Call = 0,
  DelegateCall = 1,
}

/**
 * callback that wraps an eip-712 signature. Library agnostic
 */
export type SignTypedDataCallback = (params: {
  domain: any;
  primaryType: any;
  types: any;
  message: any;
}) => Promise<string>;

export type Transfer = {
  token: string;
  to: string;
  amount: bigint | number;
};

export type SetupConfig = {
  spender: string; // spender safe
  receiver: string; // settlement safe
  token: string; // token contract address used for payments
  allowance: AllowanceConfig;
  delay: DelayConfig;
};

export type AllowanceConfig = {
  /// Duration, in seconds, before a refill occurs
  period: number;
  /// Amount added to balance after each period elapses.
  refill: bigint | number;
  /// Timestamp of the initial period start, useful for bringing the period in sync with the user's local timezone
  timestamp?: number;
};

export type DelayConfig = {
  /// Duration in seconds that should be required after a transaction is proposed
  cooldown: number;
  /// Duration in seconds that a proposed transaction is valid for after cooldown (or 0 if valid forever)
  expiration: number;
};

export type AccountQueryResult = {
  status: AccountIntegrityStatus;
  allowance: {
    balance: bigint;
    refill: bigint;
    period: bigint;
    nextRefill: bigint | null;
  };
};

export enum AccountIntegrityStatus {
  Ok,
  SafeNotDeployed,
  SafeMisconfigured,
  RolesNotDeployed,
  RolesMisconfigured,
  DelayNotDeployed,
  DelayMisconfigured,
  DelayQueueNotEmpty,
  UnexpectedError,
}
