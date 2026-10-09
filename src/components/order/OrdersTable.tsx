/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 入库计划汇总表（P2-4b 区块拆分自 OrderManager）：主表 + 可展开卡板需求/采购明细。
import React from 'react';
import { Edit2, Trash2, ChevronUp, ChevronDown, Layers } from 'lucide-react';
import { DBService, formatters } from '../../db';

// 行类型 = getOrdersWithMetrics() 的元素（含 shortage_qty/stock_qty/turnover_days 等派生指标）
type OrderRow = ReturnType<typeof DBService.getOrdersWithMetrics>[number];

interface Props {
  rows: OrderRow[];
  expandedOrderIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (order: OrderRow) => void;
  onDelete: (order: OrderRow) => void;
  onBuildPallets: (poNo: string) => void;
}

const getStatusBadge = (status: OrderRow['status']) => {
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

export const OrdersTable: React.FC<Props> = ({
  rows, expandedOrderIds, onToggleExpand, onEdit, onDelete, onBuildPallets
}) => {
  return (
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-slate-400">
                  未查找到符合过滤条件的订单记录。
                </td>
              </tr>
            ) : (
              rows.map((o, index) => {
                const isPoPlan = o.status === 'pending_receipt';
                const isExpanded = expandedOrderIds.has(o.id);
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
                              onClick={() => onBuildPallets(o.order_no)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                              title={`按采购单 ${o.order_no} 整单确认收货并创建入库计划`}
                            >
                              确认收货 → 建入库计划
                            </button>
                          )}
                          {!isPoPlan && o.status === 'pending' && (
                            <>
                              <button
                                onClick={() => onEdit(o)}
                                className="p-1 hover:bg-indigo-50 rounded text-slate-400 hover:text-indigo-600 transition-all"
                                title="修改排单中计划"
                              >
                                <Edit2 size={14} />
                              </button>
                              {o.source !== 'purchase' && (
                                <button
                                  onClick={() => onDelete(o)}
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
                            onClick={() => onToggleExpand(o.id)}
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
  );
};
