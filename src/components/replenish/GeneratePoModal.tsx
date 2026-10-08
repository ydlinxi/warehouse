/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 生成补货采购单弹窗（P2-4b 区块拆分自 ReplenishManager）：自持采购单草稿（预交货日/付款方式/备注/可调补货量）。
import React, { useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { ReplenishPlan, ReplenishPlanItem } from '../../types';
import { PoDraft, genPoNo, safeNum } from './helpers';

interface Props {
  plan: ReplenishPlan;
  onSubmit: (draft: PoDraft) => void;
  onClose: () => void;
}

export const GeneratePoModal: React.FC<Props> = ({ plan, onSubmit, onClose }) => {
  const [draft, setDraft] = useState<PoDraft>(() => {
    const items = (plan.items || []).map((it: ReplenishPlanItem) => ({
      ...it,
      need: safeNum(it.need) > 0 ? safeNum(it.need) : Math.max(safeNum(it.abundanceThreshold) - safeNum(it.stock), 1)
    }));
    return {
      ...plan, items,
      expectDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      payMethod: '预付全款', note: '', poNo: genPoNo(),
    };
  });

  const setPoNeed = (sku: string, val: number) => {
    setDraft(prev => ({ ...prev, items: prev.items.map((x: ReplenishPlanItem) => x.sku === sku ? { ...x, need: Math.max(0, safeNum(val)) } : x) }));
  };

  const poTotals = {
    qty: draft.items.reduce((s: number, x: ReplenishPlanItem) => s + x.need, 0),
    amt: draft.items.reduce((s: number, x: ReplenishPlanItem) => s + x.need * x.price, 0)
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2"><ShoppingCart size={16} />生成补货采购单 · {draft.supplierName}（{draft.id}）</h3>
          <button onClick={onClose} className="text-indigo-100 hover:text-white cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><span className="text-slate-400">供应商编号</span><div className="font-mono font-bold">{draft.supplierId}</div></div>
            <div><span className="text-slate-400">地域</span><div className="font-bold">{draft.location}</div></div>
            <div><span className="text-slate-400">MOQ</span><div className="font-bold">{draft.moq} 件</div></div>
            <div><span className="text-slate-400">触发SKU</span><div className="font-mono font-bold">{draft.triggerSku?.sku || '—'}</div></div>
            <div><span className="text-slate-400">合并SKU数</span><div className="font-bold text-indigo-600">{draft.items.length} 个</div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div><label className="text-slate-400 block mb-1">采购单号</label><input value={draft.poNo} readOnly className="w-full border border-slate-200 rounded px-2 py-1 font-mono bg-slate-50" /></div>
            <div><label className="text-slate-400 block mb-1">预交货日</label><input type="date" value={draft.expectDate} onChange={e => setDraft(p => ({ ...p, expectDate: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1" /></div>
            <div><label className="text-slate-400 block mb-1">付款方式</label>
              <select value={draft.payMethod} onChange={e => setDraft(p => ({ ...p, payMethod: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1 bg-white">
                <option>预付全款</option><option>预付50%</option><option>货到付款</option><option>月结30天</option>
              </select>
            </div>
          </div>
          <div><label className="text-slate-400 block mb-1">备注</label><textarea value={draft.note} onChange={e => setDraft(p => ({ ...p, note: e.target.value }))} placeholder="可填写特殊要求（包装、物流、质检标准等）" className="w-full border border-slate-200 rounded px-2 py-1 min-h-[50px]" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr>
                <th className="py-1.5 px-3">SKU</th><th className="py-1.5 px-3">商品名</th><th className="py-1.5 px-3">规格</th><th className="py-1.5 px-3 text-right">当前库存</th><th className="py-1.5 px-3 text-right">充裕值</th><th className="py-1.5 px-3 text-right">建议补货量</th><th className="py-1.5 px-3 text-right">单价(¥)</th><th className="py-1.5 px-3 text-right">小计</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {draft.items.map((it: ReplenishPlanItem) => (
                  <tr key={it.sku}>
                    <td className="py-1.5 px-3 font-mono text-indigo-600">{it.sku}</td>
                    <td className="py-1.5 px-3">{it.emoji || ''} {it.title}</td>
                    <td className="py-1.5 px-3 text-slate-500">{it.spec || '—'}</td>
                    <td className="py-1.5 px-3 text-right">{it.stock}</td>
                    <td className="py-1.5 px-3 text-right">{it.abundanceThreshold}</td>
                    <td className="py-1.5 px-3 text-right"><input type="number" min={0} value={it.need} onChange={e => setPoNeed(it.sku, Number(e.target.value))} className="w-16 text-right border border-slate-200 rounded px-1 py-0.5 font-bold text-rose-600" /></td>
                    <td className="py-1.5 px-3 text-right">{it.price}</td>
                    <td className="py-1.5 px-3 text-right">{(it.need * it.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-1">
            <div><span className="text-slate-400">建议补货总量</span><div className="font-bold text-rose-600 text-lg">{poTotals.qty} 件</div></div>
            <div className="text-right"><span className="text-slate-400">采购总额</span><div className="font-bold text-emerald-600 text-xl">¥{poTotals.amt.toLocaleString()}</div></div>
          </div>
          <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2">补货量 = max(充裕值 - 当前库存, 1)，建议数量可编辑；单价由系统核定不可修改，总额实时更新。提交后补货计划状态将流转为「已生成采购单」。</div>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer">取消</button>
          <button onClick={() => onSubmit(draft)} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer">确认提交采购单</button>
        </div>
      </div>
    </div>
  );
};
