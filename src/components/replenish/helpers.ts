/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 补货模块共享工具与本地类型（P2-4b 区块拆分自 ReplenishManager）。
import { ProductSku, ReplenishPlan, ReplenishPlanDraft } from '../../types';

// 导出工具：统一输出真正的 .xlsx（Excel 可直接打开）
// 说明：原先这里是手写 CSV（Blob + BOM）。现改为委托 utils/xlsx 的 OOXML 生成器，
// 并把旧的 `exportCsv` 名字保留为别名，避免遗漏既有调用点（行为一致，仅文件格式升级为 xlsx）。
export { exportXlsx } from '../../utils/xlsx';
export { exportXlsx as exportCsv } from '../../utils/xlsx';

export const safeNum = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n; };
// 单价兜底：price 缺失时按 SKU 末位估算（与早前一致）
export const unitPrice = (p: { price?: number; sku?: string }) => safeNum(p.price) || Math.round(30 + (p.sku ? p.sku.charCodeAt(p.sku.length - 1) % 8 : 0) * 10);
// 计划编号：RP-YYYYMMDD-NN（按当天已存在计划计数）
export const genPlanId = (arr: { id?: string }[]) => {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = arr.filter(p => (p.id || '').indexOf(ds) >= 0).length + 1;
  return `RP-${ds}-${String(seq).padStart(2, '0')}`;
};
export const genPoNo = () => 'PO-REPL-' + Date.now().toString().slice(-8);

// 库存状态判定（按有效库存）
export const getStockStatus = (p: ProductSku, effectiveStock?: number) => {
  const stock = effectiveStock ?? p.stock;
  if (stock <= p.replenishPoint) return { cls: 'bg-rose-100 text-rose-700', text: '🔴需补货' };
  if (stock < p.abundanceThreshold) return { cls: 'bg-amber-100 text-amber-700', text: '🟡偏低' };
  return { cls: 'bg-emerald-100 text-emerald-700', text: '🟢充裕' };
};

// ===== 计划相关本地类型 =====
// 预览阶段的计划草稿，带 UI 处理方式标记 _mode（不落库）
export type BuiltPlan = ReplenishPlanDraft & { _mode?: '新建' | '覆盖更新' };
export interface PlanPreview { built: BuiltPlan[]; createCnt: number; updateCnt: number; grandQty: number; grandAmt: number; }
// 生成采购单弹窗草稿
export type PoDraft = ReplenishPlan & { expectDate: string; payMethod: string; note: string; };
