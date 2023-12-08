import { AbiCoder, ZeroHash } from "ethers";

import { _predictZodiacModAddress } from "./_zodiacMod";
import deployments from "../deployments";

import { TransactionRequest } from "../types";

export function predictRolesModAddress(safe: string): string {
  return _predictZodiacModAddress(
    deployments.rolesModMastercopy.address,
    encodeSetUp(safe)
  );
}

export function populateRolesModCreation(safe: string): TransactionRequest {
  const { moduleProxyFactory } = deployments;

  return {
    to: moduleProxyFactory.address,
    value: 0,
    data: moduleProxyFactory.iface.encodeFunctionData("deployModule", [
      deployments.rolesModMastercopy.address,
      encodeSetUp(safe),
      ZeroHash,
    ]),
  };
}

function encodeSetUp(safe: string) {
  const owner = safe;
  const avatar = safe;
  const target = safe;

  const initializer = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [owner, avatar, target]
  );

  return deployments.rolesModMastercopy.iface.encodeFunctionData("setUp", [
    initializer,
  ]);
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

export enum RolesConditionStatus {
  Ok,
  DelegateCallNotAllowed,
  TargetAddressNotAllowed,
  FunctionNotAllowed,
  SendNotAllowed,
  OrViolation,
  NorViolation,
  ParameterNotAllowed,
  ParameterLessThanAllowed,
  ParameterGreaterThanAllowed,
  ParameterNotAMatch,
  NotEveryArrayElementPasses,
  NoArrayElementPasses,
  ParameterNotSubsetOfAllowed,
  BitmaskOverflow,
  BitmaskNotAllowed,
  CustomConditionViolation,
  AllowanceExceeded,
  CallAllowanceExceeded,
  EtherAllowanceExceeded,
}
