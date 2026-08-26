/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  PackageCheck,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ArrowRight
} from 'lucide-react';
import { DBService, formatters } from '../db';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const stats = DBService.getOverallStats();
  const orders = DBService.getOrdersWithMetrics();
  const inbounds = DBService.getInbounds();
  const outbounds = DBService.getOutbounds();

  // Shortage items / pending alerts
  const shortageOrders = orders.filter(o => o.status === 'shortage' || o.status === 'pending');
  const qualityPendingCount = inbounds.filter(i => i.quality === '待复检' && DBService.getPositionStock(i.id) > 0).length;

  // Let's build trend data for the last 7 days (or simulated 10 days for August 2026)
  const days = ['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25'];
  
  const chartData = days.map(d => {
    const inQty = inbounds
      .filter(i => i.inbound_date === d)
      .reduce((sum, i) => sum + i.actual_qty, 0);
    const outQty = outbounds
      .filter(o => o.outbound_date === d)
      .reduce((sum, o) => sum + o.outbound_qty, 0);
    return { date: d.slice(5).replace('-', '/'), inQty, outQty };
  });

  // Calculate coordinates for SVG line/bar chart
  const maxVal = Math.max(...chartData.flatMap(d => [d.inQty, d.outQty]), 100) * 1.15;
  const chartHeight = 160;
  const chartWidth = 500;
  const colWidth = chartWidth / chartData.length;

  const pointsIn = chartData.map((d, idx) => {
    const x = idx * colWidth + colWidth / 2;
    const y = chartHeight - (d.inQty / maxVal) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const pointsOut = chartData.map((d, idx) => {
    const x = idx * colWidth + colWidth / 2;
    const y = chartHeight - (d.outQty / maxVal) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  // Circular ring details
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const occupancyPercent = Math.min(100, stats.occupancyRate);
  const strokeDashoffset = circumference - (occupancyPercent / 100) * circumference;

  // Combine live activity stream dynamically
  const activities = [
    ...inbounds.map(i => ({
      id: `in-${i.id}`,
      type: 'inbound',
      title: `入库 | ${i.order_no}`,
      sub: `${i.position_code} | ${i.line}`,
      qty: `+${formatters.number(i.actual_qty)} Pcs`,
      qtyColor: 'text-blue-600 font-bold',
      dateStr: i.inbound_date,
      timestamp: new Date(i.inbound_date).getTime() + (i.id.charCodeAt(5) || 0) * 1000, // micro adjustment for ordering
      borderColor: 'border-l-4 border-blue-500'
    })),
    ...outbounds.map(o => ({
      id: `out-${o.id}`,
      type: 'outbound',
      title: `出库 | ${o.order_no}`,
      sub: `${o.position_code} | ${o.handler}`,
      qty: `-${formatters.number(o.outbound_qty)} Pcs`,
      qtyColor: 'text-amber-600 font-bold',
      dateStr: o.outbound_date,
      timestamp: new Date(o.outbound_date).getTime() + (o.id.charCodeAt(5) || 0) * 1000,
      borderColor: 'border-l-4 border-amber-500'
    }))
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);

  return (
    <div id="dashboard-root" className="space-y-5 animate-fade-in">
      {/* Top Banner and Greeting */}
      <div id="dashboard-header-bar" className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">仓库运营中心看板</h2>
          <p className="text-xs text-slate-500 mt-0.5">多维卡片架构实时监控成品订单进度、物理货架储量占用及产销平衡指数。</p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl py-1.5 px-3 shadow-sm">
          <Calendar size={14} className="text-slate-400" />
          <span className="font-semibold">快照日期：2026/08/25</span>
        </div>
      </div>

      {/* Bento Metric Cards Grid */}
      <div id="kpi-grid" className="grid grid-cols-5 gap-4">
        {/* 1. 在库结存 */}
        <div id="kpi-stock" className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-[110px]">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">在库结存</span>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {formatters.number(stats.stockBalance)}
            </span>
            <span className="text-xs text-slate-400 font-semibold mb-1">Pcs</span>
          </div>
        </div>

        {/* 2. 欠库订单数 */}
        <div id="kpi-shortage" className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-[110px]">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">欠库订单数</span>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-amber-600 font-mono">
              {String(stats.shortageOrdersCount).padStart(2, '0')}
            </span>
            <span className="text-xs text-slate-400 font-semibold mb-1">待入库</span>
          </div>
        </div>

        {/* 3. 平均周转天数 */}
        <div id="kpi-turnover" className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-[110px]">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">平均周转天数</span>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {stats.avgTurnoverDays}
            </span>
            <span className="text-xs text-slate-400 font-semibold mb-1">Days</span>
          </div>
        </div>

        {/* 4. 爆仓预警 (Custom styled with huge overlay watermark) */}
        <div 
          id="kpi-warning" 
          onClick={() => onNavigate('map')}
          className={`rounded-2xl border p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-[110px] relative overflow-hidden cursor-pointer ${
            stats.isWarning 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {/* Watermark character */}
          <div className={`absolute -right-2 -top-5 text-7xl font-extrabold select-none opacity-10 pointer-events-none ${
            stats.isWarning ? 'text-rose-600' : 'text-emerald-600'
          }`}>
            {stats.isWarning ? '!' : '✔'}
          </div>

          <span className={`text-[11px] font-bold uppercase tracking-wider z-10 ${
            stats.isWarning ? 'text-rose-700' : 'text-emerald-700'
          }`}>
            爆仓预警
          </span>
          <div className="flex items-end justify-between z-10">
            <span className={`text-2xl font-bold font-mono ${
              stats.isWarning ? 'text-rose-600' : 'text-emerald-600'
            }`}>
              {stats.isWarning ? '临界区' : '安全区'}
            </span>
            <span className={`text-xs font-semibold mb-1 ${
              stats.isWarning ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              剩余 {stats.availableCount} 位
            </span>
          </div>
        </div>

        {/* 5. 产销平衡率 */}
        <div id="kpi-balance" className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-[110px]">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">产销平衡率</span>
          <div className="flex flex-col space-y-1.5">
            <span className="text-2xl font-bold text-slate-950 font-mono leading-none">
              {Math.round(stats.balanceRate * 100)}%
            </span>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.round(stats.balanceRate * 100))}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Bento Grid - charts and flows */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Bento: Trend Chart (8 columns) */}
        <div id="trend-card" className="col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                <span className="text-indigo-600">●</span> 每日出入库流水趋势
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">最近 10 日各生产线完成的入库数量与出仓发货对比趋势</p>
            </div>
            <div className="flex items-center space-x-3 text-[10px] font-bold">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded bg-indigo-500" />
                <span className="text-slate-500">实际上架</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded bg-amber-500" />
                <span className="text-slate-500">发货出库</span>
              </div>
            </div>
          </div>

          <div className="relative w-full overflow-hidden" style={{ height: '170px' }}>
            <svg viewBox={`0 0 ${chartWidth} 190`} className="w-full h-full">
              {/* Background horizontal gridlines */}
              <line x1="0" y1="0" x2={chartWidth} y2="0" stroke="#f8fafc" strokeWidth="1" />
              <line x1="0" y1="40" x2={chartWidth} y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2={chartWidth} y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2={chartWidth} y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="160" x2={chartWidth} y2="160" stroke="#e2e8f0" strokeWidth="1" />

              {/* Inbound Line */}
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsIn}
              />

              {/* Outbound Line */}
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsOut}
              />

              {/* Grid dots */}
              {chartData.map((d, idx) => {
                const x = idx * colWidth + colWidth / 2;
                const yIn = chartHeight - (d.inQty / maxVal) * chartHeight;
                const yOut = chartHeight - (d.outQty / maxVal) * chartHeight;

                return (
                  <g key={idx}>
                    {d.inQty > 0 && <circle cx={x} cy={yIn} r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="1" />}
                    {d.outQty > 0 && <circle cx={x} cy={yOut} r="3.5" fill="#f59e0b" stroke="#fff" strokeWidth="1" />}
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {chartData.map((d, idx) => {
                const x = idx * colWidth + colWidth / 2;
                return (
                  <text
                    key={idx}
                    x={x}
                    y="180"
                    textAnchor="middle"
                    className="fill-slate-400 font-bold font-sans text-[10px]"
                  >
                    {d.date}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Bento: Donut Chart Occupancy (4 columns) */}
        <div id="occupancy-card" className="col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1">
              <span className="text-blue-500">●</span> 库容占用分布
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">可用空置货位与满载货位的占用比例</p>
          </div>

          <div className="flex items-center justify-center py-2.5 relative">
            <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="9"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke={stats.occupancyRate > 85 ? '#f43f5e' : '#3b82f6'}
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute text-center flex flex-col items-center">
              <span className="text-xl font-extrabold text-slate-800 tracking-tight font-mono">
                {Math.round(stats.occupancyRate)}%
              </span>
              <span className="text-[9px] text-slate-400 font-bold">已用货架</span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-semibold">
            <div className="flex items-center justify-between border-b border-slate-50 pb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-blue-500" />
                已占用托架卡位
              </span>
              <span className="font-bold text-slate-800 font-mono">{formatters.number(stats.occupiedCount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-slate-200" />
                空闲安全货位
              </span>
              <span className="font-bold text-slate-800 font-mono">{formatters.number(stats.availableCount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Third Bento Grid: Activities and alert feeds */}
      <div className="grid grid-cols-12 gap-4">
        {/* Real-time Activities stream (Bento style, 6 columns) */}
        <div className="col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-[300px]">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
              <span>实时出入流水</span>
              <button 
                onClick={() => onNavigate('inventory')}
                className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5"
              >
                <span>对账明细</span>
                <ArrowRight size={10} />
              </button>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">当前系统各班组最新提交的入库/出货物理痕迹</p>
          </div>

          <div className="flex-1 mt-3 space-y-3 overflow-y-auto pr-0.5">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10">暂无出入库流动历史。</p>
            ) : (
              activities.map(act => (
                <div 
                  key={act.id} 
                  className={`flex items-center justify-between p-3 bg-slate-50/60 rounded-xl border-l-4 border hover:bg-slate-50 hover:border-slate-300 transition-all ${act.borderColor}`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">{act.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase font-bold mt-0.5">{act.sub}</span>
                  </div>
                  <div className="text-right">
                    <span className={`block text-xs font-bold ${act.qtyColor}`}>{act.qty}</span>
                    <span className="text-[9px] text-slate-400 font-medium font-mono block mt-0.5">{act.dateStr}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Shortage & Quality warnings block (Bento style, 6 columns) */}
        <div className="col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-[300px]">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1">
              <span>系统预警与异常拦截</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">自动探测在库欠料排产订单与OQC品质检验拦截货板</p>
          </div>

          <div className="flex-1 mt-3 grid grid-cols-2 gap-3 overflow-hidden">
            {/* Shortage orders nested box */}
            <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl flex flex-col overflow-hidden">
              <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1 border-b border-slate-200 pb-1.5 mb-2 shrink-0">
                <AlertTriangle size={11} className="text-amber-500" />
                <span>欠库订单 ({shortageOrders.length})</span>
              </h4>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 text-[11px]">
                {shortageOrders.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-10">无欠库订单</p>
                ) : (
                  shortageOrders.map(o => (
                    <div key={o.id} className="flex justify-between items-center p-1 bg-white/70 border border-slate-100 rounded">
                      <span className="font-bold font-mono">{o.order_no}</span>
                      <span className="text-amber-600 font-bold font-mono">缺 {o.shortage_qty}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quality holding nested box */}
            <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl flex flex-col overflow-hidden">
              <h4 className="text-[11px] font-bold text-slate-700 flex items-center gap-1 border-b border-slate-200 pb-1.5 mb-2 shrink-0">
                <CheckCircle size={11} className="text-indigo-500" />
                <span>待复检拦截 ({qualityPendingCount})</span>
              </h4>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 text-[11px]">
                {qualityPendingCount === 0 ? (
                  <p className="text-slate-400 italic text-center py-10">无放行阻隔</p>
                ) : (
                  inbounds.filter(i => i.quality === '待复检' && DBService.getPositionStock(i.id) > 0).map(i => (
                    <div key={i.id} className="flex justify-between items-center p-1 bg-white/70 border border-slate-100 rounded">
                      <span className="font-bold font-mono text-slate-700">{i.position_code}</span>
                      <span className="text-indigo-600 font-bold">待检验</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Widescreen bottom Bento Panel: Key orders progress monitoring */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <span className="text-blue-500">●</span> 重点监控订单进度
          </h3>
          <div className="text-xs text-slate-400 font-semibold">当前在产及履约中订单共 {orders.length} 笔</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="pb-2">订单号</th>
                <th className="pb-2">产品型号</th>
                <th className="pb-2 text-center">卡架配置需求</th>
                <th className="pb-2 text-center">实收/计划指标</th>
                <th className="pb-2">履约进度条</th>
                <th className="pb-2 text-right">剩余缺库缺件 (Pcs)</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {orders.slice(0, 3).map(o => {
                const ratio = o.order_qty > 0 ? o.inbound_qty / o.order_qty : 0;
                const isComplete = ratio >= 1;

                return (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                    <td className="py-2.5 font-mono font-bold text-slate-800">{o.order_no}</td>
                    <td className="py-2.5 text-slate-600 font-semibold">{o.model}</td>
                    <td className="py-2.5 text-center font-mono font-medium text-slate-500">{o.pallet_count} 卡板</td>
                    <td className="py-2.5 text-center font-mono font-bold text-slate-700">
                      {formatters.number(o.inbound_qty)} / {formatters.number(o.order_qty)}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">{Math.round(ratio * 100)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      {o.shortage_qty === 0 ? (
                        <span className="text-emerald-600">0</span>
                      ) : (
                        <span className="text-rose-600">{formatters.number(o.shortage_qty)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

