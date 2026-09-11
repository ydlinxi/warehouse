/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { DBService, formatters } from '../db';
import {
  Order,
  PositionDemand,
  Inbound,
  Outbound,
  Position,
  WarehouseConfig
} from '../types';

interface WarehouseStats {
  totalCapacity: number;
  occupiedCount: number;
  availableCount: number;
  occupancyRate: number;
  stockBalance: number;
  shortageOrdersCount: number;
  avgTurnoverDays: number;
  balanceRate: number;
  pendingPalletCount: number;
  warningIndex: number;
  isWarning: boolean;
  warningFactor: number;
  activeOrdersCount?: number;
  pendingInboundPallets?: number;
}

interface InventoryStoreState {
  orders: Order[];
  demands: PositionDemand[];
  inbounds: Inbound[];
  outbounds: Outbound[];
  warehouseConfig: WarehouseConfig;
  positions: Position[];
  stats: WarehouseStats;

  // Search & Scanner UI State
  isSearchModalOpen: boolean;
  isScanModalOpen: boolean;
  globalSearchQuery: string;
  targetOutboundPosition: Position | null;

  // Index maps for O(1) lookups
  positionMap: Map<string, Position>;
  orderMap: Map<string, Order>;

  // Actions
  init: () => void;
  refreshData: () => void;
  setSearchModalOpen: (open: boolean) => void;
  setScanModalOpen: (open: boolean) => void;
  setGlobalSearchQuery: (q: string) => void;
  setTargetOutboundPosition: (pos: Position | null) => void;

  // DB Business Actions
  addOrder: (order: {
    order_no: string;
    model: string;
    order_qty: number;
    per_pallet: number;
  }) => Order;

  recordInbound: (
    demandId: string,
    positionCode: string,
    inboundDate: string,
    actualQty: number,
    line: string,
    handler: string,
    quality: 'OQC验Pass' | '不合格' | '待复检',
    note: string
  ) => Inbound;

  updateInbound: (
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
  ) => Inbound;

  deleteInbound: (inboundId: string) => void;

  recordOutbound: (
    inboundId: string,
    outboundDate: string,
    outboundQty: number,
    handler: string,
    note: string
  ) => Outbound;

  deleteOutbound: (outboundId: string) => void;

  updateWarehouseConfig: (newConfig: WarehouseConfig) => void;

  resetDatabase: () => void;
}

export const useInventoryStore = create<InventoryStoreState>((set, get) => ({
  orders: [],
  demands: [],
  inbounds: [],
  outbounds: [],
  warehouseConfig: { zones: [] },
  positions: [],
  stats: {
    totalCapacity: 0,
    occupiedCount: 0,
    availableCount: 0,
    occupancyRate: 0,
    stockBalance: 0,
    shortageOrdersCount: 0,
    avgTurnoverDays: 0,
    balanceRate: 0,
    pendingPalletCount: 0,
    warningIndex: 0,
    isWarning: false,
    warningFactor: 0,
    activeOrdersCount: 0,
    pendingInboundPallets: 0
  },

  isSearchModalOpen: false,
  isScanModalOpen: false,
  globalSearchQuery: '',
  targetOutboundPosition: null,

  positionMap: new Map(),
  orderMap: new Map(),

  init: () => {
    DBService.initDatabaseIfEmpty();
    get().refreshData();
  },

  refreshData: () => {
    const orders = DBService.getOrders();
    const demands = DBService.getDemands();
    const inbounds = DBService.getInbounds();
    const outbounds = DBService.getOutbounds();
    const warehouseConfig = DBService.getWarehouseConfig();
    const positions = DBService.getPositions();
    const rawStats = DBService.getOverallStats();

    // Compute active orders count & pending pallets
    const activeOrdersCount = orders.filter(o => o.status !== 'completed').length;
    const pendingInboundPallets = demands.filter(d => d.position_code === null).length;

    const stats: WarehouseStats = {
      ...rawStats,
      activeOrdersCount,
      pendingInboundPallets
    };

    // Rebuild O(1) Fast Indexes
    const positionMap = new Map<string, Position>();
    positions.forEach(p => positionMap.set(p.code, p));

    const orderMap = new Map<string, Order>();
    orders.forEach(o => orderMap.set(o.id, o));

    set({
      orders,
      demands,
      inbounds,
      outbounds,
      warehouseConfig,
      positions,
      stats,
      positionMap,
      orderMap
    });
  },

  setSearchModalOpen: (open) => set({ isSearchModalOpen: open }),
  setScanModalOpen: (open) => set({ isScanModalOpen: open }),
  setGlobalSearchQuery: (q) => set({ globalSearchQuery: q }),
  setTargetOutboundPosition: (pos) => set({ targetOutboundPosition: pos }),

  addOrder: (orderData) => {
    const newOrder = DBService.addOrder(
      orderData.order_no,
      orderData.model,
      orderData.order_qty,
      orderData.per_pallet
    );
    get().refreshData();
    return newOrder;
  },

  recordInbound: (...args) => {
    const res = DBService.recordInbound(...args);
    get().refreshData();
    return res;
  },

  updateInbound: (...args) => {
    const res = DBService.updateInbound(...args);
    get().refreshData();
    return res;
  },

  deleteInbound: (inboundId) => {
    DBService.deleteInbound(inboundId);
    get().refreshData();
  },

  recordOutbound: (...args) => {
    const res = DBService.recordOutbound(...args);
    get().refreshData();
    return res;
  },

  deleteOutbound: (outboundId) => {
    DBService.deleteOutbound(outboundId);
    get().refreshData();
  },

  updateWarehouseConfig: (newConfig) => {
    DBService.saveWarehouseConfig(newConfig);
    get().refreshData();
  },

  resetDatabase: () => {
    DBService.resetDatabase();
    get().refreshData();
  }
}));
