import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { createSetupConfig, postFixture, preFixture } from "./test-helpers";
import {
  getAccountOwners,
  populateAccountCreation,
  populateAccountSetup,
  predictAccountAddress,
} from "../src";
import {
  SENTINEL_ADDRESS,
  populateAddOwnerDispatch,
  populateAddOwnerEnqueue,
} from "../src/entrypoints/accounts-actions/accountOwner";
import { predictDelayModAddress } from "../src/parts";
import { IDelayModifier__factory } from "../typechain-types";
import { getAddress } from "ethers";

const PERIOD = 12345;
const AMOUNT = 76543;
const COOLDOWN = 120;

describe.only("account-owner", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function setupAccount() {
    const [owner, spender, receiver, relayer] = await hre.ethers.getSigners();

    const erc20 = await (
      await hre.ethers.getContractFactory("TestERC20")
    ).deploy();

    const config = createSetupConfig({
      spender: spender.address,
      receiver: receiver.address,
      period: PERIOD,
      token: await erc20.getAddress(),
      allowance: AMOUNT,
      cooldown: COOLDOWN,
    });
    const account = predictAccountAddress({ owner: owner.address });

    const creationTx = populateAccountCreation({ owner: owner.address });
    const setupTx = await populateAccountSetup(
      { owner: owner.address, account, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      account,
      owner,
      spender,
      receiver,
      relayer,
      delayMod: IDelayModifier__factory.connect(
        predictDelayModAddress(account),
        relayer
      ),
      config,
    };
  }

  it.only("adds an account owner", async () => {
    const { account, owner, relayer, delayMod } =
      await loadFixture(setupAccount);

    const firstOwner = owner.address;
    const secondOwner = getAddress(
      "0x06b2729304C9c15CB1bA2df761455e474080CA19"
    ) as `0x${string}`;
    const enqueueTx = await populateAddOwnerEnqueue(
      { account, chainId: 31337 },
      secondOwner,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );
    const executeTx = populateAddOwnerDispatch(
      { account },
      "0x06b2729304C9c15CB1bA2df761455e474080CA19"
    );

    {
      // starts correctly configured
      const [owners] = await delayMod.getModulesPaginated(
        SENTINEL_ADDRESS,
        100
      );
      expect(owners).to.deep.equal([firstOwner]);
      // the owner of the delay mod is the safe
      expect(await delayMod.owner()).to.equal(account);
    }

    // dispatch the enqueue tx
    await relayer.sendTransaction(enqueueTx);

    {
      // no changes on owners yet, only enqueued
      const [owners] = await delayMod.getModulesPaginated(
        SENTINEL_ADDRESS,
        100
      );
      expect(owners).to.deep.equal([firstOwner]);
    }

    // we try to send the dispatch tx, but gets reverted before cooldown
    await expect(relayer.sendTransaction(executeTx)).to.be.revertedWith(
      "Transaction is still in cooldown"
    );
    await mine(2, { interval: 120 });

    // works after cooldown
    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;

    // second owner is now reflected
    const [owners] = await delayMod.getModulesPaginated(SENTINEL_ADDRESS, 100);
    expect(owners).to.deep.equal([secondOwner, owner.address]);
  });

  describe("getAccountOwners", () => {
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
