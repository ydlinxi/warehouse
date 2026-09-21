/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ERP 对账中心：采购单 ↔ 入库单 ↔ 质检单 ↔ 结算单 四单一致性校验
 */

import React, { useMemo, useState } from 'react';
import { FileCheck, Download, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { DBService, formatters } from '../db';

type ReconStatus = '一致' | '差异' | '待入库';

interface ReconRow {
  poNo: string;
  supplier: string;
  sku: string;
  title: string;
  unitPrice: number;
  qtyPo: number;
  qtyIn: number;
  qtyQc: number;
  amtPo: number;
  amtFn: number;
  status: ReconStatus;
  diff: string;
}

export const ReconCenter: React.FC = () => {
  const [filter, setFilter] = useState<'all' | ReconStatus>('all');

  const rows = useMemo<ReconRow[]>(() => {
    const pos = DBService.getPurchaseOrders();
    const demands = DBService.getDemands();
    const inbounds = DBService.getInbounds();
    const result: ReconRow[] = [];

    pos.forEach(po => {
      po.items.forEach(item => {
        const demand = demands.find(
          d => d.order_no === po.poNo && (d.model === item.title || d.product === item.title)
        );
        const inb = demand?.inbound_id ? inbounds.find(i => i.id === demand.inbound_id) : undefined;

        const qtyPo = item.need;
        const qtyIn = inb ? inb.actual_qty : 0;
        const sellable = inb ? (inb.quality === 'OQC验Pass' || inb.disposal === '让步接收') : false;
        const qtyQc = sellable ? qtyIn : 0;
        const amtPo = qtyPo * item.price;
        const amtFn = qtyQc * item.price;

        let status: ReconStatus;
        let diff: string;
        if (qtyIn === 0) {
          status = '待入库';
          diff = po.status === '已收货' ? '已收货但无入库记录' : `采购单状态：${po.status}`;
        } else if (qtyIn === qtyPo && qtyQc === qtyPo) {
          status = '一致';
          diff = '四单一致';
        } else {
          status = '差异';
          diff = qtyIn < qtyPo ? '到货不足，按合格数量结算' : '质检不合格，按合格数量结算';
        }

        result.push({
          poNo: po.poNo,
          supplier: po.supplierName,
          sku: item.sku,
          title: item.title,
          unitPrice: item.price,
          qtyPo,
          qtyIn,
          qtyQc,
          amtPo,
          amtFn,
          status,
          diff
        });
      });
    });

    return result;
  }, []);

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  const matched = rows.filter(r => r.status === '一致').length;
  const mismatched = rows.filter(r => r.status === '差异').length;
  const pending = rows.filter(r => r.status === '待入库').length;
  const totalDiffAmt = rows.reduce((s, r) => s + Math.abs(r.amtPo - r.amtFn), 0);
  const consistentRate = rows.length > 0 ? Math.round((matched / rows.length) * 100) : 0;

  const exportCsv = () => {
    const header = ['采购单号', '供应商', 'SKU', '品名', '单价', '采购量', '入库量', '合格量', '采购金额', '结算金额', '状态', '差异说明'];
    const lines = filtered.map(r => [
      r.poNo, r.supplier, r.sku, r.title, r.unitPrice, r.qtyPo, r.qtyIn, r.qtyQc, r.amtPo, r.amtFn, r.status, r.diff
    ]);
    const csv = [header, ...lines]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ERP对账_${formatters.dbDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: ReconStatus) => {
    if (s === '一致') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">✓ 一致</span>;
    if (s === '差异') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">⚠ 差异</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">待入库</span>;
  };

  const filters: Array<{ key: 'all' | ReconStatus; label: string; count: number }> = [
    { key: 'all', label: '全部', count: rows.length },
    { key: '一致', label: '一致', count: matched },
    { key: '差异', label: '差异', count: mismatched },
    { key: '待入库', label: '待入库', count: pending },
  ];

  return (
    <div id="recon-center-root" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ERP 对账中心</h2>
          <p className="text-xs text-slate-500 mt-1">采购单 ↔ 入库单 ↔ 质检单 ↔ 结算单 四单一致性校验，差异按合格数量结算。</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
        >
          <Download size={14} />
          <span>导出对账明细</span>
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><FileCheck size={12} />对账明细</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{rows.length}</div>
          <div className="text-[10px] text-slate-400">采购条目</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><CheckCircle2 size={12} />一致率</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{consistentRate}%</div>
          <div className="text-[10px] text-slate-400">{matched} 条一致</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><AlertTriangle size={12} />差异笔数</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{mismatched}</div>
          <div className="text-[10px] text-slate-400">需与供应商沟通</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><Clock size={12} />差异金额</div>
          <div className="text-2xl font-black text-rose-600 mt-1">¥{formatters.number(totalDiffAmt)}</div>
          <div className="text-[10px] text-slate-400">采购额 - 结算额</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider font-bold z-10">
              <tr>
                <th className="py-3 px-4">采购单号</th>
                <th className="py-3 px-4">供应商</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">品名</th>
                <th className="py-3 px-4 text-right">采购量</th>
                <th className="py-3 px-4 text-right">入库量</th>
                <th className="py-3 px-4 text-right">合格量</th>
                <th className="py-3 px-4 text-right">采购金额</th>
                <th className="py-3 px-4 text-right">结算金额</th>
                <th className="py-3 px-4 text-center">一致性</th>
                <th className="py-3 px-4">差异说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">暂无对账数据</td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={`${r.poNo}-${r.sku}-${i}`} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">{r.poNo}</td>
                    <td className="py-3 px-4">{r.supplier}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{r.sku}</td>
                    <td className="py-3 px-4">{r.title}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatters.number(r.qtyPo)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">{formatters.number(r.qtyIn)}</td>
                    <td className="py-3 px-4 text-right font-mono text-blue-600 font-semibold">{formatters.number(r.qtyQc)}</td>
                    <td className="py-3 px-4 text-right font-mono">¥{formatters.number(r.amtPo)}</td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${r.amtFn < r.amtPo ? 'text-rose-500' : 'text-slate-700'}`}>
                      ¥{formatters.number(r.amtFn)}
                    </td>
                    <td className="py-3 px-4 text-center">{statusBadge(r.status)}</td>
                    <td className="py-3 px-4 text-slate-500">{r.diff}</td>
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
