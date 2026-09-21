/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { DBService } from '../db';
import { WarehouseConfig, ProductModel, ProductSku, Supplier } from '../types';

export const SystemConfig: React.FC = () => {
  const [warehouseConfig, setWarehouseConfig] = useState<WarehouseConfig>(() => DBService.getWarehouseConfig());
  const [lines, setLines] = useState<string[]>(() => DBService.getLines());
  const [handlers, setHandlers] = useState<string[]>(() => DBService.getHandlers());
  const [models, setModels] = useState<ProductModel[]>(() => DBService.getModels());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => DBService.getSuppliers());
  const [skus, setSkus] = useState<ProductSku[]>(() => DBService.getProductSkus());
  const [newModelName, setNewModelName] = useState('');
  const [newModelPerPallet, setNewModelPerPallet] = useState<number | ''>('');
  const [newModelSafety, setNewModelSafety] = useState<number | ''>('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierLocation, setNewSupplierLocation] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

  // ===== 主数据中心：型号库 / 供应商 / SKU 阈值 =====
  const updateModelField = (name: string, field: 'default_per_pallet' | 'safety_stock', v: number) => {
    const updated = models.map(m => m.name === name ? { ...m, [field]: Math.max(1, v) } : m);
    setModels(updated);
    DBService.saveModels(updated);
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    const name = newModelName.trim();
    if (!name) { setErrorMsg('型号名称不能为空！'); return; }
    if (models.some(m => m.name === name)) { setErrorMsg(`型号 ${name} 已存在！`); return; }
    if (!newModelPerPallet || newModelPerPallet < 1) { setErrorMsg('默认每托数量必须大于 0！'); return; }
    const updated = [...models, {
      name,
      default_per_pallet: Number(newModelPerPallet),
      safety_stock: Number(newModelSafety) || Number(newModelPerPallet) * 6
    }];
    setModels(updated);
    DBService.saveModels(updated);
    setNewModelName(''); setNewModelPerPallet(''); setNewModelSafety('');
    setSuccessMsg(`型号「${name}」已加入型号库。`);
  };

  const handleDeleteModel = (name: string) => {
    const updated = models.filter(m => m.name !== name);
    setModels(updated);
    DBService.saveModels(updated);
    setSuccessMsg(`型号「${name}」已从型号库移除。`);
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    const name = newSupplierName.trim();
    if (!name) { setErrorMsg('供应商名称不能为空！'); return; }
    if (suppliers.some(s => s.name === name)) { setErrorMsg(`供应商「${name}」已存在！`); return; }
    const updated = [...suppliers, {
      id: 'SUP' + String(suppliers.length + 1).padStart(4, '0'),
      name,
      location: newSupplierLocation.trim() || '—',
      moq: 10,
      rating: 4.5
    }];
    setSuppliers(updated);
    DBService.saveSuppliers(updated);
    setNewSupplierName(''); setNewSupplierLocation('');
    setSuccessMsg(`供应商「${name}」已加入名录。`);
  };

  const handleDeleteSupplier = (id: string) => {
    const updated = suppliers.filter(s => s.id !== id);
    setSuppliers(updated);
    DBService.saveSuppliers(updated);
    setSuccessMsg('供应商已移除。');
  };

  const updateSkuField = (sku: string, field: 'perPallet' | 'replenishPoint' | 'abundanceThreshold', v: number) => {
    const updated = skus.map(s => s.sku === sku
      ? { ...s, [field]: field === 'perPallet' ? Math.max(1, v) : Math.max(0, v) }
      : s);
    setSkus(updated);
    DBService.saveProductSkus(updated);
  };

  // Deep Reset Database
  const handleResetDatabase = () => {
    if (window.confirm('警告：此操作将清空所有新增订单、出入库历史记录，并恢复至系统最初的出厂演示状态。是否确认？')) {
      DBService.resetToDefault();
      setWarehouseConfig(DBService.getWarehouseConfig());
      setLines(DBService.getLines());
      setHandlers(DBService.getHandlers());
      setModels(DBService.getModels());
      setSuppliers(DBService.getSuppliers());
      setSkus(DBService.getProductSkus());
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

      <div className="grid grid-cols-1 gap-5">
        {/* Card 1: Warehouse grid capacities */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-5 flex flex-col justify-between">
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

      {/* ===== 主数据中心：型号库 / 供应商 / SKU 阈值 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 型号库 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-50 pb-1.5 flex items-center justify-between">
            <span>商品库（SPU）· 一个商品下可挂多个 SKU</span>
            <span className="text-[10px] font-normal text-slate-400">商品数: {models.length}</span>
          </h4>
          <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-[240px]">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-left">商品ID</th>
                  <th className="py-2 px-3 text-left">商品名 / 型号</th>
                  <th className="py-2 px-2 text-right">默认每托</th>
                  <th className="py-2 px-2 text-right">安全库存</th>
                  <th className="py-2 px-2 text-center">SKU 数</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {models.map(m => (
                  <tr key={m.itemId || m.name}>
                    <td className="py-1.5 px-3 font-mono font-bold text-violet-700">{m.itemId || '—'}</td>
                    <td className="py-1.5 px-3">
                      <div className="font-semibold text-slate-700">{m.itemName || m.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.name}{m.code ? ` · ${m.code}` : ''}</div>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <input type="number" min={1} value={m.default_per_pallet}
                        onChange={(e) => updateModelField(m.name, 'default_per_pallet', Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none" />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <input type="number" min={1} value={m.safety_stock}
                        onChange={(e) => updateModelField(m.name, 'safety_stock', Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none" />
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                      {skus.filter(s => s.itemId === m.itemId).length}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <button onClick={() => handleDeleteModel(m.name)} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded transition-all">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={handleAddModel} className="grid grid-cols-4 gap-2">
            <input type="text" placeholder="型号名称" value={newModelName} onChange={(e) => setNewModelName(e.target.value)}
              className="col-span-2 border border-slate-200 rounded-lg py-1 px-2 text-xs focus:outline-none" />
            <input type="number" min={1} placeholder="每托" value={newModelPerPallet}
              onChange={(e) => setNewModelPerPallet(e.target.value === '' ? '' : Number(e.target.value))}
              className="border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono focus:outline-none" />
            <input type="number" min={1} placeholder="安全库存" value={newModelSafety}
              onChange={(e) => setNewModelSafety(e.target.value === '' ? '' : Number(e.target.value))}
              className="border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono focus:outline-none" />
            <button type="submit" className="col-span-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1">
              <Plus size={12} />新增型号
            </button>
          </form>
        </div>

        {/* 供应商 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-50 pb-1.5 flex items-center justify-between">
            <span>供应商名录</span>
            <span className="text-[10px] font-normal text-slate-400">数量: {suppliers.length}</span>
          </h4>
          <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-[240px]">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-left">供应商</th>
                  <th className="py-2 px-2 text-left">地区</th>
                  <th className="py-2 px-2 text-right">MOQ</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td className="py-1.5 px-3">
                      <div className="font-semibold text-slate-700">{s.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.id}</div>
                    </td>
                    <td className="py-1.5 px-2 text-slate-600">{s.location}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{s.moq}</td>
                    <td className="py-1.5 px-2 text-center">
                      <button onClick={() => handleDeleteSupplier(s.id)} className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded transition-all">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={handleAddSupplier} className="grid grid-cols-3 gap-2">
            <input type="text" placeholder="供应商名称" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
              className="col-span-2 border border-slate-200 rounded-lg py-1 px-2 text-xs focus:outline-none" />
            <input type="text" placeholder="地区" value={newSupplierLocation} onChange={(e) => setNewSupplierLocation(e.target.value)}
              className="border border-slate-200 rounded-lg py-1 px-2 text-xs focus:outline-none" />
            <button type="submit" className="col-span-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1">
              <Plus size={12} />新增供应商
            </button>
          </form>
        </div>
      </div>

      {/* SKU 补货阈值 */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-50 pb-1.5 flex items-center justify-between">
          <span>SKU · 单托容量 / 补货值 / 充裕值</span>
          <span className="text-[10px] font-normal text-slate-400">共 {skus.length} 个 SKU / {models.length} 个商品（一个托只放同一 SKU，超量按单托容量拆多托）</span>
        </h4>
        <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-[280px]">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
              <tr>
                <th className="py-2 px-3 text-left">商品ID</th>
                <th className="py-2 px-3 text-left">SKU</th>
                <th className="py-2 px-3 text-left">SKU 品名 / 规格</th>
                <th className="py-2 px-3 text-left">供应商</th>
                <th className="py-2 px-2 text-right">在库</th>
                <th className="py-2 px-2 text-right">每托</th>
                <th className="py-2 px-2 text-right">补货值</th>
                <th className="py-2 px-2 text-right">充裕值</th>
                <th className="py-2 px-2 text-center">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {skus.map(s => {
                const sup = suppliers.find(x => x.id === s.supplierId);
                const isTrigger = s.stock <= s.replenishPoint;
                const isMerge = !isTrigger && s.stock < s.abundanceThreshold;
                return (
                  <tr key={s.sku}>
                    <td className="py-1.5 px-3 font-mono font-bold text-violet-700">{s.itemId}</td>
                    <td className="py-1.5 px-3 font-mono font-bold text-indigo-600">{s.sku}</td>
                    <td className="py-1.5 px-3 text-slate-700">{s.title}
                      <div className="text-[10px] text-slate-400">{[s.color, s.spec].filter(Boolean).join(' / ') || '—'}</div>
                    </td>
                    <td className="py-1.5 px-3 text-slate-500">{sup?.name || s.supplierId}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">{s.stock}</td>
                    <td className="py-1.5 px-2 text-right">
                      <input type="number" min={1} value={s.perPallet}
                        onChange={(e) => updateSkuField(s.sku, 'perPallet', Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none" />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <input type="number" min={0} value={s.replenishPoint}
                        onChange={(e) => updateSkuField(s.sku, 'replenishPoint', Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none" />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <input type="number" min={0} value={s.abundanceThreshold}
                        onChange={(e) => updateSkuField(s.sku, 'abundanceThreshold', Number(e.target.value))}
                        className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-right font-mono focus:outline-none" />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {isTrigger
                        ? <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">需补货</span>
                        : isMerge
                          ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">可合并</span>
                          : <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">正常</span>}
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
