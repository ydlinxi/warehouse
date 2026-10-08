/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// SKU 补货详情弹窗（P2-4b 区块拆分自 ReplenishManager）：纯展示 + 库存构成。
import React from 'react';
import { Eye, X } from 'lucide-react';
import { DBService } from '../../db';
import { ProductSku } from '../../types';
import { getStockStatus } from './helpers';

interface Props {
  sku: ProductSku;
  inFlightMap: Record<string, number>;
  itemNameOf: (itemId?: string) => string;
  supplierNameOf: (sid: string) => string;
  onClose: () => void;
}

export const SkuDetailModal: React.FC<Props> = ({ sku, inFlightMap, itemNameOf, supplierNameOf, onClose }) => {
  const bd = DBService.getSkuStockBreakdown(sku.sku);
  const inFlight = inFlightMap[sku.sku] || 0;
  const eff = sku.stock + inFlight;
  const st = getStockStatus(sku, eff);
  const effNeed = Math.max(0, sku.abundanceThreshold - eff);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2"><Eye size={16} />SKU 补货详情</h3>
          <button onClick={onClose} className="text-indigo-100 hover:text-white cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <span className="text-slate-400">商品ID / 商品名</span>
              <div className="font-mono font-bold text-violet-700">{sku.itemId} <span className="font-sans font-normal text-slate-600">{itemNameOf(sku.itemId)}</span></div>
            </div>
            <div><span className="text-slate-400">SKU</span><div className="font-mono font-bold">{sku.sku}</div></div>
            <div><span className="text-slate-400">当前库存</span><div className="font-bold">{sku.stock}</div></div>
            <div><span className="text-slate-400">充裕值</span><div className="font-bold">{sku.abundanceThreshold}</div></div>
            <div><span className="text-slate-400">补货值</span><div className="font-bold">{sku.replenishPoint}</div></div>
            <div className="col-span-2"><span className="text-slate-400">商品名</span><div className="font-semibold">{sku.emoji || ''} {sku.title}</div></div>
            <div className="col-span-2"><span className="text-slate-400">规格</span><div>{sku.spec || '—'}</div></div>
            <div className="col-span-2"><span className="text-slate-400">供应商</span><div>{sku.supplierName || supplierNameOf(sku.supplierId)}（{sku.supplierId}）</div></div>
            <div className="col-span-2 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed">
              <div className="text-slate-500 font-semibold mb-1">当前库存构成（可售口径）</div>
              <div className="text-slate-600">
                OQC验Pass 入库 − 已出库 = <b className="text-emerald-600">{bd.available}</b> 件（= 当前库存）
              </div>
              <div className="text-slate-500 mt-0.5">
                其中待复检 <b>{bd.pending}</b> 件、不合格 <b>{bd.reject}</b> 件<b className="text-rose-600">不计入可售</b>；在架物理量合计 {bd.physical} 件（含上述两类），累计已出库 {bd.shipped} 件。
              </div>
              <div className="text-[10px] text-slate-400 mt-1">不合格品处置为「让步接收」后转为可售，才会进入当前库存。</div>
            </div>
          </div>
          <div className="pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">状态（按有效库存）</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.text}</span>
            </div>
            <div className="flex items-center justify-between py-1"><span className="text-slate-400">在途/已计划覆盖</span><span className="font-bold text-emerald-600">{inFlight} 件</span></div>
            <div className="flex items-center justify-between py-1"><span className="text-slate-400">有效库存</span><span className="font-bold">{eff} 件</span></div>
            <div className="flex items-center justify-between py-1"><span className="text-slate-400">有效建议补货量</span><span className="font-bold text-rose-600">{effNeed > 0 ? effNeed + ' 件' : '—'}</span></div>
          </div>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer">关闭</button>
        </div>
      </div>
    </div>
  );
};
