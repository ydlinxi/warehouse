import React, { useState, useMemo } from 'react';
import { AlertTriangle, Search, PackagePlus, FileText, X, ShoppingCart, ChevronRight, ChevronLeft, Eye, Download } from 'lucide-react';
import { DBService, formatters } from '../db';
import { ProductSku, PurchaseOrder } from '../types';

// CSV 导出（Blob + BOM + 字段转义）
const exportCsv = (filename: string, header: string[], rows: (string | number)[][]) => {
  const csv = [header, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ===== 工具函数（对齐早前 v3 版本） =====
const safeNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
// 单价兜底：price 缺失时按 SKU 末位估算（与早前一致）
const unitPrice = (p: any) => safeNum(p.price) || Math.round(30 + (p.sku ? p.sku.charCodeAt(p.sku.length - 1) % 8 : 0) * 10);
const needQty = (p: any) => Math.max(safeNum(p.abundanceThreshold) - safeNum(p.stock), 1);
// 计划编号：RP-YYYYMMDD-NN（按当天已存在计划计数）
const genPlanId = (arr: any[]) => {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = arr.filter((p: any) => (p.id || '').indexOf(ds) >= 0).length + 1;
  return `RP-${ds}-${String(seq).padStart(2, '0')}`;
};
const genPoNo = () => 'PO-REPL-' + Date.now().toString().slice(-8);

export const ReplenishManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alert' | 'plan'>('alert');
  const [skus, setSkus] = useState<ProductSku[]>(() => DBService.getProductSkus());
  const [plans, setPlans] = useState<any[]>(() => DBService.getReplenishPlans());
  const [searchKw, setSearchKw] = useState('');
  const [planFilter, setPlanFilter] = useState<'全部' | '待确认' | '已生成采购单'>('全部');
  const [planSearch, setPlanSearch] = useState('');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<any | null>(null);
  const [poModal, setPoModal] = useState<any | null>(null);
  const [detailSku, setDetailSku] = useState<any | null>(null);

  // 分页
  const [alertPage, setAlertPage] = useState(1);
  const [alertPageSize, setAlertPageSize] = useState(20);
  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = useState(20);

  const persistSkus = (next: ProductSku[]) => { setSkus(next); DBService.saveProductSkus(next); };
  const persistPlans = (next: any[]) => { setPlans(next); DBService.saveReplenishPlans(next); };

  const getStatus = (p: ProductSku, effectiveStock?: number) => {
    const stock = effectiveStock ?? p.stock;
    if (stock <= p.replenishPoint) return { cls: 'bg-rose-100 text-rose-700', text: '🔴需补货' };
    if (stock < p.abundanceThreshold) return { cls: 'bg-amber-100 text-amber-700', text: '🟡偏低' };
    return { cls: 'bg-emerald-100 text-emerald-700', text: '🟢充裕' };
  };

  const supplierNameOf = (sid: string) => {
    const sup = DBService.getSuppliers().find(s => s.id === sid);
    return sup ? sup.name : '—';
  };

  // 商品主数据（SPU 级）：SKU 归属的商品ID → 商品名
  const items = useMemo(() => DBService.getRawItems(), []);
  const itemNameOf = (itemId?: string) => {
    const it = items.find(x => x.itemId === itemId);
    return it ? (it.itemName || it.name) : (itemId || '—');
  };

  // 在途覆盖量：待确认计划 + 未结案采购单
  const inFlightMap = useMemo(() => {
    const map: Record<string, number> = {};
    plans.filter(p => p.status === '待确认').forEach(p => (p.items || []).forEach((it: any) => {
      map[it.sku] = (map[it.sku] || 0) + safeNum(it.need);
    }));
    DBService.getPurchaseOrders()
      .filter(po => ['待采购', '已付款', '待收货'].includes(po.status))
      .forEach(po => po.items.forEach(it => {
        map[it.sku] = (map[it.sku] || 0) + safeNum(it.need);
      }));
    return map;
  }, [plans, skus]);

  // ===== 库存维度 KPI（按有效库存 = 当前库存 + 在途覆盖量） =====
  const effectiveStockOf = (p: ProductSku) => p.stock + (inFlightMap[p.sku] || 0);
  const needReplenishCount = skus.filter(p => effectiveStockOf(p) <= p.replenishPoint).length;
  const abundantCount = skus.filter(p => effectiveStockOf(p) >= p.abundanceThreshold).length;
  const involvedSups = new Set(skus.filter(p => effectiveStockOf(p) <= p.replenishPoint).map(p => p.supplierId)).size;
  const planTotal = plans.length;
  const pending = plans.filter(p => p.status === '待确认').length;
  const submitted = plans.filter(p => p.status === '已生成采购单').length;

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

  const onThresholdEdit = (sku: string, field: 'replenishPoint' | 'abundanceThreshold', value: number) => {
    persistSkus(skus.map(p => p.sku === sku ? { ...p, [field]: value } : p));
  };

  const skuTotal = plans.reduce((s: number, p: any) => s + (p.items || []).length, 0);

  const planFiltered = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    return plans.filter(p => {
      if (planFilter !== '全部' && p.status !== planFilter) return false;
      if (!q) return true;
      return (p.supplierName || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.supplierId || '').toLowerCase().includes(q) ||
        (p.items || []).some((x: any) => (x.sku || '').toLowerCase().includes(q) || (x.title || '').toLowerCase().includes(q));
    });
  }, [plans, planFilter, planSearch]);

  // ===== 分页切片 =====
  const alertTotalPages = Math.max(1, Math.ceil(filteredSkus.length / alertPageSize));
  const alertPageSafe = Math.min(alertPage, alertTotalPages);
  const pagedSkus = filteredSkus.slice((alertPageSafe - 1) * alertPageSize, alertPageSafe * alertPageSize);

  const planTotalPages = Math.max(1, Math.ceil(planFiltered.length / planPageSize));
  const planPageSafe = Math.min(planPage, planTotalPages);
  const pagedPlans = planFiltered.slice((planPageSafe - 1) * planPageSize, planPageSafe * planPageSize);

  // ===== 导出 =====
  const exportAlertCsv = () => {
    exportCsv(`补货预警_SKU阈值_${formatters.dbDate()}.csv`,
      ['商品ID', '商品名', 'SKU', 'SKU品名', '规格', '供应商', '当前库存', '充裕值', '补货值', '状态'],
      filteredSkus.map(p => [
        p.itemId, itemNameOf(p.itemId), p.sku, p.title, p.spec || '',
        p.supplierName || supplierNameOf(p.supplierId),
        p.stock, p.abundanceThreshold, p.replenishPoint,
        getStatus(p).text
      ]));
  };

  const exportPlanCsv = () => {
    exportCsv(`补货计划_${formatters.dbDate()}.csv`,
      ['计划编号', '供应商', '供应商编号', 'SKU数', '建议补货量', '预估金额', '状态', '采购单号', '生成时间'],
      planFiltered.map(p => [
        p.id, p.supplierName, p.supplierId, (p.items || []).length,
        p.totalQty, p.totalAmt, p.status, p.poNo || '', p.createdAt || ''
      ]));
  };

  // ===== 一键生成补货计划：预览确认 =====
  const buildPlansFromAlerts = () => {
    const { mergedPlans } = DBService.computeReplenishAlerts(skus);
    return (mergedPlans || []).map((mp: any) => {
      const sup = mp.supplier || {};
      const items = (mp.items || []).map((it: any) => ({
        sku: it.sku, title: it.title || it.name || '', emoji: it.emoji || '', spec: it.spec || '',
        stock: safeNum(it.stock), effectiveStock: safeNum(it.effectiveStock), replenishPoint: safeNum(it.replenishPoint), abundanceThreshold: safeNum(it.abundanceThreshold),
        need: safeNum(it.need) > 0 ? safeNum(it.need) : Math.max(safeNum(it.abundanceThreshold) - safeNum(it.stock), 1),
        price: unitPrice(it), isTrigger: safeNum(it.effectiveStock ?? it.stock) <= safeNum(it.replenishPoint)
      }));
      const totalQty = items.reduce((s: number, x: any) => s + x.need, 0);
      const totalAmt = items.reduce((s: number, x: any) => s + x.need * x.price, 0);
      const trigger = items.find((x: any) => x.isTrigger) || {};
      return {
        supplierId: sup.id || '—', supplierName: sup.name || '—', location: sup.location || '—', moq: sup.moq || '—',
        triggerSku: { sku: trigger.sku, title: trigger.title || '', spec: trigger.spec || '', stock: safeNum(trigger.stock) },
        items, totalQty, totalAmt, status: '待确认', poNo: ''
      };
    });
  };

  const genAllPlans = () => {
    const built = buildPlansFromAlerts();
    if (!built.length) { alert('当前无需补货的 SKU，暂无补货计划'); return; }
    const store = DBService.getReplenishPlans();
    built.forEach((b: any) => { b._mode = store.find(p => p.supplierId === b.supplierId && p.status === '待确认') ? '覆盖更新' : '新建'; });
    const createCnt = built.filter((b: any) => b._mode === '新建').length;
    const updateCnt = built.length - createCnt;
    const grandQty = built.reduce((s: number, b: any) => s + b.totalQty, 0);
    const grandAmt = built.reduce((s: number, b: any) => s + b.totalAmt, 0);
    setPreviewModal({ built, createCnt, updateCnt, grandQty, grandAmt });
  };

  // 覆盖更新幂等：同供应商已有「待确认」计划 → 保留编号覆盖更新；
  // 若某供应商已没有需要补货的SKU（被采购单/旧计划覆盖），清除其待确认旧计划。
  const confirmGeneratePlans = () => {
    if (!previewModal) return;
    const { built } = previewModal;
    const store = DBService.getReplenishPlans();
    const builtSupplierIds = new Set(built.map((b: any) => b.supplierId));
    const next: any[] = store.filter(p => p.status !== '待确认' || builtSupplierIds.has(p.supplierId));
    const removed = store.length - next.length;
    let created = 0, updated = 0;
    const now = formatters.dbDate();
    built.forEach((b: any) => {
      const idx = next.findIndex(p => p.supplierId === b.supplierId && p.status === '待确认');
      if (idx >= 0) {
        next[idx] = { ...next[idx], items: b.items, totalQty: b.totalQty, totalAmt: b.totalAmt, triggerSku: b.triggerSku };
        updated++;
      } else {
        next.push({ ...b, id: genPlanId(next), createdAt: now });
        created++;
      }
    });
    persistPlans(next);
    setPreviewModal(null);
    setActiveTab('plan');
    alert(`补货计划已生成：新建 ${created} 个${updated ? `，覆盖更新 ${updated} 个` : ''}${removed ? `，清除已覆盖 ${removed} 个` : ''}`);
  };

  // ===== 生成采购单（带预交货日 / 付款方式 / 备注 / 可调补货量） =====
  const openPoModal = (plan: any) => {
    const today = new Date();
    const expectDate = new Date(today.getTime() + 15 * 86400000).toISOString().slice(0, 10);
    const items = (plan.items || []).map((it: any) => ({ ...it, need: safeNum(it.need) > 0 ? safeNum(it.need) : Math.max(safeNum(it.abundanceThreshold) - safeNum(it.stock), 1) }));
    setPoModal({ ...plan, items, expectDate, payMethod: '预付全款', note: '', poNo: genPoNo() });
  };

  const setPoNeed = (sku: string, val: number) => {
    setPoModal((prev: any) => prev ? { ...prev, items: prev.items.map((x: any) => x.sku === sku ? { ...x, need: Math.max(0, safeNum(val)) } : x) } : prev);
  };

  const poTotals = poModal ? {
    qty: poModal.items.reduce((s: number, x: any) => s + x.need, 0),
    amt: poModal.items.reduce((s: number, x: any) => s + x.need * x.price, 0)
  } : null;

  const submitPurchaseOrder = (m: any) => {
    const po: PurchaseOrder = {
      poNo: m.poNo, supplierId: m.supplierId, supplierName: m.supplierName,
      items: m.items.map((it: any) => ({ sku: it.sku, title: it.title, need: it.need, price: it.price })),
      totalQty: m.items.reduce((s: number, x: any) => s + x.need, 0),
      totalAmt: m.items.reduce((s: number, x: any) => s + x.need * x.price, 0),
      status: '待采购', createdAt: formatters.dbDate(),
      expectDate: m.expectDate, payMethod: m.payMethod, note: m.note
    };
    const all = DBService.getPurchaseOrders(); all.push(po); DBService.savePurchaseOrders(all);
    persistPlans(plans.map(p => p.id === m.id ? { ...p, status: '已生成采购单', poNo: po.poNo } : p));
    setPoModal(null);
  };

  const voidPlan = (id: string) => {
    if (!window.confirm('确认作废该补货计划？作废后将从列表移除，可重新一键生成。')) return;
    persistPlans(plans.filter(p => p.id !== id));
    if (expandedPlanId === id) setExpandedPlanId(null);
  };

  const togglePlanDetail = (id: string) => setExpandedPlanId(expandedPlanId === id ? null : id);

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-slate-50 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200"><AlertTriangle size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">补货预警与采购建议</h2>
            <p className="text-sm text-slate-500 mt-0.5">基于真实库存与阈值，按供应商合并生成补货计划，一键转为采购单。</p>
          </div>
        </div>
        <div className="flex bg-slate-200/70 p-1 rounded-xl self-start md:self-auto">
          <button onClick={() => setActiveTab('alert')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'alert' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}><PackagePlus size={15} /><span>库存预警</span></button>
          <button onClick={() => setActiveTab('plan')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'plan' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}><FileText size={15} /><span>补货计划 ({plans.length})</span></button>
        </div>
      </div>

      {activeTab === 'alert' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
            {[
              { label: '需补货SKU数', val: needReplenishCount, color: 'text-rose-600', sub: 'stock≤补货值' },
              { label: '已达充裕值SKU数', val: abundantCount, color: 'text-emerald-600', sub: 'stock≥充裕值' },
              { label: '涉及供应商数', val: involvedSups, color: 'text-amber-600', sub: '需补货SKU归属' },
              { label: '补货计划数', val: planTotal, color: 'text-indigo-600', sub: `待确认 ${pending} · 已下单 ${submitted}` }
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
                    onClick={exportAlertCsv}
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
                      const st = getStatus(p, eff);
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
                          <td className="py-3 px-4 text-center"><button onClick={() => setDetailSku(p)} className="px-2 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1 mx-auto"><Eye size={12} />详情</button></td>
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
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
            {[
              { label: '计划总数', val: planTotal, color: 'text-indigo-600', sub: '按供应商合并' },
              { label: '待确认', val: pending, color: 'text-amber-600', sub: '可生成采购单' },
              { label: '已生成采购单', val: submitted, color: 'text-emerald-600', sub: '状态已流转' },
              { label: '合并SKU总数', val: skuTotal, color: 'text-rose-600', sub: '含触发+合并' }
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
                  <button onClick={genAllPlans} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"><PackagePlus size={15} />一键生成补货计划</button>
                </div>
              </div>
              <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-white shrink-0">
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value as any)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
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
                      const triggerCnt = items.filter((x: any) => x.isTrigger).length;
                      const mergedCnt = items.length - triggerCnt;
                      const open = expandedPlanId === plan.id;
                      const stCell = plan.status === '已生成采购单'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">🟢已生成采购单<div className="font-mono text-[10px] text-slate-400 mt-0.5">{plan.poNo}</div></span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">🟡待确认</span>;
                      const actCell = plan.status === '已生成采购单'
                        ? <span className="text-slate-400 text-[11px]">已完成</span>
                        : <>
                            <button onClick={() => openPoModal(plan)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer">生成采购单</button>
                            <button onClick={() => voidPlan(plan.id)} className="ml-1 px-2.5 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-[11px] font-semibold cursor-pointer">作废</button>
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
                                    {items.map((x: any) => {
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
      )}

      {/* ===== 生成补货计划：预览确认弹窗 ===== */}
      {previewModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2"><PackagePlus size={16} />一键生成补货计划 · 预览确认（{previewModal.built.length} 个供应商）</h3>
              <button onClick={() => setPreviewModal(null)} className="text-indigo-100 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><span className="text-slate-400">新建计划</span><div className="font-bold text-emerald-600 text-lg">{previewModal.createCnt} 个</div></div>
                <div><span className="text-slate-400">覆盖更新</span><div className="font-bold text-amber-600 text-lg">{previewModal.updateCnt} 个</div></div>
                <div><span className="text-slate-400">合并SKU总数</span><div className="font-bold text-lg">{previewModal.built.reduce((s: number, b: any) => s + b.items.length, 0)} 个</div></div>
                <div><span className="text-slate-400">补货总量 / 预计金额</span><div className="font-bold text-lg text-rose-600">{previewModal.grandQty} 件 · ¥{previewModal.grandAmt.toLocaleString()}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr>
                    <th className="py-1.5 px-3">供应商编号</th><th className="py-1.5 px-3">名称</th><th className="py-1.5 px-3">地域</th><th className="py-1.5 px-3 text-center">SKU数</th><th className="py-1.5 px-3 text-right">补货量</th><th className="py-1.5 px-3">触发SKU</th><th className="py-1.5 px-3">处理方式</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {previewModal.built.map((b: any) => (
                      <tr key={b.supplierId}>
                        <td className="py-1.5 px-3 font-mono">{b.supplierId}</td>
                        <td className="py-1.5 px-3">{b.supplierName}</td>
                        <td className="py-1.5 px-3">{b.location}</td>
                        <td className="py-1.5 px-3 text-center">{b.items.length}</td>
                        <td className="py-1.5 px-3 text-right">{b.totalQty}</td>
                        <td className="py-1.5 px-3 font-mono">{b.triggerSku?.sku || '—'}</td>
                        <td className="py-1.5 px-3">{b._mode === '覆盖更新' ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">覆盖更新</span> : <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">新建</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2">合并规则：SKU库存≤补货值时触发补货，自动检查同供应商其他SKU是否低于充裕值（stock&lt;充裕值），低于则合并补货。计算时已扣除「待收货采购单」的在途覆盖量，避免重复下单；同供应商旧「待确认」计划将被覆盖更新或清除，不会重复计入。</div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setPreviewModal(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer">取消</button>
              <button onClick={confirmGeneratePlans} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer">✔ 确认生成计划</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 生成采购单弹窗（预交货日 / 付款方式 / 备注 / 可调补货量） ===== */}
      {poModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2"><ShoppingCart size={16} />生成补货采购单 · {poModal.supplierName}（{poModal.id}）</h3>
              <button onClick={() => setPoModal(null)} className="text-indigo-100 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><span className="text-slate-400">供应商编号</span><div className="font-mono font-bold">{poModal.supplierId}</div></div>
                <div><span className="text-slate-400">地域</span><div className="font-bold">{poModal.location}</div></div>
                <div><span className="text-slate-400">MOQ</span><div className="font-bold">{poModal.moq} 件</div></div>
                <div><span className="text-slate-400">触发SKU</span><div className="font-mono font-bold">{poModal.triggerSku?.sku || '—'}</div></div>
                <div><span className="text-slate-400">合并SKU数</span><div className="font-bold text-indigo-600">{poModal.items.length} 个</div></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div><label className="text-slate-400 block mb-1">采购单号</label><input value={poModal.poNo} readOnly className="w-full border border-slate-200 rounded px-2 py-1 font-mono bg-slate-50" /></div>
                <div><label className="text-slate-400 block mb-1">预交货日</label><input type="date" value={poModal.expectDate} onChange={e => setPoModal((p: any) => p ? { ...p, expectDate: e.target.value } : p)} className="w-full border border-slate-200 rounded px-2 py-1" /></div>
                <div><label className="text-slate-400 block mb-1">付款方式</label>
                  <select value={poModal.payMethod} onChange={e => setPoModal((p: any) => p ? { ...p, payMethod: e.target.value } : p)} className="w-full border border-slate-200 rounded px-2 py-1 bg-white">
                    <option>预付全款</option><option>预付50%</option><option>货到付款</option><option>月结30天</option>
                  </select>
                </div>
              </div>
              <div><label className="text-slate-400 block mb-1">备注</label><textarea value={poModal.note} onChange={e => setPoModal((p: any) => p ? { ...p, note: e.target.value } : p)} placeholder="可填写特殊要求（包装、物流、质检标准等）" className="w-full border border-slate-200 rounded px-2 py-1 min-h-[50px]" /></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr>
                    <th className="py-1.5 px-3">SKU</th><th className="py-1.5 px-3">商品名</th><th className="py-1.5 px-3">规格</th><th className="py-1.5 px-3 text-right">当前库存</th><th className="py-1.5 px-3 text-right">充裕值</th><th className="py-1.5 px-3 text-right">建议补货量</th><th className="py-1.5 px-3 text-right">单价(¥)</th><th className="py-1.5 px-3 text-right">小计</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {poModal.items.map((it: any) => (
                      <tr key={it.sku}>
                        <td className="py-1.5 px-3 font-mono text-indigo-600">{it.sku}</td>
                        <td className="py-1.5 px-3">{it.emoji || ''} {it.title}</td>
                        <td className="py-1.5 px-3 text-slate-500">{it.spec || '—'}</td>
                        <td className="py-1.5 px-3 text-right">{it.stock}</td>
                        <td className="py-1.5 px-3 text-right">{it.abundanceThreshold}</td>
                        <td className="py-1.5 px-3 text-right"><input type="number" min={0} value={it.need} onChange={e => setPoNeed(it.sku, Number(e.target.value))} className="w-16 text-right border border-slate-200 rounded px-1 py-0.5 font-bold text-rose-600" /></td>
                        <td className="py-1.5 px-3 text-right">{it.price}</td>
                        <td className="py-1.5 px-3 text-right">{(it.need * it.price).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center pt-1">
                <div><span className="text-slate-400">建议补货总量</span><div className="font-bold text-rose-600 text-lg">{poTotals?.qty} 件</div></div>
                <div className="text-right"><span className="text-slate-400">采购总额</span><div className="font-bold text-emerald-600 text-xl">¥{poTotals?.amt.toLocaleString()}</div></div>
              </div>
              <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2">补货量 = max(充裕值 - 当前库存, 1)，建议数量可编辑；单价由系统核定不可修改，总额实时更新。提交后补货计划状态将流转为「已生成采购单」。</div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setPoModal(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer">取消</button>
              <button onClick={() => submitPurchaseOrder(poModal)} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer">确认提交采购单</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SKU 详情弹窗 ===== */}
      {detailSku && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2"><Eye size={16} />SKU 补货详情</h3>
              <button onClick={() => setDetailSku(null)} className="text-indigo-100 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <span className="text-slate-400">商品ID / 商品名</span>
                  <div className="font-mono font-bold text-violet-700">{detailSku.itemId} <span className="font-sans font-normal text-slate-600">{itemNameOf(detailSku.itemId)}</span></div>
                </div>
                <div><span className="text-slate-400">SKU</span><div className="font-mono font-bold">{detailSku.sku}</div></div>
                <div><span className="text-slate-400">当前库存</span><div className="font-bold">{detailSku.stock}</div></div>
                <div><span className="text-slate-400">充裕值</span><div className="font-bold">{detailSku.abundanceThreshold}</div></div>
                <div><span className="text-slate-400">补货值</span><div className="font-bold">{detailSku.replenishPoint}</div></div>
                <div className="col-span-2"><span className="text-slate-400">商品名</span><div className="font-semibold">{detailSku.emoji || ''} {detailSku.title}</div></div>
                <div className="col-span-2"><span className="text-slate-400">规格</span><div>{detailSku.spec || '—'}</div></div>
                <div className="col-span-2"><span className="text-slate-400">供应商</span><div>{detailSku.supplierName || supplierNameOf(detailSku.supplierId)}（{detailSku.supplierId}）</div></div>
                {(() => {
                  const bd = DBService.getSkuStockBreakdown(detailSku.sku);
                  return (
                    <div className="col-span-2 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed">
                      <div className="text-slate-500 font-semibold mb-1">当前库存构成（可售口径）</div>
                      <div className="text-slate-600">
                        OQC验Pass 入库 − 已出库 = <b className="text-emerald-600">{bd.available}</b> 件（= 当前库存）
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        其中待复检 <b>{bd.pending}</b> 件、不合格 <b>{bd.reject}</b> 件<b className="text-rose-600">不计入可售</b>；在架物理量合计 {bd.physical} 件（含上述两类），累计已出库 {bd.shipped} 件。
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">不合格品处置为「让步接收」后转为可售，才会进入当前库存。</div>
                    </div>
                  );
                })()}
              </div>
              <div className="pt-1 border-t border-slate-100">
                {(() => {
                  const inFlight = inFlightMap[detailSku.sku] || 0;
                  const eff = detailSku.stock + inFlight;
                  const st = getStatus(detailSku, eff);
                  const effNeed = Math.max(0, detailSku.abundanceThreshold - eff);
                  return (
                    <>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-400">状态（按有效库存）</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.text}</span>
                      </div>
                      <div className="flex items-center justify-between py-1"><span className="text-slate-400">在途/已计划覆盖</span><span className="font-bold text-emerald-600">{inFlight} 件</span></div>
                      <div className="flex items-center justify-between py-1"><span className="text-slate-400">有效库存</span><span className="font-bold">{eff} 件</span></div>
                      <div className="flex items-center justify-between py-1"><span className="text-slate-400">有效建议补货量</span><span className="font-bold text-rose-600">{effNeed > 0 ? effNeed + ' 件' : '—'}</span></div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setDetailSku(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
