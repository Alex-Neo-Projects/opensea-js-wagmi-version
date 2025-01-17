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
exports.testMatchingNewOrder = void 0;
const bignumber_js_1 = require("bignumber.js");
const chai_1 = require("chai");
const mocha_1 = require("mocha");
const web3_1 = __importDefault(require("web3"));
const types_1 = require("wyvern-js/lib/types");
const constants_1 = require("../../constants");
const index_1 = require("../../index");
const types_2 = require("../../types");
const utils_1 = require("../../utils/utils");
const constants_2 = require("../constants");
const orders_json_1 = __importDefault(require("../fixtures/orders.json"));
const utils_2 = require("../utils");
const fees_1 = require("./fees");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ordersJSON = orders_json_1.default;
const englishSellOrderJSON = ordersJSON[0];
const provider = new web3_1.default.providers.HttpProvider(constants_1.MAINNET_PROVIDER_URL);
const rinkebyProvider = new web3_1.default.providers.HttpProvider(constants_1.RINKEBY_PROVIDER_URL);
const client = new index_1.OpenSeaSDK(provider, {
    networkName: types_2.Network.Main,
    apiKey: constants_2.MAINNET_API_KEY,
}, (line) => console.info(`MAINNET: ${line}`));
const rinkebyClient = new index_1.OpenSeaSDK(rinkebyProvider, {
    networkName: types_2.Network.Rinkeby,
    apiKey: constants_2.RINKEBY_API_KEY,
}, (line) => console.info(`RINKEBY: ${line}`));
const assetsForBundleOrder = [
    { tokenId: constants_2.MYTHEREUM_TOKEN_ID.toString(), tokenAddress: constants_2.MYTHEREUM_ADDRESS },
    {
        tokenId: constants_2.DIGITAL_ART_CHAIN_TOKEN_ID.toString(),
        tokenAddress: constants_2.DIGITAL_ART_CHAIN_ADDRESS,
    },
];
const assetsForBulkTransfer = assetsForBundleOrder;
let manaAddress;
let daiAddress;
(0, mocha_1.suite)("SDK: orders", () => {
    (0, mocha_1.before)(() => __awaiter(void 0, void 0, void 0, function* () {
        daiAddress = (yield client.api.getPaymentTokens({ symbol: "DAI" }))
            .tokens[0].address;
        manaAddress = (yield client.api.getPaymentTokens({ symbol: "MANA" }))
            .tokens[0].address;
    }));
    ordersJSON.map((orderJSON, index) => {
        (0, mocha_1.test)("Order #" + index + " has correct types", () => {
            const order = (0, utils_1.orderFromJSON)(orderJSON);
            chai_1.assert.instanceOf(order.basePrice, bignumber_js_1.BigNumber);
            chai_1.assert.typeOf(order.maker, "string");
            chai_1.assert.equal(+order.quantity, 1);
        });
    });
    (0, mocha_1.test)("Correctly sets decimals on fungible order", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const tokenId = constants_2.DISSOLUTION_TOKEN_ID.toString();
        const tokenAddress = constants_1.ENJIN_ADDRESS;
        const quantity = 1;
        const decimals = 2;
        const order = yield client._makeSellOrder({
            asset: {
                tokenAddress,
                tokenId,
                decimals,
                schemaName: types_2.WyvernSchemaName.ERC1155,
            },
            quantity,
            accountAddress,
            startAmount: 2,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order.quantity.toNumber(), quantity * Math.pow(10, decimals));
    }));
    (0, mocha_1.test)("Correctly errors for invalid sell order price parameters", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const expirationTime = Math.round(Date.now() / 1000 + 900); // fifteen minutes from now
        const paymentTokenAddress = manaAddress;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                paymentTokenAddress,
                waitForHighestBid: true,
                expirationTime: 0,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Expiration time cannot be 0");
        }
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                endAmount: 1,
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                expirationTime,
                paymentTokenAddress: constants_1.NULL_ADDRESS,
                waitForHighestBid: true,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "English auctions must use wrapped ETH");
        }
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                endAmount: 3,
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                expirationTime,
                paymentTokenAddress: constants_1.NULL_ADDRESS,
                waitForHighestBid: false,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "End price must be less than or equal to the start price");
        }
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                endAmount: 1,
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                paymentTokenAddress: constants_1.NULL_ADDRESS,
                waitForHighestBid: false,
                expirationTime: 0,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Expiration time must be set if order will change in price");
        }
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                listingTime: Math.round(Date.now() / 1000 - 60),
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                paymentTokenAddress: constants_1.NULL_ADDRESS,
                waitForHighestBid: false,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Listing time cannot be in the past");
        }
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                listingTime: Math.round(Date.now() / 1000 + 20),
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                expirationTime,
                paymentTokenAddress,
                waitForHighestBid: true,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Cannot schedule an English auction for the future");
        }
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                expirationTime,
                paymentTokenAddress,
                waitForHighestBid: false,
                englishAuctionReservePrice: 1,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Reserve prices may only be set on English auctions");
        }
        try {
            yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                expirationTime,
                paymentTokenAddress,
                waitForHighestBid: true,
                englishAuctionReservePrice: 1,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Reserve price must be greater than or equal to the start amount");
        }
    }));
    (0, mocha_1.test)("Correctly errors for invalid buy order price parameters", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const currentSeconds = Math.round(Date.now() / 1000);
        const expirationTime = currentSeconds + 20 * 60; // 20 minutes from now
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        try {
            yield client._makeBuyOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                extraBountyBasisPoints: 0,
                expirationTime,
                paymentTokenAddress: constants_1.NULL_ADDRESS,
            });
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Offers must use wrapped ETH or an ERC-20 token");
        }
    }));
    (0, mocha_1.test)("Cannot yet match a new English auction sell order, bountied", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const amountInToken = 1.2;
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const currentSeconds = Math.round(Date.now() / 1000);
        const expirationTime = currentSeconds + 20 * 60; // 20 minutes from now
        const bountyPercent = 1.1;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const _asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const order = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress,
            startAmount: amountInToken,
            paymentTokenAddress,
            extraBountyBasisPoints: bountyPercent * 100,
            buyerAddress: constants_1.NULL_ADDRESS,
            expirationTime,
            waitForHighestBid: true,
        });
        chai_1.assert.equal(order.taker, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInToken);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        // Make sure there's gap time to expire it
        chai_1.assert.isAbove(order.expirationTime.toNumber(), expirationTime);
        // Make sure it's listed in the future
        chai_1.assert.equal(order.listingTime.toNumber(), expirationTime);
        yield client._sellOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is impossible
        try {
            yield testMatchingNewOrder(order, takerAddress, expirationTime + 100);
            chai_1.assert.fail();
        }
        catch (error) {
            chai_1.assert.include(error.message, "Buy-side order is set in the future or expired");
        }
    }));
    mocha_1.test.skip("Can match a finished English auction sell order", () => __awaiter(void 0, void 0, void 0, function* () {
        const makerAddress = constants_2.ALEX_ADDRESS_2;
        const takerAddress = constants_2.ALEX_ADDRESS;
        const matcherAddress = constants_2.DEVIN_ADDRESS;
        const now = Math.round(Date.now() / 1000);
        // Get bid from server
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const { orders } = yield rinkebyClient.api.getOrdersLegacyWyvern({
            side: types_2.OrderSide.Buy,
            asset_contract_address: constants_2.CK_RINKEBY_ADDRESS,
            token_id: constants_2.CK_RINKEBY_TOKEN_ID,
            payment_token_address: paymentTokenAddress,
            maker: makerAddress,
        });
        const buy = orders[0];
        chai_1.assert.isDefined(buy);
        chai_1.assert.isDefined(buy.asset);
        if (!buy || !buy.asset) {
            return;
        }
        // Make sure it's listed in the past
        chai_1.assert.isBelow(buy.listingTime.toNumber(), now);
        (0, fees_1.testFeesMakerOrder)(buy, buy.asset.collection);
        const sell = (0, utils_1.orderFromJSON)(englishSellOrderJSON);
        chai_1.assert.equal(+sell.quantity, 1);
        chai_1.assert.equal(sell.feeRecipient, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(sell.paymentToken, paymentTokenAddress);
        /* Requirements in Wyvern contract for funds transfer. */
        chai_1.assert.isAtMost(buy.takerRelayerFee.toNumber(), sell.takerRelayerFee.toNumber());
        chai_1.assert.isAtMost(buy.takerProtocolFee.toNumber(), sell.takerProtocolFee.toNumber());
        const sellPrice = yield rinkebyClient.getCurrentPriceLegacyWyvern(sell);
        const buyPrice = yield rinkebyClient.getCurrentPriceLegacyWyvern(buy);
        chai_1.assert.isAtLeast(buyPrice.toNumber(), sellPrice.toNumber());
        console.info(`Matching two orders that differ in price by ${buyPrice.toNumber() - sellPrice.toNumber()}`);
        yield rinkebyClient._buyOrderValidationAndApprovals({
            order: buy,
            accountAddress: makerAddress,
        });
        yield rinkebyClient._sellOrderValidationAndApprovals({
            order: sell,
            accountAddress: takerAddress,
        });
        const gas = yield rinkebyClient._estimateGasForMatch({
            buy,
            sell,
            accountAddress: matcherAddress,
        });
        chai_1.assert.isAbove(gas || 0, 0);
        console.info(`Match gas cost: ${gas}`);
    }));
    (0, mocha_1.test)("Ensures buy order compatibility with an English sell order", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const takerAddress = constants_2.ALEX_ADDRESS;
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const amountInToken = 0.01;
        const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24); // one day from now
        const extraBountyBasisPoints = 1.1 * 100;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const sellOrder = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress: takerAddress,
            startAmount: amountInToken,
            paymentTokenAddress,
            expirationTime,
            extraBountyBasisPoints,
            buyerAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: true,
        });
        const buyOrder = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC721 },
            quantity: 1,
            accountAddress,
            paymentTokenAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
            sellOrder,
        });
        (0, fees_1.testFeesMakerOrder)(buyOrder, asset.collection);
        chai_1.assert.equal(sellOrder.taker, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(buyOrder.taker, sellOrder.maker);
        chai_1.assert.equal(buyOrder.makerRelayerFee.toNumber(), sellOrder.makerRelayerFee.toNumber());
        chai_1.assert.equal(buyOrder.takerRelayerFee.toNumber(), sellOrder.takerRelayerFee.toNumber());
        chai_1.assert.equal(buyOrder.makerProtocolFee.toNumber(), sellOrder.makerProtocolFee.toNumber());
        chai_1.assert.equal(buyOrder.takerProtocolFee.toNumber(), sellOrder.takerProtocolFee.toNumber());
        yield client._buyOrderValidationAndApprovals({
            order: buyOrder,
            accountAddress,
        });
        yield client._sellOrderValidationAndApprovals({
            order: sellOrder,
            accountAddress: takerAddress,
        });
    }));
    (0, mocha_1.test)("Ensures ERC721v3 buy order compatibility with an English sell order", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const takerAddress = constants_2.ALEX_ADDRESS;
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const amountInToken = 0.01;
        const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24); // one day from now
        const extraBountyBasisPoints = 1.1 * 100;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const sellOrder = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress: takerAddress,
            startAmount: amountInToken,
            paymentTokenAddress,
            expirationTime,
            extraBountyBasisPoints,
            buyerAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: true,
        });
        const buyOrder = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC721v3 },
            quantity: 1,
            accountAddress,
            paymentTokenAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
            sellOrder,
        });
        (0, fees_1.testFeesMakerOrder)(buyOrder, asset.collection);
        chai_1.assert.equal(sellOrder.taker, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(buyOrder.taker, sellOrder.maker);
        chai_1.assert.equal(buyOrder.makerRelayerFee.toNumber(), sellOrder.makerRelayerFee.toNumber());
        chai_1.assert.equal(buyOrder.takerRelayerFee.toNumber(), sellOrder.takerRelayerFee.toNumber());
        chai_1.assert.equal(buyOrder.makerProtocolFee.toNumber(), sellOrder.makerProtocolFee.toNumber());
        chai_1.assert.equal(buyOrder.takerProtocolFee.toNumber(), sellOrder.takerProtocolFee.toNumber());
        yield client._buyOrderValidationAndApprovals({
            order: buyOrder,
            accountAddress,
        });
        yield client._sellOrderValidationAndApprovals({
            order: sellOrder,
            accountAddress: takerAddress,
        });
    }));
    (0, mocha_1.test)("Ensures buy order compatibility with an ERC721v3 English sell order", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const takerAddress = constants_2.ALEX_ADDRESS;
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const amountInToken = 0.01;
        const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24); // one day from now
        const extraBountyBasisPoints = 1.1 * 100;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const sellOrder = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC721v3 },
            quantity: 1,
            accountAddress: takerAddress,
            startAmount: amountInToken,
            paymentTokenAddress,
            expirationTime,
            extraBountyBasisPoints,
            buyerAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: true,
        });
        const buyOrder = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress,
            paymentTokenAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
            sellOrder,
        });
        (0, fees_1.testFeesMakerOrder)(buyOrder, asset.collection);
        chai_1.assert.equal(sellOrder.taker, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(buyOrder.taker, sellOrder.maker);
        chai_1.assert.equal(buyOrder.makerRelayerFee.toNumber(), sellOrder.makerRelayerFee.toNumber());
        chai_1.assert.equal(buyOrder.takerRelayerFee.toNumber(), sellOrder.takerRelayerFee.toNumber());
        chai_1.assert.equal(buyOrder.makerProtocolFee.toNumber(), sellOrder.makerProtocolFee.toNumber());
        chai_1.assert.equal(buyOrder.takerProtocolFee.toNumber(), sellOrder.takerProtocolFee.toNumber());
        yield client._buyOrderValidationAndApprovals({
            order: buyOrder,
            accountAddress,
        });
        yield client._sellOrderValidationAndApprovals({
            order: sellOrder,
            accountAddress: takerAddress,
        });
    }));
    mocha_1.test.skip("Creates ENS name buy order", () => __awaiter(void 0, void 0, void 0, function* () {
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const _buyOrder = yield rinkebyClient._makeBuyOrder({
            asset: {
                tokenId: constants_2.ENS_HELLO_TOKEN_ID,
                tokenAddress: constants_2.ENS_RINKEBY_TOKEN_ADDRESS,
                name: constants_2.ENS_HELLO_NAME,
                schemaName: types_2.WyvernSchemaName.ENSShortNameAuction,
            },
            quantity: 1,
            accountAddress: constants_2.ENS_RINKEBY_SHORT_NAME_OWNER,
            paymentTokenAddress,
            startAmount: 0.01,
            expirationTime: Math.round(Date.now() / 1000 + 60 * 60 * 24),
            extraBountyBasisPoints: 0,
        });
        // TODO (joshuawu): Fill this test out after backend supports ENS short names.
        // assert.equal(buyOrder, {})
    }));
    (0, mocha_1.test)("Matches a private sell order, doesn't for wrong taker", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const amountInToken = 2;
        const bountyPercent = 1;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const order = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: bountyPercent * 100,
            buyerAddress: takerAddress,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order.paymentToken, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInToken);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        chai_1.assert.notEqual(order.expirationTime.toNumber(), 0);
        chai_1.assert.isTrue((0, utils_2.areTimestampsNearlyEqual)((0, utils_1.getMaxOrderExpirationTimestamp)(), order.expirationTime.toNumber()));
        (0, fees_1.testFeesMakerOrder)(order, asset.collection, bountyPercent * 100);
        yield client._sellOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield testMatchingNewOrder(order, takerAddress);
        // Make sure no one else can take it
        try {
            yield testMatchingNewOrder(order, constants_2.DEVIN_ADDRESS);
        }
        catch (e) {
            // It works!
            return;
        }
        chai_1.assert.fail();
    }));
    (0, mocha_1.test)("Matches a new dutch sell order of a small amount of ERC-20 item (DAI) for ETH", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const amountInEth = 0.012;
        const tokenId = null;
        const tokenAddress = daiAddress;
        const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24);
        const order = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC20 },
            quantity: Math.pow(10, 18) * 0.01,
            accountAddress,
            startAmount: amountInEth,
            endAmount: 0,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            expirationTime,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInEth);
        chai_1.assert.equal(order.extra.toNumber(), Math.pow(10, 18) * amountInEth);
        chai_1.assert.equal(order.expirationTime.toNumber(), expirationTime);
        yield client._sellOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield testMatchingNewOrder(order, takerAddress);
    }));
    (0, mocha_1.test)("Matches a new sell order of an 1155 item for ETH", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const amountInEth = 2;
        const tokenId = constants_2.AGE_OF_RUST_TOKEN_ID;
        const tokenAddress = constants_1.ENJIN_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const order = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC1155 },
            quantity: 1,
            accountAddress,
            startAmount: amountInEth,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInEth);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        chai_1.assert.notEqual(order.expirationTime.toNumber(), 0);
        chai_1.assert.isTrue((0, utils_2.areTimestampsNearlyEqual)((0, utils_1.getMaxOrderExpirationTimestamp)(), order.expirationTime.toNumber()));
        (0, fees_1.testFeesMakerOrder)(order, asset.collection);
        yield client._sellOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield testMatchingNewOrder(order, takerAddress);
    }));
    (0, mocha_1.test)("Matches a buy order of an 1155 item for W-ETH", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const takerAddress = constants_2.ALEX_ADDRESS;
        const paymentToken = constants_2.WETH_ADDRESS;
        const amountInToken = 0.01;
        const tokenId = constants_2.DISSOLUTION_TOKEN_ID;
        const tokenAddress = constants_1.ENJIN_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const order = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC1155 },
            quantity: 1,
            accountAddress,
            startAmount: amountInToken,
            paymentTokenAddress: paymentToken,
            extraBountyBasisPoints: 0,
        });
        chai_1.assert.equal(order.taker, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(order.paymentToken, paymentToken);
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, 18) * amountInToken);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        chai_1.assert.notEqual(order.expirationTime.toNumber(), 0);
        chai_1.assert.isTrue((0, utils_2.areTimestampsNearlyEqual)((0, utils_1.getMaxOrderExpirationTimestamp)(), order.expirationTime.toNumber()));
        (0, fees_1.testFeesMakerOrder)(order, asset.collection);
        yield client._buyOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield testMatchingNewOrder(order, takerAddress);
    }));
    (0, mocha_1.test)("Matches a new bountied sell order for an ERC-20 token (MANA)", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const paymentToken = (yield client.api.getPaymentTokens({ symbol: "MANA" }))
            .tokens[0];
        const amountInToken = 5000;
        const bountyPercent = 1;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const order = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress,
            startAmount: amountInToken,
            paymentTokenAddress: paymentToken.address,
            extraBountyBasisPoints: bountyPercent * 100,
            buyerAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order.paymentToken, paymentToken.address);
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, paymentToken.decimals) * amountInToken);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        chai_1.assert.notEqual(order.expirationTime.toNumber(), 0);
        chai_1.assert.isTrue((0, utils_2.areTimestampsNearlyEqual)((0, utils_1.getMaxOrderExpirationTimestamp)(), order.expirationTime.toNumber()));
        (0, fees_1.testFeesMakerOrder)(order, asset.collection, bountyPercent * 100);
        yield client._sellOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield testMatchingNewOrder(order, takerAddress);
    }));
    (0, mocha_1.test)("Matches a buy order with an ERC-20 token (DAI)", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const paymentToken = (yield client.api.getPaymentTokens({ symbol: "DAI" }))
            .tokens[0];
        const amountInToken = 3;
        const tokenId = constants_2.CK_TOKEN_ID.toString();
        const tokenAddress = constants_2.CK_ADDRESS;
        const asset = yield client.api.getAsset({ tokenAddress, tokenId });
        const order = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress,
            startAmount: amountInToken,
            paymentTokenAddress: paymentToken.address,
            extraBountyBasisPoints: 0,
        });
        chai_1.assert.equal(order.taker, constants_1.NULL_ADDRESS);
        chai_1.assert.equal(order.paymentToken, paymentToken.address);
        chai_1.assert.equal(order.basePrice.toNumber(), Math.pow(10, paymentToken.decimals) * amountInToken);
        chai_1.assert.equal(order.extra.toNumber(), 0);
        chai_1.assert.notEqual(order.expirationTime.toNumber(), 0);
        chai_1.assert.isTrue((0, utils_2.areTimestampsNearlyEqual)((0, utils_1.getMaxOrderExpirationTimestamp)(), order.expirationTime.toNumber()));
        (0, fees_1.testFeesMakerOrder)(order, asset.collection);
        yield client._buyOrderValidationAndApprovals({ order, accountAddress });
        // Make sure match is valid
        yield testMatchingNewOrder(order, takerAddress);
    }));
    (0, mocha_1.test)("Serializes payment token and matches most recent ERC-20 sell order", () => __awaiter(void 0, void 0, void 0, function* () {
        const takerAddress = constants_2.ALEX_ADDRESS;
        const order = yield client.api.getOrderLegacyWyvern({
            side: types_2.OrderSide.Sell,
            payment_token_address: manaAddress,
            taker: constants_1.NULL_ADDRESS,
        });
        chai_1.assert.isNotNull(order.paymentTokenContract);
        if (!order.paymentTokenContract) {
            return;
        }
        chai_1.assert.equal(order.paymentTokenContract.address, manaAddress);
        chai_1.assert.equal(order.paymentToken, manaAddress);
        // TODO why can't we test atomicMatch?
        yield testMatchingOrder(order, takerAddress, false);
    }));
    (0, mocha_1.test)("Bulk transfer", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const takerAddress = constants_2.ALEX_ADDRESS_2;
        const gas = yield client._estimateGasForTransfer({
            assets: assetsForBulkTransfer,
            fromAddress: accountAddress,
            toAddress: takerAddress,
        });
        chai_1.assert.isAbove(gas, 0);
    }));
    (0, mocha_1.test)("Fungible tokens filter", () => __awaiter(void 0, void 0, void 0, function* () {
        const manaTokens = (yield client.api.getPaymentTokens({ symbol: "MANA" }))
            .tokens;
        chai_1.assert.equal(manaTokens.length, 1);
        const mana = manaTokens[0];
        chai_1.assert.isNotNull(mana);
        chai_1.assert.equal(mana.name, "Decentraland MANA");
        chai_1.assert.equal(mana.address, "0x0f5d2fb29fb7d3cfee444a200298f468908cc942");
        chai_1.assert.equal(mana.decimals, 18);
        const dai = (yield client.api.getPaymentTokens({ symbol: "DAI" }))
            .tokens[0];
        chai_1.assert.isNotNull(dai);
        chai_1.assert.equal(dai.name, "Dai Stablecoin");
        chai_1.assert.equal(dai.decimals, 18);
        const all = yield client.api.getPaymentTokens();
        chai_1.assert.isNotEmpty(all);
    }));
    // Temp skip due to migration
    mocha_1.test.skip("orderToJSON computes correct current price for Dutch auctions", () => __awaiter(void 0, void 0, void 0, function* () {
        const { orders } = yield client.api.getOrdersLegacyWyvern({
            sale_kind: types_2.SaleKind.DutchAuction,
            side: types_2.OrderSide.Sell,
        });
        chai_1.assert.equal(orders.length, client.api.pageSize);
        orders.map((order) => {
            chai_1.assert.isNotNull(order.currentPrice);
            const buyerFeeBPS = order.asset
                ? order.asset.assetContract.buyerFeeBasisPoints
                : order.assetBundle && order.assetBundle.assetContract
                    ? order.assetBundle.assetContract.buyerFeeBasisPoints
                    : null;
            if (!order.currentPrice || buyerFeeBPS) {
                // Skip checks with buyer fees
                return;
            }
            const multiple = order.side == types_2.OrderSide.Sell
                ? +order.takerRelayerFee / constants_1.INVERSE_BASIS_POINT + 1
                : 1;
            // Possible race condition
            chai_1.assert.equal(order.currentPrice.toPrecision(3), (0, utils_1.estimateCurrentPrice)(order).toPrecision(3));
            chai_1.assert.isAtLeast(order.basePrice.times(multiple).toNumber(), order.currentPrice.toNumber());
        });
    }));
    // Skipping brittle test, due to token id dependency
    mocha_1.test.skip("orderToJSON current price includes buyer fee", () => __awaiter(void 0, void 0, void 0, function* () {
        const { orders } = yield client.api.getOrdersLegacyWyvern({
            sale_kind: types_2.SaleKind.FixedPrice,
            asset_contract_address: constants_2.CRYPTOFLOWERS_CONTRACT_ADDRESS_WITH_BUYER_FEE,
            token_id: 8645,
            bundled: false,
            side: types_2.OrderSide.Sell,
            is_english: false,
        });
        chai_1.assert.isNotEmpty(orders);
        orders.map((order) => {
            chai_1.assert.isNotNull(order.currentPrice);
            chai_1.assert.isNotNull(order.asset);
            if (!order.currentPrice || !order.asset) {
                return;
            }
            const buyerFeeBPS = order.takerRelayerFee;
            const multiple = +buyerFeeBPS / constants_1.INVERSE_BASIS_POINT + 1;
            chai_1.assert.equal(order.basePrice.times(multiple).toNumber(), (0, utils_1.estimateCurrentPrice)(order).toNumber());
        });
    }));
    // Flaky due to DB statement timeout
    mocha_1.test.skip("orderToJSON current price does not include buyer fee for English auctions", () => __awaiter(void 0, void 0, void 0, function* () {
        const { orders } = yield client.api.getOrdersLegacyWyvern({
            side: types_2.OrderSide.Sell,
            is_english: true,
        });
        chai_1.assert.isNotEmpty(orders);
        orders.map((order) => {
            chai_1.assert.isNotNull(order.currentPrice);
            chai_1.assert.isNotNull(order.asset);
            if (!order.currentPrice || !order.asset) {
                return;
            }
            chai_1.assert.equal(order.basePrice.toNumber(), (0, utils_1.estimateCurrentPrice)(order).toNumber());
        });
    }));
    mocha_1.test.skip("Matches first buy order in book", () => __awaiter(void 0, void 0, void 0, function* () {
        const order = yield client.api.getOrderLegacyWyvern({
            side: types_2.OrderSide.Buy,
        });
        chai_1.assert.isNotNull(order);
        if (!order) {
            return;
        }
        const assetOrBundle = order.asset || order.assetBundle;
        chai_1.assert.isNotNull(assetOrBundle);
        if (!assetOrBundle) {
            return;
        }
        const takerAddress = order.maker;
        // Taker might not have all approval permissions so only test match
        yield testMatchingOrder(order, takerAddress, false);
    }));
    mocha_1.test.skip("Matches a buy order and estimates gas on fulfillment", () => __awaiter(void 0, void 0, void 0, function* () {
        // Need to use a taker who has created a proxy and approved W-ETH already
        const takerAddress = constants_2.ALEX_ADDRESS;
        const order = yield client.api.getOrderLegacyWyvern({
            side: types_2.OrderSide.Buy,
            owner: takerAddress,
            // Use a token that has already been approved via approve-all
            asset_contract_address: constants_2.DIGITAL_ART_CHAIN_ADDRESS,
            token_id: constants_2.DIGITAL_ART_CHAIN_TOKEN_ID,
        });
        chai_1.assert.isNotNull(order);
        if (!order) {
            return;
        }
        chai_1.assert.isNotNull(order.asset);
        if (!order.asset) {
            return;
        }
        yield testMatchingOrder(order, takerAddress, true);
    }));
    (0, mocha_1.test)("Correct order data on merkle ERC721 listing", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const tokenId = constants_2.DISSOLUTION_TOKEN_ID.toString();
        const tokenAddress = constants_1.ENJIN_ADDRESS;
        const quantity = 1;
        const decimals = 2;
        const order = yield client._makeSellOrder({
            asset: {
                tokenAddress,
                tokenId,
                decimals,
                schemaName: types_2.WyvernSchemaName.ERC721,
            },
            quantity,
            accountAddress,
            startAmount: 2,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order["target"], constants_1.MERKLE_VALIDATOR_MAINNET);
        chai_1.assert.equal(order["replacementPattern"], "0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
        chai_1.assert.equal(order.howToCall, types_1.HowToCall.DelegateCall);
    }));
    (0, mocha_1.test)("Correct order data on merkle ERC1155 listing", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const tokenId = constants_2.DISSOLUTION_TOKEN_ID.toString();
        const tokenAddress = constants_1.ENJIN_ADDRESS;
        const quantity = 1;
        const decimals = 2;
        const order = yield client._makeSellOrder({
            asset: {
                tokenAddress,
                tokenId,
                decimals,
                schemaName: types_2.WyvernSchemaName.ERC1155,
            },
            quantity,
            accountAddress,
            startAmount: 2,
            extraBountyBasisPoints: 0,
            buyerAddress: constants_1.NULL_ADDRESS,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        chai_1.assert.equal(order["target"], constants_1.MERKLE_VALIDATOR_MAINNET);
        chai_1.assert.equal(order["replacementPattern"], "0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
        chai_1.assert.equal(order.howToCall, types_1.HowToCall.DelegateCall);
    }));
    (0, mocha_1.test)("Correct order data on merkle ERC721 offer", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const amountInToken = 0.01;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const order = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC721 },
            quantity: 1,
            accountAddress,
            paymentTokenAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
        });
        chai_1.assert.equal(order["target"], constants_1.MERKLE_VALIDATOR_MAINNET);
        chai_1.assert.equal(order["replacementPattern"], "0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
        chai_1.assert.equal(order.howToCall, types_1.HowToCall.DelegateCall);
    }));
    (0, mocha_1.test)("Correct order data on merkle ERC1155 offer", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const amountInToken = 0.01;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const order = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC1155 },
            quantity: 1,
            accountAddress,
            paymentTokenAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
        });
        chai_1.assert.equal(order["target"], constants_1.MERKLE_VALIDATOR_MAINNET);
        chai_1.assert.equal(order["replacementPattern"], "0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
        chai_1.assert.equal(order.howToCall, types_1.HowToCall.DelegateCall);
    }));
    (0, mocha_1.test)("Verify no merkle data on ERC721 english auction listing and bids", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS_2;
        const takerAddress = constants_2.ALEX_ADDRESS;
        const paymentTokenAddress = constants_2.WETH_ADDRESS;
        const amountInToken = 0.01;
        const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24); // one day from now
        const extraBountyBasisPoints = 1.1 * 100;
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        const sellOrder = yield client._makeSellOrder({
            asset: { tokenAddress, tokenId },
            quantity: 1,
            accountAddress: takerAddress,
            startAmount: amountInToken,
            paymentTokenAddress,
            expirationTime,
            extraBountyBasisPoints,
            buyerAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: true,
        });
        chai_1.assert.equal(sellOrder["target"], tokenAddress);
        chai_1.assert.equal(sellOrder["replacementPattern"], "0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000000");
        chai_1.assert.equal(sellOrder.howToCall, types_1.HowToCall.Call);
        const buyOrder = yield client._makeBuyOrder({
            asset: { tokenAddress, tokenId, schemaName: types_2.WyvernSchemaName.ERC721 },
            quantity: 1,
            accountAddress,
            paymentTokenAddress,
            startAmount: amountInToken,
            extraBountyBasisPoints: 0,
            sellOrder,
        });
        chai_1.assert.equal(buyOrder["target"], tokenAddress);
        chai_1.assert.equal(buyOrder["replacementPattern"], "0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
        chai_1.assert.equal(buyOrder.howToCall, types_1.HowToCall.Call);
    }));
    (0, mocha_1.suite)("Expiration times", () => {
        (0, mocha_1.test)("it fails when expiration time is 0", () => __awaiter(void 0, void 0, void 0, function* () {
            const accountAddress = constants_2.ALEX_ADDRESS;
            const paymentTokenAddress = manaAddress;
            const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
            const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
            try {
                yield client._makeSellOrder({
                    asset: { tokenAddress, tokenId },
                    quantity: 1,
                    accountAddress,
                    startAmount: 2,
                    extraBountyBasisPoints: 0,
                    buyerAddress: constants_1.NULL_ADDRESS,
                    paymentTokenAddress,
                    waitForHighestBid: false,
                    expirationTime: 0,
                });
                chai_1.assert.fail();
            }
            catch (error) {
                chai_1.assert.include(error.message, "Expiration time cannot be 0");
            }
            try {
                yield client._makeBuyOrder({
                    asset: { tokenAddress, tokenId },
                    quantity: 1,
                    accountAddress,
                    startAmount: 2,
                    extraBountyBasisPoints: 0,
                    paymentTokenAddress,
                    expirationTime: 0,
                });
                chai_1.assert.fail();
            }
            catch (error) {
                chai_1.assert.include(error.message, "Expiration time cannot be 0");
            }
        }));
        (0, mocha_1.test)("it fails when expiration time exceeds six months", () => __awaiter(void 0, void 0, void 0, function* () {
            const accountAddress = constants_2.ALEX_ADDRESS;
            const paymentTokenAddress = manaAddress;
            const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
            const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
            const expirationDate = new Date();
            expirationDate.setMonth(expirationDate.getMonth() + 7);
            const expirationTime = Math.round(expirationDate.getTime() / 1000);
            try {
                yield client._makeSellOrder({
                    asset: { tokenAddress, tokenId },
                    quantity: 1,
                    accountAddress,
                    startAmount: 2,
                    extraBountyBasisPoints: 0,
                    buyerAddress: constants_1.NULL_ADDRESS,
                    paymentTokenAddress,
                    waitForHighestBid: false,
                    expirationTime,
                });
                chai_1.assert.fail();
            }
            catch (error) {
                chai_1.assert.include(error.message, "Expiration time must not exceed six months from now");
            }
            try {
                yield client._makeBuyOrder({
                    asset: { tokenAddress, tokenId },
                    quantity: 1,
                    accountAddress,
                    startAmount: 2,
                    extraBountyBasisPoints: 0,
                    paymentTokenAddress,
                    expirationTime,
                });
                chai_1.assert.fail();
            }
            catch (error) {
                chai_1.assert.include(error.message, "Expiration time must not exceed six months from now");
            }
        }));
        (0, mocha_1.test)("it handles expiration time duration correctly", () => __awaiter(void 0, void 0, void 0, function* () {
            const accountAddress = constants_2.ALEX_ADDRESS;
            const paymentTokenAddress = manaAddress;
            const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
            const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
            // Added buffer
            const listingTime = Math.floor(new Date().getTime() / 1000) + 60;
            // 10 minutes after
            const expirationTime = listingTime + 600;
            try {
                yield client._makeSellOrder({
                    asset: { tokenAddress, tokenId },
                    quantity: 1,
                    accountAddress,
                    startAmount: 2,
                    extraBountyBasisPoints: 0,
                    buyerAddress: constants_1.NULL_ADDRESS,
                    paymentTokenAddress,
                    waitForHighestBid: false,
                    listingTime,
                    expirationTime,
                });
                chai_1.assert.fail();
            }
            catch (error) {
                chai_1.assert.include(error.message, `Expiration time must be at least 15 minutes from the listing date`);
            }
            try {
                yield client._makeBuyOrder({
                    asset: { tokenAddress, tokenId },
                    quantity: 1,
                    accountAddress,
                    startAmount: 2,
                    extraBountyBasisPoints: 0,
                    paymentTokenAddress,
                    expirationTime,
                });
                chai_1.assert.fail();
            }
            catch (error) {
                chai_1.assert.include(error.message, `Expiration time must be at least 15 minutes from the listing date`);
            }
            const twentyMinuteExpirationTime = expirationTime + 600;
            const sellOrder = yield client._makeSellOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                extraBountyBasisPoints: 0,
                buyerAddress: constants_1.NULL_ADDRESS,
                paymentTokenAddress,
                waitForHighestBid: false,
                listingTime,
                // 20 minutes after listing time
                expirationTime: twentyMinuteExpirationTime,
            });
            chai_1.assert.equal(sellOrder["expirationTime"].toNumber(), twentyMinuteExpirationTime);
            const buyOrder = yield client._makeBuyOrder({
                asset: { tokenAddress, tokenId },
                quantity: 1,
                accountAddress,
                startAmount: 2,
                extraBountyBasisPoints: 0,
                paymentTokenAddress,
                expirationTime: twentyMinuteExpirationTime,
            });
            chai_1.assert.equal(buyOrder["expirationTime"].toNumber(), twentyMinuteExpirationTime);
        }));
    });
});
function testMatchingOrder(order, accountAddress, testAtomicMatch = false, referrerAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        // Test a separate recipient for sell orders
        const recipientAddress = order.side === types_2.OrderSide.Sell ? constants_2.ALEX_ADDRESS_2 : accountAddress;
        const matchingOrder = client._makeMatchingOrder({
            order,
            accountAddress,
            recipientAddress,
        });
        const { buy, sell } = (0, utils_1.assignOrdersToSides)(order, matchingOrder);
        if (!order.waitingForBestCounterOrder) {
            const isValid = yield client._validateMatch({ buy, sell, accountAddress });
            chai_1.assert.isTrue(isValid);
        }
        else {
            console.info(`English Auction detected, skipping validation`);
        }
        if (testAtomicMatch && !order.waitingForBestCounterOrder) {
            const isValid = yield client._validateOrder(order);
            chai_1.assert.isTrue(isValid);
            const isFulfillable = yield client.isOrderFulfillableLegacyWyvern({
                order,
                accountAddress,
                recipientAddress,
                referrerAddress,
            });
            chai_1.assert.isTrue(isFulfillable);
        }
    });
}
function testMatchingNewOrder(order, accountAddress, counterOrderListingTime) {
    return __awaiter(this, void 0, void 0, function* () {
        const matchingOrder = client._makeMatchingOrder({
            order,
            accountAddress,
            recipientAddress: accountAddress,
        });
        if (counterOrderListingTime != null) {
            matchingOrder.listingTime = (0, utils_1.makeBigNumber)(counterOrderListingTime);
        }
        // Test fees
        chai_1.assert.equal(matchingOrder.makerProtocolFee.toNumber(), 0);
        chai_1.assert.equal(matchingOrder.takerProtocolFee.toNumber(), 0);
        if (order.waitingForBestCounterOrder) {
            chai_1.assert.equal(matchingOrder.feeRecipient, constants_1.OPENSEA_LEGACY_FEE_RECIPIENT);
        }
        else {
            chai_1.assert.equal(matchingOrder.feeRecipient, constants_1.NULL_ADDRESS);
        }
        chai_1.assert.equal(matchingOrder.makerRelayerFee.toNumber(), order.makerRelayerFee.toNumber());
        chai_1.assert.equal(matchingOrder.takerRelayerFee.toNumber(), order.takerRelayerFee.toNumber());
        chai_1.assert.equal(matchingOrder.makerReferrerFee.toNumber(), order.makerReferrerFee.toNumber());
        const v = 27;
        const r = "";
        const s = "";
        let buy;
        let sell;
        if (order.side == types_2.OrderSide.Buy) {
            buy = Object.assign(Object.assign({}, order), { v,
                r,
                s });
            sell = Object.assign(Object.assign({}, matchingOrder), { v,
                r,
                s });
        }
        else {
            sell = Object.assign(Object.assign({}, order), { v,
                r,
                s });
            buy = Object.assign(Object.assign({}, matchingOrder), { v,
                r,
                s });
        }
        const isValid = yield client._validateMatch({ buy, sell, accountAddress });
        chai_1.assert.isTrue(isValid);
        // Make sure assets are transferrable
        yield Promise.all(getAssetsAndQuantities(order).map(({ asset, quantity }) => __awaiter(this, void 0, void 0, function* () {
            const fromAddress = sell.maker;
            const toAddress = buy.maker;
            const useProxy = asset.tokenAddress === constants_2.CK_ADDRESS ||
                asset.schemaName === types_2.WyvernSchemaName.ERC20;
            const isTransferrable = yield client.isAssetTransferrable({
                asset,
                quantity,
                fromAddress,
                toAddress,
                useProxy,
            });
            chai_1.assert.isTrue(isTransferrable, `Not transferrable: ${asset.tokenAddress} # ${asset.tokenId} schema ${asset.schemaName} quantity ${quantity} from ${fromAddress} to ${toAddress} using proxy: ${useProxy}`);
        })));
    });
}
exports.testMatchingNewOrder = testMatchingNewOrder;
function getAssetsAndQuantities(order) {
    const wyAssets = "bundle" in order.metadata
        ? order.metadata.bundle.assets
        : order.metadata.asset
            ? [order.metadata.asset]
            : [];
    const schemaNames = "bundle" in order.metadata && "schemas" in order.metadata.bundle
        ? order.metadata.bundle.schemas
        : "schema" in order.metadata
            ? [order.metadata.schema]
            : [];
    chai_1.assert.isNotEmpty(wyAssets);
    chai_1.assert.equal(wyAssets.length, schemaNames.length);
    return wyAssets.map((wyAsset, i) => {
        const asset = {
            tokenId: "id" in wyAsset && wyAsset.id != null ? wyAsset.id : null,
            tokenAddress: wyAsset.address,
            schemaName: schemaNames[i],
        };
        if ("quantity" in wyAsset) {
            return { asset, quantity: new bignumber_js_1.BigNumber(wyAsset.quantity) };
        }
        else {
            return { asset, quantity: new bignumber_js_1.BigNumber(1) };
        }
    });
}
