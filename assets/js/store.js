/* ================================================================
   Aneiang ERD Studio · store.js
   全局命名空间 / 事件总线 / 视图状态 / 数据模型 / localStorage 持久化 / 撤销重做
   ================================================================ */
var ERD = window.ERD = window.ERD || {};

/* ---------- 常量 ---------- */
ERD.CARD_W = 252;   // 表卡片宽度
ERD.ROW_H = 16.5;   // 字段行高
ERD.HEAD_H = 45;    // 卡片头高度（两行：表名行 + 元信息行）
ERD.FLAGS = ['', 'pk', 'fk', 'uk', 'idx'];
ERD.CARDS = { '1:N': '1:N', '1:1': '1:1', 'N:N': 'N:N' };

/* ---------- 卡片几何（渲染 / 连线锚点 / 导出共用） ---------- */
ERD.cardW = function () { return ERD.CARD_W; };
ERD.tableH = function (t) {
  if (!t || t.fold) return ERD.HEAD_H;   // 折叠后仅剩两行表头
  return ERD.HEAD_H + (t.cols ? t.cols.length : 0) * ERD.ROW_H;
};
/* 字段锚点：返回 {x, y}；折叠或未命中时取卡片中部 */
ERD.colPos = function (t, colName) {
  let idx = -1;
  if (t && t.cols) t.cols.forEach((c, i) => { if (c[0] === colName && idx < 0) idx = i; });
  if (!t || idx < 0 || t.fold) return { x: t ? t.x + ERD.cardW(t) / 2 : 0, y: t ? t.y + ERD.tableH(t) / 2 : 0 };
  return { x: t.x + ERD.CARD_W / 2, y: t.y + ERD.HEAD_H + idx * ERD.ROW_H + ERD.ROW_H / 2 };
};

/* ---------- 工具 ---------- */
ERD.uid = (function () {
  let n = Math.floor(Math.random() * 0xffff);
  return function (p) { n = (n + 1) & 0xffffff; return (p || '') + '_' + Date.now().toString(36) + n.toString(36); };
})();
ERD.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
};
/* 颜色值校验：仅接受 hex / rgb() / hsl() 形式，防止注入内联样式 */
ERD.safeColor = function (c) {
  const s = String(c == null ? '' : c).trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[\d\s.,%]*\)$/.test(s)) return s;
  return '#7aa2f7';
};
/* 域显示名：默认域（核心域/扩展域，未改名前）跟随界面语言，改名的域显示自定义名 */
ERD.zoneLabel = function (z) {
  const T = (typeof _t === 'function') ? _t : (zh => zh);
  if (!z) return T('未分组', 'Ungrouped');
  if (z.key === 'z_core' && z.name === '核心域') return T('核心域', 'Core');
  if (z.key === 'z_ext' && z.name === '扩展域') return T('扩展域', 'Ext');
  return z.name;
};
/* 内置字段注释显示名：{zh,en} 对象 → 当前语言字符串；普通字符串原样返回 */
ERD.tCmt = function (c) {
  if (c && typeof c === 'object' && c.zh != null) return (typeof _t === 'function') ? _t(c.zh, c.en) : c.zh;
  return c || '';
};

/* ---------- 事件总线 ---------- */
ERD.bus = (function () {
  const map = {};
  return {
    on(ev, fn) { (map[ev] = map[ev] || []).push(fn); },
    off(ev, fn) { if (map[ev]) map[ev] = map[ev].filter(f => f !== fn); },
    emit(ev, data) { (map[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error('[bus:' + ev + ']', e); } }); }
  };
})();

