/* 验证混淆产物功能完好：按 index.html 的加载顺序加载 dist 中的 JS，
   跑与源码冒烟测试同等的断言（Node 环境，无 DOM） */
global.window = { ERD: undefined };

const fs = require('fs');
const path = require('path');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const base = path.join(__dirname, '..', 'dist', 'assets', 'js');

/* 按 store → sql → io → sample 的依赖顺序加载（render/interact/editor/app 依赖 DOM，跳过） */
['store.js', 'sql.js', 'io.js', 'sample.js'].forEach(f => {
  const p = path.join(base, manifest.js[f]);
  if (!fs.existsSync(p)) { console.error('缺失文件: ' + f); process.exit(1); }
  require(p);
});

const ERD = window.ERD;
const S = window.ERD_SAMPLE;
let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  << ' + extra : '')); }
}

console.log('== 混淆产物 · 功能验证 ==');
T('ERD 命名空间完好', !!ERD && !!ERD.store && !!ERD.sql && !!ERD.io);
T('示例工程 12 张表', S.tables.length === 12, 'got ' + S.tables.length);
T('示例工程 4 个域', S.zones.length === 4);
T('字段总数 > 100', S.tables.reduce((s, t) => s + t.cols.filter(c => c[2] !== 'g').length, 0) > 100);
T('非空字段 > 60', S.tables.reduce((s, t) => s + t.cols.filter(c => c[4]).length, 0) > 60);
T('默认主题 dark', ERD.ui.get('theme') === 'dark');
T('默认背景 grid', ERD.ui.get('bgPattern') === 'grid');
T('默认连线 bezier', ERD.ui.get('edgeStyle') === 'bezier');
T('bezier 路径生成', /^M 0 0 C /.test(ERD.edgePath({ x: 0, y: 0 }, { x: 100, y: 50 })));
T('ortho 折线生成', (ERD.edgePath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'ortho').match(/ L /g) || []).length === 3);

console.log('== SQL 生成/解析 往返（混淆后） ==');
const pg = ERD.sql.generate(S, 'postgresql');
T('生成 12 个 CREATE TABLE', (pg.match(/CREATE TABLE/g) || []).length === 12);
const back = ERD.sql.parse(pg);
T('回解析 12 张表', back.tables.length === 12, 'got ' + back.tables.length);
const ei = back.tables.find(t => t.key === 'order_main');
T('order_main 存在', !!ei);
T('非空标记保留', ei.cols.find(c => c[0] === 'order_no')[4] === true);
T('可空标记保留', ei.cols.find(c => c[0] === 'ext_json')[4] === false);

console.log('== 卡片几何（混淆后） ==');
const t1 = { key: 't1', x: 0, y: 0, cols: [['id', 'bigint', 'pk', '', true], ['name', 'varchar(50)', '', '', true]] };
T('卡片宽度', ERD.cardW(t1) === ERD.CARD_W);
T('卡片高度', ERD.tableH(t1) === ERD.HEAD_H + 2 * ERD.ROW_H);
T('字段锚点', ERD.colPos(t1, 'name').y === ERD.HEAD_H + 1 * ERD.ROW_H + ERD.ROW_H / 2);
t1.fold = true;
T('折叠高度', ERD.tableH(t1) === ERD.HEAD_H);

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
if (fail > 0) process.exit(1);
