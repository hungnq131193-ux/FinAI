/**
 * AI Service - TrollLLM API Integration (via Vercel Proxy)
 * Handles all AI-powered financial analysis
 * 
 * Sử dụng Vercel Serverless Function để tránh CORS/Mixed Content
 * 
 * LƯU Ý: CHỈ service này mới dùng API key
 * Lấy giá KHÔNG dùng token AI!
 */

export class AIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // Sử dụng Vercel proxy để tránh Mixed Content (HTTP->HTTPS)
        this.baseUrl = '/api/ai'; // Vercel serverless function
        this.model = 'claude-sonnet-4-5-20250929'; // Claude Sonnet 4.5 từ TrollLLM
    }

    /**
     * Analyze an asset and generate trading signals
     */
    async analyzeAsset(asset) {
        const { symbol, name, price, change, type, timeframe, timeframeLabel } = asset;

        console.log(`🤖 AI đang phân tích ${symbol}...`);

        const systemPrompt = `Bạn là chuyên gia phân tích tài chính hàng đầu với 20+ năm kinh nghiệm. 

Nhiệm vụ:
1. Phân tích kỹ thuật: RSI, MACD, Bollinger Bands, Support/Resistance
2. Đánh giá xu hướng và momentum
3. Đưa ra Entry, Stop Loss, và 3 mức Take Profit cụ thể
4. Giải thích rõ ràng bằng tiếng Việt

CHỈ trả về JSON hợp lệ, không có text khác.`;

        const userPrompt = `Phân tích chi tiết tài sản sau:

📊 Thông tin:
- Tài sản: ${name} (${symbol})
- Loại: ${this.getAssetTypeLabel(type)}
- Giá hiện tại: ${this.formatPriceForPrompt(price, type)}
- Thay đổi 24h: ${change >= 0 ? '+' : ''}${(change || 0).toFixed(2)}%
- Khung thời gian: ${timeframeLabel}

🎯 Trả về JSON:
{
  "action": "BUY" | "SELL" | "HOLD",
  "entry": <giá vào lệnh>,
  "stopLoss": <giá cắt lỗ>,
  "targets": [<TP1>, <TP2>, <TP3>],
  "riskReward": "1:X",
  "confidence": <1-5>,
  "reasoning": {
    "technical": "<phân tích kỹ thuật>",
    "news": "<tin tức ảnh hưởng>",
    "summary": "<tóm tắt lý do>"
  }
}`;

        try {
            const response = await this.callAPI(systemPrompt, userPrompt);
            console.log('✅ AI response received');
            return this.parseAnalysisResponse(response, asset);
        } catch (error) {
            console.error('❌ API error:', error.message);
            console.log('⚠️ Using fallback analysis');
            return this.generateFallbackAnalysis(asset);
        }
    }

    /**
     * Call the TrollLLM API via Vercel Proxy
     */
    async callAPI(systemPrompt, userPrompt) {
        console.log('📡 Calling API via Vercel Proxy:', this.baseUrl);
        console.log('📤 Model:', this.model);

        const requestBody = {
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        };

        console.log('📤 Request:', JSON.stringify(requestBody).substring(0, 200) + '...');

        // Gọi qua Vercel proxy (không cần /chat/completions vì proxy xử lý)
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60000) // 60s timeout
        });

        console.log('📥 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        console.log('📥 AI Content:', content.substring(0, 150) + '...');
        return content;
    }

    /**
     * Parse the AI response into structured data
     */
    parseAnalysisResponse(response, asset) {
        console.log('📝 Parsing AI response...');

        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('✅ Parsed:', parsed.action, 'confidence:', parsed.confidence);

                return {
                    action: parsed.action || 'HOLD',
                    entry: parsed.entry || asset.price,
                    stopLoss: parsed.stopLoss || asset.price * 0.95,
                    targets: parsed.targets || [
                        asset.price * 1.05,
                        asset.price * 1.10,
                        asset.price * 1.15
                    ],
                    riskReward: parsed.riskReward || '1:2',
                    confidence: Math.min(5, Math.max(1, parsed.confidence || 3)),
                    reasoning: parsed.reasoning || {}
                };
            } else {
                console.warn('⚠️ No JSON found in response');
            }
        } catch (e) {
            console.error('❌ Parse error:', e.message);
        }

        return this.generateFallbackAnalysis(asset);
    }

    /**
     * Generate fallback analysis when API fails
     */
    generateFallbackAnalysis(asset) {
        const { price, change, type } = asset;

        console.log('🔄 Generating fallback analysis...');

        let action = 'HOLD';
        let confidence = 2;
        let technicalReason = '';

        const changeVal = change || 0;

        if (changeVal < -5) {
            action = 'BUY';
            confidence = 3;
            technicalReason = `Giảm mạnh ${Math.abs(changeVal).toFixed(1)}% - RSI có thể oversold. Xem xét tích lũy.`;
        } else if (changeVal < -2) {
            action = 'BUY';
            confidence = 2;
            technicalReason = `Điều chỉnh ${Math.abs(changeVal).toFixed(1)}%. Cơ hội mua nếu xu hướng dài hạn tốt.`;
        } else if (changeVal > 8) {
            action = 'SELL';
            confidence = 3;
            technicalReason = `Tăng mạnh ${changeVal.toFixed(1)}% - Có thể overbought. Xem xét chốt lời.`;
        } else if (changeVal > 3) {
            action = 'HOLD';
            confidence = 3;
            technicalReason = `Xu hướng tăng (+${changeVal.toFixed(1)}%). Giữ và theo dõi kháng cự.`;
        } else {
            technicalReason = `Sideway (${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(1)}%). Chờ tín hiệu rõ ràng.`;
        }

        const multiplier = type === 'stock' ? 0.03 : 0.05;

        return {
            action,
            entry: price,
            stopLoss: price * (1 - multiplier * 1.5),
            targets: [
                price * (1 + multiplier),
                price * (1 + multiplier * 2),
                price * (1 + multiplier * 3)
            ],
            riskReward: '1:2',
            confidence,
            reasoning: {
                technical: technicalReason,
                news: '⚠️ Cần API key để lấy phân tích AI đầy đủ.',
                summary: `Phân tích offline: ${action === 'BUY' ? 'Tín hiệu mua' :
                    action === 'SELL' ? 'Xem xét chốt lời' : 'Theo dõi thêm'}.`
            }
        };
    }

    /**
     * Get Vietnamese label for asset type
     */
    getAssetTypeLabel(type) {
        const labels = {
            crypto: 'Tiền điện tử',
            gold: 'Vàng',
            silver: 'Bạc',
            stock: 'Cổ phiếu Việt Nam'
        };
        return labels[type] || 'Tài sản';
    }

    /**
     * Format price for prompt
     */
    formatPriceForPrompt(price, type) {
        if (!price) return 'N/A';

        if (type === 'stock') {
            return `${(price * 1000).toLocaleString('vi-VN')} VND`;
        }
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Test API connection
     */
    async testConnection() {
        console.log('🧪 Testing API connection...');
        try {
            const response = await this.callAPI(
                'Trả lời ngắn gọn bằng tiếng Việt.',
                'Nói "Xin chào" nếu bạn hoạt động bình thường.'
            );
            const success = response.length > 0;
            console.log(success ? '✅ API connected!' : '❌ API not responding');
            return success;
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
    }
}
