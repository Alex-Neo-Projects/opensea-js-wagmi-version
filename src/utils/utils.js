"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getAssetItemType = exports.hasErrorCode = exports.getMaxOrderExpirationTimestamp = exports.merkleValidatorByNetwork = exports.getNonCompliantApprovalAddress = exports.onDeprecated = exports.validateAndFormatWalletAddress = exports.delay = exports.assignOrdersToSides = exports.getOrderHash = exports.getWyvernBundle = exports.getWyvernAsset = exports.estimateCurrentPrice = exports.getTransferFeeSettings = exports.getCurrentGasPrice = exports.estimateGas = exports.rawCall = exports.sendRawTransaction = exports.makeBigNumber = exports.isContractAddress = exports.signTypedDataAsync = exports.personalSignAsync = exports.orderToJSON = exports.orderFromJSON = exports.tokenFromJSON = exports.collectionFromJSON = exports.assetContractFromJSON = exports.assetBundleFromJSON = exports.userFromJSON = exports.accountFromJSON = exports.transactionFromJSON = exports.assetEventFromJSON = exports.assetFromJSON = exports.confirmTransaction = exports.promisifyCall = exports.annotateERC20TransferABI = exports.annotateERC721TransferABI = exports.WyvernProtocol = void 0;
const constants_1 = require("@opensea/seaport-js/lib/constants");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ethereum_types_1 = require("ethereum-types");
const ethUtil = __importStar(require("ethereumjs-util"));
const _ = __importStar(require("lodash"));
const wyvern_js_1 = require("wyvern-js");
Object.defineProperty(exports, "WyvernProtocol", { enumerable: true, get: function () { return wyvern_js_1.WyvernProtocol; } });
const types_1 = require("wyvern-schemas/dist/types");
const constants_2 = require("../constants");
const contracts_1 = require("../contracts");
const types_2 = require("../types");
const annotateERC721TransferABI = (asset) => ({
    constant: false,
    inputs: [
        {
            name: "_to",
            type: "address",
            kind: types_1.FunctionInputKind.Replaceable,
        },
        {
            name: "_tokenId",
            type: "uint256",
            kind: types_1.FunctionInputKind.Asset,
            value: asset.id,
        },
    ],
    target: asset.address,
    name: "transfer",
    outputs: [],
    payable: false,
    stateMutability: types_1.StateMutability.Nonpayable,
    type: ethereum_types_1.AbiType.Function,
});
exports.annotateERC721TransferABI = annotateERC721TransferABI;
const annotateERC20TransferABI = (asset) => ({
    constant: false,
    inputs: [
        {
            name: "_to",
            type: "address",
            kind: types_1.FunctionInputKind.Replaceable,
        },
        {
            name: "_amount",
            type: "uint256",
            kind: types_1.FunctionInputKind.Count,
            value: asset.quantity,
        },
    ],
    target: asset.address,
    name: "transfer",
    outputs: [
        {
            name: "success",
            type: "bool",
            kind: types_1.FunctionOutputKind.Other,
        },
    ],
    payable: false,
    stateMutability: types_1.StateMutability.Nonpayable,
    type: ethereum_types_1.AbiType.Function,
});
exports.annotateERC20TransferABI = annotateERC20TransferABI;
// OTHER
const txCallbacks = {};
/**
 * Promisify a callback-syntax web3 function
 * @param inner callback function that accepts a Web3 callback function and passes
 * it to the Web3 function
 */
function promisify(inner) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => inner((err, res) => {
            if (err) {
                reject(err);
            }
            resolve(res);
        }));
    });
}
/**
 * Promisify a call a method on a contract,
 * handling Parity errors. Returns '0x' if error.
 * Note that if T is not "string", this may return a falsey
 * value when the contract doesn't support the method (e.g. `isApprovedForAll`).
 * @param callback An anonymous function that takes a web3 callback
 * and returns a Web3 Contract's call result, e.g. `c => erc721.ownerOf(3, c)`
 * @param onError callback when user denies transaction
 */
