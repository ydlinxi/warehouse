/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 采购单详情弹窗（P2-4b 区块拆分自 PurchaseManager）：纯展示。
import React from 'react';
import { Eye, X } from 'lucide-react';
import { PurchaseOrder } from '../../types';
import { getStatusBadge } from './status';

interface Props {
  po: PurchaseOrder;
  onClose: () => void;
}

export const PurchaseDetailModal: React.FC<Props> = ({ po, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Eye className="text-indigo-500" size={20} />采购单详情</h3>
            <span className="font-mono text-sm text-indigo-600 font-bold">{po.poNo}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(po.status).cls}`}>{getStatusBadge(po.status).label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div><div className="text-slate-400 mb-0.5">供应商</div><div className="font-semibold text-slate-800">{po.supplierName}</div><div className="text-[10px] text-slate-400 font-mono">{po.supplierId}</div></div>
            <div><div className="text-slate-400 mb-0.5">创建日期</div><div className="font-semibold text-slate-800">{po.createdAt || '—'}</div></div>
            <div><div className="text-slate-400 mb-0.5">预交货日</div><div className="font-semibold text-slate-800">{po.expectDate || '—'}</div></div>
            <div><div className="text-slate-400 mb-0.5">付款方式</div><div className="font-semibold text-slate-800">{po.payMethod || '—'}</div></div>
            <div><div className="text-slate-400 mb-0.5">付款日期</div><div className="font-semibold text-slate-800">{po.paidAt || '—'}</div></div>
            <div><div className="text-slate-400 mb-0.5">付款流水号</div><div className="font-mono text-[11px] text-slate-800">{po.payNo || '—'}</div></div>
            <div><div className="text-slate-400 mb-0.5">实付金额</div><div className="font-semibold text-emerald-600">{po.paidAmt != null ? '¥' + po.paidAmt.toLocaleString() : '—'}</div></div>
            <div><div className="text-slate-400 mb-0.5">收货时间</div><div className="font-semibold text-slate-800">{po.receivedAt || '—'}</div></div>
            <div><div className="text-slate-400 mb-0.5">备注</div><div className="font-semibold text-slate-800">{po.note || '—'}</div></div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-2 px-3">SKU</th><th className="py-2 px-3">品名</th>
                  <th className="py-2 px-3 text-right">数量</th><th className="py-2 px-3 text-right">单价</th><th className="py-2 px-3 text-right">小计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {po.items.map(it => (
                  <tr key={it.sku}>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-600">{it.sku}</td>
                    <td className="py-2 px-3">{it.title}</td>
                    <td className="py-2 px-3 text-right font-mono">{it.need}</td>
                    <td className="py-2 px-3 text-right font-mono">¥{it.price}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">¥{(it.need * it.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr>
                  <td className="py-2 px-3" colSpan={2}>合计</td>
                  <td className="py-2 px-3 text-right font-mono">{po.totalQty} 件</td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-600">¥{po.totalAmt.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5 leading-relaxed">
            状态流转：待采购 → 已付款 → 待收货 → 已收货。当前状态「{po.status}」。
            {po.status === '待采购'
              ? ' 请先「付款」登记付款方式与流水号（付款后明细锁定，不可再编辑）。'
              : po.status === '已付款'
                ? ' 已付款待发货；货到厂后请点「确认到厂」推进为待收货。'
                : po.status === '待收货'
                  ? ' 该采购单已在「入库计划」生成待收货建卡板行，可前往确认收货。'
                  : ' 已收货，卡板需求已流转至「入库作业」分配上架。'}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer">关闭</button>
        </div>
      </div>
    </div>
  );
};
