/* ================================================================
   Aneiang ERD Studio · presets.js — 表模板 / 常用字段库（纯数据，可测试）
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.presets = (function () {

  const AUDIT = [
    ['deleted', 'bool', '', { zh: '逻辑删除', en: 'Deleted' }, false],
    ['version', 'int', '', { zh: '乐观锁', en: 'Optimistic lock' }, false],
    ['created_by', 'bigint', '', { zh: '创建人', en: 'Created by' }, false],
    ['created_at', 'timestamptz', '', { zh: '创建时间', en: 'Created at' }, true],
    ['updated_by', 'bigint', '', { zh: '更新人', en: 'Updated by' }, false],
    ['updated_at', 'timestamptz', '', { zh: '更新时间', en: 'Updated at' }, true]
  ];
  const PK = ['id', 'bigserial', 'pk', { zh: '主键', en: 'ID' }, true];

  /* ---------- 表模板 ---------- */
  const TEMPLATES = [
    {
      key: 'blank', name: { zh: '空白表', en: 'Blank' }, icon: 'ri-file-line',
      desc: { zh: '仅一个自增主键，从零开始', en: 'Just an auto-increment PK, start from scratch' },
      cols: [PK.slice()]
    },
    {
      key: 'std', name: { zh: '标准业务表', en: 'Standard' }, icon: 'ri-table-line',
      desc: { zh: '主键 + 名称/状态/备注 + 审计六件套', en: 'PK + name/status/remark + audit columns' },
      cols: [
        PK.slice(),
        ['name', 'varchar(100)', '', { zh: '名称', en: 'Name' }, true],
        ['status', 'varchar(20)', 'idx', { zh: '状态（字典）', en: 'Status (dict)' }, true],
        ['remark', 'varchar(500)', '', { zh: '备注', en: 'Remark' }, false],
        ['ext_json', 'jsonb', '', { zh: '扩展属性', en: 'Ext props' }, false]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'tree', name: { zh: '树形层级表', en: 'Tree' }, icon: 'ri-node-tree',
      desc: { zh: 'parent_id 自关联 + 层级/排序', en: 'parent_id self-reference + level/sort' },
      cols: [
        PK.slice(),
        ['parent_id', 'bigint', 'fk', { zh: '上级（根=0）', en: 'Parent (root=0)' }, true],
        ['name', 'varchar(100)', '', { zh: '名称', en: 'Name' }, true],
        ['level', 'int', '', { zh: '层级', en: 'Level' }, false],
        ['sort_order', 'int', '', { zh: '排序', en: 'Sort' }, false],
        ['is_leaf', 'bool', '', { zh: '叶子节点', en: 'Is leaf' }, false]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'dict', name: { zh: '字典表', en: 'Dictionary' }, icon: 'ri-book-2-line',
      desc: { zh: 'type+code 唯一的通用枚举', en: 'Generic enum, unique type+code' },
      cols: [
        PK.slice(),
        ['dict_type', 'varchar(50)', 'uk', { zh: '字典类型', en: 'Dict type' }, true],
        ['dict_code', 'varchar(50)', '', { zh: '字典值', en: 'Dict code' }, true],
        ['dict_name', 'varchar(100)', '', { zh: '显示名', en: 'Display name' }, true],
        ['sort_order', 'int', '', { zh: '排序', en: 'Sort' }, false],
        ['enabled', 'bool', '', { zh: '启用', en: 'Enabled' }, true]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'master', name: { zh: '主数据表', en: 'Master Data' }, icon: 'ri-user-3-line',
      desc: { zh: '人员/机构等主体档案：编码唯一 + 联系方式', en: 'Person/org profiles: unique code + contacts' },
      cols: [
        PK.slice(),
        ['code', 'varchar(50)', 'uk', { zh: '业务编码', en: 'Business code' }, true],
        ['name', 'varchar(50)', '', { zh: '名称', en: 'Name' }, true],
        ['phone', 'varchar(20)', '', { zh: '手机号', en: 'Phone' }, false],
        ['email', 'varchar(100)', '', { zh: '邮箱', en: 'Email' }, false],
        ['status', 'varchar(20)', 'idx', { zh: '状态', en: 'Status' }, true],
        ['ext_json', 'jsonb', '', { zh: '扩展', en: 'Ext' }, false]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'rel', name: { zh: '关联中间表', en: 'Junction' }, icon: 'ri-links-line',
      desc: { zh: '多对多关系：两侧外键 + 联合唯一', en: 'Many-to-many: FKs on both sides + unique pair' },
      cols: [
        PK.slice(),
        ['a_id', 'bigint', 'fk', { zh: 'A 侧 ID', en: 'A-side ID' }, true],
        ['b_id', 'bigint', 'fk', { zh: 'B 侧 ID', en: 'B-side ID' }, true],
        ['sort_order', 'int', '', { zh: '排序', en: 'Sort' }, false],
        ['created_at', 'timestamptz', '', { zh: '创建时间', en: 'Created at' }, true]
      ]
    },
    {
      key: 'poly', name: { zh: '多态关联表', en: 'Polymorphic' }, icon: 'ri-shapes-line',
      desc: { zh: 'biz_type + biz_id 挂任意业务对象', en: 'biz_type + biz_id attach to any entity' },
      cols: [
        PK.slice(),
        ['biz_type', 'varchar(40)', '', { zh: '业务类型', en: 'Biz type' }, true],
        ['biz_id', 'bigint', '', { zh: '业务记录 ID', en: 'Biz record ID' }, true],
        ['title', 'varchar(200)', '', { zh: '标题', en: 'Title' }, true],
        ['content', 'text', '', { zh: '内容', en: 'Content' }, false]
      ].concat(AUDIT.map(a => a.slice()))
    }
  ];

  /* ---------- 常用字段库（属性面板一键追加） ---------- */
  const QUICK_FIELDS = [
    { name: 'phone', type: 'varchar(20)', cmt: { zh: '手机号', en: 'Phone' } },
    { name: 'email', type: 'varchar(100)', cmt: { zh: '邮箱', en: 'Email' } },
    { name: 'status', type: 'varchar(20)', cmt: { zh: '状态（字典）', en: 'Status (dict)' }, flag: 'idx', nn: true },
    { name: 'type', type: 'varchar(20)', cmt: { zh: '类型（字典）', en: 'Type (dict)' } },
    { name: 'remark', type: 'varchar(500)', cmt: { zh: '备注', en: 'Remark' } },
    { name: 'content', type: 'text', cmt: { zh: '内容', en: 'Content' } },
    { name: 'sort_order', type: 'int', cmt: { zh: '排序', en: 'Sort' } },
    { name: 'amount', type: 'numeric(10,2)', cmt: { zh: '金额', en: 'Amount' }, nn: true },
    { name: 'quantity', type: 'int', cmt: { zh: '数量', en: 'Quantity' }, nn: true },
    { name: 'code', type: 'varchar(50)', cmt: { zh: '业务编码', en: 'Business code' }, flag: 'uk', nn: true },
    { name: 'start_at', type: 'timestamptz', cmt: { zh: '开始时间', en: 'Start at' } },
    { name: 'end_at', type: 'timestamptz', cmt: { zh: '结束时间', en: 'End at' } },
    { name: 'expired_at', type: 'timestamptz', cmt: { zh: '过期时间', en: 'Expired at' } },
    { name: 'url', type: 'varchar(500)', cmt: { zh: '链接', en: 'URL' } },
    { name: 'ext_json', type: 'jsonb', cmt: { zh: '扩展属性（JSON）', en: 'Ext props (JSON)' } },
    { name: 'tags', type: 'varchar[]', cmt: { zh: '标签数组', en: 'Tags array' } },
    { name: 'weight', type: 'int', cmt: { zh: '权重', en: 'Weight' } },
    { name: 'is_default', type: 'bool', cmt: { zh: '默认项', en: 'Is default' } }
  ];

  return { TEMPLATES, QUICK_FIELDS, AUDIT };
})();

/* ---------- 常用字段注册表（内置 + 自定义，localStorage 持久化） ---------- */
ERD.quick = (function () {
  const KEY = 'erd.quick.v1';
  let extra = [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(v)) {
      extra = v.filter(x => x && typeof x.name === 'string' && x.name.trim())
        .map(x => ({ name: x.name, type: x.type || 'varchar(100)', cmt: ERD.tCmt(x.cmt), flag: x.flag || '', nn: !!x.nn }));
    }
  } catch (e) { /* ignore */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(extra)); } catch (e) { /* ignore */ } }
  /* 完整列表 = 内置 + 自定义 */
  function list() { return ERD.presets.QUICK_FIELDS.concat(extra); }
  function add(f) {
    if (!f || typeof f.name !== 'string') return false;
    const name = f.name.trim();
    if (!name || list().some(x => x.name === name)) return false;
    extra.push({ name, type: f.type || 'varchar(100)', cmt: ERD.tCmt(f.cmt), flag: f.flag || '', nn: !!f.nn });
    save(); return true;
  }
  function remove(name) {
    const i = extra.findIndex(x => x.name === name);
    if (i < 0) return false;
    extra.splice(i, 1); save(); return true;
  }
  return { list, extra: () => extra.slice(), add, remove, BUILTIN: ERD.presets.QUICK_FIELDS };
})();
