/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Order,
  InboundPlanLine,
  PositionDemand,
  Inbound,
  Outbound,
  Position,
  WarehouseConfig,
  ProductModel,
  InventoryMonthRecord,
  Supplier,
  ProductSku,
  PurchaseOrder,
  PendingOutbound,
  PurchasePlanRow
} from './types';
import { SEED_SUPPLIERS, SEED_PRODUCT_SKUS, SEED_ITEMS, SKU_MIGRATION, modelOfTitle } from './seed';

// Helper to generate UUIDs
export function generateUUID(): string {
  return 'idx_' + Math.random().toString(36).substring(2, 15);
}

const safeNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

// Default static lists
export const DEFAULT_MODELS: ProductModel[] = [
  { name: 'PRO-X1', code: '0001', default_per_pallet: 100, safety_stock: 600 },
  { name: 'MX-400', code: '0002', default_per_pallet: 80, safety_stock: 480 },
  { name: 'LITE-A', code: '0003', default_per_pallet: 150, safety_stock: 900 },
  { name: 'MAX-90', code: '0004', default_per_pallet: 50, safety_stock: 300 },
];

export const DEFAULT_LINES = ['线别A-01', '线别A-02', '线别B-01', '线别B-02', '线别C-01'];
export const DEFAULT_HANDLERS = ['张敏', '刘杰', '王强', '陈芳', '赵磊'];
export const QUALITY_OPTIONS = ['OQC验Pass', '待复检', '不合格'] as const;

// Storage keys
const KEYS = {
  ORDERS: 'fg_inventory_orders',
  DEMANDS: 'fg_inventory_demands',
  INBOUNDS: 'fg_inventory_inbounds',
  OUTBOUNDS: 'fg_inventory_outbounds',
  WAREHOUSE_CONFIG: 'fg_inventory_warehouse_config',
  MODELS: 'fg_inventory_models',
  LINES: 'fg_inventory_lines',
  HANDLERS: 'fg_inventory_handlers',
  SUPPLIERS: 'fg_inventory_suppliers',
  PRODUCT_SKUS: 'fg_inventory_product_skus',
  ITEMS: 'fg_inventory_items',
  REPLENISH_PLANS: 'fg_inventory_replenish_plans',
  PURCHASE_ORDERS: 'fg_inventory_purchase_orders',
  PENDING_OUTBOUNDS: 'fg_inventory_pending_outbounds',
  PURCHASE_PLAN_ROWS: 'fg_inventory_purchase_plan_rows'
};

