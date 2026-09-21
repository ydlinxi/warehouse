/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 商品(SKU)与供应商主数据种子 —— 用于补货预警 / 补货计划 / 采购单演示。
 * 融合自 v3 仿真靶场的 RPA_DATA（SKU_FLAT / ALI_SUPPLIERS），作为 warehouse 的真实主数据。
 */

import { Supplier, ProductSku, ProductModel } from './types';

// 供应商主数据：地域/MOQ/评级多样化，覆盖不同采购场景（长交期大批量、小批量快反等）
export const SEED_SUPPLIERS: Supplier[] = [
  { id: 'SUP0001', name: '宏源实业有限公司', location: '深圳', moq: 10, rating: 4.8 },
  { id: 'SUP0002', name: '盛达工贸有限公司', location: '广州', moq: 20, rating: 4.6 },
  { id: 'SUP0003', name: '中科科技有限公司', location: '东莞', moq: 5, rating: 4.9 },
  { id: 'SUP0004', name: '联创供应链有限公司', location: '苏州', moq: 50, rating: 4.5 },
  { id: 'SUP0005', name: '华美德制造有限公司', location: '宁波', moq: 100, rating: 4.7 },
  { id: 'SUP0006', name: '锐进科技工贸', location: '杭州', moq: 2, rating: 4.4 },
  { id: 'SUP0007', name: '恒辉精密制造', location: '佛山', moq: 15, rating: 4.6 },
  { id: 'SUP0008', name: '远东物联科技', location: '武汉', moq: 30, rating: 4.3 },
];

