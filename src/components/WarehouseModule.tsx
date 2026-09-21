/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LayoutDashboard, Database, FileCheck } from 'lucide-react';
import { ModuleShell, ModuleTab } from './ModuleShell';
import { Dashboard } from './Dashboard';
import { InventorySummary } from './InventorySummary';
import { ReconCenter } from './ReconCenter';

interface WarehouseModuleProps {
  activeKey?: string;
  onNavigate?: (tab: string) => void;
}

export const WarehouseModule: React.FC<WarehouseModuleProps> = ({ activeKey, onNavigate }) => {
  const tabs: ModuleTab[] = [
    {
      key: 'dashboard',
      label: '运营大盘',
      icon: LayoutDashboard,
      content: <Dashboard onNavigate={(t: string) => (onNavigate ? onNavigate(t) : undefined)} />,
    },
    { key: 'inventory', label: '库存报表', icon: Database, content: <InventorySummary /> },
    { key: 'recon', label: 'ERP 对账', icon: FileCheck, content: <ReconCenter /> },
  ];

  return (
    <ModuleShell
      title="仓库管理"
      subtitle="运营大盘 · 库存报表 · ERP 对账"
      activeKey={activeKey}
      tabs={tabs}
    />
  );
};
