/* ================================================================
   Aneiang ERD Studio · ctxmenu.js — 右键上下文菜单（画布 / 表 / 字段行 / 连线）
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.ctx = (function () {

  let viewport;

  function init() {
    viewport = document.getElementById('viewport');
    viewport.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.menu')) close();
    });
    window.addEventListener('blur', close);
  }

  function close() { document.querySelectorAll('.menu.ctx.open').forEach(m => m.remove()); }

  /* ---------- 通用弹出 ---------- */
  function show(x, y, items) {
    close();
    const m = document.createElement('div');
    m.className = 'menu ctx open';
    items.forEach(it => {
      if (it === '-') { const s = document.createElement('div'); s.className = 'msep'; m.appendChild(s); return; }
      if (it.title) { const t = document.createElement('div'); t.className = 'mtitle'; t.textContent = it.title; m.appendChild(t); return; }
      const mi = document.createElement('div');
      mi.className = 'mi' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '');
      mi.innerHTML = '<i class="' + (it.icon || 'ri-checkbox-blank-circle-fill') + '"></i><span>' + it.label + '</span>' + (it.right || '');
      if (!it.disabled) mi.onclick = () => { close(); it.onClick(); };
      m.appendChild(mi);
    });
    document.body.appendChild(m);
    /* 视口内翻转定位 */
    const VW = window.innerWidth, VH = window.innerHeight;
    m.style.maxHeight = (VH - 16) + 'px';
    m.style.overflowY = 'auto';
    const MW = m.offsetWidth, MH = m.offsetHeight;
    m.style.left = Math.min(x, VW - MW - 8) + 'px';
    m.style.top = (y + MH > VH - 8) ? Math.max(8, y - MH - 4) + 'px' : (y + 4) + 'px';
    m.style.right = 'auto';
  }

  /* ---------- 事件入口 ---------- */
  function onContextMenu(e) {
    e.preventDefault();
    const pt = { x: e.clientX, y: e.clientY };

    /* 字段行 */
    const row = e.target.closest('.row');
    if (row) {
      const card = row.closest('.table');
      const t = ERD.store.tableByKey(card && card.dataset.key);
      const colName = row.dataset.col;
      if (t) {
        const ci = t.cols.findIndex(c => c[0] === colName && c[2] !== 'g');
        if (ci >= 0) { selectTable(t.key); return fieldMenu(t, ci, pt); }
        if (t.cols[ci = t.cols.findIndex(c => c[0] === colName)] && t.cols[ci][2] === 'g') { selectTable(t.key); return tableMenu(t, pt); }
      }
    }

    /* 表卡片 */
    const card = e.target.closest('.table');
    if (card) {
      const t = ERD.store.tableByKey(card.dataset.key);
      if (t) { selectTable(t.key); return tableMenu(t, pt); }
    }

    /* 连线 */
    if (e.target.classList && e.target.classList.contains('edge') && e.target._rel) {
      const r = e.target._rel;
      ERD.view.sel = { type: 'relation', id: r.id };
      ERD.render.applySelStyles();
      ERD.bus.emit('select');
      return relationMenu(r, pt);
    }

    /* 空白画布 */
    canvasMenu(pt);
  }

  function selectTable(key) {
    ERD.view.sel = { type: 'table', id: key };
    ERD.view.focusKey = key;
    ERD.render.applyFocusStyles();
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  /* ---------- 字段菜单 ---------- */
  function fieldMenu(t, i, pt) {
    const c = t.cols[i];
    const isPk = c[2] === 'pk';
    const nn = !!c[4];
    const usedByFk = ERD.store.state.p.relations.some(r => r.type === 'fk' && r.child === t.key && r.col === c[0]);
    const setCols = (cols, label) => { ERD.store.setColumns(t.key, cols, label); ERD.editor.renderDock(); };
    const items = [
      { title: '字段 · ' + c[0] + ' · ' + c[1] },
      { icon: 'ri-file-copy-line', label: '复制字段名', onClick: () => copyText(c[0]) },
      '-',
      { icon: 'ri-key-2-line', label: isPk ? '取消主键' : '设为主键（唯一）', onClick: () => {
          const cols = t.cols.map(x => x.slice());
          if (isPk) cols[i][2] = '';
          else { cols.forEach(x => { if (x[2] === 'pk') x[2] = ''; }); cols[i][2] = 'pk'; cols[i][4] = true; }
          setCols(cols, '修改主键');
        } },
      { icon: 'ri-star-line', label: nn ? '取消非空' : '设为非空 NOT NULL', disabled: isPk, onClick: () => {
          const cols = t.cols.map(x => x.slice());
          cols[i][4] = !nn;
          setCols(cols, '修改非空');
        } },
      '-',
      { icon: 'ri-focus-2-line', label: '标记为 UK 唯一', right: c[2] === 'uk' ? '<i class="ri-check-line" style="color:var(--green)"></i>' : '', onClick: () => toggleFlag(t, i, 'uk', setCols) },
      { icon: 'ri-list-ordered', label: '标记为 IDX 索引', right: c[2] === 'idx' ? '<i class="ri-check-line" style="color:var(--green)"></i>' : '', onClick: () => toggleFlag(t, i, 'idx', setCols) },
      '-',
      { icon: 'ri-add-line', label: '在下方插入字段', onClick: () => {
          const cols = t.cols.map(x => x.slice());
          cols.splice(i + 1, 0, ['', 'varchar(100)', '', '', false]);
          setCols(cols, '插入字段');
          ERD.editor.renderDock();
          focusColInput(t, i + 1);
        } },
      { icon: 'ri-close-line', label: '删除字段', danger: true, disabled: usedByFk || isPk && t.cols.filter(x => x[2] === 'pk').length === 1, onClick: () => {
          if (usedByFk) { ERD.editor.toast('字段被外键关系使用，请先删除对应关系', 'err'); return; }
          const cols = t.cols.map(x => x.slice());
          cols.splice(i, 1);
          setCols(cols, '删除字段');
          ERD.editor.toast('已删除字段 ' + c[0], 'ok');
        } }
    ];
    show(pt.x, pt.y, items);
  }

  function toggleFlag(t, i, flag, setCols) {
    const cols = t.cols.map(x => x.slice());
    cols[i][2] = cols[i][2] === flag ? '' : flag;
    setCols(cols, '修改字段标记');
  }

  function focusColInput(t, idx) {
    setTimeout(() => {
      const dock = document.getElementById('dock-body');
      if (!dock) return;
      const rows = dock.querySelectorAll('.col-row:not(.head):not(.g-row)');
      const row = rows[idx];
      if (row) { const inp = row.querySelector('input.cname'); if (inp) { inp.focus(); inp.select(); } }
    }, 60);
  }

  /* ---------- 表菜单 ---------- */
  function tableMenu(t, pt) {
    const clip = ERD.view.clip;
    const items = [
      { title: t.key + (t.cn ? ' · ' + t.cn : '') },
      { icon: 'ri-edit-line', label: '编辑属性', onClick: () => ERD.editor.renderDock() },
      { icon: 'ri-links-line', label: '从该表连外键…', onClick: () => {
          ERD.interact.setConnectMode(true);
          ERD.interact.setConnectFrom(t.key);
        } },
      '-',
      { icon: 'ri-file-copy-line', label: '复制表', onClick: () => {
          ERD.view.clip = { key: t.key, cn: t.cn, zone: t.zone, desc: t.desc, cols: t.cols.map(c => c.slice()) };
          ERD.editor.toast('已复制表 ' + t.key + '，右键画布可粘贴', 'ok');
        } },
      { icon: 'ri-scissors-line', label: '剪切表', onClick: () => {
          ERD.view.clip = { key: t.key, cn: t.cn, zone: t.zone, desc: t.desc, cols: t.cols.map(c => c.slice()) };
          ERD.store.removeTable(t.key);
          ERD.editor.toast('已剪切表 ' + t.key + '（Ctrl+Z 可撤销）', 'ok');
        } },
      { icon: 'ri-folder-line', label: t.fold ? '展开字段' : '折叠字段', onClick: () => ERD.store.setFold(t.key, !t.fold) },
      { icon: 'ri-focus-3-line', label: '定位居中', onClick: () => ERD.editor.focusTable(t.key) },
      { icon: 'ri-star-smile-line', label: t.core ? '取消核心表' : '设为核心表', onClick: () => ERD.store.updateTable(t.key, { core: !t.core }, '修改核心标记') },
      '-',
      { icon: 'ri-delete-bin-line', label: '删除表', danger: true, onClick: () => ERD.editor.confirmDeleteTable(t.key) }
    ];
    show(pt.x, pt.y, items);
  }

  /* ---------- 关系菜单 ---------- */
  function relationMenu(r, pt) {
    const items = [
      { title: r.type === 'fk' ? (r.child + '.' + r.col + ' → ' + r.parent) : (r.from + ' ⇢ ' + r.to) },
      { icon: 'ri-edit-line', label: '编辑关系', onClick: () => ERD.editor.renderDock() },
      '-',
      { icon: 'ri-scales-3-line', label: '切换基数（1:N ↔ 1:1）', disabled: r.type !== 'fk', onClick: () => {
          ERD.store.updateRelation(r.id, { card: r.card === '1:1' ? '1:N' : '1:1' }, '切换基数');
          ERD.editor.toast('基数已切换', 'ok');
        } },
      { icon: 'ri-delete-bin-line', label: '删除关系', danger: true, onClick: () => { ERD.store.removeRelation(r.id); ERD.editor.toast('已删除关系', 'ok'); } }
    ];
    show(pt.x, pt.y, items);
  }

  /* ---------- 空白画布菜单 ---------- */
  function canvasMenu(pt) {
    const clip = ERD.view.clip;
    const p = ERD.store.state.p;
    /* 画布坐标 */
    const r = viewport.getBoundingClientRect();
    const cx = (pt.x - r.left - ERD.view.tx) / ERD.view.scale - ERD.cardW() / 2;
    const cy = (pt.y - r.top - ERD.view.ty) / ERD.view.scale - 30;
    const pos = { x: Math.round(cx), y: Math.round(cy) };
    const items = [
      { icon: 'ri-table-line', label: '新建表（此处）', onClick: () => ERD.editor.dlgNewTable(pos) },
      { icon: 'ri-add-circle-line', label: '快速建表（默认模板）', onClick: () => {
          const t = ERD.store.addTable({ x: pos.x, y: pos.y });
          ERD.editor.renderDock();
          focusKeyInput();
        } },
      clip ? { icon: 'ri-clipboard-line', label: '粘贴表 ' + clip.key, onClick: () => {
          ERD.store.addTable({ key: clip.key, cn: clip.cn, zone: clip.zone, desc: clip.desc, x: pos.x, y: pos.y, cols: clip.cols.map(c => c.slice()) });
          ERD.editor.toast('已粘贴表（副本）', 'ok');
        } } : null,
      '-',
      { icon: 'ri-links-line', label: '新建关系…', onClick: () => ERD.editor.openRelationDialog({}) },
      { icon: 'ri-folder-line', label: '折叠全部', onClick: () => ERD.store.foldAll(true) },
      { icon: 'ri-folder-open-line', label: '展开全部', onClick: () => ERD.store.foldAll(false) },
      '-',
      { icon: 'ri-layout-grid-line', label: '自动布局', onClick: () => ERD.editor.autoLayout() },
      { icon: 'ri-fullscreen-line', label: '适配窗口', onClick: () => ERD.render.fit() },
      '-',
      { icon: 'ri-upload-2-line', label: '导入 SQL / JSON…', onClick: () => ERD.editor.dlgImport() }
    ].filter(Boolean);
    show(pt.x, pt.y, items);
  }

  function focusKeyInput() {
    setTimeout(() => {
      const inp = document.getElementById('dk-key');
      if (inp) { inp.focus(); inp.select(); }
    }, 80);
  }

  /* ---------- 剪贴板（http 环境降级） ---------- */
  function copyText(text) {
    const done = () => ERD.editor.toast('已复制：' + text, 'ok');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch (e) { ERD.editor.toast('复制失败，请手动选择', 'warn'); }
  }

  return { init, close };
})();
