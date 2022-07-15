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
exports.OpenSeaSDK = void 0;
const seaport_js_1 = require("@opensea/seaport-js");
const constants_1 = require("@opensea/seaport-js/lib/constants");
const bignumber_js_1 = require("bignumber.js");
const ethereumjs_util_1 = require("ethereumjs-util");
const ethers_1 = require("ethers");
const fbemitter_1 = require("fbemitter");
const _ = __importStar(require("lodash"));
const web3_1 = __importDefault(require("web3"));
const wyvern_js_1 = require("wyvern-js");
const WyvernSchemas = __importStar(require("wyvern-schemas"));
const api_1 = require("./api");
const constants_2 = require("./constants");
const contracts_1 = require("./contracts");
const debugging_1 = require("./debugging");
const privateListings_1 = require("./orders/privateListings");
const types_1 = require("./types");
const schema_1 = require("./utils/schema");
const utils_1 = require("./utils/utils");
class OpenSeaSDK {
    /**
     * Your very own seaport.
     * Create a new instance of OpenSeaJS.
     * @param provider Web3 Provider to use for transactions. For example:
     *  `const provider = new Web3.providers.HttpProvider('https://mainnet.infura.io')`
     * @param apiConfig configuration options, including `networkName`
     * @param logger logger, optional, a function that will be called with debugging
     *  information
     */
    constructor(provider, apiConfig = {}, logger) {
        var _b;
        // Extra gwei to add to the mean gas price when making transactions
        this.gasPriceAddition = new bignumber_js_1.BigNumber(3);
        // Multiply gas estimate by this factor when making transactions
        this.gasIncreaseFactor = constants_2.DEFAULT_GAS_INCREASE_FACTOR;
        this.getAmountWithBasisPointsApplied = (amount, basisPoints) => {
            return amount
                .multipliedBy(basisPoints)
                .dividedBy(constants_2.INVERSE_BASIS_POINT)
                .toString();
        };
        // API config
        apiConfig.networkName = apiConfig.networkName || types_1.Network.Main;
        this.api = new api_1.OpenSeaAPI(apiConfig);
        this._wyvernConfigOverride = apiConfig.wyvernConfig;
        this._networkName = apiConfig.networkName;
        const readonlyProvider = new web3_1.default.providers.HttpProvider(`${this.api.apiBaseUrl}/${constants_2.RPC_URL_PATH}`);
        const useReadOnlyProvider = (_b = apiConfig.useReadOnlyProvider) !== null && _b !== void 0 ? _b : true;
        // Web3 Config
        this.web3 = new web3_1.default(provider);
        this.web3ReadOnly = useReadOnlyProvider
            ? new web3_1.default(readonlyProvider)
            : this.web3;
        // Ethers Config
        this.ethersProvider = new ethers_1.providers.Web3Provider(provider);
        this.seaport = new seaport_js_1.Seaport(this.ethersProvider, {
            conduitKeyToConduit: constants_2.CONDUIT_KEYS_TO_CONDUIT,
            overrides: {
                defaultConduitKey: constants_2.CROSS_CHAIN_DEFAULT_CONDUIT_KEY,
            },
        });
        // WyvernJS config
        this._wyvernProtocol = new wyvern_js_1.WyvernProtocol(provider, Object.assign({ network: this._networkName }, apiConfig.wyvernConfig));
        // WyvernJS config for readonly (optimization for infura calls)
        this._wyvernProtocolReadOnly = useReadOnlyProvider
            ? new wyvern_js_1.WyvernProtocol(readonlyProvider, Object.assign({ network: this._networkName }, apiConfig.wyvernConfig))
            : this._wyvernProtocol;
        // WrappedNFTLiquidationProxy Config
        this._wrappedNFTFactoryAddress =
            this._networkName == types_1.Network.Main
                ? constants_2.WRAPPED_NFT_FACTORY_ADDRESS_MAINNET
                : constants_2.WRAPPED_NFT_FACTORY_ADDRESS_RINKEBY;
        this._wrappedNFTLiquidationProxyAddress =
            this._networkName == types_1.Network.Main
                ? constants_2.WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_MAINNET
                : constants_2.WRAPPED_NFT_LIQUIDATION_PROXY_ADDRESS_RINKEBY;
        this._uniswapFactoryAddress =
            this._networkName == types_1.Network.Main
                ? constants_2.UNISWAP_FACTORY_ADDRESS_MAINNET
                : constants_2.UNISWAP_FACTORY_ADDRESS_RINKEBY;
        // Emit events
        this._emitter = new fbemitter_1.EventEmitter();
        // Debugging: default to nothing
        this.logger = logger || ((arg) => arg);
    }
    /**
     * Add a listener to a marketplace event
     * @param event An event to listen for
     * @param listener A callback that will accept an object with event data
     * @param once Whether the listener should only be called once
     */
    addListener(event, listener, once = false) {
        const subscription = once
            ? this._emitter.once(event, listener)
            : this._emitter.addListener(event, listener);
        return subscription;
    }
    /**
     * Remove an event listener, included here for completeness.
     * Simply calls `.remove()` on a subscription
     * @param subscription The event subscription returned from `addListener`
     */
    removeListener(subscription) {
        subscription.remove();
    }
    /**
     * Remove all event listeners. Good idea to call this when you're unmounting
     * a component that listens to events to make UI updates
     * @param event Optional EventType to remove listeners for
     */
    removeAllListeners(event) {
        this._emitter.removeAllListeners(event);
    }
    /**
     * Wraps an arbitrary group of NFTs into their corresponding WrappedNFT ERC20 tokens.
     * Emits the `WrapAssets` event when the transaction is prompted.
     * @param param0 __namedParameters Object
     * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to bundle together.
     * @param accountAddress Address of the user's wallet
     */
    wrapAssets({ assets, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = this._getSchema(types_1.WyvernSchemaName.ERC721);
            const wyAssets = assets.map((a) => (0, utils_1.getWyvernAsset)(schema, a));
            // Separate assets out into two arrays of tokenIds and tokenAddresses
            const tokenIds = wyAssets.map((a) => a.id);
            const tokenAddresses = wyAssets.map((a) => a.address);
            // Check if all tokenAddresses match. If not, then we have a mixedBatch of
            // NFTs from different NFT core contracts
            const isMixedBatchOfAssets = !tokenAddresses.every((val, _i, arr) => val === arr[0]);
            this._dispatch(types_1.EventType.WrapAssets, { assets: wyAssets, accountAddress });
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: this._wrappedNFTLiquidationProxyAddress,
                value: 0,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.WrappedNFTLiquidationProxy, "wrapNFTs"), [
                    tokenIds,
                    tokenAddresses,
                    isMixedBatchOfAssets,
                ]),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.WrapAssets, "Wrapping Assets");
        });
    }
    /**
     * Unwraps an arbitrary group of NFTs from their corresponding WrappedNFT ERC20 tokens back into ERC721 tokens.
     * Emits the `UnwrapAssets` event when the transaction is prompted.
     * @param param0 __namedParameters Object
     * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to bundle together.
     * @param destinationAddresses Addresses that each resulting ERC721 token will be sent to. Must be the same length as `tokenIds`. Each address corresponds with its respective token ID in the `tokenIds` array.
     * @param accountAddress Address of the user's wallet
     */
    unwrapAssets({ assets, destinationAddresses, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!assets ||
                !destinationAddresses ||
                assets.length != destinationAddresses.length) {
                throw new Error("The 'assets' and 'destinationAddresses' arrays must exist and have the same length.");
            }
            const schema = this._getSchema(types_1.WyvernSchemaName.ERC721);
            const wyAssets = assets.map((a) => (0, utils_1.getWyvernAsset)(schema, a));
            // Separate assets out into two arrays of tokenIds and tokenAddresses
            const tokenIds = wyAssets.map((a) => a.id);
            const tokenAddresses = wyAssets.map((a) => a.address);
            // Check if all tokenAddresses match. If not, then we have a mixedBatch of
            // NFTs from different NFT core contracts
            const isMixedBatchOfAssets = !tokenAddresses.every((val, _i, arr) => val === arr[0]);
            this._dispatch(types_1.EventType.UnwrapAssets, {
                assets: wyAssets,
                accountAddress,
            });
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: this._wrappedNFTLiquidationProxyAddress,
                value: 0,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.WrappedNFTLiquidationProxy, "unwrapNFTs"), [
                    tokenIds,
                    tokenAddresses,
                    destinationAddresses,
                    isMixedBatchOfAssets,
                ]),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.UnwrapAssets, "Unwrapping Assets");
        });
    }
    /**
     * Liquidates an arbitrary group of NFTs by atomically wrapping them into their
     * corresponding WrappedNFT ERC20 tokens, and then immediately selling those
     * ERC20 tokens on their corresponding Uniswap exchange.
     * Emits the `LiquidateAssets` event when the transaction is prompted.
     * @param param0 __namedParameters Object
     * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to bundle together.
     * @param accountAddress Address of the user's wallet
     * @param uniswapSlippageAllowedInBasisPoints The amount of slippage that a user will tolerate in their Uniswap trade; if Uniswap cannot fulfill the order without more slippage, the whole function will revert.
     */
    liquidateAssets({ assets, accountAddress, uniswapSlippageAllowedInBasisPoints, }) {
        return __awaiter(this, void 0, void 0, function* () {
            // If no slippage parameter is provided, use a sane default value
            const uniswapSlippage = uniswapSlippageAllowedInBasisPoints === 0
                ? constants_2.DEFAULT_WRAPPED_NFT_LIQUIDATION_UNISWAP_SLIPPAGE_IN_BASIS_POINTS
                : uniswapSlippageAllowedInBasisPoints;
            const schema = this._getSchema(types_1.WyvernSchemaName.ERC721);
            const wyAssets = assets.map((a) => (0, utils_1.getWyvernAsset)(schema, a));
            // Separate assets out into two arrays of tokenIds and tokenAddresses
            const tokenIds = wyAssets.map((a) => a.id);
            const tokenAddresses = wyAssets.map((a) => a.address);
            // Check if all tokenAddresses match. If not, then we have a mixedBatch of
            // NFTs from different NFT core contracts
            const isMixedBatchOfAssets = !tokenAddresses.every((val, _i, arr) => val === arr[0]);
            this._dispatch(types_1.EventType.LiquidateAssets, {
                assets: wyAssets,
                accountAddress,
            });
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: this._wrappedNFTLiquidationProxyAddress,
                value: 0,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.WrappedNFTLiquidationProxy, "liquidateNFTs"), [tokenIds, tokenAddresses, isMixedBatchOfAssets, uniswapSlippage]),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.LiquidateAssets, "Liquidating Assets");
        });
    }
    /**
     * Purchases a bundle of WrappedNFT tokens from Uniswap and then unwraps them into ERC721 tokens.
     * Emits the `PurchaseAssets` event when the transaction is prompted.
     * @param param0 __namedParameters Object
     * @param numTokensToBuy The number of WrappedNFT tokens to purchase and unwrap
     * @param amount The estimated cost in wei for tokens (probably some ratio above the minimum amount to avoid the transaction failing due to frontrunning, minimum amount is found by calling UniswapExchange(uniswapAddress).getEthToTokenOutputPrice(numTokensToBuy.mul(10**18));
     * @param contractAddress Address of the corresponding NFT core contract for these NFTs.
     * @param accountAddress Address of the user's wallet
     */
    purchaseAssets({ numTokensToBuy, amount, contractAddress, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            this._dispatch(types_1.EventType.PurchaseAssets, {
                amount,
                contractAddress,
                accountAddress,
            });
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: this._wrappedNFTLiquidationProxyAddress,
                value: amount,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.WrappedNFTLiquidationProxy, "purchaseNFTs"), [numTokensToBuy, contractAddress]),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.PurchaseAssets, "Purchasing Assets");
        });
    }
    /**
     * Gets the estimated cost or payout of either buying or selling NFTs to Uniswap using either purchaseAssts() or liquidateAssets()
     * @param param0 __namedParameters Object
     * @param numTokens The number of WrappedNFT tokens to either purchase or sell
     * @param isBuying A bool for whether the user is buying or selling
     * @param contractAddress Address of the corresponding NFT core contract for these NFTs.
     */
    getQuoteFromUniswap({ numTokens, isBuying, contractAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get UniswapExchange for WrappedNFTContract for contractAddress
            const wrappedNFTFactory = new this.web3.eth.Contract(contracts_1.WrappedNFTFactory, this._wrappedNFTFactoryAddress);
            const wrappedNFTAddress = yield wrappedNFTFactory.methods
                .nftContractToWrapperContract(contractAddress)
                .call();
            const wrappedNFT = new this.web3.eth.Contract(contracts_1.WrappedNFT, wrappedNFTAddress);
            const uniswapFactory = new this.web3.eth.Contract(contracts_1.UniswapFactory, this._uniswapFactoryAddress);
            const uniswapExchangeAddress = yield uniswapFactory.methods
                .getExchange(wrappedNFTAddress)
                .call();
            const uniswapExchange = new this.web3.eth.Contract(contracts_1.UniswapExchange, uniswapExchangeAddress);
            // Convert desired WNFT to wei
            const amount = wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(numTokens), Number(wrappedNFT.methods.decimals().call()));
            // Return quote from Uniswap
            if (isBuying) {
                return parseInt(yield uniswapExchange.methods
                    .getEthToTokenOutputPrice(amount.toString())
                    .call());
            }
            else {
                return parseInt(yield uniswapExchange.methods
                    .getTokenToEthInputPrice(amount.toString())
                    .call());
            }
        });
    }
    /**
     * Wrap ETH into W-ETH.
     * W-ETH is needed for placing buy orders (making offers).
     * Emits the `WrapEth` event when the transaction is prompted.
     * @param param0 __namedParameters Object
     * @param amountInEth How much ether to wrap
     * @param accountAddress Address of the user's wallet containing the ether
     */
    wrapEth({ amountInEth, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = WyvernSchemas.tokens[this._networkName].canonicalWrappedEther;
            const amount = wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(amountInEth), token.decimals);
            this._dispatch(types_1.EventType.WrapEth, { accountAddress, amount });
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: token.address,
                value: amount,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.CanonicalWETH, "deposit"), []),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.WrapEth, "Wrapping ETH");
        });
    }
    /**
     * Unwrap W-ETH into ETH.
     * Emits the `UnwrapWeth` event when the transaction is prompted.
     * @param param0 __namedParameters Object
     * @param amountInEth How much W-ETH to unwrap
     * @param accountAddress Address of the user's wallet containing the W-ETH
     */
    unwrapWeth({ amountInEth, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = WyvernSchemas.tokens[this._networkName].canonicalWrappedEther;
            const amount = wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(amountInEth), token.decimals);
            this._dispatch(types_1.EventType.UnwrapWeth, { accountAddress, amount });
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: token.address,
                value: 0,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.CanonicalWETH, "withdraw"), [
                    amount.toString(),
                ]),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.UnwrapWeth, "Unwrapping W-ETH");
        });
    }
    getFees({ openseaAsset: asset, paymentTokenAddress, startAmount, endAmount, }) {
        return __awaiter(this, void 0, void 0, function* () {
            // Seller fee basis points
            const openseaSellerFeeBasisPoints = constants_2.DEFAULT_SELLER_FEE_BASIS_POINTS;
            const collectionSellerFeeBasisPoints = asset.collection.devSellerFeeBasisPoints;
            // Buyer fee basis points
            const openseaBuyerFeeBasisPoints = constants_2.DEFAULT_BUYER_FEE_BASIS_POINTS;
            const collectionBuyerFeeBasisPoints = asset.collection.devBuyerFeeBasisPoints;
            // Seller basis points
            const sellerBasisPoints = constants_2.INVERSE_BASIS_POINT -
                openseaSellerFeeBasisPoints -
                collectionSellerFeeBasisPoints;
            const getConsiderationItem = (basisPoints, recipient) => {
                return {
                    token: paymentTokenAddress,
                    amount: this.getAmountWithBasisPointsApplied(startAmount, basisPoints),
                    endAmount: this.getAmountWithBasisPointsApplied(endAmount !== null && endAmount !== void 0 ? endAmount : startAmount, basisPoints),
                    recipient,
                };
            };
            return {
                sellerFee: getConsiderationItem(sellerBasisPoints),
                openseaSellerFee: getConsiderationItem(openseaSellerFeeBasisPoints, constants_2.OPENSEA_FEE_RECIPIENT),
                collectionSellerFee: collectionSellerFeeBasisPoints > 0 && asset.collection.payoutAddress
                    ? getConsiderationItem(collectionSellerFeeBasisPoints, asset.collection.payoutAddress)
                    : undefined,
                openseaBuyerFee: openseaBuyerFeeBasisPoints > 0
                    ? getConsiderationItem(openseaBuyerFeeBasisPoints, constants_2.OPENSEA_FEE_RECIPIENT)
                    : undefined,
                collectionBuyerFee: collectionBuyerFeeBasisPoints > 0 && asset.collection.payoutAddress
                    ? getConsiderationItem(collectionBuyerFeeBasisPoints, asset.collection.payoutAddress)
                    : undefined,
            };
        });
    }
    getAssetItems(assets, quantities = [], fallbackSchema) {
        return assets.map((asset, index) => {
            var _b, _c, _d;
            return ({
                itemType: (0, utils_1.getAssetItemType)((_b = this._getSchemaName(asset)) !== null && _b !== void 0 ? _b : fallbackSchema),
                token: asset.tokenAddress,
                identifier: (_c = asset.tokenId) !== null && _c !== void 0 ? _c : undefined,
                amount: (_d = quantities[index].toString()) !== null && _d !== void 0 ? _d : "1",
            });
        });
    }
    /**
     * Create a buy order to make an offer on a bundle or group of assets.
     * If the user hasn't approved W-ETH access yet, this will emit `ApproveCurrency` before asking for approval.
     * @param param0 __namedParameters Object
     * @param assets Array of Asset objects to bid on
     * @param collection Optional collection for computing fees, required only if all assets belong to the same collection
     * @param quantities The quantity of each asset to sell. Defaults to 1 for each.
     * @param accountAddress Address of the maker's wallet
     * @param startAmount Value of the offer, in units of the payment token (or wrapped ETH if no payment token address specified)
     * @param expirationTime Expiration time for the order, in seconds.
     * @param paymentTokenAddress Optional address for using an ERC-20 token in the order. If unspecified, defaults to W-ETH
     * @param sellOrder Optional sell order (like an English auction) to ensure fee and schema compatibility
     * @param referrerAddress The optional address that referred the order
     */
    createBundleBuyOrderLegacyWyvern({ assets, collection, quantities, accountAddress, startAmount, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), paymentTokenAddress, sellOrder, referrerAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            // Default to 1 of each asset
            quantities = quantities || assets.map((_a) => 1);
            paymentTokenAddress =
                paymentTokenAddress ||
                    WyvernSchemas.tokens[this._networkName].canonicalWrappedEther.address;
            if (!paymentTokenAddress) {
                throw new Error("Payment token required");
            }
            const order = yield this._makeBundleBuyOrder({
                assets,
                collection,
                quantities,
                accountAddress,
                startAmount,
                expirationTime,
                paymentTokenAddress,
                extraBountyBasisPoints: 0,
                sellOrder,
                referrerAddress,
            });
            // NOTE not in Wyvern exchange code:
            // frontend checks to make sure
            // token is approved and sufficiently available
            yield this._buyOrderValidationAndApprovals({ order, accountAddress });
            const hashedOrder = Object.assign(Object.assign({}, order), { hash: (0, utils_1.getOrderHash)(order) });
            let signature;
            try {
                signature = yield this.authorizeOrder(hashedOrder);
            }
            catch (error) {
                console.error(error);
                throw new Error("You declined to authorize your offer");
            }
            const orderWithSignature = Object.assign(Object.assign({}, hashedOrder), signature);
            return this.validateAndPostOrder(orderWithSignature);
        });
    }
    /**
     * Create a buy order to make an offer on an asset.
     * @param options Options for creating the buy order
     * @param options.asset The asset to trade
     * @param options.accountAddress Address of the maker's wallet
     * @param options.startAmount Value of the offer, in units of the payment token (or wrapped ETH if no payment token address specified)
     * @param options.quantity The number of assets to bid for (if fungible or semi-fungible). Defaults to 1. In units, not base units, e.g. not wei
     * @param options.expirationTime Expiration time for the order, in seconds
     * @param options.paymentTokenAddress Optional address for using an ERC-20 token in the order. If unspecified, defaults to WETH
     */
    createBuyOrder({ asset, accountAddress, startAmount, quantity = 1, expirationTime, paymentTokenAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!asset.tokenId) {
                throw new Error("Asset must have a tokenId");
            }
            paymentTokenAddress =
                paymentTokenAddress !== null && paymentTokenAddress !== void 0 ? paymentTokenAddress : constants_2.WETH_ADDRESS_BY_NETWORK[this._networkName];
            const openseaAsset = yield this.api.getAsset(asset);
            const considerationAssetItems = this.getAssetItems([openseaAsset], [(0, utils_1.makeBigNumber)(quantity)]);
            const { basePrice } = yield this._getPriceParameters(types_1.OrderSide.Buy, paymentTokenAddress, (0, utils_1.makeBigNumber)(expirationTime !== null && expirationTime !== void 0 ? expirationTime : (0, utils_1.getMaxOrderExpirationTimestamp)()), (0, utils_1.makeBigNumber)(startAmount));
            const { openseaSellerFee, collectionSellerFee } = yield this.getFees({
                openseaAsset,
                paymentTokenAddress,
                startAmount: basePrice,
            });
            const considerationFeeItems = [
                openseaSellerFee,
                collectionSellerFee,
            ].filter((item) => item !== undefined);
            const { executeAllActions } = yield this.seaport.createOrder({
                offer: [
                    {
                        token: paymentTokenAddress,
                        amount: basePrice.toString(),
                    },
                ],
                consideration: [...considerationAssetItems, ...considerationFeeItems],
                endTime: (_b = expirationTime === null || expirationTime === void 0 ? void 0 : expirationTime.toString()) !== null && _b !== void 0 ? _b : (0, utils_1.getMaxOrderExpirationTimestamp)().toString(),
                zone: constants_2.DEFAULT_ZONE_BY_NETWORK[this._networkName],
            }, accountAddress);
            const order = yield executeAllActions();
            return this.api.postOrder(order, { protocol: "seaport", side: "bid" });
        });
    }
    /**
     * Create a buy order to make an offer on an asset.
     * If the user hasn't approved W-ETH access yet, this will emit `ApproveCurrency` before asking for approval.
     * @param param0 __namedParameters Object
     * @param asset The asset to trade
     * @param accountAddress Address of the maker's wallet
     * @param startAmount Value of the offer, in units of the payment token (or wrapped ETH if no payment token address specified)
     * @param quantity The number of assets to bid for (if fungible or semi-fungible). Defaults to 1. In units, not base units, e.g. not wei.
     * @param expirationTime Expiration time for the order, in seconds.
     * @param paymentTokenAddress Optional address for using an ERC-20 token in the order. If unspecified, defaults to W-ETH
     * @param sellOrder Optional sell order (like an English auction) to ensure fee and schema compatibility
     * @param referrerAddress The optional address that referred the order
     */
    createBuyOrderLegacyWyvern({ asset, accountAddress, startAmount, quantity = 1, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), paymentTokenAddress, sellOrder, referrerAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            paymentTokenAddress =
                paymentTokenAddress ||
                    WyvernSchemas.tokens[this._networkName].canonicalWrappedEther.address;
            if (!paymentTokenAddress) {
                throw new Error("Payment token required");
            }
            const order = yield this._makeBuyOrder({
                asset,
                quantity,
                accountAddress,
                startAmount,
                expirationTime,
                paymentTokenAddress,
                extraBountyBasisPoints: 0,
                sellOrder,
                referrerAddress,
            });
            // NOTE not in Wyvern exchange code:
            // frontend checks to make sure
            // token is approved and sufficiently available
            yield this._buyOrderValidationAndApprovals({ order, accountAddress });
            const hashedOrder = Object.assign(Object.assign({}, order), { hash: (0, utils_1.getOrderHash)(order) });
            let signature;
            try {
                signature = yield this.authorizeOrder(hashedOrder);
            }
            catch (error) {
                console.error(error);
                throw new Error("You declined to authorize your offer");
            }
            const orderWithSignature = Object.assign(Object.assign({}, hashedOrder), signature);
            return this.validateAndPostOrder(orderWithSignature);
        });
    }
    /**
     * Create a sell order to auction an asset.
     * @param options Options for creating the sell order
     * @param options.asset The asset to trade
     * @param options.accountAddress Address of the maker's wallet
     * @param options.startAmount Price of the asset at the start of the auction. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
     * @param options.endAmount Optional price of the asset at the end of its expiration time. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
     * @param options.quantity The number of assets to sell (if fungible or semi-fungible). Defaults to 1. In units, not base units, e.g. not wei.
     * @param options.listingTime Optional time when the order will become fulfillable, in UTC seconds. Undefined means it will start now.
     * @param options.expirationTime Expiration time for the order, in UTC seconds.
     * @param options.paymentTokenAddress Address of the ERC-20 token to accept in return. If undefined or null, uses Ether.
     * @param options.buyerAddress Optional address that's allowed to purchase this item. If specified, no other address will be able to take the order, unless its value is the null address.
     */
    createSellOrder({ asset, accountAddress, startAmount, endAmount, quantity = 1, listingTime, expirationTime, paymentTokenAddress = constants_2.NULL_ADDRESS, buyerAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!asset.tokenId) {
                throw new Error("Asset must have a tokenId");
            }
            const openseaAsset = yield this.api.getAsset(asset);
            const offerAssetItems = this.getAssetItems([openseaAsset], [(0, utils_1.makeBigNumber)(quantity)]);
            const { basePrice, endPrice } = yield this._getPriceParameters(types_1.OrderSide.Sell, paymentTokenAddress, (0, utils_1.makeBigNumber)(expirationTime !== null && expirationTime !== void 0 ? expirationTime : (0, utils_1.getMaxOrderExpirationTimestamp)()), (0, utils_1.makeBigNumber)(startAmount), endAmount !== undefined ? (0, utils_1.makeBigNumber)(endAmount) : undefined);
            const { sellerFee, openseaSellerFee, collectionSellerFee } = yield this.getFees({
                openseaAsset,
                paymentTokenAddress,
                startAmount: basePrice,
                endAmount: endPrice,
            });
            const considerationFeeItems = [
                sellerFee,
                openseaSellerFee,
                collectionSellerFee,
            ].filter((item) => item !== undefined);
            if (buyerAddress) {
                considerationFeeItems.push(...(0, privateListings_1.getPrivateListingConsiderations)(offerAssetItems, buyerAddress));
            }
            const { executeAllActions } = yield this.seaport.createOrder({
                offer: offerAssetItems,
                consideration: considerationFeeItems,
                startTime: listingTime,
                endTime: (_b = expirationTime === null || expirationTime === void 0 ? void 0 : expirationTime.toString()) !== null && _b !== void 0 ? _b : (0, utils_1.getMaxOrderExpirationTimestamp)().toString(),
                zone: constants_2.DEFAULT_ZONE_BY_NETWORK[this._networkName],
            }, accountAddress);
            const order = yield executeAllActions();
            return this.api.postOrder(order, { protocol: "seaport", side: "ask" });
        });
    }
    /**
     * Create a sell order to auction an asset.
     * Will throw a 'You do not own enough of this asset' error if the maker doesn't have the asset or not enough of it to sell the specific `quantity`.
     * If the user hasn't approved access to the token yet, this will emit `ApproveAllAssets` (or `ApproveAsset` if the contract doesn't support approve-all) before asking for approval.
     * @param param0 __namedParameters Object
     * @param tokenId DEPRECATED: Token ID. Use `asset` instead.
     * @param tokenAddress DEPRECATED: Address of the token's contract. Use `asset` instead.
     * @param asset The asset to trade
     * @param accountAddress Address of the maker's wallet
     * @param startAmount Price of the asset at the start of the auction. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
     * @param endAmount Optional price of the asset at the end of its expiration time. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
     * @param quantity The number of assets to sell (if fungible or semi-fungible). Defaults to 1. In units, not base units, e.g. not wei.
     * @param listingTime Optional time when the order will become fulfillable, in UTC seconds. Undefined means it will start now.
     * @param expirationTime Expiration time for the order, in UTC seconds.
     * @param waitForHighestBid If set to true, this becomes an English auction that increases in price for every bid. The highest bid wins when the auction expires, as long as it's at least `startAmount`. `expirationTime` must be > 0.
     * @param englishAuctionReservePrice Optional price level, below which orders may be placed but will not be matched.  Orders below the reserve can be manually accepted but will not be automatically matched.
     * @param paymentTokenAddress Address of the ERC-20 token to accept in return. If undefined or null, uses Ether.
     * @param extraBountyBasisPoints Optional basis points (1/100th of a percent) to reward someone for referring the fulfillment of this order
     * @param buyerAddress Optional address that's allowed to purchase this item. If specified, no other address will be able to take the order, unless its value is the null address.
     * @param buyerEmail Optional email of the user that's allowed to purchase this item. If specified, a user will have to verify this email before being able to take the order.
     */
    createSellOrderLegacyWyvern({ asset, accountAddress, startAmount, endAmount, quantity = 1, listingTime, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), waitForHighestBid = false, englishAuctionReservePrice, paymentTokenAddress, extraBountyBasisPoints = 0, buyerAddress, buyerEmail, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield this._makeSellOrder({
                asset,
                quantity,
                accountAddress,
                startAmount,
                endAmount,
                listingTime,
                expirationTime,
                waitForHighestBid,
                englishAuctionReservePrice,
                paymentTokenAddress: paymentTokenAddress || constants_2.NULL_ADDRESS,
                extraBountyBasisPoints,
                buyerAddress: buyerAddress || constants_2.NULL_ADDRESS,
            });
            yield this._sellOrderValidationAndApprovals({ order, accountAddress });
            if (buyerEmail) {
                yield this._createEmailWhitelistEntry({ order, buyerEmail });
            }
            const hashedOrder = Object.assign(Object.assign({}, order), { hash: (0, utils_1.getOrderHash)(order) });
            let signature;
            try {
                signature = yield this.authorizeOrder(hashedOrder);
            }
            catch (error) {
                console.error(error);
                throw new Error("You declined to authorize your auction");
            }
            const orderWithSignature = Object.assign(Object.assign({}, hashedOrder), signature);
            return this.validateAndPostOrder(orderWithSignature);
        });
    }
    /**
     * Create multiple sell orders in bulk to auction assets out of an asset factory.
     * Will throw a 'You do not own this asset' error if the maker doesn't own the factory.
     * Items will mint to users' wallets only when they buy them. See https://docs.opensea.io/docs/opensea-initial-item-sale-tutorial for more info.
     * If the user hasn't approved access to the token yet, this will emit `ApproveAllAssets` (or `ApproveAsset` if the contract doesn't support approve-all) before asking for approval.
     * @param param0 __namedParameters Object
     * @param assets Which assets you want to post orders for. Use the tokenAddress of your factory contract
     * @param accountAddress Address of the factory owner's wallet
     * @param startAmount Price of the asset at the start of the auction, or minimum acceptable bid if it's an English auction. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
     * @param endAmount Optional price of the asset at the end of its expiration time. If not specified, will be set to `startAmount`. Units are in the amount of a token above the token's decimal places (integer part). For example, for ether, expected units are in ETH, not wei.
     * @param quantity The number of assets to sell at one time (if fungible or semi-fungible). Defaults to 1. In units, not base units, e.g. not wei.
     * @param listingTime Optional time when the order will become fulfillable, in UTC seconds. Undefined means it will start now.
     * @param expirationTime Expiration time for the order, in seconds.
     * @param waitForHighestBid If set to true, this becomes an English auction that increases in price for every bid. The highest bid wins when the auction expires, as long as it's at least `startAmount`. `expirationTime` must be > 0.
     * @param paymentTokenAddress Address of the ERC-20 token to accept in return. If undefined or null, uses Ether.
     * @param extraBountyBasisPoints Optional basis points (1/100th of a percent) to reward someone for referring the fulfillment of each order
     * @param buyerAddress Optional address that's allowed to purchase each item. If specified, no other address will be able to take each order.
     * @param buyerEmail Optional email of the user that's allowed to purchase each item. If specified, a user will have to verify this email before being able to take each order.
     * @param numberOfOrders Number of times to repeat creating the same order for each asset. If greater than 5, creates them in batches of 5. Requires an `apiKey` to be set during seaport initialization in order to not be throttled by the API.
     * @returns The number of orders created in total
     */
    createFactorySellOrders({ assets, accountAddress, startAmount, endAmount, quantity = 1, listingTime, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), waitForHighestBid = false, paymentTokenAddress, extraBountyBasisPoints = 0, buyerAddress, buyerEmail, numberOfOrders = 1, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (numberOfOrders < 1) {
                throw new Error("Need to make at least one sell order");
            }
            if (!assets || !assets.length) {
                throw new Error("Need at least one asset to create orders for");
            }
            if (_.uniqBy(assets, (a) => a.tokenAddress).length !== 1) {
                throw new Error("All assets must be on the same factory contract address");
            }
            // Validate just a single dummy order but don't post it
            const dummyOrder = yield this._makeSellOrder({
                asset: assets[0],
                quantity,
                accountAddress,
                startAmount,
                endAmount,
                listingTime,
                expirationTime,
                waitForHighestBid,
                paymentTokenAddress: paymentTokenAddress || constants_2.NULL_ADDRESS,
                extraBountyBasisPoints,
                buyerAddress: buyerAddress || constants_2.NULL_ADDRESS,
            });
            yield this._sellOrderValidationAndApprovals({
                order: dummyOrder,
                accountAddress,
            });
            const _makeAndPostOneSellOrder = (asset) => __awaiter(this, void 0, void 0, function* () {
                const order = yield this._makeSellOrder({
                    asset,
                    quantity,
                    accountAddress,
                    startAmount,
                    endAmount,
                    listingTime,
                    expirationTime,
                    waitForHighestBid,
                    paymentTokenAddress: paymentTokenAddress || constants_2.NULL_ADDRESS,
                    extraBountyBasisPoints,
                    buyerAddress: buyerAddress || constants_2.NULL_ADDRESS,
                });
                if (buyerEmail) {
                    yield this._createEmailWhitelistEntry({ order, buyerEmail });
                }
                const hashedOrder = Object.assign(Object.assign({}, order), { hash: (0, utils_1.getOrderHash)(order) });
                let signature;
                try {
                    signature = yield this.authorizeOrder(hashedOrder);
                }
                catch (error) {
                    console.error(error);
                    throw new Error("You declined to authorize your auction, or your web3 provider can't sign using personal_sign. Try 'web3-provider-engine' and make sure a mnemonic is set. Just a reminder: there's no gas needed anymore to mint tokens!");
                }
                const orderWithSignature = Object.assign(Object.assign({}, hashedOrder), signature);
                return this.validateAndPostOrder(orderWithSignature);
            });
            const range = _.range(numberOfOrders * assets.length);
            const batches = _.chunk(range, constants_2.SELL_ORDER_BATCH_SIZE);
            let numOrdersCreated = 0;
            for (const subRange of batches) {
                // subRange = e.g. [5, 6, 7, 8, 9]
                // batches of assets = e.g. [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, ... 10]
                // Will block until all SELL_ORDER_BATCH_SIZE orders
                // have come back in parallel
                const batchOrdersCreated = yield Promise.all(subRange.map((assetOrderIndex) => __awaiter(this, void 0, void 0, function* () {
                    const assetIndex = Math.floor(assetOrderIndex / numberOfOrders);
                    return _makeAndPostOneSellOrder(assets[assetIndex]);
                })));
                this.logger(`Created and posted a batch of ${batchOrdersCreated.length} orders in parallel.`);
                numOrdersCreated += batchOrdersCreated.length;
                // Don't overwhelm router
                yield (0, utils_1.delay)(500);
            }
            return numOrdersCreated;
        });
    }
    /**
     * Create a sell order to auction a bundle of assets.
     * Will throw a 'You do not own this asset' error if the maker doesn't have one of the assets.
     * If the user hasn't approved access to any of the assets yet, this will emit `ApproveAllAssets` (or `ApproveAsset` if the contract doesn't support approve-all) before asking for approval for each asset.
     * @param param0 __namedParameters Object
     * @param bundleName Name of the bundle
     * @param bundleDescription Optional description of the bundle. Markdown is allowed.
     * @param bundleExternalLink Optional link to a page that adds context to the bundle.
     * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to bundle together.
     * @param collection Optional collection for computing fees, required only if all assets belong to the same collection
     * @param quantities The quantity of each asset to sell. Defaults to 1 for each.
     * @param accountAddress The address of the maker of the bundle and the owner of all the assets.
     * @param startAmount Price of the asset at the start of the auction, or minimum acceptable bid if it's an English auction.
     * @param endAmount Optional price of the asset at the end of its expiration time. If not specified, will be set to `startAmount`.
     * @param listingTime Optional time when the order will become fulfillable, in UTC seconds. Undefined means it will start now.
     * @param expirationTime Expiration time for the order, in seconds.
     * @param waitForHighestBid If set to true, this becomes an English auction that increases in price for every bid. The highest bid wins when the auction expires, as long as it's at least `startAmount`. `expirationTime` must be > 0.
     * @param englishAuctionReservePrice Optional price level, below which orders may be placed but will not be matched.  Orders below the reserve can be manually accepted but will not be automatically matched.
     * @param paymentTokenAddress Address of the ERC-20 token to accept in return. If undefined or null, uses Ether.
     * @param extraBountyBasisPoints Optional basis points (1/100th of a percent) to reward someone for referring the fulfillment of this order
     * @param buyerAddress Optional address that's allowed to purchase this bundle. If specified, no other address will be able to take the order, unless it's the null address.
     */
    createBundleSellOrderLegacyWyvern({ bundleName, bundleDescription, bundleExternalLink, assets, collection, quantities, accountAddress, startAmount, endAmount, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), listingTime, waitForHighestBid = false, englishAuctionReservePrice, paymentTokenAddress, extraBountyBasisPoints = 0, buyerAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            // Default to one of each asset
            quantities = quantities || assets.map((_a) => 1);
            const order = yield this._makeBundleSellOrder({
                bundleName,
                bundleDescription,
                bundleExternalLink,
                assets,
                collection,
                quantities,
                accountAddress,
                startAmount,
                endAmount,
                listingTime,
                expirationTime,
                waitForHighestBid,
                englishAuctionReservePrice,
                paymentTokenAddress: paymentTokenAddress || constants_2.NULL_ADDRESS,
                extraBountyBasisPoints,
                buyerAddress: buyerAddress || constants_2.NULL_ADDRESS,
            });
            yield this._sellOrderValidationAndApprovals({ order, accountAddress });
            const hashedOrder = Object.assign(Object.assign({}, order), { hash: (0, utils_1.getOrderHash)(order) });
            let signature;
            try {
                signature = yield this.authorizeOrder(hashedOrder);
            }
            catch (error) {
                console.error(error);
                throw new Error("You declined to authorize your auction");
            }
            const orderWithSignature = Object.assign(Object.assign({}, hashedOrder), signature);
            return this.validateAndPostOrder(orderWithSignature);
        });
    }
    fulfillPrivateOrder({ order, accountAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            let transactionHash;
            switch (order.protocolAddress) {
                case constants_1.CROSS_CHAIN_SEAPORT_ADDRESS: {
                    if (!((_b = order.taker) === null || _b === void 0 ? void 0 : _b.address)) {
                        throw new Error("Order is not a private listing must have a taker address");
                    }
                    const counterOrder = (0, privateListings_1.constructPrivateListingCounterOrder)(order.protocolData, order.taker.address);
                    const fulfillments = (0, privateListings_1.getPrivateListingFulfillments)(order.protocolData);
                    const transaction = yield this.seaport
                        .matchOrders({
                        orders: [order.protocolData, counterOrder],
                        fulfillments,
                        overrides: {
                            value: counterOrder.parameters.offer[0].startAmount,
                        },
                        accountAddress,
                    })
                        .transact();
                    const transactionReceipt = yield transaction.wait();
                    transactionHash = transactionReceipt.transactionHash;
                    break;
                }
                default:
                    throw new Error("Unsupported protocol");
            }
            yield this._confirmTransaction(transactionHash, types_1.EventType.MatchOrders, "Fulfilling order");
            return transactionHash;
        });
    }
    /**
     * Fullfill or "take" an order for an asset, either a buy or sell order
     * @param options fullfillment options
     * @param options.order The order to fulfill, a.k.a. "take"
     * @param options.accountAddress The taker's wallet address
     * @param options.recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress
     * @returns Transaction hash for fulfilling the order
     */
    fulfillOrder({ order, accountAddress, recipientAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const isPrivateListing = !!order.taker;

            if (isPrivateListing) {
                if (recipientAddress) {
                    throw new Error("Private listings cannot be fulfilled with a recipient address");
                }
                return this.fulfillPrivateOrder({
                    order,
                    accountAddress,
                });
            }
            let transactionHash;
            switch (order.protocolAddress) {
                case constants_1.CROSS_CHAIN_SEAPORT_ADDRESS: {
                    const { executeAllActions } = yield this.seaport.fulfillOrder({
                        order: order.protocolData,
                        accountAddress,
                        recipientAddress,
                    });
                    const transaction = yield executeAllActions();
                    transactionHash = transaction.hash;
                    break;
                }
                default:
                    throw new Error("Unsupported protocol");
            }
            yield this._confirmTransaction(transactionHash, types_1.EventType.MatchOrders, "Fulfilling order");
            return transactionHash;
        });
    }
    /**
     * Fullfill or "take" an order for an asset, either a buy or sell order
     * @param param0 __namedParamaters Object
     * @param order The order to fulfill, a.k.a. "take"
     * @param accountAddress The taker's wallet address
     * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress.
     * @param referrerAddress The optional address that referred the order
     * @returns Transaction hash for fulfilling the order
     */
    fulfillOrderLegacyWyvern({ order, accountAddress, recipientAddress, referrerAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchingOrder = this._makeMatchingOrder({
                order,
                accountAddress,
                recipientAddress: recipientAddress || accountAddress,
            });
            const { buy, sell } = (0, utils_1.assignOrdersToSides)(order, matchingOrder);
            const metadata = this._getMetadata(order, referrerAddress);
            const transactionHash = yield this._atomicMatch({
                buy,
                sell,
                accountAddress,
                metadata,
            });
            yield this._confirmTransaction(transactionHash, types_1.EventType.MatchOrders, "Fulfilling order", () => __awaiter(this, void 0, void 0, function* () {
                const isOpen = yield this._validateOrder(order);
                return !isOpen;
            }));
            return transactionHash;
        });
    }
    cancelSeaportOrders({ orders, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.seaport
                .cancelOrders(orders, accountAddress)
                .transact();
            return transaction.hash;
        });
    }
    /**
     * Cancel an order on-chain, preventing it from ever being fulfilled.
     * @param param0 __namedParameters Object
     * @param order The order to cancel
     * @param accountAddress The order maker's wallet address
     */
    cancelOrder({ order, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            this._dispatch(types_1.EventType.CancelOrder, { orderV2: order, accountAddress });
            // Transact and get the transaction hash
            let transactionHash;
            switch (order.protocolAddress) {
                case constants_1.CROSS_CHAIN_SEAPORT_ADDRESS: {
                    transactionHash = yield this.cancelSeaportOrders({
                        orders: [order.protocolData.parameters],
                        accountAddress,
                    });
                    break;
                }
                default:
                    throw new Error("Unsupported protocol");
            }
            // Await transaction confirmation
            yield this._confirmTransaction(transactionHash, types_1.EventType.CancelOrder, "Cancelling order");
        });
    }
    /**
     * Cancel an order on-chain, preventing it from ever being fulfilled.
     * @param param0 __namedParameters Object
     * @param order The order to cancel
     * @param accountAddress The order maker's wallet address
     */
    cancelOrderLegacyWyvern({ order, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            this._dispatch(types_1.EventType.CancelOrder, { order, accountAddress });
            const transactionHash = yield this._wyvernProtocol.wyvernExchange
                .cancelOrder_([
                order.exchange,
                order.maker,
                order.taker,
                order.feeRecipient,
                order.target,
                order.staticTarget,
                order.paymentToken,
            ], [
                order.makerRelayerFee,
                order.takerRelayerFee,
                order.makerProtocolFee,
                order.takerProtocolFee,
                order.basePrice,
                order.extra,
                order.listingTime,
                order.expirationTime,
                order.salt,
            ], order.feeMethod, order.side, order.saleKind, order.howToCall, order.calldata, order.replacementPattern, order.staticExtradata, order.v || 0, order.r || constants_2.NULL_BLOCK_HASH, order.s || constants_2.NULL_BLOCK_HASH)
                .sendTransactionAsync({ from: accountAddress });
            yield this._confirmTransaction(transactionHash, types_1.EventType.CancelOrder, "Cancelling order", () => __awaiter(this, void 0, void 0, function* () {
                const isOpen = yield this._validateOrder(order);
                return !isOpen;
            }));
        });
    }
    /**
     * Cancel all existing orders with a lower nonce on-chain, preventing them from ever being fulfilled.
     * @param param0 __namedParameters Object
     * @param accountAddress The order maker's wallet address
     */
    bulkCancelExistingOrders({ accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            this._dispatch(types_1.EventType.BulkCancelExistingOrders, { accountAddress });
            const transactionHash = yield this._wyvernProtocol.wyvernExchange
                .incrementNonce()
                .sendTransactionAsync({ from: accountAddress });
            yield this._confirmTransaction(transactionHash.toString(), types_1.EventType.BulkCancelExistingOrders, "Bulk cancelling existing orders");
        });
    }
    /**
     * Approve a non-fungible token for use in trades.
     * Requires an account to be initialized first.
     * Called internally, but exposed for dev flexibility.
     * Checks to see if already approved, first. Then tries different approval methods from best to worst.
     * @param param0 __namedParameters Object
     * @param tokenId Token id to approve, but only used if approve-all isn't
     *  supported by the token contract
     * @param tokenAddress The contract address of the token being approved
     * @param accountAddress The user's wallet address
     * @param proxyAddress Address of the user's proxy contract. If not provided,
     *  will attempt to fetch it from Wyvern.
     * @param tokenAbi ABI of the token's contract. Defaults to a flexible ERC-721
     *  contract.
     * @param skipApproveAllIfTokenAddressIn an optional list of token addresses that, if a token is approve-all type, will skip approval
     * @param schemaName The Wyvern schema name corresponding to the asset type
     * @returns Transaction hash if a new transaction was created, otherwise null
     */
    approveSemiOrNonFungibleToken({ tokenId, tokenAddress, accountAddress, proxyAddress, tokenAbi = contracts_1.ERC721, skipApproveAllIfTokenAddressIn = new Set(), schemaName = types_1.WyvernSchemaName.ERC721, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = this._getSchema(schemaName);
            const tokenContract = new this.web3.eth.Contract(tokenAbi, tokenAddress);
            if (!proxyAddress) {
                proxyAddress = (yield this._getProxy(accountAddress)) || undefined;
                if (!proxyAddress) {
                    throw new Error("Uninitialized account");
                }
            }
            const approvalAllCheck = () => __awaiter(this, void 0, void 0, function* () {
                // NOTE:
                // Use this long way of calling so we can check for method existence on a bool-returning method.
                const isApprovedForAllRaw = yield (0, utils_1.rawCall)(this.web3ReadOnly, {
                    from: accountAddress,
                    to: tokenContract.options.address,
                    data: tokenContract.methods
                        .isApprovedForAll(accountAddress, proxyAddress)
                        .encodeABI(),
                });
                return parseInt(isApprovedForAllRaw);
            });
            const isApprovedForAll = yield approvalAllCheck();
            if (isApprovedForAll == 1) {
                // Supports ApproveAll
                this.logger("Already approved proxy for all tokens");
                return null;
            }
            if (isApprovedForAll == 0) {
                // Supports ApproveAll
                //  not approved for all yet
                if (skipApproveAllIfTokenAddressIn.has(tokenAddress)) {
                    this.logger("Already approving proxy for all tokens in another transaction");
                    return null;
                }
                skipApproveAllIfTokenAddressIn.add(tokenAddress);
                try {
                    this._dispatch(types_1.EventType.ApproveAllAssets, {
                        accountAddress,
                        proxyAddress,
                        contractAddress: tokenAddress,
                    });
                    const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                        from: accountAddress,
                        to: tokenContract.options.address,
                        data: tokenContract.methods
                            .setApprovalForAll(proxyAddress, true)
                            .encodeABI(),
                    }, (error) => {
                        this._dispatch(types_1.EventType.TransactionDenied, {
                            error,
                            accountAddress,
                        });
                    });
                    yield this._confirmTransaction(txHash, types_1.EventType.ApproveAllAssets, "Approving all tokens of this type for trading", () => __awaiter(this, void 0, void 0, function* () {
                        const result = yield approvalAllCheck();
                        return result == 1;
                    }));
                    return txHash;
                }
                catch (error) {
                    console.error(error);
                    throw new Error("Couldn't get permission to approve these tokens for trading. Their contract might not be implemented correctly. Please contact the developer!");
                }
            }
            // Does not support ApproveAll (ERC721 v1 or v2)
            this.logger("Contract does not support Approve All");
            const approvalOneCheck = () => __awaiter(this, void 0, void 0, function* () {
                // Note: approvedAddr will be 'undefined' if not supported
                let approvedAddr;
                try {
                    approvedAddr = yield tokenContract.methods
                        .getApproved(tokenId)
                        .call();
                    if (typeof approvedAddr === "string" && approvedAddr == "0x") {
                        // Geth compatibility
                        approvedAddr = undefined;
                    }
                }
                catch (error) {
                    console.error(error);
                }
                if (approvedAddr == proxyAddress) {
                    this.logger("Already approved proxy for this token");
                    return true;
                }
                this.logger(`Approve response: ${approvedAddr}`);
                // SPECIAL CASING non-compliant contracts
                if (!approvedAddr) {
                    approvedAddr = yield (0, utils_1.getNonCompliantApprovalAddress)(
                    // @ts-expect-error This is an actual contract instance
                    tokenContract, tokenId, accountAddress);
                    if (approvedAddr == proxyAddress) {
                        this.logger("Already approved proxy for this item");
                        return true;
                    }
                    this.logger(`Special-case approve response: ${approvedAddr}`);
                }
                return false;
            });
            const isApprovedForOne = yield approvalOneCheck();
            if (isApprovedForOne) {
                return null;
            }
            // Call `approve`
            try {
                this._dispatch(types_1.EventType.ApproveAsset, {
                    accountAddress,
                    proxyAddress,
                    asset: (0, utils_1.getWyvernAsset)(schema, { tokenId, tokenAddress }),
                });
                const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                    from: accountAddress,
                    to: tokenContract.options.address,
                    data: tokenContract.methods
                        .approve(proxyAddress, tokenId)
                        .encodeABI(),
                }, (error) => {
                    this._dispatch(types_1.EventType.TransactionDenied, {
                        error,
                        accountAddress,
                    });
                });
                yield this._confirmTransaction(txHash, types_1.EventType.ApproveAsset, "Approving single token for trading", approvalOneCheck);
                return txHash;
            }
            catch (error) {
                console.error(error);
                throw new Error("Couldn't get permission to approve this token for trading. Its contract might not be implemented correctly. Please contact the developer!");
            }
        });
    }
    /**
     * Approve a fungible token (e.g. W-ETH) for use in trades.
     * Called internally, but exposed for dev flexibility.
     * Checks to see if the minimum amount is already approved, first.
     * @param param0 __namedParameters Object
     * @param accountAddress The user's wallet address
     * @param tokenAddress The contract address of the token being approved
     * @param proxyAddress The user's proxy address. If unspecified, uses the Wyvern token transfer proxy address.
     * @param minimumAmount The minimum amount needed to skip a transaction. Defaults to the max-integer.
     * @returns Transaction hash if a new transaction occurred, otherwise null
     */
    approveFungibleToken({ accountAddress, tokenAddress, proxyAddress, minimumAmount = wyvern_js_1.WyvernProtocol.MAX_UINT_256, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            proxyAddress =
                proxyAddress ||
                    ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernTokenTransferProxyContractAddress) ||
                    wyvern_js_1.WyvernProtocol.getTokenTransferProxyAddress(this._networkName);
            const approvedAmount = yield this._getApprovedTokenCount({
                accountAddress,
                tokenAddress,
                proxyAddress,
            });
            if (approvedAmount.isGreaterThanOrEqualTo(minimumAmount)) {
                this.logger("Already approved enough currency for trading");
                return null;
            }
            this.logger(`Not enough token approved for trade: ${approvedAmount} approved to transfer ${tokenAddress}`);
            this._dispatch(types_1.EventType.ApproveCurrency, {
                accountAddress,
                contractAddress: tokenAddress,
                proxyAddress,
            });
            const hasOldApproveMethod = [constants_2.ENJIN_COIN_ADDRESS, constants_2.MANA_ADDRESS].includes(tokenAddress.toLowerCase());
            if (minimumAmount.isGreaterThan(0) && hasOldApproveMethod) {
                // Older erc20s require initial approval to be 0
                yield this.unapproveFungibleToken({
                    accountAddress,
                    tokenAddress,
                    proxyAddress,
                });
            }
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: tokenAddress,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.ERC20, "approve"), 
                // Always approve maximum amount, to prevent the need for followup
                // transactions (and because old ERC20s like MANA/ENJ are non-compliant)
                [proxyAddress, wyvern_js_1.WyvernProtocol.MAX_UINT_256.toString()]),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.ApproveCurrency, "Approving currency for trading", () => __awaiter(this, void 0, void 0, function* () {
                const newlyApprovedAmount = yield this._getApprovedTokenCount({
                    accountAddress,
                    tokenAddress,
                    proxyAddress,
                });
                return newlyApprovedAmount.isGreaterThanOrEqualTo(minimumAmount);
            }));
            return txHash;
        });
    }
    /**
     * Un-approve a fungible token (e.g. W-ETH) for use in trades.
     * Called internally, but exposed for dev flexibility.
     * Useful for old ERC20s that require a 0 approval count before
     * changing the count
     * @param param0 __namedParameters Object
     * @param accountAddress The user's wallet address
     * @param tokenAddress The contract address of the token being approved
     * @param proxyAddress The user's proxy address. If unspecified, uses the Wyvern token transfer proxy address.
     * @returns Transaction hash
     */
    unapproveFungibleToken({ accountAddress, tokenAddress, proxyAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            proxyAddress =
                proxyAddress ||
                    ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernTokenTransferProxyContractAddress) ||
                    wyvern_js_1.WyvernProtocol.getTokenTransferProxyAddress(this._networkName);
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: accountAddress,
                to: tokenAddress,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.ERC20, "approve"), [proxyAddress, 0]),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, { error, accountAddress });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.UnapproveCurrency, "Resetting Currency Approval", () => __awaiter(this, void 0, void 0, function* () {
                const newlyApprovedAmount = yield this._getApprovedTokenCount({
                    accountAddress,
                    tokenAddress,
                    proxyAddress,
                });
                return newlyApprovedAmount.isZero();
            }));
            return txHash;
        });
    }
    /**
     * Gets the current price for the order.
     */
    getCurrentPrice({ order, }) {
        return __awaiter(this, void 0, void 0, function* () {
            return new bignumber_js_1.BigNumber(order.currentPrice);
        });
    }
    /**
     * Gets the price for the order using the contract
     * @param order The order to calculate the price for
     */
    getCurrentPriceLegacyWyvern(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentPrice = yield this._wyvernProtocolReadOnly.wyvernExchange
                .calculateCurrentPrice_([
                order.exchange,
                order.maker,
                order.taker,
                order.feeRecipient,
                order.target,
                order.staticTarget,
                order.paymentToken,
            ], [
                order.makerRelayerFee,
                order.takerRelayerFee,
                order.makerProtocolFee,
                order.takerProtocolFee,
                order.basePrice,
                order.extra,
                order.listingTime,
                order.expirationTime,
                order.salt,
            ], order.feeMethod, order.side, order.saleKind, order.howToCall, order.calldata, order.replacementPattern, order.staticExtradata)
                .callAsync();
            return currentPrice;
        });
    }
    /**
     * Returns whether an order is fulfillable.
     * An order may not be fulfillable if a target item's transfer function
     * is locked for some reason, e.g. an item is being rented within a game
     * or trading has been locked for an item type.
     * @param param0 __namedParameters Object
     * @param order Order to check
     * @param accountAddress The account address that will be fulfilling the order
     * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress.
     * @param referrerAddress The optional address that referred the order
     */
    isOrderFulfillable({ order, accountAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (order.protocolAddress) {
                case constants_1.CROSS_CHAIN_SEAPORT_ADDRESS: {
                    try {
                        const isValid = yield this.seaport
                            .validate([order.protocolData], accountAddress)
                            .callStatic();
                        return !!isValid;
                    }
                    catch (error) {
                        if ((0, utils_1.hasErrorCode)(error) && error.code === "CALL_EXCEPTION") {
                            return false;
                        }
                        throw error;
                    }
                }
                default:
                    throw new Error("Unsupported protocol");
            }
        });
    }
    /**
     * Returns whether an order is fulfillable.
     * An order may not be fulfillable if a target item's transfer function
     * is locked for some reason, e.g. an item is being rented within a game
     * or trading has been locked for an item type.
     * @param param0 __namedParameters Object
     * @param order Order to check
     * @param accountAddress The account address that will be fulfilling the order
     * @param recipientAddress The optional address to receive the order's item(s) or curriencies. If not specified, defaults to accountAddress.
     * @param referrerAddress The optional address that referred the order
     */
    isOrderFulfillableLegacyWyvern({ order, accountAddress, recipientAddress, referrerAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchingOrder = this._makeMatchingOrder({
                order,
                accountAddress,
                recipientAddress: recipientAddress || accountAddress,
            });
            const { buy, sell } = (0, utils_1.assignOrdersToSides)(order, matchingOrder);
            const metadata = this._getMetadata(order, referrerAddress);
            const gas = yield this._estimateGasForMatch({
                buy,
                sell,
                accountAddress,
                metadata,
            });
            this.logger(`Gas estimate for ${order.side == types_1.OrderSide.Sell ? "sell" : "buy"} order: ${gas}`);
            return gas != null && gas > 0;
        });
    }
    /**
     * Returns whether an asset is transferrable.
     * An asset may not be transferrable if its transfer function
     * is locked for some reason, e.g. an item is being rented within a game
     * or trading has been locked for an item type.
     * @param param0 __namedParameters Object
     * @param tokenId DEPRECATED: Token ID. Use `asset` instead.
     * @param tokenAddress DEPRECATED: Address of the token's contract. Use `asset` instead.
     * @param asset The asset to trade
     * @param fromAddress The account address that currently owns the asset
     * @param toAddress The account address that will be acquiring the asset
     * @param quantity The amount of the asset to transfer, if it's fungible (optional). In units (not base units), e.g. not wei.
     * @param useProxy Use the `fromAddress`'s proxy contract only if the `fromAddress` has already approved the asset for sale. Required if checking an ERC-721 v1 asset (like CryptoKitties) that doesn't check if the transferFrom caller is the owner of the asset (only allowing it if it's an approved address).
     * @param retries How many times to retry if false
     */
    isAssetTransferrable({ asset, fromAddress, toAddress, quantity, useProxy = false, }, retries = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = this._getSchema(this._getSchemaName(asset));
            const quantityBN = quantity
                ? wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(quantity), asset.decimals || 0)
                : (0, utils_1.makeBigNumber)(1);
            const wyAsset = (0, utils_1.getWyvernAsset)(schema, asset, quantityBN);
            const abi = schema.functions.transfer(wyAsset);
            let from = fromAddress;
            if (useProxy) {
                const proxyAddress = yield this._getProxy(fromAddress);
                if (!proxyAddress) {
                    console.error(`This asset's owner (${fromAddress}) does not have a proxy!`);
                    return false;
                }
                from = proxyAddress;
            }
            const data = (0, schema_1.encodeTransferCall)(abi, fromAddress, toAddress);
            try {
                const gas = yield (0, utils_1.estimateGas)(this._getClientsForRead({ retries }).web3, {
                    from,
                    to: abi.target,
                    data,
                });
                return gas > 0;
            }
            catch (error) {
                if (retries <= 0) {
                    console.error(error);
                    console.error(from, abi.target, data);
                    return false;
                }
                yield (0, utils_1.delay)(500);
                return yield this.isAssetTransferrable({ asset, fromAddress, toAddress, quantity, useProxy }, retries - 1);
            }
        });
    }
    /**
     * Transfer a fungible or non-fungible asset to another address
     * @param param0 __namedParamaters Object
     * @param fromAddress The owner's wallet address
     * @param toAddress The recipient's wallet address
     * @param asset The fungible or non-fungible asset to transfer
     * @param quantity The amount of the asset to transfer, if it's fungible (optional). In units (not base units), e.g. not wei.
     * @returns Transaction hash
     */
    transfer({ fromAddress, toAddress, asset, quantity = 1, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = this._getSchema(this._getSchemaName(asset));
            const quantityBN = wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(quantity), asset.decimals || 0);
            const wyAsset = (0, utils_1.getWyvernAsset)(schema, asset, quantityBN);
            const isCryptoKitties = [constants_2.CK_ADDRESS, constants_2.CK_RINKEBY_ADDRESS].includes(wyAsset.address);
            // Since CK is common, infer isOldNFT from it in case user
            // didn't pass in `version`
            const isOldNFT = isCryptoKitties ||
                (!!asset.version &&
                    [types_1.TokenStandardVersion.ERC721v1, types_1.TokenStandardVersion.ERC721v2].includes(asset.version));
            const abi = this._getSchemaName(asset) === types_1.WyvernSchemaName.ERC20
                ? (0, utils_1.annotateERC20TransferABI)(wyAsset)
                : isOldNFT
                    ? (0, utils_1.annotateERC721TransferABI)(wyAsset)
                    : schema.functions.transfer(wyAsset);
            this._dispatch(types_1.EventType.TransferOne, {
                accountAddress: fromAddress,
                toAddress,
                asset: wyAsset,
            });
            const data = (0, schema_1.encodeTransferCall)(abi, fromAddress, toAddress);
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: fromAddress,
                to: abi.target,
                data,
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, {
                    error,
                    accountAddress: fromAddress,
                });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.TransferOne, `Transferring asset`);
            return txHash;
        });
    }
    /**
     * Transfer one or more assets to another address.
     * ERC-721 and ERC-1155 assets are supported
     * @param param0 __namedParamaters Object
     * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to transfer.
     * @param fromAddress The owner's wallet address
     * @param toAddress The recipient's wallet address
     * @param schemaName The Wyvern schema name corresponding to the asset type, if not in each Asset definition
     * @returns Transaction hash
     */
    transferAll({ assets, fromAddress, toAddress, schemaName = types_1.WyvernSchemaName.ERC721, }) {
        return __awaiter(this, void 0, void 0, function* () {
            toAddress = (0, utils_1.validateAndFormatWalletAddress)(this.web3, toAddress);
            const schemaNames = assets.map((asset) => this._getSchemaName(asset) || schemaName);
            const wyAssets = assets.map((asset) => (0, utils_1.getWyvernAsset)(this._getSchema(this._getSchemaName(asset)), asset));
            const { calldata, target } = (0, schema_1.encodeAtomicizedTransfer)(schemaNames.map((name) => this._getSchema(name)), wyAssets, fromAddress, toAddress, this._wyvernProtocol, this._networkName);
            let proxyAddress = yield this._getProxy(fromAddress);
            if (!proxyAddress) {
                proxyAddress = yield this._initializeProxy(fromAddress);
            }
            yield this._approveAll({
                schemaNames,
                wyAssets,
                accountAddress: fromAddress,
                proxyAddress,
            });
            this._dispatch(types_1.EventType.TransferAll, {
                accountAddress: fromAddress,
                toAddress,
                assets: wyAssets,
            });
            const txHash = yield (0, utils_1.sendRawTransaction)(this.web3, {
                from: fromAddress,
                to: proxyAddress,
                data: (0, schema_1.encodeProxyCall)(target, types_1.HowToCall.DelegateCall, calldata),
            }, (error) => {
                this._dispatch(types_1.EventType.TransactionDenied, {
                    error,
                    accountAddress: fromAddress,
                });
            });
            yield this._confirmTransaction(txHash, types_1.EventType.TransferAll, `Transferring ${assets.length} asset${assets.length == 1 ? "" : "s"}`);
            return txHash;
        });
    }
    /**
     * Get known payment tokens (ERC-20) that match your filters.
     * @param param0 __namedParameters Object
     * @param symbol Filter by the ERC-20 symbol for the token,
     *    e.g. "DAI" for Dai stablecoin
     * @param address Filter by the ERC-20 contract address for the token,
     *    e.g. "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359" for Dai
     * @param name Filter by the name of the ERC-20 contract.
     *    Not guaranteed to exist or be unique for each token type.
     *    e.g. '' for Dai and 'Decentraland' for MANA
     * FUTURE: officiallySupported: Filter for tokens that are
     *    officially supported and shown on opensea.io
     */
    getFungibleTokens({ symbol, address, name, } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, utils_1.onDeprecated)("Use `api.getPaymentTokens` instead");
            const tokenSettings = WyvernSchemas.tokens[this._networkName];
            const { tokens } = yield this.api.getPaymentTokens({
                symbol,
                address,
                name,
            });
            const offlineTokens = [
                tokenSettings.canonicalWrappedEther,
                ...tokenSettings.otherTokens,
            ].filter((t) => {
                if (symbol != null && t.symbol.toLowerCase() != symbol.toLowerCase()) {
                    return false;
                }
                if (address != null && t.address.toLowerCase() != address.toLowerCase()) {
                    return false;
                }
                if (name != null && t.name != name) {
                    return false;
                }
                return true;
            });
            return [...offlineTokens, ...tokens];
        });
    }
    /**
     * Get an account's balance of any Asset.
     * @param param0 __namedParameters Object
     * @param accountAddress Account address to check
     * @param asset The Asset to check balance for
     * @param retries How many times to retry if balance is 0
     */
    getAssetBalance({ accountAddress, asset }, retries = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = this._getSchema(this._getSchemaName(asset));
            const wyAsset = (0, utils_1.getWyvernAsset)(schema, asset);
            if (schema.functions.countOf) {
                // ERC20 or ERC1155 (non-Enjin)
                const abi = schema.functions.countOf(wyAsset);
                const contract = new (this._getClientsForRead({
                    retries,
                }).web3.eth.Contract)([abi], abi.target);
                const inputValues = abi.inputs
                    .filter((x) => x.value !== undefined)
                    .map((x) => x.value);
                const count = yield contract.methods[abi.name](accountAddress, ...inputValues).call();
                if (count !== undefined) {
                    return new bignumber_js_1.BigNumber(count);
                }
            }
            else if (schema.functions.ownerOf) {
                // ERC721 asset
                const abi = schema.functions.ownerOf(wyAsset);
                const contract = new (this._getClientsForRead({
                    retries,
                }).web3.eth.Contract)([abi], abi.target);
                if (abi.inputs.filter((x) => x.value === undefined)[0]) {
                    throw new Error("Missing an argument for finding the owner of this asset");
                }
                const inputValues = abi.inputs.map((i) => i.value.toString());
                try {
                    const owner = yield contract.methods[abi.name](...inputValues).call();
                    if (owner) {
                        return owner.toLowerCase() == accountAddress.toLowerCase()
                            ? new bignumber_js_1.BigNumber(1)
                            : new bignumber_js_1.BigNumber(0);
                    }
                    // eslint-disable-next-line no-empty
                }
                catch (_b) { }
            }
            else {
                // Missing ownership call - skip check to allow listings
                // by default
                throw new Error("Missing ownership schema for this asset type");
            }
            if (retries <= 0) {
                throw new Error("Unable to get current owner from smart contract");
            }
            else {
                yield (0, utils_1.delay)(500);
                // Recursively check owner again
                return yield this.getAssetBalance({ accountAddress, asset }, retries - 1);
            }
        });
    }
    /**
     * Get the balance of a fungible token.
     * Convenience method for getAssetBalance for fungibles
     * @param param0 __namedParameters Object
     * @param accountAddress Account address to check
     * @param tokenAddress The address of the token to check balance for
     * @param schemaName Optional schema name for the fungible token
     * @param retries Number of times to retry if balance is undefined
     */
    getTokenBalance({ accountAddress, tokenAddress, schemaName = types_1.WyvernSchemaName.ERC20, }, retries = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const asset = {
                tokenId: null,
                tokenAddress,
                schemaName,
            };
            return this.getAssetBalance({ accountAddress, asset }, retries);
        });
    }
    /**
     * Compute the fees for an order
     * @param param0 __namedParameters
     * @param asset Asset to use for fees. May be blank ONLY for multi-collection bundles.
     * @param side The side of the order (buy or sell)
     * @param accountAddress The account to check fees for (useful if fees differ by account, like transfer fees)
     * @param extraBountyBasisPoints The basis points to add for the bounty. Will throw if it exceeds the assets' contract's OpenSea fee.
     */
    computeFees({ asset, side, accountAddress, extraBountyBasisPoints = 0, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let openseaBuyerFeeBasisPoints = constants_2.DEFAULT_BUYER_FEE_BASIS_POINTS;
            let openseaSellerFeeBasisPoints = constants_2.DEFAULT_SELLER_FEE_BASIS_POINTS;
            let devBuyerFeeBasisPoints = 0;
            let devSellerFeeBasisPoints = 0;
            let transferFee = (0, utils_1.makeBigNumber)(0);
            let transferFeeTokenAddress = null;
            let maxTotalBountyBPS = constants_2.DEFAULT_MAX_BOUNTY;
            if (asset) {
                openseaBuyerFeeBasisPoints = +asset.collection.openseaBuyerFeeBasisPoints;
                openseaSellerFeeBasisPoints =
                    +asset.collection.openseaSellerFeeBasisPoints;
                devBuyerFeeBasisPoints = +asset.collection.devBuyerFeeBasisPoints;
                devSellerFeeBasisPoints = +asset.collection.devSellerFeeBasisPoints;
                maxTotalBountyBPS = openseaSellerFeeBasisPoints;
            }
            // Compute transferFrom fees
            if (side == types_1.OrderSide.Sell && asset) {
                // Server-side knowledge
                transferFee = asset.transferFee
                    ? (0, utils_1.makeBigNumber)(asset.transferFee)
                    : transferFee;
                transferFeeTokenAddress = asset.transferFeePaymentToken
                    ? asset.transferFeePaymentToken.address
                    : transferFeeTokenAddress;
                try {
                    // web3 call to update it
                    const result = yield (0, utils_1.getTransferFeeSettings)(this.web3, {
                        asset,
                        accountAddress,
                    });
                    transferFee =
                        result.transferFee != null ? result.transferFee : transferFee;
                    transferFeeTokenAddress =
                        result.transferFeeTokenAddress || transferFeeTokenAddress;
                }
                catch (error) {
                    // Use server defaults
                    console.error(error);
                }
            }
            // Compute bounty
            const sellerBountyBasisPoints = side == types_1.OrderSide.Sell ? extraBountyBasisPoints : 0;
            // Check that bounty is in range of the opensea fee
            const bountyTooLarge = sellerBountyBasisPoints + constants_2.OPENSEA_SELLER_BOUNTY_BASIS_POINTS >
                maxTotalBountyBPS;
            if (sellerBountyBasisPoints > 0 && bountyTooLarge) {
                let errorMessage = `Total bounty exceeds the maximum for this asset type (${maxTotalBountyBPS / 100}%).`;
                if (maxTotalBountyBPS >= constants_2.OPENSEA_SELLER_BOUNTY_BASIS_POINTS) {
                    errorMessage += ` Remember that OpenSea will add ${constants_2.OPENSEA_SELLER_BOUNTY_BASIS_POINTS / 100}% for referrers with OpenSea accounts!`;
                }
                throw new Error(errorMessage);
            }
            return {
                totalBuyerFeeBasisPoints: openseaBuyerFeeBasisPoints + devBuyerFeeBasisPoints,
                totalSellerFeeBasisPoints: openseaSellerFeeBasisPoints + devSellerFeeBasisPoints,
                openseaBuyerFeeBasisPoints,
                openseaSellerFeeBasisPoints,
                devBuyerFeeBasisPoints,
                devSellerFeeBasisPoints,
                sellerBountyBasisPoints,
                transferFee,
                transferFeeTokenAddress,
            };
        });
    }
    /**
     * Post an order to the OpenSea orderbook.
     * @param order The order to post. Can either be signed by the maker or pre-approved on the Wyvern contract using approveOrder. See https://github.com/ProjectWyvern/wyvern-ethereum/blob/master/contracts/exchange/Exchange.sol#L178
     * @returns The order as stored by the orderbook
     */
    validateAndPostOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validation is called server-side
            const confirmedOrder = yield this.api.postOrderLegacyWyvern((0, utils_1.orderToJSON)(order));
            return confirmedOrder;
        });
    }
    /**
     * DEPRECATED: ERC-1559
     * https://eips.ethereum.org/EIPS/eip-1559
     * Compute the gas price for sending a txn, in wei
     * Will be slightly above the mean to make it faster
     */
    _computeGasPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            const meanGas = yield (0, utils_1.getCurrentGasPrice)(this.web3);
            const weiToAdd = this.web3.utils.toWei(this.gasPriceAddition.toString(), "gwei");
            return meanGas.plus(weiToAdd);
        });
    }
    /**
     * Compute the gas amount for sending a txn
     * Will be slightly above the result of estimateGas to make it more reliable
     * @param estimation The result of estimateGas for a transaction
     */
    _correctGasAmount(estimation) {
        return Math.ceil(estimation * this.gasIncreaseFactor);
    }
    /**
     * Estimate the gas needed to match two orders. Returns undefined if tx errors
     * @param param0 __namedParamaters Object
     * @param buy The buy order to match
     * @param sell The sell order to match
     * @param accountAddress The taker's wallet address
     * @param metadata Metadata bytes32 to send with the match
     * @param retries Number of times to retry if false
     */
    _estimateGasForMatch({ buy, sell, accountAddress, metadata = constants_2.NULL_BLOCK_HASH, }, retries = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            let value;
            if (buy.maker.toLowerCase() == accountAddress.toLowerCase() &&
                buy.paymentToken == constants_2.NULL_ADDRESS) {
                value = yield this._getRequiredAmountForTakingSellOrder(sell);
            }
            try {
                return yield this._getClientsForRead({
                    retries,
                })
                    .wyvernProtocol.wyvernExchange.atomicMatch_([
                    buy.exchange,
                    buy.maker,
                    buy.taker,
                    buy.feeRecipient,
                    buy.target,
                    buy.staticTarget,
                    buy.paymentToken,
                    sell.exchange,
                    sell.maker,
                    sell.taker,
                    sell.feeRecipient,
                    sell.target,
                    sell.staticTarget,
                    sell.paymentToken,
                ], [
                    buy.makerRelayerFee,
                    buy.takerRelayerFee,
                    buy.makerProtocolFee,
                    buy.takerProtocolFee,
                    buy.basePrice,
                    buy.extra,
                    buy.listingTime,
                    buy.expirationTime,
                    buy.salt,
                    sell.makerRelayerFee,
                    sell.takerRelayerFee,
                    sell.makerProtocolFee,
                    sell.takerProtocolFee,
                    sell.basePrice,
                    sell.extra,
                    sell.listingTime,
                    sell.expirationTime,
                    sell.salt,
                ], [
                    buy.feeMethod,
                    buy.side,
                    buy.saleKind,
                    buy.howToCall,
                    sell.feeMethod,
                    sell.side,
                    sell.saleKind,
                    sell.howToCall,
                ], buy.calldata, sell.calldata, buy.replacementPattern, sell.replacementPattern, buy.staticExtradata, sell.staticExtradata, [buy.v || 0, sell.v || 0], [
                    buy.r || constants_2.NULL_BLOCK_HASH,
                    buy.s || constants_2.NULL_BLOCK_HASH,
                    sell.r || constants_2.NULL_BLOCK_HASH,
                    sell.s || constants_2.NULL_BLOCK_HASH,
                    metadata,
                ])
                    .estimateGasAsync({ from: accountAddress, value });
            }
            catch (error) {
                if (retries <= 0) {
                    console.error(error);
                    return undefined;
                }
                yield (0, utils_1.delay)(200);
                return yield this._estimateGasForMatch({ buy, sell, accountAddress, metadata }, retries - 1);
            }
        });
    }
    /**
     * Estimate the gas needed to transfer assets in bulk
     * Used for tests
     * @param param0 __namedParamaters Object
     * @param assets An array of objects with the tokenId and tokenAddress of each of the assets to transfer.
     * @param fromAddress The owner's wallet address
     * @param toAddress The recipient's wallet address
     * @param schemaName The Wyvern schema name corresponding to the asset type, if not in each asset
     */
    _estimateGasForTransfer({ assets, fromAddress, toAddress, schemaName = types_1.WyvernSchemaName.ERC721, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const schemaNames = assets.map((asset) => this._getSchemaName(asset) || schemaName);
            const wyAssets = assets.map((asset) => (0, utils_1.getWyvernAsset)(this._getSchema(this._getSchemaName(asset)), asset));
            const proxyAddress = yield this._getProxy(fromAddress);
            if (!proxyAddress) {
                throw new Error("Uninitialized proxy address");
            }
            yield this._approveAll({
                schemaNames,
                wyAssets,
                accountAddress: fromAddress,
                proxyAddress,
            });
            const { calldata, target } = (0, schema_1.encodeAtomicizedTransfer)(schemaNames.map((name) => this._getSchema(name)), wyAssets, fromAddress, toAddress, this._wyvernProtocol, this._networkName);
            return (0, utils_1.estimateGas)(this.web3, {
                from: fromAddress,
                to: proxyAddress,
                data: (0, schema_1.encodeProxyCall)(target, types_1.HowToCall.DelegateCall, calldata),
            });
        });
    }
    /**
     * Get the proxy address for a user's wallet.
     * Internal method exposed for dev flexibility.
     * @param accountAddress The user's wallet address
     * @param retries Optional number of retries to do
     * @param wyvernProtocol optional wyvern protocol override
     */
    _getProxy(accountAddress, retries = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            let proxyAddress = yield this._wyvernProtocolReadOnly.wyvernProxyRegistry
                .proxies(accountAddress)
                .callAsync();
            if (proxyAddress == "0x") {
                throw new Error("Couldn't retrieve your account from the blockchain - make sure you're on the correct Ethereum network!");
            }
            if (!proxyAddress || proxyAddress == constants_2.NULL_ADDRESS) {
                if (retries > 0) {
                    yield (0, utils_1.delay)(1000);
                    return yield this._getProxy(accountAddress, retries - 1);
                }
                proxyAddress = null;
            }
            return proxyAddress;
        });
    }
    /**
     * Initialize the proxy for a user's wallet.
     * Proxies are used to make trades on behalf of the order's maker so that
     *  trades can happen when the maker isn't online.
     * Internal method exposed for dev flexibility.
     * @param accountAddress The user's wallet address
     * @param wyvernProtocol optional wyvern protocol override
     */
    _initializeProxy(accountAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            this._dispatch(types_1.EventType.InitializeAccount, { accountAddress });
            this.logger(`Initializing proxy for account: ${accountAddress}`);
            const txnData = { from: accountAddress };
            const gasEstimate = yield this._wyvernProtocol.wyvernProxyRegistry
                .registerProxy()
                .estimateGasAsync(txnData);
            const transactionHash = yield this._wyvernProtocol.wyvernProxyRegistry
                .registerProxy()
                .sendTransactionAsync(Object.assign(Object.assign({}, txnData), { gas: this._correctGasAmount(gasEstimate) }));
            yield this._confirmTransaction(transactionHash, types_1.EventType.InitializeAccount, "Initializing proxy for account", () => __awaiter(this, void 0, void 0, function* () {
                const polledProxy = yield this._getProxy(accountAddress, 0);
                return !!polledProxy;
            }));
            const proxyAddress = yield this._getProxy(accountAddress, 10);
            if (!proxyAddress) {
                throw new Error("Failed to initialize your account :( Please restart your wallet/browser and try again!");
            }
            return proxyAddress;
        });
    }
    /**
     * For a fungible token to use in trades (like W-ETH), get the amount
     *  approved for use by the Wyvern transfer proxy.
     * Internal method exposed for dev flexibility.
     * @param param0 __namedParameters Object
     * @param accountAddress Address for the user's wallet
     * @param tokenAddress Address for the token's contract
     * @param proxyAddress User's proxy address. If undefined, uses the token transfer proxy address
     */
    _getApprovedTokenCount({ accountAddress, tokenAddress, proxyAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!tokenAddress) {
                tokenAddress =
                    WyvernSchemas.tokens[this._networkName].canonicalWrappedEther.address;
            }
            const addressToApprove = proxyAddress ||
                ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernTokenTransferProxyContractAddress) ||
                wyvern_js_1.WyvernProtocol.getTokenTransferProxyAddress(this._networkName);
            const approved = yield (0, utils_1.rawCall)(this.web3, {
                from: accountAddress,
                to: tokenAddress,
                data: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.ERC20, "allowance"), [
                    accountAddress,
                    addressToApprove,
                ]),
            });
            return (0, utils_1.makeBigNumber)(approved);
        });
    }
    _makeBuyOrder({ asset, quantity, accountAddress, startAmount, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), paymentTokenAddress, extraBountyBasisPoints = 0, sellOrder, referrerAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            accountAddress = (0, utils_1.validateAndFormatWalletAddress)(this.web3, accountAddress);
            const schema = this._getSchema(this._getSchemaName(asset));
            const quantityBN = wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(quantity), asset.decimals || 0);
            const wyAsset = (0, utils_1.getWyvernAsset)(schema, asset, quantityBN);
            const openSeaAsset = yield this.api.getAsset(asset);
            const taker = sellOrder ? sellOrder.maker : constants_2.NULL_ADDRESS;
            const { totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints } = yield this.computeFees({
                asset: openSeaAsset,
                extraBountyBasisPoints,
                side: types_1.OrderSide.Buy,
            });
            const { makerRelayerFee, takerRelayerFee, makerProtocolFee, takerProtocolFee, makerReferrerFee, feeRecipient, feeMethod, } = this._getBuyFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, sellOrder);
            const { target, calldata, replacementPattern } = (0, schema_1.encodeBuy)(schema, wyAsset, accountAddress, (sellOrder === null || sellOrder === void 0 ? void 0 : sellOrder.waitingForBestCounterOrder)
                ? undefined
                : utils_1.merkleValidatorByNetwork[this._networkName]);
            const { basePrice, extra, paymentToken } = yield this._getPriceParameters(types_1.OrderSide.Buy, paymentTokenAddress, (0, utils_1.makeBigNumber)(expirationTime), (0, utils_1.makeBigNumber)(startAmount));
            const times = this._getTimeParameters({
                expirationTimestamp: expirationTime,
            });
            const { staticTarget, staticExtradata } = yield this._getStaticCallTargetAndExtraData({
                asset: openSeaAsset,
                useTxnOriginStaticCall: false,
            });
            return {
                exchange: ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernExchangeContractAddress) ||
                    wyvern_js_1.WyvernProtocol.getExchangeContractAddress(this._networkName),
                maker: accountAddress,
                taker,
                quantity: quantityBN,
                makerRelayerFee,
                takerRelayerFee,
                makerProtocolFee,
                takerProtocolFee,
                makerReferrerFee,
                waitingForBestCounterOrder: false,
                feeMethod,
                feeRecipient,
                side: types_1.OrderSide.Buy,
                saleKind: types_1.SaleKind.FixedPrice,
                target,
                howToCall: target === utils_1.merkleValidatorByNetwork[this._networkName]
                    ? types_1.HowToCall.DelegateCall
                    : types_1.HowToCall.Call,
                calldata,
                replacementPattern,
                staticTarget,
                staticExtradata,
                paymentToken,
                basePrice,
                extra,
                listingTime: times.listingTime,
                expirationTime: times.expirationTime,
                salt: wyvern_js_1.WyvernProtocol.generatePseudoRandomSalt(),
                metadata: {
                    asset: wyAsset,
                    schema: schema.name,
                    referrerAddress,
                },
            };
        });
    }
    _makeSellOrder({ asset, quantity, accountAddress, startAmount, endAmount, listingTime, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), waitForHighestBid, englishAuctionReservePrice = 0, paymentTokenAddress, extraBountyBasisPoints, buyerAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            accountAddress = (0, utils_1.validateAndFormatWalletAddress)(this.web3, accountAddress);
            const schema = this._getSchema(this._getSchemaName(asset));
            const quantityBN = wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(quantity), asset.decimals || 0);
            const wyAsset = (0, utils_1.getWyvernAsset)(schema, asset, quantityBN);
            const openSeaAsset = yield this.api.getAsset(asset);
            const { totalSellerFeeBasisPoints, totalBuyerFeeBasisPoints, sellerBountyBasisPoints, } = yield this.computeFees({
                asset: openSeaAsset,
                side: types_1.OrderSide.Sell,
                extraBountyBasisPoints,
            });
            const { target, calldata, replacementPattern } = (0, schema_1.encodeSell)(schema, wyAsset, accountAddress, waitForHighestBid
                ? undefined
                : utils_1.merkleValidatorByNetwork[this._networkName]);
            const orderSaleKind = endAmount != null && endAmount !== startAmount
                ? types_1.SaleKind.DutchAuction
                : types_1.SaleKind.FixedPrice;
            const { basePrice, extra, paymentToken, reservePrice } = yield this._getPriceParameters(types_1.OrderSide.Sell, paymentTokenAddress, (0, utils_1.makeBigNumber)(expirationTime), (0, utils_1.makeBigNumber)(startAmount), endAmount !== undefined ? (0, utils_1.makeBigNumber)(endAmount) : undefined, waitForHighestBid, (0, utils_1.makeBigNumber)(englishAuctionReservePrice));
            const times = this._getTimeParameters({
                expirationTimestamp: expirationTime,
                listingTimestamp: listingTime,
                waitingForBestCounterOrder: waitForHighestBid,
            });
            const { makerRelayerFee, takerRelayerFee, makerProtocolFee, takerProtocolFee, makerReferrerFee, feeRecipient, feeMethod, } = this._getSellFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, waitForHighestBid, sellerBountyBasisPoints);
            const { staticTarget, staticExtradata } = yield this._getStaticCallTargetAndExtraData({
                asset: openSeaAsset,
                useTxnOriginStaticCall: waitForHighestBid,
            });
            return {
                exchange: ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernExchangeContractAddress) ||
                    wyvern_js_1.WyvernProtocol.getExchangeContractAddress(this._networkName),
                maker: accountAddress,
                taker: buyerAddress,
                quantity: quantityBN,
                makerRelayerFee,
                takerRelayerFee,
                makerProtocolFee,
                takerProtocolFee,
                makerReferrerFee,
                waitingForBestCounterOrder: waitForHighestBid,
                englishAuctionReservePrice: reservePrice
                    ? (0, utils_1.makeBigNumber)(reservePrice)
                    : undefined,
                feeMethod,
                feeRecipient,
                side: types_1.OrderSide.Sell,
                saleKind: orderSaleKind,
                target,
                howToCall: target === utils_1.merkleValidatorByNetwork[this._networkName]
                    ? types_1.HowToCall.DelegateCall
                    : types_1.HowToCall.Call,
                calldata,
                replacementPattern,
                staticTarget,
                staticExtradata,
                paymentToken,
                basePrice,
                extra,
                listingTime: times.listingTime,
                expirationTime: times.expirationTime,
                salt: wyvern_js_1.WyvernProtocol.generatePseudoRandomSalt(),
                metadata: {
                    asset: wyAsset,
                    schema: schema.name,
                },
            };
        });
    }
    _getStaticCallTargetAndExtraData({ asset, useTxnOriginStaticCall, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const isCheezeWizards = [
                constants_2.CHEEZE_WIZARDS_GUILD_ADDRESS.toLowerCase(),
                constants_2.CHEEZE_WIZARDS_GUILD_RINKEBY_ADDRESS.toLowerCase(),
            ].includes(asset.tokenAddress.toLowerCase());
            const isDecentralandEstate = asset.tokenAddress.toLowerCase() ==
                constants_2.DECENTRALAND_ESTATE_ADDRESS.toLowerCase();
            const isMainnet = this._networkName == types_1.Network.Main;
            if (isMainnet && !useTxnOriginStaticCall) {
                // While testing, we will use dummy values for mainnet. We will remove this if-statement once we have pushed the PR once and tested on Rinkeby
                return {
                    staticTarget: constants_2.NULL_ADDRESS,
                    staticExtradata: "0x",
                };
            }
            if (isCheezeWizards) {
                const cheezeWizardsBasicTournamentAddress = isMainnet
                    ? constants_2.CHEEZE_WIZARDS_BASIC_TOURNAMENT_ADDRESS
                    : constants_2.CHEEZE_WIZARDS_BASIC_TOURNAMENT_RINKEBY_ADDRESS;
                const cheezeWizardsBasicTournamentInstance = new this.web3.eth.Contract(contracts_1.CheezeWizardsBasicTournament, cheezeWizardsBasicTournamentAddress);
                const wizardFingerprint = yield (0, utils_1.rawCall)(this.web3, {
                    to: cheezeWizardsBasicTournamentInstance.options.address,
                    data: cheezeWizardsBasicTournamentInstance.methods
                        .wizardFingerprint(asset.tokenId)
                        .encodeABI(),
                });
                return {
                    staticTarget: isMainnet
                        ? constants_2.STATIC_CALL_CHEEZE_WIZARDS_ADDRESS
                        : constants_2.STATIC_CALL_CHEEZE_WIZARDS_RINKEBY_ADDRESS,
                    staticExtradata: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.StaticCheckCheezeWizards, "succeedIfCurrentWizardFingerprintMatchesProvidedWizardFingerprint"), [asset.tokenId, wizardFingerprint, useTxnOriginStaticCall]),
                };
            }
            else if (isDecentralandEstate && isMainnet) {
                // We stated that we will only use Decentraland estates static
                // calls on mainnet, since Decentraland uses Ropsten
                const decentralandEstateAddress = constants_2.DECENTRALAND_ESTATE_ADDRESS;
                const decentralandEstateInstance = new this.web3.eth.Contract(contracts_1.DecentralandEstates, decentralandEstateAddress);
                const estateFingerprint = yield (0, utils_1.rawCall)(this.web3, {
                    to: decentralandEstateInstance.options.address,
                    data: decentralandEstateInstance.methods
                        .getFingerprint(asset.tokenId)
                        .encodeABI(),
                });
                return {
                    staticTarget: constants_2.STATIC_CALL_DECENTRALAND_ESTATES_ADDRESS,
                    staticExtradata: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.StaticCheckDecentralandEstates, "succeedIfCurrentEstateFingerprintMatchesProvidedEstateFingerprint"), [asset.tokenId, estateFingerprint, useTxnOriginStaticCall]),
                };
            }
            else if (useTxnOriginStaticCall) {
                return {
                    staticTarget: isMainnet
                        ? constants_2.STATIC_CALL_TX_ORIGIN_ADDRESS
                        : constants_2.STATIC_CALL_TX_ORIGIN_RINKEBY_ADDRESS,
                    staticExtradata: (0, schema_1.encodeCall)((0, contracts_1.getMethod)(contracts_1.StaticCheckTxOrigin, "succeedIfTxOriginMatchesHardcodedAddress"), []),
                };
            }
            else {
                // Noop - no checks
                return {
                    staticTarget: constants_2.NULL_ADDRESS,
                    staticExtradata: "0x",
                };
            }
        });
    }
    _makeBundleBuyOrder({ assets, collection, quantities, accountAddress, startAmount, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), paymentTokenAddress, extraBountyBasisPoints = 0, sellOrder, referrerAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            accountAddress = (0, utils_1.validateAndFormatWalletAddress)(this.web3, accountAddress);
            const quantityBNs = quantities.map((quantity, i) => wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(quantity), assets[i].decimals || 0));
            const bundle = (0, utils_1.getWyvernBundle)(assets, assets.map((a) => this._getSchema(a.schemaName)), quantityBNs);
            const orderedSchemas = bundle.schemas.map((name) => this._getSchema(name));
            const taker = sellOrder ? sellOrder.maker : constants_2.NULL_ADDRESS;
            // If all assets are for the same collection, use its fees
            const asset = collection ? yield this.api.getAsset(assets[0]) : undefined;
            const { totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints } = yield this.computeFees({
                asset,
                extraBountyBasisPoints,
                side: types_1.OrderSide.Buy,
            });
            const { makerRelayerFee, takerRelayerFee, makerProtocolFee, takerProtocolFee, makerReferrerFee, feeRecipient, feeMethod, } = this._getBuyFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, sellOrder);
            const { calldata, replacementPattern } = (0, schema_1.encodeAtomicizedBuy)(orderedSchemas, bundle.assets, accountAddress, this._wyvernProtocol, this._networkName);
            const { basePrice, extra, paymentToken } = yield this._getPriceParameters(types_1.OrderSide.Buy, paymentTokenAddress, (0, utils_1.makeBigNumber)(expirationTime), (0, utils_1.makeBigNumber)(startAmount));
            const times = this._getTimeParameters({
                expirationTimestamp: expirationTime,
            });
            return {
                exchange: ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernExchangeContractAddress) ||
                    wyvern_js_1.WyvernProtocol.getExchangeContractAddress(this._networkName),
                maker: accountAddress,
                taker,
                quantity: (0, utils_1.makeBigNumber)(1),
                makerRelayerFee,
                takerRelayerFee,
                makerProtocolFee,
                takerProtocolFee,
                makerReferrerFee,
                waitingForBestCounterOrder: false,
                feeMethod,
                feeRecipient,
                side: types_1.OrderSide.Buy,
                saleKind: types_1.SaleKind.FixedPrice,
                target: wyvern_js_1.WyvernProtocol.getAtomicizerContractAddress(this._networkName),
                howToCall: types_1.HowToCall.DelegateCall,
                calldata,
                replacementPattern,
                staticTarget: constants_2.NULL_ADDRESS,
                staticExtradata: "0x",
                paymentToken,
                basePrice,
                extra,
                listingTime: times.listingTime,
                expirationTime: times.expirationTime,
                salt: wyvern_js_1.WyvernProtocol.generatePseudoRandomSalt(),
                metadata: {
                    bundle,
                    referrerAddress,
                },
            };
        });
    }
    _makeBundleSellOrder({ bundleName, bundleDescription, bundleExternalLink, assets, collection, quantities, accountAddress, startAmount, endAmount, listingTime, expirationTime = (0, utils_1.getMaxOrderExpirationTimestamp)(), waitForHighestBid, englishAuctionReservePrice = 0, paymentTokenAddress, extraBountyBasisPoints, buyerAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            accountAddress = (0, utils_1.validateAndFormatWalletAddress)(this.web3, accountAddress);
            const quantityBNs = quantities.map((quantity, i) => wyvern_js_1.WyvernProtocol.toBaseUnitAmount((0, utils_1.makeBigNumber)(quantity), assets[i].decimals || 0));
            const bundle = (0, utils_1.getWyvernBundle)(assets, assets.map((a) => this._getSchema(a.schemaName)), quantityBNs);
            const orderedSchemas = bundle.schemas.map((name) => this._getSchema(name));
            bundle.name = bundleName;
            bundle.description = bundleDescription;
            bundle.external_link = bundleExternalLink;
            // If all assets are for the same collection, use its fees
            const asset = collection ? yield this.api.getAsset(assets[0]) : undefined;
            const { totalSellerFeeBasisPoints, totalBuyerFeeBasisPoints, sellerBountyBasisPoints, } = yield this.computeFees({
                asset,
                side: types_1.OrderSide.Sell,
                extraBountyBasisPoints,
            });
            const { calldata, replacementPattern } = (0, schema_1.encodeAtomicizedSell)(orderedSchemas, bundle.assets, accountAddress, this._wyvernProtocol, this._networkName);
            const { basePrice, extra, paymentToken, reservePrice } = yield this._getPriceParameters(types_1.OrderSide.Sell, paymentTokenAddress, (0, utils_1.makeBigNumber)(expirationTime), (0, utils_1.makeBigNumber)(startAmount), endAmount !== undefined ? (0, utils_1.makeBigNumber)(endAmount) : undefined, waitForHighestBid, (0, utils_1.makeBigNumber)(englishAuctionReservePrice));
            const times = this._getTimeParameters({
                expirationTimestamp: expirationTime,
                listingTimestamp: listingTime,
                waitingForBestCounterOrder: waitForHighestBid,
            });
            const orderSaleKind = endAmount != null && endAmount !== startAmount
                ? types_1.SaleKind.DutchAuction
                : types_1.SaleKind.FixedPrice;
            const { makerRelayerFee, takerRelayerFee, makerProtocolFee, takerProtocolFee, makerReferrerFee, feeRecipient, } = this._getSellFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, waitForHighestBid, sellerBountyBasisPoints);
            return {
                exchange: ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernExchangeContractAddress) ||
                    wyvern_js_1.WyvernProtocol.getExchangeContractAddress(this._networkName),
                maker: accountAddress,
                taker: buyerAddress,
                quantity: (0, utils_1.makeBigNumber)(1),
                makerRelayerFee,
                takerRelayerFee,
                makerProtocolFee,
                takerProtocolFee,
                makerReferrerFee,
                waitingForBestCounterOrder: waitForHighestBid,
                englishAuctionReservePrice: reservePrice
                    ? (0, utils_1.makeBigNumber)(reservePrice)
                    : undefined,
                feeMethod: types_1.FeeMethod.SplitFee,
                feeRecipient,
                side: types_1.OrderSide.Sell,
                saleKind: orderSaleKind,
                target: wyvern_js_1.WyvernProtocol.getAtomicizerContractAddress(this._networkName),
                howToCall: types_1.HowToCall.DelegateCall,
                calldata,
                replacementPattern,
                staticTarget: constants_2.NULL_ADDRESS,
                staticExtradata: "0x",
                paymentToken,
                basePrice,
                extra,
                listingTime: times.listingTime,
                expirationTime: times.expirationTime,
                salt: wyvern_js_1.WyvernProtocol.generatePseudoRandomSalt(),
                metadata: {
                    bundle,
                },
            };
        });
    }
    _makeMatchingOrder({ order, accountAddress, recipientAddress, }) {
        accountAddress = (0, utils_1.validateAndFormatWalletAddress)(this.web3, accountAddress);
        recipientAddress = (0, utils_1.validateAndFormatWalletAddress)(this.web3, recipientAddress);
        const computeOrderParams = () => {
            const shouldValidate = order.target === utils_1.merkleValidatorByNetwork[this._networkName];
            if ("asset" in order.metadata) {
                const schema = this._getSchema(order.metadata.schema);
                return order.side == types_1.OrderSide.Buy
                    ? (0, schema_1.encodeSell)(schema, order.metadata.asset, recipientAddress, shouldValidate ? order.target : undefined)
                    : (0, schema_1.encodeBuy)(schema, order.metadata.asset, recipientAddress, shouldValidate ? order.target : undefined);
            }
            else if ("bundle" in order.metadata) {
                // We're matching a bundle order
                const bundle = order.metadata.bundle;
                const orderedSchemas = bundle.schemas
                    ? bundle.schemas.map((schemaName) => this._getSchema(schemaName))
                    : // Backwards compat:
                        bundle.assets.map(() => this._getSchema("schema" in order.metadata ? order.metadata.schema : undefined));
                const atomicized = order.side == types_1.OrderSide.Buy
                    ? (0, schema_1.encodeAtomicizedSell)(orderedSchemas, order.metadata.bundle.assets, recipientAddress, this._wyvernProtocol, this._networkName)
                    : (0, schema_1.encodeAtomicizedBuy)(orderedSchemas, order.metadata.bundle.assets, recipientAddress, this._wyvernProtocol, this._networkName);
                return {
                    target: wyvern_js_1.WyvernProtocol.getAtomicizerContractAddress(this._networkName),
                    calldata: atomicized.calldata,
                    replacementPattern: atomicized.replacementPattern,
                };
            }
            else {
                throw new Error("Invalid order metadata");
            }
        };
        const { target, calldata, replacementPattern } = computeOrderParams();
        const times = this._getTimeParameters({
            expirationTimestamp: 0,
            isMatchingOrder: true,
        });
        // Compat for matching buy orders that have fee recipient still on them
        const feeRecipient = order.feeRecipient == constants_2.NULL_ADDRESS
            ? constants_2.OPENSEA_LEGACY_FEE_RECIPIENT
            : constants_2.NULL_ADDRESS;
        const matchingOrder = {
            exchange: order.exchange,
            maker: accountAddress,
            taker: order.maker,
            quantity: order.quantity,
            makerRelayerFee: order.makerRelayerFee,
            takerRelayerFee: order.takerRelayerFee,
            makerProtocolFee: order.makerProtocolFee,
            takerProtocolFee: order.takerProtocolFee,
            makerReferrerFee: order.makerReferrerFee,
            waitingForBestCounterOrder: false,
            feeMethod: order.feeMethod,
            feeRecipient,
            side: (order.side + 1) % 2,
            saleKind: types_1.SaleKind.FixedPrice,
            target,
            howToCall: order.howToCall,
            calldata,
            replacementPattern,
            staticTarget: constants_2.NULL_ADDRESS,
            staticExtradata: "0x",
            paymentToken: order.paymentToken,
            basePrice: order.basePrice,
            extra: (0, utils_1.makeBigNumber)(0),
            listingTime: times.listingTime,
            expirationTime: times.expirationTime,
            salt: wyvern_js_1.WyvernProtocol.generatePseudoRandomSalt(),
            metadata: order.metadata,
        };
        return matchingOrder;
    }
    /**
     * Validate against Wyvern that a buy and sell order can match
     * @param param0 __namedParameters Object
     * @param buy The buy order to validate
     * @param sell The sell order to validate
     * @param accountAddress Address for the user's wallet
     * @param shouldValidateBuy Whether to validate the buy order individually.
     * @param shouldValidateSell Whether to validate the sell order individually.
     * @param retries How many times to retry if validation fails
     */
    _validateMatch({ buy, sell, accountAddress, shouldValidateBuy = false, shouldValidateSell = false, }, retries = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (shouldValidateBuy) {
                    const buyValid = yield this._validateOrder(buy);
                    this.logger(`Buy order is valid: ${buyValid}`);
                    if (!buyValid) {
                        throw new Error("Invalid buy order. It may have recently been removed. Please refresh the page and try again!");
                    }
                }
                if (shouldValidateSell) {
                    const sellValid = yield this._validateOrder(sell);
                    this.logger(`Sell order is valid: ${sellValid}`);
                    if (!sellValid) {
                        throw new Error("Invalid sell order. It may have recently been removed. Please refresh the page and try again!");
                    }
                }
                const canMatch = yield (0, debugging_1.requireOrdersCanMatch)(this._getClientsForRead({
                    retries,
                }).wyvernProtocol, { buy, sell, accountAddress });
                this.logger(`Orders matching: ${canMatch}`);
                const calldataCanMatch = yield (0, debugging_1.requireOrderCalldataCanMatch)(this._getClientsForRead({
                    retries,
                }).wyvernProtocol, { buy, sell });
                this.logger(`Order calldata matching: ${calldataCanMatch}`);
                return true;
            }
            catch (error) {
                if (retries <= 0) {
                    throw new Error(`Error matching this listing: ${error instanceof Error ? error.message : ""}. Please contact the maker or try again later!`);
                }
                yield (0, utils_1.delay)(500);
                return yield this._validateMatch({ buy, sell, accountAddress, shouldValidateBuy, shouldValidateSell }, retries - 1);
            }
        });
    }
    // For creating email whitelists on order takers
    _createEmailWhitelistEntry({ order, buyerEmail, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const asset = "asset" in order.metadata ? order.metadata.asset : undefined;
            if (!asset || !asset.id) {
                throw new Error("Whitelisting only available for non-fungible assets.");
            }
            yield this.api.postAssetWhitelist(asset.address, asset.id, buyerEmail);
        });
    }
    // Throws
    _sellOrderValidationAndApprovals({ order, accountAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
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
            const tokenAddress = order.paymentToken;
            yield this._approveAll({
                schemaNames,
                wyAssets,
                accountAddress,
            });
            // For fulfilling bids,
            // need to approve access to fungible token because of the way fees are paid
            // This can be done at a higher level to show UI
            if (tokenAddress != constants_2.NULL_ADDRESS) {
                const minimumAmount = (0, utils_1.makeBigNumber)(order.basePrice);
                const tokenTransferProxyAddress = ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernTokenTransferProxyContractAddress) ||
                    wyvern_js_1.WyvernProtocol.getTokenTransferProxyAddress(this._networkName);
                yield this.approveFungibleToken({
                    accountAddress,
                    tokenAddress,
                    minimumAmount,
                    proxyAddress: tokenTransferProxyAddress,
                });
            }
            // Check sell parameters
            const sellValid = yield this._wyvernProtocol.wyvernExchange
                .validateOrderParameters_([
                order.exchange,
                order.maker,
                order.taker,
                order.feeRecipient,
                order.target,
                order.staticTarget,
                order.paymentToken,
            ], [
                order.makerRelayerFee,
                order.takerRelayerFee,
                order.makerProtocolFee,
                order.takerProtocolFee,
                order.basePrice,
                order.extra,
                order.listingTime,
                order.expirationTime,
                order.salt,
            ], order.feeMethod, order.side, order.saleKind, order.howToCall, order.calldata, order.replacementPattern, order.staticExtradata)
                .callAsync({ from: accountAddress });
            if (!sellValid) {
                console.error(order);
                throw new Error(`Failed to validate sell order parameters. Make sure you're on the right network!`);
            }
        });
    }
    /**
     * Instead of signing an off-chain order, you can approve an order
     * with on on-chain transaction using this method
     * @param order Order to approve
     * @returns Transaction hash of the approval transaction
     */
    approveOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            this._dispatch(types_1.EventType.ApproveOrder, {
                orderV2: order,
                accountAddress: order.maker.address,
            });
            let transactionHash;
            switch (order.protocolAddress) {
                case constants_1.CROSS_CHAIN_SEAPORT_ADDRESS: {
                    const transaction = yield this.seaport
                        .validate([order.protocolData], order.maker.address)
                        .transact();
                    transactionHash = transaction.hash;
                    break;
                }
                default:
                    throw new Error("Unsupported protocol");
            }
            yield this._confirmTransaction(transactionHash, types_1.EventType.ApproveOrder, "Approving order");
            return transactionHash;
        });
    }
    /**
     * Instead of signing an off-chain order, you can approve an order
     * with on on-chain transaction using this method
     * @param order Order to approve
     * @returns Transaction hash of the approval transaction
     */
    approveOrderLegacyWyvern(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountAddress = order.maker;
            const includeInOrderBook = true;
            this._dispatch(types_1.EventType.ApproveOrder, { order, accountAddress });
            const transactionHash = yield this._wyvernProtocol.wyvernExchange
                .approveOrder_([
                order.exchange,
                order.maker,
                order.taker,
                order.feeRecipient,
                order.target,
                order.staticTarget,
                order.paymentToken,
            ], [
                order.makerRelayerFee,
                order.takerRelayerFee,
                order.makerProtocolFee,
                order.takerProtocolFee,
                order.basePrice,
                order.extra,
                order.listingTime,
                order.expirationTime,
                order.salt,
            ], order.feeMethod, order.side, order.saleKind, order.howToCall, order.calldata, order.replacementPattern, order.staticExtradata, includeInOrderBook)
                .sendTransactionAsync({ from: accountAddress });
            yield this._confirmTransaction(transactionHash.toString(), types_1.EventType.ApproveOrder, "Approving order", () => __awaiter(this, void 0, void 0, function* () {
                const isApproved = yield this._validateOrder(order);
                return isApproved;
            }));
            return transactionHash;
        });
    }
    _validateOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const isValid = yield this._wyvernProtocolReadOnly.wyvernExchange
                .validateOrder_([
                order.exchange,
                order.maker,
                order.taker,
                order.feeRecipient,
                order.target,
                order.staticTarget,
                order.paymentToken,
            ], [
                order.makerRelayerFee,
                order.takerRelayerFee,
                order.makerProtocolFee,
                order.takerProtocolFee,
                order.basePrice,
                order.extra,
                order.listingTime,
                order.expirationTime,
                order.salt,
            ], order.feeMethod, order.side, order.saleKind, order.howToCall, order.calldata, order.replacementPattern, order.staticExtradata, order.v || 0, order.r || constants_2.NULL_BLOCK_HASH, order.s || constants_2.NULL_BLOCK_HASH)
                .callAsync();
            return isValid;
        });
    }
    _approveAll({ schemaNames, wyAssets, accountAddress, proxyAddress, }) {
        return __awaiter(this, void 0, void 0, function* () {
            proxyAddress =
                proxyAddress || (yield this._getProxy(accountAddress, 0)) || undefined;
            if (!proxyAddress) {
                proxyAddress = yield this._initializeProxy(accountAddress);
            }
            const contractsWithApproveAll = new Set();
            return Promise.all(wyAssets.map((wyAsset, i) => __awaiter(this, void 0, void 0, function* () {
                const schemaName = schemaNames[i];
                // Verify that the taker owns the asset
                let isOwner;
                try {
                    isOwner = yield this._ownsAssetOnChain({
                        accountAddress,
                        proxyAddress,
                        wyAsset,
                        schemaName,
                    });
                }
                catch (error) {
                    // let it through for assets we don't support yet
                    isOwner = true;
                }
                if (!isOwner) {
                    const minAmount = "quantity" in wyAsset ? wyAsset.quantity : 1;
                    console.error(`Failed on-chain ownership check: ${accountAddress} on ${schemaName}:`, wyAsset);
                    throw new Error(`You don't own enough to do that (${minAmount} base units of ${wyAsset.address}${wyAsset.id ? " token " + wyAsset.id : ""})`);
                }
                switch (schemaName) {
                    case types_1.WyvernSchemaName.ERC721:
                    case types_1.WyvernSchemaName.ERC721v3:
                    case types_1.WyvernSchemaName.ERC1155:
                    case types_1.WyvernSchemaName.LegacyEnjin:
                    case types_1.WyvernSchemaName.ENSShortNameAuction:
                        // Handle NFTs and SFTs
                        // eslint-disable-next-line no-case-declarations
                        const wyNFTAsset = wyAsset;
                        return yield this.approveSemiOrNonFungibleToken({
                            tokenId: wyNFTAsset.id.toString(),
                            tokenAddress: wyNFTAsset.address,
                            accountAddress,
                            proxyAddress,
                            schemaName,
                            skipApproveAllIfTokenAddressIn: contractsWithApproveAll,
                        });
                    case types_1.WyvernSchemaName.ERC20:
                        // Handle FTs
                        // eslint-disable-next-line no-case-declarations
                        const wyFTAsset = wyAsset;
                        if (contractsWithApproveAll.has(wyFTAsset.address)) {
                            // Return null to indicate no tx occurred
                            return null;
                        }
                        contractsWithApproveAll.add(wyFTAsset.address);
                        return yield this.approveFungibleToken({
                            tokenAddress: wyFTAsset.address,
                            accountAddress,
                            proxyAddress,
                        });
                    // For other assets, including contracts:
                    // Send them to the user's proxy
                    // if (where != WyvernAssetLocation.Proxy) {
                    //   return this.transferOne({
                    //     schemaName: schema.name,
                    //     asset: wyAsset,
                    //     isWyvernAsset: true,
                    //     fromAddress: accountAddress,
                    //     toAddress: proxy
                    //   })
                    // }
                    // return true
                }
            })));
        });
    }
    // Throws
    _buyOrderValidationAndApprovals({ order, counterOrder, accountAddress, }) {
        var _b;
        return __awaiter(this, void 0, void 0, function* () {
            const tokenAddress = order.paymentToken;
            if (tokenAddress != constants_2.NULL_ADDRESS) {
                /* NOTE: no buy-side auctions for now, so sell.saleKind === 0 */
                let minimumAmount = (0, utils_1.makeBigNumber)(order.basePrice);
                if (counterOrder) {
                    minimumAmount = yield this._getRequiredAmountForTakingSellOrder(counterOrder);
                }
                // Check token approval
                // This can be done at a higher level to show UI
                yield this.approveFungibleToken({
                    accountAddress,
                    tokenAddress,
                    minimumAmount,
                    proxyAddress: ((_b = this._wyvernConfigOverride) === null || _b === void 0 ? void 0 : _b.wyvernTokenTransferProxyContractAddress) ||
                        wyvern_js_1.WyvernProtocol.getTokenTransferProxyAddress(this._networkName),
                });
            }
            // Check order formation
            const buyValid = yield this._wyvernProtocolReadOnly.wyvernExchange
                .validateOrderParameters_([
                order.exchange,
                order.maker,
                order.taker,
                order.feeRecipient,
                order.target,
                order.staticTarget,
                order.paymentToken,
            ], [
                order.makerRelayerFee,
                order.takerRelayerFee,
                order.makerProtocolFee,
                order.takerProtocolFee,
                order.basePrice,
                order.extra,
                order.listingTime,
                order.expirationTime,
                order.salt,
            ], order.feeMethod, order.side, order.saleKind, order.howToCall, order.calldata, order.replacementPattern, order.staticExtradata)
                .callAsync({ from: accountAddress });
            if (!buyValid) {
                console.error(order);
                throw new Error(`Failed to validate buy order parameters. Make sure you're on the right network!`);
            }
        });
    }
    /**
     * Check if an account, or its proxy, owns an asset on-chain
     * @param accountAddress Account address for the wallet
     * @param proxyAddress Proxy address for the account
     * @param wyAsset asset to check. If fungible, the `quantity` attribute will be the minimum amount to own
     * @param schemaName WyvernSchemaName for the asset
     */
    _ownsAssetOnChain({ accountAddress, proxyAddress, wyAsset, schemaName, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const asset = {
                tokenId: wyAsset.id || null,
                tokenAddress: wyAsset.address,
                schemaName,
            };
            const minAmount = new bignumber_js_1.BigNumber("quantity" in wyAsset ? wyAsset.quantity : 1);
            const accountBalance = yield this.getAssetBalance({
                accountAddress,
                asset,
            });
            if (accountBalance.isGreaterThanOrEqualTo(minAmount)) {
                return true;
            }
            proxyAddress = proxyAddress || (yield this._getProxy(accountAddress));
            if (proxyAddress) {
                const proxyBalance = yield this.getAssetBalance({
                    accountAddress: proxyAddress,
                    asset,
                });
                if (proxyBalance.isGreaterThanOrEqualTo(minAmount)) {
                    return true;
                }
            }
            return false;
        });
    }
    _getBuyFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, sellOrder) {
        this._validateFees(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints);
        let makerRelayerFee;
        let takerRelayerFee;
        if (sellOrder) {
            // Use the sell order's fees to ensure compatiblity and force the order
            // to only be acceptable by the sell order maker.
            // Swap maker/taker depending on whether it's an English auction (taker)
            // TODO add extraBountyBasisPoints when making bidder bounties
            makerRelayerFee = sellOrder.waitingForBestCounterOrder
                ? (0, utils_1.makeBigNumber)(sellOrder.makerRelayerFee)
                : (0, utils_1.makeBigNumber)(sellOrder.takerRelayerFee);
            takerRelayerFee = sellOrder.waitingForBestCounterOrder
                ? (0, utils_1.makeBigNumber)(sellOrder.takerRelayerFee)
                : (0, utils_1.makeBigNumber)(sellOrder.makerRelayerFee);
        }
        else {
            makerRelayerFee = (0, utils_1.makeBigNumber)(totalBuyerFeeBasisPoints);
            takerRelayerFee = (0, utils_1.makeBigNumber)(totalSellerFeeBasisPoints);
        }
        return {
            makerRelayerFee,
            takerRelayerFee,
            makerProtocolFee: (0, utils_1.makeBigNumber)(0),
            takerProtocolFee: (0, utils_1.makeBigNumber)(0),
            makerReferrerFee: (0, utils_1.makeBigNumber)(0),
            feeRecipient: constants_2.OPENSEA_LEGACY_FEE_RECIPIENT,
            feeMethod: types_1.FeeMethod.SplitFee,
        };
    }
    _getSellFeeParameters(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints, waitForHighestBid, sellerBountyBasisPoints = 0) {
        this._validateFees(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints);
        // Use buyer as the maker when it's an English auction, so Wyvern sets prices correctly
        const feeRecipient = waitForHighestBid
            ? constants_2.NULL_ADDRESS
            : constants_2.OPENSEA_LEGACY_FEE_RECIPIENT;
        // Swap maker/taker fees when it's an English auction,
        // since these sell orders are takers not makers
        const makerRelayerFee = waitForHighestBid
            ? (0, utils_1.makeBigNumber)(totalBuyerFeeBasisPoints)
            : (0, utils_1.makeBigNumber)(totalSellerFeeBasisPoints);
        const takerRelayerFee = waitForHighestBid
            ? (0, utils_1.makeBigNumber)(totalSellerFeeBasisPoints)
            : (0, utils_1.makeBigNumber)(totalBuyerFeeBasisPoints);
        return {
            makerRelayerFee,
            takerRelayerFee,
            makerProtocolFee: (0, utils_1.makeBigNumber)(0),
            takerProtocolFee: (0, utils_1.makeBigNumber)(0),
            makerReferrerFee: (0, utils_1.makeBigNumber)(sellerBountyBasisPoints),
            feeRecipient,
            feeMethod: types_1.FeeMethod.SplitFee,
        };
    }
    /**
     * Validate fee parameters
     * @param totalBuyerFeeBasisPoints Total buyer fees
     * @param totalSellerFeeBasisPoints Total seller fees
     */
    _validateFees(totalBuyerFeeBasisPoints, totalSellerFeeBasisPoints) {
        const maxFeePercent = constants_2.INVERSE_BASIS_POINT / 100;
        if (totalBuyerFeeBasisPoints > constants_2.INVERSE_BASIS_POINT ||
            totalSellerFeeBasisPoints > constants_2.INVERSE_BASIS_POINT) {
            throw new Error(`Invalid buyer/seller fees: must be less than ${maxFeePercent}%`);
        }
        if (totalBuyerFeeBasisPoints < 0 || totalSellerFeeBasisPoints < 0) {
            throw new Error(`Invalid buyer/seller fees: must be at least 0%`);
        }
    }
    /**
     * Get the listing and expiration time parameters for a new order
     * @param expirationTimestamp Timestamp to expire the order (in seconds), or 0 for non-expiring
     * @param listingTimestamp Timestamp to start the order (in seconds), or undefined to start it now
     * @param waitingForBestCounterOrder Whether this order should be hidden until the best match is found
     */
    _getTimeParameters({ expirationTimestamp = (0, utils_1.getMaxOrderExpirationTimestamp)(), listingTimestamp, waitingForBestCounterOrder = false, isMatchingOrder = false, }) {
        const maxExpirationTimeStamp = (0, utils_1.getMaxOrderExpirationTimestamp)();
        const minListingTimestamp = Math.round(Date.now() / 1000);
        if (!isMatchingOrder && expirationTimestamp === 0) {
            throw new Error("Expiration time cannot be 0");
        }
        if (listingTimestamp && listingTimestamp < minListingTimestamp) {
            throw new Error("Listing time cannot be in the past.");
        }
        if (listingTimestamp && listingTimestamp >= expirationTimestamp) {
            throw new Error("Listing time must be before the expiration time.");
        }
        if (waitingForBestCounterOrder && listingTimestamp) {
            throw new Error(`Cannot schedule an English auction for the future.`);
        }
        if (parseInt(expirationTimestamp.toString()) != expirationTimestamp) {
            throw new Error(`Expiration timestamp must be a whole number of seconds`);
        }
        if (expirationTimestamp > maxExpirationTimeStamp) {
            throw new Error("Expiration time must not exceed six months from now");
        }
        if (waitingForBestCounterOrder) {
            listingTimestamp = expirationTimestamp;
            // Expire one week from now, to ensure server can match it
            // Later, this will expire closer to the listingTime
            expirationTimestamp =
                expirationTimestamp + constants_2.ORDER_MATCHING_LATENCY_SECONDS;
            // The minimum expiration time has to be at least fifteen minutes from now
            const minEnglishAuctionListingTimestamp = minListingTimestamp + constants_2.MIN_EXPIRATION_MINUTES * 60;
            if (!isMatchingOrder &&
                listingTimestamp < minEnglishAuctionListingTimestamp) {
                throw new Error(`Expiration time must be at least ${constants_2.MIN_EXPIRATION_MINUTES} minutes from now`);
            }
        }
        else {
            // Small offset to account for latency
            listingTimestamp =
                listingTimestamp || Math.round(Date.now() / 1000 - 100);
            // The minimum expiration time has to be at least fifteen minutes from now
            const minExpirationTimestamp = listingTimestamp + constants_2.MIN_EXPIRATION_MINUTES * 60;
            if (!isMatchingOrder && expirationTimestamp < minExpirationTimestamp) {
                throw new Error(`Expiration time must be at least ${constants_2.MIN_EXPIRATION_MINUTES} minutes from the listing date`);
            }
        }
        return {
            listingTime: (0, utils_1.makeBigNumber)(listingTimestamp),
            expirationTime: (0, utils_1.makeBigNumber)(expirationTimestamp),
        };
    }
    /**
     * Compute the `basePrice` and `extra` parameters to be used to price an order.
     * Also validates the expiration time and auction type.
     * @param tokenAddress Address of the ERC-20 token to use for trading.
     * Use the null address for ETH
     * @param expirationTime When the auction expires, or 0 if never.
     * @param startAmount The base value for the order, in the token's main units (e.g. ETH instead of wei)
     * @param endAmount The end value for the order, in the token's main units (e.g. ETH instead of wei). If unspecified, the order's `extra` attribute will be 0
     */
    _getPriceParameters(orderSide, tokenAddress, expirationTime, startAmount, endAmount, waitingForBestCounterOrder = false, englishAuctionReservePrice) {
        return __awaiter(this, void 0, void 0, function* () {
            const priceDiff = endAmount != null ? startAmount.minus(endAmount) : new bignumber_js_1.BigNumber(0);
            const paymentToken = tokenAddress.toLowerCase();
            const isEther = tokenAddress == constants_2.NULL_ADDRESS;
            const { tokens } = yield this.api.getPaymentTokens({
                address: paymentToken,
            });
            const token = tokens[0];
            // Validation
            if (startAmount.isNaN() || startAmount == null || startAmount.lt(0)) {
                throw new Error(`Starting price must be a number >= 0`);
            }
            if (!isEther && !token) {
                throw new Error(`No ERC-20 token found for '${paymentToken}'`);
            }
            if (isEther && waitingForBestCounterOrder) {
                throw new Error(`English auctions must use wrapped ETH or an ERC-20 token.`);
            }
            if (isEther && orderSide === types_1.OrderSide.Buy) {
                throw new Error(`Offers must use wrapped ETH or an ERC-20 token.`);
            }
            if (priceDiff.lt(0)) {
                throw new Error("End price must be less than or equal to the start price.");
            }
            if (priceDiff.gt(0) && expirationTime.eq(0)) {
                throw new Error("Expiration time must be set if order will change in price.");
            }
            if (englishAuctionReservePrice &&
                !englishAuctionReservePrice.isZero() &&
                !waitingForBestCounterOrder) {
                throw new Error("Reserve prices may only be set on English auctions.");
            }
            if (englishAuctionReservePrice &&
                !englishAuctionReservePrice.isZero() &&
                englishAuctionReservePrice < startAmount) {
                throw new Error("Reserve price must be greater than or equal to the start amount.");
            }
            // Note: WyvernProtocol.toBaseUnitAmount(makeBigNumber(startAmount), token.decimals)
            // will fail if too many decimal places, so special-case ether
            const basePrice = isEther
                ? (0, utils_1.makeBigNumber)(this.web3.utils.toWei(startAmount.toString(), "ether")).integerValue()
                : wyvern_js_1.WyvernProtocol.toBaseUnitAmount(startAmount, token.decimals);
            const endPrice = endAmount
                ? isEther
                    ? (0, utils_1.makeBigNumber)(this.web3.utils.toWei(endAmount.toString(), "ether")).integerValue()
                    : wyvern_js_1.WyvernProtocol.toBaseUnitAmount(endAmount, token.decimals)
                : undefined;
            const extra = isEther
                ? (0, utils_1.makeBigNumber)(this.web3.utils.toWei(priceDiff.toString(), "ether")).integerValue()
                : wyvern_js_1.WyvernProtocol.toBaseUnitAmount(priceDiff, token.decimals);
            const reservePrice = englishAuctionReservePrice
                ? isEther
                    ? (0, utils_1.makeBigNumber)(this.web3.utils.toWei(englishAuctionReservePrice.toString(), "ether")).integerValue()
                    : wyvern_js_1.WyvernProtocol.toBaseUnitAmount(englishAuctionReservePrice, token.decimals)
                : undefined;
            return { basePrice, extra, paymentToken, reservePrice, endPrice };
        });
    }
    _getMetadata(order, referrerAddress) {
        const referrer = referrerAddress || order.metadata.referrerAddress;
        if (referrer && (0, ethereumjs_util_1.isValidAddress)(referrer)) {
            return referrer;
        }
        return undefined;
    }
    _atomicMatch({ buy, sell, accountAddress, metadata = constants_2.NULL_BLOCK_HASH, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let value;
            let shouldValidateBuy = true;
            let shouldValidateSell = true;
            // Only check buy, but shouldn't matter as they should always be equal
            if (sell.maker.toLowerCase() == accountAddress.toLowerCase()) {
                // USER IS THE SELLER, only validate the buy order
                yield this._sellOrderValidationAndApprovals({
                    order: sell,
                    accountAddress,
                });
                shouldValidateSell = false;
            }
            else if (buy.maker.toLowerCase() == accountAddress.toLowerCase()) {
                // USER IS THE BUYER, only validate the sell order
                yield this._buyOrderValidationAndApprovals({
                    order: buy,
                    counterOrder: sell,
                    accountAddress,
                });
                shouldValidateBuy = false;
                // If using ETH to pay, set the value of the transaction to the current price
                if (buy.paymentToken == constants_2.NULL_ADDRESS) {
                    value = yield this._getRequiredAmountForTakingSellOrder(sell);
                }
            }
            else {
                // User is neither - matching service
            }
            yield this._validateMatch({
                buy,
                sell,
                accountAddress,
                shouldValidateBuy,
                shouldValidateSell,
            });
            this._dispatch(types_1.EventType.MatchOrders, {
                buy,
                sell,
                accountAddress,
                matchMetadata: metadata,
            });
            let txHash;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txnData = { from: accountAddress, value };
            const args = [
                [
                    buy.exchange,
                    buy.maker,
                    buy.taker,
                    buy.feeRecipient,
                    buy.target,
                    buy.staticTarget,
                    buy.paymentToken,
                    sell.exchange,
                    sell.maker,
                    sell.taker,
                    sell.feeRecipient,
                    sell.target,
                    sell.staticTarget,
                    sell.paymentToken,
                ],
                [
                    buy.makerRelayerFee,
                    buy.takerRelayerFee,
                    buy.makerProtocolFee,
                    buy.takerProtocolFee,
                    buy.basePrice,
                    buy.extra,
                    buy.listingTime,
                    buy.expirationTime,
                    buy.salt,
                    sell.makerRelayerFee,
                    sell.takerRelayerFee,
                    sell.makerProtocolFee,
                    sell.takerProtocolFee,
                    sell.basePrice,
                    sell.extra,
                    sell.listingTime,
                    sell.expirationTime,
                    sell.salt,
                ],
                [
                    buy.feeMethod,
                    buy.side,
                    buy.saleKind,
                    buy.howToCall,
                    sell.feeMethod,
                    sell.side,
                    sell.saleKind,
                    sell.howToCall,
                ],
                buy.calldata,
                sell.calldata,
                buy.replacementPattern,
                sell.replacementPattern,
                buy.staticExtradata,
                sell.staticExtradata,
                [buy.v || 0, sell.v || 0],
                [
                    buy.r || constants_2.NULL_BLOCK_HASH,
                    buy.s || constants_2.NULL_BLOCK_HASH,
                    sell.r || constants_2.NULL_BLOCK_HASH,
                    sell.s || constants_2.NULL_BLOCK_HASH,
                    metadata,
                ],
            ];
            // Estimate gas first
            try {
                // Typescript splat doesn't typecheck
                const gasEstimate = yield this._wyvernProtocolReadOnly.wyvernExchange
                    .atomicMatch_(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10])
                    .estimateGasAsync(txnData);
                txnData.gas = this._correctGasAmount(gasEstimate);
            }
            catch (error) {
                console.error(`Failed atomic match with args: `, args, error);
                throw new Error(`Oops, the Ethereum network rejected this transaction :( The OpenSea devs have been alerted, but this problem is typically due an item being locked or untransferrable. The exact error was "${error instanceof Error
                    ? error.message.substr(0, debugging_1.MAX_ERROR_LENGTH)
                    : "unknown"}..."`);
            }
            // Then do the transaction
            try {
                this.logger(`Fulfilling order with gas set to ${txnData.gas}`);
                txHash = yield this._wyvernProtocol.wyvernExchange
                    .atomicMatch_(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10])
                    .sendTransactionAsync(txnData);
            }
            catch (error) {
                console.error(error);
                this._dispatch(types_1.EventType.TransactionDenied, {
                    error,
                    buy,
                    sell,
                    accountAddress,
                    matchMetadata: metadata,
                });
                throw new Error(`Failed to authorize transaction: "${error instanceof Error && error.message
                    ? error.message
                    : "user denied"}..."`);
            }
            return txHash;
        });
    }
    _getRequiredAmountForTakingSellOrder(sell) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentPrice = yield this.getCurrentPriceLegacyWyvern(sell);
            const estimatedPrice = (0, utils_1.estimateCurrentPrice)(sell);
            const maxPrice = bignumber_js_1.BigNumber.max(currentPrice, estimatedPrice);
            // TODO Why is this not always a big number?
            sell.takerRelayerFee = (0, utils_1.makeBigNumber)(sell.takerRelayerFee);
            const feePercentage = sell.takerRelayerFee.div(constants_2.INVERSE_BASIS_POINT);
            const fee = feePercentage.times(maxPrice);
            return fee.plus(maxPrice).integerValue(bignumber_js_1.BigNumber.ROUND_CEIL);
        });
    }
    /**
     * Gets the current order nonce for an account
     * @param accountAddress account to check the nonce for
     * @returns nonce
     */
    getNonce(accountAddress) {
        return this._wyvernProtocol.wyvernExchange
            .nonces(accountAddress)
            .callAsync();
    }
    /**
     * Generate the signature for authorizing an order
     * @param order Unsigned wyvern order
     * @returns order signature in the form of v, r, s, also an optional nonce
     */
    authorizeOrder(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const signerAddress = order.maker;
            this._dispatch(types_1.EventType.CreateOrder, {
                order,
                accountAddress: order.maker,
            });
            try {
                // 2.3 Sign order flow using EIP-712
                const signerOrderNonce = yield this.getNonce(signerAddress);
                // We need to manually specify each field because OS orders can contain unrelated data
                const orderForSigning = {
                    maker: order.maker,
                    exchange: order.exchange,
                    taker: order.taker,
                    makerRelayerFee: order.makerRelayerFee.toString(),
                    takerRelayerFee: order.takerRelayerFee.toString(),
                    makerProtocolFee: order.makerProtocolFee.toString(),
                    takerProtocolFee: order.takerProtocolFee.toString(),
                    feeRecipient: order.feeRecipient,
                    feeMethod: order.feeMethod,
                    side: order.side,
                    saleKind: order.saleKind,
                    target: order.target,
                    howToCall: order.howToCall,
                    calldata: order.calldata,
                    replacementPattern: order.replacementPattern,
                    staticTarget: order.staticTarget,
                    staticExtradata: order.staticExtradata,
                    paymentToken: order.paymentToken,
                    basePrice: order.basePrice.toString(),
                    extra: order.extra.toString(),
                    listingTime: order.listingTime.toString(),
                    expirationTime: order.expirationTime.toString(),
                    salt: order.salt.toString(),
                };
                // We don't JSON.stringify as certain wallet providers sanitize this data
                // https://github.com/coinbase/coinbase-wallet-sdk/issues/60
                const message = {
                    types: constants_2.EIP_712_ORDER_TYPES,
                    domain: {
                        name: constants_2.EIP_712_WYVERN_DOMAIN_NAME,
                        version: constants_2.EIP_712_WYVERN_DOMAIN_VERSION,
                        chainId: this._networkName == types_1.Network.Main ? 1 : 4,
                        verifyingContract: order.exchange,
                    },
                    primaryType: "Order",
                    message: Object.assign(Object.assign({}, orderForSigning), { nonce: signerOrderNonce.toNumber() }),
                };
                const ecSignature = yield (0, utils_1.signTypedDataAsync)(this.web3, message, signerAddress);
                return Object.assign(Object.assign({}, ecSignature), { nonce: signerOrderNonce.toNumber() });
            }
            catch (error) {
                this._dispatch(types_1.EventType.OrderDenied, {
                    order,
                    accountAddress: signerAddress,
                });
                throw error;
            }
        });
    }
    _getSchemaName(asset) {
        if (asset.schemaName) {
            return asset.schemaName;
        }
        else if ("assetContract" in asset) {
            return asset.assetContract.schemaName;
        }
        return undefined;
    }
    _getSchema(schemaName) {
        const schemaName_ = schemaName || types_1.WyvernSchemaName.ERC721;
        const schema = WyvernSchemas.schemas[this._networkName].filter((s) => s.name == schemaName_)[0];
        if (!schema) {
            throw new Error(`Trading for this asset (${schemaName_}) is not yet supported. Please contact us or check back later!`);
        }
        return schema;
    }
    _dispatch(event, data) {
        this._emitter.emit(event, data);
    }
    /**
     * Get the clients to use for a read call
     * @param retries current retry value
     * @param wyvernProtocol optional wyvern protocol to use, has default
     * @param wyvernProtocol optional readonly wyvern protocol to use, has default
     */
    _getClientsForRead({ retries }) {
        if (retries > 0) {
            // Use injected provider by default
            return {
                web3: this.web3,
                wyvernProtocol: this._wyvernProtocol,
            };
        }
        else {
            // Use provided provider as fallback
            return {
                web3: this.web3ReadOnly,
                wyvernProtocol: this._wyvernProtocolReadOnly,
            };
        }
    }
    _confirmTransaction(transactionHash, event, description, testForSuccess) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionEventData = { transactionHash, event };
            this.logger(`Transaction started: ${description}`);
            if (transactionHash == constants_2.NULL_BLOCK_HASH) {
                // This was a smart contract wallet that doesn't know the transaction
                this._dispatch(types_1.EventType.TransactionCreated, { event });
                if (!testForSuccess) {
                    // Wait if test not implemented
                    this.logger(`Unknown action, waiting 1 minute: ${description}`);
                    yield (0, utils_1.delay)(60 * 1000);
                    return;
                }
                return yield this._pollCallbackForConfirmation(event, description, testForSuccess);
            }
            // Normal wallet
            try {
                this._dispatch(types_1.EventType.TransactionCreated, transactionEventData);
                yield (0, utils_1.confirmTransaction)(this.web3, transactionHash);
                this.logger(`Transaction succeeded: ${description}`);
                this._dispatch(types_1.EventType.TransactionConfirmed, transactionEventData);
            }
            catch (error) {
                this.logger(`Transaction failed: ${description}`);
                this._dispatch(types_1.EventType.TransactionFailed, Object.assign(Object.assign({}, transactionEventData), { error }));
                throw error;
            }
        });
    }
    _pollCallbackForConfirmation(event, description, testForSuccess) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const initialRetries = 60;
                const testResolve = (retries) => __awaiter(this, void 0, void 0, function* () {
                    const wasSuccessful = yield testForSuccess();
                    if (wasSuccessful) {
                        this.logger(`Transaction succeeded: ${description}`);
                        this._dispatch(types_1.EventType.TransactionConfirmed, { event });
                        return resolve();
                    }
                    else if (retries <= 0) {
                        return reject();
                    }
                    if (retries % 10 == 0) {
                        this.logger(`Tested transaction ${initialRetries - retries + 1} times: ${description}`);
                    }
                    yield (0, utils_1.delay)(5000);
                    return testResolve(retries - 1);
                });
                return testResolve(initialRetries);
            });
        });
    }
    /**
     * Returns whether or not an authenticated proxy is revoked for a specific account address
     * @param accountAddress
     * @returns
     */
    isAuthenticatedProxyRevoked(accountAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const proxy = yield this._wyvernProtocol.getAuthenticatedProxy(accountAddress);
            return proxy.revoked().callAsync();
        });
    }
    /**
     * Revokes an authenticated proxy's access i.e. for freezing listings
     * @param accountAddress
     * @returns transaction hash
     */
    revokeAuthenticatedProxyAccess(accountAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const proxy = yield this._wyvernProtocol.getAuthenticatedProxy(accountAddress);
            return proxy.setRevoke(true).sendTransactionAsync({ from: accountAddress });
        });
    }
    /**
     * Unrevokes an authenticated proxy's access i.e. for unfreezing listings
     * @param accountAddress
     * @returns transaction hash
     */
    unrevokeAuthenticatedProxyAccess(accountAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const proxy = yield this._wyvernProtocol.getAuthenticatedProxy(accountAddress);
            return proxy.setRevoke(false).sendTransactionAsync({
                from: accountAddress,
            });
        });
    }
}
exports.OpenSeaSDK = OpenSeaSDK;