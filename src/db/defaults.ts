// src/db/defaults.ts — 默认静态数据与存储键（从 db.ts 抽离，P2-4）
// 说明：DEFAULT_* 与 KEYS 原在 db.ts 顶层；现抽到独立模块并 facade 再导出（KEYS 为内部使用、不对外再导出）。
import { ProductModel } from '../types';

export const DEFAULT_MODELS: ProductModel[] = [
  { itemId: 'SPU0001', name: 'OVEN-X1', code: '0001', default_per_pallet: 150, safety_stock: 600 },
  { itemId: 'SPU0002', name: 'MICRO-400', code: '0002', default_per_pallet: 80, safety_stock: 480 },
  { itemId: 'SPU0003', name: 'TOAST-A', code: '0003', default_per_pallet: 200, safety_stock: 900 },
  { itemId: 'SPU0004', name: 'DISH-90', code: '0004', default_per_pallet: 50, safety_stock: 300 },
  { itemId: 'SPU0005', name: 'BAKE 配件', code: '0005', default_per_pallet: 300, safety_stock: 1500 },
  { itemId: 'SPU0006', name: 'MINI', code: '0006', default_per_pallet: 240, safety_stock: 1200 },
  { itemId: 'SPU0007', name: 'AIRF-2', code: '0007', default_per_pallet: 120, safety_stock: 480 },
  { itemId: 'SPU0008', name: 'FREEZ-P10', code: '0008', default_per_pallet: 60, safety_stock: 240 },
  { itemId: 'SPU0009', name: 'COOK-5', code: '0009', default_per_pallet: 40, safety_stock: 200 },
  { itemId: 'SPU0010', name: 'COFFEE-B1', code: '0010', default_per_pallet: 100, safety_stock: 500 },
  { itemId: 'SPU0011', name: 'STEAM-C3', code: '0011', default_per_pallet: 120, safety_stock: 600 },
  { itemId: 'SPU0012', name: 'FRIDGE-R2', code: '0012', default_per_pallet: 20, safety_stock: 100 },
  { itemId: 'SPU0013', name: 'BLEND-P3', code: '0013', default_per_pallet: 150, safety_stock: 750 },
  { itemId: 'SPU0014', name: 'CORD-K1', code: '0014', default_per_pallet: 600, safety_stock: 3000 },
  { itemId: 'SPU0015', name: 'SOUP-S5', code: '0015', default_per_pallet: 80, safety_stock: 400 },
  { itemId: 'SPU0016', name: 'WASH-W2', code: '0016', default_per_pallet: 90, safety_stock: 450 },
  { itemId: 'SPU0017', name: 'MOLD-B8', code: '0017', default_per_pallet: 500, safety_stock: 2500 },
  { itemId: 'SPU0018', name: 'GRIND-G9', code: '0018', default_per_pallet: 200, safety_stock: 1000 },
  { itemId: 'SPU0019', name: 'HUMID-U4', code: '0019', default_per_pallet: 150, safety_stock: 750 },
  { itemId: 'SPU0020', name: 'STEW-T1', code: '0020', default_per_pallet: 200, safety_stock: 1000 },
  { itemId: 'SPU0021', name: 'ICE-M1', code: '0021', default_per_pallet: 180, safety_stock: 900 },
  { itemId: 'SPU0022', name: 'PANINI-D1', code: '0022', default_per_pallet: 60, safety_stock: 300 },
];

export const DEFAULT_LINES = ['线别A-01', '线别A-02', '线别B-01', '线别B-02', '线别C-01'];
export const DEFAULT_HANDLERS = ['张敏', '刘杰', '王强', '陈芳', '赵磊'];
export const QUALITY_OPTIONS = ['OQC验Pass', '待复检', '不合格'] as const;

// Storage keys
export const KEYS = {
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
