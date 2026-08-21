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
      mi.innerHTML = '<i class="' + (it.icon || 'ri-checkbox-blank-circle-fill') + '"></i><span>' + ERD.esc(it.label) + '</span>' + (it.right || '');
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
      if (t) {
        if (ERD.view.selKeys.length > 1 && ERD.view.selKeys.includes(t.key)) {
          selectPrimary(t.key);
          return batchMenu(ERD.view.selKeys.slice(), pt);
        }
        selectTable(t.key);
        return tableMenu(t, pt);
      }
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
    ERD.view.selKeys = [key];
    ERD.view.sel = { type: 'table', id: key };
    ERD.view.focusKey = key;
    ERD.render.applyFocusStyles();
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  /* 多选中更新主选中（保持 selKeys 不变） */
  function selectPrimary(key) {
    ERD.view.sel = { type: 'table', id: key };
    ERD.view.focusKey = key;
    ERD.render.applyFocusStyles();
    ERD.render.applySelStyles();
    ERD.bus.emit('select');
  }

  /* ---------- 批量菜单（多选表） ---------- */
  function batchMenu(keys, pt) {
    const n = keys.length;
    const p = ERD.store.state.p;
    const items = [
      { title: _t('已选 ' + n + ' 张表', n + ' table' + (n > 1 ? 's' : '') + ' selected') },
      { icon: 'ri-folder-line', label: _t('折叠字段', 'Fold Fields'), onClick: () => { ERD.store.setFoldMany(keys, true); ERD.editor.toast(_t('已折叠 ' + n + ' 张表', 'Folded ' + n + ' tables'), 'ok'); } },
      { icon: 'ri-folder-open-line', label: _t('展开字段', 'Expand Fields'), onClick: () => { ERD.store.setFoldMany(keys, false); ERD.editor.toast(_t('已展开 ' + n + ' 张表', 'Expanded ' + n + ' tables'), 'ok'); } },
      '-',
      { title: _t('对齐 / 分布', 'Align / Distribute') },
      { icon: 'ri-align-left', label: _t('左对齐', 'Align Left'), onClick: () => { ERD.store.alignTables(keys, 'left'); ERD.editor.toast(_t('已左对齐', 'Aligned left'), 'ok'); } },
      { icon: 'ri-align-center', label: _t('水平居中', 'Align Center H'), onClick: () => { ERD.store.alignTables(keys, 'hcenter'); ERD.editor.toast(_t('已水平居中', 'Aligned center H'), 'ok'); } },
      { icon: 'ri-align-right', label: _t('右对齐', 'Align Right'), onClick: () => { ERD.store.alignTables(keys, 'right'); ERD.editor.toast(_t('已右对齐', 'Aligned right'), 'ok'); } },
      { icon: 'ri-align-top', label: _t('顶端对齐', 'Align Top'), onClick: () => { ERD.store.alignTables(keys, 'top'); ERD.editor.toast(_t('已顶端对齐', 'Aligned top'), 'ok'); } },
      { icon: 'ri-align-vertically', label: _t('垂直居中', 'Align Center V'), onClick: () => { ERD.store.alignTables(keys, 'vcenter'); ERD.editor.toast(_t('已垂直居中', 'Aligned center V'), 'ok'); } },
      { icon: 'ri-align-bottom', label: _t('底端对齐', 'Align Bottom'), onClick: () => { ERD.store.alignTables(keys, 'bottom'); ERD.editor.toast(_t('已底端对齐', 'Aligned bottom'), 'ok'); } },
      { icon: 'ri-arrow-right-s-line', label: _t('水平等距分布', 'Distribute Horizontally'), disabled: n < 3, onClick: () => { ERD.store.distributeTables(keys, 'h'); ERD.editor.toast(_t('已水平等距分布', 'Distributed horizontally'), 'ok'); } },
      { icon: 'ri-arrow-down-s-line', label: _t('垂直等距分布', 'Distribute Vertically'), disabled: n < 3, onClick: () => { ERD.store.distributeTables(keys, 'v'); ERD.editor.toast(_t('已垂直等距分布', 'Distributed vertically'), 'ok'); } },
      '-'
    ];
    p.zones.forEach(z => items.push({
      icon: 'ri-stack-line',
      label: _t('移动到域 · ', 'Move to zone · ') + z.name,
      onClick: () => {
        ERD.store.moveTables(keys, z.key);
        ERD.editor.toast(_t('已移动 ' + n + ' 张表到「' + z.name + '」', 'Moved ' + n + ' tables to "' + z.name + '"'), 'ok');
      }
    }));
    items.push('-');
    items.push({ icon: 'ri-delete-bin-line', label: _t('删除所选 ' + n + ' 张表', 'Delete ' + n + ' selected tables'), danger: true, onClick: () => ERD.editor.confirmDeleteMany(keys) });
    show(pt.x, pt.y, items);
  }

  /* ---------- 字段菜单 ---------- */
  function fieldMenu(t, i, pt) {
    const c = t.cols[i];
    const isPk = c[2] === 'pk';
    const nn = !!c[4];
    const usedByFk = ERD.store.state.p.relations.some(r => r.type === 'fk' && r.child === t.key && r.col === c[0]);
    const setCols = (cols, label) => { ERD.store.setColumns(t.key, cols, label); ERD.editor.renderDock(); };
    const items = [
      { title: _t('字段 · ', 'Field · ') + c[0] + ' · ' + c[1] },
      { icon: 'ri-file-copy-line', label: _t('复制字段名', 'Copy Field Name'), onClick: () => copyText(c[0]) },
      '-',
      { icon: 'ri-key-2-line', label: isPk ? _t('取消主键', 'Remove PK') : _t('设为主键（唯一）', 'Set as PK (unique)'), onClick: () => {
          const cols = t.cols.map(x => x.slice());
          if (isPk) cols[i][2] = '';
          else { cols.forEach(x => { if (x[2] === 'pk') x[2] = ''; }); cols[i][2] = 'pk'; cols[i][4] = true; }
          setCols(cols, _t('修改主键', 'Change PK'));
        } },
      { icon: 'ri-star-line', label: nn ? _t('取消非空', 'Remove NOT NULL') : _t('设为非空 NOT NULL', 'Set NOT NULL'), disabled: isPk, onClick: () => {
          const cols = t.cols.map(x => x.slice());
          cols[i][4] = !nn;
          setCols(cols, _t('修改非空', 'Change NOT NULL'));
        } },
      '-',
      { icon: 'ri-focus-2-line', label: _t('标记为 UK 唯一', 'Mark as UK'), right: c[2] === 'uk' ? '<i class="ri-check-line" style="color:var(--green)"></i>' : '', onClick: () => toggleFlag(t, i, 'uk', setCols) },
      { icon: 'ri-list-ordered', label: _t('标记为 IDX 索引', 'Mark as IDX'), right: c[2] === 'idx' ? '<i class="ri-check-line" style="color:var(--green)"></i>' : '', onClick: () => toggleFlag(t, i, 'idx', setCols) },
      '-',
      { icon: 'ri-add-line', label: _t('在下方插入字段', 'Insert Field Below'), onClick: () => {
          const cols = t.cols.map(x => x.slice());
          cols.splice(i + 1, 0, ['', 'varchar(100)', '', '', false]);
          setCols(cols, _t('插入字段', 'Insert field'));
          ERD.editor.renderDock();
          focusColInput(t, i + 1);
        } },
      { icon: 'ri-close-line', label: _t('删除字段', 'Delete Field'), danger: true, disabled: usedByFk || isPk && t.cols.filter(x => x[2] === 'pk').length === 1, onClick: () => {
          if (usedByFk) { ERD.editor.toast(_t('字段被外键关系使用，请先删除对应关系', 'Field is used by an FK relation — delete it first'), 'err'); return; }
          const cols = t.cols.map(x => x.slice());
          cols.splice(i, 1);
          setCols(cols, _t('删除字段', 'Delete field'));
          ERD.editor.toast(_t('已删除字段 ' + c[0], 'Field deleted: ' + c[0]), 'ok');
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
      { icon: 'ri-edit-line', label: _t('编辑属性', 'Edit Properties'), onClick: () => ERD.editor.renderDock() },
      { icon: 'ri-links-line', label: _t('从该表连外键…', 'Create FK from this table…'), onClick: () => {
          ERD.interact.setConnectMode(true);
          ERD.interact.setConnectFrom(t.key);
        } },
      '-',
      { icon: 'ri-file-copy-line', label: _t('复制表', 'Copy Table'), onClick: () => {
          ERD.view.clip = { key: t.key, cn: t.cn, zone: t.zone, desc: t.desc, cols: t.cols.map(c => c.slice()) };
          ERD.editor.toast(_t('已复制表 ' + t.key + '，右键画布可粘贴', 'Table ' + t.key + ' copied — right-click canvas to paste'), 'ok');
        } },
      { icon: 'ri-scissors-line', label: _t('剪切表', 'Cut Table'), onClick: () => {
          ERD.view.clip = { key: t.key, cn: t.cn, zone: t.zone, desc: t.desc, cols: t.cols.map(c => c.slice()) };
          ERD.store.removeTable(t.key);
          ERD.editor.toast(_t('已剪切表 ' + t.key + '（Ctrl+Z 可撤销）', 'Table ' + t.key + ' cut (Ctrl+Z to undo)'), 'ok');
        } },
      { icon: 'ri-folder-line', label: t.fold ? _t('展开字段', 'Expand Fields') : _t('折叠字段', 'Fold Fields'), onClick: () => ERD.store.setFold(t.key, !t.fold) },
      { icon: 'ri-focus-3-line', label: _t('定位居中', 'Center on Canvas'), onClick: () => ERD.editor.focusTable(t.key) },
      { icon: 'ri-star-smile-line', label: t.core ? _t('取消核心表', 'Unmark as Core') : _t('设为核心表', 'Mark as Core'), onClick: () => ERD.store.updateTable(t.key, { core: !t.core }, _t('修改核心标记', 'Change core flag')) },
      '-',
      { icon: 'ri-delete-bin-line', label: _t('删除表', 'Delete Table'), danger: true, onClick: () => ERD.editor.confirmDeleteTable(t.key) }
    ];
    show(pt.x, pt.y, items);
  }

  /* ---------- 关系菜单 ---------- */
  function relationMenu(r, pt) {
    const items = [
      { title: r.type === 'fk' ? (r.child + '.' + r.col + ' → ' + r.parent) : (r.from + ' ⇢ ' + r.to) },
      { icon: 'ri-edit-line', label: _t('编辑关系', 'Edit Relation'), onClick: () => ERD.editor.renderDock() },
      '-',
      { icon: 'ri-scales-3-line', label: _t('切换基数（1:N ↔ 1:1）', 'Toggle Cardinality (1:N ↔ 1:1)'), disabled: r.type !== 'fk', onClick: () => {
          ERD.store.updateRelation(r.id, { card: r.card === '1:1' ? '1:N' : '1:1' }, _t('切换基数', 'Change cardinality'));
          ERD.editor.toast(_t('基数已切换', 'Cardinality toggled'), 'ok');
        } },
      { icon: 'ri-delete-bin-line', label: _t('删除关系', 'Delete Relation'), danger: true, onClick: () => { ERD.store.removeRelation(r.id); ERD.editor.toast(_t('已删除关系', 'Relation deleted'), 'ok'); } }
    ];
    show(pt.x, pt.y, items);
  }

  /* ---------- 空白画布菜单 ---------- */
  function canvasMenu(pt) {
    ERD.view.selKeys = [];
    const clip = ERD.view.clip;
    const p = ERD.store.state.p;
    /* 画布坐标 */
    const r = viewport.getBoundingClientRect();
    const cx = (pt.x - r.left - ERD.view.tx) / ERD.view.scale - ERD.cardW() / 2;
    const cy = (pt.y - r.top - ERD.view.ty) / ERD.view.scale - 30;
    const pos = { x: Math.round(cx), y: Math.round(cy) };
    const items = [
      { icon: 'ri-table-line', label: _t('新建表（此处）', 'New Table Here'), onClick: () => ERD.editor.dlgNewTable(pos) },
      { icon: 'ri-add-circle-line', label: _t('快速建表（默认模板）', 'Quick Table (default)'), onClick: () => {
          const t = ERD.store.addTable({ x: pos.x, y: pos.y });
          ERD.editor.renderDock();
          focusKeyInput();
        } },
      clip ? { icon: 'ri-clipboard-line', label: _t('粘贴表 ', 'Paste Table ') + clip.key, onClick: () => {
          ERD.store.addTable({ key: clip.key, cn: clip.cn, zone: clip.zone, desc: clip.desc, x: pos.x, y: pos.y, cols: clip.cols.map(c => c.slice()) });
          ERD.editor.toast(_t('已粘贴表（副本）', 'Table pasted (copy)'), 'ok');
        } } : null,
      '-',
      { icon: 'ri-links-line', label: _t('新建关系…', 'New Relation…'), onClick: () => ERD.editor.openRelationDialog({}) },
      { icon: 'ri-folder-line', label: _t('折叠全部', 'Fold All'), onClick: () => ERD.store.foldAll(true) },
      { icon: 'ri-folder-open-line', label: _t('展开全部', 'Expand All'), onClick: () => ERD.store.foldAll(false) },
      '-',
      { icon: 'ri-layout-grid-line', label: _t('自动布局', 'Auto Layout'), onClick: () => ERD.editor.autoLayout() },
      { icon: 'ri-fullscreen-line', label: _t('适配窗口', 'Fit to Window'), onClick: () => ERD.render.fit() },
      '-',
      { icon: 'ri-upload-2-line', label: _t('导入 SQL / JSON…', 'Import SQL / JSON…'), onClick: () => ERD.editor.dlgImport() }
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
