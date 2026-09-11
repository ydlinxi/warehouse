/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useInventoryStore } from '../store/useInventoryStore';
import { Position } from '../types';
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  PackageMinus,
  PlusCircle,
  Edit,
  X,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { formatters } from '../db';

interface PositionLedgerTableProps {
  mode?: 'all' | 'outbound';
}

export const PositionLedgerTable: React.FC<PositionLedgerTableProps> = ({ mode = 'all' }) => {
  const {
    positions,
    demands,
    inbounds,
    warehouseConfig,
    recordInbound,
    recordOutbound,
    updateInbound,
    refreshData,
    targetOutboundPosition,
    setTargetOutboundPosition
  } = useInventoryStore();

  // Filters & Pagination State
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied'>(mode === 'outbound' ? 'occupied' : 'all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Modals
  const [quickInboundPos, setQuickInboundPos] = useState<Position | null>(null);
  const [quickOutboundPos, setQuickOutboundPos] = useState<Position | null>(null);
  const [selectedDemandId, setSelectedDemandId] = useState<string>('');
  const [outboundQtyInput, setOutboundQtyInput] = useState<number>(100);
  const [outboundHandler, setOutboundHandler] = useState<string>('刘杰');
  const [inboundLine, setInboundLine] = useState<string>('线别A-01');
  const [inboundHandler, setInboundHandler] = useState<string>('张敏');
  const [inboundQuality, setInboundQuality] = useState<'OQC验Pass' | '待复检' | '不合格'>('OQC验Pass');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [actionErrorMsg, setActionErrorMsg] = useState<string>('');

  React.useEffect(() => {
    if (mode === 'outbound' && targetOutboundPosition) {
      // Auto open outbound modal for the target position
      setQuickOutboundPos(targetOutboundPosition);
      setOutboundQtyInput(targetOutboundPosition.qty || 1);
      // Clear it from global store so it doesn't re-trigger on next mount
      setTargetOutboundPosition(null);
    }
  }, [mode, targetOutboundPosition, setTargetOutboundPosition]);

  const todayStr = formatters.dbDate();

  // Compute Unallocated Demands for Quick Inbound Modal
  const unallocatedDemands = useMemo(() => {
    return demands.filter(d => d.position_code === null);
  }, [demands]);

  // Compute Filtered Positions
  const filteredPositions = useMemo(() => {
    return positions.filter(p => {
      // Status Filter
      if (statusFilter === 'available' && p.status !== 'available') return false;
      if (statusFilter === 'occupied' && p.status !== 'occupied') return false;

      // Zone Filter
      if (zoneFilter !== 'all' && p.zone !== zoneFilter) return false;

      // Query Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const codeMatch = p.code.toLowerCase().includes(q);
        const orderMatch = p.order_no?.toLowerCase().includes(q);
        const modelMatch = p.model?.toLowerCase().includes(q);
        if (!codeMatch && !orderMatch && !modelMatch) return false;
      }

      return true;
    });
  }, [positions, statusFilter, zoneFilter, searchQuery]);

  // Pagination calculation
  const totalItems = filteredPositions.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const pagePositions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPositions.slice(start, start + pageSize);
  }, [filteredPositions, currentPage, pageSize]);

  // Reset page when filter changes
  const handleFilterChange = (setter: Function, val: any) => {
    setter(val);
    setCurrentPage(1);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      '序号',
      '库区',
      '排数',
      '列数',
      '仓位代码',
      '储位状态',
      '关联订单号',
      '产品型号',
      '卡板序号',
      '在库件数(Pcs)',
      '入库日期',
      '在库天数',
      '品质状态',
      '生产线别',
      '经办人'
    ];

    const rows = filteredPositions.map((p, index) => {
      let daysStored = 0;
      if (p.inbound_date) {
        const diff = new Date(todayStr).getTime() - new Date(p.inbound_date).getTime();
        daysStored = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }

      return [
        index + 1,
        `${p.zone}区`,
        p.row,
        p.col,
        p.code,
        p.status === 'occupied' ? '已占用' : '空闲',
        p.order_no || '-',
        p.model || '-',
        p.seq ? `#${p.seq}` : '-',
        p.qty || 0,
        p.inbound_date || '-',
        p.status === 'occupied' ? `${daysStored}天` : '-',
        p.quality || '-',
        p.line || '-',
        p.handler || '-'
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `全仓物理仓位明细台账_${formatters.dbDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Execute Quick Inbound from Table
  const handleExecuteQuickInbound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInboundPos || !selectedDemandId) return;

    setActionSuccessMsg('');
    setActionErrorMsg('');

    try {
      const demand = unallocatedDemands.find(d => d.id === selectedDemandId);
      if (!demand) throw new Error('未选择有效的托盘需求！');

      recordInbound(
        demand.id,
        quickInboundPos.code,
        todayStr,
        200, // Default 200 pcs
        inboundLine,
        inboundHandler,
        inboundQuality,
        '从全仓物理台账快捷上架'
      );

      setActionSuccessMsg(`卡位 [${quickInboundPos.code}] 已成功上架订单 ${demand.order_no} 托盘 #${demand.seq}！`);
      setQuickInboundPos(null);
      setSelectedDemandId('');
    } catch (err: any) {
      setActionErrorMsg(err.message || '快捷上架失败！');
    }
  };

  // Execute Quick Outbound from Table
  const handleExecuteQuickOutbound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOutboundPos || !quickOutboundPos.inbound_id) return;

    setActionSuccessMsg('');
    setActionErrorMsg('');

    try {
      recordOutbound(
        quickOutboundPos.inbound_id,
        todayStr,
        outboundQtyInput,
        outboundHandler,
        '从全仓物理台账快捷一键出库'
      );

      setActionSuccessMsg(`仓位 [${quickOutboundPos.code}] 扣减出库 ${outboundQtyInput} Pcs 成功！`);
      setQuickOutboundPos(null);
    } catch (err: any) {
      setActionErrorMsg(err.message || '快捷出库失败！');
    }
  };

  // Compute summary stats for current filter
  const filterOccupiedCount = filteredPositions.filter(p => p.status === 'occupied').length;
  const filterAvailableCount = filteredPositions.filter(p => p.status === 'available').length;
  const filterInStockQty = filteredPositions.reduce((sum, p) => sum + (p.qty || 0), 0);

  return (
    <div className="space-y-4">
      {/* Success / Error Alerts */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Title & Filter Badges */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">全仓物理仓位台账明细表</h3>
              <p className="text-[11px] text-slate-400">
                实时掌握全仓 {positions.length} 个卡位全景分布、存货件数与存放周期
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="导出当前筛选结果为 Excel CSV 表格"
            >
              <Download size={14} />
              <span>导出全仓台账 (CSV)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Status Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => handleFilterChange(setStatusFilter, 'all')}
              className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              全部 ({positions.length})
            </button>
            <button
              onClick={() => handleFilterChange(setStatusFilter, 'occupied')}
              className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'occupied' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              已占用 ({positions.filter(p => p.status === 'occupied').length})
            </button>
            <button
              onClick={() => handleFilterChange(setStatusFilter, 'available')}
              className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'available' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              空闲 ({positions.filter(p => p.status === 'available').length})
            </button>
          </div>

          {/* Zone Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <span className="text-slate-500 font-semibold shrink-0">库区筛选:</span>
            <select
              value={zoneFilter}
              onChange={(e) => handleFilterChange(setZoneFilter, e.target.value)}
              className="w-full bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">全库区 ({warehouseConfig.zones.length}个区)</option>
              {warehouseConfig.zones.map(z => (
                <option key={z.code} value={z.code}>
                  {z.code}区 ({z.rows}排 × {z.cols}列 = {z.rows * z.cols}卡位)
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center col-span-1 lg:col-span-2">
            <Search size={14} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="搜索仓位码 (如 B02-01)、订单号 (如 PO26)、产品型号 (如 PRO-X1)..."
              value={searchQuery}
              onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => handleFilterChange(setSearchQuery, '')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Current Filter Metrics Summary Bar */}
        <div className="flex flex-wrap items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] font-semibold text-slate-600 gap-2">
          <div className="flex items-center gap-4">
            <span>符合条件卡位: <strong className="text-slate-900 font-mono text-xs">{totalItems}</strong> 个</span>
            <span>已占用: <strong className="text-rose-600 font-mono text-xs">{filterOccupiedCount}</strong> 卡位</span>
            <span>空闲可用: <strong className="text-emerald-600 font-mono text-xs">{filterAvailableCount}</strong> 卡位</span>
          </div>
          <div>
            在库成品总量: <strong className="text-indigo-600 font-mono text-xs">{filterInStockQty.toLocaleString()}</strong> Pcs
          </div>
        </div>
      </div>

      {/* Main Ledger Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3">仓位代码</th>
                <th className="py-3 px-3 text-center">所属库区</th>
                <th className="py-3 px-3 text-center">状态</th>
                <th className="py-3 px-3">关联订单号</th>
                <th className="py-3 px-3">产品型号</th>
                <th className="py-3 px-3 text-center">托盘序号</th>
                <th className="py-3 px-3 text-right">在库数量</th>
                <th className="py-3 px-3 text-center">入库日期</th>
                <th className="py-3 px-3 text-center">在库天数</th>
                <th className="py-3 px-3 text-center">品质状态</th>
                <th className="py-3 px-3 text-center w-32">快捷操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {pagePositions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    没有查找到符合条件的仓位台账数据
                  </td>
                </tr>
              ) : (
                pagePositions.map((p, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  let daysStored = 0;
                  if (p.inbound_date) {
                    const diff = new Date(todayStr).getTime() - new Date(p.inbound_date).getTime();
                    daysStored = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
                  }

                  return (
                    <tr key={p.code} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      {/* Position Code */}
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-lg border text-xs ${
                          p.status === 'occupied'
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}>
                          {p.code}
                        </span>
                      </td>

                      {/* Zone */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                        {p.zone}区
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {p.status === 'occupied' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            已占用
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            空闲
                          </span>
                        )}
                      </td>

                      {/* Order No */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {p.order_no || <span className="text-slate-300 font-normal italic">-</span>}
                      </td>

                      {/* Model */}
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {p.model || <span className="text-slate-300 font-normal italic">-</span>}
                      </td>

                      {/* Pallet Seq */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                        {p.seq ? `#${p.seq}` : <span className="text-slate-300 italic">-</span>}
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {p.qty !== null && p.qty !== undefined ? (
                          <span className="text-indigo-600">{p.qty.toLocaleString()} Pcs</span>
                        ) : (
                          <span className="text-slate-300 font-normal italic">-</span>
                        )}
                      </td>

                      {/* Inbound Date */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                        {p.inbound_date || <span className="text-slate-300 italic">-</span>}
                      </td>

                      {/* Days Stored */}
                      <td className="py-2.5 px-3 text-center">
                        {p.status === 'occupied' ? (
                          <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                            daysStored > 30 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {daysStored} 天
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">-</span>
                        )}
                      </td>

                      {/* Quality */}
                      <td className="py-2.5 px-3 text-center">
                        {p.quality ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.quality === 'OQC验Pass'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : p.quality === '待复检'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {p.quality}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        {p.status === 'available' ? (
                          mode !== 'outbound' && (
                            <button
                              type="button"
                              onClick={() => {
                                setQuickInboundPos(p);
                                if (unallocatedDemands.length > 0) {
                                  setSelectedDemandId(unallocatedDemands[0].id);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                            >
                              <PlusCircle size={12} />
                              <span>上架</span>
                            </button>
                          )
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (mode === 'all') {
                                  setTargetOutboundPosition(p);
                                  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'outbound' }));
                                } else {
                                  setQuickOutboundPos(p);
                                  setOutboundQtyInput(p.qty || 100);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                              title="快捷出库"
                            >
                              <PackageMinus size={12} />
                              <span>出库</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>每页显示</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none"
            >
              <option value={30}>30 条</option>
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
              <option value={200}>200 条</option>
            </select>
            <span>显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} 条，共 {totalItems} 条</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              上一页
            </button>
            <span className="px-2 font-mono font-bold text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* Quick Inbound Modal */}
      {quickInboundPos && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <PlusCircle size={16} />
                快捷上架到指定仓位 [{quickInboundPos.code}]
              </h3>
              <button
                onClick={() => setQuickInboundPos(null)}
                className="text-emerald-100 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteQuickInbound} className="p-4 space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-900 font-semibold">
                已选中空闲卡位：<span className="font-mono font-bold text-emerald-700">{quickInboundPos.code}</span> ({quickInboundPos.zone}区)
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  选择待上架的订单与托盘号
                </label>
                {unallocatedDemands.length === 0 ? (
                  <p className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs font-semibold">
                    目前所有排单托盘均已分配仓位！如需上架，请先在【订单管理】建立新排单。
                  </p>
                ) : (
                  <select
                    required
                    value={selectedDemandId}
                    onChange={(e) => setSelectedDemandId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-white font-bold cursor-pointer"
                  >
                    {unallocatedDemands.map(d => (
                      <option key={d.id} value={d.id}>
                        订单 {d.order_no} | {d.model} (托盘 #{d.seq})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">生产线别</label>
                  <select
                    value={inboundLine}
                    onChange={(e) => setInboundLine(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                  >
                    <option value="线别A-01">线别A-01</option>
                    <option value="线别B-02">线别B-02</option>
                    <option value="线别C-03">线别C-03</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">操作经办</label>
                  <select
                    value={inboundHandler}
                    onChange={(e) => setInboundHandler(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                  >
                    <option value="张敏">张敏</option>
                    <option value="李强">李强</option>
                    <option value="陈芳">陈芳</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">品质检验状态</label>
                <select
                  value={inboundQuality}
                  onChange={(e) => setInboundQuality(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-bold"
                >
                  <option value="OQC验Pass">OQC验Pass</option>
                  <option value="待复检">待复检</option>
                  <option value="不合格">不合格</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickInboundPos(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold text-slate-600 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={unallocatedDemands.length === 0}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  确认上架到卡位
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Outbound Modal */}
      {quickOutboundPos && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <PackageMinus size={16} />
                快捷安排出库 [{quickOutboundPos.code}]
              </h3>
              <button
                onClick={() => setQuickOutboundPos(null)}
                className="text-indigo-100 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteQuickOutbound} className="p-4 space-y-3 text-xs">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-900 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>仓位：{quickOutboundPos.code}</span>
                  <span>订单：{quickOutboundPos.order_no}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>产品：{quickOutboundPos.model}</span>
                  <span>当前在库：<strong className="text-indigo-700">{quickOutboundPos.qty} Pcs</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">出库数量 (Pcs)</label>
                <input
                  type="number"
                  min="1"
                  max={quickOutboundPos.qty || 1}
                  required
                  value={outboundQtyInput}
                  onChange={(e) => setOutboundQtyInput(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">发货经办</label>
                <select
                  value={outboundHandler}
                  onChange={(e) => setOutboundHandler(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-bold"
                >
                  <option value="刘杰">刘杰</option>
                  <option value="王强">王强</option>
                  <option value="赵敏">赵敏</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickOutboundPos(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold text-slate-600 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  确认扣减出库
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