function promisifyCall(callback, onError) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield promisify(callback);
            if (typeof result === "string" && result == "0x") {
                // Geth compatibility
                return undefined;
            }
            return result;
        }
        catch (error) {
            // Probably method not found, and web3 is a Parity node
            if (onError) {
                onError(error);
            }
            else {
                console.error(error);
            }
            return undefined;
        }
    });
}
exports.promisifyCall = promisifyCall;
const track = (web3, txHash, onFinalized) => {
    if (txCallbacks[txHash]) {
        txCallbacks[txHash].push(onFinalized);
    }
    else {
        txCallbacks[txHash] = [onFinalized];
        const poll = () => __awaiter(void 0, void 0, void 0, function* () {
            const tx = yield web3.eth.getTransaction(txHash);
            if (tx && tx.blockHash && tx.blockHash !== constants_2.NULL_BLOCK_HASH) {
                const receipt = yield web3.eth.getTransactionReceipt(txHash);
                if (!receipt) {
                    // Hack: assume success if no receipt
                    console.warn("No receipt found for ", txHash);
                }
                const status = receipt.status;
                txCallbacks[txHash].map((f) => f(status));
                delete txCallbacks[txHash];
            }
            else {
                setTimeout(poll, 1000);
            }
        });
        poll().catch();
    }
};
const confirmTransaction = (web3, txHash) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        track(web3, txHash, (didSucceed) => {
            if (didSucceed) {
                resolve("Transaction complete!");
            }
            else {
                reject(new Error(`Transaction failed :( You might have already completed this action. See more on the mainnet at etherscan.io/tx/${txHash}`));
            }
        });
    });
});
exports.confirmTransaction = confirmTransaction;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assetFromJSON = (asset) => {
    const isAnimated = asset.image_url && asset.image_url.endsWith(".gif");
    const isSvg = asset.image_url && asset.image_url.endsWith(".svg");
    const fromJSON = {
        tokenId: asset.token_id.toString(),
        tokenAddress: asset.asset_contract.address,
        name: asset.name,
        description: asset.description,
        owner: asset.owner,
        assetContract: (0, exports.assetContractFromJSON)(asset.asset_contract),
        collection: (0, exports.collectionFromJSON)(asset.collection),
        orders: asset.orders ? asset.orders.map(exports.orderFromJSON) : null,
        sellOrders: asset.sell_orders ? asset.sell_orders.map(exports.orderFromJSON) : null,
        buyOrders: asset.buy_orders ? asset.buy_orders.map(exports.orderFromJSON) : null,
        isPresale: asset.is_presale,
        // Don't use previews if it's a special image
        imageUrl: isAnimated || isSvg
            ? asset.image_url
            : asset.image_preview_url || asset.image_url,
        imagePreviewUrl: asset.image_preview_url,
        imageUrlOriginal: asset.image_original_url,
        imageUrlThumbnail: asset.image_thumbnail_url,
        externalLink: asset.external_link,
        openseaLink: asset.permalink,
        traits: asset.traits,
        numSales: asset.num_sales,
        lastSale: asset.last_sale ? (0, exports.assetEventFromJSON)(asset.last_sale) : null,
        backgroundColor: asset.background_color
            ? `#${asset.background_color}`
            : null,
        transferFee: asset.transfer_fee ? makeBigNumber(asset.transfer_fee) : null,
        transferFeePaymentToken: asset.transfer_fee_payment_token
            ? (0, exports.tokenFromJSON)(asset.transfer_fee_payment_token)
            : null,
    };
    // If orders were included, put them in sell/buy order groups
    if (fromJSON.orders && !fromJSON.sellOrders) {
        fromJSON.sellOrders = fromJSON.orders.filter((o) => o.side == types_2.OrderSide.Sell);
    }
    if (fromJSON.orders && !fromJSON.buyOrders) {
        fromJSON.buyOrders = fromJSON.orders.filter((o) => o.side == types_2.OrderSide.Buy);
    }
    return fromJSON;
};
exports.assetFromJSON = assetFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assetEventFromJSON = (assetEvent) => {
    return {
        eventType: assetEvent.event_type,
        eventTimestamp: assetEvent.event_timestamp,
        auctionType: assetEvent.auction_type,
        totalPrice: assetEvent.total_price,
        transaction: assetEvent.transaction
            ? (0, exports.transactionFromJSON)(assetEvent.transaction)
            : null,
        paymentToken: assetEvent.payment_token
            ? (0, exports.tokenFromJSON)(assetEvent.payment_token)
            : null,
    };
};
exports.assetEventFromJSON = assetEventFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transactionFromJSON = (transaction) => {
    return {
        fromAccount: (0, exports.accountFromJSON)(transaction.from_account),
        toAccount: (0, exports.accountFromJSON)(transaction.to_account),
        createdDate: new Date(`${transaction.created_date}Z`),
        modifiedDate: new Date(`${transaction.modified_date}Z`),
        transactionHash: transaction.transaction_hash,
        transactionIndex: transaction.transaction_index,
        blockNumber: transaction.block_number,
        blockHash: transaction.block_hash,
        timestamp: new Date(`${transaction.timestamp}Z`),
    };
};
exports.transactionFromJSON = transactionFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const accountFromJSON = (account) => {
    return {
        address: account.address,
        config: account.config,
        profileImgUrl: account.profile_img_url,
        user: account.user ? (0, exports.userFromJSON)(account.user) : null,
    };
};
exports.accountFromJSON = accountFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userFromJSON = (user) => {
    return {
        username: user.username,
    };
};
exports.userFromJSON = userFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assetBundleFromJSON = (asset_bundle) => {
    const fromJSON = {
        maker: asset_bundle.maker,
        assets: asset_bundle.assets ? asset_bundle.assets.map(exports.assetFromJSON) : [],
        assetContract: asset_bundle.asset_contract
            ? (0, exports.assetContractFromJSON)(asset_bundle.asset_contract)
            : undefined,
        name: asset_bundle.name,
        slug: asset_bundle.slug,
        description: asset_bundle.description,
        externalLink: asset_bundle.external_link,
        permalink: asset_bundle.permalink,
        sellOrders: asset_bundle.sell_orders
            ? asset_bundle.sell_orders.map(exports.orderFromJSON)
            : null,
    };
    return fromJSON;
};
exports.assetBundleFromJSON = assetBundleFromJSON;
const assetContractFromJSON = (
// eslint-disable-next-line @typescript-eslint/no-explicit-any
asset_contract) => {
    return {
        name: asset_contract.name,
        description: asset_contract.description,
        type: asset_contract.asset_contract_type,
        schemaName: asset_contract.schema_name,
        address: asset_contract.address,
        tokenSymbol: asset_contract.symbol,
        buyerFeeBasisPoints: +asset_contract.buyer_fee_basis_points,
        sellerFeeBasisPoints: +asset_contract.seller_fee_basis_points,
        openseaBuyerFeeBasisPoints: +asset_contract.opensea_buyer_fee_basis_points,
        openseaSellerFeeBasisPoints: +asset_contract.opensea_seller_fee_basis_points,
        devBuyerFeeBasisPoints: +asset_contract.dev_buyer_fee_basis_points,
        devSellerFeeBasisPoints: +asset_contract.dev_seller_fee_basis_points,
        imageUrl: asset_contract.image_url,
        externalLink: asset_contract.external_link,
        wikiLink: asset_contract.wiki_link,
    };
};
exports.assetContractFromJSON = assetContractFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const collectionFromJSON = (collection) => {
    const createdDate = new Date(`${collection.created_date}Z`);
    return {
        createdDate,
        name: collection.name,
        description: collection.description,
        slug: collection.slug,
        editors: collection.editors,
        hidden: collection.hidden,
        featured: collection.featured,
        featuredImageUrl: collection.featured_image_url,
        displayData: collection.display_data,
        paymentTokens: (collection.payment_tokens || []).map(exports.tokenFromJSON),
        openseaBuyerFeeBasisPoints: +collection.opensea_buyer_fee_basis_points,
        openseaSellerFeeBasisPoints: +collection.opensea_seller_fee_basis_points,
        devBuyerFeeBasisPoints: +collection.dev_buyer_fee_basis_points,
        devSellerFeeBasisPoints: +collection.dev_seller_fee_basis_points,
        payoutAddress: collection.payout_address,
        imageUrl: collection.image_url,
        largeImageUrl: collection.large_image_url,
        stats: collection.stats,
        traitStats: collection.traits,
        externalLink: collection.external_url,
        wikiLink: collection.wiki_url,
    };
};
exports.collectionFromJSON = collectionFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tokenFromJSON = (token) => {
    const fromJSON = {
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        address: token.address,
        imageUrl: token.image_url,
        ethPrice: token.eth_price,
        usdPrice: token.usd_price,
    };
    return fromJSON;
};
exports.tokenFromJSON = tokenFromJSON;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orderFromJSON = (order) => {
    const createdDate = new Date(`${order.created_date}Z`);
    const fromJSON = {
        hash: order.order_hash || order.hash,
        cancelledOrFinalized: order.cancelled || order.finalized,
        markedInvalid: order.marked_invalid,
        metadata: order.metadata,
        quantity: new bignumber_js_1.default(order.quantity || 1),
        exchange: order.exchange,
        makerAccount: order.maker,
        takerAccount: order.taker,
        // Use string address to conform to Wyvern Order schema
        maker: order.maker.address,
        taker: order.taker.address,
        makerRelayerFee: new bignumber_js_1.default(order.maker_relayer_fee),
        takerRelayerFee: new bignumber_js_1.default(order.taker_relayer_fee),
        makerProtocolFee: new bignumber_js_1.default(order.maker_protocol_fee),
        takerProtocolFee: new bignumber_js_1.default(order.taker_protocol_fee),
        makerReferrerFee: new bignumber_js_1.default(order.maker_referrer_fee || 0),
        waitingForBestCounterOrder: order.fee_recipient.address == constants_2.NULL_ADDRESS,
        feeMethod: order.fee_method,
        feeRecipientAccount: order.fee_recipient,
        feeRecipient: order.fee_recipient.address,
        side: order.side,
        saleKind: order.sale_kind,
        target: order.target,
        howToCall: order.how_to_call,
        calldata: order.calldata,
        replacementPattern: order.replacement_pattern,
        staticTarget: order.static_target,
        staticExtradata: order.static_extradata,
        paymentToken: order.payment_token,
        basePrice: new bignumber_js_1.default(order.base_price),
        extra: new bignumber_js_1.default(order.extra),
        currentBounty: new bignumber_js_1.default(order.current_bounty || 0),
        currentPrice: new bignumber_js_1.default(order.current_price || 0),
        createdTime: new bignumber_js_1.default(Math.round(createdDate.getTime() / 1000)),
        listingTime: new bignumber_js_1.default(order.listing_time),
        expirationTime: new bignumber_js_1.default(order.expiration_time),
        salt: new bignumber_js_1.default(order.salt),
        v: parseInt(order.v),
        r: order.r,
        s: order.s,
        paymentTokenContract: order.payment_token_contract
            ? (0, exports.tokenFromJSON)(order.payment_token_contract)
            : undefined,
        asset: order.asset ? (0, exports.assetFromJSON)(order.asset) : undefined,
        assetBundle: order.asset_bundle
            ? (0, exports.assetBundleFromJSON)(order.asset_bundle)
            : undefined,
    };
    // Use client-side price calc, to account for buyer fee (not added by server) and latency
    fromJSON.currentPrice = estimateCurrentPrice(fromJSON);
    return fromJSON;
};
exports.orderFromJSON = orderFromJSON;
/**
 * Convert an order to JSON, hashing it as well if necessary
 * @param order order (hashed or unhashed)
 */
