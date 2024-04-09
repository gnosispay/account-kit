import { expect } from "chai";
import { ZeroAddress } from "ethers";
import hre from "hardhat";
import {
  addAccountOwner,
  getAccountOwners,
  populateAccountCreation,
  predictAccountAddress,
} from "../src";
import { predictDelayModAddress } from "../src/parts";
import { IDelayModifier__factory } from "../typechain-types";

describe("account-owner", () => {
  describe("addAccountOwner", () => {
    it("returns the correct contract data for adding a new account owner", () => {
      expect(addAccountOwner(ZeroAddress)).to.equal(
        "0x610b59250000000000000000000000000000000000000000000000000000000000000000"
      );
    });
  });

  async function createAccount() {
    const [user, spender, receiver, relayer] = await hre.ethers.getSigners();

    const account = predictAccountAddress({ owner: user.address });
    const creationTx = populateAccountCreation({ owner: user.address });
    const delayModAddress = predictDelayModAddress(account);

    await relayer.sendTransaction(creationTx);

    return {
      user,
      spender,
      receiver,
      relayer,
      account,
      delayMod: IDelayModifier__factory.connect(
        delayModAddress,
        hre.ethers.provider
      ),
    };
  }

  describe("getAccountOwners", () => {
    it("given the callback to invoke a call on eth network, it provides it the proper encoded call and returns account owners", async () => {
      const account = await createAccount();

      const doEthCall = async (encodedFunctionCall: `0x${string}`) => {
        const decodedGetOwnersFunction =
          account.delayMod.interface.parseTransaction({
            data: encodedFunctionCall,
          });

        expect(decodedGetOwnersFunction?.name).to.equal("getModulesPaginated");

        return {
          data: "0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000030000000000000000000000007dda50eefac6081d66c8290941b6853a749c6a6f000000000000000000000000c8983516f545a341fc6c237cecd3079785d4643200000000000000000000000006b2729304c9c15cb1ba2df761455e474080ca19",
        };
      };

      const owners = await getAccountOwners(doEthCall);

      expect(owners).to.deep.equal([
        "0x7DdA50eefAc6081d66c8290941b6853A749c6A6f",
        "0xc8983516f545a341fc6C237cECd3079785d46432",
        "0x06b2729304C9c15CB1bA2df761455e474080CA19",
      ]);
    });
  });
});
