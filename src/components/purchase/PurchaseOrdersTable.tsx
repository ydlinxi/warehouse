/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 采购单列表（P2-4b 区块拆分自 PurchaseManager）：纯展示 + 回调。
import React from 'react';
import { ShoppingCart, Eye, CreditCard, Pencil, PackageCheck } from 'lucide-react';
import { PurchaseOrder, PurchaseStatus } from '../../types';
import { getStatusBadge } from './status';

interface Props {
  pos: PurchaseOrder[];
  onDetail: (po: PurchaseOrder) => void;
  onPay: (po: PurchaseOrder) => void;
  onEdit: (po: PurchaseOrder) => void;
  onAdvance: (po: PurchaseOrder, next: PurchaseStatus) => void;
}

export const PurchaseOrdersTable: React.FC<Props> = ({ pos, onDetail, onPay, onEdit, onAdvance }) => {
  return (
    <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200/80 shadow-xs">
      {pos.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <ShoppingCart size={40} className="mx-auto text-slate-300 mb-2" />
          <p className="font-medium text-slate-600">暂无采购单：可点击右上角「新建采购单」手工创建，或到「补货预警」一键生成采购建议</p>
        </div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            <tr>
              <th className="py-3 px-4">采购单号</th><th className="py-3 px-4">供应商</th><th className="py-3 px-4 text-center">SKU数</th>
              <th className="py-3 px-4 text-right">总量</th><th className="py-3 px-4 text-right">金额</th><th className="py-3 px-4">状态</th><th className="py-3 px-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {pos.map(po => {
              const m = getStatusBadge(po.status);
              const editable = po.status === '待采购';
              return (
                <tr key={po.poNo} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                    <button
                      onClick={() => onDetail(po)}
                      className="hover:underline cursor-pointer"
                      title="查看采购单详情"
                    >
                      {po.poNo}
                    </button>
                  </td>
                  <td className="py-3 px-4"><b>{po.supplierName}</b><div className="text-[10px] text-slate-400 font-mono">{po.supplierId}</div></td>
                  <td className="py-3 px-4 text-center">{po.items.length}</td>
                  <td className="py-3 px-4 text-right font-bold">{po.totalQty} 件</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">¥{po.totalAmt.toLocaleString()}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.cls}`}>{m.label}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button onClick={() => onDetail(po)} className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer flex items-center gap-1"><Eye size={12} />详情</button>
                      {po.status === '待采购' && (
                        <>
                          <button onClick={() => onPay(po)} className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1"><CreditCard size={12} />付款</button>
                          {editable && <button onClick={() => onEdit(po)} className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer flex items-center gap-1"><Pencil size={12} />编辑</button>}
                        </>
                      )}
                      {po.status === '已付款' && (
                        <>
                          <button onClick={() => onAdvance(po, '待收货')} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1"><PackageCheck size={12} />确认到厂</button>
                          <span className="text-[11px] text-sky-600 font-semibold">已付款 {po.paidAt} · 等待发货到厂</span>
                        </>
                      )}
                      {po.status === '待收货' && (
                        <span className="text-[11px] text-amber-600 font-semibold">待收货 · 请到「入库计划」点「确认收货 → 建卡板」</span>
                      )}
                      {po.status === '已收货' && <span className="text-[11px] text-slate-400">收货于 {po.receivedAt}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
