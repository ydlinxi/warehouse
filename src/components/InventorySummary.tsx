/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Download,
  Filter,
  Eye,
  X,
  FileText,
  ChevronRight
} from 'lucide-react';
import { DBService, formatters } from '../db';
import { InventoryMonthRecord, Inbound, Outbound } from '../types';

export const InventorySummary: React.FC = () => {
  const currentYear = 2026;
  const currentMonth = 8;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');

  // Drilldown Modal State
  const [drilldownRecord, setDrilldownRecord] = useState<InventoryMonthRecord | null>(null);

  // Load records
  const rawRecords = DBService.getMonthlyInventory(selectedYear, selectedMonth);

  // Filtered records
  const filteredRecords = rawRecords.filter(r => {
    const matchesSearch = r.order_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.position_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModel = modelFilter === '' || r.model === modelFilter;
    const matchesQuality = qualityFilter === '' || r.quality === qualityFilter;
    return matchesSearch && matchesModel && matchesQuality;
  });

  // Calculate Column Totals
  const totalOpening = filteredRecords.reduce((sum, r) => sum + r.opening, 0);
  const totalInbound = filteredRecords.reduce((sum, r) => sum + r.inbound, 0);
  const totalOutbound = filteredRecords.reduce((sum, r) => sum + r.outbound, 0);
  const totalClosing = filteredRecords.reduce((sum, r) => sum + r.closing, 0);

  // Product models for dropdown filter
  const models = DBService.getModels();

  // Export to CSV Function
  const handleExportCSV = () => {
    const title = `${selectedYear}年${selectedMonth}月成品进销存总表`;
    
    // Headers list
    const headers = ['序号', '客户编码', '订单号', '产品型号', '仓位码', '期初库存 (Pcs)', '本期入库 (Pcs)', '本期出库 (Pcs)', '期末结存 (Pcs)', '品质检验'];
    
    const rows = filteredRecords.map((r, index) => {
      const customerCode = r.order_no.slice(0, 4);
      return [
        index + 1,
        customerCode,
        r.order_no,
        r.model,
        r.position_code,
        r.opening,
        r.inbound,
        r.outbound,
        r.closing,
        r.quality
      ];
    });

    const csvContent = [
      [title],
      [],
      headers,
      ...rows,
      [],
      ['合计', '', '', '', '', totalOpening, totalInbound, totalOutbound, totalClosing, '']
    ].map(e => e.map(val => {
      // Escape commas and double quotes for safety
      if (typeof val === 'string') {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')).join('\n');

    // Create download link
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title}_导出版.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drilled transactions for modal
  const getDrilledTransactions = (record: InventoryMonthRecord) => {
    const startOfMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonthDate = new Date(selectedYear, selectedMonth, 1);

    const fullInbounds = DBService.getInbounds().filter(i => 
      i.order_no === record.order_no && 
      i.position_code === record.position_code &&
      new Date(i.inbound_date) >= startOfMonthDate &&
      new Date(i.inbound_date) < endOfMonthDate
    );

    const fullOutbounds = DBService.getOutbounds().filter(o => 
      o.order_no === record.order_no && 
      o.position_code === record.position_code &&
      new Date(o.outbound_date) >= startOfMonthDate &&
      new Date(o.outbound_date) < endOfMonthDate
    );

    return { fullInbounds, fullOutbounds };
  };

  const drilledTrxs = drilldownRecord ? getDrilledTransactions(drilldownRecord) : null;

  return (
    <div id="inventory-summary-root" className="space-y-4">
      {/* Header Panel */}
      <div id="inventory-header" className="flex items-center justify-between">
        <div>
          {/* Dynamic Concatenated Report Title (G1 VBA equivalent) */}
          <h2 id="report-title-label" className="text-xl font-bold text-slate-800">
            {selectedYear}年{selectedMonth}月成品进销存总表
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            按自然月维度自动汇算并冻结快照，展示各储位托盘的期初、本期出入及期末库存结余。
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Month/Year Selectors */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 space-x-1 shadow-sm">
            <select
              id="select-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-0 py-1 px-2.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="2026">2026年</option>
              <option value="2025">2025年</option>
            </select>
            <span className="text-slate-300">|</span>
            <select
              id="select-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-0 py-1 px-2.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <button
            id="btn-export-inventory"
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>导出表格 (Excel/CSV)</span>
          </button>
        </div>
      </div>

      {/* Query Filters */}
      <div id="inventory-filters" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search-inventory"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="筛选订单号 / 仓位码..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="w-40">
          <select
            id="filter-inv-model"
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
            id="filter-inv-quality"
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
          >
            <option value="">全部品质</option>
            <option value="OQC验Pass">OQC验Pass</option>
            <option value="待复检">待复检</option>
            <option value="不合格">不合格</option>
          </select>
        </div>
      </div>

      {/* Dynamic Table with Freeze Header (ySplit=3) */}
      <div id="inventory-table-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider font-bold z-10">
              <tr>
                <th className="py-3 px-4 w-12 text-center">序号</th>
                <th className="py-3 px-4">客户编码</th>
                <th className="py-3 px-4">订单号</th>
                <th className="py-3 px-4">产品型号</th>
                <th className="py-3 px-4">仓位码</th>
                <th className="py-3 px-4 text-right">期初库存 (Pcs)</th>
                <th className="py-3 px-4 text-right">本期入库 (Pcs)</th>
                <th className="py-3 px-4 text-right">本期出库 (Pcs)</th>
                <th className="py-3 px-4 text-right text-indigo-600">期末结存 (Pcs)</th>
                <th className="py-3 px-4 text-center">品质检验</th>
                <th className="py-3 px-4 text-center">多维钻取</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    该统计月份暂无活跃的进销存库存流水。
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, index) => {
                  const customerCode = r.order_no.length >= 4 ? r.order_no.slice(0, 4) : r.order_no;
                  const isPass = r.quality === 'OQC验Pass';

                  return (
                    <tr key={index} className="hover:bg-slate-50/60 transition-all">
                      <td className="py-2.5 px-4 text-center font-mono text-slate-400">{index + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-500">{customerCode}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{r.order_no}</td>
                      <td className="py-2.5 px-4">{r.model}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{r.position_code}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500">{formatters.number(r.opening)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600">{formatters.number(r.inbound)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-600">{formatters.number(r.outbound)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700">{formatters.number(r.closing)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          isPass ? 'bg-emerald-50 text-emerald-600' : 
                          r.quality === '待复检' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {r.quality}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          id={`btn-drill-${r.order_no}-${r.position_code}`}
                          onClick={() => setDrilldownRecord(r)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all"
                          title="查看当月明细对账单"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Sum footer */}
            {filteredRecords.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-900 text-slate-200 text-xs font-bold border-t border-slate-700 z-10">
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-center">期末合并求和合计</td>
                  <td className="py-3 px-4 text-right font-mono">{formatters.number(totalOpening)}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400">{formatters.number(totalInbound)}</td>
                  <td className="py-3 px-4 text-right font-mono text-amber-400">{formatters.number(totalOutbound)}</td>
                  <td className="py-3 px-4 text-right font-mono text-indigo-300">{formatters.number(totalClosing)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* DIMENSION DRILLDOWN MODAL */}
      {drilldownRecord && drilledTrxs && (
        <div id="drilldown-modal-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div id="drilldown-modal-dialog" className="bg-white rounded-xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden transform transition-all">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText size={16} className="text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800">
                  一托一档：{selectedYear}年{selectedMonth}月对账单明细下钻 ({drilldownRecord.position_code})
                </h3>
              </div>
              <button
                id="btn-close-drilldown"
                onClick={() => setDrilldownRecord(null)}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Profile Bar */}
              <div className="grid grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">订单编号:</span>
                  <span className="font-bold text-slate-800 font-mono">{drilldownRecord.order_no}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">产品型号:</span>
                  <span className="font-semibold text-slate-700">{drilldownRecord.model}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">在库品质:</span>
                  <span className="font-semibold text-emerald-600">{drilldownRecord.quality}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">当月结存:</span>
                  <span className="font-bold text-indigo-600 font-mono">{formatters.number(drilldownRecord.closing)} Pcs</span>
                </div>
              </div>

              {/* Transactions grid split */}
              <div className="grid grid-cols-2 gap-4">
                {/* 1. Monthly Inbound History */}
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <div className="p-2 bg-emerald-50 text-emerald-800 border-b border-emerald-100 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>当月入库上架流水</span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded">
                      + {formatters.number(drilldownRecord.inbound)} Pcs
                    </span>
                  </div>
                  <div className="p-2.5 space-y-2 max-h-48 overflow-y-auto text-[11px]">
                    {drilledTrxs.fullInbounds.length === 0 ? (
                      <p className="text-slate-400 italic py-4 text-center">本期无入库操作</p>
                    ) : (
                      drilledTrxs.fullInbounds.map(i => (
                        <div key={i.id} className="p-2 bg-slate-50 rounded border border-slate-100 space-y-1">
                          <div className="flex justify-between text-slate-700 font-semibold">
                            <span>数量: {formatters.number(i.actual_qty)} Pcs</span>
                            <span className="text-slate-400 font-mono">{formatters.date(i.inbound_date)}</span>
                          </div>
                          <div className="text-slate-500 flex justify-between text-[10px]">
                            <span>班组: {i.line}</span>
                            <span>操作人: {i.handler}</span>
                          </div>
                          {i.note && <p className="text-slate-400 italic text-[10px]">备注: {i.note}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Monthly Outbound History */}
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <div className="p-2 bg-amber-50 text-amber-800 border-b border-amber-100 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>当月出库发货流水</span>
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded">
                      - {formatters.number(drilldownRecord.outbound)} Pcs
                    </span>
                  </div>
                  <div className="p-2.5 space-y-2 max-h-48 overflow-y-auto text-[11px]">
                    {drilledTrxs.fullOutbounds.length === 0 ? (
                      <p className="text-slate-400 italic py-4 text-center">本期无发货操作</p>
                    ) : (
                      drilledTrxs.fullOutbounds.map(o => (
                        <div key={o.id} className="p-2 bg-slate-50 rounded border border-slate-100 space-y-1">
                          <div className="flex justify-between text-slate-700 font-semibold">
                            <span>发货: {formatters.number(o.outbound_qty)} Pcs</span>
                            <span className="text-slate-400 font-mono">{formatters.date(o.outbound_date)}</span>
                          </div>
                          <div className="text-slate-500 flex justify-between text-[10px]">
                            <span>发货员: {o.handler}</span>
                          </div>
                          {o.note && <p className="text-slate-400 italic text-[10px]">发货批: {o.note}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                id="btn-close-drilldown-footer"
                onClick={() => setDrilldownRecord(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold cursor-pointer"
              >
                确定对账，关闭窗口
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
