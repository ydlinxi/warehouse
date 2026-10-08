/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { Inbound, Position, InventoryMonthRecord } from '../../types';

export const InventoryService = {


  // 商品级库存汇总：该商品下全部 SKU 的可售 / 待复检 / 不合格 / 在架物理 / 累计已出库
    computeItemStock(this: DBServiceApi, itemId: string) {
    const skus = this.getRawProductSkus().filter(s => s.itemId === itemId);
    const sum = { skuCount: skus.length, available: 0, pending: 0, reject: 0, physical: 0, shipped: 0 };
    skus.forEach(s => {
      const b = this.getSkuStockBreakdown(s.sku);
      sum.available += b.available; sum.pending += b.pending;
      sum.reject += b.reject; sum.physical += b.physical; sum.shipped += b.shipped;
    });
    return sum;
  },


  // Get current stock for an inbound ID
    getPositionStock(this: DBServiceApi, inboundId: string): number {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    const inbound = inbounds.find(i => i.id === inboundId);
    if (!inbound) return 0;

    const totalIn = inbound.actual_qty;
    const totalOut = outbounds
      .filter(o => o.inbound_id === inboundId)
      .reduce((sum, o) => sum + o.outbound_qty, 0);

    return Math.max(0, totalIn - totalOut);
  },


  // Position Matrix Generator
    getPositions(this: DBServiceApi): Position[] {
    const config = this.getWarehouseConfig();
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    // Map of position_code -> occupied data
    const occupiedMap = new Map<string, { inbound: Inbound; stock: number }>();

    inbounds.forEach(inb => {
      // Calculate current stock for this inbound
      const outs = outbounds.filter(o => o.inbound_id === inb.id).reduce((sum, o) => sum + o.outbound_qty, 0);
      const stock = inb.actual_qty - outs;
      if (stock > 0) {
        // Position has stock
        occupiedMap.set(inb.position_code, { inbound: inb, stock });
      }
    });

    const positions: Position[] = [];
    for (const zone of config.zones) {
      for (let r = 1; r <= zone.rows; r++) {
        for (let c = 1; c <= zone.cols; c++) {
          const rowStr = String(r).padStart(2, '0');
          const colStr = String(c).padStart(2, '0');
          const code = `${zone.code}${rowStr}-${colStr}`;

          const activeData = occupiedMap.get(code);

          if (activeData) {
            positions.push({
              code,
              zone: zone.code,
              row: r,
              col: c,
              status: 'occupied',
              order_id: activeData.inbound.order_id,
              order_no: activeData.inbound.order_no,
              model: activeData.inbound.model,
              sku: activeData.inbound.sku,
              qty: activeData.stock,
              quality: activeData.inbound.quality,
              inbound_id: activeData.inbound.id,
              inbound_date: activeData.inbound.inbound_date,
              seq: activeData.inbound.seq,
              line: activeData.inbound.line,
              handler: activeData.inbound.handler
            });
          } else {
            positions.push({
              code,
              zone: zone.code,
              row: r,
              col: c,
              status: 'available',
              order_id: null,
              order_no: null,
              model: null,
              sku: null,
              qty: null,
              quality: null,
              inbound_id: null,
              inbound_date: null,
              seq: null,
              line: null,
              handler: null
            });
          }
        }
      }
    }

    return positions;
  },


  // Core metrics for Dashboard / Header
    getOverallStats(this: DBServiceApi) {
    const positions = this.getPositions();
    const totalCapacity = positions.length;
    const occupiedCount = positions.filter(p => p.status === 'occupied').length;
    const availableCount = totalCapacity - occupiedCount;

    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    // Split stock by quality: OQC验Pass = sellable, others = frozen
    let sellableIn = 0, sellableOut = 0, frozenIn = 0, frozenOut = 0;
    inbounds.forEach(i => {
      const out = outbounds
        .filter(o => o.inbound_id === i.id)
        .reduce((s, o) => s + o.outbound_qty, 0);
      if (i.quality === 'OQC验Pass') {
        sellableIn += i.actual_qty;
        sellableOut += out;
      } else {
        frozenIn += i.actual_qty;
        frozenOut += out;
      }
    });
    const sumIn = sellableIn + frozenIn;
    const sumOut = sellableOut + frozenOut;
    const stockBalance = sumIn - sumOut;
    const sellableBalance = sellableIn - sellableOut;
    const frozenBalance = frozenIn - frozenOut;

    // Production-to-Sales Balance Rate = total outbound / total inbound (all time)
    const balanceRate = sumIn > 0 ? sumOut / sumIn : 0;

    // Shortage orders count (how many orders are lacking items)
    const ordersWithMetrics = this.getOrdersWithMetrics();
    const shortageOrdersCount = ordersWithMetrics.filter(o => o.shortage_qty > 0).length;

    // Average turnover days
    const activeTurnovers = ordersWithMetrics.filter(o => o.stock_qty > 0 && o.turnover_days > 0);
    const avgTurnoverDays = activeTurnovers.length > 0 
      ? Math.round(activeTurnovers.reduce((sum, o) => sum + o.turnover_days, 0) / activeTurnovers.length)
      : 0;

    // Full Warehouse Warning (爆仓预警)
    // Formula: 可用仓位 - Σ(各进行中订单未入库卡位数量) * (1 - 产销平衡率)
    const pendingPalletCount = ordersWithMetrics
      .filter(o => o.status === 'pending' || o.status === 'shortage' || o.status === 'in_progress')
      .reduce((sum, o) => {
        // Calculate how many pallets are still to be placed
        const completedPallets = inbounds.filter(i => i.order_id === o.id).length;
        const remainingPallets = Math.max(0, o.pallet_count - completedPallets);
        return sum + remainingPallets;
      }, 0);

    const warningFactor = pendingPalletCount * (1 - balanceRate);
    const warningIndex = availableCount - warningFactor;
    const isWarning = warningIndex < 0;

    return {
      totalCapacity,
      occupiedCount,
      availableCount,
      occupancyRate: totalCapacity > 0 ? (occupiedCount / totalCapacity) * 100 : 0,
      stockBalance,
      sellableBalance,
      frozenBalance,
      shortageOrdersCount,
      avgTurnoverDays,
      balanceRate,
      pendingPalletCount,
      warningIndex,
      isWarning,
      warningFactor
    };
  },


  // Monthly Report Generator (期初 + 本期入库 - 本期出库 = 期末)
    getMonthlyInventory(this: DBServiceApi, year: number, month: number): InventoryMonthRecord[] {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    // End date of last month
    const startOfMonthDate = new Date(year, month - 1, 1);
    const endOfMonthDate = new Date(year, month, 1);

    // Get unique combinations of (order_no, position_code) across all time
    const combinations = new Map<string, { order_no: string; position_code: string; model: string; sku?: string; quality: string }>();

    inbounds.forEach(i => {
      const key = `${i.order_no}||${i.position_code}`;
      if (!combinations.has(key)) {
        combinations.set(key, {
          order_no: i.order_no,
          position_code: i.position_code,
          model: i.model,
          sku: this.resolveSkuCode(i.model, i.sku),
          quality: i.quality
        });
      }
    });

    const records: InventoryMonthRecord[] = [];

    combinations.forEach((info) => {
      const orderInbounds = inbounds.filter(i => i.order_no === info.order_no && i.position_code === info.position_code);
      const orderOutbounds = outbounds.filter(o => o.order_no === info.order_no && o.position_code === info.position_code);

      // 1. Opening stock (cumulative In - cumulative Out before startOfMonthDate)
      const openingIn = orderInbounds
        .filter(i => new Date(i.inbound_date) < startOfMonthDate)
        .reduce((sum, i) => sum + i.actual_qty, 0);

      const openingOut = orderOutbounds
        .filter(o => new Date(o.outbound_date) < startOfMonthDate)
        .reduce((sum, o) => sum + o.outbound_qty, 0);

      const opening = Math.max(0, openingIn - openingOut);

      // 2. Current Month Inbound
      const currentIn = orderInbounds
        .filter(i => {
          const d = new Date(i.inbound_date);
          return d >= startOfMonthDate && d < endOfMonthDate;
        })
        .reduce((sum, i) => sum + i.actual_qty, 0);

      // 3. Current Month Outbound
      const currentOut = orderOutbounds
        .filter(o => {
          const d = new Date(o.outbound_date);
          return d >= startOfMonthDate && d < endOfMonthDate;
        })
        .reduce((sum, o) => sum + o.outbound_qty, 0);

      // 4. Closing balance
      const closing = opening + currentIn - currentOut;

      // Split closing by quality: OQC验Pass = sellable, others = frozen
      // 口径对齐：只统计月末截止日出库，保证 期末 = 可售 + 冻结
      let closingSellable = 0;
      let closingFrozen = 0;
      orderInbounds.forEach(i => {
        const out = outbounds
          .filter(o => o.inbound_id === i.id && new Date(o.outbound_date) < endOfMonthDate)
          .reduce((s, x) => s + x.outbound_qty, 0);
        const stock = Math.max(0, i.actual_qty - out);
        if (i.quality === 'OQC验Pass') closingSellable += stock;
        else closingFrozen += stock;
      });

      // Only display if there was any historical stock or active transactions in this month
      if (opening > 0 || currentIn > 0 || currentOut > 0 || closing > 0) {
        records.push({
          year,
          month,
          order_no: info.order_no,
          model: info.model,
          sku: info.sku,
          position_code: info.position_code,
          opening,
          inbound: currentIn,
          outbound: currentOut,
          closing,
          closingSellable,
          closingFrozen,
          quality: info.quality
        });
      }
    });

    return records;
  }
};
