export enum OperationType {
  Call = 0,
  DelegateCall = 1,
}

export interface TransactionData {
  to: string;
  value?: bigint | number;
  data: string;
}

export interface SafeTransactionData {
  to: string;
  value: bigint | number;
  data: string;
  operation: OperationType;
}

export type ExecutionConfig = {
  account: string;
  chainId: bigint | number;
  nonce: bigint | number;
};

export type AccountAddresses = {
  owner: string;
  safe: string;
};

export type AllowanceAddresses = {
  owner: string;
  spender: string;
  receiver: string;
};

export type AllowanceConfig = {
  amount: bigint | number;
  period: bigint | number;
};

export type AccountConfig = {
  owner: string;
  //** defaults for the allowance **/
  spender: string; // the gnosis signer
  receiver: string; // the settlement safe
  token: string; // the address of the token used for payments
  amount: bigint | number; // the allowance amount granted to spender
  period: number; // period after which an allowance will be replenished (IN SECONDS)
  //** for delay mod **/
  cooldown: number; // execution delay for owner before he execute transactions (IN SECONDS)
};

export type Transfer = {
  token: string;
  to: string;
  amount: bigint | number;
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

export enum RolesParameterType {
  None = 0,
  Static,
  Dynamic,
  Tuple,
  Array,
  Calldata,
  AbiEncoded,
}

export enum RolesExecutionOptions {
  None = 0,
  Send,
  DelegateCall,
  Both,
}

export enum RolesOperator {
  // 00:    EMPTY EXPRESSION (default, always passes)
  //          paramType: Static / Dynamic / Tuple / Array
  //          ❓ children (only for paramType: Tuple / Array to describe their structure)
  //          🚫 compValue
  /* 00: */ Pass = 0,
  // ------------------------------------------------------------
  // 01-04: LOGICAL EXPRESSIONS
  //          paramType: None
  //          ✅ children
  //          🚫 compValue
  /* 01: */ And,
  /* 02: */ Or,
  /* 03: */ Nor,
  /* 04: */ _Placeholder04,
  // ------------------------------------------------------------
  // 05-14: COMPLEX EXPRESSIONS
  //          paramType: Calldata / Tuple / Array,
  //          ✅ children
  //          🚫 compValue
  /* 05: */ Matches,
  /* 06: */ ArraySome,
  /* 07: */ ArrayEvery,
  /* 08: */ ArraySubset,
  /* 09: */ _Placeholder09,
  /* 10: */ _Placeholder10,
  /* 11: */ _Placeholder11,
  /* 12: */ _Placeholder12,
  /* 13: */ _Placeholder13,
  /* 14: */ _Placeholder14,
  // ------------------------------------------------------------
  // 15:    SPECIAL COMPARISON (without compValue)
  //          paramType: Static
  //          🚫 children
  //          🚫 compValue
  /* 15: */ EqualToAvatar,
  // ------------------------------------------------------------
  // 16-31: COMPARISON EXPRESSIONS
  //          paramType: Static / Dynamic / Tuple / Array
  //          ❓ children (only for paramType: Tuple / Array to describe their structure)
  //          ✅ compValue
  /* 16: */ EqualTo, // paramType: Static / Dynamic / Tuple / Array
  /* 17: */ GreaterThan, // paramType: Static
  /* 18: */ LessThan, // paramType: Static
  /* 19: */ SignedIntGreaterThan, // paramType: Static
  /* 20: */ SignedIntLessThan, // paramType: Static
  /* 21: */ Bitmask, // paramType: Static / Dynamic
  /* 22: */ Custom, // paramType: Static / Dynamic / Tuple / Array
  /* 23: */ _Placeholder23,
  /* 24: */ _Placeholder24,
  /* 25: */ _Placeholder25,
  /* 26: */ _Placeholder26,
  /* 27: */ _Placeholder27,
  /* 28: */ WithinAllowance, // paramType: Static
  /* 29: */ EtherWithinAllowance, // paramType: None
  /* 30: */ CallWithinAllowance, // paramType: None
  /* 31: */ _Placeholder31,
}
