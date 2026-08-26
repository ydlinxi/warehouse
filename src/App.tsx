/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { OrderManager } from './components/OrderManager';
import { InboundManager } from './components/InboundManager';
import { OutboundManager } from './components/OutboundManager';
import { InventorySummary } from './components/InventorySummary';
import { PositionMap } from './components/PositionMap';
import { SystemConfig } from './components/SystemConfig';

import { DBService } from './db';
import { UserRole } from './types';
import { Shield, AlertTriangle, Clock, HelpCircle, Bell } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('map');
  const [stats, setStats] = useState(() => DBService.getOverallStats());

  // Automatically initialize database if empty on load
  useEffect(() => {
    DBService.initDatabaseIfEmpty();
    setStats(DBService.getOverallStats());
  }, []);

  // Update stats globally whenever tabs change (which implies action might have happened)
  useEffect(() => {
    setStats(DBService.getOverallStats());
  }, [currentTab]);

  const handleNavigate = (tab: string) => {
    setCurrentTab(tab);
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'orders':
        return <OrderManager />;
      case 'inbound':
        return <InboundManager />;
      case 'outbound':
        return <OutboundManager />;
      case 'inventory':
        return <InventorySummary />;
      case 'map':
        return <PositionMap />;
      case 'system':
        return <SystemConfig />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div id="app-wrapper" className="flex bg-slate-50 text-slate-800 min-h-screen font-sans antialiased overflow-hidden select-none">
      {/* Sidebar Navigation Left Panel */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isWarning={stats.isWarning}
      />

      {/* Main Content Workspace Frame */}
      <div id="main-workspace-frame" className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Global Application Top Header */}
        <header id="app-top-header" className="h-14 bg-white border-b border-slate-100 px-6 flex items-center justify-between shrink-0 shadow-sm z-30">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-none">成品进销存协同管理台</p>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-1 block">
                支持业务流自动核查、爆仓安全防护、一托一档溯源管理
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-medium">
            {/* Simulation Date Badge */}
            <div className="flex items-center space-x-1.5 text-slate-500 bg-slate-50 border border-slate-100 py-1 px-2.5 rounded-lg font-semibold font-mono">
              <Clock size={12} className="text-slate-400" />
              <span>当前系统日期：2026/08/25</span>
            </div>

            {/* Warning indicator bell */}
            {stats.isWarning && (
              <div 
                onClick={() => setCurrentTab('dashboard')}
                className="flex items-center space-x-1 text-rose-600 bg-rose-50 border border-rose-100 py-1 px-2.5 rounded-lg font-bold animate-pulse cursor-pointer hover:bg-rose-100/50"
                title="警告：仓位极度紧张，请立即增加出货频率！"
              >
                <AlertTriangle size={13} />
                <span>爆仓超限预警</span>
              </div>
            )}

            <div className="h-4 w-px bg-slate-200" />

            {/* Account Info */}
            <div className="flex items-center space-x-2.5">
              <div className="text-right">
                <span className="block text-[11px] font-bold text-slate-700">ydlinxi@gmail.com</span>
                <span className="block text-[9px] text-slate-400 font-medium">超级授权操作员</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow">
                Y
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Workspace Section */}
        <main id="app-workspace-body" className="flex-1 overflow-y-auto p-6 bg-slate-50/50 z-20">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
