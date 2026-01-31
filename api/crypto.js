// Vercel Serverless Function - Crypto/Gold Price API
// Lấy giá crypto và vàng REAL-TIME từ CoinGecko

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=60'); // Cache 60 seconds

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { type } = req.query;
    console.log('[Crypto API] Type:', type);

    try {
        // Crypto prices from CoinGecko
        if (!type || type === 'crypto' || type === 'all') {
            console.log('[Crypto API] Fetching CoinGecko data...');

            const cryptoIds = [
                'bitcoin', 'ethereum', 'tether', 'binancecoin', 'ripple',
                'solana', 'dogecoin', 'cardano', 'polkadot', 'shiba-inu',
                'avalanche-2', 'chainlink', 'litecoin', 'uniswap', 'cosmos',
                'stellar', 'monero', 'tron', 'near', 'aptos'
            ].join(',');

            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'FinAI/1.0'
                    },
                    signal: AbortSignal.timeout(15000)
                }
            );

            if (!response.ok) {
                throw new Error(`CoinGecko returned ${response.status}`);
            }

            const data = await response.json();

            // Map to friendly format
            const cryptoNames = {
                'bitcoin': { symbol: 'BTC', name: 'Bitcoin', icon: '₿' },
                'ethereum': { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ' },
                'tether': { symbol: 'USDT', name: 'Tether', icon: '₮' },
                'binancecoin': { symbol: 'BNB', name: 'Binance Coin', icon: '🔶' },
                'ripple': { symbol: 'XRP', name: 'Ripple', icon: '✕' },
                'solana': { symbol: 'SOL', name: 'Solana', icon: '◎' },
                'dogecoin': { symbol: 'DOGE', name: 'Dogecoin', icon: '🐕' },
                'cardano': { symbol: 'ADA', name: 'Cardano', icon: '₳' },
                'polkadot': { symbol: 'DOT', name: 'Polkadot', icon: '●' },
                'shiba-inu': { symbol: 'SHIB', name: 'Shiba Inu', icon: '🐕' },
                'avalanche-2': { symbol: 'AVAX', name: 'Avalanche', icon: '🔺' },
                'chainlink': { symbol: 'LINK', name: 'Chainlink', icon: '⬡' },
                'litecoin': { symbol: 'LTC', name: 'Litecoin', icon: 'Ł' },
                'uniswap': { symbol: 'UNI', name: 'Uniswap', icon: '🦄' },
                'cosmos': { symbol: 'ATOM', name: 'Cosmos', icon: '⚛' },
                'stellar': { symbol: 'XLM', name: 'Stellar', icon: '★' },
                'monero': { symbol: 'XMR', name: 'Monero', icon: 'ɱ' },
                'tron': { symbol: 'TRX', name: 'TRON', icon: '⟁' },
                'near': { symbol: 'NEAR', name: 'NEAR Protocol', icon: 'Ⓝ' },
                'aptos': { symbol: 'APT', name: 'Aptos', icon: '◈' }
            };

            const cryptos = Object.entries(data).map(([id, info]) => {
                const meta = cryptoNames[id] || { symbol: id.toUpperCase(), name: id, icon: '🪙' };
                return {
                    id: id,
                    symbol: meta.symbol,
                    name: meta.name,
                    icon: meta.icon,
                    type: 'crypto',
                    price: info.usd,
                    change: info.usd_24h_change || 0,
                    volume: info.usd_24h_vol || 0,
                    marketCap: info.usd_market_cap || 0,
                    source: 'CoinGecko',
                    isRealtime: true
                };
            });

            // If requesting gold too
            if (type === 'all') {
                // Get gold price from metals API (PAX Gold, Tether Gold, Silver tokens)
                try {
                    const goldResponse = await fetch(
                        'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold,tether-gold,silver-token&vs_currencies=usd&include_24hr_change=true',
                        { signal: AbortSignal.timeout(10000) }
                    );

                    if (goldResponse.ok) {
                        const goldData = await goldResponse.json();

                        // PAX Gold is a good proxy for physical gold price
                        if (goldData['pax-gold']) {
                            cryptos.push({
                                id: 'gold',
                                symbol: 'GOLD',
                                name: 'Vàng (XAU/USD)',
                                icon: '🥇',
                                type: 'metal',
                                price: goldData['pax-gold'].usd,
                                change: goldData['pax-gold'].usd_24h_change || 0,
                                source: 'CoinGecko/PAXGold',
                                isRealtime: true
                            });
                        }

                        // Tether Gold
                        if (goldData['tether-gold']) {
                            cryptos.push({
                                id: 'xaut',
                                symbol: 'XAUT',
                                name: 'Tether Gold',
                                icon: '🥇',
                                type: 'metal',
                                price: goldData['tether-gold'].usd,
                                change: goldData['tether-gold'].usd_24h_change || 0,
                                source: 'CoinGecko/XAUT',
                                isRealtime: true
                            });
                        }
                    }
                } catch (e) {
                    console.log('[Crypto API] Gold fetch failed:', e.message);
                }
            }

            return res.status(200).json({
                assets: cryptos,
                count: cryptos.length,
                source: 'CoinGecko',
                timestamp: new Date().toISOString()
            });
        }

        // Gold/metals only - Get REAL XAU/USD and XAG/USD prices
        if (type === 'metals' || type === 'gold') {
            console.log('[Metals API] Fetching real XAU/USD and XAG/USD prices...');

            const metals = [];

            try {
                // Try Gold-API.io free endpoint first (more accurate than crypto tokens)
                // Fallback: Use Frankfurter API for forex rates to calculate from USD

                // Method 1: Use free metals API proxy through goldpricez
                const goldPriceResponse = await fetch(
                    'https://data-asg.goldprice.org/dbXRates/USD',
                    {
                        signal: AbortSignal.timeout(10000),
                        headers: { 'Accept': 'application/json' }
                    }
                );

                if (goldPriceResponse.ok) {
                    const data = await goldPriceResponse.json();
                    console.log('[Metals API] GoldPrice.org response:', data);

                    // Data format: { items: [{ xauPrice, xagPrice, chgXau, chgXag, ... }] }
                    if (data.items && data.items[0]) {
                        const item = data.items[0];

                        if (item.xauPrice) {
                            metals.push({
                                id: 'xau',
                                symbol: 'XAU/USD',
                                name: 'Vàng (Spot Gold)',
                                icon: '🥇',
                                type: 'metal',
                                price: parseFloat(item.xauPrice),
                                change: parseFloat(item.pcXau) || 0, // Percent change
                                priceChange: parseFloat(item.chgXau) || 0,
                                source: 'GoldPrice.org',
                                isRealtime: true
                            });
                        }

                        if (item.xagPrice) {
                            metals.push({
                                id: 'xag',
                                symbol: 'XAG/USD',
                                name: 'Bạc (Spot Silver)',
                                icon: '🥈',
                                type: 'metal',
                                price: parseFloat(item.xagPrice),
                                change: parseFloat(item.pcXag) || 0, // Percent change
                                priceChange: parseFloat(item.chgXag) || 0,
                                source: 'GoldPrice.org',
                                isRealtime: true
                            });
                        }
                    }
                }

                // If no data from primary source, try backup
                if (metals.length === 0) {
                    console.log('[Metals API] Primary source failed, using PAX Gold as fallback...');

                    // Fallback to PAX Gold (tokenized gold, ~0.5% off real price)
                    const paxResponse = await fetch(
                        'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true',
                        { signal: AbortSignal.timeout(10000) }
                    );

                    if (paxResponse.ok) {
                        const paxData = await paxResponse.json();
                        if (paxData['pax-gold']) {
                            metals.push({
                                id: 'xau',
                                symbol: 'XAU/USD',
                                name: 'Vàng (ước tính từ PAXG)',
                                icon: '🥇',
                                type: 'metal',
                                price: paxData['pax-gold'].usd,
                                change: paxData['pax-gold'].usd_24h_change || 0,
                                source: 'CoinGecko/PAXGold',
                                isRealtime: true,
                                note: 'Giá ước tính, có thể chênh ±0.5%'
                            });
                        }
                    }

                    // Add silver estimate based on gold/silver ratio (~85:1 typically)
                    if (metals.length > 0) {
                        const goldPrice = metals[0].price;
                        const silverEstimate = goldPrice / 85; // Approximate ratio
                        metals.push({
                            id: 'xag',
                            symbol: 'XAG/USD',
                            name: 'Bạc (ước tính)',
                            icon: '🥈',
                            type: 'metal',
                            price: Math.round(silverEstimate * 100) / 100,
                            change: metals[0].change || 0,
                            source: 'Estimated',
                            isRealtime: false,
                            note: 'Ước tính từ tỷ lệ Au/Ag'
                        });
                    }
                }

            } catch (e) {
                console.error('[Metals API] Error fetching prices:', e.message);
            }

            // Final fallback with hardcoded approximate values
            if (metals.length === 0) {
                console.log('[Metals API] All sources failed, using hardcoded values');
                metals.push(
                    { id: 'xau', symbol: 'XAU/USD', name: 'Vàng (Spot)', icon: '🥇', type: 'metal', price: 2870, change: 0, source: 'Fallback' },
                    { id: 'xag', symbol: 'XAG/USD', name: 'Bạc (Spot)', icon: '🥈', type: 'metal', price: 33.5, change: 0, source: 'Fallback' }
                );
            }

            return res.status(200).json({
                assets: metals,
                count: metals.length,
                source: metals[0]?.source || 'Unknown',
                timestamp: new Date().toISOString()
            });
        }

        return res.status(400).json({
            error: 'Invalid type. Use: crypto, metals, gold, or all'
        });

    } catch (error) {
        console.error('[Crypto API] Error:', error.message);
        return res.status(500).json({
            error: error.message,
            fallback: 'Try again later'
        });
    }
}
