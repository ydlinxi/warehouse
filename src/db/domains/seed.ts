/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { InboundPlanLine, Order, PositionDemand, Inbound, Outbound, PendingOutbound, ProductSku } from '../../types';
import { safeNum } from '../formatters';
import { generateUUID } from '../formatters';
import { KEYS } from '../defaults';
import { SEED_PRODUCT_SKUS, SKU_MIGRATION } from '../../seed';
import { DEMO_ORDERS_V2, DEMO_ECOM_ORDERS } from '../../demoOrders';



  // ===== 库存初始化种子：覆盖全部 SKU，让数据落在 充裕 / 偏低 / 需补货 三档 =====
  // 键为 SKU，值为该托上架数量（0 或留空 = 不建库存 → stock 0 → 需补货）
  export const STOCK_SEED: Record<string, number> = {
    'SUP0001-001': 120, 'SUP0001-002': 140, 'SUP0001-003': 30,
    'SUP0002-001': 55, 'SUP0002-003': 45,
    'SUP0003-001': 300, 'SUP0003-002': 35, 'SUP0003-003': 20,
    'SUP0004-001': 8, 'SUP0004-002': 35, 'SUP0004-003': 10,
    'SUP0005-001': 45, 'SUP0005-002': 50, 'SUP0005-003': 90,
    'SUP0006-001': 15, 'SUP0006-002': 40, 'SUP0006-003': 60,
    // ===== 扩充批次：42/50 个 SKU 有上架库存（新增键必须追加在末尾，否则会挪动既有 A12-xx 卡位）=====
    'SUP0001-004': 45, 'SUP0001-005': 12, 'SUP0001-006': 130,
    'SUP0002-004': 150, 'SUP0002-005': 30, 'SUP0002-006': 55,
    'SUP0003-004': 260, 'SUP0003-005': 40, 'SUP0003-007': 12,
    'SUP0004-004': 70, 'SUP0004-005': 6, 'SUP0004-007': 420,
    'SUP0005-004': 260, 'SUP0005-006': 900, 'SUP0005-007': 40,
    'SUP0006-004': 300, 'SUP0006-006': 120, 'SUP0006-007': 25,
    'SUP0007-001': 1200, 'SUP0007-002': 350, 'SUP0007-004': 260,
    'SUP0008-001': 480, 'SUP0008-003': 90, 'SUP0008-004': 20
    // 未上架（无库存种子）：SUP0001-007 / SUP0002-007 / SUP0003-006 / SUP0004-006 /
    // SUP0005-005 / SUP0006-005 / SUP0007-003 / SUP0008-002 —— 用于演示「已建 SKU 但尚未上架」
  };

  export const STOCK_SEED_META: Record<string, { title: string }> = {
    'SUP0001-001': { title: 'OVEN-X1 电烤箱 红色' }, 'SUP0001-002': { title: 'OVEN-X1 电烤箱 黑色' }, 'SUP0001-003': { title: 'OVEN-X1 电烤箱 蓝色' },
    'SUP0002-001': { title: 'MICRO-400 微波炉 红色' }, 'SUP0002-003': { title: 'MICRO-400 微波炉 绿色' },
    'SUP0003-001': { title: 'TOAST-A 烤面包机 A' }, 'SUP0003-002': { title: 'TOAST-A 烤面包机 B' }, 'SUP0003-003': { title: 'TOAST-A 烤面包机 C' },
    'SUP0004-001': { title: 'DISH-90 洗碗机 S' }, 'SUP0004-002': { title: 'DISH-90 洗碗机 M' }, 'SUP0004-003': { title: 'DISH-90 洗碗机 L' },
    'SUP0005-001': { title: 'BAKE 配件 01' }, 'SUP0005-002': { title: 'BAKE 配件 02' }, 'SUP0005-003': { title: 'BAKE 配件 03' },
    'SUP0006-001': { title: 'MINI 迷你煮蛋器 01' }, 'SUP0006-002': { title: 'MINI 迷你煮蛋器 02' }, 'SUP0006-003': { title: 'MINI 迷你煮蛋器 03' }
  };


  // 防重入锁：初始化内部会经 getInbounds() → initDatabaseIfEmpty() 回调自身，
  // 若不加锁会形成 init → ensureSeedStockLedger → getInbounds → init 的无限递归（栈溢出）
  export let _initRunning = false;

