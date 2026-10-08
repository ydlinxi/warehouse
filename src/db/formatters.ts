// src/db/formatters.ts — 通用格式化与数值/ID 工具（从 db.ts 抽离，P2-4）
// 说明：这些符号原本在 db.ts 顶层导出，被 13+ 个组件直接 import。
//       现抽到独立模块，db.ts 仅做 facade 再导出，引用方零改动。

/** 安全转数字：非数返回 0 */
export const safeNum = (v: unknown): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/** 生成内部 ID（seed/demo 数据与 DBService 内部复用） */
export function generateUUID(): string {
  return 'idx_' + Math.random().toString(36).substring(2, 15);
}

/** 展示层格式化工具 */
export const formatters = {
  // Rmb currency format
  currency: (amount: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(amount);
  },
  // Number with thousands separators
  number: (num: number, fractionDigits = 0) => {
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(num);
  },
  // Date format yyyy/mm/dd
  date: (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  },
  // DB date format yyyy-mm-dd
  dbDate: (date: Date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};
