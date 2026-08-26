/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Layers,
  Box,
  CheckCircle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Info,
  Check,
  X
} from 'lucide-react';
import { DBService, formatters } from '../db';
import { Position, Order } from '../types';

export const PositionMap: React.FC = () => {
  const [warehouseConfig, setWarehouseConfig] = useState(() => DBService.getWarehouseConfig());
  const [selectedZone, setSelectedZone] = useState('A');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCellCode, setSelectedCellCode] = useState<string | null>(null);
  
  // Get all orders and overall stats
  const orders = DBService.getOrdersWithMetrics();
  const positions = DBService.getPositions();
  const overallStats = DBService.getOverallStats();
  const inbounds = DBService.getInbounds();
  const outbounds = DBService.getOutbounds();
  const demands = DBService.getDemands();

  // Selected Order for Excel Top Bar & Left Table
  const [selectedOrderNo, setSelectedOrderNo] = useState<string>(() => {
    if (orders.length > 0) return orders[0].order_no;
    return 'PO260810';
  });

  // Searchable Order Combobox State
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const orderDropdownRef = useRef<HTMLDivElement>(null);

  // Unified list of orders for search dropdown
  const orderOptions = useMemo(() => {
    return orders;
  }, [orders]);

  // Filtered order options based on search query
  const filteredOrderOptions = useMemo(() => {
    if (!orderSearchQuery.trim()) return orderOptions;
    const q = orderSearchQuery.toLowerCase().trim();
    return orderOptions.filter(
      o =>
        o.order_no.toLowerCase().includes(q) ||
        (o.model && o.model.toLowerCase().includes(q)) ||
        (o.customer_code && o.customer_code.toLowerCase().includes(q))
    );
  }, [orderOptions, orderSearchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(event.target as Node)) {
        setIsOrderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Row Range for Matrix (Default 1-20 for snappy Excel grid view)
  const [rowRange, setRowRange] = useState<[number, number]>([1, 20]);

  // Highlight all locations belonging to current order toggle
  const [highlightOrderSlots, setHighlightOrderSlots] = useState<boolean>(true);
  const [zoomScale, setZoomScale] = useState(1);

  // Active Zone configuration
  const activeZoneObj = warehouseConfig.zones.find(z => z.code === selectedZone) || warehouseConfig.zones[0] || { code: 'A', rows: 70, cols: 20 };
  const maxRows = activeZoneObj.rows;
  const maxCols = activeZoneObj.cols;

  // Selected Order object and metrics
  const activeOrder = useMemo(() => {
    return orders.find(o => o.order_no === selectedOrderNo) || {
      order_no: selectedOrderNo,
      model: 'MX-400',
      stock_qty: 180,
      order_qty: 240,
      customer_code: 'PO26'
    };
  }, [orders, selectedOrderNo]);

  // Positions belonging to the selected Order (for left table) - 100% Real DB Data
  const orderPositionsTable = useMemo(() => {
    const rows: {
      seq: number;
      code: string;
      order_no: string;
      model: string;
      qty: number;
      quality: string;
      status: string;
    }[] = [];

    let seqCounter = 1;

    // 1. Gather all inbounds matching this order from DB
    const inboundsForOrder = inbounds.filter(i => i.order_no === selectedOrderNo);

    if (inboundsForOrder.length > 0) {
      inboundsForOrder.forEach(inb => {
        // Calculate remaining actual stock for this inbound lot
        const outs = outbounds.filter(o => o.inbound_id === inb.id).reduce((sum, o) => sum + o.outbound_qty, 0);
        const currentStock = Math.max(0, inb.actual_qty - outs);

        rows.push({
          seq: seqCounter++,
          code: inb.position_code,
          order_no: inb.order_no,
          model: inb.model,
          qty: currentStock,
          quality: inb.quality || 'OQC验Pass',
          status: currentStock > 0 ? 'occupied' : 'available'
        });
      });
    } else {
      // 2. If no inbounds yet, check planned demands with position_code for this order
      const demandsForOrder = demands.filter(d => d.order_no === selectedOrderNo && d.position_code);
      demandsForOrder.forEach(d => {
        rows.push({
          seq: seqCounter++,
          code: d.position_code!,
          order_no: d.order_no,
          model: d.model,
          qty: 0,
          quality: '预排待入库',
          status: 'available'
        });
      });
    }

    return rows;
  }, [inbounds, outbounds, demands, selectedOrderNo]);

  // Filtered table rows (only non-zero actual stock positions)
  const filteredOrderPositionsTable = useMemo(() => {
    return orderPositionsTable.filter(r => r.qty > 0);
  }, [orderPositionsTable]);

  // Global Multi-dimensional Search across all warehouse positions (non-zero stock)
  const globalSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();

    const results: {
      seq: number;
      code: string;
      order_no: string;
      model: string;
      qty: number;
      quality: string;
      status: string;
    }[] = [];

    let seqCounter = 1;

    inbounds.forEach(inb => {
      const outs = outbounds.filter(o => o.inbound_id === inb.id).reduce((sum, o) => sum + o.outbound_qty, 0);
      const currentStock = Math.max(0, inb.actual_qty - outs);

      if (currentStock <= 0) return;

      const matchCode = inb.position_code.toLowerCase().includes(q);
      const matchOrder = inb.order_no.toLowerCase().includes(q);
      const matchModel = inb.model.toLowerCase().includes(q);
      const matchQty = String(currentStock).includes(q) || String(inb.actual_qty).includes(q);
      const matchQuality = (inb.quality || '').toLowerCase().includes(q);

      if (matchCode || matchOrder || matchModel || matchQty || matchQuality) {
        results.push({
          seq: seqCounter++,
          code: inb.position_code,
          order_no: inb.order_no,
          model: inb.model,
          qty: currentStock,
          quality: inb.quality || 'OQC验Pass',
          status: 'occupied'
        });
      }
    });

    return results;
  }, [searchQuery, inbounds, outbounds]);

  // Rows to display in left table (Search Results vs Order Table)
  const displayTableRows = useMemo(() => {
    if (searchQuery.trim()) {
      return globalSearchResults;
    }
    return filteredOrderPositionsTable;
  }, [searchQuery, globalSearchResults, filteredOrderPositionsTable]);

  // Non-zero occupied locations array for quick pill tag bar
  const activeStockLocations = useMemo(() => {
    return orderPositionsTable.filter(r => r.qty > 0);
  }, [orderPositionsTable]);

  // Total inventory quantity for the selected order
  const orderTotalStock = useMemo(() => {
    return orderPositionsTable.reduce((acc, item) => acc + item.qty, 0);
  }, [orderPositionsTable]);

  // Positions in current zone
  const zonePositions = useMemo(() => {
    return positions.filter(p => p.zone === selectedZone);
  }, [positions, selectedZone]);

  // Active cell details
  const activeCell = useMemo(() => {
    if (!selectedCellCode) return null;
    const pos = positions.find(p => p.code === selectedCellCode);
    const tableItem = orderPositionsTable.find(t => t.code === selectedCellCode);

    if (pos) {
      return {
        ...pos,
        quality: pos.quality || tableItem?.quality || 'OQC验Pass'
      };
    }

    return {
      code: selectedCellCode,
      zone: selectedCellCode.substring(0, 1),
      row: parseInt(selectedCellCode.substring(1, 3), 10) || 1,
      col: parseInt(selectedCellCode.substring(4, 6), 10) || 1,
      status: tableItem && tableItem.qty > 0 ? 'occupied' : 'available',
      order_no: tableItem ? selectedOrderNo : null,
      model: tableItem ? tableItem.model : null,
      qty: tableItem ? tableItem.qty : 0,
      quality: tableItem ? tableItem.quality : 'OQC验Pass'
    };
  }, [selectedCellCode, positions, orderPositionsTable, selectedOrderNo]);

  // Row presets for pagination
  const rowPresets = useMemo(() => {
    const presets: [number, number][] = [];
    const step = 20;
    for (let start = 1; start <= maxRows; start += step) {
      const end = Math.min(start + step - 1, maxRows);
      presets.push([start, end]);
    }
    return presets;
  }, [maxRows]);

  const rowsList: number[] = [];
  for (let r = rowRange[0]; r <= Math.min(rowRange[1], maxRows); r++) {
    rowsList.push(r);
  }

  const colsList: number[] = [];
  for (let c = 1; c <= maxCols; c++) {
    colsList.push(c);
  }

  // Handle cell locate
  const handleLocateCell = (code: string, orderNo?: string) => {
    const zone = code.substring(0, 1);
    const rowStr = code.substring(1, 3);
    const row = parseInt(rowStr, 10);

    if (zone && ['A', 'B', 'C'].includes(zone)) {
      setSelectedZone(zone);
    }

    if (!isNaN(row)) {
      const start = Math.max(1, Math.floor((row - 1) / 20) * 20 + 1);
      const end = Math.min(maxRows, start + 19);
      setRowRange([start, end]);
    }

    if (orderNo && orderNo !== '空置' && orderNo !== selectedOrderNo) {
      setSelectedOrderNo(orderNo);
    }

    setSelectedCellCode(code);
  };

  return (
    <div id="positionmap-root" className="space-y-3 font-sans text-xs select-none">
      
      {/* =========================================================================
          EXCEL TOP HEADER CONTROL BANNER (参考 Excel 头部 核心配置与统计栏)
          ========================================================================= */}
      <div className="bg-white border-2 border-slate-300 rounded-lg p-2 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-center items-center">
          
          {/* Section 1: 订单号 & 订单库存数量 (Left Block) */}
          <div className="col-span-12 md:col-span-3 grid grid-cols-2 gap-1 bg-emerald-50/80 p-1.5 rounded border border-emerald-200">
            <div className="flex flex-col justify-center relative" ref={orderDropdownRef}>
              <span className="text-[11px] font-bold text-slate-700 bg-emerald-200/80 py-1 px-2 rounded-t border border-emerald-300 flex items-center justify-between">
                <span>订单号</span>
                <span className="text-[9px] font-normal text-slate-500">可检索</span>
              </span>
              <div className="relative mt-0.5">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={isOrderDropdownOpen ? orderSearchQuery : selectedOrderNo}
                    onFocus={() => {
                      setOrderSearchQuery('');
                      setIsOrderDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setOrderSearchQuery(e.target.value);
                      if (!isOrderDropdownOpen) setIsOrderDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (filteredOrderOptions.length > 0) {
                          setSelectedOrderNo(filteredOrderOptions[0].order_no);
                        } else if (orderSearchQuery.trim()) {
                          setSelectedOrderNo(orderSearchQuery.trim().toUpperCase());
                        }
                        setIsOrderDropdownOpen(false);
                      }
                    }}
                    placeholder="输入或选择订单号..."
                    className="w-full bg-yellow-100 font-mono font-black text-slate-900 border border-yellow-300 rounded-b py-1 pl-2 pr-6 text-xs text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-text uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrderDropdownOpen(!isOrderDropdownOpen);
                      if (!isOrderDropdownOpen) setOrderSearchQuery('');
                    }}
                    className="absolute right-1 text-slate-600 hover:text-slate-900 p-0.5"
                    title="展开/收起订单列表"
                  >
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOrderDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Searchable Dropdown Popup */}
                {isOrderDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-emerald-500 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto text-left py-1">
                    <div className="px-2.5 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-100 uppercase flex justify-between items-center">
                      <span>订单匹配结果 ({filteredOrderOptions.length})</span>
                      <span className="text-[9px] text-slate-400">点击选择</span>
                    </div>
                    {filteredOrderOptions.length > 0 ? (
                      filteredOrderOptions.map((o) => {
                        const isSelected = o.order_no === selectedOrderNo;
                        return (
                          <div
                            key={o.id || o.order_no}
                            onClick={() => {
                              setSelectedOrderNo(o.order_no);
                              setIsOrderDropdownOpen(false);
                              setOrderSearchQuery('');
                            }}
                            className={`px-2.5 py-1.5 cursor-pointer text-xs flex items-center justify-between transition-colors border-b border-slate-50 last:border-none ${
                              isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div>
                              <div className="font-mono font-black text-slate-900 text-xs">{o.order_no}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{o.model}</div>
                            </div>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 bg-emerald-600 text-white font-bold text-[9px] rounded">
                                已选
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-3 text-center text-slate-400 text-xs space-y-1">
                        <p>未找到匹配订单</p>
                        <p className="text-[10px] text-slate-400">按 Enter 直接使用 "{orderSearchQuery.toUpperCase()}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-700 bg-amber-100/90 py-1 px-2 rounded-t border border-amber-200">
                订单库存数量
              </span>
              <div className="bg-yellow-100 font-mono font-black text-slate-900 border border-yellow-300 rounded-b py-1 px-1.5 text-base text-center mt-0.5">
                {orderTotalStock}
              </div>
            </div>
          </div>

          {/* Section 2: 仓库配置 (Center Block) */}
          <div className="col-span-12 md:col-span-3 bg-amber-50/70 p-1.5 rounded border border-amber-200">
            <div className="bg-amber-200/70 text-amber-900 font-bold text-[11px] py-0.5 rounded-t border border-amber-300 uppercase tracking-wider">
              仓库配置
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1 text-[11px]">
              <div className="bg-yellow-100/80 p-1 rounded border border-yellow-300">
                <span className="text-slate-500 block text-[10px]">区域</span>
                <span className="font-black text-amber-900 font-mono text-xs">{selectedZone}区</span>
              </div>
              <div className="bg-yellow-100/80 p-1 rounded border border-yellow-300">
                <span className="text-slate-500 block text-[10px]">排数</span>
                <span className="font-black text-amber-900 font-mono text-xs">{maxRows}</span>
              </div>
              <div className="bg-yellow-100/80 p-1 rounded border border-yellow-300">
                <span className="text-slate-500 block text-[10px]">列数</span>
                <span className="font-black text-amber-900 font-mono text-xs">{maxCols}</span>
              </div>
            </div>
          </div>

          {/* Section 3: 储量统计 (Right Block) */}
          <div className="col-span-12 md:col-span-4 bg-emerald-50/70 p-1.5 rounded border border-emerald-200">
            <div className="bg-emerald-200/80 text-emerald-900 font-bold text-[11px] py-0.5 rounded-t border border-emerald-300 uppercase tracking-wider">
              储量统计
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1 text-[11px]">
              <div className="bg-emerald-100/80 p-1 rounded border border-emerald-300">
                <span className="text-slate-600 block text-[10px]">仓位容量</span>
                <span className="font-black text-emerald-900 font-mono text-xs">{overallStats.totalCapacity}</span>
              </div>
              <div className="bg-emerald-100/80 p-1 rounded border border-emerald-300">
                <span className="text-slate-600 block text-[10px]">可用仓位</span>
                <span className="font-black text-emerald-900 font-mono text-xs">{overallStats.availableCount}</span>
              </div>
              <div className="bg-rose-100/90 p-1 rounded border border-rose-300">
                <span className="text-rose-700 block text-[10px] font-bold">爆仓预警</span>
                <span className="font-black text-rose-800 font-mono text-xs">{overallStats.isWarning ? '告警中' : '85%'}</span>
              </div>
            </div>
          </div>

          {/* Section 4: 产销平衡率 (Far Right KPI) */}
          <div className="col-span-12 md:col-span-2 bg-yellow-100 p-1.5 rounded border-2 border-amber-300 flex flex-col justify-center items-center">
            <span className="text-[11px] font-bold text-amber-900 bg-amber-200/80 w-full py-0.5 rounded border border-amber-300">
              产销平衡率
            </span>
            <span className="text-xl font-black font-mono text-rose-600 mt-1">
              {Math.round(overallStats.balanceRate * 100)}%
            </span>
          </div>

        </div>
      </div>

      {/* =========================================================================
          CONTROL TOOLBAR: ZONE TABS, QUICK SEARCH & ZOOM
          ========================================================================= */}
      <div className="bg-slate-100 p-2 rounded-lg border border-slate-300 flex flex-wrap items-center justify-between gap-2">
        {/* Zone Selector Pills */}
        <div className="flex items-center space-x-1">
          <span className="text-[11px] font-bold text-slate-600 mr-1">切换库区:</span>
          {warehouseConfig.zones.map(z => {
            const isActive = selectedZone === z.code;
            return (
              <button
                key={z.code}
                onClick={() => {
                  setSelectedZone(z.code);
                  const zObj = warehouseConfig.zones.find(x => x.code === z.code);
                  if (zObj) setRowRange([1, Math.min(20, zObj.rows)]);
                }}
                className={`px-3 py-1 rounded font-bold text-xs border transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {z.code} 库区
              </button>
            );
          })}
        </div>

        {/* Row Segment Pagination */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] font-bold text-slate-500">货架排段:</span>
          {rowPresets.map(([start, end]) => {
            const isActive = rowRange[0] === start && rowRange[1] === end;
            return (
              <button
                key={`${start}-${end}`}
                onClick={() => setRowRange([start, end])}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                  isActive
                    ? 'bg-slate-800 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {start}-{end}排
              </button>
            );
          })}
        </div>

        {/* Search & Zoom Controls */}
        <div className="flex items-center space-x-2">
          {/* Quick Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索仓位/订单/型号/数量 (例 B02-01, PO260810, MX-400)..."
              className="pl-7 pr-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500 w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Map Legend */}
          <div className="flex items-center space-x-2 text-[11px] bg-white px-2 py-1 rounded border border-slate-300 font-bold">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-rose-600 rounded-sm inline-block" />
              已占/占用
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-emerald-600 rounded-sm inline-block" />
              空置/可用
            </span>
          </div>

          {/* Zoom */}
          <div className="flex items-center border border-slate-300 rounded bg-white">
            <button
              onClick={() => setZoomScale(s => Math.max(0.7, s - 0.1))}
              className="px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
              title="缩小"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] font-mono px-1 border-x border-slate-200">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(s => Math.min(1.3, s + 0.1))}
              className="px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
              title="放大"
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN EXCEL SPLIT VIEW (左侧订单仓位详情表 + 右侧区域位图网格)
          ========================================================================= */}
      <div className="grid grid-cols-12 gap-3 items-start">
        
        {/* -----------------------------------------------------------------------
            LEFT COLUMN: 订单仓位详情列表 (对应 Excel 左侧表格)
            ----------------------------------------------------------------------- */}
        <div className="col-span-12 lg:col-span-4 bg-white border-2 border-slate-300 rounded-lg p-2 shadow-sm space-y-2">
          
          {/* Table Header & Active Stock Badge */}
          <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-1.5 pt-1">
            <h3 className="font-black text-slate-800 text-xs flex items-center gap-1">
              <span className="w-2 h-3 bg-emerald-600 inline-block rounded-xs" />
              {searchQuery.trim() ? (
                <span className="text-amber-800 font-bold flex items-center gap-1">
                  🔍 检索结果列表 <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">({displayTableRows.length} 处匹配)</span>
                </span>
              ) : (
                <span>订单仓位列表 <span className="text-emerald-700 font-mono">({selectedOrderNo})</span></span>
              )}
            </h3>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setHighlightOrderSlots(!highlightOrderSlots)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  highlightOrderSlots
                    ? 'bg-amber-500 text-slate-900 border-amber-600 font-black shadow-2xs'
                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                }`}
                title="高亮右侧地图中属于该订单的所有在库仓位"
              >
                {highlightOrderSlots ? '⚡ 高亮本单' : '高亮本单'}
              </button>
              {!searchQuery.trim() && (
                <span className="bg-rose-100 text-rose-800 border border-rose-300 font-bold px-2 py-0.5 rounded text-[10px]">
                  在库仓位 ({filteredOrderPositionsTable.length})
                </span>
              )}
            </div>
          </div>

          {/* Excel Style Table */}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-slate-300 rounded">
            <table className="w-full text-left border-collapse font-sans text-[11px]">
              <thead>
                <tr className="bg-emerald-600 text-white font-bold tracking-wider text-[11px]">
                  <th className="p-1.5 border border-emerald-700 text-center w-8">序号</th>
                  <th className="p-1.5 border border-emerald-700 text-center font-mono">仓位码</th>
                  <th className="p-1.5 border border-emerald-700 text-center font-mono">关联订单</th>
                  <th className="p-1.5 border border-emerald-700 text-center font-mono">产品型号</th>
                  <th className="p-1.5 border border-emerald-700 text-center font-mono">库存数量</th>
                  <th className="p-1.5 border border-emerald-700 text-center">品质检验结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayTableRows.map((row) => {
                  const isSelected = selectedCellCode === row.code;

                  return (
                    <tr
                      key={`table-row-${row.seq}-${row.code}`}
                      onClick={() => handleLocateCell(row.code, row.order_no)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-100 font-bold text-slate-900 border-l-4 border-amber-500'
                          : row.seq % 2 === 0
                          ? 'bg-slate-50 hover:bg-emerald-50/60'
                          : 'bg-white hover:bg-emerald-50/60'
                      }`}
                    >
                      <td className="p-1.5 border border-slate-200 text-center font-mono font-bold text-slate-500">
                        {row.seq}
                      </td>
                      <td className="p-1.5 border border-slate-200 text-center font-mono font-bold text-indigo-700">
                        {row.code}
                      </td>
                      <td className="p-1.5 border border-slate-200 text-center font-mono font-bold text-slate-900">
                        {row.order_no}
                      </td>
                      <td className="p-1.5 border border-slate-200 text-center font-mono text-slate-800">
                        {row.model}
                      </td>
                      <td className={`p-1.5 border border-slate-200 text-center font-mono font-black ${
                        row.qty > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        {row.qty}
                      </td>
                      <td className="p-1.5 border border-slate-200 text-center text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          row.quality === 'OQC验Pass'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : row.quality === '待复检'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {row.quality}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {displayTableRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                      {searchQuery.trim() ? `未找到包含 "${searchQuery}" 的仓位、订单或型号` : '该订单暂无关联在库仓位记录'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Active Cell Inspector Card */}
          {activeCell && (
            <div className="bg-amber-50 border border-amber-300 rounded p-2 text-xs space-y-1">
              <div className="flex justify-between items-center border-b border-amber-200 pb-1">
                <span className="font-bold text-amber-900 flex items-center gap-1">
                  <Info size={12} className="text-amber-700" />
                  选中仓位详情: <b className="font-mono text-indigo-800">{activeCell.code}</b>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeCell.status === 'occupied' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  {activeCell.status === 'occupied' ? '已占用' : '可用空置'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-700 pt-0.5">
                <div>关联订单: <b className="font-mono text-slate-900">{activeCell.order_no || '-'}</b></div>
                <div>存货型号: <b className="font-mono text-slate-900">{activeCell.model || '-'}</b></div>
                <div>库存数量: <b className="font-mono text-rose-600 font-black">{activeCell.qty || 0} Pcs</b></div>
                <div>质检状态: <b className="text-emerald-700">{activeCell.quality || 'OQC验Pass'}</b></div>
              </div>
            </div>
          )}
        </div>

        {/* -----------------------------------------------------------------------
            RIGHT COLUMN: 区域·位·图 网格矩阵 (对应 Excel 右侧 区域位图)
            ----------------------------------------------------------------------- */}
        <div className="col-span-12 lg:col-span-8 bg-white border-2 border-slate-300 rounded-lg p-2 shadow-sm space-y-2 overflow-hidden flex flex-col min-h-[620px]">
          <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-1.5">
            <h3 className="font-black text-slate-800 text-xs flex items-center gap-1">
              <span className="w-2 h-3 bg-amber-500 inline-block rounded-xs" />
              区域·位·图 矩阵 (第 {selectedZone} 区 - 第 {rowRange[0]}~{Math.min(rowRange[1], maxRows)} 排)
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              网格维度: {maxRows}排 × {maxCols}列 (20列可视视图)
            </span>
          </div>

          {/* Matrix Grid Container */}
          <div className="flex-1 overflow-auto border border-slate-300 bg-slate-100 p-1.5 rounded relative">
            <div
              className="transition-transform duration-150 origin-top-left"
              style={{ transform: `scale(${zoomScale})` }}
            >
              <table className="border-collapse font-mono text-[10px] text-center w-full">
                <thead>
                  <tr className="bg-amber-100 font-bold text-amber-900 border border-slate-400">
                    <th className="p-1 border border-slate-400 bg-amber-200/80 min-w-[55px] text-[11px]">
                      区·位·图
                    </th>
                    {colsList.map(c => (
                      <th
                        key={`col-hdr-${c}`}
                        className="p-1 border border-slate-400 min-w-[42px] font-bold text-slate-800 text-[10px] bg-yellow-100"
                      >
                        列{c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsList.map(r => {
                    const rowStr = String(r).padStart(2, '0');

                    return (
                      <tr key={`matrix-row-${selectedZone}-${r}`} className="hover:bg-slate-200/50">
                        {/* Row Header Label */}
                        <td className="p-1 border border-slate-400 font-bold text-slate-700 bg-slate-200 text-center text-[10px]">
                          {r}排
                        </td>

                        {/* Columns */}
                        {colsList.map(c => {
                          const colStr = String(c).padStart(2, '0');
                          const code = `${selectedZone}${rowStr}-${colStr}`;
                          
                          // Check if position exists
                          const pos = zonePositions.find(p => p.code === code);
                          const tableItem = orderPositionsTable.find(t => t.code === code);

                          const isOccupied = pos ? pos.status === 'occupied' : (tableItem && tableItem.qty > 0);
                          const isMatchSelectedOrder = (pos?.order_no === selectedOrderNo && pos?.qty > 0) || (tableItem && tableItem.qty > 0);
                          const isSelectedCell = selectedCellCode === code;
                          const q = searchQuery.trim().toUpperCase();
                          const inbItem = inbounds.find(i => i.position_code === code);
                          const isSearchHit = q ? (
                            code.toUpperCase().includes(q) ||
                            (pos?.order_no && pos.order_no.toUpperCase().includes(q)) ||
                            (pos?.model && pos.model.toUpperCase().includes(q)) ||
                            (pos?.qty !== null && String(pos.qty).includes(q)) ||
                            (inbItem?.order_no && inbItem.order_no.toUpperCase().includes(q)) ||
                            (inbItem?.model && inbItem.model.toUpperCase().includes(q)) ||
                            (tableItem?.order_no && tableItem.order_no.toUpperCase().includes(q)) ||
                            (tableItem?.model && tableItem.model.toUpperCase().includes(q)) ||
                            (tableItem?.qty !== undefined && String(tableItem.qty).includes(q))
                          ) : false;

                          // Excel Exact Color Scheme:
                          // Occupied / Highlighted = Bright Red (#FF0000 / bg-rose-600)
                          // Available = Bright Green (#00B050 / bg-emerald-600)
                          let cellBgClass = isOccupied
                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700';

                          if (isSearchHit) {
                            cellBgClass = 'bg-amber-400 text-slate-900 font-black animate-pulse';
                          } else if (highlightOrderSlots && isMatchSelectedOrder) {
                            cellBgClass = 'bg-rose-600 text-white ring-2 ring-amber-400 font-black z-10 shadow-sm';
                          }

                          return (
                            <td
                              key={code}
                              onClick={() => setSelectedCellCode(code)}
                              className={`p-1 border border-slate-400 cursor-pointer font-bold transition-all text-center ${cellBgClass} ${
                                isSelectedCell ? 'ring-2 ring-slate-900 ring-offset-1 z-20 scale-105 shadow-md font-black' : ''
                              }`}
                              title={`仓位: ${code}\n状态: ${isOccupied ? `已占用 (订单: ${selectedOrderNo})` : '空置可用'}`}
                            >
                              <div className="leading-tight text-[9px] font-mono tracking-tight">
                                {code}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
