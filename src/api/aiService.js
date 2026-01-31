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

        const systemPrompt = `Bạn là chuyên gia phân tích tài chính với 20+ năm kinh nghiệm trên thị trường Việt Nam và quốc tế.

QUAN TRỌNG:
- KHÔNG tìm kiếm internet, KHÔNG nói "đang tìm kiếm"
- Phân tích TRỰC TIẾP dựa trên dữ liệu được cung cấp
- Sử dụng kiến thức sẵn có về kỹ thuật phân tích
- Trả lời bằng tiếng Việt, rõ ràng và chuyên nghiệp

CHỈ trả về JSON hợp lệ, không có text giải thích bên ngoài.`;

        const userPrompt = `Phân tích kỹ thuật và đưa ra khuyến nghị giao dịch:

📊 THÔNG TIN TÀI SẢN:
- Mã: ${symbol}
- Tên: ${name}
- Loại: ${this.getAssetTypeLabel(type)}
- Giá hiện tại: ${this.formatPriceForPrompt(price, type)}
- Biến động 24h: ${change >= 0 ? '+' : ''}${(change || 0).toFixed(2)}%
- Khung thời gian phân tích: ${timeframeLabel}

📈 YÊU CẦU PHÂN TÍCH:
1. Đánh giá xu hướng dựa trên biến động giá
2. Ước tính vùng hỗ trợ/kháng cự dựa trên giá hiện tại
3. Đưa ra điểm vào lệnh, cắt lỗ, và 3 mức chốt lời cụ thể
4. Giải thích lý do bằng tiếng Việt

🎯 TRẢ VỀ JSON (CHỈ JSON, KHÔNG TEXT KHÁC):
{
  "action": "BUY" hoặc "SELL" hoặc "HOLD",
  "entry": <giá vào lệnh - số>,
  "stopLoss": <giá cắt lỗ - số>,
  "targets": [<TP1>, <TP2>, <TP3>],
  "riskReward": "1:X",
  "confidence": <1-5>,
  "reasoning": {
    "technical": "<Phân tích kỹ thuật: RSI ước tính, xu hướng, vùng hỗ trợ/kháng cự>",
    "news": "<Nhận định chung về thị trường và ngành>",
    "summary": "<Tóm tắt: Nên mua/bán/giữ và lý do chính>"
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
        const { symbol, name, price, change, type } = asset;

        console.log('🔄 Generating fallback analysis for', symbol);

        let action = 'HOLD';
        let confidence = 2;
        let technicalReason = '';
        let newsReason = '';
        let summary = '';

        const changeVal = change || 0;
        const priceStr = type === 'stock'
            ? `${price?.toFixed(1) || 'N/A'} nghìn VND`
            : `$${price?.toLocaleString() || 'N/A'}`;

        // Technical analysis based on price change
        if (changeVal < -5) {
            action = 'BUY';
            confidence = 3;
            technicalReason = `📉 ${symbol} giảm mạnh ${Math.abs(changeVal).toFixed(1)}% trong phiên. RSI có thể đang ở vùng quá bán (<30). Đây có thể là cơ hội tích lũy nếu xu hướng dài hạn vẫn tốt. Vùng hỗ trợ ước tính: ${(price * 0.95).toFixed(2)}. Cần quan sát khối lượng giao dịch để xác nhận.`;
            newsReason = `⚡ Thị trường đang có áp lực bán. ${type === 'stock' ? 'Cổ phiếu Việt Nam' : 'Thị trường crypto'} chịu ảnh hưởng từ các yếu tố vĩ mô. Theo dõi các tin tức liên quan đến ${name} để đánh giá.`;
            summary = `Tín hiệu MUA tiềm năng. Giá ${priceStr} đang ở vùng có thể oversold. Xem xét tích lũy với SL chặt.`;
        } else if (changeVal < -2) {
            action = 'BUY';
            confidence = 2;
            technicalReason = `📊 ${symbol} điều chỉnh ${Math.abs(changeVal).toFixed(1)}%. Mức giá hiện tại ${priceStr} có thể là điểm vào hợp lý. RSI ước tính: 35-45. Vùng hỗ trợ gần: ${(price * 0.97).toFixed(2)}, kháng cự: ${(price * 1.05).toFixed(2)}.`;
            newsReason = `📰 Nhà đầu tư đang thận trọng. ${type === 'stock' ? 'VN-Index có thể đang test hỗ trợ.' : 'BTC dominance cần theo dõi.'} Kiểm tra tin tức mới nhất về ${name}.`;
            summary = `Xem xét MUA. Điều chỉnh nhẹ có thể là cơ hội nếu trend chính là uptrend.`;
        } else if (changeVal > 8) {
            action = 'SELL';
            confidence = 3;
            technicalReason = `🔥 ${symbol} tăng MẠNH ${changeVal.toFixed(1)}%! RSI có thể đang overbought (>70). Giá ${priceStr} có thể gặp áp lực chốt lời. Kháng cự tiếp theo: ${(price * 1.05).toFixed(2)}.`;
            newsReason = `🚀 Có tin tốt tác động đến ${name}. Tuy nhiên sau đợt tăng mạnh, thường có nhịp điều chỉnh. Xem xét bảo vệ lợi nhuận.`;
            summary = `Xem xét CHỐT LỜI một phần. Đà tăng mạnh nhưng cần cẩn thận với overbought.`;
        } else if (changeVal > 3) {
            action = 'HOLD';
            confidence = 3;
            technicalReason = `📈 ${symbol} tăng tốt +${changeVal.toFixed(1)}%. Xu hướng ngắn hạn tích cực. RSI ước tính: 55-65. Giữ vị thế và đặt trailing stop tại ${(price * 0.97).toFixed(2)}. Mục tiêu tiếp theo: ${(price * 1.05).toFixed(2)}.`;
            newsReason = `✅ Thị trường đang thuận lợi cho ${type === 'stock' ? 'cổ phiếu' : 'crypto'}. ${name} đang trong đà tăng.`;
            summary = `GIỮ vị thế. Trend đang tốt, đặt trailing stop để bảo vệ lợi nhuận.`;
        } else if (changeVal > 0) {
            action = 'HOLD';
            confidence = 2;
            technicalReason = `➡️ ${symbol} tăng nhẹ +${changeVal.toFixed(1)}%. Thị trường sideway, chưa có tín hiệu rõ ràng. Giá ${priceStr}. Vùng tích lũy: ${(price * 0.98).toFixed(2)} - ${(price * 1.02).toFixed(2)}.`;
            newsReason = `📋 Không có tin đột biến. Thị trường đang chờ đợi catalyst mới.`;
            summary = `GIỮ và THEO DÕI. Chờ breakout khỏi vùng tích lũy để hành động.`;
        } else {
            action = 'HOLD';
            confidence = 2;
            technicalReason = `⚖️ ${symbol} biến động nhẹ ${changeVal.toFixed(1)}%. RSI trung tính (~50). Giá ${priceStr} đang trong vùng cân bằng. Hỗ trợ: ${(price * 0.97).toFixed(2)}, Kháng cự: ${(price * 1.03).toFixed(2)}.`;
            newsReason = `🔍 Thị trường đang tích lũy. Theo dõi volume và tin tức để xác định xu hướng.`;
            summary = `TRUNG LẬP. Chờ tín hiệu rõ ràng hơn từ giá và khối lượng.`;
        }

        const multiplier = type === 'stock' ? 0.03 : 0.05;

        return {
            action,
            entry: price,
            stopLoss: parseFloat((price * (1 - multiplier * 1.5)).toFixed(2)),
            targets: [
                parseFloat((price * (1 + multiplier)).toFixed(2)),
                parseFloat((price * (1 + multiplier * 2)).toFixed(2)),
                parseFloat((price * (1 + multiplier * 3)).toFixed(2))
            ],
            riskReward: '1:2',
            confidence,
            reasoning: {
                technical: technicalReason,
                news: newsReason,
                summary: summary
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