const orderToJSON = (order) => {
    const asJSON = {
        exchange: order.exchange.toLowerCase(),
        maker: order.maker.toLowerCase(),
        taker: order.taker.toLowerCase(),
        makerRelayerFee: order.makerRelayerFee.toString(),
        takerRelayerFee: order.takerRelayerFee.toString(),
        makerProtocolFee: order.makerProtocolFee.toString(),
        takerProtocolFee: order.takerProtocolFee.toString(),
        makerReferrerFee: order.makerReferrerFee.toString(),
        feeMethod: order.feeMethod,
        feeRecipient: order.feeRecipient.toLowerCase(),
        side: order.side,
        saleKind: order.saleKind,
        target: order.target.toLowerCase(),
        howToCall: order.howToCall,
        calldata: order.calldata,
        replacementPattern: order.replacementPattern,
        staticTarget: order.staticTarget.toLowerCase(),
        staticExtradata: order.staticExtradata,
        paymentToken: order.paymentToken.toLowerCase(),
        quantity: order.quantity.toString(),
        basePrice: order.basePrice.toString(),
        englishAuctionReservePrice: order.englishAuctionReservePrice
            ? order.englishAuctionReservePrice.toString()
            : undefined,
        extra: order.extra.toString(),
        createdTime: order.createdTime ? order.createdTime.toString() : undefined,
        listingTime: order.listingTime.toString(),
        expirationTime: order.expirationTime.toString(),
        salt: order.salt.toString(),
        metadata: order.metadata,
        v: order.v,
        r: order.r,
        s: order.s,
        nonce: order.nonce,
    };
    return asJSON;
};
exports.orderToJSON = orderToJSON;
/**
 * Sign messages using web3 personal signatures
 * @param web3 Web3 instance
 * @param message message to sign
 * @param signerAddress web3 address signing the message
 * @returns A signature if provider can sign, otherwise null
 */
