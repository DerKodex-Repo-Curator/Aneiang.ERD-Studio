/* ================================================================
   Aneiang ERD Studio · presets.js — 表模板 / 常用字段库（纯数据，可测试）
   ================================================================ */
var ERD = window.ERD = window.ERD || {};
ERD.presets = (function () {

  const AUDIT = [
    ['deleted', 'bool', '', '逻辑删除', false],
    ['version', 'int', '', '乐观锁', false],
    ['created_by', 'bigint', '', '创建人', false],
    ['created_at', 'timestamptz', '', '创建时间', true],
    ['updated_by', 'bigint', '', '更新人', false],
    ['updated_at', 'timestamptz', '', '更新时间', true]
  ];
  const PK = ['id', 'bigserial', 'pk', '主键', true];

  /* ---------- 表模板 ---------- */
  const TEMPLATES = [
    {
      key: 'blank', name: '空白表', icon: 'ri-file-line',
      desc: '仅一个自增主键，从零开始',
      cols: [PK.slice()]
    },
    {
      key: 'std', name: '标准业务表', icon: 'ri-table-line',
      desc: '主键 + 名称/状态/备注 + 审计六件套',
      cols: [
        PK.slice(),
        ['name', 'varchar(100)', '', '名称', true],
        ['status', 'varchar(20)', 'idx', '状态（字典）', true],
        ['remark', 'varchar(500)', '', '备注', false],
        ['ext_json', 'jsonb', '', '扩展属性', false]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'tree', name: '树形层级表', icon: 'ri-node-tree',
      desc: 'parent_id 自关联 + 层级/排序',
      cols: [
        PK.slice(),
        ['parent_id', 'bigint', 'fk', '上级（根=0）', true],
        ['name', 'varchar(100)', '', '名称', true],
        ['level', 'int', '', '层级', false],
        ['sort_order', 'int', '', '排序', false],
        ['is_leaf', 'bool', '', '叶子节点', false]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'dict', name: '字典表', icon: 'ri-book-2-line',
      desc: 'type+code 唯一的通用枚举',
      cols: [
        PK.slice(),
        ['dict_type', 'varchar(50)', 'uk', '字典类型', true],
        ['dict_code', 'varchar(50)', '', '字典值', true],
        ['dict_name', 'varchar(100)', '', '显示名', true],
        ['sort_order', 'int', '', '排序', false],
        ['enabled', 'bool', '', '启用', true]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'master', name: '主数据表', icon: 'ri-user-3-line',
      desc: '人员/机构等主体档案：编码唯一 + 联系方式',
      cols: [
        PK.slice(),
        ['code', 'varchar(50)', 'uk', '业务编码', true],
        ['name', 'varchar(50)', '', '名称', true],
        ['phone', 'varchar(20)', '', '手机号', false],
        ['email', 'varchar(100)', '', '邮箱', false],
        ['status', 'varchar(20)', 'idx', '状态', true],
        ['ext_json', 'jsonb', '', '扩展', false]
      ].concat(AUDIT.map(a => a.slice()))
    },
    {
      key: 'rel', name: '关联中间表', icon: 'ri-links-line',
      desc: '多对多关系：两侧外键 + 联合唯一',
      cols: [
        PK.slice(),
        ['a_id', 'bigint', 'fk', 'A 侧 ID', true],
        ['b_id', 'bigint', 'fk', 'B 侧 ID', true],
        ['sort_order', 'int', '', '排序', false],
        ['created_at', 'timestamptz', '', '创建时间', true]
      ]
    },
    {
      key: 'poly', name: '多态关联表', icon: 'ri-shapes-line',
      desc: 'biz_type + biz_id 挂任意业务对象',
      cols: [
        PK.slice(),
        ['biz_type', 'varchar(40)', '', '业务类型', true],
        ['biz_id', 'bigint', '', '业务记录 ID', true],
        ['title', 'varchar(200)', '', '标题', true],
        ['content', 'text', '', '内容', false]
      ].concat(AUDIT.map(a => a.slice()))
    }
  ];

  /* ---------- 常用字段库（属性面板一键追加） ---------- */
  const QUICK_FIELDS = [
    { name: 'phone', type: 'varchar(20)', cmt: '手机号' },
    { name: 'email', type: 'varchar(100)', cmt: '邮箱' },
    { name: 'status', type: 'varchar(20)', cmt: '状态（字典）', flag: 'idx', nn: true },
    { name: 'type', type: 'varchar(20)', cmt: '类型（字典）' },
    { name: 'remark', type: 'varchar(500)', cmt: '备注' },
    { name: 'content', type: 'text', cmt: '内容' },
    { name: 'sort_order', type: 'int', cmt: '排序' },
    { name: 'amount', type: 'numeric(10,2)', cmt: '金额', nn: true },
    { name: 'quantity', type: 'int', cmt: '数量', nn: true },
    { name: 'code', type: 'varchar(50)', cmt: '业务编码', flag: 'uk', nn: true },
    { name: 'start_at', type: 'timestamptz', cmt: '开始时间' },
    { name: 'end_at', type: 'timestamptz', cmt: '结束时间' },
    { name: 'expired_at', type: 'timestamptz', cmt: '过期时间' },
    { name: 'url', type: 'varchar(500)', cmt: '链接' },
    { name: 'ext_json', type: 'jsonb', cmt: '扩展属性（JSON）' },
    { name: 'tags', type: 'varchar[]', cmt: '标签数组' },
    { name: 'weight', type: 'int', cmt: '权重' },
    { name: 'is_default', type: 'bool', cmt: '默认项' }
  ];

  return { TEMPLATES, QUICK_FIELDS, AUDIT };
})();
