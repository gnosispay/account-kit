import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import {
  createSetupConfig,
  postFixture,
  preFixture,
} from "./test-helpers/index";

import {
  populateAccountCreation,
  populateAccountSetup,
  populateExecuteEnqueue,
  getTransactionRequest,
  generateTypedData,
  predictAccountAddress,
} from "../src";

import { predictDelayModAddress } from "../src/parts";
import {
  IDelayModifier__factory,
  ISafe__factory,
  RealERC1271Wallet,
} from "../typechain-types";

describe("execute with ERC1271 signatures", () => {
  before(async () => {
    await preFixture();
  });

  after(async () => {
    await postFixture();
  });

  async function setupAccountWithERC1271() {
    const [owner, relayer, other] = await hre.ethers.getSigners();

    // Deploy real ERC1271 wallet
    const RealERC1271WalletFactory =
      await hre.ethers.getContractFactory("RealERC1271Wallet");
    const realWallet = (await RealERC1271WalletFactory.deploy(
      owner.address
    )) as unknown as RealERC1271Wallet;
    const realWalletAddress = await realWallet.getAddress();

    const config = createSetupConfig({
      cooldown: 120, // 2 minutes
      expiration: 300, // 5 minutes
    });

    const account = predictAccountAddress({ owner: owner.address });
    const delayAddress = predictDelayModAddress(account);

    // Create and setup the account
    const creationTx = populateAccountCreation({ owner: owner.address });
    const setupTx = await populateAccountSetup(
      { account, owner: owner.address, chainId: 31337, nonce: 0 },
      config,
      ({ domain, types, message }) =>
        owner.signTypedData(domain, types, message)
    );

    await relayer.sendTransaction(creationTx);
    await relayer.sendTransaction(setupTx);

    return {
      account,
      owner,
      relayer,
      other,
      realWallet,
      realWalletAddress,
      safe: ISafe__factory.connect(account, relayer),
      delay: IDelayModifier__factory.connect(delayAddress, relayer),
      config,
    };
  }

  describe("getTransactionRequest", () => {
    it("should handle EOA signatures", async () => {
      const { account, owner } = await loadFixture(setupAccountWithERC1271);

      const transaction = {
        to: "0x1234567890123456789012345678901234567890",
        value: 0n,
        data: "0x",
      };

      const { message } = generateTypedData(
        { account, chainId: 31337 },
        transaction
      );

      // Mock EOA signature (132 characters)
      const eoaSignature = "0x" + "a".repeat(130);

      const txRequest = getTransactionRequest({
        account,
        transaction,
        message,
        signature: eoaSignature,
        // No smartWalletAddress = EOA processing
      });

      expect(txRequest.to).to.equal(predictDelayModAddress(account));
      expect(txRequest.value).to.equal(0);
      expect(txRequest.data).to.be.a("string");
      expect(txRequest.data.startsWith("0x")).to.be.true;

      // For EOA, the data should be: encodedData + salt + signature
      const {
        domain: testDomain,
        types: testTypes,
        message: testMessage,
      } = generateTypedData({ account, chainId: 31337 }, transaction);

      // Create a real signature to test with
      const realSignature = await owner.signTypedData(
        testDomain,
        testTypes,
        testMessage
      );

      const realTxRequest = getTransactionRequest({
        account,
        transaction,
        message: testMessage,
        signature: realSignature,
        // No smartWalletAddress = EOA processing
      });

      // Validate the EOA structure: encodedData + salt + signature
      expect(realTxRequest.data).to.include(testMessage.salt.slice(2)); // Remove 0x prefix

      // The data should contain the signature
      expect(realTxRequest.data).to.include(realSignature.slice(2)); // Remove 0x prefix

      // The data should end with the signature (last 130 hex chars = 65 bytes * 2)
      const dataWithoutPrefix = realTxRequest.data.slice(2); // Remove 0x
      const signatureWithoutPrefix = realSignature.slice(2); // Remove 0x
      expect(dataWithoutPrefix.endsWith(signatureWithoutPrefix)).to.be.true;

      // EOA format should be shorter than ERC1271 format
      expect(realTxRequest.data.length).to.be.lessThan(1000);
    });

    it("should handle ERC1271 signatures with smartWalletAddress", async () => {
      const { account, realWalletAddress, owner } = await loadFixture(
        setupAccountWithERC1271
      );

      const transaction = {
        to: "0x1234567890123456789012345678901234567890",
        value: 0n,
        data: "0x",
      };

      const { message } = generateTypedData(
        { account, chainId: 31337 },
        transaction
      );

      // Mock ERC1271 signature (different length to distinguish from EOA)
      const erc1271Signature = "0x" + "b".repeat(200);

      const txRequest = getTransactionRequest({
        account,
        transaction,
        message,
        signature: erc1271Signature,
        smartWalletAddress: realWalletAddress, // This triggers ERC1271 processing
      });

      expect(txRequest.to).to.equal(predictDelayModAddress(account));
      expect(txRequest.value).to.equal(0);
      expect(txRequest.data).to.be.a("string");
      expect(txRequest.data.startsWith("0x")).to.be.true;

      // For ERC1271, the data should be longer due to additional encoding
      // Format: execFromModuleCalldata + signature + salt + r + s + v
      const {
        domain: testDomain,
        types: testTypes,
        message: testMessage,
      } = generateTypedData({ account, chainId: 31337 }, transaction);

      // Create a real signature to test with
      const realSignature = await owner.signTypedData(
        testDomain,
        testTypes,
        testMessage
      );

      const realERC1271TxRequest = getTransactionRequest({
        account,
        transaction,
        message: testMessage,
        signature: realSignature,
        smartWalletAddress: realWalletAddress,
      });

      // Validate the ERC1271 structure: execFromModuleCalldata + signature + salt + r + s + v
      // The data should contain the signature
      expect(realERC1271TxRequest.data).to.include(realSignature.slice(2)); // Remove 0x prefix

      // The data should contain the salt
      expect(realERC1271TxRequest.data).to.include(testMessage.salt.slice(2)); // Remove 0x prefix

      // The data should contain the smart wallet address (as part of r parameter)
      const walletAddressWithoutPrefix = realWalletAddress
        .slice(2)
        .toLowerCase();
      expect(realERC1271TxRequest.data.toLowerCase()).to.include(
        walletAddressWithoutPrefix
      );

      // The data should end with the signature format: r (32 bytes) + s (32 bytes) + v (1 byte) = 65 bytes = 130 hex chars
      const dataWithoutPrefix = realERC1271TxRequest.data.slice(2); // Remove 0x
      // Last 130 hex chars should be the RSV signature format (r + s + v)
      expect(dataWithoutPrefix.length).to.be.greaterThan(130);

      // The last byte should be 0x00 (contract signature marker)
      expect(realERC1271TxRequest.data.endsWith("00")).to.be.true;

      // ERC1271 format should be longer than EOA format
      expect(realERC1271TxRequest.data.length).to.be.greaterThan(400);
    });
  });

  describe("end-to-end signature validation", () => {
    it("should work with EOA signatures (existing functionality)", async () => {
      const { account, owner, relayer } = await loadFixture(
        setupAccountWithERC1271
      );

      const testTransaction = {
        to: account, // Send to self
        value: 0n,
        data: "0x",
      };

      const enqueueTx = await populateExecuteEnqueue(
        { account, chainId: 31337 },
        testTransaction,
        ({ domain, types, message }) =>
          owner.signTypedData(domain, types, message)
      );

      // Should not revert - this tests the EOA path
      await expect(relayer.sendTransaction(enqueueTx)).to.not.be.reverted;
    });

    it("should demonstrate ERC1271 contract validates signatures correctly", async () => {
      const { realWallet, owner } = await loadFixture(setupAccountWithERC1271);

      // Create a test message and sign it properly
      const testMessage = "Hello ERC1271!";
      const messageHash = hre.ethers.hashMessage(testMessage);

      // Sign the message using the standard signMessage method
      const signature = await owner.signMessage(testMessage);

      // Verify the real wallet validates this signature correctly
      const isValid = await realWallet.isValidSignature(messageHash, signature);
      expect(isValid).to.equal("0x1626ba7e"); // ERC1271 magic value

      // Test with an invalid signature (wrong signer)
      const [, wrongSigner] = await hre.ethers.getSigners();
      const wrongSignature = await wrongSigner.signMessage(testMessage);
      const isInvalid = await realWallet.isValidSignature(
        messageHash,
        wrongSignature
      );
      expect(isInvalid).to.equal("0xffffffff"); // Invalid signature
    });

    it("should correctly format ERC1271 transactions with mock signatures", async () => {
      const { account, realWalletAddress } = await loadFixture(
        setupAccountWithERC1271
      );

      const testTransaction = {
        to: "0x2222222222222222222222222222222222222222",
        value: 50n,
        data: "0xabcd1234",
      };

      // Generate typed data
      const { message } = generateTypedData(
        { account, chainId: 31337 },
        testTransaction
      );

      // Use a mock signature for testing the encoding format
      // In real usage, this would come from an actual ERC1271 wallet
      const mockSignature = "0x" + "ab".repeat(65); // 65 bytes signature

      // Use our SDK to create the transaction with ERC1271 support
      const txRequest = getTransactionRequest({
        account,
        transaction: testTransaction,
        message,
        signature: mockSignature,
        smartWalletAddress: realWalletAddress,
      });

      // Verify the transaction is properly formatted
      expect(txRequest.to).to.equal(predictDelayModAddress(account));
      expect(txRequest.data).to.include(mockSignature.slice(2));
      expect(txRequest.data).to.include(
        realWalletAddress.slice(2).toLowerCase()
      );

      // Verify the structure matches ERC1271 encoding requirements
      expect(txRequest.data.length).to.be.greaterThan(400); // ERC1271 format is longer
    });
  });

  describe("signature format validation", () => {
    it("should encode ERC1271 signatures with correct structure", async () => {
      const { account, realWalletAddress } = await loadFixture(
        setupAccountWithERC1271
      );

      const transaction = {
        to: "0x1111111111111111111111111111111111111111",
        value: 123n,
        data: "0x1234",
      };

      const { message } = generateTypedData(
        { account, chainId: 31337 },
        transaction
      );

      const signature = "0x" + "d".repeat(130);

      const txRequest = getTransactionRequest({
        account,
        transaction,
        message,
        signature,
        smartWalletAddress: realWalletAddress,
      });

      // The data should contain our signature
      expect(txRequest.data).to.include(signature.slice(2)); // Remove 0x for inclusion check

      // The data should contain the smart wallet address (as part of r parameter)
      const addressWithoutPrefix = realWalletAddress.slice(2).toLowerCase();
      expect(txRequest.data.toLowerCase()).to.include(addressWithoutPrefix);
    });
  });

  describe("error handling", () => {
    it("should handle empty smartWalletAddress as EOA", async () => {
      const { account } = await loadFixture(setupAccountWithERC1271);

      const transaction = {
        to: "0x1234567890123456789012345678901234567890",
        value: 0n,
        data: "0x",
      };

      const { message } = generateTypedData(
        { account, chainId: 31337 },
        transaction
      );

      const signature = "0x" + "f".repeat(130);

      // Empty string should be treated as EOA
      const txRequest1 = getTransactionRequest({
        account,
        transaction,
        message,
        signature,
        smartWalletAddress: "", // Empty string
      });

      // Undefined should be treated as EOA
      const txRequest2 = getTransactionRequest({
        account,
        transaction,
        message,
        signature,
        // smartWalletAddress undefined
      });

      // Both should produce the same result (EOA format)
      expect(txRequest1.data).to.equal(txRequest2.data);
    });
  });
});
