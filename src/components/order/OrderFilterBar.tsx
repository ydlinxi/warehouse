/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 入库计划筛选栏（P2-4b 区块拆分自 OrderManager）：搜索 + 型号/状态过滤。
import React from 'react';
import { Search } from 'lucide-react';
import { ProductModel } from '../../types';

interface Props {
  searchQuery: string;
  modelFilter: string;
  statusFilter: string;
  models: ProductModel[];
  onSearchChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onStatusChange: (v: string) => void;
}

export const OrderFilterBar: React.FC<Props> = ({
  searchQuery, modelFilter, statusFilter, models, onSearchChange, onModelChange, onStatusChange
}) => {
  return (
    <div id="orders-filters" className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[200px] relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="search-orders"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索计划号 / 客户编码..."
          className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="w-40">
        <select
          id="filter-model"
          value={modelFilter}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
        >
          <option value="">全部型号</option>
          {models.map(m => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="w-40">
        <select
          id="filter-status"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="pending">排单中 (Pending)</option>
          <option value="pending_receipt">待收货建卡板</option>
          <option value="shortage">欠库不足 (Shortage)</option>
          <option value="in_progress">出入库中 (In Progress)</option>
          <option value="completed">已完结 (Completed)</option>
        </select>
      </div>
    </div>
  );
};
