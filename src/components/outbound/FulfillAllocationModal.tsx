/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 出库仓位分配模态框（P2-4b 区块拆分自 OutboundManager）：纯展示 + 回调，分配状态由父组件持有。
import React from 'react';
import { Truck, X } from 'lucide-react';
import { PendingOutbound, Position } from '../../types';

interface Props {
  target: PendingOutbound;
  candidates: Position[];
  isFallback: boolean;
  allocations: Record<string, number>;
  assigned: number;
  onSetAlloc: (inboundId: string, v: number) => void;
  onAutoAlloc: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const FulfillAllocationModal: React.FC<Props> = ({
  target, candidates, isFallback, allocations, assigned, onSetAlloc, onAutoAlloc, onConfirm, onClose
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Truck className="text-indigo-500" size={20} />选择出库仓位
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              订单 <b className="font-mono">{target.ecomOrderNo}</b> · {target.platform} · 型号 {target.model}{target.wmsRef ? ` · WMS SKU ${target.wmsRef}` : ''} · 待出库 <b className="text-indigo-600">{target.qty}</b> 件
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">仅列出该 SKU（{target.wmsRef ? `${target.wmsRef} · ` : ''}{target.model}）的可售仓位，同一 SKU 可多仓位分配出库</span>
            <button
              onClick={onAutoAlloc}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-600 cursor-pointer"
            >
              按库存自动分配
            </button>
          </div>
          {isFallback && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px]">
              未找到{target.wmsRef ? ` WMS SKU「${target.wmsRef}」` : `型号「${target.model}」`}的可售仓位，以下为其它可售仓位兜底（请核对实物与 SKU 一致）。
            </div>
          )}
          {candidates.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">当前无可售库存仓位</div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-2 px-3">仓位</th>
                    <th className="py-2 px-3">型号</th>
                    <th className="py-2 px-3 text-right">在库结存</th>
                    <th className="py-2 px-3 text-right">本次分配</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map(c => (
                    <tr key={c.code}>
                      <td className="py-2 px-3 font-mono font-bold text-indigo-600">{c.code}</td>
                      <td className="py-2 px-3">
                        <span className={(target.wmsRef ? c.sku === target.wmsRef : c.model === target.model) ? 'text-slate-700' : 'text-slate-400'}>
                          {c.model}
                          {c.sku ? <span className="ml-1 text-[10px] text-slate-400">{c.sku}</span> : null}
                          {(target.wmsRef ? c.sku === target.wmsRef : c.model === target.model) ? '' : '（兜底）'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{c.qty}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number" min={0} max={c.qty || 0}
                          value={allocations[c.inbound_id!] || 0}
                          onChange={(e) => onSetAlloc(c.inbound_id!, Number(e.target.value))}
                          className="w-24 border border-slate-300 rounded py-1 px-2 text-right font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${assigned === target.qty ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <span>已分配 {assigned} / 需出库 {target.qty}</span>
            <span>{assigned === target.qty ? '✓ 数量一致' : `仍需分配 ${target.qty - assigned}`}</span>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer">取消</button>
          <button
            onClick={onConfirm}
            disabled={assigned !== target.qty}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
          >
            确认出库
          </button>
        </div>
      </div>
    </div>
  );
};
