/* ==========================================
   李氏家谱 - 导航与移动端适配
   ========================================== */

const Navigation = {
  init() {
    this.bindHamburger();
    this.bindNavLinks();
  },

  bindHamburger() {
    const btn = document.getElementById('hamburgerBtn');
    const nav = document.getElementById('navLinks');
    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      nav.classList.toggle('open');
    });

    // 点击空白处关闭菜单
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') &&
          !nav.contains(e.target) &&
          !btn.contains(e.target)) {
        btn.classList.remove('active');
        nav.classList.remove('open');
      }
    });
  },

  bindNavLinks() {
    const nav = document.getElementById('navLinks');
    const btn = document.getElementById('hamburgerBtn');
    if (!nav) return;

    // 点击导航链接后关闭移动端菜单
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          nav.classList.remove('open');
          if (btn) btn.classList.remove('active');
        }
      });
    });
  }
};

// 在 App.init 中调用 Navigation.init()
if (typeof App !== 'undefined') {
  const origInit = App.init;
  App.init = function() {
    if (origInit) origInit.call(this);
    Navigation.init();
  };
}
