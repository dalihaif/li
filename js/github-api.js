/* ==========================================
   李氏家谱 - GitHub API 数据层
   通过 GitHub API 读写仓库中的 JSON 数据文件
   ========================================== */

const GitHubAPI = {
  // 配置（从 localStorage 读取，用户可在设置页面填写）
  _config: null,

  /* 获取配置 */
  _getConfig() {
    if (this._config) return this._config;
    try {
      const saved = localStorage.getItem('github_config');
      if (saved) {
        this._config = JSON.parse(saved);
        return this._config;
      }
    } catch (e) {}
    return null;
  },

  /* 保存配置 */
  saveConfig(config) {
    this._config = config;
    localStorage.setItem('github_config', JSON.stringify(config));
  },

  /* 是否已配置 */
  isConfigured() {
    const c = this._getConfig();
    return !!(c && c.owner && c.repo && c.token);
  },

  /* 构建请求头 */
  _headers() {
    const c = this._getConfig();
    return {
      'Authorization': `token ${c.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  },

  /* 
   * 读取文件内容
   * 返回: { content: string, sha: string }
   */
  async readFile(path) {
    const c = this._getConfig();
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}?ref=${c.branch || 'main'}`;
    const res = await fetch(url, {
      headers: { 
        'Authorization': `token ${c.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 404) return null; // 文件不存在
      throw new Error(`GitHub API 错误 ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    return { content, sha: data.sha };
  },

  /* 
   * 写入/更新文件内容
   * content: 字符串内容（会自动 base64 编码）
   * message: commit 信息
   */
  async writeFile(path, content, sha, message = '更新族谱数据') {
    const c = this._getConfig();
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`;
    
    // 正确的 Base64 编码（支持 Unicode）
    const base64Content = this._utf8ToBase64(content);
    
    const body = {
      message,
      content: base64Content,
      branch: c.branch || 'main',
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub 写入失败 ${res.status}: ${err.message || res.statusText}`);
    }
    const data = await res.json();
    return data.content.sha;
  },

  /* 
   * Unicode 字符串转 Base64（浏览器兼容）
   */
  _utf8ToBase64(str) {
    // 方法1：适用于所有现代浏览器
    if (typeof btoa !== 'undefined') {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {}
    }
    
    // 方法2：使用 TextEncoder（更现代）
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      return btoa(binary);
    }
    
    // 降级：假设是 ASCII
    return btoa(str);
  },

  /* 
   * Base64 转 Unicode 字符串（浏览器兼容）
   */
  _base64ToUtf8(base64) {
    const binaryStr = atob(base64);
    
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    
    return decodeURIComponent(escape(binaryStr));
  },

  /* 
   * 读取全部族谱数据
   * 数据文件存在仓库的 data/family.json
   */
  async loadData() {
    const result = await this.readFile('data/family.json');
    if (!result) {
      // 文件不存在，返回空数据
      return { members: [], messages: [], mottos: [], notices: [], settings: {} };
    }
    return JSON.parse(result.content);
  },

  /* 
   * 保存全部族谱数据
   */
  async saveData(data) {
    const result = await this.readFile('data/family.json');
    const sha = result ? result.sha : null;
    const content = JSON.stringify(data, null, 2);
    await this.writeFile('data/family.json', content, sha, '更新族谱数据');
  },

  /* 验证 Token 是否有效 */
  async verifyToken() {
    const c = this._getConfig();
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}`;
    const res = await fetch(url, {
      headers: { 
        'Authorization': `token ${c.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    return res.ok;
  },
};
