// Vercel Serverless Function - VN Stock Price API
// Lấy giá cổ phiếu VN REAL-TIME từ CafeF

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=30'); // Cache 30 seconds

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { source, symbols } = req.query;
    console.log('[Stock API] Source:', source, 'Symbols:', symbols);

    try {
        // Default: Get all HOSE stocks from CafeF (REAL-TIME!)
        // Also accept 'ssi' as alias for backward compatibility
        if (!source || source === 'cafef' || source === 'all' || source === 'ssi') {
            console.log('[Stock API] Fetching CafeF HOSE data...');

            const response = await fetch(
                'https://banggia.cafef.vn/stockhandler.ashx?center=1',
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    signal: AbortSignal.timeout(15000)
                }
            );

            if (!response.ok) {
                throw new Error(`CafeF returned ${response.status}`);
            }

            const data = await response.json();

            // Parse CafeF format
            // a: symbol, b: ref price, c: ceil, d: floor
            // l: last match price, k: change, n: total volume
            // v: high, w: low, Time: timestamp
            const stocks = data.map(s => ({
                symbol: s.a,
                price: s.l || s.b, // last match or ref price
                refPrice: s.b,
                ceil: s.c,
                floor: s.d,
                change: s.k || 0,  // change in price (thousands VND)
                changePercent: s.b > 0 ? ((s.k / s.b) * 100) : 0,
                high: s.v || s.l,
                low: s.w || s.l,
                volume: s.n || 0,
                time: s.Time,
                source: 'CafeF',
                isRealtime: true
            })).filter(s => s.price > 0);

            // If symbols requested, filter
            if (symbols) {
                const symbolList = symbols.toUpperCase().split(',').map(s => s.trim());
                const filtered = stocks.filter(s => symbolList.includes(s.symbol));

                return res.status(200).json({
                    stocks: filtered,
                    count: filtered.length,
                    total: stocks.length,
                    source: 'CafeF',
                    timestamp: new Date().toISOString()
                });
            }

            return res.status(200).json({
                stocks: stocks,
                count: stocks.length,
                source: 'CafeF',
                timestamp: new Date().toISOString()
            });
        }

        // Get single stock quote
        if (source === 'quote') {
            const symbol = (symbols || 'VNM').toUpperCase().trim();
            console.log('[Stock API] Quote for:', symbol);

            const response = await fetch(
                'https://banggia.cafef.vn/stockhandler.ashx?center=1',
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    signal: AbortSignal.timeout(10000)
                }
            );

            if (!response.ok) {
                throw new Error(`CafeF returned ${response.status}`);
            }

            const data = await response.json();
            const stock = data.find(s => s.a === symbol);

            if (!stock) {
                return res.status(404).json({ error: `Stock ${symbol} not found` });
            }

            return res.status(200).json({
                symbol: stock.a,
                price: stock.l || stock.b,
                refPrice: stock.b,
                ceil: stock.c,
                floor: stock.d,
                change: stock.k || 0,
                changePercent: stock.b > 0 ? ((stock.k / stock.b) * 100) : 0,
                high: stock.v || stock.l,
                low: stock.w || stock.l,
                open: stock.e || stock.b,
                volume: stock.n || 0,
                buyVol: stock.tb || 0,
                sellVol: stock.ts || 0,
                time: stock.Time,
                source: 'CafeF',
                isRealtime: true,
                timestamp: new Date().toISOString()
            });
        }

        // Batch fetch specific symbols
        if (source === 'batch') {
            const symbolList = (symbols || 'VNM,FPT,VIC,VCB,CTG,HPG,MBB,TCB,SSI,MSN,GAS,VHM')
                .toUpperCase().split(',').map(s => s.trim());

            console.log('[Stock API] Batch for:', symbolList.join(','));

            const response = await fetch(
                'https://banggia.cafef.vn/stockhandler.ashx?center=1',
                {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    signal: AbortSignal.timeout(15000)
                }
            );

            if (!response.ok) {
                throw new Error(`CafeF returned ${response.status}`);
            }

            const data = await response.json();
            const stocks = data
                .filter(s => symbolList.includes(s.a))
                .map(s => ({
                    symbol: s.a,
                    price: s.l || s.b,
                    refPrice: s.b,
                    change: s.k || 0,
                    changePercent: s.b > 0 ? ((s.k / s.b) * 100) : 0,
                    high: s.v || s.l,
                    low: s.w || s.l,
                    volume: s.n || 0,
                    time: s.Time,
                    source: 'CafeF',
                    isRealtime: true
                }));

            return res.status(200).json({
                stocks: stocks,
                count: stocks.length,
                requested: symbolList.length,
                source: 'CafeF',
                timestamp: new Date().toISOString()
            });
        }

        return res.status(400).json({
            error: 'Invalid source. Use: cafef, quote, batch, or all',
            available: ['cafef', 'quote', 'batch', 'all']
        });

    } catch (error) {
        console.error('[Stock API] Error:', error.message);
        return res.status(500).json({
            error: error.message,
            fallback: 'Try again later or check CafeF directly'
        });
    }
}
