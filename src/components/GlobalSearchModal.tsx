/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useInventoryStore } from '../store/useInventoryStore';
import {
  Search,
  X,
  MapPin,
  FileSpreadsheet,
  PackageCheck,
  PackageMinus,
  ArrowRight,
  PlusCircle,
  QrCode,
  Sparkles
} from 'lucide-react';
import { formatters } from '../db';

interface GlobalSearchModalProps {
  onNavigateTab?: (tab: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ onNavigateTab }) => {
  const {
    isSearchModalOpen,
    setSearchModalOpen,
    positions,
    orders,
    inbounds,
    demands,
    recordOutbound,
    recordInbound,
    refreshData
  } = useInventoryStore();

  const [query, setQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<any | null>(null);
  const [outboundQty, setOutboundQty] = useState<number>(100);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const todayStr = formatters.dbDate();

  // Listen for Ctrl+K or / shortcut to launch search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setSearchModalOpen(true);
      } else if (e.key === 'Escape' && isSearchModalOpen) {
        setSearchModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen, setSearchModalOpen]);

  // Search calculations
  const searchResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return { matchedPositions: [], matchedOrders: [], matchedInbounds: [] };
    }

    const matchedPositions = positions.filter(p =>
      p.code.toLowerCase().includes(trimmed) ||
      p.order_no?.toLowerCase().includes(trimmed) ||
      p.model?.toLowerCase().includes(trimmed)
    ).slice(0, 10);

    const matchedOrders = orders.filter(o =>
      o.order_no.toLowerCase().includes(trimmed) ||
      o.model.toLowerCase().includes(trimmed) ||
      o.customer_code.toLowerCase().includes(trimmed)
    ).slice(0, 6);

    const matchedInbounds = inbounds.filter(i =>
      i.order_no.toLowerCase().includes(trimmed) ||
      i.position_code.toLowerCase().includes(trimmed) ||
      i.model.toLowerCase().includes(trimmed)
    ).slice(0, 6);

    return { matchedPositions, matchedOrders, matchedInbounds };
  }, [query, positions, orders, inbounds]);

  if (!isSearchModalOpen) return null;

  const handleQuickOutbound = (p: any) => {
    if (!p.inbound_id) return;
    try {
      recordOutbound(
        p.inbound_id,
        todayStr,
        outboundQty,
        '刘杰',
        '全局万能检索极速出库'
      );
      setFeedbackMsg(`⚡ 仓位 [${p.code}] 已成功扣减出库 ${outboundQty} Pcs！`);
      setSelectedPosition(null);
      refreshData();
    } catch (err: any) {
      setFeedbackMsg(`❌ 出库失败: ${err.message}`);
    }
  };

  const totalResultsCount =
    searchResults.matchedPositions.length +
    searchResults.matchedOrders.length +
    searchResults.matchedInbounds.length;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[80vh]">
        {/* Search Header Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/80 shrink-0">
          <Search size={20} className="text-indigo-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="极速万能检索：输入仓位码(如 B02-01)、订单号(如 PO26)、产品型号(如 PRO-X1)..."
            className="w-full text-sm font-semibold text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer shrink-0"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => setSearchModalOpen(false)}
            className="px-2.5 py-1 text-xs font-bold text-slate-500 bg-slate-200/60 hover:bg-slate-200 rounded-lg shrink-0 cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="mx-4 mt-3 p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex justify-between items-center shrink-0">
            <span>{feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg('')} className="text-indigo-500 hover:text-indigo-700 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Search Results Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {!query.trim() ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl text-indigo-600 flex items-center justify-center mx-auto">
                <Sparkles size={24} />
              </div>
              <p className="font-bold text-slate-700 text-sm">输入任意卡位代码、订单编号或产品型号</p>
              <p className="text-xs text-slate-400">支持全库区即时联动查询与快速出入库处理</p>
            </div>
          ) : totalResultsCount === 0 ? (
            <div className="py-12 text-center text-slate-400">
              未找到匹配“<span className="font-bold text-slate-700">{query}</span>”的仓位、订单或流水记录
            </div>
          ) : (
            <>
              {/* Positions Section */}
              {searchResults.matchedPositions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider mb-2">
                    <MapPin size={14} className="text-indigo-600" />
                    <span>匹配仓位卡位 ({searchResults.matchedPositions.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResults.matchedPositions.map(p => (
                      <div
                        key={p.code}
                        onClick={() => setSelectedPosition(p)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          p.status === 'occupied'
                            ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300'
                            : 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono mb-1">
                          <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                            p.status === 'occupied' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {p.code}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {p.status === 'occupied' ? '已占用' : '空闲'}
                          </span>
                        </div>
                        {p.status === 'occupied' ? (
                          <div className="space-y-0.5 text-[11px] text-slate-700">
                            <p className="font-bold">订单：{p.order_no}</p>
                            <p className="text-slate-500">型号：{p.model} | 数量：{p.qty} Pcs</p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-emerald-700 font-semibold mt-1">空闲可用卡位，点击可直接上架</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Section */}
              {searchResults.matchedOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider mb-2">
                    <FileSpreadsheet size={14} className="text-indigo-600" />
                    <span>匹配销售订单 ({searchResults.matchedOrders.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {searchResults.matchedOrders.map(o => (
                      <div
                        key={o.id}
                        onClick={() => {
                          setSearchModalOpen(false);
                          if (onNavigateTab) onNavigateTab('orders');
                        }}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between hover:bg-indigo-50/50 hover:border-indigo-200 cursor-pointer transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-700">{o.order_no}</span>
                            <span className="text-slate-700 font-semibold">{o.model}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            订单总量：{o.order_qty.toLocaleString()} Pcs ({o.pallet_count} 托板) | 建立于：{o.created_at}
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inbound History Section */}
              {searchResults.matchedInbounds.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-500 text-[11px] uppercase tracking-wider mb-2">
                    <PackageCheck size={14} className="text-indigo-600" />
                    <span>匹配历史入库卡板 ({searchResults.matchedInbounds.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {searchResults.matchedInbounds.map(inb => (
                      <div
                        key={inb.id}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="font-bold text-slate-800">{inb.order_no}</span>
                            <span className="text-slate-600">托盘 #{inb.seq}</span>
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                              [{inb.position_code}]
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            型号：{inb.model} | 数量：{inb.actual_qty} Pcs | 入库日期：{inb.inbound_date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Drawer for Selected Position */}
        {selectedPosition && (
          <div className="p-4 bg-indigo-50 border-t border-indigo-100 shrink-0 space-y-2">
            <div className="flex items-center justify-between font-bold text-indigo-900">
              <span className="font-mono text-sm">选中仓位：[{selectedPosition.code}]</span>
              <button onClick={() => setSelectedPosition(null)} className="text-indigo-400 hover:text-indigo-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {selectedPosition.status === 'occupied' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">快捷扣减出库件数:</span>
                <input
                  type="number"
                  min="1"
                  max={selectedPosition.qty || 1}
                  value={outboundQty}
                  onChange={(e) => setOutboundQty(Number(e.target.value))}
                  className="w-24 bg-white border border-indigo-200 rounded-lg p-1 font-mono font-bold text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleQuickOutbound(selectedPosition)}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <PackageMinus size={14} />
                  <span>极速出库</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-800 font-semibold">此卡位空闲可用</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchModalOpen(false);
                    if (onNavigateTab) onNavigateTab('inbound');
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle size={14} />
                  <span>跳转入库工作台排位</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Shortcut Helper */}
        <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between px-4 shrink-0">
          <span>快捷键提示：按 <kbd className="bg-white border rounded px-1 text-[10px] font-mono">Esc</kbd> 退出搜索</span>
          <span>支持扫码枪录入或快捷键 <kbd className="bg-white border rounded px-1 text-[10px] font-mono">Ctrl+K</kbd></span>
        </div>
      </div>
    </div>
  );
};
