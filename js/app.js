/* === === === === === === === === === === === === === === === === =
   鏉庢皬瀹惰氨 - 涓诲簲鐢ㄩ€昏緫锛堝畬鏁寸増锛?
   椤甸潰璺敱銆丆RUD銆佹暟鎹姞杞姐€乁I 娓叉煋
   === === === === === === === === === === === === === === === === = */

const App = {
  currentPage: 'dashboard',
  currentMember: null,
  selectedFatherId: null,
  selectedMotherId: null,
  selectedSpouseId: null,
  _deleteId: null,
  _lifeEventDeleteId: null,
  _photoDeleteId: null,
  _messageDeleteId: null,
  _mottoDeleteId: null,
 _noticeDeleteId: null,
  _avatarData: null,

  showToast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + (type || 'success');
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 2500);
  },

  calcAge(birthDate, deathDate) {
    if (!birthDate) return '?';
    const start = new Date(birthDate);
    const end = deathDate ? new Date(deathDate) : new Date();
    let y = end.getFullYear() - start.getFullYear();
    const m = end.getMonth() - start.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < start.getDate())) y--;
    return y >= 0 ? y : '?';
  },

  getAvatar(name) { return name ? name.charAt(0) : '?'; },
  genderLabel(g) { return g === 'male' ? '\u7537' : '\u5973'; },

  esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function(c) {
      if (c === '&') return '&amp;';
      if (c === '<') return '&lt;';
      if (c === '>') return '&gt;';
      return '&quot;';
    });
  },

  compressImage(dataUrl, maxW, quality) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  },

  // ========== 本地访问统计 (PV/UV) ==========
  _initLocalStats() {
    try {
      // PV: 每次页面加载 +1
      let pv = parseInt(localStorage.getItem('ls_pv') || '0', 10);
      pv += 1;
      localStorage.setItem('ls_pv', String(pv));

      // UV: 按天去重，当天首次访问 +1
      const today = this._todayStr();
      const lastDate = localStorage.getItem('ls_uv_date') || '';
      let uv = parseInt(localStorage.getItem('ls_uv') || '0', 10);
      if (lastDate !== today) {
        uv += 1;
        localStorage.setItem('ls_uv', String(uv));
        localStorage.setItem('ls_uv_date', today);
      }

      // 更新页面显示
      const elPv = document.getElementById('localPv');
      const elUv = document.getElementById('localUv');
      if (elPv) elPv.textContent = pv;
      if (elUv) elUv.textContent = uv;
    } catch (e) {
      // localStorage 不可用时静默失败
    }
  },

  _todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  // ================ Navigation ================

  navigateTo(pageId) {
    const pageMap = {
      'dashboard': 'index.html',
      'members': 'members.html',
      'tree': 'tree.html',
      'memorial': 'memorial.html',
      'lifeEvents': 'life-events.html',
      'photos': 'photos.html',
      'messages': 'messages.html',
      'mottos': 'mottos.html',
      'notices': 'notices.html',
      'stats': 'stats.html'
    };
    window.location.href = pageMap[pageId] || 'index.html';
  },

  refreshAll() {
    this.loadDashboard();
    this.showToast('\u5df2\u5237\u65b0', 'info');
  },

  // ================ Dashboard ================

  async loadDashboard() {
    try {
      const stats = await DB.getStats();
      const ids = ['statTotal','statMale','statFemale','statAlive','statDeceased'];
      const vals = [stats.total, stats.male, stats.female, stats.alive, stats.deceased];
      ids.forEach((id,i) => {
        const el = document.getElementById(id);
        if (el) el.textContent = vals[i];
      });
      await this.loadRecentMembers();
    } catch(e) { console.error('loadDashboard error:', e); }
      try { await this.loadGenerationPoem(); } catch(e) { console.error('loadGenerationPoem error:', e); }
  },

  async loadGenerationPoem() {
    // 从 IndexedDB 加载辈分诗和祖籍信息（不渲染到UI，仅缓存）
    try {
      this._generationPoem = (await DB.get('settings', 'generation_poem'))?.value || '';
      this._ancestralHome = (await DB.get('settings', 'ancestral_home'))?.value || '';
    } catch(e) { /* 静默失败 */ }
  },

  async loadRecentMembers() {
    const container = document.getElementById('recentMembers');
    if (!container) return;
    try {
      const members = await DB.getAll('members');
      if (members.length === 0) return;
      const sorted = members.sort((a,b) => (b.id||0) - (a.id||0)).slice(0, 6);
      container.innerHTML = sorted.map(m => {
        const gender = m.gender === 'female' ? 'female' : 'male';
        const genLabel = (m.generation || '?') + '\u4ee3';
        const age = this.calcAge(m.birth_date, m.death_date);
        const ageStr = age !== '?' ? age + '\u5c81' : '?';
        return '<div class="member-card" onclick="App.showMemberDetail(' + m.id + ')">' +
          '<div class="member-avatar ' + gender + '">' + this.getAvatar(m.name) + '</div>' +
          '<div class="member-info">' +
          '<div class="member-name">' + this.esc(m.name) + '</div>' +
          '<div class="member-meta">' + genLabel + ' \u00b7 ' + ageStr + '</div>' +
          '<div class="member-tags">' +
          '<span class="tag ' + (gender==='male'?'tag-male':'tag-female') + '">' + this.genderLabel(m.gender) + '</span>' +
          (m.death_date ? '<span class="tag tag-deceased">\u6545</span>' : '') +
          '</div></div></div>';
      }).join('');
    } catch(e) { console.error('loadRecentMembers error:', e); }
  },

  // ================ Navigation binding ================

  bindNavEvents() {
    const brand = document.getElementById('navBrand');
    if (brand) brand.addEventListener('click', () => this.navigateTo('dashboard'));
    document.querySelectorAll('.navbar-nav a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        this.navigateTo(a.dataset.page);
      });
    });
  },

  // ================ Member List ================

  async loadMembers() {
    const container = document.getElementById('memberList');
    if (!container) return;
    try {
      const members = await DB.getAll('members');
      const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
      const genderFilter = document.querySelector('#memberFilters [data-group="gender"].active')?.dataset?.value || 'all';
      const aliveFilter = document.querySelector('#memberFilters [data-group="alive"].active')?.dataset?.value || 'all';

      let filtered = members.filter(m => {
        if (genderFilter !== 'all' && m.gender !== genderFilter) return false;
        if (aliveFilter === 'alive' && m.death_date) return false;
        if (aliveFilter === 'deceased' && !m.death_date) return false;
        if (searchVal) {
          const haystack = ((m.name||'') + (m.address||'') + (m.bio||'')).toLowerCase();
          if (!haystack.includes(searchVal)) return false;
        }
        return true;
      });
      filtered.sort((a,b) => (a.generation||99) - (b.generation||99) || (b.id||0) - (a.id||0));

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">\u65cf</div><h4>\u6ca1\u6709\u5339\u914d\u7684\u6210\u5458</h4><p>\u8bf7\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u6216\u6dfb\u52a0\u65b0\u6210\u5458</p></div>';
        return;
      }
      container.innerHTML = filtered.map(m => {
        const gender = m.gender === 'female' ? 'female' : 'male';
        const genLabel = (m.generation || '?') + '\u4ee3';
        const age = this.calcAge(m.birth_date, m.death_date);
        return '<div class="member-card" onclick="App.showMemberDetail(' + m.id + ')">' +
          '<div class="member-avatar ' + gender + '">' + this.getAvatar(m.name) + '</div>' +
          '<div class="member-info">' +
          '<div class="member-name">' + this.esc(m.name) + '</div>' +
          '<div class="member-meta">' + genLabel + ' \u00b7 ' + (age!=='?'?age+'\u5c81':'?') + '</div>' +
          '<div class="member-tags">' +
          '<span class="tag ' + (gender==='male'?'tag-male':'tag-female') + '">' + this.genderLabel(m.gender) + '</span>' +
          (m.death_date ? '<span class="tag tag-deceased">\u6545</span>' : '') +
          '</div></div></div>';
      }).join('');
    } catch(e) { console.error('loadMembers error:', e); }
  },

  // ================ Member form (add/edit) ================

  async showMemberForm(id) {
    this.selectedFatherId = null;
    this.selectedMotherId = null;
    this.selectedSpouseId = null;
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    if (!overlay) return;

    const resetForm = () => {
      const safeVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      safeVal('formId', '');
      safeVal('formName', ''); safeVal('formGender', 'male');
      safeVal('formGeneration', ''); safeVal('formBirthOrder', '');
      safeVal('formEthnicity', '汉族'); safeVal('formBirthDate', '');
      safeVal('formDeathDate', ''); safeVal('formEducation', '');
      safeVal('formCareer', ''); safeVal('formPhone', '');
      safeVal('formAddress', ''); safeVal('formBio', '');
      safeVal('formCourtesyName', '');
      safeVal('formArtName', '');
      safeVal('formAncestralHome', '');
      safeVal('formGenerationPoem', '');
      safeVal('formBurialSite', '');
      const av = document.getElementById('avatarPreview');
      if (av) { av.className = 'member-avatar male'; av.textContent = '?'; av.style.backgroundImage = ''; }
      this._avatarData = null;
    };

    // 隐藏详情弹窗，防止遮住编辑表单（两者 z-index 相同，详情弹窗 DOM 靠后）
    const detailOverlay = document.getElementById('detailModalOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';

    if (id) {
      title.textContent = '\u7f16\u8f91\u6210\u5458';
      try {
        const member = await DB.get('members', id);
        if (!member) { this.showToast('\u6210\u5458\u4e0d\u5b58\u5728', 'error'); return; }
        this.currentMember = member;
        document.getElementById('formId').value = id;
        document.getElementById('formName').value = member.name || '';
        document.getElementById('formGender').value = member.gender || 'male';
        document.getElementById('formGeneration').value = member.generation || '';
        document.getElementById('formBirthOrder').value = member.birth_order || '';
        document.getElementById('formEthnicity').value = member.ethnicity || '\u6c49\u65cf';
        document.getElementById('formBirthDate').value = member.birth_date || '';
        document.getElementById('formDeathDate').value = member.death_date || '';
        document.getElementById('formEducation').value = member.education || '';
        document.getElementById('formCareer').value = member.career || '';
        document.getElementById('formPhone').value = member.phone || '';
        document.getElementById('formAddress').value = member.address || '';
        document.getElementById('formBio').value = member.bio || '';
        // 传统文化字段
        document.getElementById('formCourtesyName').value = member.courtesy_name || '';
        document.getElementById('formArtName').value = member.art_name || '';
        document.getElementById('formAncestralHome').value = member.ancestral_home || '';
        document.getElementById('formGenerationPoem').value = member.generation_poem || '';
        document.getElementById('formBurialSite').value = member.burial_site || '';
        this.selectedFatherId = member.father_id || null;
        this.selectedMotherId = member.mother_id || null;
        this.selectedSpouseId = member.spouse_id || null;
       const gender = (member.gender === 'female') ? 'female' : 'male';
       document.getElementById('avatarPreview').className = 'member-avatar ' + gender;
       document.getElementById('avatarPreview').textContent = this.getAvatar(member.name);
        // Restore avatar image
        if (member.avatar) {
          document.getElementById('avatarPreview').style.backgroundImage = 'url(' + member.avatar + ')';
          document.getElementById('avatarPreview').style.backgroundSize = 'cover';
          document.getElementById('avatarPreview').style.backgroundPosition = 'center';
          document.getElementById('avatarPreview').textContent = '';
          this._avatarData = member.avatar;
        } else {
          this._avatarData = null;
        }
        this.updateRelationLabel('father');
        this.updateRelationLabel('mother');
        this.updateRelationLabel('spouse');
      } catch(e) { this.showToast('\u52a0\u8f7d\u6210\u5458\u5931\u8d25', 'error'); return; }
    } else {
      title.textContent = '\u6dfb\u52a0\u6210\u5458';
      this.currentMember = null;
      resetForm();
      this.updateRelationLabel('father');
      this.updateRelationLabel('mother');
      this.updateRelationLabel('spouse');
    }
    overlay.style.display = 'flex';
  },

  async saveMember(e) {
    e.preventDefault();
    const name = document.getElementById('formName').value.trim();
    if (!name) { this.showToast('\u59d3\u540d\u4e0d\u80fd\u4e3a\u7a7a', 'error'); return; }
    const id = document.getElementById('formId').value;
    const data = {
      name: name,
      gender: document.getElementById('formGender').value,
      generation: parseInt(document.getElementById('formGeneration').value) || 1,
      birth_order: document.getElementById('formBirthOrder').value,
      ethnicity: document.getElementById('formEthnicity').value,
      birth_date: document.getElementById('formBirthDate').value || null,
      death_date: document.getElementById('formDeathDate').value || null,
      education: document.getElementById('formEducation').value,
      career: document.getElementById('formCareer').value,
      phone: document.getElementById('formPhone').value,
      address: document.getElementById('formAddress').value,
      bio: document.getElementById('formBio').value,
      // 传统文化字段
      courtesy_name: document.getElementById('formCourtesyName').value,
      art_name: document.getElementById('formArtName').value,
      ancestral_home: document.getElementById('formAncestralHome').value,
      generation_poem: document.getElementById('formGenerationPoem').value,
      burial_site: document.getElementById('formBurialSite').value,
      father_id: this.selectedFatherId || null,
      mother_id: this.selectedMotherId || null,
      spouse_id: this.selectedSpouseId || null,
      avatar: this._avatarData || null
    };

    // 将空字符串转换为 null
    data.father_id = data.father_id || null;
    data.mother_id = data.mother_id || null;
    data.spouse_id = data.spouse_id || null;
    data.birth_date = data.birth_date || null;
    data.death_date = data.death_date || null;

    // ========== 数据验证 ==========
    // 1. 出生日期不能晚于逝世日期
    if (data.birth_date && data.death_date) {
      if (data.birth_date > data.death_date) {
        this.showToast('出生日期不能晚于逝世日期', 'error');
        return;
      }
    }
    // 2. 防止循环亲属关系（不能选择自己的后代作为父母/配偶）
    if (id) {
      const cyclicCheck = await this._checkCircularRelation(parseInt(id), data.father_id, data.mother_id, data.spouse_id);
      if (cyclicCheck) {
        this.showToast(cyclicCheck, 'error');
        return;
      }
    }
    // ========== 验证结束 ==========

    if (id) data.id = parseInt(id);
    try {
      await DB.put('members', data);
      this.closeModal();
      this.showToast(id ? '\u6210\u5458\u5df2\u66f4\u65b0' : '\u6210\u5458\u5df2\u6dfb\u52a0', 'success');
      await DB.log(id ? '\u66f4\u65b0\u6210\u5458' : '\u6dfb\u52a0\u6210\u5458', name);
      this.loadDashboard();
      this.loadMembers();
      // 编辑保存后，刷新详情弹窗显示最新数据
      if (id) {
        try { await this.showMemberDetail(parseInt(id)); } catch(e) {}
      }
      } catch(e) {
      this.showToast('\u4fdd\u5b58\u5931\u8d25\uff1a' + (e.message || e), 'error');
      console.error('saveMember error:', e);
    }
  },


  // 检查循环亲属关系（防止设置自己的后代为父母）
  async _checkCircularRelation(memberId, fatherId, motherId, spouseId) {
    if (fatherId && fatherId === memberId) return '不能选择自己作为父亲';
    if (motherId && motherId === memberId) return '不能选择自己作为母亲';
    if (spouseId && spouseId === memberId) return '不能选择自己作为配偶';
    if (fatherId) {
      const isDescendant = await this._isDescendant(memberId, fatherId);
      if (isDescendant) return '不能选择自己的后代作为父亲';
    }
    if (motherId) {
      const isDescendant = await this._isDescendant(memberId, motherId);
      if (isDescendant) return '不能选择自己的后代作为母亲';
    }
    return null;
  },

  // 检查 targetId 是否是 memberId 的后代（防止选后代做父母）
  // 例：memberId=当前成员，targetId=选中的父亲
  //     如果父亲是_memberId_ 的后代（即晚辈），则返回 true（非法）
  async _isDescendant(memberId, targetId) {
    const allMembers = await DB.getAll('members');

    const visited = new Set();
    const queue = [memberId];  // 从自己开始，向下遍历所有后代
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === targetId) return true;  // targetId 是后代 → 非法
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      // 找 currentId 的所有子女
      const children = allMembers.filter(m => m.father_id === currentId || m.mother_id === currentId);
      for (const child of children) queue.push(child.id);
    }
    return false;  // targetId 不是后代 → 合法
  },

  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'none';
    this.currentMember = null;
    // 注意：不清除 _deleteId，因为它属于详情弹窗，可能在编辑保存后仍需用于删除操作
  },

  // ================ Member detail ================

  async showMemberDetail(id) {
    window.currentDetailId = id; // 存储当前查看的成员 ID
  
    try {
      const member = await DB.get('members', id);
      if (!member) { this.showToast('\u6210\u5458\u4e0d\u5b58\u5728', 'error'); return; }
      this.currentMember = member;
      this._deleteId = id;
      const overlay = document.getElementById('detailModalOverlay');
      if (!overlay) return;
      overlay.style.display = 'flex';
      const gender = (member.gender === 'female') ? 'female' : 'male';
     document.getElementById('detailAvatar').className = 'detail-avatar ' + gender;
     document.getElementById('detailAvatar').textContent = this.getAvatar(member.name);
      if (member.avatar) {
        document.getElementById('detailAvatar').style.backgroundImage = 'url(' + member.avatar + ')';
        document.getElementById('detailAvatar').style.backgroundSize = 'cover';
        document.getElementById('detailAvatar').style.backgroundPosition = 'center';
        document.getElementById('detailAvatar').textContent = '';
      } else {
        document.getElementById('detailAvatar').style.backgroundImage = '';
      }
      document.getElementById('detailName').textContent = member.name || '\u2014';
      document.getElementById('detailGenderTag').textContent = this.genderLabel(member.gender);
      document.getElementById('detailGenderTag').className = 'tag ' + (gender==='male'?'tag-male':'tag-female');
      document.getElementById('detailGenerationTag').textContent = (member.generation || '?') + '\u4ee3';
      const age = this.calcAge(member.birth_date, member.death_date);
      document.getElementById('detailAgeTag').textContent = age !== '?' ? age + '\u5c81' : '?\u5c81';
      document.getElementById('detailBirthDate').textContent = member.birth_date || '\u2014';
      document.getElementById('detailDeathDate').textContent = member.death_date || '\u2014';
      document.getElementById('detailBirthOrder').textContent = member.birth_order || '\u2014';
      document.getElementById('detailEthnicity').textContent = member.ethnicity || '\u2014';
      document.getElementById('detailEducation').textContent = member.education || '\u2014';
      document.getElementById('detailCareer').textContent = member.career || '\u2014';
      document.getElementById('detailPhone').textContent = member.phone || '\u2014';
      document.getElementById('detailAddress').textContent = member.address || '\u2014';
      document.getElementById('detailBio').textContent = member.bio || '\u2014';

      // 传统文化字段
      document.getElementById('detailCourtesyName').textContent = member.courtesy_name || '\u2014';
      document.getElementById('detailArtName').textContent = member.art_name || '\u2014';
      document.getElementById('detailAncestralHome').textContent = member.ancestral_home || '\u2014';
      document.getElementById('detailGenerationPoem').textContent = member.generation_poem || '\u2014';
      document.getElementById('detailBurialSite').textContent = member.burial_site || '\u2014';

      const relContainer = document.getElementById('detailRelations');
      let relHtml = '';
      if (member.father_id) {
        try {
          const f = await DB.get('members', member.father_id);
          if (f) relHtml += '<div class="relation-item"><span style="color:var(--male);font-weight:600;">\u7236</span> ' + this.esc(f.name) + '</div>';
        } catch(e) {}
      }
      if (member.mother_id) {
        try {
          const m = await DB.get('members', member.mother_id);
          if (m) relHtml += '<div class="relation-item"><span style="color:var(--female);font-weight:600;">\u6bcd</span> ' + this.esc(m.name) + '</div>';
        } catch(e) {}
      }
      if (member.spouse_id) {
        try {
          const s = await DB.get('members', member.spouse_id);
          if (s) {
            const label = member.gender === 'male' ? '\u59bb' : '\u592b';
            relHtml += '<div class="relation-item"><span style="color:var(--gold-dark);font-weight:600;">' + label + '</span> ' + this.esc(s.name) + '</div>';
          }
        } catch(e) {}
      }
      try {
        const all = await DB.getAll('members');
        const children = all.filter(m => m.father_id === id || m.mother_id === id);
        children.forEach(c => {
          relHtml += '<div class="relation-item"><span style="color:var(--cinnabar);font-weight:600;">\u5b50\u5973</span> ' + this.esc(c.name) + '</div>';
        });
      } catch(e) {}
      relContainer.innerHTML = relHtml || '<div style="font-size:0.85rem;color:var(--text-muted);">\u6682\u65e0\u8bb0\u5f55</div>';

      try {
        const events = await DB.getLifeEvents(id);
        const evtContainer = document.getElementById('detailLifeEvents');
        if (events.length === 0) {
          evtContainer.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);">\u6682\u65e0\u8bb0\u5f55</div>';
        } else {
          evtContainer.innerHTML = events.sort((a,b) => (a.event_date||'').localeCompare(b.event_date||''))
            .map(e => '<div style="padding:4px 0;border-bottom:1px solid var(--border-light);">' +
              '<span style="color:var(--text-muted);font-size:0.75rem;">' + (e.event_date||'') + '</span> ' +
              '<span style="color:var(--text-primary);font-weight:500;">' + this.esc(e.title) + '</span></div>').join('');
        }
      } catch(e) { console.error(e); }
    } catch(e) { this.showToast('\u52a0\u8f7d\u5931\u8d25', 'error'); }
  },

  closeDetailModal() {
    const overlay = document.getElementById('detailModalOverlay');
    if (overlay) overlay.style.display = 'none';
    this.currentMember = null;
    this._deleteId = null;
  },

  async deleteCurrentMember() {
    const id = this._deleteId;
    if (!id) return;
    if (!confirm('\u786e\u5b9a\u8981\u5220\u9664\u8be5\u6210\u5458\u5417\uff1f\u8be5\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002')) return;
    try {
      const member = this.currentMember;

      // \u7ea7\u8054\uff1a\u5220\u9664\u5173\u8054\u7684\u751f\u547d\u4e8b\u4ef6
      const events = await DB.getLifeEvents(id);
      for (const evt of events) await DB.delete('lifeEvents', evt.id);

      // \u7ea7\u8054\uff1a\u5220\u9664\u5173\u8054\u7684\u7167\u7247
      const photos = await DB.getPhotos(id);
      for (const photo of photos) await DB.delete('photos', photo.id);

      // \u7ea7\u8054\uff1a\u5220\u9664\u5173\u8054\u7684\u7559\u8a00
      const msgs = await DB.getMessages(id);
      for (const msg of msgs) await DB.delete('messages', msg.id);

      // \u7ea7\u8054\uff1a\u6e05\u9664\u914d\u5076\u7684\u914d\u5076\u5173\u7cfb
      if (member && member.spouse_id) {
        const spouse = await DB.get('members', member.spouse_id);
        if (spouse) {
          delete spouse.spouse_id;
          await DB.put('members', spouse);
        }
      }

      // \u7ea7\u8054\uff1a\u6e05\u9664\u5176\u4ed6\u6210\u5458\u4e2d\u5bf9\u6b64\u4eba\u7684\u5f15\u7528
      const all = await DB.getAll('members');
      for (const m of all) {
        if (m.father_id === id || m.mother_id === id || m.spouse_id === id) {
          if (m.father_id === id) delete m.father_id;
          if (m.mother_id === id) delete m.mother_id;
          if (m.spouse_id === id) delete m.spouse_id;
          await DB.put('members', m);
        }
      }

      await DB.delete('members', id);
      this.closeDetailModal();
      this.showToast('\u5df2\u5220\u9664\uff08\u542b\u5173\u8054\u6570\u636e\uff09', 'success');
      await DB.log('\u5220\u9664\u6210\u5458', member ? member.name : 'id:'+id);
      this.loadDashboard();
      this.loadMembers();
      FamilyTree.refresh();
    } catch(e) { this.showToast('\u5220\u9664\u5931\u8d25', 'error'); }
  },

  // ================ Reset Database ================

  async resetDB() {
    if (!confirm('确定要重置数据库吗？这将清空所有数据，且不可恢复！')) return;
    if (!confirm('再次确认：清空所有族谱数据？')) return;
    try {
      this.showToast('正在重置数据库...', 'info');
      // 使用 deleteAll 清空所有对象存储
      const storeNames = ['members', 'messages', 'mottos', 'notices', 'settings', 'life_events', 'photos', 'logs'];
      for (const storeName of storeNames) {
        try {
          await DB.deleteAll(storeName);
        } catch(e) {
          // 如果某个store不存在，继续清除其他store
          console.log('Clear ' + storeName + ' failed:', e);
        }
      }
      this.showToast('数据库已重置，页面将刷新...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      this.showToast('重置失败: ' + e.message, 'error');
    }
  },

  // ================ Relation picker ================

  async openRelationPicker(role) {
    const container = document.getElementById('relationPicker_' + role);
    if (!container) return;
    const isVisible = container.style.display !== 'none';
    if (isVisible) { container.style.display = 'none'; return; }
    try {
      const members = await DB.getAll('members');
      container.style.display = 'block';
      container.innerHTML = '<div class="relation-picker">' +
        members.filter(m => !this.currentMember || m.id !== this.currentMember.id).map(m =>
          '<div class="relation-picker-item" data-role="' + role + '" data-id="' + m.id + '">' +
          this.esc(m.name) + ' (' + (m.generation||'?') + '\u4ee3' + ', ' + this.genderLabel(m.gender) + ')</div>'
        ).join('') + '</div>';
      container.querySelectorAll('.relation-picker-item').forEach(el => {
        el.addEventListener('click', () => {
          const rid = parseInt(el.dataset.id);
          if (role === 'father') this.selectedFatherId = rid;
          else if (role === 'mother') this.selectedMotherId = rid;
          else if (role === 'spouse') this.selectedSpouseId = rid;
          this.updateRelationLabel(role);
          container.style.display = 'none';
        });
      });
    } catch(e) { console.error(e); }
  },

  async updateRelationLabel(role) {
    const label = document.getElementById(role + 'Label');
    if (!label) return;
    let id = null;
    if (role === 'father') id = this.selectedFatherId;
    else if (role === 'mother') id = this.selectedMotherId;
    else if (role === 'spouse') id = this.selectedSpouseId;
    if (id) {
      try {
        const m = await DB.get('members', id);
        label.innerHTML = m ? '<span style="color:var(--text-primary);font-weight:500;">' + this.esc(m.name) + '</span>' : '<span style="color:var(--text-muted);">\u672a\u9009\u62e9</span>';
      } catch(e) { label.innerHTML = '<span style="color:var(--text-muted);">\u672a\u9009\u62e9</span>'; }
    } else {
      label.innerHTML = '<span style="color:var(--text-muted);">\u672a\u9009\u62e9</span>';
    }
  },

  clearRelation(role) {
    if (role === 'father') this.selectedFatherId = null;
    else if (role === 'mother') this.selectedMotherId = null;
    else if (role === 'spouse') this.selectedSpouseId = null;
    this.updateRelationLabel(role);
  },

  handleAvatar() {
   const input = document.getElementById('avatarUpload');
   const preview = document.getElementById('avatarPreview');
   if (!input || !preview) return;
   input.addEventListener('change', () => {
     const file = input.files[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = async e => {
       const compressed = await this.compressImage(e.target.result, 200, 0.8);
       preview.style.backgroundImage = 'url(' + compressed + ')';
       preview.style.backgroundSize = 'cover';
       preview.style.backgroundPosition = 'center';
       preview.textContent = '';
        this._avatarData = compressed;
     };
     reader.readAsDataURL(file);
   });
 },

  // ================ Memorial Hall ================

  async loadMemorial() {
    const container = document.getElementById('ancestorTablets');
    if (!container) return;
    try {
      const members = await DB.getAll('members');
      const deceased = members.filter(m => m.death_date).sort((a,b) => (a.generation||1)-(b.generation||1));
      if (deceased.length === 0) {
        container.innerHTML = '<div class="no-ancestors">\u6682\u65e0\u5df2\u6545\u5148\u7956\u8bb0\u5f55\uff0c\u8bf7\u5148\u6dfb\u52a0\u6210\u5458\u4fe1\u606f</div>';
        return;
      }
      container.innerHTML = deceased.map(m => {
        return '<div class="tablet ' + (m.gender==='female'?'tablet-female':'tablet-male') + '" onclick="App.showMemberDetail(' + m.id + ')">' +
          '<div class="tablet-name">' + this.esc(m.name) + '</div>' +
          '<div class="tablet-generation">' + (m.generation||'?') + '\u4ee3\u79c4' + '</div>' +
          '<div class="tablet-dates">' + (m.birth_date||'?') + ' \u2014 ' + (m.death_date||'?') + '</div>' +
          '<div class="tablet-actions">' +
          '<button class="tablet-btn" onclick="event.stopPropagation();App.showMemberDetail(' + m.id + ')">\u796d</button>' +
          '</div></div>';
      }).join('');
      Effects.startCandleGlow();
      Effects.startEmberGlow();
    } catch(e) { console.error('loadMemorial error:', e); }
  },

  // ========== 留言 ==========

  loadMessages() {
    const board = document.getElementById('messageBoard');
    if (!board) return;
    DB.getAll('messages').then(messages => {
      if (!messages || messages.length === 0) {
        board.innerHTML = '<div class="empty-state"><div class="empty-icon">言</div><h4>暂无留言</h4><p>写下对先祖的追思寄语</p></div>';
        return;
      }
      messages.sort((a,b) => (b.created_at || b.id || 0) - (a.created_at || a.id || 0));
      board.innerHTML = messages.map(m => `
        <div class="msg-item" style="padding:16px;border-bottom:1px solid rgba(139,69,19,0.15);margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="color:#8B0000;">${this._esc(m.author || '匿名')}</strong>
            <small style="color:#999;">${this._fmtDate(m.created_at)}</small>
          </div>
          <p style="color:#4a3728;line-height:1.8;">${this._esc(m.content || '')}</p>
          <button class="btn btn-sm" style="color:#c0392b;padding:4px 8px;font-size:12px;"
            onclick="App.deleteMsg(${m.id})">删除</button>
        </div>
      `).join('');
    }).catch(e => console.error('loadMessages error:', e));
  },

  saveMessage(e) {
    e.preventDefault();
    const author = document.getElementById('msgAuthor')?.value?.trim();
    const content = document.getElementById('msgContent')?.value?.trim();
    if (!content) { this.showToast('请输入留言内容', 'warn'); return; }
    DB.put('messages', { author: author || '匿名', content, created_at: new Date().toISOString() })
      .then(() => {
        this.showToast('留言已提交');
        document.getElementById('messageModalOverlay').style.display = 'none';
        document.getElementById('formMessage').reset();
        this.loadMessages();
      }).catch(e => this.showToast('提交失败: ' + e.message, 'error'));
  },

  deleteMsg(id) {
    if (!confirm('确定删除该留言？')) return;
    DB.delete('messages', id).then(() => {
      this.showToast('留言已删除');
      this.loadMessages();
    }).catch(e => this.showToast('删除失败: ' + e.message, 'error'));
  },

  // ========== 家训 ==========

  loadMottos() {
    const list = document.getElementById('mottoList');
    if (!list) return;
    DB.getAll('mottos').then(mottos => {
      if (!mottos || mottos.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">训</div><h4>暂无家训</h4><p>添加家族家训，传承优良家风</p></div>';
        return;
      }
      mottos.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0));
      list.innerHTML = mottos.map(m => `
        <div class="motto-item" style="padding:20px;border-bottom:1px solid rgba(139,69,19,0.15);margin-bottom:12px;background:rgba(139,69,19,0.03);border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="color:#8B0000;margin:0;font-size:18px;">${this._esc(m.title || '无标题')}</h4>
            <div>
              <button class="btn btn-sm" style="color:#2980b9;padding:4px 8px;font-size:12px;"
                onclick="App.editMotto(${m.id})">编辑</button>
              <button class="btn btn-sm" style="color:#c0392b;padding:4px 8px;font-size:12px;"
                onclick="App.deleteMotto(${m.id})">删除</button>
            </div>
          </div>
          <p style="color:#4a3728;line-height:2;white-space:pre-wrap;">${this._esc(m.content || '')}</p>
        </div>
      `).join('');
    }).catch(e => console.error('loadMottos error:', e));
  },

  showMottoForm(id) {
    const overlay = document.getElementById('mottoModalOverlay');
    const titleEl = document.getElementById('mottoModalTitle');
    const editId = document.getElementById('mottoEditId');
    const titleInput = document.getElementById('mottoTitle');
    const contentInput = document.getElementById('mottoContent');
    const deleteBtn = document.getElementById('btnDeleteMotto');
    if (!overlay) return;
    document.getElementById('formMotto').reset();

    if (id) {
      titleEl.textContent = '编辑家训';
      deleteBtn.style.display = 'inline-block';
      DB.get('mottos', id).then(m => {
        editId.value = id;
        titleInput.value = m.title || '';
        contentInput.value = m.content || '';
      });
    } else {
      titleEl.textContent = '添加家训';
      deleteBtn.style.display = 'none';
      editId.value = '';
    }
    overlay.style.display = 'flex';
  },

  saveMotto(e) {
    e.preventDefault();
    const id = document.getElementById('mottoEditId')?.value;
    const title = document.getElementById('mottoTitle')?.value?.trim();
    const content = document.getElementById('mottoContent')?.value?.trim();
    if (!title && !content) { this.showToast('请输入内容', 'warn'); return; }
    const data = { title, content, updated_at: new Date().toISOString() };
    const promise = id ? DB.put('mottos', { ...data, id: id }) : DB.put('mottos', { ...data, sort_order: Date.now() });
    promise.then(() => {
      this.showToast(id ? '家训已更新' : '家训已添加');
      document.getElementById('mottoModalOverlay').style.display = 'none';
      this.loadMottos();
    }).catch(e => this.showToast('保存失败: ' + e.message, 'error'));
  },

  editMotto(id) { this.showMottoForm(id); },

  deleteMotto(id) {
    if (!confirm('确定删除该家训？')) return;
    DB.delete('mottos', id).then(() => {
      this.showToast('家训已删除');
      document.getElementById('mottoModalOverlay').style.display = 'none';
      this.loadMottos();
    }).catch(e => this.showToast('删除失败: ' + e.message, 'error'));
  },

  // ========== 公告 ==========

  loadNotices() {
    const list = document.getElementById('noticeList');
    if (!list) return;
    DB.getAll('notices').then(notices => {
      if (!notices || notices.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">告</div><h4>暂无公告</h4><p>发布家族公告，通知家族成员</p></div>';
        return;
      }
      notices.sort((a,b) => (b.created_at || b.id || 0) - (a.created_at || a.id || 0));
      list.innerHTML = notices.map(n => `
        <div class="notice-item" style="padding:20px;border-bottom:1px solid rgba(139,69,19,0.15);margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <h4 style="color:#8B0000;margin:0;font-size:18px;">${this._esc(n.title || '无标题')}</h4>
            <small style="color:#999;">${this._fmtDate(n.created_at)}</small>
          </div>
          <p style="color:#4a3728;line-height:2;white-space:pre-wrap;">${this._esc(n.content || '')}</p>
          <div style="text-align:right;margin-top:8px;">
            <button class="btn btn-sm" style="color:#2980b9;padding:4px 8px;font-size:12px;"
              onclick="App.editNotice(${n.id})">编辑</button>
            <button class="btn btn-sm" style="color:#c0392b;padding:4px 8px;font-size:12px;"
              onclick="App.deleteNotice(${n.id})">删除</button>
          </div>
        </div>
      `).join('');
    }).catch(e => console.error('loadNotices error:', e));
  },

  showNoticeForm(id) {
    const overlay = document.getElementById('noticeModalOverlay');
    const titleEl = document.getElementById('noticeModalTitle');
    const editId = document.getElementById('noticeEditId');
    const titleInput = document.getElementById('noticeTitle');
    const contentInput = document.getElementById('noticeContent');
    const deleteBtn = document.getElementById('btnDeleteNotice');
    if (!overlay) return;
    document.getElementById('formNotice').reset();

    if (id) {
      titleEl.textContent = '编辑公告';
      deleteBtn.style.display = 'inline-block';
      DB.get('notices', id).then(n => {
        editId.value = id;
        titleInput.value = n.title || '';
        contentInput.value = n.content || '';
      });
    } else {
      titleEl.textContent = '发布公告';
      deleteBtn.style.display = 'none';
      editId.value = '';
    }
    overlay.style.display = 'flex';
  },

  saveNotice(e) {
    e.preventDefault();
    const id = document.getElementById('noticeEditId')?.value;
    const title = document.getElementById('noticeTitle')?.value?.trim();
    const content = document.getElementById('noticeContent')?.value?.trim();
    if (!title && !content) { this.showToast('请输入内容', 'warn'); return; }
    const data = { title, content, updated_at: new Date().toISOString() };
    const promise = id ? DB.put('notices', { ...data, id: id }) : DB.put('notices', { ...data, created_at: new Date().toISOString() });
    promise.then(() => {
      this.showToast(id ? '公告已更新' : '公告已发布');
      document.getElementById('noticeModalOverlay').style.display = 'none';
      this.loadNotices();
    }).catch(e => this.showToast('发布失败: ' + e.message, 'error'));
  },

  editNotice(id) { this.showNoticeForm(id); },

  deleteNotice(id) {
    if (!confirm('确定删除该公告？')) return;
    DB.delete('notices', id).then(() => {
      this.showToast('公告已删除');
      document.getElementById('noticeModalOverlay').style.display = 'none';
      this.loadNotices();
    }).catch(e => this.showToast('删除失败: ' + e.message, 'error'));
  },

  // ========== 辅助方法 ==========
  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  },

  _fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },

  // ========== DOMContentLoaded 页面初始化 ==========

  async _initPage() {
    const currentPage = getCurrentPageName();

    // 所有页面通用的初始化
  try { await Effects.init(); Effects.startScrollUnfold(); } catch(e) {}
  this._initLocalStats();

  // 绑定通用按钮事件
  const btnAdd = document.getElementById('btnAddMember');
  if (btnAdd) btnAdd.addEventListener('click', () => App.showMemberForm());

  // 绑定表单提交
  const formMember = document.getElementById('formMember');
  if (formMember) formMember.addEventListener('submit', (e) => App.saveMember(e));

  // 绑定弹窗关闭按钮
  const btnCancel = document.getElementById('btnCancelForm');
  if (btnCancel) btnCancel.addEventListener('click', () => App.closeModal());
  const btnClose = document.getElementById('btnCloseModal');
  if (btnClose) btnClose.addEventListener('click', () => App.closeModal());
  const btnCloseDetail = document.getElementById('btnCloseDetail');
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => { document.getElementById('detailModalOverlay').style.display = 'none'; });

  // 绑定详情弹窗中的编辑和删除按钮
  const btnEditDetail = document.getElementById('btnEditDetail');
  if (btnEditDetail) btnEditDetail.addEventListener('click', () => {
    if (window.currentDetailId) App.showMemberForm(window.currentDetailId);
  });

  const btnDeleteDetail = document.getElementById('btnDeleteDetail');
  if (btnDeleteDetail) btnDeleteDetail.addEventListener('click', () => App.deleteCurrentMember());

  // 绑定家族关系"选择"/"清除"按钮（6个按钮）
  const btnSelFather = document.getElementById('btnSelectFather');
  if (btnSelFather) btnSelFather.addEventListener('click', () => App.openRelationPicker('father'));
  const btnClrFather = document.getElementById('btnClearFather');
  if (btnClrFather) btnClrFather.addEventListener('click', () => App.clearRelation('father'));

  const btnSelMother = document.getElementById('btnSelectMother');
  if (btnSelMother) btnSelMother.addEventListener('click', () => App.openRelationPicker('mother'));
  const btnClrMother = document.getElementById('btnClearMother');
  if (btnClrMother) btnClrMother.addEventListener('click', () => App.clearRelation('mother'));

  const btnSelSpouse = document.getElementById('btnSelectSpouse');
  if (btnSelSpouse) btnSelSpouse.addEventListener('click', () => App.openRelationPicker('spouse'));
  const btnClrSpouse = document.getElementById('btnClearSpouse');
  if (btnClrSpouse) btnClrSpouse.addEventListener('click', () => App.clearRelation('spouse'));

  // 留言
  const btnAddMsg = document.getElementById('btnAddMessage');
  if (btnAddMsg) btnAddMsg.addEventListener('click', () => { document.getElementById('messageModalOverlay').style.display = 'flex'; });
  const formMsg = document.getElementById('formMessage');
  if (formMsg) formMsg.addEventListener('submit', (e) => App.saveMessage(e));

  // 家训
  const btnAddMotto = document.getElementById('btnAddMotto');
  if (btnAddMotto) btnAddMotto.addEventListener('click', () => App.showMottoForm());
  const formMotto = document.getElementById('formMotto');
  if (formMotto) formMotto.addEventListener('submit', (e) => App.saveMotto(e));
  const btnDelMotto = document.getElementById('btnDeleteMotto');
  if (btnDelMotto) btnDelMotto.addEventListener('click', () => { const id = document.getElementById('mottoEditId')?.value; if (id) App.deleteMotto(id); });

  // 公告
  const btnAddNotice = document.getElementById('btnAddNotice');
  if (btnAddNotice) btnAddNotice.addEventListener('click', () => App.showNoticeForm());
  const formNotice = document.getElementById('formNotice');
  if (formNotice) formNotice.addEventListener('submit', (e) => App.saveNotice(e));
  const btnDelNotice = document.getElementById('btnDeleteNotice');
  if (btnDelNotice) btnDelNotice.addEventListener('click', () => { const id = document.getElementById('noticeEditId')?.value; if (id) App.deleteNotice(id); });

  // 首页
  if (currentPage === 'dashboard') {
    App.loadDashboard();
  }

  // 成员管理
  if (currentPage === 'members') {
    // 绑定筛选按钮
    document.querySelectorAll('#memberFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        document.querySelectorAll(`#memberFilters .filter-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        App.loadMembers();
      });
    });

    // 绑定搜索框
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => App.loadMembers());
    }

    App.loadMembers();
  }

  // 留言
  if (currentPage === 'messages') App.loadMessages();

  // 家训
  if (currentPage === 'mottos') App.loadMottos();

  // 公告
  if (currentPage === 'notices') App.loadNotices();

  // 统计页面
  if (currentPage === 'stats') {
    // 绑定重置数据按钮
    const btnReset = document.getElementById('btnResetData');
    if (btnReset) btnReset.addEventListener('click', () => App.resetDB());
    App.loadDashboard();
  }

  // 家族树
  if (currentPage === 'tree' && typeof FamilyTree !== 'undefined') {
    try {
      FamilyTree.init('treeContainer', (id) => { App.showMemberDetail(id); });
      FamilyTree.refresh();

      // 绑定工具栏按钮事件
      const btnExpandAll = document.getElementById('treeExpandAll');
      const btnCollapseAll = document.getElementById('treeCollapseAll');
      const btnZoomIn = document.getElementById('treeZoomIn');
      const btnZoomOut = document.getElementById('treeZoomOut');
      const btnFit = document.getElementById('treeFit');

      if (btnExpandAll) btnExpandAll.addEventListener('click', () => FamilyTree.expandAll());
      if (btnCollapseAll) btnCollapseAll.addEventListener('click', () => FamilyTree.collapseAll());
      if (btnZoomIn) btnZoomIn.addEventListener('click', () => FamilyTree.zoomIn());
      if (btnZoomOut) btnZoomOut.addEventListener('click', () => FamilyTree.zoomOut());
      if (btnFit) btnFit.addEventListener('click', () => FamilyTree.fitToScreen());
    } catch(e) { console.error('FamilyTree init error:', e); }
  }

  // 祭奠堂
  if (currentPage === 'memorial') {
    if (typeof Memorial !== 'undefined') {
      try { await Memorial.init(); } catch(e) { console.error('Memorial init error:', e); }
    }
    if (typeof Effects !== 'undefined') {
      try { Effects.startAll(); } catch(e) {}
    }
  }

  }

};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App._initPage());







