/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 一键生成补货计划 · 预览确认弹窗（P2-4b 区块拆分自 ReplenishManager）：纯展示 + 回调。
import React from 'react';
import { PackagePlus, X } from 'lucide-react';
import { BuiltPlan, PlanPreview } from './helpers';

interface Props {
  preview: PlanPreview;
  onConfirm: () => void;
  onClose: () => void;
}

export const PlanPreviewModal: React.FC<Props> = ({ preview, onConfirm, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2"><PackagePlus size={16} />一键生成补货计划 · 预览确认（{preview.built.length} 个供应商）</h3>
          <button onClick={onClose} className="text-indigo-100 hover:text-white cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><span className="text-slate-400">新建计划</span><div className="font-bold text-emerald-600 text-lg">{preview.createCnt} 个</div></div>
            <div><span className="text-slate-400">覆盖更新</span><div className="font-bold text-amber-600 text-lg">{preview.updateCnt} 个</div></div>
            <div><span className="text-slate-400">合并SKU总数</span><div className="font-bold text-lg">{preview.built.reduce((s: number, b: BuiltPlan) => s + b.items.length, 0)} 个</div></div>
            <div><span className="text-slate-400">补货总量 / 预计金额</span><div className="font-bold text-lg text-rose-600">{preview.grandQty} 件 · ¥{preview.grandAmt.toLocaleString()}</div></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr>
                <th className="py-1.5 px-3">供应商编号</th><th className="py-1.5 px-3">名称</th><th className="py-1.5 px-3">地域</th><th className="py-1.5 px-3 text-center">SKU数</th><th className="py-1.5 px-3 text-right">补货量</th><th className="py-1.5 px-3">触发SKU</th><th className="py-1.5 px-3">处理方式</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {preview.built.map((b: BuiltPlan) => (
                  <tr key={b.supplierId}>
                    <td className="py-1.5 px-3 font-mono">{b.supplierId}</td>
                    <td className="py-1.5 px-3">{b.supplierName}</td>
                    <td className="py-1.5 px-3">{b.location}</td>
                    <td className="py-1.5 px-3 text-center">{b.items.length}</td>
                    <td className="py-1.5 px-3 text-right">{b.totalQty}</td>
                    <td className="py-1.5 px-3 font-mono">{b.triggerSku?.sku || '—'}</td>
                    <td className="py-1.5 px-3">{b._mode === '覆盖更新' ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">覆盖更新</span> : <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">新建</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2">合并规则：SKU库存≤补货值时触发补货，自动检查同供应商其他SKU是否低于充裕值（stock&lt;充裕值），低于则合并补货。计算时已扣除「待收货采购单」的在途覆盖量，避免重复下单；同供应商旧「待确认」计划将被覆盖更新或清除，不会重复计入。</div>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer">取消</button>
          <button onClick={onConfirm} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer">✔ 确认生成计划</button>
        </div>
      </div>
    </div>
  );
};
