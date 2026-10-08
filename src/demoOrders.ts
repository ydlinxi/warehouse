/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 演示交易数据 —— fresh 建库与存量库补齐共用，集中于此，避免 db.ts 内联堆积。
 */

import { PendingOutbound } from './types';

interface DemoPalletSpec {
  seq: number; sku: string; title: string; qty: number; pos: string;
  date: string; quality: 'OQC验Pass' | '待复检' | '不合格';
  disposal?: '让步接收' | '退货' | '报废';
  note: string; handler: string;
}
interface DemoOrderSpec {
  id: string; order_no: string; model: string; order_qty: number;
  status: string; created_at: string;
  lines: { sku: string; title: string; maxPerPallet: number; qty: number }[];
  pallets: DemoPalletSpec[];
  outbounds?: { seq: number; qty: number; date: string; handler: string; note: string }[];
}

// ===== 演示订单规格（第 19~50 个 SKU 的订单/上架/出库记录）=====
// fresh 建库与存量库补齐都走这里，避免两处维护；仓位取 A16~A18 / B07~B08（不与既有卡位冲突）
export const DEMO_ORDERS_V2: DemoOrderSpec[] = [
  {
    id: 'order_011', order_no: 'PO260912', model: 'OVEN-X1 电烤箱 金色 等 2 个 SKU',
    order_qty: 460, status: 'in_progress', created_at: '2026-09-12',
    lines: [
      { sku: 'SUP0001-004', title: 'OVEN-X1 电烤箱 金色', maxPerPallet: 150, qty: 300 },
      { sku: 'SUP0002-004', title: 'MICRO-400 微波炉 蓝色', maxPerPallet: 80, qty: 160 }
    ],
    pallets: [
      { seq: 1, sku: 'SUP0001-004', title: 'OVEN-X1 电烤箱 金色', qty: 150, pos: 'A16-01', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' },
      { seq: 2, sku: 'SUP0001-004', title: 'OVEN-X1 电烤箱 金色', qty: 150, pos: 'A16-02', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' },
      { seq: 3, sku: 'SUP0002-004', title: 'MICRO-400 微波炉 蓝色', qty: 80, pos: 'B07-01', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '陈芳' },
      { seq: 4, sku: 'SUP0002-004', title: 'MICRO-400 微波炉 蓝色', qty: 80, pos: 'B07-02', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '陈芳' }
    ],
    outbounds: [{ seq: 1, qty: 100, date: '2026-09-15', handler: '刘杰', note: '电商备货发出' }]
  },
  {
    id: 'order_012', order_no: 'PO260915', model: 'STEAM-C3 电蒸锅 白色 等 2 个 SKU',
    order_qty: 260, status: 'in_progress', created_at: '2026-09-15',
    lines: [
      { sku: 'SUP0003-007', title: 'STEAM-C3 电蒸锅 白色', maxPerPallet: 120, qty: 240 },
      { sku: 'SUP0004-005', title: 'FRIDGE-R2 冰箱 黑色', maxPerPallet: 20, qty: 20 }
    ],
    pallets: [
      { seq: 1, sku: 'SUP0003-007', title: 'STEAM-C3 电蒸锅 白色', qty: 120, pos: 'A17-01', date: '2026-09-16', quality: 'OQC验Pass', note: '正常入库', handler: '赵磊' },
      { seq: 2, sku: 'SUP0003-007', title: 'STEAM-C3 电蒸锅 白色', qty: 120, pos: 'A17-02', date: '2026-09-16', quality: '待复检', note: '抽检待复检', handler: '赵磊' },
      { seq: 3, sku: 'SUP0004-005', title: 'FRIDGE-R2 冰箱 黑色', qty: 20, pos: 'B07-03', date: '2026-09-16', quality: '不合格', disposal: '退货', note: '喷涂不良，整托退货', handler: '陈芳' }
    ]
  },
  {
    id: 'order_013', order_no: 'PO260916', model: 'CORD-K1 电源线 白色',
    order_qty: 1200, status: 'completed', created_at: '2026-09-11',
    lines: [{ sku: 'SUP0005-006', title: 'CORD-K1 电源线 白色', maxPerPallet: 600, qty: 1200 }],
    pallets: [
      { seq: 1, sku: 'SUP0005-006', title: 'CORD-K1 电源线 白色', qty: 600, pos: 'B08-01', date: '2026-09-11', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' },
      { seq: 2, sku: 'SUP0005-006', title: 'CORD-K1 电源线 白色', qty: 600, pos: 'B08-02', date: '2026-09-12', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' }
    ],
    outbounds: [
      { seq: 1, qty: 600, date: '2026-09-15', handler: '王强', note: '全额发出，完结' },
      { seq: 2, qty: 600, date: '2026-09-15', handler: '王强', note: '全额发出，完结' }
    ]
  },
  {
    // 排单中：仅需求行、未到货上架（对应「已建 SKU 但尚未上架」的 FREEZ-P10 / GRIND-G9）
    id: 'order_014', order_no: 'PO260918', model: 'FREEZ-P10 冷柜 蓝色 等 2 个 SKU',
    order_qty: 320, status: 'pending', created_at: '2026-09-18',
    lines: [
      { sku: 'SUP0001-007', title: 'FREEZ-P10 冷柜 蓝色', maxPerPallet: 60, qty: 120 },
      { sku: 'SUP0007-003', title: 'GRIND-G9 磨豆机 手摇', maxPerPallet: 100, qty: 200 }
    ],
    pallets: []
  },
  {
    id: 'order_015', order_no: 'PO260920', model: 'PANINI-D1 电饼铛 28cm 等 2 个 SKU',
    order_qty: 480, status: 'shortage', created_at: '2026-09-14',
    lines: [
      { sku: 'SUP0008-004', title: 'PANINI-D1 电饼铛 28cm', maxPerPallet: 60, qty: 300 },
      { sku: 'SUP0006-007', title: 'WASH-W2 迷你洗衣机 8kg', maxPerPallet: 90, qty: 180 }
    ],
    pallets: [
      { seq: 1, sku: 'SUP0008-004', title: 'PANINI-D1 电饼铛 28cm', qty: 60, pos: 'A18-01', date: '2026-09-15', quality: 'OQC验Pass', note: '分批到货', handler: '刘杰' },
      { seq: 2, sku: 'SUP0008-004', title: 'PANINI-D1 电饼铛 28cm', qty: 60, pos: 'A18-02', date: '2026-09-15', quality: 'OQC验Pass', note: '分批到货', handler: '刘杰' },
      { seq: 3, sku: 'SUP0006-007', title: 'WASH-W2 迷你洗衣机 8kg', qty: 90, pos: 'A18-03', date: '2026-09-15', quality: 'OQC验Pass', note: '正常入库', handler: '刘杰' }
    ]
  }
];

// ===== 电商平台订单（待出库 / 已出库）=====
// 平台只取靶场里真实存在「商城/订单」靶场的渠道：PLT-01 淘宝卖家中心（千牛）——其订单台 tb-orders、
// 物流管理 tb-logistics 是国内仓发货的 EDI 来源；「天猫」为 PLT-01 下的渠道（靶场 tb-orders 的 platform 字段）。
// 抖音(PLT-04)/小红书(PLT-13) 在靶场只有达人、内容、笔记、舆情模块，没有商城订单，故不作为订单来源。
// 型号与在售 SKU 品名对齐，便于点「出库」时按型号匹配仓位扣减。
export const DEMO_ECOM_ORDERS: Omit<PendingOutbound, 'id'>[] = [
  // ---- 待出库 ----
  { ecomOrderNo: 'EC20260916T01', platform: '淘宝', model: 'OVEN-X1 电烤箱 红色', qty: 18, recipient: '陈晨（杭州西湖）', address: '浙江省杭州市西湖区文三路 508 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-16', note: '淘宝旗舰店当日件，优先拣货' },
  { ecomOrderNo: 'EC20260916M02', platform: '天猫', model: 'MICRO-400 微波炉 红色', qty: 40, recipient: '赵磊（成都武侯）', address: '四川省成都市武侯区天府大道 666 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-16', note: '天猫官方店大促单，待出库' },
  { ecomOrderNo: 'EC20260916T03', platform: '淘宝', model: 'MINI 迷你煮蛋器 01', qty: 25, recipient: '孙悦（西安雁塔）', address: '陕西省西安市雁塔区科技路 10 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-16', note: '淘宝直播间下单（PLT-03），待出库' },
  { ecomOrderNo: 'EC20260915M04', platform: '天猫', model: 'BAKE 配件 01', qty: 60, recipient: '周琳（长沙岳麓）', address: '湖南省长沙市岳麓区麓谷大道 88 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '天猫店铺逛逛种草转化单，待出库' },
  { ecomOrderNo: 'EC20260915T05', platform: '淘宝', model: 'CORD-K1 电源线 白色', qty: 200, recipient: '吴敏（郑州金水）', address: '河南省郑州市金水区花园路 32 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '淘宝企业店批量单，待出库' },
  { ecomOrderNo: 'EC20260915M06', platform: '天猫', model: 'DISH-90 洗碗机 S', qty: 6, recipient: '郑凯（南京鼓楼）', address: '江苏省南京市鼓楼区中山北路 100 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '天猫大件，需加固包装' },
  { ecomOrderNo: 'EC20260914M07', platform: '天猫', model: 'AIRF-2 空气炸锅 深空灰', qty: 12, recipient: '何静（厦门思明）', address: '福建省厦门市思明区望海路 21 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-14', note: '天猫预售尾款单，待出库' },
  { ecomOrderNo: 'EC20260914T08', platform: '淘宝', model: 'STEAM-C3 电蒸锅 白色', qty: 35, recipient: '马超（重庆渝北）', address: '重庆市渝北区金开大道 1000 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-14', note: '淘宝直播带货单（PLT-03），待出库' },
  { ecomOrderNo: 'EC20260913T09', platform: '淘宝', model: 'TOAST-A 烤面包机 B', qty: 45, recipient: '高鹏（合肥蜀山）', address: '安徽省合肥市蜀山区望江西路 99 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-13', note: '淘宝聚划算拼团单，待出库' },
  { ecomOrderNo: 'EC20260913M10', platform: '天猫', model: 'BAKE 配件 03', qty: 80, recipient: '谢婷（昆明五华）', address: '云南省昆明市五华区人民中路 66 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-13', note: '天猫店铺配件补货单' },
  { ecomOrderNo: 'EC20260912M11', platform: '天猫', model: 'STEW-T1 电炖盅 黑色', qty: 150, recipient: '韩雪（青岛崂山）', address: '山东省青岛市崂山区海尔路 8 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-12', note: '天猫企业购批量单' },
  { ecomOrderNo: 'EC20260912T12', platform: '淘宝', model: 'WASH-W2 迷你洗衣机 8kg', qty: 20, recipient: '曹阳（天津和平）', address: '天津市和平区南京路 75 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-12', note: '淘宝直播秒杀单（PLT-03）' },
  { ecomOrderNo: 'EC20260913A01', platform: '淘宝', model: 'OVEN-X1 电烤箱 黑色', qty: 30, recipient: '张伟（上海浦东）', address: '上海市浦东新区世纪大道 100 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-13', note: '淘宝旗舰店已付款，待拣货' },
  { ecomOrderNo: 'EC20260914D02', platform: '淘宝', model: 'MICRO-400 微波炉 黑色', qty: 24, recipient: '李娜（北京朝阳）', address: '北京市朝阳区建国路 88 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-14', note: '淘宝直播间下单，待出库' },
  { ecomOrderNo: 'EC20260915J03', platform: '淘宝', model: 'MINI 迷你煮蛋器 03', qty: 12, recipient: '王芳（广州天河）', address: '广州市天河区天河路 200 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '淘宝店铺单，待出库' },
  { ecomOrderNo: 'EC20260915A04', platform: '淘宝', model: 'BAKE 配件 03', qty: 50, recipient: '张伟（上海浦东）', address: '上海市浦东新区世纪大道 100 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '淘宝配件补单，待出库' },

  // ---- 已出库（含物流单号回写）----
  { ecomOrderNo: 'EC20260911M17', platform: '天猫', model: 'OVEN-X1 电烤箱 蓝色', qty: 22, recipient: '林可（福州鼓楼）', address: '福建省福州市鼓楼区五四路 168 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-11', outboundAt: '2026-09-12', logisticsNo: 'SF2026091201', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260911T18', platform: '淘宝', model: 'MICRO-400 微波炉 绿色', qty: 60, recipient: '朱迪（贵阳观山湖）', address: '贵州省贵阳市观山湖区长岭北路 9 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-11', outboundAt: '2026-09-12', logisticsNo: 'SF2026091202', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260910T19', platform: '淘宝', model: 'MINI 迷你煮蛋器 02', qty: 30, recipient: '刘洋（沈阳和平）', address: '辽宁省沈阳市和平区青年大街 288 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-10', outboundAt: '2026-09-11', logisticsNo: 'SF2026091103', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260910M20', platform: '天猫', model: 'BAKE 配件 02', qty: 90, recipient: '叶楠（南昌红谷滩）', address: '江西省南昌市红谷滩区凤凰中大道 66 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-10', outboundAt: '2026-09-11', logisticsNo: 'SF2026091104', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260909T21', platform: '淘宝', model: 'CORD-K1 电源线 黑色', qty: 300, recipient: '唐宇（南宁青秀）', address: '广西南宁市青秀区民族大道 131 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-09', outboundAt: '2026-09-10', logisticsNo: 'SF2026091005', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260909M22', platform: '天猫', model: 'DISH-90 洗碗机 L', qty: 8, recipient: '范磊（石家庄裕华）', address: '河北省石家庄市裕华区体育南大街 88 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-09', outboundAt: '2026-09-10', logisticsNo: 'SF2026091006', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260908M23', platform: '天猫', model: 'OVEN-X1 电烤箱 金色', qty: 15, recipient: '方圆（无锡梁溪）', address: '江苏省无锡市梁溪区人民中路 220 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-08', outboundAt: '2026-09-09', logisticsNo: 'SF2026090907', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260908T24', platform: '淘宝', model: 'PANINI-D1 电饼铛 28cm', qty: 10, recipient: '黄蕾（佛山顺德）', address: '广东省佛山市顺德区德胜中路 8 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-08', outboundAt: '2026-09-09', logisticsNo: 'SF2026090908', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260907T25', platform: '淘宝', model: 'MOLD-B8 烘焙模具 6寸', qty: 500, recipient: '邓鑫（温州龙湾）', address: '浙江省温州市龙湾区永中街道 12 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-07', outboundAt: '2026-09-08', logisticsNo: 'SF2026090809', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260907M26', platform: '天猫', model: 'HUMID-U4 加湿器 灰色', qty: 40, recipient: '石磊（太原小店）', address: '山西省太原市小店区长风街 66 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-07', outboundAt: '2026-09-08', logisticsNo: 'SF2026090810', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260910D05', platform: '淘宝', model: 'TOAST-A 烤面包机 A', qty: 20, recipient: '李娜（北京朝阳）', address: '北京市朝阳区建国路 88 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-10', outboundAt: '2026-09-11', logisticsNo: 'SF2026091105', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260908J06', platform: '淘宝', model: 'DISH-90 洗碗机 M', qty: 10, recipient: '王芳（广州天河）', address: '广州市天河区天河路 200 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-08', outboundAt: '2026-09-09', logisticsNo: 'SF2026090902', note: '已出库，物流单号已回写' }
];
