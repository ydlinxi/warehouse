/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 回退入库记录确认弹窗（P2-4b 区块拆分自 InboundManager）：纯展示 + 回调。
import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Inbound } from '../../types';

interface Props {
  target: Inbound;
  onConfirm: () => void;
  onClose: () => void;
}

export const RollbackInboundModal: React.FC<Props> = ({ target, onConfirm, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5">
          <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
            <RotateCcw className="text-amber-500" size={20} />
            确认回退入库记录？
          </h3>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            确定要回退订单 <strong className="text-slate-700">{target.order_no}</strong> 托盘 <strong className="text-slate-700">#{target.seq}</strong> 的入库记录及相关数据吗？
          </p>
          <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs mb-6">
            回退后，该入库记录及相关数据将彻底清除：卡位 <strong className="font-mono">{target.position_code}</strong> 将自动解锁释放，托盘将<strong>重新返回待分配列表</strong>。
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition-colors"
            >
              确认回退
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