function personalSignAsync(web3, message, signerAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        const signature = yield promisify((c) => web3.currentProvider.sendAsync({
            method: "personal_sign",
            params: [message, signerAddress],
            from: signerAddress,
            id: new Date().getTime(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, c));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = signature.error;
        if (error) {
            throw new Error(error);
        }
        return parseSignatureHex(signature === null || signature === void 0 ? void 0 : signature.result);
    });
}
exports.personalSignAsync = personalSignAsync;
/**
 * Sign messages using web3 signTypedData signatures
 * @param web3 Web3 instance
 * @param message message to sign
 * @param signerAddress web3 address signing the message
 * @returns A signature if provider can sign, otherwise null
 */
function signTypedDataAsync(web3, message, signerAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        let signature;
        try {
            // Using sign typed data V4 works with a stringified message, used by browser providers i.e. Metamask
            signature = yield promisify((c) => web3.currentProvider.sendAsync({
                method: "eth_signTypedData_v4",
                params: [signerAddress, JSON.stringify(message)],
                from: signerAddress,
                id: new Date().getTime(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }, c));
        }
        catch (_a) {
            // Fallback to normal sign typed data for node providers, without using stringified message
            // https://github.com/coinbase/coinbase-wallet-sdk/issues/60
            signature = yield promisify((c) => web3.currentProvider.sendAsync({
                method: "eth_signTypedData",
                params: [signerAddress, message],
                from: signerAddress,
                id: new Date().getTime(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }, c));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = signature.error;
        if (error) {
            throw new Error(error);
        }
        return parseSignatureHex(signature === null || signature === void 0 ? void 0 : signature.result);
    });
}
exports.signTypedDataAsync = signTypedDataAsync;
/**
 * Checks whether a given address contains any code
 * @param web3 Web3 instance
 * @param address input address
 */
function isContractAddress(web3, address) {
    return __awaiter(this, void 0, void 0, function* () {
        const code = yield web3.eth.getCode(address);
        return code !== "0x";
    });
}
exports.isContractAddress = isContractAddress;
/**
 * Special fixes for making BigNumbers using web3 results
 * @param arg An arg or the result of a web3 call to turn into a BigNumber
 */
function makeBigNumber(arg) {
    // Zero sometimes returned as 0x from contracts
    if (arg === "0x") {
        arg = 0;
    }
    // fix "new BigNumber() number type has more than 15 significant digits"
    arg = arg.toString();
    return new bignumber_js_1.default(arg);
}
exports.makeBigNumber = makeBigNumber;
/**
 * Send a transaction to the blockchain and optionally confirm it
 * @param web3 Web3 instance
 * @param param0 __namedParameters
 * @param from address sending transaction
 * @param to destination contract address
 * @param data data to send to contract
 * @param gasPrice gas price to use. If unspecified, uses web3 default (mean gas price)
 * @param value value in ETH to send with data. Defaults to 0
 * @param onError callback when user denies transaction
 */
function sendRawTransaction(web3, { from, to, data, gasPrice, value = 0, gas }, onError) {
    return __awaiter(this, void 0, void 0, function* () {
        if (gas == null) {
            // This gas cannot be increased due to an ethjs error
            gas = yield estimateGas(web3, { from, to, data, value });
        }
        try {
            const txHashRes = yield promisify((c) => web3.eth.sendTransaction({
                from,
                to,
                value: value.toString(),
                data,
                gas: gas === null || gas === void 0 ? void 0 : gas.toString(),
                gasPrice: gasPrice === null || gasPrice === void 0 ? void 0 : gasPrice.toString(),
            }, c));
            return txHashRes;
        }
        catch (error) {
            onError(error);
            throw error;
        }
    });
}
exports.sendRawTransaction = sendRawTransaction;
/**
 * Call a method on a contract, sending arbitrary data and
 * handling Parity errors. Returns '0x' if error.
 * @param web3 Web3 instance
 * @param param0 __namedParameters
 * @param from address sending call
 * @param to destination contract address
 * @param data data to send to contract
 * @param onError callback when user denies transaction
 */
function rawCall(web3, { from, to, data }, onError) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield web3.eth.call({
                from,
                to,
                data,
            });
            return result;
        }
        catch (error) {
            // Probably method not found, and web3 is a Parity node
            if (onError) {
                onError(error);
            }
            // Backwards compatibility with Geth nodes
            return "0x";
        }
    });
}
exports.rawCall = rawCall;
/**
 * Estimate Gas usage for a transaction
 * @param web3 Web3 instance
 * @param from address sending transaction
 * @param to destination contract address
 * @param data data to send to contract
 * @param value value in ETH to send with data
 */
