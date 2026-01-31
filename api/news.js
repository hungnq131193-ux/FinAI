// Vercel Serverless Function - Enhanced News Search API
// Lấy tin tức tài chính realtime từ nhiều nguồn cho AI phân tích

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

        // Fetch news from multiple sources in parallel
        const news = await fetchAllNewsSources(searchQuery, type);

        return res.status(200).json({
            query: searchQuery,
            articles: news,
            count: news.length,
            sources: ['Google News', 'VnExpress', 'Market Context'],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[News API] Error:', error.message);
        return res.status(500).json({
            error: 'Failed to fetch news',
            query: searchQuery,
            articles: getComprehensiveMarketContext(searchQuery, type)
        });
    }
}

async function fetchAllNewsSources(query, type) {
    const allArticles = [];

    // Run all fetches in parallel for speed
    const [googleNews, vnexpressNews, marketContext] = await Promise.allSettled([
        fetchGoogleNews(query, type),
        fetchVnExpressNews(query, type),
        Promise.resolve(getMarketIndicators(query, type))
    ]);

    // Collect successful results
    if (googleNews.status === 'fulfilled') allArticles.push(...googleNews.value);
    if (vnexpressNews.status === 'fulfilled') allArticles.push(...vnexpressNews.value);
    if (marketContext.status === 'fulfilled') allArticles.push(...marketContext.value);

    // If no external news, add comprehensive context
    if (allArticles.length === 0) {
        return getComprehensiveMarketContext(query, type);
    }

    return allArticles.slice(0, 8); // Return top 8 articles
}

async function fetchGoogleNews(query, type) {
    const searchTerms = type === 'stock'
        ? `${query} cổ phiếu VNINDEX`
        : type === 'metal'
            ? `${query} giá vàng gold price`
            : query;

    const encodedQuery = encodeURIComponent(searchTerms);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=vi&gl=VN&ceid=VN:vi`;

    const response = await fetch(url, {
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) throw new Error('Google News error');

    const xml = await response.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    return items.slice(0, 4).map(item => {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

        return {
            title: decodeHTMLEntities(title),
            date: pubDate,
            source: 'Google News',
            importance: 'high'
        };
    });
}

async function fetchVnExpressNews(query, type) {
    try {
        const searchTerms = type === 'stock' ? `${query} chứng khoán` : `${query} thị trường`;
        const url = `https://vnexpress.net/rss/kinh-doanh.rss`;

        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) return [];

        const xml = await response.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

        // Filter items that mention the query
        return items
            .filter(item => item.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 2)
            .map(item => {
                const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
                const description = item.match(/<description>(.*?)<\/description>/)?.[1] || '';

                return {
                    title: decodeHTMLEntities(title),
                    summary: decodeHTMLEntities(description).substring(0, 150),
                    source: 'VnExpress',
                    importance: 'medium'
                };
            });
    } catch (e) {
        console.log('[VnExpress] Failed:', e.message);
        return [];
    }
}

function getMarketIndicators(query, type) {
    const today = new Date().toLocaleDateString('vi-VN');

    if (type === 'stock') {
        return [
            {
                title: `📊 Phân tích kỹ thuật ${query}`,
                summary: `RSI, MACD, EMA20/50/200 - Xu hướng và điểm vào/ra dựa trên biến động giá`,
                date: today,
                source: 'Technical Analysis',
                importance: 'critical'
            }
        ];
    }

    if (type === 'metal' || type === 'gold') {
        return [
            {
                title: '📈 Chỉ báo vĩ mô ảnh hưởng giá vàng/bạc',
                summary: 'Fed Funds Rate, CPI lạm phát, DXY Index, US 10Y Yield - Các yếu tố quyết định xu hướng',
                date: today,
                source: 'Macro Analysis',
                importance: 'critical'
            }
        ];
    }

    return [];
}

function getComprehensiveMarketContext(query, type) {
    const today = new Date().toLocaleDateString('vi-VN');
    const hour = new Date().getHours();
    const marketOpen = hour >= 9 && hour < 15;

    if (type === 'stock') {
        return [
            {
                title: `📊 Phân tích tổng hợp ${query}`,
                summary: `Kết hợp phân tích kỹ thuật (RSI, MACD, Bollinger Bands) và cơ bản (P/E, ROE, tăng trưởng doanh thu). Xem xét xu hướng ngành và vị thế cạnh tranh.`,
                date: today,
                source: 'Comprehensive Analysis',
                importance: 'critical'
            },
            {
                title: `📈 Xu hướng thị trường VN-Index`,
                summary: marketOpen
                    ? 'Thị trường đang trong phiên giao dịch. Theo dõi volume, thanh khoản, và nhóm bluechip dẫn dắt.'
                    : 'Ngoài giờ giao dịch. Cần đánh giá xu hướng từ phiên trước và tin tức overnight.',
                date: today,
                source: 'Market Context',
                importance: 'high'
            },
            {
                title: '🌍 Yếu tố vĩ mô ảnh hưởng TTCK Việt Nam',
                summary: 'Tỷ giá USD/VND, lãi suất NHNN, dòng vốn ngoại, chính sách Fed và triển vọng kinh tế toàn cầu.',
                date: today,
                source: 'Macro Context',
                importance: 'medium'
            }
        ];
    }

    if (type === 'metal' || type === 'gold') {
        return [
            {
                title: '🥇 Phân tích giá vàng/bạc thế giới',
                summary: 'Giá XAU/USD và XAG/USD phụ thuộc: (1) Chính sách Fed - lãi suất, (2) Lạm phát CPI Mỹ, (3) Chỉ số DXY (USD), (4) Căng thẳng địa chính trị.',
                date: today,
                source: 'Gold Analysis',
                importance: 'critical'
            },
            {
                title: '📊 Chỉ báo kỹ thuật kim loại quý',
                summary: 'Các mức Fibonacci quan trọng, vùng hỗ trợ/kháng cự major, RSI overbought/oversold, và pattern chart dài hạn.',
                date: today,
                source: 'Technical',
                importance: 'high'
            },
            {
                title: '🏦 Yếu tố cung-cầu vật chất',
                summary: 'Nhu cầu từ NHTW (đặc biệt Trung Quốc, Ấn Độ), sản lượng khai thác, và xu hướng tích trữ tài sản an toàn.',
                date: today,
                source: 'Fundamental',
                importance: 'medium'
            }
        ];
    }

    return [
        {
            title: `💼 Phân tích thị trường: ${query}`,
            summary: 'Kết hợp phân tích kỹ thuật, tin tức và yếu tố vĩ mô để đưa ra khuyến nghị đầu tư.',
            date: today,
            source: 'FinAI Analysis',
            importance: 'high'
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
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        .replace(/<[^>]*>/g, ''); // Remove HTML tags
}

