/* ==========================================
   李氏家谱 - 成员管理模块
   ========================================== */

(function() {
  // 成员表单（添加/编辑）
  function showMemberForm(id) {
    App.selectedFatherId = null;
    App.selectedMotherId = null;
    App.selectedSpouseId = null;
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
      App._avatarData = null;
    };

    if (id) {
      title.textContent = '编辑成员';
      DB.get('members', id).then(member => {
        if (!member) { App.showToast('成员不存在', 'error'); return; }
        App.currentMember = member;
        document.getElementById('formId').value = id;
        document.getElementById('formName').value = member.name || '';
        document.getElementById('formGender').value = member.gender || 'male';
        document.getElementById('formGeneration').value = member.generation || '';
        document.getElementById('formBirthOrder').value = member.birth_order || '';
        document.getElementById('formEthnicity').value = member.ethnicity || '汉族';
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
        App.selectedFatherId = member.father_id || null;
        App.selectedMotherId = member.mother_id || null;
        App.selectedSpouseId = member.spouse_id || null;
        const gender = (member.gender === 'female') ? 'female' : 'male';
        document.getElementById('avatarPreview').className = 'member-avatar ' + gender;
        document.getElementById('avatarPreview').textContent = App.getAvatar(member.name);
        if (member.avatar) {
          document.getElementById('avatarPreview').style.backgroundImage = 'url(' + member.avatar + ')';
          document.getElementById('avatarPreview').style.backgroundSize = 'cover';
          document.getElementById('avatarPreview').style.backgroundPosition = 'center';
          document.getElementById('avatarPreview').textContent = '';
          App._avatarData = member.avatar;
        } else {
          App._avatarData = null;
        }
        App.updateRelationLabel('father');
        App.updateRelationLabel('mother');
        App.updateRelationLabel('spouse');
      }).catch(e => { App.showToast('加载成员失败', 'error'); });
    } else {
      title.textContent = '添加成员';
      App.currentMember = null;
      resetForm();
      App.updateRelationLabel('father');
      App.updateRelationLabel('mother');
      App.updateRelationLabel('spouse');
    }
    overlay.style.display = 'flex';
  }

  function saveMember(e) {
    e.preventDefault();
    const name = document.getElementById('formName').value.trim();
    if (!name) { App.showToast('姓名不能为空', 'error'); return; }
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
      courtesy_name: document.getElementById('formCourtesyName').value,
      art_name: document.getElementById('formArtName').value,
      ancestral_home: document.getElementById('formAncestralHome').value,
      generation_poem: document.getElementById('formGenerationPoem').value,
      burial_site: document.getElementById('formBurialSite').value,
      father_id: App.selectedFatherId || null,
      mother_id: App.selectedMotherId || null,
      spouse_id: App.selectedSpouseId || null,
      avatar: App._avatarData || null
    };
    if (id) data.id = parseInt(id);
    DB.put('members', data).then(() => {
      App.closeModal();
      App.showToast(id ? '成员已更新' : '成员已添加', 'success');
      DB.log(id ? '更新成员' : '添加成员', name);
      App.loadDashboard();
      App.loadMembers();
      FamilyTree.refresh();
    }).catch(e => { App.showToast('保存失败', 'error'); console.error(e); });
  }

  function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'none';
    App.currentMember = null;
    App._deleteId = null;
  }

  // 将方法挂载到 App
  Object.assign(App, {
    showMemberForm,
    saveMember,
    closeModal
  });
})();
