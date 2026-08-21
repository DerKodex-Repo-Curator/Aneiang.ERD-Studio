/* ================================================================
   Aneiang ERD Studio · sample.js — 内置演示工程
   通用电商订单系统（12 表 / 4 域），无任何真实业务信息
   演示特性：多态关联 / 字典表 / 审计六件套 / 数组字段 / 自关联 /
            逻辑关联 / 大字段 jsonb / 乐观锁 / 逻辑删除
   ================================================================ */
window.ERD_SAMPLE = (function () {
  const D = {
    base:    {name:'基础设置', color:'#7dcfff'},
    trade:   {name:'交易',     color:'#e0af68'},
    goods:   {name:'商品',     color:'#73daca'},
    support: {name:'支撑能力', color:'#bb9af7'}
  };
  const AUDIT = [
    ['deleted','bool','','逻辑删除'],['version','int','','乐观锁'],
    ['created_by','bigint','','创建人'],['created_at','timestamptz','','创建时间'],
    ['updated_by','bigint','','更新人'],['updated_at','timestamptz','','更新时间']
  ];
  const TABLES = [
  {key:'sys_dict', zone:'base', x:60, y:96, cn:'数据字典',
   desc:'全局枚举字典（订单状态/支付方式/物流方式…），type+code 唯一。',
   cols:[
    ['id','bigint','pk','主键'],
    ['dict_type','varchar(50)','uk','字典类型 order_status/pay_method…'],
    ['dict_code','varchar(50)','','字典值'],
    ['dict_name','varchar(100)','','显示名'],
    ['sort_order','int','','排序'],
    ['enabled','bool','','启用'],
    ['ext_json','jsonb','','扩展'],
    ...AUDIT
   ]},
  {key:'sys_user', zone:'base', x:60, y:520, cn:'系统用户',
   desc:'平台用户主表，含买家/卖家/运营多种角色。',
   cols:[
    ['id','bigint','pk','主键'],
    ['username','varchar(50)','uk','登录名'],
    ['phone','varchar(20)','uk','手机号'],
    ['password_hash','varchar(255)','','密码哈希'],
    ['real_name','varchar(50)','','姓名'],
    ['avatar_url','varchar(500)','','头像'],
    ['user_role','varchar(20)','idx','buyer/seller/admin'],
    ['status','varchar(20)','idx','active/frozen'],
    ['last_login_at','timestamptz','','最后登录'],
    ['ext_json','jsonb','','扩展'],
    ...AUDIT
   ]},
  {key:'sys_address', zone:'base', x:60, y:1010, cn:'收货地址',
   desc:'用户收货地址簿，默认地址用 is_default 标记。',
   cols:[
    ['id','bigint','pk','主键'],
    ['user_id','bigint','idx','所属用户'],
    ['receiver','varchar(50)','','收件人'],
    ['phone','varchar(20)','','联系电话'],
    ['province','varchar(20)','','省'],
    ['city','varchar(20)','','市'],
    ['district','varchar(20)','','区'],
    ['detail','varchar(200)','','详细地址'],
    ['is_default','bool','','默认地址'],
    ...AUDIT
   ]},
  {key:'shop', zone:'goods', x:480, y:96, cn:'店铺',
   desc:'卖家店铺，一个用户可开多店（演示自关联 + 扩展字段）。',
   cols:[
    ['id','bigint','pk','主键'],
    ['owner_user_id','bigint','idx','店主用户'],
    ['shop_name','varchar(100)','','店铺名'],
    ['logo_url','varchar(500)','','店招图'],
    ['category','varchar(20)','idx','主营类目（字典 shop_cat）'],
    ['status','varchar(20)','idx','open/closed'],
    ['ext_json','jsonb','','扩展（客服配置等）'],
    ...AUDIT
   ]},
  {key:'category', zone:'goods', x:480, y:520, cn:'商品类目',
   desc:'类目树，parent_id 自关联支持多级类目。',
   cols:[
    ['id','bigint','pk','主键'],
    ['parent_id','bigint','fk','上级类目（根=0）'],
    ['cat_name','varchar(50)','','类目名'],
    ['level','int','','层级 1/2/3'],
    ['sort_order','int','','排序'],
    ['is_leaf','bool','','叶子类目'],
    ...AUDIT
   ]},
  {key:'product', zone:'goods', x:480, y:1010, cn:'商品',
   desc:'商品主表，价格快照存订单明细，避免改价影响历史订单。',
   cols:[
    ['id','bigint','pk','主键'],
    ['shop_id','bigint','fk','所属店铺'],
    ['category_id','bigint','fk','类目'],
    ['product_name','varchar(200)','','商品名'],
    ['subtitle','varchar(200)','','副标题'],
    ['main_image','varchar(500)','','主图'],
    ['images','varchar[]','','相册图数组'],
    ['price','numeric(10,2)','','现价'],
    ['stock','int','','库存'],
    ['sales_count','int','','累计销量'],
    ['status','varchar(20)','idx','on_sale/off_sale'],
    ['ext_json','jsonb','','扩展（运费模板等）'],
    ...AUDIT
   ]},
  {key:'order_main', zone:'trade', x:900, y:96, cn:'订单主表',
   desc:'交易核心表。金额字段 numeric 精确存储；状态机内联主表，避免拆表臃肿。',
   cols:[
    ['id','bigint','pk','主键'],
    ['order_no','varchar(32)','uk','订单号'],
    ['user_id','bigint','idx','买家'],
    ['shop_id','bigint','idx','店铺'],
    ['address_id','bigint','fk','收货地址快照'],
    ['total_amount','numeric(10,2)','','商品总额'],
    ['freight','numeric(10,2)','','运费'],
    ['discount_amount','numeric(10,2)','','优惠金额'],
    ['pay_amount','numeric(10,2)','','实付金额'],
    ['order_status','varchar(20)','idx','状态机 paid/shipped/done/closed'],
    ['pay_method','varchar(20)','','支付方式（字典 pay_method）'],
    ['paid_at','timestamptz','','支付时间'],
    ['shipped_at','timestamptz','','发货时间'],
    ['completed_at','timestamptz','','完成时间'],
    ['remark','varchar(500)','','买家留言'],
    ['ext_json','jsonb','','扩展'],
    ...AUDIT
   ]},
  {key:'order_item', zone:'trade', x:900, y:660, cn:'订单明细',
   desc:'快照商品名称/价格/图片，商品后续改价或删除不影响此单。',
   cols:[
    ['id','bigint','pk','主键'],
    ['order_id','bigint','fk','所属订单'],
    ['product_id','bigint','idx','商品引用'],
    ['product_name','varchar(200)','','名称快照'],
    ['image_url','varchar(500)','','图片快照'],
    ['unit_price','numeric(10,2)','','成交单价快照'],
    ['quantity','int','','数量'],
    ['subtotal','numeric(10,2)','','小计'],
    ...AUDIT
   ]},
  {key:'payment', zone:'trade', x:900, y:1010, cn:'支付单',
   desc:'对接三方支付，一笔订单可能多次尝试（演示状态机 + 回调留痕）。',
   cols:[
    ['id','bigint','pk','主键'],
    ['pay_no','varchar(32)','uk','支付流水号'],
    ['order_id','bigint','fk','订单'],
    ['pay_channel','varchar(20)','','wx/alipay/balance'],
    ['amount','numeric(10,2)','','金额'],
    ['pay_status','varchar(20)','idx','created/success/failed/refunded'],
    ['transaction_id','varchar(64)','','三方交易号'],
    ['paid_at','timestamptz','','支付成功时间'],
    ['callback_at','timestamptz','','回调时间'],
    ['ext_json','jsonb','','三方原始报文'],
    ...AUDIT
   ]},
  {key:'shipment', zone:'trade', x:1260, y:96, cn:'发货单',
   desc:'一单可多次发货（拆包），每张发货单对应一个物流单号。',
   cols:[
    ['id','bigint','pk','主键'],
    ['order_id','bigint','fk','订单'],
    ['shipment_no','varchar(32)','uk','发货单号'],
    ['carrier','varchar(50)','','承运商（字典 carrier）'],
    ['tracking_no','varchar(64)','','物流单号'],
    ['ship_status','varchar(20)','idx','created/in_transit/signed'],
    ['shipped_at','timestamptz','','发货时间'],
    ['signed_at','timestamptz','','签收时间'],
    ...AUDIT
   ]},
  {key:'review', zone:'support', x:1260, y:520, cn:'商品评价',
   desc:'订单完成后评价，一单一商品一条；回复走 parent_id 楼中楼（自关联）。',
   cols:[
    ['id','bigint','pk','主键'],
    ['order_item_id','bigint','fk','订单明细'],
    ['user_id','bigint','idx','评价人'],
    ['parent_id','bigint','fk','父评价（回复）'],
    ['score','int','','1-5 星'],
    ['content','text','','评价内容'],
    ['images','varchar[]','','晒图数组'],
    ['reply_from_seller','text','','卖家回复'],
    ['status','varchar(20)','idx','normal/hidden'],
    ...AUDIT
   ]},
  {key:'sys_notification', zone:'support', x:1260, y:1010, cn:'站内通知',
   desc:'订单/物流/评价通知统一管理，biz_type+biz_id 多态关联业务（演示多态）。',
   cols:[
    ['id','bigint','pk','主键'],
    ['biz_type','varchar(40)','','order/shipment/review/system'],
    ['biz_id','bigint','','业务ID（多态关联）'],
    ['title','varchar(200)','','标题'],
    ['content','text','','内容'],
    ['target_user_id','bigint','idx','接收人（NULL=广播）'],
    ['channels','varchar[]','','渠道数组 in_app/sms'],
    ['read_at','timestamptz','','已读时间'],
    ['sent_at','timestamptz','','发送时间'],
    ...AUDIT
   ]}
  ];

  /* 物理外键（真实约束）与逻辑关联（无约束的业务依存） */
  const RELS = [
    ['sys_address','user_id','sys_user'],
    ['category','parent_id','category'],
    ['product','shop_id','shop'],
    ['product','category_id','category'],
    ['order_main','address_id','sys_address'],
    ['order_item','order_id','order_main'],
    ['order_item','product_id','product'],
    ['payment','order_id','order_main'],
    ['shipment','order_id','order_main'],
    ['review','order_item_id','order_item'],
    ['review','parent_id','review']
  ].map(r => ({ type: 'fk', child: r[0], col: r[1], parent: r[2] }));

  const LOGICAL = [
    { type: 'logical', from: 'order_main', to: 'shop', label: '同店铺聚合查询' },
    { type: 'logical', from: 'order_main', to: 'sys_dict', label: '状态字典' },
    { type: 'logical', from: 'review', to: 'product', label: '商品评分聚合' }
  ];

  /* 非空标注：主键隐含非空；业务关键字段为 NOT NULL */
  const NN = {
    "sys_dict": ["dict_type", "dict_code", "dict_name", "sort_order", "enabled", "created_at", "updated_at"],
    "sys_user": ["username", "phone", "password_hash", "user_role", "status", "created_at", "updated_at"],
    "sys_address": ["user_id", "receiver", "phone", "province", "city", "district", "detail", "created_at", "updated_at"],
    "shop": ["owner_user_id", "shop_name", "category", "status", "created_at", "updated_at"],
    "category": ["parent_id", "cat_name", "level", "created_at", "updated_at"],
    "product": ["shop_id", "category_id", "product_name", "price", "stock", "status", "created_at", "updated_at"],
    "order_main": ["order_no", "user_id", "shop_id", "total_amount", "freight", "pay_amount", "order_status", "created_at", "updated_at"],
    "order_item": ["order_id", "product_id", "product_name", "unit_price", "quantity", "subtotal", "created_at", "updated_at"],
    "payment": ["pay_no", "order_id", "pay_channel", "amount", "pay_status", "created_at", "updated_at"],
    "shipment": ["order_id", "shipment_no", "carrier", "ship_status", "created_at", "updated_at"],
    "review": ["order_item_id", "user_id", "score", "content", "created_at", "updated_at"],
    "sys_notification": ["biz_type", "title", "created_at", "updated_at"]
  };
  const NN_SET = {};
  Object.keys(NN).forEach(k => { NN_SET[k] = new Set(NN[k]); });

  const zmap = { base: 'base', trade: 'trade', goods: 'goods', support: 'support' };

  return {
    meta: { name: '电商订单系统 · 演示工程', desc: '通用电商交易模型，用于演示平台全部能力' },
    zones: Object.keys(D).map(k => ({ key: k, name: D[k].name, color: D[k].color })),
    tables: TABLES.map(t => ({
      key: t.key, zone: zmap[t.zone] || '', x: t.x, y: t.y,
      cn: t.cn, desc: t.desc || '', core: t.key === 'order_main',
      cols: t.cols.map(c => [c[0], c[1], c[2], c[3], !!(NN_SET[t.key] && NN_SET[t.key].has(c[0]))])
    })),
    relations: RELS.concat(LOGICAL)
  };
})();
