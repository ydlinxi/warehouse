/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { DBService, formatters } from '../db';
import { Order, ProductModel, ProductSku, PurchaseOrder, InboundPlanLine } from '../types';
import { OrderFilterBar } from './order/OrderFilterBar';
import { OrdersTable } from './order/OrdersTable';
import { OrderCreateModal } from './order/OrderCreateModal';
import { DeleteOrderModal } from './order/DeleteOrderModal';

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

  // Expandable Row State：支持**同时展开多条**（点一个展开一个、点多个展开多个，非手风琴）
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

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
    } catch (err) {
      setErrorMsg((err as Error).message || '删除订单失败！');
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
    } catch (e) {
      setErrorMsg((e as Error).message || '创建入库计划失败！');
    }
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setEditingOrderId(null);
    setReceivingPoNo(null);
    setOrderNo('');
    setPlanLines([emptyLine()]);
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

  const receivingPo = receivingPoNo ? (pos.find(p => p.poNo === receivingPoNo) ?? null) : null;

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
      <OrderFilterBar
        searchQuery={searchQuery}
        modelFilter={modelFilter}
        statusFilter={statusFilter}
        models={models}
        onSearchChange={setSearchQuery}
        onModelChange={setModelFilter}
        onStatusChange={setStatusFilter}
      />

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
      <OrdersTable
        rows={filteredRows}
        expandedOrderIds={expandedOrderIds}
        onToggleExpand={(id) => setExpandedOrderIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        })}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onBuildPallets={handleBuildPallets}
      />

      {/* CREATE ORDER DRAWER/MODAL */}
      {isCreateOpen && (
        <OrderCreateModal
          editingOrderId={editingOrderId}
          receivingPoNo={receivingPoNo}
          receivingPo={receivingPo}
          orderNo={orderNo}
          planLines={planLines}
          skus={skus}
          errorMsg={errorMsg}
          linePallets={linePallets}
          totalPlanQty={totalPlanQty}
          totalPlanPallets={totalPlanPallets}
          onClose={closeCreateModal}
          onSubmit={handleCreateOrder}
          onSuggestOrderNo={() => setOrderNo(suggestPlanNo())}
          onOrderNoChange={setOrderNo}
          onAddLine={addPlanLine}
          onRemoveLine={removePlanLine}
          onUpdateLine={updatePlanLine}
          onSkuChange={handleLineSkuChange}
        />
      )}

      {/* Custom Confirm Dialog for Deletion */}
      {orderToDelete && (
        <DeleteOrderModal
          target={orderToDelete}
          onConfirm={confirmDelete}
          onClose={() => setOrderToDelete(null)}
        />
      )}
    </div>
  );
};
