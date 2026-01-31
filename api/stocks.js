// Vercel Serverless Function - Stock Price Scraper
// Lấy giá cổ phiếu VN từ nhiều nguồn khác nhau

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { source, symbols } = req.query;
    console.log('[Stock Proxy] Source:', source, 'Symbols:', symbols);

    try {
        let data = null;

        switch (source) {
            case 'tcbs': {
                // TCBS API - Real-time for individual stock
                const symbol = symbols || 'VNM';
                console.log('[Stock Proxy] Fetching TCBS for:', symbol);

                const tcbsRes = await fetch(
                    `https://apipubaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=${symbol}&type=stock&resolution=D&countBack=5`,
                    {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                );

                if (tcbsRes.ok) {
                    data = await tcbsRes.json();
                } else {
                    console.log('[Stock Proxy] TCBS failed, status:', tcbsRes.status);
                    data = { error: 'TCBS unavailable', status: tcbsRes.status };
                }
                break;
            }

            case 'ssi': {
                // SSI API - All stocks list
                console.log('[Stock Proxy] Fetching SSI list...');

                const ssiRes = await fetch(
                    'https://iboard-api.ssi.com.vn/statistics/getliststockdata?market=',
                    {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                );

                if (ssiRes.ok) {
                    data = await ssiRes.json();
                } else {
                    console.log('[Stock Proxy] SSI failed, status:', ssiRes.status);
                    data = { error: 'SSI unavailable', status: ssiRes.status };
                }
                break;
            }

            case 'wichart': {
                // WiChart API - Alternative source
                console.log('[Stock Proxy] Fetching WiChart...');
                const symbol = symbols || 'VNM';

                const wichartRes = await fetch(
                    `https://wichart.vn/api/thong-ke-giao-dich/snap-shot?symbol=${symbol}`,
                    {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0'
                        }
                    }
                );

                if (wichartRes.ok) {
                    data = await wichartRes.json();
                } else {
                    data = { error: 'WiChart unavailable', status: wichartRes.status };
                }
                break;
            }

            case 'batch': {
                // Batch fetch multiple stocks from TCBS
                const stockList = (symbols || 'VNM,FPT,VIC,VCB,TCB').split(',');
                const results = [];

                for (const sym of stockList.slice(0, 15)) { // Limit to 15 stocks
                    try {
                        const r = await fetch(
                            `https://apipubaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=${sym.trim()}&type=stock&resolution=D&countBack=3`,
                            {
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            }
                        );

                        if (r.ok) {
                            const d = await r.json();
                            if (d.data && d.data.length > 0) {
                                const latest = d.data[d.data.length - 1];
                                const prev = d.data.length > 1 ? d.data[d.data.length - 2] : latest;
                                const change = prev.close > 0
                                    ? ((latest.close - prev.close) / prev.close) * 100
                                    : 0;

                                results.push({
                                    symbol: sym.trim(),
                                    price: latest.close,
                                    open: latest.open,
                                    high: latest.high,
                                    low: latest.low,
                                    volume: latest.volume,
                                    change: parseFloat(change.toFixed(2)),
                                    time: latest.tradingDate || new Date().toISOString()
                                });
                            }
                        }
                    } catch (e) {
                        console.error(`[Stock Proxy] Error fetching ${sym}:`, e.message);
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 150));
                }

                data = {
                    stocks: results,
                    count: results.length,
                    source: 'TCBS',
                    timestamp: new Date().toISOString()
                };
                break;
            }

            case 'quote': {
                // Quick quote for a single stock with more details
                const symbol = (symbols || 'VNM').toUpperCase().trim();
                console.log('[Stock Proxy] Quick quote for:', symbol);

                // Try TCBS first
                try {
                    const tcbsRes = await fetch(
                        `https://apipubaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=${symbol}&type=stock&resolution=D&countBack=10`,
                        {
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        }
                    );

                    if (tcbsRes.ok) {
                        const tcbsData = await tcbsRes.json();
                        if (tcbsData.data && tcbsData.data.length > 0) {
                            const bars = tcbsData.data;
                            const latest = bars[bars.length - 1];
                            const prev = bars.length > 1 ? bars[bars.length - 2] : latest;
                            const week = bars.length > 5 ? bars[bars.length - 6] : bars[0];

                            const dayChange = prev.close > 0
                                ? ((latest.close - prev.close) / prev.close) * 100
                                : 0;
                            const weekChange = week.close > 0
                                ? ((latest.close - week.close) / week.close) * 100
                                : 0;

                            data = {
                                symbol: symbol,
                                price: latest.close,
                                open: latest.open,
                                high: latest.high,
                                low: latest.low,
                                volume: latest.volume,
                                prevClose: prev.close,
                                change: parseFloat(dayChange.toFixed(2)),
                                changeWeek: parseFloat(weekChange.toFixed(2)),
                                high52w: Math.max(...bars.map(b => b.high)),
                                low52w: Math.min(...bars.map(b => b.low)),
                                source: 'TCBS',
                                isRealtime: true,
                                timestamp: new Date().toISOString()
                            };
                        }
                    }
                } catch (e) {
                    console.error('[Stock Proxy] TCBS quote error:', e.message);
                }

                if (!data) {
                    data = { error: 'Quote unavailable for ' + symbol };
                }
                break;
            }

            default:
                return res.status(400).json({
                    error: 'Invalid source. Use: tcbs, ssi, batch, quote, or wichart',
                    available: ['tcbs', 'ssi', 'batch', 'quote', 'wichart']
                });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('[Stock Proxy] Error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
