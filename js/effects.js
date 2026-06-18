/* ============================================
   李氏家谱 - 动态特效引擎 (轻量化重写)
   纯 Canvas 2D + CSS · 无外部依赖
   香火缭绕 · 烛光摇曳 · 星火余烬
   花瓣飘落 · 卷轴展开
   ============================================ */

const Effects = (() => {
  let enabled = true;
  let incenseSystem = null;
  let petalSystem = null;
  let candleIntervals = [];
  let scrollDone = false;
  let scrollStyleEl = null;

  async function init() {
    try {
      const saved = await DB.getSetting("effectsEnabled");
      if (saved !== null) enabled = saved;
    } catch (e) {}
    updateToggleUI();
    return enabled;
  }

  function updateToggleUI() {
    const sw = document.getElementById("effectsSwitch");
    if (sw) sw.classList.toggle("on", enabled);
  }

  function isEnabled() { return enabled; }

  async function toggle() {
    enabled = !enabled;
    updateToggleUI();
    try { await DB.setSetting("effectsEnabled", enabled); } catch (e) {}
    if (enabled) startAll(); else stopAll();
    return enabled;
  }

  // ========== Canvas 2D 通用粒子引擎 ==========

  function createParticleSystem(container, opts) {
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;";
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const particles = [];
    let running = true;

    function resize() {
      canvas.width = container.offsetWidth || window.innerWidth;
      canvas.height = container.offsetHeight || window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const cfg = Object.assign({
      count: 30, minSpeed: 0.3, maxSpeed: 0.8,
      minSize: 4, maxSize: 14, minAlpha: 0.1, maxAlpha: 0.35,
      color: "180,160,140", direction: "up", sway: 0.3, shape: "circle"
    }, opts);

    for (let i = 0; i < cfg.count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * cfg.sway,
        vy: (cfg.direction === "up" ? -1 : 1) *
            (cfg.minSpeed + Math.random() * (cfg.maxSpeed - cfg.minSpeed)),
        size: cfg.minSize + Math.random() * (cfg.maxSize - cfg.minSize),
        alpha: cfg.minAlpha + Math.random() * (cfg.maxAlpha - cfg.minAlpha),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        phase: Math.random() * Math.PI * 2
      });
    }

    let animId;
    function animate() {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now() / 2000;
      for (const p of particles) {
        p.vx += Math.sin(now + p.phase) * 0.02;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (cfg.direction === "up" && p.y < -30) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 30;
          p.vx = (Math.random() - 0.5) * cfg.sway;
        } else if (cfg.direction === "down" && p.y > canvas.height + 30) {
          p.x = Math.random() * canvas.width;
          p.y = -30;
          p.vx = (Math.random() - 0.5) * cfg.sway;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        if (cfg.shape === "ellipse") {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = "rgba(" + cfg.color + "," + p.alpha + ")";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, "rgba(" + cfg.color + "," + Math.min(p.alpha * 2, 0.6) + ")");
          g.addColorStop(0.4, "rgba(" + cfg.color + "," + p.alpha * 0.6 + ")");
          g.addColorStop(1, "rgba(" + cfg.color + ",0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      animId = requestAnimationFrame(animate);
    }
    animate();

    return {
      destroy: function () {
        running = false;
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", resize);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  // ========== 1. 香火缭绕 ==========

  function startIncense() {
    if (incenseSystem) return;
    var container = document.getElementById("effectsContainer");
    if (!container) return;
    incenseSystem = createParticleSystem(container, {
      count: 25, minSpeed: 0.2, maxSpeed: 0.5,
      minSize: 8, maxSize: 20, minAlpha: 0.08, maxAlpha: 0.25,
      color: "180,160,140", direction: "up", sway: 0.2
    });
  }

  function stopIncense() {
    if (incenseSystem) { incenseSystem.destroy(); incenseSystem = null; }
  }

  // ========== 2. 烛光摇曳 ==========

  function startCandleGlow() {
    var tablets = document.querySelectorAll(".tablet");
    tablets.forEach(function (t, i) {
      var id = setInterval(function () {
        if (!enabled || !document.body.contains(t)) return;
        var intensity = 0.5 + Math.sin(Date.now() / 800 + i * 1.5) * 0.3;
        t.style.boxShadow = "0 0 " + (15 + intensity * 20) +
          "px rgba(255,165,0," + (0.1 + intensity * 0.2) + ")";
      }, 100);
      candleIntervals.push(id);
    });
  }

  function stopCandleGlow() {
    candleIntervals.forEach(function (id) { clearInterval(id); });
    candleIntervals = [];
    document.querySelectorAll(".tablet").forEach(function (t) { t.style.boxShadow = ""; });
  }

  // ========== 3. 星火余烬 ==========

  function startEmberGlow() {
    document.querySelectorAll(".tablet").forEach(function (t) {
      if (!t.classList.contains("ember-added")) {
        t.classList.add("ember-added");
        var glow = document.createElement("div");
        glow.className = "ember-glow";
        glow.style.cssText =
          "position:absolute;top:-10px;left:50%;transform:translateX(-50%);" +
          "width:40px;height:40px;border-radius:50%;" +
          "background:radial-gradient(circle,rgba(255,165,0,0.3) 0%,transparent 70%);" +
          "pointer-events:none;animation:emberPulse 2s ease-in-out infinite;";
        t.appendChild(glow);
      }
    });
  }

  function stopEmberGlow() {
    document.querySelectorAll(".ember-glow").forEach(function (el) { el.remove(); });
    document.querySelectorAll(".ember-added").forEach(function (el) { el.classList.remove("ember-added"); });
  }

  // ========== 4. 花瓣飘落 ==========

  function startPetals() {
    if (petalSystem) return;
    var container = document.getElementById("effectsContainer") || document.body;
    petalSystem = createParticleSystem(container, {
      count: 20, minSpeed: 0.4, maxSpeed: 1.0,
      minSize: 4, maxSize: 9, minAlpha: 0.15, maxAlpha: 0.35,
      color: "255,182,193", direction: "down", sway: 0.5, shape: "ellipse"
    });
  }

  function stopPetals() {
    if (petalSystem) { petalSystem.destroy(); petalSystem = null; }
  }

  // ========== 5. 卷轴展开 ==========

  function startScrollUnfold() {
    if (scrollDone) return;
    scrollDone = true;
    try { if (sessionStorage.getItem("scrollUnfoldDone")) return; } catch (e) {}

    var overlay = document.createElement("div");
    overlay.id = "scrollOverlay";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;" +
      "z-index:9998;pointer-events:none;overflow:hidden;";

    var leftScroll = document.createElement("div");
    leftScroll.style.cssText =
      "position:absolute;top:0;left:0;bottom:0;width:50%;" +
      "background:linear-gradient(to right,#2C1810 0%,#3E2723 50%,transparent 100%);" +
      "animation:scrollLeft 1.5s ease-out forwards;" +
      "border-right:3px solid #D4AF37;";

    var rightScroll = document.createElement("div");
    rightScroll.style.cssText =
      "position:absolute;top:0;right:0;bottom:0;width:50%;" +
      "background:linear-gradient(to left,#2C1810 0%,#3E2723 50%,transparent 100%);" +
      "animation:scrollRight 1.5s ease-out forwards;" +
      "border-left:3px solid #D4AF37;";

    overlay.appendChild(leftScroll);
    overlay.appendChild(rightScroll);
    document.body.appendChild(overlay);

    scrollStyleEl = document.createElement("style");
    scrollStyleEl.textContent =
      "@keyframes scrollLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }" +
      "@keyframes scrollRight { 0% { transform: translateX(0); } 100% { transform: translateX(100%); } }";
    document.head.appendChild(scrollStyleEl);

    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (scrollStyleEl && scrollStyleEl.parentNode) scrollStyleEl.parentNode.removeChild(scrollStyleEl);
    }, 1800);
    try { sessionStorage.setItem("scrollUnfoldDone", "1"); } catch (e) {}
  }

  // ========== 整体控制 ==========

  function startAll() {
    if (!enabled) return;
    startIncense();
    startPetals();
    startCandleGlow();
    startEmberGlow();
  }

  function stopAll() {
    stopIncense(); stopCandleGlow(); stopEmberGlow(); stopPetals();
  }

  function onPageChange(pageId) {
    if (!enabled) return;
    if (pageId === "memorial") {
      startIncense();
      startPetals();
      setTimeout(function () { startCandleGlow(); startEmberGlow(); }, 100);
    } else {
      stopIncense(); stopCandleGlow(); stopEmberGlow();
    }
  }

  function destroy() { stopAll(); }

  return {
    init: init, toggle: toggle, isEnabled: isEnabled,
    startAll: startAll, stopAll: stopAll, onPageChange: onPageChange,
    startScrollUnfold: startScrollUnfold, destroy: destroy,
    loadThreeJs: function () { return Promise.resolve(); }
  };
})();

window.Effects = Effects;