function estimateGas(web3, { from, to, data, value = 0 }) {
    return __awaiter(this, void 0, void 0, function* () {
        const amount = yield web3.eth.estimateGas({
            from,
            to,
            value: value.toString(),
            data,
        });
        return amount;
    });
}
exports.estimateGas = estimateGas;
/**
 * Get mean gas price for sending a txn, in wei
 * @param web3 Web3 instance
 */
function getCurrentGasPrice(web3) {
    return __awaiter(this, void 0, void 0, function* () {
        const gasPrice = yield web3.eth.getGasPrice();
        return new bignumber_js_1.default(gasPrice);
    });
}
exports.getCurrentGasPrice = getCurrentGasPrice;
/**
 * Get current transfer fees for an asset
 * @param web3 Web3 instance
 * @param asset The asset to check for transfer fees
 */
function getTransferFeeSettings(web3, { asset, accountAddress, }) {
    return __awaiter(this, void 0, void 0, function* () {
        let transferFee;
        let transferFeeTokenAddress;
        if (asset.tokenAddress.toLowerCase() == constants_2.ENJIN_ADDRESS.toLowerCase()) {
            // Enjin asset
            const feeContract = new web3.eth.Contract(contracts_1.ERC1155, asset.tokenAddress);
            const params = yield feeContract.methods
                .transferSettings(asset.tokenId)
                .call({ from: accountAddress });
            if (params) {
                transferFee = makeBigNumber(params[3]);
                if (params[2] === "0") {
                    transferFeeTokenAddress = constants_2.ENJIN_COIN_ADDRESS;
                }
            }
        }
        return { transferFee, transferFeeTokenAddress };
    });
}
exports.getTransferFeeSettings = getTransferFeeSettings;
// sourced from 0x.js:
// https://github.com/ProjectWyvern/wyvern-js/blob/39999cb93ce5d80ea90b4382182d1bd4339a9c6c/src/utils/signature_utils.ts
function parseSignatureHex(signature) {
    // HACK: There is no consensus on whether the signatureHex string should be formatted as
    // v + r + s OR r + s + v, and different clients (even different versions of the same client)
    // return the signature params in different orders. In order to support all client implementations,
    // we parse the signature in both ways, and evaluate if either one is a valid signature.
    const validVParamValues = [27, 28];
    const ecSignatureRSV = _parseSignatureHexAsRSV(signature);
    if (_.includes(validVParamValues, ecSignatureRSV.v)) {
        return ecSignatureRSV;
    }
    // For older clients
    const ecSignatureVRS = _parseSignatureHexAsVRS(signature);
    if (_.includes(validVParamValues, ecSignatureVRS.v)) {
        return ecSignatureVRS;
    }
    throw new Error("Invalid signature");
    function _parseSignatureHexAsVRS(signatureHex) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signatureBuffer = ethUtil.toBuffer(signatureHex);
        let v = signatureBuffer[0];
        if (v < 27) {
            v += 27;
        }
        const r = signatureBuffer.slice(1, 33);
        const s = signatureBuffer.slice(33, 65);
        const ecSignature = {
            v,
            r: ethUtil.bufferToHex(r),
            s: ethUtil.bufferToHex(s),
        };
        return ecSignature;
    }
    function _parseSignatureHexAsRSV(signatureHex) {
        const { v, r, s } = ethUtil.fromRpcSig(signatureHex);
        const ecSignature = {
            v,
            r: ethUtil.bufferToHex(r),
            s: ethUtil.bufferToHex(s),
        };
        return ecSignature;
    }
}
/**
 * Estimates the price of an order
 * @param order The order to estimate price on
 * @param secondsToBacktrack The number of seconds to subtract on current time,
 *  to fix race conditions
 * @param shouldRoundUp Whether to round up fractional wei
 */
