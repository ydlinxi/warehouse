/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 采购单付款弹窗（P2-4b 区块拆分自 PurchaseManager）：自持付款表单状态。
import React, { useState } from 'react';
import { CreditCard, X } from 'lucide-react';
import { DBService } from '../../db';
import { toast } from '../../utils/toast';
import { PurchaseOrder } from '../../types';

const PAY_METHODS = ['预付全款', '预付款30%', '月结30天', '月结60天', '货到付款', '其他'];

interface Props {
  po: PurchaseOrder;
  onPaid: (message: string) => void;
  onClose: () => void;
}

export const PurchasePayModal: React.FC<Props> = ({ po, onPaid, onClose }) => {
  const [payMethod, setPayMethod] = useState(() => po.payMethod || '预付全款');
  const [payNo, setPayNo] = useState(() => 'TXN' + Date.now().toString().slice(-10));
  const [payAmt, setPayAmt] = useState(() => po.totalAmt);
  const [payNote, setPayNote] = useState(() => po.note || '');

  const submitPay = () => {
    try {
      DBService.payPurchaseOrder(po.poNo, { payMethod, payNo, paidAmt: Number(payAmt), note: payNote });
      onPaid(`采购单 ${po.poNo} 已登记付款 ¥${((Number(payAmt) || po.totalAmt)).toLocaleString()}（${payMethod}），等待货到厂`);
      onClose();
    } catch (e) {
      toast((e as Error)?.message || '付款登记失败', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><CreditCard className="text-sky-500" size={20} />采购单付款</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs grid grid-cols-2 gap-2">
            <div><div className="text-slate-400">采购单号</div><div className="font-mono font-bold text-indigo-600">{po.poNo}</div></div>
            <div><div className="text-slate-400">供应商</div><div className="font-semibold text-slate-800">{po.supplierName}</div></div>
            <div><div className="text-slate-400">采购总量</div><div className="font-semibold text-slate-800">{po.totalQty} 件</div></div>
            <div><div className="text-slate-400">采购金额</div><div className="font-bold text-emerald-600">¥{po.totalAmt.toLocaleString()}</div></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              付款方式
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5">
                {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              付款流水号
              <input type="text" value={payNo} onChange={e => setPayNo(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
            </label>
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              实付金额（元）
              <input type="number" min={0} value={payAmt} onChange={e => setPayAmt(Number(e.target.value))} className="border border-slate-300 rounded-lg px-2 py-1.5 font-mono font-bold" />
            </label>
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              备注
              <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="如 已付全款，供应商备货中" className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
          </div>

          <div className="text-[11px] text-sky-800 bg-sky-50 border border-sky-100 rounded-lg p-2.5 leading-relaxed">
            付款后采购单状态推进为「已付款」，明细与金额<b>锁定不可再编辑</b>；供应商到货后点「确认到厂」推进为待收货，再由「入库计划」确认收货并拆卡板。月结 / 货到付款方式在此仅登记挂账，不产生实际支付流水。
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer">取消</button>
          <button onClick={submitPay} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow cursor-pointer">确认付款</button>
        </div>
      </div>
    </div>
  );
};
