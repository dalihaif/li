/**
 * 李氏家谱 — 共享JS
 * 所有页面共用的工具和逻辑（不含DB操作，DB操作在 js/db.js 中）
 */

// ============ 工具函数 ============

// 显示提示消息
function showToast(message, type = 'info') {
  // 尝试查找 toast 元素
  let toast = document.getElementById('toast');
  
  // 如果不存在，创建一个
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.style.display = 'block';
  
  // 3秒后自动隐藏
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// 计算年龄
function calculateAge(birthDate, deathDate = null) {
  if (!birthDate) return '';
  
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const age = end.getFullYear() - birth.getFullYear();
  
  return age >= 0 ? age + '岁' : '';
}

// 生成唯一的ID
function generateId() {
  return Date.now() + Math.random().toString(36).substr(2, 9);
}

// ============ 导航栏逻辑 ============

// 初始化导航栏
function initNavigation() {
  // 获取当前页面名称
  const currentPage = getCurrentPageName();
  
  // 高亮当前页面的导航项
  const navLinks = document.querySelectorAll('.navbar-nav a');
  navLinks.forEach(link => {
    const page = link.getAttribute('data-page');
    if (page === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // 汉堡菜单
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navLinksContainer = document.getElementById('navLinks');
  
  if (hamburgerBtn && navLinksContainer) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('active');
      navLinksContainer.classList.toggle('open');
    });
    
    // 点击导航链接后关闭菜单
    navLinksContainer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburgerBtn.classList.remove('active');
        navLinksContainer.classList.remove('open');
      });
    });
  }
}

// 获取当前页面名称
function getCurrentPageName() {
  const path = window.location.pathname;
  const fileName = path.split('/').pop();
  
  if (!fileName || fileName === '' || fileName === 'index.html') {
    return 'dashboard';
  }
  
  return fileName.replace('.html', '');
}

// ============ 弹窗逻辑 ============

// 关闭弹窗
function closeModal() {
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
}

// 显示弹窗
function showModal(title, content) {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  
  if (modalOverlay && modalTitle && modalBody) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modalOverlay.style.display = 'flex';
  }
}

// ============ 页面初始化 ============

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  
  // 点击弹窗背景关闭弹窗
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }
});
