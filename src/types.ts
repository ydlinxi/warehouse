/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'planner' | 'inbound' | 'outbound' | 'manager' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export interface ProductModel {
  name: string;
  default_per_pallet: number;
}

export interface Order {
  id: string; // Unique GUID/ID
  order_no: string; // Unique order number (e.g., PO20260801)
  customer_code: string; // Left 4 chars of order_no
  model: string; // Model name
  order_qty: number; // Order quantity
  per_pallet: number; // Pallet capacity
  pallet_count: number; // CEILING(order_qty / per_pallet)
  status: 'pending' | 'in_progress' | 'completed' | 'shortage';
  created_at: string;
}

export interface PositionDemand {
  id: string;
  order_id: string;
  order_no: string;
  model: string;
  seq: number; // 1 to pallet_count
  position_code: string | null; // e.g. A01-02
  inbound_id: string | null; // Linked inbound entry
}

export interface Inbound {
  id: string;
  order_id: string;
  order_no: string;
  model: string;
  seq: number;
  position_code: string;
  inbound_date: string; // YYYY-MM-DD
  actual_qty: number;
  line: string;
  handler: string;
  quality: 'OQC验Pass' | '不合格' | '待复检';
  note: string;
}

export interface Outbound {
  id: string;
  inbound_id: string;
  order_id: string;
  order_no: string;
  model: string;
  position_code: string;
  outbound_date: string; // YYYY-MM-DD
  outbound_qty: number;
  handler: string;
  note: string;
}

export interface Position {
  code: string; // Zone + Row(2D) + "-" + Col(2D)
  zone: string;
  row: number;
  col: number;
  status: 'available' | 'occupied';
  order_id?: string | null;
  order_no?: string | null;
  model?: string | null;
  qty?: number | null;
  quality?: 'OQC验Pass' | '不合格' | '待复检' | null;
  inbound_id?: string | null;
  inbound_date?: string | null;
  seq?: number | null;
  line?: string | null;
  handler?: string | null;
}

export interface WarehouseZoneConfig {
  code: string; // e.g. 'A', 'B'
  rows: number;
  cols: number;
}

export interface WarehouseConfig {
  zones: WarehouseZoneConfig[];
}

export interface InventoryMonthRecord {
  year: number;
  month: number;
  order_no: string;
  model: string;
  position_code: string;
  opening: number;
  inbound: number;
  outbound: number;
  closing: number;
  quality: string;
}