function estimateCurrentPrice(order, secondsToBacktrack = 30, shouldRoundUp = true) {
    let { basePrice, listingTime, expirationTime, extra } = order;
    const { side, takerRelayerFee, saleKind } = order;
    const now = new bignumber_js_1.default(Math.round(Date.now() / 1000)).minus(secondsToBacktrack);
    basePrice = new bignumber_js_1.default(basePrice);
    listingTime = new bignumber_js_1.default(listingTime);
    expirationTime = new bignumber_js_1.default(expirationTime);
    extra = new bignumber_js_1.default(extra);
    let exactPrice = basePrice;
    if (saleKind === types_2.SaleKind.FixedPrice) {
        // Do nothing, price is correct
    }
    else if (saleKind === types_2.SaleKind.DutchAuction) {
        const diff = extra
            .times(now.minus(listingTime))
            .dividedBy(expirationTime.minus(listingTime));
        exactPrice =
            side == types_2.OrderSide.Sell
                ? /* Sell-side - start price: basePrice. End price: basePrice - extra. */
                    basePrice.minus(diff)
                : /* Buy-side - start price: basePrice. End price: basePrice + extra. */
                    basePrice.plus(diff);
    }
    // Add taker fee only for buyers
    if (side === types_2.OrderSide.Sell && !order.waitingForBestCounterOrder) {
        // Buyer fee increases sale price
        exactPrice = exactPrice.times(+takerRelayerFee / constants_2.INVERSE_BASIS_POINT + 1);
    }
    return shouldRoundUp
        ? exactPrice.integerValue(bignumber_js_1.default.ROUND_CEIL)
        : exactPrice;
}
exports.estimateCurrentPrice = estimateCurrentPrice;
/**
 * Get the Wyvern representation of a fungible asset
 * @param schema The WyvernSchema needed to access this asset
 * @param asset The asset to trade
 * @param quantity The number of items to trade
 */
