/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'planner' | 'inbound' | 'outbound' | 'manager' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

// 商品主数据（SPU 级，即「主体商品」）：一个商品下挂多个 SKU（规格 / 颜色不同）
export interface ProductModel {
  itemId: string;       // 商品ID（SPU 级编码），如 SPU0001
  name: string;         // 型号短码，如 PRO-X1（用于入库 / 订单的型号字段）
  itemName?: string;    // 商品名称（展示用），如 PRO-X1 智能终端
  code?: string;        // SPU 短码（4 位数字），如 PRO-X1 → 0001
  default_per_pallet: number;
  safety_stock: number; // 安全库存阈值 (Pcs)，低于此值触发补货预警
}

// 入库计划 SKU 行：每个 SKU 设置最大卡板容量与实际数量，
// 一个托只放同一 SKU，托数 = CEILING(实际数量 / 最大卡板容量)
export interface InboundPlanLine {
  sku: string;           // SKU 编码（手动可留空，用型号名）
  title: string;         // 品名 / 型号
  maxPerPallet: number;  // 最大卡板容量
  qty: number;           // 实际数量
}

export interface Order {
  id: string; // Unique GUID/ID
  order_no: string; // 计划编号（自动/手动），唯一
  customer_code: string; // Left 4 chars of order_no
  model: string; // 兼容字段：单 SKU 时为型号；多 SKU 时为摘要
  order_qty: number; // 所有 SKU 行实际数量合计
  per_pallet: number; // 兼容字段：首行最大卡板容量
  pallet_count: number; // 所有 SKU 行托数合计
  lines?: InboundPlanLine[]; // 1-多个 SKU 行
  source?: 'manual' | 'purchase'; // 来源：手动新建 / 采购单收货
  poNo?: string;              // 采购来源关联的采购单号
  status: 'pending' | 'in_progress' | 'completed' | 'shortage' | 'pending_receipt';
  created_at: string;
}

export interface PositionDemand {
  id: string;
  order_id: string;
  order_no: string;
  sku?: string; // 内部 SKU 编码（仓位账本真相源关联键；缺失时按 model 兼容解析）
  model: string; // 成品订单型号
  product?: string; // 采购到货商品名（成品订单用 model）
  source?: 'purchase' | 'order'; // 需求来源：采购 / 成品订单
  seq: number; // 1 to pallet_count
  position_code: string | null; // e.g. A01-02
  inbound_id: string | null; // Linked inbound entry
  planned_qty?: number; // 该托的计划入库数量（按最大卡板容量拆分，末托为余数）
  maxPerPallet?: number; // 该托所属 SKU 的最大卡板容量
}

export interface Inbound {
  id: string;
  order_id: string;
  order_no: string;
  sku?: string; // 内部 SKU 编码（仓位账本真相源关联键；缺失时按 model 兼容解析）
  model: string;
  seq: number;
  position_code: string;
  inbound_date: string; // YYYY-MM-DD
  actual_qty: number;
  line: string;
  handler: string;
  quality: 'OQC验Pass' | '不合格' | '待复检';
  disposal?: '退货' | '报废' | '让步接收'; // 不合格品处置结果
  note: string;
}

export interface Outbound {
  id: string;
  inbound_id: string;
  order_id: string;
  order_no: string;
  model: string;
  position_code: string;
  outbound_date: string; // YYYY-MM-DD
  outbound_qty: number;
  handler: string;
  note: string;
}

// 电商推送的待出库发货单（电商已付款订单 → WMS 待出库 → 出库回写物流）
export interface PendingOutbound {
  id: string;
  ecomOrderNo: string;     // 电商订单号
  platform: string;        // 电商平台（淘宝 / 天猫，来源为 PLT-01 淘宝卖家中心，靶场有订单台/物流靶场）
  model: string;           // 商品型号 / SKU
  qty: number;             // 待发货数量
  recipient: string;       // 收货人
  address: string;         // 收货地址
  status: '待出库' | '已出库';
  ecomStatus: string;       // 电商侧订单状态（如：已发货）
  createdAt: string;
  outboundAt?: string;
  logisticsNo?: string;    // 出库后生成的物流单号
  note?: string;
}

export interface Position {
  code: string; // Zone + Row(2D) + "-" + Col(2D)
  zone: string;
  row: number;
  col: number;
  status: 'available' | 'occupied';
  order_id?: string | null;
  order_no?: string | null;
  model?: string | null;
  qty?: number | null;
  quality?: 'OQC验Pass' | '不合格' | '待复检' | null;
  inbound_id?: string | null;
  inbound_date?: string | null;
  seq?: number | null;
  line?: string | null;
  handler?: string | null;
}

export interface WarehouseZoneConfig {
  code: string; // e.g. 'A', 'B'
  rows: number;
  cols: number;
}

export interface WarehouseConfig {
  zones: WarehouseZoneConfig[];
}

export interface InventoryMonthRecord {
  year: number;
  month: number;
  order_no: string;
  model: string;
  sku?: string; // 关联 SKU 主数据的编码（供应商货号，如 SUP0001-001）
  position_code: string;
  opening: number;
  inbound: number;
  outbound: number;
  closing: number;
  closingSellable: number;
  closingFrozen: number;
  quality: string;
}

// ===== 供应链主数据（用于补货预警 / 补货计划 / 采购单） =====
export interface Supplier {
  id: string;
  name: string;
  location: string;
  moq: number;
  rating: number;
}

export interface ProductSku {
  sku: string;
  itemId: string;           // 所属商品ID（SPU 级，如 SPU0001）——一个商品可挂多个 SKU
  title: string;
  emoji?: string;
  cat?: string;
  color?: string;
  spec?: string;
  price: number;
  stock: number;
  perPallet: number;        // 单托容量（一个托只放该 SKU，超出则拆多托）
  supplierId: string;
  supplierName?: string;
  replenishPoint: number;   // 补货值：stock ≤ 补货值 触发补货
  abundanceThreshold: number; // 充裕值：stock < 充裕值 被合并补货
}

export type PurchaseStatus = '待采购' | '已付款' | '待收货' | '已收货';

export interface PurchaseOrder {
  poNo: string;
  supplierId: string;
  supplierName: string;
  items: { sku: string; title: string; need: number; price: number }[];
  totalQty: number;
  totalAmt: number;
  status: PurchaseStatus;
  createdAt: string;
  receivedAt?: string;
  expectDate?: string;
  payMethod?: string;
  note?: string;
  paidAt?: string;    // 付款日期（待采购 → 已付款 时写入）
  payNo?: string;     // 付款流水号
  paidAmt?: number;   // 实付金额
}

// 待收货的采购单，落库为「待收货建卡板」入库计划行（跨模块可见、刷新不丢）
export interface PurchasePlanRow {
  id: string;            // plan-<poNo>-<sku>
  poNo: string;
  supplierId: string;
  supplierName: string;
  sku: string;
  model: string;         // 展示名（item.title）
  need: number;          // 需求数量
  perPallet: number;     // 单托数量（一 SKU 一卡板）
  palletCount: number;
  status: '待收货建卡板';
  createdAt: string;
}
