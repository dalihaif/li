/* ==========================================
   李氏家谱 - 数据层（GitHub API 模式）
   通过 GitHub API 读写仓库中的 JSON 数据
   ========================================== */

const DB = {
  _cache: null,
  _loaded: false,
  _saving: false,
  _saveQueue: [],

  /* ========== 初始化：从 GitHub 加载全部数据 ========== */
  async open() {
    if (this._loaded) return this._cache;
    if (!GitHubAPI.isConfigured()) {
      throw new Error('请先配置 GitHub 仓库信息（点击右上角 ⚙️ 设置）');
    }
    try {
      const data = await GitHubAPI.loadData();
      this._cache = data;
    } catch (e) {
      console.error('❌ 无法从 GitHub 加载数据:', e);
      this._cache = this._emptyData();
      throw e;
    }
    this._loaded = true;
    return this._cache;
  },

  _emptyData() {
    return { members: [], messages: [], mottos: [], notices: [], settings: {} };
  },

  /* ========== 保存队列（防止并发写入冲突） ========== */
  async _save() {
    if (this._saving) {
      // 上一次保存还没完成，等一会儿再试
      await new Promise(r => setTimeout(r, 500));
      return this._save();
    }
    this._saving = true;
    try {
      await GitHubAPI.saveData(this._cache);
      console.log('✅ 数据已保存到 GitHub');
    } catch (e) {
      console.error('❌ 保存失败:', e);
      throw e;
    } finally {
      this._saving = false;
    }
  },

  _saveAsync() {
    // 异步保存，不阻塞 UI
    setTimeout(() => this._save().catch(e => console.error('后台保存失败:', e)), 100);
  },

  /* ========== 成员操作 ========== */
  async getAll(table) {
    const data = await this.open();
    return data[table] || [];
  },

  async getById(table, id) {
    const items = await this.getAll(table);
    return items.find(item => item.id === id) || null;
  },

  async add(table, item) {
    const data = await this.open();
    if (!data[table]) data[table] = [];
    item.id = item.id || this._genId();
    item.createdAt = new Date().toISOString();
    item.updatedAt = item.createdAt;
    data[table].push(item);
    this._cache = data;
    this._saveAsync();
    return item;
  },

  async update(table, id, updates) {
    const data = await this.open();
    const idx = (data[table] || []).findIndex(item => item.id === id);
    if (idx === -1) throw new Error('记录不存在');
    updates.updatedAt = new Date().toISOString();
    Object.assign(data[table][idx], updates);
    this._cache = data;
    this._saveAsync();
    return data[table][idx];
  },

  async delete(table, id) {
    const data = await this.open();
    data[table] = (data[table] || []).filter(item => item.id !== id);
    this._cache = data;
    this._saveAsync();
  },

  /* 条件查询 */
  async find(table, where) {
    const items = await this.getAll(table);
    return items.filter(item => {
      return Object.entries(where).every(([k, v]) => item[k] === v);
    });
  },

  /* 获取家族树数据（直接返回树形结构） */
  async getTreeData() {
    const members = await this.getAll('members');
    if (!members.length) return { roots: [] };

    // 构建成员映射 + 孩子关系
    const map = {};
    members.forEach(m => {
      map[m.id] = { ...m, children: [], spouses: [] };
    });

    // 建立父子关系（去重，优先挂父亲）
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

    // 支持多配偶
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

    // 只保留一支根树（取出生最早的）
    let roots = members.filter(m => !hasParent.has(m.id)).map(m => map[m.id]);
    if (roots.length > 1) {
      roots.sort((a, b) => {
        const ya = a.birth_date ? parseInt(a.birth_date.split('-')[0]) : 9999;
        const yb = b.birth_date ? parseInt(b.birth_date.split('-')[0]) : 9999;
        return ya - yb;
      });
      roots = [roots[0]];
    }

    return { roots };
  },

  /* ========== 纪念堂状态 ========== */
  async getMemorialState() {
    const data = await this.open();
    return data.settings && data.settings.memorial_state
      ? JSON.parse(data.settings.memorial_state)
      : { candles: 0, incense: 0, wine: 0, offerings: 0, lastDate: '' };
  },

  async saveMemorialState(state) {
    const data = await this.open();
    if (!data.settings) data.settings = {};
    data.settings.memorial_state = JSON.stringify(state);
    this._cache = data;
    this._saveAsync();
  },

  /* ========== 工具方法 ========== */
  _genId() {
    return '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  /* 导出全部数据（用于备份） */
  async exportAll() {
    return await this.open();
  },

  /* 导入全部数据（覆盖） */
  async importAll(data) {
    this._cache = {
      members: data.members || [],
      messages: data.messages || [],
      mottos: data.mottos || [],
      notices: data.notices || [],
      settings: data.settings || {},
    };
    this._loaded = true;
    await this._save();
  },

  /* ========== 兼容方法（app.js 依赖这些命名） ========== */

  /* DB.put() — 有 id 则更新，无 id 则新增 */
  async put(table, item) {
    if (item.id) {
      return await this.update(table, item.id, item);
    } else {
      return await this.add(table, item);
    }
  },

  /* DB.get() — 别名，调用 getById() */
  async get(table, id) {
    return await this.getById(table, id);
  },

  /* DB.getStats() — 获取统计数据 */
  async getStats() {
    const members = await this.getAll('members');
    const total = members.length;
    const male = members.filter(m => m.gender === 'male').length;
    const female = members.filter(m => m.gender === 'female').length;
    const alive = members.filter(m => !m.death_date).length;
    const deceased = members.filter(m => m.death_date).length;
    return { total, male, female, alive, deceased };
  },

  /* DB.getLifeEvents(memberId) — 获取成员的生命事件 */
  async getLifeEvents(memberId) {
    const events = await this.getAll('lifeEvents');
    return events.filter(e => e.member_id === memberId);
  },

  /* DB.getPhotos(memberId) — 获取成员的照片 */
  async getPhotos(memberId) {
    const photos = await this.getAll('photos');
    return photos.filter(p => p.member_id === memberId);
  },

  /* DB.getMessages(memberId) — 获取成员的留言（或全部） */
  async getMessages(memberId) {
    const messages = await this.getAll('messages');
    if (memberId) {
      return messages.filter(m => m.member_id === memberId);
    }
    return messages;
  },

  /* DB.deleteAll(table) — 删除表中所有数据 */
  async deleteAll(table) {
    const data = await this.open();
    data[table] = [];
    this._cache = data;
    await this._save();
  },
};
