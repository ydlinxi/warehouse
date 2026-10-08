/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { InboundPlanLine, Order, PurchaseOrder, PurchasePlanRow } from '../../types';
import { generateUUID } from '../formatters';
import { formatters } from '../formatters';
import { KEYS } from '../defaults';

export const PurchaseService = {


    getPurchaseOrders(this: DBServiceApi): PurchaseOrder[] {
    const saved = localStorage.getItem(KEYS.PURCHASE_ORDERS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  },


    savePurchaseOrders(this: DBServiceApi, list: PurchaseOrder[]) {
    localStorage.setItem(KEYS.PURCHASE_ORDERS, JSON.stringify(list));
  },


  // 采购入库计划行（待收货建卡板）——由采购单状态派生并落库
    getPurchasePlanRows(this: DBServiceApi): PurchasePlanRow[] {
    const saved = localStorage.getItem(KEYS.PURCHASE_PLAN_ROWS);
    if (saved === null) return this.syncPurchasePlanRows();
    try { return JSON.parse(saved); } catch (e) { return this.syncPurchasePlanRows(); }
  },


    savePurchasePlanRows(this: DBServiceApi, list: PurchasePlanRow[]) {
    localStorage.setItem(KEYS.PURCHASE_PLAN_ROWS, JSON.stringify(list));
  },


  // 按采购单状态重建计划行：待收货 → 每个 SKU 一行；其余状态不生成
  // 每行的卡位数量 = CEIL(需求 / 单托容量)，一个托只放一个 SKU
    syncPurchasePlanRows(this: DBServiceApi): PurchasePlanRow[] {
    const skus = this.getProductSkus();
    const rows: PurchasePlanRow[] = [];
    this.getPurchaseOrders()
      .filter(p => p.status === '待收货')
      .forEach(po => {
        po.items.forEach(item => {
          const perPallet = Math.max(1, skus.find(s => s.sku === item.sku)?.perPallet || 100);
          const palletCount = Math.max(1, Math.ceil(item.need / perPallet));
          rows.push({
            id: `plan-${po.poNo}-${item.sku}`,
            poNo: po.poNo,
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            sku: item.sku,
            model: item.title,
            need: item.need,
            perPallet,
            palletCount,
            status: '待收货建卡板',
            createdAt: po.createdAt
          });
        });
      });
    this.savePurchasePlanRows(rows);
    return rows;
  },


  // 采购单收货确认：货到厂，状态置为已收货，并生成「入库计划（待分配需求行）」，
  // 由仓管到「入库管理 → 待入库卡位分配」分配仓位、质检后再上架，不再直接占仓。
  // 返回生成的入库计划行数。
    receivePurchaseOrder(this: DBServiceApi, poNo: string): number {
    const list = this.getPurchaseOrders();
    const target = list.find(p => p.poNo === poNo);
    if (!target) return 0;
    if (target.status === '已收货') return 0;

    // 货到厂 → 生成入库计划（卡板需求），库存由仓位账本（上架入库）实时推导，此处不再直接改 SKU 库存
    const demands = this.getDemands();
    let palletTotal = 0;

    target.items.forEach(item => {
      const perPallet = Math.max(1, this.getRawProductSkus().find(s => s.sku === item.sku)?.perPallet || 100);
      const palletCount = Math.max(1, Math.ceil(item.need / perPallet));
      let remain = item.need;
      for (let i = 0; i < palletCount; i++) {
        const qty = Math.min(perPallet, remain);
        remain -= qty;
        palletTotal += 1;
        demands.push({
          id: generateUUID(),
          order_id: target.poNo,
          order_no: target.poNo,
          sku: item.sku,
          model: item.title,
          product: item.title,
          source: 'purchase',
          seq: palletTotal,
          position_code: null,
          inbound_id: null,
          planned_qty: qty,
          maxPerPallet: perPallet
        });
      }
    });

    this.saveDemands(demands);

    target.status = '已收货';
    target.receivedAt = formatters.dbDate();
    this.savePurchaseOrders(list);
    // 已收货 → 移除对应的待收货建卡板计划行
    this.syncPurchasePlanRows();

    return palletTotal;
  },


  // 采购单确认收货 → 创建入库计划（带 SKU 行，弹窗可调整卡板容量/数量），并推进采购单为已收货
    receivePurchaseOrderAsPlan(this: DBServiceApi, poNo: string, planNo: string, lines: InboundPlanLine[]): Order {
    const list = this.getPurchaseOrders();
    const target = list.find(p => p.poNo === poNo);
    if (!target) throw new Error('找不到该采购单');
    if (target.status === '已收货') throw new Error('该采购单已收货');

    // 创建入库计划（并派生卡板需求）；库存由仓位账本（上架入库）实时推导
    const order = this.addOrder(planNo, lines, { source: 'purchase', poNo });

    // 采购单推进为已收货，并移除待收货计划行
    target.status = '已收货';
    target.receivedAt = formatters.dbDate();
    this.savePurchaseOrders(list);
    this.syncPurchasePlanRows();

    return order;
  },


  // 采购单付款：待采购 → 已付款（登记付款方式 / 流水号 / 实付金额），付款后明细锁定
    payPurchaseOrder(this: DBServiceApi, poNo: string, info: { payMethod?: string; payNo?: string; paidAmt?: number; note?: string }) {
    const list = this.getPurchaseOrders();
    const idx = list.findIndex(p => p.poNo === poNo);
    if (idx === -1) throw new Error('找不到该采购单');
    if (list[idx].status !== '待采购') throw new Error(`仅「待采购」状态的采购单可付款，当前为「${list[idx].status}」`);
    const paid = Number(info.paidAmt);
    list[idx] = {
      ...list[idx],
      status: '已付款',
      payMethod: info.payMethod || list[idx].payMethod,
      payNo: info.payNo,
      paidAmt: isNaN(paid) || paid <= 0 ? list[idx].totalAmt : paid,
      paidAt: formatters.dbDate(),
      note: info.note !== undefined ? info.note : list[idx].note
    };
    this.savePurchaseOrders(list);
    // 付款不生成建卡板计划行（仍以「待收货」为准）
    this.syncPurchasePlanRows();
  },


  // 修改采购单可编辑字段（状态推进、明细调整等），已收货后调用方应禁止
    updatePurchaseOrder(this: DBServiceApi, poNo: string, patch: Partial<PurchaseOrder>) {
    const list = this.getPurchaseOrders();
    const idx = list.findIndex(p => p.poNo === poNo);
    if (idx === -1) throw new Error('找不到该采购单');
    list[idx] = { ...list[idx], ...patch };
    this.savePurchaseOrders(list);
    // 状态变化后同步「待收货建卡板」计划行
    this.syncPurchasePlanRows();
  }
};
