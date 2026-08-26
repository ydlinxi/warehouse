/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PackagePlus,
  PackageMinus,
  Database,
  Map,
  Settings,
  Users,
  ShieldAlert
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isWarning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isWarning
}) => {
  const menuItems = [
    { id: 'map', name: '首页 / 仓位地图', icon: Map, badge: isWarning ? '爆仓预警' : undefined },
    { id: 'dashboard', name: '运营大盘看板', icon: LayoutDashboard },
    { id: 'orders', name: '订单管理', icon: FileSpreadsheet },
    { id: 'inbound', name: '入库管理', icon: PackagePlus },
    { id: 'outbound', name: '出库管理', icon: PackageMinus },
    { id: 'inventory', name: '库存报表', icon: Database },
    { id: 'system', name: '系统配置', icon: Settings },
  ];

  return (
    <div id="sidebar-container" className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div id="sidebar-header" className="p-5 border-b border-slate-800 flex items-center space-x-3 bg-slate-950">
        <div className="p-2 bg-indigo-600 rounded-lg text-white">
          <Database size={20} />
        </div>
        <div>
          <h1 className="font-bold text-sm leading-tight text-white tracking-wide">成品进销存管理系统</h1>
          <span className="text-xs text-slate-400">Web 企业级 v1.1</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav id="sidebar-nav" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <span className="px-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 block mb-2">系统模块</span>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              id={`nav-item-${item.id}`}
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 translate-x-1'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  item.id === 'map' && isWarning 
                    ? 'bg-rose-500 text-white animate-bounce' 
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div id="sidebar-footer" className="p-4 border-t border-slate-800 bg-slate-950 text-xs text-slate-500 flex flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <span>系统状态</span>
          <span className="flex items-center text-emerald-400 gap-1 font-semibold text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>运行中</span>
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          <span>日期: 2026/08/25</span>
        </div>
      </div>
    </div>
  );
};
