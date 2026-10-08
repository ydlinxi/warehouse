/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PositionLedgerTable } from './PositionLedgerTable';
import { PackageMinus, History, LayoutGrid, Truck, CheckCircle, AlertCircle, X } from 'lucide-react';
import { DBService } from '../db';
import { Outbound, PendingOutbound } from '../types';
import { PendingOutboundPanel } from './outbound/PendingOutboundPanel';
import { OutboundRecordPanel } from './outbound/OutboundRecordPanel';
import { FulfillAllocationModal } from './outbound/FulfillAllocationModal';
import { RollbackOutboundModal } from './outbound/RollbackOutboundModal';

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
  // 手动刷新：电商（淘宝 / 亚马逊）在别的页面推送待出库后，无需重开 iframe 即可看到
  const handleRefreshPending = () => {
    const list = DBService.getPendingOutbounds();
    setPendingOutbounds(list);
    setErrorMsg('');
    setSuccessMsg(`已刷新待出库记录：共 ${list.length} 条，其中待出库 ${list.filter(p => p.status === '待出库').length} 条。`);
  };

  // 模拟电商系统：收到已付款订单 → 推送一条待出库记录
  const handleReceiveEcom = () => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const order = DBService.receiveEcomOrder();
      setSuccessMsg(`已接收电商已付款订单 ${order.ecomOrderNo}（${order.platform}），生成待出库记录。`);
      refreshPending();
    } catch (err) {
      setErrorMsg((err as Error).message || '接收电商订单失败！');
    }
  };

  // 待出库 → 选择出库仓位（同一 SKU 可来自多个仓位）
  const [fulfillTarget, setFulfillTarget] = useState<PendingOutbound | null>(null);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const getSellablePositions = () => DBService.getPositions()
    .filter(x => x.status === 'occupied' && x.quality === 'OQC验Pass' && (x.qty || 0) > 0 && x.inbound_id);

  // 严格匹配（与 outbound.ts 同口径）：
  //   ① 推送带 wmsRef（WMS SKU）→ 按 SKU 精确命中（规避「电商商品级标题 ≠ WMS SKU 级品名」的口径差异）；
  //   ② 型号（model）精确匹配；
  //   ③ 历史单据兼容：按型号**前缀**收敛到同系列 SKU（如「CABLE-K1 数据线」→ 白/黑）。
  //   以上皆空才退回其它可售仓位兜底。
  const getStrictMatches = (p: PendingOutbound) => {
    const sell = getSellablePositions();
    if (p.wmsRef) {
      const bySku = sell.filter(x => x.sku === p.wmsRef);
      if (bySku.length > 0) return bySku;
    }
    const byModel = sell.filter(x => x.model === p.model);
    if (byModel.length > 0) return byModel;
    return sell.filter(x => (x.model || '').indexOf(p.model + ' ') === 0);
  };

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
    } catch (err) {
      setErrorMsg((err as Error).message || '出库失败！');
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
    } catch (err) {
      setErrorMsg((err as Error).message || '回退出库记录失败！');
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
          <PendingOutboundPanel
            pendingOutbounds={pendingOutbounds}
            onReceiveEcom={handleReceiveEcom}
            onFulfill={openFulfill}
            onRefresh={handleRefreshPending}
          />
        ) : activeTab === 'ledger' ? (
          <div className="h-full">
            <PositionLedgerTable mode="outbound" />
          </div>
        ) : (
          <OutboundRecordPanel
            items={filteredOutbounds}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRollback={setOutboundToRollback}
          />
        )}
      </div>

      {/* 待出库 → 选择出库仓位 */}
      {fulfillTarget && (() => {
        const cands = getFulfillCandidates(fulfillTarget);
        const isFallback = getStrictMatches(fulfillTarget).length === 0;
        const assigned = Object.values(allocations).reduce((s, n) => s + (Number(n) || 0), 0);
        return (
          <FulfillAllocationModal
            target={fulfillTarget}
            candidates={cands}
            isFallback={isFallback}
            allocations={allocations}
            assigned={assigned}
            onSetAlloc={setAlloc}
            onAutoAlloc={() => setAllocations(buildAutoAlloc(fulfillTarget))}
            onConfirm={confirmFulfill}
            onClose={() => setFulfillTarget(null)}
          />
        );
      })()}

      {/* Rollback Outbound Confirmation Modal */}
      {outboundToRollback && (
        <RollbackOutboundModal
          target={outboundToRollback}
          onConfirm={confirmRollbackOutbound}
          onClose={() => setOutboundToRollback(null)}
        />
      )}
    </div>
  );
};
