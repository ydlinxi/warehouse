/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { Inbound } from '../../types';
import { generateUUID } from '../formatters';
import { formatters } from '../formatters';
import { KEYS } from '../defaults';

export const InboundService = {


  // Inbounds CRUD
    getInbounds(this: DBServiceApi): Inbound[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.INBOUNDS);
    return saved ? JSON.parse(saved) : [];
  },


    saveInbounds(this: DBServiceApi, inbounds: Inbound[]) {
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
  },


    recordInbound(this: DBServiceApi, 
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
      sku: demand.sku,
      model: demand.model || demand.product || '',
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
  },


  // Update existing inbound record
    updateInbound(this: DBServiceApi, 
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
  },


  // 不合格品处置：让步接收（转可售）/ 退货 / 报废（清空该托库存）
    disposeInbound(this: DBServiceApi, inboundId: string, disposal: '让步接收' | '退货' | '报废') {
    const inbounds = this.getInbounds();
    const idx = inbounds.findIndex(i => i.id === inboundId);
    if (idx === -1) throw new Error('找不到该入库卡板！');
    const inb = inbounds[idx];

    if (disposal === '让步接收') {
      inb.quality = 'OQC验Pass';
      inb.disposal = '让步接收';
    } else {
      // 退货/报废：清空该托库存；SKU 在售库存由仓位账本实时推导，此处无需改 SKU 账
      inb.actual_qty = 0;
      inb.disposal = disposal;
    }
    inb.note = (inb.note ? inb.note + ' | ' : '') + `不合格处置：${disposal}`;
    inbounds[idx] = inb;
    this.saveInbounds(inbounds);
    this.updateOrderStatus(inb.order_id);
  },


  // Delete / Rollback an inbound record
    deleteInbound(this: DBServiceApi, inboundId: string) {
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

    // 回退入库：SKU 在售库存由仓位账本实时推导，撤销入库记录后自动反映，无需改 SKU 账

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
};
