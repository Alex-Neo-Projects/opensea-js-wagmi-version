"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const mocha_1 = require("mocha");
const web3_1 = __importDefault(require("web3"));
const constants_1 = require("../../constants");
const contracts_1 = require("../../contracts");
const index_1 = require("../../index");
const types_1 = require("../../types");
const schema_1 = require("../../utils/schema");
const constants_2 = require("../constants");
const fees_1 = require("./fees");
const orders_1 = require("./orders");
const provider = new web3_1.default.providers.HttpProvider(constants_1.MAINNET_PROVIDER_URL);
const rinkebyProvider = new web3_1.default.providers.HttpProvider(constants_1.RINKEBY_PROVIDER_URL);
const client = new index_1.OpenSeaSDK(provider, {
    networkName: types_1.Network.Main,
    apiKey: constants_2.MAINNET_API_KEY,
}, (line) => console.info(`MAINNET: ${line}`));
const rinkebyClient = new index_1.OpenSeaSDK(rinkebyProvider, {
    networkName: types_1.Network.Rinkeby,
    apiKey: constants_2.RINKEBY_API_KEY,
}, (line) => console.info(`RINKEBY: ${line}`));
(0, mocha_1.suite)("SDK: static calls", () => {
    (0, mocha_1.test)("Mainnet staticCall tx.origin can be applied to arbitrary order", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const amountInToken = 2;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const order = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            accountAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            quantity: 1,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        order.staticTarget = constants_1.STATIC_CALL_TX_ORIGIN_ADDRESS;
        order.staticExtradata = (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.StaticCheckTxOrigin, "succeedIfTxOriginMatchesSpecifiedAddress"), [takerAddress]);
        chai_1.assert.equal(order.paymentToken, constants_1.NULL_ADDRESS);
        yield client._sellOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield (0, orders_1.testMatchingNewOrder)(order, takerAddress);
    }));
    mocha_1.test.skip("Mainnet StaticCall Decentraland", () => __awaiter(void 0, void 0, void 0, function* () {
        // Mainnet Decentraland
        const accountAddress = "0xf293dfe0ac79c2536b9426957ac8898d6c743717"; // Mainnet Decentraland Estate owner
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const amountInToken = 2;
        const tokenId = "2898"; // Mainnet DecentralandEstate TokenID
        const tokenAddress = "0x959e104e1a4db6317fa58f8295f586e1a978c297"; // Mainnet DecentralandEstates Contract
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const order = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            accountAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            quantity: 1,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order.paymentToken, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInToken);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        chai_1.assert.equal(order.expirationTime.toNumber(), 0);
        (0, fees_1.testFeesMakerOrder)(order, asset.collection, 0);
        yield client._sellOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield (0, orders_1.testMatchingNewOrder)(order, takerAddress);
    }));
    mocha_1.test.skip("Testnet StaticCall CheezeWizards", () => __awaiter(void 0, void 0, void 0, function* () {
        // Testnet Cheezewizards
        const accountAddress = constants_2.ALEX_ADDRESS; // Testnet CheezeWizards token owner
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const amountInToken = 2;
        // Testnet Cheezewizards
        const tokenId = "3"; // Testnet CheezeWizards TokenID
        const tokenAddress = "0x095731b672b76b00A0b5cb9D8258CD3F6E976cB2"; // Testnet CheezeWizards Guild address
        const asset = yield rinkebyClient.api.getAsset({ tokenAddress, tokenId });
        const order = yield rinkebyClient._makeSellOrder({
            asset: { tokenAddress, tokenId },
            accountAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            quantity: 1,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order.paymentToken, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInToken);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        chai_1.assert.equal(order.expirationTime.toNumber(), 0);
        (0, fees_1.testFeesMakerOrder)(order, asset.collection, 0);
        yield rinkebyClient._sellOrderValidationAndApprovals({
            order,
            accountAddress,
        });
        // Make sure match is valid
        yield (0, orders_1.testMatchingNewOrder)(order, takerAddress);
    }));
});
