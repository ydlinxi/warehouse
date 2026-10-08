/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { Outbound, PendingOutbound } from '../../types';
import { generateUUID } from '../formatters';
import { formatters } from '../formatters';
import { KEYS } from '../defaults';

export const OutboundService = {


  // Outbounds CRUD
    getOutbounds(this: DBServiceApi): Outbound[] {
    this.initDatabaseIfEmpty();
    const saved = localStorage.getItem(KEYS.OUTBOUNDS);
    return saved ? JSON.parse(saved) : [];
  },


    saveOutbounds(this: DBServiceApi, outbounds: Outbound[]) {
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
  },


    recordOutbound(this: DBServiceApi, 
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

    // Quality gate: only OQC验Pass stock is shippable
    if (inbound.quality && inbound.quality !== 'OQC验Pass') {
      throw new Error(
        `该入库记录品质状态为「${inbound.quality}」，不可出库！请先复检通过或走不合格处理流程。`
      );
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

    // SKU 在售库存由仓位账本实时推导（inbound 对应出库已记录），无需改 SKU 账

    // Update status
    this.updateOrderStatus(inbound.order_id);

    return newOutbound;
  },


    deleteOutbound(this: DBServiceApi, outboundId: string) {
    const outboundsList = this.getOutbounds();
    const outbound = outboundsList.find(o => o.id === outboundId);
    if (!outbound) return;

    const filtered = outboundsList.filter(o => o.id !== outboundId);
    this.saveOutbounds(filtered);

    // 回退出库：SKU 在售库存由仓位账本实时推导，撤销出库记录后自动加回

    this.updateOrderStatus(outbound.order_id);
  },


  // ===== 电商待出库发货单（电商已付款订单 → WMS 待出库 → 出库回写物流） =====
    getPendingOutbounds(this: DBServiceApi): PendingOutbound[] {
    const saved = localStorage.getItem(KEYS.PENDING_OUTBOUNDS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  },


    savePendingOutbounds(this: DBServiceApi, list: PendingOutbound[]) {
    localStorage.setItem(KEYS.PENDING_OUTBOUNDS, JSON.stringify(list));
  },


  // 模拟电商系统推送：收到已付款订单，生成一条待出库记录
    receiveEcomOrder(this: DBServiceApi): PendingOutbound {
    const positions = this.getPositions().filter(p =>
      p.status === 'occupied' && p.quality === 'OQC验Pass' && (p.qty || 0) > 0
    );
    if (positions.length === 0) {
      throw new Error('当前没有可售库存，无法生成电商待出库订单');
    }
    const exist = this.getPendingOutbounds();
    const idx = exist.length;
    const pos = positions[idx % positions.length];
    // 平台只取靶场有商城订单靶场的渠道：PLT-01 淘宝卖家中心（含天猫）
    const platforms = ['淘宝', '天猫', '淘宝'];
    const recipients = ['张伟（上海浦东）', '李娜（北京朝阳）', '王芳（广州天河）', '陈晨（杭州西湖）', '赵磊（成都武侯）', '吴敏（郑州金水）'];
    const qty = Math.max(1, Math.floor((pos.qty || 1) / 10));
    const order: PendingOutbound = {
      id: generateUUID(),
      ecomOrderNo: 'EC' + formatters.dbDate().replace(/-/g, '') + String(idx + 1).padStart(3, '0'),
      platform: platforms[idx % platforms.length],
      model: pos.model || '未知型号',
      qty,
      recipient: recipients[idx % recipients.length],
      address: '默认收货地址',
      status: '待出库',
      ecomStatus: '已发货',
      createdAt: formatters.dbDate(),
      note: `电商${platforms[idx % platforms.length]}订单已发货，推送至 WMS 待出库拣货`
    };
    exist.push(order);
    this.savePendingOutbounds(exist);
    return order;
  },


  // 出库执行：匹配可售库存卡位扣减，生成正式出库流水，并回写电商物流状态为已出库
    fulfillPendingOutbound(this: DBServiceApi, id: string, handler: string): Outbound[] {
    const list = this.getPendingOutbounds();
    const pending = list.find(p => p.id === id);
    if (!pending) throw new Error('找不到待出库记录');
    if (pending.status === '已出库') return [];

    let left = pending.qty;
    const created: Outbound[] = [];
    const today = formatters.dbDate();

    // 可售仓位（OQC验Pass 且有结存），库存升序优先用尽零散仓位
    const sellable = () => this.getPositions()
      .filter(p => p.status === 'occupied' && p.quality === 'OQC验Pass' && (p.qty || 0) > 0)
      .sort((a, b) => (a.qty || 0) - (b.qty || 0));

    // 三级匹配：
    //   ① 电商推送带 wmsRef（商家编码 → WMS SKU）时，按 SKU **精确命中** —— 最准，
    //      彻底规避「电商商品级标题（CABLE-K1 数据线）≠ WMS SKU 级品名（CABLE-K1 数据线 白色）」的口径差异；
    //   ② 退化为按型号（model）精确匹配；
    //   ③ 历史单据兼容：推送时尚未带 wmsRef，按型号**前缀**收敛到同系列 SKU
    //      （如推送「CABLE-K1 数据线」→ 命中「CABLE-K1 数据线 白色 / 黑色」），仍远优于全仓兜底；
    //   ④ 仍无 → 任意可售仓位兜底（外部平台命名可能与 WMS 完全不同，需人工核对实物）。
    let candidates = pending.wmsRef ? sellable().filter(p => p.sku === pending.wmsRef) : [];
    if (candidates.length === 0) candidates = sellable().filter(p => p.model === pending.model);
    if (candidates.length === 0) candidates = sellable().filter(p => (p.model || '').indexOf(pending.model + ' ') === 0);
    if (candidates.length === 0) candidates = sellable();

    if (candidates.length === 0) {
      const who = pending.wmsRef ? `WMS SKU ${pending.wmsRef}（${pending.model}）` : `型号 ${pending.model}`;
      throw new Error(`${who} 当前无可售库存，无法出库`);
    }

    for (const c of candidates) {
      if (left <= 0) break;
      const take = Math.min(left, c.qty || 0);
      if (take <= 0) continue;
      created.push(this.recordOutbound(c.inbound_id!, today, take, handler, `电商订单${pending.ecomOrderNo}出库`));
      left -= take;
    }

    if (left > 0) {
      const who = pending.wmsRef ? `WMS SKU ${pending.wmsRef}（${pending.model}）` : `型号 ${pending.model}`;
      throw new Error(`${who} 可售库存不足，仅完成 ${pending.qty - left}/${pending.qty}`);
    }

    pending.status = '已出库';
    pending.outboundAt = today;
    pending.logisticsNo = 'SF' + pending.id.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase();
    pending.note = `已出库，物流单号 ${pending.logisticsNo}（电商物流状态：已出库）`;
    this.savePendingOutbounds(list);
    return created;
  },


  // 出库执行（指定仓位）：按用户选择的仓位分配数量扣减，同一 SKU 可来自多个仓位
    fulfillPendingOutboundWithAllocations(this: DBServiceApi, 
    id: string,
    handler: string,
    allocations: { inboundId: string; qty: number }[]
  ): Outbound[] {
    const list = this.getPendingOutbounds();
    const pending = list.find(p => p.id === id);
    if (!pending) throw new Error('找不到待出库记录');
    if (pending.status === '已出库') return [];

    const valid = allocations.filter(a => a.inboundId && a.qty > 0);
    if (valid.length === 0) throw new Error('请至少选择一个出库仓位！');
    const total = valid.reduce((s, a) => s + a.qty, 0);
    if (total !== pending.qty) {
      throw new Error(`已分配数量(${total}) 必须等于待出库数量(${pending.qty})`);
    }

    const today = formatters.dbDate();
    const created: Outbound[] = [];
    valid.forEach(a => {
      created.push(this.recordOutbound(a.inboundId, today, a.qty, handler, `电商订单${pending.ecomOrderNo}出库（指定仓位）`));
    });

    pending.status = '已出库';
    pending.outboundAt = today;
    pending.ecomStatus = '已出库';
    pending.logisticsNo = pending.logisticsNo || ('SF' + pending.id.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase());
    pending.note = `已出库，从 ${valid.length} 个仓位扣减，物流单号 ${pending.logisticsNo}`;
    this.savePendingOutbounds(list);
    return created;
  }
};
