/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 库存预警标签页（P2-4b 区块拆分自 ReplenishManager）：KPI + SKU 阈值表 + 搜索/分页/导出。
import React, { useState, useMemo } from 'react';
import { Search, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatters } from '../../db';
import { ProductSku } from '../../types';
import { exportXlsx, getStockStatus } from './helpers';

interface Kpis {
  needReplenishCount: number;
  abundantCount: number;
  involvedSups: number;
  planTotal: number;
  pending: number;
  submitted: number;
}

interface Props {
  skus: ProductSku[];
  inFlightMap: Record<string, number>;
  kpis: Kpis;
  itemNameOf: (itemId?: string) => string;
  supplierNameOf: (sid: string) => string;
  onThresholdEdit: (sku: string, field: 'replenishPoint' | 'abundanceThreshold', value: number) => void;
  onDetail: (sku: ProductSku) => void;
}

export const ReplenishAlertsPanel: React.FC<Props> = ({
  skus, inFlightMap, kpis, itemNameOf, supplierNameOf, onThresholdEdit, onDetail
}) => {
  const [searchKw, setSearchKw] = useState('');
  const [alertPage, setAlertPage] = useState(1);
  const [alertPageSize, setAlertPageSize] = useState(20);

  const effectiveStockOf = (p: ProductSku) => p.stock + (inFlightMap[p.sku] || 0);

  const filteredSkus = useMemo(() => {
    const q = searchKw.trim().toLowerCase();
    if (!q) return skus;
    return skus.filter(p =>
      p.sku.toLowerCase().includes(q) ||
      (p.itemId || '').toLowerCase().includes(q) ||
      itemNameOf(p.itemId).toLowerCase().includes(q) ||
      (p.title || '').toLowerCase().includes(q) ||
      (p.spec || '').toLowerCase().includes(q) ||
      (p.supplierName || supplierNameOf(p.supplierId) || '').toLowerCase().includes(q)
    );
  }, [skus, searchKw]);

  const alertTotalPages = Math.max(1, Math.ceil(filteredSkus.length / alertPageSize));
  const alertPageSafe = Math.min(alertPage, alertTotalPages);
  const pagedSkus = filteredSkus.slice((alertPageSafe - 1) * alertPageSize, alertPageSafe * alertPageSize);

  const exportAlertXlsx = () => {
    exportXlsx(`补货预警_SKU阈值_${formatters.dbDate()}.xlsx`,
      ['商品ID', '商品名', 'SKU', 'SKU品名', '规格', '供应商', '当前库存', '充裕值', '补货值', '状态'],
      filteredSkus.map(p => [
        p.itemId, itemNameOf(p.itemId), p.sku, p.title, p.spec || '',
        p.supplierName || supplierNameOf(p.supplierId),
        p.stock, p.abundanceThreshold, p.replenishPoint,
        getStockStatus(p).text
      ]));
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
        {[
          { label: '需补货SKU数', val: kpis.needReplenishCount, color: 'text-rose-600', sub: 'stock≤补货值' },
          { label: '已达充裕值SKU数', val: kpis.abundantCount, color: 'text-emerald-600', sub: 'stock≥充裕值' },
          { label: '涉及供应商数', val: kpis.involvedSups, color: 'text-amber-600', sub: '需补货SKU归属' },
          { label: '补货计划数', val: kpis.planTotal, color: 'text-indigo-600', sub: `待确认 ${kpis.pending} · 已下单 ${kpis.submitted}` }
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
            <div className="text-[11px] text-slate-400 font-bold">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.val}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/55 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-slate-800">补货预警 · SKU库存与阈值</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">stock ≤ 补货值触发补货；stock &lt; 充裕值被合并补货。阈值可编辑。</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={exportAlertXlsx}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer shrink-0"
              >
                <Download size={14} />导出
              </button>
              <div className="relative flex-1 sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchKw} onChange={e => { setSearchKw(e.target.value); setAlertPage(1); }} placeholder="搜索 商品ID / SKU / 商品名 / 规格 / 供应商..." className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4" title="商品ID = 主体商品（SPU）编码，如 SPU0001；一个商品下可挂多个 SKU（规格/颜色不同）">商品ID</th>
                  <th className="py-3 px-4">SKU</th><th className="py-3 px-4">SKU 品名</th><th className="py-3 px-4">规格</th>
                  <th className="py-3 px-4">供应商</th>
                  <th className="py-3 px-4 text-right" title="当前库存 = 可售库存：仅统计「OQC验Pass」的入库减去已出库；待复检 / 不合格不计入（点「详情」看构成）">当前库存 ⓘ</th>
                  <th className="py-3 px-4 text-right">充裕值</th><th className="py-3 px-4 text-right">补货值</th>
                  <th className="py-3 px-4 text-center">状态</th><th className="py-3 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pagedSkus.map(p => {
                  const eff = effectiveStockOf(p);
                  const inFlight = inFlightMap[p.sku] || 0;
                  const st = getStockStatus(p, eff);
                  const supName = p.supplierName || supplierNameOf(p.supplierId);
                  return (
                    <tr key={p.sku} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-violet-700">{p.itemId}</div>
                        <div className="text-[10px] text-slate-400">{itemNameOf(p.itemId)}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{p.sku}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.emoji || ''} {p.title}<div className="text-[10px] text-slate-400">{p.color ? `颜色 ${p.color}` : ''}</div></td>
                      <td className="py-3 px-4 text-slate-500">{p.spec || '—'}</td>
                      <td className="py-3 px-4 text-slate-600"><b>{supName}</b><div className="text-[10px] text-slate-400 font-mono">{p.supplierId}</div></td>
                      <td className="py-3 px-4 text-right" title="可售库存 = OQC验Pass 入库 − 已出库；待复检 / 不合格不计入">
                        <div className="font-bold text-slate-900">{p.stock}</div>
                        {inFlight > 0 && <div className="text-[10px] text-emerald-600" title={`有效库存 ${eff} = 当前 ${p.stock} + 在途 ${inFlight}`}>+{inFlight} 在途</div>}
                      </td>
                      <td className="py-3 px-4 text-right"><input type="number" value={p.abundanceThreshold} min={0} onChange={e => onThresholdEdit(p.sku, 'abundanceThreshold', Number(e.target.value))} className="w-16 text-right border border-slate-200 rounded px-1 py-0.5" /></td>
                      <td className="py-3 px-4 text-right"><input type="number" value={p.replenishPoint} min={0} onChange={e => onThresholdEdit(p.sku, 'replenishPoint', Number(e.target.value))} className="w-16 text-right border border-slate-200 rounded px-1 py-0.5" /></td>
                      <td className="py-3 px-4 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`} title={`有效库存=${eff}（当前${p.stock}${inFlight ? `+在途${inFlight}` : ''}）`}>{st.text}</span></td>
                      <td className="py-3 px-4 text-center"><button onClick={() => onDetail(p)} className="px-2 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1 mx-auto"><Eye size={12} />详情</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
            <span>状态按<strong>有效库存</strong>判定（当前库存 + 待确认计划/未结案采购单（待采购/已付款/待收货）的在途覆盖量）。生成补货计划时扣除未结案采购单，待确认计划会被覆盖刷新，避免重复。stock≤补货值→🔴需补货；stock&lt;充裕值→🟡偏低；stock≥充裕值→🟢充裕。</span>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={alertPageSize}
                onChange={e => { setAlertPageSize(Number(e.target.value)); setAlertPage(1); }}
                className="border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-600"
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} 条/页</option>)}
              </select>
              <button
                onClick={() => setAlertPage(alertPageSafe - 1)}
                disabled={alertPageSafe <= 1}
                className="px-2 py-1 border border-slate-200 rounded bg-white flex items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={12} />上一页
              </button>
              <span className="text-slate-500">第 {alertPageSafe} / {alertTotalPages} 页 · 共 {filteredSkus.length} 条</span>
              <button
                onClick={() => setAlertPage(alertPageSafe + 1)}
                disabled={alertPageSafe >= alertTotalPages}
                className="px-2 py-1 border border-slate-200 rounded bg-white flex items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                下一页<ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
