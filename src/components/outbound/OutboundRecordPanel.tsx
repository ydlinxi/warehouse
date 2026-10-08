/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 出库历史记录表格（P2-4b 区块拆分自 OutboundManager）：搜索框 + 流水表，纯展示 + 回调。
import React from 'react';
import { Search, PackageMinus, Calendar, User, RotateCcw } from 'lucide-react';
import { Outbound } from '../../types';

interface Props {
  items: Outbound[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onRollback: (o: Outbound) => void;
}

export const OutboundRecordPanel: React.FC<Props> = ({ items, searchQuery, onSearchChange, onRollback }) => {
  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Table Control Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/55 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-slate-800">成品出库发货流水账 ({items.length})</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">记录每一次成品发货卡位、数量与去向，支持撤销追溯。</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索订单号 / 型号 / 仓位 / 经办人..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Outbound Records Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            <tr>
              <th className="py-3 px-4 w-12 text-center">序号</th>
              <th className="py-3 px-4">出库日期</th>
              <th className="py-3 px-4">关联订单号</th>
              <th className="py-3 px-4">产品型号</th>
              <th className="py-3 px-4 text-center">仓位卡位</th>
              <th className="py-3 px-4 text-right">出库数量 (Pcs)</th>
              <th className="py-3 px-4 text-center">发货经办</th>
              <th className="py-3 px-4">发货备注说明</th>
              <th className="py-3 px-4 text-center w-24">操作管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-20 text-center text-slate-400">
                  <PackageMinus size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">暂无符合条件的出库发货记录</p>
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-center text-slate-400 font-mono">#{index + 1}</td>
                  <td className="py-3 px-4 font-mono text-slate-600 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    {item.outbound_date}
                  </td>
                  <td className="py-3 px-4 font-bold text-indigo-600 font-mono">{item.order_no}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{item.model}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-bold rounded text-[11px] border border-indigo-100">
                      {item.position_code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                    {item.outbound_qty.toLocaleString()} Pcs
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      {item.handler}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={item.note || ''}>
                    {item.note || <span className="text-slate-300 italic">-</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onRollback(item)}
                      className="px-2.5 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold border border-slate-200"
                      title="回退记录及相关数据（恢复卡位库存）"
                    >
                      <RotateCcw size={13} className="text-amber-500" />
                      <span>回退</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
