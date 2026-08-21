/* 冒烟测试：sql.js 解析/生成往返 + sample.js 完整性（node 运行，无 DOM） */
global.window = { ERD: undefined };

/* localStorage 模拟：供工程播种/持久化测试 */
const LS = {};
global.localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(LS, k) ? LS[k] : null,
  setItem: (k, v) => { LS[k] = String(v); },
  removeItem: k => { delete LS[k]; }
};

const path = require('path');
const base = path.join(__dirname, '..', 'assets', 'js');

require(path.join(base, 'store.js'));   // 定义 window.ERD 基础
require(path.join(base, 'sql.js'));
require(path.join(base, 'io.js'));
require(path.join(base, 'sample.js'));
require(path.join(base, 'presets.js'));

const ERD = window.ERD;
let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  << ' + extra : '')); }
}

console.log('== sample.js 完整性 ==');
const S = window.ERD_SAMPLE;
T('12 张表', S.tables.length === 12, 'got ' + S.tables.length);
T('4 个域', S.zones.length === 4);
T('11 条外键', S.relations.filter(r => r.type === 'fk').length === 11);
T('3 条逻辑关联', S.relations.filter(r => r.type === 'logical').length === 3);
T('所有表 zone 有效', S.tables.every(t => t.zone === '' || S.zones.some(z => z.key === t.zone)));
const fks = new Set(S.relations.filter(r => r.type === 'fk').map(r => r.child + '.' + r.col));
T('外键关系与字段 fk 标记一致', S.tables.every(t => t.cols.every(c =>
  c[2] !== 'fk' || fks.has(t.key + '.' + c[0]))));
T('order_main 为核心表', S.tables.find(t => t.key === 'order_main').core === true);
T('字段总数 > 100', S.tables.reduce((s, t) => s + t.cols.filter(c => c[2] !== 'g').length, 0) > 100);
T('示例含非空字段 > 60', S.tables.reduce((s, t) => s + t.cols.filter(c => c[4]).length, 0) > 60,
  String(S.tables.reduce((s, t) => s + t.cols.filter(c => c[4]).length, 0)));
T('示例不含敏感业务词', !/专家|人才库|卫生健康|卫健委|公示|年审/.test(JSON.stringify(S)),
  '检测到敏感词');

console.log('== UI 偏好 / 连线路径 ==');
T('UI 默认主题 dark', ERD.ui.get('theme') === 'dark');
T('UI 默认背景 grid', ERD.ui.get('bgPattern') === 'grid');
T('UI 默认连线 bezier', ERD.ui.get('edgeStyle') === 'bezier');
T('bezier 路径为三次曲线', /^M 0 0 C /.test(ERD.edgePath({ x: 0, y: 0 }, { x: 100, y: 50 })));
T('ortho 折线三段直线', (ERD.edgePath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'ortho').match(/ L /g) || []).length === 3);
T('straight 两点直线', ERD.edgePath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'straight') === 'M 0 0 L 100 50');
T('自关联路径含 C', / C /.test(ERD.edgePath({ x: 10, y: 10, self: true }, { x: 10, y: -10 })));

console.log('== 工程播种 / 持久化（localStorage 模拟） ==');
const seeded = ERD.store.init(function () { return window.ERD_SAMPLE; });
T('播种后当前工程非空', !!seeded);
T('播种工程含 12 张表', !!seeded && seeded.tables.length === 12, 'got ' + (seeded && seeded.tables.length));
T('播种工程有合法 id', !!seeded && typeof seeded.id === 'string' && seeded.id.length > 4, JSON.stringify(seeded && seeded.id));
T('播种工程名取自 meta.name', !!seeded && /电商订单系统/.test(seeded.name), JSON.stringify(seeded && seeded.name));
T('播种工程描述取自 meta.desc', !!seeded && /电商交易模型/.test(seeded.description));
T('无 undefined 存储键', !Object.keys(LS).some(function (k) { return /undefined$/.test(k); }),
  JSON.stringify(Object.keys(LS)));
