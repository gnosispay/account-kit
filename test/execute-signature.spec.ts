import { expect } from "chai";
import { Signature, Wallet, concat } from "ethers";

import { generateTypedData, getTransactionRequest } from "../src";

describe("EOA signature normalization", () => {
  const wallet = new Wallet("0x" + "11".repeat(32));
  const transaction = { to: wallet.address, value: 0, data: "0x" };
  const { domain, types, message } = generateTypedData(
    { account: wallet.address, chainId: 31337 },
    transaction
  );
  const request = (signature: string, smartWalletAddress?: string) =>
    getTransactionRequest({
      account: wallet.address,
      transaction,
      message,
      signature,
      smartWalletAddress,
    });

  for (const parity of [0, 1]) {
    it(`normalizes parity ${parity} and preserves v = ${
      parity + 27
    }`, async () => {
      const signed = Signature.from(
        await wallet.signTypedData(domain, types, message)
      );
      const normalized = Signature.from({
        r: signed.r,
        s: signed.s,
        v: parity + 27,
      }).serialized;
      const raw =
        normalized.slice(0, -2) + parity.toString(16).padStart(2, "0");
      expect(request(raw)).to.deep.equal(request(normalized));
      expect(request(raw).data.endsWith(normalized.slice(2))).to.equal(true);
    });

    it(`preserves contract signature ending in ${parity}`, () => {
      const raw = "0x" + "aa".repeat(64) + parity.toString(16).padStart(2, "0");
      expect(request(raw, wallet.address).data).to.include(
        concat([raw, message.salt]).slice(2)
      );
    });
  }

  it("rejects malformed EOA signatures", () => {
    expect(() => request("0x1234")).to.throw();
  });
});
