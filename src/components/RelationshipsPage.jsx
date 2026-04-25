import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LineChart, Line,
} from 'recharts';
import {
  RELATIONSHIP_TABLES,
  INTERACTION_TERMS,
  CAUSAL_EDGES,
  PROBABILITY_MODEL_NOTES,
  ALL_RELATIONSHIP_ROWS,
  buildRelationshipTrend,
} from '../utils/relationshipKnowledge.js';

const edgeChartData = CAUSAL_EDGES.map(([from, to, weight], idx) => ({
  id: `${from}-${to}-${idx}`,
  edge: `${from}->${to}`,
  weight: Math.abs(weight),
  sign: weight >= 0 ? 'positive' : 'negative',
}));

export default function RelationshipsPage() {
  const pairTrendCharts = ALL_RELATIONSHIP_ROWS.map((row, idx) => {
    const trend = buildRelationshipTrend(row);
    return {
      id: `${row.f1}-${row.f2}-${idx}`,
      title: `${row.f1} vs ${row.f2}`,
      relation: row.relation,
      reference: row.reference,
      ...trend,
    };
  });

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      style={{ background: 'linear-gradient(180deg, #071428 0%, #050d1d 55%, #040916 100%)' }}
    >
      <div className="mb-4 rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Relationships and Trend Modeling</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Unified representation: eGFR = f(Cr, Age, Gender, BMI, DM, HTN, Chol, HDL, Hb, interactions).
          This page summarizes literature-guided mathematical relationships and causal structure for probability-based propagation.
        </p>
        <p className="text-xs text-slate-400 mt-2">Critical interaction terms: {INTERACTION_TERMS.join(', ')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Causal Edge Strengths</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={edgeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="edge" angle={-35} textAnchor="end" interval={0} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="weight">
                  {edgeChartData.map((d) => (
                    <Cell key={d.id} fill={d.sign === 'positive' ? '#5f86c7' : '#b07bb6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Probability and SEM Notes</h3>
          <ul className="space-y-2">
            {PROBABILITY_MODEL_NOTES.map((note) => (
              <li key={note} className="text-sm text-slate-300 leading-relaxed">
                - {note}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        {RELATIONSHIP_TABLES.map((section) => (
          <div key={section.title} className="rounded-xl border border-slate-500/20 bg-slate-900/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-600/20">
              <h3 className="text-sm font-semibold text-slate-200">{section.title}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/35 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Feature 1</th>
                    <th className="px-3 py-2 font-semibold">Feature 2</th>
                    <th className="px-3 py-2 font-semibold">Mathematical Relation</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Medical Interpretation</th>
                    <th className="px-3 py-2 font-semibold">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={`${row.f1}-${row.f2}-${row.reference}`} className="border-t border-slate-700/20 text-slate-300">
                      <td className="px-3 py-2">{row.f1}</td>
                      <td className="px-3 py-2">{row.f2}</td>
                      <td className="px-3 py-2">{row.relation}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">{row.interpretation}</td>
                      <td className="px-3 py-2 text-slate-400">{row.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-500/20 bg-slate-900/30 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Pairwise Trend Charts (All Table Relationships)</h3>
        <p className="text-xs text-slate-400 mb-3">
          Each chart visualizes the mathematical directionality from your relationship tables (positive, inverse, U-shaped, categorical).
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {pairTrendCharts.map((chart) => (
            <div key={chart.id} className="rounded-lg border border-slate-600/25 bg-slate-800/30 p-3">
              <p className="text-xs text-slate-200 font-semibold">{chart.title}</p>
              <p className="text-[11px] text-slate-400 mb-2">{chart.relation}</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.chartType === 'bar' ? (
                    <BarChart data={chart.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                      <XAxis dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="y" fill="#6f8ec6" />
                    </BarChart>
                  ) : (
                    <LineChart data={chart.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                      <XAxis dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip />
                      <Line dataKey="y" stroke="#6f8ec6" strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">{chart.reference}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
