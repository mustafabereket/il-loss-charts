import {
    MarketStats,
    IUniswapPair,
    UniswapPair,
    UniswapDailyData,
    UniswapHourlyData,
    UniswapSwap,
    UniswapMintOrBurn,
    LPStats
} from '@sommelier/shared-types';

import { ethers } from 'ethers';

export interface AllPairsState {
    isLoading: boolean;
    pairs: UniswapPair[] | null;
    lookups: {
        [pairId: string]: IUniswapPair & {
            volumeRanking: number;
            liquidityRanking: number;
        };
    } | null;
    byLiquidity: IUniswapPair[] | null;
}

export type Provider = 'metamask' | 'walletconnect';

export interface Wallet {
    account: string | null;
    providerName: Provider | null;
    provider: any | null;
}

export interface PairPricesState {
    pairData: UniswapPair;
    historicalDailyData: UniswapDailyData[];
    historicalHourlyData: UniswapHourlyData[];
}

export interface IError {
    message: string;
}

export type StatsWindow = 'total' | 'day' | 'week';

export interface SwapsState {
    swaps: UniswapSwap[] | null;
    mintsAndBurns: {
        mints: UniswapMintOrBurn[];
        burns: UniswapMintOrBurn[];
        combined: UniswapMintOrBurn[];
    } | null;
}

export interface PairDataState {
    isLoading: boolean;
    currentError?: string;
    lpInfo?: PairPricesState;
    latestSwaps?: SwapsState;
}

export interface LPDataState extends PairDataState {
    lpStats: LPStats<string>;
}

export interface TopPairsState {
    daily: MarketStats[];
    weekly: MarketStats[];
}

export interface PrefetchedPairState {
    [pairId: string]: LPDataState;
}
export interface GasPrices {
    standard: number;
    fast: number;
    faster: number;
}

export type ManageLiquidityActionState = 
    'awaitingGasPrices'
    | 'gasPriceNotSelected'
    | 'amountNotEntered'
    | 'insufficientFunds'
    | 'slippageTooHigh'
    | 'needsApproval'
    | 'waitingApproval'
    | 'needsSubmit'
    | 'submitted'
    | 'unknown';

export interface WalletBalances {
    [tokenName: string]: {
        id: string;
        balance: ethers.BigNumber;
        symbol?: string;
        decimals?: string;
        allowance: {
            [address: string]:ethers.BigNumber
        };
    }
}