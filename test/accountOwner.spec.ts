import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther } from "ethers";
import hre from "hardhat";
import { createSetupConfig, postFixture, preFixture } from "./test-helpers";
import {
  createInnerAddOwnerTransaction,
  getAccountOwners,
  populateAccountCreation,
  populateAccountSetup,
  predictAccountAddress,
} from "../src";
import { SPENDING_ALLOWANCE_KEY } from "../src/constants";
import {
  SENTINEL_ADDRESS,
  populateAddOwnerDispatch,
  populateAddOwnerEnqueue,
} from "../src/entrypoints/accounts-actions/accountOwner";
import { predictDelayModAddress } from "../src/parts";
import { IDelayModifier__factory } from "../typechain-types";

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

  describe("createInnerAddOwnerTransaction", () => {
    it("returns the correct contract for adding a new account owner", () => {
      expect(
        createInnerAddOwnerTransaction(
          ZeroAddress,
          "0x06b2729304C9c15CB1bA2df761455e474080CA19"
        )
      ).to.deep.equal({
        to: "0x0000000000000000000000000000000000000000",
        data: "0x610b592500000000000000000000000006b2729304c9c15cb1ba2df761455e474080ca19",
        value: 0,
      });
    });
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

    const enqueueTx = await populateAddOwnerEnqueue(
      { account, chainId: 31337 },
      "0x06b2729304C9c15CB1bA2df761455e474080CA19",
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    const [delayModOwnersBefore] = await delayMod.getModulesPaginated(
      SENTINEL_ADDRESS,
      100
    );
    expect(delayModOwnersBefore).to.deep.equal([
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    ]);

    const executeTx = populateAddOwnerDispatch(
      { account },
      "0x06b2729304C9c15CB1bA2df761455e474080CA19"
    );

    const delayModOwner = await delayMod.owner();
    expect(delayModOwner).to.equal(
      "0xD02D18dEE837Aaf0Fe687aAd520dFFc3cd39E375"
    );

    await relayer.sendTransaction(enqueueTx);

    // is reverted before cooldown
    await expect(relayer.sendTransaction(executeTx)).to.be.revertedWith(
      "Transaction is still in cooldown"
    );
    await mine(2, { interval: 120 });
    // works after cooldown
    await expect(relayer.sendTransaction(executeTx)).to.not.be.reverted;

    const [delayModOwnersAfter] = await delayMod.getModulesPaginated(
      SENTINEL_ADDRESS,
      100
    );

    expect(delayModOwnersAfter).to.deep.equal([
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "0xD02D18dEE837Aaf0Fe687aAd520dFFc3cd39E375",
    ]);
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