function getWyvernAsset(schema, asset, quantity = new bignumber_js_1.default(1)) {
    const tokenId = asset.tokenId != null ? asset.tokenId.toString() : undefined;
    return schema.assetFromFields({
        ID: tokenId,
        Quantity: quantity.toString(),
        Address: asset.tokenAddress.toLowerCase(),
        Name: asset.name,
    });
}
exports.getWyvernAsset = getWyvernAsset;
/**
 * Get the Wyvern representation of a group of assets
 * Sort order is enforced here. Throws if there's a duplicate.
 * @param assets Assets to bundle
 * @param schemas The WyvernSchemas needed to access each asset, respectively
 * @param quantities The quantity of each asset to bundle, respectively
 */
function getWyvernBundle(assets, schemas, quantities) {
    if (assets.length != quantities.length) {
        throw new Error("Bundle must have a quantity for every asset");
    }
    if (assets.length != schemas.length) {
        throw new Error("Bundle must have a schema for every asset");
    }
    const wyAssets = assets.map((asset, i) => getWyvernAsset(schemas[i], asset, quantities[i]));
    const sorters = [
        (assetAndSchema) => assetAndSchema.asset.address,
        (assetAndSchema) => assetAndSchema.asset.id || 0,
    ];
    const wyAssetsAndSchemas = wyAssets.map((asset, i) => ({
        asset,
        schema: schemas[i].name,
    }));
    const uniqueAssets = _.uniqBy(wyAssetsAndSchemas, (group) => `${sorters[0](group)}-${sorters[1](group)}`);
    if (uniqueAssets.length != wyAssetsAndSchemas.length) {
        throw new Error("Bundle can't contain duplicate assets");
    }
    const sortedWyAssetsAndSchemas = _.sortBy(wyAssetsAndSchemas, sorters);
    return {
        assets: sortedWyAssetsAndSchemas.map((group) => group.asset),
        schemas: sortedWyAssetsAndSchemas.map((group) => group.schema),
    };
}
exports.getWyvernBundle = getWyvernBundle;
/**
 * Get the non-prefixed hash for the order
 * (Fixes a Wyvern typescript issue and casing issue)
 * @param order order to hash
 */
