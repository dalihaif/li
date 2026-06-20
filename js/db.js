/* ==========================================
   李氏家谱 - API 数据层
   从服务器读取/写入数据，纯前端无本地存储
   ========================================== */

const DB = {
  // 内存缓存：所有数据存在这里
  _cache: null,
  // API 基础地址（自动适配当前域名，也可手动修改）
  _baseURL: (() => {
    // 开发环境可用 localhost:3000，生产环境自动用当前域名
    return window.location.origin + '/api';
  })(),
  _loaded: false,
  _saving: false,

  /* ========== 初始化：从服务器加载全部数据 ========== */
  async open() {
    if (this._loaded) return this._cache;
    try {
      const res = await fetch(`${this._baseURL}/data`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        this._cache = json.data;
      } else {
        this._cache = this._emptyData();
      }
    } catch (e) {
      console.error('❌ 无法连接服务器:', e);
      // 服务器不可用时，用空数据（页面仍可打开，但无法保存）
      this._cache = this._emptyData();
      this._offline = true;
    }
    this._loaded = true;
    return this._cache;
  },

  _emptyData() {
    return { members: [], messages: [], mottos: [], notices: [], settings: {} };
  },

  /* ========== 保存到服务器 ========== */
  async _save() {
    if (this._offline) {
      throw new Error('当前离线，无法保存到服务器');
    }
    if (this._saving) {
      // 上一次保存还没完成，等一会儿再试
      await new Promise(r => setTimeout(r, 300));
      return this._save();
    }
    this._saving = true;
    try {
      const res = await fetch(`${this._baseURL}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._cache)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '保存失败');
    } catch (e) {
      this._saving = false;
      throw e;
    }
    this._saving = false;
  },

  /* ========== 通用读写接口（兼容旧 IndexedDB 方法名） ========== */

  // 获取整个 store 的数据
  async getAll(storeName) {
    await this.open();
    if (storeName === 'settings') {
      // settings 是 key-value 对象，不是数组
      return this._settingsToArray(this._cache.settings || {});
    }
    return this._cache[storeName] || [];
  },

  // 按 ID 获取单条
  async get(storeName, id) {
    await this.open();
    if (storeName === 'settings') {
      const s = (this._cache.settings || {})[id];
      return s ? { key: id, value: s } : null;
    }
    const items = this._cache[storeName] || [];
    return items.find(it => it.id === id) || null;
  },

  // 写入（add 或 update 都走这个）
  async put(storeName, data) {
    await this.open();
    if (storeName === 'settings') {
      if (!this._cache.settings) this._cache.settings = {};
      this._cache.settings[data.key] = data.value;
      await this._save();
      return data;
    }
    let items = this._cache[storeName] || [];
    const idx = items.findIndex(it => it.id === data.id);
    if (idx >= 0) {
      items[idx] = data;
    } else {
      // 新数据：分配新 ID
      if (!data.id || items.some(it => it.id === data.id)) {
        const maxId = items.reduce((m, it) => Math.max(m, it.id || 0), 0);
        data.id = maxId + 1;
      }
      items.push(data);
    }
    this._cache[storeName] = items;
    await this._save();
    return data;
  },

  // 删除
  async delete(storeName, id) {
    await this.open();
    if (storeName === 'settings') {
      delete this._cache.settings[id];
      await this._save();
      return true;
    }
    let items = this._cache[storeName] || [];
    items = items.filter(it => it.id !== id);
    this._cache[storeName] = items;
    await this._save();
    return true;
  },

  // 清空 store
  async deleteAll(storeName) {
    await this.open();
    this._cache[storeName] = [];
    await this._save();
    return true;
  },

  /* ========== 索引查询（兼容旧接口） ========== */
  async getByIndex(storeName, indexName, value) {
    const items = await this.getAll(storeName);
    if (indexName === 'member_id') {
      return items.filter(it => it.member_id === value);
    }
    if (indexName === 'generation') {
      return items.filter(it => it.generation === value);
    }
    return items;
  },

  async getMembersByGeneration(gen) {
    return this.getByIndex('members', 'generation', gen);
  },

  async getLifeEvents(memberId) {
    return this.getByIndex('lifeEvents', 'member_id', memberId);
  },

  async getPhotos(memberId) {
    return this.getByIndex('photos', 'member_id', memberId);
  },

  async getMessages(memberId) {
    return this.getByIndex('messages', 'member_id', memberId);
  },

  /* ========== 设置项 ========== */
  async getSetting(key, defaultValue) {
    await this.open();
    const val = (this._cache.settings || {})[key];
    return val !== undefined ? val : defaultValue;
  },

  async setSetting(key, value) {
    await this.open();
    if (!this._cache.settings) this._cache.settings = {};
    this._cache.settings[key] = value;
    await this._save();
  },

  _settingsToArray(settingsObj) {
    return Object.entries(settingsObj || {}).map(([key, value]) => ({ key, value }));
  },

  /* ========== 家族树数据构建（前端计算，同之前逻辑） ========== */
  async getTreeData() {
    const members = await this.getAll('members');
    if (members.length === 0) return { roots: [] };

    const map = {};
    members.forEach(m => { map[m.id] = { ...m, children: [], spouses: [] }; });

    const hasParent = new Set();
    const assignedChildren = new Set();
    members.forEach(m => {
      if (assignedChildren.has(m.id)) return;
      let assigned = false;
      if (m.father_id && map[m.father_id]) {
        map[m.father_id].children.push(map[m.id]);
        hasParent.add(m.id);
        assignedChildren.add(m.id);
        assigned = true;
      }
      if (!assigned && m.mother_id && map[m.mother_id]) {
        map[m.mother_id].children.push(map[m.id]);
        hasParent.add(m.id);
        assignedChildren.add(m.id);
      }
    });

    let roots = members.filter(m => !hasParent.has(m.id)).map(m => map[m.id]);

    if (roots.length > 1) {
      roots.sort((a, b) => {
        const ya = a.birth_date ? parseInt(a.birth_date.split('-')[0]) : 9999;
        const yb = b.birth_date ? parseInt(b.birth_date.split('-')[0]) : 9999;
        return ya - yb;
      });
      roots = [roots[0]];
    }

    Object.values(map).forEach(node => {
      if (node.children.length > 0) {
        node.children.sort((a, b) => (parseInt(a.birth_order) || 99) - (parseInt(b.birth_order) || 99));
      }
    });

    members.forEach(m => {
      const spouseIds = [];
      if (m.spouse_ids && Array.isArray(m.spouse_ids)) spouseIds.push(...m.spouse_ids);
      if (m.spouse_id && !spouseIds.includes(m.spouse_id)) spouseIds.push(m.spouse_id);
      const self = map[m.id];
      spouseIds.forEach(sid => {
        if (map[sid] && !self.spouses.some(s => s.id === sid)) {
          self.spouses.push(map[sid]);
        }
      });
    });

    const extraRoots = [];
    roots.forEach((root, rootIdx) => {
      if (root.spouses && root.spouses.length > 0) {
        root.spouses.forEach(s => {
          const idx = roots.findIndex(r => r.id === s.id);
          if (idx >= 0 && idx !== rootIdx) extraRoots.push(idx);
        });
      }
    });
    [...new Set(extraRoots)].sort((a, b) => b - a).forEach(idx => { roots.splice(idx, 1); });

    return { roots };
  },

  /* ========== 统计数据 ========== */
  async getStats() {
    const members = await this.getAll('members');
    const total = members.length;
    const male = members.filter(m => m.gender === 'male').length;
    const female = members.filter(m => m.gender === 'female').length;
    const alive = members.filter(m => !m.death_date).length;
    const deceased = members.filter(m => !!m.death_date).length;
    const generations = [...new Set(members.map(m => m.generation || 1))].sort((a, b) => a - b);
    return { total, male, female, alive, deceased, generations, generationCount: generations.length };
  },

  /* ========== 日志 ========== */
  async log(action, details) {
    await this.open();
    let logs = this._cache.logs || [];
    const entry = { id: Date.now(), action, details, created_at: new Date().toISOString() };
    logs.push(entry);
    if (logs.length > 500) logs = logs.slice(-500);
    this._cache.logs = logs;
    // 日志不阻塞保存
    this._save().catch(e => {});
  },

  /* ========== 导出 / 导入 ========== */
  async exportAll() {
    await this.open();
    return { ...this._cache };
  },

  async importAll(data) {
    await this.open();
    this._cache = { ...this._emptyData(), ...data };
    await this._save();
  }
};

window.DB = DB;
