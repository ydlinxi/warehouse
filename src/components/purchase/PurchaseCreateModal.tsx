/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 新建采购单弹窗（P2-4b 区块拆分自 PurchaseManager）：自持全部建单表单状态与校验逻辑。
import React, { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { DBService } from '../../db';
import { toast } from '../../utils/toast';
import { PurchaseOrder, ProductModel } from '../../types';

interface CreateRow {
  key: number; mode: 'existing' | 'new';
  sku: string; title: string; spec: string; color: string;
  itemId: string;        // 归属商品（SPU）：'' 表示新建商品
  newItemName: string;   // 新建商品时的商品名称
  perPallet: number; need: number; price: number;
}

interface Props {
  onCreated: (poNo: string, newCnt: number) => void;
  onClose: () => void;
}

export const PurchaseCreateModal: React.FC<Props> = ({ onCreated, onClose }) => {
  const suppliers = DBService.getSuppliers();
  const [cSupplierId, setCSupplierId] = useState(() => suppliers[0]?.id || '');
  const [cItems, setCItems] = useState<CreateRow[]>([]);
  const [cExpect, setCExpect] = useState(() => new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
  const [cPay, setCPay] = useState('预付全款');
  const [cNote, setCNote] = useState('');

  const supplierSkus = DBService.getProductSkus().filter(s => s.supplierId === cSupplierId);

  const changeSupplier = (id: string) => { setCSupplierId(id); setCItems([]); };

  const addRow = (mode: 'existing' | 'new') =>
    setCItems(prev => [...prev, {
      key: Date.now() + Math.random(), mode,
      sku: '', title: '', spec: '', color: '',
      itemId: '', newItemName: '', perPallet: 100, need: 100, price: 0
    }]);

  const patchRow = (key: number, patch: Partial<Omit<CreateRow, 'key' | 'mode'>>) =>
    setCItems(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));

  const pickExistingSku = (key: number, sku: string) => {
    const rec = supplierSkus.find(s => s.sku === sku);
    patchRow(key, { sku, title: rec?.title || '', spec: rec?.spec || '', price: rec?.price || 0 });
  };

  const removeRow = (key: number) => setCItems(prev => prev.filter(r => r.key !== key));

  // 同批次多个新 SKU：按行序连续预览自动编码（如 SUP0001-004、005…）
  const newRowOffset = (key: number) => cItems.filter(x => x.mode === 'new').findIndex(x => x.key === key);

  // 该供应商名下已有的商品（SPU）：新建 SKU 时可挂到已有商品，或选择「新建商品」
  const itemOfSuppliers = (() => {
    const all = DBService.getRawItems();
    const ids = [...new Set(supplierSkus.map(s => s.itemId))];
    return ids.map(id => all.find(it => it.itemId === id)).filter((it): it is ProductModel => !!it);
  })();
  // 同批次「新建商品」的商品ID预览偏移
  const newItemOffset = (key: number) => cItems.filter(x => x.mode === 'new' && !x.itemId).findIndex(x => x.key === key);

  const normKey = (v?: string) => (v || '').replace(/\s+/g, '').toLowerCase();

  // 明细校验：返回空串=通过。新 SKU 额外做品名规范 + 「一物多码」防重
  const rowError = (r: CreateRow): string => {
    if (!(r.need > 0)) return '数量需大于 0';
    if (r.mode === 'existing') {
      if (!r.sku) return '请选择该供应商的 SKU';
      if (cItems.some(o => o.key !== r.key && o.mode === 'existing' && o.sku === r.sku)) return '该 SKU 在本单中重复';
      return '';
    }
    if (!r.itemId && !(r.newItemName || '').trim()) return '请选择归属商品（SPU），或填写新商品名称';
    const title = (r.title || '').trim();
    if (!title) return '品名必填';
    if (title.length < 2) return '品名至少 2 个字符';
    if (!/[\u4e00-\u9fa5A-Za-z]/.test(title)) return '品名需含中文或字母，不能只有数字/符号';
    if (title.includes(' · ') || /\d{3,}-\d{2,}/.test(title)) return '品名只填产品名称，不要带 SKU 编码或「 · 」分隔符';
    const hit = supplierSkus.find(s => normKey(s.title) === normKey(title) && normKey(s.spec) === normKey(r.spec) && normKey(s.color) === normKey(r.color));
    if (hit) return `已存在同款 ${hit.sku}（品名/规格/颜色一致），请改用「选择已有 SKU」`;
    if (cItems.some(o => o.key !== r.key && o.mode === 'new'
      && normKey(o.title) === normKey(title) && normKey(o.spec) === normKey(r.spec) && normKey(o.color) === normKey(r.color)))
      return '本单中已有完全相同的新 SKU';
    return '';
  };

  const rowErrors = cItems.map(r => ({ key: r.key, msg: rowError(r) }));
  const errorOf = (key: number) => rowErrors.find(e => e.key === key)?.msg || '';
  const errorCnt = rowErrors.filter(e => e.msg).length;
  const canSubmit = cItems.length > 0 && errorCnt === 0;

  const cTotals = {
    qty: cItems.reduce((s, x) => s + (x.need || 0), 0),
    amt: cItems.reduce((s, x) => s + (x.need || 0) * (x.price || 0), 0),
    newCnt: cItems.filter(x => x.mode === 'new').length,
  };

  const submitCreate = () => {
    const sup = suppliers.find(s => s.id === cSupplierId);
    if (!sup) { toast('请选择供应商', 'warn'); return; }
    if (!cItems.length) { toast('请至少添加一条采购明细（选择已有 SKU 或新建 SKU）', 'warn'); return; }
    if (!canSubmit) {
      toast('明细校验未通过：' + (rowErrors.find(e => e.msg)?.msg || '请检查明细'), 'warn');
      return;
    }
    const totalQty = cItems.reduce((s, x) => s + (x.need || 0), 0);
    const moq = Number(sup.moq) || 0;
    if (moq > 0 && totalQty < moq) {
      if (!window.confirm(`${sup.name} 的起订量（MOQ）为 ${moq} 件，本次采购总量仅 ${totalQty} 件，是否仍要创建采购单？`)) return;
    }
    const items: PurchaseOrder['items'] = [];
    for (const r of cItems) {
      if (r.mode === 'new') {
        const title = (r.title || '').trim();
        const rec = DBService.addProductSku({
          supplierId: sup.id, supplierName: sup.name, title,
          itemId: r.itemId || undefined,
          itemName: r.itemId ? undefined : ((r.newItemName || '').trim() || undefined),
          spec: (r.spec || '').trim(), color: (r.color || '').trim(),
          price: r.price || 0, perPallet: Math.max(1, Number(r.perPallet) || 100)
        });
        items.push({ sku: rec.sku, title, need: r.need, price: r.price || 0 });
      } else {
        items.push({ sku: r.sku, title: r.title, need: r.need, price: r.price || 0 });
      }
    }
    const po: PurchaseOrder = {
      poNo: 'PO-MAN-' + Date.now().toString().slice(-8),
      supplierId: sup.id, supplierName: sup.name,
      items,
      totalQty: items.reduce((s, x) => s + x.need, 0),
      totalAmt: items.reduce((s, x) => s + x.need * x.price, 0),
      status: '待采购', createdAt: new Date().toISOString().slice(0, 10),
      expectDate: cExpect, payMethod: cPay, note: cNote || '手工新建采购单'
    };
    const all = DBService.getPurchaseOrders(); all.push(po); DBService.savePurchaseOrders(all);
    onCreated(po.poNo, cTotals.newCnt);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Plus className="text-emerald-500" size={20} />新建采购单</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              供应商（已合作名单）
              <select value={cSupplierId} onChange={e => changeSupplier(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5">
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}（{s.id}）</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              预交货日
              <input type="date" value={cExpect} onChange={e => setCExpect(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              付款方式
              <input type="text" value={cPay} onChange={e => setCPay(e.target.value)} placeholder="如 预付全款 / 月结30天" className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </label>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-2 px-3">类型</th><th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">品名 / 规格</th>
                  <th className="py-2 px-3 text-right">单托容量</th>
                  <th className="py-2 px-3 text-right">数量</th><th className="py-2 px-3 text-right">单价</th>
                  <th className="py-2 px-3 text-right">小计</th><th className="py-2 px-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cItems.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-400">暂无明细，请点击下方「＋选择已有 SKU」或「＋新建 SKU」</td></tr>
                )}
                {cItems.map(r => (
                  <tr key={r.key} className="align-top">
                    <td className="py-2 px-3">
                      {r.mode === 'new'
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">🆕 新SKU</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 whitespace-nowrap">已有</span>}
                    </td>
                    <td className="py-2 px-3">
                      {r.mode === 'existing' ? (
                        <span className="font-mono font-bold text-indigo-600 whitespace-nowrap">{r.sku || '— 待选择 —'}</span>
                      ) : (
                        <div className="whitespace-nowrap">
                          <div className="font-mono font-bold text-amber-600">{DBService.nextSkuCode(cSupplierId, Math.max(0, newRowOffset(r.key)))}</div>
                          <div className="text-[10px] text-slate-400">自动编码（只读）</div>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {r.mode === 'existing' ? (
                        <div className="flex flex-col gap-1 min-w-[240px]">
                          <select value={r.sku} onChange={e => pickExistingSku(r.key, e.target.value)} className="border border-slate-300 rounded px-2 py-1">
                            <option value="">— 选择该供应商的 SKU —</option>
                            {supplierSkus
                              .filter(s => s.sku === r.sku || !cItems.some(o => o.key !== r.key && o.mode === 'existing' && o.sku === s.sku))
                              .map(s => <option key={s.sku} value={s.sku}>{s.sku} · {s.title}</option>)}
                          </select>
                          <div className="text-[10px] text-slate-400 truncate">规格：{r.spec || '—'}（取自 SKU 主数据）</div>
                          <div className="text-[10px] text-violet-600 font-mono">商品 {supplierSkus.find(s => s.sku === r.sku)?.itemId || '—'}</div>
                          {errorOf(r.key) && <div className="text-[10px] text-rose-600 font-semibold">{errorOf(r.key)}</div>}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 min-w-[240px]">
                          <select value={r.itemId} onChange={e => patchRow(r.key, { itemId: e.target.value })}
                            className="border border-slate-300 rounded px-2 py-1 text-[11px]">
                            <option value="">＋ 新建商品（SPU）</option>
                            {itemOfSuppliers.map(it => <option key={it.itemId} value={it.itemId}>{it.itemId} · {it.itemName}</option>)}
                          </select>
                          {r.itemId
                            ? <div className="text-[10px] text-slate-400">该 SKU 将挂到商品 <span className="font-mono text-violet-600">{r.itemId}</span></div>
                            : (
                              <>
                                <input type="text" value={r.newItemName} onChange={e => patchRow(r.key, { newItemName: e.target.value })}
                                  placeholder="新商品名称（必填），如 MICRO-400 微波炉" className="border border-slate-300 rounded px-2 py-1" />
                                <div className="text-[10px] text-violet-600 font-mono">商品ID 预览：{DBService.nextItemId(Math.max(0, newItemOffset(r.key)))}</div>
                              </>
                            )}
                          <input type="text" value={r.title} onChange={e => patchRow(r.key, { title: e.target.value })}
                            placeholder="SKU 品名（必填），如 OVEN-X1 电烤箱 紫色" className="border border-slate-300 rounded px-2 py-1" />
                          <div className="flex gap-1">
                            <input type="text" value={r.spec} onChange={e => patchRow(r.key, { spec: e.target.value })}
                              placeholder="规格，如 256G/标准版" className="border border-slate-300 rounded px-2 py-1 w-1/2" />
                            <input type="text" value={r.color} onChange={e => patchRow(r.key, { color: e.target.value })}
                              placeholder="颜色，如 金色" className="border border-slate-300 rounded px-2 py-1 w-1/2" />
                          </div>
                          {errorOf(r.key) && <div className="text-[10px] text-rose-600 font-semibold">{errorOf(r.key)}</div>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {r.mode === 'new'
                        ? <input type="number" min={1} value={r.perPallet} onChange={e => patchRow(r.key, { perPallet: Number(e.target.value) })}
                            className="w-20 border border-slate-300 rounded py-1 px-2 text-right font-mono" title="单托容量：决定入库时拆几个卡板" />
                        : <span className="font-mono text-slate-500">{supplierSkus.find(s => s.sku === r.sku)?.perPallet ?? '—'}</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input type="number" min={0} value={r.need} onChange={e => patchRow(r.key, { need: Number(e.target.value) })}
                        className="w-20 border border-slate-300 rounded py-1 px-2 text-right font-mono font-bold" />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input type="number" min={0} value={r.price} onChange={e => patchRow(r.key, { price: Number(e.target.value) })}
                        className="w-20 border border-slate-300 rounded py-1 px-2 text-right font-mono" />
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-700 whitespace-nowrap">¥{((r.need || 0) * (r.price || 0)).toLocaleString()}</td>
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => removeRow(r.key)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer" title="删除该明细"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => addRow('existing')} className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer flex items-center gap-1"><Plus size={12} />选择已有 SKU</button>
            <button onClick={() => addRow('new')} className="px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-lg text-[11px] font-semibold text-amber-700 cursor-pointer flex items-center gap-1"><Plus size={12} />新建 SKU</button>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5 leading-relaxed">
            「新建 SKU」字段：<b>归属商品（SPU）</b>（挂到已有商品，或选择「新建商品」并填写商品名，商品ID 自动生成 如 SPU0023）、<b>SKU 编码</b>（自动生成 供应商号-三位序号，如上表预览的 SUP0005-004）、<b>SKU 品名</b>（必填）、<b>规格</b>、<b>颜色</b>、<b>单托容量</b>、<b>单价</b>，保存时一并写入商品主数据与 SKU 主数据；补货值默认 20、充裕值默认 50，可在「补货预警」或「系统配置」调整。单托容量决定收货时拆几个卡板，库存则由到货上架后的仓位账本实时推导。当前暂不支持引入新供应商。
            <div className="mt-1.5 text-rose-600 font-semibold">校验规则：品名必填且需含中文/字母、不得混入 SKU 编码或「 · 」分隔符；同一供应商下 品名+规格+颜色 完全相同会被拦截，请改用「选择已有 SKU」，避免一物多码；采购总量低于供应商起订量（MOQ）时会二次确认。</div>
          </div>

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            备注
            <input type="text" value={cNote} onChange={e => setCNote(e.target.value)} placeholder="备注说明（默认：手工新建采购单）" className="border border-slate-300 rounded-lg px-2 py-1.5" />
          </label>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">合计：<b className="text-slate-800">{cTotals.qty} 件</b> / <b className="text-emerald-600">¥{cTotals.amt.toLocaleString()}</b>{cTotals.newCnt > 0 && <b className="text-amber-600 ml-2">（{cTotals.newCnt} 个新 SKU）</b>}</span>
            {errorCnt > 0 && <span className="text-rose-600 text-xs font-semibold">{errorCnt} 条明细未通过校验</span>}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer">取消</button>
          <button
            onClick={submitCreate}
            disabled={!canSubmit}
            title={canSubmit ? '创建采购单' : '请先修正校验未通过的明细'}
            className={`px-4 py-2 rounded-lg text-xs font-semibold shadow ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >创建采购单</button>
        </div>
      </div>
    </div>
  );
};
