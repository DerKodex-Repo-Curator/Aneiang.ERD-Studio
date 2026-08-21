/* ================================================================
   Aneiang ERD Studio · editor.js — 属性面板 / 弹窗 / 菜单 / 工具栏 / 自动布局
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.editor = (function () {
  let mask, modal, dock, dockBody;
  let welcomeLock = false;   // 欢迎页锁定：仅「开始使用」可关闭，屏蔽 × 与遮罩点击
  let tpEl = null;           // 字段类型自定义下拉面板
  const AUDIT_COLS = [
    ['deleted', 'bool', '', { zh: '逻辑删除', en: 'Deleted' }], ['version', 'int', '', { zh: '乐观锁', en: 'Optimistic lock' }],
    ['created_by', 'bigint', '', { zh: '创建人', en: 'Created by' }], ['created_at', 'timestamptz', '', { zh: '创建时间', en: 'Created at' }],
    ['updated_by', 'bigint', '', { zh: '更新人', en: 'Updated by' }], ['updated_at', 'timestamptz', '', { zh: '更新时间', en: 'Updated at' }]
  ];
  const COMMON_TYPES = ['bigint', 'bigserial', 'int', 'smallint', 'numeric(5,2)', 'numeric(10,2)', 'varchar(20)', 'varchar(40)', 'varchar(50)', 'varchar(100)', 'varchar(200)', 'varchar(500)', 'text', 'bool', 'boolean', 'date', 'timestamptz', 'timestamp', 'jsonb', 'json', 'varchar[]', 'int[]'];

  /* ---------- 开源项目信息 ---------- */
  const OSS = {
    name: 'Aneiang ERD Studio',
    tagline: _t('数据库 ER 图在线设计 · 纯前端 · 离线可用 · 可私有部署', 'Database ER diagram designer · pure frontend · offline · self-hostable'),
    github: 'https://github.com/AneiangSoft/Aneiang.ERD-Studio',
    gitee: 'https://gitee.com/aneiangsoft/aneiang.erd-studio',
    issues: 'https://github.com/AneiangSoft/Aneiang.ERD-Studio/issues',
    license: 'MIT'
  };
  /* 更新日志：{v, date, items: [{zh, en}]} */
  const CHANGELOG = [
    {
      v: '1.1.0', date: '2026-08',
      items: [
        { zh: '性能优化：拖拽不再逐帧写盘；编辑改为单表定点刷新；撤销/重做改用原生深拷贝并限制历史内存', en: 'Performance: drag no longer saves per-frame; targeted refresh on edits; native deep-clone undo/redo with bounded history' },
        { zh: '存储优化：单次序列化复用，持久化剥离冗余字段', en: 'Storage: single serialization, stripped redundant fields' },
        { zh: '界面：语言切换免刷新；新增欢迎页 / 关于 / 更新日志；开源仓库入口', en: 'UI: language switch without reload; added Welcome / About / Changelog; open-source repo links' },
        { zh: '编辑体验：常用字段支持自定义与管理；字段类型改为分组可过滤的自定义下拉', en: 'Editing: customizable quick fields; grouped & filterable type dropdown' },
        { zh: '样式与无障碍：动画时长/缓动统一、菜单键盘导航、空态引导卡片、浅色主题对比度校准、响应式适配', en: 'Polish & a11y: unified motion, menu keyboard navigation, empty-state card, light-theme contrast, responsive tweaks' },
        { zh: '构建：发布时自动注入 Service Worker 缓存版本', en: 'Build: auto-inject SW cache version on publish' }
      ]
    },
    {
      v: '1.0.0', date: '2026-06',
      items: [
        { zh: '首个版本：纯前端、零依赖的 ER 图在线设计平台，支持离线与私有化部署', en: 'Initial release: pure-frontend, zero-dependency ER diagram designer, offline & self-hostable' }
      ]
    }
  ];

  function openRepo(url) { const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url; }

  /* 字段类型候选（按类别分组展示，自定义类型追加在末尾） */
  const TYPE_GROUPS = [
    { name: _t('整数', 'Integer'), types: ['bigint', 'bigserial', 'serial', 'int', 'integer', 'smallint', 'tinyint'] },
    { name: _t('数值', 'Numeric'), types: ['numeric(5,2)', 'numeric(10,2)', 'numeric(18,2)', 'decimal(10,2)', 'double precision', 'real', 'money'] },
    { name: _t('字符串', 'Text'), types: ['varchar(20)', 'varchar(40)', 'varchar(50)', 'varchar(100)', 'varchar(200)', 'varchar(500)', 'char(10)', 'text', 'citext'] },
    { name: _t('时间', 'Time'), types: ['date', 'time', 'timestamp', 'timestamptz', 'datetime', 'time(6)'] },
    { name: _t('布尔', 'Boolean'), types: ['bool', 'boolean'] },
    { name: _t('JSON / 文档', 'JSON'), types: ['json', 'jsonb', 'xml'] },
    { name: _t('数组', 'Array'), types: ['varchar[]', 'int[]', 'bigint[]', 'text[]', 'uuid[]'] },
    { name: _t('网络 / 其它', 'Other'), types: ['uuid', 'inet', 'cidr', 'macaddr', 'bytea', 'blob', 'clob'] }
  ];

  function init() {
    mask = document.getElementById('modal-mask');
    dock = document.getElementById('dock');
    dockBody = document.getElementById('dock-body');
    wireHeader();
    wireViewbar();
    wireBus();
    mask.addEventListener('mousedown', e => { if (e.target === mask && !welcomeLock) closeModal(); });
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenus();
    });
    /* 字段类型自定义下拉（委托，行重建后仍生效） */
    dockBody.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('ctype')) typePanelOpen(e.target); });
    dockBody.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('ctype')) typePanelOpen(e.target); });
    dockBody.addEventListener('click', e => {
      const caret = e.target.closest('.tp-caret');
      if (caret) {
        const inp = caret.parentElement && caret.parentElement.querySelector('.ctype');
        if (inp) { inp.focus(); typePanelOpen(inp); }
      }
    });
    dockBody.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('ctype')) setTimeout(typePanelClose, 0); });
    dockBody.addEventListener('keydown', e => { if (e.key === 'Escape' && tpEl) typePanelClose(); });
    dockBody.addEventListener('scroll', typePanelClose, true);
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
  function closeModal() { typePanelClose(); mask.classList.remove('open'); mask.innerHTML = ''; modal = null; }
  function confirmDlg(msg, onOk, okLabel) {
    const m = openModal(_t('操作确认', 'Confirmation'), 'ri-error-warning-line',
      '<div class="confirm-msg"><i class="ri-error-warning-line"></i>' + msg + '</div>',
      '<button class="btn" data-act="cancel">' + _t('取消', 'Cancel') + '</button><button class="btn primary" data-act="ok">' + (okLabel || _t('确认', 'OK')) + '</button>');
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
      m.setAttribute('role', 'menu');
      m._btn = btn;
      const menuItems = [];
      list.forEach(it => {
        if (it === '-') { const s = div('msep'); s.setAttribute('role', 'separator'); m.appendChild(s); return; }
        if (it.title) { const t = div('mtitle'); t.textContent = it.title; t.setAttribute('role', 'presentation'); m.appendChild(t); return; }
        const mi = div('mi' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : ''));
        mi.setAttribute('role', 'menuitem');
        mi.innerHTML = '<i class="' + it.icon + '"></i><span>' + ERD.esc(it.label) + '</span>' + (it.right || '');
        mi.tabIndex = -1;
        if (!it.disabled) {
          menuItems.push(mi);
          mi.onclick = () => { closeMenus(); btn.focus(); it.onClick(); };
        }
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
      /* 键盘导航：方向键 / Home / End / 回车 / 空格 / Esc */
      m.addEventListener('keydown', e => {
        const len = menuItems.length;
        if (!len) return;
        const idx = menuItems.indexOf(document.activeElement);
        let target = -1;
        if (e.key === 'ArrowDown') target = idx < 0 ? 0 : (idx + 1) % len;
        else if (e.key === 'ArrowUp') target = idx < 0 ? len - 1 : (idx - 1 + len) % len;
        else if (e.key === 'Home') target = 0;
        else if (e.key === 'End') target = len - 1;
        else if (e.key === 'Enter' || e.key === ' ') {
          if (idx >= 0) { e.preventDefault(); menuItems[idx].click(); }
          return;
        } else if (e.key === 'Escape') { e.preventDefault(); closeMenus(); btn.focus(); return; }
        else return;
        e.preventDefault();
        menuItems[target].focus();
      });
      /* 打开后聚焦首项，键盘用户可直接上下选择 */
      const first = menuItems[0];
      if (first) first.focus();
    });
  }
  function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }

  function loadSample() {
    if (!window.ERD_SAMPLE) { toast(_t('示例数据未加载', 'Sample data not loaded'), 'err'); return; }
    const sp = JSON.parse(JSON.stringify(window.ERD_SAMPLE));
    sp.id = ERD.uid('p');
    sp.name = '演示示例 ' + new Date().toLocaleDateString('zh-CN');
    sp.description = sp.description || (sp.meta && (sp.meta.desc || sp.meta.description)) || '';
    ERD.store.create(sp.name, sp.description, sp);
    ERD.render.renderAll(); ERD.render.fit();
    toast(_t('已载入示例工程', 'Sample project loaded'), 'ok');
  }

  /* ================= 头部工具栏 ================= */
  function wireHeader() {
    const $ = id => document.getElementById(id);
    /* 工程：切换（动态工程列表）+ 管理 */
    attachMenu($('btn-project'), () => {
      const list = ERD.store.list();
      const cur = ERD.store.state.p;
      const items = [
        { title: _t('切换工程', 'Switch Project') },
        ...list.map(p => ({
          icon: p.id === (cur && cur.id) ? 'ri-check-line' : 'ri-database-2-line',
          label: p.name,
          right: '<span style="color:var(--dimmer);font-size:10px">' + (p.tableCount || 0) + _t(' 表', ' tbls') + '</span>',
          onClick: () => {
            if (cur && p.id !== cur.id) { ERD.store.open(p.id); toast(_t('已切换到工程「' + p.name + '」', 'Switched to "' + p.name + '"'), 'ok'); }
          }
        }))
      ];
      if (list.length) items.push('-');
      items.push(
        { title: _t('工程管理', 'Project') },
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
      );
      return items;
    });

    $('btn-newtable').onclick = () => dlgNewTable();
    $('btn-newproj').onclick = dlgNewProject;

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
        { icon: 'ri-links-line', label: _t('连线模式（创建外键，C）…', 'Connect Mode (create FK, C)…'), onClick: () => ERD.interact.setConnectMode(!ERD.view.connectMode) },
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
    /* 帮助：使用帮助 / 更新日志 / 欢迎页 / 贡献 / 隐私 / 关于 / 开源仓库 */
    attachMenu($('btn-help'), [
      { icon: 'ri-question-line', label: _t('使用帮助', 'Help'), onClick: dlgHelp },
      { icon: 'ri-list-ordered', label: _t('更新日志', 'Changelog'), onClick: dlgChangelog },
      { icon: 'ri-star-smile-line', label: _t('欢迎页', 'Welcome'), onClick: showWelcome },
      '-',
      { icon: 'ri-user-3-line', label: _t('参与贡献', 'Contributing'), onClick: dlgContributing },
      { icon: 'ri-eye-off-line', label: _t('隐私与数据', 'Privacy & Data'), onClick: dlgPrivacy },
      '-',
      { icon: 'ri-information-line', label: _t('关于本应用', 'About'), onClick: dlgAbout },
      '-',
      { icon: 'ri-git-branch-line', label: 'GitHub', onClick: () => openRepo(OSS.github) },
      { icon: 'ri-book-2-line', label: 'Gitee', onClick: () => openRepo(OSS.gitee) }
    ]);
  }

  /* ================= 浮动视图条 ================= */
  const THEMES = [
    { key: 'dark', name: { zh: '暗夜（默认）', en: 'Dark (default)' }, bg: '#0e1116', panel: '#161a22', accent: '#7aa2f7' },
    { key: 'midnight', name: { zh: '午夜蓝', en: 'Midnight' }, bg: '#090d18', panel: '#0f1526', accent: '#6f9bff' },
    { key: 'light', name: { zh: '极简白', en: 'Light' }, bg: '#f4f6fa', panel: '#ffffff', accent: '#3b6fe0' },
    { key: 'blue', name: { zh: '商务蓝', en: 'Business Blue' }, bg: '#edf2fb', panel: '#ffffff', accent: '#2f5cc4' },
    { key: 'green', name: { zh: '护眼绿', en: 'Eye-care Green' }, bg: '#eef2e8', panel: '#fcfdfa', accent: '#3f7d38' },
    { key: 'paper', name: { zh: '羊皮纸', en: 'Paper' }, bg: '#f6f1e3', panel: '#fdfaf1', accent: '#8a6d2f' }
  ];
  const BGS = [
    { key: 'grid', name: { zh: '网格', en: 'Grid' }, icon: 'ri-layout-grid-line' },
    { key: 'dots', name: { zh: '点阵', en: 'Dots' }, icon: 'ri-focus-3-line' },
    { key: 'none', name: { zh: '纯净（无图案）', en: 'Plain (none)' }, icon: 'ri-eye-off-line' }
  ];
  const EDGE_STYLES = [
    { key: 'bezier', name: { zh: '曲线（默认）', en: 'Curve (default)' }, icon: 'ri-links-line' },
    { key: 'ortho', name: { zh: '直角折线', en: 'Orthogonal' }, icon: 'ri-git-branch-line' },
    { key: 'straight', name: { zh: '直线', en: 'Straight' }, icon: 'ri-subtract-line' }
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
      const items = [{ title: _t('界面主题', 'Theme') }];
      THEMES.forEach(t => items.push({
        icon: 'ri-palette-line',
        label: _t(t.name.zh, t.name.en),
        right: '<span class="mi-sw" title="' + _t('背景 / 面板 / 强调色', 'Background / panel / accent') + '">' +
          '<i style="background:' + t.bg + '"></i><i style="background:' + t.panel + '"></i><i style="background:' + t.accent + '"></i></span>' +
          (curTheme === t.key ? chk : ''),
        onClick: () => { ERD.ui.set('theme', t.key); ERD.render.renderEdges(); ERD.render.renderLegend(); }
      }));
      items.push('-');
      items.push({ title: _t('画布背景', 'Canvas Background') });
      BGS.forEach(b => items.push({
        icon: b.icon, label: _t(b.name.zh, b.name.en), right: curBg === b.key ? chk : '',
        onClick: () => ERD.ui.set('bgPattern', b.key)
      }));
      items.push('-');
      items.push({ title: _t('连线样式', 'Edge Style') });
      EDGE_STYLES.forEach(s => items.push({
        icon: s.icon, label: _t(s.name.zh, s.name.en), right: curEdge === s.key ? chk : '',
        onClick: () => { ERD.ui.set('edgeStyle', s.key); ERD.render.renderEdges(); }
      }));
      items.push('-');
      items.push({ title: _t('表卡片折叠', 'Table Folding') });
      items.push({ icon: 'ri-folder-line', label: _t('折叠全部表（仅显示表名）', 'Fold all tables (name only)'), onClick: () => ERD.store.foldAll(true) });
      items.push({ icon: 'ri-folder-open-line', label: _t('展开全部表', 'Expand all tables'), onClick: () => ERD.store.foldAll(false) });
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
      el.innerHTML = '<span class="dot"></span>' + _t('已自动保存 ', 'Saved at ') + new Date().toLocaleTimeString('zh-CN', { hour12: false });
    });
    ERD.bus.on('select', renderDock);
  }
  function updateHistoryBtns() {
    document.getElementById('btn-undo').disabled = !ERD.store.canUndo();
    document.getElementById('btn-redo').disabled = !ERD.store.canRedo();
  }
  function refreshProjects() {
    const list = ERD.store.list();
    const cur = ERD.store.state.p;
    const pn = document.getElementById('proj-name');
    if (pn) pn.textContent = (cur && cur.name) || _t('未命名工程', 'Untitled');
    const st = document.getElementById('st-proj');
    if (st) st.textContent = list.length;
  }

  /* ================= 右侧属性面板 ================= */
  function openDock() { dock.classList.add('open'); }
  function closeDock() { dock.classList.remove('open'); }

  function renderDock() {
    typePanelClose();   // 面板随属性面板重建关闭
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
    const zoneOpts = '<option value="">' + _t('未分组', 'Ungrouped') + '</option>' + p.zones.map(z =>
      '<option value="' + z.key + '"' + (z.key === t.zone ? ' selected' : '') + '>' + ERD.esc(ERD.zoneLabel(z)) + '</option>').join('');

    let relHtml = '';
    const rels = p.relations.filter(r => r.type === 'fk' ? (r.child === key || r.parent === key) : (r.from === key || r.to === key));
    rels.forEach(r => {
      let main, sub;
      if (r.type === 'fk') {
        main = r.child === key ? (ERD.esc(r.col) + ' → ' + ERD.esc(r.parent)) : (ERD.esc(r.child) + '.' + ERD.esc(r.col));
        sub = r.child === key ? _t('外键 · 指向父表', 'FK → parent') : _t('被引用', 'Referenced');
      } else {
        main = ERD.esc(r.from) + ' ⇢ ' + ERD.esc(r.to);
        sub = _t('逻辑关联', 'Logical') + (r.label ? ' · ' + ERD.esc(r.label) : '');
      }
      relHtml += '<div class="rel-item" data-rel="' + r.id + '"><i class="' + (r.type === 'fk' ? 'ri-link' : 'ri-link-unlink') + '" style="color:' + (r.type === 'fk' ? 'var(--fk)' : 'var(--dim)') + '"></i>' +
        '<div class="rt"><b>' + main + '</b><small>' + sub + '</small></div>' +
        '<span class="card-tag">' + (r.card || (r.type === 'logical' ? _t('逻辑', 'Logical') : '')) + '</span></div>';
    });

    let colRows = '';
    t.cols.forEach((c, i) => {
      if (c[2] === 'g') {
        colRows += '<div class="col-row g-row" data-i="' + i + '">' +
          '<div class="col-cell drag-grip" draggable="true" title="' + _t('拖拽排序', 'Drag to reorder') + '"><i class="ri-drag-move-2-line"></i></div>' +
          '<div class="col-cell"><input class="g-in" data-f="1" value="' + ERD.esc(c[1]) + '" placeholder="' + _t('分组标题', 'Group title') + '"></div>' +
          '<div class="col-cell"><span class="g-badge">' + _t('分组分隔行', 'Group separator') + '</span>' +
          '<button class="mini" data-act="up" title="' + _t('上移', 'Move up') + '"><i class="ri-arrow-up-line"></i></button>' +
          '<button class="mini" data-act="down" title="' + _t('下移', 'Move down') + '"><i class="ri-arrow-down-line"></i></button>' +
          '<button class="mini del" data-act="del" title="' + _t('删除', 'Delete') + '"><i class="ri-close-line"></i></button></div></div>';
      } else {
        const flagSel = ERD.FLAGS.map(f =>
          '<option value="' + f + '"' + (c[2] === f ? ' selected' : '') + '>' + (f ? f.toUpperCase() : '—') + '</option>').join('');
        const nnChk = c[2] === 'pk'
          ? '<input type="checkbox" class="nn" checked disabled title="' + _t('主键隐含非空', 'PK implies NOT NULL') + '">'
          : '<input type="checkbox" class="nn" data-f="4" title="' + _t('非空 NOT NULL', 'NOT NULL') + '"' + (c[4] ? ' checked' : '') + '>';
        colRows += '<div class="col-row" data-i="' + i + '">' +
          '<div class="col-cell drag-grip" draggable="true" title="' + _t('拖拽排序', 'Drag to reorder') + '"><i class="ri-drag-move-2-line"></i></div>' +
          '<div class="col-cell"><input class="cname" data-f="0" value="' + ERD.esc(c[0]) + '"></div>' +
          '<div class="col-cell"><div class="tp-wrap"><input class="ctype" data-f="1" value="' + ERD.esc(c[1]) + '"><button class="tp-caret" type="button" tabindex="-1" title="' + _t('选择类型', 'Choose type') + '"><i class="ri-arrow-down-s-line"></i></button></div></div>' +
          '<div class="col-cell"><select class="flag" data-f="2">' + flagSel + '</select></div>' +
          '<div class="col-cell" style="justify-content:center">' + nnChk + '</div>' +
          '<div class="col-cell"><input class="ccmt" data-f="3" value="' + ERD.esc(c[3] || '') + '" title="' + ERD.esc(c[3] || '') + '"></div>' +
          '<div class="col-cell" style="justify-content:flex-end">' +
          '<button class="mini" data-act="up" title="' + _t('上移', 'Move up') + '"><i class="ri-arrow-up-line"></i></button>' +
          '<button class="mini" data-act="down" title="' + _t('下移', 'Move down') + '"><i class="ri-arrow-down-line"></i></button>' +
          '<button class="mini del" data-act="del" title="' + _t('删除', 'Delete') + '"><i class="ri-close-line"></i></button></div></div>';
      }
    });

    dockBody.innerHTML =
      '<div class="dock-sec"><h4>' + _t('基本属性', 'General') + '</h4>' +
      '<div class="form-row"><div class="fw"><label>' + _t('表名（英文）', 'Table Name (EN)') + '</label><input class="itxt mono" id="dk-key" value="' + ERD.esc(t.key) + '"></div>' +
      '<div style="width:130px"><label>' + _t('中文名', 'Display Name') + '</label><input class="itxt" id="dk-cn" value="' + ERD.esc(t.cn || '') + '"></div></div>' +
      '<div class="form-row"><div class="fw"><label>' + _t('所属域', 'Zone') + '</label><select class="isel" id="dk-zone">' + zoneOpts + '</select></div>' +
      '<div style="width:110px"><label>' + _t('标记', 'Tag') + '</label><select class="isel" id="dk-core"><option value="0"' + (!t.core ? ' selected' : '') + '>' + _t('普通表', 'Normal') + '</option><option value="1"' + (t.core ? ' selected' : '') + '>' + _t('核心表', 'Core') + '</option></select></div></div>' +
      '<div class="form-row"><div class="fw"><label>' + _t('表说明', 'Description') + '</label><textarea class="itxtarea" id="dk-desc" rows="3">' + ERD.esc(t.desc || '') + '</textarea></div></div></div>' +

      '<div class="dock-sec"><h4>' + _t('字段（', 'Columns (') + t.cols.filter(c => c[2] !== 'g').length + _t('）', ')') +
      '<span class="acts"><button class="btn sm" id="dk-addcol"><i class="ri-add-line"></i>' + _t('字段', 'Column') + '</button>' +
      '<button class="btn sm" id="dk-addgroup"><i class="ri-group-line"></i>' + _t('分组', 'Group') + '</button>' +
      '<button class="btn sm" id="dk-addaudit" title="' + _t('补充 deleted/version/created_by/created_at/updated_by/updated_at', 'Add deleted/version/created_by/created_at/updated_by/updated_at') + '">' + _t('审计六件套', 'Audit set') + '</button></span></h4>' +
      '<div class="quick-fields" id="dk-quick">' +
      '<button class="btn sm" id="dk-qf-btn"><i class="ri-add-line"></i>' + _t('常用字段', 'Quick Fields') + '<i class="ri-arrow-down-s-line"></i></button>' +
      '<button class="btn sm icon" id="dk-qf-manage" title="' + _t('管理常用字段（内置 + 自定义）', 'Manage quick fields (built-in + custom)') + '"><i class="ri-tools-line"></i></button>' +
      '</div>' +
      '<div class="col-tbl"><div class="col-row head"><div class="drag-grip"></div><div>' + _t('字段名', 'Name') + '</div><div>' + _t('类型', 'Type') + '</div><div>' + _t('标记', 'Flag') + '</div><div style="text-align:center" title="' + _t('非空 NOT NULL', 'NOT NULL') + '">' + _t('非空', 'NN') + '</div><div>' + _t('说明', 'Comment') + '</div><div style="text-align:right">' + _t('操作', 'Actions') + '</div></div>' + colRows + '</div>' +
      '<div class="g-tip">' + _t('标记可选 PK 主键 / FK 外键 / UK 唯一 / IDX 索引；✱ 非空 = NOT NULL（主键隐含）；FK 标记由「关系」自动维护<br>回车 = 下方插入新行 · 粘贴多行文本可批量建字段（如 name varchar(50) 名称）',
        'Flags: PK primary / FK foreign / UK unique / IDX index; ✱ = NOT NULL (PK implies it); FK is managed by relations<br>Enter = insert a new row below · Paste multi-line text to batch-add columns (e.g. name varchar(50) comment)') + '</div></div>' +

      '<div class="dock-sec"><h4>' + _t('关系（', 'Relations (') + rels.length + _t('）', ')') +
      '<span class="acts"><button class="btn sm" id="dk-addrel" title="' + _t('新建关系', 'New relation') + '"><i class="ri-add-line"></i>' + _t('新建', 'New') + '</button></span></h4>' +
      (relHtml || '<div class="g-tip">' + _t('暂无关系，可点右上「新建」，或按住表卡片右下角圆点拖到目标表', 'No relations yet. Click "New" above, or drag the dot on a table’s bottom-right corner to another table.') + '</div>') + '</div>' +

      '<div class="dock-sec"><h4>' + _t('操作', 'Actions') + '</h4><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn" id="dk-dup"><i class="ri-file-copy-line"></i>' + _t('复制表', 'Duplicate') + '</button>' +
      '<button class="btn" id="dk-center"><i class="ri-focus-3-line"></i>' + _t('定位', 'Focus') + '</button>' +
      '<button class="btn" id="dk-fold"><i class="' + (t.fold ? 'ri-folder-open-line' : 'ri-folder-line') + '"></i>' + (t.fold ? _t('展开字段', 'Expand') : _t('折叠字段', 'Fold')) + '</button>' +
      '<button class="btn danger" id="dk-del"><i class="ri-delete-bin-line"></i>' + _t('删除表', 'Delete') + '</button></div></div>';

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
        if (ERD.store.state.p.tables.some(x => x.key === key2)) { toast(_t('表名已存在：', 'Table name already exists: ') + key2, 'err'); }
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

    /* 关系区「新建」按钮：以当前表为子表打开关系弹窗 */
    dockBody.querySelector('#dk-addrel').onclick = () => openRelationDialog({ child: key });

    /* 字段表格事件（委托） */
    const tblEl = dockBody.querySelector('.col-tbl');
    tblEl.addEventListener('change', e => {
      const row = e.target.closest('.col-row'); if (!row) return;
      const i = +row.dataset.i;
      const isChk = e.target.type === 'checkbox';
      const f = isChk ? 4 : +e.target.dataset.f;
      const cols = t.cols.map(c => c.slice());
      if (e.target.classList.contains('flag') && e.target.value === 'fk') {
        toast(_t('FK 标记请通过「连线」或关系编辑创建，保持数据一致', 'Set the FK flag via "Connect" or relation editing to keep data consistent'), 'warn');
        renderDock(); return;
      }
      if (isChk) cols[i][4] = e.target.checked;
      else {
        cols[i][f] = e.target.value;
        if (f === 2 && cols[i][2] === 'pk') cols[i][4] = true;   // 主键隐含非空
      }
      if (!isChk && f === 0 && !cols[i][0].trim()) { toast(_t('字段名不能为空', 'Column name cannot be empty'), 'warn'); renderDock(); return; }
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
        if (used) { toast(_t('字段 ', 'Column ') + colName + _t(' 被外键关系使用，请先删除对应关系', ' is used by a FK relation. Remove that relation first.'), 'err'); return; }
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

    /* 常用字段：下拉菜单一键追加（内置 + 自定义，已存在则跳过）+ 管理 */
    attachMenu(dockBody.querySelector('#dk-qf-btn'), () => {
      const list = ERD.quick.list();
      return [
        { title: _t('点击追加字段', 'Click to append a field') },
        ...list.map(f => ({
          icon: 'ri-key-2-line',
          label: ERD.tCmt(f.cmt) || f.name,
          right: '<span style="color:var(--dimmer);font-size:10px">' + ERD.esc(f.type) + (f.flag ? ' · ' + f.flag.toUpperCase() : '') + '</span>',
          onClick: () => appendQuickField(t, f)
        }))
      ];
    });
    dockBody.querySelector('#dk-qf-manage').onclick = dlgQuickFields;

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
      if (!parsed.length) { toast(_t('未识别到有效字段行', 'No valid column lines recognized'), 'warn'); return; }
      const i = +row.dataset.i;
      const cols = t.cols.map(c => c.slice());
      cols.splice.apply(cols, [i + 1, 0].concat(parsed));
      ERD.store.setColumns(t.key, cols, '批量粘贴字段');
      renderDock();
      focusColInputAt(i + parsed.length);
      toast(_t('已批量添加 ', 'Added ') + parsed.length + _t(' 个字段', ' columns'), 'ok');
    });
    dockBody.querySelector('#dk-addgroup').onclick = () => {
      const cols = t.cols.map(c => c.slice());
      cols.push(['—', _t('新分组', 'New group'), 'g', '———']);
      ERD.store.setColumns(t.key, cols, '新增分组');
      renderDock();
    };
    dockBody.querySelector('#dk-addaudit').onclick = () => {
      const cols = t.cols.map(c => c.slice());
      let added = 0;
      AUDIT_COLS.forEach(a => { if (!cols.some(c => c[0] === a[0])) { cols.push([a[0], a[1], a[2], ERD.tCmt(a[3]), a[4]]); added++; } });
      if (!added) { toast(_t('审计六件套已存在', 'Audit columns already present'), 'warn'); return; }
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
        key: src.key + '_copy', cn: (src.cn || '') + _t(' 副本', ' copy'), zone: src.zone, desc: src.desc,
        x: src.x + 60, y: src.y + 60, cols: src.cols.map(c => c.slice())
      });
      toast(_t('已复制表', 'Table duplicated'), 'ok');
      renderDock();
    };
    dockBody.querySelector('#dk-center').onclick = () => focusTable(t.key);
    dockBody.querySelector('#dk-fold').onclick = () => ERD.store.setFold(t.key, !t.fold);
    dockBody.querySelector('#dk-del').onclick = () => confirmDeleteTable(t.key);

    /* 头部信息 */
    const head = document.getElementById('dock-head-info');
    head.innerHTML = '<b>' + ERD.esc(t.key) + '</b><small><span class="zdot" style="background:' + zc + ';display:inline-block;width:8px;height:8px;border-radius:3px;margin-right:5px"></span>' + ERD.esc(t.cn || zoneName(t.zone)) + ' · ' + t.cols.filter(c => c[2] !== 'g').length + _t(' 字段', ' fields') + '</small>';
    const hi = document.getElementById('dock-head-icon');
    hi.className = 'ri-table-line';
    hi.style.color = zc;
  }

  function zoneName(zk) { const z = ERD.store.state.p.zones.find(x => x.key === zk); return z ? ERD.zoneLabel(z) : _t('未分组', 'Ungrouped'); }

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
        '<div class="form-row"><div class="fw"><label>' + _t('子表（含外键）', 'Child (FK)') + '</label><select class="isel" id="rl-child">' + tOpts(r.child) + '</select></div>' +
        '<div class="fw"><label>' + _t('外键字段', 'FK Column') + '</label><select class="isel" id="rl-col">' + cOpts + '</select></div></div>' +
        '<div class="form-row"><div class="fw"><label>' + _t('父表（被引用）', 'Parent (referenced)') + '</label><select class="isel" id="rl-parent">' + tOpts(r.parent) + '</select></div>' +
        '<div class="fw"><label>' + _t('父表字段', 'Parent Column') + '</label><select class="isel" id="rl-pcol">' + pOpts + '</select></div></div>' +
        '<div class="form-row"><div class="fw"><label>' + _t('基数', 'Cardinality') + '</label><select class="isel" id="rl-card">' +
        '<option value="1:N"' + (r.card === '1:N' ? ' selected' : '') + '>1 ∶ N' + _t('（一对多）', ' (one-to-many)') + '</option>' +
        '<option value="1:1"' + (r.card === '1:1' ? ' selected' : '') + '>1 ∶ 1' + _t('（一对一）', ' (one-to-one)') + '</option></select></div></div>';
    } else {
      body =
        '<div class="form-row"><div class="fw"><label>' + _t('起点表', 'From Table') + '</label><select class="isel" id="rl-from">' + tOpts(r.from) + '</select></div>' +
        '<div class="fw"><label>' + _t('终点表', 'To Table') + '</label><select class="isel" id="rl-to">' + tOpts(r.to) + '</select></div></div>' +
        '<div class="form-row"><div class="fw"><label>' + _t('关联说明（显示在连线上）', 'Label (shown on the relation)') + '</label><input class="itxt" id="rl-label" value="' + ERD.esc(r.label || '') + '"></div></div>';
    }
    body += '<div class="dock-sec" style="margin-top:18px"><h4>' + _t('操作', 'Actions') + '</h4><div style="display:flex;gap:8px">' +
      '<button class="btn danger" id="rl-del"><i class="ri-delete-bin-line"></i>' + _t('删除关系', 'Delete Relation') + '</button></div></div>';

    dockBody.innerHTML = '<div class="g-tip" style="margin-bottom:12px">' +
      (r.type === 'fk' ? '<i class="ri-link" style="color:var(--fk)"></i> ' + _t('物理外键关系', 'Physical FK relation') : '<i class="ri-link-unlink"></i> ' + _t('逻辑关联（无物理外键）', 'Logical relation (no physical FK)')) + '</div>' + body;

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
    g('rl-del').onclick = () => { ERD.store.removeRelation(r.id); toast(_t('已删除关系', 'Relation deleted'), 'ok'); };

    const head = document.getElementById('dock-head-info');
    const title = r.type === 'fk' ? (r.child + '.' + r.col + ' → ' + r.parent) : (r.from + ' ⇢ ' + r.to);
    head.innerHTML = '<b style="font-size:12.5px">' + ERD.esc(title) + '</b><small>' + (r.type === 'fk' ? _t('物理外键 · ', 'FK · ') + (r.card || '1:N') : _t('逻辑关联', 'Logical')) + '</small>';
    const hi = document.getElementById('dock-head-icon');
    hi.className = r.type === 'fk' ? 'ri-link' : 'ri-link-unlink';
    hi.style.color = r.type === 'fk' ? 'var(--fk)' : 'var(--dim)';
  }

  /* ---------- 新建关系弹窗 ---------- */
  function openRelationDialog(preset) {
    const p = ERD.store.state.p;
    const tOpts = sel => p.tables.map(t => '<option value="' + ERD.esc(t.key) + '"' + (t.key === sel ? ' selected' : '') + '>' + ERD.esc(t.key) + (t.cn ? ' · ' + ERD.esc(t.cn) : '') + '</option>').join('');
    const m = openModal(_t('新建关系', 'New Relation'), 'ri-links-line',
      '<div class="form-row"><div class="fw"><label>' + _t('关系类型', 'Relation Type') + '</label><select class="isel" id="nr-type">' +
      '<option value="fk">' + _t('物理外键（FK）', 'Physical FK') + '</option><option value="logical">' + _t('逻辑关联（虚线）', 'Logical (dashed)') + '</option></select>' +
      '<div class="fhint">' + _t('物理外键 = 子表字段引用父表；逻辑关联 = 无物理外键的业务关联', 'Physical FK = child column references the parent; Logical = business relation without FK') + '</div></div></div>' +
      '<div class="form-row" id="nr-fk-rows">' +
      '<div class="fw"><label>' + _t('子表（含外键的一侧）', 'Child (FK side)') + '</label><select class="isel" id="nr-child">' + tOpts(preset && preset.child) + '</select></div>' +
      '<div class="fw"><label>' + _t('外键字段', 'FK Column') + '</label><select class="isel" id="nr-col"></select></div></div>' +
      '<div class="form-row" id="nr-fk-rows2">' +
      '<div class="fw"><label>' + _t('父表（被引用）', 'Parent (referenced)') + '</label><select class="isel" id="nr-parent">' + tOpts(preset && preset.parent) + '</select></div>' +
      '<div class="fw"><label>' + _t('父表字段', 'Parent Column') + '</label><select class="isel" id="nr-pcol"></select></div></div>' +
      '<div class="form-row" id="nr-lg-row" style="display:none">' +
      '<div class="fw"><label>' + _t('起点表', 'From Table') + '</label><select class="isel" id="nr-from">' + tOpts(preset && preset.child) + '</select></div>' +
      '<div class="fw"><label>' + _t('终点表', 'To Table') + '</label><select class="isel" id="nr-to">' + tOpts(preset && preset.parent) + '</select></div></div>' +
      '<div class="form-row" id="nr-lg-label" style="display:none"><div class="fw"><label>' + _t('关联说明', 'Label') + '</label><input class="itxt" id="nr-label" placeholder="' + _t('如：多态关联 biz_type + biz_id', 'e.g. polymorphic biz_type + biz_id') + '"></div></div>',
      '<button class="btn" data-act="cancel">' + _t('取消', 'Cancel') + '</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>' + _t('创建', 'Create') + '</button>');

    const q = s => m.querySelector(s);
    function fillCols() {
      const ct = ERD.store.tableByKey(q('#nr-child').value);
      const pt = ERD.store.tableByKey(q('#nr-parent').value);
      const guess = pt ? (pt.key.replace(/^sys_/, '') + '_id').replace(/s$/, '') : '';
      /* 子表缺少 <父表>_id 时提供「自动创建」选项 */
      const hasGuess = !!(ct && ct.cols.some(c => c[0] === guess));
      const autoOpt = (pt && !hasGuess) ? '<option value="__auto__">' + _t('自动创建 ', 'Auto-create ') + guess + '</option>' : '';
      q('#nr-col').innerHTML = autoOpt + (ct ? ct.cols.filter(c => c[2] !== 'g').map(c =>
        '<option value="' + ERD.esc(c[0]) + '"' + (c[0] === guess ? ' selected' : '') + '>' + ERD.esc(c[0]) + '</option>').join('') : '');
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
        let col = q('#nr-col').value;
        const child = q('#nr-child').value, parent = q('#nr-parent').value;
        if (!child || !parent || !col) { toast(_t('请选择完整的表与字段', 'Please select the full table and column'), 'err'); return; }
        /* 自动创建外键字段：子表缺少 <父表>_id 时自动补一列 */
        if (col === '__auto__') {
          const ct = ERD.store.tableByKey(child);
          const pt = ERD.store.tableByKey(parent);
          const base = pt ? (pt.key.replace(/^sys_/, '') + '_id').replace(/s$/, '') : 'fk_id';
          const names = ct.cols.filter(c => c[2] !== 'g').map(c => c[0]);
          let name = base, n = 2;
          while (names.indexOf(name) >= 0) name = base + '_' + n++;
          const cols = ct.cols.map(c => c.slice());
          cols.push([name, 'bigint', '', '', false]);
          ERD.store.setColumns(child, cols, _t('自动补充外键字段', 'Auto-add FK column'));
          col = name;
        }
        if (child === parent && q('#nr-pcol').value === col) { toast(_t('自关联的外键字段与父字段不能相同', 'Self-referencing FK column cannot equal the parent column'), 'err'); return; }
        const r = ERD.store.addRelation({ type: 'fk', child, col, parent, parentCol: q('#nr-pcol').value, card: '1:N' });
        ERD.view.sel = { type: 'relation', id: r.id };
      } else {
        const from = q('#nr-from').value, to = q('#nr-to').value;
        if (!from || !to || from === to) { toast(_t('请选择两个不同的表', 'Please select two different tables'), 'err'); return; }
        const r = ERD.store.addRelation({ type: 'logical', from, to, label: q('#nr-label').value.trim() });
        ERD.view.sel = { type: 'relation', id: r.id };
      }
      closeModal();
      ERD.render.renderAll();
      toast(_t('关系已创建', 'Relation created'), 'ok');
      /* 连线模式连续创建：创建后保持连线模式，可直接继续选下一张子表 */
      if (preset && preset.fromConnect && ERD.interact && ERD.interact.setConnectMode) ERD.interact.setConnectMode(true);
    };
  }

  /* ---------- 删除表确认 ---------- */
  function confirmDeleteTable(key) {
    const t = ERD.store.tableByKey(key); if (!t) return;
    confirmDlg(_t('确认删除表 <b>' + ERD.esc(t.key) + '</b>（' + ERD.esc(t.cn || '') + '）？<br>其所有关系连线将一并删除。',
      'Delete table <b>' + ERD.esc(t.key) + '</b> (' + ERD.esc(t.cn || '') + ')?<br>All its relations will be removed too.'), () => {
      ERD.store.removeTable(key);
      toast(_t('已删除表 ', 'Deleted table ') + key, 'ok');
    }, _t('删除', 'Delete'));
  }

  /* ---------- 批量删除确认 ---------- */
  function confirmDeleteMany(keys) {
    const n = keys.length;
    const names = keys.slice(0, 3).map(k => {
      const t = ERD.store.tableByKey(k);
      return t ? ERD.esc(t.key) : ERD.esc(k);
    }).join(_t('、', ', ')) + (n > 3 ? _t(' 等', ' …') : '');
    confirmDlg(_t('确认删除所选 <b>' + n + '</b> 张表（' + names + '）？<br>其所有关系连线将一并删除，且不可恢复。',
      'Delete the selected <b>' + n + '</b> tables (' + names + ')?<br>All their relations will be removed permanently.'), () => {
      ERD.store.removeTables(keys);
      toast(_t('已删除 ', 'Deleted ') + n + _t(' 张表', ' tables'), 'ok');
    }, _t('删除', 'Delete'));
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
          '<input class="zname" value="' + ERD.esc(ERD.zoneLabel(z)) + '" data-act="name">' +
          '<span class="zcnt">' + n + _t(' 张表', ' tables') + '</span>' +
          '<button class="btn sm icon danger" data-act="delz" title="' + _t('删除域（表归入第一个域）', 'Delete zone (tables move to the first zone)') + '"><i class="ri-delete-bin-line"></i></button></div>';
      }).join('') + '<button class="btn" id="zn-add" style="width:100%;justify-content:center"><i class="ri-add-line"></i>' + _t('新增域', 'Add Zone') + '</button>';
    }
    const m = openModal(_t('业务域管理', 'Business Zones'), 'ri-stack-line', '<div id="zn-list">' + body() + '</div>',
      '<button class="btn" data-act="close">' + _t('关闭', 'Close') + '</button>');
    m.querySelector('[data-act=close]').onclick = closeModal;
    function rebind() {
      const list = m.querySelector('#zn-list');
      list.querySelectorAll('.zone-row').forEach(row => {
        const zk = row.dataset.z;
        row.querySelector('[data-act=color]').onchange = e => { ERD.store.updateZone(zk, { color: e.target.value }); refresh(); };
        row.querySelector('[data-act=name]').onchange = e => { ERD.store.updateZone(zk, { name: e.target.value.trim() || _t('未命名', 'Untitled') }); refresh(); };
        row.querySelector('[data-act=delz]').onclick = () => {
          const n = p.tables.filter(t => t.zone === zk).length;
          const go = () => { ERD.store.removeZone(zk); refresh(); };
          if (n) confirmDlg(_t('该域下还有 ' + n + ' 张表，删除后这些表将归入第一个域，确认？',
            'This zone has ' + n + ' tables. After deletion they will move to the first zone. Continue?'), go);
          else go();
        };
      });
      list.querySelector('#zn-add').onclick = () => {
        const palette = ['#7dcfff', '#bb9af7', '#e0af68', '#73daca', '#f7768e', '#7aa2f7', '#a9ce6c', '#ff9e64'];
        ERD.store.addZone(_t('新域', 'New Zone'), palette[p.zones.length % palette.length]);
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
    const zoneOpts = '<option value="">' + _t('未分组', 'Ungrouped') + '</option>' + p.zones.map(z =>
      '<option value="' + z.key + '">' + ERD.esc(ERD.zoneLabel(z)) + '</option>').join('');
    const cards = TPLS.map((tp, i) =>
      '<div class="tpl-card' + (i === 1 ? ' sel' : '') + '" data-tpl="' + tp.key + '">' +
      '<i class="' + tp.icon + '"></i><b>' + _t(tp.name.zh, tp.name.en) + '</b><small>' + _t(tp.desc.zh, tp.desc.en) + '</small>' +
      '<span class="tpl-cnt">' + tp.cols.filter(c => c[2] !== 'g').length + _t(' 字段', ' fields') + '</span></div>').join('');

    const m = openModal(_t('新建表', 'New Table'), 'ri-table-line',
      '<div class="form-row"><div class="fw"><label>' + _t('表名（英文）', 'Table Name (EN)') + '</label><input class="itxt mono" id="nt-key" placeholder="' + _t('如：order_main', 'e.g. order_main') + '" autocomplete="off"></div>' +
      '<div style="width:130px"><label>' + _t('中文名', 'Display Name') + '</label><input class="itxt" id="nt-cn" placeholder="' + _t('如：订单主表', 'e.g. Order') + '"></div></div>' +
      '<div class="form-row"><div class="fw"><label>' + _t('所属域', 'Zone') + '</label><select class="isel" id="nt-zone">' + zoneOpts + '</select></div></div>' +
      '<div class="form-row"><div class="fw"><label>' + _t('选择模板', 'Template') + '</label><div class="tpl-grid" id="nt-tpls">' + cards + '</div></div></div>',
      '<button class="btn" data-act="cancel">' + _t('取消', 'Cancel') + '</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>' + _t('创建', 'Create') + '</button>', true);
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
      if (!key) { toast(_t('请输入表名', 'Please enter a table name'), 'err'); q('#nt-key').focus(); return; }
      const tp = TPLS.find(x => x.key === q('#nt-tpls .tpl-card.sel').dataset.tpl) || TPLS[0];
      ERD.store.addTable({
        key: key, cn: q('#nt-cn').value.trim(), zone: q('#nt-zone').value,
        x: pos ? pos.x : undefined, y: pos ? pos.y : undefined,
        cols: tp.cols.map(c => [c[0], c[1], c[2], ERD.tCmt(c[3]), c[4]])
      });
      closeModal();
      ERD.render.renderAll();
      renderDock();
      const inp = document.getElementById('dk-key');
      if (inp) { inp.focus(); inp.select(); }
      toast(_t('表已创建，可继续编辑字段（回车快速加行）', 'Table created. Edit fields below (Enter to add a row)'), 'ok');
    }
  }

  /* ================= 工程弹窗 ================= */
  function dlgNewProject() {
    const m = openModal(_t('新建工程', 'New Project'), 'ri-folder-line',
      '<div class="form-row"><div class="fw"><label>' + _t('工程名称', 'Project Name') + '</label><input class="itxt" id="np-name" placeholder="' + _t('如：××系统数据库设计', 'e.g. Order System DB') + '"></div></div>' +
      '<div class="form-row"><div class="fw"><label>' + _t('描述', 'Description') + '</label><textarea class="itxtarea" id="np-desc" rows="2" placeholder="' + _t('可选', 'Optional') + '"></textarea></div></div>',
      '<button class="btn" data-act="cancel">' + _t('取消', 'Cancel') + '</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>' + _t('创建', 'Create') + '</button>');
    const q = s => m.querySelector(s);
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => {
      const name = q('#np-name').value.trim();
      if (!name) { toast(_t('请输入工程名称', 'Please enter a project name'), 'err'); return; }
      ERD.store.create(name, q('#np-desc').value.trim());
      closeModal(); ERD.render.renderAll(); ERD.render.fit();
      toast(_t('工程已创建，开始添加表吧', 'Project created. Start adding tables.'), 'ok');
    };
    setTimeout(() => q('#np-name').focus(), 50);
  }
  function dlgRenameProject() {
    const p = ERD.store.state.p;
    const m = openModal(_t('重命名工程', 'Rename Project'), 'ri-edit-line',
      '<div class="form-row"><div class="fw"><label>' + _t('工程名称', 'Project Name') + '</label><input class="itxt" id="rn-name" value="' + ERD.esc(p.name) + '"></div></div>' +
      '<div class="form-row"><div class="fw"><label>' + _t('描述', 'Description') + '</label><textarea class="itxtarea" id="rn-desc" rows="2">' + ERD.esc(p.description || '') + '</textarea></div></div>',
      '<button class="btn" data-act="cancel">' + _t('取消', 'Cancel') + '</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>' + _t('保存', 'Save') + '</button>');
    const q = s => m.querySelector(s);
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => {
      ERD.store.rename(p.id, q('#rn-name').value.trim() || p.name, q('#rn-desc').value.trim());
      closeModal(); toast(_t('已保存', 'Saved'), 'ok');
    };
  }

  /* ================= 导入弹窗 ================= */
  function dlgImport() {
    const m = openModal(_t('导入数据', 'Import Data'), 'ri-upload-2-line',
      '<div class="drop-zone" id="imp-drop"><i class="ri-upload-2-line"></i>' + _t('点击选择文件，或将文件拖拽到此处', 'Click to choose a file, or drag & drop it here') + '<br><span style="font-size:10.5px;color:var(--dimmer)">' + _t('支持 .json（本平台工程）/ .sql / .ddl（CREATE TABLE 脚本）', 'Supports .json (this app) / .sql / .ddl (CREATE TABLE scripts)') + '</span></div>' +
      '<input type="file" id="imp-file" accept=".json,.sql,.ddl,.txt" style="display:none">' +
      '<div class="form-row" style="margin-bottom:8px"><div class="fw"><label>' + _t('或粘贴 SQL / JSON 文本', 'Or paste SQL / JSON text') + '</label><textarea id="imp-text" placeholder="CREATE TABLE xxx (...);"></textarea></div></div>' +
      '<div class="imp-opts">' + _t('导入方式：', 'Import mode:') + '<label><input type="radio" name="imp-mode" value="new" checked>' + _t('新建工程', 'New project') + '</label>' +
      '<label><input type="radio" name="imp-mode" value="merge">' + _t('合并到当前工程', 'Merge into current') + '</label></div>' +
      '<div class="fhint" id="imp-info" style="margin-top:10px"></div>',
      '<button class="btn" data-act="cancel">' + _t('取消', 'Cancel') + '</button><button class="btn primary" data-act="ok"><i class="ri-check-line"></i>' + _t('导入', 'Import') + '</button>', true);
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
        ? '<i class="ri-checkbox-circle-line" style="color:var(--green)"></i> ' + _t('识别为 ', 'Detected as ') + (r.kind === 'project' ? _t('工程 JSON', 'Project JSON') : 'SQL DDL') +
          _t('：', ': ') + tb.length + _t(' 张表 / ', ' tables / ') + rl.length + _t(' 条关系', ' relations') + (zs && zs.length ? ' / ' + zs.length + _t(' 个域', ' zones') : '')
        : '<i class="ri-error-warning-line" style="color:var(--rose)"></i> ' + ERD.esc(r.error || _t('无法识别的格式', 'Unrecognized format'));
    }
    q('#imp-text').addEventListener('change', () => preview());
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=ok]').onclick = () => {
      const text = pendingText || q('#imp-text').value;
      if (!text.trim()) { toast(_t('请选择文件或粘贴内容', 'Choose a file or paste content first'), 'err'); return; }
      const mode = m.querySelector('input[name=imp-mode]:checked').value;
      const r = ERD.io.parseAuto(text);
      if (!r.ok) { toast(r.error || _t('无法识别', 'Unrecognized'), 'err'); return; }
      const done = ERD.io.importData(r, mode);
      if (done) { closeModal(); ERD.render.renderAll(); ERD.render.fit(); }
    };
  }

  /* ================= 类型库管理 ================= */
  function dlgTypes() {
    const m = openModal(_t('类型库管理', 'Type Library'), 'ri-braces-line',
      '<div class="fhint" style="margin-bottom:10px">' + _t('自定义类型保存在本浏览器（localStorage），会自动并入字段「类型」输入框的候选列表；内置类型不可删除。', 'Custom types are stored in this browser (localStorage) and merged into the type candidates; built-in types cannot be removed.') + '</div>' +
      '<div class="g-tip" style="margin-bottom:8px;color:var(--dim)">' + _t('内置：', 'Built-in: ') + ERD.types.BUILTIN.slice(0, 10).join(' / ') + ' …' + _t('（共 ', ' (') + ERD.types.BUILTIN.length + _t(' 种）', ')') + '</div>' +
      '<div id="tp-list"></div>' +
      '<div class="form-row" style="margin-top:12px;margin-bottom:6px;align-items:flex-end">' +
      '<div class="fw"><label>' + _t('新增自定义类型', 'Add Custom Type') + '</label><input class="itxt mono" id="tp-add" placeholder="' + _t('如：decimal(12,4) / inet / citext', 'e.g. decimal(12,4) / inet / citext') + '" autocomplete="off"></div>' +
      '<button class="btn primary" id="tp-btn"><i class="ri-add-line"></i>' + _t('添加', 'Add') + '</button></div>',
      '<button class="btn" data-act="cancel">' + _t('关闭', 'Close') + '</button>');
    const q = s => m.querySelector(s);
    function body() {
      const extra = ERD.types.extra();
      if (!extra.length) return '<div class="g-tip">' + _t('暂无自定义类型', 'No custom types yet') + '</div>';
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
          refresh(); toast(_t('已删除类型 ', 'Removed type ') + t, 'ok');
        };
      });
    }
    function addOne() {
      const v = q('#tp-add').value.trim();
      if (!v) { toast(_t('请输入类型名', 'Please enter a type name'), 'warn'); return; }
      if (!ERD.types.add(v)) { toast(_t('类型已存在或为空', 'Type already exists or is empty'), 'warn'); return; }
      q('#tp-add').value = '';
      refresh(); toast(_t('已添加类型 ', 'Added type ') + v, 'ok');
    }
    q('[data-act=cancel]').onclick = closeModal;
    q('#tp-btn').onclick = addOne;
    q('#tp-add').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } });
    refresh();
    setTimeout(() => q('#tp-add').focus(), 50);
  }

  /* ================= 字段类型自定义下拉 ================= */
  function typePanelClose() {
    if (tpEl) { tpEl.remove(); tpEl = null; }
  }
  function typePanelOpen(input) {
    if (!input) return;
    typePanelClose();
    const q = (input.value || '').trim().toLowerCase();
    const cur = input.value;
    const el = document.createElement('div');
    el.className = 'tp-panel';
    let html = '';
    TYPE_GROUPS.forEach(g => {
      const list = g.types.filter(t => !q || t.toLowerCase().includes(q));
      if (!list.length) return;
      html += '<div class="tp-group">' + ERD.esc(g.name) + '</div>' +
        list.map(t => '<div class="tp-opt' + (t === cur ? ' sel' : '') + '" data-t="' + ERD.esc(t) + '">' + ERD.esc(t) + '</div>').join('');
    });
    const custom = ERD.types.extra();
    const cl = custom.filter(t => !q || t.toLowerCase().includes(q));
    if (cl.length) {
      html += '<div class="tp-group">' + _t('自定义', 'Custom') + '</div>' +
        cl.map(t => '<div class="tp-opt' + (t === cur ? ' sel' : '') + '" data-t="' + ERD.esc(t) + '">' + ERD.esc(t) + '</div>').join('');
    }
    if (!html) html = '<div class="tp-empty">' + _t('无匹配，可直接输入类型', 'No match — type it yourself') + '</div>';
    el.innerHTML = html;
    document.body.appendChild(el);
    /* 定位（fixed 相对视口），空间不足向上展开 */
    const r = input.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(r.left, window.innerWidth - el.offsetWidth - 8)) + 'px';
    el.style.top = (r.bottom + 4) + 'px';
    if (r.bottom + 4 + el.offsetHeight > window.innerHeight - 8 && r.top - el.offsetHeight - 4 > 8) {
      el.style.top = (r.top - el.offsetHeight - 4) + 'px';
    }
    /* 点击选项（mousedown 先于 blur，preventDefault 保持焦点避免误提交） */
    el.addEventListener('mousedown', e => {
      const opt = e.target.closest('.tp-opt'); if (!opt) return;
      e.preventDefault();
      input.value = opt.dataset.t;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      typePanelClose();
      input.focus();
    });
    tpEl = el;
  }

  /* ================= 常用字段管理 ================= */
  function appendQuickField(t, f) {
    if (!t || !f) return;
    const cols = t.cols.map(c => c.slice());
    if (cols.some(c => c[0] === f.name)) { toast(_t('字段 ', 'Column ') + f.name + _t(' 已存在', ' already exists'), 'warn'); return; }
    cols.push([f.name, f.type, f.flag || '', ERD.tCmt(f.cmt), !!f.nn]);
    ERD.store.setColumns(t.key, cols, '追加常用字段');
    renderDock();
    toast(_t('已添加 ', 'Added ') + f.name, 'ok');
  }

  function dlgQuickFields() {
    const m = openModal(_t('常用字段管理', 'Quick Fields Manager'), 'ri-tools-line',
      '<div class="fhint" style="margin-bottom:10px">' + _t('自定义常用字段保存在本浏览器（localStorage），可在属性面板「常用字段」菜单中一键追加；内置字段不可删除。', 'Custom quick fields are stored in this browser (localStorage) and appear in the "Quick Fields" menu; built-in fields cannot be removed.') + '</div>' +
      '<div class="dock-sec"><h4>' + _t('内置', 'Built-in') + '（' + ERD.quick.BUILTIN.length + '）</h4>' +
      '<div class="g-tip" style="color:var(--dim)">' + ERD.quick.BUILTIN.map(f => f.name).join(' / ') + '</div></div>' +
      '<div class="dock-sec"><h4>' + _t('自定义', 'Custom') + '</h4><div id="qf-list"></div></div>' +
      '<div class="dock-sec"><h4>' + _t('新增常用字段', 'Add Quick Field') + '</h4>' +
      '<div class="form-row" style="align-items:flex-end">' +
      '<div class="fw"><label>' + _t('字段名', 'Name') + '</label><input class="itxt mono" id="qf-name" placeholder="mobile" autocomplete="off"></div>' +
      '<div class="fw"><label>' + _t('类型', 'Type') + '</label><input class="itxt mono" id="qf-type" placeholder="varchar(50)"></div>' +
      '<div class="fw"><label>' + _t('说明', 'Comment') + '</label><input class="itxt" id="qf-cmt" placeholder="' + _t('显示名', 'Display name') + '"></div>' +
      '</div>' +
      '<div class="form-row" style="align-items:flex-end;margin-top:6px">' +
      '<div style="width:120px"><label>' + _t('标记', 'Flag') + '</label><select class="isel" id="qf-flag">' +
      '<option value="">' + _t('无', 'None') + '</option><option value="pk">PK</option><option value="uk">UK</option><option value="idx">IDX</option></select></div>' +
      '<label style="display:flex;align-items:center;gap:5px;height:30px"><input type="checkbox" id="qf-nn"> ' + _t('非空 NOT NULL', 'Not null') + '</label>' +
      '<button class="btn primary" id="qf-add"><i class="ri-add-line"></i>' + _t('添加', 'Add') + '</button>' +
      '</div></div>',
      '<button class="btn" data-act="cancel">' + _t('关闭', 'Close') + '</button>');
    const q = s => m.querySelector(s);
    function body() {
      const extra = ERD.quick.extra();
      if (!extra.length) return '<div class="g-tip">' + _t('暂无自定义字段', 'No custom fields yet') + '</div>';
      return extra.map(f => '<div class="zone-row" data-n="' + ERD.esc(f.name) + '">' +
        '<code style="flex:1;font-size:12px">' + ERD.esc(f.name) + '</code>' +
        '<span style="color:var(--dim);font-size:11px;margin-right:10px">' + ERD.esc(f.type) + (f.flag ? ' · ' + f.flag.toUpperCase() : '') + (f.nn ? ' · ✱' : '') + '</span>' +
        '<button class="btn sm danger" data-act="del"><i class="ri-delete-bin-line"></i></button></div>').join('');
    }
    function refresh() { q('#qf-list').innerHTML = body(); rebind(); }
    function rebind() {
      q('#qf-list').querySelectorAll('[data-act=del]').forEach(b => {
        b.onclick = () => {
          const name = b.closest('[data-n]').dataset.n;
          ERD.quick.remove(name);
          refresh(); toast(_t('已删除字段 ', 'Removed column ') + name, 'ok');
        };
      });
    }
    function addOne() {
      const name = q('#qf-name').value.trim();
      if (!name) { toast(_t('请输入字段名', 'Please enter a column name'), 'warn'); return; }
      const ok = ERD.quick.add({ name, type: q('#qf-type').value.trim(), cmt: q('#qf-cmt').value.trim(), flag: q('#qf-flag').value, nn: q('#qf-nn').checked });
      if (!ok) { toast(_t('字段已存在或为空', 'Column already exists or is empty'), 'warn'); return; }
      q('#qf-name').value = ''; q('#qf-type').value = ''; q('#qf-cmt').value = ''; q('#qf-flag').value = ''; q('#qf-nn').checked = false;
      refresh(); toast(_t('已添加字段 ', 'Added column ') + name, 'ok');
      q('#qf-name').focus();
    }
    q('[data-act=cancel]').onclick = closeModal;
    q('#qf-add').onclick = addOne;
    q('#qf-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } });
    /* 类型输入复用自定义下拉 */
    const qfType = q('#qf-type');
    qfType.addEventListener('focus', () => typePanelOpen(qfType));
    qfType.addEventListener('input', () => typePanelOpen(qfType));
    qfType.addEventListener('focusout', () => setTimeout(typePanelClose, 0));
    qfType.addEventListener('keydown', e => { if (e.key === 'Escape') typePanelClose(); });
    refresh();
    setTimeout(() => q('#qf-name').focus(), 50);
  }

  /* ================= 分享链接内容打开方式 ================= */
  function dlgShareOpen(parsed) {
    const tb = parsed.kind === 'project' ? parsed.project.tables.length : parsed.tables.length;
    const rl = parsed.kind === 'project' ? parsed.project.relations.length : parsed.relations.length;
    const name = parsed.kind === 'project' ? (parsed.project.name || '') : _t('SQL 结构', 'SQL Schema');
    const m = openModal(_t('打开分享内容', 'Open Shared Content'), 'ri-link',
      '<div class="confirm-msg">' + _t('识别到来自链接的工程内容：', 'Detected project content from the link: ') + '<b>' + ERD.esc(name) + '</b>' + _t('（', ' (') + tb + _t(' 表 / ', ' tables / ') + rl + _t(' 关系）。', ' relations).') + '<br>' + _t('请选择打开方式：', 'Choose how to open:') + '</div>',
      '<button class="btn" data-act="cancel">' + _t('取消', 'Cancel') + '</button>' +
      '<button class="btn" data-act="merge"><i class="ri-merge-cells-horizontal"></i>' + _t('合并到当前工程', 'Merge into current') + '</button>' +
      '<button class="btn primary" data-act="new"><i class="ri-file-add-line"></i>' + _t('作为新工程打开', 'Open as new project') + '</button>');
    const q = s => m.querySelector(s);
    const open = mode => {
      ERD.io.importData(parsed, mode);
      closeModal();
      ERD.render.renderAll(); ERD.render.fit();
      toast(mode === 'new' ? _t('已作为新工程打开分享内容', 'Opened shared content as a new project') : _t('已合并分享内容到当前工程', 'Merged shared content into the current project'), 'ok');
    };
    q('[data-act=cancel]').onclick = closeModal;
    q('[data-act=new]').onclick = () => open('new');
    q('[data-act=merge]').onclick = () => open('merge');
  }

  /* ================= 帮助 ================= */
  function dlgHelp() {
    const body = _t(
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
      '· 「常用字段」菜单一键追加 手机号/邮箱/状态/金额 等高频字段，可自定义（⚙ 管理）<br>' +
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
      '· 「工具」菜单可切换界面语言：简体中文 / English。</div></div>',
      '<div class="dock-sec"><h4>Canvas</h4><div class="g-tip" style="line-height:2.2">' +
      '· Drag empty canvas to pan, wheel to zoom, F to fit window<br>' +
      '· Click a table card to focus its relations; double-click to fold/expand<br>' +
      '· <b>Ctrl/Cmd+Click</b> multi-select, <b>Shift+Drag</b> marquee-select; drag the group together<br>' +
      '· Right-click on a multi-selection: fold/expand, <b>align & even distribute</b>, move to zone, bulk delete<br>' +
      '· <b>Double-click empty canvas: quick new table</b>; drag cards to arrange (4px grid snap)<br>' +
      '· <b>Mini-map</b> (bottom-left): click/drag to jump the view<br>' +
      '· <b>Right-click</b> opens context menus on canvas / tables / columns / relations<br>' +
      '· Click a relation to select & edit; Delete removes the selected table/relation</div></div>' +
      '<div class="dock-sec"><h4>Fast Modeling</h4><div class="g-tip" style="line-height:2.2">' +
      '· New table offers 7 templates (press N)<br>' +
      '· <b>Enter</b> in a column inserts a new row below; press repeatedly to add columns fast<br>' +
      '· <b>Paste multi-line text</b> in the name box to batch-add columns: one line per "name type comment"<br>' +
      '· "Quick Fields" menu adds phone/email/status/amount etc.; customizable via ⚙<br>' +
      '· Ctrl+C / Ctrl+V copy & paste tables · Ctrl+D quick duplicate</div></div>' +
      '<div class="dock-sec"><h4>Shortcuts</h4><div class="g-tip" style="line-height:2.2">' +
      'N new table · L toggle logical relations · A auto layout · F fit window · +/- zoom<br>' +
      'Ctrl+Z undo · Ctrl+Y redo · Ctrl+F search · Ctrl+S save · Esc cancel/close</div></div>' +
      '<div class="dock-sec"><h4>Storage</h4><div class="g-tip" style="line-height:2.2">' +
      'Pure frontend, no backend. All data auto-saves in <b>browser localStorage</b> (this browser only).<br>' +
      'Back up important projects regularly via "Export → Project JSON"; import to restore on another machine/browser.<br>' +
      '"Export → SQL" supports 8 dialects: PostgreSQL / MySQL / MariaDB / SQLite / SQL Server / Oracle / DaMeng DM / KingbaseES.</div></div>' +
      '<div class="dock-sec"><h4>Files / Share / PWA</h4><div class="g-tip" style="line-height:2.2">' +
      '· "File" menu: open/save local <b>.erd / .json</b> files (Ctrl+S syncs to the file);<br>' +
      '· "Copy Share Link": encodes the project into the URL; open the link to load it (use JSON for long links);<br>' +
      '· Installable as <b>PWA</b>: on HTTPS / localhost use the browser "Install app" to work offline.<br>' +
      '· "Tools" menu switches UI language: 简体中文 / English.</div></div>'
    ) + '<div class="dock-sec"><h4>' + _t('关于', 'About') + '</h4><div class="g-tip" style="line-height:2.2">' +
      ERD.esc(OSS.name) + ' · v' + ERD.VERSION + ' · ' + _t('开源', 'Open Source') + '（' + OSS.license + '）<br>' +
      _t('数据仅存浏览器本地，无后端、无账号、无遥测。', 'Data stays in your browser only; no backend, no accounts, no telemetry.') + '<br>' +
      _t('图标：Remix Icon（Apache-2.0，本地内置）；支持离线 / 内网 / 云 / Docker 部署。', 'Icons: Remix Icon (Apache-2.0, bundled locally); offline / intranet / cloud / Docker ready.') + '<br>' +
      '<a href="' + OSS.github + '" target="_blank" rel="noopener" style="color:var(--accent)">GitHub</a> · <a href="' + OSS.gitee + '" target="_blank" rel="noopener" style="color:var(--accent)">Gitee</a></div></div>';
    const m = openModal(_t('使用帮助与关于', 'Help & About'), 'ri-question-line', body,
      '<button class="btn" data-act="log">' + _t('更新日志', 'Changelog') + '</button>' +
      '<button class="btn" data-act="about">' + _t('关于', 'About') + '</button>' +
      '<button class="btn primary" data-act="close">' + _t('知道了', 'Got it') + '</button>');
    m.querySelector('[data-act=close]').onclick = closeModal;
    m.querySelector('[data-act=log]').onclick = () => { closeModal(); dlgChangelog(); };
    m.querySelector('[data-act=about]').onclick = () => { closeModal(); dlgAbout(); };
  }

  /* ================= 开源 / 关于 / 更新日志 / 欢迎页 ================= */
  function dlgChangelog() {
    const rows = CHANGELOG.map(c =>
      '<div class="cl-item"><b class="cl-v">v' + ERD.esc(c.v) + '</b>' + (c.date ? '<span class="cl-d">' + ERD.esc(c.date) + '</span>' : '') +
      '<ul>' + c.items.map(it => '<li>' + ERD.esc(_t(it.zh, it.en)) + '</li>').join('') + '</ul></div>'
    ).join('');
    const m = openModal(_t('更新日志', 'Changelog'), 'ri-list-ordered',
      '<div class="cl-list">' + rows + '</div>',
      '<button class="btn primary" data-act="close">' + _t('知道了', 'Got it') + '</button>', true);
    m.querySelector('[data-act=close]').onclick = closeModal;
  }

  function dlgAbout() {
    const m = openModal(_t('关于', 'About'), 'ri-information-line',
      '<div class="ab-hero"><i class="ri-flow-chart"></i><div><b>' + ERD.esc(OSS.name) + '</b><span class="ab-ver">v' + ERD.VERSION + '</span>' +
      '<div class="ab-tag">' + ERD.esc(OSS.tagline) + '</div></div></div>' +
      '<div class="g-tip" style="margin:2px 0 14px">' +
      _t('一个开源的数据库 ER 图在线设计平台：无后端、无第三方运行时依赖，可离线使用，支持私有化 / 云 / Docker 部署。', 'An open-source online database ER diagram designer: no backend, no third-party runtime deps, works offline, self-hostable / cloud / Docker.') +
      '</div>' +
      '<div class="dock-sec"><h4>' + _t('开源信息', 'Open Source') + '</h4><div class="g-tip" style="line-height:2">' +
      '· ' + _t('代码开源协议：', 'Code license: ') + '<b>MIT</b><br>' +
      '· ' + _t('图标：Remix Icon（Apache-2.0，本地内置）', 'Icons: Remix Icon (Apache-2.0, bundled locally)') + '<br>' +
      '· ' + _t('版本：', 'Version: ') + 'v' + ERD.VERSION + '<br>' +
      '· ' + _t('纯前端、零依赖，数据仅存于浏览器本地', 'Pure frontend & zero-dependency; data stays in your browser') + '</div></div>' +
      '<div class="ab-links">' +
      '<button class="btn" data-act="gh"><i class="ri-git-branch-line"></i>GitHub</button>' +
      '<button class="btn" data-act="gee"><i class="ri-book-2-line"></i>Gitee</button>' +
      '<button class="btn" data-act="issue"><i class="ri-error-warning-line"></i>' + _t('反馈 / Issue', 'Feedback / Issues') + '</button>' +
      '<button class="btn" data-act="log"><i class="ri-list-ordered"></i>' + _t('更新日志', 'Changelog') + '</button>' +
      '</div>',
      '<button class="btn primary" data-act="close">' + _t('知道了', 'Got it') + '</button>', true);
    m.querySelector('[data-act=close]').onclick = closeModal;
    m.querySelector('[data-act=gh]').onclick = () => openRepo(OSS.github);
    m.querySelector('[data-act=gee]').onclick = () => openRepo(OSS.gitee);
    m.querySelector('[data-act=issue]').onclick = () => openRepo(OSS.issues);
    m.querySelector('[data-act=log]').onclick = () => { closeModal(); dlgChangelog(); };
  }

  function dlgContributing() {
    const body =
      '<div class="g-tip" style="line-height:2;margin-bottom:12px">' +
      _t('欢迎参与 Aneiang ERD Studio 的开源共建！任何反馈、建议与代码贡献都非常欢迎。', 'Welcome to contribute to Aneiang ERD Studio! Any feedback, suggestions and code contributions are appreciated.') +
      '</div>' +
      '<div class="dock-sec"><h4>' + _t('如何贡献', 'How to contribute') + '</h4><div class="g-tip" style="line-height:2.2">' +
      '· ' + _t('提 Issue / 建议：说明使用场景与复现步骤', 'Report issues / ideas: describe the scenario and repro steps') + '<br>' +
      '· ' + _t('提交 PR：Fork 仓库 → 新建分支 → 修改 → Pull Request', 'Submit a PR: fork the repo → new branch → make changes → pull request') + '<br>' +
      '· ' + _t('翻译：新增界面文案请同时提供中 / 英文', 'Translate: provide both Chinese & English for new UI strings') + '</div></div>' +
      '<div class="dock-sec"><h4>' + _t('开发约定', 'Conventions') + '</h4><div class="g-tip" style="line-height:2.2">' +
      '· ' + _t('纯原生 HTML/CSS/JS，零依赖、零构建', 'Vanilla HTML/CSS/JS: zero dependency & zero build') + '<br>' +
      '· ' + _t('修改后请运行 node test/smoke.test.js 冒烟测试', 'Run node test/smoke.test.js after changes') + '<br>' +
      '· ' + _t('项目以 MIT 协议开源', 'The project is released under the MIT license') + '</div></div>' +
      '<div class="ab-links">' +
      '<button class="btn" data-act="repo"><i class="ri-git-branch-line"></i>GitHub</button>' +
      '<button class="btn" data-act="issue"><i class="ri-error-warning-line"></i>' + _t('反馈 / Issue', 'Feedback / Issues') + '</button>' +
      '</div>';
    const m = openModal(_t('参与贡献', 'Contributing'), 'ri-user-3-line', body,
      '<button class="btn primary" data-act="close">' + _t('知道了', 'Got it') + '</button>', true);
    m.querySelector('[data-act=close]').onclick = closeModal;
    m.querySelector('[data-act=repo]').onclick = () => openRepo(OSS.github);
    m.querySelector('[data-act=issue]').onclick = () => openRepo(OSS.issues);
  }

  function dlgPrivacy() {
    const body =
      '<div class="dock-sec"><h4>' + _t('数据存储', 'Data storage') + '</h4><div class="g-tip" style="line-height:2.2">' +
      '· ' + _t('所有工程数据仅保存在当前浏览器的 localStorage 中', 'All project data is stored only in your browser’s localStorage') + '<br>' +
      '· ' + _t('另有 IndexedDB 救援镜像，意外丢失时自动找回', 'An IndexedDB rescue mirror auto-recovers projects after unexpected loss') + '<br>' +
      '· ' + _t('数据与浏览器 Profile 绑定，请定期「导出 → 工程 JSON」备份', 'Data is bound to the browser profile; back up via "Export → Project JSON" regularly') + '</div></div>' +
      '<div class="dock-sec"><h4>' + _t('无遥测', 'No telemetry') + '</h4><div class="g-tip" style="line-height:2.2">' +
      '· ' + _t('本项目无后端、无账号、无第三方统计与遥测', 'No backend, no accounts, no third-party analytics or telemetry') + '<br>' +
      '· ' + _t('界面图标为本地内置的 Remix Icon（Apache-2.0）', 'Icons are locally bundled Remix Icon (Apache-2.0)') + '<br>' +
      '· ' + _t('断网 / 内网 / 离线环境完全可用', 'Fully usable offline / intranet / air-gapped') + '</div></div>';
    const m = openModal(_t('隐私与数据', 'Privacy & Data'), 'ri-eye-off-line', body,
      '<button class="btn primary" data-act="close">' + _t('知道了', 'Got it') + '</button>');
    m.querySelector('[data-act=close]').onclick = closeModal;
  }

  /* PWA 新版本已就绪：刷新应用 */
  function confirmUpdate() {
    confirmDlg(
      _t('检测到新版本，刷新页面即可体验最新功能。', 'A new version is ready. Reload to enjoy the latest features.'),
      () => location.reload(),
      _t('立即刷新', 'Reload now')
    );
  }

  function showWelcome() {
    const feats = [
      ['ri-table-line', _t('可视化建模', 'Visual modeling')],
      ['ri-links-line', _t('物理外键 / 逻辑关联', 'Physical FK / logical relations')],
      ['ri-file-code-line', _t('SQL 导入 · 8 方言导出', 'SQL import · 8 dialects export')],
      ['ri-image-line', _t('PNG / SVG / Mermaid', 'PNG / SVG / Mermaid')],
      ['ri-database-2-line', _t('数据字典 Excel', 'XLSX dictionary')],
      ['ri-tools-line', _t('6 主题 · 自动布局 · PWA', '6 themes · auto layout · PWA')]
    ];
    const featsHtml = feats.map(f =>
      '<div class="wl-feat"><i class="' + f[0] + '"></i><span>' + ERD.esc(f[1]) + '</span></div>').join('');
    const m = openModal(_t('欢迎使用', 'Welcome'), 'ri-flow-chart',
      '<div class="wl-hero"><i class="ri-flow-chart"></i><div><b>' + ERD.esc(OSS.name) + '</b><span class="ab-ver">v' + ERD.VERSION + '</span>' +
      '<div class="ab-tag">' + ERD.esc(OSS.tagline) + '</div></div></div>' +
      '<div class="wl-feats">' + featsHtml + '</div>' +
      '<div class="wl-actions">' +
      '<button class="btn primary" data-act="newproj"><i class="ri-add-circle-line"></i>' + _t('新建工程', 'New Project') + '</button>' +
      '<button class="btn" data-act="newtable"><i class="ri-add-line"></i>' + _t('新建表', 'New Table') + '</button>' +
      '<button class="btn" data-act="import"><i class="ri-upload-2-line"></i>' + _t('导入 SQL / JSON', 'Import SQL / JSON') + '</button>' +
      '<button class="btn" data-act="sample"><i class="ri-database-2-line"></i>' + _t('载入演示示例', 'Load Sample') + '</button>' +
      '<button class="btn" data-act="open"><i class="ri-folder-open-line"></i>' + _t('打开本地文件', 'Open Local File') + '</button>' +
      '</div>' +
      '<div class="ab-links">' +
      '<a href="' + OSS.github + '" target="_blank" rel="noopener"><i class="ri-git-branch-line"></i>GitHub</a>' +
      '<a href="' + OSS.gitee + '" target="_blank" rel="noopener"><i class="ri-book-2-line"></i>Gitee</a>' +
      '</div>',
      '<button class="btn" data-act="log"><i class="ri-list-ordered"></i>' + _t('更新日志', 'Changelog') + '</button>' +
      '<button class="btn" data-act="about"><i class="ri-information-line"></i>' + _t('关于', 'About') + '</button>' +
      '<button class="btn primary" data-act="close">' + _t('开始使用', 'Get Started') + '</button>', true);
    /* 欢迎页：仅「开始使用」可关闭；刷新不会跳过（标记在点击开始使用时才写入） */
    welcomeLock = true;
    m.querySelector('.close').style.display = 'none';   // 隐藏右上角 ×，只保留「开始使用」
    m.querySelector('[data-act=close]').onclick = () => {
      try { localStorage.setItem('erd.welcome.v1', '1'); } catch (e) { /* ignore */ }
      welcomeLock = false;
      closeModal();
    };
    m.querySelector('[data-act=newproj]').onclick = () => { welcomeLock = false; closeModal(); dlgNewProject(); };
    m.querySelector('[data-act=newtable]').onclick = () => { welcomeLock = false; closeModal(); dlgNewTable(); };
    m.querySelector('[data-act=import]').onclick = () => { welcomeLock = false; closeModal(); dlgImport(); };
    m.querySelector('[data-act=sample]').onclick = () => { welcomeLock = false; closeModal(); loadSample(); };
    m.querySelector('[data-act=open]').onclick = () => { welcomeLock = false; closeModal(); ERD.io.openLocalFile(); };
    m.querySelector('[data-act=log]').onclick = () => { welcomeLock = false; closeModal(); dlgChangelog(); };
    m.querySelector('[data-act=about]').onclick = () => { welcomeLock = false; closeModal(); dlgAbout(); };
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
    toast(_t('已按业务域自动排列', 'Arranged by zone automatically'), 'ok');
  }

  return { init, toast, confirm: confirmDlg, confirmDeleteTable, confirmDeleteMany, openRelationDialog, renderDock, autoLayout, dlgImport, loadSample, dlgNewTable, dlgNewProject, focusTable, dlgTypes, dlgShareOpen, dlgHelp, dlgAbout, dlgChangelog, dlgContributing, dlgPrivacy, confirmUpdate, showWelcome };
})();
