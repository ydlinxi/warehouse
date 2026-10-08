/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { ProductSku, ReplenishPlan, ReplenishAlertPlan } from '../../types';
import { safeNum } from '../formatters';
import { KEYS } from '../defaults';

export const ReplenishService = {


    getReplenishPlans(this: DBServiceApi): ReplenishPlan[] {
    const saved = localStorage.getItem(KEYS.REPLENISH_PLANS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  },


    saveReplenishPlans(this: DBServiceApi, list: ReplenishPlan[]) {
    localStorage.setItem(KEYS.REPLENISH_PLANS, JSON.stringify(list));
  },


  // 按供应商合并补货：stock≤补货值 触发，同供应商 stock<充裕值 合并。
  // 计算时扣除「未结案采购单」的覆盖量，避免提交采购单后重复生成；待确认计划作为草稿不计入。
    computeReplenishAlerts(this: DBServiceApi, skus: ProductSku[]): { mergedPlans: ReplenishAlertPlan[] } {
    const suppliers = this.getSuppliers();

    // 覆盖量 = 在途 + 已到厂未上架，避免提交采购单/收货后重复生成补货计划。
    // 注意：「待确认」补货计划本身只是草稿，生成时会被覆盖/清除，因此不计入，避免重复或漏单。
    const coverage: Record<string, number> = {};
    const addCov = (skuCode: string, qty: number) => { if (skuCode) coverage[skuCode] = (coverage[skuCode] || 0) + qty; };

    const inbounds = this.getInbounds();
    this.getPurchaseOrders().forEach(po => {
      if (['待采购', '已付款', '待收货'].includes(po.status)) {
        // 在途：货未到厂，按需求全额覆盖
        po.items.forEach(it => addCov(it.sku, safeNum(it.need)));
      } else if (po.status === '已收货') {
        // 已到厂未上架：需求 - 已上架入库量，避免入库上架完成前误判为缺货
        const recordedBySku: Record<string, number> = {};
        inbounds.filter(i => i.order_id === po.poNo).forEach(i => {
          const code = this.resolveSkuCode(i.model, i.sku);
          if (code) recordedBySku[code] = (recordedBySku[code] || 0) + safeNum(i.actual_qty);
        });
        po.items.forEach(it => {
          const pending = Math.max(0, safeNum(it.need) - (recordedBySku[it.sku] || 0));
          if (pending > 0) addCov(it.sku, pending);
        });
      }
    });

    const groups = new Map<string, ProductSku[]>();
    skus.forEach(s => {
      if (!groups.has(s.supplierId)) groups.set(s.supplierId, []);
      groups.get(s.supplierId)!.push(s);
    });
    const mergedPlans: ReplenishAlertPlan[] = [];
    groups.forEach((items, sid) => {
      const evaluated = items.map(s => {
        const effStock = s.stock + (coverage[s.sku] || 0);
        const need = Math.max(0, s.abundanceThreshold - effStock);
        return { ...s, effectiveStock: effStock, effectiveNeed: need };
      });
      const triggers = evaluated.filter(s => s.effectiveStock <= s.replenishPoint && s.effectiveNeed > 0);
      if (triggers.length === 0) return; // 没有真正需要补货的SKU
      const merged = evaluated.filter(s => s.effectiveStock > s.replenishPoint && s.effectiveStock < s.abundanceThreshold && s.effectiveNeed > 0);
      const planItems = [...triggers, ...merged].map(s => ({
        sku: s.sku, title: s.title, emoji: s.emoji, spec: s.spec,
        stock: s.stock, effectiveStock: s.effectiveStock, replenishPoint: s.replenishPoint, abundanceThreshold: s.abundanceThreshold,
        need: s.effectiveNeed
      }));
      const sup = suppliers.find(x => x.id === sid);
      mergedPlans.push({
        supplier: sup ? { id: sup.id, name: sup.name, location: sup.location, moq: sup.moq } : { id: sid, name: '—', location: '—', moq: '—' },
        items: planItems
      });
    });
    return { mergedPlans };
  }
};
