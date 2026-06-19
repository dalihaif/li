/* =========================================
   李氏家谱 — 祭奠堂交互
   上蜡烛 / 上香 / 上贡品 — 固定3支/盘，点击激活
   ========================================= */
const Memorial = {
  candleLit: 0,    // 已点燃的蜡烛数 (0-3)
  incenseLit: 0,    // 已点燃的香数 (0-3)
  offeringLit: 0,    // 已上的贡品数 (0-3)
  maxEach: 3,

  async init() {
    await this.loadState();
    this.bindEvents();
    this.renderAll();
  },

  async loadState() {
    try {
      const data = await DB.get('settings', 'memorial_state');
      if (data && data.value) {
        this.candleLit = data.value.candleLit || 0;
        this.incenseLit = data.value.incenseLit || 0;
        this.offeringLit = data.value.offeringLit || 0;
      }
    } catch (e) {}
  },

  async saveState() {
    try {
      await DB.put('settings', {
        key: 'memorial_state',
        value: {
          candleLit: this.candleLit,
          incenseLit: this.incenseLit,
          offeringLit: this.offeringLit
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
    if (e1) e1.textContent = this.candleLit;
    const e2 = document.getElementById('incenseCount');
    if (e2) e2.textContent = this.incenseLit;
    const e3 = document.getElementById('offeringCount');
    if (e3) e3.textContent = this.offeringLit;
  },

  /* ===== 蜡烛 ===== */
  addCandle() {
    if (this.candleLit >= this.maxEach) {
      App.showToast('蜡烛已达上限（最多3支）', 'warning');
      return;
    }
    this.candleLit++;
    this.saveState();
    this.renderCandles();
    this.updateCounts();
    this.animateCandleLight();
    App.showToast('已上蜡烛，愿祖先庇佑', 'success');
  },

  renderCandles() {
    for (let i = 1; i <= this.maxEach; i++) {
      const el = document.getElementById('candle' + i);
      if (!el) continue;
      if (i <= this.candleLit) {
        el.classList.add('lit');
      } else {
        el.classList.remove('lit');
      }
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
    if (this.incenseLit >= this.maxEach) {
      App.showToast('香已达上限（最多3支）', 'warning');
      return;
    }
    this.incenseLit++;
    this.saveState();
    this.renderIncense();
    this.updateCounts();
    this.animateSmoke();
    App.showToast('已上香，诚心敬仰', 'success');
  },

  renderIncense() {
    for (let i = 1; i <= this.maxEach; i++) {
      const el = document.getElementById('incense' + i);
      if (!el) continue;
      if (i <= this.incenseLit) {
        el.classList.add('lit');
      } else {
        el.classList.remove('lit');
      }
    }
  },

  animateSmoke() {
    const particles = document.querySelectorAll('.memorial-incense.lit .incense-smoke');
    particles.forEach(p => { p.style.animationPlayState = 'running'; });
  },

  /* ===== 上贡品 ===== */
  addOffering() {
    if (this.offeringLit >= this.maxEach) {
      App.showToast('贡品已达上限（最多3盘）', 'warning');
      return;
    }
    this.offeringLit++;
    this.saveState();
    this.renderOfferings();
    this.updateCounts();
    App.showToast('已上贡品：' + this.getOfferingName(this.offeringLit - 1), 'success');
  },

  getOfferingName(index) {
    const names = ['水果', '茶', '敬香'];
    return names[index] || '贡品';
  },

  renderOfferings() {
    for (let i = 1; i <= this.maxEach; i++) {
      const el = document.getElementById('offering' + i);
      if (!el) continue;
      if (i <= this.offeringLit) {
        el.classList.add('lit');
      } else {
        el.classList.remove('lit');
      }
    }
  },

  async refresh() {
    await this.loadState();
    this.renderAll();
  }
};
