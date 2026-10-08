/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 入库批量设置行（P2-4b 区块拆分自 InboundManager）：表格 thead 内的批量设置 <tr>。
import React from 'react';
import { CheckSquare } from 'lucide-react';
import { QUALITY_OPTIONS } from '../../db';
import { Inbound } from '../../types';

export interface BatchFields {
  actualQty: string;
  inboundDate: string;
  selectedLine: string;
  selectedHandler: string;
  qualityResult: Inbound['quality'] | '';
  note: string;
}

interface Props {
  batchFields: BatchFields;
  onChange: (patch: Partial<BatchFields>) => void;
  lines: string[];
  handlers: string[];
  onApply: () => void;
  onReset: () => void;
}

export const BatchSettingsRow: React.FC<Props> = ({ batchFields, onChange, lines, handlers, onApply, onReset }) => {
  return (
    <tr className="bg-indigo-50/60 border-b border-indigo-100">
      <th className="py-1.5 px-3"></th>
      <th colSpan={4} className="py-1.5 px-3 text-right text-indigo-700 font-bold text-[11px]">
        批量设置选中项 👉
      </th>
      <th className="py-1.5 px-3 text-[10px] text-slate-400 font-medium">
        (仓位需独立分配)
      </th>
      <th className="py-1.5 px-1 text-center">
        <input type="number" placeholder="数量" value={batchFields.actualQty} onChange={(e) => onChange({ actualQty: e.target.value })} className="w-20 border border-indigo-200 rounded px-1.5 py-1 text-[10px] font-normal focus:outline-none focus:border-indigo-400" />
      </th>
      <th className="py-1.5 px-1 text-center">
        <input type="date" value={batchFields.inboundDate} onChange={(e) => onChange({ inboundDate: e.target.value })} className="w-24 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal focus:outline-none focus:border-indigo-400" />
      </th>
      <th className="py-1.5 px-1 text-center">
        <select value={batchFields.selectedLine} onChange={(e) => onChange({ selectedLine: e.target.value })} className="w-24 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal bg-white focus:outline-none focus:border-indigo-400">
          <option value="">不更改</option>
          {lines.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </th>
      <th className="py-1.5 px-1 text-center">
        <select value={batchFields.selectedHandler} onChange={(e) => onChange({ selectedHandler: e.target.value })} className="w-20 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal bg-white focus:outline-none focus:border-indigo-400">
          <option value="">不更改</option>
          {handlers.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </th>
      <th className="py-1.5 px-1 text-center">
        <select value={batchFields.qualityResult} onChange={(e) => onChange({ qualityResult: e.target.value as Inbound['quality'] | '' })} className="w-24 border border-indigo-200 rounded px-1 py-1 text-[10px] font-normal bg-white focus:outline-none focus:border-indigo-400">
          <option value="">不更改</option>
          {QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </th>
      <th className="py-1.5 px-1">
        <input type="text" placeholder="批量备注..." value={batchFields.note} onChange={(e) => onChange({ note: e.target.value })} className="w-full border border-indigo-200 rounded px-2 py-1 text-[10px] font-normal focus:outline-none focus:border-indigo-400" />
      </th>
      <th className="py-1.5 px-2 text-center">
        <div className="flex flex-col gap-1">
          <button onClick={onApply} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 rounded text-[11px] font-bold shadow-sm transition-colors cursor-pointer w-full flex items-center justify-center gap-1">
            <CheckSquare size={12} />
            应用
          </button>
          <button onClick={onReset} className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded text-[10px] font-bold shadow-sm transition-colors cursor-pointer w-full flex items-center justify-center">
            清空
          </button>
        </div>
      </th>
    </tr>
  );
};
