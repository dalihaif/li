/* ============================================
   李氏家谱 - 家族树 Canvas 渲染器
   正交连线 · 夫妇同框 · 展开收起 · 碰撞避让
   ============================================ */

const FamilyTree = (() => {
  let canvas, ctx;
  let allNodes = [];       // 扁平节点列表（含配偶）
  let treeRoots = [];      // 根节点
  let scale = 1, offsetX = 0, offsetY = 0;
  let isDragging = false, dragStartX, dragStartY, dragOffX, dragOffY;
  let collapsedSet = new Set();
  let onClickNode = null;

  const C = {
    unitW: 160,          // 每个人占宽
    nodeW: 140,          // 节点宽
    nodeH: 72,           // 节点高
    hGap: 30,            // 水平间距
    vGap: 120,           // 代际垂直间距
    spouseGap: 8,        // 夫妇间间距
    lw: 2,               // 连线线宽
    colorMale: '#8B4513',
    colorFemale: '#8B0000',
    colorLine: '#D4AF37',
    colorGold: '#B8860B',
    bg: '#F5E6C8',
    font: '"Noto Sans SC","PingFang SC",sans-serif',
    fontTitle: '"Noto Serif SC","STSong",serif',
    r: 6                 // 圆角
  };

  function init(canvasId, clickCb) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    onClickNode = clickCb;
    resize();
    window.addEventListener('resize', resize);
    setupEvents();
  }

  function resize() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setupEvents() {
    ['mousedown','mousemove','mouseup','mouseleave','wheel','click','dblclick'].forEach(evt =>
      canvas.addEventListener(evt, e => handleEvent(evt, e))
    );
    ['touchstart','touchmove','touchend'].forEach(evt =>
      canvas.addEventListener(evt, e => handleTouch(evt, e), { passive: false })
    );
  }

  let touchDist = 0;
  function handleTouch(evt, e) {
    e.preventDefault();
    if (evt === 'touchstart') {
      if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragOffX = offsetX; dragOffY = offsetY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDist = Math.sqrt(dx*dx + dy*dy);
      }
    } else if (evt === 'touchmove' && e.touches.length === 1 && isDragging) {
      offsetX = dragOffX + (e.touches[0].clientX - dragStartX);
      offsetY = dragOffY + (e.touches[0].clientY - dragStartY);
      render();
    } else if (evt === 'touchmove' && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const nd = Math.sqrt(dx*dx + dy*dy);
      if (touchDist > 0) { scale = Math.max(0.2, Math.min(3, scale * (nd / touchDist))); }
      touchDist = nd;
      render();
    } else if (evt === 'touchend') {
      isDragging = false;
      if (e.changedTouches.length === 1 && 'changedTouches' in e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.changedTouches[0].clientX - rect.left;
        const my = e.changedTouches[0].clientY - rect.top;
        const cn = hitTestCollapseBtn(mx, my);
        if (cn) {
          if (collapsedSet.has(cn.id)) collapsedSet.delete(cn.id);
          else collapsedSet.add(cn.id);
          layoutAndRender();
        } else {
          const n = hitTest(mx, my);
          if (n && onClickNode) onClickNode(n.id);
        }
      }
    }
  }

  function handleEvent(evt, e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (evt === 'mousedown') {
      isDragging = true;
      dragStartX = mx; dragStartY = my;
      dragOffX = offsetX; dragOffY = offsetY;
    } else if (evt === 'mousemove' && isDragging) {
      offsetX = dragOffX + (mx - dragStartX);
      offsetY = dragOffY + (my - dragStartY);
      render();
    } else if (evt === 'mouseup' || evt === 'mouseleave') {
      isDragging = false;
    } else if (evt === 'wheel') {
      e.preventDefault();
      const ds = -e.deltaY * 0.001;
      const ns = Math.max(0.2, Math.min(3, scale + ds));
      const wx = (mx - offsetX) / scale, wy = (my - offsetY) / scale;
      scale = ns;
      offsetX = mx - wx * scale; offsetY = my - wy * scale;
      render();
    } else if (evt === 'click' && !isDragging) {
      const cn = hitTestCollapseBtn(mx, my);
      if (cn) {
        if (collapsedSet.has(cn.id)) collapsedSet.delete(cn.id);
        else collapsedSet.add(cn.id);
        layoutAndRender();
        return;
      }
      const n = hitTest(mx, my);
      if (n && onClickNode) onClickNode(n.id);
    }
  }

  function hitTestCollapseBtn(mx, my) {
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const n = allNodes[i];
      if (n._hidden || !n.children || n.children.length === 0 || n._isSpouse) continue;
      const bx = (n.x + C.nodeW - 16) * scale + offsetX;
      const by = (n.y + C.nodeH - 16) * scale + offsetY;
      const br = 14 * scale;
      if (Math.abs(mx - bx) <= br && Math.abs(my - by) <= br) return n;
    }
    return null;
  }

  function hitTest(mx, my) {
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const n = allNodes[i];
      if (n._hidden) continue;
      const nx = n.x * scale + offsetX;
      const ny = n.y * scale + offsetY;
      const nw = (n._isSpouse ? C.nodeW : C.nodeW) * scale;
      const nh = C.nodeH * scale;
      if (mx >= nx && mx <= nx + nw && my >= ny && my <= ny + nh) return n;
    }
    return null;
  }

  // ==================== 布局算法 ====================

  function buildLayout(roots) {
    // 深拷贝并预处理
    const copy = node => {
      const n = { ...node, children: [], spouses: (node.spouses || []).map(s => ({ ...s, _isSpouse: true })) };
      (node.children || []).forEach(c => n.children.push(copy(c)));
      return n;
    };
    const rootsCopy = roots.map(r => copy(r));

    // 标记已故/在世
    const markStatus = n => {
      n._deceased = !!n.death_date;
      (n.children || []).forEach(markStatus);
      (n.spouses || []).forEach(markStatus);
    };
    rootsCopy.forEach(markStatus);

    // 计算子树宽度（考虑收起）
    function calcWidth(node) {
      if (!node.children || node.children.length === 0 || collapsedSet.has(node.id)) {
        node._treeWidth = 1 + (node.spouses && node.spouses.length > 0 ? 1 : 0);
        return node._treeWidth;
      }
      let w = 0;
      node.children.forEach(c => w += calcWidth(c));
      // 夫妇作为一个整体居中在子女上方
      node._treeWidth = Math.max(w, 1 + (node.spouses && node.spouses.length > 0 ? 1 : 0));
      return node._treeWidth;
    }

    // 分配 X 位置（单位坐标）
    function assignX(node, startX, level) {
      node._level = level;
      const hasSpouse = node.spouses && node.spouses.length > 0;
      const nodeUnits = 1 + (hasSpouse ? 1 : 0);

      if (!node.children || node.children.length === 0 || collapsedSet.has(node.id)) {
        node._x = startX;
        node._y = level;
        if (hasSpouse) {
          node.spouses[0]._x = startX + 1;
          node.spouses[0]._y = level;
          node.spouses[0]._hidden = false;
        }
        return startX + nodeUnits;
      }

      let cx = startX;
      node.children.forEach(child => { cx = assignX(child, cx, level + 1); });

      // 居中：第一个和最后一个子女的中心
      const firstX = node.children[0]._x;
      const lastX = node.children[node.children.length - 1]._x;
      const lastW = node.children[node.children.length - 1]._treeWidth;
      const center = (firstX + lastX + lastW - 1) / 2;

      node._x = center - (nodeUnits - 1) / 2;
      node._y = level;

      if (hasSpouse) {
        node.spouses[0]._x = node._x + 1;
        node.spouses[0]._y = level;
        node.spouses[0]._hidden = false;
      }

      return Math.max(startX + nodeUnits, lastX + lastW);
    }

    rootsCopy.forEach(r => { calcWidth(r); assignX(r, 0, 0); });

    // 扁平化所有节点
    const flat = [];
    function flatten(node) {
      flat.push(node);
      if (node.spouses) node.spouses.forEach(s => { s._parentId = node.id; flat.push(s); });
      if (node.children && !collapsedSet.has(node.id)) node.children.forEach(c => flatten(c));
    }
    rootsCopy.forEach(r => flatten(r));

    // 转换单位坐标到像素坐标
    flat.forEach(n => {
      n.x = n._x * C.unitW + 60;
      n.y = n._y * C.vGap + 50;
    });

    return { flat, roots: rootsCopy };
  }

  // ==================== 渲染 ====================

  function render() {
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    // 宣纸底色
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // 浅纹理（细线网格）
    ctx.strokeStyle = 'rgba(139,69,19,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    if (allNodes.length === 0) {
      ctx.fillStyle = '#8D6E63';
      ctx.font = `20px ${C.font}`;
      ctx.textAlign = 'center';
      ctx.fillText('暂无成员，请先添加先祖', w/2, h/2);
      return;
    }

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. 先画所有连线
    drawAllConnections();

    // 2. 再画所有节点（在上层）
    allNodes.forEach(n => {
      if (!n._hidden) drawNode(n);
    });

    ctx.restore();
  }

  function drawAllConnections() {
    // 父子连线（正交）
    allNodes.forEach(p => {
      if (p._isSpouse || p._hidden) return;
      if (collapsedSet.has(p.id)) return;
      if (!p.children || p.children.length === 0) return;

      const hasSpouse = p.spouses && p.spouses.length > 0;
      const pCenterX = p.x + C.nodeW / 2 + (hasSpouse ? C.unitW / 2 : 0);
      const pBottom = p.y + C.nodeH;

      // 孩子的位置范围
      const visChildren = p.children.filter(c => !c._hidden);
      if (visChildren.length === 0) return;

      const firstC = visChildren[0];
      const lastC = visChildren[visChildren.length - 1];
      const cTop = firstC.y;
      const midY = (pBottom + cTop) / 2;

      ctx.strokeStyle = C.colorLine;
      ctx.lineWidth = C.lw;
      ctx.setLineDash([]);

      // 垂直从父节点到中间
      ctx.beginPath();
      ctx.moveTo(pCenterX, pBottom);
      ctx.lineTo(pCenterX, midY);
      ctx.stroke();

      if (visChildren.length === 1) {
        // 直接垂直连线
        ctx.beginPath();
        ctx.moveTo(pCenterX, midY);
        ctx.lineTo(pCenterX, cTop);
        ctx.stroke();
      } else {
        // 水平横杠
        const firstCX = firstC.x + C.nodeW / 2 + (firstC.spouses && firstC.spouses.length > 0 ? C.unitW / 2 : 0);
        const lastCX = lastC.x + C.nodeW / 2 + (lastC.spouses && lastC.spouses.length > 0 ? C.unitW / 2 : 0);
        ctx.beginPath();
        ctx.moveTo(firstCX, midY);
        ctx.lineTo(lastCX, midY);
        ctx.stroke();

        // 垂直到每个孩子
        visChildren.forEach(c => {
          const cCX = c.x + C.nodeW / 2 + (c.spouses && c.spouses.length > 0 ? C.unitW / 2 : 0);
          ctx.beginPath();
          ctx.moveTo(cCX, midY);
          ctx.lineTo(cCX, cTop);
          ctx.stroke();
        });
      }
    });

    // 夫妇连线（短横线）
    allNodes.forEach(n => {
      if (n._hidden || n._isSpouse) return;
      if (n.spouses && n.spouses.length > 0) {
        const s = n.spouses[0];
        if (s._hidden) return;
        ctx.strokeStyle = C.colorGold;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(n.x + C.nodeW, n.y + C.nodeH / 2);
        ctx.lineTo(s.x, s.y + C.nodeH / 2);
        ctx.stroke();
      }
    });

    // 已故成员的标记线（灰色虚线穿过节点）
    allNodes.forEach(n => {
      if (n._deceased && !n._hidden) {
        ctx.strokeStyle = 'rgba(153,153,153,0.3)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3,3]);
        const nw = n._isSpouse ? C.nodeW : C.nodeW;
        ctx.beginPath();
        ctx.moveTo(n.x + 10, n.y + C.nodeH / 2);
        ctx.lineTo(n.x + nw - 10, n.y + C.nodeH / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  function drawNode(node) {
    const x = node.x, y = node.y;
    const nw = node._isSpouse ? C.nodeW : C.nodeW;
    const nh = C.nodeH, r = C.r;
    const isMale = node.gender !== 'female';
    const color = isMale ? C.colorMale : C.colorFemale;
    const member = node;

    // 阴影
    ctx.save();
    ctx.shadowColor = 'rgba(26,15,10,0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // 主体圆形
    ctx.beginPath();
    roundRect(ctx, x, y, nw, nh, r);
    ctx.fillStyle = '#FAF0DC';
    ctx.fill();
    ctx.restore();

    // 边框
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 顶部色条
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + nw - r, y);
    ctx.quadraticCurveTo(x + nw, y, x + nw, y + r);
    ctx.lineTo(x + nw, y + 26);
    ctx.lineTo(x, y + 26);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // 姓名
    ctx.fillStyle = '#FFF';
    ctx.font = `bold 14px ${C.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = member.name || '未知';
    ctx.fillText(name.length > 4 ? name.slice(0,3) + '…' : name, x + nw/2, y + 13);

    // 世代 + 年份
    ctx.fillStyle = '#5D4037';
    ctx.font = `11px ${C.font}`;
    let info = `${member.generation || '?'}代`;
    if (member.birth_date) {
      const by = member.birth_date.split('-')[0];
      info += ` · ${by}`;
      if (member.death_date) info += `-${member.death_date.split('-')[0]}`;
    }
    ctx.fillText(info, x + nw/2, y + 42);

    // 性别符号
    ctx.fillStyle = node._deceased ? '#999' : color;
    ctx.font = '13px sans-serif';
    ctx.fillText(isMale ? '♂' : '♀', x + nw/2, y + 60);

    // 展开/收起指示
    if (node.children && node.children.length > 0 && !node._isSpouse) {
      const isCollapsed = collapsedSet.has(node.id);
      ctx.fillStyle = isCollapsed ? C.colorGold : '#fff';
      ctx.strokeStyle = C.colorGold;
      ctx.lineWidth = 1.5;
      const ix = x + nw - 16, iy = y + nh - 16, isz = 16;
      ctx.beginPath();
      ctx.arc(ix, iy, isz/2, 0, Math.PI*2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.colorGold;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isCollapsed ? '+' : '−', ix, iy);
    }

    // 已故标记 - 小十字
    if (node._deceased) {
      ctx.fillStyle = 'rgba(139,0,0,0.3)';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('✝', x + nw - 4, y + 3);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ==================== 公共 API ====================

  function update(treeData) {
    collapsedSet.clear();
    const result = buildLayout(treeData.roots);
    allNodes = result.flat;
    treeRoots = result.roots;

    // 居中
    if (allNodes.length > 0) {
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas ? canvas.width / dpr : 1000;
      const minX = Math.min(...allNodes.map(n => n.x));
      const maxX = Math.max(...allNodes.map(n => n.x + C.nodeW));
      const center = (minX + maxX) / 2;
      offsetX = cw / 2 - center;
      offsetY = 20;
      scale = 1;
    }
    render();
  }

  function layoutAndRender() {
    const result = buildLayout(treeRoots);
    allNodes = result.flat;
    render();
  }

  function zoomIn() { scale = Math.min(3, scale + 0.25); render(); }
  function zoomOut() { scale = Math.max(0.2, scale - 0.25); render(); }
  function fitToScreen() {
    if (allNodes.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    const minX = Math.min(...allNodes.map(n => n.x)) - 40;
    const maxX = Math.max(...allNodes.map(n => n.x + C.nodeW)) + 40;
    const minY = Math.min(...allNodes.map(n => n.y)) - 40;
    const maxY = Math.max(...allNodes.map(n => n.y + C.nodeH)) + 40;
    const cw2 = maxX - minX, ch2 = maxY - minY;
    scale = Math.min(cw / cw2, ch / ch2, 1.5);
    offsetX = (cw - cw2 * scale) / 2 - minX * scale;
    offsetY = (ch - ch2 * scale) / 2 - minY * scale;
    render();
  }

  function expandAll() {
    collapsedSet.clear();
    layoutAndRender();
  }

  function collapseAll() {
    collapsedSet.clear();
    function walk(nodes) {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          collapsedSet.add(n.id);
          walk(n.children);
        }
      });
    }
    walk(treeRoots);
    layoutAndRender();
  }

  function refresh() {
    DB.getTreeData().then(data => update(data));
  }

  return { init, update, render, zoomIn, zoomOut, fitToScreen, refresh, layoutAndRender, expandAll, collapseAll };
})();

window.FamilyTree = FamilyTree;

