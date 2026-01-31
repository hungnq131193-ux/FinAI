// Vercel Serverless Function - AI Proxy
// Giải quyết Mixed Content (HTTP -> HTTPS) và ẩn API key

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { model, messages, temperature, max_tokens } = req.body;
        const apiKey = req.headers.authorization?.replace('Bearer ', '');

        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' });
        }

        console.log('[AI Proxy] Forwarding to TrollLLM...');

        // Forward to TrollLLM API (correct URL from docs)
        const response = await fetch('https://chat.trollllm.xyz/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5
                messages,
                temperature: temperature || 0.7,
                max_tokens: max_tokens || 2000
            })
        });

        const data = await response.json();
        console.log('[AI Proxy] Response status:', response.status);

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('[AI Proxy] Error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
