/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
import { Order, ProductModel } from '../types';

interface OrderManagerProps {}

export const OrderManager: React.FC<OrderManagerProps> = () => {
  const [orders, setOrders] = useState(() => DBService.getOrdersWithMetrics());
  const [models] = useState<ProductModel[]>(() => DBService.getModels());
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [orderNo, setOrderNo] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [orderQty, setOrderQty] = useState<number | ''>('');
  const [perPallet, setPerPallet] = useState<number | ''>('');
  const [errorMsg, setErrorMsg] = useState('');

  // Expandable Row State
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Edit State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Delete Confirmation State
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const refreshData = () => {
    setOrders(DBService.getOrdersWithMetrics());
  };

  const handleEditClick = (order: Order) => {
    setEditingOrderId(order.id);
    setOrderNo(order.order_no);
    setSelectedModel(order.model);
    setOrderQty(order.order_qty);
    setPerPallet(order.per_pallet);
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

  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName);
    const model = models.find(m => m.name === modelName);
    if (model) {
      setPerPallet(model.default_per_pallet);
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!orderNo.trim()) {
      setErrorMsg('请输入订单号！');
      return;
    }
    if (!selectedModel) {
      setErrorMsg('请选择产品型号！');
      return;
    }
    if (!orderQty || orderQty <= 0) {
      setErrorMsg('订单数量必须大于 0！');
      return;
    }
    if (!perPallet || perPallet <= 0) {
      setErrorMsg('每卡板数量必须大于 0！');
      return;
    }

    const calculatedPallets = Math.ceil(Number(orderQty) / Number(perPallet));
    if (calculatedPallets > 2000) {
      setErrorMsg(`订单划分的卡位数量(${calculatedPallets}托)超过系统单次处理上限(2000托)，请分批建单或增加单托数量！`);
      return;
    }

    if (Number(orderQty) > 10000000) {
      setErrorMsg(`订单总数量不能超过 10,000,000 Pcs，请确认数值是否正确！`);
      return;
    }

    try {
      if (editingOrderId) {
        DBService.updateOrder(editingOrderId, orderNo.trim(), selectedModel, Number(orderQty), Number(perPallet));
      } else {
        DBService.addOrder(orderNo.trim(), selectedModel, Number(orderQty), Number(perPallet));
      }
      // Reset & refresh
      setOrderNo('');
      setSelectedModel('');
      setOrderQty('');
      setPerPallet('');
      setIsCreateOpen(false);
      setEditingOrderId(null);
      refreshData();
    } catch (e: any) {
      setErrorMsg(e.message || '创建订单失败！');
    }
  };

  // Filter list
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_no.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          o.customer_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModel = modelFilter === '' || o.model === modelFilter;
    const matchesStatus = statusFilter === '' || o.status === statusFilter;
    return matchesSearch && matchesModel && matchesStatus;
  });

  const getStatusBadge = (status: Order['status']) => {
    const badges = {
      pending: 'bg-slate-100 text-slate-700 border-slate-200',
      in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
      completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      shortage: 'bg-amber-100 text-amber-700 border-amber-200'
    };

    const names = {
      pending: '排单中',
      in_progress: '出入库中',
      completed: '已完结',
      shortage: '欠库不足'
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badges[status]}`}>
        {names[status]}
      </span>
    );
  };

  // Dynamic values inside the form as user types
  const calculatedPallets = orderQty && perPallet ? Math.ceil(Number(orderQty) / Number(perPallet)) : 0;

  return (
    <div id="ordermanager-root" className="space-y-4">
      {/* Page header and action */}
      <div id="orders-header" className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">订单情况汇总表</h2>
          <p className="text-xs text-slate-500 mt-1">录入销售合同订单、每托盘额定数量，系统自动分割储位卡板需求。</p>
        </div>
        
        {/* Permission Check for Create (Unlocked) */}
        <button
          id="btn-create-order"
          onClick={() => {
            setIsCreateOpen(true);
            setErrorMsg('');
          }}
          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>新建销售订单</span>
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
            placeholder="搜索订单号 / 客户编码..."
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
            <option value="shortage">欠库不足 (Shortage)</option>
            <option value="in_progress">出入库中 (In Progress)</option>
            <option value="completed">已完结 (Completed)</option>
          </select>
        </div>
      </div>

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
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-10 text-center text-slate-400">
                    未查找到符合过滤条件的订单记录。
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o, index) => {
                  const isExpanded = expandedOrderId === o.id;
                  const demandRows = DBService.getDemands().filter(d => d.order_id === o.id);
                  
                  return (
                    <React.Fragment key={o.id}>
                      <tr className={`hover:bg-slate-50/50 transition-all ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                        {/* A序号 column generates index automatically (A=IF(C="","",ROW()-2)) */}
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-500">{o.customer_code}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{o.order_no}</td>
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
                            {o.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleEditClick(o)}
                                  className="p-1 hover:bg-indigo-50 rounded text-slate-400 hover:text-indigo-600 transition-all"
                                  title="修改排单中订单"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(o)}
                                  className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-all"
                                  title="删除排单中订单"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                            <button
                              id={`btn-toggle-expand-${o.order_no}`}
                              onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-all"
                              title="展开卡位需求及分配明细"
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
                            <div className="border border-slate-100 rounded-lg bg-white p-3 shadow-inner">
                              <h4 className="text-[11px] font-bold uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                                <Layers size={12} className="text-slate-500" />
                                订单 {o.order_no} ({o.model}) 储位托盘派生需求树 — 系统共划分 {o.pallet_count} 个卡位卡板
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
          <div id="create-order-dialog" className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <Package size={16} />
                </div>
                <h3 className="font-bold text-sm text-slate-800">
                  {editingOrderId ? '修改销售合同订单' : '新建销售合同订单'}
                </h3>
              </div>
              <button
                id="btn-close-create"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingOrderId(null);
                  setOrderNo('');
                  setSelectedModel('');
                  setOrderQty('');
                  setPerPallet('');
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

              {/* Order Number */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">订单编码 (唯一索引)</label>
                <input
                  id="input-order-no"
                  type="text"
                  required
                  placeholder="例如: PO20260801"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">系统将自动截取前4位作为客户编码进行落库</p>
              </div>

              {/* Model Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">产品型号</label>
                <select
                  id="select-order-model"
                  required
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- 请选择成品型号 --</option>
                  {models.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Row: Order Qty & Per Pallet */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">订单总数量 (Pcs)</label>
                  <input
                    id="input-order-qty"
                    type="number"
                    min="1"
                    required
                    placeholder="输入箱数/件数"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">每卡板额定容量</label>
                  <input
                    id="input-per-pallet"
                    type="number"
                    min="1"
                    required
                    placeholder="托盘容量"
                    value={perPallet}
                    onChange={(e) => setPerPallet(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Dynamic Pallet Ceiling Indicator */}
              {calculatedPallets > 0 && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-500">分割计算托盘卡位：</span>
                  <span className="font-bold text-indigo-600">
                    {calculatedPallets} 卡位 (CEILING)
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-cancel-create"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingOrderId(null);
                    setOrderNo('');
                    setSelectedModel('');
                    setOrderQty('');
                    setPerPallet('');
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
                  {editingOrderId ? '保存修改' : '确认排单'}
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
