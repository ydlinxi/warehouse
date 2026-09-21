/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PositionLedgerTable } from './PositionLedgerTable';
import { PackageMinus, History, LayoutGrid, Search, RotateCcw, Calendar, User, FileText, CheckCircle, AlertCircle, X, Plus, Truck } from 'lucide-react';
import { DBService, formatters } from '../db';
import { Outbound, PendingOutbound } from '../types';

export const OutboundManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'records' | 'pending'>('ledger');
  const [outbounds, setOutbounds] = useState<Outbound[]>(() => DBService.getOutbounds());
  const [pendingOutbounds, setPendingOutbounds] = useState<PendingOutbound[]>(() => DBService.getPendingOutbounds());
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [outboundToRollback, setOutboundToRollback] = useState<Outbound | null>(null);

  const refreshData = () => {
    setOutbounds(DBService.getOutbounds());
  };
  const refreshPending = () => {
    setPendingOutbounds(DBService.getPendingOutbounds());
  };

  // 模拟电商系统：收到已付款订单 → 推送一条待出库记录
  const handleReceiveEcom = () => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const order = DBService.receiveEcomOrder();
      setSuccessMsg(`已接收电商已付款订单 ${order.ecomOrderNo}（${order.platform}），生成待出库记录。`);
      refreshPending();
    } catch (err: any) {
      setErrorMsg(err.message || '接收电商订单失败！');
    }
  };

  // 待出库 → 选择出库仓位（同一 SKU 可来自多个仓位）
  const [fulfillTarget, setFulfillTarget] = useState<PendingOutbound | null>(null);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const getSellablePositions = () => DBService.getPositions()
    .filter(x => x.status === 'occupied' && x.quality === 'OQC验Pass' && (x.qty || 0) > 0 && x.inbound_id);

  // 仅匹配「同 SKU（型号）」的仓位；只有完全没有同 SKU 仓位时才退回其它可售仓位兜底
  const getStrictMatches = (p: PendingOutbound) => getSellablePositions().filter(x => x.model === p.model);

  const getFulfillCandidates = (p: PendingOutbound) => {
    const strict = getStrictMatches(p);
    if (strict.length > 0) return strict;
    return getSellablePositions().filter(x => x.model !== p.model);
  };

  const buildAutoAlloc = (p: PendingOutbound) => {
    const alloc: Record<string, number> = {};
    let left = p.qty;
    for (const c of getFulfillCandidates(p)) {
      if (left <= 0) break;
      const take = Math.min(left, c.qty || 0);
      if (take > 0 && c.inbound_id) { alloc[c.inbound_id] = take; left -= take; }
    }
    return alloc;
  };

  const openFulfill = (p: PendingOutbound) => {
    setSuccessMsg('');
    setErrorMsg('');
    setAllocations(buildAutoAlloc(p));
    setFulfillTarget(p);
  };

  const setAlloc = (inboundId: string, v: number) =>
    setAllocations(prev => ({ ...prev, [inboundId]: Math.max(0, v) }));

  const confirmFulfill = () => {
    if (!fulfillTarget) return;
    setSuccessMsg('');
    setErrorMsg('');
    const total = Object.values(allocations).reduce((s, n) => s + (Number(n) || 0), 0);
    if (total !== fulfillTarget.qty) {
      setErrorMsg(`已分配数量(${total}) 必须等于待出库数量(${fulfillTarget.qty})`);
      return;
    }
    const list = Object.entries(allocations)
      .filter(([, n]) => n > 0)
      .map(([inboundId, qty]) => ({ inboundId, qty }));
    try {
      const obs = DBService.fulfillPendingOutboundWithAllocations(
        fulfillTarget.id,
        DBService.getHandlers()[0] || '出库经办',
        list
      );
      setSuccessMsg(`电商订单 ${fulfillTarget.ecomOrderNo} 已出库，从 ${list.length} 个仓位扣减，生成 ${obs.length} 条出库流水。`);
      setFulfillTarget(null);
      setAllocations({});
      refreshPending();
      refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || '出库失败！');
    }
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
          <button
            type="button"
            onClick={() => {
              setActiveTab('pending');
              refreshPending();
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck size={15} />
            <span>待出库记录 ({pendingOutbounds.filter(p => p.status === '待出库').length})</span>
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
        {activeTab === 'pending' ? (
          <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/55 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">电商待出库记录（{pendingOutbounds.filter(p => p.status === '待出库').length} 待出库 / 共 {pendingOutbounds.length}）</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">电商收到已付款订单后推送至此；出库成功后回写物流状态为「已出库」。</p>
              </div>
              <button
                onClick={handleReceiveEcom}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Plus size={14} /> 模拟电商订单发货（推送待出库）
              </button>
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
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.model}</td>
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
                          ? <button onClick={() => openFulfill(p)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer">出库</button>
                          : <span className="text-[11px] text-slate-400">已完成</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'ledger' ? (
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

      {/* 待出库 → 选择出库仓位 */}
      {fulfillTarget && (() => {
        const cands = getFulfillCandidates(fulfillTarget);
        const isFallback = getStrictMatches(fulfillTarget).length === 0;
        const assigned = Object.values(allocations).reduce((s, n) => s + (Number(n) || 0), 0);
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Truck className="text-indigo-500" size={20} />选择出库仓位
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    订单 <b className="font-mono">{fulfillTarget.ecomOrderNo}</b> · {fulfillTarget.platform} · 型号 {fulfillTarget.model} · 待出库 <b className="text-indigo-600">{fulfillTarget.qty}</b> 件
                  </p>
                </div>
                <button onClick={() => setFulfillTarget(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">仅列出该 SKU（{fulfillTarget.model}）的可售仓位，同一 SKU 可多仓位分配出库</span>
                  <button
                    onClick={() => setAllocations(buildAutoAlloc(fulfillTarget))}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-600 cursor-pointer"
                  >
                    按库存自动分配
                  </button>
                </div>
                {isFallback && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px]">
                    未找到型号「{fulfillTarget.model}」的可售仓位，以下为其它可售仓位兜底（请核对实物与 SKU 一致）。
                  </div>
                )}
                {cands.length === 0 ? (
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
                        {cands.map(c => (
                          <tr key={c.code}>
                            <td className="py-2 px-3 font-mono font-bold text-indigo-600">{c.code}</td>
                            <td className="py-2 px-3">
                              <span className={c.model === fulfillTarget.model ? 'text-slate-700' : 'text-slate-400'}>
                                {c.model}{c.model !== fulfillTarget.model ? '（型号不同，兜底）' : ''}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{c.qty}</td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number" min={0} max={c.qty || 0}
                                value={allocations[c.inbound_id!] || 0}
                                onChange={(e) => setAlloc(c.inbound_id!, Number(e.target.value))}
                                className="w-24 border border-slate-300 rounded py-1 px-2 text-right font-mono"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${assigned === fulfillTarget.qty ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span>已分配 {assigned} / 需出库 {fulfillTarget.qty}</span>
                  <span>{assigned === fulfillTarget.qty ? '✓ 数量一致' : `仍需分配 ${fulfillTarget.qty - assigned}`}</span>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setFulfillTarget(null)} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer">取消</button>
                <button
                  onClick={confirmFulfill}
                  disabled={assigned !== fulfillTarget.qty}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
                >
                  确认出库
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
