/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 入库历史记录与追溯面板（P2-4b 区块拆分自 InboundManager）：搜索 + 历史明细表。
import React, { useState, useMemo } from 'react';
import { Search, Import, RotateCcw } from 'lucide-react';
import { formatters } from '../../db';
import { Inbound } from '../../types';

interface Props {
  inbounds: Inbound[];
  onRollback: (inb: Inbound) => void;
}

export const InboundRecordsPanel: React.FC<Props> = ({ inbounds, onRollback }) => {
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const filteredInbounds = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return inbounds;
    return inbounds.filter(i =>
      i.order_no.toLowerCase().includes(q) ||
      i.model.toLowerCase().includes(q) ||
      i.position_code.toLowerCase().includes(q) ||
      i.handler.toLowerCase().includes(q) ||
      (i.note && i.note.toLowerCase().includes(q))
    );
  }, [inbounds, historySearchQuery]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/55 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-slate-800">历史入库明细与品质追溯 ({filteredInbounds.length})</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">完整记录成品入库卡板位、生产线别与 OQC 检验结果，支持修改与撤销追溯。</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
            placeholder="搜索订单号 / 型号 / 仓位 / 经办人..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            <tr>
              <th className="py-3 px-4 w-12">序号</th>
              <th className="py-3 px-4">入库日期</th>
              <th className="py-3 px-4">关联订单号</th>
              <th className="py-3 px-4">产品型号</th>
              <th className="py-3 px-4 text-center">卡板序号</th>
              <th className="py-3 px-4 text-center">上架仓位码</th>
              <th className="py-3 px-4 text-right">实际入库量</th>
              <th className="py-3 px-4 text-center">生产线别</th>
              <th className="py-3 px-4 text-center">品质检验</th>
              <th className="py-3 px-4 text-center">经办人</th>
              <th className="py-3 px-4">备注说明</th>
              <th className="py-3 px-4 text-center w-24">操作管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {filteredInbounds.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-16 text-center text-slate-400 text-xs">
                  <Import size={36} className="mx-auto text-slate-300 mb-2" />
                  暂无符合条件的入库明细记录
                </td>
              </tr>
            ) : (
              [...filteredInbounds].reverse().map((inb, idx) => (
                <tr key={inb.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-slate-400 text-[10px]">#{idx + 1}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-600">{formatters.date(inb.inbound_date)}</td>
                  <td className="py-2.5 px-4 font-bold font-mono text-indigo-600">{inb.order_no}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold text-[10px]">{inb.model}</span>
                  </td>
                  <td className="py-2.5 px-4 text-center font-bold text-slate-500">#{inb.seq}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{inb.position_code}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{formatters.number(inb.actual_qty)} Pcs</td>
                  <td className="py-2.5 px-4 text-center font-medium text-slate-600">{inb.line}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inb.quality === 'OQC验Pass' ? 'bg-emerald-100 text-emerald-700' :
                      inb.quality === '待复检' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {inb.quality}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-600 font-medium">{inb.handler}</td>
                  <td className="py-2.5 px-4 text-slate-400 text-[11px] max-w-xs truncate" title={inb.note || '无'}>
                    {inb.note || <span className="text-slate-300 italic">-</span>}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onRollback(inb)}
                        className="px-2.5 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold border border-slate-200"
                        title="回退记录（释放仓位，托盘回归待分配）"
                      >
                        <RotateCcw size={13} className="text-amber-500" />
                        <span>回退</span>
                      </button>
                    </div>
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