export const SeedService = {


  // 清理历史「SPU 短码」演示单及其关联流水（orders / demands / inbounds / outbounds）：
  // 这些记录 model 只到 SPU（如 OVEN-X1、MICRO-400、TOAST-A），与现行 SKU 主数据口径不一致，
  // 会在「库存报表 → 成品进销存总表」里出现型号为短码、SKU 编码对不上的脏行。
  // 返回清理掉的订单数。
    purgeLegacySpuOrders(this: DBServiceApi): number {
    const LEGACY_ORDER_NOS = ['PO260701', 'PO260810', 'PO260815'];
    const SPU_ONLY = ['OVEN-X1', 'MICRO-400', 'TOAST-A', 'DISH-90', 'MINI', 'BAKE 配件'];
    const readArr = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    };

    const orders = readArr(KEYS.ORDERS);
    const legacy = orders.filter(o =>
      LEGACY_ORDER_NOS.includes(o.order_no) || SPU_ONLY.includes(String(o.model || '').trim()));
    if (legacy.length === 0) return 0;

    const legacyIds = new Set(legacy.map(o => o.id));
    const legacyNos = new Set<string>([...LEGACY_ORDER_NOS, ...legacy.map(o => o.order_no)]);
    const keep = (r: any) => !legacyIds.has(r.order_id) && !legacyIds.has(r.id) && !legacyNos.has(r.order_no);

    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders.filter(o => !legacyIds.has(o.id))));
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(readArr(KEYS.DEMANDS).filter(keep)));
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(readArr(KEYS.INBOUNDS).filter(keep)));
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(readArr(KEYS.OUTBOUNDS).filter(keep)));
    return legacy.length;
  },


  // 旧 SKU 编码 → 新编码（v2）迁移：一次性改写已存在的本地数据
    migrateLegacySkuCodes(this: DBServiceApi) {
    const remap = (code: string) => SKU_MIGRATION[code] || code;
    const read = (key: string) => {
      const v = localStorage.getItem(key);
      if (!v) return null;
      try { return JSON.parse(v); } catch (e) { return null; }
    };

    // 商品 SKU 主数据
    const skus: any[] | null = read(KEYS.PRODUCT_SKUS);
    if (Array.isArray(skus)) {
      let changed = false;
      skus.forEach(s => {
        const next = remap(s.sku);
        if (next !== s.sku) { s.sku = next; changed = true; }
      });
      if (changed) this.saveProductSkus(skus);
    }

    // 采购单明细 SKU
    const pos: any[] | null = read(KEYS.PURCHASE_ORDERS);
    if (Array.isArray(pos)) {
      let changed = false;
      pos.forEach(po => (po.items || []).forEach((it: any) => {
        const next = remap(it.sku);
        if (next !== it.sku) { it.sku = next; changed = true; }
      }));
      if (changed) this.savePurchaseOrders(pos);
    }

    // 入库计划 SKU 行
    const orders: any[] | null = read(KEYS.ORDERS);
    if (Array.isArray(orders)) {
      let changed = false;
      orders.forEach(o => (o.lines || []).forEach((l: any) => {
        const next = remap(l.sku);
        if (next !== l.sku) { l.sku = next; changed = true; }
      }));
      if (changed) this.saveOrders(orders);
    }

    // 入库流水 SKU（仓位账本，派生库存的唯一真相源）
    const inbs: any[] | null = read(KEYS.INBOUNDS);
    if (Array.isArray(inbs)) {
      let changed = false;
      inbs.forEach(i => {
        const next = remap(i.sku);
        if (next !== i.sku) { i.sku = next; changed = true; }
      });
      if (changed) this.saveInbounds(inbs);
    }

    // 库位需求 SKU
    const dms: any[] | null = read(KEYS.DEMANDS);
    if (Array.isArray(dms)) {
      let changed = false;
      dms.forEach(d => {
        const next = remap(d.sku);
        if (next !== d.sku) { d.sku = next; changed = true; }
      });
      if (changed) this.saveDemands(dms);
    }
  },


  // 商品主数据补齐：把新增的种子 SKU 追加到已存在的本地主数据（保留用户自建 SKU 与阈值调整）
    ensureSeedProductSkus(this: DBServiceApi): number {
    const raw = localStorage.getItem(KEYS.PRODUCT_SKUS);
    if (!raw) return 0; // 空库由完整种子落盘
    let list: ProductSku[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return 0;
      list = parsed;
    } catch (e) { return 0; }
    const have = new Set(list.map(s => s.sku));
    const missing = SEED_PRODUCT_SKUS.filter(s => !have.has(s.sku));
    // 品名同步：主数据（SEED_PRODUCT_SKUS）里的商品名若有更新，把本地同编码 SKU 的 title 一并刷新，
    // 避免历史库里残留旧行业品名（如「PRO-X1 智能终端」「MX-400 模块」）；用户自定义的阈值 / 卡板等字段保留。
    const seedMap = new Map(SEED_PRODUCT_SKUS.map(s => [s.sku, s]));
    let renamed = 0;
    list.forEach(s => {
      const seed = seedMap.get(s.sku);
      if (seed && seed.title && s.title !== seed.title) { s.title = seed.title; renamed += 1 }
    });
    if (missing.length === 0 && renamed === 0) return 0;
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify([...list, ...missing.map(s => ({ ...s }))]));
    return missing.length;
  },


  // 台账品名归一：早期版本的演示数据里，仓位台账 / 出入库 / 需求 / 入库计划的 model 记录的是
  // 旧型号名（如「PRO-X1 智能终端」「MX-400 模块」）。主数据换成生活小家电后，这里按 **SKU 编码**
  // 把各台账的 model 文案刷新为当前主数据的品名，消除「同一 SKU 两套品名」的脏数据。
  // 幂等：与当前品名一致时不做任何写入。返回修正的条数。
    normalizeModelNames(this: DBServiceApi): number {
    const read = (k: string): any[] | null => {
      try {
        const raw = localStorage.getItem(k);
        const arr = raw ? JSON.parse(raw) : null;
        return Array.isArray(arr) ? arr : null;
      } catch (e) { return null; }
    };
    let total = 0;
    // 台账类：一行 = 一个 SKU（字段 sku / model）
    const fixRows = (key: string) => {
      const arr = read(key);
      if (!arr) return;
      let n = 0;
      arr.forEach((r: any) => {
        if (!r || !r.sku) return;
        const title = this.skuTitle(r.sku);
        if (title && title !== r.sku && r.model !== title) { r.model = title; n += 1 }
      });
      if (n) { localStorage.setItem(key, JSON.stringify(arr)); total += n }
    };
    fixRows(KEYS.INBOUNDS);
    fixRows(KEYS.OUTBOUNDS);
    fixRows(KEYS.DEMANDS);
    // 入库计划：按行（lines[].sku / lines[].title）
    const orders = read(KEYS.ORDERS);
    if (orders) {
      let n = 0;
      orders.forEach((o: any) => (o && o.lines ? o.lines : []).forEach((l: any) => {
        if (!l || !l.sku) return;
        const title = this.skuTitle(l.sku);
        if (title && title !== l.sku && l.title !== title) { l.title = title; n += 1 }
      }));
      if (n) { localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders)); total += n }
    }
    // 电商待出库：只有 model（无 sku 编码），按品名反查当前主数据做同义替换
    const pend = read(KEYS.PENDING_OUTBOUNDS);
    if (pend) {
      const titleSet = new Set(SEED_PRODUCT_SKUS.map(s => s.title));
      let n = 0;
      pend.forEach((r: any) => {
        if (!r || !r.model || titleSet.has(r.model)) return;
        // 旧型号名 → 按「型号首词 + 颜色」尽量匹配到当前主数据品名
        const hit = SEED_PRODUCT_SKUS.find(s => s.title === r.model)
          || SEED_PRODUCT_SKUS.find(s => {
            const parts = String(r.model).split(' ');
            return parts.length > 1 && s.title.indexOf(parts[parts.length - 1]) >= 0
              && s.title.split(' ')[0] === parts[0];
          });
        if (hit && hit.title !== r.model) { r.model = hit.title; n += 1 }
      });
      if (n) { localStorage.setItem(KEYS.PENDING_OUTBOUNDS, JSON.stringify(pend)); total += n }
    }
    return total;
  },


  // 演示订单补齐：第 19~50 个 SKU 的订单 / 上架卡板 / 出库记录。
  // 已存在同单号则跳过；某托的目标仓位已被占用则跳过该托，保证不覆盖真实数据。
  // 返回新增的订单数。
    ensureDemoOrders(this: DBServiceApi): number {
    const readArr = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    };
    const orders = readArr(KEYS.ORDERS);
    if (orders.length === 0) return 0; // 空库走完整种子流程
    const demands = readArr(KEYS.DEMANDS);
    const inbounds = readArr(KEYS.INBOUNDS);
    const outbounds = readArr(KEYS.OUTBOUNDS);
    const outByInbound: Record<string, number> = {};
    outbounds.forEach(o => { outByInbound[o.inbound_id] = (outByInbound[o.inbound_id] || 0) + safeNum(o.outbound_qty); });
    const occupied = new Set(
      inbounds.filter(i => safeNum(i.actual_qty) - (outByInbound[i.id] || 0) > 0).map(i => i.position_code)
    );

    let added = 0;
    DEMO_ORDERS_V2.forEach(spec => {
      if (orders.some(o => o.order_no === spec.order_no)) return;
      orders.push({
        id: spec.id, order_no: spec.order_no, customer_code: 'PO26', model: spec.model,
        order_qty: spec.order_qty,
        per_pallet: spec.lines[0]?.maxPerPallet || 1,
        pallet_count: spec.lines.reduce((s, l) => s + Math.max(1, Math.ceil(l.qty / l.maxPerPallet)), 0),
        status: spec.status, created_at: spec.created_at,
        lines: spec.lines.map(l => ({ ...l }))
      } as Order);

      spec.pallets.forEach(p => {
        if (occupied.has(p.pos)) return;
        occupied.add(p.pos);
        const inboundId = `inbound_${spec.id}_${p.seq}`;
        demands.push({
          id: `demand_${spec.id}_${p.seq}`, order_id: spec.id, order_no: spec.order_no,
          sku: p.sku, model: p.title, seq: p.seq, position_code: p.pos, inbound_id: inboundId
        });
        inbounds.push({
          id: inboundId, order_id: spec.id, order_no: spec.order_no, sku: p.sku, model: p.title,
          seq: p.seq, position_code: p.pos, inbound_date: p.date, actual_qty: p.qty,
          line: p.pos.startsWith('A') ? '线别A-03' : '线别B-03', handler: p.handler,
          quality: p.quality, disposal: p.disposal, note: p.note
        });
      });

      // 未到货部分：保留需求行（position 为空），等「待入库卡位分配」派位
      let seq = spec.pallets.length;
      spec.lines.forEach(l => {
        const covered = spec.pallets.filter(p => p.sku === l.sku).reduce((s, p) => s + p.qty, 0);
        if (l.qty - covered > 0) {
          seq += 1;
          demands.push({
            id: `demand_${spec.id}_${seq}`, order_id: spec.id, order_no: spec.order_no,
            sku: l.sku, model: l.title, seq, position_code: null, inbound_id: null
          });
        }
      });

      (spec.outbounds || []).forEach(o => {
        const p = spec.pallets.find(x => x.seq === o.seq);
        const inboundId = `inbound_${spec.id}_${o.seq}`;
        if (!p || !inbounds.some(i => i.id === inboundId)) return;
        outbounds.push({
          id: `outbound_${spec.id}_${o.seq}`, inbound_id: inboundId, order_id: spec.id, order_no: spec.order_no,
          model: p.title, position_code: p.pos, outbound_date: o.date, outbound_qty: o.qty,
          handler: o.handler, note: o.note
        });
      });

      added += 1;
    });

    if (added === 0) return 0;
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
    return added;
  },


  // 库存初始化卡位：A 区每排 20 列，超出自动换排（A12-01..A12-20 → A13-01..）。
  // 新增 SKU 必须追加在 STOCK_SEED 末尾，这样既有 SKU 的卡位不会漂移。
    stockSeedPosition(this: DBServiceApi, index: number): string {
    const perRow = 20;
    const row = 12 + Math.floor(index / perRow);
    const col = (index % perRow) + 1;
    return `A${String(row).padStart(2, '0')}-${String(col).padStart(2, '0')}`;
  },


  // 平台名对齐靶场：只有 PLT-01 淘宝卖家中心（千牛）在靶场里有「商城/订单」靶场（tb-orders / tb-logistics），
  // 天猫为其下渠道；抖音(PLT-04)/小红书(PLT-13) 仅有达人·内容·笔记·舆情模块，京东/拼多多/快手/视频号则完全不存在。
  // 历史数据里的这些平台统一归并到 淘宝 / 天猫（幂等，可重复执行）
    normalizeEcomPlatforms(this: DBServiceApi): number {
    const PLATFORM_MAP: Record<string, string> = {
      '京东': '淘宝', '拼多多': '天猫', '快手': '淘宝', '视频号': '天猫',
      '抖音': '淘宝', '小红书': '天猫'
    };
    const raw = localStorage.getItem(KEYS.PENDING_OUTBOUNDS);
    if (!raw) return 0;
    let list: PendingOutbound[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return 0;
      list = parsed;
    } catch (e) { return 0; }
    let changed = 0;
    list.forEach(o => {
      const next = PLATFORM_MAP[o.platform];
      if (!next) return;
      if (o.note) o.note = o.note.split(o.platform).join(next);
      o.platform = next;
      changed++;
    });
    if (changed) this.savePendingOutbounds(list);
    return changed;
  },


  // 电商平台订单补齐：把缺少的演示电商订单追加进本地数据（按电商订单号去重，幂等）
    ensureDemoEcomOrders(this: DBServiceApi): number {
    const saved = localStorage.getItem(KEYS.PENDING_OUTBOUNDS);
    if (!saved) return 0; // 空库由完整种子落盘
    let list: PendingOutbound[];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return 0;
      list = parsed;
    } catch (e) { return 0; }
    // 已有待出库单据（电商推送的真实数据，或此前落过的演示数据）→ 不再追加演示单，
    // 避免「淘宝发货 1 单，WMS 却冒出几十条待出库」造成的因果混淆。
    if (list.length > 0) return 0;
    const missing = DEMO_ECOM_ORDERS.filter(o => o && o.ecomOrderNo);
    if (missing.length === 0) return 0;
    this.savePendingOutbounds(missing.map(o => ({ ...o, id: generateUUID() })));
    return missing.length;
  },


  // 统一取 SKU 品名（以商品主数据为准，避免 STOCK_SEED_META 与主数据双份维护）
    skuTitle(this: DBServiceApi, sku: string): string {
    return SEED_PRODUCT_SKUS.find(s => s.sku === sku)?.title || STOCK_SEED_META[sku]?.title || sku;
  },


  // 旧数据升级：补种「库存初始化」入库流水（老库没有 stk-seed 流水会导致派生库存全为 0）
    ensureSeedStockLedger(this: DBServiceApi) {
    const inbounds = this.getInbounds();
    let changed = false;
    Object.keys(STOCK_SEED).forEach((sku, idx) => {
      // 已有同 SKU 的初始化托（含旧编码 id 迁移过来的）不重复补种
      if (inbounds.some(i => i.order_id === 'stk-seed' && i.sku === sku)) return;
      const qty = STOCK_SEED[sku];
      if (!qty) return;
      inbounds.push({
        id: `inbound_stk_${sku}`,
        order_id: 'stk-seed',
        order_no: 'WH2026-STK',
        sku,
        model: this.skuTitle(sku),
        seq: idx + 1,
        position_code: this.stockSeedPosition(idx),
        inbound_date: '2026-08-20',
        actual_qty: qty,
        line: '线别C-01',
        handler: '赵磊',
        quality: 'OQC验Pass',
        note: '库存初始化（数据升级补种）'
      });
      changed = true;
    });
    if (changed) this.saveInbounds(inbounds);
  },


  // Init Data with realistic default records
    initDatabaseIfEmpty(this: DBServiceApi) {
    if (_initRunning) return;
    _initRunning = true;
    try {
      this.seedDatabase();
    } finally {
      _initRunning = false;
    }
  },


  // 实际播种逻辑（与 initDatabaseIfEmpty 拆分，以便加防重入锁）
    seedDatabase(this: DBServiceApi) {
    this.migrateLegacySkuCodes();
    this.ensureSeedProductSkus();
    this.normalizeModelNames();     // 台账品名归一（历史库里的旧行业品名 → 当前主数据品名）
    this.purgeLegacySpuOrders();
    this.normalizeEcomPlatforms();
    this.ensureItemMaster();
    this.ensureSeedStockLedger();

    // ===== 采购单：确保 4 种状态齐全（待采购 / 已付款 / 待收货 / 已收货）=====
    // 待采购 → 可付款；已付款 → 等货到厂；待收货 → 自动在「入库计划」生成「待收货建卡板」行；已收货 → 进入 ERP 对账
    if (!localStorage.getItem(KEYS.PURCHASE_ORDERS)) {
      this.savePurchaseOrders([
        {
          poNo: 'PO20260901', supplierId: 'SUP0001', supplierName: '宏源实业有限公司',
          items: [
            { sku: 'SUP0001-002', title: 'OVEN-X1 电烤箱 黑色', need: 300, price: 320 },
            { sku: 'SUP0001-001', title: 'OVEN-X1 电烤箱 红色', need: 200, price: 320 }
          ],
          totalQty: 500, totalAmt: 300 * 320 + 200 * 320,
          status: '待收货', createdAt: '2026-09-01', expectDate: '2026-09-18',
          payMethod: '月结30天', note: '首批试产物料，已到厂待收货'
        },
        {
          poNo: 'PO20260905', supplierId: 'SUP0002', supplierName: '盛达工贸有限公司',
          items: [ { sku: 'SUP0002-002', title: 'MICRO-400 微波炉 黑色', need: 500, price: 180 } ],
          totalQty: 500, totalAmt: 500 * 180,
          status: '待采购', createdAt: '2026-09-05', expectDate: '2026-09-20',
          payMethod: '预付款', note: '常规备货'
        },
        {
          poNo: 'PO20260908', supplierId: 'SUP0006', supplierName: '锐进科技工贸',
          items: [ { sku: 'SUP0006-002', title: 'MINI 迷你煮蛋器 02', need: 240, price: 68 } ],
          totalQty: 240, totalAmt: 240 * 68,
          status: '已付款', createdAt: '2026-09-08', expectDate: '2026-09-22',
          payMethod: '预付全款', paidAt: '2026-09-08', payNo: 'TXN20260908001', paidAmt: 240 * 68,
          note: '已付全款，供应商备货中'
        },
        {
          poNo: 'PO20260810', supplierId: 'SUP0001', supplierName: '宏源实业有限公司',
          items: [
            { sku: 'SUP0001-001', title: 'OVEN-X1 电烤箱 红色', need: 200, price: 320 },
            { sku: 'SUP0003-001', title: 'TOAST-A 烤面包机 A', need: 150, price: 95 }
          ],
          totalQty: 350, totalAmt: 200 * 320 + 150 * 95,
          status: '待收货', createdAt: '2026-08-10', expectDate: '2026-09-12',
          payMethod: '月结30天', note: '加急补货，已到厂待收货'
        },
        {
          poNo: 'PO20260910', supplierId: 'SUP0003', supplierName: '中科科技有限公司',
          items: [
            { sku: 'SUP0001-002', title: 'OVEN-X1 电烤箱 黑色', need: 300, price: 320 },
            { sku: 'SUP0002-001', title: 'MICRO-400 微波炉 红色', need: 80, price: 180 }
          ],
          totalQty: 380, totalAmt: 300 * 320 + 80 * 180,
          status: '待收货', createdAt: '2026-09-10', expectDate: '2026-09-16',
          payMethod: '货到付款', note: '到厂待收货'
        },
        {
          poNo: 'PO20260912', supplierId: 'SUP0004', supplierName: '联创供应链有限公司',
          items: [
            { sku: 'SUP0004-002', title: 'DISH-90 洗碗机 M', need: 100, price: 620 },
            { sku: 'SUP0005-003', title: 'BAKE 配件 03', need: 200, price: 60 }
          ],
          totalQty: 300, totalAmt: 100 * 620 + 200 * 60,
          status: '已收货', receivedAt: '2026-09-14', createdAt: '2026-09-02', expectDate: '2026-09-12',
          payMethod: '月结60天', note: '已到货，四单一致'
        },
        {
          poNo: 'PO20260915', supplierId: 'SUP0005', supplierName: '华美德制造有限公司',
          items: [ { sku: 'SUP0005-001', title: 'BAKE 配件 01', need: 300, price: 45 } ],
          totalQty: 300, totalAmt: 300 * 45,
          status: '已收货', receivedAt: '2026-09-15', createdAt: '2026-09-06', expectDate: '2026-09-14',
          payMethod: '预付款', note: '到货部分不合格'
        }
      ]);
    }
    // 已有业务数据（老库）：只补齐演示订单 / 电商订单，不重置任何内容
    if (localStorage.getItem(KEYS.ORDERS)) {
      this.ensureDemoOrders();
      this.ensureDemoEcomOrders();
      return;
    }

    // Pre-populate realistic historical orders, demands, inbounds, outbounds
    const orders: Order[] = [];
    const demands: PositionDemand[] = [];
    const inbounds: Inbound[] = [];
    const outbounds: Outbound[] = [];

    // 注：早期以 SPU 短码记型号的演示单（PO260701 / PO260810 / PO260815，model 为 OVEN-X1 / MICRO-400 / TOAST-A）
    // 已从数据源移除，避免其污染进销存总表；历史库由 purgeLegacySpuOrders() 清理。

    // ===== Order 4 - 多 SKU 出入库中（覆盖 待复检 / 不合格 / 让步接收 / 退货 / 报废）=====
    const order4Id = 'order_004';
    const o4: Order = {
      id: order4Id, order_no: 'PO260901', customer_code: 'PO26', model: 'OVEN-X1 电烤箱 红色 等 3 个 SKU',
      order_qty: 300, per_pallet: 100, pallet_count: 3, status: 'in_progress', created_at: '2026-09-01',
      lines: [
        { sku: 'SUP0001-001', title: 'OVEN-X1 电烤箱 红色', maxPerPallet: 150, qty: 150 },
        { sku: 'SUP0002-002', title: 'MICRO-400 微波炉 黑色', maxPerPallet: 80, qty: 80 },
        { sku: 'SUP0003-001', title: 'TOAST-A 烤面包机 A', maxPerPallet: 200, qty: 70 }
      ]
    };
    orders.push(o4);
    const o4Demands = [
      { seq: 1, sku: 'SUP0001-001', model: 'OVEN-X1 电烤箱 红色', pos: 'B03-01', qty: 150, quality: 'OQC验Pass' as const, note: '正常入库' },
      { seq: 2, sku: 'SUP0002-002', model: 'MICRO-400 微波炉 黑色', pos: 'B03-02', qty: 80, quality: '待复检' as const, note: '待复检拦截' },
      { seq: 3, sku: 'SUP0003-001', model: 'TOAST-A 烤面包机 A', pos: 'B03-03', qty: 70, quality: '不合格' as const, disposal: '让步接收' as const, note: '外观瑕疵，让步接收' },
      { seq: 4, sku: 'SUP0002-002', model: 'MICRO-400 微波炉 黑色', pos: 'B03-04', qty: 80, quality: '不合格' as const, disposal: '退货' as const, note: '尺寸超差，整托退货' },
      { seq: 5, sku: 'SUP0003-001', model: 'TOAST-A 烤面包机 A', pos: 'B03-05', qty: 80, quality: '不合格' as const, disposal: '报废' as const, note: '功能不良，整托报废' }
    ];
    o4Demands.forEach(d => {
      const demandId = `demand_o4_${d.seq}`;
      const inboundId = `inbound_o4_${d.seq}`;
      demands.push({ id: demandId, order_id: order4Id, order_no: o4.order_no, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_id: inboundId });
      inbounds.push({ id: inboundId, order_id: order4Id, order_no: o4.order_no, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_date: '2026-09-03', actual_qty: d.qty, line: '线别A-02', handler: '赵磊', quality: d.quality, disposal: d.disposal, note: d.note });
    });

    // ===== 新增：Order 5 - 已完结（全额入库且全部发出）=====
    const order5Id = 'order_005';
    const o5: Order = {
      id: order5Id, order_no: 'PO260905', customer_code: 'PO26', model: 'OVEN-X1 电烤箱 黑色',
      order_qty: 200, per_pallet: 100, pallet_count: 2, status: 'completed', created_at: '2026-09-05'
    };
    orders.push(o5);
    for (let i = 1; i <= 2; i++) {
      const demandId = `demand_o5_${i}`;
      const inboundId = `inbound_o5_${i}`;
      demands.push({ id: demandId, order_id: order5Id, order_no: o5.order_no, sku: 'SUP0001-002', model: o5.model, seq: i, position_code: `A05-0${i}`, inbound_id: inboundId });
      inbounds.push({ id: inboundId, order_id: order5Id, order_no: o5.order_no, sku: 'SUP0001-002', model: o5.model, seq: i, position_code: `A05-0${i}`, inbound_date: '2026-09-06', actual_qty: 100, line: '线别A-01', handler: '张敏', quality: 'OQC验Pass', note: '正常入库' });
      outbounds.push({ id: `outbound_o5_${i}`, inbound_id: inboundId, order_id: order5Id, order_no: o5.order_no, model: o5.model, position_code: `A05-0${i}`, outbound_date: '2026-09-12', outbound_qty: 100, handler: '王强', note: '全部发出，完结' });
    }

    // ===== 新增：Order 6 - 欠库不足（只到 2 托，未达订单量）=====
    const order6Id = 'order_006';
    const o6: Order = {
      id: order6Id, order_no: 'PO260910', customer_code: 'PO26', model: 'MICRO-400 微波炉 黑色',
      order_qty: 400, per_pallet: 80, pallet_count: 5, status: 'shortage', created_at: '2026-09-08'
    };
    orders.push(o6);
    for (let i = 1; i <= 2; i++) {
      const demandId = `demand_o6_${i}`;
      const inboundId = `inbound_o6_${i}`;
      demands.push({ id: demandId, order_id: order6Id, order_no: o6.order_no, sku: 'SUP0002-002', model: o6.model, seq: i, position_code: `B06-0${i}`, inbound_id: inboundId });
      inbounds.push({ id: inboundId, order_id: order6Id, order_no: o6.order_no, sku: 'SUP0002-002', model: o6.model, seq: i, position_code: `B06-0${i}`, inbound_date: '2026-09-09', actual_qty: 80, line: '线别B-02', handler: '陈芳', quality: 'OQC验Pass', note: '部分到货' });
    }

    // ===== 库存初始化入库：让各 SKU 落在 充裕 / 偏低 / 需补货 三档（派生库存按仓位账本实时计算）=====
    const stockSeed = STOCK_SEED;
    let stkIdx = 0;
    Object.keys(stockSeed).forEach(sku => {
      const qty = stockSeed[sku];
      if (!qty) return;
      const pos = this.stockSeedPosition(stkIdx);
      stkIdx += 1;
      const inboundId = `inbound_stk_${sku}`;
      inbounds.push({
        id: inboundId, order_id: 'stk-seed', order_no: 'WH2026-STK', sku, model: this.skuTitle(sku),
        seq: stkIdx, position_code: pos, inbound_date: '2026-08-20', actual_qty: qty,
        line: '线别C-01', handler: '赵磊', quality: 'OQC验Pass', note: '库存初始化'
      });
    });

    // ===== 跨月出库：丰富进销存月报 / 出库台账（均为 OQC 可售库存扣减）=====
    const stkOut: Array<[string, string, number, string, string]> = [
      ['SUP0001-001', '2026-08-20', 20, '刘杰', '大客户调拨'],
      ['SUP0001-001', '2026-09-05', 20, '王强', '电商备货'],
      ['SUP0002-003', '2026-08-25', 15, '陈芳', '线下门店'],
      ['SUP0003-001', '2026-09-08', 50, '张敏', '电商发货'],
      ['SUP0006-003', '2026-09-10', 10, '刘杰', '促销出货'],
      ['SUP0005-003', '2026-08-30', 30, '王强', '批发'],
      ['SUP0005-002', '2026-09-12', 10, '陈芳', '补货发出'],
      ['SUP0004-002', '2026-09-01', 5, '张敏', '样机出库']
    ];
    stkOut.forEach(([sku, date, qty, handler, note], i) => {
      outbounds.push({
        id: `outbound_stk_${i + 1}`, inbound_id: `inbound_stk_${sku}`, order_id: 'stk-seed', order_no: 'WH2026-STK',
        model: this.skuTitle(sku), position_code: this.stockSeedPosition(Object.keys(stockSeed).indexOf(sku)),
        outbound_date: date, outbound_qty: qty, handler, note
      });
    });

    // ===== 电商平台订单：8 个平台、28 条（16 待出库 / 12 已出库）=====
    const pendingOutbounds: PendingOutbound[] = DEMO_ECOM_ORDERS.map(o => ({ ...o, id: generateUUID() }));

    // ===== 已收货采购单入库（ERP 对账：一致 / 差异）=====
    // PO20260912 → 全额合格入库 → 一致；PO20260915 → 部分不合格 → 差异
    const recDemands = [
      { poNo: 'PO20260912', seq: 1, sku: 'SUP0004-002', model: 'DISH-90 洗碗机 M', pos: 'A15-01', qty: 100, quality: 'OQC验Pass' as const },
      { poNo: 'PO20260912', seq: 2, sku: 'SUP0005-003', model: 'BAKE 配件 03', pos: 'A15-02', qty: 200, quality: 'OQC验Pass' as const },
      { poNo: 'PO20260915', seq: 1, sku: 'SUP0005-001', model: 'BAKE 配件 01', pos: 'A15-03', qty: 200, quality: 'OQC验Pass' as const },
      { poNo: 'PO20260915', seq: 2, sku: 'SUP0005-001', model: 'BAKE 配件 01', pos: 'A15-04', qty: 100, quality: '不合格' as const, note: '到货抽检不合格，冻结待处置' }
    ];
    recDemands.forEach(d => {
      const demandId = `demand_rec_${d.poNo}_${d.seq}`;
      const inboundId = `inbound_rec_${d.poNo}_${d.seq}`;
      demands.push({ id: demandId, order_id: `rec-${d.poNo}`, order_no: d.poNo, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_id: inboundId, product: d.model });
      inbounds.push({ id: inboundId, order_id: `rec-${d.poNo}`, order_no: d.poNo, sku: d.sku, model: d.model, seq: d.seq, position_code: d.pos, inbound_date: d.poNo === 'PO20260912' ? '2026-09-14' : '2026-09-15', actual_qty: d.qty, line: '线别A-01', handler: '张敏', quality: d.quality, note: d.note || '采购到货入库' });
    });

    // Save to localStorage
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
    localStorage.setItem(KEYS.DEMANDS, JSON.stringify(demands));
    localStorage.setItem(KEYS.INBOUNDS, JSON.stringify(inbounds));
    localStorage.setItem(KEYS.OUTBOUNDS, JSON.stringify(outbounds));
    // 待出库单据：必须**保留**电商平台（淘宝 / 亚马逊）已推送过来的单据
    // （`pages/tb-orders.html` / `amz-orders.html` 发货时写入本 key，是外部系统的真实业务数据），
    // 演示单据仅按 ecomOrderNo 去重后**追加**，不再整表覆盖 —— 否则首次打开 WMS 会把推送冲掉。
    const _existingPending: PendingOutbound[] = (() => {
      try {
        const raw = localStorage.getItem(KEYS.PENDING_OUTBOUNDS);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list as PendingOutbound[] : [];
      } catch (e) { return []; }
    })();
    // 若已存在**电商平台推送**的待出库单据（`pages/tb-orders.html` / `amz-orders.html` 发货时写入），
    // 则**完全不注入演示单据** —— 保证「淘宝发货 N 单 → WMS 待出库 N 条」的因果清晰；
    // 只有在没有任何推送时才落 28 条演示数据（供首次浏览 / 培训演示）。
    const _mergedPending = _existingPending.length ? _existingPending : pendingOutbounds;
    localStorage.setItem(KEYS.PENDING_OUTBOUNDS, JSON.stringify(_mergedPending));

    // 追加扩充批次的演示订单（第 19~50 个 SKU 的订单 / 上架 / 出库记录）与电商平台订单
    this.ensureDemoOrders();
    this.ensureDemoEcomOrders();
  },


  // 规整 SKU 行：最大卡板容量与数量至少为 1
    normalizePlanLines(this: DBServiceApi, lines: InboundPlanLine[]): InboundPlanLine[] {
    return lines.map(l => ({
      sku: l.sku || l.title,
      title: l.title,
      maxPerPallet: Math.max(1, Number(l.maxPerPallet) || 1),
      qty: Math.max(1, Number(l.qty) || 0)
    }));
  },


  // 按 SKU 行生成卡板需求（一托一个 SKU，最后一托为余数）
    buildPlanDemands(this: DBServiceApi, order: Order, demands: PositionDemand[]) {
    let seq = 0;
    (order.lines || []).forEach(line => {
      const palletCount = Math.max(1, Math.ceil(line.qty / line.maxPerPallet));
      let remain = line.qty;
      for (let i = 0; i < palletCount; i++) {
        const qty = Math.min(line.maxPerPallet, remain);
        remain -= qty;
        seq += 1;
        demands.push({
          id: generateUUID(),
          order_id: order.id,
          order_no: order.order_no,
          sku: line.sku,
          model: line.title,
          product: line.title,
          source: 'order',
          seq,
          position_code: null,
          inbound_id: null,
          planned_qty: qty,
          maxPerPallet: line.maxPerPallet
        });
      }
    });
  }
};
