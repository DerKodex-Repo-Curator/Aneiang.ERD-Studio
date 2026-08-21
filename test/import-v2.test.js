/* SQL 导入回归测试：电商订单系统完整 DDL（内联，由内置示例生成风格） */
global.window = { ERD: undefined };
const path = require('path');
const base = path.join(__dirname, '..', 'assets', 'js');
require(path.join(base, 'store.js'));
require(path.join(base, 'sql.js'));
require(path.join(base, 'io.js'));

const ERD = window.ERD;

const DDL = `
-- 工程：电商订单系统（演示）
CREATE TABLE sys_user (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(50),
  user_role VARCHAR(20) NOT NULL DEFAULT 'buyer',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  ext_json JSONB,
  deleted BOOL NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE sys_user IS '系统用户';
COMMENT ON COLUMN sys_user.username IS '登录名';

CREATE TABLE sys_address (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES sys_user(id),
  receiver VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  province VARCHAR(20) NOT NULL,
  city VARCHAR(20) NOT NULL,
  district VARCHAR(20) NOT NULL,
  detail VARCHAR(200) NOT NULL,
  is_default BOOL NOT NULL DEFAULT FALSE,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE sys_address IS '收货地址';

CREATE TABLE shop (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL,
  shop_name VARCHAR(100) NOT NULL,
  logo_url VARCHAR(500),
  category VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  ext_json JSONB,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE shop IS '店铺';

CREATE TABLE category (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES category(id),
  cat_name VARCHAR(50) NOT NULL,
  level INT NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  is_leaf BOOL DEFAULT TRUE,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE category IS '商品类目';

CREATE TABLE product (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL REFERENCES shop(id),
  category_id BIGINT NOT NULL REFERENCES category(id),
  product_name VARCHAR(200) NOT NULL,
  subtitle VARCHAR(200),
  main_image VARCHAR(500),
  images VARCHAR[],
  price NUMERIC(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  sales_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'on_sale',
  ext_json JSONB,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE product IS '商品';
COMMENT ON COLUMN product.images IS '相册图数组';

CREATE TABLE order_main (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  shop_id BIGINT NOT NULL,
  address_id BIGINT REFERENCES sys_address(id),
  total_amount NUMERIC(10,2) NOT NULL,
  freight NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  pay_amount NUMERIC(10,2) NOT NULL,
  order_status VARCHAR(20) NOT NULL DEFAULT 'created',
  pay_method VARCHAR(20),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  remark VARCHAR(500),
  ext_json JSONB,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE order_main IS '订单主表：交易核心';
COMMENT ON COLUMN order_main.order_no IS '订单号';

CREATE TABLE order_item (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES order_main(id),
  product_id BIGINT NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  image_url VARCHAR(500),
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE order_item IS '订单明细';

CREATE TABLE payment (
  id BIGSERIAL PRIMARY KEY,
  pay_no VARCHAR(32) NOT NULL UNIQUE,
  order_id BIGINT NOT NULL REFERENCES order_main(id),
  pay_channel VARCHAR(20) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  pay_status VARCHAR(20) NOT NULL DEFAULT 'created',
  transaction_id VARCHAR(64),
  paid_at TIMESTAMPTZ,
  callback_at TIMESTAMPTZ,
  ext_json JSONB,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE payment IS '支付单';

CREATE TABLE shipment (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES order_main(id),
  shipment_no VARCHAR(32) NOT NULL UNIQUE,
  carrier VARCHAR(50) NOT NULL,
  tracking_no VARCHAR(64),
  ship_status VARCHAR(20) NOT NULL DEFAULT 'created',
  shipped_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE shipment IS '发货单';

CREATE TABLE review (
  id BIGSERIAL PRIMARY KEY,
  order_item_id BIGINT NOT NULL REFERENCES order_item(id),
  user_id BIGINT NOT NULL,
  parent_id BIGINT REFERENCES review(id),
  score INT NOT NULL,
  content TEXT NOT NULL,
  images VARCHAR[],
  reply_from_seller TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'normal',
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE review IS '商品评价';

CREATE TABLE sys_notification (
  id BIGSERIAL PRIMARY KEY,
  biz_type VARCHAR(40) NOT NULL,
  biz_id BIGINT,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  target_user_id BIGINT,
  channels VARCHAR[],
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  deleted BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE sys_notification IS '站内通知';

ALTER TABLE shop ADD CONSTRAINT fk_shop_owner FOREIGN KEY (owner_user_id) REFERENCES sys_user (id);
ALTER TABLE order_main ADD CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES sys_user (id);
ALTER TABLE order_main ADD CONSTRAINT fk_order_shop FOREIGN KEY (shop_id) REFERENCES shop (id);
CREATE INDEX idx_order_status ON order_main USING btree (order_status);
CREATE INDEX idx_product_shop ON product USING btree (shop_id);
`;

