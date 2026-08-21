/* ================================================================
   Aneiang ERD Studio · interact.js — 平移/缩放/拖拽/选择/连线模式/快捷键
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.interact = (function () {
  let viewport, canvas, svg, searchEl;
  let dragging = null;   // {key, moved, ox, oy} 或 {group, keys, offsets, moved}
  let panning = null;
  let marquee = null;    // {sx, sy, ex, ey} Shift 框选

  function init() {
    viewport = document.getElementById('viewport');
    canvas = document.getElementById('canvas');
    svg = document.getElementById('edges');
    searchEl = document.getElementById('search');

    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('dblclick', onDblClick);
    svg.addEventListener('mousedown', e => { if (e.target.classList.contains('edge')) e.stopPropagation(); });
    svg.addEventListener('click', onEdgeClick);
    searchEl.addEventListener('input', onSearch);
    document.addEventListener('keydown', onKey);
  }

  /* ---------- 坐标换算 ---------- */
  function toCanvas(cx, cy) {
    const r = viewport.getBoundingClientRect();
    return {
      x: (cx - r.left - ERD.view.tx) / ERD.view.scale,
      y: (cy - r.top - ERD.view.ty) / ERD.view.scale
    };
  }

  /* ---------- 平移 / 拖拽起点 ---------- */
  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.t-fold')) return;   // 折叠按钮不触发拖拽
    if (e.target.closest('.table')) {
      const card = e.target.closest('.table');
      const key = card.dataset.key;
      const t = ERD.store.tableByKey(key);
      if (!t) return;
      /* Ctrl/Cmd 点击 = 多选切换，不进入拖拽 */
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        toggleMulti(key);
        return;
      }
      const pt = toCanvas(e.clientX, e.clientY);
      /* 点击已多选中的表 → 整组拖动 */
      if (ERD.view.selKeys.length > 1 && ERD.view.selKeys.indexOf(key) >= 0) {
        dragging = { group: true, keys: ERD.view.selKeys.slice(), offsets: {}, moved: false };
        dragging.keys.forEach(k => {
          const tt = ERD.store.tableByKey(k);
          if (tt) dragging.offsets[k] = { dx: pt.x - tt.x, dy: pt.y - tt.y };
        });
      } else {
        dragging = { group: false, key, moved: false, dx: pt.x - t.x, dy: pt.y - t.y };
      }
      e.preventDefault();
      return;
    }
    if (e.target.closest('.edge')) return;
    /* Shift + 空白拖拽 = 矩形框选 */
    if (e.shiftKey) {
      startMarquee(e.clientX, e.clientY);
      marquee.ex = e.clientX; marquee.ey = e.clientY;
      e.preventDefault();
      return;
    }
    panning = { sx: e.clientX, sy: e.clientY, ox: ERD.view.tx, oy: ERD.view.ty };
    viewport.classList.add('panning');
  }

  /* ---------- 框选（Shift 拖拽） ---------- */
  function startMarquee(cx, cy) {
    marquee = { sx: cx, sy: cy, ex: cx, ey: cy };
    let el = document.getElementById('marquee');
    if (!el) {
      el = document.createElement('div');
      el.id = 'marquee';
      viewport.appendChild(el);
    }
    el.style.display = 'block';
    updateMarquee(cx, cy);
  }
  function updateMarquee(cx, cy) {
    if (!marquee) return;
    const el = document.getElementById('marquee'); if (!el) return;
    const r = viewport.getBoundingClientRect();
    const x = Math.min(marquee.sx, cx) - r.left;
    const y = Math.min(marquee.sy, cy) - r.top;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = Math.abs(cx - marquee.sx) + 'px';
    el.style.height = Math.abs(cy - marquee.sy) + 'px';
  }
  function endMarquee() {
    const el = document.getElementById('marquee');
    if (el) el.style.display = 'none';
    marquee = null;
  }
  function finishMarquee() {
    if (!marquee) return;
    const a = toCanvas(marquee.sx, marquee.sy);
    const b = toCanvas(marquee.ex, marquee.ey);
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const hit = [];
    ERD.store.state.p.tables.forEach(t => {
      const tx = t.x, ty = t.y, tw = ERD.cardW(t), th = ERD.tableH(t);
      if (tx < x1 && tx + tw > x0 && ty < y1 && ty + th > y0) hit.push(t.key);
    });
    endMarquee();
    if (!hit.length) return;
    const merged = ERD.view.selKeys.slice();
    hit.forEach(k => { if (merged.indexOf(k) < 0) merged.push(k); });
    ERD.view.selKeys = merged;
    ERD.view.sel = { type: 'table', id: hit[0] };
    ERD.view.focusKey = hit[0];
    ERD.render.applyFocusStyles();
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  /* Ctrl/Cmd 点击：累积多选；主选中聚焦该表 */
  function toggleMulti(key) {
    const i = ERD.view.selKeys.indexOf(key);
    if (i >= 0) ERD.view.selKeys.splice(i, 1);
    else ERD.view.selKeys.push(key);
    if (!ERD.view.selKeys.length) {
      ERD.view.sel = null;
      ERD.view.focusKey = null;
      ERD.render.applyFocusStyles();
      ERD.render.applySelStyles();
      ERD.bus.emit('select');
      return;
    }
    ERD.view.sel = { type: 'table', id: key };
    ERD.view.focusKey = key;
    ERD.render.applyFocusStyles();
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  function onMouseMove(e) {
    if (marquee) {
      marquee.ex = e.clientX; marquee.ey = e.clientY;
      updateMarquee(e.clientX, e.clientY);
      return;
    }
    if (panning) {
      ERD.view.tx = panning.ox + e.clientX - panning.sx;
      ERD.view.ty = panning.oy + e.clientY - panning.sy;
      ERD.render.applyView();
      return;
    }
    if (dragging) {
      const pt = toCanvas(e.clientX, e.clientY);
      if (!dragging.moved) {
        dragging.moved = true;
        ERD.store.beginMove();
        if (dragging.group) {
          dragging.keys.forEach(k => { const tt = ERD.store.tableByKey(k); if (tt && tt.el) tt.el.classList.add('dragging'); });
        } else {
          const t = ERD.store.tableByKey(dragging.key);
          if (t && t.el) t.el.classList.add('dragging');
        }
      }
      if (dragging.group) {
        dragging.keys.forEach(k => {
          const off = dragging.offsets[k]; if (!off) return;
          const nx = Math.round((pt.x - off.dx) / 4) * 4;
          const ny = Math.round((pt.y - off.dy) / 4) * 4;
          ERD.store.moveTable(k, nx, ny);
          const tt = ERD.store.tableByKey(k);
          if (tt && tt.el) { tt.el.style.left = tt.x + 'px'; tt.el.style.top = tt.y + 'px'; }
        });
        ERD.render.scheduleMove(dragging.keys[0]);
      } else {
        const nx = Math.round((pt.x - dragging.dx) / 4) * 4;
        const ny = Math.round((pt.y - dragging.dy) / 4) * 4;
        ERD.store.moveTable(dragging.key, nx, ny);
        ERD.render.scheduleMove(dragging.key);
      }
      return;
    }
    if (ERD.view.connectMode && ERD.view.connectFrom) updateGhost(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (marquee) { finishMarquee(); }
    if (panning) { panning = null; viewport.classList.remove('panning'); }
    if (dragging) {
      const d = dragging; dragging = null;
      /* 拖拽结束统一落盘（拖拽过程中 moveTable 不写存储） */
      if (d.moved) ERD.store.persist(true);
      if (d.group) {
        d.keys.forEach(k => { const t = ERD.store.tableByKey(k); if (t && t.el) t.el.classList.remove('dragging'); });
        if (!d.moved) onTableClick(d.keys[0]);
      } else {
        const t = ERD.store.tableByKey(d.key);
        if (t && t.el) t.el.classList.remove('dragging');
        if (!d.moved) onTableClick(d.key);
      }
    }
  }

  /* ---------- 双击：表卡片=折叠；空白画布=快速建表 ---------- */
  function onDblClick(e) {
    if (e.target.closest('.t-fold')) return;
    const card = e.target.closest('.table');
    if (card) {
      const t = ERD.store.tableByKey(card.dataset.key);
      if (t) ERD.store.setFold(t.key, !t.fold);
      return;
    }
    if (e.target.closest('.edge') || e.target.closest('.zone')) return;
    /* 双击空白：在该位置快速建表 */
    const pt = toCanvas(e.clientX, e.clientY);
    const t = ERD.store.addTable({ x: Math.round(pt.x - ERD.cardW() / 2), y: Math.round(pt.y - 30) });
    ERD.editor.renderDock();
    const inp = document.getElementById('dk-key');
    if (inp) { inp.focus(); inp.select(); }
  }

  /* ---------- 点击表卡片 ---------- */
  function onTableClick(key) {
    if (ERD.view.connectMode) { onConnectClick(key); return; }
    ERD.view.selKeys = [key];
    ERD.view.sel = { type: 'table', id: key };
    ERD.view.focusKey = key;
    ERD.render.applyFocusStyles();
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  function onEdgeClick(e) {
    const path = e.target;
    if (!path.classList.contains('edge')) return;
    const rel = path._rel; if (!rel) return;
    ERD.view.sel = { type: 'relation', id: rel.id };
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  function clearSelection() {
    ERD.view.sel = null;
    ERD.view.selKeys = [];
    ERD.view.focusKey = null;
    ERD.render.applyFocusStyles();
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  /* ---------- 缩放 ---------- */
  function onWheel(e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.89);
  }
  function zoomAt(cx, cy, f) {
    const ns = Math.min(2.2, Math.max(0.15, ERD.view.scale * f));
    const r = viewport.getBoundingClientRect();
    const px = (cx - r.left - ERD.view.tx) / ERD.view.scale;
    const py = (cy - r.top - ERD.view.ty) / ERD.view.scale;
    ERD.view.tx = cx - r.left - px * ns;
    ERD.view.ty = cy - r.top - py * ns;
    ERD.view.scale = ns;
    ERD.render.applyView();
  }
  function zoomCenter(f) {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  }

  /* ---------- 连线模式 ---------- */
  function setConnectMode(on) {
    ERD.view.connectMode = !!on;
    ERD.view.connectFrom = null;
    viewport.classList.toggle('connect', !!on);
    const btn = document.getElementById('btn-connect');
    if (btn) btn.classList.toggle('active', !!on);
    const hint = document.getElementById('status-hint');
    if (hint) {
      hint.className = on ? 'connect' : '';
      hint.innerHTML = on
        ? '<i class="ri-links-line"></i>' + _t('连线模式：先点击<b style="color:var(--amber)">子表</b>，再点击<b style="color:var(--amber)">父表</b>（Esc 退出）', 'Connect mode: click <b style="color:var(--amber)">child table</b> first, then <b style="color:var(--amber)">parent table</b> (Esc to exit)')
        : _t('拖拽平移 · 滚轮缩放 · 双击空白建表 · 右键快捷菜单 · N 新建表 · 双击表折叠', 'Drag to pan · Wheel to zoom · Double-click empty canvas to add table · Right-click menu · N new table · Double-click to fold');
    }
    hideGhost();
    ERD.render.renderAll();
  }

  function onConnectClick(key) {
    if (!ERD.view.connectFrom) {
      setConnectFrom(key);
    } else if (ERD.view.connectFrom === key) {
      const t = ERD.store.tableByKey(key);
      if (t && t.el) t.el.classList.remove('connect-src');
      ERD.view.connectFrom = null;
      setConnectMode(true);
    } else {
      const child = ERD.view.connectFrom, parent = key;
      setConnectMode(false);
      ERD.editor.openRelationDialog({ child, parent });
    }
  }

  /* 外部入口：直接设定连线起点（右键菜单“从该表连外键”） */
  function setConnectFrom(key) {
    if (!ERD.view.connectMode) setConnectMode(true);
    if (ERD.view.connectFrom && ERD.view.connectFrom !== key) {
      const prev = ERD.store.tableByKey(ERD.view.connectFrom);
      if (prev && prev.el) prev.el.classList.remove('connect-src');
    }
    ERD.view.connectFrom = key;
    const t = ERD.store.tableByKey(key);
    if (t && t.el) t.el.classList.add('connect-src');
    const hint = document.getElementById('status-hint');
    if (hint) hint.innerHTML = '<i class="ri-links-line"></i>' + _t('已选子表 <b style="color:var(--amber)">' + ERD.esc(key) + '</b>，请点击父表（Esc 取消）', 'Child table <b style="color:var(--amber)">' + ERD.esc(key) + '</b> selected — click parent table (Esc to cancel)');
  }

  function updateGhost(cx, cy) {
    const g = document.getElementById('ghost'); if (!g) return;
    const t = ERD.store.tableByKey(ERD.view.connectFrom); if (!t) return;
    const pt = toCanvas(cx, cy);
    g.setAttribute('d', 'M ' + (t.x + ERD.cardW(t) / 2) + ' ' + (t.y + 20) + ' L ' + pt.x + ' ' + pt.y);
    g.style.display = '';
  }
  function hideGhost() {
    const g = document.getElementById('ghost');
    if (g) g.style.display = 'none';
  }

  /* ---------- 搜索 ---------- */
  function onSearch(e) {
    ERD.view.filter = e.target.value;
    ERD.render.applyFilter();
  }

  /* ---------- 快捷键 ---------- */
  function onKey(e) {
    const tag = (e.target.tagName || '').toUpperCase();
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); ERD.store.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !typing) { e.preventDefault(); ERD.store.redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); searchEl.focus(); searchEl.select(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      ERD.store.persist(true);
      ERD.bus.emit('status', { msg: '已保存到本地', kind: 'ok' });
      if (ERD.io.getFileHandle && ERD.io.getFileHandle()) {
        ERD.io.saveProjectFile().catch(() => {});
      }
      return;
    }
    if (e.key === 'Escape') {
      if (ERD.view.connectMode) { setConnectMode(false); return; }
      if (typing) { e.target.blur(); return; }
      clearSelection();
      return;
    }
    if (typing) return;

    /* 复制 / 粘贴 / 复制表 */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const sel = ERD.view.sel;
      if (sel && sel.type === 'table') {
        const t = ERD.store.tableByKey(sel.id);
        if (t) {
          e.preventDefault();
          ERD.view.clip = { key: t.key, cn: t.cn, zone: t.zone, desc: t.desc, cols: t.cols.map(c => c.slice()) };
          ERD.bus.emit('status', { msg: '已复制表 ' + t.key + '，Ctrl+V 或右键画布粘贴', kind: 'ok' });
        }
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (ERD.view.clip) {
        e.preventDefault();
        const r = viewport.getBoundingClientRect();
        const cx = (r.width / 2 - ERD.view.tx) / ERD.view.scale - ERD.cardW() / 2;
        const cy = (r.height / 2 - ERD.view.ty) / ERD.view.scale - 40;
        const cp = ERD.view.clip;
        ERD.store.addTable({ key: cp.key, cn: cp.cn, zone: cp.zone, desc: cp.desc, x: Math.round(cx), y: Math.round(cy), cols: cp.cols.map(c => c.slice()) });
        ERD.editor.renderDock();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      const sel = ERD.view.sel;
      if (sel && sel.type === 'table') {
        e.preventDefault();
        const t = ERD.store.tableByKey(sel.id);
        if (t) {
          ERD.store.addTable({ key: t.key, cn: (t.cn || '') + ' 副本', zone: t.zone, desc: t.desc, x: t.x + 60, y: t.y + 60, cols: t.cols.map(c => c.slice()) });
          ERD.editor.renderDock();
          ERD.bus.emit('status', { msg: '已复制表', kind: 'ok' });
        }
      }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const sel = ERD.view.sel; if (!sel) return;
      e.preventDefault();
      if (sel.type === 'relation') { ERD.store.removeRelation(sel.id); ERD.bus.emit('status', { msg: '已删除关系', kind: 'ok' }); }
      else if (ERD.view.selKeys.length > 1) ERD.editor.confirmDeleteMany(ERD.view.selKeys.slice());
      else ERD.editor.confirmDeleteTable(sel.id);
      return;
    }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); ERD.editor.dlgNewTable(); return; }
    if (e.key === 'l' || e.key === 'L') { document.getElementById('btn-logical').click(); return; }
    if (e.key === 'a' || e.key === 'A') { ERD.editor.autoLayout(); return; }
    if (e.key === 'f' || e.key === 'F') { ERD.render.fit(); return; }
    if (e.key === '+') { zoomCenter(1.25); return; }
    if (e.key === '-') { zoomCenter(0.8); return; }
  }

  return { init, zoomAt, zoomCenter, setConnectMode, setConnectFrom, clearSelection, onTableClick };
})();
