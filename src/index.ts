import populateAccountCreation, {
  predictAccountAddress,
  populateDirectTransfer,
} from "./entrypoints/accountCreation";
import accountQuery from "./entrypoints/accountQuery";
import populateAccountSetup from "./entrypoints/accountSetup";
import {
  populateLimitEnqueue,
  populateLimitDispatch,
} from "./entrypoints/limit";
import populateSpend from "./entrypoints/spend";

function populateExecEnqueue() {}
function populateExecDispatch() {}

export * from "./types";

export {
  // populate transactions
  populateAccountCreation,
  populateAccountSetup,
  populateDirectTransfer,
  populateSpend,
  populateLimitEnqueue,
  populateLimitDispatch,
  populateExecEnqueue,
  populateExecDispatch,
  // predict account setup addresses
  predictAccountAddress,
  // integrity, status and info query
  accountQuery,
};
