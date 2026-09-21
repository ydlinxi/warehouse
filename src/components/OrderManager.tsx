/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Eye,
  X,
  Package,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2
} from 'lucide-react';
import { DBService, formatters } from '../db';
import { Order, ProductModel, ProductSku, PurchaseOrder, InboundPlanLine } from '../types';

interface OrderManagerProps {}

export const OrderManager: React.FC<OrderManagerProps> = () => {
  const [orders, setOrders] = useState(() => DBService.getOrdersWithMetrics());
  const [models] = useState<ProductModel[]>(() => DBService.getModels());
  const [skus] = useState<ProductSku[]>(() => DBService.getProductSkus());
  const [pos, setPos] = useState<PurchaseOrder[]>(() => DBService.getPurchaseOrders());
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [orderNo, setOrderNo] = useState('');
  const [planLines, setPlanLines] = useState<InboundPlanLine[]>([{ sku: '', title: '', maxPerPallet: 100, qty: 0 }]);
  const [receivingPoNo, setReceivingPoNo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Expandable Row State
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Edit State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Delete Confirmation State
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const refreshData = () => {
    setOrders(DBService.getOrdersWithMetrics());
    setPos(DBService.getPurchaseOrders());
  };

  const handleEditClick = (order: Order) => {
    setEditingOrderId(order.id);
    setOrderNo(order.order_no);
    setPlanLines((order.lines && order.lines.length > 0)
      ? order.lines.map(l => ({ ...l }))
      : [{ sku: order.model, title: order.model, maxPerPallet: order.per_pallet, qty: order.order_qty }]);
    setIsCreateOpen(true);
  };

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order);
  };

  const confirmDelete = () => {
    if (!orderToDelete) return;
    try {
      DBService.deleteOrder(orderToDelete.id);
      refreshData();
      setOrderToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || '删除订单失败！');
      setOrderToDelete(null);
    }
  };

  // 采购单确认收货：打开「创建入库计划」弹窗并预填采购单 SKU 行，用户确认卡板容量后再创建
  const handleBuildPallets = (poNo: string) => {
    const rows = DBService.getPurchasePlanRows().filter(r => r.poNo === poNo);
    setErrorMsg('');
    setEditingOrderId(null);
    setReceivingPoNo(poNo);
    setOrderNo(suggestPlanNo());
    setPlanLines(rows.length > 0
      ? rows.map(r => ({ sku: r.sku, title: r.model, maxPerPallet: r.perPallet, qty: r.need }))
      : [{ sku: '', title: '', maxPerPallet: 100, qty: 0 }]);
    setIsCreateOpen(true);
  };

  // ===== 入库计划 SKU 行编辑 =====
  const emptyLine = (): InboundPlanLine => ({ sku: '', title: '', maxPerPallet: 100, qty: 0 });
  const addPlanLine = () => setPlanLines(prev => [...prev, emptyLine()]);
  const removePlanLine = (idx: number) => setPlanLines(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  const updatePlanLine = (idx: number, patch: Partial<InboundPlanLine>) =>
    setPlanLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const handleLineSkuChange = (idx: number, skuCode: string) => {
    const sku = skus.find(s => s.sku === skuCode);
    if (!sku) { updatePlanLine(idx, { sku: '', title: '' }); return; }
    updatePlanLine(idx, { sku: sku.sku, title: sku.title, maxPerPallet: sku.perPallet });
  };
  const linePallets = (l: InboundPlanLine) => Math.max(1, Math.ceil((l.qty || 0) / Math.max(1, l.maxPerPallet || 1)));
  const totalPlanQty = planLines.reduce((s, l) => s + (l.qty || 0), 0);
  const totalPlanPallets = planLines.reduce((s, l) => s + linePallets(l), 0);

  // 自动生成计划编号：PL + 日期 + 3 位序号
  const suggestPlanNo = () => {
    const base = 'PL' + formatters.dbDate().replace(/-/g, '');
    const existing = new Set(DBService.getOrders().map(o => o.order_no));
    let n = 1;
    while (existing.has(base + String(n).padStart(3, '0'))) n++;
    return base + String(n).padStart(3, '0');
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!orderNo.trim()) {
      setErrorMsg('请输入计划编号！');
      return;
    }
    for (let i = 0; i < planLines.length; i++) {
      const l = planLines[i];
      if (!l.title && !l.sku) {
        setErrorMsg(`第 ${i + 1} 行请选择 SKU！`);
        return;
      }
      if (!l.qty || l.qty <= 0) {
        setErrorMsg(`第 ${i + 1} 行实际数量必须大于 0！`);
        return;
      }
      if (!l.maxPerPallet || l.maxPerPallet <= 0) {
        setErrorMsg(`第 ${i + 1} 行最大卡板容量必须大于 0！`);
        return;
      }
    }
    if (totalPlanPallets > 2000) {
      setErrorMsg(`计划划分的卡位数量(${totalPlanPallets}托)超过系统单次处理上限(2000托)，请分批建单或增大单托容量！`);
      return;
    }
    if (totalPlanQty > 10000000) {
      setErrorMsg('计划总数量不能超过 10,000,000 Pcs，请确认数值是否正确！');
      return;
    }

    try {
      if (receivingPoNo) {
        DBService.receivePurchaseOrderAsPlan(receivingPoNo, orderNo.trim(), planLines);
        setSuccessMsg(`采购单 ${receivingPoNo} 已确认收货，入库计划 ${orderNo.trim()} 已创建并保留在列表中，可继续分配/上架。`);
      } else if (editingOrderId) {
        DBService.updateOrder(editingOrderId, orderNo.trim(), planLines);
      } else {
        DBService.addOrder(orderNo.trim(), planLines);
      }
      // Reset & refresh
      setOrderNo('');
      setPlanLines([emptyLine()]);
      setIsCreateOpen(false);
      setEditingOrderId(null);
      setReceivingPoNo(null);
      refreshData();
    } catch (e: any) {
      setErrorMsg(e.message || '创建入库计划失败！');
    }
  };

  type OrderMetric = typeof orders[number];

  // 采购单已付款/途中/待收货 → 每张采购单合并为一行「待收货建卡板」计划（1 计划 = N 个 SKU）
  const poPlanRows = useMemo(() => {
    const skuList = DBService.getProductSkus();
    const groups = new Map<string, ReturnType<typeof DBService.getPurchasePlanRows>>();
    DBService.getPurchasePlanRows().forEach(r => {
      if (!groups.has(r.poNo)) groups.set(r.poNo, []);
      groups.get(r.poNo)!.push(r);
    });

    const rows: OrderMetric[] = [];
    groups.forEach((items, poNo) => {
      const totalQty = items.reduce((s, r) => s + r.need, 0);
      const totalPallets = items.reduce((s, r) => s + r.palletCount, 0);
      const stockQty = items.reduce((s, r) => {
        const sku = skuList.find(x => x.sku === r.sku);
        return s + (sku ? sku.stock : 0);
      }, 0);
      rows.push({
        id: `po-plan-${poNo}`,
        order_no: poNo,
        customer_code: items[0].supplierName || items[0].supplierId,
        model: `${items.length} 个SKU`,
        order_qty: totalQty,
        per_pallet: items[0].perPallet,
        pallet_count: totalPallets,
        status: 'pending_receipt',
        created_at: items[0].createdAt,
        inbound_qty: 0,
        shortage_qty: totalQty,
        outbound_qty: 0,
        stock_qty: stockQty,
        turnover_days: 0
      } as OrderMetric);
    });
    return rows;
  }, [pos]);

  // Filter list（包含采购单待建卡板行）
  const allRows = useMemo(() => [...poPlanRows, ...orders], [poPlanRows, orders]);
  const filteredRows = allRows.filter(o => {
    const matchesSearch = o.order_no.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          o.customer_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModel = modelFilter === '' || o.model === modelFilter;
    const matchesStatus = statusFilter === '' || o.status === statusFilter;
    return matchesSearch && matchesModel && matchesStatus;
  });

  const getStatusBadge = (status: Order['status']) => {
    const badges = {
      pending: 'bg-slate-100 text-slate-700 border-slate-200',
      in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
      completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      shortage: 'bg-amber-100 text-amber-700 border-amber-200',
      pending_receipt: 'bg-rose-100 text-rose-700 border-rose-200'
    };

    const names = {
      pending: '排单中',
      in_progress: '出入库中',
      completed: '已完结',
      shortage: '欠库不足',
      pending_receipt: '待收货建卡板'
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badges[status]}`}>
        {names[status]}
      </span>
    );
  };

  const receivingPo = receivingPoNo ? pos.find(p => p.poNo === receivingPoNo) : null;

  return (
    <div id="ordermanager-root" className="space-y-4">
      {/* Page header and action */}
      <div id="orders-header" className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">入库计划汇总表</h2>
          <p className="text-xs text-slate-500 mt-1">
            两种来源同表管理：<b>自建</b>（手动录入，立即按每托拆分卡板需求）与<b>采购</b>（采购单已付款/途中/待收货自动进入，需整单确认收货后才拆卡板）。
          </p>
        </div>
        
        {/* Permission Check for Create (Unlocked) */}
        <button
          id="btn-create-order"
          onClick={() => {
            setIsCreateOpen(true);
            setErrorMsg('');
            setEditingOrderId(null);
            setOrderNo(suggestPlanNo());
            setPlanLines([emptyLine()]);
          }}
          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>新建入库计划</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div id="orders-filters" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search-orders"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索计划号 / 客户编码..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="w-40">
          <select
            id="filter-model"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
          >
            <option value="">全部型号</option>
            {models.map(m => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
          >
            <option value="">全部状态</option>
            <option value="pending">排单中 (Pending)</option>
            <option value="pending_receipt">待收货建卡板</option>
            <option value="shortage">欠库不足 (Shortage)</option>
            <option value="in_progress">出入库中 (In Progress)</option>
            <option value="completed">已完结 (Completed)</option>
          </select>
        </div>
      </div>

      {/* Global feedback */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-medium">
          {successMsg}
        </div>
      )}
      {errorMsg && !isCreateOpen && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Orders Table Container */}
      <div id="orders-table-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table wrapper with relative viewport to support freeze header */}
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            {/* STICKY HEADER (冻结窗格 ySplit=2) */}
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider font-bold z-10">
              <tr>
                <th className="py-3 px-4 w-12 text-center">序号</th>
                <th className="py-3 px-4">客户编码</th>
                <th className="py-3 px-4">订单号</th>
                <th className="py-3 px-4">产品型号</th>
                <th className="py-3 px-4 text-right">订单数量 (Pcs)</th>
                <th className="py-3 px-4 text-right">每卡板数</th>
                <th className="py-3 px-4 text-center">卡位数量 (托)</th>
                <th className="py-3 px-4 text-right">累计入库 (Pcs)</th>
                <th className="py-3 px-4 text-right">欠库数量</th>
                <th className="py-3 px-4 text-right">已出库</th>
                <th className="py-3 px-4 text-right">在库结存</th>
                <th className="py-3 px-4 text-center">周转天数</th>
                <th className="py-3 px-4 text-center">状态</th>
                <th className="py-3 px-4 text-center">卡板明细</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-10 text-center text-slate-400">
                    未查找到符合过滤条件的订单记录。
                  </td>
                </tr>
              ) : (
                filteredRows.map((o, index) => {
                  const isPoPlan = o.status === 'pending_receipt';
                  const isExpanded = expandedOrderId === o.id;
                  const demandRows = isPoPlan ? [] : DBService.getDemands().filter(d => d.order_id === o.id);
                  const purchaseLines = isPoPlan ? DBService.getPurchasePlanRows().filter(r => r.poNo === o.order_no) : [];
                  
                  return (
                    <React.Fragment key={o.id}>
                      <tr className={`hover:bg-slate-50/50 transition-all ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                        {/* A序号 column generates index automatically (A=IF(C="","",ROW()-2)) */}
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-500">{o.customer_code}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{o.order_no}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(isPoPlan || o.source === 'purchase') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                              {(isPoPlan || o.source === 'purchase') ? '采购' : '自建'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">{o.model}</td>
                        <td className="py-3 px-4 text-right font-semibold font-mono">{formatters.number(o.order_qty)}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">{formatters.number(o.per_pallet)}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-indigo-600">{formatters.number(o.pallet_count)}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">{formatters.number(o.inbound_qty)}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-rose-500">
                          {o.shortage_qty > 0 ? formatters.number(o.shortage_qty) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-600">{formatters.number(o.outbound_qty)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">{formatters.number(o.stock_qty)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {o.stock_qty > 0 ? `${o.turnover_days}天` : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(o.status)}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isPoPlan && (
                              <button
                                onClick={() => handleBuildPallets(o.order_no)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                                title={`按采购单 ${o.order_no} 整单确认收货并创建入库计划`}
                              >
                                确认收货 → 建入库计划
                              </button>
                            )}
                            {!isPoPlan && o.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleEditClick(o)}
                                  className="p-1 hover:bg-indigo-50 rounded text-slate-400 hover:text-indigo-600 transition-all"
                                  title="修改排单中计划"
                                >
                                  <Edit2 size={14} />
                                </button>
                                {o.source !== 'purchase' && (
                                  <button
                                    onClick={() => handleDeleteClick(o)}
                                    className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all"
                                    title="删除排单中计划"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              id={`btn-toggle-expand-${o.order_no}`}
                              onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-all"
                              title={isPoPlan ? '展开采购单 SKU 明细' : '展开卡位需求及分配明细'}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Collapsible Child rows for generated Position Demands */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={14} className="bg-slate-50/50 p-4">
                            {isPoPlan ? (
                              <div className="border border-slate-100 rounded-lg bg-white p-3 shadow-inner">
                                <h4 className="text-[11px] font-bold uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                                  <Layers size={12} className="text-slate-500" />
                                  采购单 {o.order_no} 待建卡板 SKU 明细 — 共 {purchaseLines.length} 个 SKU / {o.pallet_count} 个卡板
                                </h4>
                                <table className="w-full text-xs border-collapse">
                                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                                    <tr>
                                      <th className="py-1.5 px-2 text-left">SKU</th>
                                      <th className="py-1.5 px-2 text-left">品名</th>
                                      <th className="py-1.5 px-2 text-right">最大卡板容量</th>
                                      <th className="py-1.5 px-2 text-right">实际数量</th>
                                      <th className="py-1.5 px-2 text-center">卡位</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {purchaseLines.map(r => (
                                      <tr key={r.id}>
                                        <td className="py-1.5 px-2 font-mono font-bold text-indigo-600">{r.sku}</td>
                                        <td className="py-1.5 px-2">{r.model}</td>
                                        <td className="py-1.5 px-2 text-right font-mono">{formatters.number(r.perPallet)}</td>
                                        <td className="py-1.5 px-2 text-right font-mono">{formatters.number(r.need)}</td>
                                        <td className="py-1.5 px-2 text-center font-mono font-bold text-indigo-600">{r.palletCount}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                            <div className="border border-slate-100 rounded-lg bg-white p-3 shadow-inner">
                              <h4 className="text-[11px] font-bold uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                                <Layers size={12} className="text-slate-500" />
                                计划 {o.order_no} ({o.model}) 储位托盘派生需求树 — 系统共划分 {o.pallet_count} 个卡位卡板
                              </h4>
                              <div className="grid grid-cols-4 gap-3">
                                {demandRows.map(d => {
                                  const linkedInb = d.inbound_id ? DBService.getInbounds().find(i => i.id === d.inbound_id) : null;
                                  const inStock = linkedInb ? DBService.getPositionStock(linkedInb.id) : 0;

                                  return (
                                    <div
                                      id={`demand-card-${o.order_no}-${d.seq}`}
                                      key={d.id}
                                      className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                                        d.position_code
                                          ? inStock > 0
                                            ? 'bg-emerald-50/30 border-emerald-100 text-emerald-900'
                                            : 'bg-slate-50 border-slate-200 text-slate-400'
                                          : 'bg-amber-50/20 border-amber-100 text-amber-800'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between font-semibold border-b border-dashed border-slate-100 pb-1 mb-1">
                                        <span>卡板序号 #{d.seq}</span>
                                        {d.position_code ? (
                                          <span className="font-mono bg-emerald-100 text-emerald-800 border border-emerald-200 px-1 py-0.2 rounded text-[10px]">
                                            {d.position_code}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-amber-600 bg-amber-100 px-1 py-0.2 rounded">
                                            未入库分配
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 mb-1 truncate" title={d.product || d.model}>
                                        {d.product || d.model} · 计划 {formatters.number(d.planned_qty || 0)} Pcs
                                      </div>
                                      <div className="space-y-1 text-[11px] mt-1 text-slate-500">
                                        {linkedInb ? (
                                          <>
                                            <p className="flex justify-between">
                                              <span>实际入库：</span>
                                              <span className="font-mono text-slate-700">{formatters.number(linkedInb.actual_qty)} Pcs</span>
                                            </p>
                                            <p className="flex justify-between">
                                              <span>品质：</span>
                                              <span className="font-medium text-slate-700">{linkedInb.quality}</span>
                                            </p>
                                            <p className="flex justify-between font-semibold">
                                              <span>在库剩余：</span>
                                              <span className={`font-mono ${inStock > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                {formatters.number(inStock)} Pcs
                                              </span>
                                            </p>
                                          </>
                                        ) : (
                                          <p className="text-slate-400 italic">待入库组录入实际库位、检验通过后即可确认定位。</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ORDER DRAWER/MODAL */}
      {isCreateOpen && (
        <div id="create-order-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div id="create-order-dialog" className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-xl overflow-hidden transform transition-all">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <Package size={16} />
                </div>
                <h3 className="font-bold text-sm text-slate-800">
                  {editingOrderId ? '修改入库计划' : receivingPoNo ? '确认收货 · 创建入库计划' : '新建入库计划'}
                </h3>
              </div>
              <button
                id="btn-close-create"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingOrderId(null);
                  setReceivingPoNo(null);
                  setOrderNo('');
                  setPlanLines([emptyLine()]);
                }}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              {receivingPoNo && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed">
                  来源采购单 <b className="font-mono">{receivingPoNo}</b>
                  {receivingPo && <> · 供应商 {receivingPo.supplierName}</>}。
                  已预填该采购单的 SKU 与数量，请确认或调整每个 SKU 的<b>最大卡板容量</b>与<b>实际数量</b>后创建入库计划（计划创建后保留在列表，可继续分配上架）。
                </div>
              )}

              {/* Order Number */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">计划编号 (唯一索引)</label>
                <div className="flex gap-2">
                  <input
                    id="input-order-no"
                    type="text"
                    required
                    placeholder="例如: PL20260914001"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setOrderNo(suggestPlanNo())}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 cursor-pointer shrink-0"
                  >
                    自动生成
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">可自动生成或手动填写；系统截取前 4 位作为客户编码。</p>
              </div>

              {/* SKU Lines */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">SKU 行（1-多个 SKU）</label>
                  <button
                    type="button"
                    onClick={addPlanLine}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold cursor-pointer"
                  >
                    ＋ 添加 SKU 行
                  </button>
                </div>
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {planLines.map((l, idx) => (
                    <div key={idx} className="p-2 bg-slate-50/70 border border-slate-100 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <select
                          value={l.sku}
                          onChange={(e) => handleLineSkuChange(idx, e.target.value)}
                          className="flex-1 border border-slate-200 rounded-lg py-1 px-2 text-xs focus:outline-none"
                        >
                          <option value="">-- 选择 SKU --</option>
                          {skus.map(s => <option key={s.sku} value={s.sku}>{s.sku} · {s.title}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => removePlanLine(idx)}
                          disabled={planLines.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded disabled:opacity-30 cursor-pointer"
                          title="删除该行"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">最大卡板容量</label>
                          <input
                            type="number" min={1} value={l.maxPerPallet}
                            onChange={(e) => updatePlanLine(idx, { maxPerPallet: Number(e.target.value) })}
                            className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">实际数量</label>
                          <input
                            type="number" min={1} value={l.qty}
                            onChange={(e) => updatePlanLine(idx, { qty: Number(e.target.value) })}
                            className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono focus:outline-none"
                          />
                        </div>
                        <div className="text-[11px] text-right pb-1">
                          <span className="text-slate-400">卡位 </span>
                          <span className="font-bold text-indigo-600">{linePallets(l)}</span>
                          <span className="text-slate-400"> 托</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-500">合计（{planLines.length} 个 SKU）：</span>
                <span className="font-bold text-indigo-600">{totalPlanQty} Pcs / {totalPlanPallets} 托</span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-cancel-create"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingOrderId(null);
                    setReceivingPoNo(null);
                    setOrderNo('');
                    setPlanLines([emptyLine()]);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  id="btn-submit-order"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
                >
                  {editingOrderId ? '保存修改' : receivingPoNo ? '确认收货并创建计划' : '确认排单'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog for Deletion */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5">
              <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
                <Trash2 className="text-rose-500" size={20} />
                确认删除排单？
              </h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                确定要删除处于排单中状态的订单 <strong className="text-slate-700">{orderToDelete.order_no}</strong> 及其分割的托盘数据吗？此操作不可逆。
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setOrderToDelete(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
