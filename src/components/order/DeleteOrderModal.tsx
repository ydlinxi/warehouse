/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 删除排单确认弹窗（P2-4b 区块拆分自 OrderManager）。
import React from 'react';
import { Trash2 } from 'lucide-react';
import { Order } from '../../types';

interface Props {
  target: Order;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteOrderModal: React.FC<Props> = ({ target, onConfirm, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5">
          <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
            <Trash2 className="text-rose-500" size={20} />
            确认删除排单？
          </h3>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            确定要删除处于排单中状态的订单 <strong className="text-slate-700">{target.order_no}</strong> 及其分割的托盘数据吗？此操作不可逆。
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition-colors"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
