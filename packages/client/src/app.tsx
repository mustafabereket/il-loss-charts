import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-widgets/dist/css/react-widgets.css';
import 'styles/app.scss';
import classNames from 'classnames';
import { ErrorBoundary, useErrorHandler } from 'react-error-boundary';
import { useState, useEffect, ReactElement, createContext, Dispatch, SetStateAction } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';
import ManageLiquidityModal from 'components/manage-liquidity-modal';
import config from 'config';
import {
    UniswapPair,
    EthGasPrices,
    MarketStats,
} from '@sommelier/shared-types';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LandingContainer from 'containers/landing-container';
import MarketContainer from 'containers/market-container';
import PairContainer from 'containers/pair-container';
import SearchContainer from 'containers/search-container';
import PositionContainer from 'containers/position-container';
import SideMenu from 'components/side-menu';
import ConnectWalletModal from 'components/connect-wallet-modal';
import { PageError, ModalError } from 'components/page-error';

import useWallet from 'hooks/use-wallet';
import usePrefetch from 'hooks/use-prefetch';

import initialData from 'constants/initialData.json';
import { UniswapApiFetcher as Uniswap } from 'services/api';
import { calculatePairRankings } from 'services/calculate-stats';

import { AllPairsState, TopPairsState } from 'types/states';
export type PendingTx = {
    approval: Array<string>;
    confirm: Array<string>;
};
type PendingTxContext = {
    pendingTx: PendingTx;
    setPendingTx: Dispatch<SetStateAction<PendingTx>>,
};

const defaultPendingContext = {
    pendingTx: {
        approval: [],
        confirm: [],
    },
}
export const PendingTxContext = createContext<Partial<PendingTxContext>>(defaultPendingContext);