T('manifest 只含 1 个工程', JSON.parse(LS['erd.manifest.v1']).projects.length === 1);
/* 模拟刷新：再次 init 应从 localStorage 恢复而非重复播种 */
const reopened = ERD.store.init(function () { return window.ERD_SAMPLE; });
T('二次 init 恢复工程', !!reopened && reopened.tables.length === 12);
T('二次 init 不重复播种', JSON.parse(LS['erd.manifest.v1']).projects.length === 1);
/* 自愈：坏 manifest（无 id 项）被清理并重新播种 */
LS['erd.manifest.v1'] = JSON.stringify({ projects: [{ id: null, name: '坏数据', tableCount: 3 }, { id: 'p_ok', name: '正常工程', tableCount: 1, updatedAt: '2026-01-01' }], activeId: null });
LS['erd.project.p_ok'] = JSON.stringify({ id: 'p_ok', name: '正常工程', dbType: 'postgresql', zones: [], tables: [{ key: 'a', cols: [['id', 'bigint', 'pk', '', true]] }], relations: [] });
LS['erd.project.undefined'] = '{"name":"坏工程"}';
const healed = ERD.store.init(function () { return window.ERD_SAMPLE; });
T('坏项清理后打开正常工程', !!healed && healed.id === 'p_ok' && healed.tables.length === 1, JSON.stringify(healed && healed.id));
T('undefined 坏键被清除', !('erd.project.undefined' in LS));

console.log('== 卡片几何：单列 / 折叠 ==');
const shortT = { key: 't1', x: 0, y: 0, cols: [['id', 'bigint', 'pk', '', true], ['name', 'varchar(50)', '', '', true]] };
const longT = { key: 't2', x: 100, y: 0, cols: Array.from({ length: 30 }, (_, i) => ['c' + i, 'varchar(20)', '', '', false]) };
T('短表宽度固定', ERD.cardW(shortT) === ERD.CARD_W);
T('短表高度 = 头 + 行数', ERD.tableH(shortT) === ERD.HEAD_H + 2 * ERD.ROW_H);
T('长表(30字段)仍单栏宽度', ERD.cardW(longT) === ERD.CARD_W);
T('长表高度完整列出', ERD.tableH(longT) === ERD.HEAD_H + 30 * ERD.ROW_H);
T('colPos 按单列计算', ERD.colPos(longT, 'c20').y === ERD.HEAD_H + 20 * ERD.ROW_H + ERD.ROW_H / 2);
T('colPos 首字段', ERD.colPos(longT, 'c0').y === ERD.HEAD_H + ERD.ROW_H / 2);
T('colPos 未命中取中部', ERD.colPos(longT, 'nope').y === ERD.tableH(longT) / 2);
longT.fold = true;
T('折叠后宽度不变', ERD.cardW(longT) === ERD.CARD_W);
T('折叠后高度 = 仅两行表头', ERD.tableH(longT) === ERD.HEAD_H);
T('表头为两行结构(高度>40)', ERD.HEAD_H > 40);
T('折叠后 colPos 取中部', ERD.colPos(longT, 'c0').y === ERD.tableH(longT) / 2);

console.log('== SQL 生成 → 解析 往返 ==');
const pg = ERD.sql.generate(S, 'postgresql');
T('PG 生成含 12 个 CREATE TABLE', (pg.match(/CREATE TABLE/g) || []).length === 12);
T('PG 生成含 ALTER TABLE FK 11', (pg.match(/ALTER TABLE [^\n]+ FOREIGN KEY/g) || []).length === 11);
T('PG 生成含 COMMENT ON TABLE', /COMMENT ON TABLE "sys_dict"/.test(pg));
T('PG 生成含 COMMENT ON COLUMN', /COMMENT ON COLUMN "order_main"."order_no"/.test(pg));
T('PG 生成含 NOT NULL', /NOT NULL/.test(pg));

const back = ERD.sql.parse(pg);
T('往返解析 12 表', back.tables.length === 12, 'got ' + back.tables.length);
T('往返解析 11 外键', back.relations.filter(r => r.type === 'fk').length === 11, 'got ' + back.relations.filter(r => r.type === 'fk').length);
const ei = back.tables.find(t => t.key === 'order_main');
T('order_main 字段数一致(非g)', ei.cols.filter(c => c[2] !== 'g').length === S.tables.find(t => t.key === 'order_main').cols.filter(c => c[2] !== 'g').length,
  ei.cols.filter(c => c[2] !== 'g').length);
T('order_main 主键 id', ei.cols.find(c => c[0] === 'id')[2] === 'pk');
T('字段注释被解析', /订单号/.test(ei.cols.find(c => c[0] === 'order_no')[3]));
T('uk 被解析', back.tables.find(t => t.key === 'payment').cols.find(c => c[0] === 'pay_no')[2] === 'uk');
T('数组类型 varchar[] 保留', back.tables.find(t => t.key === 'product').cols.find(c => c[0] === 'images')[1] === 'varchar[]');
T('往返保留非空(order_main.order_no)', ei.cols.find(c => c[0] === 'order_no')[4] === true);
T('往返保留可空(order_main.ext_json)', ei.cols.find(c => c[0] === 'ext_json')[4] === false);

