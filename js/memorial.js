/* =========================================
   李氏家谱 — 祭奠堂交互
   上香 / 敬酒 / 上贡品
   竖版牌位 + 累计计数器 + 访客记录
   ========================================= */
const Memorial = {
  candleLit: 0,        // 当前点燃的蜡烛数（固定最多3支）
  incenseLit: 0,      // 当前香的支数（固定最多3支）
  wineLit: 0,          // 当前敬酒杯数（不再使用，改为纯累计）
  offeringLit: 0,       // 当前贡品种数（固定最多5种）

  // 累计计数器（永久累计，不设上限）
  totalCandles: 0,
  totalIncense: 0,
  totalWine: 0,
  totalOfferings: 0,

  // 访客ID（本次会话唯一，用于区分不同访客的贡献）
  visitorId: null,

  async init() {
    this.visitorId = this.getVisitorId();
    await this.loadState();
    await this.loadDeceased();
    this.bindEvents();
    this.renderAll();
  },

  /* ===== 获取或生成访客ID ===== */
  getVisitorId() {
    let id = sessionStorage.getItem('memorial_visitor_id');
    if (!id) {
      id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      sessionStorage.setItem('memorial_visitor_id', id);
    }
    return id;
  },

  async loadState() {
    try {
      const data = await DB.get('settings', 'memorial_state');
      if (data && data.value) {
        this.candleLit = data.value.candleLit || 0;
        this.incenseLit = data.value.incenseLit || 0;
        this.wineLit = data.value.wineLit || 0;
        this.offeringLit = data.value.offeringLit || 0;
        // 累计计数
        this.totalCandles = data.value.totalCandles || 0;
        this.totalIncense = data.value.totalIncense || 0;
        this.totalWine = data.value.totalWine || 0;
        this.totalOfferings = data.value.totalOfferings || 0;
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
          wineLit: this.wineLit,
          offeringLit: this.offeringLit,
          totalCandles: this.totalCandles,
          totalIncense: this.totalIncense,
          totalWine: this.totalWine,
          totalOfferings: this.totalOfferings
        }
      });
    } catch (e) { console.error('save memorial state error:', e); }
  },

  /* ===== 加载已故成员，生成牌位 ===== */
  async loadDeceased() {
    try {
      const allMembers = await DB.getAll('members');
      const deceased = allMembers
        .filter(m => m.death_date || (m.status && m.status === 'deceased') || (m.is_alive === false))
        .sort((a, b) => {
          // 按世代排序：有世代值的按数字排，没有的排最后
          const ag = parseInt(a.generation) || 9999;
          const bg = parseInt(b.generation) || 9999;
          return ag - bg;
        });
      const tabletsGrid = document.getElementById('tabletsGrid');
      if (!tabletsGrid) return;

      if (deceased.length === 0) {
        return;
      }

      // 清空并重建
      tabletsGrid.innerHTML = '';

      for (const member of deceased) {
        const nameChars = member.name.split('');
        const tablet = document.createElement('div');
        tablet.className = 'tablet-item';
        tablet.title = member.name + (member.generation ? ' - 第' + member.generation + '世' : '');

        let charHtml = '';
        nameChars.forEach((ch, i) => {
          const cls = (i === nameChars.length - 1) ? 'tablet-char last' : 'tablet-char';
          charHtml += `<div class="${cls}">${ch}</div>`;
        });

        tablet.innerHTML = `
          <div class="tablet-wood-frame">
            <div class="tablet-wood-inner">
              <div class="tablet-dynasty">李氏</div>
              ${charHtml}
              <div class="tablet-char suffix">之</div>
              <div class="tablet-char suffix last">位</div>
            </div>
          </div>
          <div class="tablet-base"></div>
        `;
        tabletsGrid.appendChild(tablet);
      }
    } catch (e) {
      console.error('loadDeceased error:', e);
    }
  },

  bindEvents() {
    const btnCandle = document.getElementById('btnCandle');
    const btnIncense = document.getElementById('btnIncense');
    const btnWine = document.getElementById('btnWine');
    const btnOffering = document.getElementById('btnOffering');
    if (btnCandle) btnCandle.onclick = () => this.addCandle();
    if (btnIncense) btnIncense.onclick = () => this.addIncense();
    if (btnWine) btnWine.onclick = () => this.addWine();
    if (btnOffering) btnOffering.onclick = () => this.addOffering();
  },

  renderAll() {
    this.renderCandles();
    this.renderIncense();
    this.renderWine();
    this.renderOfferings();
    this.updateCounts();
    this.updateCumulative();
  },

  updateCounts() {
    // 按钮数字显示已移除，无需更新
  },

  updateCumulative() {
    const e0 = document.getElementById('totalCandles');
    if (e0) e0.textContent = this.totalCandles;
    const e1 = document.getElementById('totalIncense');
    if (e1) e1.textContent = this.totalIncense;
    const e2 = document.getElementById('totalWine');
    if (e2) e2.textContent = this.totalWine;
    const e3 = document.getElementById('totalOfferings');
    if (e3) e3.textContent = this.totalOfferings;
  },

  /* ===== 点蜡烛（视觉最多3支，累计无上限） ===== */
  addCandle() {
    if (this.candleLit < 3) {
      this.candleLit++;
    }
    this.totalCandles++;
    this.saveState();
    this.renderCandles();
    this.updateCounts();
    this.updateCumulative();
    this.animateCandleLight();
    App.showToast('点亮心灯 照亮前路（累计 ' + this.totalCandles + ' 次）', 'success');
    this.showBlessing('点亮心灯 照亮前路');
    this.logVisitorAction('candle');
  },

  renderCandles() {
    const container = document.getElementById('candleContainer');
    if (!container) return;

    // 固定生成3支蜡烛
    if (container.children.length === 0) {
      for (let i = 1; i <= 3; i++) {
        const el = document.createElement('div');
        el.className = 'memorial-candle';
        el.id = 'candle' + i;
        el.innerHTML = `
          <div class="candle-flame"></div>
          <div class="candle-body"></div>
        `;
        container.appendChild(el);
      }
    }

    // 根据 candleLit 控制点燃状态
    for (let i = 1; i <= 3; i++) {
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

  /* ===== 上香（视觉最多3支，累计无上限） ===== */
  addIncense() {
    if (this.incenseLit < 3) {
      this.incenseLit++;
    }
    this.totalIncense++;
    this.saveState();
    this.renderIncense();
    this.updateCounts();
    this.updateCumulative();
    this.animateIncenseLight();
    App.showToast('祖先庇佑 香火永续（累计 ' + this.totalIncense + ' 次）', 'success');
    this.showBlessing('祖先庇佑 香火永续');
    this.logVisitorAction('incense');
  },

  renderIncense() {
    const container = document.getElementById('incenseContainer');
    if (!container) return;

    // 固定生成3支香
    if (container.children.length === 0) {
      for (let i = 1; i <= 3; i++) {
        const el = document.createElement('div');
        el.className = 'memorial-incense';
        el.id = 'incense' + i;
        el.innerHTML = '<div class="incense-stick"></div><div class="incense-smoke"></div>';
        container.appendChild(el);
      }
    }

    // 根据 incenseLit 控制亮灭
    for (let i = 1; i <= 3; i++) {
      const el = document.getElementById('incense' + i);
      if (!el) continue;
      if (i <= this.incenseLit) {
        el.classList.add('lit');
      } else {
        el.classList.remove('lit');
      }
    }
  },

  animateIncenseLight() {
    const hall = document.getElementById('memorialHall');
    if (!hall) return;
    const glow = document.createElement('div');
    glow.className = 'incense-light-glow';
    hall.appendChild(glow);
    setTimeout(() => { if (glow.parentNode) glow.parentNode.removeChild(glow); }, 2000);
  },

  /* ===== 显示全屏祝福文字 ===== */
  showBlessing(text) {
    const existing = document.querySelector('.blessing-text');
    if (existing) existing.parentNode.removeChild(existing);

    const el = document.createElement('div');
    el.className = 'blessing-text';
    el.textContent = text;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add('show');
    });

    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
    }, 2200);
  },

  /* ===== 敬酒（纯累计，无上限） ===== */
  addWine() {
    this.totalWine++;
    this.saveState();
    this.updateCumulative();
    App.showToast('诚心敬仰 德泽绵长（累计 ' + this.totalWine + ' 次）', 'success');
    this.showBlessing('诚心敬仰 德泽绵长');
    this.logVisitorAction('wine');
  },

  renderWine() {
    // 敬酒改为纯累计，不显示视觉效果
    // 保留空函数以避免报错
  },

  animateSmoke() {
    const particles = document.querySelectorAll('.memorial-wine.lit .wine-steam');
    particles.forEach(p => { p.style.animationPlayState = 'running'; });
  },

  /* ===== 上贡品（视觉最多5种，累计无上限） ===== */
  addOffering() {
    if (this.offeringLit < 5) {
      this.offeringLit++;
    }
    this.totalOfferings++;
    this.saveState();
    this.renderOfferings();
    this.updateCounts();
    this.updateCumulative();
    App.showToast('列祖列宗 敬请享用（累计 ' + this.totalOfferings + ' 次）', 'success');
    this.showBlessing('列祖列宗 敬请享用');
    this.logVisitorAction('offering');
  },

  renderOfferings() {
    const container = document.getElementById('offeringContainer');
    if (!container) return;

    const emojis = ['🍎', '🍵', '🍶', '🍰', '💐'];
    const names = ['水果', '茶', '美酒', '糕点', '鲜花'];

    // 固定生成5种贡品
    if (container.children.length === 0) {
      for (let i = 0; i < 5; i++) {
        const el = document.createElement('div');
        el.className = 'memorial-offering';
        el.id = 'offering' + (i + 1);
        el.innerHTML = `<div class="offering-emoji">${emojis[i]}</div><div class="offering-name">${names[i]}</div>`;
        container.appendChild(el);
      }
    }

    // 根据 offeringLit 控制显示状态
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById('offering' + i);
      if (!el) continue;
      if (i <= this.offeringLit) {
        el.classList.add('lit');
      } else {
        el.classList.remove('lit');
      }
    }
  },

  /* ===== 记录访客行为 ===== */
  async logVisitorAction(action) {
    try {
      const logs = await DB.get('settings', 'memorial_visitor_logs') || { value: [] };
      const logEntry = {
        visitorId: this.visitorId,
        action: action,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('zh-CN')
      };

      if (!logs.value) logs.value = [];
      logs.value.push(logEntry);

      // 只保留最近1000条记录
      if (logs.value.length > 1000) {
        logs.value = logs.value.slice(-1000);
      }

      await DB.put('settings', {
        key: 'memorial_visitor_logs',
        value: logs.value
      });
    } catch (e) {
      console.error('log visitor action error:', e);
    }
  },

  async refresh() {
    await this.loadState();
    await this.loadDeceased();
    this.renderAll();
  }
};