function App(): ReactElement {
    // ------------------ Initial Mount - API calls for first render ------------------

    const [allPairs, setAllPairs] = useState<AllPairsState>({
        isLoading: true,
        pairs: null,
        lookups: null,
        byLiquidity: null,
    });
    const [marketData, setMarketData] = useState<MarketStats[] | null>(null);
    const [topPairs, setTopPairs] = useState<TopPairsState | null>(null);
    const [currentError, setError] = useState<string | null>(null);
    const [gasPrices, setGasPrices] = useState<EthGasPrices | null>(null);
    const [showConnectWallet, setShowConnectWallet] = useState(false);
    const { wallet, error, ...restWalletProps } = useWallet();
    const [prefetchedPairs, setPairsToFetch] = usePrefetch(null);
    // subscribe to the hook, will propogate to the nearest boundary
    const [pendingTx, setPendingTx] = useState<PendingTx>({
        approval: [],
        confirm: [],
    });
    useErrorHandler(error);
    useEffect(() => {
        const fetchAllPairs = async () => {
            // Fetch all pairs
            const { data: pairsRaw, error } = await Uniswap.getTopPairs();

            if (error) {
                // we could not list pairs
                console.warn(`Could not fetch top pairs: ${error}`);
                (window as any).error = error;
                setError(error);
                return;
            }

            if (pairsRaw) {
                const calculated = calculatePairRankings(pairsRaw);

                setAllPairs({
                    isLoading: false,
                    pairs: calculated.pairs.map((p) => new UniswapPair(p)),
                    lookups: calculated.pairLookups,
                    byLiquidity: calculated.byLiquidity,
                });
            }
        };

        const fetchTopPairs = async () => {
            // Fetch all pairs
            const [
                { data: topWeeklyPairs, error: topWeeklyPairsError },
                { data: topDailyPairs, error: topDailyPairsError },
                { data: wethDaiPair, error: wethDaiPairError },
            ] = await Promise.all([
                Uniswap.getWeeklyTopPerformingPairs(),
                Uniswap.getDailyTopPerformingPairs(),
                Uniswap.getPairOverview(initialData.pairId),
            ]);

            const error =
                topWeeklyPairsError ?? topDailyPairsError ?? wethDaiPairError;

            if (error) {
                // we could not get our market data
                console.warn(`Could not fetch market data: ${error}`);
                setError(error);
                return;
            }

            // if (marketData) {
            //     setMarketData(marketData);
            // }

            if (topWeeklyPairs && topDailyPairs && wethDaiPair) {
                setTopPairs({ daily: topDailyPairs, weekly: topWeeklyPairs });

                // Prefetch first ten daily and weekly pairs
                const { list: pairsToFetch } = [
                    ...topDailyPairs.slice(0, 10),
                    ...topWeeklyPairs.slice(0, 10),
                    wethDaiPair,
                ].reduce(
                    (
                        acc: {
                            list: MarketStats[];
                            lookup: { [pairId: string]: boolean };
                        },
                        pair
                    ) => {
                        if (!acc.lookup[pair.id]) {
                            // TODO: Fix this typing. We don't need a IUniswapPair, or MarketStats
                            // All we need is an object with an ID
                            acc.list.push((pair as any) as MarketStats);
                        }
                        return acc;
                    },
                    { list: [], lookup: {} }
                );

                setPairsToFetch(pairsToFetch);
            }
        };

        const fetchMarketData = async () => {
            // Fetch all pairs
            const [
                { data: marketData, error: marketDataError },
                // { data: topPairs, error: topPairsError }
            ] = await Promise.all([
                Uniswap.getMarketData(),
                // Uniswap.getDailyTopPerformingPairs()
            ]);

            const error = marketDataError;
            // const error = marketDataError ?? topPairsError;

            if (error) {
                // we could not get our market data
                console.warn(`Could not fetch market data: ${error}`);
                setError(error);
                return;
            }

            if (marketData) {
                setMarketData(marketData);
            }
        };

        void fetchAllPairs();
        void fetchTopPairs();
        void fetchMarketData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { sendJsonMessage, lastJsonMessage } = useWebSocket(config.wsApi);

    // Handle websocket message
    // Ignore if we have an error
    useEffect(() => {
        if (!lastJsonMessage) return;

        const { topic } = lastJsonMessage;

        if (!topic) return;

        if (topic.startsWith('ethGas:getGasPrices')) {
            const { data: gasPrices }: { data: EthGasPrices } = lastJsonMessage;
            setGasPrices(gasPrices);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastJsonMessage]);

    //    Subscribe to gas prices on first render
    useEffect(() => {
        sendJsonMessage({ op: 'subscribe', topics: ['ethGas:getGasPrices'] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [showAddLiquidity, setShowAddLiquidity] = useState(false);
    const [currentPairId, setCurrentPairId] = useState<string | null>(null);
    const handleAddLiquidity = (pairId: string) => {
        setCurrentPairId(pairId);

        // Check if wallet exists, if not show wallet modal
        if (wallet && wallet.account) {
            setShowAddLiquidity(true);
        } else {
            setShowConnectWallet(true);
        }
    };

    return (
        <ErrorBoundary
            fallbackRender={({ error }) => <PageError errorMsg={error} />}
        >
            <ToastContainer
                position='top-center'
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            <Router>
                <div className={classNames('app', 'dark')} id='app-wrap'>
                    <PendingTxContext.Provider
                        value={{ pendingTx, setPendingTx }}
                    >
                        <div className='side-menu-wrapper'>
                            <SideMenu
                                wallet={wallet}
                                setShowConnectWallet={setShowConnectWallet}
                            />
                        </div>
                        <div className='app-body' id='app-body'>
                            {currentError ? (
                                <PageError errorMsg={currentError} />
                            ) : (
                                <>
                                    <ErrorBoundary
                                        FallbackComponent={ModalError}
                                    >
                                        <ConnectWalletModal
                                            show={showConnectWallet}
                                            setShow={setShowConnectWallet}
                                            wallet={wallet}
                                            error={error}
                                            {...restWalletProps}
                                        />
                                        <ManageLiquidityModal
                                            show={showAddLiquidity}
                                            setShow={setShowAddLiquidity}
                                            wallet={wallet}
                                            pairId={currentPairId}
                                            gasPrices={gasPrices}
                                        />
                                    </ErrorBoundary>
                                    <ErrorBoundary
                                        fallbackRender={({ error }) => (
                                            <PageError errorMsg={error} />
                                        )}
                                    >
                                        <Switch>
                                            <Route path='/positions'>
                                                <PositionContainer
                                                    wallet={wallet}
                                                />
                                            </Route>
                                            <Route path='/market'>
                                                <MarketContainer
                                                    marketData={marketData}
                                                />
                                            </Route>
                                            <Route path='/pair'>
                                                <PairContainer
                                                    allPairs={allPairs}
                                                    prefetchedPairs={
                                                        prefetchedPairs
                                                    }
                                                    handleAddLiquidity={
                                                        handleAddLiquidity
                                                    }
                                                />
                                            </Route>
                                            <Route path='/search'>
                                                <SearchContainer
                                                    allPairs={allPairs}
                                                />
                                            </Route>
                                            <Route path='/'>
                                                <LandingContainer
                                                    topPairs={topPairs}
                                                    wallet={wallet}
                                                    setShowConnectWallet={
                                                        setShowConnectWallet
                                                    }
                                                    handleAddLiquidity={
                                                        handleAddLiquidity
                                                    }
                                                />
                                            </Route>
                                        </Switch>
                                    </ErrorBoundary>
                                </>
                            )}
                        </div>
                    </PendingTxContext.Provider>
                </div>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
