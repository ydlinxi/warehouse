/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 采购单状态展示元数据（P2-4b 区块拆分自 PurchaseManager，供订单表与详情弹窗共用）。
export const STATUS_META: Record<string, { label: string; cls: string }> = {
  '待采购': { label: '待采购', cls: 'bg-slate-100 text-slate-600' },
  '已付款': { label: '💳已付款·待发货', cls: 'bg-sky-100 text-sky-700' },
  '待收货': { label: '待收货', cls: 'bg-amber-100 text-amber-700' },
  '已收货': { label: '✅已收货', cls: 'bg-emerald-100 text-emerald-700' },
};

export const getStatusBadge = (s: string) =>
  STATUS_META[s] || { label: s, cls: 'bg-slate-100 text-slate-600' };