/* ---------- UI 偏好（主题 / 画布样式，独立于工程数据持久化） ---------- */
ERD.ui = (function () {
  const KEY = 'erd.ui.v1';
  const DEF = { theme: 'dark', bgPattern: 'grid', edgeStyle: 'bezier' };
  let s;
  try { s = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { s = Object.assign({}, DEF); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  function apply() {
    if (typeof document === 'undefined') return;
    document.body.dataset.theme = s.theme;
    const vp = document.getElementById('viewport');
    if (vp) {
      vp.classList.remove('bg-grid', 'bg-dots', 'bg-none');
      vp.classList.add('bg-' + s.bgPattern);
    }
  }
  return {
    get: k => s[k],
    set(k, v) { s[k] = v; save(); apply(); },
    apply
  };
})();

/* ---------- 类型注册表（内置 + 自定义，localStorage 持久化） ---------- */
ERD.types = (function () {
  const KEY = 'erd.types.v1';
  const BUILTIN = ['bigint', 'bigserial', 'serial', 'int', 'smallint', 'numeric(5,2)', 'numeric(10,2)', 'numeric(18,2)',
    'varchar(20)', 'varchar(40)', 'varchar(50)', 'varchar(100)', 'varchar(200)', 'varchar(500)', 'char(10)', 'text',
    'bool', 'boolean', 'date', 'time', 'timestamptz', 'timestamp', 'jsonb', 'json', 'uuid',
    'varchar[]', 'int[]', 'bigint[]', 'text[]'];
  let extra = [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(v)) extra = v.filter(x => typeof x === 'string' && x.trim());
  } catch (e) { /* ignore */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(extra)); } catch (e) { /* ignore */ } }
  function list() { return BUILTIN.concat(extra); }
  function syncDatalist() {
    const dl = document.getElementById('dl-types');
    if (dl) dl.innerHTML = list().map(t => '<option value="' + ERD.esc(t) + '"></option>').join('');
  }
  return {
    list,
    extra() { return extra.slice(); },
    add(t) {
      const s = String(t || '').trim();
      if (!s || BUILTIN.includes(s) || extra.includes(s)) return false;
      extra.push(s); save(); syncDatalist(); return true;
    },
    remove(t) {
      const i = extra.indexOf(t);
      if (i < 0) return false;
      extra.splice(i, 1); save(); syncDatalist(); return true;
    },
    syncDatalist, BUILTIN
  };
})();

/* ---------- 救援保险箱：IndexedDB 镜像（localStorage 丢失/溢出时的兜底） ----------
   每次保存都会把工程快照镜像到 IndexedDB（异步、不阻塞）。
   localStorage 被清空或写入失败时，可从 vault 恢复。Node 测试环境无 indexedDB 自动跳过。 */
ERD.vault = (function () {
  const DB = 'erd-vault', STORE = 'projects';
  let db = null;
  function open() {
    return new Promise(resolve => {
      if (db) return resolve(db);
      if (!('indexedDB' in window)) return resolve(null);
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); };
        req.onsuccess = () => { db = req.result; resolve(db); };
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  function put(p) {
    open().then(d => {
      if (!d || !p || !p.id) return;
      /* IndexedDB 存储时会自动结构化克隆，无需手动深拷贝（调用方传入的是快照对象） */
      try { d.transaction(STORE, 'readwrite').objectStore(STORE).put(p); } catch (e) { /* ignore */ }
    });
  }
  function del(id) {
    open().then(d => { if (!d || !id) return; try { d.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); } catch (e) { /* ignore */ } });
  }
  function getAll() {
    return open().then(d => new Promise(resolve => {
      if (!d) return resolve([]);
      try {
        const tx = d.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    }));
  }
  return { put, del, getAll };
})();

/* ---------- 连线路径生成（曲线 / 直角折线 / 直线，渲染与导出共用） ---------- */
ERD.edgePath = function (from, to, style) {
  if (from.self) {
    return 'M ' + from.x + ' ' + from.y + ' C ' + (from.x - 52) + ' ' + (from.y + 16) + ', ' + (from.x - 52) + ' ' + (to.y - 16) + ', ' + to.x + ' ' + to.y;
  }
  const st = style || 'bezier';
  if (st === 'straight') return 'M ' + from.x + ' ' + from.y + ' L ' + to.x + ' ' + to.y;
  if (st === 'ortho') {
    if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
      const mx = Math.round((from.x + to.x) / 2);
      return 'M ' + from.x + ' ' + from.y + ' L ' + mx + ' ' + from.y + ' L ' + mx + ' ' + to.y + ' L ' + to.x + ' ' + to.y;
    }
    const my = Math.round((from.y + to.y) / 2);
    return 'M ' + from.x + ' ' + from.y + ' L ' + from.x + ' ' + my + ' L ' + to.x + ' ' + my + ' L ' + to.x + ' ' + to.y;
  }
  const dx = to.x - from.x;
  return 'M ' + from.x + ' ' + from.y + ' C ' + (from.x + dx * .45) + ' ' + from.y + ', ' + (to.x - dx * .45) + ' ' + to.y + ', ' + to.x + ' ' + to.y;
};

