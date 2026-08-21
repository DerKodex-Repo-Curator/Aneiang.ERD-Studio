/* ================================================================
   Aneiang ERD Studio · editor.js — 属性面板 / 弹窗 / 菜单 / 工具栏 / 自动布局
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.editor = (function () {
  let mask, modal, dock, dockBody;
  const AUDIT_COLS = [
    ['deleted', 'bool', '', '逻辑删除'], ['version', 'int', '', '乐观锁'],
    ['created_by', 'bigint', '', '创建人'], ['created_at', 'timestamptz', '', '创建时间'],
    ['updated_by', 'bigint', '', '更新人'], ['updated_at', 'timestamptz', '', '更新时间']
  ];
  const COMMON_TYPES = ['bigint', 'bigserial', 'int', 'smallint', 'numeric(5,2)', 'numeric(10,2)', 'varchar(20)', 'varchar(40)', 'varchar(50)', 'varchar(100)', 'varchar(200)', 'varchar(500)', 'text', 'bool', 'boolean', 'date', 'timestamptz', 'timestamp', 'jsonb', 'json', 'varchar[]', 'int[]'];

  function init() {
    mask = document.getElementById('modal-mask');
    dock = document.getElementById('dock');
    dockBody = document.getElementById('dock-body');
    wireHeader();
    wireViewbar();
    wireBus();
    mask.addEventListener('mousedown', e => { if (e.target === mask) closeModal(); });
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenus();
    });
  }

  /* ================= 通用弹窗 ================= */
  function openModal(title, icon, bodyHtml, footHtml, wide) {
    mask.innerHTML =
      '<div class="modal' + (wide ? ' wide' : '') + '">' +
      '<div class="modal-head"><i class="' + icon + '"></i><h3>' + title + '</h3><span class="close"><i class="ri-close-line"></i></span></div>' +
      '<div class="modal-body">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="modal-foot">' + footHtml + '</div>' : '') +
      '</div>';
    mask.classList.add('open');
    modal = mask.querySelector('.modal');
    modal.querySelector('.close').onclick = closeModal;
    return modal;
  }
  function closeModal() { mask.classList.remove('open'); mask.innerHTML = ''; modal = null; }
  function confirmDlg(msg, onOk, okLabel) {
    const m = openModal('操作确认', 'ri-error-warning-line',
      '<div class="confirm-msg"><i class="ri-error-warning-line"></i>' + msg + '</div>',
      '<button class="btn" data-act="cancel">取消</button><button class="btn primary" data-act="ok">' + (okLabel || '确认') + '</button>');
    m.querySelector('[data-act=cancel]').onclick = closeModal;
    m.querySelector('[data-act=ok]').onclick = () => { closeModal(); onOk(); };
  }
  function toast(msg, kind) {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    const icon = kind === 'ok' ? 'ri-checkbox-circle-line' : kind === 'err' ? 'ri-error-warning-line' : 'ri-information-line';
    el.className = 'toast ' + (kind || 'info');
    el.innerHTML = '<i class="' + icon + '"></i><span>' + ERD.esc(msg) + '</span>';
    wrap.appendChild(el);
    setTimeout(() => el.classList.add('fade'), 2400);
    setTimeout(() => el.remove(), 2900);
  }

  /* ================= 下拉菜单 ================= */
  function closeMenus() { document.querySelectorAll('.menu.open').forEach(m => m.remove()); }
  function attachMenu(btn, items) {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const exist = document.querySelector('.menu.open');
      closeMenus();
      if (exist && exist._btn === btn) return;
      const list = typeof items === 'function' ? items() : items;
      const m = document.createElement('div');
      m.className = 'menu open';
      m._btn = btn;
      list.forEach(it => {
        if (it === '-') { m.appendChild(div('msep')); return; }
        if (it.title) { const t = div('mtitle'); t.textContent = it.title; m.appendChild(t); return; }
        const mi = div('mi' + (it.danger ? ' danger' : ''));
        mi.innerHTML = '<i class="' + it.icon + '"></i><span>' + ERD.esc(it.label) + '</span>' + (it.right || '');
        mi.onclick = () => { closeMenus(); it.onClick(); };
        m.appendChild(mi);
      });
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      const GAP = 6, VH = window.innerHeight;
      /* 先限高再测量，保证菜单始终在视口内；空间不足且上方更宽裕时向上翻转 */
      m.style.maxHeight = (VH - 16) + 'px';
      m.style.overflowY = 'auto';
      const MH = m.offsetHeight;
      if (r.bottom + GAP + MH > VH - 8 && r.top - GAP > VH - r.bottom) {
        m.style.top = Math.max(8, r.top - GAP - MH) + 'px';
      } else {
        m.style.top = Math.min(r.bottom + GAP, VH - MH - 8) + 'px';
      }
      m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
      m.style.left = 'auto';
    });
  }
  function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }

  function loadSample() {
    if (!window.ERD_SAMPLE) { toast('示例数据未加载', 'err'); return; }
    const sp = JSON.parse(JSON.stringify(window.ERD_SAMPLE));
    sp.id = ERD.uid('p');
    sp.name = '演示示例 ' + new Date().toLocaleDateString('zh-CN');
    sp.description = sp.description || (sp.meta && (sp.meta.desc || sp.meta.description)) || '';
    ERD.store.create(sp.name, sp.description, sp);
    ERD.render.renderAll(); ERD.render.fit();
    toast('已载入示例工程', 'ok');
  }

  /* ================= 头部工具栏 ================= */
  function wireHeader() {
    const $ = id => document.getElementById(id);
    $('proj-select').addEventListener('change', e => {
      const v = e.target.value;
      if (v && ERD.store.state.p && v !== ERD.store.state.p.id) ERD.store.open(v);
    });

    attachMenu($('btn-proj-menu'), [
      { icon: 'ri-add-line', label: _t('新建工程…', 'New Project…'), onClick: dlgNewProject },
      { icon: 'ri-edit-line', label: _t('重命名当前工程…', 'Rename Current Project…'), onClick: dlgRenameProject },
      { icon: 'ri-file-copy-line', label: _t('复制当前工程', 'Duplicate Project'), onClick: () => {
          const id = ERD.store.duplicate(ERD.store.state.p.id);
          if (id) { ERD.store.open(id); toast(_t('已复制工程', 'Project duplicated'), 'ok'); }
        } },
      { icon: 'ri-delete-bin-line', label: _t('删除当前工程', 'Delete Project'), danger: true, onClick: () => {
          const p = ERD.store.state.p;
          confirmDlg(_t('确认删除工程「' + ERD.esc(p.name) + '」？该操作不可恢复，请先导出 JSON 备份。', 'Delete project "' + ERD.esc(p.name) + '"? This cannot be undone. Export a JSON backup first.'), () => {
            const rest = ERD.store.list().filter(x => x.id !== p.id);
            if (ERD.store.remove(p.id)) { ERD.store.open(rest[0].id); toast(_t('已删除工程', 'Project deleted'), 'ok'); }
          }, _t('删除', 'Delete'));
        } },
      '-',
      { icon: 'ri-database-2-line', label: _t('载入内置演示示例（电商订单系统）', 'Load built-in sample (e-commerce)'), onClick: loadSample }
    ]);

    $('btn-newtable').onclick = () => dlgNewTable();

    /* 文件：打开/保存本地文件、导入、分享链接、类型库 */
    attachMenu($('btn-file'), [
      { icon: 'ri-folder-open-line', label: _t('打开本地文件…（.erd / .json）', 'Open Local File… (.erd / .json)'), onClick: () => ERD.io.openLocalFile() },
      { icon: 'ri-save-line', label: _t('保存到本地文件（Ctrl+S 同步）', 'Save to File (Ctrl+S)'), onClick: () => ERD.io.saveProjectFile() },
      { icon: 'ri-save-3-line', label: _t('另存为…', 'Save As…'), onClick: () => ERD.io.saveProjectFileAs() },
      '-',
      { icon: 'ri-upload-2-line', label: _t('导入 SQL / JSON…', 'Import SQL / JSON…'), onClick: dlgImport },
      '-',
      { icon: 'ri-link', label: _t('复制分享链接（含完整表结构）', 'Copy Share Link (contains full schema)'), onClick: () => {
          confirmDlg(_t('分享链接将包含完整表结构，请勿公开分享含敏感信息的内容。确认复制？', 'The share link contains the full schema. Do NOT share sensitive content publicly. Copy now?'), () => ERD.io.copyShareLink(), _t('复制', 'Copy'));
        } },
      '-',
      { icon: 'ri-braces-line', label: _t('类型库管理…', 'Type Library…'), onClick: dlgTypes }
    ]);

    /* 工具：连线模式 / 业务域 / 折叠 / 语言 */
    attachMenu($('btn-tools'), () => {
      const items = [
        { title: _t('画布工具', 'Canvas Tools') },
        { icon: 'ri-links-line', label: _t('连线模式（创建外键）…', 'Connect Mode (create FK)…'), onClick: () => ERD.interact.setConnectMode(!ERD.view.connectMode) },
        { icon: 'ri-stack-line', label: _t('业务域管理…', 'Business Zones…'), onClick: dlgZones },
        '-',
        { icon: 'ri-eye-line', label: (ERD.view.showLogical ? _t('隐藏', 'Hide') : _t('显示', 'Show')) + _t('逻辑关联', ' Logical Relations'), onClick: () => { document.getElementById('btn-logical').click(); } },
        { icon: 'ri-layout-grid-line', label: _t('自动布局', 'Auto Layout'), onClick: autoLayout },
        '-',
        { icon: 'ri-folder-line', label: _t('折叠全部表', 'Fold All Tables'), onClick: () => ERD.store.foldAll(true) },
        { icon: 'ri-folder-open-line', label: _t('展开全部表', 'Expand All Tables'), onClick: () => ERD.store.foldAll(false) },
        '-',
        { title: _t('语言', 'Language') },
        ...ERD.i18n.LANGS.map(l => ({
          icon: 'ri-translate-2',
          label: l.label,
          right: (ERD.i18n.get() === l.key ? '<i class="ri-check-line" style="color:var(--green)"></i>' : ''),
          onClick: () => { if (ERD.i18n.get() !== l.key) ERD.i18n.set(l.key); }
        }))
      ];
      return items;
    });

    $('btn-undo').onclick = () => ERD.store.undo();
    $('btn-redo').onclick = () => ERD.store.redo();
    attachMenu($('btn-export'), [
      { icon: 'ri-database-2-line', label: _t('工程 JSON（.json）', 'Project JSON (.json)'), onClick: () => ERD.io.exportJSON() },
      '-',
      { title: _t('SQL 脚本（8 种方言）', 'SQL Script (8 dialects)') },
      ...Object.keys(ERD.sql.DIALECTS).map(k => ({
        icon: 'ri-file-code-line',
        label: ERD.sql.DIALECTS[k].label,
        onClick: () => ERD.io.exportSQL(k)
      })),
      '-',
      { icon: 'ri-image-line', label: _t('PNG 图片（.png）', 'PNG Image (.png)'), onClick: () => ERD.io.exportPNG() },
      { icon: 'ri-shape-line', label: _t('SVG 矢量图（.svg）', 'SVG Vector (.svg)'), onClick: () => ERD.io.exportSVG() },
      '-',
      { icon: 'ri-git-branch-line', label: _t('Mermaid ER（.mmd）', 'Mermaid ER (.mmd)'), onClick: () => ERD.io.exportMermaid() },
      { icon: 'ri-file-excel-2-line', label: _t('数据字典 Excel（.xlsx）', 'Data Dictionary Excel (.xlsx)'), onClick: () => ERD.io.exportXLSX() }
    ]);
    $('btn-help').onclick = dlgHelp;
  }

  /* ================= 浮动视图条 ================= */
  const THEMES = [
    { key: 'dark', name: '暗夜（默认）', bg: '#0e1116', panel: '#161a22', accent: '#7aa2f7' },
    { key: 'midnight', name: '午夜蓝', bg: '#090d18', panel: '#0f1526', accent: '#6f9bff' },
    { key: 'light', name: '极简白', bg: '#f4f6fa', panel: '#ffffff', accent: '#3b6fe0' },
    { key: 'blue', name: '商务蓝', bg: '#edf2fb', panel: '#ffffff', accent: '#2f5cc4' },
    { key: 'green', name: '护眼绿', bg: '#eef2e8', panel: '#fcfdfa', accent: '#3f7d38' },
    { key: 'paper', name: '羊皮纸', bg: '#f6f1e3', panel: '#fdfaf1', accent: '#8a6d2f' }
  ];
  const BGS = [
    { key: 'grid', name: '网格', icon: 'ri-layout-grid-line' },
    { key: 'dots', name: '点阵', icon: 'ri-focus-3-line' },
    { key: 'none', name: '纯净（无图案）', icon: 'ri-eye-off-line' }
  ];
  const EDGE_STYLES = [
    { key: 'bezier', name: '曲线（默认）', icon: 'ri-links-line' },
    { key: 'ortho', name: '直角折线', icon: 'ri-git-branch-line' },
    { key: 'straight', name: '直线', icon: 'ri-subtract-line' }
  ];

  function wireViewbar() {
    const $ = id => document.getElementById(id);
    $('btn-fit').onclick = () => ERD.render.fit();
    $('btn-zin').onclick = () => ERD.interact.zoomCenter(1.25);
    $('btn-zout').onclick = () => ERD.interact.zoomCenter(0.8);
    $('btn-logical').onclick = () => {
      ERD.view.showLogical = !ERD.view.showLogical;
      $('btn-logical').classList.toggle('active', ERD.view.showLogical);
      $('btn-logical').querySelector('i').className = ERD.view.showLogical ? 'ri-eye-line' : 'ri-eye-off-line';
      ERD.render.renderEdges();
      ERD.render.applyFocusStyles();
      ERD.render.applyFilter();
    };
    $('btn-layout').onclick = autoLayout;

    /* 外观：主题 / 背景 / 连线样式 */
    attachMenu($('btn-theme'), () => {
      const curTheme = ERD.ui.get('theme'), curBg = ERD.ui.get('bgPattern'), curEdge = ERD.ui.get('edgeStyle');
      const chk = '<i class="ri-check-line mi-check"></i>';
      const items = [{ title: '界面主题' }];
      THEMES.forEach(t => items.push({
        icon: 'ri-palette-line',
        label: t.name,
        right: '<span class="mi-sw" title="背景 / 面板 / 强调色">' +
          '<i style="background:' + t.bg + '"></i><i style="background:' + t.panel + '"></i><i style="background:' + t.accent + '"></i></span>' +
          (curTheme === t.key ? chk : ''),
        onClick: () => { ERD.ui.set('theme', t.key); ERD.render.renderEdges(); ERD.render.renderLegend(); }
      }));
      items.push('-');
      items.push({ title: '画布背景' });
      BGS.forEach(b => items.push({
        icon: b.icon, label: b.name, right: curBg === b.key ? chk : '',
        onClick: () => ERD.ui.set('bgPattern', b.key)
      }));
      items.push('-');
      items.push({ title: '连线样式' });
      EDGE_STYLES.forEach(s => items.push({
        icon: s.icon, label: s.name, right: curEdge === s.key ? chk : '',
        onClick: () => { ERD.ui.set('edgeStyle', s.key); ERD.render.renderEdges(); }
      }));
      items.push('-');
      items.push({ title: '表卡片折叠' });
      items.push({ icon: 'ri-folder-line', label: '折叠全部表（仅显示表名）', onClick: () => ERD.store.foldAll(true) });
      items.push({ icon: 'ri-folder-open-line', label: '展开全部表', onClick: () => ERD.store.foldAll(false) });
      return items;
    });
  }

  /* ================= 总线订阅 ================= */
  function wireBus() {
    ERD.bus.on('status', s => toast(s.msg, s.kind));
    ERD.bus.on('history', updateHistoryBtns);
    ERD.bus.on('meta', refreshProjects);
    ERD.bus.on('saved', () => {
      const el = document.getElementById('save-state');
      el.className = 'saved';
      el.innerHTML = '<i class="ri-checkbox-circle-line"></i>' + _t('已自动保存 ', 'Saved at ') + new Date().toLocaleTimeString('zh-CN', { hour12: false });
    });
    ERD.bus.on('select', renderDock);
  }
  function updateHistoryBtns() {
    document.getElementById('btn-undo').disabled = !ERD.store.canUndo();
    document.getElementById('btn-redo').disabled = !ERD.store.canRedo();
  }
  function refreshProjects() {
    const sel = document.getElementById('proj-select');
    const list = ERD.store.list();
    const cur = ERD.store.state.p;
    sel.innerHTML = list.map(p =>
      '<option value="' + p.id + '"' + (cur && p.id === cur.id ? ' selected' : '') + '>' +
      ERD.esc(p.name) + '（' + (p.tableCount || 0) + ' 表）</option>').join('');
    const st = document.getElementById('st-proj');
    if (st) st.textContent = list.length;
  }

  /* ================= 右侧属性面板 ================= */
  function openDock() { dock.classList.add('open'); }
  function closeDock() { dock.classList.remove('open'); }

  function renderDock() {
    const sel = ERD.view.sel;
    if (!sel) { closeDock(); return; }
    openDock();
    if (sel.type === 'table') renderTableDock(sel.id);
    else renderRelationDock(sel.id);
  }

  /* ---------- 表属性面板 ---------- */
  function renderTableDock(key) {
    const t = ERD.store.tableByKey(key);
    if (!t) { closeDock(); return; }
    const p = ERD.store.state.p;
    const zc = ERD.safeColor((p.zones.find(z => z.key === t.zone) || {}).color || '#8b93a3');
    const zoneOpts = '<option value="">未分组</option>' + p.zones.map(z =>
      '<option value="' + z.key + '"' + (z.key === t.zone ? ' selected' : '') + '>' + ERD.esc(z.name) + '</option>').join('');

    let relHtml = '';
    const rels = p.relations.filter(r => r.type === 'fk' ? (r.child === key || r.parent === key) : (r.from === key || r.to === key));
    rels.forEach(r => {
      let main, sub;
      if (r.type === 'fk') {
        main = r.child === key ? (ERD.esc(r.col) + ' → ' + ERD.esc(r.parent)) : (ERD.esc(r.child) + '.' + ERD.esc(r.col));
        sub = r.child === key ? '外键 · 指向父表' : '被引用';
      } else {
        main = ERD.esc(r.from) + ' ⇢ ' + ERD.esc(r.to);
        sub = '逻辑关联' + (r.label ? ' · ' + ERD.esc(r.label) : '');
      }
      relHtml += '<div class="rel-item" data-rel="' + r.id + '"><i class="' + (r.type === 'fk' ? 'ri-link' : 'ri-link-unlink') + '" style="color:' + (r.type === 'fk' ? 'var(--fk)' : 'var(--dim)') + '"></i>' +
        '<div class="rt"><b>' + main + '</b><small>' + sub + '</small></div>' +
        '<span class="card-tag">' + (r.card || (r.type === 'logical' ? '逻辑' : '')) + '</span></div>';
    });

    let colRows = '';
    t.cols.forEach((c, i) => {
      if (c[2] === 'g') {
        colRows += '<div class="col-row g-row" data-i="' + i + '" draggable="true">' +
          '<div class="col-cell drag-grip" title="拖拽排序"><i class="ri-drag-move-2-line"></i></div>' +
          '<div class="col-cell"><input class="g-in" data-f="1" value="' + ERD.esc(c[1]) + '" placeholder="分组标题"></div>' +
          '<div class="col-cell"><span class="g-badge">分组分隔行</span>' +
          '<button class="mini" data-act="up" title="上移"><i class="ri-arrow-up-line"></i></button>' +
          '<button class="mini" data-act="down" title="下移"><i class="ri-arrow-down-line"></i></button>' +
          '<button class="mini del" data-act="del" title="删除"><i class="ri-close-line"></i></button></div></div>';
      } else {
        const flagSel = ERD.FLAGS.map(f =>
          '<option value="' + f + '"' + (c[2] === f ? ' selected' : '') + '>' + (f ? f.toUpperCase() : '—') + '</option>').join('');
        const nnChk = c[2] === 'pk'
          ? '<input type="checkbox" class="nn" checked disabled title="主键隐含非空">'
          : '<input type="checkbox" class="nn" data-f="4" title="非空 NOT NULL"' + (c[4] ? ' checked' : '') + '>';
        colRows += '<div class="col-row" data-i="' + i + '" draggable="true">' +
          '<div class="col-cell drag-grip" title="拖拽排序"><i class="ri-drag-move-2-line"></i></div>' +
          '<div class="col-cell"><input class="cname" data-f="0" value="' + ERD.esc(c[0]) + '"></div>' +
          '<div class="col-cell"><input class="ctype" data-f="1" list="dl-types" value="' + ERD.esc(c[1]) + '"></div>' +
          '<div class="col-cell"><select class="flag" data-f="2">' + flagSel + '</select></div>' +
          '<div class="col-cell" style="justify-content:center">' + nnChk + '</div>' +
          '<div class="col-cell"><input class="ccmt" data-f="3" value="' + ERD.esc(c[3] || '') + '" title="' + ERD.esc(c[3] || '') + '"></div>' +
          '<div class="col-cell" style="justify-content:flex-end">' +
          '<button class="mini" data-act="up" title="上移"><i class="ri-arrow-up-line"></i></button>' +
          '<button class="mini" data-act="down" title="下移"><i class="ri-arrow-down-line"></i></button>' +
          '<button class="mini del" data-act="del" title="删除"><i class="ri-close-line"></i></button></div></div>';
      }
    });

    dockBody.innerHTML =
      '<div class="dock-sec"><h4>基本属性</h4>' +
      '<div class="form-row"><div class="fw"><label>表名（英文）</label><input class="itxt mono" id="dk-key" value="' + ERD.esc(t.key) + '"></div>' +
      '<div style="width:130px"><label>中文名</label><input class="itxt" id="dk-cn" value="' + ERD.esc(t.cn || '') + '"></div></div>' +
      '<div class="form-row"><div class="fw"><label>所属域</label><select class="isel" id="dk-zone">' + zoneOpts + '</select></div>' +
      '<div style="width:110px"><label>标记</label><select class="isel" id="dk-core"><option value="0"' + (!t.core ? ' selected' : '') + '>普通表</option><option value="1"' + (t.core ? ' selected' : '') + '>核心表</option></select></div></div>' +
      '<div class="form-row"><div class="fw"><label>表说明</label><textarea class="itxtarea" id="dk-desc" rows="3">' + ERD.esc(t.desc || '') + '</textarea></div></div></div>' +

      '<div class="dock-sec"><h4>字段（' + t.cols.filter(c => c[2] !== 'g').length + '）' +
      '<span class="acts"><button class="btn sm" id="dk-addcol"><i class="ri-add-line"></i>字段</button>' +
      '<button class="btn sm" id="dk-addgroup"><i class="ri-group-line"></i>分组</button>' +
      '<button class="btn sm" id="dk-addaudit" title="补充 deleted/version/created_by/created_at/updated_by/updated_at">审计六件套</button></span></h4>' +
      '<div class="quick-fields" id="dk-quick"><span class="qf-title">常用</span>' +
      ERD.presets.QUICK_FIELDS.map((f, i) => '<button class="qf" data-q="' + i + '" title="' + ERD.esc(f.name) + ' ' + ERD.esc(f.type) + (f.cmt ? ' · ' + ERD.esc(f.cmt) : '') + '">' + ERD.esc(f.cmt || f.name) + '</button>').join('') +
      '</div>' +
      '<div class="col-tbl"><div class="col-row head"><div class="drag-grip"></div><div>字段名</div><div>类型</div><div>标记</div><div style="text-align:center" title="非空 NOT NULL">非空</div><div>说明</div><div style="text-align:right">操作</div></div>' + colRows + '</div>' +
      '<div class="g-tip">标记可选 PK 主键 / FK 外键 / UK 唯一 / IDX 索引；✱ 非空 = NOT NULL（主键隐含）；FK 标记由「关系」自动维护<br>回车 = 下方插入新行 · 粘贴多行文本可批量建字段（如 name varchar(50) 名称）</div></div>' +

      '<div class="dock-sec"><h4>关系（' + rels.length + '）</h4>' + (relHtml || '<div class="g-tip">暂无关系，可用顶部「连线」按钮创建</div>') + '</div>' +

      '<div class="dock-sec"><h4>操作</h4><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn" id="dk-dup"><i class="ri-file-copy-line"></i>复制表</button>' +
      '<button class="btn" id="dk-center"><i class="ri-focus-3-line"></i>定位</button>' +
      '<button class="btn" id="dk-fold"><i class="' + (t.fold ? 'ri-folder-open-line' : 'ri-folder-line') + '"></i>' + (t.fold ? '展开字段' : '折叠字段') + '</button>' +
      '<button class="btn danger" id="dk-del"><i class="ri-delete-bin-line"></i>删除表</button></div></div>';

    /* 基本属性事件 */
    const commitBase = () => {
      const key2 = dockBody.querySelector('#dk-key').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const patch = {
        cn: dockBody.querySelector('#dk-cn').value.trim(),
        zone: dockBody.querySelector('#dk-zone').value,
        core: dockBody.querySelector('#dk-core').value === '1',
        desc: dockBody.querySelector('#dk-desc').value
      };
      if (key2 && key2 !== t.key) {
        if (ERD.store.state.p.tables.some(x => x.key === key2)) { toast('表名已存在：' + key2, 'err'); }
        else {
          patch.key = key2;
          p.relations.forEach(r => {
            if (r.type === 'fk') { if (r.child === t.key) r.child = key2; if (r.parent === t.key) r.parent = key2; }
            else { if (r.from === t.key) r.from = key2; if (r.to === t.key) r.to = key2; }
          });
          if (ERD.view.sel && ERD.view.sel.id === t.key) ERD.view.sel.id = key2;
          if (ERD.view.focusKey === t.key) ERD.view.focusKey = key2;
        }
      }
      ERD.store.updateTable(t.key, patch, '修改表属性');
    };
    dockBody.querySelector('#dk-key').addEventListener('change', commitBase);
    dockBody.querySelector('#dk-cn').addEventListener('change', commitBase);
    dockBody.querySelector('#dk-zone').addEventListener('change', commitBase);
    dockBody.querySelector('#dk-core').addEventListener('change', commitBase);
    dockBody.querySelector('#dk-desc').addEventListener('change', commitBase);

    /* 字段表格事件（委托） */
    const tblEl = dockBody.querySelector('.col-tbl');
    tblEl.addEventListener('change', e => {
      const row = e.target.closest('.col-row'); if (!row) return;
      const i = +row.dataset.i;
      const isChk = e.target.type === 'checkbox';
      const f = isChk ? 4 : +e.target.dataset.f;
      const cols = t.cols.map(c => c.slice());
      if (e.target.classList.contains('flag') && e.target.value === 'fk') {
        toast('FK 标记请通过「连线」或关系编辑创建，保持数据一致', 'warn');
        renderDock(); return;
      }
      if (isChk) cols[i][4] = e.target.checked;
      else {
        cols[i][f] = e.target.value;
        if (f === 2 && cols[i][2] === 'pk') cols[i][4] = true;   // 主键隐含非空
      }
      if (!isChk && f === 0 && !cols[i][0].trim()) { toast('字段名不能为空', 'warn'); renderDock(); return; }
      ERD.store.setColumns(t.key, cols, '编辑字段');
    });

    tblEl.addEventListener('click', e => {
      const btn = e.target.closest('.mini'); if (!btn) return;
      const row = e.target.closest('.col-row'); if (!row) return;
      const i = +row.dataset.i;
      const cols = t.cols.map(c => c.slice());
      if (btn.dataset.act === 'up' && i > 0) { const tmp = cols[i - 1]; cols[i - 1] = cols[i]; cols[i] = tmp; }
      else if (btn.dataset.act === 'down' && i < cols.length - 1) { const tmp = cols[i + 1]; cols[i + 1] = cols[i]; cols[i] = tmp; }
      else if (btn.dataset.act === 'del') {
        const colName = cols[i][0];
        const used = ERD.store.state.p.relations.some(r => r.type === 'fk' && r.child === t.key && r.col === colName);
        if (used) { toast('字段 ' + colName + ' 被外键关系使用，请先删除对应关系', 'err'); return; }
        cols.splice(i, 1);
      } else return;
      ERD.store.setColumns(t.key, cols, '调整字段');
      renderDock();
    });

    /* 字段拖拽排序（仅抓手触发，避免与输入交互冲突） */
    let dragFrom = -1;
    const clearDragState = () => {
      dragFrom = -1;
      dockBody.querySelectorAll('.col-row').forEach(r => r.classList.remove('dragging', 'drop-target'));
    };
    tblEl.addEventListener('dragstart', e => {
      const row = e.target.closest('.col-row');
      if (!row || row.classList.contains('head') || !e.target.closest('.drag-grip')) { e.preventDefault(); return; }
      dragFrom = +row.dataset.i;
      row.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (err) { /* ignore */ }
    });
    tblEl.addEventListener('dragover', e => {
      const row = e.target.closest('.col-row');
      if (!row || row.classList.contains('head') || dragFrom < 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drop-target');
    });
    tblEl.addEventListener('dragleave', e => {
      const row = e.target.closest('.col-row');
      if (row) row.classList.remove('drop-target');
    });
    tblEl.addEventListener('drop', e => {
      const row = e.target.closest('.col-row');
      if (!row || row.classList.contains('head')) return;
      e.preventDefault();
      const to = +row.dataset.i;
      if (dragFrom >= 0 && to !== dragFrom) {
        const cols = t.cols.map(c => c.slice());
        const moved = cols.splice(dragFrom, 1)[0];
        cols.splice(to, 0, moved);
        ERD.store.setColumns(t.key, cols, '拖拽调整字段');
        renderDock();
      }
      clearDragState();
    });
    tblEl.addEventListener('dragend', clearDragState);

    dockBody.querySelector('#dk-addcol').onclick = () => {
      const cols = t.cols.map(c => c.slice());
      cols.push(['col_' + (cols.length + 1), 'varchar(100)', '', '']);
      ERD.store.setColumns(t.key, cols, '新增字段');
      renderDock();
      const rows = dockBody.querySelectorAll('.col-row:not(.head):not(.g-row) input.cname');
      if (rows.length) { rows[rows.length - 1].focus(); }
    };

    /* 常用字段一键追加（已存在则跳过） */
    dockBody.querySelector('#dk-quick').addEventListener('click', e => {
      const btn = e.target.closest('.qf'); if (!btn) return;
      const f = ERD.presets.QUICK_FIELDS[+btn.dataset.q];
      const cols = t.cols.map(c => c.slice());
      if (cols.some(c => c[0] === f.name)) { toast('字段 ' + f.name + ' 已存在', 'warn'); return; }
      cols.push([f.name, f.type, f.flag || '', f.cmt || '', !!f.nn]);
      ERD.store.setColumns(t.key, cols, '追加常用字段');
      renderDock();
      toast('已添加 ' + f.name, 'ok');
    });

    /* 回车 = 在当前行下方插入新行并聚焦（连续快速建字段） */
    tblEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const row = e.target.closest('.col-row');
      if (!row || row.classList.contains('head') || row.classList.contains('g-row')) return;
      e.preventDefault();
      const i = +row.dataset.i;
      const cols = t.cols.map(c => c.slice());
      cols.splice(i + 1, 0, ['', 'varchar(100)', '', '', false]);
      ERD.store.setColumns(t.key, cols, '插入字段');
      renderDock();
      focusColInputAt(i + 1);
    });

    /* 多行粘贴 = 批量建字段（支持 "name" / "name type" / "name type comment"） */
    tblEl.addEventListener('paste', e => {
      const row = e.target.closest('.col-row');
      if (!row || row.classList.contains('head')) return;
      if (!e.target.classList.contains('cname')) return;
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text || !/\n/.test(text.trim())) return;   // 单行交给默认行为
      e.preventDefault();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsed = [];
      lines.forEach(line => {
        const cleaned = line.replace(/\t/g, ' ').replace(/\s+--\s+/g, ' ');
        const parts = cleaned.split(/\s+/).filter(Boolean);
        let name = '', type = '', cmt = '';
        if (parts.length >= 3) { name = parts[0]; type = parts[1]; cmt = parts.slice(2).join(' '); }
        else if (parts.length === 2) { name = parts[0]; type = parts[1]; }
        else if (parts.length === 1) { name = parts[0]; }
        name = name.replace(/[`,;]/g, '');
        if (!name || !/^[A-Za-z_][\w]*$/.test(name)) return;
        parsed.push([name, type || 'varchar(100)', '', cmt, false]);
      });
      if (!parsed.length) { toast('未识别到有效字段行', 'warn'); return; }
      const i = +row.dataset.i;
      const cols = t.cols.map(c => c.slice());
      cols.splice.apply(cols, [i + 1, 0].concat(parsed));
      ERD.store.setColumns(t.key, cols, '批量粘贴字段');
      renderDock();
      focusColInputAt(i + parsed.length);
      toast('已批量添加 ' + parsed.length + ' 个字段', 'ok');
    });
    dockBody.querySelector('#dk-addgroup').onclick = () => {
      const cols = t.cols.map(c => c.slice());
      cols.push(['—', '新分组', 'g', '———']);
      ERD.store.setColumns(t.key, cols, '新增分组');
      renderDock();
    };
    dockBody.querySelector('#dk-addaudit').onclick = () => {
      const cols = t.cols.map(c => c.slice());
      let added = 0;
      AUDIT_COLS.forEach(a => { if (!cols.some(c => c[0] === a[0])) { cols.push(a.slice()); added++; } });
      if (!added) { toast('审计六件套已存在', 'warn'); return; }
      ERD.store.setColumns(t.key, cols, '补充审计字段');
      renderDock();
    };

    /* 关系列表点击 → 选中该关系 */
    dockBody.querySelectorAll('.rel-item').forEach(el => {
      el.onclick = () => { ERD.view.sel = { type: 'relation', id: el.dataset.rel }; ERD.render.applySelStyles(); renderDock(); };
    });

    dockBody.querySelector('#dk-dup').onclick = () => {
      const src = ERD.store.tableByKey(t.key);
      ERD.store.addTable({
        key: src.key + '_copy', cn: (src.cn || '') + ' 副本', zone: src.zone, desc: src.desc,
        x: src.x + 60, y: src.y + 60, cols: src.cols.map(c => c.slice())
      });
      toast('已复制表', 'ok');
      renderDock();
    };
    dockBody.querySelector('#dk-center').onclick = () => focusTable(t.key);
    dockBody.querySelector('#dk-fold').onclick = () => ERD.store.setFold(t.key, !t.fold);
    dockBody.querySelector('#dk-del').onclick = () => confirmDeleteTable(t.key);

    /* 头部信息 */
    const head = document.getElementById('dock-head-info');
    head.innerHTML = '<b>' + ERD.esc(t.key) + '</b><small><span class="zdot" style="background:' + zc + ';display:inline-block;width:8px;height:8px;border-radius:3px;margin-right:5px"></span>' + ERD.esc(t.cn || zoneName(t.zone)) + ' · ' + t.cols.filter(c => c[2] !== 'g').length + ' 字段</small>';
    const hi = document.getElementById('dock-head-icon');
    hi.className = 'ri-table-line';
    hi.style.color = zc;
  }

  function zoneName(zk) { const z = ERD.store.state.p.zones.find(x => x.key === zk); return z ? z.name : '未分组'; }

  function focusColInputAt(idx) {
    setTimeout(() => {
      const rows = dockBody.querySelectorAll('.col-row:not(.head):not(.g-row)');
      const row = rows[idx];
      if (row) { const inp = row.querySelector('input.cname'); if (inp) { inp.focus(); inp.select(); } }
    }, 60);
  }

  function focusTable(key) {
    const t = ERD.store.tableByKey(key); if (!t) return;
    const r = document.getElementById('viewport').getBoundingClientRect();
    ERD.view.scale = Math.max(ERD.view.scale, 0.9);
    ERD.view.tx = r.width / 2 - (t.x + ERD.cardW(t) / 2) * ERD.view.scale;
    ERD.view.ty = r.height / 2 - (t.y + (t.h || 200) / 2) * ERD.view.scale;
    ERD.render.applyView();
  }

  /* ---------- 关系属性面板 ---------- */
  function renderRelationDock(id) {
    const r = ERD.store.relById(id);
    if (!r) { closeDock(); return; }
    const p = ERD.store.state.p;
    const tOpts = sel => p.tables.map(t => '<option value="' + ERD.esc(t.key) + '"' + (t.key === sel ? ' selected' : '') + '>' + ERD.esc(t.key) + '</option>').join('');
    let body = '';
    if (r.type === 'fk') {
      const ct = ERD.store.tableByKey(r.child);
      const pt = ERD.store.tableByKey(r.parent);
      const cOpts = ct ? ct.cols.filter(c => c[2] !== 'g').map(c => '<option value="' + ERD.esc(c[0]) + '"' + (c[0] === r.col ? ' selected' : '') + '>' + ERD.esc(c[0]) + '</option>').join('') : '';
      const pOpts = pt ? pt.cols.filter(c => c[2] !== 'g').map(c => '<option value="' + ERD.esc(c[0]) + '"' + (c[0] === r.parentCol ? ' selected' : '') + '>' + ERD.esc(c[0]) + '</option>').join('') : '';
      body =
        '<div class="form-row"><div class="fw"><label>子表（含外键）</label><select class="isel" id="rl-child">' + tOpts(r.child) + '</select></div>' +
        '<div class="fw"><label>外键字段</label><select class="isel" id="rl-col">' + cOpts + '</select></div></div>' +
        '<div class="form-row"><div class="fw"><label>父表（被引用）</label><select class="isel" id="rl-parent">' + tOpts(r.parent) + '</select></div>' +
        '<div class="fw"><label>父表字段</label><select class="isel" id="rl-pcol">' + pOpts + '</select></div></div>' +
        '<div class="form-row"><div class="fw"><label>基数</label><select class="isel" id="rl-card">' +
        '<option value="1:N"' + (r.card === '1:N' ? ' selected' : '') + '>1 ∶ N（一对多）</option>' +
        '<option value="1:1"' + (r.card === '1:1' ? ' selected' : '') + '>1 ∶ 1（一对一）</option></select></div></div>';
    } else {
      body =
        '<div class="form-row"><div class="fw"><label>起点表</label><select class="isel" id="rl-from">' + tOpts(r.from) + '</select></div>' +
        '<div class="fw"><label>终点表</label><select class="isel" id="rl-to">' + tOpts(r.to) + '</select></div></div>' +
        '<div class="form-row"><div class="fw"><label>关联说明（显示在连线上）</label><input class="itxt" id="rl-label" value="' + ERD.esc(r.label || '') + '"></div></div>';
    }
    body += '<div class="dock-sec" style="margin-top:18px"><h4>操作</h4><div style="display:flex;gap:8px">' +
      '<button class="btn danger" id="rl-del"><i class="ri-delete-bin-line"></i>删除关系</button></div></div>';

    dockBody.innerHTML = '<div class="g-tip" style="margin-bottom:12px">' +
      (r.type === 'fk' ? '<i class="ri-link" style="color:var(--fk)"></i> 物理外键关系' : '<i class="ri-link-unlink"></i> 逻辑关联（无物理外键）') + '</div>' + body;

    const g = id2 => dockBody.querySelector('#' + id2);
    if (r.type === 'fk') {
      g('rl-child').onchange = e => { ERD.store.updateRelation(r.id, { child: e.target.value, col: '' }); renderDock(); };
      g('rl-col').onchange = e => ERD.store.updateRelation(r.id, { col: e.target.value });
      g('rl-parent').onchange = e => { ERD.store.updateRelation(r.id, { parent: e.target.value, parentCol: 'id' }); renderDock(); };
      g('rl-pcol').onchange = e => ERD.store.updateRelation(r.id, { parentCol: e.target.value });
      g('rl-card').onchange = e => ERD.store.updateRelation(r.id, { card: e.target.value });
    } else {
      g('rl-from').onchange = e => ERD.store.updateRelation(r.id, { from: e.target.value });
      g('rl-to').onchange = e => ERD.store.updateRelation(r.id, { to: e.target.value });
      g('rl-label').onchange = e => ERD.store.updateRelation(r.id, { label: e.target.value });
    }
    g('rl-del').onclick = () => { ERD.store.removeRelation(r.id); toast('已删除关系', 'ok'); };

    const head = document.getElementById('dock-head-info');
    const title = r.type === 'fk' ? (r.child + '.' + r.col + ' → ' + r.parent) : (r.from + ' ⇢ ' + r.to);
    head.innerHTML = '<b style="font-size:12.5px">' + ERD.esc(title) + '</b><small>' + (r.type === 'fk' ? '物理外键 · ' + (r.card || '1:N') : '逻辑关联') + '</small>';
    const hi = document.getElementById('dock-head-icon');
    hi.className = r.type === 'fk' ? 'ri-link' : 'ri-link-unlink';
    hi.style.color = r.type === 'fk' ? 'var(--fk)' : 'var(--dim)';
  }

  /* ---------- 新建关系弹窗 ---------- */
  function openRelationDialog(preset) {
    const p = ERD.store.state.p;
    const tOpts = sel => p.tables.map(t => '<option value="' + ERD.esc(t.key) + '"' + (t.key === sel ? ' selected' : '') + '>' + ERD.esc(t.key) + (t.cn ? ' · ' + ERD.esc(t.cn) : '') + '</option>').join('');
    const m = openModal('新建关系', 'ri-links-line',
      '<div class="form-row"><div class="fw"><label>关系类型</label><select class="isel" id="nr-type">' +
      '<option value="fk">物理外键（FK）</option><option value="logical">逻辑关联（虚线）</option></select>' +
      '<div class="fhint">物理外键 = 子表字段引用父表；逻辑关联 = 无物理外键的业务关联</div></div></div>' +
      '<div class="form-row" id="nr-fk-rows">' +
      '<div class="fw"><label>子表（含外键的一侧）</label><select class="isel" id="nr-child">' + tOpts(preset && preset.child) + '</select></div>' +
      '<div class="fw"><label>外键字段</label><select class="isel" id="nr-col"></select></div></div>' +
      '<div class="form-row" id="nr-fk-rows2">' +
      '<div class="fw"><label>父表（被引用）</label><select class="isel" id="nr-parent">' + tOpts(preset && preset.parent) + '</select></div>' +
      '<div class="fw"><label>父表字段</label><select class="isel" id="nr-pcol"></select></div></div>' +
      '<div class="form-row" id="nr-lg-row" style="display:none">' +
      '<div class="fw"><label>起点表</label><select class="isel" id="nr-from">' + tOpts(preset && preset.child) + '</select></div>' +
      '<div class="fw"><label>终点表</label><select class="isel" id="nr-to">' + tOpts(preset && preset.parent) + '</select></div></div>' +
      '<div class="form-row" id="nr-lg-label" style="display:none"><div class="fw"><label>关联说明</label><input class="itxt" id="nr-label" placeholder="如：多态关联 biz_type + biz_id"></div></div>',
      '<button class="btn" data-act="cancel">取消</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>创建</button>');

    const q = s => m.querySelector(s);
    function fillCols() {
      const ct = ERD.store.tableByKey(q('#nr-child').value);
      const pt = ERD.store.tableByKey(q('#nr-parent').value);
      const guess = pt ? (pt.key.replace(/^sys_/, '') + '_id').replace(/s$/, '') : '';
      q('#nr-col').innerHTML = ct ? ct.cols.filter(c => c[2] !== 'g').map(c =>
        '<option value="' + ERD.esc(c[0]) + '"' + (c[0] === guess ? ' selected' : '') + '>' + ERD.esc(c[0]) + '</option>').join('') : '';
      q('#nr-pcol').innerHTML = pt ? pt.cols.filter(c => c[2] !== 'g').map(c =>
        '<option value="' + ERD.esc(c[0]) + '"' + (c[0] === 'id' || (pt.cols[0] && c[0] === pt.cols[0][0]) ? ' selected' : '') + '>' + ERD.esc(c[0]) + '</option>').join('') : '';
    }
    fillCols();
    q('#nr-child').onchange = fillCols;
    q('#nr-parent').onchange = fillCols;
    q('#nr-type').onchange = e => {
      const isFk = e.target.value === 'fk';
      q('#nr-fk-rows').style.display = isFk ? '' : 'none';
      q('#nr-fk-rows2').style.display = isFk ? '' : 'none';
      q('#nr-lg-row').style.display = isFk ? 'none' : '';
      q('#nr-lg-label').style.display = isFk ? 'none' : '';
    };
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => {
      const type = q('#nr-type').value;
      if (type === 'fk') {
        const child = q('#nr-child').value, parent = q('#nr-parent').value, col = q('#nr-col').value;
        if (!child || !parent || !col) { toast('请选择完整的表与字段', 'err'); return; }
        if (child === parent && q('#nr-pcol').value === col) { toast('自关联的外键字段与父字段不能相同', 'err'); return; }
        const r = ERD.store.addRelation({ type: 'fk', child, col, parent, parentCol: q('#nr-pcol').value, card: '1:N' });
        ERD.view.sel = { type: 'relation', id: r.id };
      } else {
        const from = q('#nr-from').value, to = q('#nr-to').value;
        if (!from || !to || from === to) { toast('请选择两个不同的表', 'err'); return; }
        const r = ERD.store.addRelation({ type: 'logical', from, to, label: q('#nr-label').value.trim() });
        ERD.view.sel = { type: 'relation', id: r.id };
      }
      closeModal();
      ERD.render.renderAll();
      toast('关系已创建', 'ok');
    };
  }

  /* ---------- 删除表确认 ---------- */
  function confirmDeleteTable(key) {
    const t = ERD.store.tableByKey(key); if (!t) return;
    confirmDlg('确认删除表 <b>' + ERD.esc(t.key) + '</b>（' + ERD.esc(t.cn || '') + '）？<br>其所有关系连线将一并删除。', () => {
      ERD.store.removeTable(key);
      toast('已删除表 ' + key, 'ok');
    }, '删除');
  }

  /* ---------- 批量删除确认 ---------- */
  function confirmDeleteMany(keys) {
    const n = keys.length;
    const names = keys.slice(0, 3).map(k => {
      const t = ERD.store.tableByKey(k);
      return t ? ERD.esc(t.key) : ERD.esc(k);
    }).join('、') + (n > 3 ? ' 等' : '');
    confirmDlg('确认删除所选 <b>' + n + '</b> 张表（' + names + '）？<br>其所有关系连线将一并删除，且不可恢复。', () => {
      ERD.store.removeTables(keys);
      toast('已删除 ' + n + ' 张表', 'ok');
    }, '删除');
  }

  /* ================= 域管理弹窗 ================= */
  function dlgZones() {
    const p = ERD.store.state.p;
    function body() {
      return p.zones.map(z => {
        const n = p.tables.filter(t => t.zone === z.key).length;
        return '<div class="zone-row" data-z="' + z.key + '">' +
          '<span class="zdot" style="background:' + ERD.esc(z.color) + '"></span>' +
          '<input class="color-in" type="color" value="' + ERD.esc(z.color) + '" data-act="color">' +
          '<input class="zname" value="' + ERD.esc(z.name) + '" data-act="name">' +
          '<span class="zcnt">' + n + ' 张表</span>' +
          '<button class="btn sm icon danger" data-act="delz" title="删除域（表归入第一个域）"><i class="ri-delete-bin-line"></i></button></div>';
      }).join('') + '<button class="btn" id="zn-add" style="width:100%;justify-content:center"><i class="ri-add-line"></i>新增域</button>';
    }
    const m = openModal('业务域管理', 'ri-stack-line', '<div id="zn-list">' + body() + '</div>',
      '<button class="btn" data-act="close">关闭</button>');
    m.querySelector('[data-act=close]').onclick = closeModal;
    function rebind() {
      const list = m.querySelector('#zn-list');
      list.querySelectorAll('.zone-row').forEach(row => {
        const zk = row.dataset.z;
        row.querySelector('[data-act=color]').onchange = e => { ERD.store.updateZone(zk, { color: e.target.value }); refresh(); };
        row.querySelector('[data-act=name]').onchange = e => { ERD.store.updateZone(zk, { name: e.target.value.trim() || '未命名' }); refresh(); };
        row.querySelector('[data-act=delz]').onclick = () => {
          const n = p.tables.filter(t => t.zone === zk).length;
          const go = () => { ERD.store.removeZone(zk); refresh(); };
          if (n) confirmDlg('该域下还有 ' + n + ' 张表，删除后这些表将归入第一个域，确认？', go);
          else go();
        };
      });
      list.querySelector('#zn-add').onclick = () => {
        const palette = ['#7dcfff', '#bb9af7', '#e0af68', '#73daca', '#f7768e', '#7aa2f7', '#a9ce6c', '#ff9e64'];
        ERD.store.addZone('新域', palette[p.zones.length % palette.length]);
        refresh();
      };
    }
    function refresh() { m.querySelector('#zn-list').innerHTML = body(); rebind(); }
    rebind();
  }

  /* ================= 新建表（模板） ================= */
  function dlgNewTable(pos) {
    const p = ERD.store.state.p;
    const TPLS = ERD.presets.TEMPLATES;
    const zoneOpts = '<option value="">未分组</option>' + p.zones.map(z =>
      '<option value="' + z.key + '">' + ERD.esc(z.name) + '</option>').join('');
    const cards = TPLS.map((tp, i) =>
      '<div class="tpl-card' + (i === 1 ? ' sel' : '') + '" data-tpl="' + tp.key + '">' +
      '<i class="' + tp.icon + '"></i><b>' + tp.name + '</b><small>' + tp.desc + '</small>' +
      '<span class="tpl-cnt">' + tp.cols.filter(c => c[2] !== 'g').length + ' 字段</span></div>').join('');

    const m = openModal('新建表', 'ri-table-line',
      '<div class="form-row"><div class="fw"><label>表名（英文）</label><input class="itxt mono" id="nt-key" placeholder="如：order_main" autocomplete="off"></div>' +
      '<div style="width:130px"><label>中文名</label><input class="itxt" id="nt-cn" placeholder="如：订单主表"></div></div>' +
      '<div class="form-row"><div class="fw"><label>所属域</label><select class="isel" id="nt-zone">' + zoneOpts + '</select></div></div>' +
      '<div class="form-row"><div class="fw"><label>选择模板</label><div class="tpl-grid" id="nt-tpls">' + cards + '</div></div></div>',
      '<button class="btn" data-act="cancel">取消</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>创建</button>', true);
    const q = s => m.querySelector(s);

    q('#nt-tpls').addEventListener('click', e => {
      const card = e.target.closest('.tpl-card'); if (!card) return;
      q('#nt-tpls').querySelectorAll('.tpl-card').forEach(c => c.classList.remove('sel'));
      card.classList.add('sel');
    });
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => doCreate();
    q('#nt-key').addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); });
    q('#nt-cn').addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); });
    setTimeout(() => q('#nt-key').focus(), 50);

    function doCreate() {
      const key = q('#nt-key').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!key) { toast('请输入表名', 'err'); q('#nt-key').focus(); return; }
      const tp = TPLS.find(x => x.key === q('#nt-tpls .tpl-card.sel').dataset.tpl) || TPLS[0];
      ERD.store.addTable({
        key: key, cn: q('#nt-cn').value.trim(), zone: q('#nt-zone').value,
        x: pos ? pos.x : undefined, y: pos ? pos.y : undefined,
        cols: tp.cols.map(c => c.slice())
      });
      closeModal();
      ERD.render.renderAll();
      renderDock();
      const inp = document.getElementById('dk-key');
      if (inp) { inp.focus(); inp.select(); }
      toast('表已创建，可继续编辑字段（回车快速加行）', 'ok');
    }
  }

  /* ================= 工程弹窗 ================= */
  function dlgNewProject() {
    const m = openModal('新建工程', 'ri-folder-line',
      '<div class="form-row"><div class="fw"><label>工程名称</label><input class="itxt" id="np-name" placeholder="如：××系统数据库设计"></div></div>' +
      '<div class="form-row"><div class="fw"><label>描述</label><textarea class="itxtarea" id="np-desc" rows="2" placeholder="可选"></textarea></div></div>',
      '<button class="btn" data-act="cancel">取消</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>创建</button>');
    const q = s => m.querySelector(s);
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => {
      const name = q('#np-name').value.trim();
      if (!name) { toast('请输入工程名称', 'err'); return; }
      ERD.store.create(name, q('#np-desc').value.trim());
      closeModal(); ERD.render.renderAll(); ERD.render.fit();
      toast('工程已创建，开始添加表吧', 'ok');
    };
    setTimeout(() => q('#np-name').focus(), 50);
  }
  function dlgRenameProject() {
    const p = ERD.store.state.p;
    const m = openModal('重命名工程', 'ri-edit-line',
      '<div class="form-row"><div class="fw"><label>工程名称</label><input class="itxt" id="rn-name" value="' + ERD.esc(p.name) + '"></div></div>' +
      '<div class="form-row"><div class="fw"><label>描述</label><textarea class="itxtarea" id="rn-desc" rows="2">' + ERD.esc(p.description || '') + '</textarea></div></div>',
      '<button class="btn" data-act="cancel">取消</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>保存</button>');
    const q = s => m.querySelector(s);
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => {
      ERD.store.rename(p.id, q('#rn-name').value.trim() || p.name, q('#rn-desc').value.trim());
      closeModal(); toast('已保存', 'ok');
    };
  }

  /* ================= 导入弹窗 ================= */
  function dlgImport() {
    const m = openModal('导入数据', 'ri-upload-2-line',
      '<div class="drop-zone" id="imp-drop"><i class="ri-upload-2-line"></i>点击选择文件，或将文件拖拽到此处<br><span style="font-size:10.5px;color:var(--dimmer)">支持 .json（本平台工程）/ .sql / .ddl（CREATE TABLE 脚本）</span></div>' +
      '<input type="file" id="imp-file" accept=".json,.sql,.ddl,.txt" style="display:none">' +
      '<div class="form-row" style="margin-bottom:8px"><div class="fw"><label>或粘贴 SQL / JSON 文本</label><textarea id="imp-text" placeholder="CREATE TABLE xxx (...);"></textarea></div></div>' +
      '<div class="imp-opts">导入方式：<label><input type="radio" name="imp-mode" value="new" checked>新建工程</label>' +
      '<label><input type="radio" name="imp-mode" value="merge">合并到当前工程</label></div>' +
      '<div class="fhint" id="imp-info" style="margin-top:10px"></div>',
      '<button class="btn" data-act="cancel">取消</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>导入</button>', true);
    const q = s => m.querySelector(s);
    let pendingText = '';
    const drop = q('#imp-drop'), file = q('#imp-file');
    drop.onclick = () => file.click();
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => {
      e.preventDefault(); drop.classList.remove('over');
      const f = e.dataTransfer.files[0];
      if (f) readFile(f);
    };
    file.onchange = () => { if (file.files[0]) readFile(file.files[0]); };
    function readFile(f) {
      const rd = new FileReader();
      rd.onload = () => {
        pendingText = String(rd.result || '');
        q('#imp-text').value = pendingText.length > 20000 ? '' : pendingText;
        preview(pendingText);
      };
      rd.readAsText(f, 'utf-8');
    }
    function preview(text) {
      const r = ERD.io.parseAuto(text || q('#imp-text').value);
      const pj = r.kind === 'project' ? (r.project || {}) : null;
      const tb = pj ? (pj.tables || []) : (r.tables || []);
      const rl = pj ? (pj.relations || []) : (r.relations || []);
      const zs = pj ? (pj.zones || null) : null;
      q('#imp-info').innerHTML = r.ok
        ? '<i class="ri-checkbox-circle-line" style="color:var(--green)"></i> 识别为 ' + (r.kind === 'project' ? '工程 JSON' : 'SQL DDL') +
          '：' + tb.length + ' 张表 / ' + rl.length + ' 条关系' + (zs && zs.length ? ' / ' + zs.length + ' 个域' : '')
        : '<i class="ri-error-warning-line" style="color:var(--rose)"></i> ' + ERD.esc(r.error || '无法识别的格式');
    }
    q('#imp-text').addEventListener('change', () => preview());
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => {
      const text = pendingText || q('#imp-text').value;
      if (!text.trim()) { toast('请选择文件或粘贴内容', 'err'); return; }
      const mode = m.querySelector('input[name=imp-mode]:checked').value;
      const r = ERD.io.parseAuto(text);
      if (!r.ok) { toast(r.error || '无法识别', 'err'); return; }
      const done = ERD.io.importData(r, mode);
      if (done) { closeModal(); ERD.render.renderAll(); ERD.render.fit(); }
    };
  }

  /* ================= 类型库管理 ================= */
  function dlgTypes() {
    const m = openModal('类型库管理', 'ri-braces-line',
      '<div class="fhint" style="margin-bottom:10px">自定义类型保存在本浏览器（localStorage），会自动并入字段「类型」输入框的候选列表；内置类型不可删除。</div>' +
      '<div class="g-tip" style="margin-bottom:8px;color:var(--dim)">内置：' + ERD.types.BUILTIN.slice(0, 10).join(' / ') + ' …（共 ' + ERD.types.BUILTIN.length + ' 种）</div>' +
      '<div id="tp-list"></div>' +
      '<div class="form-row" style="margin-top:12px;margin-bottom:6px;align-items:flex-end">' +
      '<div class="fw"><label>新增自定义类型</label><input class="itxt mono" id="tp-add" placeholder="如：decimal(12,4) / inet / citext" autocomplete="off"></div>' +
      '<button class="btn primary" id="tp-btn"><i class="ri-add-line"></i>添加</button></div>',
      '<button class="btn" data-act="cancel">关闭</button>');
    const q = s => m.querySelector(s);
    function body() {
      const extra = ERD.types.extra();
      if (!extra.length) return '<div class="g-tip">暂无自定义类型</div>';
      return extra.map(t => '<div class="zone-row" data-t="' + ERD.esc(t) + '">' +
        '<code style="flex:1;font-size:12px">' + ERD.esc(t) + '</code>' +
        '<button class="btn sm danger" data-act="del"><i class="ri-delete-bin-line"></i></button></div>').join('');
    }
    function refresh() { q('#tp-list').innerHTML = body(); rebind(); }
    function rebind() {
      q('#tp-list').querySelectorAll('[data-act=del]').forEach(b => {
        b.onclick = () => {
          const t = b.closest('[data-t]').dataset.t;
          ERD.types.remove(t);
          refresh(); toast('已删除类型 ' + t, 'ok');
        };
      });
    }
    function addOne() {
      const v = q('#tp-add').value.trim();
      if (!v) { toast('请输入类型名', 'warn'); return; }
      if (!ERD.types.add(v)) { toast('类型已存在或为空', 'warn'); return; }
      q('#tp-add').value = '';
      refresh(); toast('已添加类型 ' + v, 'ok');
    }
    q('[data-act=cancel]').onclick = closeModal;
    q('#tp-btn').onclick = addOne;
    q('#tp-add').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } });
    refresh();
    setTimeout(() => q('#tp-add').focus(), 50);
  }

  /* ================= 分享链接内容打开方式 ================= */
  function dlgShareOpen(parsed) {
    const tb = parsed.kind === 'project' ? parsed.project.tables.length : parsed.tables.length;
    const rl = parsed.kind === 'project' ? parsed.project.relations.length : parsed.relations.length;
    const name = parsed.kind === 'project' ? (parsed.project.name || '') : 'SQL 结构';
    const m = openModal('打开分享内容', 'ri-link',
      '<div class="confirm-msg">识别到来自链接的工程内容：<b>' + ERD.esc(name) + '</b>（' + tb + ' 表 / ' + rl + ' 关系）。<br>请选择打开方式：</div>',
      '<button class="btn" data-act="cancel">取消</button>' +
      '<button class="btn" data-act="merge"><i class="ri-merge-cells-horizontal"></i>合并到当前工程</button>' +
      '<button class="btn primary" data-act="new"><i class="ri-file-add-line"></i>作为新工程打开</button>');
    const q = s => m.querySelector(s);
    const open = mode => {
      ERD.io.importData(parsed, mode);
      closeModal();
      ERD.render.renderAll(); ERD.render.fit();
      toast(mode === 'new' ? '已作为新工程打开分享内容' : '已合并分享内容到当前工程', 'ok');
    };
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=new]').onclick = () => open('new');
    q('[data-act=merge]').onclick = () => open('merge');
  }

  /* ================= 帮助 ================= */
  function dlgHelp() {
    openModal('使用帮助与关于', 'ri-question-line',
      '<div class="dock-sec"><h4>画布操作</h4><div class="g-tip" style="line-height:2.2">' +
      '· 拖拽空白处平移，滚轮缩放，F 键适配窗口<br>' +
      '· 点击表卡片：聚焦该表关系；双击表折叠/展开<br>' +
      '· <b>Ctrl/Cmd+点击</b>多选表，<b>Shift+拖拽空白</b>框选；多选后可整体拖动<br>' +
      '· 多选后右键：折叠/展开、<b>对齐与等距分布</b>、移动到域、批量删除<br>' +
      '· <b>双击空白处：快速新建表</b>；拖动表卡片调整布局（4px 网格对齐）<br>' +
      '· 左下角<b>迷你地图</b>：点击/拖动跳转视图<br>' +
      '· <b>右键</b>：画布/表/字段/连线均有上下文菜单<br>' +
      '· 点击连线：选中并编辑关系；Delete 删除所选表/关系</div></div>' +
      '<div class="dock-sec"><h4>快速建表建字段</h4><div class="g-tip" style="line-height:2.2">' +
      '· 新建表可选 7 种模板（N 键快速打开）<br>' +
      '· 字段编辑中<b>回车</b> = 下方插入新行，连续回车快速加字段<br>' +
      '· 在字段名输入框<b>粘贴多行文本</b>可批量建字段：每行「字段名 类型 说明」<br>' +
      '· 「常用」字段条一键追加 手机号/邮箱/状态/金额 等高频字段<br>' +
      '· Ctrl+C / Ctrl+V 复制粘贴表 · Ctrl+D 快速副本</div></div>' +
      '<div class="dock-sec"><h4>快捷键</h4><div class="g-tip" style="line-height:2.2">' +
      'N 新建表 · L 逻辑关联开关 · A 自动布局 · F 适配窗口 · +/- 缩放<br>' +
      'Ctrl+Z 撤销 · Ctrl+Y 重做 · Ctrl+F 搜索 · Ctrl+S 保存 · Esc 取消/关闭</div></div>' +
      '<div class="dock-sec"><h4>数据存储</h4><div class="g-tip" style="line-height:2.2">' +
      '纯前端应用，无后端。所有数据自动保存在<b>浏览器本地（localStorage）</b>，仅限当前浏览器。<br>' +
      '重要工程请定期通过「导出 → 工程 JSON」备份；换电脑 / 换浏览器时导入即可恢复。<br>' +
      '「导出 → SQL」支持 8 种数据库方言：PostgreSQL / MySQL / MariaDB / SQLite / SQL Server / Oracle / 达梦 DM / 人大金仓 KingbaseES。</div></div>' +
      '<div class="dock-sec"><h4>本地文件 / 分享 / PWA</h4><div class="g-tip" style="line-height:2.2">' +
      '· 「文件」菜单：打开/保存本地 <b>.erd / .json</b> 文件（Ctrl+S 同步保存到文件）；<br>' +
      '· 「复制分享链接」：把当前工程编码进 URL，分享后打开链接即可载入（链接较长时建议改用 JSON）；<br>' +
      '· 支持<b>安装为 PWA</b>：通过 HTTPS / localhost 访问时可用浏览器「安装应用」，离线也可使用。<br>' +
      '· 「工具」菜单可切换界面语言：简体中文 / English。</div></div>' +
      '<div class="dock-sec"><h4>关于</h4><div class="g-tip" style="line-height:2.2">' +
      'Aneiang ERD Studio · 数据库 ER 图在线设计平台（开源，MIT License）<br>' +
      '图标：Remix Icon（Apache-2.0，本地内置）；支持离线 / 内网 / 容器化部署。<br>' +
      'GitHub：github.com/AneiangSoft/Aneiang.ERD-Studio<br>' +
      'Gitee：gitee.com/aneiangsoft/aneiang.erd-studio</div></div>',
      '<button class="btn primary" data-act="close">知道了</button>').querySelector('[data-act=close]').onclick = closeModal;
  }

  /* ================= 自动布局 ================= */
  function autoLayout() {
    const p = ERD.store.state.p;
    if (!p.tables.length) return;
    ERD.store.pushHistory('自动布局');
    const groups = {};
    p.tables.forEach(t => { const k = t.zone || '__none'; (groups[k] = groups[k] || []).push(t); });
    const zl = p.zones.map(z => z.key).filter(k => groups[k] && groups[k].length);
    const none = groups['__none'] || [];
    const order = zl.concat(none.length ? ['__none'] : []);
    let x = 0;
    order.forEach(zk => {
      const ts = groups[zk];
      ts.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      let y = 0;
      ts.forEach(t => { t.x = x; t.y = y; y += ERD.tableH(t) + 44; });
      x += ERD.CARD_W + 160;
    });
    ERD.store.persist();
    ERD.bus.emit('dirty', 'all');
    ERD.render.fit();
    toast('已按业务域自动排列', 'ok');
  }

  return { init, toast, confirm: confirmDlg, confirmDeleteTable, confirmDeleteMany, openRelationDialog, renderDock, autoLayout, dlgImport, loadSample, dlgNewTable, focusTable, dlgTypes, dlgShareOpen };
})();
