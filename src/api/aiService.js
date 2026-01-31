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
        const today = new Date().toLocaleDateString('vi-VN');

        console.log(`🤖 AI đang phân tích ${symbol}...`);

        const systemPrompt = `Bạn là chuyên gia phân tích tài chính hàng đầu với 20+ năm kinh nghiệm, chuyên về thị trường chứng khoán Việt Nam và kim loại quý (vàng, bạc).

VAI TRÒ:
- Phân tích kỹ thuật chuyên sâu (chart patterns, indicators)
- Phân tích cơ bản (tin tức, sự kiện, yếu tố vĩ mô)
- Đưa ra khuyến nghị giao dịch cụ thể với Entry/SL/TP

QUAN TRỌNG - KHÔNG ĐƯỢC:
- KHÔNG bịa số liệu VN-Index, S&P500 hoặc bất kỳ chỉ số nào
- KHÔNG đề cập con số cụ thể của các chỉ số thị trường nếu không chắc chắn
- CHỈ phân tích dựa trên GIÁ THỰC TẾ được cung cấp trong prompt
- Với cổ phiếu VN: Giá tính theo đơn vị NGHÌN VNĐ (ví dụ: 38.75 = 38,750 VND)

KIẾN THỨC CỦA BẠN:
- Xu hướng chung, sentiment thị trường VN (bullish/bearish/neutral)
- Các yếu tố vĩ mô: Fed, lạm phát, USD/VND, giá dầu
- Đặc điểm ngành nghề của từng cổ phiếu Việt Nam (ngân hàng, BĐS, thép...)
- Xu hướng giá vàng thế giới, ảnh hưởng của Fed/DXY

QUY TẮC:
1. Phân tích chi tiết dựa trên GIÁ HIỆN TẠI được cung cấp
2. Đề cập xu hướng vĩ mô CHUNG, không bịa số liệu cụ thể  
3. Với cổ phiếu VN: Đề cập ngành, đối thủ, triển vọng business
4. Với vàng/bạc: Đề cập xu hướng USD, lạm phát, nhu cầu an toàn
5. CHỈ trả về JSON hợp lệ, không có text khác`;

        const contextInfo = this.getMarketContext(type, symbol);
        const timeframeStrategy = this.getTimeframeGuidance(timeframe);

        const userPrompt = `📅 Ngày phân tích: ${today}
⏰ Thời gian: ${new Date().toLocaleTimeString('vi-VN')} (GMT+7)

📊 TÀI SẢN CẦN PHÂN TÍCH (DỮ LIỆU REALTIME):
- Mã: ${symbol}
- Tên đầy đủ: ${name}
- Loại: ${this.getAssetTypeLabel(type)}
- Giá hiện tại: ${this.formatPriceForPrompt(price, type)} [REALTIME]
- Biến động 24h: ${change >= 0 ? '+' : ''}${(change || 0).toFixed(2)}%

🕐 KHUNG THỜI GIAN: ${timeframeLabel}
${timeframeStrategy}

${contextInfo}

🎯 YÊU CẦU PHÂN TÍCH CHI TIẾT:

1. PHÂN TÍCH KỸ THUẬT:
   - Xác định xu hướng chính (uptrend/downtrend/sideway)
   - Các mức hỗ trợ và kháng cự quan trọng
   - Chỉ báo RSI, MACD ước tính dựa trên biến động
   - Pattern nếu có (Double bottom, Head & Shoulders, Triangle...)

2. TIN TỨC & SỰ KIỆN:
   - Các yếu tố vĩ mô ảnh hưởng (Fed, lạm phát, USD...)
   - Tin tức ngành/công ty gần đây nếu biết
   - Sự kiện chính trị, kinh tế có thể tác động
   - Sentiment thị trường hiện tại

3. KHUYẾN NGHỊ GIAO DỊCH:
   - Điểm vào lệnh (Entry) hợp lý
   - Điểm cắt lỗ (Stop Loss) - giới hạn rủi ro 3-5%
   - 3 mức chốt lời (TP1, TP2, TP3) theo risk/reward
   - Tỷ lệ Risk/Reward khuyến nghị

📋 TRẢ VỀ JSON (CHỈ JSON, KHÔNG GIẢI THÍCH THÊM):
{
  "action": "BUY" | "SELL" | "HOLD",
  "entry": <giá vào lệnh>,
  "stopLoss": <giá cắt lỗ>,
  "targets": [<TP1>, <TP2>, <TP3>],
  "riskReward": "1:X",
  "confidence": <1-5>,
  "reasoning": {
    "technical": "<Phân tích kỹ thuật đầy đủ 3-5 câu: xu hướng, RSI/MACD ước tính, hỗ trợ/kháng cự, pattern>",
    "news": "<Tin tức & sự kiện ảnh hưởng 3-5 câu: yếu tố vĩ mô, tin ngành, sentiment thị trường>",
    "summary": "<Tóm tắt 2-3 câu: Khuyến nghị rõ ràng và lý do chính>"
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
     * Get market context based on asset type
     */
    getMarketContext(type, symbol) {
        if (type === 'stock') {
            const sectorInfo = {
                'VNM': 'Ngành: Thực phẩm & Đồ uống. Đối thủ: TH True Milk, Nutifood.',
                'FPT': 'Ngành: Công nghệ thông tin. Mảng: Phần mềm, Telecom, Giáo dục.',
                'VIC': 'Ngành: Bất động sản. Tập đoàn đa ngành: BĐS, Bán lẻ, Ô tô VinFast.',
                'VHM': 'Ngành: Bất động sản nhà ở. Thuộc Vingroup.',
                'VCB': 'Ngành: Ngân hàng. Big4 ngân hàng TMCP Nhà nước.',
                'TCB': 'Ngành: Ngân hàng tư nhân. Mảnh: Retail, SME.',
                'HPG': 'Ngành: Thép. Doanh nghiệp thép lớn nhất Việt Nam.',
                'MSN': 'Ngành: Tiêu dùng đa ngành. Sở hữu WinMart, Techcombank.',
                'GAS': 'Ngành: Dầu khí. Độc quyền phân phối khí.',
                'SSI': 'Ngành: Chứng khoán. CTCK lớn nhất Việt Nam.',
            };
            return `🏢 THÔNG TIN DOANH NGHIỆP:
