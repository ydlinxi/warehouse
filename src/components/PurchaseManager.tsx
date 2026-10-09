/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShoppingCart, CheckCircle, Plus } from 'lucide-react';
import { DBService } from '../db';
import { toast } from '../utils/toast';
import { PurchaseOrder, PurchaseStatus } from '../types';
import { PurchaseOrdersTable } from './purchase/PurchaseOrdersTable';
import { PurchaseCreateModal } from './purchase/PurchaseCreateModal';
import { PurchasePayModal } from './purchase/PurchasePayModal';
import { PurchaseEditModal } from './purchase/PurchaseEditModal';
import { PurchaseDetailModal } from './purchase/PurchaseDetailModal';

export const PurchaseManager: React.FC = () => {
  const [pos, setPos] = useState<PurchaseOrder[]>(() => DBService.getPurchaseOrders());
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [payPo, setPayPo] = useState<PurchaseOrder | null>(null);
  const [editPo, setEditPo] = useState<PurchaseOrder | null>(null);
  const [detailPo, setDetailPo] = useState<PurchaseOrder | null>(null);

  const refresh = () => setPos(DBService.getPurchaseOrders());

  // 状态推进：待采购 →(付款) 已付款 →(确认到厂) 待收货 →(入库计划收货) 已收货
  const advance = (po: PurchaseOrder, next: PurchaseStatus) => {
    if (next === '待收货' && po.status !== '已付款') {
      toast('请先登记付款（待采购 → 已付款），再确认到厂。', 'warn');
      return;
    }
    DBService.updatePurchaseOrder(po.poNo, { status: next });
    refresh();
    setNotice(`采购单 ${po.poNo} 状态已更新为「${next}」`);
  };

  const active = pos.filter(p => p.status !== '已收货').length;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-slate-50 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200"><ShoppingCart size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">采购管理</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              采购单生命周期：待采购 →<b>已付款</b>→ 待收货 → 已收货。创建后先「付款」（预付/月结登记，付款后明细锁定）→ 货到厂点「确认到厂」→ 确认收货与拆卡板在「入库计划」完成。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active > 0 && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold">{active} 张进行中</span>}
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 cursor-pointer"><Plus size={14} />新建采购单</button>
        </div>
      </div>

      <PurchaseOrdersTable
        pos={pos}
        onDetail={setDetailPo}
        onPay={setPayPo}
        onEdit={setEditPo}
        onAdvance={advance}
      />

      {notice && (
        <div className="fixed bottom-6 right-6 z-50 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-lg">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-900 text-xs ml-1">✕</button>
        </div>
      )}

      {/* 新建采购单弹窗 */}
      {showCreate && (
        <PurchaseCreateModal
          onCreated={(poNo, newCnt) => {
            refresh();
            setNotice(`采购单 ${poNo} 已创建${newCnt ? `（含 ${newCnt} 个新 SKU，已写入商品主数据）` : ''}`);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* 付款弹窗：待采购 → 已付款 */}
      {payPo && (
        <PurchasePayModal
          po={payPo}
          onPaid={(msg) => { refresh(); setNotice(msg); }}
          onClose={() => setPayPo(null)}
        />
      )}

      {/* 编辑弹窗 */}
      {editPo && (
        <PurchaseEditModal
          po={editPo}
          onSaved={(msg) => { refresh(); setNotice(msg); }}
          onClose={() => setEditPo(null)}
        />
      )}

      {/* 详情弹窗 */}
      {detailPo && (
        <PurchaseDetailModal
          po={detailPo}
          onClose={() => setDetailPo(null)}
        />
      )}
    </div>
  );
};
