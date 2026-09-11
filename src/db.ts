/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Order,
  PositionDemand,
  Inbound,
  Outbound,
  Position,
  WarehouseConfig,
  ProductModel,
  InventoryMonthRecord
} from './types';

// Helper to generate UUIDs
export function generateUUID(): string {
  return 'idx_' + Math.random().toString(36).substring(2, 15);
}

// Default static lists
export const DEFAULT_MODELS: ProductModel[] = [
  { name: 'PRO-X1', default_per_pallet: 100 },
  { name: 'MX-400', default_per_pallet: 80 },
  { name: 'LITE-A', default_per_pallet: 150 },
  { name: 'MAX-90', default_per_pallet: 50 },
];

export const DEFAULT_LINES = ['线别A-01', '线别A-02', '线别B-01', '线别B-02', '线别C-01'];
export const DEFAULT_HANDLERS = ['张敏', '刘杰', '王强', '陈芳', '赵磊'];
export const QUALITY_OPTIONS = ['OQC验Pass', '待复检', '不合格'] as const;

// Storage keys
const KEYS = {
  ORDERS: 'fg_inventory_orders',
  DEMANDS: 'fg_inventory_demands',
  INBOUNDS: 'fg_inventory_inbounds',
  OUTBOUNDS: 'fg_inventory_outbounds',
  WAREHOUSE_CONFIG: 'fg_inventory_warehouse_config',
  MODELS: 'fg_inventory_models',
  LINES: 'fg_inventory_lines',
  HANDLERS: 'fg_inventory_handlers'
};

