/* ================================================================
   Aneiang ERD Studio · io.js — 导入导出：JSON / SQL / PNG / SVG / Mermaid / XLSX
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.io = (function () {

  /* ================= 下载工具 ================= */
  function download(name, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function stamp() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()); }
  function baseName() {
    const p = ERD.store.state.p;
    return (p.name || 'erd').replace(/[\\/:*?"<>|]/g, '_');
  }
  function ok(msg) { ERD.bus.emit('status', { msg, kind: 'ok' }); }

  /* ================= 导入：自动识别 ================= */
  function parseAuto(text) {
    const s = String(text || '').trim();
    if (!s) return { ok: false, error: '内容为空' };
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const j = JSON.parse(s);
        return normalizeProject(j);
      } catch (e) {
        return { ok: false, error: 'JSON 解析失败：' + e.message };
      }
    }
    if (/create\s+table/i.test(s)) {
      const r = ERD.sql.parse(s);
      if (!r.tables.length) return { ok: false, error: '未解析到任何 CREATE TABLE 语句' };
      return { ok: true, kind: 'schema', tables: r.tables, relations: r.relations, warnings: r.warnings };
    }
    return { ok: false, error: '无法识别的格式：请导入本平台导出的 JSON，或含 CREATE TABLE 的 SQL 脚本' };
  }

  function normalizeProject(j) {
    // 兼容：完整工程 {zones,tables,relations,...} 或 裸 {tables:[...]}
    const tables = j.tables || (Array.isArray(j) ? j : null);
    if (!tables || !Array.isArray(tables)) return { ok: false, error: 'JSON 中缺少 tables 数组' };
    const zones = (j.zones && j.zones.length ? j.zones : [
      { key: 'z1', name: '默认域', color: '#7dcfff' }
    ]).map(z => ({ key: z.key || ERD.uid('z'), name: z.name || '域', color: z.color || '#7aa2f7' }));
    tables.forEach(t => {
      t.key = String(t.key || t.name || 'table').toLowerCase();
      t.cn = t.cn || ''; t.desc = t.desc || t.description || '';
      t.zone = t.zone || zones[0].key;
      t.x = +t.x || 0; t.y = +t.y || 0; t.fold = !!t.fold;
      t.cols = (t.cols || []).map(c => Array.isArray(c)
        ? [String(c[0]), c[1] || 'varchar(100)', c[2] || '', c[3] || '', !!c[4]]
        : [c.name, c.type || 'varchar(100)', c.flag || '', c.comment || '', !!c.nn]);
    });
    const relations = (j.relations || []).map(r => {
      if (r.type === 'logical' || r.from !== undefined) return { id: ERD.uid('r'), type: 'logical', from: r.from || r.child, to: r.to || r.parent, label: r.label || '' };
      return { id: ERD.uid('r'), type: 'fk', child: r.child, col: r.col, parent: r.parent, parentCol: r.parentCol || 'id', card: r.card || '1:N' };
    }).filter(r => r.type === 'logical' ? (r.from && r.to) : (r.child && r.parent));
    return {
      ok: true, kind: 'project',
      project: {
        name: j.name || '导入工程', description: j.description || j.desc || '',
        dbType: j.dbType || 'postgresql',
        zones, tables, relations
      }
    };
  }

  /* ================= 导入执行 ================= */
  function importData(parsed, mode) {
    const cur = ERD.store.state.p;
    if (parsed.kind === 'project' && mode === 'new') {
      const pj = parsed.project;
      pj.id = ERD.uid('p');
      ERD.store.create(pj.name, pj.description, pj);
      ok('已导入工程：' + pj.tables.length + ' 表 / ' + pj.relations.length + ' 关系');
      return true;
    }
    // 合并（project 或 schema）
    const incTables = parsed.kind === 'project' ? parsed.project.tables : parsed.tables;
    const incRels = parsed.kind === 'project' ? parsed.project.relations : parsed.relations;
    const incZones = parsed.kind === 'project' ? parsed.project.zones : null;
    const srcName = parsed.kind === 'project' ? parsed.project.name : 'SQL 导入';

    ERD.store.pushHistory('导入 ' + srcName);

    // 域合并（按名称）
    const zoneMap = {};
    if (incZones) {
      incZones.forEach(z => {
        const exist = cur.zones.find(x => x.name === z.name);
        if (exist) { zoneMap[z.key] = exist.key; return; }
        const nz = { key: ERD.uid('z'), name: z.name, color: z.color };
        cur.zones.push(nz); zoneMap[z.key] = nz.key;
      });
    }
    const fallbackZone = cur.zones[0].key;

    // 表合并（重名自动加后缀）
    const keyMap = {};
    let maxX = 0;
    cur.tables.forEach(t => { maxX = Math.max(maxX, t.x); });
    incTables.forEach(t => {
      let nk = t.key;
      if (cur.tables.some(x => x.key === nk)) {
        let i = 2;
        while (cur.tables.some(x => x.key === nk + '_' + i)) i++;
        nk = nk + '_' + i;
      }
      keyMap[t.key] = nk;
      cur.tables.push({
        key: nk, cn: t.cn || '', desc: t.desc || '', core: !!t.core, fold: !!t.fold,
        zone: zoneMap[t.zone] || fallbackZone,
        x: (t.x || 0) + maxX + 120, y: t.y || 0,
        cols: (t.cols || []).map(c => c.slice())
      });
    });
    // 关系合并（表名映射 + 去重）
    let relAdded = 0;
    incRels.forEach(r => {
      const child = keyMap[r.child] || r.child;
      const parent = keyMap[r.parent] || r.parent;
      if (r.type === 'logical' || r.from !== undefined) {
        const from = keyMap[r.from] || r.from, to = keyMap[r.to] || r.to;
        if (cur.tables.some(x => x.key === from) && cur.tables.some(x => x.key === to)) {
          cur.relations.push({ id: ERD.uid('r'), type: 'logical', from, to, label: r.label || '' });
          relAdded++;
        }
        return;
      }
      if (cur.tables.some(x => x.key === child) && cur.tables.some(x => x.key === parent)) {
        cur.relations.push({ id: ERD.uid('r'), type: 'fk', child, col: r.col, parent, parentCol: r.parentCol || 'id', card: r.card || '1:N' });
        const ct = cur.tables.find(x => x.key === child);
        const c = ct && ct.cols.find(x => x[0] === r.col);
        if (c) c[2] = 'fk';
        relAdded++;
      }
    });
    ERD.store.persist();
    ERD.bus.emit('dirty', 'all');
    ok('已合并：新增 ' + incTables.length + ' 表 / ' + relAdded + ' 关系' + (parsed.warnings && parsed.warnings.length ? '（' + parsed.warnings.length + ' 处警告，见控制台）' : ''));
    if (parsed.warnings && parsed.warnings.length) console.warn('[导入警告]', parsed.warnings);
    return true;
  }

  /* ================= 导出：JSON ================= */
  function exportJSON() {
    const p = JSON.parse(JSON.stringify(ERD.store.state.p));
    p.tables.forEach(t => { delete t.el; delete t.h; });
    p.exportedAt = new Date().toISOString();
    p.app = 'Aneiang ERD Studio v1.0';
    download(baseName() + '_' + stamp() + '.json', JSON.stringify(p, null, 2), 'application/json');
    ok('已导出工程 JSON');
  }

  /* ================= 导出：SQL ================= */
  function exportSQL(dialect) {
    const d = ERD.sql.dialect(dialect);
    const sql = ERD.sql.generate(ERD.store.state.p, dialect);
    download(baseName() + '_' + d.fileName + '_' + stamp() + '.sql', sql, 'text/plain;charset=utf-8');
    ok('已导出 SQL（' + d.label + '）');
  }

  /* ================= 导出：SVG / PNG ================= */
  /* 读取当前主题 CSS 变量，导出图与画布观感一致（无 DOM 环境回退暗色） */
  function cssVars() {
    const fb = {
      bg: '#0e1116', panel: '#161a22', line: '#2a3140', title: '#e6e9ef', tName: '#ffffff',
      cName: '#c8d3e8', cType: '#5f6b82', dim: '#8b93a3',
      pk: '#e0af68', fk: '#7aa2f7', uk: '#73daca', violet: '#bb9af7', rose: '#f7768e',
      edge: '#4b5568', edgeLg: '#6b7a99', lblFill: '#8b93a3', lblStroke: '#0e1116',
      zoneBd: 'rgba(255,255,255,.07)', zoneBg: 'rgba(255,255,255,.012)'
    };
    try {
      const cs = getComputedStyle(document.body);
      const g = n => (cs.getPropertyValue(n) || '').trim();
      const v = {
        bg: g('--bg'), panel: g('--panel'), line: g('--line'), title: g('--title'), tName: g('--t-name'),
        cName: g('--c-name'), cType: g('--c-type'), dim: g('--dim'),
        pk: g('--pk'), fk: g('--fk'), uk: g('--uk'), violet: g('--violet'), rose: g('--rose'),
        edge: g('--edge'), edgeLg: g('--edge-logical'), lblFill: g('--edge-label-fill'), lblStroke: g('--edge-label-stroke'),
        zoneBd: g('--zone-bd'), zoneBg: g('--zone-bg')
      };
      Object.keys(v).forEach(k => { if (!v[k]) v[k] = fb[k]; });
      return v;
    } catch (e) { return fb; }
  }

  function buildExportSVG(scale) {
    const p = ERD.store.state.p;
    const C = cssVars();
    const W = ERD.CARD_W, RH = ERD.ROW_H, HH = ERD.HEAD_H;
    const edgeStyle = (typeof ERD.ui !== 'undefined' && ERD.ui.get('edgeStyle')) || 'bezier';
    const pad = 60;
    let minX = 0, minY = 0, maxX = 2600, maxY = 1800;
    if (p.tables.length) {
      minX = Math.min(...p.tables.map(t => t.x)) - pad;
      minY = Math.min(...p.tables.map(t => t.y)) - pad - 30;
      maxX = Math.max(...p.tables.map(t => t.x + ERD.cardW(t))) + pad;
      maxY = Math.max(...p.tables.map(t => t.y + ERD.tableH(t))) + pad;
    }
    const esc = ERD.esc;
    const parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + (maxX - minX) * scale + '" height="' + (maxY - minY) * scale + '" viewBox="' + minX + ' ' + minY + ' ' + (maxX - minX) + ' ' + (maxY - minY) + '" font-family="Microsoft YaHei, PingFang SC, sans-serif">');
    parts.push('<rect x="' + (minX - 2000) + '" y="' + (minY - 2000) + '" width="' + (maxX - minX + 4000) + '" height="' + (maxY - minY + 4000) + '" fill="' + C.bg + '"/>');
    // 标题
    parts.push('<text x="' + minX + '" y="' + (minY - 14) + '" fill="' + C.title + '" font-size="20" font-weight="600">' + esc(p.name) + ' · ER 图</text>');
    parts.push('<defs>' +
      '<marker id="crow" markerWidth="16" markerHeight="14" refX="15" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 7 L14 1 M0 7 L14 7 M0 7 L14 13" stroke="' + C.fk + '" stroke-width="1.3" fill="none"/></marker>' +
      '<marker id="one" markerWidth="10" markerHeight="14" refX="2" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M8 1 L8 13" stroke="' + C.fk + '" stroke-width="1.3" fill="none"/></marker></defs>');

    // 域框
    const groups = {};
    p.tables.forEach(t => { const k = t.zone || ''; (groups[k] = groups[k] || []).push(t); });
    Object.entries(groups).forEach(([zk, ts]) => {
      if (!zk) return;
      const z = p.zones.find(x => x.key === zk); if (!z) return;
      const x = Math.min(...ts.map(t => t.x)) - 20, y = Math.min(...ts.map(t => t.y)) - 44;
      const w = Math.max(...ts.map(t => t.x + ERD.cardW(t))) + 20 - x;
      const h = Math.max(...ts.map(t => t.y + ERD.tableH(t))) + 20 - y;
      parts.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="16" fill="' + C.zoneBg + '" stroke="' + C.zoneBd + '" stroke-dasharray="6 6"/>');
      parts.push('<text x="' + (x + 14) + '" y="' + (y - 8) + '" fill="' + z.color + '" font-size="13" font-weight="600" letter-spacing="3">' + esc(z.name) + ' · ' + ts.length + ' 表</text>');
    });

    // 连线
    const byKey = {};
    p.tables.forEach(t => byKey[t.key] = t);
    function colY(t, colName) { return ERD.colPos(t, colName).y; }
    function edgeD(ct, col, pt, isSelf) {
      const cw = ERD.cardW(ct), pw = ERD.cardW(pt);
      if (isSelf) { const y = colY(ct, col); return { from: { x: ct.x, y: y + 14 }, to: { x: ct.x, y: y - 6 }, self: true }; }
      const cy = colY(ct, col);
      const pc = pt.cols.find(c => c[0] === 'id') ? 'id' : (pt.cols[0] && pt.cols[0][0]);
      const py = colY(pt, pc || 'id');
      let from, to;
      if (pt.x + pw < ct.x - 10) { from = { x: pt.x + pw, y: py }; to = { x: ct.x, y: cy }; }
      else if (ct.x + cw < pt.x - 10) { from = { x: ct.x + cw, y: cy }; to = { x: pt.x, y: py }; }
      else if (ct.y > pt.y) { from = { x: pt.x + pw / 2, y: pt.y + ERD.tableH(pt) }; to = { x: ct.x + cw / 2, y: ct.y }; }
      else { from = { x: ct.x + cw / 2, y: ct.y + ERD.tableH(ct) }; to = { x: pt.x + pw / 2, y: pt.y }; }
      return { from, to };
    }
    p.relations.forEach(r => {
      if (r.type === 'fk') {
        const ct = byKey[r.child], pt = byKey[r.parent];
        if (!ct || !pt) return;
        const e = edgeD(ct, r.col, pt, ct === pt);
        const d = ERD.edgePath(e.from, e.to, edgeStyle);
        const one1 = r.card === '1:1';
        parts.push('<path d="' + d + '" fill="none" stroke="' + C.edge + '" stroke-width="1.4" marker-start="url(#one)"' + (one1 ? ' marker-end="url(#one)"' : ' marker-end="url(#crow)"') + '/>');
      } else {
        const ct = byKey[r.from], pt = byKey[r.to];
        if (!ct || !pt) return;
        const cw = ERD.cardW(ct), pw = ERD.cardW(pt);
        const cy = ct.y + HH + 40, py = pt.y + HH + 60;
        const from = ct.x + cw < pt.x ? { x: ct.x + cw, y: cy } : { x: ct.x, y: cy };
        const to = ct.x + cw < pt.x ? { x: pt.x, y: py } : { x: pt.x + pw, y: py };
        const d = ERD.edgePath(from, to, edgeStyle);
        parts.push('<path d="' + d + '" fill="none" stroke="' + C.edgeLg + '" stroke-width="1.4" stroke-dasharray="7 5"/>');
        if (r.label) parts.push('<text x="' + (from.x + to.x) / 2 + '" y="' + ((from.y + to.y) / 2 - 4) + '" fill="' + C.lblFill + '" font-size="10" text-anchor="middle" stroke="' + C.lblStroke + '" stroke-width="3" paint-order="stroke">' + esc(r.label) + '</text>');
      }
    });

    // 表卡片（单列字段，支持折叠）
    p.tables.forEach(t => {
      const zc = (p.zones.find(z => z.key === t.zone) || {}).color || C.dim;
      const cw = ERD.cardW(t), h = ERD.tableH(t);
      const nCols = t.cols.filter(c => c[2] !== 'g').length;
      let inner = '';
      if (!t.fold) {
        t.cols.forEach((c, i) => {
          const y = t.y + HH + i * RH + 12;
          if (c[2] === 'g') {
            inner += '<text x="' + (t.x + 8) + '" y="' + y + '" fill="' + zc + '" font-size="9" font-weight="600">' + esc(c[1]) + '</text>';
            return;
          }
          inner += '<text x="' + (t.x + 8) + '" y="' + y + '" fill="' + C.cName + '" font-size="10.5" font-family="Consolas, monospace">' + esc(c[0]) + '</text>';
          if (c[4] || c[2] === 'pk') {
            inner += '<text x="' + (t.x + 8 + c[0].length * 6.1 + 2) + '" y="' + y + '" fill="' + C.rose + '" font-size="10.5" font-weight="700">✱</text>';
          }
          inner += '<text x="' + (t.x + W - 8) + '" y="' + y + '" fill="' + C.cType + '" font-size="9" font-family="Consolas, monospace" text-anchor="end">' + esc(c[1]) + '</text>';
          if (c[2]) {
            const badgeColor = { pk: C.pk, fk: C.fk, uk: C.uk, idx: C.violet }[c[2]] || C.dim;
            inner += '<text x="' + (t.x + W - 76) + '" y="' + y + '" fill="' + badgeColor + '" font-size="8" font-weight="700" text-anchor="end">' + (c[2] === 'idx' ? 'IDX' : c[2].toUpperCase()) + '</text>';
          }
        });
      }
      /* 两行表头：行1 = 英文表名；行2 = 中文名 · 列数 · 折叠标记 */
      const meta = (t.cn ? esc(t.cn) + ' · ' : '') + nCols + ' 列' + (t.fold ? ' · 已折叠' : '');
      parts.push('<g>' +
        '<rect x="' + t.x + '" y="' + t.y + '" width="' + cw + '" height="' + h + '" rx="10" fill="' + C.panel + '" stroke="' + C.line + '"/>' +
        '<path d="M ' + (t.x + 10) + ' ' + t.y + ' h ' + (cw - 20) + '" stroke="' + zc + '" stroke-width="3" fill="none"/>' +
        '<line x1="' + t.x + '" y1="' + (t.y + HH) + '" x2="' + (t.x + cw) + '" y2="' + (t.y + HH) + '" stroke="' + C.line + '"/>' +
        '<text x="' + (t.x + 10) + '" y="' + (t.y + 16) + '" fill="' + C.tName + '" font-size="11.5" font-weight="700" font-family="Consolas, monospace">' + esc(t.key) + (t.fold ? ' ▸' : '') + '</text>' +
        '<text x="' + (t.x + 10) + '" y="' + (t.y + 33) + '" fill="' + C.dim + '" font-size="9.5">' + meta + '</text>' +
        inner + '</g>');
    });

    parts.push('</svg>');
    return parts.join('\n');
  }

  function exportSVG() {
    download(baseName() + '_' + stamp() + '.svg', buildExportSVG(1), 'image/svg+xml;charset=utf-8');
    ok('已导出 SVG（当前主题配色）');
  }

  function exportPNG() {
    const svgStr = buildExportSVG(1);
    const bg = cssVars().bg;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const cv = document.createElement('canvas');
      cv.width = img.width * scale; cv.height = img.height * scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(b => {
        download(baseName() + '_' + stamp() + '.png', b, 'image/png');
        ok('已导出 PNG（2 倍分辨率 · 当前主题配色）');
      }, 'image/png');
    };
    img.onerror = () => { ERD.bus.emit('status', { msg: 'PNG 导出失败，可改用 SVG 导出', kind: 'err' }); };
    img.src = url;
  }

  /* ================= 导出：Mermaid ================= */
  function exportMermaid() {
    const p = ERD.store.state.p;
    const esc = s => String(s || '').replace(/"/g, "'");
    const lines = ['erDiagram'];
    p.tables.forEach(t => {
      lines.push('  "' + t.key + '" {');
      t.cols.forEach(c => {
        if (c[2] === 'g') return;
        const tag = c[2] === 'pk' ? ' PK' : c[2] === 'fk' ? ' FK' : c[2] === 'uk' ? ' UK' : '';
        const cm = c[3] ? ' "' + esc(c[3]) + '"' : '';
        lines.push('    ' + (c[1] || 'varchar').replace(/[^\w()]/g, '') + ' ' + c[0].replace(/[^\w]/g, '_') + tag + cm);
      });
      lines.push('  }');
    });
    p.relations.forEach(r => {
      if (r.type === 'fk') {
        const card = r.card === '1:1' ? '||--||' : '||--o{';
        lines.push('  "' + r.parent + '" ' + card + ' "' + r.child + '" : "' + esc(r.col) + '"');
      } else {
        lines.push('  "' + r.from + '" .... "' + r.to + '" : "' + esc(r.label || '逻辑关联') + '"');
      }
    });
    const header = '%%{init: {"theme":"dark"}}%%\n';
    download(baseName() + '_' + stamp() + '.mmd', header + lines.join('\n') + '\n', 'text/plain;charset=utf-8');
    ok('已导出 Mermaid（可用 mermaid.live / Typora 打开）');
  }

  /* ================= 导出：XLSX（零依赖最小实现） ================= */
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files) {  // files: [{name, data(Uint8Array)}]
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    files.forEach(f => {
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const nameB = enc.encode(f.name);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);       // version
      lh.setUint16(6, 0x0800, true);   // UTF-8 名称
      lh.setUint16(8, 0, true);        // STORE
      lh.setUint16(10, 0, true); lh.setUint16(12, 0, true); // time/date
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, nameB.length, true);
      lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nameB, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nameB.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    });
    let cdSize = 0;
    central.forEach(c => cdSize += c.length);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    const total = all.reduce((s, c) => s + c.length, 0);
    const outBuf = new Uint8Array(total);
    let pos = 0;
    all.forEach(c => { outBuf.set(c, pos); pos += c.length; });
    return new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function xmlEsc(s) { return ERD.esc(s); }
  function colLetter(n) { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function sheetXml(rows, widths) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (widths) {
      xml += '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>';
    }
    xml += '<sheetData>';
    rows.forEach((row, ri) => {
      xml += '<row r="' + (ri + 1) + '"' + (ri === 0 ? ' ht="22" customHeight="1"' : '') + '>';
      row.forEach((cell, ci) => {
        if (cell == null || cell === '') return;
        const ref = colLetter(ci) + (ri + 1);
        const style = ri === 0 ? ' s="1"' : '';
        xml += '<c r="' + ref + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + xmlEsc(cell) + '</t></is></c>';
      });
      xml += '</row>';
    });
    xml += '</sheetData></worksheet>';
    return xml;
  }

  function exportXLSX() {
    const p = ERD.store.state.p;
    const zoneName = k => { const z = p.zones.find(x => x.key === k); return z ? z.name : '未分组'; };
    // Sheet1 总览
    const s1 = [
      ['项目', '内容'],
      ['工程名称', p.name],
      ['工程描述', p.description || ''],
      ['数据库类型', p.dbType || 'postgresql'],
      ['表数量', String(p.tables.length)],
      ['字段总数', String(p.tables.reduce((s, t) => s + t.cols.filter(c => c[2] !== 'g').length, 0))],
      ['物理外键', String(p.relations.filter(r => r.type === 'fk').length)],
      ['逻辑关联', String(p.relations.filter(r => r.type === 'logical').length)],
      ['业务域', p.zones.map(z => z.name).join('、')],
      ['导出时间', new Date().toLocaleString('zh-CN')]
    ];
    // Sheet2 表清单
    const s2 = [['表名', '中文名', '所属域', '字段数', '主键', '表说明']];
    p.tables.forEach(t => {
      s2.push([t.key, t.cn || '', zoneName(t.zone), String(t.cols.filter(c => c[2] !== 'g').length),
        t.cols.filter(c => c[2] === 'pk').map(c => c[0]).join(','), t.desc || '']);
    });
    // Sheet3 字段明细
    const s3 = [['表名', '表中文', '字段名', '类型', '标记', '非空', '说明']];
    const flagName = { pk: 'PK', fk: 'FK', uk: 'UK', idx: 'IDX' };
    p.tables.forEach(t => t.cols.forEach(c => {
      if (c[2] === 'g') return;
      s3.push([t.key, t.cn || '', c[0], c[1], flagName[c[2]] || '', (c[4] || c[2] === 'pk') ? '√' : '', c[3] || '']);
    }));
    // Sheet4 关系
    const s4 = [['类型', '子表/起点', '字段', '父表/终点', '父字段', '基数', '说明']];
    p.relations.forEach(r => {
      if (r.type === 'fk') s4.push(['物理外键', r.child, r.col, r.parent, r.parentCol || 'id', r.card || '1:N', '']);
      else s4.push(['逻辑关联', r.from, '', r.to, '', '', r.label || '']);
    });

    const nSheets = 4;
    let wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    let wbSheets = '';
    const sheetNames = ['总览', '表清单', '字段明细', '关系'];
    for (let i = 1; i <= nSheets; i++) {
      wbRels += '<Relationship Id="rId' + i + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + i + '.xml"/>';
      wbSheets += '<sheet name="' + sheetNames[i - 1] + '" sheetId="' + i + '" r:id="rId' + i + '"/>';
    }
    const files = [
      {
        name: '[Content_Types].xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          Array.from({ length: nSheets }, (_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>'
      },
      {
        name: '_rels/.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
      },
      {
        name: 'xl/workbook.xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + wbSheets + '</sheets></workbook>'
      },
      { name: 'xl/_rels/workbook.xml.rels', data: wbRels + '</Relationships>' },
      {
        name: 'xl/styles.xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          '<fonts count="2"><font><sz val="11"/><name val="等线"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="等线"/></font></fonts>' +
          '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
          '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
          '</styleSheet>'
      },
      { name: 'xl/worksheets/sheet1.xml', data: sheetXml(s1, [16, 80]) },
      { name: 'xl/worksheets/sheet2.xml', data: sheetXml(s2, [30, 22, 14, 8, 18, 60]) },
      { name: 'xl/worksheets/sheet3.xml', data: sheetXml(s3, [30, 22, 28, 18, 6, 6, 55]) },
      { name: 'xl/worksheets/sheet4.xml', data: sheetXml(s4, [10, 30, 24, 30, 12, 8, 45]) }
    ];
    download(baseName() + '_数据字典_' + stamp() + '.xlsx', zipStore(files));
    ok('已导出数据字典 Excel（4 个 Sheet）');
  }

  return { parseAuto, importData, exportJSON, exportSQL, exportPNG, exportSVG, exportMermaid, exportXLSX };
})();