/* ---------- 视图 / 会话状态（不持久化到工程文件） ---------- */
ERD.view = {
  scale: 0.55, tx: 40, ty: 90,
  showLogical: false,   // 是否显示逻辑关联
  connectMode: false,   // 连线模式
  connectFrom: null,    // 连线起点表 key
  sel: null,            // {type:'table'|'relation', id}
  selKeys: [],          // 多选表 key 集合（Ctrl/Cmd 点击累积）
  focusKey: null,       // 关系聚焦表 key
  filter: ''            // 搜索词
};

/* ================================================================
   存储层
   ================================================================ */
ERD.store = (function () {
  const MANIFEST_KEY = 'erd.manifest.v1';
  const PROJ_PREFIX = 'erd.project.';
  const HISTORY_MAX = 60;
  const HISTORY_BYTES_MAX = 20 * 1024 * 1024;   // 撤销历史总字节上限，防大工程内存暴涨
  const SCHEMA_VERSION = 1;   // 工程数据格式版本（升级结构时递增并补充 migrate 步骤）

  /* 深拷贝：优先原生 structuredClone（更快且保留类型），旧环境回退 JSON 往返 */
  const deepClone = (typeof structuredClone === 'function')
    ? function (v) { return structuredClone(v); }
    : function (v) { return JSON.parse(JSON.stringify(v)); };

  /* 工程数据迁移：未来 schemaVersion 递增时在此按版本逐步升级 */
  function migrate(p) {
    const cur = p;
    /* 示例：if ((cur.schemaVersion || 1) < 2) { cur = mig_v1_to_v2(cur); } */
    if (cur.schemaVersion !== SCHEMA_VERSION) cur.schemaVersion = SCHEMA_VERSION;
    return cur;
  }

  const state = {
    manifest: { projects: [], activeId: null },
    p: null,             // 当前工程（活对象）
    undoStack: [],       // [{json, label}]
    redoStack: [],
    savedAt: null,
    _persistTimer: null
  };

  /* ---------- localStorage 基础 ---------- */
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSetRaw(k, str) {
    try { localStorage.setItem(k, str); return true; }
    catch (e) {
      busStatus('本地存储空间不足，请导出 JSON 备份并清理旧工程', 'warn');
      return false;
    }
  }
  function lsSet(k, v) { return lsSetRaw(k, JSON.stringify(v)); }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function busStatus(msg, kind) { ERD.bus.emit('status', { msg, kind: kind || 'info' }); }

  /* ---------- 工程骨架 ---------- */
  function blankProject(name, desc) {
    const now = new Date().toISOString();
    return {
      id: ERD.uid('p'), name: name || '未命名工程', description: desc || '',
      dbType: 'postgresql', schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now,
      zones: [
        { key: 'z_core', name: '核心域', color: '#7dcfff' },
        { key: 'z_ext', name: '扩展域', color: '#bb9af7' }
      ],
      tables: [],
      relations: []
    };
  }

  /* ---------- 历史记录（撤销/重做） ---------- */
  /* 复制表对象（剔除渲染期挂载的 DOM 引用 el，避免 structuredClone 抛错 / 存储冗余） */
  function copyTable(t) {
    const c = {};
    for (const k in t) if (k !== 'el') c[k] = t[k];
    return c;
  }
  function snapshot() {
    const p = state.p;
    return deepClone({
      zones: p.zones,
      tables: p.tables.map(copyTable),
      relations: p.relations
    });
  }
  function pushHistory(label) {
    if (!state.p) return;
    const data = snapshot();
    const size = byteSize(JSON.stringify(data));
    state.undoStack.push({ data, size, label: label || '' });
    /* 裁剪：条数上限 + 总字节上限（从新到旧累计，超限即丢弃更旧的快照） */
    let total = 0;
    for (let i = state.undoStack.length - 1; i >= 0; i--) {
      total += state.undoStack[i].size;
      if (state.undoStack.length - i > HISTORY_MAX || total > HISTORY_BYTES_MAX) {
        state.undoStack.splice(0, i + 1);
        break;
      }
    }
    state.redoStack.length = 0;
    ERD.bus.emit('history');
  }
  function restore(data) {
    const p = state.p;
    p.zones = data.zones; p.tables = data.tables; p.relations = data.relations;
    ERD.view.sel = null; ERD.view.connectFrom = null;
    persist();
    ERD.bus.emit('dirty', 'all');
  }
  function undo() {
    if (!state.undoStack.length) { busStatus('没有可撤销的操作'); return; }
    const item = state.undoStack.pop();
    state.redoStack.push({ data: snapshot(), label: item.label });
    restore(item.data);
    busStatus('已撤销：' + (item.label || '操作'));
    ERD.bus.emit('history');
  }
  function redo() {
    if (!state.redoStack.length) { busStatus('没有可重做的操作'); return; }
    const item = state.redoStack.pop();
    state.undoStack.push({ data: snapshot(), label: item.label });
    restore(item.data);
    busStatus('已重做：' + (item.label || '操作'));
    ERD.bus.emit('history');
  }

  /* ---------- 持久化 ---------- */
  function byteSize(s) { try { return new Blob([s]).size; } catch (e) { return (s || '').length; } }
  const QUOTA_WARN = 3.5 * 1024 * 1024;   // 接近 localStorage 上限时预警

  function persist(immediate) {
    if (!state.p) return;
    clearTimeout(state._persistTimer);
    const doSave = () => {
      state.p.updatedAt = new Date().toISOString();
      /* 单次序列化复用：localStorage 与救援保险箱共用同一份字符串
         （展开保留全部顶层字段，仅剔除表上的渲染期 DOM 引用 el） */
      const str = JSON.stringify(Object.assign({}, state.p, { tables: state.p.tables.map(copyTable) }));
      /* 大工程预警：接近 localStorage 配额时提醒定期备份 */
      const size = byteSize(str);
      if (size > QUOTA_WARN) {
        busStatus('工程约 ' + (size / 1048576).toFixed(1) + ' MB，接近浏览器存储上限，请定期「导出 → 工程 JSON」备份', 'warn');
      }
      if (lsSetRaw(PROJ_PREFIX + state.p.id, str)) {
        const m = state.manifest.projects.find(x => x.id === state.p.id);
        if (m) {
          m.name = state.p.name; m.description = state.p.description;
          m.updatedAt = state.p.updatedAt; m.tableCount = state.p.tables.length;
        }
        lsSet(MANIFEST_KEY, state.manifest);
        state.savedAt = new Date();
        ERD.bus.emit('saved');
      } else {
        /* localStorage 写入失败（配额/隐私模式）：提示 + 自动导出备份兜底 */
        ERD.vault.put(JSON.parse(str));
        busStatus('本地存储写入失败，已尝试写入救援存储，并自动导出 JSON 备份', 'err');
        try { if (ERD.io && ERD.io.exportJSON) ERD.io.exportJSON(); } catch (e) { /* ignore */ }
      }
      /* 每次保存都镜像到 IndexedDB 救援保险箱（快照对象，IDB 自行克隆；异步不阻塞） */
      ERD.vault.put(JSON.parse(str));
    };
    if (immediate) doSave();
    else state._persistTimer = setTimeout(doSave, 350);
  }

  /* 启动时从救援保险箱找回 localStorage 缺失的工程 */
  function vaultRestore() {
    ERD.vault.getAll().then(list => {
      if (!list || !list.length) return;
      const manifest = lsGet(MANIFEST_KEY) || { projects: [], activeId: null };
      const existing = new Set((manifest.projects || []).map(x => x && x.id));
      let added = 0;
      list.forEach(p => {
        if (!p || !p.id || existing.has(p.id)) return;
        if (lsSet(PROJ_PREFIX + p.id, p)) {
          manifest.projects.push(meta(p));
          existing.add(p.id); added++;
        }
      });
      if (added) {
        if (!manifest.activeId && manifest.projects.length) manifest.activeId = manifest.projects[0].id;
        lsSet(MANIFEST_KEY, manifest);
        state.manifest = manifest;
        ERD.bus.emit('meta');
        busStatus('已从救援存储恢复 ' + added + ' 个工程', 'ok');
      }
    });
  }

  /* ---------- 工程管理 ---------- */
  function init(sampleFactory) {
    state.manifest = lsGet(MANIFEST_KEY) || { projects: [], activeId: null };
    /* 自愈：清理无 id 的坏工程项（旧版播种缺陷写入过 erd.project.undefined） */
    if (state.manifest.projects && state.manifest.projects.some(x => !x || !x.id)) {
      lsDel(PROJ_PREFIX + 'undefined');
      state.manifest.projects = state.manifest.projects.filter(x => x && x.id);
      if (!state.manifest.projects.length) state.manifest.activeId = null;
      lsSet(MANIFEST_KEY, state.manifest);
    }
    if (!state.manifest.projects.length) {
      if (typeof sampleFactory === 'function') {
        let sp = sampleFactory();
        if (sp) {
          sp = JSON.parse(JSON.stringify(sp));
          const now = new Date().toISOString();
          sp.id = ERD.uid('p');
          if (sp.meta) {
            sp.name = sp.name || sp.meta.name;
            if (sp.description == null) sp.description = sp.meta.desc || sp.meta.description || '';
            delete sp.meta;
          }
          sp.name = sp.name || '示例工程';
          if (sp.description == null) sp.description = '';
          sp.dbType = sp.dbType || 'postgresql';
          sp.schemaVersion = SCHEMA_VERSION;
          sp.createdAt = sp.createdAt || now;
          sp.updatedAt = now;
          lsSet(PROJ_PREFIX + sp.id, sp);
          state.manifest = { projects: [meta(sp)], activeId: sp.id };
          lsSet(MANIFEST_KEY, state.manifest);
        }
      }
    }
    if (!state.manifest.activeId && state.manifest.projects.length) {
      state.manifest.activeId = state.manifest.projects[0].id;
    }
    if (state.manifest.activeId) open(state.manifest.activeId, true);
    return state.p;
  }

  function meta(p) {
    return { id: p.id, name: p.name, description: p.description, updatedAt: p.updatedAt, tableCount: p.tables.length };
  }

  function list() { return state.manifest.projects.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); }

  function open(id, silent) {
    let p = lsGet(PROJ_PREFIX + id);
    if (!p) { busStatus('工程数据不存在或已损坏', 'err'); return false; }
    p = migrate(p);
    state.p = p;
    state.undoStack = []; state.redoStack = [];
    state.manifest.activeId = id;
    lsSet(MANIFEST_KEY, state.manifest);
    ERD.view.sel = null; ERD.view.selKeys = []; ERD.view.filter = '';
    if (!silent) persist(true);
    ERD.bus.emit('dirty', 'all');
    ERD.bus.emit('meta');
    ERD.bus.emit('history');
    return true;
  }

  function create(name, desc, data) {
    const p = data || blankProject(name, desc);
    if (data) { p.id = ERD.uid('p'); p.name = name || p.name; p.description = desc != null ? desc : p.description; }
    p.updatedAt = new Date().toISOString();
    lsSet(PROJ_PREFIX + p.id, p);
    state.manifest.projects.push(meta(p));
    state.manifest.activeId = p.id;
    lsSet(MANIFEST_KEY, state.manifest);
    state.p = p; state.undoStack = []; state.redoStack = [];
    ERD.view.sel = null; ERD.view.selKeys = [];
    ERD.bus.emit('dirty', 'all'); ERD.bus.emit('meta');
    busStatus('已创建工程「' + p.name + '」');
    return p;
  }

  function duplicate(id) {
    const src = id === (state.p && state.p.id) ? state.p : lsGet(PROJ_PREFIX + id);
    if (!src) return null;
    const cp = JSON.parse(JSON.stringify(src));
    cp.id = ERD.uid('p'); cp.name = src.name + ' 副本';
    cp.createdAt = cp.updatedAt = new Date().toISOString();
    lsSet(PROJ_PREFIX + cp.id, cp);
    state.manifest.projects.push(meta(cp));
    lsSet(MANIFEST_KEY, state.manifest);
    ERD.bus.emit('meta');
    return cp.id;
  }

  function remove(id) {
    if (state.manifest.projects.length <= 1) { busStatus('至少保留一个工程', 'warn'); return false; }
    lsDel(PROJ_PREFIX + id);
    ERD.vault.del(id);
    state.manifest.projects = state.manifest.projects.filter(x => x.id !== id);
    if (state.manifest.activeId === id) {
      state.manifest.activeId = state.manifest.projects[0] ? state.manifest.projects[0].id : null;
      if (state.manifest.activeId) open(state.manifest.activeId, true);
    }
    lsSet(MANIFEST_KEY, state.manifest);
    ERD.bus.emit('meta');
    return true;
  }

  function rename(id, name, desc) {
    const p = id === (state.p && state.p.id) ? state.p : lsGet(PROJ_PREFIX + id);
    if (!p) return;
    p.name = name != null ? name : p.name;
    if (desc != null) p.description = desc;
    p.updatedAt = new Date().toISOString();
    if (p === state.p) persist(true); else lsSet(PROJ_PREFIX + id, p);
    const m = state.manifest.projects.find(x => x.id === id);
    if (m) { m.name = p.name; m.updatedAt = p.updatedAt; }
    lsSet(MANIFEST_KEY, state.manifest);
    ERD.bus.emit('meta');
  }

  /* ---------- 数据访问 ---------- */
  function tableByKey(k) { return state.p.tables.find(t => t.key === k); }
  function relById(id) { return state.p.relations.find(r => r.id === id); }
  function zoneOf(t) { return state.p.zones.find(z => z.key === (t && t.zone)) || null; }
  function uniqueTableKey(base) {
    let k = base || 'table', i = 1;
    const exists = () => state.p.tables.some(t => t.key === k);
    while (exists()) { k = base + '_' + (++i); }
    return k;
  }
  function nextPos() {
    const r = document.getElementById('viewport').getBoundingClientRect();
    const cx = (r.width / 2 - ERD.view.tx) / ERD.view.scale - ERD.CARD_W / 2;
    const cy = (r.height / 2 - ERD.view.ty) / ERD.view.scale - 60;
    const n = state.p.tables.length;
    return { x: Math.round(cx + (n % 5) * 30 - 60), y: Math.round(cy + Math.floor(n / 5) * 40 - 60) };
  }

  /* ---------- 表操作 ---------- */
  function addTable(props) {
    pushHistory('新增表');
    const pos = nextPos();
    const t = {
      key: uniqueTableKey((props.key || props.name || 'new_table').toLowerCase().replace(/[^a-z0-9_]/g, '_')),
      zone: props.zone || (state.p.zones[0] && state.p.zones[0].key) || '',
      x: props.x != null ? props.x : pos.x, y: props.y != null ? props.y : pos.y,
      cn: props.cn || '', desc: props.desc || '', core: !!props.core,
      cols: props.cols && props.cols.length ? props.cols : [
        ['id', 'bigint', 'pk', '主键', true],
        ['name', 'varchar(100)', '', '名称', true]
      ]
    };
    state.p.tables.push(t);
    if (props.zone == null && !state.p.zones.some(z => z.key === t.zone)) t.zone = '';
    persist(); ERD.bus.emit('dirty', 'all');
    ERD.view.sel = { type: 'table', id: t.key };
    ERD.bus.emit('select');
    return t;
  }

  function updateTable(key, patch, label) {
    const t = tableByKey(key); if (!t) return;
    pushHistory(label || '修改表');
    Object.assign(t, patch);
    persist();
    ERD.bus.emit('dirty', { type: 'table', key });
  }

  function setColumns(key, cols, label) {
    const t = tableByKey(key); if (!t) return;
    pushHistory(label || '修改字段');
    t.cols = cols;
    syncFkFlags(t);
    persist();
    ERD.bus.emit('dirty', { type: 'table', key });
  }

  function removeTable(key) {
    const t = tableByKey(key); if (!t) return;
    pushHistory('删除表 ' + t.key);
    state.p.tables = state.p.tables.filter(x => x.key !== key);
    state.p.relations = state.p.relations.filter(r =>
      !(r.type === 'fk' ? (r.child === key || r.parent === key) : (r.from === key || r.to === key)));
    if (ERD.view.sel && ERD.view.sel.id === key) { ERD.view.sel = null; ERD.bus.emit('select'); }
    persist(); ERD.bus.emit('dirty', 'all');
  }

  /* ---------- 表移动（拖拽） ---------- */
  function beginMove() { pushHistory('移动表'); }
  /* 拖拽中不落盘（避免每帧全工程序列化），由 interact 在 mouseup 时统一 persist(true) */
  function moveTable(key, x, y) {
    const t = tableByKey(key); if (!t) return;
    t.x = Math.round(x); t.y = Math.round(y);
    ERD.bus.emit('dirty', 'move');
  }

  /* ---------- 折叠 / 展开（显示状态，不进撤销历史） ---------- */
  function setFold(key, fold) {
    const t = tableByKey(key); if (!t) return;
    t.fold = !!fold;
    persist();
    ERD.bus.emit('dirty', { type: 'table', key });
    if (ERD.view.sel && ERD.view.sel.type === 'table' && ERD.view.sel.id === key) ERD.bus.emit('select');
  }
  function foldAll(fold) {
    state.p.tables.forEach(t => { t.fold = !!fold; });
    persist(); ERD.bus.emit('dirty', 'all');
    if (ERD.view.sel && ERD.view.sel.type === 'table') ERD.bus.emit('select');
  }

  /* ---------- 批量操作（多选） ---------- */
  function removeTables(keys) {
    if (!keys || !keys.length) return;
    const set = new Set(keys);
    pushHistory('批量删除 ' + keys.length + ' 张表');
    state.p.tables = state.p.tables.filter(t => !set.has(t.key));
    state.p.relations = state.p.relations.filter(r =>
      !(r.type === 'fk' ? (set.has(r.child) || set.has(r.parent)) : (set.has(r.from) || set.has(r.to))));
    if (ERD.view.sel && set.has(ERD.view.sel.id)) { ERD.view.sel = null; ERD.view.selKeys = []; }
    ERD.bus.emit('select');
    persist(); ERD.bus.emit('dirty', 'all');
  }
  function moveTables(keys, zone) {
    if (!keys || !keys.length) return;
    pushHistory('移动 ' + keys.length + ' 张表到域');
    keys.forEach(k => { const t = tableByKey(k); if (t) t.zone = zone; });
    persist(); ERD.bus.emit('dirty', 'all');
  }
  function setFoldMany(keys, fold) {
    if (!keys || !keys.length) return;
    keys.forEach(k => { const t = tableByKey(k); if (t) t.fold = !!fold; });
    persist(); ERD.bus.emit('dirty', 'all');
    if (ERD.view.sel && ERD.view.sel.type === 'table') ERD.bus.emit('select');
  }

  /* ---------- 对齐 / 分布（多选） ---------- */
  function alignTables(keys, mode) {
    const ts = (keys || []).map(k => tableByKey(k)).filter(Boolean);
    if (ts.length < 2) return;
    pushHistory('对齐表格');
    const minX = Math.min(...ts.map(t => t.x));
    const maxX = Math.max(...ts.map(t => t.x + ERD.cardW(t)));
    const minY = Math.min(...ts.map(t => t.y));
    const maxY = Math.max(...ts.map(t => t.y + ERD.tableH(t)));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    ts.forEach(t => {
      const w = ERD.cardW(t), h = ERD.tableH(t);
      if (mode === 'left') t.x = Math.round(minX);
      else if (mode === 'hcenter') t.x = Math.round(cx - w / 2);
      else if (mode === 'right') t.x = Math.round(maxX - w);
      else if (mode === 'top') t.y = Math.round(minY);
      else if (mode === 'vcenter') t.y = Math.round(cy - h / 2);
      else if (mode === 'bottom') t.y = Math.round(maxY - h);
    });
    persist(); ERD.bus.emit('dirty', 'all');
  }
  function distributeTables(keys, axis) {
    const ts = (keys || []).map(k => tableByKey(k)).filter(Boolean);
    if (ts.length < 3) return;
    pushHistory('等距分布');
    if (axis === 'h') {
      const total = ts.reduce((s, t) => s + ERD.cardW(t), 0);
      const minX = Math.min(...ts.map(t => t.x));
      const maxX = Math.max(...ts.map(t => t.x + ERD.cardW(t)));
      const gap = (maxX - minX - total) / (ts.length - 1);
      ts.sort((a, b) => a.x - b.x);
      let x = minX;
      ts.forEach(t => { t.x = Math.round(x); x += ERD.cardW(t) + gap; });
    } else {
      const total = ts.reduce((s, t) => s + ERD.tableH(t), 0);
      const minY = Math.min(...ts.map(t => t.y));
      const maxY = Math.max(...ts.map(t => t.y + ERD.tableH(t)));
      const gap = (maxY - minY - total) / (ts.length - 1);
      ts.sort((a, b) => a.y - b.y);
      let y = minY;
      ts.forEach(t => { t.y = Math.round(y); y += ERD.tableH(t) + gap; });
    }
    persist(); ERD.bus.emit('dirty', 'all');
  }

  /* ---------- 关系操作 ---------- */
  function syncFkFlags(t) {
    const fkCols = new Set(state.p.relations.filter(r => r.type === 'fk' && r.child === t.key).map(r => r.col));
    t.cols.forEach(c => { if (c[2] === 'fk' && !fkCols.has(c[0])) c[2] = ''; });
  }

  function addRelation(rel) {
    pushHistory('新增关系');
    const r = {
      id: ERD.uid('r'),
      type: rel.type || 'fk',
      card: rel.card || '1:N'
    };
    if (r.type === 'fk') {
      r.child = rel.child; r.col = rel.col || ''; r.parent = rel.parent;
      r.parentCol = rel.parentCol || 'id'; r.card = rel.card || '1:N';
      const ct = tableByKey(r.child);
      if (ct) {
        const col = ct.cols.find(c => c[0] === r.col);
        if (col) col[2] = 'fk';
        syncFkFlags(ct);
      }
    } else {
      r.from = rel.from; r.to = rel.to; r.label = rel.label || '';
    }
    state.p.relations.push(r);
    persist();
    ERD.bus.emit('dirty', { type: 'relation', key: r.type === 'fk' ? r.child : undefined });
    return r;
  }

  function updateRelation(id, patch, label) {
    const r = relById(id); if (!r) return;
    pushHistory(label || '修改关系');
    const oldChild = r.child;
    if (patch.col !== undefined) {
      const ct = tableByKey(oldChild);
      if (ct) { const old = ct.cols.find(c => c[0] === r.col); if (old) old[2] = ''; }
    }
    Object.assign(r, patch);
    if (r.type === 'fk') {
      const ct = tableByKey(r.child);
      if (ct) {
        const col = ct.cols.find(c => c[0] === r.col);
        if (col) col[2] = 'fk';
        syncFkFlags(ct);
      }
    }
    persist();
    /* 新旧子表都需刷新卡片（fk 徽标可能变化） */
    const keys = [r.child, oldChild].filter(Boolean);
    ERD.bus.emit('dirty', { type: 'relation', key: r.child, keys: keys.length > 1 ? keys : undefined });
    ERD.bus.emit('select');
  }

  function removeRelation(id) {
    const r = relById(id); if (!r) return;
    pushHistory('删除关系');
    state.p.relations = state.p.relations.filter(x => x.id !== id);
    if (r.type === 'fk') { const ct = tableByKey(r.child); if (ct) syncFkFlags(ct); }
    if (ERD.view.sel && ERD.view.sel.id === id) { ERD.view.sel = null; ERD.bus.emit('select'); }
    persist();
    ERD.bus.emit('dirty', { type: 'relation', key: r.type === 'fk' ? r.child : undefined });
  }

  /* ---------- 域操作 ---------- */
  function addZone(name, color) {
    pushHistory('新增域');
    const z = { key: ERD.uid('z'), name: name || '新域', color: ERD.safeColor(color) };
    state.p.zones.push(z);
    persist(); ERD.bus.emit('dirty', 'all');
    return z;
  }
  function updateZone(key, patch) {
    pushHistory('修改域');
    if (patch.color !== undefined) patch.color = ERD.safeColor(patch.color);
    const z = state.p.zones.find(x => x.key === key); if (!z) return;
    Object.assign(z, patch);
    persist(); ERD.bus.emit('dirty', 'all');
  }
  function removeZone(key) {
    pushHistory('删除域');
    state.p.zones = state.p.zones.filter(x => x.key !== key);
    const fb = state.p.zones[0] ? state.p.zones[0].key : '';
    state.p.tables.forEach(t => { if (t.zone === key) t.zone = fb; });
    persist(); ERD.bus.emit('dirty', 'all');
  }

  /* ---------- 统计 ---------- */
  function stats() {
    const p = state.p; if (!p) return { tables: 0, cols: 0, fk: 0, lg: 0, zones: 0 };
    let cols = 0;
    p.tables.forEach(t => t.cols.forEach(c => { if (c[2] !== 'g') cols++; }));
    return {
      tables: p.tables.length, cols,
      fk: p.relations.filter(r => r.type === 'fk').length,
      lg: p.relations.filter(r => r.type === 'logical').length,
      zones: p.zones.length
    };
  }

  return {
    state, init, list, open, create, duplicate, remove, rename,
    tableByKey, relById, zoneOf, uniqueTableKey,
    addTable, updateTable, setColumns, removeTable, moveTable, beginMove, setFold, foldAll,
    removeTables, moveTables, setFoldMany, alignTables, distributeTables,
    addRelation, updateRelation, removeRelation,
    addZone, updateZone, removeZone,
    pushHistory, undo, redo, stats, persist, vaultRestore,
    canUndo: () => state.undoStack.length > 0,
    canRedo: () => state.redoStack.length > 0
  };
})();