// stock 故意压低部分 SKU 以演示补货触发；replenishPoint=补货值，abundanceThreshold=充裕值
// perPallet=单托容量：一个托只放同一 SKU，数量超出则向上拆多托
//
// 两级主数据：
//   · 商品ID（SPU 级，如 SPU0001）—— 主体商品，一个商品可挂多个 SKU
//   · SKU ID（SKU 级，如 SUP0001-001）—— 规格单品，直接沿用供应商货号，供应商 / 仓库 / 电商上架 三层共用同一编码
// SKU 编码格式：<供应商编号>-<该供应商下商品序号>；颜色 / 规格由 color / spec 字段承载，不进入编码。
const RAW_SKUS: Omit<ProductSku, 'itemId'>[] = [
  // SUP0001 · 宏源实业 · PRO-X1
  { sku: 'SUP0001-001', title: 'PRO-X1 智能终端 红色', emoji: '📱', cat: '电子', color: '红', spec: '4G+64G', price: 320, stock: 8, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-002', title: 'PRO-X1 智能终端 黑色', emoji: '📱', cat: '电子', color: '黑', spec: '4G+64G', price: 320, stock: 35, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-003', title: 'PRO-X1 智能终端 蓝色', emoji: '📱', cat: '电子', color: '蓝', spec: '4G+64G', price: 320, stock: 62, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  // SUP0002 · 盛达工贸 · MX-400
  { sku: 'SUP0002-001', title: 'MX-400 模块 红色', emoji: '🔧', cat: '模块', color: '红', spec: '标准版', price: 180, stock: 12, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-002', title: 'MX-400 模块 黑色', emoji: '🔧', cat: '模块', color: '黑', spec: '标准版', price: 180, stock: 18, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-003', title: 'MX-400 模块 绿色', emoji: '🔧', cat: '模块', color: '绿', spec: '标准版', price: 180, stock: 70, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  // SUP0003 · 中科科技 · LITE-A
  { sku: 'SUP0003-001', title: 'LITE-A 轻量版 A', emoji: '💡', cat: '电子', color: '', spec: '基础', price: 95, stock: 5, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0003-002', title: 'LITE-A 轻量版 B', emoji: '💡', cat: '电子', color: '', spec: '增强', price: 110, stock: 30, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0003-003', title: 'LITE-A 轻量版 C', emoji: '💡', cat: '电子', color: '', spec: '旗舰', price: 130, stock: 45, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  // SUP0004 · 联创供应链 · MAX-90
  { sku: 'SUP0004-001', title: 'MAX-90 大型 S', emoji: '📦', cat: '整机', color: '', spec: '小型', price: 560, stock: 6, perPallet: 50, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0004-002', title: 'MAX-90 大型 M', emoji: '📦', cat: '整机', color: '', spec: '中型', price: 620, stock: 22, perPallet: 50, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0004-003', title: 'MAX-90 大型 L', emoji: '📦', cat: '整机', color: '', spec: '大型', price: 680, stock: 28, perPallet: 50, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  // SUP0005 · 华美德 · PRO 配件
  { sku: 'SUP0005-001', title: 'PRO 配件 01', emoji: '🔌', cat: '配件', color: '', spec: 'A类', price: 45, stock: 40, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-002', title: 'PRO 配件 02', emoji: '🔌', cat: '配件', color: '', spec: 'B类', price: 52, stock: 9, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-003', title: 'PRO 配件 03', emoji: '🔌', cat: '配件', color: '', spec: 'C类', price: 60, stock: 88, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  // SUP0006 · 锐进科技 · MINI
  { sku: 'SUP0006-001', title: 'MINI 迷你 01', emoji: '🎧', cat: '音频', color: '', spec: '耳塞', price: 78, stock: 4, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0006-002', title: 'MINI 迷你 02', emoji: '🎧', cat: '音频', color: '', spec: '头戴', price: 120, stock: 33, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0006-003', title: 'MINI 迷你 03', emoji: '🎧', cat: '音频', color: '', spec: '颈挂', price: 99, stock: 50, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },

  // ===== 以下为扩充批次（第 19~50 个 SKU），覆盖全部 8 家供应商 =====
  // SUP0001 · 宏源实业
  { sku: 'SUP0001-004', title: 'PRO-X1 智能终端 金色', emoji: '📱', cat: '电子', color: '金', spec: '4G+64G', price: 320, stock: 0, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-005', title: 'PRO-X1 智能终端 银色', emoji: '📱', cat: '电子', color: '银', spec: '8G+128G', price: 380, stock: 0, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-006', title: 'AIR-2 平板 深空灰', emoji: '📲', cat: '电子', color: '灰', spec: '64G', price: 460, stock: 0, perPallet: 120, supplierId: 'SUP0001', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0001-007', title: 'TAB-P10 平板 蓝色', emoji: '📲', cat: '电子', color: '蓝', spec: '10.1 寸', price: 880, stock: 0, perPallet: 60, supplierId: 'SUP0001', replenishPoint: 10, abundanceThreshold: 25 },
  // SUP0002 · 盛达工贸
  { sku: 'SUP0002-004', title: 'MX-400 模块 蓝色', emoji: '🔧', cat: '模块', color: '蓝', spec: '标准版', price: 180, stock: 0, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-005', title: 'MX-400 模块 白色', emoji: '🔧', cat: '模块', color: '白', spec: '增强版', price: 195, stock: 0, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-006', title: 'GATE-5 网关 黑色', emoji: '📡', cat: '模块', color: '黑', spec: '5G 双频', price: 650, stock: 0, perPallet: 40, supplierId: 'SUP0002', replenishPoint: 8, abundanceThreshold: 20 },
  { sku: 'SUP0002-007', title: 'GATE-5 网关 白色', emoji: '📡', cat: '模块', color: '白', spec: '5G 双频', price: 650, stock: 0, perPallet: 40, supplierId: 'SUP0002', replenishPoint: 8, abundanceThreshold: 20 },
  // SUP0003 · 中科科技
  { sku: 'SUP0003-004', title: 'LITE-A 轻量版 D', emoji: '💡', cat: '电子', color: '', spec: '旗舰', price: 145, stock: 0, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0003-005', title: 'NEO-B1 智能音箱 灰色', emoji: '🔊', cat: '音频', color: '灰', spec: '标准', price: 210, stock: 0, perPallet: 100, supplierId: 'SUP0003', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0003-006', title: 'NEO-B1 智能音箱 白色', emoji: '🔊', cat: '音频', color: '白', spec: '增强', price: 240, stock: 0, perPallet: 100, supplierId: 'SUP0003', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0003-007', title: 'CAM-C3 摄像头 白色', emoji: '📷', cat: '电子', color: '白', spec: '2K', price: 168, stock: 0, perPallet: 120, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  // SUP0004 · 联创供应链
  { sku: 'SUP0004-004', title: 'MAX-90 大型 XL', emoji: '📦', cat: '整机', color: '', spec: '超大', price: 780, stock: 0, perPallet: 40, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0004-005', title: 'RACK-R2 机柜 黑色', emoji: '🗄️', cat: '整机', color: '黑', spec: '42U', price: 1250, stock: 0, perPallet: 20, supplierId: 'SUP0004', replenishPoint: 5, abundanceThreshold: 12 },
  { sku: 'SUP0004-006', title: 'RACK-R2 机柜 白色', emoji: '🗄️', cat: '整机', color: '白', spec: '22U', price: 880, stock: 0, perPallet: 20, supplierId: 'SUP0004', replenishPoint: 5, abundanceThreshold: 12 },
  { sku: 'SUP0004-007', title: 'POWER-P3 电源 黑色', emoji: '🔋', cat: '配件', color: '黑', spec: '1000W', price: 320, stock: 0, perPallet: 150, supplierId: 'SUP0004', replenishPoint: 20, abundanceThreshold: 50 },
  // SUP0005 · 华美德制造
  { sku: 'SUP0005-004', title: 'PRO 配件 04', emoji: '🔌', cat: '配件', color: '', spec: 'D类', price: 68, stock: 0, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-005', title: 'PRO 配件 05', emoji: '🔌', cat: '配件', color: '', spec: 'E类', price: 75, stock: 0, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-006', title: 'CABLE-K1 数据线 白色', emoji: '🧵', cat: '配件', color: '白', spec: '1.5m', price: 22, stock: 0, perPallet: 600, supplierId: 'SUP0005', replenishPoint: 60, abundanceThreshold: 150 },
  { sku: 'SUP0005-007', title: 'CABLE-K1 数据线 黑色', emoji: '🧵', cat: '配件', color: '黑', spec: '1.5m', price: 22, stock: 0, perPallet: 600, supplierId: 'SUP0005', replenishPoint: 60, abundanceThreshold: 150 },
  // SUP0006 · 锐进科技工贸
  { sku: 'SUP0006-004', title: 'MINI 迷你 04', emoji: '🎧', cat: '音频', color: '', spec: '入耳式', price: 88, stock: 0, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0006-005', title: 'SOUND-S5 蓝牙音箱 单喇叭', emoji: '📻', cat: '音频', color: '', spec: '单喇叭', price: 260, stock: 0, perPallet: 80, supplierId: 'SUP0006', replenishPoint: 10, abundanceThreshold: 25 },
  { sku: 'SUP0006-006', title: 'SOUND-S5 蓝牙音箱 双喇叭', emoji: '📻', cat: '音频', color: '', spec: '双喇叭', price: 340, stock: 0, perPallet: 80, supplierId: 'SUP0006', replenishPoint: 10, abundanceThreshold: 25 },
  { sku: 'SUP0006-007', title: 'WATCH-W2 智能手表 46mm', emoji: '⌚', cat: '电子', color: '', spec: '46mm', price: 990, stock: 0, perPallet: 90, supplierId: 'SUP0006', replenishPoint: 8, abundanceThreshold: 20 },
  // SUP0007 · 恒辉精密制造
  { sku: 'SUP0007-001', title: 'BEAR-B8 轴承 6204', emoji: '⚙️', cat: '五金', color: '', spec: '6204', price: 35, stock: 0, perPallet: 500, supplierId: 'SUP0007', replenishPoint: 40, abundanceThreshold: 100 },
  { sku: 'SUP0007-002', title: 'BEAR-B8 轴承 6205', emoji: '⚙️', cat: '五金', color: '', spec: '6205', price: 42, stock: 0, perPallet: 500, supplierId: 'SUP0007', replenishPoint: 40, abundanceThreshold: 100 },
  { sku: 'SUP0007-003', title: 'GEAR-G9 齿轮 模数2', emoji: '🔩', cat: '五金', color: '', spec: '模数 2', price: 120, stock: 0, perPallet: 200, supplierId: 'SUP0007', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0007-004', title: 'HUB-U4 集线器 灰色', emoji: '🔗', cat: '配件', color: '灰', spec: '7 口', price: 130, stock: 0, perPallet: 150, supplierId: 'SUP0007', replenishPoint: 15, abundanceThreshold: 40 },
  // SUP0008 · 远东物联科技
  { sku: 'SUP0008-001', title: 'SENSOR-T1 传感器 黑色', emoji: '🌡️', cat: '传感', color: '黑', spec: '温度', price: 95, stock: 0, perPallet: 200, supplierId: 'SUP0008', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0008-002', title: 'SENSOR-T1 传感器 白色', emoji: '🌡️', cat: '传感', color: '白', spec: '湿度', price: 105, stock: 0, perPallet: 200, supplierId: 'SUP0008', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0008-003', title: 'IOT-M1 模组 NB-IoT', emoji: '📶', cat: '模块', color: '', spec: 'NB-IoT', price: 140, stock: 0, perPallet: 180, supplierId: 'SUP0008', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0008-004', title: 'PANEL-D1 显示屏 7寸', emoji: '🖥️', cat: '电子', color: '', spec: '7 寸', price: 420, stock: 0, perPallet: 60, supplierId: 'SUP0008', replenishPoint: 10, abundanceThreshold: 25 },
];

/* ===== 商品主数据（SPU 级）=====
   由 SKU 主数据按「型号」聚合生成：型号 = 品名首词（「PRO 配件」系列首词为 PRO，单独特判）。
   商品ID 规则：SPU + 四位序号；一个商品下可挂多个 SKU（颜色 / 规格不同）。 */
const MODEL_CN: Record<string, string> = {
  'PRO-X1': '智能终端', 'AIR-2': '平板电脑', 'TAB-P10': '平板电脑',
  'MX-400': '通信模块', 'GATE-5': '网关设备', 'LITE-A': '轻量终端',
  'NEO-B1': '智能音箱', 'CAM-C3': '摄像头', 'MAX-90': '整机机箱',
  'RACK-R2': '服务器机柜', 'POWER-P3': '电源模块', 'PRO 配件': '结构配件',
  'CABLE-K1': '数据线', 'MINI': '迷你音频', 'SOUND-S5': '蓝牙音箱',
  'WATCH-W2': '智能手表', 'BEAR-B8': '精密轴承', 'GEAR-G9': '齿轮',
  'HUB-U4': '集线器', 'SENSOR-T1': '传感器', 'IOT-M1': '物联网模组', 'PANEL-D1': '显示屏'
};

// 从品名推导型号（与前端 assets/data.js 的 modelOf 保持一致口径）
export const modelOfTitle = (title: string): string => {
  const t = String(title || '').trim();
  if (t.indexOf('PRO 配件') === 0) return 'PRO 配件';
  return t.split(' ')[0] || t;
};

const _models: string[] = [];
RAW_SKUS.forEach(s => {
  const m = modelOfTitle(s.title);
  if (_models.indexOf(m) < 0) _models.push(m);
});

export const SEED_ITEMS: ProductModel[] = _models.map((m, i) => {
  const skus = RAW_SKUS.filter(s => modelOfTitle(s.title) === m);
  const seq = String(i + 1).padStart(4, '0');
  return {
    itemId: 'SPU' + seq,
    name: m,                                     // 型号短码（入库 / 订单 model 字段沿用）
    itemName: MODEL_CN[m] ? `${m} ${MODEL_CN[m]}` : m,  // 商品名称（展示）
    code: seq,                                   // SPU 短码
    default_per_pallet: skus.reduce((a, s) => Math.max(a, s.perPallet), 1),
    safety_stock: skus.reduce((a, s) => a + s.replenishPoint, 0)
  };
});

const _itemIdByModel: Record<string, string> = Object.fromEntries(SEED_ITEMS.map(it => [it.name, it.itemId]));

// 给每个 SKU 挂上所属商品ID
export const SEED_PRODUCT_SKUS: ProductSku[] = RAW_SKUS.map(s => ({
  ...s,
  itemId: _itemIdByModel[modelOfTitle(s.title)] || SEED_ITEMS[0].itemId
}));

// 旧 SKU 编码 → 新供应商货号迁移映射（v1 SKU-X1-RED / v2 E0001-01 统一迁到 SUP0001-001），用于升级已存在的本地数据
export const SKU_MIGRATION: Record<string, string> = {
  'SKU-X1-RED': 'SUP0001-001', 'SKU-X1-BLK': 'SUP0001-002', 'SKU-X1-BLU': 'SUP0001-003',
  'SKU-MX-RED': 'SUP0002-001', 'SKU-MX-BLK': 'SUP0002-002', 'SKU-MX-GRN': 'SUP0002-003',
  'SKU-LITE-A': 'SUP0003-001', 'SKU-LITE-B': 'SUP0003-002', 'SKU-LITE-C': 'SUP0003-003',
  'SKU-MAX-S': 'SUP0004-001', 'SKU-MAX-M': 'SUP0004-002', 'SKU-MAX-L': 'SUP0004-003',
  'SKU-PRO-01': 'SUP0005-001', 'SKU-PRO-02': 'SUP0005-002', 'SKU-PRO-03': 'SUP0005-003',
  'SKU-MINI-01': 'SUP0006-001', 'SKU-MINI-02': 'SUP0006-002', 'SKU-MINI-03': 'SUP0006-003',
  'E0001-01': 'SUP0001-001', 'E0001-02': 'SUP0001-002', 'E0001-03': 'SUP0001-003',
  'M0002-01': 'SUP0002-001', 'M0002-02': 'SUP0002-002', 'M0002-03': 'SUP0002-003',
  'E0003-01': 'SUP0003-001', 'E0003-02': 'SUP0003-002', 'E0003-03': 'SUP0003-003',
  'C0004-01': 'SUP0004-001', 'C0004-02': 'SUP0004-002', 'C0004-03': 'SUP0004-003',
  'A0005-01': 'SUP0005-001', 'A0005-02': 'SUP0005-002', 'A0005-03': 'SUP0005-003',
  'U0006-01': 'SUP0006-001', 'U0006-02': 'SUP0006-002', 'U0006-03': 'SUP0006-003'
};
