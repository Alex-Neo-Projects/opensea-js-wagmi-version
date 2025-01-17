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
exports.testFeesMakerOrder = void 0;
const chai_1 = require("chai");
const mocha_1 = require("mocha");
const web3_1 = __importDefault(require("web3"));
const constants_1 = require("../../constants");
const index_1 = require("../../index");
const types_1 = require("../../types");
const constants_2 = require("../constants");
const provider = new web3_1.default.providers.HttpProvider(constants_1.MAINNET_PROVIDER_URL);
const client = new index_1.OpenSeaSDK(provider, {
    networkName: types_1.Network.Main,
    apiKey: constants_2.MAINNET_API_KEY,
}, (line) => console.info(`MAINNET: ${line}`));
let asset;
const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24); // one day from now
(0, mocha_1.suite)("SDK: fees", () => {
    (0, mocha_1.before)(() => __awaiter(void 0, void 0, void 0, function* () {
        const tokenId = constants_2.MYTHEREUM_TOKEN_ID.toString();
        const tokenAddress = constants_2.MYTHEREUM_ADDRESS;
        asset = yield client.api.getAsset({ tokenAddress, tokenId });
        chai_1.assert.isNotNull(asset);
    }));
    (0, mocha_1.test)("Computes fees correctly for non-zero-fee asset", () => __awaiter(void 0, void 0, void 0, function* () {
        const bountyPercent = 1.5;
        const extraBountyBasisPoints = bountyPercent * 100;
        const collection = asset.collection;
        const buyerFeeBasisPoints = collection.openseaBuyerFeeBasisPoints + collection.devBuyerFeeBasisPoints;
        const sellerFeeBasisPoints = collection.openseaSellerFeeBasisPoints +
            collection.devSellerFeeBasisPoints;
        const buyerFees = yield client.computeFees({
            asset,
            extraBountyBasisPoints,
            side: types_1.OrderSide.Buy,
        });
        chai_1.assert.equal(buyerFees.totalBuyerFeeBasisPoints, buyerFeeBasisPoints);
        chai_1.assert.equal(buyerFees.totalSellerFeeBasisPoints, sellerFeeBasisPoints);
        chai_1.assert.equal(buyerFees.devBuyerFeeBasisPoints, collection.devBuyerFeeBasisPoints);
        chai_1.assert.equal(buyerFees.devSellerFeeBasisPoints, collection.devSellerFeeBasisPoints);
        chai_1.assert.equal(buyerFees.openseaBuyerFeeBasisPoints, collection.openseaBuyerFeeBasisPoints);
        chai_1.assert.equal(buyerFees.openseaSellerFeeBasisPoints, collection.openseaSellerFeeBasisPoints);
        chai_1.assert.equal(buyerFees.sellerBountyBasisPoints, 0);
        const sellerFees = yield client.computeFees({
            asset,
            extraBountyBasisPoints,
            side: types_1.OrderSide.Sell,
        });
        chai_1.assert.equal(sellerFees.totalBuyerFeeBasisPoints, buyerFeeBasisPoints);
        chai_1.assert.equal(sellerFees.totalSellerFeeBasisPoints, sellerFeeBasisPoints);
        chai_1.assert.equal(sellerFees.devBuyerFeeBasisPoints, collection.devBuyerFeeBasisPoints);
        chai_1.assert.equal(sellerFees.devSellerFeeBasisPoints, collection.devSellerFeeBasisPoints);
        chai_1.assert.equal(sellerFees.openseaBuyerFeeBasisPoints, collection.openseaBuyerFeeBasisPoints);
        chai_1.assert.equal(sellerFees.openseaSellerFeeBasisPoints, collection.openseaSellerFeeBasisPoints);
        chai_1.assert.equal(sellerFees.sellerBountyBasisPoints, extraBountyBasisPoints);
        const heterogenousBundleSellerFees = yield client.computeFees({
            extraBountyBasisPoints,
            side: types_1.OrderSide.Sell,
        });
        chai_1.assert.equal(heterogenousBundleSellerFees.totalBuyerFeeBasisPoints, constants_1.DEFAULT_BUYER_FEE_BASIS_POINTS);
        chai_1.assert.equal(heterogenousBundleSellerFees.totalSellerFeeBasisPoints, constants_1.DEFAULT_SELLER_FEE_BASIS_POINTS);
        chai_1.assert.equal(heterogenousBundleSellerFees.devBuyerFeeBasisPoints, 0);
        chai_1.assert.equal(heterogenousBundleSellerFees.devSellerFeeBasisPoints, 0);
        chai_1.assert.equal(heterogenousBundleSellerFees.openseaBuyerFeeBasisPoints, constants_1.DEFAULT_BUYER_FEE_BASIS_POINTS);
        chai_1.assert.equal(heterogenousBundleSellerFees.openseaSellerFeeBasisPoints, constants_1.DEFAULT_SELLER_FEE_BASIS_POINTS);
        chai_1.assert.equal(heterogenousBundleSellerFees.sellerBountyBasisPoints, extraBountyBasisPoints);
    }));
    mocha_1.test.skip("Computes fees correctly for zero-fee asset", () => __awaiter(void 0, void 0, void 0, function* () {
        const asset = yield client.api.getAsset({
            tokenAddress: constants_2.DECENTRALAND_ADDRESS,
            tokenId: constants_2.DECENTRALAND_ID,
        });
        const bountyPercent = 0;
        const buyerFees = yield client.computeFees({
            asset,
            extraBountyBasisPoints: bountyPercent * 100,
            side: types_1.OrderSide.Buy,
        });
        chai_1.assert.equal(buyerFees.totalBuyerFeeBasisPoints, 0);
        chai_1.assert.equal(buyerFees.totalSellerFeeBasisPoints, 0);
        chai_1.assert.equal(buyerFees.devBuyerFeeBasisPoints, 0);
        chai_1.assert.equal(buyerFees.devSellerFeeBasisPoints, 0);
        chai_1.assert.equal(buyerFees.openseaBuyerFeeBasisPoints, 0);
        chai_1.assert.equal(buyerFees.openseaSellerFeeBasisPoints, 0);
        chai_1.assert.equal(buyerFees.sellerBountyBasisPoints, 0);
        const sellerFees = yield client.computeFees({
            asset,
            extraBountyBasisPoints: bountyPercent * 100,
            side: types_1.OrderSide.Sell,
        });
        chai_1.assert.equal(sellerFees.totalBuyerFeeBasisPoints, 0);
        chai_1.assert.equal(sellerFees.totalSellerFeeBasisPoints, 0);
        chai_1.assert.equal(sellerFees.devBuyerFeeBasisPoints, 0);
        chai_1.assert.equal(sellerFees.devSellerFeeBasisPoints, 0);
        chai_1.assert.equal(sellerFees.openseaBuyerFeeBasisPoints, 0);
        chai_1.assert.equal(sellerFees.openseaSellerFeeBasisPoints, 0);
        chai_1.assert.equal(sellerFees.sellerBountyBasisPoints, bountyPercent * 100);
    }));
    (0, mocha_1.test)("Errors for computing fees correctly", () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield client.computeFees({
                asset,
                extraBountyBasisPoints: 200,
                side: types_1.OrderSide.Sell,
            });
            chai_1.assert.fail();
        }
        catch (err) {
            const error = err;
            if (!error.message.includes("bounty exceeds the maximum") ||
                !error.message.includes("OpenSea will add")) {
                chai_1.assert.fail(error.message);
            }
        }
    }));
    (0, mocha_1.test)("First page of orders have valid fees", () => __awaiter(void 0, void 0, void 0, function* () {
        const { orders } = yield client.api.getOrdersLegacyWyvern();
        chai_1.assert.isNotEmpty(orders);
        orders.forEach((order) => {
            if (order.asset) {
                chai_1.assert.isNotEmpty(order.asset.assetContract);
                chai_1.assert.isNotEmpty(order.asset.tokenId);
                testFeesMakerOrder(order, order.asset.collection);
            }
            chai_1.assert.isNotEmpty(order.paymentTokenContract);
        });
    }));
    (0, mocha_1.test)("Computes per-transfer fees correctly, Enjin and CK", () => __awaiter(void 0, void 0, void 0, function* () {
        const asset = yield client.api.getAsset({
            tokenAddress: constants_1.ENJIN_ADDRESS,
            tokenId: constants_2.CATS_IN_MECHS_ID,
        });
        const zeroTransferFeeAsset = yield client.api.getAsset({
            tokenAddress: constants_2.CK_ADDRESS,
            tokenId: constants_2.CK_TOKEN_ID,
        });
        const sellerFees = yield client.computeFees({
            asset,
            side: types_1.OrderSide.Sell,
        });
        const sellerZeroFees = yield client.computeFees({
            asset: zeroTransferFeeAsset,
            side: types_1.OrderSide.Sell,
        });
        chai_1.assert.equal(sellerZeroFees.transferFee.toString(), "0");
        chai_1.assert.isNull(sellerZeroFees.transferFeeTokenAddress);
        chai_1.assert.equal(sellerFees.transferFee.toString(), "1000000000000000000");
        chai_1.assert.equal(sellerFees.transferFeeTokenAddress, constants_1.ENJIN_COIN_ADDRESS);
    }));
    // NOTE: Enjin platform limitation:
    // the transfer fee isn't showing as whitelisted (skipped) by Enjin's method
    mocha_1.test.skip("Computes whitelisted Enjin per-transfer fees correctly", () => __awaiter(void 0, void 0, void 0, function* () {
        const whitelistedAsset = yield client.api.getAsset({
            tokenAddress: constants_1.ENJIN_ADDRESS,
            tokenId: constants_2.SPIRIT_CLASH_TOKEN_ID,
        });
        const sellerZeroFees = yield client.computeFees({
            asset: whitelistedAsset,
            side: types_1.OrderSide.Sell,
            accountAddress: constants_2.SPIRIT_CLASH_OWNER,
        });
        chai_1.assert.equal(sellerZeroFees.transferFee.toString(), "0");
        chai_1.assert.equal(sellerZeroFees.transferFeeTokenAddress, constants_1.ENJIN_COIN_ADDRESS);
    }));
    (0, mocha_1.test)("_getBuyFeeParameters works for assets", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const extraBountyBasisPoints = 0;
        const sellOrder = yield client._makeSellOrder({
            asset,
            quantity: 1,
            accountAddress,
            startAmount: 1,
            paymentTokenAddress: constants_1.NULL_ADDRESS,
            extraBountyBasisPoints,
            buyerAddress: constants_1.NULL_ADDRESS,
            waitForHighestBid: false,
        });
        const { totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints } = yield client.computeFees({
            asset,
            extraBountyBasisPoints,
            side: types_1.OrderSide.Buy,
        });
        const { makerRelayerFee, takerRelayerFee, makerProtocolFee, takerProtocolFee, makerReferrerFee, feeRecipient, feeMethod, } = client._getBuyFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, sellOrder);
        chai_1.assert.isAbove(totalSellerFeeBasisPoints, 0);
        unitTestFeesBuyOrder({
            makerRelayerFee,
            takerRelayerFee,
            makerProtocolFee,
            takerProtocolFee,
            makerReferrerFee,
            feeRecipient,
            feeMethod,
        });
    }));
    (0, mocha_1.test)("_getBuyFeeParameters works for English auction assets", () => __awaiter(void 0, void 0, void 0, function* () {
        const accountAddress = constants_2.ALEX_ADDRESS;
        const extraBountyBasisPoints = 0;
        const sellOrder = yield client._makeSellOrder({
            asset,
            quantity: 1,
            accountAddress,
            startAmount: 1,
            paymentTokenAddress: constants_2.WETH_ADDRESS,
            extraBountyBasisPoints,
            buyerAddress: constants_1.NULL_ADDRESS,
            expirationTime,
            waitForHighestBid: true,
        });
        const { totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints } = yield client.computeFees({
            asset,
            extraBountyBasisPoints,
            side: types_1.OrderSide.Buy,
        });
        const { makerRelayerFee, takerRelayerFee, makerProtocolFee, takerProtocolFee, makerReferrerFee, feeRecipient, feeMethod, } = client._getBuyFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, sellOrder);
        chai_1.assert.isAbove(totalSellerFeeBasisPoints, 0);
        unitTestFeesBuyOrder({
            makerRelayerFee,
            takerRelayerFee,
            makerProtocolFee,
            takerProtocolFee,
            makerReferrerFee,
            feeRecipient,
            feeMethod,
        });
    }));
});
function unitTestFeesBuyOrder({ makerRelayerFee, takerRelayerFee, makerProtocolFee, takerProtocolFee, makerReferrerFee, feeRecipient, feeMethod, }) {
    chai_1.assert.equal(+makerRelayerFee, asset.collection.openseaBuyerFeeBasisPoints +
        asset.collection.devBuyerFeeBasisPoints);
    chai_1.assert.equal(+takerRelayerFee, asset.collection.openseaSellerFeeBasisPoints +
        asset.collection.devSellerFeeBasisPoints);
    chai_1.assert.equal(+makerProtocolFee, 0);
    chai_1.assert.equal(+takerProtocolFee, 0);
    chai_1.assert.equal(+makerReferrerFee, 0);
    chai_1.assert.equal(feeRecipient, constants_1.OPENSEA_LEGACY_FEE_RECIPIENT);
    chai_1.assert.equal(feeMethod, types_1.FeeMethod.SplitFee);
}
function testFeesMakerOrder(order, collection, makerBountyBPS) {
    chai_1.assert.equal(order.makerProtocolFee.toNumber(), 0);
    chai_1.assert.equal(order.takerProtocolFee.toNumber(), 0);
    if (order.waitingForBestCounterOrder) {
        chai_1.assert.equal(order.feeRecipient, constants_1.NULL_ADDRESS);
    }
    else {
        chai_1.assert.equal(order.feeRecipient, constants_1.OPENSEA_LEGACY_FEE_RECIPIENT);
    }
    // Public order
    if (makerBountyBPS != null) {
        chai_1.assert.equal(order.makerReferrerFee.toNumber(), makerBountyBPS);
    }
    if (collection) {
        const totalSellerFee = collection.devSellerFeeBasisPoints +
            collection.openseaSellerFeeBasisPoints;
        const totalBuyerFeeBasisPoints = collection.devBuyerFeeBasisPoints + collection.openseaBuyerFeeBasisPoints;
        // Homogenous sale
        if (order.side == types_1.OrderSide.Sell && order.waitingForBestCounterOrder) {
            // Fees may not match the contract's fees, which are changeable.
        }
        else if (order.side == types_1.OrderSide.Sell) {
            chai_1.assert.equal(order.makerRelayerFee.toNumber(), totalSellerFee);
            chai_1.assert.equal(order.takerRelayerFee.toNumber(), totalBuyerFeeBasisPoints);
            chai_1.assert.equal(order.makerRelayerFee.toNumber(), collection.devSellerFeeBasisPoints +
                collection.openseaSellerFeeBasisPoints);
            // Check bounty
            if (collection.openseaSellerFeeBasisPoints >=
                constants_1.OPENSEA_SELLER_BOUNTY_BASIS_POINTS) {
                chai_1.assert.isAtMost(constants_1.OPENSEA_SELLER_BOUNTY_BASIS_POINTS +
                    order.makerReferrerFee.toNumber(), collection.openseaSellerFeeBasisPoints);
            }
            else {
                // No extra bounty allowed if < 1%
                chai_1.assert.equal(order.makerReferrerFee.toNumber(), 0);
            }
        }
        else {
            chai_1.assert.equal(order.makerRelayerFee.toNumber(), totalBuyerFeeBasisPoints);
            chai_1.assert.equal(order.takerRelayerFee.toNumber(), totalSellerFee);
            chai_1.assert.equal(order.makerRelayerFee.toNumber(), collection.devBuyerFeeBasisPoints +
                collection.openseaBuyerFeeBasisPoints);
        }
    }
    else {
        // Heterogenous
        if (order.side == types_1.OrderSide.Sell) {
            chai_1.assert.equal(order.makerRelayerFee.toNumber(), constants_1.DEFAULT_SELLER_FEE_BASIS_POINTS);
            chai_1.assert.equal(order.takerRelayerFee.toNumber(), constants_1.DEFAULT_BUYER_FEE_BASIS_POINTS);
            chai_1.assert.isAtMost(constants_1.OPENSEA_SELLER_BOUNTY_BASIS_POINTS + order.makerReferrerFee.toNumber(), constants_1.DEFAULT_MAX_BOUNTY);
        }
        else {
            chai_1.assert.equal(order.makerRelayerFee.toNumber(), constants_1.DEFAULT_BUYER_FEE_BASIS_POINTS);
            chai_1.assert.equal(order.takerRelayerFee.toNumber(), constants_1.DEFAULT_SELLER_FEE_BASIS_POINTS);
        }
    }
}
exports.testFeesMakerOrder = testFeesMakerOrder;
