/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileSpreadsheet, PackagePlus } from 'lucide-react';
import { ModuleShell, ModuleTab } from './ModuleShell';
import { OrderManager } from './OrderManager';
import { InboundManager } from './InboundManager';

interface InboundModuleProps {
  activeKey?: string;
}

export const InboundModule: React.FC<InboundModuleProps> = ({ activeKey }) => {
  const tabs: ModuleTab[] = [
    { key: 'plan', label: '入库计划', icon: FileSpreadsheet, content: <OrderManager /> },
    { key: 'execute', label: '入库作业', icon: PackagePlus, content: <InboundManager /> },
  ];

  return (
    <ModuleShell
      title="入库管理"
      subtitle="入库计划 → 收货 / 质检 / 上架 / 处置"
      activeKey={activeKey}
      tabs={tabs}
    />
  );
};
