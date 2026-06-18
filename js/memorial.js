/* =========================================
   李氏家谱 — 祭奠堂交互
   上蜡烛 / 上香 / 上贡品 图案 + 点击特效
   ========================================= */

const Memorial = {
  candleCount: 0,
  incenseCount: 0,
  offeringCount: 0,
  offerings: [],

  init() {
    this.loadState();
    this.bindEvents();
    this.renderAll();
  },

  async loadState() {
    try {
      const data = await DB.get('settings', 'memorial_state');
      if (data && data.value) {
        const s = data.value;
        this.candleCount = s.candleCount || 0;
        this.incenseCount = s.incenseCount || 0;
        this.offeringCount = s.offeringCount || 0;
        this.offerings = s.offerings || [];
      }
    } catch (e) {}
  },

  async saveState() {
    try {
      await DB.put('settings', {
        id: 'memorial_state',
        value: {
          candleCount: this.candleCount,
          incenseCount: this.incenseCount,
          offeringCount: this.offeringCount,
          offerings: this.offerings
        }
      });
    } catch (e) { console.error('save memorial state error:', e); }
  },

  bindEvents() {
    const btnCandle = document.getElementById('btnCandle');
    const btnIncense = document.getElementById('btnIncense');
    const btnOffering = document.getElementById('btnOffering');
    if (btnCandle) btnCandle.onclick = () => this.addCandle();
    if (btnIncense) btnIncense.onclick = () => this.addIncense();
    if (btnOffering) btnOffering.onclick = () => this.addOffering();
  },

  renderAll() {
    this.renderCandles();
    this.renderIncense();
    this.renderOfferings();
    this.updateCounts();
  },

  updateCounts() {
    const e1 = document.getElementById('candleCount');
    if (e1) e1.textContent = this.candleCount;
    const e2 = document.getElementById('incenseCount');
    if (e2) e2.textContent = this.incenseCount;
    const e3 = document.getElementById('offeringCount');
    if (e3) e3.textContent = this.offeringCount;
  },

  /* ===== 蜡烛 ===== */
  addCandle() {
    if (this.candleCount >= 9) {
      App.showToast('蜡烛数量已达上限（最多9支）', 'warning');
      return;
    }
    this.candleCount++;
    this.saveState();
    this.renderCandles();
    this.updateCounts();
    this.animateCandleLight();
    App.showToast('已上蜡烛，愿祖先庇佑', 'success');
  },

  renderCandles() {
    const container = document.getElementById('candlesContainer');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < this.candleCount; i++) {
      const el = document.createElement('div');
      el.className = 'memorial-candle lit';
      el.innerHTML = '<div class="candle-flame"><div class="flame-inner"></div><div class="flame-glow"></div></div>'
        + '<div class="candle-wick"></div>'
        + '<div class="candle-body"><div class="candle-stripe"></div></div>'
        + '<div class="candle-base"></div>';
      container.appendChild(el);
    }
  },

  animateCandleLight() {
    const hall = document.getElementById('memorialHall');
    if (!hall) return;
    const glow = document.createElement('div');
    glow.className = 'candle-light-glow';
    hall.appendChild(glow);
    setTimeout(() => { if (glow.parentNode) glow.parentNode.removeChild(glow); }, 2000);
  },

  /* ===== 上香 ===== */
  addIncense() {
    if (this.incenseCount >= 3) {
      App.showToast('香的数量已达上限（最多3支）', 'warning');
      return;
    }
    this.incenseCount++;
    this.saveState();
    this.renderIncense();
    this.updateCounts();
    this.animateSmoke();
    App.showToast('已上香，诚心敬仰', 'success');
  },

  renderIncense() {
    const container = document.getElementById('incenseContainer');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < this.incenseCount; i++) {
      const el = document.createElement('div');
      el.className = 'memorial-incense lit';
      el.innerHTML = '<div class="incense-smoke">'
        + '<div class="smoke-particle smoke-1"></div>'
        + '<div class="smoke-particle smoke-2"></div>'
        + '<div class="smoke-particle smoke-3"></div>'
        + '</div>'
        + '<div class="incense-stick"></div>'
        + '<div class="incense-ash"></div>'
        + '<div class="incense-base"></div>';
      container.appendChild(el);
    }
  },

  animateSmoke() {
    const particles = document.querySelectorAll('.smoke-particle');
    particles.forEach(p => { p.style.animationPlayState = 'running'; });
  },

  /* ===== 上贡品 ===== */
  addOffering() {
    const list = ['水果', '糕点', '酒', '茶', '鲜花', '米饭'];
    const existing = this.offerings.map(o => o.name);
    const available = list.filter(n => !existing.includes(n));
    if (available.length === 0) {
      App.showToast('贡品已全部上齐', 'warning');
      return;
    }
    const name = available[0];
    const emojiMap = { '水果':'\uD83C\uDF4E', '糕点':'\uD83C\uDF70', '酒':'\uD83C\uDF7A', '茶':'\uD83C\uDF75', '鲜花':'\uD83D\uDC8D', '米饭':'\uD83C\uDF5A' };
    this.offeringCount++;
    this.offerings.push({ name: name, emoji: emojiMap[name] || '\uD83C\uDF81' });
    this.saveState();
    this.renderOfferings();
    this.updateCounts();
    App.showToast('已上贡品：' + name, 'success');
  },

  renderOfferings() {
    const container = document.getElementById('offeringContainer');
    if (!container) return;
    container.innerHTML = '';
    this.offerings.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'memorial-offering';
      el.style.animationDelay = (i * 0.2) + 's';
      el.innerHTML = '<div class="offering-emoji">' + item.emoji + '</div>'
        + '<div class="offering-name">' + item.name + '</div>';
      container.appendChild(el);
    });
  },

  async refresh() {
    await this.loadState();
    this.renderAll();
  }
};
