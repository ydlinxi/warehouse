/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 待出库记录面板（P2-4b 区块拆分自 OutboundManager）：纯展示 + 回调，状态与业务逻辑由父组件持有。
import React from 'react';
import { Truck, Plus } from 'lucide-react';
import { PendingOutbound } from '../../types';

interface Props {
  pendingOutbounds: PendingOutbound[];
  onReceiveEcom: () => void;
  onFulfill: (p: PendingOutbound) => void;
  onRefresh: () => void;
}

export const PendingOutboundPanel: React.FC<Props> = ({ pendingOutbounds, onReceiveEcom, onFulfill, onRefresh }) => {
  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/55 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-slate-800">电商待出库记录（{pendingOutbounds.filter(p => p.status === '待出库').length} 待出库 / 共 {pendingOutbounds.length}）</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">电商收到已付款订单后推送至此；出库成功后回写物流状态为「已出库」。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            title="从本地存储重新读取电商平台（淘宝 / 亚马逊）推送的待出库单据"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            ↻ 刷新
          </button>
          <button
            onClick={onReceiveEcom}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Plus size={14} /> 模拟电商订单发货（推送待出库）
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            <tr>
              <th className="py-3 px-4">电商订单号</th>
              <th className="py-3 px-4">平台</th>
              <th className="py-3 px-4">电商状态</th>
              <th className="py-3 px-4">型号</th>
              <th className="py-3 px-4 text-right">数量</th>
              <th className="py-3 px-4">收货人</th>
              <th className="py-3 px-4">状态</th>
              <th className="py-3 px-4">物流单号</th>
              <th className="py-3 px-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {pendingOutbounds.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-20 text-center text-slate-400">
                  <Truck size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">暂无待出库记录，点右上角「模拟接收电商已付款订单」试试</p>
                </td>
              </tr>
            ) : pendingOutbounds.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-bold text-indigo-600 font-mono">{p.ecomOrderNo}</td>
                <td className="py-3 px-4"><span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-[11px] border border-sky-100">{p.platform}</span></td>
                <td className="py-3 px-4"><span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded text-[11px] border border-violet-100">{p.ecomStatus}</span></td>
                <td className="py-3 px-4 font-semibold text-slate-800">{p.model}{p.wmsRef ? <span className="ml-1 text-[10px] font-normal text-slate-400">{p.wmsRef}</span> : null}</td>
                <td className="py-3 px-4 text-right font-bold">{p.qty}</td>
                <td className="py-3 px-4 text-slate-600">{p.recipient}</td>
                <td className="py-3 px-4">
                  {p.status === '已出库'
                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">✅已出库</span>
                    : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">🟡待出库</span>}
                </td>
                <td className="py-3 px-4 font-mono text-slate-600">{p.logisticsNo || <span className="text-slate-300 italic">—</span>}</td>
                <td className="py-3 px-4 text-center">
                  {p.status === '待出库'
                    ? <button onClick={() => onFulfill(p)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer">出库</button>
                    : <span className="text-[11px] text-slate-400">已完成</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
