/* ================================================================
   Aneiang ERD Studio · sql.js — SQL DDL 解析与多方言生成
   支持方言：PostgreSQL / MySQL / MariaDB / SQLite / SQL Server
             / Oracle / 达梦 DM / 人大金仓 KingbaseES
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.sql = (function () {

  /* ================= 解析 ================= */
  function parse(text) {
    const warnings = [];
    const tables = [];
    const rels = [];
    const tIndex = {};   // 小写表名 -> 表对象

    const src = String(text || '');
    // 去掉块注释
    const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
    // 去掉行注释（跳过字符串字面量内的 --）
    const clean = stripLineComments(noBlock);

    function ensureTable(name) {
      const lk = name.toLowerCase();
      if (!tIndex[lk]) {
        const t = { key: lk, cn: '', desc: '', zone: '', cols: [], x: 0, y: 0 };
        tables.push(t); tIndex[lk] = t;
      }
      return tIndex[lk];
    }

    /* ---- 扫描 CREATE TABLE（括号配对提取表体，支持双引号/反引号/方括号与 schema 前缀） ---- */
    const ctRe = /CREATE\s+(?:UNLOGGED\s+|TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?/gi;
    let m;
    const createPositions = [];
    while ((m = ctRe.exec(clean)) !== null) createPositions.push({ name: m[1], idx: m.index, after: m.index + m[0].length });
    createPositions.forEach(cp => {
      // PARTITION OF 为物理分区，非逻辑表，跳过
      if (/^\s*PARTITION\s+OF\b/i.test(clean.slice(cp.after, cp.after + 40))) return;
      const t = ensureTable(cp.name);
      const open = clean.indexOf('(', cp.after);
      if (open < 0) { warnings.push('CREATE TABLE ' + cp.name + ' 缺少 "("，已跳过'); return; }
      let depth = 0, end = -1;
      for (let i = open; i < clean.length; i++) {
        const ch = clean[i];
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end < 0) { warnings.push('CREATE TABLE ' + cp.name + ' 括号不匹配，已跳过'); return; }
      const body = clean.substring(open + 1, end);
      // 表尾注释（MySQL）: COMMENT='...' 在 end 与最近分号之间
      const tail = clean.substring(end + 1, clean.indexOf(';', end) > 0 ? clean.indexOf(';', end) : end + 300);
      const tc = tail.match(/COMMENT\s*=?\s*'((?:[^']|'')*)'/i);
      if (tc) t.cn = t.desc = tc[1].replace(/''/g, "'");
      parseTableBody(t, body, rels, warnings);
    });

    /* ---- COMMENT ON (PostgreSQL / Oracle / 达梦) ---- */
    const cotRe = /COMMENT\s+ON\s+TABLE\s+(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?\s+IS\s+'((?:[^']|'')*)'/gi;
    while ((m = cotRe.exec(clean)) !== null) {
      const t = ensureTable(m[1]); const s = m[2].replace(/''/g, "'");
      if (!t.desc) t.desc = s;
      if (!t.cn) t.cn = s.split(/[。;；·,，]/)[0].slice(0, 30);
    }
    const cocRe = /COMMENT\s+ON\s+COLUMN\s+(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?\.["`\[]?([\w$]+)["`\]]?\s+IS\s+'((?:[^']|'')*)'/gi;
    while ((m = cocRe.exec(clean)) !== null) {
      const t = ensureTable(m[1]);
      const c = t.cols.find(x => x[0].toLowerCase() === m[2].toLowerCase());
      if (c) c[3] = m[3].replace(/''/g, "'");
    }

    /* ---- ALTER TABLE ... FOREIGN KEY ---- */
    const fkRe = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?\s+ADD\s+CONSTRAINT\s+[\w$]+\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?\s*(?:\(([^)]+)\))?/gi;
    while ((m = fkRe.exec(clean)) !== null) {
      const child = m[1].toLowerCase(), parent = m[3].toLowerCase();
      const cols = splitCols(m[2]);
      const pcols = m[4] ? splitCols(m[4]) : ['id'];
      cols.forEach((c, i) => {
        ensureTable(child); ensureTable(parent);
        rels.push({ type: 'fk', child, col: c, parent, parentCol: pcols[i] || 'id', card: '1:N' });
      });
    }

    /* ---- CREATE INDEX ---- */
    const ixRe = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w$]+\s+ON\s+(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?\s*(?:USING\s+\w+\s*)?\(([^)]+)\)/gi;
    while ((m = ixRe.exec(clean)) !== null) {
      const t = ensureTable(m[2]);
      splitCols(m[3]).forEach(cn => {
        const c = t.cols.find(x => x[0].toLowerCase() === cn.toLowerCase());
        if (c && !c[2]) c[2] = m[1] ? 'uk' : 'idx';
      });
    }

    /* ---- 外键关系回填 fk 标记 & 自动布局坐标 ---- */
    rels.forEach(r => {
      if (r.type !== 'fk') return;
      const t = tIndex[r.child];
      if (t) { const c = t.cols.find(x => x[0].toLowerCase() === r.col.toLowerCase()); if (c && !c[2]) c[2] = 'fk'; }
    });
    tables.forEach((t, i) => {
      t.x = (i % 5) * 320;
      t.y = Math.floor(i / 5) * 360;
    });

    return { tables, relations: rels, warnings };
  }

  function stripLineComments(s) {
    let out = '', q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { out += ch; if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`' || ch === '[') { q = ch; out += ch; continue; }
      if (ch === ']' && q === '[') { q = null; out += ch; continue; }
      if (ch === '-' && s[i + 1] === '-') {
        const nl = s.indexOf('\n', i);
        if (nl < 0) break;
        out += '\n'; i = nl; continue;
      }
      out += ch;
    }
    return out;
  }

  function splitCols(s) {
    return String(s || '').split(',').map(x => x.trim().replace(/^["`\[]|["`\]]$/g, '')).filter(Boolean);
  }

  function parseTableBody(t, body, rels, warnings) {
    // 按顶层逗号切分
    const parts = [];
    let depth = 0, cur = '', q = null;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (q) {
        cur += ch;
        if (ch === q || (ch === ']' && q === '[')) q = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`' || ch === '[') { q = ch; cur += ch; continue; }
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());

    parts.forEach(part => {
      // 外键约束（含 CONSTRAINT xxx FOREIGN KEY）
      let m = part.match(/^(?:CONSTRAINT\s+[\w$]+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?\s*(?:\(([^)]+)\))?/i);
      if (m) {
        const cols = splitCols(m[1]);
        const pcols = m[3] ? splitCols(m[3]) : ['id'];
        cols.forEach((c, i) => rels.push({ type: 'fk', child: t.key, col: c, parent: m[2].toLowerCase(), parentCol: pcols[i] || 'id', card: '1:N' }));
        return;
      }
      // CONSTRAINT / 裸 PRIMARY KEY / UNIQUE（提取括号内列）
      if (/^(CONSTRAINT\s+[\w$]+\s+)?PRIMARY\s+KEY\s*\(/i.test(part)) {
        splitCols(part.replace(/^(CONSTRAINT\s+[\w$]+\s+)?PRIMARY\s+KEY/i, '').replace(/[()]/g, '')).forEach(cn => {
          const c = t.cols.find(x => x[0].toLowerCase() === cn.toLowerCase()); if (c) c[2] = 'pk';
        });
        return;
      }
      if (/^(CONSTRAINT\s+[\w$]+\s+)?UNIQUE\b/i.test(part)) {
        const inner = part.match(/\(([^)]*)\)/);
        if (inner) splitCols(inner[1]).forEach(cn => {
          const c = t.cols.find(x => x[0].toLowerCase() === cn.toLowerCase()); if (c && !c[2]) c[2] = 'uk';
        });
        return;
      }
      if (/^(KEY|INDEX)\s+[\w$]+\s*\(/i.test(part)) {
        const inner = part.match(/\(([^)]*)\)/);
        if (inner) splitCols(inner[1]).forEach(cn => {
          const c = t.cols.find(x => x[0].toLowerCase() === cn.toLowerCase()); if (c && !c[2]) c[2] = 'idx';
        });
        return;
      }
      if (/^(CHECK|CONSTRAINT|EXCLUDE|PRIMARY|LIKE|INHERITS)\b/i.test(part)) return;
      // 字段定义
      parseColumn(t, part, rels, warnings);
    });
  }

  const MULTIWORD_TYPES = ['DOUBLE PRECISION', 'CHARACTER VARYING', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITHOUT TIME ZONE', 'TIME WITH TIME ZONE', 'BIT VARYING'];
  function parseColumn(t, part, rels, warnings) {
    let rest = part.trim();
    const nameM = rest.match(/^["`\[]?([\w$]+)["`\]]?\s+(.+)$/s);
    if (!nameM) { warnings.push('无法解析字段定义: ' + part.slice(0, 60)); return; }
    const name = nameM[1];
    rest = nameM[2].trim();

    // 提取类型（含多词类型与 (n) 参数）
    let type = '', i = 0;
    const upRest = rest.toUpperCase();
    let matchedMulti = false;
    for (const mt of MULTIWORD_TYPES) {
      if (upRest.startsWith(mt)) { type = rest.slice(0, mt.length); i = mt.length; matchedMulti = true; break; }
    }
    if (!matchedMulti) {
      const wm = rest.match(/^([A-Za-z][\w]*)/);
      if (!wm) { warnings.push('无法识别字段类型: ' + name); return; }
      type = wm[1]; i = wm[0].length;
    }
    // 跳过空格，吃掉 (…)
    while (i < rest.length && /\s/.test(rest[i])) i++;
    if (rest[i] === '(') {
      let d = 0, j = i;
      for (; j < rest.length; j++) { if (rest[j] === '(') d++; else if (rest[j] === ')') { d--; if (!d) break; } }
      type += rest.slice(i, j + 1);
      i = j + 1;
    }
    // [] 数组
    const tailArr = rest.slice(i);
    const arrM = tailArr.match(/^\s*(\[\s*\d*\s*\])+/);
    if (arrM) { type += arrM[1].replace(/\s+/g, ''); i += arrM[0].length; }

    const opts = rest.slice(i);
    const upOpts = opts.toUpperCase();

    let flag = '';
    if (/\bPRIMARY\s+KEY\b/i.test(opts)) flag = 'pk';
    else if (/\bUNIQUE\b/i.test(opts)) flag = 'uk';

    // 非空：先剔除 COMMENT '...' 内容避免注释文本误判
    const nn = /\bNOT\s+NULL\b/i.test(opts.replace(/COMMENT\s+'(?:[^']|'')*'/gi, ''));

    // MySQL 字段注释
    let comment = '';
    const cm = opts.match(/COMMENT\s+'((?:[^']|'')*)'/i);
    if (cm) comment = cm[1].replace(/''/g, "'");

    // 内联 REFERENCES
    const rf = opts.match(/REFERENCES\s+(?:(?:["`\[]?)[\w$]+["`\]]?\.)?["`\[]?([\w$]+)["`\]]?\s*(?:\(([^)]+)\))?/i);
    const col = [name, type, flag, comment, nn || flag === 'pk'];
    t.cols.push(col);
    if (rf) {
      const pcols = rf[2] ? splitCols(rf[2]) : ['id'];
      rels.push({ type: 'fk', child: t.key, col: name, parent: rf[1].toLowerCase(), parentCol: pcols[0] || 'id', card: '1:N' });
      if (!col[2]) col[2] = 'fk';
    }
  }

  /* ================= 生成：多方言 ================= */
  const qv = s => String(s == null ? '' : s).replace(/'/g, "''");
  const INT_RE = /^(bigint|bigserial|int|integer|smallint|serial|mediumint)/i;
  const SERIAL_RE = /serial|bigserial/i;

  /* 类型映射：模型类型（PG 风格）→ 目标方言类型 */
  function makeMap(types, mk) {
    return function (t) {
      const s = String(t || '').trim().toLowerCase();
      if (!s) return mk.varchar(100);
      const arr = /\[\s*\]\s*$/.test(s);
      const base = arr ? s.replace(/\[\s*\]\s*$/, '').trim() : s;
      if (types[base] != null) {
        const v = types[base];
        return (arr && mk.array) ? mk.array(v) : v;
      }
      let m = base.match(/^(varchar|character\s+varying)\s*\(\s*(\d+)\s*\)/);
      if (m) return mk.varchar(+m[2]);
      m = base.match(/^(char|character)\s*\(\s*(\d+)\s*\)/);
      if (m) return mk.char(+m[2]);
      m = base.match(/^(numeric|decimal|number)\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/);
      if (m) return mk.number(+m[2], m[3] ? +m[3] : null);
      if (base === 'timestamptz') return mk.timestamptz();
      if (base === 'timestamp') return mk.timestamp();
      if (arr) return mk.array ? mk.array(base) : s;
      return s;
    };
  }

  /* 通用 COMMENT ON 注释（PG / Kingbase / Oracle / DM） */
  function makeComments(q) {
    return function (t) {
      const arr = [];
      const cm = t.cn ? (t.cn + (t.desc && t.desc !== t.cn ? '：' + t.desc : '')) : t.desc;
      if (cm) arr.push('COMMENT ON TABLE ' + q(t.key) + " IS '" + qv(cm) + "';");
      t.cols.forEach(c => { if (c[2] !== 'g' && c[3]) arr.push('COMMENT ON COLUMN ' + q(t.key) + '.' + q(c[0]) + " IS '" + qv(c[3]) + "';"); });
      return arr;
    };
  }

  /* 通用 ALTER TABLE 外键 */
  function makeFk(q) {
    return r => 'ALTER TABLE ' + q(r.child) + ' ADD CONSTRAINT fk_' + r.child + '_' + r.col +
      ' FOREIGN KEY (' + q(r.col) + ') REFERENCES ' + q(r.parent) + ' (' + q(r.parentCol || 'id') + ');';
  }

  /* 通用 CREATE INDEX */
  function makeIndex(q) {
    return (t, c) => 'CREATE INDEX idx_' + t.key + '_' + c[0] + ' ON ' + q(t.key) + '(' + q(c[0]) + ');';
  }

  /* 通用表说明前置注释（SQLite / SQL Server 无 COMMENT 语句） */
  function makePreTable() {
    return function (t) {
      const cm = t.cn ? (t.cn + (t.desc && t.desc !== t.cn ? '：' + t.desc : '')) : t.desc;
      return cm ? ['-- 表：' + t.key + ' — ' + cm] : [];
    };
  }

  const DIALECTS = {
    postgresql: {
      label: 'PostgreSQL', fileName: 'postgresql',
      q: c => '"' + c + '"',
      mapType: t => String(t || 'varchar(100)').trim(),   // PG 原样保留
      ident(c) { if (c[2] === 'pk' && SERIAL_RE.test(c[1])) return { line: '"' + c[0] + '" ' + c[1], isPk: false }; return null; },
      unique: (t, c) => 'CONSTRAINT uk_' + t.key + '_' + c[0] + ' UNIQUE ("' + c[0] + '")',
      comments: makeComments(c => '"' + c + '"'),
      fk: makeFk(c => '"' + c + '"'),
      index: makeIndex(c => '"' + c + '"'),
      tx: { begin: 'BEGIN;', commit: 'COMMIT;' }
    },

    /* 人大金仓 KingbaseES：兼容 PostgreSQL 语法 */
    kingbase: {
      label: '人大金仓 KingbaseES', fileName: 'kingbase',
      q: c => '"' + c + '"',
      mapType: t => String(t || 'varchar(100)').trim(),
      ident(c) { if (c[2] === 'pk' && SERIAL_RE.test(c[1])) return { line: '"' + c[0] + '" ' + c[1], isPk: false }; return null; },
      unique: (t, c) => 'CONSTRAINT uk_' + t.key + '_' + c[0] + ' UNIQUE ("' + c[0] + '")',
      comments: makeComments(c => '"' + c + '"'),
      fk: makeFk(c => '"' + c + '"'),
      index: makeIndex(c => '"' + c + '"'),
      tx: { begin: 'BEGIN;', commit: 'COMMIT;' }
    },

    mysql: makeMySQLDialect('MySQL', 'mysql'),
    mariadb: makeMySQLDialect('MariaDB', 'mariadb'),

    sqlite: {
      label: 'SQLite', fileName: 'sqlite',
      q: c => '`' + c + '`',
      mapType: makeMap({
        bigint: 'INTEGER', bigserial: 'INTEGER', int: 'INTEGER', integer: 'INTEGER', smallint: 'INTEGER', serial: 'INTEGER', mediumint: 'INTEGER',
        text: 'TEXT', bool: 'INTEGER', boolean: 'INTEGER', date: 'TEXT', time: 'TEXT',
        jsonb: 'TEXT', json: 'TEXT', uuid: 'TEXT', bytea: 'BLOB', money: 'NUMERIC', inet: 'TEXT',
        'double precision': 'REAL', double: 'REAL', real: 'REAL', float: 'REAL', 'float4': 'REAL', 'float8': 'REAL',
        timestamptz: 'TEXT', timestamp: 'TEXT'
      }, {
        varchar: n => 'VARCHAR(' + n + ')', char: n => 'CHAR(' + n + ')',
        number: (p, s) => 'NUMERIC(' + p + (s != null ? ',' + s : '') + ')',
        timestamptz: () => 'TEXT', timestamp: () => 'TEXT', array: () => 'TEXT'
      }),
      ident(c) { if (c[2] === 'pk' && INT_RE.test(c[1])) return { line: '`' + c[0] + '` INTEGER PRIMARY KEY AUTOINCREMENT', isPk: true }; return null; },
      unique: (t, c) => 'UNIQUE (`' + c[0] + '`)',
      fkInline: r => 'FOREIGN KEY (`' + r.col + '`) REFERENCES `' + r.parent + '` (`' + (r.parentCol || 'id') + '`)',
      index: makeIndex(c => '`' + c + '`'),
      preTable: makePreTable(),
      head: ['PRAGMA foreign_keys = ON;'],
      tx: { begin: 'BEGIN;', commit: 'COMMIT;' }
    },

    sqlserver: {
      label: 'SQL Server', fileName: 'sqlserver',
      q: c => '[' + c + ']',
      mapType: makeMap({
        bigint: 'BIGINT', bigserial: 'BIGINT', int: 'INT', integer: 'INT', smallint: 'SMALLINT', serial: 'INT', mediumint: 'INT',
        text: 'NVARCHAR(MAX)', bool: 'BIT', boolean: 'BIT', date: 'DATE', time: 'TIME',
        jsonb: 'NVARCHAR(MAX)', json: 'NVARCHAR(MAX)', uuid: 'UNIQUEIDENTIFIER', bytea: 'VARBINARY(MAX)',
        money: 'MONEY', inet: 'NVARCHAR(45)',
        'double precision': 'FLOAT', double: 'FLOAT', real: 'REAL', float: 'FLOAT', 'float4': 'REAL', 'float8': 'FLOAT',
        timestamptz: 'DATETIMEOFFSET', timestamp: 'DATETIME2'
      }, {
        varchar: n => 'NVARCHAR(' + n + ')', char: n => 'NCHAR(' + n + ')',
        number: (p, s) => 'DECIMAL(' + p + (s != null ? ',' + s : '') + ')',
        timestamptz: () => 'DATETIMEOFFSET', timestamp: () => 'DATETIME2', array: () => 'NVARCHAR(MAX)'
      }),
      ident(c) { if (c[2] === 'pk' && INT_RE.test(c[1])) return { line: '[' + c[0] + '] ' + this.mapType(c[1]) + ' IDENTITY(1,1) NOT NULL', isPk: false }; return null; },
      unique: (t, c) => 'CONSTRAINT uk_' + t.key + '_' + c[0] + ' UNIQUE ([' + c[0] + '])',
      fk: makeFk(c => '[' + c + ']'),
      index: makeIndex(c => '[' + c + ']'),
      preTable: makePreTable(),
      tx: { begin: 'BEGIN TRANSACTION;', commit: 'COMMIT;' }
    },

    oracle: {
      label: 'Oracle', fileName: 'oracle',
      q: c => '"' + c + '"',
      mapType: makeMap({
        bigint: 'NUMBER(19)', bigserial: 'NUMBER(19)', int: 'NUMBER(10)', integer: 'NUMBER(10)', smallint: 'NUMBER(5)', serial: 'NUMBER(10)', mediumint: 'NUMBER(10)',
        text: 'CLOB', bool: 'NUMBER(1)', boolean: 'NUMBER(1)', date: 'DATE', time: 'VARCHAR2(8)',
        jsonb: 'CLOB', json: 'CLOB', uuid: 'VARCHAR2(36)', bytea: 'BLOB', money: 'NUMBER(19,4)', inet: 'VARCHAR2(45)',
        'double precision': 'BINARY_DOUBLE', double: 'BINARY_DOUBLE', real: 'BINARY_FLOAT', float: 'BINARY_DOUBLE', 'float4': 'BINARY_FLOAT', 'float8': 'BINARY_DOUBLE',
        timestamptz: 'TIMESTAMP WITH TIME ZONE', timestamp: 'TIMESTAMP'
      }, {
        varchar: n => 'VARCHAR2(' + n + ')', char: n => 'CHAR(' + n + ')',
        number: (p, s) => 'NUMBER(' + p + (s != null ? ',' + s : '') + ')',
        timestamptz: () => 'TIMESTAMP WITH TIME ZONE', timestamp: () => 'TIMESTAMP', array: () => 'CLOB'
      }),
      ident(c) { if (c[2] === 'pk' && INT_RE.test(c[1])) return { line: '"' + c[0] + '" ' + this.mapType(c[1]) + ' GENERATED BY DEFAULT AS IDENTITY NOT NULL', isPk: false }; return null; },
      unique: (t, c) => 'CONSTRAINT uk_' + t.key + '_' + c[0] + ' UNIQUE ("' + c[0] + '")',
      comments: makeComments(c => '"' + c + '"'),
      fk: makeFk(c => '"' + c + '"'),
      index: makeIndex(c => '"' + c + '"')
    },

    /* 达梦 DM：IDENTITY 自增 + COMMENT ON 注释 */
    dm: {
      label: '达梦 DM', fileName: 'dm',
      q: c => '"' + c + '"',
      mapType: makeMap({
        bigint: 'BIGINT', bigserial: 'BIGINT', int: 'INT', integer: 'INT', smallint: 'SMALLINT', serial: 'INT', mediumint: 'INT',
        text: 'TEXT', bool: 'BIT', boolean: 'BIT', date: 'DATE', time: 'TIME',
        jsonb: 'TEXT', json: 'TEXT', uuid: 'VARCHAR(36)', bytea: 'BLOB', money: 'DECIMAL(19,4)', inet: 'VARCHAR(45)',
        'double precision': 'DOUBLE', double: 'DOUBLE', real: 'REAL', float: 'DOUBLE', 'float4': 'REAL', 'float8': 'DOUBLE',
        timestamptz: 'TIMESTAMP WITH TIME ZONE', timestamp: 'TIMESTAMP'
      }, {
        varchar: n => 'VARCHAR(' + n + ')', char: n => 'CHAR(' + n + ')',
        number: (p, s) => 'NUMBER(' + p + (s != null ? ',' + s : '') + ')',
        timestamptz: () => 'TIMESTAMP WITH TIME ZONE', timestamp: () => 'TIMESTAMP', array: () => 'TEXT'
      }),
      ident(c) { if (c[2] === 'pk' && INT_RE.test(c[1])) return { line: '"' + c[0] + '" ' + this.mapType(c[1]) + ' IDENTITY(1,1)', isPk: false }; return null; },
      unique: (t, c) => 'CONSTRAINT uk_' + t.key + '_' + c[0] + ' UNIQUE ("' + c[0] + '")',
      comments: makeComments(c => '"' + c + '"'),
      fk: makeFk(c => '"' + c + '"'),
      index: makeIndex(c => '"' + c + '"')
    }
  };

  /* MySQL / MariaDB 共用方言 */
  function makeMySQLDialect(label, fileName) {
    return {
      label: label, fileName: fileName,
      q: c => '`' + c + '`',
      mapType: makeMap({
        bigint: 'BIGINT', bigserial: 'BIGINT', int: 'INT', integer: 'INT', smallint: 'SMALLINT', serial: 'INT', mediumint: 'INT',
        text: 'TEXT', bool: 'TINYINT(1)', boolean: 'TINYINT(1)', date: 'DATE', time: 'TIME',
        jsonb: 'JSON', json: 'JSON', uuid: 'CHAR(36)', bytea: 'BLOB', money: 'DECIMAL(19,4)', inet: 'VARCHAR(45)',
        'double precision': 'DOUBLE', double: 'DOUBLE', real: 'FLOAT', float: 'FLOAT', 'float4': 'FLOAT', 'float8': 'DOUBLE',
        timestamptz: 'DATETIME', timestamp: 'DATETIME'
      }, {
        varchar: n => 'VARCHAR(' + n + ')', char: n => 'CHAR(' + n + ')',
        number: (p, s) => 'DECIMAL(' + p + (s != null ? ',' + s : '') + ')',
        timestamptz: () => 'DATETIME', timestamp: () => 'DATETIME', array: () => 'JSON'
      }),
      ident(c) { if (c[2] === 'pk' && INT_RE.test(c[1])) return { line: '`' + c[0] + '` ' + this.mapType(c[1]) + ' AUTO_INCREMENT', isPk: false }; return null; },
      unique: (t, c) => 'UNIQUE KEY uk_' + c[0] + ' (`' + c[0] + '`)',
      inlineComment: c => (c[3] ? " COMMENT '" + qv(c[3]) + "'" : ''),
      tableTail(t) {
        const cm = t.cn ? (t.cn + (t.desc && t.desc !== t.cn ? '：' + t.desc : '')) : (t.desc || '');
        return " COMMENT='" + qv(cm) + "' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
      },
      fk: makeFk(c => '`' + c + '`'),
      index: makeIndex(c => '`' + c + '`')
    };
  }

  function generate(project, dialectKey) {
    const d = DIALECTS[dialectKey] || DIALECTS.postgresql;
    const p = project;
    const out = [];
    /* 可选钩子兜底（inlineComment / tableTail / preTable 仅部分方言提供） */
    const inlineComment = d.inlineComment || (() => '');
    const tableTail = d.tableTail || (() => '');
    const preTable = d.preTable || (() => []);
    const comments = d.comments || (() => []);
    const stamp = '-- 由 Aneiang ERD Studio 生成 · ' + new Date().toLocaleString('zh-CN') +
      '\n-- 工程：' + p.name + (p.description ? ' · ' + p.description : '') +
      '\n-- 目标数据库：' + d.label + '\n';
    out.push(stamp);

    (d.head || []).forEach(h => out.push(h));
    if (d.tx) { out.push(d.tx.begin); out.push(''); }

    const fks = p.relations.filter(r => r.type === 'fk');

    p.tables.forEach(t => {
      const defs = [];
      const skipPk = {};
      t.cols.forEach(c => {
        if (c[2] === 'g') return;
        const ident = d.ident(c);
        if (ident) {
          defs.push(ident.line);
          if (ident.isPk) skipPk[c[0]] = true;
        } else {
          let line = d.q(c[0]) + ' ' + d.mapType(c[1] || 'varchar(100)');
          if (c[2] === 'pk' || c[4]) line += ' NOT NULL';
          line += inlineComment(c);
          defs.push(line);
        }
      });
      const pkCols = t.cols.filter(c => c[2] === 'pk' && !skipPk[c[0]]).map(c => d.q(c[0]));
      if (pkCols.length) defs.push('PRIMARY KEY (' + pkCols.join(', ') + ')');
      t.cols.forEach(c => { if (c[2] === 'uk') { const u = d.unique(t, c); if (u) defs.push(u); } });
      if (d.fkInline) {
        fks.filter(r => r.child === t.key).forEach(r => { const s = d.fkInline(r); if (s) defs.push(s); });
      }
      const items = defs.map((x, i) => '  ' + x + (i < defs.length - 1 ? ',' : ''));
      preTable(t).forEach(x => out.push(x));
      out.push('CREATE TABLE ' + d.q(t.key) + ' (\n' + items.join('\n') + '\n)' + tableTail(t) + ';');
      comments(t).forEach(x => out.push(x));
      out.push('');
    });

    if (!d.fkInline) {
      fks.forEach(r => { const s = d.fk(r); if (s) out.push(s); });
      if (fks.length) out.push('');
    }

    p.tables.forEach(t => {
      t.cols.forEach(c => {
        if (c[2] === 'idx') { const s = d.index(t, c); if (s) out.push(s); }
      });
    });

    const lgs = p.relations.filter(r => r.type === 'logical');
    if (lgs.length) {
      out.push('');
      out.push('-- 逻辑关联（无物理外键）');
      lgs.forEach(r => out.push('-- ' + r.from + ' ⇢ ' + r.to + (r.label ? '：' + r.label : '')));
    }

    if (d.tx) out.push(d.tx.commit);
    return out.join('\n') + '\n';
  }

  return { parse, generate, DIALECTS, dialect: k => DIALECTS[k] || DIALECTS.postgresql };
})();
