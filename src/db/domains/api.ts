/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ProductModel, InboundPlanLine, Order, PositionDemand, Inbound, Outbound, PendingOutbound, Position, WarehouseConfig, InventoryMonthRecord, Supplier, ProductSku, PurchaseOrder, PurchasePlanRow, ReplenishPlan, ReplenishAlertPlan } from '../../types';

// DBService 聚合 facade 的类型契约：所有域服务方法的并集（静态属性已降级为模块常量，不在此列）。
export interface DBServiceApi {
  getWarehouseConfig(): WarehouseConfig;
  saveWarehouseConfig(config: WarehouseConfig): void;
  getModels(): ProductModel[];
  saveModels(models: ProductModel[]): void;
  getSuppliers(): Supplier[];
  saveSuppliers(list: Supplier[]): void;
  getRawItems(): ProductModel[];
  saveItems(list: ProductModel[]): void;
  nextItemId(offset?: number): string;
  itemIdByTitle(title: string): string | undefined;
  ensureItemMaster(): number;
  computeItemStock(itemId: string): { skuCount: number; available: number; pending: number; reject: number; physical: number; shipped: number; };
  getRawProductSkus(): ProductSku[];
  getProductSkus(): ProductSku[];
  nextSkuCode(supplierId: string, offset?: number): string;
  addProductSku(input: {
    supplierId: string; supplierName: string; title: string; price: number;
    itemId?: string; itemName?: string;
    perPallet?: number; replenishPoint?: number; abundanceThreshold?: number;
    emoji?: string; cat?: string; spec?: string; color?: string;
  }): ProductSku;
  resolveSkuCode(model?: string, skuField?: string): string | undefined;
  getSkuStockBreakdown(sku: string): { available: number; pending: number; reject: number; shipped: number; physical: number };
  computeSkuAvailableStock(): Record<string, number>;
  saveProductSkus(list: ProductSku[]): void;
  getReplenishPlans(): ReplenishPlan[];
  saveReplenishPlans(list: ReplenishPlan[]): void;
  getPurchaseOrders(): PurchaseOrder[];
  savePurchaseOrders(list: PurchaseOrder[]): void;
  getPurchasePlanRows(): PurchasePlanRow[];
  savePurchasePlanRows(list: PurchasePlanRow[]): void;
  syncPurchasePlanRows(): PurchasePlanRow[];
  receivePurchaseOrder(poNo: string): number;
  receivePurchaseOrderAsPlan(poNo: string, planNo: string, lines: InboundPlanLine[]): Order;
  payPurchaseOrder(poNo: string, info: { payMethod?: string; payNo?: string; paidAmt?: number; note?: string }): void;
  updatePurchaseOrder(poNo: string, patch: Partial<PurchaseOrder>): void;
  computeReplenishAlerts(skus: ProductSku[]): { mergedPlans: ReplenishAlertPlan[] };
  getLines(): string[];
  saveLines(lines: string[]): void;
  getHandlers(): string[];
  saveHandlers(handlers: string[]): void;
  purgeLegacySpuOrders(): number;
  migrateLegacySkuCodes(): void;
  ensureSeedProductSkus(): number;
  normalizeModelNames(): number;
  ensureDemoOrders(): number;
  stockSeedPosition(index: number): string;
  normalizeEcomPlatforms(): number;
  ensureDemoEcomOrders(): number;
  skuTitle(sku: string): string;
  ensureSeedStockLedger(): void;
  initDatabaseIfEmpty(): void;
  seedDatabase(): void;
  getOrders(): Order[];
  saveOrders(orders: Order[]): void;
  addOrder(orderNo: string, lines: InboundPlanLine[], meta?: { source?: 'manual' | 'purchase'; poNo?: string }): Order;
  normalizePlanLines(lines: InboundPlanLine[]): InboundPlanLine[];
  buildPlanDemands(order: Order, demands: PositionDemand[]): void;
  deleteOrder(orderId: string): void;
  updateOrder(orderId: string, orderNo: string, lines: InboundPlanLine[]): void;
  getDemands(): PositionDemand[];
  saveDemands(demands: PositionDemand[]): void;
  getInbounds(): Inbound[];
  saveInbounds(inbounds: Inbound[]): void;
  recordInbound(
    demandId: string,
    positionCode: string,
    date: string,
    actualQty: number,
    line: string,
    handler: string,
    quality: 'OQC验Pass' | '待复检' | '不合格',
    note: string
  ): Inbound;
  updateInbound(
    inboundId: string,
    updates: {
      positionCode?: string;
      actualQty?: number;
      inboundDate?: string;
      line?: string;
      handler?: string;
      quality?: 'OQC验Pass' | '待复检' | '不合格';
      note?: string;
    }
  ): Inbound;
  disposeInbound(inboundId: string, disposal: '让步接收' | '退货' | '报废'): void;
  deleteInbound(inboundId: string): void;
  getOutbounds(): Outbound[];
  saveOutbounds(outbounds: Outbound[]): void;
  recordOutbound(
    inboundId: string,
    outboundDate: string,
    outboundQty: number,
    handler: string,
    note: string
  ): Outbound;
  deleteOutbound(outboundId: string): void;
  getPendingOutbounds(): PendingOutbound[];
  savePendingOutbounds(list: PendingOutbound[]): void;
  receiveEcomOrder(): PendingOutbound;
  fulfillPendingOutbound(id: string, handler: string): Outbound[];
  fulfillPendingOutboundWithAllocations(
    id: string,
    handler: string,
    allocations: { inboundId: string; qty: number }[]
  ): Outbound[];
  getPositionStock(inboundId: string): number;
  updateOrderStatus(orderId: string): void;
  getOrdersWithMetrics(): { inbound_qty: number; shortage_qty: number; outbound_qty: number; stock_qty: number; turnover_days: number; id: string; order_no: string; customer_code: string; model: string; order_qty: number; per_pallet: number; pallet_count: number; lines?: InboundPlanLine[]; source?: "manual" | "purchase"; poNo?: string; status: "pending" | "in_progress" | "completed" | "shortage" | "pending_receipt"; created_at: string; }[];
  getPositions(): Position[];
  getOverallStats(): { totalCapacity: number; occupiedCount: number; availableCount: number; occupancyRate: number; stockBalance: number; sellableBalance: number; frozenBalance: number; shortageOrdersCount: number; avgTurnoverDays: number; balanceRate: number; pendingPalletCount: number; warningIndex: number; isWarning: boolean; warningFactor: number; };
  getMonthlyInventory(year: number, month: number): InventoryMonthRecord[];
  resetToDefault(): void;
  resetDatabase(): void;
}
