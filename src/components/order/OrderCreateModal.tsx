/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 新建/修改/确认收货入库计划弹窗（P2-4b 区块拆分自 OrderManager）：纯表单 + 回调。
import React from 'react';
import { X, Package, Trash2 } from 'lucide-react';
import { InboundPlanLine, ProductSku, PurchaseOrder } from '../../types';

interface Props {
  editingOrderId: string | null;
  receivingPoNo: string | null;
  receivingPo: PurchaseOrder | null;
  orderNo: string;
  planLines: InboundPlanLine[];
  skus: ProductSku[];
  errorMsg: string;
  linePallets: (l: InboundPlanLine) => number;
  totalPlanQty: number;
  totalPlanPallets: number;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onSuggestOrderNo: () => void;
  onOrderNoChange: (v: string) => void;
  onAddLine: () => void;
  onRemoveLine: (idx: number) => void;
  onUpdateLine: (idx: number, patch: Partial<InboundPlanLine>) => void;
  onSkuChange: (idx: number, sku: string) => void;
}

export const OrderCreateModal: React.FC<Props> = ({
  editingOrderId, receivingPoNo, receivingPo, orderNo, planLines, skus, errorMsg,
  linePallets, totalPlanQty, totalPlanPallets,
  onClose, onSubmit, onSuggestOrderNo, onOrderNoChange, onAddLine, onRemoveLine, onUpdateLine, onSkuChange
}) => {
  return (
    <div id="create-order-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div id="create-order-dialog" className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-xl overflow-hidden transform transition-all">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <Package size={16} />
            </div>
            <h3 className="font-bold text-sm text-slate-800">
              {editingOrderId ? '修改入库计划' : receivingPoNo ? '确认收货 · 创建入库计划' : '新建入库计划'}
            </h3>
          </div>
          <button
            id="btn-close-create"
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {receivingPoNo && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed">
              来源采购单 <b className="font-mono">{receivingPoNo}</b>
              {receivingPo && <> · 供应商 {receivingPo.supplierName}</>}。
              已预填该采购单的 SKU 与数量，请确认或调整每个 SKU 的<b>最大卡板容量</b>与<b>实际数量</b>后创建入库计划（计划创建后保留在列表，可继续分配上架）。
            </div>
          )}

          {/* Order Number */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">计划编号 (唯一索引)</label>
            <div className="flex gap-2">
              <input
                id="input-order-no"
                type="text"
                required
                placeholder="例如: PL20260914001"
                value={orderNo}
                onChange={(e) => onOrderNoChange(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
              />
              <button
                type="button"
                onClick={onSuggestOrderNo}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 cursor-pointer shrink-0"
              >
                自动生成
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">可自动生成或手动填写；系统截取前 4 位作为客户编码。</p>
          </div>

          {/* SKU Lines */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">SKU 行（1-多个 SKU）</label>
              <button
                type="button"
                onClick={onAddLine}
                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold cursor-pointer"
              >
                ＋ 添加 SKU 行
              </button>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {planLines.map((l, idx) => (
                <div key={idx} className="p-2 bg-slate-50/70 border border-slate-100 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={l.sku}
                      onChange={(e) => onSkuChange(idx, e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg py-1 px-2 text-xs focus:outline-none"
                    >
                      <option value="">-- 选择 SKU --</option>
                      {skus.map(s => <option key={s.sku} value={s.sku}>{s.sku} · {s.title}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => onRemoveLine(idx)}
                      disabled={planLines.length <= 1}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded disabled:opacity-30 cursor-pointer"
                      title="删除该行"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">最大卡板容量</label>
                      <input
                        type="number" min={1} value={l.maxPerPallet}
                        onChange={(e) => onUpdateLine(idx, { maxPerPallet: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">实际数量</label>
                      <input
                        type="number" min={1} value={l.qty}
                        onChange={(e) => onUpdateLine(idx, { qty: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <div className="text-[11px] text-right pb-1">
                      <span className="text-slate-400">卡位 </span>
                      <span className="font-bold text-indigo-600">{linePallets(l)}</span>
                      <span className="text-slate-400"> 托</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-center justify-between text-xs">
            <span className="text-slate-500">合计（{planLines.length} 个 SKU）：</span>
            <span className="font-bold text-indigo-600">{totalPlanQty} Pcs / {totalPlanPallets} 托</span>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              id="btn-cancel-create"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              id="btn-submit-order"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
            >
              {editingOrderId ? '保存修改' : receivingPoNo ? '确认收货并创建计划' : '确认排单'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
