// Vercel Serverless Function - Stock Price Proxy
// Giải quyết CORS cho các API cổ phiếu VN

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { source, symbols } = req.query;

    console.log('[Stock Proxy] Source:', source, 'Symbols:', symbols);

    try {
        let data = null;

        switch (source) {
            case 'tcbs':
                // TCBS API for individual stock
                const symbol = symbols || 'VNM';
                console.log('[Stock Proxy] Fetching TCBS for:', symbol);
                const tcbsRes = await fetch(
                    `https://apipubaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=${symbol}&type=stock&resolution=D&countBack=2`,
                    { headers: { 'Accept': 'application/json' } }
                );
                data = await tcbsRes.json();
                break;

            case 'ssi':
                // SSI API for all stocks
                console.log('[Stock Proxy] Fetching SSI list...');
                const ssiRes = await fetch(
                    'https://iboard-api.ssi.com.vn/statistics/getliststockdata?market=',
                    { headers: { 'Accept': 'application/json' } }
                );
                data = await ssiRes.json();
                break;

            case 'tcbs-list':
                // Fetch multiple stocks from TCBS
                const stockList = (symbols || 'VNM,FPT,VIC').split(',');
                const results = [];

                for (const sym of stockList.slice(0, 20)) {
                    try {
                        const r = await fetch(
                            `https://apipubaws.tcbs.com.vn/stock-insight/v2/stock/bars-long-term?ticker=${sym}&type=stock&resolution=D&countBack=2`,
                            { headers: { 'Accept': 'application/json' } }
                        );
                        if (r.ok) {
                            const d = await r.json();
                            if (d.data && d.data.length > 0) {
                                const latest = d.data[d.data.length - 1];
                                const prev = d.data.length > 1 ? d.data[0] : latest;
                                results.push({
                                    symbol: sym,
                                    price: latest.close,
                                    open: latest.open,
                                    high: latest.high,
                                    low: latest.low,
                                    volume: latest.volume,
                                    change: prev.close > 0 ? ((latest.close - prev.close) / prev.close) * 100 : 0
                                });
                            }
                        }
                    } catch (e) {
                        console.error(`[Stock Proxy] Error fetching ${sym}:`, e.message);
                    }
                    // Small delay
                    await new Promise(r => setTimeout(r, 100));
                }
                data = { stocks: results };
                break;

            default:
                return res.status(400).json({ error: 'Invalid source. Use: tcbs, ssi, or tcbs-list' });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('[Stock Proxy] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
