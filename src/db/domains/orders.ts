/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { InboundPlanLine, Order, PositionDemand } from '../../types';
import { generateUUID } from '../formatters';
import { formatters } from '../formatters';
import { KEYS } from '../defaults';

export const OrdersService = {


  // Orders CRUD
    getOrders(this: DBServiceApi): Order[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.ORDERS);
    const raw: Order[] = saved ? JSON.parse(saved) : [];
    // 兼容历史数据：无 lines 时按单 SKU 合成一行
    return raw.map(o => (o.lines && o.lines.length > 0)
      ? o
      : {
          ...o,
          lines: [{ sku: o.model, title: o.model, maxPerPallet: o.per_pallet || 1, qty: o.order_qty }]
        });
  },


    saveOrders(this: DBServiceApi, orders: Order[]) {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  },


    addOrder(this: DBServiceApi, orderNo: string, lines: InboundPlanLine[], meta?: { source?: 'manual' | 'purchase'; poNo?: string }): Order {
    const orders = this.getOrders();
    const upper = orderNo.trim().toUpperCase();
    if (!upper) throw new Error('计划编号不能为空！');
    if (!lines || lines.length === 0) throw new Error('请至少添加一个 SKU 行！');

    // Check uniqueness（跨表校验：自建计划编号不得与其它自建计划 / 采购单号重复）
    if (orders.some(o => o.order_no.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 已经存在！`);
    }
    if (this.getPurchaseOrders().some(p => p.poNo.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 与采购单号重复，请更换计划编号！`);
    }
    if (this.getPurchasePlanRows().some(r => r.poNo.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 与待收货采购单号重复，请更换计划编号！`);
    }

    const normalized = this.normalizePlanLines(lines);
    const totalQty = normalized.reduce((s, l) => s + l.qty, 0);
    const totalPallets = normalized.reduce((s, l) => s + Math.ceil(l.qty / l.maxPerPallet), 0);
    if (totalPallets > 2000) {
      throw new Error(`计划划分的卡位数量(${totalPallets}托)超过系统上限，请分批建单。`);
    }
    if (totalQty > 10000000) {
      throw new Error('计划总数量不能超过 10,000,000 Pcs，请确认数值是否正确！');
    }

    const customerCode = upper.length >= 4 ? upper.substring(0, 4) : upper;
    const newOrder: Order = {
      id: generateUUID(),
      order_no: upper,
      customer_code: customerCode.toUpperCase(),
      model: normalized.length === 1 ? normalized[0].title : `${normalized.length} 个SKU`,
      order_qty: totalQty,
      per_pallet: normalized[0].maxPerPallet,
      pallet_count: totalPallets,
      lines: normalized,
      source: meta?.source || 'manual',
      poNo: meta?.poNo,
      status: 'pending',
      created_at: formatters.dbDate()
    };

    orders.unshift(newOrder); // Newest first
    this.saveOrders(orders);

    // 派生卡板需求：每个 SKU 行按最大卡板容量向上拆托，一托只放一个 SKU
    const demands = this.getDemands();
    this.buildPlanDemands(newOrder, demands);
    this.saveDemands(demands);

    return newOrder;
  },


    deleteOrder(this: DBServiceApi, orderId: string): void {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('找不到该订单。');
    const order = orders[orderIndex];

    if (order.status !== 'pending') {
      throw new Error('仅允许删除处于“排单中”状态的订单。');
    }
    if (order.source === 'purchase') {
      throw new Error('该入库计划由采购单收货生成，不能删除；如需撤销请先回退采购单状态。');
    }

    // Delete order
    orders.splice(orderIndex, 1);
    this.saveOrders(orders);

    // Delete associated demands
    const demands = this.getDemands().filter(d => d.order_id !== orderId);
    this.saveDemands(demands);
  },


    updateOrder(this: DBServiceApi, orderId: string, orderNo: string, lines: InboundPlanLine[]): void {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('找不到该计划。');
    const order = orders[orderIndex];

    if (order.status !== 'pending') {
      throw new Error('仅允许修改处于“排单中”状态的计划。');
    }

    const upper = orderNo.trim().toUpperCase();
    if (!upper) throw new Error('计划编号不能为空！');
    if (!lines || lines.length === 0) throw new Error('请至少添加一个 SKU 行！');

    if (orders.some(o => o.id !== orderId && o.order_no.toUpperCase() === upper)) {
      throw new Error(`计划编号 ${orderNo} 已经存在！`);
    }

    const normalized = this.normalizePlanLines(lines);
    const totalQty = normalized.reduce((s, l) => s + l.qty, 0);
    const totalPallets = normalized.reduce((s, l) => s + Math.ceil(l.qty / l.maxPerPallet), 0);
    if (totalPallets > 2000) {
      throw new Error(`计划划分的卡位数量(${totalPallets}托)超过系统上限，请分批建单。`);
    }

    const customerCode = upper.length >= 4 ? upper.substring(0, 4) : upper;
    order.order_no = upper;
    order.customer_code = customerCode.toUpperCase();
    order.model = normalized.length === 1 ? normalized[0].title : `${normalized.length} 个SKU`;
    order.order_qty = totalQty;
    order.per_pallet = normalized[0].maxPerPallet;
    order.pallet_count = totalPallets;
    order.lines = normalized;

    this.saveOrders(orders);

    // 重建卡板需求
    const demands = this.getDemands().filter(d => d.order_id !== orderId);
    this.buildPlanDemands(order, demands);
    this.saveDemands(demands);
  },


  // Demands CRUD
    getDemands(this: DBServiceApi): PositionDemand[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.DEMANDS);
    return saved ? JSON.parse(saved) : [];
  },


    saveDemands(this: DBServiceApi, demands: PositionDemand[]) {
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
  },


  // Update order's status based on cumulative values
    updateOrderStatus(this: DBServiceApi, orderId: string) {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    const inbounds = this.getInbounds().filter(i => i.order_id === orderId);
    const outbounds = this.getOutbounds().filter(o => o.order_id === orderId);

    const sumInbound = inbounds.reduce((sum, i) => sum + i.actual_qty, 0);
    const sumOutbound = outbounds.reduce((sum, o) => sum + o.outbound_qty, 0);
    const stockBalance = sumInbound - sumOutbound;

    if (sumInbound === 0) {
      order.status = 'pending';
    } else if (sumInbound >= order.order_qty && stockBalance === 0) {
      order.status = 'completed';
    } else if (sumInbound < order.order_qty) {
      order.status = 'shortage'; // Missing or outstanding target qty
    } else {
      order.status = 'in_progress';
    }

    this.saveOrders(orders);
  },


  // Computed views for Orders (including aggregates)
    getOrdersWithMetrics(this: DBServiceApi) {
    const orders = this.getOrders();
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    return orders.map(o => {
      const oInbounds = inbounds.filter(i => i.order_id === o.id);
      const oOutbounds = outbounds.filter(ob => ob.order_id === o.id);

      const inboundQty = oInbounds.reduce((sum, i) => sum + i.actual_qty, 0);
      const outboundQty = oOutbounds.reduce((sum, ob) => sum + ob.outbound_qty, 0);
      const stockQty = inboundQty - outboundQty;
      const shortageQty = Math.max(0, o.order_qty - inboundQty);

      // Turn-around Days: last day of month vs first inbound date
      let turnoverDays = 0;
      if (stockQty > 0 && oInbounds.length > 0) {
        const firstInDate = new Date(Math.min(...oInbounds.map(i => new Date(i.inbound_date).getTime())));
        // Get end of current month
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const diffTime = Math.abs(endOfMonth.getTime() - firstInDate.getTime());
        turnoverDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        ...o,
        inbound_qty: inboundQty,
        shortage_qty: shortageQty,
        outbound_qty: outboundQty,
        stock_qty: stockQty,
        turnover_days: turnoverDays
      };
    });
  }
};
