/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Database,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { DBService } from '../db';
import { ProductModel, WarehouseConfig } from '../types';

export const SystemConfig: React.FC = () => {
  const [warehouseConfig, setWarehouseConfig] = useState<WarehouseConfig>(() => DBService.getWarehouseConfig());
  const [models, setModels] = useState<ProductModel[]>(() => DBService.getModels());
  const [lines, setLines] = useState<string[]>(() => DBService.getLines());
  const [handlers, setHandlers] = useState<string[]>(() => DBService.getHandlers());

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Model Form
  const [newModelName, setNewModelName] = useState('');
  const [newModelPerPallet, setNewModelPerPallet] = useState<number | ''>('');

  // Line & Handler inputs
  const [newLine, setNewLine] = useState('');
  const [newHandler, setNewHandler] = useState('');

  // New Zone fields
  const [newZoneCode, setNewZoneCode] = useState('');
  const [newZoneRows, setNewZoneRows] = useState<number | ''>('');
  const [newZoneCols, setNewZoneCols] = useState<number | ''>('');

  // Local state for inline row/col editing of existing zones
  const [editingRows, setEditingRows] = useState<Record<string, number>>({});
  const [editingCols, setEditingCols] = useState<Record<string, number>>({});

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const code = newZoneCode.trim().toUpperCase();
    if (!code) {
      setErrorMsg('区域编码不能为空！');
      return;
    }
    if (!/^[A-Z]$/.test(code)) {
      setErrorMsg('区域编码必须是 A-Z 之间的单个大写英文字母！');
      return;
    }
    if (!newZoneRows || newZoneRows < 1 || newZoneRows > 120) {
      setErrorMsg('排架数必须在 1 至 120 之间！');
      return;
    }
    if (!newZoneCols || newZoneCols < 1 || newZoneCols > 40) {
      setErrorMsg('每排列数必须在 1 至 40 之间！');
      return;
    }

    if (warehouseConfig.zones.some(z => z.code === code)) {
      setErrorMsg(`物理区域 [${code}区] 已经存在！`);
      return;
    }

    const updatedZones = [
      ...warehouseConfig.zones,
      { code, rows: Number(newZoneRows), cols: Number(newZoneCols) }
    ];
    const updatedConfig = { zones: updatedZones };
    setWarehouseConfig(updatedConfig);
    DBService.saveWarehouseConfig(updatedConfig);

    setNewZoneCode('');
    setNewZoneRows('');
    setNewZoneCols('');
    setSuccessMsg(`区域 [${code}区] 自定义规划成功！已完成排架数量与每排容量初始化。`);
  };

  const handleUpdateZone = (code: string) => {
    setSuccessMsg('');
    setErrorMsg('');

    const zoneObj = warehouseConfig.zones.find(z => z.code === code);
    if (!zoneObj) {
      setErrorMsg('未找到指定物理分区！');
      return;
    }

    const updatedRows = editingRows[code] !== undefined ? editingRows[code] : zoneObj.rows;
    const updatedCols = editingCols[code] !== undefined ? editingCols[code] : zoneObj.cols;

    if (updatedRows === zoneObj.rows && updatedCols === zoneObj.cols) {
      setErrorMsg('数据未发生改动！');
      return;
    }

    if (updatedRows < 1 || updatedRows > 120) {
      setErrorMsg('排架数必须在 1 至 120 之间！');
      return;
    }
    if (updatedCols < 1 || updatedCols > 40) {
      setErrorMsg('每排储位数必须在 1 至 40 之间！');
      return;
    }

    // Check inventory boundaries
    const activeInbounds = DBService.getInbounds();
    for (const inb of activeInbounds) {
      if (inb.position_code.startsWith(code)) {
        const codeMatch = inb.position_code.match(/^([A-Z])(\d{2})-(\d{2})$/);
        if (codeMatch) {
          const [_, z, rStr, cStr] = codeMatch;
          const r = parseInt(rStr, 10);
          const c = parseInt(cStr, 10);
          if (r > updatedRows || c > updatedCols) {
            setErrorMsg(`无法缩减区域，已有托盘占用超出新设定界限的物理储位 (${inb.position_code})。`);
            return;
          }
        }
      }
    }

    const updatedZones = warehouseConfig.zones.map(z => {
      if (z.code === code) {
        return { ...z, rows: updatedRows, cols: updatedCols };
      }
      return z;
    });

    const updatedConfig = { zones: updatedZones };
    setWarehouseConfig(updatedConfig);
    DBService.saveWarehouseConfig(updatedConfig);
    
    // Clear editing states
    const nextRows = { ...editingRows };
    const nextCols = { ...editingCols };
    delete nextRows[code];
    delete nextCols[code];
    setEditingRows(nextRows);
    setEditingCols(nextCols);

    setSuccessMsg(`物理区域 [${code}区] 参数更新成功！新规模已同步应用。`);
  };

  const handleDeleteZone = (code: string) => {
    setSuccessMsg('');
    setErrorMsg('');

    if (warehouseConfig.zones.length <= 1) {
      setErrorMsg('系统必须保留至少一个高架仓库物理区域！');
      return;
    }

    const activeInbounds = DBService.getInbounds();
    const hasInventory = activeInbounds.some(inb => inb.position_code.startsWith(code));
    if (hasInventory) {
      setErrorMsg(`区域 [${code}区] 仍有成品托盘占用高架储位，禁止强制剔除该物理区！`);
      return;
    }

    const updatedZones = warehouseConfig.zones.filter(z => z.code !== code);
    const updatedConfig = { zones: updatedZones };
    setWarehouseConfig(updatedConfig);
    DBService.saveWarehouseConfig(updatedConfig);
    setSuccessMsg(`物理区域 [${code}区] 已成功下线剔除。`);
  };

  // Model CRUD
  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!newModelName.trim()) {
      setErrorMsg('型号名称不能为空！');
      return;
    }
    if (!newModelPerPallet || newModelPerPallet <= 0) {
      setErrorMsg('每卡板容量必须大于 0！');
      return;
    }

    if (models.some(m => m.name.toUpperCase() === newModelName.trim().toUpperCase())) {
      setErrorMsg(`型号 ${newModelName} 已经存在！`);
      return;
    }

    const updated = [...models, { name: newModelName.trim().toUpperCase(), default_per_pallet: Number(newModelPerPallet) }];
    setModels(updated);
    DBService.saveModels(updated);
    setNewModelName('');
    setNewModelPerPallet('');
    setSuccessMsg('成品型号新增成功！');
  };

  const handleDeleteModel = (name: string) => {
    setSuccessMsg('');
    setErrorMsg('');

    // Don't allow deleting preloaded models if bound to current orders to avoid integrity crash
    const activeOrders = DBService.getOrders();
    if (activeOrders.some(o => o.model === name)) {
      setErrorMsg(`型号 [${name}] 已绑定到活动订单中，不允许强行剔除！`);
      return;
    }

    const updated = models.filter(m => m.name !== name);
    setModels(updated);
    DBService.saveModels(updated);
    setSuccessMsg('产品型号删除成功！');
  };

  // Lines CRUD
  const handleAddLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLine.trim()) return;
    if (lines.includes(newLine.trim())) return;

    const updated = [...lines, newLine.trim()];
    setLines(updated);
    DBService.saveLines(updated);
    setNewLine('');
    setSuccessMsg('生产线别新增成功！');
  };

  const handleDeleteLine = (item: string) => {
    const updated = lines.filter(l => l !== item);
    setLines(updated);
    DBService.saveLines(updated);
  };

  // Handlers CRUD
  const handleAddHandler = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHandler.trim()) return;
    if (handlers.includes(newHandler.trim())) return;

    const updated = [...handlers, newHandler.trim()];
    setHandlers(updated);
    DBService.saveHandlers(updated);
    setNewHandler('');
    setSuccessMsg('班组经办人员新增成功！');
  };

  const handleDeleteHandler = (item: string) => {
    const updated = handlers.filter(h => h !== item);
    setHandlers(updated);
    DBService.saveHandlers(updated);
  };

  // Deep Reset Database
  const handleResetDatabase = () => {
    if (window.confirm('警告：此操作将清空所有新增订单、出入库历史记录，并恢复至系统最初的出厂演示状态。是否确认？')) {
      DBService.resetToDefault();
      setWarehouseConfig(DBService.getWarehouseConfig());
      setModels(DBService.getModels());
      setLines(DBService.getLines());
      setHandlers(DBService.getHandlers());
      setSuccessMsg('系统成功一键还原！所有订单流水及排架地图已初始化。');
    }
  };

  return (
    <div id="system-config-root" className="space-y-6">
      {/* Header Banner */}
      <div id="config-header" className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统后台与基础数据配置</h2>
          <p className="text-xs text-slate-500 mt-1">系统管理员在此调整仓库储位限制（行数列数）、成品出厂型号名册及作业人员授权。</p>
        </div>

        <button
          id="btn-reset-db"
          onClick={handleResetDatabase}
          className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw size={13} className="animate-spin-slow" />
          <span>恢复默认演示数据</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs font-semibold flex items-start gap-1.5 shadow-sm">
          <CheckCircle size={14} className="shrink-0 text-emerald-500 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs font-semibold flex items-start gap-1.5 shadow-sm">
          <AlertTriangle size={14} className="shrink-0 text-rose-500 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Card 1: Warehouse grid capacities */}
        <div className="col-span-5 bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 border-b border-slate-50 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Settings size={13} className="text-indigo-600" />
                立体高架货架分区维护
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                共 {warehouseConfig.zones.length} 个物理分区
              </span>
            </h3>

            {/* Existing Zones List */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {warehouseConfig.zones.map(z => {
                const isEdited = editingRows[z.code] !== undefined || editingCols[z.code] !== undefined;
                const rVal = editingRows[z.code] !== undefined ? editingRows[z.code] : z.rows;
                const cVal = editingCols[z.code] !== undefined ? editingCols[z.code] : z.cols;

                return (
                  <div
                    key={z.code}
                    className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-lg flex flex-col space-y-2 transition-all hover:border-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded text-xs font-bold">
                          {z.code}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{z.code}物理高架区</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {isEdited && (
                          <button
                            onClick={() => handleUpdateZone(z.code)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                          >
                            保存
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteZone(z.code)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer"
                          title="删除此分区"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <label className="block text-slate-400 mb-0.5">货位层排数 (1-120)</label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={rVal}
                          onChange={(e) => setEditingRows({ ...editingRows, [z.code]: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded py-1 px-1.5 font-mono text-slate-700 text-[11px] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-0.5">每排库位列数 (1-40)</label>
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={cVal}
                          onChange={(e) => setEditingCols({ ...editingCols, [z.code]: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded py-1 px-1.5 font-mono text-slate-700 text-[11px] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-400 text-right">
                      物理容量规模: <b className="text-indigo-600 font-mono">{rVal * cVal}</b> 个高位卡板仓槽
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form to Add New Zone */}
          <form onSubmit={handleAddZone} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/40 space-y-3">
            <h4 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
              <Plus size={11} />
              规划新增高位物理分区 (Add Custom Zone)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 mb-0.5">区字码 (A-Z)</label>
                <input
                  type="text"
                  maxLength={1}
                  required
                  placeholder="如 C"
                  value={newZoneCode}
                  onChange={(e) => setNewZoneCode(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs text-center font-bold focus:outline-none uppercase bg-white"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 mb-0.5">排架数 (Rows)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  required
                  placeholder="最大120"
                  value={newZoneRows}
                  onChange={(e) => setNewZoneRows(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs focus:outline-none bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 mb-0.5">每排槽数 (Cols)</label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  required
                  placeholder="最大40"
                  value={newZoneCols}
                  onChange={(e) => setNewZoneCols(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs focus:outline-none bg-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1"
            >
              <Plus size={12} />
              <span>添加物理分区储位</span>
            </button>
          </form>
        </div>

        {/* Card 2: Product Models list */}
        <div className="col-span-7 bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-[420px]">
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 border-b border-slate-50 pb-2 flex items-center gap-1.5 shrink-0">
              <Database size={13} className="text-emerald-600" />
              型号数据库 (Model Catalogs)
            </h3>

            {/* Model form inline */}
            <form onSubmit={handleAddModel} className="grid grid-cols-12 gap-2 shrink-0">
              <div className="col-span-6">
                <input
                  id="input-model-name"
                  type="text"
                  required
                  placeholder="新产品型号, 如 PRO-Z"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg py-1 px-3 text-xs focus:outline-none uppercase"
                />
              </div>
              <div className="col-span-4">
                <input
                  id="input-model-pallet"
                  type="number"
                  min="1"
                  required
                  placeholder="默认装板量"
                  value={newModelPerPallet}
                  onChange={(e) => setNewModelPerPallet(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg py-1 px-3 text-xs focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <button
                  type="submit"
                  id="btn-add-model"
                  className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>添加</span>
                </button>
              </div>
            </form>

            {/* Models list */}
            <div className="flex-1 overflow-y-auto border border-slate-50 rounded-lg mt-2 divide-y divide-slate-50">
              {models.map(m => (
                <div key={m.name} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-800 font-mono">{m.name}</span>
                    <span className="text-slate-400 ml-2">默认装载: {m.default_per_pallet} Pcs/托</span>
                  </div>
                  <button
                    id={`btn-del-model-${m.name}`}
                    onClick={() => handleDeleteModel(m.name)}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Split Rows: Lines & Handlers */}
      <div className="grid grid-cols-2 gap-5">
        {/* Panel 1: Production Lines */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm h-[320px] flex flex-col justify-between">
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-50 pb-1.5 flex items-center justify-between shrink-0">
              <span>生产品质线别维护</span>
              <span className="text-[10px] font-normal text-slate-400">数量: {lines.length}</span>
            </h4>

            <form onSubmit={handleAddLine} className="flex gap-2 shrink-0">
              <input
                id="input-line-config"
                type="text"
                placeholder="例如: 线别A-03"
                value={newLine}
                onChange={(e) => setNewLine(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg py-1 px-3 text-xs focus:outline-none"
              />
              <button
                type="submit"
                id="btn-add-line"
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                新增
              </button>
            </form>

            <div className="flex-1 overflow-y-auto mt-2 divide-y divide-slate-50 border border-slate-50 rounded">
              {lines.map(l => (
                <div key={l} className="p-2 flex items-center justify-between text-xs hover:bg-slate-50">
                  <span>{l}</span>
                  <button
                    id={`btn-del-line-${l}`}
                    onClick={() => handleDeleteLine(l)}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Handlers */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm h-[320px] flex flex-col justify-between">
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-50 pb-1.5 flex items-center justify-between shrink-0">
              <span>班组经办作业名录</span>
              <span className="text-[10px] font-normal text-slate-400">数量: {handlers.length}</span>
            </h4>

            <form onSubmit={handleAddHandler} className="flex gap-2 shrink-0">
              <input
                id="input-handler-config"
                type="text"
                placeholder="例如: 魏超"
                value={newHandler}
                onChange={(e) => setNewHandler(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg py-1 px-3 text-xs focus:outline-none"
              />
              <button
                type="submit"
                id="btn-add-handler"
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                新增
              </button>
            </form>

            <div className="flex-1 overflow-y-auto mt-2 divide-y divide-slate-50 border border-slate-50 rounded">
              {handlers.map(h => (
                <div key={h} className="p-2 flex items-center justify-between text-xs hover:bg-slate-50">
                  <span>{h}</span>
                  <button
                    id={`btn-del-handler-${h}`}
                    onClick={() => handleDeleteHandler(h)}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
