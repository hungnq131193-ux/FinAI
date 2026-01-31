/**
 * Price Service - Real-time market data
 * Lấy dữ liệu từ nhiều nguồn miễn phí
 * 
 * LƯU Ý: Lấy giá KHÔNG dùng AI token!
 * Trên Vercel: Dùng /api/stocks proxy để tránh CORS
 */

export class PriceService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
        this.allVNStocks = []; // Store all available VN stocks

        // Detect if running on Vercel (production)
        this.isProduction = window.location.hostname.includes('vercel.app') ||
            !window.location.hostname.includes('localhost');
        this.stocksProxyUrl = '/api/stocks'; // Vercel serverless function
        this.cryptoProxyUrl = '/api/crypto'; // Crypto/Gold prices from CoinGecko
    }

    /**
     * Get real-time crypto prices from CoinGecko via proxy
     */
    async getCryptoPrices() {
        const cacheKey = 'crypto_prices';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        if (this.isProduction) {
            try {
                console.log('📡 Fetching crypto prices via CoinGecko proxy...');
                const response = await fetch(`${this.cryptoProxyUrl}?type=all`, {
                    signal: AbortSignal.timeout(15000)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.assets && Array.isArray(data.assets)) {
                        console.log(`✅ Got ${data.assets.length} crypto/gold prices from CoinGecko`);
                        this.setCache(cacheKey, data.assets, 60000); // Cache 1 min
                        return data.assets;
                    }
                }
            } catch (e) {
                console.error('CoinGecko proxy error:', e.message);
            }
        }

        // Fallback to hardcoded prices
        return this.getDefaultCryptoAssets();
    }
    /**
     * Get real-time metal prices (Gold, Silver) from API via proxy
     */
    async getMetalPrices() {
        const cacheKey = 'metal_prices';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        if (this.isProduction) {
            try {
                console.log('📡 Fetching metal prices via GoldPrice.org proxy...');
                const response = await fetch(`${this.cryptoProxyUrl}?type=metals`, {
                    signal: AbortSignal.timeout(15000)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.assets && Array.isArray(data.assets)) {
                        console.log(`✅ Got ${data.assets.length} metal prices:`, data.assets.map(a => `${a.symbol}=$${a.price}`));
                        this.setCache(cacheKey, data.assets, 30000); // Cache 30 sec for realtime
                        return data.assets;
                    }
                }
            } catch (e) {
                console.error('Metal prices proxy error:', e.message);
            }
        }

        // Fallback with current approximate values (Jan 2026)
        return [
            { symbol: 'XAU/USD', name: 'Vàng (Spot Gold)', icon: '🥇', type: 'metal', price: 4900, change: -2.0, source: 'Fallback' },
            { symbol: 'XAG/USD', name: 'Bạc (Spot Silver)', icon: '🥈', type: 'metal', price: 80, change: -1.5, source: 'Fallback' }
        ];
    }

    /**
     * Get ALL Vietnam stock symbols from SSI/HOSE
     */
    async getAllVNStockSymbols() {
        const cacheKey = 'all_vn_symbols';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        // Use proxy in production to avoid CORS
        if (this.isProduction) {
            try {
                console.log('📡 Fetching VN stocks via CafeF proxy...');
                const response = await fetch(`${this.stocksProxyUrl}?source=cafef`, {
                    signal: AbortSignal.timeout(15000)
                });

                if (response.ok) {
                    const data = await response.json();
                    // CafeF returns { stocks: [...], count, source, timestamp }
                    if (data.stocks && Array.isArray(data.stocks)) {
                        const stocks = data.stocks.map(s => ({
                            symbol: s.symbol,
                            name: this.getVNStockName(s.symbol),
                            exchange: 'HOSE',
                            price: s.price, // Already in thousands VND
                            change: s.changePercent || 0,
                            priceChange: s.change || 0,
                            volume: s.volume || 0,
                            refPrice: s.refPrice,
                            high: s.high,
                            low: s.low,
                            time: s.time,
                            isRealtime: s.isRealtime,
                            source: 'CafeF'
                        })).filter(s => s.symbol && s.price > 0);

                        this.setCache(cacheKey, stocks, 60000); // Cache 1 min for realtime
                        this.allVNStocks = stocks;
                        console.log(`✅ Loaded ${stocks.length} VN stocks from CafeF`);
                        return stocks;
                    }
                }
            } catch (e) {
                console.error('CafeF proxy error:', e.message);
            }

            // Fallback: use hardcoded list in production
            console.log('⚠️ Using hardcoded VN stock list');
            return this.getPopularVNStocks();
        }

        // Development: Direct API calls
        try {
            const response = await fetch(
                'https://iboard-api.ssi.com.vn/statistics/getliststockdata?market=',
                {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(15000)
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    const stocks = data.data.map(s => ({
                        symbol: s.stockSymbol || s.ss,
                        name: s.stockName || s.organ || s.ss,
                        exchange: s.exchange || s.mc,
                        price: (s.matchedPrice || s.mp || s.lastPrice || 0) / 1000,
                        change: s.priceChange || s.pc || 0,
                        changePercent: s.priceChangePercent || s.pcp || 0,
                        volume: s.totalMatchedVol || s.tmv || 0
                    })).filter(s => s.symbol && s.price > 0);

                    this.setCache(cacheKey, stocks, 300000);
                    this.allVNStocks = stocks;
                    console.log(`✅ Loaded ${stocks.length} VN stocks from SSI`);
                    return stocks;
                }
            }
        } catch (e) {
            console.error('SSI list error:', e.message);
        }

        console.log('⚠️ Using hardcoded VN stock list');
        return this.getPopularVNStocks();
    }

    /**
     * Search stocks by keyword
     */
    searchStocks(query, type = 'all') {
        const q = query.toUpperCase().trim();
        if (!q) return [];

        let results = [];

        // Search VN stocks
        if (type === 'all' || type === 'stock') {
            const stockResults = this.allVNStocks.filter(s =>
                s.symbol.includes(q) ||
                (s.name && s.name.toUpperCase().includes(q))
            ).slice(0, 20);
            results = results.concat(stockResults.map(s => ({ ...s, type: 'stock', icon: '📈' })));
        }

        // Search metals (Gold/Silver)
        if (type === 'all' || type === 'metal') {
            const metals = this.getAllMetals();
            const metalResults = metals.filter(m =>
                m.symbol.includes(q) ||
                m.name.toUpperCase().includes(q)
            );
            results = results.concat(metalResults);
        }

        return results.slice(0, 30);
    }

    /**
     * Get real-time price for a single stock (use when selecting from search)
     */
    async getRealtimePrice(symbol, type = 'stock') {
        if (type === 'stock' && this.isProduction) {
            try {
                console.log(`📡 Fetching realtime price for ${symbol}...`);
                const response = await fetch(
                    `${this.stocksProxyUrl}?source=quote&symbols=${symbol}`,
                    { signal: AbortSignal.timeout(10000) }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.price) {
                        // CafeF returns: price (nghìn), change (chênh lệch giá), changePercent
                        const changePercent = data.changePercent || 0;
                        console.log(`✅ ${symbol}: ${data.price}k (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%) [CafeF]`);
                        return {
                            symbol: symbol,
                            name: this.getVNStockName(symbol),
                            icon: '📈',
                            type: 'stock',
                            price: data.price,
                            change: changePercent, // Use percent change for consistency
                            priceChange: data.change, // Raw price change
                            high: data.high,
                            low: data.low,
                            open: data.open || data.refPrice,
                            volume: data.volume,
                            refPrice: data.refPrice,
                            isRealtime: true,
                            source: 'CafeF',
                            time: data.time,
                            timestamp: data.timestamp
                        };
                    }
                }
            } catch (e) {
                console.error(`Realtime price error for ${symbol}:`, e.message);
            }
        }

        // Fallback to getStockPrice
        return this.getStockPrice(symbol);
    }

    /**
     * Get top movers - stocks with biggest changes
     */
    getTopMovers(count = 10, direction = 'up') {
        if (this.allVNStocks.length === 0) return [];

        const sorted = [...this.allVNStocks].sort((a, b) => {
            if (direction === 'up') {
                return (b.changePercent || b.change) - (a.changePercent || a.change);
            }
            return (a.changePercent || a.change) - (b.changePercent || b.change);
        });

        return sorted.slice(0, count).map(s => ({ ...s, type: 'stock', icon: '📈' }));
    }

    /**
     * Get stock price by symbol (real-time from TCBS)
     */
    async getStockPrice(symbol) {
        // Use proxy in production
        if (this.isProduction) {
            try {
                const response = await fetch(
                    `${this.stocksProxyUrl}?source=tcbs&symbols=${symbol}`,
                    { signal: AbortSignal.timeout(10000) }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.data && data.data.length > 0) {
                        const latest = data.data[data.data.length - 1];
                        const prev = data.data.length > 1 ? data.data[0] : latest;
                        const change = prev.close > 0 ? ((latest.close - prev.close) / prev.close) * 100 : 0;

                        return {
                            symbol: symbol,
                            name: this.getVNStockName(symbol),
                            icon: '📈',
                            type: 'stock',
                            price: latest.close,
                            change: change,
                            high: latest.high,
                            low: latest.low,
                            open: latest.open,
                            volume: latest.volume,
                            isRealtime: true
                        };
                    }
                }
            } catch (e) {
                console.error(`Proxy TCBS ${symbol} error:`, e.message);
            }
        } else {
            // Development: direct API call
            try {
                const response = await fetch(
                    `https://apipubaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=${symbol}&type=stock&resolution=D&countBack=2`,
                    {
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout(8000)
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.data && data.data.length > 0) {
                        const latest = data.data[data.data.length - 1];
                        const prev = data.data.length > 1 ? data.data[0] : latest;
                        const change = prev.close > 0 ? ((latest.close - prev.close) / prev.close) * 100 : 0;

                        return {
                            symbol: symbol,
                            name: this.getVNStockName(symbol),
                            icon: '📈',
                            type: 'stock',
                            price: latest.close,
                            change: change,
                            high: latest.high,
                            low: latest.low,
                            open: latest.open,
                            volume: latest.volume,
                            isRealtime: true
                        };
                    }
                }
            } catch (e) {
                console.error(`TCBS ${symbol} error:`, e.message);
            }
        }

        // Fallback to cached data
        const cached = this.allVNStocks.find(s => s.symbol === symbol);
        if (cached) {
            return { ...cached, type: 'stock', icon: '📈', isRealtime: false };
        }

        return null;
    }

    /**
     * Get multiple stock prices - uses batch API for efficiency
     */
    async getMultipleStockPrices(symbols, onProgress = null) {
        // Try batch API first (production)
        if (this.isProduction) {
            try {
                console.log('📡 Fetching batch stock prices via proxy...');
                const symbolList = symbols.join(',');
                const response = await fetch(
                    `${this.stocksProxyUrl}?source=batch&symbols=${symbolList}`,
                    { signal: AbortSignal.timeout(30000) }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.stocks && data.stocks.length > 0) {
                        console.log(`✅ Batch loaded ${data.stocks.length} stocks (${data.source})`);
                        return data.stocks.map(s => ({
                            symbol: s.symbol,
                            name: this.getVNStockName(s.symbol),
                            icon: '📈',
                            type: 'stock',
                            price: s.price,
                            change: s.change,
                            high: s.high,
                            low: s.low,
                            open: s.open,
                            volume: s.volume,
                            isRealtime: true,
                            source: data.source
                        }));
                    }
                }
            } catch (e) {
                console.error('Batch API error:', e.message);
            }
        }

        // Fallback: Individual fetching
        const results = [];
        let completed = 0;

        for (const symbol of symbols) {
            const price = await this.getStockPrice(symbol);
            if (price) results.push(price);

            completed++;
            if (onProgress) onProgress(completed, symbols.length);

            // Small delay to avoid rate limiting
            if (completed < symbols.length) {
                await new Promise(r => setTimeout(r, 150));
            }
        }

        return results;
    }

    // NOTE: Crypto prices removed - app focuses on VN stocks and metals only

    // NOTE: getMetalPrices() is defined at the top of the class (lines 53-87)
    // It uses the /api/crypto?type=metals proxy for accurate XAU/USD and XAG/USD prices

    /**
     * Get all market data
     */
    async getAllPrices(includeStocks = true) {
        console.log('🔄 Đang lấy dữ liệu thị trường...');

        // Only fetch metals now (gold, silver) - crypto removed
        const metals = await this.getMetalPrices();

        let vnStocks = [];
        if (includeStocks) {
            // Get all stock list first
            await this.getAllVNStockSymbols();

            // Get top popular stocks with real-time prices
            const popularSymbols = ['VNM', 'FPT', 'VIC', 'VHM', 'VCB', 'TCB', 'HPG', 'MSN', 'BID', 'MBB', 'ACB', 'SSI'];
            vnStocks = await this.getMultipleStockPrices(popularSymbols);
        }

        return {
            metals,
            vnStocks,
            totalStocksAvailable: this.allVNStocks.length,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Helper methods
     */
    getAllCryptos() {
        return [
            { symbol: 'BTC', name: 'Bitcoin', icon: '₿', type: 'crypto' },
            { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', type: 'crypto' },
            { symbol: 'BNB', name: 'BNB', icon: '◈', type: 'crypto' },
            { symbol: 'XRP', name: 'Ripple', icon: '✕', type: 'crypto' },
            { symbol: 'SOL', name: 'Solana', icon: '◎', type: 'crypto' },
            { symbol: 'ADA', name: 'Cardano', icon: '₳', type: 'crypto' },
            { symbol: 'DOGE', name: 'Dogecoin', icon: '🐕', type: 'crypto' },
            { symbol: 'DOT', name: 'Polkadot', icon: '●', type: 'crypto' },
            { symbol: 'AVAX', name: 'Avalanche', icon: '🔺', type: 'crypto' },
            { symbol: 'LINK', name: 'Chainlink', icon: '⬡', type: 'crypto' },
            { symbol: 'MATIC', name: 'Polygon', icon: '⬟', type: 'crypto' },
            { symbol: 'TON', name: 'Toncoin', icon: '💎', type: 'crypto' }
        ];
    }

    getAllMetals() {
        // Return metals for search - symbols must match API response
        return [
            { symbol: 'XAU/USD', name: 'Vàng (Spot Gold)', icon: '🥇', type: 'metal' },
            { symbol: 'XAG/USD', name: 'Bạc (Spot Silver)', icon: '🥈', type: 'metal' }
        ];
    }

    getPopularVNStocks() {
        // Giá ước tính dựa trên dữ liệu thị trường (đơn vị: nghìn VND)
        // Lưu ý: Đây là giá tham khảo, không phải real-time
        const stocks = [
            { symbol: 'VNM', name: 'Vinamilk', price: 68.5, change: -0.7 },
            { symbol: 'FPT', name: 'FPT Corp', price: 148.2, change: 1.5 },
            { symbol: 'VIC', name: 'Vingroup', price: 41.3, change: 0.5 },
            { symbol: 'VHM', name: 'Vinhomes', price: 38.9, change: -0.3 },
            { symbol: 'VCB', name: 'Vietcombank', price: 92.5, change: 0.8 },
            { symbol: 'BID', name: 'BIDV', price: 50.2, change: 0.4 },
            { symbol: 'CTG', name: 'VietinBank', price: 36.8, change: -0.5 },
            { symbol: 'TCB', name: 'Techcombank', price: 55.4, change: 1.2 },
            { symbol: 'MBB', name: 'MB Bank', price: 27.3, change: 0.7 },
            { symbol: 'VPB', name: 'VPBank', price: 19.8, change: -1.1 },
            { symbol: 'HPG', name: 'Hòa Phát', price: 26.5, change: 2.3 },
            { symbol: 'MSN', name: 'Masan', price: 72.1, change: 0.9 },
            { symbol: 'VRE', name: 'Vincom Retail', price: 21.5, change: -0.2 },
            { symbol: 'PLX', name: 'Petrolimex', price: 39.7, change: 0.3 },
            { symbol: 'GAS', name: 'PV Gas', price: 75.8, change: 1.8 },
            { symbol: 'SAB', name: 'Sabeco', price: 58.2, change: -0.8 },
            { symbol: 'ACB', name: 'ACB Bank', price: 26.1, change: 0.6 },
            { symbol: 'STB', name: 'Sacombank', price: 35.4, change: 1.4 },
            { symbol: 'SSI', name: 'SSI Securities', price: 38.7, change: 2.1 },
            { symbol: 'VJC', name: 'Vietjet Air', price: 98.5, change: 0.4 },
            { symbol: 'NVL', name: 'Novaland', price: 10.8, change: -2.5 },
            { symbol: 'VND', name: 'VNDirect', price: 17.2, change: 1.9 },
            { symbol: 'HDB', name: 'HDBank', price: 24.6, change: 0.5 },
            { symbol: 'POW', name: 'PV Power', price: 11.5, change: 0.8 },
            { symbol: 'REE', name: 'REE Corp', price: 52.3, change: -0.4 }
        ];

        this.allVNStocks = stocks.map(s => ({
            ...s,
            exchange: 'HOSE',
            isRealtime: false,
            note: 'Giá tham khảo - cập nhật lần cuối: 01/2026'
        }));
        return this.allVNStocks;
    }

    getVNStockName(symbol) {
        const stock = this.allVNStocks.find(s => s.symbol === symbol);
        if (stock?.name) return stock.name;

        const names = {
            VNM: 'Vinamilk', FPT: 'FPT Corp', VIC: 'Vingroup', VHM: 'Vinhomes',
            VCB: 'Vietcombank', BID: 'BIDV', CTG: 'VietinBank', TCB: 'Techcombank',
            MBB: 'MB Bank', VPB: 'VPBank', HPG: 'Hòa Phát', MSN: 'Masan',
            VRE: 'Vincom Retail', PLX: 'Petrolimex', GAS: 'PV Gas', SAB: 'Sabeco',
            ACB: 'ACB Bank', STB: 'Sacombank', SSI: 'SSI', VJC: 'Vietjet',
            NVL: 'Novaland', VND: 'VNDirect', HDB: 'HDBank', POW: 'PV Power'
        };
        return names[symbol] || symbol;
    }

    /**
     * Cache helpers
     */
    getFromCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        const timeout = item.customTimeout || this.cacheTimeout;
        if (Date.now() - item.timestamp > timeout) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }

    setCache(key, data, customTimeout = null) {
        this.cache.set(key, { data, timestamp: Date.now(), customTimeout });
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Fallback data
     */
    getFallbackCryptoPrices() {
        return [
            { symbol: 'BTC', name: 'Bitcoin', icon: '₿', type: 'crypto', price: 105000, change: 0 },
            { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', type: 'crypto', price: 3300, change: 0 },
            { symbol: 'BNB', name: 'BNB', icon: '◈', type: 'crypto', price: 650, change: 0 },
            { symbol: 'XRP', name: 'Ripple', icon: '✕', type: 'crypto', price: 3.1, change: 0 },
            { symbol: 'SOL', name: 'Solana', icon: '◎', type: 'crypto', price: 240, change: 0 },
            { symbol: 'ADA', name: 'Cardano', icon: '₳', type: 'crypto', price: 1.0, change: 0 }
        ];
    }

    getFallbackMetalPrices() {
        // Fallback with current approximate values (Jan 2026) - must match API format
        return [
            { id: 'xau', symbol: 'XAU/USD', name: 'Vàng (Spot Gold)', icon: '🥇', type: 'metal', price: 4900, change: 0, source: 'Fallback' },
            { id: 'xag', symbol: 'XAG/USD', name: 'Bạc (Spot Silver)', icon: '🥈', type: 'metal', price: 85, change: 0, source: 'Fallback' }
        ];
    }
}