// Formatter Utilities
export const formatters = {
  // Rmb currency format
  currency: (amount: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(amount);
  },
  // Number with thousands separators
  number: (num: number, fractionDigits = 0) => {
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(num);
  },
  // Date format yyyy/mm/dd
  date: (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  },
  // DB date format yyyy-mm-dd
  dbDate: (date: Date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

// ===== 演示订单规格（第 19~50 个 SKU 的订单/上架/出库记录）=====
// fresh 建库与存量库补齐都走这里，避免两处维护；仓位取 A16~A18 / B07~B08（不与既有卡位冲突）
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

const DEMO_ORDERS_V2: DemoOrderSpec[] = [
  {
    id: 'order_011', order_no: 'PO260912', model: 'PRO-X1 智能终端 金色 等 2 个 SKU',
    order_qty: 460, status: 'in_progress', created_at: '2026-09-12',
    lines: [
      { sku: 'SUP0001-004', title: 'PRO-X1 智能终端 金色', maxPerPallet: 150, qty: 300 },
      { sku: 'SUP0002-004', title: 'MX-400 模块 蓝色', maxPerPallet: 80, qty: 160 }
    ],
    pallets: [
      { seq: 1, sku: 'SUP0001-004', title: 'PRO-X1 智能终端 金色', qty: 150, pos: 'A16-01', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' },
      { seq: 2, sku: 'SUP0001-004', title: 'PRO-X1 智能终端 金色', qty: 150, pos: 'A16-02', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' },
      { seq: 3, sku: 'SUP0002-004', title: 'MX-400 模块 蓝色', qty: 80, pos: 'B07-01', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '陈芳' },
      { seq: 4, sku: 'SUP0002-004', title: 'MX-400 模块 蓝色', qty: 80, pos: 'B07-02', date: '2026-09-13', quality: 'OQC验Pass', note: '正常入库', handler: '陈芳' }
    ],
    outbounds: [{ seq: 1, qty: 100, date: '2026-09-15', handler: '刘杰', note: '电商备货发出' }]
  },
  {
    id: 'order_012', order_no: 'PO260915', model: 'CAM-C3 摄像头 白色 等 2 个 SKU',
    order_qty: 260, status: 'in_progress', created_at: '2026-09-15',
    lines: [
      { sku: 'SUP0003-007', title: 'CAM-C3 摄像头 白色', maxPerPallet: 120, qty: 240 },
      { sku: 'SUP0004-005', title: 'RACK-R2 机柜 黑色', maxPerPallet: 20, qty: 20 }
    ],
    pallets: [
      { seq: 1, sku: 'SUP0003-007', title: 'CAM-C3 摄像头 白色', qty: 120, pos: 'A17-01', date: '2026-09-16', quality: 'OQC验Pass', note: '正常入库', handler: '赵磊' },
      { seq: 2, sku: 'SUP0003-007', title: 'CAM-C3 摄像头 白色', qty: 120, pos: 'A17-02', date: '2026-09-16', quality: '待复检', note: '抽检待复检', handler: '赵磊' },
      { seq: 3, sku: 'SUP0004-005', title: 'RACK-R2 机柜 黑色', qty: 20, pos: 'B07-03', date: '2026-09-16', quality: '不合格', disposal: '退货', note: '喷涂不良，整托退货', handler: '陈芳' }
    ]
  },
  {
    id: 'order_013', order_no: 'PO260916', model: 'CABLE-K1 数据线 白色',
    order_qty: 1200, status: 'completed', created_at: '2026-09-11',
    lines: [{ sku: 'SUP0005-006', title: 'CABLE-K1 数据线 白色', maxPerPallet: 600, qty: 1200 }],
    pallets: [
      { seq: 1, sku: 'SUP0005-006', title: 'CABLE-K1 数据线 白色', qty: 600, pos: 'B08-01', date: '2026-09-11', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' },
      { seq: 2, sku: 'SUP0005-006', title: 'CABLE-K1 数据线 白色', qty: 600, pos: 'B08-02', date: '2026-09-12', quality: 'OQC验Pass', note: '正常入库', handler: '张敏' }
    ],
    outbounds: [
      { seq: 1, qty: 600, date: '2026-09-15', handler: '王强', note: '全额发出，完结' },
      { seq: 2, qty: 600, date: '2026-09-15', handler: '王强', note: '全额发出，完结' }
    ]
  },
  {
    // 排单中：仅需求行、未到货上架（对应「已建 SKU 但尚未上架」的 TAB-P10 / GEAR-G9）
    id: 'order_014', order_no: 'PO260918', model: 'TAB-P10 平板 蓝色 等 2 个 SKU',
    order_qty: 320, status: 'pending', created_at: '2026-09-18',
    lines: [
      { sku: 'SUP0001-007', title: 'TAB-P10 平板 蓝色', maxPerPallet: 60, qty: 120 },
      { sku: 'SUP0007-003', title: 'GEAR-G9 齿轮 模数2', maxPerPallet: 100, qty: 200 }
    ],
    pallets: []
  },
  {
    id: 'order_015', order_no: 'PO260920', model: 'PANEL-D1 显示屏 7寸 等 2 个 SKU',
    order_qty: 480, status: 'shortage', created_at: '2026-09-14',
    lines: [
      { sku: 'SUP0008-004', title: 'PANEL-D1 显示屏 7寸', maxPerPallet: 60, qty: 300 },
      { sku: 'SUP0006-007', title: 'WATCH-W2 智能手表 46mm', maxPerPallet: 90, qty: 180 }
    ],
    pallets: [
      { seq: 1, sku: 'SUP0008-004', title: 'PANEL-D1 显示屏 7寸', qty: 60, pos: 'A18-01', date: '2026-09-15', quality: 'OQC验Pass', note: '分批到货', handler: '刘杰' },
      { seq: 2, sku: 'SUP0008-004', title: 'PANEL-D1 显示屏 7寸', qty: 60, pos: 'A18-02', date: '2026-09-15', quality: 'OQC验Pass', note: '分批到货', handler: '刘杰' },
      { seq: 3, sku: 'SUP0006-007', title: 'WATCH-W2 智能手表 46mm', qty: 90, pos: 'A18-03', date: '2026-09-15', quality: 'OQC验Pass', note: '正常入库', handler: '刘杰' }
    ]
  }
];

// ===== 电商平台订单（待出库 / 已出库）=====
// 平台只取靶场里真实存在「商城/订单」靶场的渠道：PLT-01 淘宝卖家中心（千牛）——其订单台 tb-orders、
// 物流管理 tb-logistics 是国内仓发货的 EDI 来源；「天猫」为 PLT-01 下的渠道（靶场 tb-orders 的 platform 字段）。
// 抖音(PLT-04)/小红书(PLT-13) 在靶场只有达人、内容、笔记、舆情模块，没有商城订单，故不作为订单来源。
// 型号与在售 SKU 品名对齐，便于点「出库」时按型号匹配仓位扣减。
const DEMO_ECOM_ORDERS: Omit<PendingOutbound, 'id'>[] = [
  // ---- 待出库 ----
  { ecomOrderNo: 'EC20260916T01', platform: '淘宝', model: 'PRO-X1 智能终端 红色', qty: 18, recipient: '陈晨（杭州西湖）', address: '浙江省杭州市西湖区文三路 508 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-16', note: '淘宝旗舰店当日件，优先拣货' },
  { ecomOrderNo: 'EC20260916M02', platform: '天猫', model: 'MX-400 模块 红色', qty: 40, recipient: '赵磊（成都武侯）', address: '四川省成都市武侯区天府大道 666 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-16', note: '天猫官方店大促单，待出库' },
  { ecomOrderNo: 'EC20260916T03', platform: '淘宝', model: 'MINI 迷你 01', qty: 25, recipient: '孙悦（西安雁塔）', address: '陕西省西安市雁塔区科技路 10 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-16', note: '淘宝直播间下单（PLT-03），待出库' },
  { ecomOrderNo: 'EC20260915M04', platform: '天猫', model: 'PRO 配件 01', qty: 60, recipient: '周琳（长沙岳麓）', address: '湖南省长沙市岳麓区麓谷大道 88 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '天猫店铺逛逛种草转化单，待出库' },
  { ecomOrderNo: 'EC20260915T05', platform: '淘宝', model: 'CABLE-K1 数据线 白色', qty: 200, recipient: '吴敏（郑州金水）', address: '河南省郑州市金水区花园路 32 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '淘宝企业店批量单，待出库' },
  { ecomOrderNo: 'EC20260915M06', platform: '天猫', model: 'MAX-90 大型 S', qty: 6, recipient: '郑凯（南京鼓楼）', address: '江苏省南京市鼓楼区中山北路 100 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '天猫大件，需加固包装' },
  { ecomOrderNo: 'EC20260914M07', platform: '天猫', model: 'AIR-2 平板 深空灰', qty: 12, recipient: '何静（厦门思明）', address: '福建省厦门市思明区望海路 21 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-14', note: '天猫预售尾款单，待出库' },
  { ecomOrderNo: 'EC20260914T08', platform: '淘宝', model: 'CAM-C3 摄像头 白色', qty: 35, recipient: '马超（重庆渝北）', address: '重庆市渝北区金开大道 1000 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-14', note: '淘宝直播带货单（PLT-03），待出库' },
  { ecomOrderNo: 'EC20260913T09', platform: '淘宝', model: 'LITE-A 轻量版 B', qty: 45, recipient: '高鹏（合肥蜀山）', address: '安徽省合肥市蜀山区望江西路 99 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-13', note: '淘宝聚划算拼团单，待出库' },
  { ecomOrderNo: 'EC20260913M10', platform: '天猫', model: 'PRO 配件 03', qty: 80, recipient: '谢婷（昆明五华）', address: '云南省昆明市五华区人民中路 66 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-13', note: '天猫店铺配件补货单' },
  { ecomOrderNo: 'EC20260912M11', platform: '天猫', model: 'SENSOR-T1 传感器 黑色', qty: 150, recipient: '韩雪（青岛崂山）', address: '山东省青岛市崂山区海尔路 8 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-12', note: '天猫企业购批量单' },
  { ecomOrderNo: 'EC20260912T12', platform: '淘宝', model: 'WATCH-W2 智能手表 46mm', qty: 20, recipient: '曹阳（天津和平）', address: '天津市和平区南京路 75 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-12', note: '淘宝直播秒杀单（PLT-03）' },
  { ecomOrderNo: 'EC20260913A01', platform: '淘宝', model: 'PRO-X1 智能终端 黑色', qty: 30, recipient: '张伟（上海浦东）', address: '上海市浦东新区世纪大道 100 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-13', note: '淘宝旗舰店已付款，待拣货' },
  { ecomOrderNo: 'EC20260914D02', platform: '淘宝', model: 'MX-400 模块 黑色', qty: 24, recipient: '李娜（北京朝阳）', address: '北京市朝阳区建国路 88 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-14', note: '淘宝直播间下单，待出库' },
  { ecomOrderNo: 'EC20260915J03', platform: '淘宝', model: 'MINI 迷你 03', qty: 12, recipient: '王芳（广州天河）', address: '广州市天河区天河路 200 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '淘宝店铺单，待出库' },
  { ecomOrderNo: 'EC20260915A04', platform: '淘宝', model: 'PRO 配件 03', qty: 50, recipient: '张伟（上海浦东）', address: '上海市浦东新区世纪大道 100 号', status: '待出库', ecomStatus: '已付款', createdAt: '2026-09-15', note: '淘宝配件补单，待出库' },

  // ---- 已出库（含物流单号回写）----
  { ecomOrderNo: 'EC20260911M17', platform: '天猫', model: 'PRO-X1 智能终端 蓝色', qty: 22, recipient: '林可（福州鼓楼）', address: '福建省福州市鼓楼区五四路 168 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-11', outboundAt: '2026-09-12', logisticsNo: 'SF2026091201', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260911T18', platform: '淘宝', model: 'MX-400 模块 绿色', qty: 60, recipient: '朱迪（贵阳观山湖）', address: '贵州省贵阳市观山湖区长岭北路 9 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-11', outboundAt: '2026-09-12', logisticsNo: 'SF2026091202', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260910T19', platform: '淘宝', model: 'MINI 迷你 02', qty: 30, recipient: '刘洋（沈阳和平）', address: '辽宁省沈阳市和平区青年大街 288 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-10', outboundAt: '2026-09-11', logisticsNo: 'SF2026091103', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260910M20', platform: '天猫', model: 'PRO 配件 02', qty: 90, recipient: '叶楠（南昌红谷滩）', address: '江西省南昌市红谷滩区凤凰中大道 66 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-10', outboundAt: '2026-09-11', logisticsNo: 'SF2026091104', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260909T21', platform: '淘宝', model: 'CABLE-K1 数据线 黑色', qty: 300, recipient: '唐宇（南宁青秀）', address: '广西南宁市青秀区民族大道 131 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-09', outboundAt: '2026-09-10', logisticsNo: 'SF2026091005', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260909M22', platform: '天猫', model: 'MAX-90 大型 L', qty: 8, recipient: '范磊（石家庄裕华）', address: '河北省石家庄市裕华区体育南大街 88 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-09', outboundAt: '2026-09-10', logisticsNo: 'SF2026091006', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260908M23', platform: '天猫', model: 'PRO-X1 智能终端 金色', qty: 15, recipient: '方圆（无锡梁溪）', address: '江苏省无锡市梁溪区人民中路 220 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-08', outboundAt: '2026-09-09', logisticsNo: 'SF2026090907', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260908T24', platform: '淘宝', model: 'PANEL-D1 显示屏 7寸', qty: 10, recipient: '黄蕾（佛山顺德）', address: '广东省佛山市顺德区德胜中路 8 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-08', outboundAt: '2026-09-09', logisticsNo: 'SF2026090908', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260907T25', platform: '淘宝', model: 'BEAR-B8 轴承 6204', qty: 500, recipient: '邓鑫（温州龙湾）', address: '浙江省温州市龙湾区永中街道 12 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-07', outboundAt: '2026-09-08', logisticsNo: 'SF2026090809', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260907M26', platform: '天猫', model: 'HUB-U4 集线器 灰色', qty: 40, recipient: '石磊（太原小店）', address: '山西省太原市小店区长风街 66 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-07', outboundAt: '2026-09-08', logisticsNo: 'SF2026090810', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260910D05', platform: '淘宝', model: 'LITE-A 轻量版 A', qty: 20, recipient: '李娜（北京朝阳）', address: '北京市朝阳区建国路 88 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-10', outboundAt: '2026-09-11', logisticsNo: 'SF2026091105', note: '已出库，物流单号已回写' },
  { ecomOrderNo: 'EC20260908J06', platform: '淘宝', model: 'MAX-90 大型 M', qty: 10, recipient: '王芳（广州天河）', address: '广州市天河区天河路 200 号', status: '已出库', ecomStatus: '已出库', createdAt: '2026-09-08', outboundAt: '2026-09-09', logisticsNo: 'SF2026090902', note: '已出库，物流单号已回写' }
];

export class DBService {
  // Load config with multi-zone support and auto-migration
  static getWarehouseConfig(): WarehouseConfig {
    const default_config: WarehouseConfig = {
      zones: [
        { code: 'A', rows: 70, cols: 20 },
        { code: 'B', rows: 70, cols: 20 }
      ]
    };
    const saved = localStorage.getItem(KEYS.WAREHOUSE_CONFIG);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if old format where zones is just a string array
        if (parsed.zones && Array.isArray(parsed.zones) && (parsed.zones.length === 0 || typeof parsed.zones[0] === 'string')) {
          const migratedZones = parsed.zones.map((zCode: any) => ({
            code: String(zCode),
            rows: parsed.rows || 70,
            cols: parsed.cols || 20
          }));
          const migrated: WarehouseConfig = { zones: migratedZones };
          localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(migrated));
          return migrated;
        }
        return parsed;
      } catch (e) {
        return default_config;
      }
    }
    localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(default_config));
    return default_config;
  }

  static saveWarehouseConfig(config: WarehouseConfig) {
    localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(config));
  }

  // 型号库（= 商品库）：统一由商品主数据派生，避免型号库与 SKU 主数据两套口径
  static getModels(): ProductModel[] {
    const items = this.getRawItems();
    if (items.length) {
      return items.map(it => ({
        itemId: it.itemId, name: it.name, itemName: it.itemName, code: it.code,
        default_per_pallet: it.default_per_pallet,
        safety_stock: it.safety_stock
      }));
    }
    return DEFAULT_MODELS;
  }

  // 保存型号库 = 回写商品主数据（保留原商品ID / 商品名；新增型号自动分配商品ID）
  static saveModels(models: ProductModel[]) {
    const items = this.getRawItems();
    const next = models.map(m => {
      const hit = items.find(it => it.itemId === m.itemId || it.name === m.name);
      const itemId = m.itemId || hit?.itemId || this.nextItemId();
      return {
        itemId,
        name: m.name,
        itemName: m.itemName || hit?.itemName || m.name,
        code: m.code || hit?.code || String(itemId).replace(/\D/g, ''),
        default_per_pallet: Math.max(1, Number(m.default_per_pallet) || 100),
        safety_stock: Math.max(0, Number(m.safety_stock) || 0)
      } as ProductModel;
    });
    this.saveItems(next);
    localStorage.setItem(KEYS.MODELS, JSON.stringify(next));
  }

  // ===== 供应链：供应商 / 商品SKU / 补货计划 / 采购单 =====
  static getSuppliers(): Supplier[] {
    const saved = localStorage.getItem(KEYS.SUPPLIERS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(SEED_SUPPLIERS));
    return SEED_SUPPLIERS;
  }

  static saveSuppliers(list: Supplier[]) {
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(list));
  }

  // ===== 商品主数据（SPU 级，即「主体商品」）=====
  // 一个商品（如 SPU0001 PRO-X1 智能终端）下可挂多个 SKU（红色/黑色… 4G+64G/8G+128G…）
  static getRawItems(): ProductModel[] {
    const normalize = (arr: any[]): ProductModel[] => arr.map(it => ({
      itemId: it.itemId,
      name: it.name,
      itemName: it.itemName || it.name,
      code: it.code,
      default_per_pallet: Math.max(1, Number(it.default_per_pallet) || 100),
      safety_stock: Math.max(0, Number(it.safety_stock) || 0)
    }));
    const saved = localStorage.getItem(KEYS.ITEMS);
    if (saved) { try { return normalize(JSON.parse(saved)); } catch (e) {} }
    const seed = SEED_ITEMS.map(it => ({ ...it }));
    localStorage.setItem(KEYS.ITEMS, JSON.stringify(seed));
    return seed;
  }

  static saveItems(list: ProductModel[]) {
    localStorage.setItem(KEYS.ITEMS, JSON.stringify(list));
  }

  // 下一个商品ID（SPU + 四位序号，offset 供同批次连续预览）
  static nextItemId(offset: number = 0): string {
    const nums = this.getRawItems()
      .map(it => parseInt(String(it.itemId || '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1 + offset;
    return 'SPU' + String(next).padStart(4, '0');
  }

  // 按型号（品名首词）反查商品ID
  static itemIdByTitle(title: string): string | undefined {
    const model = modelOfTitle(title);
    return this.getRawItems().find(it => it.name === model)?.itemId;
  }

  // 商品主数据自愈：为历史 SKU 补 itemId、为缺失型号建档（幂等，可重复执行）
  static ensureItemMaster(): number {
    const items = this.getRawItems();
    let skusRaw: any[] = [];
    try {
      const raw = localStorage.getItem(KEYS.PRODUCT_SKUS);
      const arr = raw ? JSON.parse(raw) : [];
      skusRaw = Array.isArray(arr) ? arr : [];
    } catch (e) { skusRaw = []; }
    if (!skusRaw.length) return 0;

    const byModel: Record<string, ProductModel> = {};
    items.forEach(it => { byModel[it.name] = it; });
    let patched = 0;
    const added: ProductModel[] = [];
    skusRaw.forEach(s => {
      const model = modelOfTitle(s.title || '');
      let it = byModel[model];
      if (!it) {
        const seq = String(items.length + added.length + 1).padStart(4, '0');
        it = {
          itemId: 'SPU' + seq, name: model, itemName: s.title || model, code: seq,
          default_per_pallet: Math.max(1, Number(s.perPallet) || 100),
          safety_stock: Math.max(0, Number(s.replenishPoint) || 0)
        };
        byModel[model] = it; added.push(it);
      }
      if (s.itemId !== it.itemId) { s.itemId = it.itemId; patched++; }
    });
    if (added.length) this.saveItems([...items, ...added]);
    if (patched) this.saveProductSkus(skusRaw);
    return added.length + patched;
  }

  // 商品级库存汇总：该商品下全部 SKU 的可售 / 待复检 / 不合格 / 在架物理 / 累计已出库
  static computeItemStock(itemId: string) {
    const skus = this.getRawProductSkus().filter(s => s.itemId === itemId);
    const sum = { skuCount: skus.length, available: 0, pending: 0, reject: 0, physical: 0, shipped: 0 };
    skus.forEach(s => {
      const b = this.getSkuStockBreakdown(s.sku);
      sum.available += b.available; sum.pending += b.pending;
      sum.reject += b.reject; sum.physical += b.physical; sum.shipped += b.shipped;
    });
    return sum;
  }

  // 读取原始 SKU（不做库存推导），供内部匹配使用，避免与 getProductSkus 形成递归
  static getRawProductSkus(): ProductSku[] {
    // 历史数据可能没有 itemId：读取时按型号兜底补齐（持久化由 ensureItemMaster 完成）
    const normalize = (arr: any[]): ProductSku[] => arr.map(s => ({
      ...s,
      perPallet: Math.max(1, Number(s.perPallet) || 100),
      itemId: s.itemId || this.itemIdByTitle(s.title || '') || SEED_ITEMS[0].itemId
    }));
    const saved = localStorage.getItem(KEYS.PRODUCT_SKUS);
    if (saved) { try { return normalize(JSON.parse(saved)); } catch (e) {} }
    const seed = SEED_PRODUCT_SKUS.map(s => ({ ...s }));
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify(seed));
    return seed;
  }

  static getProductSkus(): ProductSku[] {
    const list = this.getRawProductSkus();
    // 库存以「仓位账本（Inbound/Outbound）」为唯一真相源，读取时实时推导；
    // 仅 OQC验Pass 的入库减去对应出库计入在售，质检未通过数量不计入。
    const stockMap = this.computeSkuAvailableStock();
    return list.map(s => ({ ...s, stock: stockMap[s.sku] ?? 0 }));
  }

  // 生成/预览 SKU 编码：供应商号-三位序号（offset 供同批次多行新 SKU 连续预览）
  static nextSkuCode(supplierId: string, offset: number = 0): string {
    const nums = this.getRawProductSkus()
      .filter(s => (s.sku || '').startsWith(supplierId + '-'))
      .map(s => parseInt(s.sku.slice(supplierId.length + 1), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1 + offset;
    return `${supplierId}-${String(next).padStart(3, '0')}`;
  }

  // 手工新建采购单：为已有供应商挂新 SKU（自动编码 供应商号-三位序号，写入商品主数据）
  // 商品归属优先级：显式 itemId（挂到已有商品）> itemName（新建商品）> 按品名型号自动匹配 / 自动建档
  static addProductSku(input: {
    supplierId: string; supplierName: string; title: string; price: number;
    itemId?: string; itemName?: string;
    perPallet?: number; replenishPoint?: number; abundanceThreshold?: number;
    emoji?: string; cat?: string; spec?: string; color?: string;
  }): ProductSku {
    const list = this.getRawProductSkus();
    const sku = this.nextSkuCode(input.supplierId);
    const model = modelOfTitle(input.title);
    const items = this.getRawItems();

    let itemId = input.itemId;
    if (itemId && !items.some(it => it.itemId === itemId)) itemId = undefined; // 传入不存在的商品ID则忽略
    if (!itemId) {
      const wanted = (input.itemName || '').trim();
      if (wanted) {
        const hit = items.find(it => it.itemName === wanted || it.name === wanted);
        itemId = hit?.itemId;
      }
      if (!itemId) itemId = items.find(it => it.name === model)?.itemId;
      if (!itemId) {
        // 新建商品（主体商品）：商品ID 自动递增，型号取品名首词
        const newId = this.nextItemId();
        const created: ProductModel = {
          itemId: newId, name: model, itemName: wanted || model,
          code: String(newId).replace(/\D/g, ''),
          default_per_pallet: Math.max(1, Number(input.perPallet) || 100),
          safety_stock: Math.max(0, Number(input.replenishPoint) || 20)
        };
        this.saveItems([...items, created]);
        itemId = created.itemId;
      } else {
        // 已有商品：单托容量 / 安全库存按新 SKU 顺带刷新上限
        this.saveItems(items.map(it => it.itemId === itemId ? {
          ...it,
          default_per_pallet: Math.max(it.default_per_pallet, Math.max(1, Number(input.perPallet) || 100)),
          safety_stock: Math.max(it.safety_stock, Math.max(0, Number(input.replenishPoint) || 0))
        } : it));
      }
    }

    const rec: ProductSku = {
      sku,
      itemId: itemId!,
      title: input.title,
      emoji: input.emoji || '🆕',
      cat: input.cat || '新品',
      spec: input.spec,
      color: input.color,
      price: input.price,
      stock: 0, // 实际库存由仓位账本实时推导，这里仅占位
      perPallet: input.perPallet || 100,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      replenishPoint: input.replenishPoint ?? 20,
      abundanceThreshold: input.abundanceThreshold ?? 50
    };
    list.push(rec);
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify(list));
    return rec;
  }

  // 型号 / SPU 短码 → 代表 SKU（兼容历史数据中入库 model 仅记录到 SPU 级别的情况）
  static SKU_RESOLVE_HINT: Record<string, string> = {
    'PRO-X1': 'SUP0001-001', 'MX-400': 'SUP0002-002', 'LITE-A': 'SUP0003-001',
    'MAX-90': 'SUP0004-001', 'PRO 配件': 'SUP0005-001', 'MINI': 'SUP0006-001'
  };

  // 将入库记录的 model / sku 解析为内部 SKU 编码（优先用 sku 字段，其次标题/SPU 兼容）
  static resolveSkuCode(model?: string, skuField?: string): string | undefined {
    if (skuField) {
      const hit = this.getRawProductSkus().find(s => s.sku === skuField);
      if (hit) return hit.sku;
    }
    if (!model) return undefined;
    const raw = this.getRawProductSkus();
    const byTitle = raw.find(s => s.title === model);
    if (byTitle) return byTitle.sku;
    const hint = this.SKU_RESOLVE_HINT[model.trim()];
    if (hint) return hint;
    const byPrefix = raw.find(s => model.startsWith(s.title.split(' ')[0]));
    return byPrefix?.sku;
  }

  // 单个 SKU 的库存构成（解释「当前库存」为何小于仓位在架量）：
  // available=可售（OQC验Pass 入库 − 已出库）｜pending=待复检｜reject=不合格｜shipped=已出库｜physical=在架物理量
  static getSkuStockBreakdown(sku: string): { available: number; pending: number; reject: number; shipped: number; physical: number } {
    const inbounds = this.getInbounds().filter(i => this.resolveSkuCode(i.model, (i as any).sku) === sku);
    const outByInbound: Record<string, number> = {};
    this.getOutbounds().forEach(o => { outByInbound[o.inbound_id] = (outByInbound[o.inbound_id] || 0) + safeNum(o.outbound_qty); });
    let available = 0, pending = 0, reject = 0, shipped = 0;
    inbounds.forEach(i => {
      const qty = safeNum(i.actual_qty);
      const out = Math.min(qty, outByInbound[i.id] || 0);
      shipped += out;
      const rest = Math.max(0, qty - out);
      const q = (i.quality || 'OQC验Pass') as string; // 与 computeSkuAvailableStock 口径一致：未标注质检视为可售
      if (q === 'OQC验Pass') available += rest;
      else if (q === '待复检') pending += rest;
      else reject += rest;
    });
    return { available, pending, reject, shipped, physical: available + pending + reject };
  }

  // 以仓位账本为唯一真相源推导各 SKU 在售库存（不含质检未通过）
  static computeSkuAvailableStock(): Record<string, number> {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();
    const outByInbound: Record<string, number> = {};
    outbounds.forEach(o => { outByInbound[o.inbound_id] = (outByInbound[o.inbound_id] || 0) + safeNum(o.outbound_qty); });
    const map: Record<string, number> = {};
    inbounds.forEach(inb => {
      if (inb.quality && inb.quality !== 'OQC验Pass') return; // 质检未通过不计入在售
      const skuCode = this.resolveSkuCode(inb.model, (inb as any).sku);
      if (!skuCode) return; // 非采购 SKU（如成品型号）不参与供应链账
      const avail = Math.max(0, safeNum(inb.actual_qty) - (outByInbound[inb.id] || 0));
      map[skuCode] = (map[skuCode] || 0) + avail;
    });
    return map;
  }

  static saveProductSkus(list: ProductSku[]) {
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify(list));
  }

  static getReplenishPlans(): any[] {
    const saved = localStorage.getItem(KEYS.REPLENISH_PLANS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  }

  static saveReplenishPlans(list: any[]) {
    localStorage.setItem(KEYS.REPLENISH_PLANS, JSON.stringify(list));
  }

  static getPurchaseOrders(): PurchaseOrder[] {
    const saved = localStorage.getItem(KEYS.PURCHASE_ORDERS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  }

  static savePurchaseOrders(list: PurchaseOrder[]) {
    localStorage.setItem(KEYS.PURCHASE_ORDERS, JSON.stringify(list));
  }

  // 采购入库计划行（待收货建卡板）——由采购单状态派生并落库
  static getPurchasePlanRows(): PurchasePlanRow[] {
    const saved = localStorage.getItem(KEYS.PURCHASE_PLAN_ROWS);
    if (saved === null) return this.syncPurchasePlanRows();
    try { return JSON.parse(saved); } catch (e) { return this.syncPurchasePlanRows(); }
  }

  static savePurchasePlanRows(list: PurchasePlanRow[]) {
    localStorage.setItem(KEYS.PURCHASE_PLAN_ROWS, JSON.stringify(list));
  }

  // 按采购单状态重建计划行：待收货 → 每个 SKU 一行；其余状态不生成
  // 每行的卡位数量 = CEIL(需求 / 单托容量)，一个托只放一个 SKU
  static syncPurchasePlanRows(): PurchasePlanRow[] {
    const skus = this.getProductSkus();
    const rows: PurchasePlanRow[] = [];
    this.getPurchaseOrders()
      .filter(p => p.status === '待收货')
      .forEach(po => {
        po.items.forEach(item => {
          const perPallet = Math.max(1, skus.find(s => s.sku === item.sku)?.perPallet || 100);
          const palletCount = Math.max(1, Math.ceil(item.need / perPallet));
          rows.push({
            id: `plan-${po.poNo}-${item.sku}`,
            poNo: po.poNo,
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            sku: item.sku,
            model: item.title,
            need: item.need,
            perPallet,
            palletCount,
            status: '待收货建卡板',
            createdAt: po.createdAt
          });
        });
      });
    this.savePurchasePlanRows(rows);
    return rows;
  }

  // 采购单收货确认：货到厂，状态置为已收货，并生成「入库计划（待分配需求行）」，
  // 由仓管到「入库管理 → 待入库卡位分配」分配仓位、质检后再上架，不再直接占仓。
  // 返回生成的入库计划行数。
  static receivePurchaseOrder(poNo: string): number {
    const list = this.getPurchaseOrders();
    const target = list.find(p => p.poNo === poNo);
    if (!target) return 0;
    if (target.status === '已收货') return 0;

    // 货到厂 → 生成入库计划（卡板需求），库存由仓位账本（上架入库）实时推导，此处不再直接改 SKU 库存
    const demands = this.getDemands();
    let palletTotal = 0;

    target.items.forEach(item => {
      const perPallet = Math.max(1, this.getRawProductSkus().find(s => s.sku === item.sku)?.perPallet || 100);
      const palletCount = Math.max(1, Math.ceil(item.need / perPallet));
      let remain = item.need;
      for (let i = 0; i < palletCount; i++) {
        const qty = Math.min(perPallet, remain);
        remain -= qty;
        palletTotal += 1;
        demands.push({
          id: generateUUID(),
          order_id: target.poNo,
          order_no: target.poNo,
          sku: item.sku,
          model: item.title,
          product: item.title,
          source: 'purchase',
          seq: palletTotal,
          position_code: null,
          inbound_id: null,
          planned_qty: qty,
          maxPerPallet: perPallet
        });
      }
    });

    this.saveDemands(demands);

    target.status = '已收货';
    target.receivedAt = formatters.dbDate();
    this.savePurchaseOrders(list);
    // 已收货 → 移除对应的待收货建卡板计划行
    this.syncPurchasePlanRows();

    return palletTotal;
  }

  // 采购单确认收货 → 创建入库计划（带 SKU 行，弹窗可调整卡板容量/数量），并推进采购单为已收货
  static receivePurchaseOrderAsPlan(poNo: string, planNo: string, lines: InboundPlanLine[]): Order {
    const list = this.getPurchaseOrders();
    const target = list.find(p => p.poNo === poNo);
    if (!target) throw new Error('找不到该采购单');
    if (target.status === '已收货') throw new Error('该采购单已收货');

    // 创建入库计划（并派生卡板需求）；库存由仓位账本（上架入库）实时推导
    const order = this.addOrder(planNo, lines, { source: 'purchase', poNo });

    // 采购单推进为已收货，并移除待收货计划行
    target.status = '已收货';
    target.receivedAt = formatters.dbDate();
    this.savePurchaseOrders(list);
    this.syncPurchasePlanRows();

    return order;
  }

  // 采购单付款：待采购 → 已付款（登记付款方式 / 流水号 / 实付金额），付款后明细锁定
  static payPurchaseOrder(poNo: string, info: { payMethod?: string; payNo?: string; paidAmt?: number; note?: string }) {
    const list = this.getPurchaseOrders();
    const idx = list.findIndex(p => p.poNo === poNo);
    if (idx === -1) throw new Error('找不到该采购单');
    if (list[idx].status !== '待采购') throw new Error(`仅「待采购」状态的采购单可付款，当前为「${list[idx].status}」`);
    const paid = Number(info.paidAmt);
    list[idx] = {
      ...list[idx],
      status: '已付款',
      payMethod: info.payMethod || list[idx].payMethod,
      payNo: info.payNo,
      paidAmt: isNaN(paid) || paid <= 0 ? list[idx].totalAmt : paid,
      paidAt: formatters.dbDate(),
      note: info.note !== undefined ? info.note : list[idx].note
    };
    this.savePurchaseOrders(list);
    // 付款不生成建卡板计划行（仍以「待收货」为准）
    this.syncPurchasePlanRows();
  }

  // 修改采购单可编辑字段（状态推进、明细调整等），已收货后调用方应禁止
  static updatePurchaseOrder(poNo: string, patch: Partial<PurchaseOrder>) {
    const list = this.getPurchaseOrders();
    const idx = list.findIndex(p => p.poNo === poNo);
    if (idx === -1) throw new Error('找不到该采购单');
    list[idx] = { ...list[idx], ...patch };
    this.savePurchaseOrders(list);
    // 状态变化后同步「待收货建卡板」计划行
    this.syncPurchasePlanRows();
  }

  // 按供应商合并补货：stock≤补货值 触发，同供应商 stock<充裕值 合并。
  // 计算时扣除「未结案采购单」的覆盖量，避免提交采购单后重复生成；待确认计划作为草稿不计入。
  static computeReplenishAlerts(skus: ProductSku[]) {
    const suppliers = this.getSuppliers();

    // 覆盖量 = 在途 + 已到厂未上架，避免提交采购单/收货后重复生成补货计划。
    // 注意：「待确认」补货计划本身只是草稿，生成时会被覆盖/清除，因此不计入，避免重复或漏单。
    const coverage: Record<string, number> = {};
    const addCov = (skuCode: string, qty: number) => { if (skuCode) coverage[skuCode] = (coverage[skuCode] || 0) + qty; };

    const inbounds = this.getInbounds();
    this.getPurchaseOrders().forEach(po => {
      if (['待采购', '已付款', '待收货'].includes(po.status)) {
        // 在途：货未到厂，按需求全额覆盖
        po.items.forEach(it => addCov(it.sku, safeNum(it.need)));
      } else if (po.status === '已收货') {
        // 已到厂未上架：需求 - 已上架入库量，避免入库上架完成前误判为缺货
        const recordedBySku: Record<string, number> = {};
        inbounds.filter(i => i.order_id === po.poNo).forEach(i => {
          const code = this.resolveSkuCode(i.model, (i as any).sku);
          if (code) recordedBySku[code] = (recordedBySku[code] || 0) + safeNum(i.actual_qty);
        });
        po.items.forEach(it => {
          const pending = Math.max(0, safeNum(it.need) - (recordedBySku[it.sku] || 0));
          if (pending > 0) addCov(it.sku, pending);
        });
      }
    });

    const groups = new Map<string, ProductSku[]>();
    skus.forEach(s => {
      if (!groups.has(s.supplierId)) groups.set(s.supplierId, []);
      groups.get(s.supplierId)!.push(s);
    });
    const mergedPlans: any[] = [];
    groups.forEach((items, sid) => {
      const evaluated = items.map(s => {
        const effStock = s.stock + (coverage[s.sku] || 0);
        const need = Math.max(0, s.abundanceThreshold - effStock);
        return { ...s, effectiveStock: effStock, effectiveNeed: need };
      });
      const triggers = evaluated.filter(s => s.effectiveStock <= s.replenishPoint && s.effectiveNeed > 0);
      if (triggers.length === 0) return; // 没有真正需要补货的SKU
      const merged = evaluated.filter(s => s.effectiveStock > s.replenishPoint && s.effectiveStock < s.abundanceThreshold && s.effectiveNeed > 0);
      const planItems = [...triggers, ...merged].map(s => ({
        sku: s.sku, title: s.title, emoji: s.emoji, spec: s.spec,
        stock: s.stock, effectiveStock: s.effectiveStock, replenishPoint: s.replenishPoint, abundanceThreshold: s.abundanceThreshold,
        need: s.effectiveNeed
      }));
      const sup = suppliers.find(x => x.id === sid);
      mergedPlans.push({
        supplier: sup ? { id: sup.id, name: sup.name, location: sup.location, moq: sup.moq } : { id: sid, name: '—', location: '—', moq: '—' },
        items: planItems
      });
    });
    return { mergedPlans };
  }

  // Load Lines
  static getLines(): string[] {
    const saved = localStorage.getItem(KEYS.LINES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    localStorage.setItem(KEYS.LINES, JSON.stringify(DEFAULT_LINES));
    return DEFAULT_LINES;
  }

  static saveLines(lines: string[]) {
    localStorage.setItem(KEYS.LINES, JSON.stringify(lines));
  }

  // Load Handlers
  static getHandlers(): string[] {
    const saved = localStorage.getItem(KEYS.HANDLERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    localStorage.setItem(KEYS.HANDLERS, JSON.stringify(DEFAULT_HANDLERS));
    return DEFAULT_HANDLERS;
  }

  static saveHandlers(handlers: string[]) {
    localStorage.setItem(KEYS.HANDLERS, JSON.stringify(handlers));
  }

  // 清理历史「SPU 短码」演示单及其关联流水（orders / demands / inbounds / outbounds）：
  // 这些记录 model 只到 SPU（如 PRO-X1、MX-400、LITE-A），与现行 SKU 主数据口径不一致，
  // 会在「库存报表 → 成品进销存总表」里出现型号为短码、SKU 编码对不上的脏行。
  // 返回清理掉的订单数。
  static purgeLegacySpuOrders(): number {
    const LEGACY_ORDER_NOS = ['PO260701', 'PO260810', 'PO260815'];
    const SPU_ONLY = ['PRO-X1', 'MX-400', 'LITE-A', 'MAX-90', 'MINI', 'PRO 配件'];
    const readArr = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    };

    const orders = readArr(KEYS.ORDERS);
    const legacy = orders.filter(o =>
      LEGACY_ORDER_NOS.includes(o.order_no) || SPU_ONLY.includes(String(o.model || '').trim()));
    if (legacy.length === 0) return 0;

    const legacyIds = new Set(legacy.map(o => o.id));
    const legacyNos = new Set<string>([...LEGACY_ORDER_NOS, ...legacy.map(o => o.order_no)]);
    const keep = (r: any) => !legacyIds.has(r.order_id) && !legacyIds.has(r.id) && !legacyNos.has(r.order_no);

    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders.filter(o => !legacyIds.has(o.id))));
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(readArr(KEYS.DEMANDS).filter(keep)));
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(readArr(KEYS.INBOUNDS).filter(keep)));
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(readArr(KEYS.OUTBOUNDS).filter(keep)));
    return legacy.length;
  }

  // 旧 SKU 编码 → 新编码（v2）迁移：一次性改写已存在的本地数据
  static migrateLegacySkuCodes() {
    const remap = (code: string) => SKU_MIGRATION[code] || code;
    const read = (key: string) => {
      const v = localStorage.getItem(key);
      if (!v) return null;
      try { return JSON.parse(v); } catch (e) { return null; }
    };

    // 商品 SKU 主数据
    const skus: any[] | null = read(KEYS.PRODUCT_SKUS);
    if (Array.isArray(skus)) {
      let changed = false;
      skus.forEach(s => {
        const next = remap(s.sku);
        if (next !== s.sku) { s.sku = next; changed = true; }
      });
      if (changed) this.saveProductSkus(skus);
    }

    // 采购单明细 SKU
    const pos: any[] | null = read(KEYS.PURCHASE_ORDERS);
    if (Array.isArray(pos)) {
      let changed = false;
      pos.forEach(po => (po.items || []).forEach((it: any) => {
        const next = remap(it.sku);
        if (next !== it.sku) { it.sku = next; changed = true; }
      }));
      if (changed) this.savePurchaseOrders(pos);
    }

    // 入库计划 SKU 行
    const orders: any[] | null = read(KEYS.ORDERS);
    if (Array.isArray(orders)) {
      let changed = false;
      orders.forEach(o => (o.lines || []).forEach((l: any) => {
        const next = remap(l.sku);
        if (next !== l.sku) { l.sku = next; changed = true; }
      }));
      if (changed) this.saveOrders(orders);
    }

    // 入库流水 SKU（仓位账本，派生库存的唯一真相源）
    const inbs: any[] | null = read(KEYS.INBOUNDS);
    if (Array.isArray(inbs)) {
      let changed = false;
      inbs.forEach(i => {
        const next = remap(i.sku);
        if (next !== i.sku) { i.sku = next; changed = true; }
      });
      if (changed) this.saveInbounds(inbs);
    }

    // 库位需求 SKU
    const dms: any[] | null = read(KEYS.DEMANDS);
    if (Array.isArray(dms)) {
      let changed = false;
      dms.forEach(d => {
        const next = remap(d.sku);
        if (next !== d.sku) { d.sku = next; changed = true; }
      });
      if (changed) this.saveDemands(dms);
    }
  }

  // ===== 库存初始化种子：覆盖全部 SKU，让数据落在 充裕 / 偏低 / 需补货 三档 =====
  // 键为 SKU，值为该托上架数量（0 或留空 = 不建库存 → stock 0 → 需补货）
  private static STOCK_SEED: Record<string, number> = {
    'SUP0001-001': 120, 'SUP0001-002': 140, 'SUP0001-003': 30,
    'SUP0002-001': 55, 'SUP0002-003': 45,
    'SUP0003-001': 300, 'SUP0003-002': 35, 'SUP0003-003': 20,
    'SUP0004-001': 8, 'SUP0004-002': 35, 'SUP0004-003': 10,
    'SUP0005-001': 45, 'SUP0005-002': 50, 'SUP0005-003': 90,
    'SUP0006-001': 15, 'SUP0006-002': 40, 'SUP0006-003': 60,
    // ===== 扩充批次：42/50 个 SKU 有上架库存（新增键必须追加在末尾，否则会挪动既有 A12-xx 卡位）=====
    'SUP0001-004': 45, 'SUP0001-005': 12, 'SUP0001-006': 130,
    'SUP0002-004': 150, 'SUP0002-005': 30, 'SUP0002-006': 55,
    'SUP0003-004': 260, 'SUP0003-005': 40, 'SUP0003-007': 12,
    'SUP0004-004': 70, 'SUP0004-005': 6, 'SUP0004-007': 420,
    'SUP0005-004': 260, 'SUP0005-006': 900, 'SUP0005-007': 40,
    'SUP0006-004': 300, 'SUP0006-006': 120, 'SUP0006-007': 25,
    'SUP0007-001': 1200, 'SUP0007-002': 350, 'SUP0007-004': 260,
    'SUP0008-001': 480, 'SUP0008-003': 90, 'SUP0008-004': 20
    // 未上架（无库存种子）：SUP0001-007 / SUP0002-007 / SUP0003-006 / SUP0004-006 /
    // SUP0005-005 / SUP0006-005 / SUP0007-003 / SUP0008-002 —— 用于演示「已建 SKU 但尚未上架」
  };
  private static STOCK_SEED_META: Record<string, { title: string }> = {
    'SUP0001-001': { title: 'PRO-X1 智能终端 红色' }, 'SUP0001-002': { title: 'PRO-X1 智能终端 黑色' }, 'SUP0001-003': { title: 'PRO-X1 智能终端 蓝色' },
    'SUP0002-001': { title: 'MX-400 模块 红色' }, 'SUP0002-003': { title: 'MX-400 模块 绿色' },
    'SUP0003-001': { title: 'LITE-A 轻量版 A' }, 'SUP0003-002': { title: 'LITE-A 轻量版 B' }, 'SUP0003-003': { title: 'LITE-A 轻量版 C' },
    'SUP0004-001': { title: 'MAX-90 大型 S' }, 'SUP0004-002': { title: 'MAX-90 大型 M' }, 'SUP0004-003': { title: 'MAX-90 大型 L' },
    'SUP0005-001': { title: 'PRO 配件 01' }, 'SUP0005-002': { title: 'PRO 配件 02' }, 'SUP0005-003': { title: 'PRO 配件 03' },
    'SUP0006-001': { title: 'MINI 迷你 01' }, 'SUP0006-002': { title: 'MINI 迷你 02' }, 'SUP0006-003': { title: 'MINI 迷你 03' }
  };

  // 商品主数据补齐：把新增的种子 SKU 追加到已存在的本地主数据（保留用户自建 SKU 与阈值调整）
  static ensureSeedProductSkus(): number {
    const raw = localStorage.getItem(KEYS.PRODUCT_SKUS);
    if (!raw) return 0; // 空库由完整种子落盘
    let list: ProductSku[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return 0;
      list = parsed;
    } catch (e) { return 0; }
    const have = new Set(list.map(s => s.sku));
    const missing = SEED_PRODUCT_SKUS.filter(s => !have.has(s.sku));
    if (missing.length === 0) return 0;
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify([...list, ...missing.map(s => ({ ...s }))]));
    return missing.length;
  }

  // 演示订单补齐：第 19~50 个 SKU 的订单 / 上架卡板 / 出库记录。
  // 已存在同单号则跳过；某托的目标仓位已被占用则跳过该托，保证不覆盖真实数据。
  // 返回新增的订单数。
  static ensureDemoOrders(): number {
    const readArr = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    };
    const orders = readArr(KEYS.ORDERS);
    if (orders.length === 0) return 0; // 空库走完整种子流程
    const demands = readArr(KEYS.DEMANDS);
    const inbounds = readArr(KEYS.INBOUNDS);
    const outbounds = readArr(KEYS.OUTBOUNDS);
    const outByInbound: Record<string, number> = {};
    outbounds.forEach(o => { outByInbound[o.inbound_id] = (outByInbound[o.inbound_id] || 0) + safeNum(o.outbound_qty); });
    const occupied = new Set(
      inbounds.filter(i => safeNum(i.actual_qty) - (outByInbound[i.id] || 0) > 0).map(i => i.position_code)
    );

    let added = 0;
    DEMO_ORDERS_V2.forEach(spec => {
      if (orders.some(o => o.order_no === spec.order_no)) return;
      orders.push({
        id: spec.id, order_no: spec.order_no, customer_code: 'PO26', model: spec.model,
        order_qty: spec.order_qty,
        per_pallet: spec.lines[0]?.maxPerPallet || 1,
        pallet_count: spec.lines.reduce((s, l) => s + Math.max(1, Math.ceil(l.qty / l.maxPerPallet)), 0),
        status: spec.status, created_at: spec.created_at,
        lines: spec.lines.map(l => ({ ...l }))
      } as Order);

      spec.pallets.forEach(p => {
        if (occupied.has(p.pos)) return;
        occupied.add(p.pos);
        const inboundId = `inbound_${spec.id}_${p.seq}`;
        demands.push({
          id: `demand_${spec.id}_${p.seq}`, order_id: spec.id, order_no: spec.order_no,
          sku: p.sku, model: p.title, seq: p.seq, position_code: p.pos, inbound_id: inboundId
        });
        inbounds.push({
          id: inboundId, order_id: spec.id, order_no: spec.order_no, sku: p.sku, model: p.title,
          seq: p.seq, position_code: p.pos, inbound_date: p.date, actual_qty: p.qty,
          line: p.pos.startsWith('A') ? '线别A-03' : '线别B-03', handler: p.handler,
          quality: p.quality, disposal: p.disposal, note: p.note
        } as any);
      });

      // 未到货部分：保留需求行（position 为空），等「待入库卡位分配」派位
      let seq = spec.pallets.length;
      spec.lines.forEach(l => {
        const covered = spec.pallets.filter(p => p.sku === l.sku).reduce((s, p) => s + p.qty, 0);
        if (l.qty - covered > 0) {
          seq += 1;
          demands.push({
            id: `demand_${spec.id}_${seq}`, order_id: spec.id, order_no: spec.order_no,
            sku: l.sku, model: l.title, seq, position_code: null, inbound_id: null
          });
        }
      });

      (spec.outbounds || []).forEach(o => {
        const p = spec.pallets.find(x => x.seq === o.seq);
        const inboundId = `inbound_${spec.id}_${o.seq}`;
        if (!p || !inbounds.some(i => i.id === inboundId)) return;
        outbounds.push({
          id: `outbound_${spec.id}_${o.seq}`, inbound_id: inboundId, order_id: spec.id, order_no: spec.order_no,
          model: p.title, position_code: p.pos, outbound_date: o.date, outbound_qty: o.qty,
          handler: o.handler, note: o.note
        } as any);
      });

      added += 1;
    });

    if (added === 0) return 0;
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
    return added;
  }

  // 库存初始化卡位：A 区每排 20 列，超出自动换排（A12-01..A12-20 → A13-01..）。
  // 新增 SKU 必须追加在 STOCK_SEED 末尾，这样既有 SKU 的卡位不会漂移。
  private static stockSeedPosition(index: number): string {
    const perRow = 20;
    const row = 12 + Math.floor(index / perRow);
    const col = (index % perRow) + 1;
    return `A${String(row).padStart(2, '0')}-${String(col).padStart(2, '0')}`;
  }

  // 平台名对齐靶场：只有 PLT-01 淘宝卖家中心（千牛）在靶场里有「商城/订单」靶场（tb-orders / tb-logistics），
  // 天猫为其下渠道；抖音(PLT-04)/小红书(PLT-13) 仅有达人·内容·笔记·舆情模块，京东/拼多多/快手/视频号则完全不存在。
  // 历史数据里的这些平台统一归并到 淘宝 / 天猫（幂等，可重复执行）
  static normalizeEcomPlatforms(): number {
    const PLATFORM_MAP: Record<string, string> = {
      '京东': '淘宝', '拼多多': '天猫', '快手': '淘宝', '视频号': '天猫',
      '抖音': '淘宝', '小红书': '天猫'
    };
    const raw = localStorage.getItem(KEYS.PENDING_OUTBOUNDS);
    if (!raw) return 0;
    let list: PendingOutbound[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return 0;
      list = parsed;
    } catch (e) { return 0; }
    let changed = 0;
    list.forEach(o => {
      const next = PLATFORM_MAP[o.platform];
      if (!next) return;
      if (o.note) o.note = o.note.split(o.platform).join(next);
      o.platform = next;
      changed++;
    });
    if (changed) this.savePendingOutbounds(list);
    return changed;
  }

  // 电商平台订单补齐：把缺少的演示电商订单追加进本地数据（按电商订单号去重，幂等）
  static ensureDemoEcomOrders(): number {
    const saved = localStorage.getItem(KEYS.PENDING_OUTBOUNDS);
    if (!saved) return 0; // 空库由完整种子落盘
    let list: PendingOutbound[];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return 0;
      list = parsed;
    } catch (e) { return 0; }
    const have = new Set(list.map(o => o.ecomOrderNo));
    const missing = DEMO_ECOM_ORDERS.filter(o => !have.has(o.ecomOrderNo));
    if (missing.length === 0) return 0;
    this.savePendingOutbounds([...list, ...missing.map(o => ({ ...o, id: generateUUID() }))]);
    return missing.length;
  }

  // 统一取 SKU 品名（以商品主数据为准，避免 STOCK_SEED_META 与主数据双份维护）
  private static skuTitle(sku: string): string {
    return SEED_PRODUCT_SKUS.find(s => s.sku === sku)?.title || this.STOCK_SEED_META[sku]?.title || sku;
  }

  // 旧数据升级：补种「库存初始化」入库流水（老库没有 stk-seed 流水会导致派生库存全为 0）
  static ensureSeedStockLedger() {
    const inbounds = this.getInbounds();
    let changed = false;
    Object.keys(this.STOCK_SEED).forEach((sku, idx) => {
      // 已有同 SKU 的初始化托（含旧编码 id 迁移过来的）不重复补种
      if (inbounds.some(i => i.order_id === 'stk-seed' && i.sku === sku)) return;
      const qty = this.STOCK_SEED[sku];
      if (!qty) return;
      inbounds.push({
        id: `inbound_stk_${sku}`,
        order_id: 'stk-seed',
        order_no: 'WH2026-STK',
        sku,
        model: this.skuTitle(sku),
        seq: idx + 1,
        position_code: this.stockSeedPosition(idx),
        inbound_date: '2026-08-20',
        actual_qty: qty,
        line: '线别C-01',
        handler: '赵磊',
        quality: 'OQC验Pass',
        note: '库存初始化（数据升级补种）'
      } as any);
      changed = true;
    });
    if (changed) this.saveInbounds(inbounds);
  }

  // 防重入锁：初始化内部会经 getInbounds() → initDatabaseIfEmpty() 回调自身，
  // 若不加锁会形成 init → ensureSeedStockLedger → getInbounds → init 的无限递归（栈溢出）
  private static _initRunning = false;

  // Init Data with realistic default records
  static initDatabaseIfEmpty() {
    if (this._initRunning) return;
    this._initRunning = true;
    try {
      this.seedDatabase();
    } finally {
      this._initRunning = false;
    }
  }

  // 实际播种逻辑（与 initDatabaseIfEmpty 拆分，以便加防重入锁）
  private static seedDatabase() {
    this.migrateLegacySkuCodes();
    this.ensureSeedProductSkus();
    this.purgeLegacySpuOrders();
    this.normalizeEcomPlatforms();
    this.ensureItemMaster();
    this.ensureSeedStockLedger();

    // ===== 采购单：确保 4 种状态齐全（待采购 / 已付款 / 待收货 / 已收货）=====
    // 待采购 → 可付款；已付款 → 等货到厂；待收货 → 自动在「入库计划」生成「待收货建卡板」行；已收货 → 进入 ERP 对账
    if (!localStorage.getItem(KEYS.PURCHASE_ORDERS)) {
      this.savePurchaseOrders([
        {
          poNo: 'PO20260901', supplierId: 'SUP0001', supplierName: '宏源实业有限公司',
          items: [
            { sku: 'SUP0001-002', title: 'PRO-X1 智能终端 黑色', need: 300, price: 320 },
            { sku: 'SUP0001-001', title: 'PRO-X1 智能终端 红色', need: 200, price: 320 }
          ],
          totalQty: 500, totalAmt: 300 * 320 + 200 * 320,
          status: '待收货', createdAt: '2026-09-01', expectDate: '2026-09-18',
          payMethod: '月结30天', note: '首批试产物料，已到厂待收货'
        },
        {
          poNo: 'PO20260905', supplierId: 'SUP0002', supplierName: '盛达工贸有限公司',
          items: [ { sku: 'SUP0002-002', title: 'MX-400 模块 黑色', need: 500, price: 180 } ],
          totalQty: 500, totalAmt: 500 * 180,
          status: '待采购', createdAt: '2026-09-05', expectDate: '2026-09-20',
          payMethod: '预付款', note: '常规备货'
        },
        {
          poNo: 'PO20260908', supplierId: 'SUP0006', supplierName: '锐进科技工贸',
          items: [ { sku: 'SUP0006-002', title: 'MINI 迷你 02', need: 240, price: 68 } ],
          totalQty: 240, totalAmt: 240 * 68,
          status: '已付款', createdAt: '2026-09-08', expectDate: '2026-09-22',
          payMethod: '预付全款', paidAt: '2026-09-08', payNo: 'TXN20260908001', paidAmt: 240 * 68,
          note: '已付全款，供应商备货中'
        },
        {
          poNo: 'PO20260810', supplierId: 'SUP0001', supplierName: '宏源实业有限公司',
          items: [
            { sku: 'SUP0001-001', title: 'PRO-X1 智能终端 红色', need: 200, price: 320 },
            { sku: 'SUP0003-001', title: 'LITE-A 轻量版 A', need: 150, price: 95 }
          ],
          totalQty: 350, totalAmt: 200 * 320 + 150 * 95,
          status: '待收货', createdAt: '2026-08-10', expectDate: '2026-09-12',
          payMethod: '月结30天', note: '加急补货，已到厂待收货'
        },
        {
          poNo: 'PO20260910', supplierId: 'SUP0003', supplierName: '中科科技有限公司',
          items: [
            { sku: 'SUP0001-002', title: 'PRO-X1 智能终端 黑色', need: 300, price: 320 },
            { sku: 'SUP0002-001', title: 'MX-400 模块 红色', need: 80, price: 180 }
          ],
          totalQty: 380, totalAmt: 300 * 320 + 80 * 180,
          status: '待收货', createdAt: '2026-09-10', expectDate: '2026-09-16',
          payMethod: '货到付款', note: '到厂待收货'
        },
        {
          poNo: 'PO20260912', supplierId: 'SUP0004', supplierName: '联创供应链有限公司',
          items: [
            { sku: 'SUP0004-002', title: 'MAX-90 大型 M', need: 100, price: 620 },
            { sku: 'SUP0005-003', title: 'PRO 配件 03', need: 200, price: 60 }
          ],
          totalQty: 300, totalAmt: 100 * 620 + 200 * 60,
          status: '已收货', receivedAt: '2026-09-14', createdAt: '2026-09-02', expectDate: '2026-09-12',
          payMethod: '月结60天', note: '已到货，四单一致'
        },
        {
          poNo: 'PO20260915', supplierId: 'SUP0005', supplierName: '华美德制造有限公司',
          items: [ { sku: 'SUP0005-001', title: 'PRO 配件 01', need: 300, price: 45 } ],
          totalQty: 300, totalAmt: 300 * 45,
          status: '已收货', receivedAt: '2026-09-15', createdAt: '2026-09-06', expectDate: '2026-09-14',
          payMethod: '预付款', note: '到货部分不合格'
        }
      ]);
    }
    // 已有业务数据（老库）：只补齐演示订单 / 电商订单，不重置任何内容
    if (localStorage.getItem(KEYS.ORDERS)) {
      this.ensureDemoOrders();
      this.ensureDemoEcomOrders();
      return;
    }

    // Pre-populate realistic historical orders, demands, inbounds, outbounds
    const orders: Order[] = [];
    const demands: PositionDemand[] = [];
    const inbounds: Inbound[] = [];
    const outbounds: Outbound[] = [];

    // 注：早期以 SPU 短码记型号的演示单（PO260701 / PO260810 / PO260815，model 为 PRO-X1 / MX-400 / LITE-A）
    // 已从数据源移除，避免其污染进销存总表；历史库由 purgeLegacySpuOrders() 清理。

    // ===== Order 4 - 多 SKU 出入库中（覆盖 待复检 / 不合格 / 让步接收 / 退货 / 报废）=====
    const order4Id = 'order_004';
    const o4: Order = {
      id: order4Id, order_no: 'PO260901', customer_code: 'PO26', model: 'PRO-X1 智能终端 红色 等 3 个 SKU',
      order_qty: 300, per_pallet: 100, pallet_count: 3, status: 'in_progress', created_at: '2026-09-01',
      lines: [
        { sku: 'SUP0001-001', title: 'PRO-X1 智能终端 红色', maxPerPallet: 150, qty: 150 },
        { sku: 'SUP0002-002', title: 'MX-400 模块 黑色', maxPerPallet: 80, qty: 80 },
        { sku: 'SUP0003-001', title: 'LITE-A 轻量版 A', maxPerPallet: 200, qty: 70 }
      ]
    };
    orders.push(o4);
    const o4Demands = [
      { seq: 1, sku: 'SUP0001-001', model: 'PRO-X1 智能终端 红色', pos: 'B03-01', qty: 150, quality: 'OQC验Pass' as const, note: '正常入库' },
      { seq: 2, sku: 'SUP0002-002', model: 'MX-400 模块 黑色', pos: 'B03-02', qty: 80, quality: '待复检' as const, note: '待复检拦截' },
      { seq: 3, sku: 'SUP0003-001', model: 'LITE-A 轻量版 A', pos: 'B03-03', qty: 70, quality: '不合格' as const, disposal: '让步接收' as const, note: '外观瑕疵，让步接收' },
      { seq: 4, sku: 'SUP0002-002', model: 'MX-400 模块 黑色', pos: 'B03-04', qty: 80, quality: '不合格' as const, disposal: '退货' as const, note: '尺寸超差，整托退货' },
      { seq: 5, sku: 'SUP0003-001', model: 'LITE-A 轻量版 A', pos: 'B03-05', qty: 80, quality: '不合格' as const, disposal: '报废' as const, note: '功能不良，整托报废' }
    ];
    o4Demands.forEach(d => {
      const demandId = `demand_o4_${d.seq}`;
      const inboundId = `inbound_o4_${d.seq}`;
      demands.push({ id: demandId, order_id: order4Id, order_no: o4.order_no, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_id: inboundId });
      inbounds.push({ id: inboundId, order_id: order4Id, order_no: o4.order_no, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_date: '2026-09-03', actual_qty: d.qty, line: '线别A-02', handler: '赵磊', quality: d.quality, disposal: d.disposal, note: d.note });
    });

    // ===== 新增：Order 5 - 已完结（全额入库且全部发出）=====
    const order5Id = 'order_005';
    const o5: Order = {
      id: order5Id, order_no: 'PO260905', customer_code: 'PO26', model: 'PRO-X1 智能终端 黑色',
      order_qty: 200, per_pallet: 100, pallet_count: 2, status: 'completed', created_at: '2026-09-05'
    };
    orders.push(o5);
    for (let i = 1; i <= 2; i++) {
      const demandId = `demand_o5_${i}`;
      const inboundId = `inbound_o5_${i}`;
      demands.push({ id: demandId, order_id: order5Id, order_no: o5.order_no, sku: 'SUP0001-002', model: o5.model, seq: i, position_code: `A05-0${i}`, inbound_id: inboundId });
      inbounds.push({ id: inboundId, order_id: order5Id, order_no: o5.order_no, sku: 'SUP0001-002', model: o5.model, seq: i, position_code: `A05-0${i}`, inbound_date: '2026-09-06', actual_qty: 100, line: '线别A-01', handler: '张敏', quality: 'OQC验Pass', note: '正常入库' });
      outbounds.push({ id: `outbound_o5_${i}`, inbound_id: inboundId, order_id: order5Id, order_no: o5.order_no, model: o5.model, position_code: `A05-0${i}`, outbound_date: '2026-09-12', outbound_qty: 100, handler: '王强', note: '全部发出，完结' });
    }

    // ===== 新增：Order 6 - 欠库不足（只到 2 托，未达订单量）=====
    const order6Id = 'order_006';
    const o6: Order = {
      id: order6Id, order_no: 'PO260910', customer_code: 'PO26', model: 'MX-400 模块 黑色',
      order_qty: 400, per_pallet: 80, pallet_count: 5, status: 'shortage', created_at: '2026-09-08'
    };
    orders.push(o6);
    for (let i = 1; i <= 2; i++) {
      const demandId = `demand_o6_${i}`;
      const inboundId = `inbound_o6_${i}`;
      demands.push({ id: demandId, order_id: order6Id, order_no: o6.order_no, sku: 'SUP0002-002', model: o6.model, seq: i, position_code: `B06-0${i}`, inbound_id: inboundId });
      inbounds.push({ id: inboundId, order_id: order6Id, order_no: o6.order_no, sku: 'SUP0002-002', model: o6.model, seq: i, position_code: `B06-0${i}`, inbound_date: '2026-09-09', actual_qty: 80, line: '线别B-02', handler: '陈芳', quality: 'OQC验Pass', note: '部分到货' });
    }

    // ===== 库存初始化入库：让各 SKU 落在 充裕 / 偏低 / 需补货 三档（派生库存按仓位账本实时计算）=====
    const stockSeed = this.STOCK_SEED;
    let stkIdx = 0;
    Object.keys(stockSeed).forEach(sku => {
      const qty = stockSeed[sku];
      if (!qty) return;
      const pos = this.stockSeedPosition(stkIdx);
      stkIdx += 1;
      const inboundId = `inbound_stk_${sku}`;
      inbounds.push({
        id: inboundId, order_id: 'stk-seed', order_no: 'WH2026-STK', sku, model: this.skuTitle(sku),
        seq: stkIdx, position_code: pos, inbound_date: '2026-08-20', actual_qty: qty,
        line: '线别C-01', handler: '赵磊', quality: 'OQC验Pass', note: '库存初始化'
      });
    });

    // ===== 跨月出库：丰富进销存月报 / 出库台账（均为 OQC 可售库存扣减）=====
    const stkOut: Array<[string, string, number, string, string]> = [
      ['SUP0001-001', '2026-08-20', 20, '刘杰', '大客户调拨'],
      ['SUP0001-001', '2026-09-05', 20, '王强', '电商备货'],
      ['SUP0002-003', '2026-08-25', 15, '陈芳', '线下门店'],
      ['SUP0003-001', '2026-09-08', 50, '张敏', '电商发货'],
      ['SUP0006-003', '2026-09-10', 10, '刘杰', '促销出货'],
      ['SUP0005-003', '2026-08-30', 30, '王强', '批发'],
      ['SUP0005-002', '2026-09-12', 10, '陈芳', '补货发出'],
      ['SUP0004-002', '2026-09-01', 5, '张敏', '样机出库']
    ];
    stkOut.forEach(([sku, date, qty, handler, note], i) => {
      outbounds.push({
        id: `outbound_stk_${i + 1}`, inbound_id: `inbound_stk_${sku}`, order_id: 'stk-seed', order_no: 'WH2026-STK',
        model: this.skuTitle(sku), position_code: this.stockSeedPosition(Object.keys(stockSeed).indexOf(sku)),
        outbound_date: date, outbound_qty: qty, handler, note
      });
    });

    // ===== 电商平台订单：8 个平台、28 条（16 待出库 / 12 已出库）=====
    const pendingOutbounds: PendingOutbound[] = DEMO_ECOM_ORDERS.map(o => ({ ...o, id: generateUUID() }));

    // ===== 已收货采购单入库（ERP 对账：一致 / 差异）=====
    // PO20260912 → 全额合格入库 → 一致；PO20260915 → 部分不合格 → 差异
    const recDemands = [
      { poNo: 'PO20260912', seq: 1, sku: 'SUP0004-002', model: 'MAX-90 大型 M', pos: 'A15-01', qty: 100, quality: 'OQC验Pass' as const },
      { poNo: 'PO20260912', seq: 2, sku: 'SUP0005-003', model: 'PRO 配件 03', pos: 'A15-02', qty: 200, quality: 'OQC验Pass' as const },
      { poNo: 'PO20260915', seq: 1, sku: 'SUP0005-001', model: 'PRO 配件 01', pos: 'A15-03', qty: 200, quality: 'OQC验Pass' as const },
      { poNo: 'PO20260915', seq: 2, sku: 'SUP0005-001', model: 'PRO 配件 01', pos: 'A15-04', qty: 100, quality: '不合格' as const, note: '到货抽检不合格，冻结待处置' }
    ];
    recDemands.forEach(d => {
      const demandId = `demand_rec_${d.poNo}_${d.seq}`;
      const inboundId = `inbound_rec_${d.poNo}_${d.seq}`;
      demands.push({ id: demandId, order_id: `rec-${d.poNo}`, order_no: d.poNo, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_id: inboundId, product: d.model });
      inbounds.push({ id: inboundId, order_id: `rec-${d.poNo}`, order_no: d.poNo, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_date: d.poNo === 'PO20260912' ? '2026-09-14' : '2026-09-15', actual_qty: d.qty, line: '线别A-01', handler: '张敏', quality: d.quality, note: d.note || '采购到货入库' });
    });

    // Save to localStorage
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
    localStorage.setItem(KEYS.PENDING_OUTBOUNDS, JSON.stringify(pendingOutbounds));

    // 追加扩充批次的演示订单（第 19~50 个 SKU 的订单 / 上架 / 出库记录）与电商平台订单
    this.ensureDemoOrders();
    this.ensureDemoEcomOrders();
  }

  // Orders CRUD
  static getOrders(): Order[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.ORDERS);
    const raw: Order[] = saved ? JSON.parse(saved) : [];
    // 兼容历史数据：无 lines 时按单 SKU 合成一行
    return raw.map(o => (o.lines && o.lines.length > 0)
      ? o
      : {
          ...o,
          lines: [{ sku: o.model, title: o.model, maxPerPallet: o.per_pallet || 1, qty: o.order_qty }]
        });
  }

  static saveOrders(orders: Order[]) {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  }

  static addOrder(orderNo: string, lines: InboundPlanLine[], meta?: { source?: 'manual' | 'purchase'; poNo?: string }): Order {
    const orders = this.getOrders();
    const upper = orderNo.trim().toUpperCase();
    if (!upper) throw new Error('计划编号不能为空！');
    if (!lines || lines.length === 0) throw new Error('请至少添加一个 SKU 行！');

    // Check uniqueness（跨表校验：自建计划编号不得与其它自建计划 / 采购单号重复）
    if (orders.some(o => o.order_no.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 已经存在！`);
    }
    if (this.getPurchaseOrders().some(p => p.poNo.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 与采购单号重复，请更换计划编号！`);
    }
    if (this.getPurchasePlanRows().some(r => r.poNo.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 与待收货采购单号重复，请更换计划编号！`);
    }

    const normalized = this.normalizePlanLines(lines);
    const totalQty = normalized.reduce((s, l) => s + l.qty, 0);
    const totalPallets = normalized.reduce((s, l) => s + Math.ceil(l.qty / l.maxPerPallet), 0);
    if (totalPallets > 2000) {
      throw new Error(`计划划分的卡位数量(${totalPallets}托)超过系统上限，请分批建单。`);
    }
    if (totalQty > 10000000) {
      throw new Error('计划总数量不能超过 10,000,000 Pcs，请确认数值是否正确！');
    }

    const customerCode = upper.length >= 4 ? upper.substring(0, 4) : upper;
    const newOrder: Order = {
      id: generateUUID(),
      order_no: upper,
      customer_code: customerCode.toUpperCase(),
      model: normalized.length === 1 ? normalized[0].title : `${normalized.length} 个SKU`,
      order_qty: totalQty,
      per_pallet: normalized[0].maxPerPallet,
      pallet_count: totalPallets,
      lines: normalized,
      source: meta?.source || 'manual',
      poNo: meta?.poNo,
      status: 'pending',
      created_at: formatters.dbDate()
    };

    orders.unshift(newOrder); // Newest first
    this.saveOrders(orders);

    // 派生卡板需求：每个 SKU 行按最大卡板容量向上拆托，一托只放一个 SKU
    const demands = this.getDemands();
    this.buildPlanDemands(newOrder, demands);
    this.saveDemands(demands);

    return newOrder;
  }

  // 规整 SKU 行：最大卡板容量与数量至少为 1
  private static normalizePlanLines(lines: InboundPlanLine[]): InboundPlanLine[] {
    return lines.map(l => ({
      sku: l.sku || l.title,
      title: l.title,
      maxPerPallet: Math.max(1, Number(l.maxPerPallet) || 1),
      qty: Math.max(1, Number(l.qty) || 0)
    }));
  }

  // 按 SKU 行生成卡板需求（一托一个 SKU，最后一托为余数）
  private static buildPlanDemands(order: Order, demands: PositionDemand[]) {
    let seq = 0;
    (order.lines || []).forEach(line => {
      const palletCount = Math.max(1, Math.ceil(line.qty / line.maxPerPallet));
      let remain = line.qty;
      for (let i = 0; i < palletCount; i++) {
        const qty = Math.min(line.maxPerPallet, remain);
        remain -= qty;
        seq += 1;
        demands.push({
          id: generateUUID(),
          order_id: order.id,
          order_no: order.order_no,
          sku: line.sku,
          model: line.title,
          product: line.title,
          source: 'order',
          seq,
          position_code: null,
          inbound_id: null,
          planned_qty: qty,
          maxPerPallet: line.maxPerPallet
        });
      }
    });
  }

  static deleteOrder(orderId: string): void {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('找不到该订单。');
    const order = orders[orderIndex];

    if (order.status !== 'pending') {
      throw new Error('仅允许删除处于“排单中”状态的订单。');
    }
    if (order.source === 'purchase') {
      throw new Error('该入库计划由采购单收货生成，不能删除；如需撤销请先回退采购单状态。');
    }

    // Delete order
    orders.splice(orderIndex, 1);
    this.saveOrders(orders);

    // Delete associated demands
    const demands = this.getDemands().filter(d => d.order_id !== orderId);
    this.saveDemands(demands);
  }

  static updateOrder(orderId: string, orderNo: string, lines: InboundPlanLine[]): void {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('找不到该计划。');
    const order = orders[orderIndex];

    if (order.status !== 'pending') {
      throw new Error('仅允许修改处于“排单中”状态的计划。');
    }

    const upper = orderNo.trim().toUpperCase();
    if (!upper) throw new Error('计划编号不能为空！');
    if (!lines || lines.length === 0) throw new Error('请至少添加一个 SKU 行！');

    if (orders.some(o => o.id !== orderId && o.order_no.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 已经存在！`);
    }

    const normalized = this.normalizePlanLines(lines);
    const totalQty = normalized.reduce((s, l) => s + l.qty, 0);
    const totalPallets = normalized.reduce((s, l) => s + Math.ceil(l.qty / l.maxPerPallet), 0);
    if (totalPallets > 2000) {
      throw new Error(`计划划分的卡位数量(${totalPallets}托)超过系统上限，请分批建单。`);
    }

    const customerCode = upper.length >= 4 ? upper.substring(0, 4) : upper;
    order.order_no = upper;
    order.customer_code = customerCode.toUpperCase();
    order.model = normalized.length === 1 ? normalized[0].title : `${normalized.length} 个SKU`;
    order.order_qty = totalQty;
    order.per_pallet = normalized[0].maxPerPallet;
    order.pallet_count = totalPallets;
    order.lines = normalized;

    this.saveOrders(orders);

    // 重建卡板需求
    const demands = this.getDemands().filter(d => d.order_id !== orderId);
    this.buildPlanDemands(order, demands);
    this.saveDemands(demands);
  }

  // Demands CRUD
  static getDemands(): PositionDemand[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.DEMANDS);
    return saved ? JSON.parse(saved) : [];
  }

  static saveDemands(demands: PositionDemand[]) {
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
  }

  // Inbounds CRUD
  static getInbounds(): Inbound[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.INBOUNDS);
    return saved ? JSON.parse(saved) : [];
  }

  static saveInbounds(inbounds: Inbound[]) {
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
  }

  static recordInbound(
    demandId: string,
    positionCode: string,
    date: string,
    actualQty: number,
    line: string,
    handler: string,
    quality: 'OQC验Pass' | '待复检' | '不合格',
    note: string
  ): Inbound {
    const demands = this.getDemands();
    const demandIndex = demands.findIndex(d => d.id === demandId);
    if (demandIndex === -1) {
      throw new Error(`找不到匹配的仓位需求行！`);
    }
    const demand = demands[demandIndex];

    // Check position code exists and matches rules
    const config = this.getWarehouseConfig();
    const codeMatch = positionCode.match(/^([A-Z])(\d{2})-(\d{2})$/);
    if (!codeMatch) {
      throw new Error(`仓位码格式不合法。应该形如: A01-02`);
    }
    const [_, zone, rowStr, colStr] = codeMatch;
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    const targetZone = config.zones.find(z => z.code === zone);
    if (!targetZone) {
      throw new Error(`区域 ${zone} 在系统配置中未定义`);
    }
    if (row < 1 || row > targetZone.rows) {
      throw new Error(`排数 ${row} 超出区域 ${zone} 的范围 (1-${targetZone.rows})`);
    }
    if (col < 1 || col > targetZone.cols) {
      throw new Error(`列数 ${col} 超出区域 ${zone} 的范围 (1-${targetZone.cols})`);
    }

    // Check if same (order_no, position_code) already in-stock to avoid double assignment
    const inboundsList = this.getInbounds();
    // Same position must not be actively occupied by another order
    const occupiedByOther = this.getPositions().find(p => p.code === positionCode && p.status === 'occupied');
    if (occupiedByOther) {
      throw new Error(`仓位码 ${positionCode} 已经被订单 ${occupiedByOther.order_no} 占用！`);
    }

    // Auto-fill today if date is empty
    const inboundDate = date ? date : formatters.dbDate();

    // Create Inbound Record
    const newInbound: Inbound = {
      id: generateUUID(),
      order_id: demand.order_id,
      order_no: demand.order_no,
      sku: demand.sku,
      model: demand.model || demand.product || '',
      seq: demand.seq,
      position_code: positionCode,
      inbound_date: inboundDate,
      actual_qty: actualQty,
      line,
      handler,
      quality,
      note
    };

    // Update the demand block
    demand.position_code = positionCode;
    demand.inbound_id = newInbound.id;

    inboundsList.push(newInbound);
    this.saveInbounds(inboundsList);
    this.saveDemands(demands);

    // Recompute Order statuses
    this.updateOrderStatus(demand.order_id);

    return newInbound;
  }

  // Update existing inbound record
  static updateInbound(
    inboundId: string,
    updates: {
      positionCode?: string;
      actualQty?: number;
      inboundDate?: string;
      line?: string;
      handler?: string;
      quality?: 'OQC验Pass' | '待复检' | '不合格';
      note?: string;
    }
  ): Inbound {
    const inboundsList = this.getInbounds();
    const inboundIndex = inboundsList.findIndex(i => i.id === inboundId);
    if (inboundIndex === -1) {
      throw new Error(`找不到要修改的入库记录！`);
    }

    const inbound = inboundsList[inboundIndex];

    // If position code is being updated, validate it
    if (updates.positionCode && updates.positionCode !== inbound.position_code) {
      const positionCode = updates.positionCode.trim().toUpperCase();
      const codeMatch = positionCode.match(/^([A-Z])(\d{2})-(\d{2})$/);
      if (!codeMatch) {
        throw new Error(`仓位码格式不合法。应该形如: A01-02`);
      }
      const [_, zone, rowStr, colStr] = codeMatch;
      const row = parseInt(rowStr, 10);
      const col = parseInt(colStr, 10);

      const config = this.getWarehouseConfig();
      const targetZone = config.zones.find(z => z.code === zone);
      if (!targetZone) {
        throw new Error(`区域 ${zone} 在系统配置中未定义`);
      }
      if (row < 1 || row > targetZone.rows) {
        throw new Error(`排数 ${row} 超出区域 ${zone} 的范围 (1-${targetZone.rows})`);
      }
      if (col < 1 || col > targetZone.cols) {
        throw new Error(`列数 ${col} 超出区域 ${zone} 的范围 (1-${targetZone.cols})`);
      }

      // Check if another order occupies this position
      const occupiedByOther = this.getPositions().find(p => p.code === positionCode && p.status === 'occupied' && p.order_id !== inbound.order_id);
      if (occupiedByOther) {
        throw new Error(`仓位码 ${positionCode} 已经被订单 ${occupiedByOther.order_no} 占用！`);
      }

      inbound.position_code = positionCode;
    }

    if (updates.actualQty !== undefined && updates.actualQty > 0) {
      inbound.actual_qty = updates.actualQty;
    }
    if (updates.inboundDate) inbound.inbound_date = updates.inboundDate;
    if (updates.line) inbound.line = updates.line;
    if (updates.handler) inbound.handler = updates.handler;
    if (updates.quality) inbound.quality = updates.quality;
    if (updates.note !== undefined) inbound.note = updates.note;

    // Update corresponding demand
    const demands = this.getDemands();
    const demand = demands.find(d => d.inbound_id === inboundId || (d.order_id === inbound.order_id && d.seq === inbound.seq));
    if (demand) {
      demand.position_code = inbound.position_code;
    }

    inboundsList[inboundIndex] = inbound;
    this.saveInbounds(inboundsList);
    this.saveDemands(demands);
    this.updateOrderStatus(inbound.order_id);

    return inbound;
  }

  // 不合格品处置：让步接收（转可售）/ 退货 / 报废（清空该托库存）
  static disposeInbound(inboundId: string, disposal: '让步接收' | '退货' | '报废') {
    const inbounds = this.getInbounds();
    const idx = inbounds.findIndex(i => i.id === inboundId);
    if (idx === -1) throw new Error('找不到该入库卡板！');
    const inb = inbounds[idx];

    if (disposal === '让步接收') {
      inb.quality = 'OQC验Pass';
      inb.disposal = '让步接收';
    } else {
      // 退货/报废：清空该托库存；SKU 在售库存由仓位账本实时推导，此处无需改 SKU 账
      inb.actual_qty = 0;
      inb.disposal = disposal;
    }
    inb.note = (inb.note ? inb.note + ' | ' : '') + `不合格处置：${disposal}`;
    inbounds[idx] = inb;
    this.saveInbounds(inbounds);
    this.updateOrderStatus(inb.order_id);
  }

  // Delete / Rollback an inbound record
  static deleteInbound(inboundId: string) {
    const inboundsList = this.getInbounds();
    const inbound = inboundsList.find(i => i.id === inboundId);
    if (!inbound) {
      throw new Error(`找不到要撤销的入库记录！`);
    }

    // Check if there are active outbounds associated
    const outboundsList = this.getOutbounds();
    const hasOutbounds = outboundsList.some(o => o.inbound_id === inboundId);
    if (hasOutbounds) {
      throw new Error(`该入库卡板已存在出库流水，无法直接撤销入库！请先撤销相关出库记录。`);
    }

    // Remove inbound
    const newInbounds = inboundsList.filter(i => i.id !== inboundId);
    this.saveInbounds(newInbounds);

    // 回退入库：SKU 在售库存由仓位账本实时推导，撤销入库记录后自动反映，无需改 SKU 账

    // Reset demand to unallocated
    const demands = this.getDemands();
    const demand = demands.find(d => d.inbound_id === inboundId || (d.order_id === inbound.order_id && d.seq === inbound.seq));
    if (demand) {
      demand.position_code = null;
      demand.inbound_id = null;
      this.saveDemands(demands);
    }

    this.updateOrderStatus(inbound.order_id);
  }

  // Outbounds CRUD
  static getOutbounds(): Outbound[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.OUTBOUNDS);
    return saved ? JSON.parse(saved) : [];
  }

  static saveOutbounds(outbounds: Outbound[]) {
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
  }

  static recordOutbound(
    inboundId: string,
    outboundDate: string,
    outboundQty: number,
    handler: string,
    note: string
  ): Outbound {
    const inbounds = this.getInbounds();
    const inbound = inbounds.find(i => i.id === inboundId);
    if (!inbound) {
      throw new Error(`找不到该入库记录！`);
    }

    // Quality gate: only OQC验Pass stock is shippable
    if (inbound.quality && inbound.quality !== 'OQC验Pass') {
      throw new Error(
        `该入库记录品质状态为「${inbound.quality}」，不可出库！请先复检通过或走不合格处理流程。`
      );
    }

    // Calculate current stock for this specific inbound card
    const stockQty = this.getPositionStock(inbound.id);
    if (outboundQty <= 0) {
      throw new Error(`出库数量必须大于 0`);
    }
    if (outboundQty > stockQty) {
      throw new Error(`出库数量 (${outboundQty}) 不能超过当前在库结存 (${stockQty})`);
    }

    const outboundsList = this.getOutbounds();
    const newOutbound: Outbound = {
      id: generateUUID(),
      inbound_id: inboundId,
      order_id: inbound.order_id,
      order_no: inbound.order_no,
      model: inbound.model,
      position_code: inbound.position_code,
      outbound_date: outboundDate ? outboundDate : formatters.dbDate(),
      outbound_qty: outboundQty,
      handler,
      note
    };

    outboundsList.push(newOutbound);
    this.saveOutbounds(outboundsList);

    // SKU 在售库存由仓位账本实时推导（inbound 对应出库已记录），无需改 SKU 账

    // Update status
    this.updateOrderStatus(inbound.order_id);

    return newOutbound;
  }

  static deleteOutbound(outboundId: string) {
    const outboundsList = this.getOutbounds();
    const outbound = outboundsList.find(o => o.id === outboundId);
    if (!outbound) return;

    const filtered = outboundsList.filter(o => o.id !== outboundId);
    this.saveOutbounds(filtered);

    // 回退出库：SKU 在售库存由仓位账本实时推导，撤销出库记录后自动加回

    this.updateOrderStatus(outbound.order_id);
  }

  // ===== 电商待出库发货单（电商已付款订单 → WMS 待出库 → 出库回写物流） =====
  static getPendingOutbounds(): PendingOutbound[] {
    const saved = localStorage.getItem(KEYS.PENDING_OUTBOUNDS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  }

  static savePendingOutbounds(list: PendingOutbound[]) {
    localStorage.setItem(KEYS.PENDING_OUTBOUNDS, JSON.stringify(list));
  }

  // 模拟电商系统推送：收到已付款订单，生成一条待出库记录
  static receiveEcomOrder(): PendingOutbound {
    const positions = this.getPositions().filter(p =>
      p.status === 'occupied' && p.quality === 'OQC验Pass' && (p.qty || 0) > 0
    );
    if (positions.length === 0) {
      throw new Error('当前没有可售库存，无法生成电商待出库订单');
    }
    const exist = this.getPendingOutbounds();
    const idx = exist.length;
    const pos = positions[idx % positions.length];
    // 平台只取靶场有商城订单靶场的渠道：PLT-01 淘宝卖家中心（含天猫）
    const platforms = ['淘宝', '天猫', '淘宝'];
    const recipients = ['张伟（上海浦东）', '李娜（北京朝阳）', '王芳（广州天河）', '陈晨（杭州西湖）', '赵磊（成都武侯）', '吴敏（郑州金水）'];
    const qty = Math.max(1, Math.floor((pos.qty || 1) / 10));
    const order: PendingOutbound = {
      id: generateUUID(),
      ecomOrderNo: 'EC' + formatters.dbDate().replace(/-/g, '') + String(idx + 1).padStart(3, '0'),
      platform: platforms[idx % platforms.length],
      model: pos.model || '未知型号',
      qty,
      recipient: recipients[idx % recipients.length],
      address: '默认收货地址',
      status: '待出库',
      ecomStatus: '已发货',
      createdAt: formatters.dbDate(),
      note: `电商${platforms[idx % platforms.length]}订单已发货，推送至 WMS 待出库拣货`
    };
    exist.push(order);
    this.savePendingOutbounds(exist);
    return order;
  }

  // 出库执行：匹配可售库存卡位扣减，生成正式出库流水，并回写电商物流状态为已出库
  static fulfillPendingOutbound(id: string, handler: string): Outbound[] {
    const list = this.getPendingOutbounds();
    const pending = list.find(p => p.id === id);
    if (!pending) throw new Error('找不到待出库记录');
    if (pending.status === '已出库') return [];

    let left = pending.qty;
    const created: Outbound[] = [];
    const today = formatters.dbDate();

    // 按 model 匹配 OQC验Pass 且有库存的卡位，库存升序优先用尽零散仓位
    const pick = (matchModel: boolean) => this.getPositions()
      .filter(p => p.status === 'occupied' && p.quality === 'OQC验Pass' && (p.qty || 0) > 0 && (!matchModel || p.model === pending.model))
      .sort((a, b) => (a.qty || 0) - (b.qty || 0));

    let candidates = pick(true);
    if (candidates.length === 0) {
      // 兜底：外部平台（如淘宝）推送的型号命名可能与 WMS 不同，退化为任意可售库存
      candidates = pick(false);
    }

    if (candidates.length === 0) {
      throw new Error(`型号 ${pending.model} 当前无可售库存，无法出库`);
    }

    for (const c of candidates) {
      if (left <= 0) break;
      const take = Math.min(left, c.qty || 0);
      if (take <= 0) continue;
      created.push(this.recordOutbound(c.inbound_id!, today, take, handler, `电商订单${pending.ecomOrderNo}出库`));
      left -= take;
    }

    if (left > 0) {
      throw new Error(`型号 ${pending.model} 可售库存不足，仅完成 ${pending.qty - left}/${pending.qty}`);
    }

    pending.status = '已出库';
    pending.outboundAt = today;
    pending.logisticsNo = 'SF' + pending.id.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase();
    pending.note = `已出库，物流单号 ${pending.logisticsNo}（电商物流状态：已出库）`;
    this.savePendingOutbounds(list);
    return created;
  }

  // 出库执行（指定仓位）：按用户选择的仓位分配数量扣减，同一 SKU 可来自多个仓位
  static fulfillPendingOutboundWithAllocations(
    id: string,
    handler: string,
    allocations: { inboundId: string; qty: number }[]
  ): Outbound[] {
    const list = this.getPendingOutbounds();
    const pending = list.find(p => p.id === id);
    if (!pending) throw new Error('找不到待出库记录');
    if (pending.status === '已出库') return [];

    const valid = allocations.filter(a => a.inboundId && a.qty > 0);
    if (valid.length === 0) throw new Error('请至少选择一个出库仓位！');
    const total = valid.reduce((s, a) => s + a.qty, 0);
    if (total !== pending.qty) {
      throw new Error(`已分配数量(${total}) 必须等于待出库数量(${pending.qty})`);
    }

    const today = formatters.dbDate();
    const created: Outbound[] = [];
    valid.forEach(a => {
      created.push(this.recordOutbound(a.inboundId, today, a.qty, handler, `电商订单${pending.ecomOrderNo}出库（指定仓位）`));
    });

    pending.status = '已出库';
    pending.outboundAt = today;
    pending.ecomStatus = '已出库';
    pending.logisticsNo = pending.logisticsNo || ('SF' + pending.id.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase());
    pending.note = `已出库，从 ${valid.length} 个仓位扣减，物流单号 ${pending.logisticsNo}`;
    this.savePendingOutbounds(list);
    return created;
  }

  // Get current stock for an inbound ID
  static getPositionStock(inboundId: string): number {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    const inbound = inbounds.find(i => i.id === inboundId);
    if (!inbound) return 0;

    const totalIn = inbound.actual_qty;
    const totalOut = outbounds
      .filter(o => o.inbound_id === inboundId)
      .reduce((sum, o) => sum + o.outbound_qty, 0);

    return Math.max(0, totalIn - totalOut);
  }

  // Update order's status based on cumulative values
  static updateOrderStatus(orderId: string) {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    const demands = this.getDemands().filter(d => d.order_id === orderId);
    const inbounds = this.getInbounds().filter(i => i.order_id === orderId);
    const outbounds = this.getOutbounds().filter(o => o.order_id === orderId);

    const sumInbound = inbounds.reduce((sum, i) => sum + i.actual_qty, 0);
    const sumOutbound = outbounds.reduce((sum, o) => sum + o.outbound_qty, 0);
    const stockBalance = sumInbound - sumOutbound;

    if (sumInbound === 0) {
      order.status = 'pending';
    } else if (sumInbound >= order.order_qty && stockBalance === 0) {
      order.status = 'completed';
    } else if (sumInbound < order.order_qty) {
      order.status = 'shortage'; // Missing or outstanding target qty
    } else {
      order.status = 'in_progress';
    }

    this.saveOrders(orders);
  }

  // Computed views for Orders (including aggregates)
  static getOrdersWithMetrics() {
    const orders = this.getOrders();
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    return orders.map(o => {
      const oInbounds = inbounds.filter(i => i.order_id === o.id);
      const oOutbounds = outbounds.filter(ob => ob.order_id === o.id);

      const inboundQty = oInbounds.reduce((sum, i) => sum + i.actual_qty, 0);
      const outboundQty = oOutbounds.reduce((sum, ob) => sum + ob.outbound_qty, 0);
      const stockQty = inboundQty - outboundQty;
      const shortageQty = Math.max(0, o.order_qty - inboundQty);

      // Turn-around Days: last day of month vs first inbound date
      let turnoverDays = 0;
      if (stockQty > 0 && oInbounds.length > 0) {
        const firstInDate = new Date(Math.min(...oInbounds.map(i => new Date(i.inbound_date).getTime())));
        // Get end of current month
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const diffTime = Math.abs(endOfMonth.getTime() - firstInDate.getTime());
        turnoverDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        ...o,
        inbound_qty: inboundQty,
        shortage_qty: shortageQty,
        outbound_qty: outboundQty,
        stock_qty: stockQty,
        turnover_days: turnoverDays
      };
    });
  }

  // Position Matrix Generator
  static getPositions(): Position[] {
    const config = this.getWarehouseConfig();
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    // Map of position_code -> occupied data
    const occupiedMap = new Map<string, { inbound: Inbound; stock: number }>();

    inbounds.forEach(inb => {
      // Calculate current stock for this inbound
      const outs = outbounds.filter(o => o.inbound_id === inb.id).reduce((sum, o) => sum + o.outbound_qty, 0);
      const stock = inb.actual_qty - outs;
      if (stock > 0) {
        // Position has stock
        occupiedMap.set(inb.position_code, { inbound: inb, stock });
      }
    });

    const positions: Position[] = [];
    for (const zone of config.zones) {
      for (let r = 1; r <= zone.rows; r++) {
        for (let c = 1; c <= zone.cols; c++) {
          const rowStr = String(r).padStart(2, '0');
          const colStr = String(c).padStart(2, '0');
          const code = `${zone.code}${rowStr}-${colStr}`;

          const activeData = occupiedMap.get(code);

          if (activeData) {
            positions.push({
              code,
              zone: zone.code,
              row: r,
              col: c,
              status: 'occupied',
              order_id: activeData.inbound.order_id,
              order_no: activeData.inbound.order_no,
              model: activeData.inbound.model,
              qty: activeData.stock,
              quality: activeData.inbound.quality,
              inbound_id: activeData.inbound.id,
              inbound_date: activeData.inbound.inbound_date,
              seq: activeData.inbound.seq,
              line: activeData.inbound.line,
              handler: activeData.inbound.handler
            });
          } else {
            positions.push({
              code,
              zone: zone.code,
              row: r,
              col: c,
              status: 'available',
              order_id: null,
              order_no: null,
              model: null,
              qty: null,
              quality: null,
              inbound_id: null,
              inbound_date: null,
              seq: null,
              line: null,
              handler: null
            });
          }
        }
      }
    }

    return positions;
  }

  // Core metrics for Dashboard / Header
  static getOverallStats() {
    const positions = this.getPositions();
    const totalCapacity = positions.length;
    const occupiedCount = positions.filter(p => p.status === 'occupied').length;
    const availableCount = totalCapacity - occupiedCount;

    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    // Split stock by quality: OQC验Pass = sellable, others = frozen
    let sellableIn = 0, sellableOut = 0, frozenIn = 0, frozenOut = 0;
    inbounds.forEach(i => {
      const out = outbounds
        .filter(o => o.inbound_id === i.id)
        .reduce((s, o) => s + o.outbound_qty, 0);
      if (i.quality === 'OQC验Pass') {
        sellableIn += i.actual_qty;
        sellableOut += out;
      } else {
        frozenIn += i.actual_qty;
        frozenOut += out;
      }
    });
    const sumIn = sellableIn + frozenIn;
    const sumOut = sellableOut + frozenOut;
    const stockBalance = sumIn - sumOut;
    const sellableBalance = sellableIn - sellableOut;
    const frozenBalance = frozenIn - frozenOut;

    // Production-to-Sales Balance Rate = total outbound / total inbound (all time)
    const balanceRate = sumIn > 0 ? sumOut / sumIn : 0;

    // Shortage orders count (how many orders are lacking items)
    const ordersWithMetrics = this.getOrdersWithMetrics();
    const shortageOrdersCount = ordersWithMetrics.filter(o => o.shortage_qty > 0).length;

    // Average turnover days
    const activeTurnovers = ordersWithMetrics.filter(o => o.stock_qty > 0 && o.turnover_days > 0);
    const avgTurnoverDays = activeTurnovers.length > 0 
      ? Math.round(activeTurnovers.reduce((sum, o) => sum + o.turnover_days, 0) / activeTurnovers.length)
      : 0;

    // Full Warehouse Warning (爆仓预警)
    // Formula: 可用仓位 - Σ(各进行中订单未入库卡位数量) * (1 - 产销平衡率)
    const pendingPalletCount = ordersWithMetrics
      .filter(o => o.status === 'pending' || o.status === 'shortage' || o.status === 'in_progress')
      .reduce((sum, o) => {
        // Calculate how many pallets are still to be placed
        const completedPallets = inbounds.filter(i => i.order_id === o.id).length;
        const remainingPallets = Math.max(0, o.pallet_count - completedPallets);
        return sum + remainingPallets;
      }, 0);

    const warningFactor = pendingPalletCount * (1 - balanceRate);
    const warningIndex = availableCount - warningFactor;
    const isWarning = warningIndex < 0;

    return {
      totalCapacity,
      occupiedCount,
      availableCount,
      occupancyRate: totalCapacity > 0 ? (occupiedCount / totalCapacity) * 100 : 0,
      stockBalance,
      sellableBalance,
      frozenBalance,
      shortageOrdersCount,
      avgTurnoverDays,
      balanceRate,
      pendingPalletCount,
      warningIndex,
      isWarning,
      warningFactor
    };
  }

  // Monthly Report Generator (期初 + 本期入库 - 本期出库 = 期末)
  static getMonthlyInventory(year: number, month: number): InventoryMonthRecord[] {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    // End date of last month
    const startOfMonthDate = new Date(year, month - 1, 1);
    const endOfMonthDate = new Date(year, month, 1);

    // Get unique combinations of (order_no, position_code) across all time
    const combinations = new Map<string, { order_no: string; position_code: string; model: string; sku?: string; quality: string }>();

    inbounds.forEach(i => {
      const key = `${i.order_no}||${i.position_code}`;
      if (!combinations.has(key)) {
        combinations.set(key, {
          order_no: i.order_no,
          position_code: i.position_code,
          model: i.model,
          sku: this.resolveSkuCode(i.model, i.sku),
          quality: i.quality
        });
      }
    });

    const records: InventoryMonthRecord[] = [];

    combinations.forEach((info, key) => {
      const orderInbounds = inbounds.filter(i => i.order_no === info.order_no && i.position_code === info.position_code);
      const orderOutbounds = outbounds.filter(o => o.order_no === info.order_no && o.position_code === info.position_code);

      // 1. Opening stock (cumulative In - cumulative Out before startOfMonthDate)
      const openingIn = orderInbounds
        .filter(i => new Date(i.inbound_date) < startOfMonthDate)
        .reduce((sum, i) => sum + i.actual_qty, 0);

      const openingOut = orderOutbounds
        .filter(o => new Date(o.outbound_date) < startOfMonthDate)
        .reduce((sum, o) => sum + o.outbound_qty, 0);

      const opening = Math.max(0, openingIn - openingOut);

      // 2. Current Month Inbound
      const currentIn = orderInbounds
        .filter(i => {
          const d = new Date(i.inbound_date);
          return d >= startOfMonthDate && d < endOfMonthDate;
        })
        .reduce((sum, i) => sum + i.actual_qty, 0);

      // 3. Current Month Outbound
      const currentOut = orderOutbounds
        .filter(o => {
          const d = new Date(o.outbound_date);
          return d >= startOfMonthDate && d < endOfMonthDate;
        })
        .reduce((sum, o) => sum + o.outbound_qty, 0);

      // 4. Closing balance
      const closing = opening + currentIn - currentOut;

      // Split closing by quality: OQC验Pass = sellable, others = frozen
      // 口径对齐：只统计月末截止日出库，保证 期末 = 可售 + 冻结
      let closingSellable = 0;
      let closingFrozen = 0;
      orderInbounds.forEach(i => {
        const out = outbounds
          .filter(o => o.inbound_id === i.id && new Date(o.outbound_date) < endOfMonthDate)
          .reduce((s, x) => s + x.outbound_qty, 0);
        const stock = Math.max(0, i.actual_qty - out);
        if (i.quality === 'OQC验Pass') closingSellable += stock;
        else closingFrozen += stock;
      });

      // Only display if there was any historical stock or active transactions in this month
      if (opening > 0 || currentIn > 0 || currentOut > 0 || closing > 0) {
        records.push({
          year,
          month,
          order_no: info.order_no,
          model: info.model,
          sku: info.sku,
          position_code: info.position_code,
          opening,
          inbound: currentIn,
          outbound: currentOut,
          closing,
          closingSellable,
          closingFrozen,
          quality: info.quality
        });
      }
    });

    return records;
  }

  // Clear data / Reset defaults
  static resetToDefault() {
    // 清空全部业务与主数据 KEY（含供应商/SKU/补货计划/采购单/待出库/采购计划行），
    // 避免"恢复默认演示数据"后出现半新半旧的残留状态
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    this.initDatabaseIfEmpty();
  }

  static resetDatabase() {
    this.resetToDefault();
  }
}
