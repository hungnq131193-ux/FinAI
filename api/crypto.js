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

        // Gold/metals only
        if (type === 'metals' || type === 'gold') {
            console.log('[Crypto API] Fetching gold prices...');

            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold,tether-gold&vs_currencies=usd&include_24hr_change=true',
                { signal: AbortSignal.timeout(10000) }
            );

            if (!response.ok) {
                throw new Error(`CoinGecko returned ${response.status}`);
            }

            const data = await response.json();

            const metals = [];

            if (data['pax-gold']) {
                metals.push({
                    id: 'gold',
                    symbol: 'GOLD',
                    name: 'Vàng (XAU/USD)',
                    icon: '🥇',
                    type: 'metal',
                    price: data['pax-gold'].usd,
                    change: data['pax-gold'].usd_24h_change || 0,
                    source: 'CoinGecko/PAXGold',
                    isRealtime: true
                });
            }

            if (data['tether-gold']) {
                metals.push({
                    id: 'gold-xaut',
                    symbol: 'XAUT',
                    name: 'Tether Gold',
                    icon: '🥇',
                    type: 'metal',
                    price: data['tether-gold'].usd,
                    change: data['tether-gold'].usd_24h_change || 0,
                    source: 'CoinGecko/XAUT',
                    isRealtime: true
                });
            }

            return res.status(200).json({
                assets: metals,
                count: metals.length,
                source: 'CoinGecko',
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
