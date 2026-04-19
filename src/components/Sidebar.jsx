import React from 'react';
import {
  LayoutDashboard, Users, Activity, TrendingUp,
  Bell, Settings, Cpu, User, ChevronRight,
} from 'lucide-react';

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'patient',     label: 'Patient Data', icon: Users },
  { id: 'simulation',  label: 'Simulation',   icon: Activity },
  { id: 'trends',      label: 'Trends',       icon: TrendingUp },
  { id: 'alerts',      label: 'Alerts',       icon: Bell },
  { id: 'settings',    label: 'Settings',     icon: Settings },
];

export default function Sidebar({ activeNav, setActiveNav, alertCount = 0 }) {
  return (
    <div
      className="w-[210px] flex-shrink-0 flex flex-col border-r border-cyan-500/10"
      style={{ background: 'linear-gradient(180deg,#07101f 0%,#050c1a 100%)' }}
    >
      {/* Logo */}
      <div className="p-4 border-b border-cyan-500/10">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center">
              <Cpu size={17} className="text-cyan-400" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 status-dot border-2 border-[#07101f]" />
          </div>
          <div>
            <p className="font-orbitron text-[13px] font-bold text-white leading-tight">RenalAI</p>
            <p className="text-[10px] text-cyan-400/65 font-medium mt-0.5 leading-tight tracking-wide">eGFR PREDICTOR</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group relative
                ${active
                  ? 'bg-cyan-500/12 border border-cyan-400/22 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cyan-400 rounded-r-full" />
              )}
              <Icon
                size={15}
                className={active ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'}
              />
              <span className="text-[13px] font-medium">{label}</span>
              {id === 'alerts' && alertCount > 0 && (
                <span className="ml-auto text-[10px] bg-red-500/80 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                  {alertCount}
                </span>
              )}
              {active && <ChevronRight size={11} className="ml-auto text-cyan-400/50" />}
            </button>
          );
        })}
      </nav>

      {/* Live badge */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/6 border border-cyan-500/14">
          <span className="relative flex-shrink-0">
            <span className="w-1.5 h-1.5 block rounded-full bg-cyan-400" />
            <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping opacity-70" />
          </span>
          <span className="text-[10px] text-cyan-400/75 font-semibold tracking-wider">LIVE SIMULATION</span>
        </div>
      </div>

      {/* Doctor profile */}
      <div className="p-2.5 border-t border-cyan-500/10">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-800/35 border border-slate-700/25
                        hover:border-cyan-500/18 transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate-200 truncate">Dr. Sarah Chen</p>
            <p className="text-[10px] text-slate-500 truncate">Nephrology</p>
          </div>
        </div>
      </div>
    </div>
  );
}
