/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { AlertTriangle, PackagePlus, FileText } from 'lucide-react';
import { DBService, formatters } from '../db';
import { ProductSku, PurchaseOrder, ReplenishPlan, ReplenishPlanItem } from '../types';
import { BuiltPlan, PlanPreview, PoDraft, genPlanId, safeNum, unitPrice } from './replenish/helpers';
import { ReplenishAlertsPanel } from './replenish/ReplenishAlertsPanel';
import { ReplenishPlansPanel } from './replenish/ReplenishPlansPanel';
import { PlanPreviewModal } from './replenish/PlanPreviewModal';
import { GeneratePoModal } from './replenish/GeneratePoModal';
import { SkuDetailModal } from './replenish/SkuDetailModal';

export const ReplenishManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alert' | 'plan'>('alert');
  const [skus, setSkus] = useState<ProductSku[]>(() => DBService.getProductSkus());
  const [plans, setPlans] = useState<ReplenishPlan[]>(() => DBService.getReplenishPlans());
  const [previewModal, setPreviewModal] = useState<PlanPreview | null>(null);
  const [poPlan, setPoPlan] = useState<ReplenishPlan | null>(null);
  const [detailSku, setDetailSku] = useState<ProductSku | null>(null);

  const persistSkus = (next: ProductSku[]) => { setSkus(next); DBService.saveProductSkus(next); };
  const persistPlans = (next: ReplenishPlan[]) => { setPlans(next); DBService.saveReplenishPlans(next); };

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
    plans.filter(p => p.status === '待确认').forEach(p => (p.items || []).forEach((it: ReplenishPlanItem) => {
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
  const skuTotal = plans.reduce((s: number, p: ReplenishPlan) => s + (p.items || []).length, 0);

  const onThresholdEdit = (sku: string, field: 'replenishPoint' | 'abundanceThreshold', value: number) => {
    persistSkus(skus.map(p => p.sku === sku ? { ...p, [field]: value } : p));
  };

  // ===== 一键生成补货计划：预览确认 =====
  const buildPlansFromAlerts = () => {
    const { mergedPlans } = DBService.computeReplenishAlerts(skus);
    return (mergedPlans || []).map((mp): BuiltPlan => {
      const sup = mp.supplier;
      const items: ReplenishPlanItem[] = (mp.items || []).map(it => ({
        sku: it.sku, title: it.title || '', emoji: it.emoji || '', spec: it.spec || '',
        stock: safeNum(it.stock), effectiveStock: safeNum(it.effectiveStock), replenishPoint: safeNum(it.replenishPoint), abundanceThreshold: safeNum(it.abundanceThreshold),
        need: safeNum(it.need) > 0 ? safeNum(it.need) : Math.max(safeNum(it.abundanceThreshold) - safeNum(it.stock), 1),
        price: unitPrice(it), isTrigger: safeNum(it.effectiveStock ?? it.stock) <= safeNum(it.replenishPoint)
      }));
      const totalQty = items.reduce((s: number, x) => s + x.need, 0);
      const totalAmt = items.reduce((s: number, x) => s + x.need * x.price, 0);
      const trigger: Partial<ReplenishPlanItem> = items.find(x => x.isTrigger) || {};
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
    built.forEach(b => { b._mode = store.find(p => p.supplierId === b.supplierId && p.status === '待确认') ? '覆盖更新' : '新建'; });
    const createCnt = built.filter(b => b._mode === '新建').length;
    const updateCnt = built.length - createCnt;
    const grandQty = built.reduce((s: number, b) => s + b.totalQty, 0);
    const grandAmt = built.reduce((s: number, b) => s + b.totalAmt, 0);
    setPreviewModal({ built, createCnt, updateCnt, grandQty, grandAmt });
  };

  // 覆盖更新幂等：同供应商已有「待确认」计划 → 保留编号覆盖更新；
  // 若某供应商已没有需要补货的SKU（被采购单/旧计划覆盖），清除其待确认旧计划。
  const confirmGeneratePlans = () => {
    if (!previewModal) return;
    const { built } = previewModal;
    const store = DBService.getReplenishPlans();
    const builtSupplierIds = new Set(built.map(b => b.supplierId));
    const next: ReplenishPlan[] = store.filter(p => p.status !== '待确认' || builtSupplierIds.has(p.supplierId));
    const removed = store.length - next.length;
    let created = 0, updated = 0;
    const now = formatters.dbDate();
    built.forEach(b => {
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
  const submitPurchaseOrder = (m: PoDraft) => {
    const po: PurchaseOrder = {
      poNo: m.poNo, supplierId: m.supplierId, supplierName: m.supplierName,
      items: m.items.map((it: ReplenishPlanItem) => ({ sku: it.sku, title: it.title, need: it.need, price: it.price })),
      totalQty: m.items.reduce((s: number, x: ReplenishPlanItem) => s + x.need, 0),
      totalAmt: m.items.reduce((s: number, x: ReplenishPlanItem) => s + x.need * x.price, 0),
      status: '待采购', createdAt: formatters.dbDate(),
      expectDate: m.expectDate, payMethod: m.payMethod, note: m.note
    };
    const all = DBService.getPurchaseOrders(); all.push(po); DBService.savePurchaseOrders(all);
    persistPlans(plans.map((p): ReplenishPlan => p.id === m.id ? { ...p, status: '已生成采购单', poNo: po.poNo } : p));
    setPoPlan(null);
  };

  const voidPlan = (id: string) => {
    if (!window.confirm('确认作废该补货计划？作废后将从列表移除，可重新一键生成。')) return;
    persistPlans(plans.filter(p => p.id !== id));
  };

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
        <ReplenishAlertsPanel
          skus={skus}
          inFlightMap={inFlightMap}
          kpis={{ needReplenishCount, abundantCount, involvedSups, planTotal, pending, submitted }}
          itemNameOf={itemNameOf}
          supplierNameOf={supplierNameOf}
          onThresholdEdit={onThresholdEdit}
          onDetail={setDetailSku}
        />
      ) : (
        <ReplenishPlansPanel
          plans={plans}
          kpis={{ planTotal, pending, submitted, skuTotal }}
          onGenerate={genAllPlans}
          onOpenPo={setPoPlan}
          onVoid={voidPlan}
        />
      )}

      {/* ===== 生成补货计划：预览确认弹窗 ===== */}
      {previewModal && (
        <PlanPreviewModal
          preview={previewModal}
          onConfirm={confirmGeneratePlans}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {/* ===== 生成采购单弹窗（预交货日 / 付款方式 / 备注 / 可调补货量） ===== */}
      {poPlan && (
        <GeneratePoModal
          plan={poPlan}
          onSubmit={submitPurchaseOrder}
          onClose={() => setPoPlan(null)}
        />
      )}

      {/* ===== SKU 详情弹窗 ===== */}
      {detailSku && (
        <SkuDetailModal
          sku={detailSku}
          inFlightMap={inFlightMap}
          itemNameOf={itemNameOf}
          supplierNameOf={supplierNameOf}
          onClose={() => setDetailSku(null)}
        />
      )}
    </div>
  );
};
