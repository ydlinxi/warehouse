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
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MobileRecordForm } from './components/MobileRecordForm';
import { SystemManual } from './components/SystemManual';

import { useInventoryStore } from './store/useInventoryStore';
import { Shield, AlertTriangle, Clock, Search, Menu } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('map');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const {
    init,
    stats,
    refreshData,
    setSearchModalOpen
  } = useInventoryStore();

  // Initialize Zustand store on mount
  useEffect(() => {
    init();
  }, []);

  // Sync stats when tab changes
  useEffect(() => {
    refreshData();
  }, [currentTab]);

  // Global navigation listener
  useEffect(() => {
    const handleNavigation = (e: CustomEvent) => {
      if (e.detail && typeof e.detail === 'string') {
        setCurrentTab(e.detail);
      }
    };
    window.addEventListener('navigate-tab' as any, handleNavigation);
    return () => window.removeEventListener('navigate-tab' as any, handleNavigation);
  }, []);

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
      case 'mobileForm':
        return <MobileRecordForm />;
      case 'manual':
        return <SystemManual />;
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
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Workspace Frame */}
      <div id="main-workspace-frame" className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Global Application Top Header */}
        <header id="app-top-header" className="h-14 bg-white border-b border-slate-100 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-2xs z-30">
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
              title="展开导航菜单"
            >
              <Menu size={18} />
            </button>

            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hidden sm:block">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-none">成品进销存协同管理系统</p>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-1 hidden lg:block">
                支持业务流自动核查、爆仓安全防护、一托一档全流程溯源
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-3 text-xs font-medium">
            {/* Quick Action 1: Global Search Button */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-700 py-1 px-2.5 rounded-xl font-bold transition-colors cursor-pointer"
              title="全局快捷万能检索 (Ctrl+K)"
            >
              <Search size={14} className="text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">检索</span>
              <kbd className="hidden lg:inline-block bg-white border border-slate-300 text-[9px] px-1 rounded font-mono text-slate-500">
                Ctrl+K
              </kbd>
            </button>

            {/* Warning indicator bell */}
            {stats.isWarning && (
              <div 
                onClick={() => setCurrentTab('dashboard')}
                className="flex items-center space-x-1 text-rose-600 bg-rose-50 border border-rose-100 py-1 px-2 rounded-lg font-bold animate-pulse cursor-pointer hover:bg-rose-100/50"
                title="警告：仓位极度紧张，请立即增加出货频率！"
              >
                <AlertTriangle size={13} />
                <span className="hidden sm:inline">爆仓预警</span>
              </div>
            )}

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* Account Info */}
            <div className="flex items-center space-x-2">
              <div className="text-right hidden md:block">
                <span className="block text-[11px] font-bold text-slate-700">ydlinxi@gmail.com</span>
                <span className="block text-[9px] text-slate-400 font-medium">超级授权操作员</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                Y
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Workspace Section */}
        <main id="app-workspace-body" className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50 z-20">
          {renderContent()}
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal onNavigateTab={setCurrentTab} />
    </div>
  );
}
