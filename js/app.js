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

  // ================ Navigation ================

  navigateTo(pageId) {
    this.currentPage = pageId;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById('page-' + pageId);
    if (pg) pg.classList.add('active');
    document.querySelectorAll('.navbar-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === pageId);
    });
    switch (pageId) {
      case 'dashboard': this.loadDashboard(); break;
      case 'members': this.loadMembers(); break;
      case 'tree': FamilyTree.refresh(); break;
      case 'memorial': this.loadMemorial(); Effects.onPageChange('memorial'); break;
      case 'lifeEvents': this.loadLifeEventMembers(); break;
      case 'photos': this.loadPhotos(); break;
      case 'messages': this.loadMessages(); break;
      case 'mottos': this.loadMottos(); break;
      case 'notices': this.loadNotices(); break;
      case 'stats': this.loadStats(); break;
    }
    if (pageId !== 'memorial') Effects.onPageChange(pageId);
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
      document.getElementById('formId').value = '';
      document.getElementById('formName').value = ''; document.getElementById('formGender').value = 'male';
      document.getElementById('formGeneration').value = ''; document.getElementById('formBirthOrder').value = '';
      document.getElementById('formEthnicity').value = '汉族'; document.getElementById('formBirthDate').value = '';
      document.getElementById('formDeathDate').value = ''; document.getElementById('formEducation').value = '';
      document.getElementById('formCareer').value = ''; document.getElementById('formPhone').value = '';
      document.getElementById('formAddress').value = ''; document.getElementById('formBio').value = '';
      // 传统文化字段
      document.getElementById('formCourtesyName').value = '';
      document.getElementById('formArtName').value = '';
      document.getElementById('formAncestralHome').value = '';
      document.getElementById('formGenerationPoem').value = '';
      document.getElementById('formBurialSite').value = '';
      document.getElementById('avatarPreview').className = 'member-avatar male';
      document.getElementById('avatarPreview').textContent = '?';
      document.getElementById('avatarPreview').style.backgroundImage = '';
      this._avatarData = null;
    };

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
      FamilyTree.refresh();
    } catch(e) {
      this.showToast('\u4fdd\u5b58\u5931\u8d25', 'error');
      console.error(e);
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

  // 检查 targetId 是否是 memberId 的后代
  async _isDescendant(memberId, targetId) {
    const visited = new Set();
    const queue = [targetId];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === memberId) return true;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const children = await DB.query('members', 'father_id', currentId);
      for (const child of children) queue.push(child.id);
    }
    return false;
  },

  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'none';
    this.currentMember = null;
    this._deleteId = null;
  },

  // ================ Member detail ================

  async showMemberDetail(id) {
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
      document.getElementById('detailBio').textContent = member.io || '\u2014';

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

  // ================ Life Events ================

  async loadLifeEventMembers() {
    const select = document.getElementById('lifeEventMemberSelect');
    if (!select) return;
    try {
      const members = await DB.getAll('members');
      select.innerHTML = '<option value="">\u9009\u62e9\u6210\u5458...</option>' +
        members.map(m => '<option value="' + m.id + '">' + this.esc(m.name) + '</option>').join('');
      select.onchange = () => {
        const val = select.value;
        if (val) this.loadLifeEvents(parseInt(val));
        else document.getElementById('lifeEventTimeline').innerHTML = '<div class="empty-state"><div class="empty-icon">\u53f2</div><h4>\u8bf7\u9009\u62e9\u4e00\u4f4d\u6210\u5458</h4><p>\u9009\u62e9\u4e0a\u65b9\u6210\u5458\u540e\uff0c\u5c06\u5c55\u793a\u5176\u751f\u5e73\u5927\u4e8b\u65f6\u95f4\u7ebf</p></div>';
      };
    } catch(e) { console.error(e); }
    const btn = document.getElementById('btnAddLifeEvent');
    if (btn) btn.onclick = () => this.showLifeEventForm();
  },

  async loadLifeEvents(memberId) {
    const container = document.getElementById('lifeEventTimeline');
    if (!container) return;
    try {
      const events = await DB.getLifeEvents(memberId);
      if (events.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">\u53f2</div><h4>\u6682\u65e0\u8bb0\u5f55</h4><p>\u70b9\u51fb\u201c\u6dfb\u52a0\u5927\u4e8b\u201d\u5f00\u59cb\u8bb0\u5f55</p></div>';
        return;
      }
      const sorted = events.sort((a,b) => (a.event_date||'').localeCompare(b.event_date||''));
      container.innerHTML = '<div class="timeline">' +
        sorted.map(e => {
          const typeClass = e.event_type === 'birth' ? 'birth' : e.event_type === 'death' ? 'death' : e.event_type === 'marriage' ? 'marriage' : e.event_type === 'career' ? 'career' : '';
          return '<div class="timeline-item">' +
            '<div class="timeline-dot ' + typeClass + '"></div>' +
            '<div class="timeline-date">' + (e.event_date||'') + '</div>' +
            '<div class="timeline-title">' + this.esc(e.title) + '</div>' +
            (e.description ? '<div class="timeline-desc">' + this.esc(e.description) + '</div>' : '') +
            '<div style="margin-top:8px;">' +
            '<button class="btn btn-ghost btn-sm" onclick="App.showLifeEventForm(' + e.id + ')" title="\u7f16\u8f91">\u270e</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="App.deleteLifeEvent(' + e.id + ',' + memberId + ')">\u5220\u9664</button>' +
            '</div></div>';
        }).join('') + '</div>';
    } catch(e) { console.error(e); }
  },

  async showLifeEventForm(id) {
    const overlay = document.getElementById('lifeEventModalOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('lifeEventFormId').value = id || '';
    document.getElementById('lifeEventFormTitle').value = '';
    document.getElementById('lifeEventFormDesc').value = '';
    document.getElementById('lifeEventFormDate').value = '';
    document.getElementById('lifeEventFormType').value = 'birth';
    document.getElementById('lifeEventModalTitle').textContent = id ? '\u7f16\u8f91\u5927\u4e8b\u8bb0' : '\u6dfb\u52a0\u5927\u4e8b\u8bb0';
    try {
      const all = await DB.getAll('members');
      const sel = document.getElementById('lifeEventFormMember');
      sel.innerHTML = all.map(m => '<option value="' + m.id + '">' + this.esc(m.name) + '</option>').join('');
      if (id) {
        const evt = await DB.get('lifeEvents', id);
        if (evt) {
          document.getElementById('lifeEventFormTitle').value = evt.title || '';
          document.getElementById('lifeEventFormDesc').value = evt.description || '';
          document.getElementById('lifeEventFormDate').value = evt.event_date || '';
          document.getElementById('lifeEventFormType').value = evt.event_type || 'other';
          if (evt.member_id) document.getElementById('lifeEventFormMember').value = evt.member_id;
        }
      }
    } catch(e) {}
  },

  async saveLifeEvent(e) {
    e.preventDefault();
    const memberId = parseInt(document.getElementById('lifeEventFormMember').value);
    const title = document.getElementById('lifeEventFormTitle').value.trim();
    if (!memberId || !title) { this.showToast('\u8bf7\u5b8c\u5584\u4fe1\u606f', 'error'); return; }
    const editId = document.getElementById('lifeEventFormId').value;
    const data = {
      member_id: memberId,
      title: title,
      event_type: document.getElementById('lifeEventFormType').value,
      event_date: document.getElementById('lifeEventFormDate').value || null,
      description: document.getElementById('lifeEventFormDesc').value
    };
    if (editId) data.id = parseInt(editId);
    try {
      await DB.put('lifeEvents', data);
      document.getElementById('lifeEventModalOverlay').style.display = 'none';
      this.showToast(editId ? '\u5927\u4e8b\u5df2\u66f4\u65b0' : '\u5927\u4e8b\u5df2\u6dfb\u52a0', 'success');
      if (editId) {
        const sel = document.getElementById('lifeEventMemberSelect');
        if (sel && sel.value) this.loadLifeEvents(parseInt(sel.value));
      } else {
        this.loadLifeEvents(memberId);
      }
      await DB.log(editId ? '\u66f4\u65b0\u751f\u5e73\u5927\u4e8b' : '\u6dfb\u52a0\u751f\u5e73\u5927\u4e8b', title);
    } catch(e) { this.showToast('\u4fdd\u5b58\u5931\u8d25', 'error'); }
  },

  async deleteLifeEvent(id, memberId) {
    if (!confirm('\u786e\u5b9a\u5220\u9664\u8be1\u5f55\uff1f')) return;
    try {
      await DB.delete('lifeEvents', id);
      this.showToast('\u5df2\u5220\u9664', 'success');
      if (memberId) this.loadLifeEvents(memberId);
    } catch(e) { this.showToast('\u5220\u9664\u5931\u8d25', 'error'); }
  },

  // ================ Photos ================

  async loadPhotos() {
    const container = document.getElementById('photoWall');
    if (!container) return;
    try {
      const photos = await DB.getAll('photos');
      if (photos.length === 0) return;
      container.innerHTML = photos.sort((a,b) => (b.id||0)-(a.id||0)).map(p => {
        return '<div class="photo-item">' +
          '<img src="' + p.data_url + '" alt="' + this.esc(p.title||'\u7167\u7247') + '" loading="lazy" onclick="App.showPhotoViewer(' + p.id + ')">' +
          '<div class="photo-overlay">' + this.esc(p.title||'\u65e0\u6807\u9898') + '</div>' +
          '<div class="photo-actions">' +
          '<button class="photo-btn photo-btn-edit" onclick="event.stopPropagation();App.showPhotoForm(' + p.id + ')" title="\u7f16\u8f91">\u270e</button>' +
          '<button class="photo-btn photo-btn-delete" onclick="event.stopPropagation();App.deletePhoto(' + p.id + ')" title="\u5220\u9664">\u2716</button>' +
          '</div></div>';
      }).join('');
    } catch(e) { console.error(e); }
  },

  async showPhotoForm(id) {
    const overlay = document.getElementById('photoModalOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('photoFormId').value = id || '';
    document.getElementById('photoFormTitle').value = '';
    document.getElementById('photoFormDesc').value = '';
    document.getElementById('photoFormFile').value = '';
    document.querySelector('#photoModalOverlay .modal-title').textContent = id ? '\u7f16\u8f91\u7167\u7247' : '\u4e0a\u4f20\u7167\u7247';
    try {
      const all = await DB.getAll('members');
      const select = document.getElementById('photoFormMember');
      select.innerHTML = '<option value="">\u4e0d\u5173\u8054\uff08\u5bb6\u65cf\u5408\u5f71\uff09</option>' +
        all.map(m => '<option value="' + m.id + '">' + this.esc(m.name) + '</option>').join('');
      if (id) {
        const photo = await DB.get('photos', id);
        if (photo) {
          document.getElementById('photoFormTitle').value = photo.title || '';
          document.getElementById('photoFormDesc').value = photo.description || '';
          if (photo.member_id) document.getElementById('photoFormMember').value = photo.member_id;
        }
      }
    } catch(e) {}
  },

  async savePhoto(e) {
    e.preventDefault();
    const editId = document.getElementById('photoFormId').value;
    const fileInput = document.getElementById('photoFormFile');
    const file = fileInput.files[0];
    const title = document.getElementById('photoFormTitle').value || '\u65e0\u6807\u9898';
    const description = document.getElementById('photoFormDesc').value;
    const member_id = parseInt(document.getElementById('photoFormMember').value) || null;
    if (!file && !editId) { this.showToast('\u8bf7\u9009\u62e9\u7167\u7247', 'error'); return; }
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const data = { title, description, member_id, data_url: ev.target.result, created_at: new Date().toISOString() };
        if (editId) { data.id = parseInt(editId); delete data.created_at; }
        try {
          await DB.put('photos', data);
          document.getElementById('photoModalOverlay').style.display = 'none';
          this.showToast(editId ? '\u7167\u7247\u5df2\u66f4\u65b0' : '\u7167\u7247\u5df2\u4e0a\u4f20', 'success');
          this.loadPhotos();
          await DB.log(editId ? '\u66f4\u65b0\u7167\u7247' : '\u4e0a\u4f20\u7167\u7247', title);
        } catch(e) { this.showToast('\u4fdd\u5b58\u5931\u8d25', 'error'); }
      };
      reader.readAsDataURL(file);
    } else {
      const existing = await DB.get('photos', parseInt(editId));
      if (!existing) { this.showToast('\u7167\u7247\u4e0d\u5b58\u5728', 'error'); return; }
      existing.title = title;
      existing.description = description;
      existing.member_id = member_id;
      try {
        await DB.put('photos', existing);
        document.getElementById('photoModalOverlay').style.display = 'none';
        this.showToast('\u7167\u7247\u5df2\u66f4\u65b0', 'success');
        this.loadPhotos();
        await DB.log('\u66f4\u65b0\u7167\u7247', title);
      } catch(e) { this.showToast('\u4fdd\u5b58\u5931\u8d25', 'error'); }
    }
  },

  async showPhotoViewer(id) {
    try {
      const photo = await DB.get('photos', id);
      if (!photo) return;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cursor = 'pointer';
      overlay.onclick = () => document.body.removeChild(overlay);
      overlay.innerHTML = '<div style="max-width:90vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;gap:12px;" onclick="event.stopPropagation()">' +
        '<img src="' + photo.data_url + '" style="max-width:100%;max-height:80vh;border-radius:8px;border:3px solid var(--gold);box-shadow:var(--shadow-lg);">' +
        '<div style="background:rgba(26,15,10,0.8);color:var(--gold);padding:8px 20px;border-radius:8px;font-size:0.85rem;">' +
        this.esc(photo.title||'') + (photo.description ? ' \u2014 ' + this.esc(photo.description) : '') + '</div>' +
        '<button class="btn btn-sm btn-outline" onclick="App.deletePhoto(' + id + ');document.body.removeChild(this.closest(\'.modal-overlay\'));">\u5220\u9664\u7167\u7247</button>' +
        '</div>';
      document.body.appendChild(overlay);
    } catch(e) { console.error(e); }
  },

  async deletePhoto(id) {
    if (!confirm('\u786e\u5b9a\u8981\u5220\u9664\u8be5\u7167\u7247\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002')) return;
    try {
      await DB.delete('photos', id);
      this.showToast('\u7167\u7247\u5df2\u5220\u9664', 'success');
      this.loadPhotos();
    } catch(e) { this.showToast('\u5220\u9664\u5931\u8d25', 'error'); }
  },

  // ================ Messages ================

  async loadMessages() {
    const container = document.getElementById('messageBoard');
    if (!container) return;
    try {
      const messages = await DB.getAll('messages');
      if (messages.length === 0) return;
      container.innerHTML = messages.sort((a,b) => (b.id||0)-(a.id||0)).map(m => {
        return '<div class="message-item">' +
          '<div class="message-header">' +
          '<span class="message-author">' + this.esc(m.author||'\u533f\u540d') + '</span>' +
          '<span class="message-date">' + (m.created_at ? new Date(m.created_at).toLocaleDateString('zh-CN') : '') + '</span>' +
          '</div>' +
          '<div class="message-content">' + this.esc(m.content) + '</div>' +
          '<div style="margin-top:8px;">' +
          '<button class="btn btn-ghost btn-sm" onclick="App.showMessageForm(' + m.id + ')" title="\u7f16\u8f91">\u270e</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.deleteMessage(' + m.id + ')">\u5220\u9664</button>' +
          '</div></div>';
      }).join('');
    } catch(e) { console.error(e); }
  },

  async showMessageForm(id) {
    const overlay = document.getElementById('messageModalOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('messageFormId').value = id || '';
    document.getElementById('messageFormAuthor').value = '';
    document.getElementById('messageFormContent').value = '';
    document.querySelector('#messageModalOverlay .modal-title').textContent = id ? '\u7f16\u8f91\u7559\u8a00' : '\u5199\u7559\u8a00';
    try {
      const all = await DB.getAll('members');
      const select = document.getElementById('messageFormMember');
      select.innerHTML = '<option value="">\u5168\u4f53\u5148\u7956</option>' +
        all.filter(m => m.death_date).map(m => '<option value="' + m.id + '">' + this.esc(m.name) + '</option>').join('');
      if (id) {
        const msg = await DB.get('messages', id);
        if (msg) {
          document.getElementById('messageFormAuthor').value = msg.author || '';
          document.getElementById('messageFormContent').value = msg.content || '';
          if (msg.member_id) document.getElementById('messageFormMember').value = msg.member_id;
        }
      }
    } catch(e) {}
  },

  async saveMessage(e) {
    e.preventDefault();
    const author = document.getElementById('messageFormAuthor').value.trim();
    const content = document.getElementById('messageFormContent').value.trim();
    if (!author || !content) { this.showToast('\u8bf7\u586b\u5199\u5b8c\u6574', 'error'); return; }
    const editId = document.getElementById('messageFormId').value;
    const data = {
      author: author,
      content: content,
      member_id: parseInt(document.getElementById('messageFormMember').value) || null,
      created_at: new Date().toISOString()
    };
    if (editId) { data.id = parseInt(editId); delete data.created_at; }
    try {
      await DB.put('messages', data);
      document.getElementById('messageModalOverlay').style.display = 'none';
      this.showToast(editId ? '\u7559\u8a00\u5df2\u66f4\u65b0' : '\u7559\u8a00\u5df2\u53d1\u5e03', 'success');
      this.loadMessages();
      await DB.log(editId ? '\u66f4\u65b0\u7559\u8a00' : '\u53d1\u5e03\u7559\u8a00', author);
    } catch(e) { this.showToast('\u4fdd\u5b58\u5931\u8d25', 'error'); }
  },

  async deleteMessage(id) {
    if (!confirm('\u786e\u5b9a\u5220\u9664\u8be5\u7559\u8a00\uff1f')) return;
    try {
      await DB.delete('messages', id);
      this.showToast('\u5df2\u5220\u9664', 'success');
      this.loadMessages();
    } catch(e) { this.showToast('\u5220\u9664\u5931\u8d25', 'error'); }
  },

  // ================ Mottos ================

  async loadMottos() {
    const container = document.getElementById('mottoList');
    if (!container) return;
    try {
      const mottos = await DB.getAll('mottos');
      if (mottos.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">\u8a00</div><h4>\u6682\u65e0\u5bb6\u8bad</h4><p>\u6dfb\u52a0\u5bb6\u65cf\u79c9\u627f\u4e0e\u805a\u8bad</p></div>';
        return;
      }
      container.innerHTML = mottos.sort((a,b) => (b.id||0)-(a.id||0)).map(m => {
        return '<div class="text-list-item">' +
          '<h3>' + this.esc(m.title) + '</h3>' +
          (m.author ? '<div class="meta">\u2014\u2014 ' + this.esc(m.author) + '</div>' : '') +
          '<div class="content">' + this.esc(m.content) + '</div>' +
          '<div style="margin-top:8px;">' +
          '<button class="btn btn-ghost btn-sm" onclick="App.showMottoForm(' + m.id + ')" title="\u7f16\u8f91">\u270e</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.deleteMotto(' + m.id + ')">\u5220\u9664</button>' +
          '</div></div>';
      }).join('');
    } catch(e) { console.error(e); }
  },

  async showMottoForm(id) {
    const overlay = document.getElementById('mottoModalOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('mottoFormId').value = id || '';
    document.getElementById('mottoTitle').value = '';
    document.getElementById('mottoContent').value = '';
    document.getElementById('mottoAuthor').value = '';
    document.getElementById('mottoModalTitle').textContent = id ? '\u7f16\u8f91\u5bb6\u8bad' : '\u6dfb\u52a0\u5bb6\u8bad';
    if (id) {
      const motto = await DB.get('mottos', id);
      if (motto) {
        document.getElementById('mottoTitle').value = motto.title || '';
        document.getElementById('mottoContent').value = motto.content || '';
        document.getElementById('mottoAuthor').value = motto.author || '';
      }
    }
  },

  async saveMotto(e) {
    e.preventDefault();
    const title = document.getElementById('mottoTitle').value.trim();
    const content = document.getElementById('mottoContent').value.trim();
    if (!title || !content) { this.showToast('\u8bf7\u586b\u5199\u5b8c\u6574', 'error'); return; }
    const editId = document.getElementById('mottoFormId').value;
    const data = { title, content, author: document.getElementById('mottoAuthor').value };
    if (editId) data.id = parseInt(editId);
    try {
      await DB.put('mottos', data);
      document.getElementById('mottoModalOverlay').style.display = 'none';
      this.showToast(editId ? '\u5bb6\u8bad\u5df2\u66f4\u65b0' : '\u5bb6\u8bad\u5df2\u4fdd\u5b58', 'success');
      this.loadMottos();
      await DB.log(editId ? '\u66f4\u65b0\u5bb6\u8bad' : '\u6dfb\u52a0\u5bb6\u8bad', title);
    } catch(e) { this.showToast('\u4fdd\u5b58\u5931\u8d25', 'error'); }
  },

  async deleteMotto(id) {
    if (!confirm('\u786e\u5b9a\u5220\u9664\u8be5\u5bb6\u8bad\uff1f')) return;
    try {
      await DB.delete('mottos', id);
      this.showToast('\u5df2\u5220\u9664', 'success');
      this.loadMottos();
    } catch(e) { this.showToast('\u5220\u9664\u5931\u8d25', 'error'); }
  },

  // ================ Notices ================

  async loadNotices() {
    const container = document.getElementById('noticeList');
    if (!container) return;
    try {
      const notices = await DB.getAll('notices');
      if (notices.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">\u544a</div><h4>\u6682\u65e0\u516c\u544a</h4><p>\u53d1\u5e03\u5bb6\u65cf\u91cd\u8981\u901a\u77e5</p></div>';
        return;
      }
      container.innerHTML = notices.sort((a,b) => (b.id||0)-(a.id||0)).map(n => {
        const typeLabel = n.type === 'important' ? '\u3010\u91cd\u8981\u3011' : n.type === 'event' ? '\u3010\u6d3b\u52a8\u3011' : '';
        return '<div class="text-list-item">' +
          '<h3>' + typeLabel + this.esc(n.title) + '</h3>' +
          '<div class="meta">' + (n.author ? this.esc(n.author) + ' \u00b7 ' : '') + (n.created_at ? new Date(n.created_at).toLocaleDateString('zh-CN') : '') + '</div>' +
          '<div class="content">' + this.esc(n.content) + '</div>' +
          '<div style="margin-top:8px;">' +
          '<button class="btn btn-ghost btn-sm" onclick="App.showNoticeForm(' + n.id + ')" title="\u7f16\u8f91">\u270e</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.deleteNotice(' + n.id + ')">\u5220\u9664</button>' +
          '</div></div>';
      }).join('');
    } catch(e) { console.error(e); }
  },

  async showNoticeForm(id) {
    const overlay = document.getElementById('noticeModalOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('noticeFormId').value = id || '';
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeContent').value = '';
    document.getElementById('noticeAuthor').value = '';
    document.getElementById('noticeType').value = 'normal';
    document.getElementById('noticeModalTitle').textContent = id ? '\u7f16\u8f91\u516c\u544a' : '\u53d1\u5e03\u516c\u544a';
    if (id) {
      const notice = await DB.get('notices', id);
      if (notice) {
        document.getElementById('noticeTitle').value = notice.title || '';
        document.getElementById('noticeContent').value = notice.content || '';
        document.getElementById('noticeAuthor').value = notice.author || '';
        document.getElementById('noticeType').value = notice.type || 'normal';
      }
    }
  },

  async saveNotice(e) {
    e.preventDefault();
    const title = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    if (!title || !content) { this.showToast('\u8bf7\u586b\u5199\u5b8c\u6574', 'error'); return; }
    const editId = document.getElementById('noticeFormId').value;
    const data = {
      title, content,
      type: document.getElementById('noticeType').value,
      author: document.getElementById('noticeAuthor').value,
      created_at: new Date().toISOString()
    };
    if (editId) { data.id = parseInt(editId); delete data.created_at; }
    try {
      await DB.put('notices', data);
      document.getElementById('noticeModalOverlay').style.display = 'none';
      this.showToast(editId ? '\u516c\u544a\u5df2\u66f4\u65b0' : '\u516c\u544a\u5df2\u53d1\u5e03', 'success');
      this.loadNotices();
      await DB.log(editId ? '\u66f4\u65b0\u516c\u544a' : '\u53d1\u5e03\u516c\u544a', title);
    } catch(e) { this.showToast('\u4fdd\u5b58\u5931\u8d25', 'error'); }
  },

  async deleteNotice(id) {
    if (!confirm('\u786e\u5b9a\u5220\u9664\u8be5\u516c\u544a\uff1f')) return;
    try {
      await DB.delete('notices', id);
      this.showToast('\u5df2\u5220\u9664', 'success');
      this.loadNotices();
    } catch(e) { this.showToast('\u5220\u9664\u5931\u8d25', 'error'); }
  },

  // ================ Statistics & Management ================

  async loadStats() {
    try {
      const stats = await DB.getStats();
      const ids = ['statTotal2','statMale2','statFemale2','statAlive2','statDeceased2'];
      const vals = [stats.total, stats.male, stats.female, stats.alive, stats.deceased];
      ids.forEach((id,i) => {
        const el = document.getElementById(id);
        if (el) el.textContent = vals[i];
      });

      const canvas = document.getElementById('genBar');
      if (canvas) {
        const members = await DB.getAll('members');
        const genMap = {};
        members.forEach(m => { const g = m.generation || 1; genMap[g] = (genMap[g] || 0) + 1; });
        const gens = Object.keys(genMap).sort((a,b)=>parseInt(a)-parseInt(b));
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.clientWidth || 400;
        const ch = canvas.clientHeight || 200;
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0,0,cw,ch);

        const maxVal = Math.max(...Object.values(genMap), 1);
        const barW = Math.min(50, (cw - 60) / gens.length - 8);
        const left = 40, top = 20, bh = ch - top - 30;

        gens.forEach((g, i) => {
          const val = genMap[g];
          const bx = left + i * (barW + 8) + (cw - left - gens.length * (barW + 8)) / 2;
          const bH = (val / maxVal) * bh;
          const by = top + bh - bH;

          ctx.fillStyle = '#8B0000';
          ctx.beginPath();
          ctx.roundRect(bx, by, barW, bH, 4);
          ctx.fill();

          ctx.fillStyle = '#5D4037';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(val, bx + barW/2, by - 6);
          ctx.fillText(g + '\u4ee3', bx + barW/2, top + bh + 16);
        });
      }
      await this.loadLogs();
    } catch(e) { console.error('loadStats error:', e); }
  },

  async loadLogs() {
    const container = document.getElementById('logList');
    if (!container) return;
    try {
      const logs = await DB.getAll('logs');
      if (logs.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.8rem;">\u6682\u65e0\u64cd\u4f5c\u8bb0\u5f55</div>';
        return;
      }
      container.innerHTML = logs.sort((a,b) => (b.id||0)-(a.id||0)).slice(0, 100).map(l => {
        const date = l.created_at ? new Date(l.created_at).toLocaleString('zh-CN') : '';
        return '<div class="log-item">' +
          '<span class="time">' + date + '</span>' +
          '<span class="action">' + this.esc(l.action) + '</span>' +
          '<span class="desc">' + this.esc(l.details||'') + '</span></div>';
      }).join('');
    } catch(e) { console.error(e); }
  },

  async exportJSON() {
    try {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '\u674e\u6c0f\u5bb6\u8c31_' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('\u5bfc\u51fa\u6210\u529f', 'success');
      await DB.log('\u5bfc\u51fa\u6570\u636e', '');
    } catch(e) { this.showToast('\u5bfc\u51fa\u5931\u8d25', 'error'); }
  },

  async importJSON(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await DB.importAll(data);
      this.showToast('\u5bfc\u5165\u6210\u529f', 'success');
      await DB.log('\u5bfc\u5165\u6570\u636e', '');
      this.refreshAll();
      FamilyTree.refresh();
    } catch(e) { this.showToast('\u5bfc\u5165\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6\u683c\u5f0f', 'error'); }
  },

  async resetData() {
    if (!confirm('\u786e\u5b9a\u8981\u5f7b\u5e95\u6e05\u7a7a\u6240\u6709\u6570\u636e\u5417\uff1f\u8be5\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\uff01')) return;
    if (!confirm('\u518d\u6b21\u786e\u8ba4\uff1a\u8fd9\u5c06\u5220\u9664\u5bb6\u8c31\u4e2d\u6240\u6709\u6570\u636e\uff01')) return;
    try {
      for (const name of Object.keys(DB.STORES)) {
        await DB.deleteAll(name);
      }
      this.showToast('\u6570\u636e\u5df2\u91cd\u7f6e', 'success');
      await DB.log('\u91cd\u7f6e\u6570\u636e', '');
      this.refreshAll();
      FamilyTree.refresh();
    } catch(e) { this.showToast('\u91cd\u7f6e\u5931\u8d25', 'error'); }
  },

  async clearLogs() {
    if (!confirm('\u786e\u5b9a\u8981\u6e05\u7a7a\u65e5\u5fd7\u5417\uff1f')) return;
    try {
      await DB.deleteAll('logs');
      this.showToast('\u65e5\u5fd7\u5df2\u6e05\u7a7a', 'success');
      this.loadLogs();
    } catch(e) { this.showToast('\u6e05\u7a7a\u5931\u8d25', 'error'); }
  }
};

window.App = App;

// ==================== Event Registration & Init ====================
document.addEventListener('DOMContentLoaded', async () => {
  App.bindNavEvents();

  const eSwitch = document.getElementById('effectsToggle');
  if (eSwitch) {
    eSwitch.addEventListener('click', async () => { await Effects.toggle(); });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      if (group) {
        document.querySelectorAll('[data-group="' + group + '"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      App.loadMembers();
    });
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', () => App.loadMembers());

  const formMember = document.getElementById('formMember');
  if (formMember) formMember.addEventListener('submit', e => App.saveMember(e));
  const formLifeEvent = document.getElementById('formLifeEvent');
  if (formLifeEvent) formLifeEvent.addEventListener('submit', e => App.saveLifeEvent(e));
  const formPhoto = document.getElementById('formPhoto');
  if (formPhoto) formPhoto.addEventListener('submit', e => App.savePhoto(e));
  const formMessage = document.getElementById('formMessage');
  if (formMessage) formMessage.addEventListener('submit', e => App.saveMessage(e));
  const formMotto = document.getElementById('formMotto');
  if (formMotto) formMotto.addEventListener('submit', e => App.saveMotto(e));
  const formNotice = document.getElementById('formNotice');
  if (formNotice) formNotice.addEventListener('submit', e => App.saveNotice(e));

  const closeModal = document.getElementById('btnCloseModal');
  if (closeModal) closeModal.addEventListener('click', () => App.closeModal());
  const cancelForm = document.getElementById('btnCancelForm');
  if (cancelForm) cancelForm.addEventListener('click', () => App.closeModal());
  const closeDetail = document.getElementById('btnCloseDetail');
  if (closeDetail) closeDetail.addEventListener('click', () => App.closeDetailModal());
  const editDetail = document.getElementById('btnEditDetail');
  if (editDetail) editDetail.addEventListener('click', () => {
    if (App._deleteId) { var _editId = App._deleteId; App.closeDetailModal(); App.showMemberForm(_editId); }
  });
  const deleteDetail = document.getElementById('btnDeleteDetail');
  if (deleteDetail) deleteDetail.addEventListener('click', () => App.deleteCurrentMember());

  const selFather = document.getElementById('btnSelectFather');
  if (selFather) selFather.addEventListener('click', () => App.openRelationPicker('father'));
  const selMother = document.getElementById('btnSelectMother');
  if (selMother) selMother.addEventListener('click', () => App.openRelationPicker('mother'));
  const selSpouse = document.getElementById('btnSelectSpouse');
  if (selSpouse) selSpouse.addEventListener('click', () => App.openRelationPicker('spouse'));
  const clrFather = document.getElementById('btnClearFather');
  if (clrFather) clrFather.addEventListener('click', () => App.clearRelation('father'));
  const clrMother = document.getElementById('btnClearMother');
  if (clrMother) clrMother.addEventListener('click', () => App.clearRelation('mother'));
  const clrSpouse = document.getElementById('btnClearSpouse');
  if (clrSpouse) clrSpouse.addEventListener('click', () => App.clearRelation('spouse'));

  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) {
        o.style.display = 'none';
        App.currentMember = null;
        App._deleteId = null;
      }
    });
  });

  App.handleAvatar();

  const btnAddMember = document.getElementById('btnAddMember');
  if (btnAddMember) btnAddMember.addEventListener('click', () => App.showMemberForm());
  const btnAddPhoto = document.getElementById('btnAddPhoto');
  if (btnAddPhoto) btnAddPhoto.addEventListener('click', () => App.showPhotoForm());
  const btnAddMessage = document.getElementById('btnAddMessage');
  if (btnAddMessage) btnAddMessage.addEventListener('click', () => App.showMessageForm());
  const btnAddMotto = document.getElementById('btnAddMotto');
  if (btnAddMotto) btnAddMotto.addEventListener('click', () => App.showMottoForm());
  const btnAddNotice = document.getElementById('btnAddNotice');
  if (btnAddNotice) btnAddNotice.addEventListener('click', () => App.showNoticeForm());
  const btnAddLifeEvent = document.getElementById('btnAddLifeEvent');
  if (btnAddLifeEvent) btnAddLifeEvent.addEventListener('click', () => App.showLifeEventForm());

  const closeLifeEvent = document.getElementById('btnCloseLifeEventModal');
  if (closeLifeEvent) closeLifeEvent.addEventListener('click', () => document.getElementById('lifeEventModalOverlay').style.display='none');
  const cancelLifeEvent = document.getElementById('btnCancelLifeEvent');
  if (cancelLifeEvent) cancelLifeEvent.addEventListener('click', () => document.getElementById('lifeEventModalOverlay').style.display='none');

  const closePhoto = document.getElementById('btnClosePhotoModal');
  if (closePhoto) closePhoto.addEventListener('click', () => document.getElementById('photoModalOverlay').style.display='none');
  const cancelPhoto = document.getElementById('btnCancelPhoto');
  if (cancelPhoto) cancelPhoto.addEventListener('click', () => document.getElementById('photoModalOverlay').style.display='none');

  const closeMessage = document.getElementById('btnCloseMessageModal');
  if (closeMessage) closeMessage.addEventListener('click', () => document.getElementById('messageModalOverlay').style.display='none');
  const cancelMessage = document.getElementById('btnCancelMessage');
  if (cancelMessage) cancelMessage.addEventListener('click', () => document.getElementById('messageModalOverlay').style.display='none');

  const closeMotto = document.getElementById('btnCloseMottoModal');
  if (closeMotto) closeMotto.addEventListener('click', () => document.getElementById('mottoModalOverlay').style.display='none');
  const cancelMotto = document.getElementById('btnCancelMotto');
  if (cancelMotto) cancelMotto.addEventListener('click', () => document.getElementById('mottoModalOverlay').style.display='none');

  const closeNotice = document.getElementById('btnCloseNoticeModal');
  if (closeNotice) closeNotice.addEventListener('click', () => document.getElementById('noticeModalOverlay').style.display='none');
  const cancelNotice = document.getElementById('btnCancelNotice');
  if (cancelNotice) cancelNotice.addEventListener('click', () => document.getElementById('noticeModalOverlay').style.display='none');

  const importFile = document.getElementById('importFile');
  if (importFile) importFile.addEventListener('change', e => {
    if (e.target.files[0]) App.importJSON(e.target.files[0]);
    e.target.value = '';
  });

  const btnExport = document.getElementById('btnExportJSON');
  if (btnExport) btnExport.addEventListener('click', () => App.exportJSON());
  const btnReset = document.getElementById('btnResetData');
  if (btnReset) btnReset.addEventListener('click', () => App.resetData());
  const btnClearLogs = document.getElementById('btnClearLogs');
  if (btnClearLogs) btnClearLogs.addEventListener('click', () => App.clearLogs());

  const btnZoomIn = document.getElementById('treeZoomIn');
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => FamilyTree.zoomIn());
  const btnZoomOut = document.getElementById('treeZoomOut');
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => FamilyTree.zoomOut());
  const btnFit = document.getElementById('treeFit');
  if (btnFit) btnFit.addEventListener('click', () => FamilyTree.fitToScreen());
    const btnExpand = document.getElementById('treeExpandAll');
    if (btnExpand) btnExpand.addEventListener('click', () => FamilyTree.expandAll());
    const btnCollapse = document.getElementById('treeCollapseAll');
    if (btnCollapse) btnCollapse.addEventListener('click', () => FamilyTree.collapseAll());

  FamilyTree.init('treeCanvas', (id) => { App.showMemberDetail(id); });
  FamilyTree.refresh();

  await Effects.init();
  Effects.startScrollUnfold();
  Effects.startAll();
  App.loadDashboard();
});