const t0 = Date.now();
const r = ERD.io.parseAuto(DDL);
console.log('解析耗时:', Date.now() - t0, 'ms');
console.log('ok:', r.ok, 'kind:', r.kind);
if (!r.ok) { console.error('ERROR:', r.error); process.exit(1); }
console.log('表:', r.tables.length, '外键关系:', r.relations.length, '警告:', (r.warnings || []).length);

let pass = 0, fail = 0;
const T = (n, c, x) => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (x ? '  << ' + x : '')); } };

T('识别为 schema', r.kind === 'schema');
T('解析出 11 张表', r.tables.length === 11, String(r.tables.length));
const fks = r.relations.filter(x => x.type === 'fk');
T('解析出 13 条外键（10 内联 + 3 ALTER）', fks.length === 13, String(fks.length));
const om = r.tables.find(t => t.key === 'order_main');
T('order_main 存在', !!om);
T('order_main 含字段数 > 15', om.cols.filter(c => c[2] !== 'g').length > 15, String(om ? om.cols.length : 0));
T('order_main.id 为主键', om.cols.find(c => c[0] === 'id') && om.cols.find(c => c[0] === 'id')[2] === 'pk');
T('order_main 有中文说明', !!om.cn && om.cn.length > 3, JSON.stringify(om.cn));
T('NOT NULL 解析：order_main.order_no 非空', om.cols.find(c => c[0] === 'order_no')[4] === true);
T('NOT NULL 解析：可空字段为空', om.cols.find(c => c[0] === 'ext_json')[4] === false);
T('全库非空字段 > 50', r.tables.reduce((s, t) => s + t.cols.filter(c => c[4]).length, 0) > 50);
const pay = r.tables.find(t => t.key === 'payment');
T('pay_no 标记 uk', pay.cols.find(c => c[0] === 'pay_no')[2] === 'uk');
T('category.parent_id 自关联外键', fks.some(x => x.child === 'category' && x.col === 'parent_id' && x.parent === 'category'));
T('ALTER TABLE 外键解析', fks.some(x => x.child === 'order_main' && x.col === 'user_id' && x.parent === 'sys_user'));
T('数组类型 VARCHAR[] 解析', r.tables.find(t => t.key === 'product').cols.find(c => c[0] === 'images')[1].toLowerCase() === 'varchar[]');
T('内联 REFERENCES 外键', fks.some(x => x.child === 'sys_address' && x.col === 'user_id' && x.parent === 'sys_user'));
if (r.warnings && r.warnings.length) console.log('  警告明细(前10):', r.warnings.slice(0, 10));

/* JSON 导入识别 */
const j = ERD.io.parseAuto(JSON.stringify({ name: 'x', tables: [{ key: 'a', cols: [['id', 'bigint', 'pk', '']] }], relations: [] }));
T('JSON 工程识别', j.ok && j.kind === 'project' && j.project.tables.length === 1);
T('JSON 对象式字段 nn 导入', ERD.io.parseAuto(JSON.stringify({
  name: 'x', tables: [{ key: 'a', cols: [{ name: 'n', type: 'varchar(10)', nn: true }] }], relations: []
})).project.tables[0].cols[0][4] === true);
const j2 = ERD.io.parseAuto('这不是SQL');
T('非法内容报错', !j2.ok);

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
