import React from 'react';
import { 
  BookOpen, 
  Map, 
  ListTodo, 
  PackagePlus, 
  Smartphone, 
  Search, 
  ShieldCheck,
  Layers
} from 'lucide-react';

export const SystemManual: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={28} className="text-indigo-200" />
            <h1 className="text-2xl font-bold tracking-wider">系统操作使用手册</h1>
          </div>
          <p className="text-indigo-100 text-sm max-w-2xl leading-relaxed">
            欢迎使用「成品进销存协同管理系统」。本手册将为您详细讲解如何进行订单排产、分配仓位、全局扫码以及管理全仓物理台账。
          </p>
        </div>
        {/* Background decorative elements */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
      </div>

      {/* Manual Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Section 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 mb-4">
            <ListTodo size={20} />
            <h2 className="text-base font-bold text-slate-800">1. 订单排程与需求下达</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            在 <span className="font-bold text-slate-800">【生产与订单排程】</span> 模块中，您可以录入新的生产/销售订单。
          </p>
          <ul className="text-xs text-slate-600 list-disc list-inside space-y-1.5 ml-1">
            <li>录入订单号、产品型号、订单总数和每托盘标准包装数。</li>
            <li>系统会 <span className="text-emerald-600 font-bold">自动将订单拆分为多个独立的“托盘”</span>（如 1000件，每托200件，将拆分为5个托盘）。</li>
            <li>拆分后的托盘即生成了“待入库需求”，自动流转至入库管理环节。</li>
          </ul>
        </div>

        {/* Section 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 mb-4">
            <PackagePlus size={20} />
            <h2 className="text-base font-bold text-slate-800">2. 入库分配与批量设置</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            在 <span className="font-bold text-slate-800">【入库扫码与批量分配】</span> 模块中处理未分配仓位的托盘：
          </p>
          <ul className="text-xs text-slate-600 list-disc list-inside space-y-1.5 ml-1">
            <li>在表格中为每一个排队的托盘指定一个 <span className="font-bold">空闲的物理仓位</span>。</li>
            <li><span className="text-indigo-600 font-bold">批量操作：</span>勾选左侧复选框，利用表格顶部的“批量设置选中项”功能，一键同步入库日期、品线、经办人、品检结果等。</li>
            <li>确认无误后点击“一键入库锁定”，这些托盘将正式进入物理仓位。</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 mb-4">
            <Map size={20} />
            <h2 className="text-base font-bold text-slate-800">3. 仓位地图与明细台账</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            在 <span className="font-bold text-slate-800">【首页 / 仓位地图】</span> 中，系统提供双视图管理：
          </p>
          <ul className="text-xs text-slate-600 list-disc list-inside space-y-1.5 ml-1">
            <li><span className="font-bold">可视化网格：</span>直观查看各库区（A区、B区等）的仓位占用状态（绿为空闲，红为占用）。</li>
            <li><span className="font-bold">全仓物理明细表：</span>点击顶部切换按钮进入台账列表，支持多条件过滤检索。</li>
            <li>支持一键导出台账为 CSV Excel 报表，或直接在仓位卡片上进行“快捷出库/上架”。</li>
          </ul>
        </div>

        {/* Section 4 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 mb-4">
            <Smartphone size={20} />
            <h2 className="text-base font-bold text-slate-800">4. 扫码填报端 (移动端)</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            左侧菜单底部的 <span className="font-bold text-slate-800">【扫码填报端】</span> 专为车间现场人员设计：
          </p>
          <ul className="text-xs text-slate-600 list-disc list-inside space-y-1.5 ml-1">
            <li>采用移动端自适应（Mobile-First）大卡片设计，按钮放大，适合手指触控。</li>
            <li><span className="font-bold">入库登记：</span>选择空闲仓位和待分配订单，填写相关信息直接提交。</li>
            <li><span className="font-bold">出库登记：</span>选择已用仓位，系统自动调出库龄与在库数量，录入扣减数量即可出库释放。</li>
            <li>此界面未来可直接转成二维码供工业 PDA 或微信扫一扫使用。</li>
          </ul>
        </div>

        {/* Section 5 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 md:col-span-2">
          <div className="flex items-center gap-2 text-indigo-600 mb-4">
            <Search size={20} />
            <h2 className="text-base font-bold text-slate-800">5. 全局检索 (快捷键) 与 爆仓预警</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">Ctrl</span>+<span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">K</span> 全局万能检索
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                在系统的任意界面，按下快捷键 <code>Ctrl+K</code>（或点击顶部右上角的搜索按钮），即可唤起全局搜索弹窗。输入仓位号、订单号或型号，即可直达定位或进行快捷扣减操作。
              </p>
            </div>
            <div>
              <h3 className="font-bold text-sm text-rose-600 mb-2 flex items-center gap-1.5">
                <ShieldCheck size={16} /> 爆仓超限安全防护
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                当全仓利用率超过安全阈值（如90%）时，系统顶部会闪烁 <span className="text-rose-600 font-bold">爆仓预警</span> 红色提示，此时请优先安排旧货（FIFO）出库，避免产线货物堆积。
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Support */}
      <div className="text-center mt-8">
        <p className="text-xs text-slate-400 font-semibold">
          如需进一步的技术支持或系统定制，请联系 IT 部门管理员。
        </p>
      </div>
    </div>
  );
};
