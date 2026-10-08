/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { GlobalSearchModal } from './components/GlobalSearchModal';

// ===== 路由级代码分割：各业务视图按需加载（与 Module 层薄容器结构契合） =====
const ProcurementModule = lazy(() => import('./components/ProcurementModule').then(m => ({ default: m.ProcurementModule })));
const InboundModule = lazy(() => import('./components/InboundModule').then(m => ({ default: m.InboundModule })));
const OutboundManager = lazy(() => import('./components/OutboundManager').then(m => ({ default: m.OutboundManager })));
const WarehouseModule = lazy(() => import('./components/WarehouseModule').then(m => ({ default: m.WarehouseModule })));
const PositionMap = lazy(() => import('./components/PositionMap').then(m => ({ default: m.PositionMap })));
const SystemConfig = lazy(() => import('./components/SystemConfig').then(m => ({ default: m.SystemConfig })));
const MobileRecordForm = lazy(() => import('./components/MobileRecordForm').then(m => ({ default: m.MobileRecordForm })));
const SystemManual = lazy(() => import('./components/SystemManual').then(m => ({ default: m.SystemManual })));

/**
 * 旧 tab 标识 → 新四大业务模块 + 子页签 的兼容映射。
 * 全局搜索、Dashboard、仓位台账等处的历史跳转仍然可用。
 */
const TAB_MAP: Record<string, { tab: string; sub: string }> = {
  replenish: { tab: 'm-procurement', sub: 'replenish' },
  purchase: { tab: 'm-procurement', sub: 'purchase' },
  orders: { tab: 'm-inbound', sub: 'plan' },
  inbound: { tab: 'm-inbound', sub: 'execute' },
  outbound: { tab: 'm-outbound', sub: '' },
  inventory: { tab: 'm-warehouse', sub: 'inventory' },
  recon: { tab: 'm-warehouse', sub: 'recon' },
  dashboard: { tab: 'm-warehouse', sub: 'dashboard' },
  map: { tab: 'map', sub: '' },
  system: { tab: 'system', sub: '' },
  mobileForm: { tab: 'mobileForm', sub: '' },
  manual: { tab: 'manual', sub: '' },
};

import { useInventoryStore } from './store/useInventoryStore';
import { DBService } from './db';
import { Shield, AlertTriangle, Search, Menu } from 'lucide-react';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get('embed') === '1';
  const [currentTab, setCurrentTabState] = useState<string>(() => {
    const t = params.get('tab');
    if (t && TAB_MAP[t]) return TAB_MAP[t].tab;
    return t || 'map';
  });
  const [subTab, setSubTab] = useState<string>(() => {
    const t = params.get('tab');
    return t && TAB_MAP[t] ? TAB_MAP[t].sub : '';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // 统一导航：兼容旧 tab 标识，自动定位到对应模块与子页签
  const goTab = useCallback((raw: string) => {
    const m = TAB_MAP[raw];
    if (m) {
      setCurrentTabState(m.tab);
      setSubTab(m.sub);
    } else {
      setCurrentTabState(raw);
      setSubTab('');
    }
  }, []);

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
        goTab(e.detail);
      }
    };
    window.addEventListener('navigate-tab', handleNavigation as EventListener);
    return () => window.removeEventListener('navigate-tab', handleNavigation as EventListener);
  }, []);

  // 各模块待办角标（切 tab 时刷新）
  const badges = useMemo(() => ({
    'm-procurement': DBService.getPurchaseOrders().filter(p => ['待采购', '已付款'].includes(p.status)).length
      + DBService.getProductSkus().filter(s => s.stock <= s.replenishPoint).length,
    'm-inbound': DBService.getOrders().filter(o => o.status === 'pending').length + DBService.getPurchasePlanRows().length,
    'm-outbound': DBService.getPendingOutbounds().filter(p => p.status === '待出库').length,
    'm-warehouse': 0,
  }), [currentTab]);

  const renderContent = () => {
    switch (currentTab) {
      case 'm-procurement':
        return <ProcurementModule activeKey={subTab} />;
      case 'm-inbound':
        return <InboundModule activeKey={subTab} />;
      case 'm-outbound':
        return <OutboundManager />;
      case 'm-warehouse':
        return <WarehouseModule activeKey={subTab} onNavigate={goTab} />;
      case 'map':
        return <PositionMap />;
      case 'system':
        return <SystemConfig />;
      case 'mobileForm':
        return <MobileRecordForm />;
      case 'manual':
        return <SystemManual />;
      default:
        return <PositionMap />;
    }
  };

  return (
    <div
      id="app-wrapper"
      className={`${isEmbed ? 'h-screen w-full overflow-hidden' : 'flex'} bg-slate-50 text-slate-800 min-h-screen font-sans antialiased overflow-hidden select-none`}
    >
      {!isEmbed && (
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={goTab}
          isWarning={stats.isWarning}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          badges={badges}
        />
      )}

      {/* Main Content Workspace Frame */}
      <div id="main-workspace-frame" className="flex-1 flex flex-col h-screen overflow-hidden">
        {!isEmbed && (
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
                  onClick={() => goTab('map')}
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
        )}

        {/* Dynamic Inner Workspace Section */}
        <main id="app-workspace-body" className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50 z-20">
          <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">加载中…</div>}>
            {renderContent()}
          </Suspense>
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal onNavigateTab={goTab} />
    </div>
  );
}
