import React, { useState, useMemo } from 'react';
import { useInventoryStore } from '../store/useInventoryStore';
import { formatters } from '../db';
import { PackagePlus, PackageMinus, CheckCircle2, AlertCircle, Search } from 'lucide-react';

export const MobileRecordForm: React.FC = () => {
  const { stats, positions, demands, recordInbound, recordOutbound } = useInventoryStore();
  const [activeMode, setActiveMode] = useState<'inbound' | 'outbound' | 'search'>('inbound');
  
  // Local form state
  const [positionCode, setPositionCode] = useState('');
  const [demandId, setDemandId] = useState('');
  const [qty, setQty] = useState('');
  const [handler, setHandler] = useState('张敏');
  const [line, setLine] = useState('线别A-01');
  const [quality, setQuality] = useState<'OQC验Pass' | '待复检' | '不合格'>('OQC验Pass');
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [message, setMessage] = useState({ type: '', text: '' });

  // Get available positions for inbound
  const availablePositions = useMemo(() => {
    return positions.filter(p => p.status === 'available');
  }, [positions]);

  // Get occupied positions for outbound
  const occupiedPositions = useMemo(() => {
    return positions.filter(p => p.status === 'occupied');
  }, [positions]);

  // Get pending demands (not yet allocated)
  const pendingDemands = useMemo(() => {
    return demands.filter(d => d.position_code === null);
  }, [demands]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return occupiedPositions.filter(p => 
      p.order_no?.toLowerCase().includes(q) || 
      p.model?.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    );
  }, [occupiedPositions, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeMode === 'search') return;
    
    setMessage({ type: '', text: '' });
    
    // Validate common
    if (!positionCode) {
      setMessage({ type: 'error', text: '请选择或扫描仓位' });
      return;
    }
    
    try {
      if (activeMode === 'inbound') {
        if (!demandId || !qty) {
          setMessage({ type: 'error', text: '请输入关联订单和数量' });
          return;
        }

        const demand = pendingDemands.find(d => d.id === demandId);
        if (!demand) {
          setMessage({ type: 'error', text: '找不到对应的需求订单，请重试' });
          return;
        }

        recordInbound(
          demandId,
          positionCode,
          formatters.dbDate(),
          Number(qty),
          line,
          handler,
          quality,
          note
        );

        setMessage({ type: 'success', text: `✅ 入库成功！仓位 ${positionCode} 已绑定订单 ${demand.order_no}` });
      } else {
        const position = occupiedPositions.find(p => p.code === positionCode);
        if (!position || !position.inbound_id) {
          setMessage({ type: 'error', text: '该仓位没有有效的在库记录！' });
          return;
        }

        const outboundQty = Number(qty) || position.qty || 0;

        if (!outboundQty) {
          setMessage({ type: 'error', text: '请输入出库数量！' });
          return;
        }

        recordOutbound(
          position.inbound_id,
          formatters.dbDate(),
          outboundQty,
          handler,
          note
        );

        setMessage({ type: 'success', text: `✅ 出库成功！仓位 ${positionCode} 已扣减 ${outboundQty} PCS` });
      }
      
      // Reset fields
      setPositionCode('');
      setDemandId('');
      setQty('');
      setNote('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '操作失败，请重试' });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-6 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 text-white text-center">
          <h2 className="text-xl font-bold tracking-wider">扫码填报端</h2>
          <p className="text-indigo-200 text-xs mt-1">请选择操作类型并填写记录</p>
        </div>

        {/* Mode Switcher */}
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => { setActiveMode('inbound'); setMessage({type:'',text:''}); setPositionCode(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-4 font-bold text-sm transition-colors cursor-pointer ${
              activeMode === 'inbound' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <PackagePlus size={16} />
            入库
          </button>
          <button
            type="button"
            onClick={() => { setActiveMode('outbound'); setMessage({type:'',text:''}); setPositionCode(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-4 font-bold text-sm transition-colors cursor-pointer ${
              activeMode === 'outbound' 
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/30' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <PackageMinus size={16} />
            出库
          </button>
          <button
            type="button"
            onClick={() => { setActiveMode('search'); setMessage({type:'',text:''}); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-4 font-bold text-sm transition-colors cursor-pointer ${
              activeMode === 'search' 
                ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50/30' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Search size={16} />
            找货
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {activeMode === 'search' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">通过订单号/型号/仓位查找</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="输入订单号..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pb-4">
                {searchQuery.trim() === '' ? (
                  <div className="text-center py-8 text-slate-400 text-sm">请输入关键词进行查找</div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">暂无匹配的在库记录</div>
                ) : (
                  searchResults.map(p => (
                    <div key={p.code} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex justify-between items-center animate-in fade-in zoom-in-95">
                      <div>
                        <div className="font-bold text-sky-600 text-sm">{p.code}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">订单: {p.order_no} | {p.qty} PCS</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setActiveMode('outbound');
                          setPositionCode(p.code);
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold text-slate-600 hover:text-emerald-600 hover:border-emerald-200 cursor-pointer transition-colors"
                      >
                        去出库
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Position Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">目标仓位 *</label>
                <select
                  value={positionCode}
                  onChange={(e) => setPositionCode(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700 bg-white"
                >
                  <option value="">-- 请选择仓位 --</option>
                  {activeMode === 'inbound' 
                    ? availablePositions.map(p => <option key={p.code} value={p.code}>{p.code} (空闲)</option>)
                    : occupiedPositions.map(p => <option key={p.code} value={p.code}>{p.code} (已用)</option>)
                  }
                </select>
                <p className="text-[10px] text-slate-400">
                  {activeMode === 'inbound' ? '请选择一个空闲的仓位进行上架。' : '请选择需要扣减出库的实物仓位。'}
                </p>
              </div>

          {activeMode === 'inbound' && (
            <>
              {/* Demand Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">待入库托盘 (订单) *</label>
                <select
                  value={demandId}
                  onChange={(e) => setDemandId(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700 bg-white"
                >
                  <option value="">-- 请选择待入库需求 --</option>
                  {pendingDemands.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.order_no} - {d.model} (托盘 {d.seq})
                    </option>
                  ))}
                </select>
                {pendingDemands.length === 0 && (
                  <p className="text-[10px] text-rose-500">当前没有待分配入库的托盘需求，请先在订单管理生成需求。</p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">入库数量 (PCS) *</label>
                <input
                  type="number"
                  placeholder="请输入整托数量"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700"
                />
              </div>

              {/* Line & Quality */}
              <div className="flex gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-bold text-slate-700 block">生产品线</label>
                  <select
                    value={line}
                    onChange={(e) => setLine(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700 bg-white"
                  >
                    <option value="线别A-01">线别A-01</option>
                    <option value="线别A-02">线别A-02</option>
                    <option value="委外加工线">委外加工线</option>
                  </select>
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-bold text-slate-700 block">品质状态</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as any)}
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700 bg-white"
                  >
                    <option value="OQC验Pass">OQC验Pass</option>
                    <option value="待复检">待复检</option>
                    <option value="不合格">不合格</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeMode === 'outbound' && positionCode && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-xs text-slate-500 mb-2 font-bold flex justify-between items-center">
                <span>当前仓位信息</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{positionCode}</span>
              </p>
              <div className="font-mono text-sm font-bold text-slate-800 space-y-1">
                {(() => {
                  const p = occupiedPositions.find(p => p.code === positionCode);
                  if (p) {
                    const diffDays = p.inbound_date ? Math.floor((new Date().getTime() - new Date(p.inbound_date).getTime()) / (1000 * 3600 * 24)) : 0;
                    return (
                      <>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 font-sans text-xs font-normal">订单:</span>
                          <span className="text-indigo-600">{p.order_no} ({p.model})</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 font-sans text-xs font-normal">在库数量:</span>
                          <span>{p.qty} PCS</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 font-sans text-xs font-normal">在库天数:</span>
                          <span className={diffDays > 15 ? 'text-rose-500' : ''}>
                            {diffDays} 天
                          </span>
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">出库数量 (PCS) *</label>
                <input
                  type="number"
                  placeholder="默认全部出库"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700"
                />
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div className="flex gap-4">
            <div className="space-y-1.5 w-1/3">
              <label className="text-xs font-bold text-slate-700 block">操作经办人</label>
              <select
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700 bg-white"
              >
                <option value="张敏">张敏</option>
                <option value="李强">李强</option>
                <option value="王工">王工</option>
              </select>
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-bold text-slate-700 block">备注 (选填)</label>
              <input
                type="text"
                placeholder="附加说明"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-slate-700"
              />
            </div>
          </div>

          {/* Message Area */}
          {message.text && (
            <div className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 animate-in fade-in ${
              message.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              {message.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
              {message.text}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === 'inbound' 
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30' 
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
          >
            {activeMode === 'inbound' ? '提交入库记录' : '提交出库记录'}
          </button>
        </>
      )}
    </form>
      </div>
    </div>
  );
};

