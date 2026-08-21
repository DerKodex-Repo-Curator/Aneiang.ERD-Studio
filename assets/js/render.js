/* ================================================================
   Aneiang ERD Studio · render.js — 画布渲染：域背景 / 表卡片 / 关系连线 / 图例 / 统计
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.render = (function () {
  const HH = ERD.HEAD_H;
  let canvas, svg, viewport, edgeEls = [], byKey = {}, rafPending = false;
  let zoneCache = null;              // 域 key → 域对象 缓存（renderZones 时重建）
  let defsEl = null, defsCv = null, defsCvHi = null;   // SVG marker 缓存（主题色变化时重建）

  /* 迷你地图状态 */
  const mm = { cv: null, ctx: null, W: 170, H: 120, s: 0, ox: 0, oy: 0, bx: 0, by: 0, dragging: false };

  function init() {
    canvas = document.getElementById('canvas');
    svg = document.getElementById('edges');
    viewport = document.getElementById('viewport');
    mm.cv = document.getElementById('mm-canvas');
    if (mm.cv) {
      mm.ctx = mm.cv.getContext('2d');
      mm.cv.addEventListener('pointerdown', mmPointerDown);
      mm.cv.addEventListener('pointermove', mmPointerMove);
      mm.cv.addEventListener('pointerup', () => { mm.dragging = false; });
      mm.cv.addEventListener('pointercancel', () => { mm.dragging = false; });
    }
    applyView();
  }

  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.body).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function tableH(t) { return ERD.tableH(t); }
  function zoneInfo() {
    if (!zoneCache) {
      zoneCache = new Map();
      (ERD.store.state.p.zones || []).forEach(z => zoneCache.set(z.key, z));
    }
    return zoneCache;
  }
  function zoneColor(zoneKey) {
    const z = zoneInfo().get(zoneKey);
    return z ? ERD.safeColor(z.color) : '#8b93a3';
  }
  function zoneName(zoneKey) {
    const z = zoneInfo().get(zoneKey);
    return z ? ERD.zoneLabel(z) : _t('未分组', 'Ungrouped');
  }

  /* ---------- 全量渲染 ---------- */
  function renderAll() {
    const p = ERD.store.state.p; if (!p) return;
    p.tables.forEach(t => { t.h = tableH(t); byKey[t.key] = t; });
    renderZones();
    renderTables();
    renderEdges();
    renderLegend();
    renderStats();
    renderEmpty();
    applySelStyles();
  }

  /* ---------- 域背景带 ---------- */
  function renderZones() {
    zoneCache = null;   // 域数据可能已变，重建缓存
    canvas.querySelectorAll('.zone').forEach(z => z.remove());
    const p = ERD.store.state.p;
    const groups = {};
    p.tables.forEach(t => { const k = t.zone || ''; (groups[k] = groups[k] || []).push(t); });
    Object.entries(groups).forEach(([zk, ts]) => {
      if (!zk) return;
      const x = Math.min(...ts.map(t => t.x)) - 20;
      const y = Math.min(...ts.map(t => t.y)) - 44;
      const w = Math.max(...ts.map(t => t.x + ERD.cardW(t))) + 20 - x;
      const h = Math.max(...ts.map(t => t.y + t.h)) + 20 - y;
      const z = document.createElement('div');
      z.className = 'zone';
      z.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
      const lb = document.createElement('div');
      lb.className = 'zone-label';
      lb.style.color = zoneColor(zk);
      lb.textContent = zoneName(zk) + ' · ' + ts.length + _t(' 表', ' tables');
      z.appendChild(lb);
      canvas.insertBefore(z, svg);
    });
  }

  /* ---------- 表卡片 ---------- */
  function buildTableEl(t) {
    const el = document.createElement('div');
    el.className = 'table' + (t.fold ? ' folded' : '');
    el.dataset.key = t.key;
    el.style.cssText = 'left:' + t.x + 'px;top:' + t.y + 'px;width:' + ERD.cardW(t) + 'px';
    const head = document.createElement('div');
    head.className = 't-head';
    head.style.borderTopColor = zoneColor(t.zone);
    const core = t.core ? '<span class="t-core" style="background:' + zoneColor(t.zone) + '">' + _t('核心', 'Core') + '</span>' : '';
    const folded = t.fold ? '<span class="t-folded">' + _t('已折叠', 'Folded') + '</span>' : '';
    /* 两行表头：行1 = 英文表名 + 折叠箭头；行2 = 中文名 + 列数 + 标记 */
    head.innerHTML =
      '<div class="t-row1"><span class="t-name" title="' + ERD.esc(t.key) + '">' + ERD.esc(t.key) + '</span>' +
      '<button class="t-fold" title="' + (t.fold ? _t('展开字段', 'Expand fields') : _t('折叠字段', 'Fold fields')) + '"><i class="ri-arrow-' + (t.fold ? 'right' : 'down') + '-s-line"></i></button></div>' +
      '<div class="t-row2"><span class="t-cn" title="' + ERD.esc(t.cn || '') + '">' + ERD.esc(t.cn || '') + '</span>' +
      '<span class="t-cnt">' + t.cols.filter(c => c[2] !== 'g').length + _t('列', ' cols') + '</span>' + core + folded + '</div>';
    el.appendChild(head);
    if (!t.fold) {
      const rows = document.createElement('div');
      rows.className = 'rows';
      t.cols.forEach(c => rows.appendChild(buildRow(t, c)));
      el.appendChild(rows);
    }
    el.querySelector('.t-fold').addEventListener('click', e => {
      e.stopPropagation();
      ERD.store.setFold(t.key, !t.fold);
    });
    return el;
  }

  function renderTables() {
    canvas.querySelectorAll('.table').forEach(el => el.remove());
    const p = ERD.store.state.p;
    p.tables.forEach(t => {
      const el = buildTableEl(t);
      t.el = el;
      byKey[t.key] = t;
      canvas.appendChild(el);
    });
  }

  function buildRow(t, c) {
    const r = document.createElement('div');
    r.className = 'row';
    r.dataset.col = c[0];
    if (c[2] === 'g') {
      r.innerHTML = '<span style="color:' + zoneColor(t.zone) + ';font-size:9px;font-weight:600;letter-spacing:1px">▸ ' + ERD.esc(c[1]) + '</span>';
    } else {
      const badge = c[2] ? '<span class="badge b-' + c[2] + '">' + (c[2] === 'idx' ? 'IDX' : c[2].toUpperCase()) + '</span>' : '';
      const nn = (c[4] || c[2] === 'pk') ? '<span class="nn-star" title="非空 NOT NULL">✱</span>' : '';
      r.innerHTML = '<span class="c-name">' + ERD.esc(c[0]) + '</span>' + nn + '<span class="c-type">' + ERD.esc(c[1]) + '</span>' + badge;
      r.title = t.key + '.' + c[0] + ' · ' + c[1] + (c[4] || c[2] === 'pk' ? ' · NOT NULL' : '') + (c[3] ? ' — ' + c[3] : '');
    }
    return r;
  }

  function updateTableCard(key) {
    const t = byKey[key]; if (!t) return;
    const p = ERD.store.state.p;
    t.h = tableH(t);
    if (t.el) {
      t.el.remove();
      t.el = null;
    }
    // 重建卡片并放回原位置
    const idx = p.tables.indexOf(t);
    const ref = idx > 0 ? byKey[p.tables[idx - 1].key] : null;
    const el = buildTableEl(t);
    t.el = el;
    if (ref && ref.el && ref.el.nextSibling) canvas.insertBefore(el, ref.el.nextSibling);
    else canvas.appendChild(el);
    applySelStyles();
  }

  /* 单表定点刷新：仅重建该卡片 + 域背景 + 连线 + 图例/统计（避免全量重建所有表） */
  function refreshTable(key) {
    const t = byKey[key]; if (!t) return;
    updateTableCard(key);
    /* 表重命名（key 变更）时重建 byKey 映射，避免后续定点刷新失配 */
    if (t.key !== key) { byKey[t.key] = t; delete byKey[key]; }
    renderZones();
    renderEdges();
    renderStats();
    renderLegend();
    applyFilter();
    applySelStyles();
  }

  /* 关系变更：重绘连线 + 统计 + 受影响表卡片（fk 徽标） */
  function refreshRelations(scope) {
    renderEdges();
    renderStats();
    const keys = scope && scope.keys ? scope.keys : (scope && scope.key ? [scope.key] : []);
    keys.forEach(k => { const t = byKey[k]; if (t) updateTableCard(k); });
    renderZones();
    applyFilter();
    applySelStyles();
  }

  /* ---------- 连线 ---------- */
  function colY(t, colName) { return ERD.colPos(t, colName).y; }

  function renderEdges() {
    const p = ERD.store.state.p;
    /* 只清掉旧连线，保留 defs（marker 缓存，主题色未变则无需重建） */
    Array.from(svg.children).forEach(ch => { if (ch.tagName !== 'defs') svg.removeChild(ch); });
    edgeEls = [];
    const bounds = canvasBounds();
    svg.setAttribute('width', Math.max(10, bounds.w));
    svg.setAttribute('height', Math.max(10, bounds.h));
    const cv = cssVar('--fk', '#7aa2f7'), cvHi = cssVar('--edge-hi', '#e0af68');
    ensureDefs(cv, cvHi);

    p.relations.forEach(r => {
      if (r.type === 'fk') drawFk(r);
      else if (ERD.view.showLogical) drawLogical(r);
    });
    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ghost.setAttribute('id', 'ghost');
    svg.appendChild(ghost);
    applySelStyles();
  }

  /* SVG 箭头 marker 复用：仅当主题色变化时重建 innerHTML */
  function ensureDefs(cv, cvHi) {
    if (!defsEl || !defsEl.isConnected) {
      defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.appendChild(defsEl);
      defsCv = defsCvHi = null;
    }
    if (defsCv !== cv || defsCvHi !== cvHi) {
      defsEl.innerHTML =
        '<marker id="crow" markerWidth="16" markerHeight="14" refX="15" refY="7" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M0 7 L14 1 M0 7 L14 7 M0 7 L14 13" stroke="' + cv + '" stroke-width="1.3" fill="none"/></marker>' +
        '<marker id="crow-hi" markerWidth="16" markerHeight="14" refX="15" refY="7" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M0 7 L14 1 M0 7 L14 7 M0 7 L14 13" stroke="' + cvHi + '" stroke-width="1.6" fill="none"/></marker>' +
        '<marker id="one" markerWidth="10" markerHeight="14" refX="2" refY="7" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M8 1 L8 13" stroke="' + cv + '" stroke-width="1.3" fill="none"/></marker>' +
        '<marker id="one-hi" markerWidth="10" markerHeight="14" refX="2" refY="7" orient="auto" markerUnits="userSpaceOnUse">' +
        '<path d="M8 1 L8 13" stroke="' + cvHi + '" stroke-width="1.6" fill="none"/></marker>';
      defsCv = cv; defsCvHi = cvHi;
    }
  }

  function addPath(from, to, logical, rel, label) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ERD.edgePath(from, to, ERD.ui.get('edgeStyle')));
    p.setAttribute('class', 'edge' + (logical ? ' logical' : ''));
    const hi = rel && rel.card === '1:1';
    p.setAttribute('marker-start', 'url(#one)');
    p.setAttribute('marker-end', logical ? 'none' : (hi ? 'url(#one-hi)' : 'url(#crow)'));
    svg.appendChild(p);
    if (label) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', (from.x + to.x) / 2);
      t.setAttribute('y', (from.y + to.y) / 2 - 4);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'edge-label');
      t.textContent = label;
      svg.appendChild(t);
      p._lbl = t;
    }
    p._rel = rel;
    edgeEls.push(p);
    return p;
  }

  function edgePoint(childT, childCol, parentT) {
    const cw = ERD.cardW(childT), pw = ERD.cardW(parentT);
    if (childT === parentT) {
      const p = ERD.colPos(childT, childCol);
      return { from: { x: p.x, y: p.y + 14 }, to: { x: p.x, y: p.y - 6 }, self: true };
    }
    const cp = ERD.colPos(childT, childCol);
    const pc = (parentT.cols.find(c => c[0] === 'id') ? 'id' : (parentT.cols[0] && parentT.cols[0][0])) || 'id';
    const pp = ERD.colPos(parentT, pc);
    const childLeft = { x: childT.x, y: cp.y };
    const childRight = { x: childT.x + cw, y: cp.y };
    const parentLeft = { x: parentT.x, y: pp.y };
    const parentRight = { x: parentT.x + pw, y: pp.y };
    if (parentT.x + pw < childT.x - 10) return { from: parentRight, to: childLeft };
    if (childT.x + cw < parentT.x - 10) return { from: childRight, to: parentLeft };
    if (childT.y > parentT.y) return { from: { x: parentT.x + pw / 2, y: parentT.y + parentT.h }, to: { x: childT.x + cw / 2, y: childT.y } };
    return { from: { x: childT.x + cw / 2, y: childT.y + childT.h }, to: { x: parentT.x + pw / 2, y: parentT.y } };
  }

  function drawFk(r) {
    const ct = byKey[r.child], pt = byKey[r.parent];
    if (!ct || !pt) return;
    const ep = edgePoint(ct, r.col, pt);
    addPath(ep.from, ep.to, false, r, '');
  }

  function drawLogical(r) {
    const ct = byKey[r.from], pt = byKey[r.to];
    if (!ct || !pt) return;
    const cy = ct.y + HH + 40, py = pt.y + HH + 60;
    const cw = ERD.cardW(ct), pw = ERD.cardW(pt);
    let from, to;
    if (ct.x + cw < pt.x) { from = { x: ct.x + cw, y: cy }; to = { x: pt.x, y: py }; }
    else { from = { x: ct.x, y: cy }; to = { x: pt.x + pw, y: py }; }
    addPath(from, to, true, r, r.label || '');
  }

  function canvasBounds() {
    const p = ERD.store.state.p;
    if (!p.tables.length) return { w: 2600, h: 1800, minX: 0, minY: 0, maxX: 2600, maxY: 1800 };
    const minX = Math.min(...p.tables.map(t => t.x)) - 60;
    const minY = Math.min(...p.tables.map(t => t.y)) - 60;
    const maxX = Math.max(...p.tables.map(t => t.x + ERD.cardW(t))) + 60;
    const maxY = Math.max(...p.tables.map(t => t.y + t.h)) + 60;
    return { w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
  }

  /* ---------- 拖动中的轻量刷新 ---------- */
  function scheduleMove(key) {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const t = byKey[key];
      if (t && t.el) { t.el.style.left = t.x + 'px'; t.el.style.top = t.y + 'px'; }
      renderZones();
      renderEdges();
      applyFilter();
      applyFocusStyles();
      applySelStyles();
    });
  }

  /* ---------- 视图变换 ---------- */
  function applyView() {
    canvas.style.transform = 'translate(' + ERD.view.tx + 'px,' + ERD.view.ty + 'px) scale(' + ERD.view.scale + ')';
    const zi = document.getElementById('zoom-ind');
    if (zi) zi.textContent = Math.round(ERD.view.scale * 100) + '%';
    renderMinimap();
  }

  /* ---------- 迷你地图 ---------- */
  function renderMinimap() {
    if (!mm.cv || !mm.ctx) return;
    const p = ERD.store.state.p; if (!p) return;
    const W = mm.W, H = mm.H, ctx = mm.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cssVar('--panel2', '#1b202b');
    ctx.fillRect(0, 0, W, H);
    if (!p.tables.length) return;
    const pad = 24;
    const minX = Math.min(...p.tables.map(t => t.x)) - pad;
    const minY = Math.min(...p.tables.map(t => t.y)) - pad;
    const maxX = Math.max(...p.tables.map(t => t.x + ERD.cardW(t))) + pad;
    const maxY = Math.max(...p.tables.map(t => t.y + ERD.tableH(t))) + pad;
    mm.bx = minX; mm.by = minY;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    mm.s = Math.min(W / bw, H / bh);
    mm.ox = (W - bw * mm.s) / 2; mm.oy = (H - bh * mm.s) / 2;
    /* 表卡片（按域着色） */
    p.tables.forEach(t => {
      ctx.fillStyle = zoneColor(t.zone);
      ctx.fillRect(mm.ox + (t.x - minX) * mm.s, mm.oy + (t.y - minY) * mm.s,
        Math.max(2, ERD.cardW(t) * mm.s), Math.max(2, ERD.tableH(t) * mm.s));
    });
    /* 当前视口 */
    const r = viewport.getBoundingClientRect();
    const vx = -ERD.view.tx / ERD.view.scale, vy = -ERD.view.ty / ERD.view.scale;
    const vw = r.width / ERD.view.scale, vh = r.height / ERD.view.scale;
    const rx = mm.ox + (vx - minX) * mm.s, ry = mm.oy + (vy - minY) * mm.s;
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.fillRect(rx, ry, vw * mm.s, vh * mm.s);
    ctx.strokeStyle = cssVar('--edge-hi', '#e0af68');
    ctx.lineWidth = 1.4;
    ctx.strokeRect(rx, ry, vw * mm.s, vh * mm.s);
  }

  function mmJump(mx, my) {
    if (!mm.s) return;
    const r = viewport.getBoundingClientRect();
    const wx = mm.bx + (mx - mm.ox) / mm.s;
    const wy = mm.by + (my - mm.oy) / mm.s;
    ERD.view.tx = r.width / 2 - wx * ERD.view.scale;
    ERD.view.ty = r.height / 2 - wy * ERD.view.scale;
    applyView();
  }
  function mmPointerDown(e) {
    mm.dragging = true;
    try { mm.cv.setPointerCapture && mm.cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件等场景可忽略 */ }
    const r = mm.cv.getBoundingClientRect();
    mmJump(e.clientX - r.left, e.clientY - r.top);
  }
  function mmPointerMove(e) {
    if (!mm.dragging) return;
    const r = mm.cv.getBoundingClientRect();
    mmJump(e.clientX - r.left, e.clientY - r.top);
  }

  function fit() {
    const p = ERD.store.state.p; if (!p || !p.tables.length) { ERD.view.scale = 1; ERD.view.tx = 60; ERD.view.ty = 60; applyView(); return; }
    const b = canvasBounds();
    const r = viewport.getBoundingClientRect();
    ERD.view.scale = Math.min((r.width - 60) / b.w, (r.height - 60) / b.h, 1.2);
    ERD.view.scale = Math.max(0.1, ERD.view.scale);
    ERD.view.tx = (r.width - b.w * ERD.view.scale) / 2 - b.minX * ERD.view.scale;
    ERD.view.ty = (r.height - b.h * ERD.view.scale) / 2 - b.minY * ERD.view.scale;
    applyView();
  }

  /* ---------- 聚焦 / 选中 / 过滤 ---------- */
  function relatedEdges(key) {
    return edgeEls.filter(p => {
      const r = p._rel; if (!r) return false;
      if (r.type === 'fk') return r.child === key || r.parent === key;
      return r.from === key || r.to === key;
    });
  }

  function applyFocusStyles() {
    const fk = ERD.view.focusKey;
    const p = ERD.store.state.p;
    if (!fk) {
      p.tables.forEach(t => t.el && t.el.classList.remove('dim', 'hi', 'near'));
      edgeEls.forEach(e => { e.classList.remove('hi', 'dim'); if (e._lbl) e._lbl.style.opacity = 1; });
      return;
    }
    const related = new Set([fk]);
    edgeEls.forEach(e => {
      const r = e._rel; if (!r) return;
      if (r.type === 'fk') { if (r.child === fk) related.add(r.parent); if (r.parent === fk) related.add(r.child); }
      else { if (r.from === fk) related.add(r.to); if (r.to === fk) related.add(r.from); }
    });
    p.tables.forEach(t => t.el && t.el.classList.toggle('dim', !related.has(t.key)));
    edgeEls.forEach(e => {
      const r = e._rel; if (!r) return;
      const on = r.type === 'fk' ? (r.child === fk || r.parent === fk) : (r.from === fk || r.to === fk);
      e.classList.toggle('hi', on);
      e.classList.toggle('dim', !on);
      if (e._lbl) e._lbl.style.opacity = on ? 1 : 0.15;
    });
  }

  function applySelStyles() {
    const sel = ERD.view.sel;
    const keys = ERD.view.selKeys || [];
    const p = ERD.store.state.p;
    p.tables.forEach(t => {
      if (!t.el) return;
      const isSel = !!(sel && sel.type === 'table' && sel.id === t.key);
      const inMulti = keys.length > 1 && keys.indexOf(t.key) >= 0;
      t.el.classList.toggle('sel', isSel);
      t.el.classList.toggle('m-sel', inMulti);
    });
    edgeEls.forEach(e => {
      const r = e._rel;
      e.classList.toggle('sel', !!(sel && sel.type === 'relation' && r && sel.id === r.id));
    });
  }

  function applyFilter() {
    const q = (ERD.view.filter || '').trim().toLowerCase();
    const p = ERD.store.state.p;
    if (!q) {
      p.tables.forEach(t => {
        t.el && t.el.querySelectorAll('.row').forEach(r => r.classList.remove('match'));
      });
      if (!ERD.view.focusKey) applyFocusStyles();
      return;
    }
    const hits = new Set();
    p.tables.forEach(t => {
      let colHit = false;
      if (t.key.toLowerCase().includes(q) || (t.cn || '').toLowerCase().includes(q)) hits.add(t.key);
      if (t.el) {
        t.el.querySelectorAll('.row').forEach(r => {
          const c = (r.dataset.col || '').toLowerCase();
          const m = c.includes(q);
          r.classList.toggle('match', m);
          if (m) colHit = true;
        });
      }
      if (colHit) hits.add(t.key);
    });
    p.tables.forEach(t => t.el && t.el.classList.toggle('dim', !hits.has(t.key)));
    edgeEls.forEach(e => { e.classList.add('dim'); if (e._lbl) e._lbl.style.opacity = 0.15; });
  }

  /* ---------- 图例 / 统计 / 空态 ---------- */
  function renderLegend() {
    const lg = document.getElementById('legend'); if (!lg) return;
    const p = ERD.store.state.p;
    const zonesHtml = p.zones.map(z => {
      const n = p.tables.filter(t => t.zone === z.key).length;
      return '<div><span class="zdot" style="background:' + ERD.esc(z.color) + '"></span>' + ERD.esc(ERD.zoneLabel(z)) + '（' + n + '）</div>';
    }).join('');
    lg.innerHTML =
      '<h3>' + _t('图例', 'Legend') + ' <span class="lg-toggle" title="' + _t('折叠/展开', 'Fold / expand') + '"><i class="ri-arrow-down-s-line"></i></span></h3>' +
      '<div class="lg-body">' +
      '<div class="lg-row"><svg width="46" height="12"><path class="lgp" d="M2 6 H30 M30 1 L44 6 M30 11 L44 6 M2 3 L2 9" stroke-width="1.4" fill="none"/></svg> 1 ∶ N' + _t('（一对多）', ' (one-to-many)') + '</div>' +
      '<div class="lg-row"><svg width="46" height="12"><path class="lgp" d="M2 6 H44 M2 3 L2 9 M44 3 L44 9" stroke-width="1.4" fill="none"/></svg> 1 ∶ 1' + _t('（一对一）', ' (one-to-one)') + '</div>' +
      '<div class="lg-row"><svg width="46" height="12"><path class="lgp-lg" d="M2 6 H44" stroke-width="1.4" stroke-dasharray="6 4" fill="none"/></svg> ' + _t('逻辑关联（无物理外键）', 'Logical (no physical FK)') + '</div>' +
      '<div style="margin-top:6px"><span class="badge b-pk">PK</span> ' + _t('主键', 'Primary key') + ' &nbsp;<span class="badge b-fk">FK</span> ' + _t('外键', 'Foreign key') + ' &nbsp;<span class="badge b-uk">UK</span> ' + _t('唯一键', 'Unique') + ' &nbsp;<span class="badge b-idx">IDX</span> ' + _t('索引', 'Index') + '</div>' +
      '<div style="margin-top:5px"><span class="lg-nn">✱</span> ' + _t('非空（NOT NULL）', 'Not null (NOT NULL)') + '</div>' +
      '<div style="margin-top:8px;border-top:1px solid var(--line);padding-top:7px" class="lg-zones">' + zonesHtml + '</div>' +
      '</div>';
    lg.querySelector('.lg-toggle').onclick = () => {
      const folded = lg.classList.toggle('folded');
      const ic = lg.querySelector('.lg-toggle i');
      if (ic) ic.className = folded ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line';
    };
  }

  function renderStats() {
    const s = ERD.store.stats();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('st-t', s.tables); set('st-c', s.cols); set('st-fk', s.fk); set('st-lg', s.lg);
  }

  function renderEmpty() {
    const p = ERD.store.state.p;
    const tip = document.getElementById('empty-tip');
    if (tip) tip.style.display = p.tables.length ? 'none' : 'flex';
  }

  return {
    init, renderAll, renderTables, renderEdges, renderZones, renderLegend, renderStats,
    updateTableCard, refreshTable, refreshRelations, scheduleMove, applyView, fit,
    applyFocusStyles, applySelStyles, applyFilter,
    byKey: () => byKey, edgeEls: () => edgeEls
  };
})();
