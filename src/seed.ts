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
  // SUP0001 · 宏源实业 · OVEN-X1
  { sku: 'SUP0001-001', title: 'OVEN-X1 电烤箱 红色', emoji: '🔥', cat: '厨电', color: '红', spec: '30L', price: 320, stock: 8, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-002', title: 'OVEN-X1 电烤箱 黑色', emoji: '🔥', cat: '厨电', color: '黑', spec: '30L', price: 320, stock: 35, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-003', title: 'OVEN-X1 电烤箱 蓝色', emoji: '🔥', cat: '厨电', color: '蓝', spec: '30L', price: 320, stock: 62, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  // SUP0002 · 盛达工贸 · MICRO-400
  { sku: 'SUP0002-001', title: 'MICRO-400 微波炉 红色', emoji: '♨️', cat: '厨电', color: '红', spec: '20L', price: 180, stock: 12, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-002', title: 'MICRO-400 微波炉 黑色', emoji: '♨️', cat: '厨电', color: '黑', spec: '20L', price: 180, stock: 18, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-003', title: 'MICRO-400 微波炉 绿色', emoji: '♨️', cat: '厨电', color: '绿', spec: '20L', price: 180, stock: 70, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  // SUP0003 · 中科科技 · TOAST-A
  { sku: 'SUP0003-001', title: 'TOAST-A 烤面包机 A', emoji: '🍞', cat: '厨电', color: '', spec: '基础款', price: 95, stock: 5, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0003-002', title: 'TOAST-A 烤面包机 B', emoji: '🍞', cat: '厨电', color: '', spec: '升级款', price: 110, stock: 30, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0003-003', title: 'TOAST-A 烤面包机 C', emoji: '🍞', cat: '厨电', color: '', spec: '旗舰款', price: 130, stock: 45, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  // SUP0004 · 联创供应链 · DISH-90
  { sku: 'SUP0004-001', title: 'DISH-90 洗碗机 S', emoji: '🍽️', cat: '厨电', color: '', spec: '6套', price: 560, stock: 6, perPallet: 50, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0004-002', title: 'DISH-90 洗碗机 M', emoji: '🍽️', cat: '厨电', color: '', spec: '8套', price: 620, stock: 22, perPallet: 50, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0004-003', title: 'DISH-90 洗碗机 L', emoji: '🍽️', cat: '厨电', color: '', spec: '12套', price: 680, stock: 28, perPallet: 50, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  // SUP0005 · 华美德 · BAKE 配件
  { sku: 'SUP0005-001', title: 'BAKE 配件 01', emoji: '🧁', cat: '配件', color: '', spec: '6寸活底', price: 45, stock: 40, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-002', title: 'BAKE 配件 02', emoji: '🧁', cat: '配件', color: '', spec: '8寸活底', price: 52, stock: 9, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-003', title: 'BAKE 配件 03', emoji: '🧁', cat: '配件', color: '', spec: '蛋糕模', price: 60, stock: 88, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  // SUP0006 · 锐进科技 · MINI
  { sku: 'SUP0006-001', title: 'MINI 迷你煮蛋器 01', emoji: '🥚', cat: '厨电', color: '', spec: '单层', price: 78, stock: 4, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0006-002', title: 'MINI 迷你煮蛋器 02', emoji: '🥚', cat: '厨电', color: '', spec: '双层', price: 120, stock: 33, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0006-003', title: 'MINI 迷你煮蛋器 03', emoji: '🥚', cat: '厨电', color: '', spec: '三层', price: 99, stock: 50, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },

  // ===== 以下为扩充批次（第 19~50 个 SKU），覆盖全部 8 家供应商 =====
  // SUP0001 · 宏源实业
  { sku: 'SUP0001-004', title: 'OVEN-X1 电烤箱 金色', emoji: '🔥', cat: '厨电', color: '金', spec: '30L', price: 320, stock: 0, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-005', title: 'OVEN-X1 电烤箱 银色', emoji: '🔥', cat: '厨电', color: '银', spec: '45L', price: 380, stock: 0, perPallet: 150, supplierId: 'SUP0001', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0001-006', title: 'AIRF-2 空气炸锅 深空灰', emoji: '🍟', cat: '厨电', color: '灰', spec: '4L', price: 460, stock: 0, perPallet: 120, supplierId: 'SUP0001', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0001-007', title: 'FREEZ-P10 冷柜 蓝色', emoji: '🧊', cat: '厨电', color: '蓝', spec: '100L', price: 880, stock: 0, perPallet: 60, supplierId: 'SUP0001', replenishPoint: 10, abundanceThreshold: 25 },
  // SUP0002 · 盛达工贸
  { sku: 'SUP0002-004', title: 'MICRO-400 微波炉 蓝色', emoji: '♨️', cat: '厨电', color: '蓝', spec: '20L', price: 180, stock: 0, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-005', title: 'MICRO-400 微波炉 白色', emoji: '♨️', cat: '厨电', color: '白', spec: '23L', price: 195, stock: 0, perPallet: 80, supplierId: 'SUP0002', replenishPoint: 25, abundanceThreshold: 60 },
  { sku: 'SUP0002-006', title: 'COOK-5 电磁炉 黑色', emoji: '🍳', cat: '厨电', color: '黑', spec: '2200W', price: 650, stock: 0, perPallet: 40, supplierId: 'SUP0002', replenishPoint: 8, abundanceThreshold: 20 },
  { sku: 'SUP0002-007', title: 'COOK-5 电磁炉 白色', emoji: '🍳', cat: '厨电', color: '白', spec: '2200W', price: 650, stock: 0, perPallet: 40, supplierId: 'SUP0002', replenishPoint: 8, abundanceThreshold: 20 },
  // SUP0003 · 中科科技
  { sku: 'SUP0003-004', title: 'TOAST-A 烤面包机 D', emoji: '🍞', cat: '厨电', color: '', spec: '旗舰款', price: 145, stock: 0, perPallet: 200, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0003-005', title: 'COFFEE-B1 咖啡机 灰色', emoji: '☕', cat: '厨电', color: '灰', spec: '基础款', price: 210, stock: 0, perPallet: 100, supplierId: 'SUP0003', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0003-006', title: 'COFFEE-B1 咖啡机 白色', emoji: '☕', cat: '厨电', color: '白', spec: '升级款', price: 240, stock: 0, perPallet: 100, supplierId: 'SUP0003', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0003-007', title: 'STEAM-C3 电蒸锅 白色', emoji: '🥟', cat: '厨电', color: '白', spec: '三层', price: 168, stock: 0, perPallet: 120, supplierId: 'SUP0003', replenishPoint: 15, abundanceThreshold: 40 },
  // SUP0004 · 联创供应链
  { sku: 'SUP0004-004', title: 'DISH-90 洗碗机 XL', emoji: '🍽️', cat: '厨电', color: '', spec: '16套', price: 780, stock: 0, perPallet: 40, supplierId: 'SUP0004', replenishPoint: 12, abundanceThreshold: 30 },
  { sku: 'SUP0004-005', title: 'FRIDGE-R2 冰箱 黑色', emoji: '🧊', cat: '厨电', color: '黑', spec: '双门', price: 1250, stock: 0, perPallet: 20, supplierId: 'SUP0004', replenishPoint: 5, abundanceThreshold: 12 },
  { sku: 'SUP0004-006', title: 'FRIDGE-R2 冰箱 白色', emoji: '🧊', cat: '厨电', color: '白', spec: '单门', price: 880, stock: 0, perPallet: 20, supplierId: 'SUP0004', replenishPoint: 5, abundanceThreshold: 12 },
  { sku: 'SUP0004-007', title: 'BLEND-P3 破壁机 黑色', emoji: '🥤', cat: '厨电', color: '黑', spec: '1200W', price: 320, stock: 0, perPallet: 150, supplierId: 'SUP0004', replenishPoint: 20, abundanceThreshold: 50 },
  // SUP0005 · 华美德制造
  { sku: 'SUP0005-004', title: 'BAKE 配件 04', emoji: '🧁', cat: '配件', color: '', spec: '吐司模', price: 68, stock: 0, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-005', title: 'BAKE 配件 05', emoji: '🧁', cat: '配件', color: '', spec: '饼干模', price: 75, stock: 0, perPallet: 300, supplierId: 'SUP0005', replenishPoint: 30, abundanceThreshold: 80 },
  { sku: 'SUP0005-006', title: 'CORD-K1 电源线 白色', emoji: '🔌', cat: '配件', color: '白', spec: '1.5m', price: 22, stock: 0, perPallet: 600, supplierId: 'SUP0005', replenishPoint: 60, abundanceThreshold: 150 },
  { sku: 'SUP0005-007', title: 'CORD-K1 电源线 黑色', emoji: '🔌', cat: '配件', color: '黑', spec: '1.5m', price: 22, stock: 0, perPallet: 600, supplierId: 'SUP0005', replenishPoint: 60, abundanceThreshold: 150 },
  // SUP0006 · 锐进科技工贸
  { sku: 'SUP0006-004', title: 'MINI 迷你煮蛋器 04', emoji: '🥚', cat: '厨电', color: '', spec: '五层', price: 88, stock: 0, perPallet: 240, supplierId: 'SUP0006', replenishPoint: 18, abundanceThreshold: 45 },
  { sku: 'SUP0006-005', title: 'SOUP-S5 电炖锅 单胆', emoji: '🍲', cat: '厨电', color: '', spec: '单胆', price: 260, stock: 0, perPallet: 80, supplierId: 'SUP0006', replenishPoint: 10, abundanceThreshold: 25 },
  { sku: 'SUP0006-006', title: 'SOUP-S5 电炖锅 双胆', emoji: '🍲', cat: '厨电', color: '', spec: '双胆', price: 340, stock: 0, perPallet: 80, supplierId: 'SUP0006', replenishPoint: 10, abundanceThreshold: 25 },
  { sku: 'SUP0006-007', title: 'WASH-W2 迷你洗衣机 8kg', emoji: '🧺', cat: '厨电', color: '', spec: '8kg', price: 990, stock: 0, perPallet: 90, supplierId: 'SUP0006', replenishPoint: 8, abundanceThreshold: 20 },
  // SUP0007 · 恒辉精密制造
  { sku: 'SUP0007-001', title: 'MOLD-B8 烘焙模具 6寸', emoji: '🧁', cat: '烘焙', color: '', spec: '6寸', price: 35, stock: 0, perPallet: 500, supplierId: 'SUP0007', replenishPoint: 40, abundanceThreshold: 100 },
  { sku: 'SUP0007-002', title: 'MOLD-B8 烘焙模具 8寸', emoji: '🧁', cat: '烘焙', color: '', spec: '8寸', price: 42, stock: 0, perPallet: 500, supplierId: 'SUP0007', replenishPoint: 40, abundanceThreshold: 100 },
  { sku: 'SUP0007-003', title: 'GRIND-G9 磨豆机 手摇', emoji: '⚙️', cat: '烘焙', color: '', spec: '手摇', price: 120, stock: 0, perPallet: 200, supplierId: 'SUP0007', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0007-004', title: 'HUMID-U4 加湿器 灰色', emoji: '💧', cat: '厨电', color: '灰', spec: '4L', price: 130, stock: 0, perPallet: 150, supplierId: 'SUP0007', replenishPoint: 15, abundanceThreshold: 40 },
  // SUP0008 · 远东物联科技
  { sku: 'SUP0008-001', title: 'STEW-T1 电炖盅 黑色', emoji: '🍵', cat: '厨电', color: '黑', spec: '1.5L', price: 95, stock: 0, perPallet: 200, supplierId: 'SUP0008', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0008-002', title: 'STEW-T1 电炖盅 白色', emoji: '🍵', cat: '厨电', color: '白', spec: '2.5L', price: 105, stock: 0, perPallet: 200, supplierId: 'SUP0008', replenishPoint: 20, abundanceThreshold: 50 },
  { sku: 'SUP0008-003', title: 'ICE-M1 制冰机 家用', emoji: '🧊', cat: '厨电', color: '', spec: '家用', price: 140, stock: 0, perPallet: 180, supplierId: 'SUP0008', replenishPoint: 15, abundanceThreshold: 40 },
  { sku: 'SUP0008-004', title: 'PANINI-D1 电饼铛 28cm', emoji: '🥞', cat: '厨电', color: '', spec: '28cm', price: 420, stock: 0, perPallet: 60, supplierId: 'SUP0008', replenishPoint: 10, abundanceThreshold: 25 },
];

/* ===== 商品主数据（SPU 级）=====
   由 SKU 主数据按「型号」聚合生成：型号 = 品名首词（「BAKE 配件」系列首词为 BAKE，单独特判）。
   商品ID 规则：SPU + 四位序号；一个商品下可挂多个 SKU（颜色 / 规格不同）。 */
const MODEL_CN: Record<string, string> = {
  'OVEN-X1': '电烤箱', 'AIRF-2': '空气炸锅', 'FREEZ-P10': '冷柜',
  'MICRO-400': '微波炉', 'COOK-5': '电磁炉', 'TOAST-A': '烤面包机',
  'COFFEE-B1': '咖啡机', 'STEAM-C3': '电蒸锅', 'DISH-90': '洗碗机',
  'FRIDGE-R2': '双门冰箱', 'BLEND-P3': '破壁机', 'BAKE 配件': '烘焙配件',
  'CORD-K1': '电源线', 'MINI': '迷你煮蛋器', 'SOUP-S5': '电炖锅',
  'WASH-W2': '迷你洗衣机', 'MOLD-B8': '烘焙模具', 'GRIND-G9': '磨豆机',
  'HUMID-U4': '加湿器', 'STEW-T1': '电炖盅', 'ICE-M1': '制冰机', 'PANINI-D1': '电饼铛'
};

// 从品名推导型号（与前端 assets/data.js 的 modelOf 保持一致口径）
export const modelOfTitle = (title: string): string => {
  const t = String(title || '').trim();
  if (t.indexOf('BAKE 配件') === 0) return 'BAKE 配件';
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
  'SKU-TOAST-A': 'SUP0003-001', 'SKU-LITE-B': 'SUP0003-002', 'SKU-LITE-C': 'SUP0003-003',
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
