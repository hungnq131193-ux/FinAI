/**
 * FinAI Analyzer - Main Application
 * Mobile-first Financial Analysis Webapp
 * 
 * Features:
 * - Search all VN stocks, crypto, metals
 * - AI Scan to find best buying opportunities
 * - Individual asset analysis with Entry/SL/TP
 */

import { AIService } from './api/aiService.js';
import { PriceService } from './api/priceService.js';
import { StorageService } from './utils/storage.js';

export class App {
  constructor() {
    this.storage = new StorageService();
    this.aiService = null;
    this.priceService = new PriceService();

    this.state = {
      apiKey: this.storage.get('kimi_api_key') || '',
      timeframe: 'short',
      assets: [],
      signals: [],
      searchResults: [],
      searchQuery: '',
      selectedAsset: null,
      isLoading: false,
      isScanning: false,
      totalStocksAvailable: 0,
      activeTab: 'market', // market, search
      activeFilter: 'all', // all, stock, crypto, metal
      filteredAssets: [] // Assets filtered by category
    };
  }

  async init() {
    this.render();
    this.bindEvents();

    if (!this.state.apiKey) {
      this.showSettingsModal();
    } else {
      this.aiService = new AIService(this.state.apiKey);
    }

    // Load data
    await this.loadData();
  }

  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="app-container">
        ${this.renderHeader()}
        ${this.renderSearchBar()}
        ${this.renderTimeframeTabs()}
        <main class="main-content">
          ${this.renderAssetsSection()}
          ${this.renderSignalsSection()}
        </main>
      </div>
      ${this.renderSettingsModal()}
      ${this.renderAnalysisModal()}
      <div class="toast-container" id="toast-container"></div>
    `;
  }

  renderHeader() {
    return `
      <header class="header">
        <div class="header-content">
          <div class="logo">
            <div class="logo-icon">📊</div>
            <span class="logo-text">FinAI</span>
            ${this.state.totalStocksAvailable > 0 ?
        `<span class="stock-count">${this.state.totalStocksAvailable} mã</span>` : ''}
          </div>
          <div class="header-actions">
            <button class="icon-btn" id="btn-ai-scan" title="AI Quét thị trường">
              🤖
            </button>
            <button class="icon-btn" id="btn-refresh" title="Làm mới">
              🔄
            </button>
            <button class="icon-btn" id="btn-settings" title="Cài đặt">
              ⚙️
            </button>
          </div>
        </div>
      </header>
    `;
  }

  renderSearchBar() {
    return `
      <div class="search-bar">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="search-input" 
                 placeholder="Tìm cổ phiếu VN, vàng, bạc..." 
                 value="${this.state.searchQuery}"
                 autocomplete="off"
                 dir="ltr"
                 lang="en"
                 style="direction: ltr !important; text-align: left !important;"
                 spellcheck="false">
          ${this.state.searchQuery ?
        `<button class="search-clear" id="search-clear">✕</button>` : ''}
        </div>
        <div class="search-filters">
          <button class="filter-btn active" data-filter="all">Tất cả</button>
          <button class="filter-btn" data-filter="stock">Cổ phiếu VN</button>
          <button class="filter-btn" data-filter="metal">Vàng/Bạc</button>
        </div>
        ${this.state.searchResults.length > 0 ? this.renderSearchResults() : ''}
      </div>
    `;
  }

  renderSearchResults() {
    return `
      <div class="search-results" id="search-results">
        ${this.state.searchResults.map(asset => `
          <div class="search-result-item" data-symbol="${asset.symbol}" data-type="${asset.type}">
            <span class="result-icon">${asset.icon || '📊'}</span>
            <div class="result-info">
              <span class="result-symbol">${asset.symbol}</span>
              <span class="result-name">${asset.name}</span>
            </div>
            <div class="result-price">
              ${asset.price ? this.formatPrice(asset.price, asset.type) : '...'}
              ${asset.change !== undefined ? `
                <span class="result-change ${asset.change >= 0 ? 'positive' : 'negative'}">
                  ${asset.change >= 0 ? '+' : ''}${asset.change.toFixed(2)}%
                </span>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderTimeframeTabs() {
    const tabs = [
      { id: 'short', label: 'Ngắn hạn', desc: '1-7 ngày' },
      { id: 'medium', label: 'Trung hạn', desc: '1-4 tuần' },
      { id: 'long', label: 'Dài hạn', desc: '1-6 tháng' },
    ];

    return `
      <div class="timeframe-tabs">
        ${tabs.map(tab => `
          <button class="tab-btn ${this.state.timeframe === tab.id ? 'active' : ''}" 
                  data-timeframe="${tab.id}">
            ${tab.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  renderAssetsSection() {
    // Assets are now shown through search filters, not on homepage
    const activeFilter = this.state.activeFilter || 'all';
    const showFilteredAssets = activeFilter !== 'all' && this.state.filteredAssets && this.state.filteredAssets.length > 0;

    if (!showFilteredAssets) {
      return `
        <section class="section" id="assets-section">
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-title-icon">💹</span>
              Thị Trường
            </h2>
            <span class="section-subtitle">Chọn tab để xem danh sách</span>
          </div>
          <div class="assets-grid empty-state" id="assets-grid">
            <div class="empty-hint">
              <span class="empty-icon">👆</span>
              <p>Nhấn vào <strong>Cổ phiếu</strong>, <strong>Crypto</strong> hoặc <strong>Vàng/Bạc</strong> để xem danh sách</p>
            </div>
          </div>
        </section>
      `;
    }

    const filterLabels = { 'stock': '📈 Cổ Phiếu VN', 'crypto': '₿ Crypto', 'metal': '🥇 Vàng/Kim loại' };

    return `
      <section class="section" id="assets-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="section-title-icon">💹</span>
            ${filterLabels[activeFilter] || 'Thị Trường'}
          </h2>
          <span class="section-subtitle" id="data-status">
            ${this.state.filteredAssets.length} tài sản • 
            ${this.state.filteredAssets.some(a => a.isRealtime) ? '🟢 Real-time' : '⚪ Cached'}
          </span>
        </div>
        <div class="assets-grid" id="assets-grid">
          ${this.state.isLoading ? this.renderAssetSkeletons() : this.renderFilteredAssetCards()}
        </div>
      </section>
    `;
  }

  renderFilteredAssetCards() {
    const assets = this.state.filteredAssets || [];
    if (assets.length === 0) return '<div class="empty-state">Không có dữ liệu</div>';

    return assets.slice(0, 50).map(asset => `
      <div class="asset-card" data-symbol="${asset.symbol}">
        <div class="asset-header">
          <span class="asset-icon">${asset.icon || '📊'}</span>
          <div class="asset-info">
            <span class="asset-symbol">${asset.symbol}</span>
            <span class="asset-name">${asset.name || asset.symbol}</span>
          </div>
        </div>
        <div class="asset-price">${this.formatPrice(asset.price, asset.type)}</div>
        <div class="asset-change ${(asset.change || 0) >= 0 ? 'positive' : 'negative'}">
          ${(asset.change || 0) >= 0 ? '▲' : '▼'} ${Math.abs(asset.change || 0).toFixed(2)}%
        </div>
        ${asset.isRealtime ? '<span class="realtime-badge">LIVE</span>' : ''}
      </div>
    `).join('');
  }

  renderAssetSkeletons() {
    return Array(8).fill(0).map(() => `
      <div class="asset-card">
        <div class="skeleton" style="height: 32px; width: 60%; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 28px; width: 80%; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 20px; width: 40%;"></div>
      </div>
    `).join('');
  }

  renderAssetCards() {
    if (this.state.assets.length === 0) {
      return `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-icon">📈</div>
          <h3 class="empty-title">Chưa có dữ liệu</h3>
          <p class="empty-text">Nhấn 🔄 để tải dữ liệu thị trường</p>
        </div>
      `;
    }

    return this.state.assets.map(asset => {
      const changeClass = asset.change >= 0 ? 'positive' : 'negative';
      const changeIcon = asset.change >= 0 ? '▲' : '▼';
      const typeClass = asset.type || 'crypto';

      return `
        <div class="asset-card ${typeClass}" data-symbol="${asset.symbol}">
          <div class="asset-header">
            <div class="asset-icon">${asset.icon || '📊'}</div>
            <div class="asset-info">
              <div class="asset-symbol">${asset.symbol}</div>
              <div class="asset-name">${asset.name}</div>
            </div>
          </div>
          <div class="asset-price">${this.formatPrice(asset.price, asset.type)}</div>
          <span class="asset-change ${changeClass}">
            ${changeIcon} ${Math.abs(asset.change || 0).toFixed(2)}%
          </span>
          ${!asset.isRealtime ? '<span class="asset-cached">⚪</span>' : ''}
        </div>
      `;
    }).join('');
  }

  renderSignalsSection() {
    return `
      <section class="section" id="signals-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="section-title-icon">💡</span>
            Gợi Ý Giao Dịch
          </h2>
          <button class="ai-scan-btn ${this.state.isScanning ? 'scanning' : ''}" id="btn-ai-scan-inline">
            ${this.state.isScanning ? '⏳ Đang quét...' : '🤖 AI Quét'}
          </button>
        </div>
        <div class="signals-list" id="signals-list">
          ${this.state.isScanning ? this.renderScanningState() : this.renderSignalCards()}
        </div>
      </section>
    `;
  }

  renderScanningState() {
    return `
      <div class="scanning-state">
        <div class="scanning-animation">🤖</div>
        <p>AI đang quét thị trường tìm cơ hội...</p>
        <div class="scanning-progress">
          <div class="scanning-bar"></div>
        </div>
      </div>
    `;
  }

  renderSignalCards() {
    if (this.state.signals.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <h3 class="empty-title">Chưa có gợi ý</h3>
          <p class="empty-text">
            Nhấn <strong>🤖 AI Quét</strong> để tìm cơ hội mua tốt nhất<br>
            hoặc chọn một tài sản để phân tích chi tiết
          </p>
        </div>
      `;
    }

    return this.state.signals.map(signal => {
      const actionClass = signal.action.toLowerCase();
      const actionLabels = { buy: 'MUA', sell: 'BÁN', hold: 'CHỜ' };
      const confidenceStars = '⭐'.repeat(signal.confidence || 3);

      return `
        <div class="signal-card ${actionClass}" data-signal-id="${signal.id}">
          <div class="signal-header">
            <div class="signal-asset">
              <div class="signal-icon">${signal.icon || '📊'}</div>
              <div class="signal-asset-info">
                <h3>${signal.symbol}</h3>
                <span>${signal.name}</span>
              </div>
            </div>
            <span class="signal-action ${actionClass}">
              ${actionLabels[actionClass] || signal.action}
            </span>
          </div>
          
          <div class="signal-levels">
            <div class="signal-level entry">
              <div class="signal-level-label">Entry</div>
              <div class="signal-level-value">${this.formatPrice(signal.entry, signal.type)}</div>
            </div>
            <div class="signal-level sl">
              <div class="signal-level-label">Stop Loss</div>
              <div class="signal-level-value">${this.formatPrice(signal.stopLoss, signal.type)}</div>
            </div>
            <div class="signal-level tp">
              <div class="signal-level-label">Target</div>
              <div class="signal-level-value">${this.formatPrice(signal.target, signal.type)}</div>
            </div>
          </div>
          
          <div class="signal-meta">
            <div class="signal-confidence">
              <span class="confidence-stars">${confidenceStars}</span>
            </div>
            <span class="signal-timeframe">${signal.timeframeLabel}</span>
            <span class="signal-view-more">Chi tiết →</span>
          </div>
          
          ${signal.reason ? `
            <div class="signal-reason">
              <strong>Lý do:</strong> ${signal.reason}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  renderSettingsModal() {
    return `
      <div class="modal-overlay" id="settings-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">⚙️ Cài Đặt API</h2>
            <button class="modal-close" id="close-settings">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Kimi K2 API Key</label>
              <input type="password" class="form-input" id="api-key-input" 
                     placeholder="Nhập API key của bạn..."
                     value="${this.state.apiKey}">
              <p class="form-hint">
                Đăng ký miễn phí tại <a href="https://kimi-k2.ai" target="_blank" style="color: var(--accent-crypto);">kimi-k2.ai</a>
              </p>
            </div>
            
            <div class="info-box">
              <h4>📌 Thông tin sử dụng Token:</h4>
              <ul>
                <li>❌ Lấy giá: <strong>KHÔNG</strong> dùng token</li>
                <li>✅ AI Quét/Phân tích: <strong>CÓ</strong> dùng token</li>
              </ul>
            </div>
            
            <button class="btn btn-primary" id="save-api-key">
              💾 Lưu Cài Đặt
            </button>
            
            <div class="mt-lg">
              <p class="form-hint" style="text-align: center;">
                ⚠️ Các gợi ý chỉ mang tính tham khảo.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAnalysisModal() {
    return `
      <div class="modal-overlay analysis-modal" id="analysis-modal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" id="analysis-title">📊 Phân Tích Chi Tiết</h2>
            <button class="modal-close" id="close-analysis">✕</button>
          </div>
          <div class="analysis-tabs">
            <button class="analysis-tab active" data-tab="technical">Kỹ Thuật</button>
            <button class="analysis-tab" data-tab="news">Tin Tức</button>
            <button class="analysis-tab" data-tab="trade">Giao Dịch</button>
          </div>
          <div class="analysis-content" id="analysis-content"></div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Settings
    document.getElementById('btn-settings')?.addEventListener('click', () => this.showSettingsModal());
    document.getElementById('close-settings')?.addEventListener('click', () => this.hideSettingsModal());
    document.getElementById('save-api-key')?.addEventListener('click', () => this.saveApiKey());

    // Refresh
    document.getElementById('btn-refresh')?.addEventListener('click', () => this.loadData());

    // AI Scan
    document.getElementById('btn-ai-scan')?.addEventListener('click', () => this.startAIScan());
    document.getElementById('btn-ai-scan-inline')?.addEventListener('click', () => this.startAIScan());

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    searchInput?.addEventListener('focus', () => {
      if (this.state.searchQuery) this.handleSearch(this.state.searchQuery);
    });

    document.getElementById('search-clear')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.state.searchResults = [];
      this.updateSearchBar();
    });

    // Search filters - clicking loads assets by type
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        const filter = e.target.dataset.filter;
        this.state.activeFilter = filter;

        // If searching, filter search results
        if (this.state.searchQuery) {
          this.handleSearch(this.state.searchQuery, filter);
          return;
        }

        // Otherwise, load all assets of this type
        if (filter === 'all') {
          this.state.filteredAssets = [];
          this.updateAssetsGrid();
          return;
        }

        // Load assets by type
        this.state.isLoading = true;
        this.updateAssetsGrid();

        try {
          if (filter === 'stock') {
            // Load VN stocks from CafeF
            const stocks = await this.priceService.getAllVNStockSymbols();
            this.state.filteredAssets = stocks.map(s => ({ ...s, icon: '📈', type: 'stock' }));
          } else if (filter === 'metal') {
            // Load metals (Gold, Silver) from CoinGecko
            const metals = await this.priceService.getMetalPrices();
            this.state.filteredAssets = metals;
          }
        } catch (e) {
          console.error('Error loading assets:', e);
          this.state.filteredAssets = [];
        }

        this.state.isLoading = false;
        this.updateAssetsGrid();
      });
    });

    // Timeframe tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setTimeframe(e.target.dataset.timeframe));
    });

    // Asset cards
    document.getElementById('assets-grid')?.addEventListener('click', (e) => {
      const card = e.target.closest('.asset-card');
      if (card) this.selectAsset(card.dataset.symbol);
    });

    // Signal cards
    document.getElementById('signals-list')?.addEventListener('click', (e) => {
      const card = e.target.closest('.signal-card');
      if (card) this.showAnalysisModal(card.dataset.signalId);
    });

    // Search results
    document.getElementById('search-results')?.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) {
        this.selectAssetFromSearch(item.dataset.symbol, item.dataset.type);
      }
    });

    // Analysis modal
    document.getElementById('close-analysis')?.addEventListener('click', () => this.hideAnalysisModal());
    document.querySelectorAll('.analysis-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchAnalysisTab(e.target.dataset.tab));
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    // API key Enter
    document.getElementById('api-key-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveApiKey();
    });

    // Close search on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-bar') && this.state.searchResults.length > 0) {
        this.state.searchResults = [];
        this.updateSearchBar();
      }
    });
  }

  // ================ SEARCH ================

  handleSearch(query, filter = 'all') {
    this.state.searchQuery = query;

    if (!query.trim()) {
      this.state.searchResults = [];
      this.updateSearchBar();
      return;
    }

    const results = this.priceService.searchStocks(query, filter);
    this.state.searchResults = results;
    this.updateSearchBar();
  }

  updateSearchBar() {
    const container = document.querySelector('.search-bar');
    if (container) {
      container.innerHTML = `
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="search-input" 
                 placeholder="Tìm cổ phiếu, crypto, vàng..." 
                 value="${this.state.searchQuery}"
                 autocomplete="off">
          ${this.state.searchQuery ?
          `<button class="search-clear" id="search-clear">✕</button>` : ''}
        </div>
        <div class="search-filters">
          <button class="filter-btn active" data-filter="all">Tất cả</button>
          <button class="filter-btn" data-filter="stock">Cổ phiếu</button>
          <button class="filter-btn" data-filter="crypto">Crypto</button>
          <button class="filter-btn" data-filter="metal">Vàng/Bạc</button>
        </div>
        ${this.state.searchResults.length > 0 ? this.renderSearchResults() : ''}
      `;
      this.rebindSearchEvents();
    }
  }

  rebindSearchEvents() {
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    searchInput?.focus();

    document.getElementById('search-clear')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.state.searchResults = [];
      this.updateSearchBar();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        if (this.state.searchQuery) {
          this.handleSearch(this.state.searchQuery, e.target.dataset.filter);
        }
      });
    });

    document.getElementById('search-results')?.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) {
        this.selectAssetFromSearch(item.dataset.symbol, item.dataset.type);
      }
    });
  }

  async selectAssetFromSearch(symbol, type) {
    this.state.searchQuery = '';
    this.state.searchResults = [];
    this.updateSearchBar();

    this.showToast(`Đang lấy giá realtime ${symbol}...`, 'info');

    let asset = null;

    if (type === 'stock') {
      // Use getRealtimePrice for latest real-time data
      asset = await this.priceService.getRealtimePrice(symbol, type);
    } else {
      // Find from cached data for crypto/metals
      asset = this.state.assets.find(a => a.symbol === symbol);
    }

    if (asset) {
      // Add to displayed assets if not there
      if (!this.state.assets.find(a => a.symbol === symbol)) {
        this.state.assets.unshift(asset);
        this.updateAssetsGrid();
      }

      // Analyze it
      await this.analyzeAsset(asset);
    } else {
      this.showToast(`Không tìm thấy ${symbol}`, 'error');
    }
  }

  // ================ AI SCAN ================

  async startAIScan() {
    if (!this.aiService) {
      this.showToast('Vui lòng cấu hình API key trước', 'error');
      this.showSettingsModal();
      return;
    }

    if (this.state.isScanning) return;

    this.state.isScanning = true;
    this.updateSignalsList();
    this.showToast('🤖 AI đang quét thị trường...', 'info');

    try {
      // Get top movers and some random stocks to analyze
      const candidates = [];

      // Add current assets
      candidates.push(...this.state.assets.slice(0, 10));

      // Add top gainers
      const topGainers = this.priceService.getTopMovers(5, 'up');
      candidates.push(...topGainers.filter(g => !candidates.find(c => c.symbol === g.symbol)));

      // Add top losers (potential buy opportunities)
      const topLosers = this.priceService.getTopMovers(5, 'down');
      candidates.push(...topLosers.filter(l => !candidates.find(c => c.symbol === l.symbol)));

      // AI analysis for best opportunities
      const timeframeLabels = {
        short: '1-7 ngày',
        medium: '1-4 tuần',
        long: '1-6 tháng'
      };

      const scanPrompt = `Bạn là chuyên gia phân tích tài chính. Quét qua danh sách tài sản sau và tìm 3-5 tài sản có cơ hội MUA tốt nhất trong ${timeframeLabels[this.state.timeframe]}:

${candidates.map(a => `- ${a.symbol} (${a.name}): Giá ${this.formatPrice(a.price, a.type)}, Thay đổi ${a.change?.toFixed(2) || 0}%`).join('\n')}

Tiêu chí đánh giá:
1. Cổ phiếu đang oversold (RSI thấp)
2. Giá gần vùng hỗ trợ mạnh
3. Có tín hiệu đảo chiều tăng
4. Risk/Reward hấp dẫn (>1:2)

Trả về JSON array với format:
[
  {
    "symbol": "...",
    "action": "BUY",
    "entry": <số>,
    "stopLoss": <số>,
    "targets": [<t1>, <t2>, <t3>],
    "confidence": <1-5>,
    "reason": "<lý do ngắn gọn>"
  }
]

Chỉ trả về các tài sản đáng MUA nhất, không liệt kê tất cả.`;

      const response = await this.aiService.callAPI(
        'Bạn là chuyên gia tài chính. Chỉ trả về JSON hợp lệ.',
        scanPrompt
      );

      // Parse response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0]);

        this.state.signals = recommendations.map(rec => {
          const asset = candidates.find(c => c.symbol === rec.symbol) || { type: 'stock', icon: '📈' };
          return {
            id: `${rec.symbol}-${Date.now()}`,
            symbol: rec.symbol,
            name: this.priceService.getVNStockName(rec.symbol),
            icon: asset.icon,
            type: asset.type,
            action: rec.action || 'BUY',
            entry: rec.entry,
            stopLoss: rec.stopLoss,
            target: rec.targets?.[0],
            targets: rec.targets,
            confidence: rec.confidence || 3,
            timeframeLabel: timeframeLabels[this.state.timeframe],
            reason: rec.reason,
            reasoning: { summary: rec.reason }
          };
        });

        this.showToast(`✅ Tìm thấy ${this.state.signals.length} cơ hội tốt!`, 'success');
      } else {
        throw new Error('Invalid AI response');
      }
    } catch (error) {
      console.error('AI Scan error:', error);
      this.showToast('Lỗi quét AI: ' + error.message, 'error');
    }

    this.state.isScanning = false;
    this.updateSignalsList();
  }

  // ================ DATA LOADING ================

  async loadData() {
    if (this.state.isLoading) return;

    this.state.isLoading = true;
    this.updateAssetsGrid();

    try {
      const allPrices = await this.priceService.getAllPrices();

      this.state.assets = [
        ...(allPrices.crypto || []),
        ...(allPrices.metals || []),
        ...(allPrices.vnStocks || [])
      ];

      this.state.totalStocksAvailable = allPrices.totalStocksAvailable || 0;

      this.showToast(`Đã tải ${this.state.assets.length} tài sản`, 'success');
    } catch (error) {
      console.error('Load error:', error);
      this.showToast('Lỗi tải dữ liệu', 'error');
    }

    this.state.isLoading = false;
    this.updateHeader();
    this.updateAssetsGrid();
  }

  updateHeader() {
    const stockCount = document.querySelector('.stock-count');
    if (stockCount) {
      stockCount.textContent = `${this.state.totalStocksAvailable} mã`;
    } else if (this.state.totalStocksAvailable > 0) {
      const logo = document.querySelector('.logo');
      if (logo) {
        const span = document.createElement('span');
        span.className = 'stock-count';
        span.textContent = `${this.state.totalStocksAvailable} mã`;
        logo.appendChild(span);
      }
    }
  }

  updateAssetsGrid() {
    const section = document.getElementById('assets-section');

    if (section) {
      // Re-render entire section to handle empty state vs filtered state
      const temp = document.createElement('div');
      temp.innerHTML = this.renderAssetsSection();
      section.replaceWith(temp.firstElementChild);

      // Rebind click events for asset cards
      document.getElementById('assets-grid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.asset-card');
        if (card) this.selectAsset(card.dataset.symbol);
      });
    }
  }

  updateSignalsList() {
    const list = document.getElementById('signals-list');
    if (list) {
      list.innerHTML = this.state.isScanning ? this.renderScanningState() : this.renderSignalCards();
    }
  }

  // ================ ASSET ANALYSIS ================

  async selectAsset(symbol) {
    const asset = this.state.assets.find(a => a.symbol === symbol);
    if (!asset) return;

    this.state.selectedAsset = asset;

    document.querySelectorAll('.asset-card').forEach(card => {
      card.classList.toggle('active', card.dataset.symbol === symbol);
    });

    await this.analyzeAsset(asset);
  }

  async analyzeAsset(asset) {
    if (!this.aiService) {
      this.showToast('Vui lòng cấu hình API key trước', 'error');
      this.showSettingsModal();
      return;
    }

    this.showToast(`Đang phân tích ${asset.symbol}...`, 'info');

    try {
      const timeframeLabels = {
        short: '1-7 ngày',
        medium: '1-4 tuần',
        long: '1-6 tháng'
      };

      const analysis = await this.aiService.analyzeAsset({
        symbol: asset.symbol,
        name: asset.name,
        price: asset.price,
        change: asset.change,
        type: asset.type,
        timeframe: this.state.timeframe,
        timeframeLabel: timeframeLabels[this.state.timeframe]
      });

      const signal = {
        id: `${asset.symbol}-${Date.now()}`,
        symbol: asset.symbol,
        name: asset.name,
        icon: asset.icon,
        type: asset.type,
        action: analysis.action || 'hold',
        entry: analysis.entry || asset.price,
        stopLoss: analysis.stopLoss || asset.price * 0.95,
        target: analysis.targets?.[0] || asset.price * 1.1,
        targets: analysis.targets,
        confidence: analysis.confidence || 3,
        riskReward: analysis.riskReward || '1:2',
        timeframeLabel: timeframeLabels[this.state.timeframe],
        reasoning: analysis.reasoning || {},
        fullAnalysis: analysis
      };

      const existingIndex = this.state.signals.findIndex(s => s.symbol === asset.symbol);
      if (existingIndex >= 0) {
        this.state.signals[existingIndex] = signal;
      } else {
        this.state.signals.unshift(signal);
      }

      this.updateSignalsList();
      this.showToast(`✅ Đã phân tích ${asset.symbol}`, 'success');
    } catch (error) {
      console.error('Analysis error:', error);
      this.showToast('Lỗi phân tích: ' + error.message, 'error');
    }
  }

  // ================ MODALS ================

  showSettingsModal() {
    document.getElementById('settings-modal').classList.add('active');
    document.getElementById('api-key-input').focus();
  }

  hideSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
  }

  async saveApiKey() {
    const input = document.getElementById('api-key-input');
    const apiKey = input.value.trim();

    if (!apiKey) {
      this.showToast('Vui lòng nhập API key', 'error');
      return;
    }

    this.state.apiKey = apiKey;
    this.storage.set('kimi_api_key', apiKey);
    this.aiService = new AIService(apiKey);

    this.hideSettingsModal();
    this.showToast('Đã lưu API key!', 'success');
  }

  showAnalysisModal(signalId) {
    const signal = this.state.signals.find(s => s.id === signalId);
    if (!signal) return;

    this.state.currentSignal = signal;

    document.getElementById('analysis-title').textContent = `📊 ${signal.symbol}`;
    this.renderAnalysisContent('technical');
    document.getElementById('analysis-modal').classList.add('active');
  }

  hideAnalysisModal() {
    document.getElementById('analysis-modal').classList.remove('active');
  }

  switchAnalysisTab(tab) {
    document.querySelectorAll('.analysis-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    this.renderAnalysisContent(tab);
  }

  renderAnalysisContent(tab) {
    const signal = this.state.currentSignal;
    if (!signal) return;

    const container = document.getElementById('analysis-content');
    const reasoning = signal.reasoning || {};

    switch (tab) {
      case 'technical':
        container.innerHTML = `
          <div class="analysis-section">
            <h4>📈 Phân Tích Kỹ Thuật</h4>
            <p class="analysis-text">${reasoning.technical || 'Đang cập nhật...'}</p>
          </div>
          <div class="analysis-section">
            <h4>📊 Chỉ Báo</h4>
            <div class="risk-reward-bar">
              <span class="rr-label">Risk/Reward:</span>
              <span class="rr-value">${signal.riskReward || '1:2'}</span>
            </div>
          </div>
        `;
        break;

      case 'news':
        container.innerHTML = `
          <div class="analysis-section">
            <h4>📰 Tin Tức & Sự Kiện</h4>
            <p class="analysis-text">${reasoning.news || 'Đang tìm kiếm...'}</p>
          </div>
        `;
        break;

      case 'trade':
        container.innerHTML = `
          <div class="analysis-section">
            <h4>🎯 Chi Tiết Lệnh</h4>
            <div class="signal-levels">
              <div class="signal-level entry">
                <div class="signal-level-label">Entry</div>
                <div class="signal-level-value">${this.formatPrice(signal.entry, signal.type)}</div>
              </div>
              <div class="signal-level sl">
                <div class="signal-level-label">Stop Loss</div>
                <div class="signal-level-value">${this.formatPrice(signal.stopLoss, signal.type)}</div>
              </div>
              ${(signal.targets || []).map((t, i) => `
                <div class="signal-level tp">
                  <div class="signal-level-label">Target ${i + 1}</div>
                  <div class="signal-level-value">${this.formatPrice(t, signal.type)}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="analysis-section">
            <h4>💬 Lý Do</h4>
            <p class="analysis-text">${reasoning.summary || signal.reason || 'Xem phân tích kỹ thuật.'}</p>
          </div>
        `;
        break;
    }
  }

  setTimeframe(timeframe) {
    this.state.timeframe = timeframe;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.timeframe === timeframe);
    });
  }

  // ================ UTILITIES ================

  formatPrice(price, type) {
    if (!price) return '-';

    if (type === 'stock') {
      // If price < 1000, it's in thousands (from CafeF: 38.75 = 38,750 VND)
      // If price >= 1000, it's already in VND (from AI: 38750)
      const priceInVND = price >= 1000 ? price : price * 1000;
      return new Intl.NumberFormat('vi-VN').format(Math.round(priceInVND)) + ' đ';
    }

    // For metals (gold/silver in USD)
    if (type === 'metal') {
      return '$' + new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(price);
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '✕', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
  }
}