// Formatter Utilities
export const formatters = {
  // Rmb currency format
  currency: (amount: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(amount);
  },
  // Number with thousands separators
  number: (num: number, fractionDigits = 0) => {
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(num);
  },
  // Date format yyyy/mm/dd
  date: (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  },
  // DB date format yyyy-mm-dd
  dbDate: (date: Date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

export class DBService {
  // Load config with multi-zone support and auto-migration
  static getWarehouseConfig(): WarehouseConfig {
    const default_config: WarehouseConfig = {
      zones: [
        { code: 'A', rows: 70, cols: 20 },
        { code: 'B', rows: 70, cols: 20 }
      ]
    };
    const saved = localStorage.getItem(KEYS.WAREHOUSE_CONFIG);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if old format where zones is just a string array
        if (parsed.zones && Array.isArray(parsed.zones) && (parsed.zones.length === 0 || typeof parsed.zones[0] === 'string')) {
          const migratedZones = parsed.zones.map((zCode: any) => ({
            code: String(zCode),
            rows: parsed.rows || 70,
            cols: parsed.cols || 20
          }));
          const migrated: WarehouseConfig = { zones: migratedZones };
          localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(migrated));
          return migrated;
        }
        return parsed;
      } catch (e) {
        return default_config;
      }
    }
    localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(default_config));
    return default_config;
  }

  static saveWarehouseConfig(config: WarehouseConfig) {
    localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(config));
  }

  // Load Models
  static getModels(): ProductModel[] {
    const saved = localStorage.getItem(KEYS.MODELS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    localStorage.setItem(KEYS.MODELS, JSON.stringify(DEFAULT_MODELS));
    return DEFAULT_MODELS;
  }

  static saveModels(models: ProductModel[]) {
    localStorage.setItem(KEYS.MODELS, JSON.stringify(models));
  }

  // Load Lines
  static getLines(): string[] {
    const saved = localStorage.getItem(KEYS.LINES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    localStorage.setItem(KEYS.LINES, JSON.stringify(DEFAULT_LINES));
    return DEFAULT_LINES;
  }

  static saveLines(lines: string[]) {
    localStorage.setItem(KEYS.LINES, JSON.stringify(lines));
  }

  // Load Handlers
  static getHandlers(): string[] {
    const saved = localStorage.getItem(KEYS.HANDLERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    localStorage.setItem(KEYS.HANDLERS, JSON.stringify(DEFAULT_HANDLERS));
    return DEFAULT_HANDLERS;
  }

  static saveHandlers(handlers: string[]) {
    localStorage.setItem(KEYS.HANDLERS, JSON.stringify(handlers));
  }

  // Init Data with realistic default records
  static initDatabaseIfEmpty() {
    if (localStorage.getItem(KEYS.ORDERS)) return;

    // Pre-populate realistic historical orders, demands, inbounds, outbounds
    const orders: Order[] = [];
    const demands: PositionDemand[] = [];
    const inbounds: Inbound[] = [];
    const outbounds: Outbound[] = [];

    // Order 1: PO260701 - PRO-X1 (Partially shipped)
    // Order quantity: 500, per pallet: 100, pallet_count: 5.
    // 5 pallets received in July 2026. 4 pallets shipped in July/Aug 2026. 1 pallet remains.
    const order1Id = 'order_001';
    const o1: Order = {
      id: order1Id,
      order_no: 'PO260701',
      customer_code: 'PO26',
      model: 'PRO-X1',
      order_qty: 500,
      per_pallet: 100,
      pallet_count: 5,
      status: 'in_progress',
      created_at: '2026-07-02'
    };
    orders.push(o1);

    // Generate 5 demands for O1 and record full inbounds
    const o1InboundDates = ['2026-07-03', '2026-07-03', '2026-07-04', '2026-07-04', '2026-07-05'];
    const o1Positions = ['A01-01', 'A01-02', 'A01-03', 'A01-04', 'A01-05'];
    for (let i = 1; i <= 5; i++) {
      const demandId = `demand_o1_${i}`;
      const inboundId = `inbound_o1_${i}`;
      demands.push({
        id: demandId,
        order_id: order1Id,
        order_no: o1.order_no,
        model: o1.model,
        seq: i,
        position_code: o1Positions[i - 1],
        inbound_id: inboundId
      });

      inbounds.push({
        id: inboundId,
        order_id: order1Id,
        order_no: o1.order_no,
        model: o1.model,
        seq: i,
        position_code: o1Positions[i - 1],
        inbound_date: o1InboundDates[i - 1],
        actual_qty: 100,
        line: '线别A-01',
        handler: '张敏',
        quality: 'OQC验Pass',
        note: '按时交付'
      });
    }

    // Records 4 outbounds for Order 1 (3 in July, 1 in August)
    outbounds.push({
      id: 'outbound_o1_1',
      inbound_id: 'inbound_o1_1',
      order_id: order1Id,
      order_no: o1.order_no,
      model: o1.model,
      position_code: 'A01-01',
      outbound_date: '2026-07-15',
      outbound_qty: 100,
      handler: '刘杰',
      note: '出货给客户'
    });
    outbounds.push({
      id: 'outbound_o1_2',
      inbound_id: 'inbound_o1_2',
      order_id: order1Id,
      order_no: o1.order_no,
      model: o1.model,
      position_code: 'A01-02',
      outbound_date: '2026-07-20',
      outbound_qty: 100,
      handler: '刘杰',
      note: '出货给客户'
    });
    outbounds.push({
      id: 'outbound_o1_3',
      inbound_id: 'inbound_o1_3',
      order_id: order1Id,
      order_no: o1.order_no,
      model: o1.model,
      position_code: 'A01-03',
      outbound_date: '2026-07-25',
      outbound_qty: 100,
      handler: '刘杰',
      note: '出货给客户'
    });
    outbounds.push({
      id: 'outbound_o1_4',
      inbound_id: 'inbound_o1_4',
      order_id: order1Id,
      order_no: o1.order_no,
      model: o1.model,
      position_code: 'A01-04',
      outbound_date: '2026-08-10',
      outbound_qty: 100,
      handler: '王强',
      note: '出货给客户'
    });

    // Order 2: PO260810 - MX-400 (Fully stored, no shipments yet)
    // Quantity: 240, per pallet: 80, pallet_count: 3
    const order2Id = 'order_002';
    const o2: Order = {
      id: order2Id,
      order_no: 'PO260810',
      customer_code: 'PO26',
      model: 'MX-400',
      order_qty: 240,
      per_pallet: 80,
      pallet_count: 3,
      status: 'in_progress',
      created_at: '2026-08-10'
    };
    orders.push(o2);

    const o2Positions = ['B02-01', 'B02-02', 'B02-03'];
    for (let i = 1; i <= 3; i++) {
      const demandId = `demand_o2_${i}`;
      const inboundId = `inbound_o2_${i}`;
      demands.push({
        id: demandId,
        order_id: order2Id,
        order_no: o2.order_no,
        model: o2.model,
        seq: i,
        position_code: o2Positions[i - 1],
        inbound_id: inboundId
      });

      inbounds.push({
        id: inboundId,
        order_id: order2Id,
        order_no: o2.order_no,
        model: o2.model,
        seq: i,
        position_code: o2Positions[i - 1],
        inbound_date: '2026-08-12',
        actual_qty: 80,
        line: '线别B-01',
        handler: '陈芳',
        quality: i === 3 ? '待复检' : 'OQC验Pass', // one is quality-checking
        note: '批量入库'
      });
    }

    // Order 3: PO260815 - LITE-A (Completely outstanding / pending)
    // Quantity: 300, per_pallet: 150, pallet_count: 2
    const order3Id = 'order_003';
    const o3: Order = {
      id: order3Id,
      order_no: 'PO260815',
      customer_code: 'PO26',
      model: 'LITE-A',
      order_qty: 300,
      per_pallet: 150,
      pallet_count: 2,
      status: 'pending',
      created_at: '2026-08-15'
    };
    orders.push(o3);

    for (let i = 1; i <= 2; i++) {
      demands.push({
        id: `demand_o3_${i}`,
        order_id: order3Id,
        order_no: o3.order_no,
        model: o3.model,
        seq: i,
        position_code: null,
        inbound_id: null
      });
    }

    // Save to localStorage
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
  }

  // Orders CRUD
  static getOrders(): Order[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.ORDERS);
    return saved ? JSON.parse(saved) : [];
  }

  static saveOrders(orders: Order[]) {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  }

  static addOrder(orderNo: string, model: string, orderQty: number, perPallet: number): Order {
    const orders = this.getOrders();
    
    // Check uniqueness
    if (orders.some(o => o.order_no.toUpperCase() === orderNo.toUpperCase())) {
      throw new Error(`订单号 ${orderNo} 已经存在！`);
    }

    const palletCount = Math.ceil(orderQty / perPallet);
    
    // Safety check to prevent memory issues
    if (palletCount > 2000) {
      throw new Error(`订单划分的卡位数量(${palletCount}托)超过系统上限，请分批建单。`);
    }

    const customerCode = orderNo.length >= 4 ? orderNo.substring(0, 4) : orderNo;

    const newOrder: Order = {
      id: generateUUID(),
      order_no: orderNo.toUpperCase(),
      customer_code: customerCode.toUpperCase(),
      model,
      order_qty: orderQty,
      per_pallet: perPallet,
      pallet_count: palletCount,
      status: 'pending',
      created_at: formatters.dbDate()
    };

    orders.unshift(newOrder); // Newest first
    this.saveOrders(orders);

    // Derive position demands
    const demands = this.getDemands();
    for (let i = 1; i <= palletCount; i++) {
      demands.push({
        id: generateUUID(),
        order_id: newOrder.id,
        order_no: newOrder.order_no,
        model: newOrder.model,
        seq: i,
        position_code: null,
        inbound_id: null
      });
    }
    this.saveDemands(demands);

    return newOrder;
  }

  static deleteOrder(orderId: string): void {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('找不到该订单。');
    const order = orders[orderIndex];

    if (order.status !== 'pending') {
      throw new Error('仅允许删除处于“排单中”状态的订单。');
    }

    // Delete order
    orders.splice(orderIndex, 1);
    this.saveOrders(orders);

    // Delete associated demands
    const demands = this.getDemands().filter(d => d.order_id !== orderId);
    this.saveDemands(demands);
  }

  static updateOrder(orderId: string, orderNo: string, model: string, orderQty: number, perPallet: number): void {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) throw new Error('找不到该订单。');
    const order = orders[orderIndex];

    if (order.status !== 'pending') {
      throw new Error('仅允许修改处于“排单中”状态的订单。');
    }

    if (orders.some(o => o.id !== orderId && o.order_no.toUpperCase() === orderNo.toUpperCase())) {
      throw new Error(`订单号 ${orderNo} 已经存在！`);
    }

    const palletCount = Math.ceil(orderQty / perPallet);
    if (palletCount > 2000) {
      throw new Error(`订单划分的卡位数量(${palletCount}托)超过系统上限，请分批建单。`);
    }

    const customerCode = orderNo.length >= 4 ? orderNo.substring(0, 4) : orderNo;

    order.order_no = orderNo.toUpperCase();
    order.customer_code = customerCode.toUpperCase();
    order.model = model;
    order.order_qty = orderQty;
    order.per_pallet = perPallet;
    order.pallet_count = palletCount;

    this.saveOrders(orders);

    // Recreate demands since count or orderNo/model changed
    let demands = this.getDemands().filter(d => d.order_id !== orderId);
    for (let i = 1; i <= palletCount; i++) {
      demands.push({
        id: generateUUID(),
        order_id: order.id,
        order_no: order.order_no,
        model: order.model,
        seq: i,
        position_code: null,
        inbound_id: null
      });
    }
    this.saveDemands(demands);
  }

  // Demands CRUD
  static getDemands(): PositionDemand[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.DEMANDS);
    return saved ? JSON.parse(saved) : [];
  }

  static saveDemands(demands: PositionDemand[]) {
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
  }

  // Inbounds CRUD
  static getInbounds(): Inbound[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.INBOUNDS);
    return saved ? JSON.parse(saved) : [];
  }

  static saveInbounds(inbounds: Inbound[]) {
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
  }

  static recordInbound(
    demandId: string,
    positionCode: string,
    date: string,
    actualQty: number,
    line: string,
    handler: string,
    quality: 'OQC验Pass' | '待复检' | '不合格',
    note: string
  ): Inbound {
    const demands = this.getDemands();
    const demandIndex = demands.findIndex(d => d.id === demandId);
    if (demandIndex === -1) {
      throw new Error(`找不到匹配的仓位需求行！`);
    }
    const demand = demands[demandIndex];

    // Check position code exists and matches rules
    const config = this.getWarehouseConfig();
    const codeMatch = positionCode.match(/^([A-Z])(\d{2})-(\d{2})$/);
    if (!codeMatch) {
      throw new Error(`仓位码格式不合法。应该形如: A01-02`);
    }
    const [_, zone, rowStr, colStr] = codeMatch;
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    const targetZone = config.zones.find(z => z.code === zone);
    if (!targetZone) {
      throw new Error(`区域 ${zone} 在系统配置中未定义`);
    }
    if (row < 1 || row > targetZone.rows) {
      throw new Error(`排数 ${row} 超出区域 ${zone} 的范围 (1-${targetZone.rows})`);
    }
    if (col < 1 || col > targetZone.cols) {
      throw new Error(`列数 ${col} 超出区域 ${zone} 的范围 (1-${targetZone.cols})`);
    }

    // Check if same (order_no, position_code) already in-stock to avoid double assignment
    const inboundsList = this.getInbounds();
    // Same position must not be actively occupied by another order
    const occupiedByOther = this.getPositions().find(p => p.code === positionCode && p.status === 'occupied');
    if (occupiedByOther) {
      throw new Error(`仓位码 ${positionCode} 已经被订单 ${occupiedByOther.order_no} 占用！`);
    }

    // Auto-fill today if date is empty
    const inboundDate = date ? date : formatters.dbDate();

    // Create Inbound Record
    const newInbound: Inbound = {
      id: generateUUID(),
      order_id: demand.order_id,
      order_no: demand.order_no,
      model: demand.model,
      seq: demand.seq,
      position_code: positionCode,
      inbound_date: inboundDate,
      actual_qty: actualQty,
      line,
      handler,
      quality,
      note
    };

    // Update the demand block
    demand.position_code = positionCode;
    demand.inbound_id = newInbound.id;

    inboundsList.push(newInbound);
    this.saveInbounds(inboundsList);
    this.saveDemands(demands);

    // Recompute Order statuses
    this.updateOrderStatus(demand.order_id);

    return newInbound;
  }

  // Update existing inbound record
  static updateInbound(
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
  ): Inbound {
    const inboundsList = this.getInbounds();
    const inboundIndex = inboundsList.findIndex(i => i.id === inboundId);
    if (inboundIndex === -1) {
      throw new Error(`找不到要修改的入库记录！`);
    }

    const inbound = inboundsList[inboundIndex];

    // If position code is being updated, validate it
    if (updates.positionCode && updates.positionCode !== inbound.position_code) {
      const positionCode = updates.positionCode.trim().toUpperCase();
      const codeMatch = positionCode.match(/^([A-Z])(\d{2})-(\d{2})$/);
      if (!codeMatch) {
        throw new Error(`仓位码格式不合法。应该形如: A01-02`);
      }
      const [_, zone, rowStr, colStr] = codeMatch;
      const row = parseInt(rowStr, 10);
      const col = parseInt(colStr, 10);

      const config = this.getWarehouseConfig();
      const targetZone = config.zones.find(z => z.code === zone);
      if (!targetZone) {
        throw new Error(`区域 ${zone} 在系统配置中未定义`);
      }
      if (row < 1 || row > targetZone.rows) {
        throw new Error(`排数 ${row} 超出区域 ${zone} 的范围 (1-${targetZone.rows})`);
      }
      if (col < 1 || col > targetZone.cols) {
        throw new Error(`列数 ${col} 超出区域 ${zone} 的范围 (1-${targetZone.cols})`);
      }

      // Check if another order occupies this position
      const occupiedByOther = this.getPositions().find(p => p.code === positionCode && p.status === 'occupied' && p.order_id !== inbound.order_id);
      if (occupiedByOther) {
        throw new Error(`仓位码 ${positionCode} 已经被订单 ${occupiedByOther.order_no} 占用！`);
      }

      inbound.position_code = positionCode;
    }

    if (updates.actualQty !== undefined && updates.actualQty > 0) {
      inbound.actual_qty = updates.actualQty;
    }
    if (updates.inboundDate) inbound.inbound_date = updates.inboundDate;
    if (updates.line) inbound.line = updates.line;
    if (updates.handler) inbound.handler = updates.handler;
    if (updates.quality) inbound.quality = updates.quality;
    if (updates.note !== undefined) inbound.note = updates.note;

    // Update corresponding demand
    const demands = this.getDemands();
    const demand = demands.find(d => d.inbound_id === inboundId || (d.order_id === inbound.order_id && d.seq === inbound.seq));
    if (demand) {
      demand.position_code = inbound.position_code;
    }

    inboundsList[inboundIndex] = inbound;
    this.saveInbounds(inboundsList);
    this.saveDemands(demands);
    this.updateOrderStatus(inbound.order_id);

    return inbound;
  }

  // Delete / Rollback an inbound record
  static deleteInbound(inboundId: string) {
    const inboundsList = this.getInbounds();
    const inbound = inboundsList.find(i => i.id === inboundId);
    if (!inbound) {
      throw new Error(`找不到要撤销的入库记录！`);
    }

    // Check if there are active outbounds associated
    const outboundsList = this.getOutbounds();
    const hasOutbounds = outboundsList.some(o => o.inbound_id === inboundId);
    if (hasOutbounds) {
      throw new Error(`该入库卡板已存在出库流水，无法直接撤销入库！请先撤销相关出库记录。`);
    }

    // Remove inbound
    const newInbounds = inboundsList.filter(i => i.id !== inboundId);
    this.saveInbounds(newInbounds);

    // Reset demand to unallocated
    const demands = this.getDemands();
    const demand = demands.find(d => d.inbound_id === inboundId || (d.order_id === inbound.order_id && d.seq === inbound.seq));
    if (demand) {
      demand.position_code = null;
      demand.inbound_id = null;
      this.saveDemands(demands);
    }

    this.updateOrderStatus(inbound.order_id);
  }

  // Outbounds CRUD
  static getOutbounds(): Outbound[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.OUTBOUNDS);
    return saved ? JSON.parse(saved) : [];
  }

  static saveOutbounds(outbounds: Outbound[]) {
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
  }

  static recordOutbound(
    inboundId: string,
    outboundDate: string,
    outboundQty: number,
    handler: string,
    note: string
  ): Outbound {
    const inbounds = this.getInbounds();
    const inbound = inbounds.find(i => i.id === inboundId);
    if (!inbound) {
      throw new Error(`找不到该入库记录！`);
    }

    // Calculate current stock for this specific inbound card
    const stockQty = this.getPositionStock(inbound.id);
    if (outboundQty <= 0) {
      throw new Error(`出库数量必须大于 0`);
    }
    if (outboundQty > stockQty) {
      throw new Error(`出库数量 (${outboundQty}) 不能超过当前在库结存 (${stockQty})`);
    }

    const outboundsList = this.getOutbounds();
    const newOutbound: Outbound = {
      id: generateUUID(),
      inbound_id: inboundId,
      order_id: inbound.order_id,
      order_no: inbound.order_no,
      model: inbound.model,
      position_code: inbound.position_code,
      outbound_date: outboundDate ? outboundDate : formatters.dbDate(),
      outbound_qty: outboundQty,
      handler,
      note
    };

    outboundsList.push(newOutbound);
    this.saveOutbounds(outboundsList);

    // Update status
    this.updateOrderStatus(inbound.order_id);

    return newOutbound;
  }

  static deleteOutbound(outboundId: string) {
    const outboundsList = this.getOutbounds();
    const outbound = outboundsList.find(o => o.id === outboundId);
    if (!outbound) return;

    const filtered = outboundsList.filter(o => o.id !== outboundId);
    this.saveOutbounds(filtered);

    this.updateOrderStatus(outbound.order_id);
  }

  // Get current stock for an inbound ID
  static getPositionStock(inboundId: string): number {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    const inbound = inbounds.find(i => i.id === inboundId);
    if (!inbound) return 0;

    const totalIn = inbound.actual_qty;
    const totalOut = outbounds
      .filter(o => o.inbound_id === inboundId)
      .reduce((sum, o) => sum + o.outbound_qty, 0);

    return Math.max(0, totalIn - totalOut);
  }

  // Update order's status based on cumulative values
  static updateOrderStatus(orderId: string) {
    const orders = this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    const demands = this.getDemands().filter(d => d.order_id === orderId);
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
  }

  // Computed views for Orders (including aggregates)
  static getOrdersWithMetrics() {
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

  // Position Matrix Generator
  static getPositions(): Position[] {
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
  }

  // Core metrics for Dashboard / Header
  static getOverallStats() {
    const positions = this.getPositions();
    const totalCapacity = positions.length;
    const occupiedCount = positions.filter(p => p.status === 'occupied').length;
    const availableCount = totalCapacity - occupiedCount;

    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();
    const sumIn = inbounds.reduce((sum, i) => sum + i.actual_qty, 0);
    const sumOut = outbounds.reduce((sum, o) => sum + o.outbound_qty, 0);
    const stockBalance = sumIn - sumOut;

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
      shortageOrdersCount,
      avgTurnoverDays,
      balanceRate,
      pendingPalletCount,
      warningIndex,
      isWarning,
      warningFactor
    };
  }

  // Monthly Report Generator (期初 + 本期入库 - 本期出库 = 期末)
  static getMonthlyInventory(year: number, month: number): InventoryMonthRecord[] {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();

    // End date of last month
    const startOfMonthDate = new Date(year, month - 1, 1);
    const endOfMonthDate = new Date(year, month, 1);

    // Get unique combinations of (order_no, position_code) across all time
    const combinations = new Map<string, { order_no: string; position_code: string; model: string; quality: string }>();

    inbounds.forEach(i => {
      const key = `${i.order_no}||${i.position_code}`;
      if (!combinations.has(key)) {
        combinations.set(key, {
          order_no: i.order_no,
          position_code: i.position_code,
          model: i.model,
          quality: i.quality
        });
      }
    });

    const records: InventoryMonthRecord[] = [];

    combinations.forEach((info, key) => {
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

      // Only display if there was any historical stock or active transactions in this month
      if (opening > 0 || currentIn > 0 || currentOut > 0 || closing > 0) {
        records.push({
          year,
          month,
          order_no: info.order_no,
          model: info.model,
          position_code: info.position_code,
          opening,
          inbound: currentIn,
          outbound: currentOut,
          closing,
          quality: info.quality
        });
      }
    });

    return records;
  }

  // Clear data / Reset defaults
  static resetToDefault() {
    localStorage.removeItem(KEYS.ORDERS);
    localStorage.removeItem(KEYS.DEMANDS);
    localStorage.removeItem(KEYS.INBOUNDS);
    localStorage.removeItem(KEYS.OUTBOUNDS);
    localStorage.removeItem(KEYS.WAREHOUSE_CONFIG);
    localStorage.removeItem(KEYS.MODELS);
    localStorage.removeItem(KEYS.LINES);
    localStorage.removeItem(KEYS.HANDLERS);
    this.initDatabaseIfEmpty();
  }

  static resetDatabase() {
    this.resetToDefault();
  }
}
