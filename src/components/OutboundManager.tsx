/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PositionLedgerTable } from './PositionLedgerTable';
import { PackageMinus, History, LayoutGrid, Search, RotateCcw, Calendar, User, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { DBService, formatters } from '../db';
import { Outbound } from '../types';

export const OutboundManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'records'>('ledger');
  const [outbounds, setOutbounds] = useState<Outbound[]>(() => DBService.getOutbounds());
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [outboundToRollback, setOutboundToRollback] = useState<Outbound | null>(null);

  const refreshData = () => {
    setOutbounds(DBService.getOutbounds());
  };

  const filteredOutbounds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return outbounds;
    return outbounds.filter(o => 
      o.order_no.toLowerCase().includes(q) ||
      o.model.toLowerCase().includes(q) ||
      o.position_code.toLowerCase().includes(q) ||
      o.handler.toLowerCase().includes(q) ||
      (o.note && o.note.toLowerCase().includes(q))
    );
  }, [outbounds, searchQuery]);

  const confirmRollbackOutbound = () => {
    if (!outboundToRollback) return;
    setSuccessMsg('');
    setErrorMsg('');
    try {
      DBService.deleteOutbound(outboundToRollback.id);
      setSuccessMsg(`已成功回退订单 ${outboundToRollback.order_no} 的出库记录及相关数据！卡位 [${outboundToRollback.position_code}] 库存已恢复。`);
      refreshData();
      setOutboundToRollback(null);
    } catch (err: any) {
      setErrorMsg(err.message || '回退出库记录失败！');
      setOutboundToRollback(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
            <PackageMinus size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">成品出库发货管理</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              在此进行物理仓位出库操作或追溯成品出库发货历史明细流水。
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid size={15} />
            <span>仓位出库台账</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('records');
              refreshData();
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'records'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={15} />
            <span>出库历史记录与追溯 ({outbounds.length})</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-500 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'ledger' ? (
          <div className="h-full">
            <PositionLedgerTable mode="outbound" />
          </div>
        ) : (
          <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Table Control Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/55 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">成品出库发货流水账 ({filteredOutbounds.length})</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">记录每一次成品发货卡位、数量与去向，支持撤销追溯。</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                  {filteredOutbounds.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-20 text-center text-slate-400">
                        <PackageMinus size={40} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-medium text-slate-600">暂无符合条件的出库发货记录</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOutbounds.map((item, index) => (
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
                            onClick={() => setOutboundToRollback(item)}
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
        )}
      </div>

      {/* Rollback Outbound Confirmation Modal */}
      {outboundToRollback && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5">
              <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
                <RotateCcw className="text-amber-500" size={20} />
                确认回退发货记录及相关数据？
              </h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                确定要回退订单 <strong className="text-slate-700">{outboundToRollback.order_no}</strong> 从仓位 <strong className="text-indigo-600 font-mono">{outboundToRollback.position_code}</strong> 发货的记录及相关数据吗？
              </p>
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs mb-6">
                回退后，该出库记录及相关数据将彻底清除，本次发货数量（<strong>{outboundToRollback.outbound_qty} Pcs</strong>）将自动恢复退回到对应卡位库存中。
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setOutboundToRollback(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmRollbackOutbound}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition-colors"
                >
                  确认回退
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
