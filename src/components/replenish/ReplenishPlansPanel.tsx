/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 补货计划标签页（P2-4b 区块拆分自 ReplenishManager）：KPI + 计划列表 + 过滤/分页/展开/导出。
import React, { useState, useMemo } from 'react';
import { PackagePlus, Download, ChevronRight, ChevronLeft } from 'lucide-react';
import { formatters } from '../../db';
import { ReplenishPlan, ReplenishPlanItem } from '../../types';
import { exportCsv, safeNum } from './helpers';

interface Kpis {
  planTotal: number;
  pending: number;
  submitted: number;
  skuTotal: number;
}

interface Props {
  plans: ReplenishPlan[];
  kpis: Kpis;
  onGenerate: () => void;
  onOpenPo: (plan: ReplenishPlan) => void;
  onVoid: (id: string) => void;
}

export const ReplenishPlansPanel: React.FC<Props> = ({ plans, kpis, onGenerate, onOpenPo, onVoid }) => {
  const [planFilter, setPlanFilter] = useState<'全部' | '待确认' | '已生成采购单'>('全部');
  const [planSearch, setPlanSearch] = useState('');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = useState(20);

  const planFiltered = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    return plans.filter(p => {
      if (planFilter !== '全部' && p.status !== planFilter) return false;
      if (!q) return true;
      return (p.supplierName || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.supplierId || '').toLowerCase().includes(q) ||
        (p.items || []).some((x: ReplenishPlanItem) => (x.sku || '').toLowerCase().includes(q) || (x.title || '').toLowerCase().includes(q));
    });
  }, [plans, planFilter, planSearch]);

  const planTotalPages = Math.max(1, Math.ceil(planFiltered.length / planPageSize));
  const planPageSafe = Math.min(planPage, planTotalPages);
  const pagedPlans = planFiltered.slice((planPageSafe - 1) * planPageSize, planPageSafe * planPageSize);

  const exportPlanCsv = () => {
    exportCsv(`补货计划_${formatters.dbDate()}.csv`,
      ['计划编号', '供应商', '供应商编号', 'SKU数', '建议补货量', '预估金额', '状态', '采购单号', '生成时间'],
      planFiltered.map(p => [
        p.id, p.supplierName, p.supplierId, (p.items || []).length,
        p.totalQty, p.totalAmt, p.status, p.poNo || '', p.createdAt || ''
      ]));
  };

  const togglePlanDetail = (id: string) => setExpandedPlanId(expandedPlanId === id ? null : id);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
        {[
          { label: '计划总数', val: kpis.planTotal, color: 'text-indigo-600', sub: '按供应商合并' },
          { label: '待确认', val: kpis.pending, color: 'text-amber-600', sub: '可生成采购单' },
          { label: '已生成采购单', val: kpis.submitted, color: 'text-emerald-600', sub: '状态已流转' },
          { label: '合并SKU总数', val: kpis.skuTotal, color: 'text-rose-600', sub: '含触发+合并' }
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
              <h3 className="text-sm font-bold text-slate-800">补货计划列表</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">一键生成 · 触发SKU🔴 + 同供应商合并SKU🟡 · 计划状态流转</p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <button onClick={exportPlanCsv} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"><Download size={14} />导出</button>
              <button onClick={onGenerate} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"><PackagePlus size={15} />一键生成补货计划</button>
            </div>
          </div>
          <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-white shrink-0">
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value as '全部' | '待确认' | '已生成采购单')} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
              <option>全部</option><option>待确认</option><option>已生成采购单</option>
            </select>
            <input value={planSearch} onChange={e => { setPlanSearch(e.target.value); setPlanPage(1); }} placeholder="搜索供应商 / 计划号 / SKU..." className="w-48 text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
            <span className="text-[11px] text-slate-400 ml-auto">共 {planFiltered.length} 个计划</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-8"></th><th className="py-3 px-4">计划编号</th><th className="py-3 px-4">供应商</th>
                  <th className="py-3 px-4 text-center">SKU数</th><th className="py-3 px-4 text-right">建议补货量</th>
                  <th className="py-3 px-4 text-right">预估金额</th><th className="py-3 px-4">状态</th>
                  <th className="py-3 px-4">生成时间</th><th className="py-3 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {planFiltered.length === 0 ? (
                  <tr><td colSpan={9} className="py-20 text-center text-slate-400">
                    <PackagePlus size={40} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">暂无补货计划，请点击右上角「一键生成补货计划」</p>
                  </td></tr>
                ) : pagedPlans.map(plan => {
                  const items = plan.items || [];
                  const triggerCnt = items.filter((x: ReplenishPlanItem) => x.isTrigger).length;
                  const mergedCnt = items.length - triggerCnt;
                  const open = expandedPlanId === plan.id;
                  const stCell = plan.status === '已生成采购单'
                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">🟢已生成采购单<div className="font-mono text-[10px] text-slate-400 mt-0.5">{plan.poNo}</div></span>
                    : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">🟡待确认</span>;
                  const actCell = plan.status === '已生成采购单'
                    ? <span className="text-slate-400 text-[11px]">已完成</span>
                    : <>
                        <button onClick={() => onOpenPo(plan)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer">生成采购单</button>
                        <button onClick={() => onVoid(plan.id)} className="ml-1 px-2.5 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-[11px] font-semibold cursor-pointer">作废</button>
                      </>;
                  return (
                    <React.Fragment key={plan.id}>
                      <tr className="hover:bg-slate-50/80">
                        <td className="py-3 px-3"><button onClick={() => togglePlanDetail(plan.id)} className="text-slate-400 hover:text-indigo-600 cursor-pointer"><ChevronRight size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} /></button></td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">{plan.id}</td>
                        <td className="py-3 px-4"><b>{plan.supplierName}</b><div className="text-[10px] text-slate-400 font-mono">{plan.supplierId}</div></td>
                        <td className="py-3 px-4 text-center"><span className="text-rose-600">触发{triggerCnt}</span> · <span className="text-amber-600">合并{mergedCnt}</span><div className="text-slate-400">共{items.length}个</div></td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">{plan.totalQty}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">¥{plan.totalAmt.toLocaleString()}</td>
                        <td className="py-3 px-4">{stCell}</td>
                        <td className="py-3 px-4 text-slate-500">{plan.createdAt || '—'}</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">{actCell}</td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={9} className="px-4 py-3 pl-12">
                            <div className="text-[11px] text-slate-500 mb-2">
                              触发原因：SKU <b className="font-mono text-slate-700">{plan.triggerSku?.sku || '—'}</b> {plan.triggerSku?.spec ? `(${plan.triggerSku.spec}) ` : ''}库存 {plan.triggerSku?.stock ?? '—'} ≤ 补货值，自动合并同供应商其他 stock&lt;充裕值 的SKU。
                              {plan.supplierId !== '—' ? `供应商MOQ：${plan.moq} 件 · 地域：${plan.location}` : ''}
                            </div>
                            <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden">
                              <thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr>
                                <th className="py-1.5 px-3">SKU</th><th className="py-1.5 px-3">商品名</th><th className="py-1.5 px-3">规格</th><th className="py-1.5 px-3">类型</th>
                                <th className="py-1.5 px-3 text-right">当前库存</th><th className="py-1.5 px-3 text-right">补货值</th><th className="py-1.5 px-3 text-right">充裕值</th>
                                <th className="py-1.5 px-3 text-right">建议补货量</th><th className="py-1.5 px-3 text-right">单价(¥)</th><th className="py-1.5 px-3 text-right">小计(¥)</th>
                              </tr></thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {items.map((x: ReplenishPlanItem) => {
                                  const need = safeNum(x.need) > 0 ? safeNum(x.need) : Math.max(safeNum(x.abundanceThreshold) - safeNum(x.stock), 0);
                                  return (
                                    <tr key={x.sku}>
                                      <td className="py-1.5 px-3 font-mono text-indigo-600">{x.sku}</td>
                                      <td className="py-1.5 px-3">{x.emoji || ''} {x.title}</td>
                                      <td className="py-1.5 px-3 text-slate-500">{x.spec || '—'}</td>
                                      <td className="py-1.5 px-3">{x.isTrigger ? <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">🔴触发</span> : <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">🟡合并</span>}</td>
                                      <td className="py-1.5 px-3 text-right">{x.stock}</td>
                                      <td className="py-1.5 px-3 text-right">{x.replenishPoint}</td>
                                      <td className="py-1.5 px-3 text-right">{x.abundanceThreshold}</td>
                                      <td className="py-1.5 px-3 text-right font-bold text-rose-600">{need > 0 ? need : '—'}</td>
                                      <td className="py-1.5 px-3 text-right">{x.price}</td>
                                      <td className="py-1.5 px-3 text-right">{(Math.max(need, 1) * x.price).toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
            <span>共 {planFiltered.length} 个计划</span>
            <div className="flex items-center gap-2">
              <select
                value={planPageSize}
                onChange={e => { setPlanPageSize(Number(e.target.value)); setPlanPage(1); }}
                className="border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-600"
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} 条/页</option>)}
              </select>
              <button
                onClick={() => setPlanPage(planPageSafe - 1)}
                disabled={planPageSafe <= 1}
                className="px-2 py-1 border border-slate-200 rounded bg-white flex items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={12} />上一页
              </button>
              <span className="text-slate-500">第 {planPageSafe} / {planTotalPages} 页</span>
              <button
                onClick={() => setPlanPage(planPageSafe + 1)}
                disabled={planPageSafe >= planTotalPages}
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
