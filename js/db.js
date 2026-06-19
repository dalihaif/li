/* ==========================================
   李氏家谱 - IndexedDB 数据层
   纯前端数据持久化，替换 Flask + SQLite
   ========================================== */

const DB_NAME = 'LiFamilyTree';
const DB_VERSION = 3;

const STORES = {
  members: { keyPath: 'id', autoIncrement: true },
  mottos: { keyPath: 'id', autoIncrement: true },
  notices: { keyPath: 'id', autoIncrement: true },
  logs: { keyPath: 'id', autoIncrement: true },
  lifeEvents: { keyPath: 'id', autoIncrement: true },
  messages: { keyPath: 'id', autoIncrement: true },
  photos: { keyPath: 'id', autoIncrement: true },
  settings: { keyPath: 'key' }
};

const DB = {
  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        Object.entries(STORES).forEach(([name, spec]) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, spec);
          }
        });
        const ms = e.target.transaction.objectStore('members');
        if (!ms.indexNames.contains('generation'))
          ms.createIndex('generation', 'generation');
        if (!ms.indexNames.contains('spouse_id'))
          ms.createIndex('spouse_id', 'spouse_id');
        const les = e.target.transaction.objectStore('lifeEvents');
        if (!les.indexNames.contains('member_id'))
          les.createIndex('member_id', 'member_id');
        const ps = e.target.transaction.objectStore('photos');
        if (!ps.indexNames.contains('member_id'))
          ps.createIndex('member_id', 'member_id');
        const mes = e.target.transaction.objectStore('messages');
        if (!mes.indexNames.contains('member_id'))
          mes.createIndex('member_id', 'member_id');
      };
      req.onsuccess = e => {
        this._db = e.target.result;
        resolve(this._db);
      };
      req.onerror = e => reject(e.target.error);
    });
  },

  async _tx(storeName, mode, callback) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      callback(store, resolve, reject);
      tx.onerror = e => reject(e.target.error);
      tx.oncomplete = () => resolve();
    });
  },

  async getAll(storeName) {
    return this._tx(storeName, 'readonly', (store, resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  },

  async get(storeName, id) {
    return this._tx(storeName, 'readonly', (store, resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
    });
  },

  async put(storeName, data) {
    return this._tx(storeName, 'readwrite', (store, resolve, reject) => {
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    return this._tx(storeName, 'readwrite', (store, resolve) => {
      store.delete(id);
      resolve(true);
    });
  },

  async deleteAll(storeName) {
    return this._tx(storeName, 'readwrite', (store, resolve) => {
      store.clear();
      resolve(true);
    });
  },

  async getByIndex(storeName, indexName, value) {
    return this._tx(storeName, 'readonly', (store, resolve) => {
      const idx = store.index(indexName);
      const req = idx.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
    });
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

  async getSetting(key, defaultValue) {
    const val = await this.get('settings', key);
    return val ? val.value : defaultValue;
  },

  async setSetting(key, value) {
    await this.put('settings', { key, value });
  },

  async getTreeData() {
    const members = await this.getAll('members');
    if (members.length === 0) return { roots: [] };
    const map = {};
    members.forEach(m => { map[m.id] = { ...m, children: [], spouses: [] }; });
    // 构建父子关系（用 hasParent 判断根节点，逻辑更清晰）
    const hasParent = new Set();
    members.forEach(m => {
      if (m.father_id && map[m.father_id]) {
        map[m.father_id].children.push(map[m.id]);
        hasParent.add(m.id);
      } else if (m.mother_id && map[m.mother_id]) {
        map[m.mother_id].children.push(map[m.id]);
        hasParent.add(m.id);
      }
    });
    const roots = members.filter(m => !hasParent.has(m.id)).map(m => map[m.id]);
    // 按出生顺序排序子女
    Object.values(map).forEach(node => {
      if (node.children.length > 0) {
        node.children.sort((a, b) => (parseInt(a.birth_order) || 99) - (parseInt(b.birth_order) || 99));
      }
    });
    // 处理配偶关系
    members.forEach(m => {
      if (m.spouse_id && map[m.spouse_id]) {
        const self = map[m.id];
        const spouse = map[m.spouse_id];
        if (!self.spouses.some(s => s.id === spouse.id)) {
          self.spouses.push(spouse);
        }
      }
    });
    return { roots };
  },

  async getStats() {
    const members = await this.getAll('members');
    const total = members.length;
    const male = members.filter(m => m.gender === 'male').length;
    const female = members.filter(m => m.gender === 'female').length;
    const alive = members.filter(m => !m.death_date).length;
    const deceased = members.filter(m => !!m.death_date).length;
    const generations = [...new Set(members.map(m => m.generation || 1))].sort((a,b)=>a-b);
    return { total, male, female, alive, deceased, generations, generationCount: generations.length };
  },

  async log(action, details) {
    await this.put('logs', { action, details, created_at: new Date().toISOString() });
    // 限制日志上限 500 条，超出则删除最旧的
    const all = await this.getAll('logs');
    if (all.length > 500) {
      const sorted = all.sort((a,b) => (a.id||0) - (b.id||0));
      const toRemove = sorted.slice(0, all.length - 500);
      for (const r of toRemove) await this.delete('logs', r.id);
    }
  },

  async exportAll() {
    const data = {};
    for (const name of Object.keys(STORES)) {
      data[name] = await this.getAll(name);
    }
    return data;
  },

  async importAll(data) {
    for (const [name, items] of Object.entries(data)) {
      if (STORES[name]) {
        await this.deleteAll(name);
        for (const item of items) {
          await this.put(name, item);
        }
      }
    }
  }
};

window.DB = DB;

