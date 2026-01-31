// Vercel Serverless Function - News Search API
// Lấy tin tức tài chính realtime cho AI phân tích

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { query, symbol, type } = req.query;

    if (!query && !symbol) {
        return res.status(400).json({ error: 'Query or symbol required' });
    }

    const searchQuery = query || symbol;

    try {
        console.log(`[News API] Searching news for: ${searchQuery}`);

        // Try multiple free news sources
        const news = await fetchFinancialNews(searchQuery, type);

        return res.status(200).json({
            query: searchQuery,
            articles: news,
            count: news.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[News API] Error:', error.message);
        return res.status(500).json({
            error: 'Failed to fetch news',
            query: searchQuery,
            articles: getDefaultNews(searchQuery, type)
        });
    }
}

async function fetchFinancialNews(query, type) {
    const articles = [];

    // Source 1: CafeF (Vietnam stocks)
    if (type === 'stock') {
        try {
            const cafefNews = await fetchCafeFNews(query);
            articles.push(...cafefNews);
        } catch (e) {
            console.log('[News] CafeF failed:', e.message);
        }
    }

    // Source 2: Google News RSS (general)
    try {
        const googleNews = await fetchGoogleNews(query);
        articles.push(...googleNews);
    } catch (e) {
        console.log('[News] Google News failed:', e.message);
    }

    // If no news found, return context-based insights
    if (articles.length === 0) {
        return getDefaultNews(query, type);
    }

    return articles.slice(0, 5); // Return top 5 articles
}

async function fetchGoogleNews(query) {
    const encodedQuery = encodeURIComponent(`${query} stock investment`);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=vi&gl=VN&ceid=VN:vi`;

    const response = await fetch(url, {
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) throw new Error('Google News error');

    const xml = await response.text();

    // Parse RSS XML
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    return items.slice(0, 3).map(item => {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

        return {
            title: decodeHTMLEntities(title),
            url: link,
            date: pubDate,
            source: 'Google News'
        };
    });
}

async function fetchCafeFNews(symbol) {
    const url = `https://cafef.vn/du-lieu/trang-tim-kiem.chn?keyword=${symbol}`;

    // Note: This would need proper HTML parsing, simplified version
    const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FinAI/1.0)'
        }
    });

    if (!response.ok) throw new Error('CafeF error');

    // For now, return placeholder - real implementation would parse HTML
    return [];
}

function getDefaultNews(query, type) {
    const today = new Date().toLocaleDateString('vi-VN');

    if (type === 'stock') {
        return [
            {
                title: `Phân tích kỹ thuật ${query} - Nhận định xu hướng ngắn hạn`,
                summary: `Cổ phiếu ${query} đang trong vùng tích lũy, cần theo dõi volume xác nhận.`,
                date: today,
                source: 'AI Analysis'
            },
            {
                title: `Báo cáo KQKD quý gần nhất của ${query}`,
                summary: 'Cần kiểm tra lịch công bố KQKD và các chỉ số tài chính cơ bản.',
                date: today,
                source: 'AI Analysis'
            }
        ];
    }

    if (type === 'metal' || type === 'gold') {
        return [
            {
                title: 'Giá vàng thế giới biến động theo Fed và lạm phát',
                summary: 'Vàng chịu ảnh hưởng từ chính sách Fed, lạm phát Mỹ, và căng thẳng địa chính trị.',
                date: today,
                source: 'Market Context'
            },
            {
                title: 'Xu hướng USD/DXY ảnh hưởng giá kim loại quý',
                summary: 'USD mạnh thường tạo áp lực giảm lên giá vàng/bạc và ngược lại.',
                date: today,
                source: 'Market Context'
            }
        ];
    }

    return [
        {
            title: `Tin tức liên quan đến ${query}`,
            summary: 'Đang tìm kiếm tin tức và phân tích mới nhất từ các nguồn tài chính.',
            date: today,
            source: 'FinAI'
        }
    ];
}

function decodeHTMLEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
}