${sectorInfo[symbol] || 'Cổ phiếu niêm yết trên sàn HOSE/HNX.'}
- Thị trường: Việt Nam (VN-Index)
- Phiên giao dịch: 9h-11h30, 13h-15h`;
        }

        if (type === 'crypto') {
            return `🌐 BỐI CẢNH CRYPTO:
- Bitcoin halving cycle: Đang trong chu kỳ post-halving 2024
- Các yếu tố: Quy định SEC, ETF Bitcoin Spot, Fed policy
- Tương quan với: S&P500, Nasdaq, DXY (nghịch đảo)`;
        }

        if (type === 'gold' || type === 'metal') {
            return `🥇 BỐI CẢNH VÀNG/KIM LOẠI:
- Safe haven asset: Tăng khi bất ổn địa chính trị
- Tương quan nghịch với: USD, lãi suất thực
- Yếu tố: Fed rate, lạm phát, căng thẳng quốc tế`;
        }

        return '';
    }

    /**
     * Get timeframe-specific analysis guidance
     */
    getTimeframeGuidance(timeframe) {
        const guides = {
            'short': `⚡ PHÂN TÍCH NGẮN HẠN (1-3 ngày):
📊 CHIẾN LƯỢC: Day Trading / Scalping
- TẬP TRUNG: Momentum ngắn hạn, biến động trong phiên
- CHỈ BÁO ƯU TIÊN: RSI 14, MACD (5,10,5), Bollinger Bands 2h/4h
- VOLUME: Quan trọng NHẤT - xác nhận breakout/breakdown
- PATTERN: Nến đảo chiều (Hammer, Engulfing, Doji), Support/Resistance ngắn hạn
- STOP LOSS: Chặt 1.5-2.5% - Ra lệnh nhanh khi sai
- TARGET: TP1 gần (2-3%), chốt nhanh, không tham
- RỦI RO: Cao - cần theo dõi liên tục, tin tức intraday quan trọng
- TIN TỨC: Chú ý lịch KQKD, tin đột xuất trong ngày`,

            'medium': `📈 PHÂN TÍCH TRUNG HẠN (1-4 tuần):
📊 CHIẾN LƯỢC: Swing Trading
- TẬP TRUNG: Xu hướng chính, sóng Elliott, Fibonacci Retracement
- CHỈ BÁO ƯU TIÊN: EMA 20/50, MACD Daily, RSI Divergence
- VOLUME: Xác nhận xu hướng, tích lũy/phân phối
- PATTERN: Head & Shoulders, Rising/Falling Wedge, Cup & Handle
- STOP LOSS: Hợp lý 3-5% - Dưới swing low gần nhất
- TARGET: TP1 (5-7%), TP2 (10-12%), TP3 (15%+)
- RỦI RO: Trung bình - Cho phép điều chỉnh nhỏ
- TIN TỨC: KQKD quý, sector rotation, policy changes, Fed meetings`,

            'long': `🎯 PHÂN TÍCH DÀI HẠN (3-12 tháng):
📊 CHIẾN LƯỢC: Position Trading / Đầu tư giá trị
- TẬP TRUNG: Phân tích CƠ BẢN là chính, kỹ thuật hỗ trợ
- CƠ BẢN: P/E, P/B, ROE, ROA, tăng trưởng doanh thu/lợi nhuận
- CHỈ BÁO KỸ THUẬT: EMA 50/200, Golden/Death Cross, Monthly charts
- VOLUME: Profile tích lũy dài hạn
- PATTERN: Major trend lines, All-time highs/lows, Long-term channels
- STOP LOSS: Rộng 10-15% - Cho phép biến động lớn
- TARGET: 20-50%+ theo chu kỳ kinh tế
- RỦI RO: Thấp nếu đúng doanh nghiệp - Trung bình hóa giá (DCA)
- QUAN TRỌNG: Chất lượng doanh nghiệp, vị thế cạnh tranh, ban lãnh đạo, outlook ngành
- TIN TỨC: Chính sách vĩ mô, chu kỳ ngành, IPO, M&A, thay đổi luật`
        };

        return guides[timeframe] || guides['medium'];
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
