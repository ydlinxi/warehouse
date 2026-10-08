/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { ProductModel, Supplier, ProductSku } from '../../types';
import { safeNum } from '../formatters';
import { DEFAULT_MODELS } from '../defaults';
import { KEYS } from '../defaults';
import { SEED_SUPPLIERS, SEED_PRODUCT_SKUS, SEED_ITEMS, modelOfTitle } from '../../seed';



  // 型号 / SPU 短码 → 代表 SKU（兼容历史数据中入库 model 仅记录到 SPU 级别的情况）
  export const SKU_RESOLVE_HINT: Record<string, string> = {
    'OVEN-X1': 'SUP0001-001', 'MICRO-400': 'SUP0002-002', 'TOAST-A': 'SUP0003-001',
    'DISH-90': 'SUP0004-001', 'BAKE 配件': 'SUP0005-001', 'MINI': 'SUP0006-001'
  };

export const CatalogService = {


  // 型号库（= 商品库）：统一由商品主数据派生，避免型号库与 SKU 主数据两套口径
    getModels(this: DBServiceApi): ProductModel[] {
    const items = this.getRawItems();
    if (items.length) {
      return items.map(it => ({
        itemId: it.itemId, name: it.name, itemName: it.itemName, code: it.code,
        default_per_pallet: it.default_per_pallet,
        safety_stock: it.safety_stock
      }));
    }
    return DEFAULT_MODELS;
  },


  // 保存型号库 = 回写商品主数据（保留原商品ID / 商品名；新增型号自动分配商品ID）
    saveModels(this: DBServiceApi, models: ProductModel[]) {
    const items = this.getRawItems();
    const next = models.map(m => {
      const hit = items.find(it => it.itemId === m.itemId || it.name === m.name);
      const itemId = m.itemId || hit?.itemId || this.nextItemId();
      return {
        itemId,
        name: m.name,
        itemName: m.itemName || hit?.itemName || m.name,
        code: m.code || hit?.code || String(itemId).replace(/\D/g, ''),
        default_per_pallet: Math.max(1, Number(m.default_per_pallet) || 100),
        safety_stock: Math.max(0, Number(m.safety_stock) || 0)
      } as ProductModel;
    });
    this.saveItems(next);
    localStorage.setItem(KEYS.MODELS, JSON.stringify(next));
  },


  // ===== 供应链：供应商 / 商品SKU / 补货计划 / 采购单 =====
    getSuppliers(this: DBServiceApi): Supplier[] {
    const saved = localStorage.getItem(KEYS.SUPPLIERS);
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(SEED_SUPPLIERS));
    return SEED_SUPPLIERS;
  },


    saveSuppliers(this: DBServiceApi, list: Supplier[]) {
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(list));
  },


  // ===== 商品主数据（SPU 级，即「主体商品」）=====
  // 一个商品（如 SPU0001 OVEN-X1 电烤箱）下可挂多个 SKU（红色/黑色… 4G+64G/8G+128G…）
    getRawItems(this: DBServiceApi): ProductModel[] {
    const normalize = (arr: any[]): ProductModel[] => arr.map(it => ({
      itemId: it.itemId,
      name: it.name,
      itemName: it.itemName || it.name,
      code: it.code,
      default_per_pallet: Math.max(1, Number(it.default_per_pallet) || 100),
      safety_stock: Math.max(0, Number(it.safety_stock) || 0)
    }));
    const saved = localStorage.getItem(KEYS.ITEMS);
    if (saved) { try { return normalize(JSON.parse(saved)); } catch (e) {} }
    const seed = SEED_ITEMS.map(it => ({ ...it }));
    localStorage.setItem(KEYS.ITEMS, JSON.stringify(seed));
    return seed;
  },


    saveItems(this: DBServiceApi, list: ProductModel[]) {
    localStorage.setItem(KEYS.ITEMS, JSON.stringify(list));
  },


  // 下一个商品ID（SPU + 四位序号，offset 供同批次连续预览）
    nextItemId(this: DBServiceApi, offset: number = 0): string {
    const nums = this.getRawItems()
      .map(it => parseInt(String(it.itemId || '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1 + offset;
    return 'SPU' + String(next).padStart(4, '0');
  },


  // 按型号（品名首词）反查商品ID
    itemIdByTitle(this: DBServiceApi, title: string): string | undefined {
    const model = modelOfTitle(title);
    return this.getRawItems().find(it => it.name === model)?.itemId;
  },


  // 商品主数据自愈：为历史 SKU 补 itemId、为缺失型号建档（幂等，可重复执行）
    ensureItemMaster(this: DBServiceApi): number {
    const items = this.getRawItems();
    let skusRaw: any[] = [];
    try {
      const raw = localStorage.getItem(KEYS.PRODUCT_SKUS);
      const arr = raw ? JSON.parse(raw) : [];
      skusRaw = Array.isArray(arr) ? arr : [];
    } catch (e) { skusRaw = []; }
    if (!skusRaw.length) return 0;

    const byModel: Record<string, ProductModel> = {};
    items.forEach(it => { byModel[it.name] = it; });
    let patched = 0;
    const added: ProductModel[] = [];
    skusRaw.forEach(s => {
      const model = modelOfTitle(s.title || '');
      let it = byModel[model];
      if (!it) {
        const seq = String(items.length + added.length + 1).padStart(4, '0');
        it = {
          itemId: 'SPU' + seq, name: model, itemName: s.title || model, code: seq,
          default_per_pallet: Math.max(1, Number(s.perPallet) || 100),
          safety_stock: Math.max(0, Number(s.replenishPoint) || 0)
        };
        byModel[model] = it; added.push(it);
      }
      if (s.itemId !== it.itemId) { s.itemId = it.itemId; patched++; }
    });
    if (added.length) this.saveItems([...items, ...added]);
    if (patched) this.saveProductSkus(skusRaw);
    return added.length + patched;
  },


  // 读取原始 SKU（不做库存推导），供内部匹配使用，避免与 getProductSkus 形成递归
    getRawProductSkus(this: DBServiceApi): ProductSku[] {
    // 历史数据可能没有 itemId：读取时按型号兜底补齐（持久化由 ensureItemMaster 完成）
    const normalize = (arr: any[]): ProductSku[] => arr.map(s => ({
      ...s,
      perPallet: Math.max(1, Number(s.perPallet) || 100),
      itemId: s.itemId || this.itemIdByTitle(s.title || '') || SEED_ITEMS[0].itemId
    }));
    const saved = localStorage.getItem(KEYS.PRODUCT_SKUS);
    if (saved) { try { return normalize(JSON.parse(saved)); } catch (e) {} }
    const seed = SEED_PRODUCT_SKUS.map(s => ({ ...s }));
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify(seed));
    return seed;
  },


    getProductSkus(this: DBServiceApi): ProductSku[] {
    const list = this.getRawProductSkus();
    // 库存以「仓位账本（Inbound/Outbound）」为唯一真相源，读取时实时推导；
    // 仅 OQC验Pass 的入库减去对应出库计入在售，质检未通过数量不计入。
    const stockMap = this.computeSkuAvailableStock();
    return list.map(s => ({ ...s, stock: stockMap[s.sku] ?? 0 }));
  },


  // 生成/预览 SKU 编码：供应商号-三位序号（offset 供同批次多行新 SKU 连续预览）
    nextSkuCode(this: DBServiceApi, supplierId: string, offset: number = 0): string {
    const nums = this.getRawProductSkus()
      .filter(s => (s.sku || '').startsWith(supplierId + '-'))
      .map(s => parseInt(s.sku.slice(supplierId.length + 1), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1 + offset;
    return `${supplierId}-${String(next).padStart(3, '0')}`;
  },


  // 手工新建采购单：为已有供应商挂新 SKU（自动编码 供应商号-三位序号，写入商品主数据）
  // 商品归属优先级：显式 itemId（挂到已有商品）> itemName（新建商品）> 按品名型号自动匹配 / 自动建档
    addProductSku(this: DBServiceApi, input: {
    supplierId: string; supplierName: string; title: string; price: number;
    itemId?: string; itemName?: string;
    perPallet?: number; replenishPoint?: number; abundanceThreshold?: number;
    emoji?: string; cat?: string; spec?: string; color?: string;
  }): ProductSku {
    const list = this.getRawProductSkus();
    const sku = this.nextSkuCode(input.supplierId);
    const model = modelOfTitle(input.title);
    const items = this.getRawItems();

    let itemId = input.itemId;
    if (itemId && !items.some(it => it.itemId === itemId)) itemId = undefined; // 传入不存在的商品ID则忽略
    if (!itemId) {
      const wanted = (input.itemName || '').trim();
      if (wanted) {
        const hit = items.find(it => it.itemName === wanted || it.name === wanted);
        itemId = hit?.itemId;
      }
      if (!itemId) itemId = items.find(it => it.name === model)?.itemId;
      if (!itemId) {
        // 新建商品（主体商品）：商品ID 自动递增，型号取品名首词
        const newId = this.nextItemId();
        const created: ProductModel = {
          itemId: newId, name: model, itemName: wanted || model,
          code: String(newId).replace(/\D/g, ''),
          default_per_pallet: Math.max(1, Number(input.perPallet) || 100),
          safety_stock: Math.max(0, Number(input.replenishPoint) || 20)
        };
        this.saveItems([...items, created]);
        itemId = created.itemId;
      } else {
        // 已有商品：单托容量 / 安全库存按新 SKU 顺带刷新上限
        this.saveItems(items.map(it => it.itemId === itemId ? {
          ...it,
          default_per_pallet: Math.max(it.default_per_pallet, Math.max(1, Number(input.perPallet) || 100)),
          safety_stock: Math.max(it.safety_stock, Math.max(0, Number(input.replenishPoint) || 0))
        } : it));
      }
    }

    const rec: ProductSku = {
      sku,
      itemId: itemId!,
      title: input.title,
      emoji: input.emoji || '🆕',
      cat: input.cat || '新品',
      spec: input.spec,
      color: input.color,
      price: input.price,
      stock: 0, // 实际库存由仓位账本实时推导，这里仅占位
      perPallet: input.perPallet || 100,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      replenishPoint: input.replenishPoint ?? 20,
      abundanceThreshold: input.abundanceThreshold ?? 50
    };
    list.push(rec);
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify(list));
    return rec;
  },


  // 将入库记录的 model / sku 解析为内部 SKU 编码（优先用 sku 字段，其次标题/SPU 兼容）
    resolveSkuCode(this: DBServiceApi, model?: string, skuField?: string): string | undefined {
    if (skuField) {
      const hit = this.getRawProductSkus().find(s => s.sku === skuField);
      if (hit) return hit.sku;
    }
    if (!model) return undefined;
    const raw = this.getRawProductSkus();
    const byTitle = raw.find(s => s.title === model);
    if (byTitle) return byTitle.sku;
    const hint = SKU_RESOLVE_HINT[model.trim()];
    if (hint) return hint;
    const byPrefix = raw.find(s => model.startsWith(s.title.split(' ')[0]));
    return byPrefix?.sku;
  },


  // 单个 SKU 的库存构成（解释「当前库存」为何小于仓位在架量）：
  // available=可售（OQC验Pass 入库 − 已出库）｜pending=待复检｜reject=不合格｜shipped=已出库｜physical=在架物理量
    getSkuStockBreakdown(this: DBServiceApi, sku: string): { available: number; pending: number; reject: number; shipped: number; physical: number } {
    const inbounds = this.getInbounds().filter(i => this.resolveSkuCode(i.model, i.sku) === sku);
    const outByInbound: Record<string, number> = {};
    this.getOutbounds().forEach(o => { outByInbound[o.inbound_id] = (outByInbound[o.inbound_id] || 0) + safeNum(o.outbound_qty); });
    let available = 0, pending = 0, reject = 0, shipped = 0;
    inbounds.forEach(i => {
      const qty = safeNum(i.actual_qty);
      const out = Math.min(qty, outByInbound[i.id] || 0);
      shipped += out;
      const rest = Math.max(0, qty - out);
      const q = (i.quality || 'OQC验Pass') as string; // 与 computeSkuAvailableStock 口径一致：未标注质检视为可售
      if (q === 'OQC验Pass') available += rest;
      else if (q === '待复检') pending += rest;
      else reject += rest;
    });
    return { available, pending, reject, shipped, physical: available + pending + reject };
  },


  // 以仓位账本为唯一真相源推导各 SKU 在售库存（不含质检未通过）
    computeSkuAvailableStock(this: DBServiceApi): Record<string, number> {
    const inbounds = this.getInbounds();
    const outbounds = this.getOutbounds();
    const outByInbound: Record<string, number> = {};
    outbounds.forEach(o => { outByInbound[o.inbound_id] = (outByInbound[o.inbound_id] || 0) + safeNum(o.outbound_qty); });
    const map: Record<string, number> = {};
    inbounds.forEach(inb => {
      if (inb.quality && inb.quality !== 'OQC验Pass') return; // 质检未通过不计入在售
      const skuCode = this.resolveSkuCode(inb.model, inb.sku);
      if (!skuCode) return; // 非采购 SKU（如成品型号）不参与供应链账
      const avail = Math.max(0, safeNum(inb.actual_qty) - (outByInbound[inb.id] || 0));
      map[skuCode] = (map[skuCode] || 0) + avail;
    });
    return map;
  },


    saveProductSkus(this: DBServiceApi, list: ProductSku[]) {
    localStorage.setItem(KEYS.PRODUCT_SKUS, JSON.stringify(list));
  }
};