function getOrderHash(order) {
    const orderWithStringTypes = Object.assign(Object.assign({}, order), { maker: order.maker.toLowerCase(), taker: order.taker.toLowerCase(), feeRecipient: order.feeRecipient.toLowerCase(), side: order.side.toString(), saleKind: order.saleKind.toString(), howToCall: order.howToCall.toString(), feeMethod: order.feeMethod.toString() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return wyvern_js_1.WyvernProtocol.getOrderHashHex(orderWithStringTypes);
}
exports.getOrderHash = getOrderHash;
/**
 * Assign an order and a new matching order to their buy/sell sides
 * @param order Original order
 * @param matchingOrder The result of _makeMatchingOrder
 */
function assignOrdersToSides(order, matchingOrder) {
    const isSellOrder = order.side == types_2.OrderSide.Sell;
    let buy;
    let sell;
    if (!isSellOrder) {
        buy = order;
        sell = Object.assign(Object.assign({}, matchingOrder), { v: buy.v, r: buy.r, s: buy.s });
    }
    else {
        sell = order;
        buy = Object.assign(Object.assign({}, matchingOrder), { v: sell.v, r: sell.r, s: sell.s });
    }
    return { buy, sell };
}
exports.assignOrdersToSides = assignOrdersToSides;
/**
 * Delay using setTimeout
 * @param ms milliseconds to wait
 */
function delay(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res) => setTimeout(res, ms));
    });
}
exports.delay = delay;
/**
 * Validates that an address exists, isn't null, and is properly
 * formatted for Wyvern and OpenSea
 * @param address input address
 */
function validateAndFormatWalletAddress(web3, address) {
    if (!address) {
        throw new Error("No wallet address found");
    }
    if (!web3.utils.isAddress(address)) {
        throw new Error("Invalid wallet address");
    }
    if (address == constants_2.NULL_ADDRESS) {
        throw new Error("Wallet cannot be the null address");
    }
    return address.toLowerCase();
}
exports.validateAndFormatWalletAddress = validateAndFormatWalletAddress;
/**
 * Notify developer when a pattern will be deprecated
 * @param msg message to log to console
 */
function onDeprecated(msg) {
    console.warn(`DEPRECATION NOTICE: ${msg}`);
}
exports.onDeprecated = onDeprecated;
/**
 * Get special-case approval addresses for an erc721 contract
 * @param erc721Contract contract to check
 */
function getNonCompliantApprovalAddress(erc721Contract, tokenId, _accountAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield Promise.allSettled([
            // CRYPTOKITTIES check
            erc721Contract.methods.kittyIndexToApproved(tokenId).call(),
            // Etherbots check
            erc721Contract.methods.partIndexToApproved(tokenId).call(),
        ]);
        return _.compact(results)[0].status;
    });
}
exports.getNonCompliantApprovalAddress = getNonCompliantApprovalAddress;
exports.merkleValidatorByNetwork = {
    [types_1.Network.Main]: constants_2.MERKLE_VALIDATOR_MAINNET,
    [types_1.Network.Rinkeby]: constants_2.MERKLE_VALIDATOR_RINKEBY,
};
/**
 * The longest time that an order is valid for is six months from the current date
 * @returns unix timestamp
 */
const getMaxOrderExpirationTimestamp = () => {
    const maxExpirationDate = new Date();
    maxExpirationDate.setMonth(maxExpirationDate.getMonth() + constants_2.MAX_EXPIRATION_MONTHS);
    maxExpirationDate.setDate(maxExpirationDate.getDate() - 1);
    return Math.round(maxExpirationDate.getTime() / 1000);
};
exports.getMaxOrderExpirationTimestamp = getMaxOrderExpirationTimestamp;
const hasErrorCode = (error) => {
    const untypedError = error;
    return !!untypedError.code;
};
exports.hasErrorCode = hasErrorCode;
const getAssetItemType = (schemaName) => {
    switch (schemaName) {
        case "ERC20":
            return constants_1.ItemType.ERC20;
        case "ERC721":
            return constants_1.ItemType.ERC721;
        case "ERC1155":
            return constants_1.ItemType.ERC1155;
        default:
            throw new Error(`Unknown schema name: ${schemaName}`);
    }
};
exports.getAssetItemType = getAssetItemType;
