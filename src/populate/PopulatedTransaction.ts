export type PopulatedTransaction = {
  to?: string;
  data?: string;
  value?: number | bigint;
  chainId?: number | bigint;
};
