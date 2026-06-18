/* ==========================================
   李氏家谱 - 辈分诗管理
   ========================================== */

// 打开辈分诗编辑模态框
App.editGenerationPoem = async function() {
  try {
    const setting = await DB.get('settings', 'generation_poem');
    document.getElementById('generationPoemInput').value = setting ? setting.value : '';
    const homeSetting = await DB.get('settings', 'ancestral_home');
    document.getElementById('ancestralHomeInput').value = homeSetting ? homeSetting.value : '';
    document.getElementById('generationPoemModal').style.display = 'flex';
  } catch(e) {
    console.error('加载辈分诗失败', e);
  }
};

// 关闭模态框
App.closeGenerationPoemModal = function() {
  document.getElementById('generationPoemModal').style.display = 'none';
};

// 保存辈分诗
App.saveGenerationPoem = async function() {
  const poem = document.getElementById('generationPoemInput').value.trim();
  const home = document.getElementById('ancestralHomeInput').value.trim();
  try {
    await DB.put('settings', { key: 'generation_poem', value: poem });
    await DB.put('settings', { key: 'ancestral_home', value: home });
    this.closeGenerationPoemModal();
    this.showToast('字辈诗已保存', 'success');
    await this.loadGenerationPoem();
  } catch(e) {
    this.showToast('保存失败', 'error');
    console.error(e);
  }
};

// 加载并显示辈分诗（在首页展示）
App.loadGenerationPoem = async function() {
  try {
    const setting = await DB.get('settings', 'generation_poem');
    const homeSetting = await DB.get('settings', 'ancestral_home');
    const display = document.getElementById('generationPoemDisplay');
    if (!display) return;

    let html = '';
    if (homeSetting && homeSetting.value) {
      html += '<div style="font-size:0.9rem;color:var(--text-light);margin-bottom:12px;">郡望：' + homeSetting.value + '</div>';
    }
    if (setting && setting.value) {
      const chars = setting.value.split('');
      html += '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;">';
      chars.forEach((ch, i) => {
        html += '<span style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;background:var(--gold-light);border-radius:50%;font-size:1.1rem;">' + ch + '</span>';
      });
      html += '</div>';
      html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:12px;">共 ' + chars.length + ' 代字辈</div>';
    } else {
      html = '尚未设置字辈诗，请点击"编辑"按钮添加。';
    }
    display.innerHTML = html;
  } catch(e) {
    console.error('加载辈分诗失败', e);
  }
};
