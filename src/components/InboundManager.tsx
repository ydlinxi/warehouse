/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Import,
  CheckCircle,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  Zap,
  ArrowRight,
  RotateCcw,
  X,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  History,
  Calendar,
  User
} from 'lucide-react';
import { DBService, formatters } from '../db';
import { PositionDemand, Inbound } from '../types';

interface InboundManagerProps {}

export const InboundManager: React.FC<InboundManagerProps> = () => {
  const [activeTab, setActiveTab] = useState<'allocation' | 'records'>('allocation');
  const [demands, setDemands] = useState<PositionDemand[]>(() => DBService.getDemands());
  const [inbounds, setInbounds] = useState<Inbound[]>(() => DBService.getInbounds());

  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Dropdown options
  const [lines] = useState(() => DBService.getLines());
  const [handlers] = useState(() => DBService.getHandlers());
  const [autoAllocateZone, setAutoAllocateZone] = useState<string>('');

  // Filter demands (only unallocated pending pallets matching search query)
  const pendingDemands = useMemo(() => {
    return demands.filter(d => {
      const isUnallocated = d.position_code === null;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
                            d.order_no.toLowerCase().includes(q) || 
                            d.model.toLowerCase().includes(q);
      return isUnallocated && matchesSearch;
    });
  }, [demands, searchQuery]);

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

  const demandsByOrder = useMemo(() => {
    const groups: Record<string, PositionDemand[]> = {};
    pendingDemands.forEach(d => {
      if (!groups[d.order_no]) {
        groups[d.order_no] = [];
      }
      groups[d.order_no].push(d);
    });
    return groups;
  }, [pendingDemands]);

  const [collapsedOrders, setCollapsedOrders] = useState<Set<string>>(new Set());
  const toggleOrderCollapse = (orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderNo)) next.delete(orderNo);
      else next.add(orderNo);
      return next;
    });
  };

  // All positions calculation (stock === 0 & no pending demand vs occupied)
  const allPositions = useMemo(() => {
    const rawPos = DBService.getPositions();
    const reservedCodes = new Set(
      demands.filter(d => d.position_code).map(d => d.position_code!)
    );
    return rawPos.map(p => {
      const isOccupied = p.status === 'occupied' || reservedCodes.has(p.code);
      return {
        ...p,
        isOccupied
      };
    });
  }, [demands, inbounds]);

  const ordersWithMetrics = useMemo(() => DBService.getOrdersWithMetrics(), [demands, inbounds]);

  // Available positions list & count
  const availablePositions = useMemo(() => {
    return allPositions.filter(p => !p.isOccupied);
  }, [allPositions]);

  // Unique zones from all positions
  const allZones = useMemo(() => {
    const set = new Set<string>();
    allPositions.forEach(p => set.add(p.zone));
    return Array.from(set).sort();
  }, [allPositions]);

  // Row input state map keyed by demand.id
  const [rowInputs, setRowInputs] = useState<Record<string, {
    positionCode: string;
    actualQty: number | '';
    inboundDate: string;
    selectedLine: string;
    selectedHandler: string;
    qualityResult: Inbound['quality'];
    note: string;
    checked: boolean;
  }>>({});

  // Initialize/Sync row inputs whenever pendingDemands changes
  useEffect(() => {
    setRowInputs(prev => {
      const next = { ...prev };
      const today = formatters.dbDate();
      const orders = DBService.getOrders();

      pendingDemands.forEach(d => {
        if (!next[d.id]) {
          const order = orders.find(o => o.id === d.order_id);
          next[d.id] = {
            positionCode: '',
            actualQty: order ? order.per_pallet : 200,
            inboundDate: today,
            selectedLine: lines[0] || '线别A-01',
            selectedHandler: handlers[0] || '张敏',
            qualityResult: 'OQC验Pass',
            note: '',
            checked: true
          };
        }
      });
      return next;
    });
  }, [pendingDemands, lines, handlers]);

  const refreshData = () => {
    setDemands(DBService.getDemands());
    setInbounds(DBService.getInbounds());
  };

  // Update specific row field helper
  const updateRowField = <K extends keyof typeof rowInputs[string]>(
    demandId: string,
    field: K,
    value: typeof rowInputs[string][K]
  ) => {
    setRowInputs(prev => ({
      ...prev,
      [demandId]: {
        ...(prev[demandId] || {
          positionCode: '',
          actualQty: 200,
          inboundDate: formatters.dbDate(),
          selectedLine: lines[0] || '',
          selectedHandler: handlers[0] || '',
          qualityResult: 'OQC验Pass',
          note: '',
          checked: true
        }),
        [field]: value
      }
    }));
  };

  const [batchFields, setBatchFields] = useState({
    actualQty: '',
    inboundDate: formatters.dbDate(),
    selectedLine: lines[0] || '线别A-01',
    selectedHandler: handlers[0] || '张敏',
    qualityResult: 'OQC验Pass' as Inbound['quality'],
    note: ''
  });

  const resetBatchFields = () => {
    setBatchFields({
      actualQty: '',
      inboundDate: formatters.dbDate(),
      selectedLine: '',
      selectedHandler: '',
      qualityResult: '',
      note: ''
    });
  };

  const applyBatchFields = () => {
    setSuccessMsg('');
    setErrorMsg('');
    const targetRows = pendingDemands.filter(d => rowInputs[d.id]?.checked);
    if (targetRows.length === 0) {
      setErrorMsg('请先勾选需要批量设置的托盘！');
      return;
    }

    setRowInputs(prev => {
      const next = { ...prev };
      targetRows.forEach(d => {
        if (next[d.id]) {
          next[d.id] = {
            ...next[d.id],
            actualQty: batchFields.actualQty !== '' ? Number(batchFields.actualQty) : next[d.id].actualQty,
            inboundDate: batchFields.inboundDate || next[d.id].inboundDate,
            selectedLine: batchFields.selectedLine || next[d.id].selectedLine,
            selectedHandler: batchFields.selectedHandler || next[d.id].selectedHandler,
            qualityResult: batchFields.qualityResult || next[d.id].qualityResult,
            note: batchFields.note !== '' ? batchFields.note : next[d.id].note,
          };
        }
      });
      return next;
    });
    setSuccessMsg(`✅ 成功将批量设置应用到 ${targetRows.length} 个勾选项！`);
    setBatchFields(prev => ({ ...prev, actualQty: '', note: '' }));
  };

  const currentlySelectedCodes = useMemo(() => {
    const codes = new Set<string>();
    Object.values(rowInputs).forEach((input: any) => {
      if (input.positionCode) {
        codes.add(input.positionCode);
      }
    });
    return codes;
  }, [rowInputs]);

  // Toggle selection for all visible rows
  const isAllChecked = useMemo(() => {
    if (pendingDemands.length === 0) return false;
    return pendingDemands.every(d => rowInputs[d.id]?.checked);
  }, [pendingDemands, rowInputs]);

  const handleToggleSelectAll = () => {
    const nextChecked = !isAllChecked;
    setRowInputs(prev => {
      const next = { ...prev };
      pendingDemands.forEach(d => {
        if (next[d.id]) {
          next[d.id] = { ...next[d.id], checked: nextChecked };
        }
      });
      return next;
    });
  };

  // Auto-allocate empty positions sequentially to checked (or all) rows
  const handleBatchAutoAllocate = () => {
    setSuccessMsg('');
    setErrorMsg('');

    // Get checked rows or all rows if none checked
    const targetRows = pendingDemands.filter(d => rowInputs[d.id]?.checked);
    const rowsToAssign = targetRows.length > 0 ? targetRows : pendingDemands;

    if (rowsToAssign.length === 0) {
      setErrorMsg('没有待分配的托盘！');
      return;
    }

    const filteredPositions = autoAllocateZone 
      ? availablePositions.filter(p => p.zone === autoAllocateZone)
      : availablePositions;

    if (filteredPositions.length === 0) {
      if (autoAllocateZone) {
        setErrorMsg(`警告：${autoAllocateZone}区 当前没有任何空闲储位可供分配！`);
      } else {
        setErrorMsg('警告：仓库当前没有任何空闲储位可供分配！');
      }
      return;
    }

    // Currently assigned codes in user inputs to avoid duplicate assignment
    const alreadyAssigned = new Set<string>();

    let allocatedCount = 0;
    let posIndex = 0;

    const nextInputs = { ...rowInputs };

    rowsToAssign.forEach(d => {
      // Find next unassigned available position
      while (posIndex < filteredPositions.length) {
        const cand = filteredPositions[posIndex].code;
        posIndex++;
        if (!alreadyAssigned.has(cand)) {
          alreadyAssigned.add(cand);
          nextInputs[d.id] = {
            ...(nextInputs[d.id] || {
              positionCode: '',
              actualQty: 200,
              inboundDate: formatters.dbDate(),
              selectedLine: lines[0] || '',
              selectedHandler: handlers[0] || '',
              qualityResult: 'OQC验Pass',
              note: '',
              checked: true
            }),
            positionCode: cand,
            checked: true
          };
          allocatedCount++;
          break;
        }
      }
    });

    setRowInputs(nextInputs);

    if (allocatedCount > 0) {
      setSuccessMsg(`⚡ 已智能为您顺位推荐并填入 ${allocatedCount} 个空闲储位卡位${autoAllocateZone ? ` (${autoAllocateZone}区)` : ''}！`);
    } else {
      setErrorMsg('没有足够的空闲仓位进行自动分配。');
    }
  };

  // Submit single row inbound
  const handleSingleInbound = (demand: PositionDemand) => {
    setSuccessMsg('');
    setErrorMsg('');

    const input = rowInputs[demand.id];
    if (!input || !input.positionCode.trim()) {
      setErrorMsg(`[托盘 #${demand.seq}] 请输入或选择指定仓位码！`);
      return;
    }
    if (!input.actualQty || input.actualQty <= 0) {
      setErrorMsg(`[托盘 #${demand.seq}] 实际入库数量必须大于 0！`);
      return;
    }

    try {
      const code = input.positionCode.trim().toUpperCase();
      DBService.recordInbound(
        demand.id,
        code,
        input.inboundDate,
        Number(input.actualQty),
        input.selectedLine,
        input.selectedHandler,
        input.qualityResult,
        input.note
      );

      setSuccessMsg(`上架成功！订单 ${demand.order_no} 托盘 #${demand.seq} 已绑定定位至 [${code}]`);
      refreshData();
    } catch (err: any) {
      setErrorMsg(`[托盘 #${demand.seq}] ${err.message || '上架入库失败！'}`);
    }
  };

  // Batch submit checked rows
  const handleBatchInbound = () => {
    setSuccessMsg('');
    setErrorMsg('');

    const selectedDemands = pendingDemands.filter(d => rowInputs[d.id]?.checked);
    if (selectedDemands.length === 0) {
      setErrorMsg('请先勾选需要批量上架入库的托盘！');
      return;
    }

    // Validate inputs & capacity
    const invalidRows: string[] = [];
    const groupedQtys = new Map<string, number>();
    const usedPositionsInBatch = new Set<string>();

    selectedDemands.forEach(d => {
      const inp = rowInputs[d.id];
      if (!inp || !inp.positionCode.trim()) {
        invalidRows.push(`订单 ${d.order_no} 托盘 #${d.seq} 未设定仓位`);
        return;
      }
      
      const posCode = inp.positionCode.trim().toUpperCase();
      const dbPos = allPositions.find(p => p.code === posCode);
      
      if (!dbPos) {
        invalidRows.push(`订单 ${d.order_no} 仓位 ${posCode} 不存在`);
      } else if (dbPos.isOccupied) {
        invalidRows.push(`订单 ${d.order_no} 仓位 ${posCode} 已被占用`);
      }
      
      if (usedPositionsInBatch.has(posCode)) {
        invalidRows.push(`仓位 ${posCode} 在当前勾选项中被重复分配`);
      }
      usedPositionsInBatch.add(posCode);

      if (!inp.actualQty || Number(inp.actualQty) <= 0) {
        invalidRows.push(`订单 ${d.order_no} 托盘 #${d.seq} 入库数非法`);
      } else {
        const qty = Number(inp.actualQty);
        const orderInfo = ordersWithMetrics.find(o => o.id === d.order_id);
        if (orderInfo) {
          if (qty > orderInfo.per_pallet) {
             invalidRows.push(`订单 ${d.order_no} 托盘 #${d.seq} 入库量(${qty})超单托上限(${orderInfo.per_pallet})`);
          }
          const currentGroupQty = groupedQtys.get(d.order_no) || 0;
          groupedQtys.set(d.order_no, currentGroupQty + qty);
        }
      }
    });

    if (invalidRows.length > 0) {
      setErrorMsg(`提交中止：\n` + invalidRows.join('；\n'));
      return;
    }

    // Global Capacity Validation
    let capacityError = '';
    for (const [orderNo, totalNewQty] of Array.from(groupedQtys.entries())) {
       const orderInfo = ordersWithMetrics.find(o => o.order_no === orderNo);
       if (orderInfo) {
          if (orderInfo.inbound_qty + totalNewQty > orderInfo.order_qty) {
             capacityError += `订单 ${orderNo} 本次入库加上已入库总量(${orderInfo.inbound_qty + totalNewQty})将超出总订单数量(${orderInfo.order_qty})；`;
          }
       }
    }
    
    if (capacityError) {
       setErrorMsg(`防超发拦截：${capacityError}`);
       return;
    }

    // Check for multiple zones in the same order
    const orderZones = new Map<string, Set<string>>();
    selectedDemands.forEach(d => {
      const inp = rowInputs[d.id];
      if (inp && inp.positionCode) {
        const position = allPositions.find(p => p.code === inp.positionCode.trim().toUpperCase());
        if (position) {
          if (!orderZones.has(d.order_no)) {
            orderZones.set(d.order_no, new Set());
          }
          orderZones.get(d.order_no)!.add(position.zone);
        }
      }
    });

    const crossZoneOrders = Array.from(orderZones.entries())
      .filter(([_, zones]) => zones.size > 1)
      .map(([orderNo, zones]) => `[${orderNo}] 分配到了 ${Array.from(zones).join('区、')}区`);

    if (crossZoneOrders.length > 0) {
      const confirmMsg = `警告：发现同一关联订单的托盘被分配到了不同的库区。\n\n${crossZoneOrders.join('\n')}\n\n原则上同一订单应安排在同一区域。是否确定要继续上架入库？`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    // Execute batch inbound
    let successCount = 0;
    const errors: string[] = [];

    selectedDemands.forEach(d => {
      const inp = rowInputs[d.id];
      try {
        const code = inp.positionCode.trim().toUpperCase();
        DBService.recordInbound(
          d.id,
          code,
          inp.inboundDate,
          Number(inp.actualQty),
          inp.selectedLine,
          inp.selectedHandler,
          inp.qualityResult,
          inp.note
        );
        successCount++;
      } catch (err: any) {
        errors.push(`托盘 #${d.seq}: ${err.message}`);
      }
    });

    refreshData();

    if (errors.length > 0) {
      setErrorMsg(`部分完成：成功 ${successCount} 个，失败 ${errors.length} 个（${errors.join('； ')}）`);
    } else {
      setSuccessMsg(`🎉 批量成功完成 ${successCount} 个托盘的上架与入仓定位！锁位成功。`);
    }
  };

  // Rollback Modal State for history records
  const [inboundToRollback, setInboundToRollback] = useState<Inbound | null>(null);

  const handleRollbackInbound = (inb: Inbound) => {
    setInboundToRollback(inb);
  };

  const confirmRollbackInbound = () => {
    if (!inboundToRollback) return;
    setSuccessMsg('');
    setErrorMsg('');

    try {
      DBService.deleteInbound(inboundToRollback.id);
      setSuccessMsg(`已成功回退订单 ${inboundToRollback.order_no} 托盘 #${inboundToRollback.seq} 的入库记录！原卡位 [${inboundToRollback.position_code}] 已释放，托盘已返回待分配。`);
      refreshData();
      setInboundToRollback(null);
    } catch (err: any) {
      setErrorMsg(err.message || '回退入库记录失败！');
      setInboundToRollback(null);
    }
  };

  const selectedCount = pendingDemands.filter(d => rowInputs[d.id]?.checked).length;

  return (
    <div id="inboundmanager-root" className="space-y-4">
      {/* Top Banner & Title */}
      <div id="inbound-header" className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Import className="text-emerald-600" size={22} />
            成品入库扫码与批量分配定位
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            在产品线组包下线后，通过表格直接录入或批量自动匹配物理卡位，一键同步上架定位与品质检验记录。
          </p>
        </div>

        {/* Global Warehouse Stat Badges */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
            待定位托盘: <b className="text-indigo-600 font-mono text-xs">{pendingDemands.length}</b> 托
          </span>
          <span className="text-[11px] font-bold text-emerald-700 px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
            空闲仓位: <b className="font-mono text-xs">{availablePositions.length}</b> 个
          </span>
          <span className="text-[11px] font-bold text-slate-500 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
            占用仓位: <b className="font-mono text-xs">{allPositions.length - availablePositions.length}</b> 个
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 text-xs">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 hover:text-rose-900 text-xs">✕</button>
        </div>
      )}

      {/* Tab Switcher Bar */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl self-start w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('allocation')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'allocation'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LayoutGrid size={15} />
          <span>待入库卡位分配台账 ({pendingDemands.length})</span>
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
          <span>入库历史记录与追溯 ({inbounds.length})</span>
        </button>
      </div>

      {activeTab === 'allocation' ? (
        /* Main Interactive Batch Allocation Workbench Card */
        <div id="inbound-batch-workbench" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Toolbar Bar */}
        <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Left Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              id="btn-select-all"
              type="button"
              onClick={handleToggleSelectAll}
              className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {isAllChecked ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-slate-400" />}
              <span>{isAllChecked ? '取消全选' : '全选表格'}</span>
            </button>

            <div className="flex items-center bg-amber-500 rounded-lg shadow-2xs overflow-hidden">
              <select
                value={autoAllocateZone}
                onChange={(e) => setAutoAllocateZone(e.target.value)}
                className="bg-amber-400 text-amber-950 font-bold text-xs py-1.5 pl-2 pr-1 border-r border-amber-500 focus:outline-none cursor-pointer"
                title="选择推荐库区"
              >
                <option value="">全区顺位</option>
                {allZones.map(zone => (
                  <option key={zone} value={zone}>{zone}区</option>
                ))}
              </select>
              <button
                id="btn-auto-allocate-positions"
                type="button"
                onClick={handleBatchAutoAllocate}
                className="px-3 py-1.5 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                title="按空闲顺位自动推荐卡位填充到各托盘"
              >
                <Zap size={14} className="fill-slate-950" />
                <span>⚡ 推荐卡位</span>
              </button>
            </div>

            <button
              id="btn-batch-confirm-inbound"
              type="button"
              onClick={handleBatchInbound}
              disabled={selectedCount === 0}
              className={`px-4 py-1.5 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                selectedCount > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Import size={14} />
              <span>🚀 批量确认上架入库 ({selectedCount})</span>
            </button>
          </div>

          {/* Right Search Input */}
          <div className="relative w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-batch-demands"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="快速检索订单号 / 产品型号..."
              className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Batch Allocation Interactive Table */}
        <div className="overflow-x-auto min-h-[380px] max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={isAllChecked}
                    onChange={handleToggleSelectAll}
                    className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-2 text-center w-10">#</th>
                <th className="py-2.5 px-3">关联订单号</th>
                <th className="py-2.5 px-3">产品型号</th>
                <th className="py-2.5 px-3 text-center">托盘序号</th>
                <th className="py-2.5 px-3 w-64">指定分配仓位 (手填 / 选择)</th>
                <th className="py-2.5 px-3 text-center w-28">实际入库量(Pcs)</th>
                <th className="py-2.5 px-3 text-center w-28">入库日期</th>
                <th className="py-2.5 px-3 text-center w-28">生产品线</th>
                <th className="py-2.5 px-3 text-center w-24">操作经办</th>
                <th className="py-2.5 px-3 text-center w-28">品质检验</th>
                <th className="py-2.5 px-3 min-w-[120px]">流水备注</th>
                <th className="py-2.5 px-3 text-center w-20">操作</th>
              </tr>
              {pendingDemands.length > 0 && (
                <tr className="bg-indigo-50/60 border-b border-indigo-100">
                  <th className="py-1.5 px-3"></th>
                  <th colSpan={4} className="py-1.5 px-3 text-right text-indigo-700 font-bold text-[11px]">
                    批量设置选中项 👉
                  </th>
                  <th className="py-1.5 px-3 text-[10px] text-slate-400 font-medium">
                    (仓位需独立分配)
                  </th>
                  <th className="py-1.5 px-1 text-center">
                    <input type="number" placeholder="数量" value={batchFields.actualQty} onChange={(e) => setBatchFields({...batchFields, actualQty: e.target.value})} className="w-20 border border-indigo-200 rounded px-1.5 py-1 text-[10px] font-normal focus:outline-none focus:border-indigo-400" />
                  </th>
                  <th className="py-1.5 px-1 text-center">
                    <input type="date" value={batchFields.inboundDate} onChange={(e) => setBatchFields({...batchFields, inboundDate: e.target.value})} className="w-24 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal focus:outline-none focus:border-indigo-400" />
                  </th>
                  <th className="py-1.5 px-1 text-center">
                    <select value={batchFields.selectedLine} onChange={(e) => setBatchFields({...batchFields, selectedLine: e.target.value})} className="w-24 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal bg-white focus:outline-none focus:border-indigo-400">
                      <option value="">不更改</option>
                      {lines.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </th>
                  <th className="py-1.5 px-1 text-center">
                    <select value={batchFields.selectedHandler} onChange={(e) => setBatchFields({...batchFields, selectedHandler: e.target.value})} className="w-20 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal bg-white focus:outline-none focus:border-indigo-400">
                      <option value="">不更改</option>
                      {handlers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </th>
                  <th className="py-1.5 px-1 text-center">
                    <select value={batchFields.qualityResult} onChange={(e) => setBatchFields({...batchFields, qualityResult: e.target.value as any})} className="w-24 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal bg-white focus:outline-none focus:border-indigo-400">
                      <option value="">不更改</option>
                      <option value="OQC验Pass">OQC验Pass</option>
                      <option value="特采">特采</option>
                      <option value="返工复验">返工复验</option>
                    </select>
                  </th>
                  <th className="py-1.5 px-1">
                    <input type="text" placeholder="批量备注..." value={batchFields.note} onChange={(e) => setBatchFields({...batchFields, note: e.target.value})} className="w-full border border-indigo-200 rounded px-2 py-1 text-[10px] font-normal focus:outline-none focus:border-indigo-400" />
                  </th>
                  <th className="py-1.5 px-2 text-center">
                    <div className="flex flex-col gap-1">
                      <button onClick={applyBatchFields} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 rounded text-[11px] font-bold shadow-sm transition-colors cursor-pointer w-full flex items-center justify-center gap-1">
                        <CheckSquare size={12} />
                        应用
                      </button>
                      <button onClick={resetBatchFields} className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded text-[10px] font-bold shadow-sm transition-colors cursor-pointer w-full flex items-center justify-center">
                        清空
                      </button>
                    </div>
                  </th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pendingDemands.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-400">
                    <CheckCircle size={36} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">全仓成品上架定位完成！暂无未定位待入库托盘。</p>
                  </td>
                </tr>
              ) : (
                Object.entries(demandsByOrder).map(([orderNo, groupDemands]: [string, PositionDemand[]]) => {
                  const isCollapsed = collapsedOrders.has(orderNo);
                  const allCheckedInGroup = groupDemands.every(d => rowInputs[d.id]?.checked);
                  const orderInfo = ordersWithMetrics.find(o => o.order_no === orderNo);
                  const progressPercent = orderInfo ? Math.min(100, Math.round((orderInfo.inbound_qty / orderInfo.order_qty) * 100)) : 0;
                  
                  return (
                    <React.Fragment key={orderNo}>
                      {/* Group Header Row */}
                      <tr 
                        className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-t border-b border-slate-200 transition-colors"
                        onClick={(e) => toggleOrderCollapse(orderNo, e)}
                      >
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={allCheckedInGroup}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRowInputs(prev => {
                                const next = { ...prev };
                                groupDemands.forEach(d => {
                                  if (next[d.id]) {
                                    next[d.id] = { ...next[d.id], checked };
                                  }
                                });
                                return next;
                              });
                            }}
                            className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                          />
                        </td>
                        <td colSpan={12} className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-slate-500 hover:text-slate-800 focus:outline-none">
                              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <span className="font-bold text-sm text-slate-800 font-mono tracking-tight">{orderNo}</span>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold">
                              共 {groupDemands.length} 托
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium pl-1">
                              产品型号: {groupDemands[0]?.model}
                            </span>
                            {orderInfo && (
                              <div className="flex items-center gap-2 ml-4">
                                <div className="text-[10px] font-bold text-slate-500">
                                  📦 已入库进度: <span className="text-indigo-600">{orderInfo.inbound_qty}</span> / {orderInfo.order_qty} Pcs
                                </div>
                                <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${progressPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progressPercent}%` }}></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Group Children */}
                      {!isCollapsed && groupDemands.map((demand, idx) => {
                        const input = rowInputs[demand.id] || {
                          positionCode: '',
                          actualQty: 200,
                          inboundDate: formatters.dbDate(),
                          selectedLine: lines[0] || '',
                          selectedHandler: handlers[0] || '',
                          qualityResult: 'OQC验Pass',
                          note: '',
                          checked: true
                        };

                        return (
                          <tr
                            key={demand.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              input.checked ? 'bg-indigo-50/30' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={input.checked}
                                onChange={(e) => updateRowField(demand.id, 'checked', e.target.checked)}
                                className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer ml-3"
                              />
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-[10px] text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-bold font-mono text-slate-400 text-xs line-through opacity-50">
                              {/* Order No is in group header now */}
                              {demand.order_no}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10px]">
                                {demand.model}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-100">
                                托盘 {demand.seq}
                              </span>
                            </td>

                      {/* Position Selector (Input + Select) */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          {/* Manual Input */}
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="如 B02-01"
                              value={input.positionCode}
                              onChange={(e) => updateRowField(demand.id, 'positionCode', e.target.value.toUpperCase())}
                              className={`w-28 border rounded py-1 pl-2 pr-5 text-xs font-mono font-bold focus:outline-none uppercase ${
                                input.positionCode
                                  ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900'
                                  : 'border-slate-300 bg-white'
                              }`}
                            />
                            {input.positionCode && (
                              <button
                                type="button"
                                onClick={() => updateRowField(demand.id, 'positionCode', '')}
                                className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                                title="清空此仓位"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>

                          {/* Dropdown Select */}
                          <select
                            value={input.positionCode}
                            onChange={(e) => updateRowField(demand.id, 'positionCode', e.target.value)}
                            className="w-32 border border-slate-300 rounded py-1 px-1 text-[11px] font-mono bg-white cursor-pointer"
                          >
                            <option value="">-- 选择仓位 --</option>
                            {allZones.map(zone => (
                              <optgroup key={`z-${zone}`} label={`${zone}区`}>
                                {allPositions
                                  .filter(p => p.zone === zone)
                                  .map(p => {
                                    const isSelectedByOther = currentlySelectedCodes.has(p.code) && input.positionCode !== p.code;
                                    const isDisabled = (p.isOccupied && p.code !== input.positionCode) || isSelectedByOther;
                                    return (
                                      <option
                                        key={`p-${p.code}`}
                                        value={p.code}
                                        disabled={isDisabled}
                                        className={isDisabled ? 'text-slate-400 bg-slate-100' : 'text-slate-900 font-bold'}
                                      >
                                        {p.code} {p.isOccupied ? '(已用)' : (isSelectedByOther ? '(已选)' : '(空闲)')}
                                      </option>
                                    );
                                  })}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Actual Qty */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={input.actualQty}
                          onChange={(e) => updateRowField(demand.id, 'actualQty', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-20 border border-slate-300 rounded py-1 px-2 text-center text-xs font-mono font-bold"
                        />
                      </td>

                      {/* Inbound Date */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="date"
                          value={input.inboundDate}
                          onChange={(e) => updateRowField(demand.id, 'inboundDate', e.target.value)}
                          className="w-28 border border-slate-300 rounded py-1 px-1 text-center text-[11px]"
                        />
                      </td>

                      {/* Line */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={input.selectedLine}
                          onChange={(e) => updateRowField(demand.id, 'selectedLine', e.target.value)}
                          className="w-24 border border-slate-300 rounded py-1 px-1 text-xs bg-white"
                        >
                          {lines.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </td>

                      {/* Handler */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={input.selectedHandler}
                          onChange={(e) => updateRowField(demand.id, 'selectedHandler', e.target.value)}
                          className="w-20 border border-slate-300 rounded py-1 px-1 text-xs bg-white"
                        >
                          {handlers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </td>

                      {/* Quality */}
                      <td className="py-2 px-3 text-center">
                        <select
                          value={input.qualityResult}
                          onChange={(e) => updateRowField(demand.id, 'qualityResult', e.target.value as Inbound['quality'])}
                          className={`w-24 border border-slate-300 rounded py-1 px-1 text-[11px] font-bold cursor-pointer ${
                            input.qualityResult === 'OQC验Pass' ? 'text-emerald-700 bg-emerald-50/50' :
                            input.qualityResult === '待复检' ? 'text-amber-700 bg-amber-50/50' :
                            'text-rose-700 bg-rose-50/50'
                          }`}
                        >
                          <option value="OQC验Pass">OQC验Pass</option>
                          <option value="待复检">待复检</option>
                          <option value="不合格">不合格</option>
                        </select>
                      </td>

                      {/* Note */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="批次/包装备注"
                          value={input.note}
                          onChange={(e) => updateRowField(demand.id, 'note', e.target.value)}
                          className="w-full border border-slate-200 rounded py-1 px-2 text-xs bg-white"
                        />
                      </td>

                      {/* Action Button */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleSingleInbound(demand)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-2xs cursor-pointer flex items-center justify-center gap-1 w-full"
                          title="单条确认此托盘上架"
                        >
                          <span>确认</span>
                          <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })
        )}
      </tbody>
          </table>
        </div>
      </div>

      ) : (
        /* History Records Tab */
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
                            onClick={() => handleRollbackInbound(inb)}
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
      )}

      {/* Rollback Confirmation Modal */}
      {inboundToRollback && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5">
              <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
                <RotateCcw className="text-amber-500" size={20} />
                确认回退入库记录？
              </h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                确定要回退订单 <strong className="text-slate-700">{inboundToRollback.order_no}</strong> 托盘 <strong className="text-slate-700">#{inboundToRollback.seq}</strong> 的入库记录及相关数据吗？
              </p>
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs mb-6">
                回退后，该入库记录及相关数据将彻底清除：卡位 <strong className="font-mono">{inboundToRollback.position_code}</strong> 将自动解锁释放，托盘将<strong>重新返回待分配列表</strong>。
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setInboundToRollback(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmRollbackInbound}
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
