/**
 * 轻量页面内提示（替代原生 `alert`）
 *
 * 为什么不用 alert：
 *  1. 原生 alert 是**阻塞式**弹窗，会中断页面渲染与 RPA 自动化脚本的执行；
 *  2. 无头 / 自动化驱动场景下无法可靠捕获或关闭，容易把流程卡死；
 *  3. 阻塞式弹窗与靶场其它页面的轻提示风格也不一致。
 * 改为右下角浮层提示：自动消失、可堆叠、不阻塞。
 */

export type ToastType = 'success' | 'warn' | 'error' | 'info';

const STYLE: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: '#f6ffed', border: '#b7eb8f', color: '#389e0d', icon: '✅' },
  warn: { bg: '#fffbe6', border: '#ffe58f', color: '#d48806', icon: '⚠️' },
  error: { bg: '#fff1f0', border: '#ffa39e', color: '#cf1322', icon: '⛔' },
  info: { bg: '#e6f4ff', border: '#91caff', color: '#0958d9', icon: 'ℹ️' },
};

let host: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement {
  if (!host) {
    host = document.createElement('div');
    host.setAttribute('data-rpa-toast-host', '');
    host.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;flex-direction:column;' +
      'gap:8px;align-items:flex-end;pointer-events:none;max-width:80vw';
    document.body.appendChild(host);
  }
  return host;
}

/** 显示一条浮层提示（默认 2.6s 自动消失） */
export function toast(message: string, type: ToastType = 'success', duration = 2600): void {
  if (typeof document === 'undefined') return;
  const c = STYLE[type] || STYLE.info;
  const el = document.createElement('div');
  el.style.cssText =
    `max-width:380px;padding:9px 14px;border-radius:8px;border:1px solid ${c.border};` +
    `background:${c.bg};color:${c.color};font-size:13px;line-height:1.5;` +
    'box-shadow:0 6px 18px rgba(0,0,0,.12);opacity:0;transform:translateY(6px);' +
    'transition:opacity .18s ease,transform .18s ease;white-space:pre-wrap';
  el.textContent = `${c.icon} ${message}`;
  ensureHost().appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 240);
  }, duration);
}

export const toastSuccess = (m: string) => toast(m, 'success');
export const toastWarn = (m: string) => toast(m, 'warn');
export const toastError = (m: string) => toast(m, 'error');
