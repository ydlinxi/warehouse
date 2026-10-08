/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 编辑采购单弹窗（P2-4b 区块拆分自 PurchaseManager）：自持编辑表单状态。
import React, { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { DBService } from '../../db';
import { PurchaseOrder } from '../../types';

interface Props {
  po: PurchaseOrder;
  onSaved: (message: string) => void;
  onClose: () => void;
}

export const PurchaseEditModal: React.FC<Props> = ({ po, onSaved, onClose }) => {
  const [editItems, setEditItems] = useState<PurchaseOrder['items']>(() => po.items.map(it => ({ ...it })));
  const [editExpect, setEditExpect] = useState(() => po.expectDate || '');
  const [editPay, setEditPay] = useState(() => po.payMethod || '');
  const [editNote, setEditNote] = useState(() => po.note || '');

  const setItemNeed = (sku: string, v: number) =>
    setEditItems(prev => prev.map(it => it.sku === sku ? { ...it, need: Math.max(0, v) } : it));
  const setItemPrice = (sku: string, v: number) =>
    setEditItems(prev => prev.map(it => it.sku === sku ? { ...it, price: Math.max(0, v) } : it));

  const editTotals = {
    qty: editItems.reduce((s, x) => s + x.need, 0),
    amt: editItems.reduce((s, x) => s + x.need * x.price, 0),
  };

  const saveEdit = () => {
    DBService.updatePurchaseOrder(po.poNo, {
      items: editItems,
      totalQty: editItems.reduce((s, x) => s + x.need, 0),
      totalAmt: editItems.reduce((s, x) => s + x.need * x.price, 0),
      expectDate: editExpect,
      payMethod: editPay,
      note: editNote,
    });
    onSaved(`采购单 ${po.poNo} 已保存修改`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Pencil className="text-indigo-500" size={20} />编辑采购单 {po.poNo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-2 px-3">SKU</th><th className="py-2 px-3">品名</th>
                  <th className="py-2 px-3 text-right">数量</th><th className="py-2 px-3 text-right">单价</th><th className="py-2 px-3 text-right">小计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {editItems.map(it => (
                  <tr key={it.sku}>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-600">{it.sku}</td>
                    <td className="py-2 px-3">{it.title}</td>
                    <td className="py-2 px-3 text-right">
                      <input type="number" min={0} value={it.need} onChange={e => setItemNeed(it.sku, Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded py-1 px-2 text-right font-mono font-bold" />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input type="number" min={0} value={it.price} onChange={e => setItemPrice(it.sku, Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded py-1 px-2 text-right font-mono" />
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-700">¥{(it.need * it.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              预交货日
              <input type="date" value={editExpect} onChange={e => setEditExpect(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              付款方式
              <input type="text" value={editPay} onChange={e => setEditPay(e.target.value)} placeholder="如 预付全款" className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-xs text-slate-600 flex flex-col gap-1 md:col-span-1">
              备注
              <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="备注说明" className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">合计：<b className="text-slate-800">{editTotals.qty} 件</b> / <b className="text-emerald-600">¥{editTotals.amt.toLocaleString()}</b></span>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer">取消</button>
          <button onClick={saveEdit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow cursor-pointer">保存修改</button>
        </div>
      </div>
    </div>
  );
};
