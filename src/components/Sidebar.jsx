import React, { useState } from 'react';
import {
  LayoutDashboard, TrendingUp,
  Cpu, User, ChevronRight, Network, FlaskConical, Menu, X,
} from 'lucide-react';

const NAV = [
  { id: 'dashboard',  label: 'Dashboard Simulation', icon: LayoutDashboard },
  { id: 'similarity', label: 'Similar Cases',        icon: Network },
  { id: 'catboost',   label: 'Trained Model',        icon: Cpu },
  { id: 'equations',  label: 'Basyoun Equation',     icon: TrendingUp },
  { id: 'trends',     label: 'Relationships',        icon: TrendingUp },
  { id: 'labentry',   label: 'Lab Entry',            icon: FlaskConical },
];

export default function Sidebar({ activeNav, setActiveNav }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Collapsed toggle button — always visible when sidebar is closed */}
      {!open && (
        <div
          className="flex-shrink-0 flex flex-col items-center pt-4 border-r border-cyan-500/10"
          style={{ width: 52, background: 'linear-gradient(180deg,#07101f 0%,#050c1a 100%)' }}
        >
          <button
            onClick={() => setOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
            title="Open navigation"
          >
            <Menu size={17} />
          </button>

          {/* Icon-only nav pills when collapsed */}
          <div className="mt-4 flex flex-col gap-1 w-full px-1.5">
            {NAV.map(({ id, icon: Icon }) => {
              const active = activeNav === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveNav(id)}
                  title={NAV.find(n => n.id === id)?.label}
                  className={`w-full flex items-center justify-center py-2 rounded-lg transition-all duration-200
                    ${active
                      ? 'bg-cyan-500/15 border border-cyan-400/25 text-cyan-400'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                    }`}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded sidebar */}
      {open && (
        <div
          className="flex-shrink-0 flex flex-col border-r border-cyan-500/10 transition-all duration-200"
          style={{ width: 210, background: 'linear-gradient(180deg,#07101f 0%,#050c1a 100%)' }}
        >
          {/* Header with close button */}
          <div className="p-4 border-b border-cyan-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-9 h-9 flex-shrink-0">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center">
                  <Cpu size={17} className="text-cyan-400" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 status-dot border-2 border-[#07101f]" />
              </div>
              <div className="min-w-0">
                <p className="font-orbitron text-[13px] font-bold text-white leading-tight">RenalAI</p>
                <p className="text-[10px] text-cyan-400/65 font-medium mt-0.5 leading-tight tracking-wide">eGFR PREDICTOR</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
              title="Close navigation"
            >
              <X size={15} />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = activeNav === id;
              return (
                <button
                  key={id}
                  onClick={() => { setActiveNav(id); setOpen(false); }}
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
      )}
    </>
  );
}
