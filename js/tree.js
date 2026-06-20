/* ============================================
   李氏家谱 - 家族树 HTML/SVG 渲染器
   夫妻同框 · 经典树状图 · 展开收起 · 拖拽缩放
   ============================================ */

const FamilyTree = (() => {
  let container = null;
  let svgLayer = null;       // SVG 连线层
  let nodesLayer = null;     // DOM 节点层
  let allNodes = [];
  let treeRoots = [];
  let scale = 1;
  let offsetX = 0, offsetY = 0;
  let isDragging = false, dragStartX, dragStartY, dragOffX, dragOffY;
  let collapsedSet = new Set();
  let onClickNode = null;

  const C = {
    nodeW: 200,             // 单人节点宽度
    nodeWSpouse: 300,       // 夫妻同框宽度
    nodeH: 80,              // 单人节点高度
    nodeHSpouse: 100,       // 夫妻同框高度
    hGap: 24,               // 兄弟节点水平间距
    vGap: 100,              // 代际垂直间距（核心：拉开代际距离）
    levelPad: 80,           // 左右留白
    colorMale: '#8B4513',
    colorFemale: '#8B0000',
    colorLine: '#B8860B',
    colorGold: '#D4AF37',
    font: '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif'
  };

  /* ==================== 初始化 ==================== */
  function init(containerId, clickCb) {
    container = document.getElementById(containerId);
    if (!container) return;
    onClickNode = clickCb;

    // 构建层级结构
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    // SVG 连线层（底层）
    svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLayer.setAttribute('class', 'tree-svg-layer');
    container.appendChild(svgLayer);

    // 节点层（上层）
    nodesLayer = document.createElement('div');
    nodesLayer.setAttribute('class', 'tree-nodes-layer');
    container.appendChild(nodesLayer);

    bindEvents();
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.max(rect.width, 400);
    const h = Math.max(rect.height, 500);
    container.style.width = w + 'px';
    container.style.height = h + 'px';
    svgLayer.setAttribute('width', w);
    svgLayer.setAttribute('height', h);
    svgLayer.style.width = w + 'px';
    svgLayer.style.height = h + 'px';
    render();
  }

  /* ==================== 事件绑定 ==================== */
  function bindEvents() {
    // 鼠标事件
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('click', onClick);

    // 触摸事件
    let touchDist = 0;
    container.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragOffX = offsetX;
        dragOffY = offsetY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: false });

    container.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        offsetX = dragOffX + (e.touches[0].clientX - dragStartX);
        offsetY = dragOffY + (e.touches[0].clientY - dragStartY);
        applyTransform();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const nd = Math.sqrt(dx * dx + dy * dy);
        if (touchDist > 0) {
          scale = Math.max(0.25, Math.min(3, scale * (nd / touchDist)));
          applyTransform();
        }
        touchDist = nd;
      }
    }, { passive: false });

    container.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  function onMouseDown(e) {
    if (e.target.closest('.tree-node') || e.target.closest('.tree-collapse-btn')) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffX = offsetX;
    dragOffY = offsetY;
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    offsetX = dragOffX + (e.clientX - dragStartX);
    offsetY = dragOffY + (e.clientY - dragStartY);
    applyTransform();
  }

  function onMouseUp() {
    isDragging = false;
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ds = -e.deltaY * 0.0012;
    const ns = Math.max(0.25, Math.min(3, scale + ds));
    const wx = (mx - offsetX) / scale;
    const wy = (my - offsetY) / scale;
    scale = ns;
    offsetX = mx - wx * scale;
    offsetY = my - wy * scale;
    applyTransform();
  }

  function onClick(e) {
    const btn = e.target.closest('.tree-collapse-btn');
    if (btn) {
      const id = parseInt(btn.dataset.id);
      toggleCollapse(id);
      return;
    }
    const nodeEl = e.target.closest('.tree-node');
    if (nodeEl && !isDragging && onClickNode) {
      const id = parseInt(nodeEl.dataset.id);
      if (id) onClickNode(id);
    }
  }

  function applyTransform() {
    nodesLayer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    // SVG 用 viewBox 变换更高效，这里用简单方式同步
    drawConnections();
  }

  /* ==================== 布局算法 ==================== */
  function buildLayout(roots) {
    if (!roots || roots.length === 0) return { flat: [], roots: [] };

    // 深拷贝
    const copy = node => ({
      ...node,
      children: (node.children || []).map(c => copy(c)),
      spouses: (node.spouses || []).map(s => ({ ...s }))
    });
    const rootsCopy = roots.map(r => copy(r));

    // 标记状态
    const visited = new Set();
    const markStatus = n => {
      if (visited.has(n.id)) return;
      visited.add(n.id);
      n._deceased = !!n.death_date;
      n.children.forEach(markStatus);
      n.spouses.forEach(markStatus);
    };
    rootsCopy.forEach(markStatus);

    // 计算每个节点的子树宽度（单位数）
    function calcWidth(node) {
      if (!node.children || node.children.length === 0 || collapsedSet.has(node.id)) {
        node._treeWidth = 1;
        return 1;
      }
      let w = 0;
      node.children.forEach(c => { w += calcWidth(c); });
      node._treeWidth = Math.max(w, 1);
      return node._treeWidth;
    }

    // 分配 X 坐标（单位坐标，后续转像素）
    function assignX(node, startX, level) {
      node._level = level;

      if (!node.children || node.children.length === 0 || collapsedSet.has(node.id)) {
        node._x = startX;
        node._y = level;
        return startX + 1;
      }

      let cx = startX;
      node.children.forEach(child => {
        cx = assignX(child, cx, level + 1);
      });

      // 父节点居中于所有子女的中心
      const firstChild = node.children[0];
      const lastChild = node.children[node.children.length - 1];
      const center = (firstChild._x + lastChild._x + lastChild._treeWidth - 1) / 2;
      node._x = center - 0.5;  // 占1个单位宽
      node._y = level;

      return Math.max(startX + 1, lastChild._x + lastChild._treeWidth);
    }

    rootsCopy.forEach(r => calcWidth(r));
    if (rootsCopy.length > 0) {
      assignX(rootsCopy[0], 0, 0);
    }

    // 扁平化
    const flat = [];
    function flatten(node) {
      flat.push(node);
      if (node.children && !collapsedSet.has(node.id)) {
        node.children.forEach(c => flatten(c));
      }
    }
    rootsCopy.forEach(r => flatten(r));

    // 单位 → 像素
    flat.forEach(n => {
      n.x = n._x * C.nodeW + n._x * C.hGap + C.levelPad;
      n.y = n._y * C.vGap + 40;
    });

    return { flat, roots: rootsCopy };
  }

  /* ==================== 节点尺寸 ==================== */
  function getNodeW(node) {
    return (node.spouses && node.spouses.length > 0) ? C.nodeWSpouse : C.nodeW;
  }
  function getNodeH(node) {
    return (node.spouses && node.spouses.length > 0) ? C.nodeHSpouse : C.nodeH;
  }

  /* ==================== 创建节点 DOM ==================== */
  function createNodeEl(node) {
    const spouses = node.spouses || [];
    const hasSpouse = spouses.length > 0;
    const nw = getNodeW(node);
    const nh = getNodeH(node);
    const isMale = node.gender !== 'female';
    const color = isMale ? C.colorMale : C.colorFemale;

    const el = document.createElement('div');
    el.className = 'tree-node' + (hasSpouse ? ' has-spouse' : '');
    el.dataset.id = node.id;
    el.style.width = nw + 'px';
    el.style.height = nh + 'px';
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    if (node._deceased) el.classList.add('deceased');

    // 顶部色条
    const header = document.createElement('div');
    header.className = 'tree-node-header';
    header.style.background = color;

    // 姓名区域
    const nameArea = document.createElement('div');
    nameArea.className = 'tree-node-name-area';

    const nameEl = document.createElement('div');
    nameEl.className = 'tree-node-name';
    nameEl.textContent = node.name || '未知';
    nameArea.appendChild(nameEl);

    if (hasSpouse) {
      // 夫妻同框布局
      el.innerHTML = '';

      const mainCol = document.createElement('div');
      mainCol.className = 'tree-node-main-col';

      const hdr = document.createElement('div');
      hdr.className = 'tree-node-header';
      hdr.style.background = color;
      hdr.textContent = node.name || '未知';
      mainCol.appendChild(hdr);

      const info = document.createElement('div');
      info.className = 'tree-node-info';
      let text = `${node.generation || '?'}代`;
      if (node.birth_date) {
        text += ` · ${String(node.birth_date).split('-')[0]}`;
        if (node.death_date) text += `-${String(node.death_date).split('-')[0]}`;
      }
      info.textContent = text;
      mainCol.appendChild(info);

      const genderIcon = document.createElement('div');
      genderIcon.className = 'tree-node-gender';
      genderIcon.textContent = isMale ? '♂' : '♀';
      mainCol.appendChild(genderIcon);

      const spouseCol = document.createElement('div');
      spouseCol.className = 'tree-node-spouse-col';

      const spouseHdr = document.createElement('div');
      spouseHdr.className = 'tree-spouse-header';
      spouseHdr.textContent = '配';
      spouseCol.appendChild(spouseHdr);

      const spouseList = document.createElement('div');
      spouseList.className = 'tree-spouse-list';

      spouses.forEach((s, idx) => {
        const sItem = document.createElement('div');
        sItem.className = 'tree-spouse-item';

        const sIsMale = s.gender !== 'female';
        const sColor = sIsMale ? C.colorMale : C.colorFemale;

        if (idx > 0) {
          const tag = document.createElement('span');
          tag.className = 'tree-spouse-tag';
          tag.textContent = idx === 1 ? '(继配)' : `(${idx}配)`;
          sItem.appendChild(tag);
        }

        const sName = document.createElement('span');
        sName.className = 'tree-spouse-name';
        sName.style.color = sColor;
        sName.textContent = s.name || '未知';
        sItem.appendChild(sName);

        const sGen = document.createElement('span');
        sGen.className = 'tree-spouse-gender';
        sGen.textContent = sIsMale ? '♂' : '♀';
        sItem.appendChild(sGen);

        if (s.birth_date && spouses.length <= 2) {
          const sYear = document.createElement('span');
          sYear.className = 'tree-spouse-years';
          const by = String(s.birth_date).split('-')[0];
          sYear.textContent = s.death_date ? `${by}-${String(s.death_date).split('-')[0]}` : by;
          sItem.appendChild(sYear);
        }

        spouseList.appendChild(sItem);
      });
      spouseCol.appendChild(spouseList);

      el.appendChild(mainCol);
      el.appendChild(spouseCol);

      // 已故标记
      if (node._deceased) {
        const cross = document.createElement('div');
        cross.className = 'tree-deceased-mark';
        cross.textContent = '✝';
        el.appendChild(cross);
      }

    } else {
      // 单人节点
      el.appendChild(header);
      el.appendChild(nameArea);

      const info = document.createElement('div');
      info.className = 'tree-node-info';
      let text = `${node.generation || '?'}代`;
      if (node.birth_date) {
        text += ` · ${String(node.birth_date).split('-')[0]}`;
        if (node.death_date) text += `-${String(node.death_date).split('-')[0]}`;
      }
      info.textContent = text;
      el.appendChild(info);

      const genderIcon = document.createElement('div');
      genderIcon.className = 'tree-node-gender';
      genderIcon.textContent = isMale ? '♂' : '♀';
      el.appendChild(genderIcon);

      if (node._deceased) {
        const cross = document.createElement('div');
        cross.className = 'tree-deceased-mark';
        cross.textContent = '✝';
        el.appendChild(cross);
      }
    }

    // 展开/收起按钮
    if (node.children && node.children.length > 0) {
      const btn = document.createElement('button');
      btn.className = 'tree-collapse-btn';
      btn.dataset.id = node.id;
      btn.title = collapsedSet.has(node.id) ? '展开子女' : '收起子女';
      btn.textContent = collapsedSet.has(node.id) ? '+' : '−';
      el.appendChild(btn);
    }

    return el;
  }

  /* ==================== 绘制连线（SVG）==================== */
  function drawConnections() {
    if (!svgLayer) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = parseFloat(svgLayer.getAttribute('width')) || container.offsetWidth;
    const ch = parseFloat(svgLayer.getAttribute('height')) || container.offsetHeight;

    // 清空旧连线
    while (svgLayer.firstChild) svgLayer.removeChild(svgLayer.firstChild);

    // 定义箭头/装饰
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgLayer.appendChild(defs);

    allNodes.forEach(p => {
      if (p._hidden || collapsedSet.has(p.id)) return;
      if (!p.children || p.children.length === 0) return;

      const pw = getNodeW(p);
      const ph = getNodeH(p);
      const pCx = p.x + pw / 2;
      const pBottom = p.y + ph;

      const visChildren = p.children.filter(c => !c._hidden);
      if (visChildren.length === 0) return;

      const cTop = visChildren[0].y;
      const midY = (pBottom + cTop) / 2;

      // 父节点底部中心 → 中间水平线的起点
      const pathD = buildConnectionPath(pCx, pBottom, visChildren, midY, cTop);
      if (!pathD) return;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('class', 'tree-conn-line');
      path.setAttribute('fill', 'none');
      svgLayer.appendChild(path);
    });
  }

  function buildConnectionPath(pCx, pBottom, children, midY, cTop) {
    if (children.length === 0) return null;

    const parts = [];

    if (children.length === 1) {
      // 单子女：直接竖线，带圆角折角效果
      const c = children[0];
      const cCx = c.x + getNodeW(c) / 2;
      const r = 8; // 圆角半径
      // 从父底部向下到中间偏上一点，然后到子顶部
      parts.push(`M ${pCx},${pBottom}`);
      parts.push(`L ${pCx},${midY}`);
      parts.push(`L ${cCx},${cTop}`);
    } else {
      // 多子女：倒T形树状分支
      const firstCx = children[0].x + getNodeW(children[0]) / 2;
      const lastCx = children[children.length - 1].x + getNodeW(children[children.length - 1]) / 2;

      // 主干线：父到底部中间
      parts.push(`M ${pCx},${pBottom}`);
      parts.push(`L ${pCx},${midY}`);

      // 横向分支线
      parts.push(`M ${firstCx},${midY}`);
      parts.push(`L ${lastCx},${midY}`);

      // 每个子节点的竖线
      children.forEach(c => {
        const cCx = c.x + getNodeW(c) / 2;
        parts.push(`M ${cCx},${midY}`);
        parts.push(`L ${cCx},${cTop}`);
      });
    }

    return parts.join(' ');
  }

  /* ==================== 渲染 ==================== */
  function render() {
    if (!container) return;

    // 清空节点层
    nodesLayer.innerHTML = '';

    if (allNodes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tree-empty';
      empty.textContent = '暂无成员，请先添加先祖';
      nodesLayer.appendChild(empty);
      svgLayer.innerHTML = '';
      return;
    }

    // 创建所有节点DOM
    allNodes.forEach(n => {
      if (!n._hidden) {
        nodesLayer.appendChild(createNodeEl(n));
      }
    });

    // 绘制连线（在节点下方）
    drawConnections();

    // 应用变换
    applyTransform();
  }

  /* ==================== 公共 API ==================== */

  function update(treeData) {
    collapsedSet.clear();
    const result = buildLayout(treeData.roots);
    allNodes = result.flat;
    treeRoots = result.roots;

    // 初始居中
    if (allNodes.length > 0) {
      const cw = container ? container.offsetWidth : 1000;
      const minX = Math.min(...allNodes.map(n => n.x));
      const maxX = Math.max(...allNodes.map(n => n.x + getNodeW(n)));
      const center = (minX + maxX) / 2;
      offsetX = cw / 2 - center;
      offsetY = 30;
      scale = 1;
    }
    render();
  }

  function layoutAndRender() {
    const result = buildLayout(treeRoots);
    allNodes = result.flat;
    render();
  }

  function toggleCollapse(id) {
    if (collapsedSet.has(id)) {
      collapsedSet.delete(id);
    } else {
      collapsedSet.add(id);
    }
    layoutAndRender();
  }

  function zoomIn() {
    scale = Math.min(3, scale + 0.2);
    applyTransform();
  }
  function zoomOut() {
    scale = Math.max(0.25, scale - 0.2);
    applyTransform();
  }
  function fitToScreen() {
    if (allNodes.length === 0 || !container) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const minX = Math.min(...allNodes.map(n => n.x)) - 30;
    const maxX = Math.max(...allNodes.map(n => n.x + getNodeW(n))) + 30;
    const minY = Math.min(...allNodes.map(n => n.y)) - 30;
    const maxY = Math.max(...allNodes.map(n => n.y + getNodeH(n))) + 30;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    scale = Math.min(cw / contentW, ch / contentH, 1.5);
    offsetX = (cw - contentW * scale) / 2 - minX * scale;
    offsetY = (ch - contentH * scale) / 2 - minY * scale;
    applyTransform();
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
    DB.getTreeData()
      .then(data => {
        if (!data || !data.roots || data.roots.length === 0) {
          allNodes = [];
          render();
          return;
        }
        try { update(data); } catch(e) { console.error('[FamilyTree] update error:', e); }
      })
      .catch(e => {
        console.error('[FamilyTree] getTreeData failed:', e);
        allNodes = [];
        render();
      });
  }

  return { init, update, render, zoomIn, zoomOut, fitToScreen, refresh, layoutAndRender, expandAll, collapseAll };
})();

window.FamilyTree = FamilyTree;