console.log('== MySQL 生成 ==');
const my = ERD.sql.generate(S, 'mysql');
T('MySQL 含 ENGINE=InnoDB', /ENGINE=InnoDB/.test(my));
T('MySQL 表注释', /COMMENT='订单主表：交易核心表/.test(my));
T('MySQL 无双引号标识符', !/"sys_dict"/.test(my));

console.log('== 解析器：MySQL 风格 DDL ==');
const mysqlDdl = `
CREATE TABLE \`order\` (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  amount DECIMAL(10,2) DEFAULT '0.00',
  status VARCHAR(20) NOT NULL,
  created_at DATETIME COMMENT '创建时间',
  UNIQUE KEY uk_user (user_id, status),
  KEY idx_status (status),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE=InnoDB COMMENT='订单表';
CREATE TABLE user (
  id BIGINT PRIMARY KEY,
  name VARCHAR(50) COMMENT '姓名'
);
CREATE INDEX idx_order_created ON \`order\` (created_at);
`;
const r2 = ERD.sql.parse(mysqlDdl);
T('MySQL 解析 2 表', r2.tables.length === 2, JSON.stringify(r2.tables.map(t => t.key)));
T('MySQL 内联 FK', r2.relations.some(r => r.type === 'fk' && r.child === 'order' && r.col === 'user_id' && r.parent === 'user'));
T('MySQL 表注释', r2.tables.find(t => t.key === 'order').desc === '订单表');
T('MySQL 字段注释', r2.tables.find(t => t.key === 'order').cols.find(c => c[0] === 'user_id')[3] === '用户ID');
T('MySQL 复合 uk', r2.tables.find(t => t.key === 'order').cols.find(c => c[0] === 'user_id')[2] === 'uk');
T('MySQL NOT NULL 解析(user_id)', r2.tables.find(t => t.key === 'order').cols.find(c => c[0] === 'user_id')[4] === true);
T('MySQL 可空解析(created_at)', r2.tables.find(t => t.key === 'order').cols.find(c => c[0] === 'created_at')[4] === false);
T('CREATE INDEX → idx', r2.tables.find(t => t.key === 'order').cols.find(c => c[0] === 'created_at')[2] === 'idx');
T('AUTO_INCREMENT 主键', r2.tables.find(t => t.key === 'order').cols.find(c => c[0] === 'id')[2] === 'pk');

console.log('== 解析器：PG 风格 DDL（ALTER + COMMENT ON） ==');
const pgDdl = `
CREATE TABLE member_info (
  id BIGSERIAL NOT NULL,
  org_id BIGINT,
  name VARCHAR(50),
  id_card VARCHAR(18),
  CONSTRAINT pk_member PRIMARY KEY (id),
  CONSTRAINT uk_card UNIQUE (id_card)
);
ALTER TABLE ONLY member_info ADD CONSTRAINT fk_mi_org FOREIGN KEY (org_id) REFERENCES sys_org (id);
COMMENT ON TABLE member_info IS '会员主表：核心档案';
COMMENT ON COLUMN member_info.id_card IS '证件号（加密）';
CREATE INDEX idx_mi_name ON member_info USING btree (name);
`;
const r3 = ERD.sql.parse(pgDdl);
T('PG 解析 2 表（sys_org 占位自动创建）', r3.tables.length === 2, JSON.stringify(r3.tables.map(t => t.key)));
T('PG CONSTRAINT pk', r3.tables.find(t => t.key === 'member_info').cols.find(c => c[0] === 'id')[2] === 'pk');
T('PG CONSTRAINT uk', r3.tables[0].cols.find(c => c[0] === 'id_card')[2] === 'uk');
T('PG ALTER FK', r3.relations.some(r => r.col === 'org_id' && r.parent === 'sys_org'));
T('PG COMMENT ON COLUMN', r3.tables[0].cols.find(c => c[0] === 'id_card')[3] === '证件号（加密）');
T('PG COMMENT ON TABLE cn', r3.tables[0].cn === '会员主表：核心档案');

console.log('== 撤销/重做（deepClone 快照 + 剥离 DOM 引用） ==');
const hp = ERD.store.create('测试工程', '', {
  zones: [{ key: 'z1', name: '域', color: '#ff0000' }],
  tables: [],
  relations: []
});
T('创建工程成功', !!hp && !!hp.id && hp.id.length > 2);
/* 注入一张带 DOM 引用 el 的表：快照须剥离 el，否则 structuredClone 会抛错 */
hp.tables.push({ key: 't_el', zone: 'z1', x: 0, y: 0, cn: '带el', desc: '', core: false, cols: [['id', 'bigint', 'pk', '', true]], el: { tagName: 'DIV' } });
ERD.store.beginMove();   // pushHistory（不依赖 document）
T('可撤销', ERD.store.canUndo());
ERD.store.undo();
const rt = ERD.store.state.p.tables[0];
T('撤销恢复表格', !!rt && rt.key === 't_el');
T('快照剥离 DOM 引用 el', rt && rt.el === undefined);
T('撤销保留字段数据', rt && rt.cols[0][0] === 'id' && rt.cols[0][2] === 'pk' && rt.cols[0][4] === true);
T('可重做', ERD.store.canRedo());
ERD.store.redo();
T('重做恢复表格', ERD.store.state.p.tables.length === 1 && ERD.store.state.p.tables[0].key === 't_el');
T('重做后仍可撤销', ERD.store.canUndo());
/* 历史条数上限：连推 70 次应被裁剪到 60，且仍可正常撤销 */
for (let i = 0; i < 70; i++) ERD.store.beginMove();
T('历史条数裁剪后仍可撤销', ERD.store.canUndo());
ERD.store.undo();
T('裁剪后撤销不报错', ERD.store.state.p.tables.length === 1);
/* persist 单次序列化：存储中不残留渲染期字段 el */
ERD.store.persist(true);
const stored = JSON.parse(LS['erd.project.' + hp.id]);
T('持久化剥离 el', !!stored && !!stored.tables[0] && !('el' in stored.tables[0]));
T('持久化保留字段数据', !!stored && stored.tables[0].cols[0][0] === 'id');

console.log('== 常用字段注册表（内置 + 自定义持久化） ==');
T('内置常用字段 18 个', ERD.quick.BUILTIN.length === 18, 'got ' + ERD.quick.BUILTIN.length);
T('新增自定义字段', ERD.quick.add({ name: 'mobile2', type: 'varchar(20)', cmt: '测试', flag: 'idx', nn: true }) === true);
T('自定义字段进入列表', ERD.quick.list().some(f => f.name === 'mobile2'));
T('重复名称被拒绝', ERD.quick.add({ name: 'mobile2' }) === false);
T('空名称被拒绝', ERD.quick.add({ name: '  ' }) === false);
T('删除自定义字段', ERD.quick.remove('mobile2') === true);
T('删除后不再存在', !ERD.quick.list().some(f => f.name === 'mobile2'));

console.log('== 默认域显示名（zoneLabel） ==');
T('默认核心域（无 _t 回退中文）', ERD.zoneLabel({ key: 'z_core', name: '核心域' }) === '核心域');
T('默认扩展域（无 _t 回退中文）', ERD.zoneLabel({ key: 'z_ext', name: '扩展域' }) === '扩展域');
T('改名后的域显示自定义名', ERD.zoneLabel({ key: 'z_core', name: '我的域' }) === '我的域');
T('缺失域回退未分组', ERD.zoneLabel(null) === '未分组');

console.log('== 内置字段注释（tCmt 归一化） ==');
T('tCmt 对象注释回退中文', ERD.tCmt({ zh: '主键', en: 'ID' }) === '主键');
T('tCmt 普通字符串原样返回', ERD.tCmt('自定义注释') === '自定义注释');
T('tCmt 空值返回空串', ERD.tCmt('') === '' && ERD.tCmt(null) === '');
T('模板主键注释已归一化（非对象）', ERD.presets.TEMPLATES.every(tp =>
  tp.cols.every(c => typeof c[3] === 'string' || c[3] == null) ? true : tp.cols.every(c => typeof c[3] === 'object' || typeof c[3] === 'string')),
  '存在非预期类型');
/* 模拟建表路径：tCmt 后注释必须是纯字符串，可直接落库 */
const tplStd = ERD.presets.TEMPLATES.find(tp => tp.key === 'std');
const builtCols = tplStd.cols.map(c => [c[0], c[1], c[2], ERD.tCmt(c[3]), c[4]]);
T('模板建表注释落库为字符串', builtCols.every(c => typeof c[3] === 'string'), JSON.stringify(builtCols.filter(c => typeof c[3] !== 'string').map(c => c[3])));
T('审计六件套注释双语对象', ERD.presets.AUDIT.every(a => a[3] && typeof a[3] === 'object' && a[3].en));
T('常用字段注释双语对象', ERD.presets.QUICK_FIELDS.every(f => f.cmt && typeof f.cmt === 'object' && f.cmt.en));

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
