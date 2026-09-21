/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { LucideIcon } from 'lucide-react';

export interface ModuleTab {
  key: string;
  label: string;
  icon: LucideIcon;
  content: React.ReactNode;
}

interface ModuleShellProps {
  title: string;
  subtitle?: string;
  tabs: ModuleTab[];
  activeKey?: string;
}

/**
 * 业务模块外壳：顶部标题 + 子页签切换，内部承载多个功能界面。
 */
export const ModuleShell: React.FC<ModuleShellProps> = ({ title, subtitle, tabs, activeKey }) => {
  const [active, setActive] = useState<string>(activeKey || tabs[0].key);

  useEffect(() => {
    if (activeKey) setActive(activeKey);
  }, [activeKey]);

  const current = tabs.find(t => t.key === active) || tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="module-title" className="text-lg font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl self-start">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                id={`module-tab-${t.key}`}
                onClick={() => setActive(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>{current.content}</div>
    </div>
  );
};
