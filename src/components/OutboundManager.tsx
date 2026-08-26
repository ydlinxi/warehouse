/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  PackageMinus,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  User,
  Barcode,
  Search,
  Layers,
  Calendar
} from 'lucide-react';
import { DBService, formatters } from '../db';
import { Inbound, Outbound } from '../types';

interface OutboundManagerProps {}

export const OutboundManager: React.FC<OutboundManagerProps> = () => {
  const [inbounds, setInbounds] = useState<Inbound[]>(() => DBService.getInbounds());
  const [outbounds, setOutbounds] = useState<Outbound[]>(() => DBService.getOutbounds());
  const [selectedInboundId, setSelectedInboundId] = useState<string | null>(null);

  // Form Fields
  const [outboundDate, setOutboundDate] = useState('');
  const [outboundQty, setOutboundQty] = useState<number | ''>('');
  const [selectedHandler, setSelectedHandler] = useState('');
  const [note, setNote] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Local state for searching outbound history logs
  const [historyQuery, setHistoryQuery] = useState('');

  // Config lists
  const [handlers] = useState(() => DBService.getHandlers());

  const refreshData = () => {
    setInbounds(DBService.getInbounds());
    setOutbounds(DBService.getOutbounds());
  };

  // Filter inbounds that still have stock remaining
  const activeStockInbounds = inbounds.map(inb => {
    const stock = DBService.getPositionStock(inb.id);
    return { ...inb, stock };
  }).filter(inb => {
    const hasStock = inb.stock > 0;
    const matchesSearch = inb.order_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inb.position_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inb.model.toLowerCase().includes(searchQuery.toLowerCase());
    return hasStock && matchesSearch;
  });

  // Filter outbounds list by search criteria
  const filteredOutbounds = outbounds.filter(o => {
    const query = historyQuery.toLowerCase();
    return o.order_no.toLowerCase().includes(query) ||
           o.model.toLowerCase().includes(query) ||
           o.position_code.toLowerCase().includes(query) ||
           o.handler.toLowerCase().includes(query) ||
           (o.note && o.note.toLowerCase().includes(query));
  });

  const handleSelectInbound = (inb: typeof activeStockInbounds[0]) => {
    setSelectedInboundId(inb.id);
    setSuccessMsg('');
    setErrorMsg('');

    // Pre-fill fields
    setOutboundQty(inb.stock); // Default to empty the full pallet
    setOutboundDate(formatters.dbDate()); // Auto Today's date
    setSelectedHandler(handlers[0] || '');
    setNote('');
  };

  const handleSubmitOutbound = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!selectedInboundId) {
      setErrorMsg('请选择一个要出货的仓位托盘！');
      return;
    }
    if (!outboundQty || outboundQty <= 0) {
      setErrorMsg('出库数量必须大于 0！');
      return;
    }

    const targetInb = activeStockInbounds.find(i => i.id === selectedInboundId);
    if (!targetInb) {
      setErrorMsg('找不到对应的入库货架信息！');
      return;
    }

    if (outboundQty > targetInb.stock) {
      setErrorMsg(`出库数量 (${outboundQty}) 超出了该卡板结存结余 (${targetInb.stock} Pcs)！`);
      return;
    }
    if (!selectedHandler) {
      setErrorMsg('请选择经办人！');
      return;
    }

    try {
      DBService.recordOutbound(
        selectedInboundId,
        outboundDate,
        Number(outboundQty),
        selectedHandler,
        note
      );

      setSuccessMsg(`出库登记成功！已从 [${targetInb.position_code}] 仓位核减出库数量 ${outboundQty} Pcs`);
      setSelectedInboundId(null);
      setNote('');
      refreshData();
    } catch (e: any) {
      setErrorMsg(e.message || '出库发货登记失败！');
    }
  };

  const selectedInbound = inbounds.find(i => i.id === selectedInboundId);
  const selectedInboundStock = selectedInbound ? DBService.getPositionStock(selectedInbound.id) : 0;

  return (
    <div id="outboundmanager-root" className="space-y-4">
      {/* Header Banner */}
      <div id="outbound-header" className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">成品出库发货管理</h2>
          <p className="text-xs text-slate-500 mt-1">选定当前存放架上有结余的成品托盘及订单号，登记出库去向和数量，实现库存自动扣减与安全释放。</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Left column: list of active in-stock entries */}
        <div className="col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[540px]">
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-600" />
              在库托盘库存树 ({activeStockInbounds.length})
            </h3>
            <div className="relative w-48">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="search-active-stock"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索订单/型号/仓位..."
                className="w-full pl-7 pr-3 py-1 bg-white border border-slate-200 rounded-md text-[11px] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {activeStockInbounds.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <TrendingDown size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs">暂无在库的成品储位。</p>
                <p className="text-[10px] text-slate-400 mt-1">请先完成新订单的 [入库上架定位]。</p>
              </div>
            ) : (
              activeStockInbounds.map((inb, index) => {
                const isSelected = inb.id === selectedInboundId;
                const qualityColor = inb.quality === 'OQC验Pass' ? 'text-emerald-600 bg-emerald-50' : 
                                     inb.quality === '待复检' ? 'text-indigo-600 bg-indigo-50' : 'text-rose-600 bg-rose-50';

                return (
                  <div
                    id={`stock-row-${inb.order_no}-${inb.position_code}`}
                    key={inb.id}
                    onClick={() => handleSelectInbound(inb)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-all ${
                      isSelected ? 'bg-amber-50/50 border-l-4 border-amber-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] text-slate-400">#{index + 1}</span>
                        <span className="font-bold text-slate-800 font-mono text-xs">{inb.order_no}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {inb.model}
                        </span>
                        <span className={`text-[9px] px-1 rounded font-bold ${qualityColor}`}>
                          {inb.quality}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <span>卡板储位: <b className="text-slate-800 font-mono">{inb.position_code}</b></span>
                        <span>&bull;</span>
                        <span>入库日期: <b className="text-slate-600">{formatters.date(inb.inbound_date)}</b></span>
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-800 font-mono block">
                        {formatters.number(inb.stock)} Pcs
                      </span>
                      <span className="text-[9px] text-slate-400">满卡板: {formatters.number(inb.actual_qty)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: detailed form input */}
        <div className="col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 h-[540px] flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5 border-b border-slate-50 pb-2 mb-3">
              <PackageMinus size={13} className="text-amber-600" />
              出库发货工作台 (Outbound Workspace)
            </h3>

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs font-semibold flex items-start gap-1.5">
                <CheckCircle size={14} className="shrink-0 text-emerald-500 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs font-semibold flex items-start gap-1.5">
                <AlertCircle size={14} className="shrink-0 text-rose-500 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {selectedInbound ? (
              <form id="outbound-form" onSubmit={handleSubmitOutbound} className="space-y-4">
                {/* Active Selection summary banner */}
                <div className="p-3 bg-amber-50/30 rounded-lg border border-amber-100 text-xs space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>选定货柜: {selectedInbound.position_code}</span>
                    <span className="text-amber-700">订单 {selectedInbound.order_no}</span>
                  </div>
                  <div className="text-slate-500 flex justify-between font-mono">
                    <span>产品型号: {selectedInbound.model}</span>
                    <span className="font-bold text-indigo-600">在库结存: {formatters.number(selectedInboundStock)} Pcs</span>
                  </div>
                </div>



                {/* Outbound Qty - with validations */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    实际出库数量 (Pcs) — 自动校验上限
                  </label>
                  <input
                    id="input-outbound-qty"
                    type="number"
                    min="1"
                    max={selectedInboundStock}
                    required
                    placeholder={`最大可出 ${selectedInboundStock} Pcs`}
                    value={outboundQty}
                    onChange={(e) => setOutboundQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">系统硬性校验: 出库数量不得超过当前仓位实际结存。</p>
                </div>

                {/* Outbound Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <Calendar size={12} className="text-amber-500" />
                    出库发货日期
                  </label>
                  <input
                    id="input-outbound-date"
                    type="date"
                    required
                    value={outboundDate}
                    onChange={(e) => setOutboundDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg py-1 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Handler */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <User size={12} className="text-amber-500" />
                    发货经办人
                  </label>
                  <select
                    id="select-outbound-handler"
                    required
                    value={selectedHandler}
                    onChange={(e) => setSelectedHandler(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                  >
                    {handlers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">发货备注</label>
                  <textarea
                    id="input-outbound-note"
                    rows={3}
                    placeholder="请输入发货柜号、封条号、物流商、目的地等核实信息。"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg py-1 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-50 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    id="btn-cancel-outbound"
                    onClick={() => setSelectedInboundId(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    重置
                  </button>
                  <button
                    type="submit"
                    id="btn-confirm-outbound"
                    className="px-5 py-2 rounded-lg text-xs font-semibold shadow flex items-center space-x-1 cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <PackageMinus size={13} />
                    <span>确认出架发货</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20">
                <Layers size={32} className="text-slate-300 mb-2" />
                <p className="text-xs text-center px-4">
                  请先在左侧列表中点击选择一个<b>有结存的在库成品托盘</b>，以便在此启动出货发货手续。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Outbound history detailed logs */}
      <div id="outbound-history-card" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingDown size={14} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">历史出库发货明细流水记录 ({filteredOutbounds.length})</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">完整记录成品出库去向，提供完整的发货批次追踪与对账基础。</p>
            </div>
          </div>
          <div className="relative w-64">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-outbound-history"
              type="text"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="搜索订单/型号/仓位/经办人..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="py-3 px-4">序号</th>
                <th className="py-3 px-4">出库日期</th>
                <th className="py-3 px-4">关联成品订单号</th>
                <th className="py-3 px-4">产品型号</th>
                <th className="py-3 px-4">出库下架仓位</th>
                <th className="py-3 px-4 text-right">出库实发数量</th>
                <th className="py-3 px-4">出库作业人</th>
                <th className="py-3 px-4">出货备注说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {filteredOutbounds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    暂无历史出库明细数据
                  </td>
                </tr>
              ) : (
                filteredOutbounds.map((o, idx) => (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-400 text-[10px]">#{idx + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-600">{formatters.date(o.outbound_date)}</td>
                    <td className="py-2.5 px-4 font-bold font-mono text-indigo-600">{o.order_no}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold text-[10px]">{o.model}</span>
                    </td>
                    <td className="py-2.5 px-4 font-bold font-mono text-amber-700">{o.position_code}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{formatters.number(o.outbound_qty)} Pcs</td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium">{o.handler}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] max-w-xs truncate" title={o.note || '无'}>
                      {o.note || <span className="text-slate-300 italic">无</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
