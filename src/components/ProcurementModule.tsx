/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bell, ShoppingCart } from 'lucide-react';
import { ModuleShell, ModuleTab } from './ModuleShell';
import { ReplenishManager } from './ReplenishManager';
import { PurchaseManager } from './PurchaseManager';

interface ProcurementModuleProps {
  activeKey?: string;
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({ activeKey }) => {
  const tabs: ModuleTab[] = [
    { key: 'replenish', label: '补货预警', icon: Bell, content: <ReplenishManager /> },
    { key: 'purchase', label: '采购单管理', icon: ShoppingCart, content: <PurchaseManager /> },
  ];

  return (
    <ModuleShell
      title="采购管理"
      subtitle="缺货预警 → 采购建议 → 采购单 → 到货收货"
      activeKey={activeKey}
      tabs={tabs}
    />
  );
};
