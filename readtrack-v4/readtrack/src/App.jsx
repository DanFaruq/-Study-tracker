import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { runMigration, persist, uid, STORAGE_KEY } from "./migration.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; } }
function fmtDateShort(d) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return "—"; } }
function getGreeting(name) { const h = new Date().getHours(); const base = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; return `${base}, ${name || "Scholar"} 👋`; }
function parseDocIntoPages(text, fileName) {
  if (!text) return [];
  let chunks = text.split(/\f|\n{4,}/);
  if (chunks.length < 2) {
    const words = text.split(/\s+/);
    const WPP = 500;
    chunks = [];
    for (let i = 0; i < words.length; i += WPP) chunks.push(words.slice(i, i + WPP).join(" "));
  }
  return chunks.filter(c => c.trim().length > 0).map((content, i) => ({ pageNum: i + 1, content: content.trim() }));
}

const ENCOURAGEMENTS = [
  "Small steps compound into big results.",
  "Every page read brings you closer.",
  "You're building something great — keep going.",
  "Consistency is your superpower.",
  "Your future self is proud of today's effort.",
  "One topic at a time. You've got this.",
];

function makeDefaultSubjects() {
  return [
    { id: uid(), name: "Community Medicine", courseCode: "COM 405", semester: "First Semester", session: "2025/2026", color: "#3b82f6", description: "Public health, epidemiology, and health systems.", notes: "", createdAt: new Date().toISOString() },
    { id: uid(), name: "Physiology", courseCode: "PHY 402", semester: "First Semester", session: "2025/2026", color: "#10b981", description: "Systems physiology and regulation.", notes: "", createdAt: new Date().toISOString() },
    { id: uid(), name: "Pathology", courseCode: "PAT 401", semester: "First Semester", session: "2025/2026", color: "#f59e0b", description: "Disease mechanisms and histopathology.", notes: "", createdAt: new Date().toISOString() },
  ];
}

const DEFAULT_DATA = {
  profile: { name: "Student", theme: "system" },
  subjects: makeDefaultSubjects(),
  topics: [], assignments: [], exams: [], mcqSessions: [], documents: [], chatHistory: [],
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 16, className = "", strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={path} />
  </svg>
);
const I = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  book:      "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  list:      "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 12h6 M9 16h4",
  clip:      "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2",
  calendar:  "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  chart:     "M18 20V10 M12 20V4 M6 20v-6",
  settings:  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  exam:      "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  sun:       "M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  moon:      "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  plus:      "M12 5v14 M5 12h14",
  trash:     "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  edit:      "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  check:     "M20 6L9 17l-5-5",
  close:     "M18 6L6 18 M6 6l12 12",
  search:    "M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z M16 16l4.5 4.5",
  download:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  menu:      "M3 12h18 M3 6h18 M3 18h18",
  trophy:    "M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0V2z",
  send:      "M22 2L11 13 M22 2L15 22l-4-9-9-4 22-7z",
  mcq:       "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  upload:    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  sparkle:   "M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.07l-4.91 3.57a1 1 0 0 0-.36 1.12L17.5 20l-4.91-3.57a1 1 0 0 0-1.18 0L6.5 20l1.87-5.86a1 1 0 0 0-.36-1.12L3.1 9.45h6.07a1 1 0 0 0 .95-.69L12 3z",
  reader:    "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  file:      "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7",
  image:     "M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 21",
  note:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  link:      "M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3 M8 12h8",
  zoom_in:   "M11 8v6 M8 11h6 M21 21l-4.35-4.35 M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  zoom_out:  "M8 11h6 M21 21l-4.35-4.35 M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  sidebar_l: "M3 3h18v18H3z M9 3v18",
  chevron_l: "M15 18l-6-6 6-6",
  chevron_r: "M9 18l6-6-6-6",
  magic:     "M15 4V2m0 2v2m0-2h-2m2 0h2 M4 13h2m-2 0v2m0-2V11 M20 9l-1.5 1.5M20 9l1.5-1.5M20 9h-1.5M20 9h1.5",
};

// ─── UI Primitives ────────────────────────────────────────────────────────────
function cn(...c) { return c.filter(Boolean).join(" "); }

function Badge({ children, variant = "default", className = "" }) {
  const v = { default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400", danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", info: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400", purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", v[variant] || v.default, className)}>{children}</span>;
}
function ProgressBar({ value, color = "#6366f1", height = 6 }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return <div className="w-full rounded-full overflow-hidden" style={{ height, background: "rgba(128,128,128,0.15)" }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} /></div>;
}
function Card({ children, className = "", style = {} }) {
  return <div className={cn("bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl", className)} style={style}>{children}</div>;
}
function Button({ children, onClick, variant = "primary", size = "md", disabled = false, className = "", type = "button" }) {
  const base = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-xs gap-1.5", md: "px-4 py-2 text-sm gap-2", lg: "px-5 py-2.5 text-base gap-2" };
  const variants = { primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm", secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 focus:ring-slate-400", danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500", ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 focus:ring-slate-400", success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500", outline: "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-slate-400" };
  return <button type={type} onClick={onClick} disabled={disabled} className={cn(base, sizes[size], variants[variant] || variants.primary, className)}>{children}</button>;
}
function Input({ value, onChange, placeholder, type = "text", min, max, className = "", id, required }) {
  return <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} required={required} className={cn("w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition", className)} />;
}
function Textarea({ value, onChange, placeholder, rows = 3, className = "" }) {
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} className={cn("w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none", className)} />;
}
function Select({ value, onChange, children, className = "" }) {
  return <select value={value} onChange={e => onChange(e.target.value)} className={cn("w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none cursor-pointer", className)}>{children}</select>;
}
function Label({ children, htmlFor, className = "" }) { return <label htmlFor={htmlFor} className={cn("text-sm font-semibold text-slate-700 dark:text-slate-300", className)}>{children}</label>; }
function FormField({ label, children, className = "" }) { return <div className={cn("space-y-1.5", className)}>{label && <Label>{label}</Label>}{children}</div>; }

function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => { if (open) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={cn("relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800", wide ? "max-w-3xl" : "max-w-lg")} onClick={e => e.stopPropagation()} style={{ animation: "modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><Icon path={I.close} size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">{icon || <Icon path={I.list} size={28} />}</div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-slate-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}
function StatCard({ label, value, sub, icon, color = "#6366f1", bg = "#eef2ff" }) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 mb-2">{label}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
          {sub && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg, color }}><Icon path={icon} size={18} /></div>
      </div>
    </Card>
  );
}

function MiniBarChart({ data, valueKey, labelKey, color = "#6366f1" }) {
  if (!data?.length) return <div className="h-40 flex items-center justify-center text-sm text-slate-400">No data yet</div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="flex items-end gap-1 h-40 pt-2">
      {data.map((d, i) => { const h = Math.max(2, ((d[valueKey] || 0) / max) * 100); return (<div key={i} className="flex-1 flex flex-col items-center gap-1 group relative"><div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">{d[labelKey]}: {d[valueKey]}</div><div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${h}%`, background: color, minHeight: 2 }} /><span className="text-[10px] text-slate-400 truncate w-full text-center leading-tight">{d[labelKey]}</span></div>); })}
    </div>
  );
}
function MiniLineChart({ data, valueKey, labelKey, color = "#10b981" }) {
  if (!data?.length || data.every(d => !d[valueKey])) return <div className="h-40 flex items-center justify-center text-sm text-slate-400">No data yet</div>;
  const values = data.map(d => d[valueKey] || 0); const max = Math.max(...values, 1); const W = 400, H = 120;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1 || 1)) * W, y: H - (v / max) * H }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (<div className="space-y-2"><svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32"><defs><linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#lg2)" /><path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />)}</svg><div className="flex justify-between text-[10px] text-slate-400">{data.filter((_, i) => i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1).map((d, i) => <span key={i}>{d[labelKey]}</span>)}</div></div>);
}
function PieDonut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ["#6366f1", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6"];
  let cum = 0;
  const slices = data.map((d, i) => { const pct = d.value / total; const start = cum; cum += pct; return { ...d, pct, start, color: colors[i % colors.length] }; });
  const r = 40, cx = 60, cy = 60;
  return (<div className="flex items-center gap-6"><svg width="120" height="120" viewBox="0 0 120 120">{slices.map((s, i) => { const sa = s.start * 2 * Math.PI - Math.PI / 2; const ea = (s.start + s.pct) * 2 * Math.PI - Math.PI / 2; const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa); const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea); const large = s.pct > 0.5 ? 1 : 0; return s.value > 0 ? <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`} fill={s.color} opacity="0.85" /> : null; })}<circle cx={cx} cy={cy} r={r - 16} fill="white" className="dark:fill-slate-900" /><text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fill="currentColor">{total}</text></svg><div className="space-y-1.5">{slices.map((s, i) => (<div key={i} className="flex items-center gap-2 text-sm"><div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /><span className="text-slate-600 dark:text-slate-400">{s.name}</span><span className="font-semibold ml-auto pl-4">{s.value}</span></div>))}</div></div>);
}

// ─── Migration Banner ─────────────────────────────────────────────────────────
function MigrationBanner({ data, onDismiss }) {
  if (!data?._migratedFrom) return null;
  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-emerald-600 text-white rounded-2xl shadow-xl p-4 flex items-start gap-3" style={{ animation: "slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
      <div className="text-2xl shrink-0">✅</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">Data migrated successfully!</p>
        <p className="text-xs text-emerald-200 mt-0.5">Your subjects, topics, assignments and exams from the previous version have been carried over.</p>
        {data._migratedAt && <p className="text-xs text-emerald-300 mt-1">Migrated at {new Date(data._migratedAt).toLocaleTimeString()}</p>}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-white/70 hover:text-white transition"><Icon path={I.close} size={16} /></button>
    </div>
  );
}

// ─── Document Reader ──────────────────────────────────────────────────────────
function DocumentReader({ document: doc, onClose, onAttachToTopic, subjects, topics }) {
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("serif");
  const [theme, setTheme] = useState("white");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("toc");
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [aiPanel, setAiPanel] = useState({ open: false, question: "", answer: "", loading: false });
  const [noteInput, setNoteInput] = useState("");
  const [noteModal, setNoteModal] = useState(false);
  const [attachModal, setAttachModal] = useState(false);
  const [tocItems, setTocItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeColor, setActiveColor] = useState("yellow");
  const readerRef = useRef();

  const HL_COLORS = [
    { key: "yellow", bg: "#fef08a", dark: "#ca8a04" },
    { key: "green",  bg: "#bbf7d0", dark: "#16a34a" },
    { key: "blue",   bg: "#bfdbfe", dark: "#2563eb" },
    { key: "pink",   bg: "#fbcfe8", dark: "#db2777" },
    { key: "orange", bg: "#fed7aa", dark: "#ea580c" },
  ];

  const THEMES = {
    white: { bg: "#ffffff", text: "#1e293b", paper: "#f8fafc", toolbar: "#ffffff", border: "#e2e8f0" },
    sepia: { bg: "#f9f3e3", text: "#3d2b1f", paper: "#fdf8f0", toolbar: "#f0e8d0", border: "#d4b896" },
    dark:  { bg: "#1a1a2e", text: "#e2e8f0", paper: "#16213e", toolbar: "#0f1629", border: "#2d3748" },
    focus: { bg: "#f0f4f8", text: "#1e293b", paper: "#ffffff", toolbar: "#f0f4f8", border: "#e2e8f0" },
  };
  const T = THEMES[theme];

  useEffect(() => {
    if (!doc) return;
    if (doc.type?.startsWith("image/")) { setPages([{ pageNum: 1, content: "", isImage: true, src: doc.dataUrl }]); return; }
    const parsed = parseDocIntoPages(doc.content || "", doc.name);
    setPages(parsed);
    const toc = [];
    parsed.forEach((p, idx) => {
      p.content.split("\n").forEach(line => {
        const hm = line.match(/^(#{1,3})\s+(.+)/);
        if (hm) toc.push({ level: hm[1].length, title: hm[2].trim(), page: idx + 1 });
        else if (line.length < 80 && line.match(/^[A-Z][A-Z\s]{5,}$/) && line.trim().length > 3) toc.push({ level: 2, title: line.trim(), page: idx + 1 });
      });
    });
    setTocItems(toc.slice(0, 60));
  }, [doc]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const res = [];
    pages.forEach(p => { const idx = p.content.toLowerCase().indexOf(searchQuery.toLowerCase()); if (idx !== -1) res.push({ page: p.pageNum, excerpt: p.content.slice(Math.max(0, idx - 30), idx + 60) }); });
    setSearchResults(res.slice(0, 20));
  }, [searchQuery, pages]);

  function handleTextSelection() {
    const sel = window.getSelection();
    const text = sel?.toString()?.trim();
    if (text && text.length > 2) {
      setSelectedText(text);
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setContextMenu({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    } else { setContextMenu(null); setSelectedText(""); }
  }

  function addHighlight(color) {
    if (!selectedText) return;
    setHighlights(h => [...h, { id: uid(), text: selectedText, color, pageNum: currentPage, createdAt: new Date().toISOString() }]);
    setContextMenu(null); setSelectedText(""); window.getSelection()?.removeAllRanges();
  }

  function addNote() {
    if (!noteInput.trim()) return;
    setNotes(n => [...n, { id: uid(), text: noteInput, pageNum: currentPage, selection: selectedText, createdAt: new Date().toISOString() }]);
    setNoteInput(""); setNoteModal(false); setContextMenu(null); setSelectedText("");
    setSidebarTab("notes"); setSidebarOpen(true);
  }

  async function callAI(prompt, ctxText) {
    setAiPanel(a => ({ ...a, open: true, loading: true, answer: "", question: prompt }));
    const pageText = pages[currentPage - 1]?.content || "";
    const ctx = ctxText || (selectedText ? `Selected: "${selectedText}"\n\nPage: ${pageText}` : `Page content:\n${pageText}`);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, system: `You are Homelander, an expert medical study AI. The student is reading "${doc?.name}". Answer concisely with clinical precision. Use bullet points for lists. Under 300 words unless a complex topic demands more.`, messages: [{ role: "user", content: `${ctx}\n\nQuestion: ${prompt}` }] })
      });
      const data = await res.json();
      setAiPanel(a => ({ ...a, loading: false, answer: data.content?.[0]?.text || "No response." }));
    } catch { setAiPanel(a => ({ ...a, loading: false, answer: "Connection error. Please try again." })); }
  }

  function renderPageContent(page) {
    if (!page) return null;
    if (page.isImage) return <div className="flex items-center justify-center p-8"><img src={page.src} alt="Document" className="max-w-full rounded-lg shadow-sm" style={{ maxHeight: "80vh" }} /></div>;
    let html = page.content;
    html = html.replace(/^(#{1,3})\s+(.+)$/gm, (_, h, t) => `<div style="font-size:${h.length === 1 ? "2em" : h.length === 2 ? "1.5em" : "1.2em"};font-weight:700;margin:1.2em 0 0.4em;line-height:1.3">${t}</div>`);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/^[-•]\s+(.+)$/gm, "<li style='margin:0.25em 0;padding-left:0.5em'>$1</li>");
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul style='padding-left:1.5em;margin:0.5em 0'>${m}</ul>`);
    html = html.replace(/\n\n/g, "</p><p style='margin:0.8em 0'>").replace(/\n/g, "<br/>");
    html = `<p style='margin:0.8em 0'>${html}</p>`;
    highlights.filter(hl => hl.pageNum === page.pageNum).forEach(hl => {
      const col = HL_COLORS.find(c => c.key === hl.color);
      if (col) { const esc = hl.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); html = html.replace(new RegExp(esc, "g"), `<mark style="background:${col.bg};color:inherit;border-radius:3px;padding:0 2px">${hl.text}</mark>`); }
    });
    return <div dangerouslySetInnerHTML={{ __html: html }} style={{ fontFamily: fontFamily === "serif" ? "Georgia,serif" : fontFamily === "mono" ? "monospace" : "system-ui,sans-serif", fontSize, lineHeight: 1.8, color: T.text }} />;
  }

  const totalPages = pages.length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: T.toolbar }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 flex-wrap" style={{ background: T.toolbar, borderColor: T.border }}>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 transition opacity-70 hover:opacity-100"><Icon path={I.close} size={16} /></button>
        <div className="w-px h-5 bg-current opacity-10" />
        <Icon path={doc?.type?.startsWith("image/") ? I.image : I.file} size={16} className="opacity-50 shrink-0" />
        <span className="text-sm font-semibold truncate opacity-90 flex-1 min-w-0 max-w-xs" style={{ color: T.text }}>{doc?.name}</span>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setShowSearch(s => !s)} className="p-1.5 rounded-lg hover:bg-black/10 transition opacity-70 hover:opacity-100" title="Search"><Icon path={I.search} size={15} /></button>
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 rounded-lg hover:bg-black/10 transition opacity-70 hover:opacity-100"><Icon path={I.zoom_out} size={15} /></button>
          <span className="text-xs font-mono opacity-60 w-10 text-center" style={{ color: T.text }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 rounded-lg hover:bg-black/10 transition opacity-70 hover:opacity-100"><Icon path={I.zoom_in} size={15} /></button>
          <div className="w-px h-5 bg-current opacity-10 mx-1" />
          <button onClick={() => setFontSize(f => Math.max(12, f - 1))} className="p-1.5 rounded-lg hover:bg-black/10 transition opacity-70 hover:opacity-100 text-xs font-bold" style={{ color: T.text }}>A-</button>
          <button onClick={() => setFontSize(f => Math.min(24, f + 1))} className="p-1.5 rounded-lg hover:bg-black/10 transition opacity-70 hover:opacity-100 text-sm font-bold" style={{ color: T.text }}>A+</button>
          <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="text-xs rounded-lg px-2 py-1 bg-black/5 hover:bg-black/10 focus:outline-none border-0 cursor-pointer" style={{ color: T.text }}>
            <option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option>
          </select>
          <div className="w-px h-5 bg-current opacity-10 mx-1" />
          {Object.keys(THEMES).map(t => <button key={t} onClick={() => setTheme(t)} className="w-5 h-5 rounded-full transition-transform" style={{ background: THEMES[t].bg, border: theme === t ? "2px solid #6366f1" : "2px solid transparent", transform: theme === t ? "scale(1.2)" : "scale(1)" }} title={t} />)}
          <div className="w-px h-5 bg-current opacity-10 mx-1" />
          <button onClick={() => setAiPanel(a => ({ ...a, open: !a.open }))} className={cn("px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1", aiPanel.open ? "bg-indigo-600 text-white" : "hover:bg-black/10 opacity-70 hover:opacity-100")} style={!aiPanel.open ? { color: T.text } : {}}>
            <div className="w-3.5 h-3.5 rounded-full bg-current/20 flex items-center justify-center text-[8px] font-bold">H</div>AI
          </button>
          <button onClick={() => setAttachModal(true)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1">
            <Icon path={I.link} size={12} />Attach
          </button>
          <div className="w-px h-5 bg-current opacity-10 mx-1" />
          <button onClick={() => setSidebarOpen(s => !s)} className="p-1.5 rounded-lg hover:bg-black/10 transition opacity-70 hover:opacity-100"><Icon path={I.sidebar_l} size={15} /></button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="relative flex items-center gap-2 px-4 py-2 border-b" style={{ background: T.bg, borderColor: T.border }}>
          <Icon path={I.search} size={14} className="opacity-40 shrink-0" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search in document…" className="flex-1 bg-transparent text-sm focus:outline-none" style={{ color: T.text }} autoFocus />
          {searchResults.length > 0 && <span className="text-xs opacity-50" style={{ color: T.text }}>{searchResults.length} found</span>}
          {searchQuery && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-56 overflow-y-auto z-10">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => { setCurrentPage(r.page); setShowSearch(false); setSearchQuery(""); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <span className="text-xs font-semibold text-indigo-600">Page {r.page}</span>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">…{r.excerpt}…</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-60 border-r flex flex-col shrink-0" style={{ background: T.toolbar, borderColor: T.border }}>
            <div className="flex border-b" style={{ borderColor: T.border }}>
              {[["toc", "📑", "Contents"], ["highlights", "🖊", "HL"], ["notes", "📝", "Notes"], ["ai", "🤖", "AI"]].map(([tab, emoji, label]) => (
                <button key={tab} onClick={() => setSidebarTab(tab)} className={cn("flex-1 py-2 text-[10px] font-semibold transition", sidebarTab === tab ? "border-b-2 border-indigo-500 opacity-100" : "opacity-40 hover:opacity-70")} style={{ color: T.text }}>
                  <div>{emoji}</div><div>{label}</div>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sidebarTab === "toc" && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-wider mb-2" style={{ color: T.text }}>Contents</p>
                  {tocItems.length === 0 && <p className="text-xs opacity-30" style={{ color: T.text }}>No headings detected</p>}
                  {tocItems.map((item, i) => (
                    <button key={i} onClick={() => setCurrentPage(item.page)} className="w-full text-left py-1 rounded-lg text-xs hover:bg-black/10 transition" style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px`, color: currentPage === item.page ? "#6366f1" : T.text, fontWeight: currentPage === item.page ? 700 : 400 }}>
                      {item.title}
                    </button>
                  ))}
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-wider mb-2 mt-4" style={{ color: T.text }}>Pages ({totalPages})</p>
                  {pages.map((p, i) => (
                    <button key={i} onClick={() => setCurrentPage(p.pageNum)} className={cn("w-full text-left px-2 py-1.5 rounded-lg text-xs transition flex items-center gap-2", currentPage === p.pageNum ? "bg-indigo-500 text-white" : "hover:bg-black/10 opacity-60")} style={{ color: currentPage === p.pageNum ? "#fff" : T.text }}>
                      <span className="font-mono shrink-0">P{p.pageNum}</span>
                      <span className="truncate">{p.content.slice(0, 35)}…</span>
                    </button>
                  ))}
                </div>
              )}
              {sidebarTab === "highlights" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-wider mb-2" style={{ color: T.text }}>Highlights ({highlights.length})</p>
                  {highlights.length === 0 && <p className="text-xs opacity-30" style={{ color: T.text }}>Select text to highlight</p>}
                  {highlights.map(hl => { const col = HL_COLORS.find(c => c.key === hl.color); return (<div key={hl.id} className="rounded-xl p-2.5 text-xs" style={{ background: col?.bg || "#fef08a", color: "#1e293b" }}><div className="flex items-start justify-between gap-1"><p className="font-medium leading-relaxed">"{hl.text}"</p><button onClick={() => setHighlights(h => h.filter(x => x.id !== hl.id))} className="shrink-0 opacity-50 hover:opacity-100"><Icon path={I.close} size={12} /></button></div><p className="opacity-50 mt-1 text-[10px]">Page {hl.pageNum}</p><button onClick={() => setCurrentPage(hl.pageNum)} className="mt-1 text-indigo-600 text-[10px] font-semibold hover:underline">Go →</button></div>); })}
                </div>
              )}
              {sidebarTab === "notes" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-wider mb-2" style={{ color: T.text }}>Notes ({notes.length})</p>
                  <button onClick={() => setNoteModal(true)} className="w-full py-2 text-xs rounded-xl border border-dashed opacity-50 hover:opacity-100 transition flex items-center justify-center gap-1" style={{ borderColor: T.border, color: T.text }}><Icon path={I.plus} size={12} /> Add note (pg {currentPage})</button>
                  {notes.map(n => (<div key={n.id} className="rounded-xl p-2.5 border text-xs" style={{ background: T.bg, borderColor: T.border, color: T.text }}>{n.selection && <p className="opacity-40 italic mb-1 truncate">"{n.selection}"</p>}<p>{n.text}</p><div className="flex items-center justify-between mt-1"><span className="opacity-30 text-[10px]">P{n.pageNum}</span><button onClick={() => setNotes(prev => prev.filter(x => x.id !== n.id))} className="opacity-30 hover:opacity-100"><Icon path={I.trash} size={11} /></button></div></div>))}
                </div>
              )}
              {sidebarTab === "ai" && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-wider" style={{ color: T.text }}>Ask Homelander</p>
                  <div className="flex flex-wrap gap-1">
                    {["Summarise page", "Explain terms", "Main points", "Clinical relevance"].map(q => (
                      <button key={q} onClick={() => callAI(q)} className="text-[10px] px-2 py-1 rounded-full border hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition" style={{ borderColor: T.border, color: T.text }}>{q}</button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input value={aiPanel.question} onChange={e => setAiPanel(a => ({ ...a, question: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") callAI(aiPanel.question); }} placeholder="Ask anything…" className="flex-1 text-xs px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500" style={{ background: T.bg, borderColor: T.border, color: T.text }} />
                    <button onClick={() => callAI(aiPanel.question)} className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"><Icon path={I.send} size={12} /></button>
                  </div>
                  {aiPanel.loading && <div className="flex gap-1 p-3">{[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>}
                  {aiPanel.answer && <div className="rounded-xl p-3 text-xs leading-relaxed border" style={{ background: T.bg, borderColor: T.border, color: T.text }}><p className="font-bold text-indigo-600 mb-1 text-[10px] uppercase tracking-wide">Homelander</p><div dangerouslySetInnerHTML={{ __html: aiPanel.answer.replace(/\n/g, "<br/>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} /></div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reading area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: T.bg }}>
          {/* Highlight toolbar */}
          <div className="flex items-center gap-1 px-4 py-1.5 border-b flex-wrap" style={{ background: T.toolbar, borderColor: T.border }}>
            <span className="text-[10px] font-semibold opacity-40 mr-1" style={{ color: T.text }}>Highlight:</span>
            {HL_COLORS.map(c => <button key={c.key} onClick={() => setActiveColor(c.key)} className="w-5 h-5 rounded-full transition-transform" style={{ background: c.bg, border: activeColor === c.key ? `2px solid ${c.dark}` : "2px solid transparent", transform: activeColor === c.key ? "scale(1.25)" : "scale(1)" }} title={c.key} />)}
            <div className="w-px h-4 bg-current opacity-10 mx-2" />
            <button onClick={() => callAI("Simplify this text", selectedText || pages[currentPage - 1]?.content?.slice(0, 1000))} className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-indigo-50 transition flex items-center gap-1" style={{ borderColor: T.border, color: T.text }}><Icon path={I.magic} size={11} />Simplify</button>
            {selectedText && <>
              <button onClick={() => addHighlight(activeColor)} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition">Highlight</button>
              <button onClick={() => callAI(`Define: "${selectedText}"`, `Term to define: "${selectedText}"`)} className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-indigo-50 transition" style={{ borderColor: T.border, color: T.text }}>Define</button>
              <button onClick={() => callAI(`Explain this: "${selectedText}"`, `Explain in plain English: "${selectedText}"\n\nContext: ${pages[currentPage - 1]?.content?.slice(0, 500)}`)} className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-indigo-50 transition" style={{ borderColor: T.border, color: T.text }}>Explain</button>
              <button onClick={() => setNoteModal(true)} className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-indigo-50 transition" style={{ borderColor: T.border, color: T.text }}>Note</button>
              <button onClick={() => { navigator.clipboard?.writeText(selectedText); setContextMenu(null); }} className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-indigo-50 transition" style={{ borderColor: T.border, color: T.text }}>Copy</button>
            </>}
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto" ref={readerRef} onMouseUp={handleTextSelection}>
            <div className="max-w-3xl mx-auto py-10 px-6 sm:px-10" style={{ zoom: `${zoom}%` }}>
              <div className="flex items-center gap-3 mb-8">
                <div className="h-px flex-1 opacity-10" style={{ background: T.text }} />
                <span className="text-xs font-mono opacity-30" style={{ color: T.text }}>Page {currentPage} of {totalPages}</span>
                <div className="h-px flex-1 opacity-10" style={{ background: T.text }} />
              </div>
              <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ background: T.paper, borderColor: T.border }}>
                <div className="p-8 sm:p-12 min-h-[60vh]">{renderPageContent(pages[currentPage - 1])}</div>
              </div>
              <div className="h-16" />
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ background: T.toolbar, borderColor: T.border }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-black/10 transition disabled:opacity-30" style={{ color: T.text }}><Icon path={I.chevron_l} size={16} />Prev</button>
            <div className="flex items-center gap-3">
              {totalPages <= 10 && totalPages > 1 && <div className="flex gap-1">{pages.map((_, i) => <button key={i} onClick={() => setCurrentPage(i + 1)} className="rounded-full transition-all" style={{ width: currentPage === i + 1 ? 20 : 8, height: 8, background: currentPage === i + 1 ? "#6366f1" : T.border }} />)}</div>}
              {totalPages > 10 && <div className="flex items-center gap-2"><input type="number" value={currentPage} min={1} max={totalPages} onChange={e => setCurrentPage(Math.min(totalPages, Math.max(1, parseInt(e.target.value) || 1)))} className="w-14 text-center text-sm rounded-xl border px-2 py-1 focus:outline-none" style={{ background: T.bg, borderColor: T.border, color: T.text }} /><span className="text-xs opacity-40" style={{ color: T.text }}>/ {totalPages}</span></div>}
              <div className="w-24 h-1.5 rounded-full" style={{ background: T.border }}>
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
              </div>
              <span className="text-xs opacity-30" style={{ color: T.text }}>{Math.round((currentPage / totalPages) * 100)}%</span>
            </div>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-black/10 transition disabled:opacity-30" style={{ color: T.text }}>Next<Icon path={I.chevron_r} size={16} /></button>
          </div>
        </div>

        {/* AI side panel */}
        {aiPanel.open && sidebarTab !== "ai" && (
          <div className="w-72 border-l flex flex-col" style={{ background: T.toolbar, borderColor: T.border }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">H</div>
                <span className="text-sm font-bold" style={{ color: T.text }}>Homelander</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <button onClick={() => setAiPanel(a => ({ ...a, open: false }))} className="opacity-40 hover:opacity-100 transition"><Icon path={I.close} size={15} style={{ color: T.text }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="flex flex-wrap gap-1">
                {["Summarise this page", "Key clinical points", "Explain this section", "Make flashcards"].map(q => <button key={q} onClick={() => callAI(q)} className="text-[10px] px-2 py-1 rounded-full border hover:border-indigo-400 transition" style={{ borderColor: T.border, color: T.text }}>{q}</button>)}
              </div>
              {aiPanel.loading && <div className="p-4 rounded-xl border" style={{ background: T.bg, borderColor: T.border }}><div className="flex gap-1">{[0, 150, 300].map(d => <div key={d} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div></div>}
              {aiPanel.answer && <div className="rounded-xl p-4 border" style={{ background: T.bg, borderColor: T.border }}><p className="text-[10px] font-bold text-indigo-600 mb-2 uppercase tracking-wide">Homelander says:</p><p className="text-xs leading-relaxed" style={{ color: T.text }} dangerouslySetInnerHTML={{ __html: aiPanel.answer.replace(/\n/g, "<br/>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} /></div>}
            </div>
            <div className="p-3 border-t" style={{ borderColor: T.border }}>
              <div className="flex gap-2">
                <input value={aiPanel.question} onChange={e => setAiPanel(a => ({ ...a, question: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") callAI(aiPanel.question); }} placeholder="Ask about this document…" className="flex-1 text-xs px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ background: T.bg, borderColor: T.border, color: T.text }} />
                <button onClick={() => callAI(aiPanel.question)} className="px-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"><Icon path={I.send} size={13} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating context menu */}
      {contextMenu && selectedText && (
        <div className="fixed z-[70] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 flex gap-1" style={{ top: contextMenu.y - 60, left: Math.min(contextMenu.x - 100, window.innerWidth - 260) }}>
          {HL_COLORS.map(c => <button key={c.key} onClick={() => addHighlight(c.key)} className="w-7 h-7 rounded-full border-2 border-transparent hover:scale-125 transition-transform" style={{ background: c.bg }} />)}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1 self-center" />
          <button onClick={() => callAI(`Define: "${selectedText}"`, `Term: "${selectedText}"`)} className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">Define</button>
          <button onClick={() => callAI(`Explain: "${selectedText}"`)} className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">Explain</button>
          <button onClick={() => setNoteModal(true)} className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">Note</button>
          <button onClick={() => { setContextMenu(null); setSelectedText(""); window.getSelection()?.removeAllRanges(); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"><Icon path={I.close} size={12} /></button>
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3">Add Note — Page {currentPage}</h3>
            {selectedText && <p className="text-xs text-slate-500 italic mb-3 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg line-clamp-2">"{selectedText}"</p>}
            <Textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Your note…" rows={4} />
            <div className="flex gap-2 mt-3"><Button variant="secondary" onClick={() => { setNoteModal(false); setNoteInput(""); }} className="flex-1">Cancel</Button><Button onClick={addNote} className="flex-1" disabled={!noteInput.trim()}>Save Note</Button></div>
          </div>
        </div>
      )}

      {/* Attach to topic modal */}
      {attachModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Attach to Topic</h3>
            <p className="text-sm text-slate-500 mb-4">Link this document to a topic for tracking</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {topics.map(t => { const sub = subjects.find(s => s.id === t.subjectId); return (<button key={t.id} onClick={() => { onAttachToTopic(doc.id, t.id, t.title, pages.length); setAttachModal(false); }} className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition"><p className="font-semibold text-sm">{t.title}</p>{sub && <p className="text-xs text-slate-500 mt-0.5">{sub.name}</p>}</button>); })}
              {topics.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No topics yet. Add topics first.</p>}
            </div>
            <Button variant="secondary" onClick={() => setAttachModal(false)} className="w-full mt-3">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Forms ────────────────────────────────────────────────────────────────────
const COLORS = ["#6366f1","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16"];

function SubjectForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: "", courseCode: "", semester: "", session: "2025/2026", color: "#6366f1", description: "", notes: "" });
  function submit(e) { e.preventDefault(); if (!form.name.trim()) return; onSave({ ...form, id: initial?.id || uid() }); }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Subject name" className="sm:col-span-2"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Community Medicine" required /></FormField>
        <FormField label="Course code"><Input value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })} placeholder="COM 405" /></FormField>
        <FormField label="Session"><Input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} placeholder="2025/2026" /></FormField>
        <FormField label="Semester" className="sm:col-span-2"><Select value={form.semester} onChange={v => setForm({ ...form, semester: v })}><option value="">— Select —</option><option value="First Semester">First Semester</option><option value="Second Semester">Second Semester</option><option value="Full Year">Full Year</option></Select></FormField>
        <FormField label="Colour" className="sm:col-span-2"><div className="flex flex-wrap gap-2 mt-1">{COLORS.map(c => <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className="w-8 h-8 rounded-full border-2 transition-all" style={{ background: c, borderColor: form.color === c ? "#1e293b" : c, transform: form.color === c ? "scale(1.2)" : "scale(1)" }} />)}</div></FormField>
        <FormField label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief overview" rows={2} /></FormField>
        <FormField label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Study strategy, exam tips…" rows={2} /></FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save subject</Button></div>
    </form>
  );
}

function TopicForm({ subjects, initial, documents, onSave, onClose }) {
  const [form, setForm] = useState(initial || { title: "", subjectId: subjects[0]?.id || "", lecturerName: "", lectureDate: todayISO(), status: "not_started", priority: "medium", notes: "", summary: "", tags: "", documentId: "" });
  const fileRef = useRef();
  const [newDocFile, setNewDocFile] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.subjectId) return;
    onSave({ ...form, id: initial?.id || uid(), tags: (typeof form.tags === "string" ? form.tags.split(",") : form.tags || []).map(t => t.trim()).filter(Boolean), newDocFile });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Topic title" className="sm:col-span-2"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Introduction to Epidemiology" required /></FormField>
        <FormField label="Subject"><Select value={form.subjectId} onChange={v => setForm({ ...form, subjectId: v })}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormField>
        <FormField label="Lecturer"><Input value={form.lecturerName} onChange={e => setForm({ ...form, lecturerName: e.target.value })} placeholder="Dr. Okoro" /></FormField>
        <FormField label="Lecture date"><Input type="date" value={form.lectureDate} onChange={e => setForm({ ...form, lectureDate: e.target.value })} /></FormField>
        <FormField label="Priority"><Select value={form.priority} onChange={v => setForm({ ...form, priority: v })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></FormField>
        <FormField label="Status"><Select value={form.status} onChange={v => setForm({ ...form, status: v })}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></Select></FormField>
        <FormField label="Tags (comma-separated)" className="sm:col-span-2"><Input value={typeof form.tags === "string" ? form.tags : (form.tags || []).join(", ")} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="revision, important, exam" /></FormField>
        <div className="sm:col-span-2">
          <Label>Attach Document <span className="text-xs text-slate-400 font-normal ml-1">(pages auto-detected)</span></Label>
          <div className="mt-2 space-y-2">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:border-indigo-400 transition" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".txt,.md,.text,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setNewDocFile(f); }} />
              {newDocFile ? (<div className="flex items-center gap-3"><Icon path={I.file} size={18} className="text-indigo-600 shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{newDocFile.name}</p><p className="text-xs text-emerald-600 font-medium">✓ Ready — pages auto-detected on save</p></div><button type="button" onClick={e => { e.stopPropagation(); setNewDocFile(null); }} className="text-slate-400 hover:text-red-500"><Icon path={I.close} size={14} /></button></div>) : (<div className="flex items-center gap-3 text-slate-500"><Icon path={I.upload} size={18} className="shrink-0" /><div><p className="text-sm font-medium">Upload document for this topic</p><p className="text-xs">TXT, MD, or images</p></div></div>)}
            </div>
            {documents.filter(d => !d.topicId || d.topicId === initial?.id).length > 0 && (
              <div><p className="text-xs text-slate-500 mb-1.5">Or link existing document:</p><Select value={form.documentId || "none"} onChange={v => setForm({ ...form, documentId: v === "none" ? "" : v })}><option value="none">— None —</option>{documents.filter(d => !d.topicId || d.topicId === initial?.id).map(d => <option key={d.id} value={d.id}>{d.name} ({d.pageCount}p)</option>)}</Select></div>
            )}
          </div>
        </div>
        <FormField label="Summary" className="sm:col-span-2"><Textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Key takeaways…" /></FormField>
        <FormField label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Areas to revisit…" /></FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save topic</Button></div>
    </form>
  );
}

function AssignmentForm({ subjects, topics, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { title: "", subjectId: "", topicId: "", lecturerName: "", dateGiven: todayISO(), dueDate: "", priority: "medium", notes: "", isSubmitted: false });
  const subjectTopics = topics.filter(t => !form.subjectId || t.subjectId === form.subjectId);
  function submit(e) { e.preventDefault(); if (!form.title.trim() || !form.dueDate) return; onSave({ ...form, id: initial?.id || uid(), status: form.isSubmitted ? "submitted" : (form.dueDate < todayISO() ? "overdue" : "pending"), updatedAt: new Date().toISOString(), createdAt: initial?.createdAt || new Date().toISOString() }); }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Title" className="sm:col-span-2"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Case presentation write-up" required /></FormField>
        <FormField label="Subject"><Select value={form.subjectId || "none"} onChange={v => setForm({ ...form, subjectId: v === "none" ? "" : v, topicId: "" })}><option value="none">— Optional —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormField>
        <FormField label="Related topic"><Select value={form.topicId || "none"} onChange={v => setForm({ ...form, topicId: v === "none" ? "" : v })}><option value="none">— Optional —</option>{subjectTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></FormField>
        <FormField label="Lecturer"><Input value={form.lecturerName} onChange={e => setForm({ ...form, lecturerName: e.target.value })} placeholder="Dr. Amina" /></FormField>
        <FormField label="Priority"><Select value={form.priority} onChange={v => setForm({ ...form, priority: v })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></FormField>
        <FormField label="Date given"><Input type="date" value={form.dateGiven} onChange={e => setForm({ ...form, dateGiven: e.target.value })} /></FormField>
        <FormField label="Due date"><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required /></FormField>
        <FormField label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Submission details…" /></FormField>
        <div className="sm:col-span-2 flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <input id="submitted" type="checkbox" checked={form.isSubmitted} onChange={e => setForm({ ...form, isSubmitted: e.target.checked })} className="w-4 h-4 rounded accent-indigo-600" />
          <label htmlFor="submitted" className="text-sm font-medium cursor-pointer">Mark as submitted</label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save assignment</Button></div>
    </form>
  );
}

function ExamForm({ subjects, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: "", subjectId: "", date: "", time: "09:00", venue: "", notes: "", type: "exam" });
  function submit(e) { e.preventDefault(); if (!form.name.trim() || !form.date) return; onSave({ ...form, id: initial?.id || uid() }); }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" className="sm:col-span-2"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Community Medicine Final" required /></FormField>
        <FormField label="Subject"><Select value={form.subjectId || "none"} onChange={v => setForm({ ...form, subjectId: v === "none" ? "" : v })}><option value="none">— Optional —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormField>
        <FormField label="Type"><Select value={form.type} onChange={v => setForm({ ...form, type: v })}><option value="exam">Exam</option><option value="test">Test / CA</option><option value="quiz">Quiz</option><option value="practical">Practical</option><option value="viva">Viva / Oral</option></Select></FormField>
        <FormField label="Date"><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></FormField>
        <FormField label="Time"><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></FormField>
        <FormField label="Venue" className="sm:col-span-2"><Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="Main Exam Hall" /></FormField>
        <FormField label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Topics to focus on…" rows={2} /></FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save exam</Button></div>
    </form>
  );
}

// ─── Exam Countdown ───────────────────────────────────────────────────────────
function ExamCountdown({ exams, subjects, onAdd, onEdit, onDelete }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  function cd(d, t) { const target = new Date(`${d}T${t || "09:00"}:00`); const diff = target - now; if (diff <= 0) return null; return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), mins: Math.floor((diff % 3600000) / 60000), secs: Math.floor((diff % 60000) / 1000) }; }
  const sorted = [...exams].sort((a, b) => new Date(`${a.date}T${a.time || "09:00"}`) - new Date(`${b.date}T${b.time || "09:00"}`));
  const upcoming = sorted.filter(e => new Date(`${e.date}T${e.time || "09:00"}`) > now);
  const past = sorted.filter(e => new Date(`${e.date}T${e.time || "09:00"}`) <= now);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">Exam Countdown</h2><p className="text-sm text-slate-500 mt-0.5">Stay ahead of every test.</p></div><Button onClick={onAdd}><Icon path={I.plus} size={15} />Add exam</Button></div>
      {upcoming.length === 0 && past.length === 0 && <EmptyState icon={<Icon path={I.exam} size={28} />} title="No exams yet" description="Add your upcoming tests and exams." action={<Button onClick={onAdd}><Icon path={I.plus} size={15} />Add exam</Button>} />}
      {upcoming.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{upcoming.map(exam => { const c = cd(exam.date, exam.time); const sub = subjects.find(s => s.id === exam.subjectId); const urg = c && c.days < 3 ? "danger" : c && c.days < 7 ? "warning" : "info"; const urgBg = c && c.days < 3 ? "from-red-50 to-red-100/50 dark:from-red-950/40 dark:to-red-900/20 border-red-200 dark:border-red-900" : c && c.days < 7 ? "from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200 dark:border-amber-900" : "from-indigo-50 to-blue-50/50 dark:from-indigo-950/40 dark:to-blue-900/20 border-indigo-200 dark:border-indigo-900"; return (<div key={exam.id} className={`rounded-2xl border bg-gradient-to-br ${urgBg} p-5 relative overflow-hidden`}>{c && c.days < 3 && <div className="absolute top-3 right-3"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" /></span></div>}<div className="flex items-start justify-between gap-2 mb-3"><div className="min-w-0"><h3 className="font-bold truncate">{exam.name}</h3>{sub && <div className="flex items-center gap-1.5 mt-0.5"><div className="w-2 h-2 rounded-full" style={{ background: sub.color }} /><span className="text-xs text-slate-500">{sub.name}</span></div>}</div><Badge variant={urg}>{c ? `${c.days}d` : "Done"}</Badge></div>{c ? <div className="grid grid-cols-4 gap-2 my-4">{[{ v: c.days, l: "days" }, { v: c.hours, l: "hrs" }, { v: c.mins, l: "min" }, { v: c.secs, l: "sec" }].map(({ v, l }) => <div key={l} className="bg-white/60 dark:bg-slate-900/60 rounded-xl p-2 text-center"><div className="text-xl font-bold tabular-nums">{String(v).padStart(2, "0")}</div><div className="text-[10px] text-slate-500 mt-0.5 uppercase">{l}</div></div>)}</div> : <div className="my-4 text-center text-slate-500 text-sm">Passed</div>}<div className="flex items-center justify-between text-xs text-slate-500"><span>{fmtDate(exam.date)}{exam.time ? ` · ${exam.time}` : ""}</span>{exam.venue && <span className="truncate ml-2">📍 {exam.venue}</span>}</div>{exam.notes && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-lg px-2.5 py-1.5 line-clamp-2">{exam.notes}</p>}<div className="flex gap-2 mt-3 pt-3 border-t border-white/40 dark:border-slate-800/60"><button onClick={() => onEdit(exam)} className="flex-1 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 flex items-center justify-center gap-1 py-1 rounded-lg hover:bg-white/60 transition"><Icon path={I.edit} size={12} />Edit</button><button onClick={() => onDelete(exam.id)} className="flex-1 text-xs text-slate-600 dark:text-slate-400 hover:text-red-600 flex items-center justify-center gap-1 py-1 rounded-lg hover:bg-white/60 transition"><Icon path={I.trash} size={12} />Delete</button></div></div>); })}</div>}
      {past.length > 0 && <div><h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Past Exams</h3><div className="space-y-2">{[...past].reverse().map(exam => { const sub = subjects.find(s => s.id === exam.subjectId); return <div key={exam.id} className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-70"><Icon path={I.check} size={16} className="text-emerald-500 shrink-0" /><div className="flex-1 min-w-0"><span className="font-medium text-sm">{exam.name}</span>{sub && <span className="text-xs text-slate-400 ml-2">· {sub.name}</span>}</div><span className="text-xs text-slate-400">{fmtDate(exam.date)}</span><button onClick={() => onDelete(exam.id)} className="text-slate-400 hover:text-red-500 ml-2"><Icon path={I.trash} size={14} /></button></div>; })}</div></div>}
    </div>
  );
}

// ─── MCQ Page ─────────────────────────────────────────────────────────────────
function MCQPage({ subjects, topics, documents, mcqSessions, onSaveSession }) {
  const [view, setView] = useState("home");
  const [genForm, setGenForm] = useState({ subjectId: "", topicId: "", documentId: "", numQuestions: 20, docText: "" });
  const [generating, setGenerating] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [quizState, setQuizState] = useState({ current: 0, answers: [], chosen: [], finished: false });

  const subjectTopics = topics.filter(t => !genForm.subjectId || t.subjectId === genForm.subjectId);

  async function generate() {
    const topic = topics.find(t => t.id === genForm.topicId);
    const subject = subjects.find(s => s.id === genForm.subjectId);
    const doc = documents.find(d => d.id === genForm.documentId);
    const ctx = genForm.docText || doc?.content || `${topic?.title || ""}\n${topic?.summary || ""}\n${topic?.notes || ""}`;
    if (!ctx.trim()) { alert("Please provide content — paste text, select a document, or pick a topic with notes."); return; }
    setGenerating(true);
    const n = Math.min(60, Math.max(5, Number(genForm.numQuestions) || 20));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8000, system: `Generate exactly ${n} MBBS-standard MCQs. Return ONLY valid JSON: {"questions":[{"q":"...","opts":["A","B","C","D"],"ans":0,"exp":"..."}]}. "ans" is 0-based. No preamble, no markdown.`, messages: [{ role: "user", content: `Subject: ${subject?.name || "General"}\nTopic: ${topic?.title || doc?.name || "Study Material"}\n\nContent:\n${ctx.slice(0, 8000)}\n\nGenerate ${n} MCQs.` }] })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let parsed;
      try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error("Parse failed"); }
      const questions = parsed.questions || [];
      if (!questions.length) throw new Error("No questions returned");
      const session = { id: uid(), subjectId: genForm.subjectId, topicId: genForm.topicId, subjectName: subject?.name || "General", topicName: topic?.title || doc?.name || "Custom", questions, numQuestions: questions.length, createdAt: new Date().toISOString(), score: null, completed: false };
      setCurrentSession(session);
      setQuizState({ current: 0, answers: new Array(questions.length).fill(null), chosen: new Array(questions.length).fill(null), finished: false });
      setView("quiz");
    } catch (err) { alert("Generation failed: " + err.message); }
    finally { setGenerating(false); }
  }

  function answer(i) {
    if (quizState.answers[quizState.current] !== null) return;
    const correct = i === currentSession.questions[quizState.current].ans;
    setQuizState(q => ({ ...q, answers: q.answers.map((a, idx) => idx === q.current ? correct : a), chosen: q.chosen.map((c, idx) => idx === q.current ? i : c) }));
  }

  function nextQ() {
    if (quizState.current < currentSession.questions.length - 1) { setQuizState(q => ({ ...q, current: q.current + 1 })); return; }
    const score = quizState.answers.filter(a => a === true).length;
    const s = { ...currentSession, score, completed: true, completedAt: new Date().toISOString() };
    setCurrentSession(s); onSaveSession(s); setView("result");
  }

  if (view === "home") return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-extrabold">MCQ Generator</h2><p className="text-sm text-slate-500">AI-powered practice from your materials</p></div><Button onClick={() => setView("generate")}><Icon path={I.sparkle} size={14} />Generate MCQs</Button></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center cursor-pointer hover:shadow-md transition" onClick={() => setView("generate")}><div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3"><Icon path={I.sparkle} size={22} className="text-indigo-600" /></div><h3 className="font-bold">Generate New</h3><p className="text-xs text-slate-500 mt-1">From documents, topics, or pasted notes</p></Card>
        <Card className="p-5 text-center cursor-pointer hover:shadow-md transition" onClick={() => setView("history")}><div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3"><Icon path={I.list} size={22} className="text-emerald-600" /></div><h3 className="font-bold">History</h3><p className="text-xs text-slate-500 mt-1">{mcqSessions.length} session{mcqSessions.length !== 1 ? "s" : ""} completed</p></Card>
        <Card className="p-5 text-center"><div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3"><Icon path={I.trophy} size={22} className="text-amber-600" /></div><h3 className="font-bold">Best Score</h3><p className="text-xs text-slate-500 mt-1">{mcqSessions.length > 0 ? `${Math.max(...mcqSessions.map(s => s.score !== null ? Math.round((s.score / s.numQuestions) * 100) : 0))}% all-time` : "No sessions yet"}</p></Card>
      </div>
      {mcqSessions.length > 0 && <Card className="p-5"><h3 className="font-bold mb-4">Recent Sessions</h3><div className="space-y-2">{[...mcqSessions].reverse().slice(0, 5).map(s => { const pct = s.score !== null ? Math.round((s.score / s.numQuestions) * 100) : null; return <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"><div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0"><Icon path={I.mcq} size={15} className="text-indigo-600" /></div><div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{s.topicName}</p><p className="text-xs text-slate-500">{s.subjectName} · {s.numQuestions}q · {fmtDate(s.createdAt)}</p></div>{pct !== null && <Badge variant={pct >= 70 ? "success" : pct >= 50 ? "warning" : "danger"}>{pct}%</Badge>}</div>; })}</div></Card>}
    </div>
  );

  if (view === "generate") return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><button onClick={() => setView("home")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500"><Icon path={I.chevron_l} size={18} /></button><div><h2 className="text-2xl font-extrabold">Generate MCQs</h2><p className="text-sm text-slate-500">AI crafts exam-quality questions from your material</p></div></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Icon path={I.upload} size={16} className="text-indigo-500" />Content Source</h3>
          <FormField label="From Document Library"><Select value={genForm.documentId || "none"} onChange={v => setGenForm(f => ({ ...f, documentId: v === "none" ? "" : v }))}><option value="none">— Select a document —</option>{documents.map(d => <option key={d.id} value={d.id}>{d.name} ({d.pageCount}p)</option>)}</Select></FormField>
          <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700" /></div><div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-slate-900 px-2 text-slate-400">or paste directly</span></div></div>
          <Textarea value={genForm.docText} onChange={e => setGenForm(f => ({ ...f, docText: e.target.value }))} placeholder="Paste lecture notes or any study content here…" rows={8} />
        </Card>
        <Card className="p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Icon path={I.settings} size={16} className="text-indigo-500" />Configuration</h3>
          <FormField label="Subject (optional)"><Select value={genForm.subjectId || "none"} onChange={v => setGenForm(f => ({ ...f, subjectId: v === "none" ? "" : v, topicId: "" }))}><option value="none">— Any —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormField>
          <FormField label="Topic (uses notes if no document)"><Select value={genForm.topicId || "none"} onChange={v => setGenForm(f => ({ ...f, topicId: v === "none" ? "" : v }))}><option value="none">— Any —</option>{subjectTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</Select></FormField>
          <FormField label={`Number of questions: ${genForm.numQuestions}`}><input type="range" min="5" max="60" step="5" value={genForm.numQuestions} onChange={e => setGenForm(f => ({ ...f, numQuestions: Number(e.target.value) }))} className="w-full accent-indigo-600" /><div className="flex justify-between text-xs text-slate-400 mt-1"><span>5</span><span>30</span><span>60</span></div></FormField>
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800"><p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">✨ {genForm.numQuestions} MBBS-standard MCQs with 4 options, correct answers & explanations</p></div>
          <Button onClick={generate} disabled={generating} className="w-full" size="lg">{generating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</> : <><Icon path={I.sparkle} size={16} />Generate {genForm.numQuestions} MCQs</>}</Button>
        </Card>
      </div>
    </div>
  );

  if (view === "quiz" && currentSession) {
    const q = currentSession.questions[quizState.current];
    const isAnswered = quizState.answers[quizState.current] !== null;
    const answered = quizState.answers.filter(a => a !== null).length;
    const labels = ["A", "B", "C", "D"];
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center gap-3"><button onClick={() => { if (window.confirm("Exit quiz?")) setView("home"); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500"><Icon path={I.close} size={18} /></button><div className="flex-1"><h2 className="font-extrabold">{currentSession.topicName}</h2><p className="text-xs text-slate-500">{currentSession.subjectName} · {currentSession.numQuestions}q</p></div><Badge variant="info">{answered}/{currentSession.questions.length}</Badge></div>
        <ProgressBar value={(answered / currentSession.questions.length) * 100} color="#6366f1" height={6} />
        <div className="flex flex-wrap gap-1.5">{currentSession.questions.map((_, i) => <button key={i} onClick={() => setQuizState(q => ({ ...q, current: i }))} className={cn("w-7 h-7 rounded-lg text-xs font-bold transition-all", i === quizState.current ? "bg-indigo-600 text-white scale-110" : quizState.answers[i] === true ? "bg-emerald-500 text-white" : quizState.answers[i] === false ? "bg-red-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>{i + 1}</button>)}</div>
        <Card className="p-6">
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Question {quizState.current + 1} of {currentSession.questions.length}</div>
          <p className="text-base font-semibold leading-relaxed mb-5">{q.q}</p>
          <div className="space-y-3">{q.opts.map((opt, i) => { let cls = "border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"; if (isAnswered) { if (i === q.ans) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"; else if (i === quizState.chosen[quizState.current]) cls = "border-red-500 bg-red-50 dark:bg-red-950/30"; else cls = "border-slate-200 dark:border-slate-700 opacity-50"; } return <button key={i} onClick={() => answer(i)} disabled={isAnswered} className={cn("w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left", cls)}><span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", isAnswered && i === q.ans ? "bg-emerald-500 text-white" : isAnswered && i === quizState.chosen[quizState.current] ? "bg-red-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600")}>{labels[i]}</span><span className="text-sm leading-relaxed">{opt}</span></button>; })}</div>
          {isAnswered && <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"><p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">💡 Explanation</p><p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">{q.exp}</p></div>}
        </Card>
        <div className="flex gap-3 justify-between">
          <Button variant="secondary" onClick={() => setQuizState(q => ({ ...q, current: Math.max(0, q.current - 1) }))} disabled={quizState.current === 0}><Icon path={I.chevron_l} size={14} />Previous</Button>
          <div className="text-center"><p className="text-xs text-slate-500">Score so far</p><p className="font-bold">{quizState.answers.filter(a => a === true).length}/{answered}</p></div>
          <Button onClick={nextQ} disabled={!isAnswered}>{quizState.current === currentSession.questions.length - 1 ? "Finish" : "Next"}<Icon path={I.chevron_r} size={14} /></Button>
        </div>
      </div>
    );
  }

  if (view === "result" && currentSession) {
    const finalScore = quizState.answers.filter(a => a === true).length;
    const pct = Math.round((finalScore / currentSession.questions.length) * 100);
    const grade = pct >= 70 ? "Pass" : pct >= 50 ? "Borderline" : "Refer";
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <Card className="p-8 text-center">
          <div className="text-6xl font-extrabold mb-2" style={{ background: pct >= 70 ? "linear-gradient(135deg,#10b981,#059669)" : pct >= 50 ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#ef4444,#dc2626)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{pct}%</div>
          <p className="text-xl font-bold mb-1">{grade}</p>
          <p className="text-slate-500 text-sm">{finalScore} correct out of {currentSession.questions.length}</p>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3"><p className="text-2xl font-bold text-emerald-600">{finalScore}</p><p className="text-xs text-emerald-700 dark:text-emerald-400">Correct</p></div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3"><p className="text-2xl font-bold text-red-600">{currentSession.questions.length - finalScore}</p><p className="text-xs text-red-700 dark:text-red-400">Wrong</p></div>
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-3"><p className="text-2xl font-bold text-indigo-600">{currentSession.questions.length}</p><p className="text-xs text-indigo-700 dark:text-indigo-400">Total</p></div>
          </div>
          <div className="flex gap-3 mt-6 justify-center"><Button variant="secondary" onClick={() => setView("generate")}>New Quiz</Button><Button onClick={() => setView("home")}>Back to MCQ</Button></div>
        </Card>
        <Card className="p-5"><h3 className="font-bold mb-4">Wrong Answers Review</h3>{quizState.answers.every(a => a === true) ? <p className="text-sm text-emerald-600 text-center py-4">🎉 Perfect score!</p> : <div className="space-y-4">{currentSession.questions.map((q, i) => quizState.answers[i] === false && <div key={i} className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"><p className="text-xs font-bold text-red-500 mb-1">Q{i + 1}</p><p className="text-sm font-semibold mb-2">{q.q}</p><p className="text-xs text-red-600">You chose: {q.opts[quizState.chosen[i]]}</p><p className="text-xs text-emerald-600">Correct: {q.opts[q.ans]}</p><p className="text-xs text-slate-500 mt-1">{q.exp}</p></div>)}</div>}</Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><button onClick={() => setView("home")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500"><Icon path={I.chevron_l} size={18} /></button><div><h2 className="text-2xl font-extrabold">MCQ History</h2><p className="text-sm text-slate-500">{mcqSessions.length} sessions</p></div></div>
      {mcqSessions.length === 0 ? <EmptyState icon={<Icon path={I.mcq} size={28} />} title="No sessions yet" action={<Button onClick={() => setView("generate")}><Icon path={I.sparkle} size={14} />Generate MCQs</Button>} /> : <div className="grid gap-3 sm:grid-cols-2">{[...mcqSessions].reverse().map(s => { const pct = s.score !== null ? Math.round((s.score / s.numQuestions) * 100) : null; return <Card key={s.id} className="p-5 hover:shadow-md transition"><div className="flex items-start justify-between gap-2 mb-3"><div><h3 className="font-bold truncate">{s.topicName}</h3><p className="text-xs text-slate-500">{s.subjectName}</p></div>{pct !== null && <Badge variant={pct >= 70 ? "success" : pct >= 50 ? "warning" : "danger"}>{pct}%</Badge>}</div><div className="flex justify-between text-xs text-slate-500 mb-2"><span>{s.numQuestions}q</span><span>{fmtDate(s.createdAt)}</span></div>{pct !== null && <ProgressBar value={pct} color={pct >= 70 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"} />}</Card>; })}</div>}
    </div>
  );
}

// ─── Homelander Chat ──────────────────────────────────────────────────────────
function HomelanderChat({ data, subjects, topics, assignments, exams, stats, documents, onClose }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hey! I'm **Homelander** — your personal study companion. 💪\n\nI have full context of your ReadTrack data — subjects, topics, documents, exams, assignments. Ask me anything. What's on your mind?", time: new Date().toISOString() }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef();
  const inputRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const QUICK = ["How am I doing?", "What should I study next?", "I have an exam coming", "Quiz me on my topics", "I'm overwhelmed", "Summarise my progress"];

  function buildSystem() {
    const upcomingExams = exams.filter(e => new Date(`${e.date}T${e.time || "09:00"}`) > new Date()).map(e => { const sub = subjects.find(s => s.id === e.subjectId); const days = Math.floor((new Date(`${e.date}T${e.time || "09:00"}`) - new Date()) / 86400000); return `${e.name} (${sub?.name || "?"}) — ${days}d on ${fmtDate(e.date)}`; });
    const pending = assignments.filter(a => a.status !== "submitted").map(a => { const sub = subjects.find(s => s.id === a.subjectId); return `${a.title} (${sub?.name || "?"}) due ${fmtDate(a.dueDate)} [${a.status}]`; });
    const subSummary = subjects.map(s => { const st = topics.filter(t => t.subjectId === s.id); return `${s.name}: ${st.filter(t => t.isCompleted).length}/${st.length} topics done`; });
    return `You are Homelander, an elite AI study companion for medical students in ReadTrack. You are confident, warm, direct, deeply knowledgeable in medicine and all MBBS subjects, genuinely supportive. Student: ${data.profile.name}. Subjects: ${subSummary.join("; ") || "None"}. Total topics: ${stats.totalTopics}, Completed: ${stats.completedTopics}. Upcoming exams: ${upcomingExams.join("; ") || "None"}. Pending assignments: ${pending.join("; ") || "None"}. Documents: ${documents.length}. Be specific with their data. Use markdown. Keep under 350 words unless explaining complex medical content.`;
  }

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg, time: new Date().toISOString() }]);
    setLoading(true);
    try {
      const history = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: buildSystem(), messages: [...history, { role: "user", content: msg }] }) });
      const result = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: result.content?.[0]?.text || "Sorry, I had trouble responding.", time: new Date().toISOString() }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Connection issue. Please try again.", time: new Date().toISOString() }]); }
    finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }

  function renderMsg(content) { return content.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\n/g, "<br/>").replace(/^- (.+)/gm, "• $1"); }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 lg:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col" style={{ height: "85vh", maxHeight: 700 }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-violet-600 rounded-t-2xl">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-extrabold text-sm">H</div>
          <div className="flex-1"><p className="font-bold text-white text-sm">Homelander</p><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><p className="text-xs text-indigo-200">Your AI Study Companion</p></div></div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10"><Icon path={I.close} size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (<div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>{m.role === "assistant" && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">H</div>}<div className={cn("max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed", m.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm")} dangerouslySetInnerHTML={{ __html: renderMsg(m.content) }} /></div>))}
          {loading && <div className="flex gap-2.5 justify-start"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">H</div><div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">{[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div></div>}
          <div ref={endRef} />
        </div>
        {messages.length <= 2 && <div className="px-4 pb-2"><div className="flex flex-wrap gap-1.5">{QUICK.map((p, i) => <button key={i} onClick={() => send(p)} className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition">{p}</button>)}</div></div>}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex gap-2 items-end">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything about your studies…" rows={1} className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" style={{ minHeight: 36, maxHeight: 100 }} />
            <button onClick={() => send()} disabled={loading || !input.trim()} className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center text-white transition shrink-0"><Icon path={I.send} size={15} /></button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">Shift+Enter for new line · Powered by Claude</p>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function AnalyticsPage({ topics, subjects, assignments, stats, subjectProgress }) {
  const [timeFilter, setTimeFilter] = useState("14d");
  const TIME_FILTERS = [{ key: "1d", label: "Today" }, { key: "7d", label: "7 Days" }, { key: "14d", label: "14 Days" }, { key: "30d", label: "30 Days" }, { key: "90d", label: "3 Months" }, { key: "all", label: "All Time" }];
  function getDays(f) { return { "1d": 1, "7d": 7, "14d": 14, "30d": 30, "90d": 90, "all": 365 }[f] || 14; }

  const activityData = useMemo(() => {
    const days = getDays(timeFilter);
    const map = {};
    const dateList = Array.from({ length: days }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); const k = d.toISOString().slice(0, 10); map[k] = { date: k.slice(5), topicsCompleted: 0, key: k }; return k; });
    topics.forEach(t => { const k = (t.updatedAt || t.createdAt || "").slice(0, 10); if (map[k] && t.isCompleted) map[k].topicsCompleted += 1; });
    if (days > 30) { const monthly = {}; dateList.forEach(k => { const month = k.slice(0, 7); if (!monthly[month]) monthly[month] = { date: month, topicsCompleted: 0 }; monthly[month].topicsCompleted += map[k].topicsCompleted; }); return Object.values(monthly); }
    return dateList.map(k => map[k]);
  }, [topics, timeFilter]);

  const filteredStats = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - getDays(timeFilter));
    const filtered = topics.filter(t => new Date(t.updatedAt || t.createdAt || 0) >= cutoff);
    return { completedTopics: filtered.filter(t => t.isCompleted).length };
  }, [topics, timeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-2xl font-extrabold">Analytics</h2><p className="text-sm text-slate-500 mt-0.5">Insights from your study data.</p></div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {TIME_FILTERS.map(f => <button key={f.key} onClick={() => setTimeFilter(f.key)} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", timeFilter === f.key ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>{f.label}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={`Topics (${TIME_FILTERS.find(f => f.key === timeFilter)?.label})`} value={filteredStats.completedTopics} sub="completed in period" icon={I.check} color="#10b981" bg="#ecfdf5" />
        <StatCard label="Overall Completion" value={topics.length ? `${Math.round((stats.completedTopics / stats.totalTopics) * 100)}%` : "0%"} sub={`${stats.completedTopics}/${stats.totalTopics} topics`} icon={I.chart} color="#6366f1" bg="#eef2ff" />
        <StatCard label="Assignment Rate" value={assignments.length ? `${Math.round((assignments.filter(a => a.status === "submitted").length / assignments.length) * 100)}%` : "0%"} sub="submitted on time" icon={I.trophy} color="#f59e0b" bg="#fffbeb" />
        <StatCard label="Active Subjects" value={subjects.filter(s => topics.some(t => t.subjectId === s.id && !t.isCompleted)).length} sub={`of ${subjects.length} total`} icon={I.book} color="#8b5cf6" bg="#f5f3ff" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><div className="flex items-center justify-between mb-1"><h3 className="font-bold">Topics Completed</h3><Badge variant="default">{TIME_FILTERS.find(f => f.key === timeFilter)?.label}</Badge></div><p className="text-xs text-slate-500 mb-4">Topics finished per day</p><MiniBarChart data={activityData} valueKey="topicsCompleted" labelKey="date" color="#6366f1" /></Card>
        <Card className="p-5"><h3 className="font-bold mb-1">Assignment Status</h3><p className="text-xs text-slate-500 mb-4">Breakdown of all assignments</p>{assignments.length === 0 ? <div className="h-40 flex items-center justify-center text-sm text-slate-400">No assignments yet</div> : <PieDonut data={[{ name: "Submitted", value: assignments.filter(a => a.status === "submitted").length }, { name: "Pending", value: assignments.filter(a => a.status === "pending").length }, { name: "Overdue", value: assignments.filter(a => a.status === "overdue").length }].filter(d => d.value > 0)} />}</Card>
      </div>
      <Card className="p-5"><div className="flex items-center justify-between mb-4"><h3 className="font-bold">Subject-wise Topics</h3><Badge variant="default">All time</Badge></div><MiniBarChart data={subjectProgress.map(s => ({ name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name, value: s.completedTopics }))} valueKey="value" labelKey="name" color="#8b5cf6" /></Card>
      <Card className="p-5"><h3 className="font-bold mb-4">Per-subject breakdown</h3>{subjects.length === 0 ? <div className="text-sm text-slate-400 text-center py-8">No subjects yet</div> : <div className="space-y-5">{subjectProgress.map(s => (<div key={s.id}><div className="flex items-center gap-2 mb-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /><span className="font-semibold text-sm">{s.name}</span><span className="text-xs text-slate-400 ml-auto">{s.courseCode}</span></div><div className="flex justify-between text-xs text-slate-500 mb-1.5"><span>Topics</span><span>{s.completedTopics}/{s.totalTopics} · {s.topicPct}%</span></div><ProgressBar value={s.topicPct} color={s.color} /></div>))}</div>}</Card>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(null);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [homelanderOpen, setHomelanderOpen] = useState(false);
  const [readerDoc, setReaderDoc] = useState(null);

  const [subjectModal, setSubjectModal] = useState({ open: false, item: null });
  const [topicModal, setTopicModal] = useState({ open: false, item: null });
  const [assignmentModal, setAssignmentModal] = useState({ open: false, item: null });
  const [examModal, setExamModal] = useState({ open: false, item: null });

  const [topicSearch, setTopicSearch] = useState("");
  const [topicSubjectFilter, setTopicSubjectFilter] = useState("all");
  const [topicStatusFilter, setTopicStatusFilter] = useState("all");
  const [topicPriorityFilter, setTopicPriorityFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  const encouragement = useMemo(() => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)], []);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const migrated = runMigration(DEFAULT_DATA);
    setData(migrated);
    if (migrated._migratedFrom) setShowMigrationBanner(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !data) return;
    persist(data);
  }, [data, mounted]);

  useEffect(() => {
    if (!mounted || !data) return;
    const root = document.documentElement;
    root.classList.remove("dark");
    if (data.profile.theme === "dark") root.classList.add("dark");
    if (data.profile.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
  }, [data?.profile?.theme, mounted]);

  const patch = useCallback(fn => setData(prev => ({ ...prev, ...fn(prev) })), []);

  if (!mounted || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto">
            <Icon path={I.book} size={22} className="text-white" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading ReadTrack…</p>
        </div>
      </div>
    );
  }

  const subjects = data.subjects || [];
  const topics = data.topics || [];
  const exams = data.exams || [];
  const mcqSessions = data.mcqSessions || [];
  const documents = data.documents || [];

  const assignments = useMemo(() => {
    const today = todayISO();
    return (data.assignments || []).map(a => ({ ...a, status: a.isSubmitted ? "submitted" : (a.dueDate && a.dueDate < today ? "overdue" : "pending") }));
  }, [data.assignments]);

  const subjectProgress = useMemo(() => subjects.map(s => {
    const st = topics.filter(t => t.subjectId === s.id);
    const completedTopics = st.filter(t => t.isCompleted).length;
    return { ...s, totalTopics: st.length, completedTopics, topicPct: st.length ? Math.round((completedTopics / st.length) * 100) : 0 };
  }), [subjects, topics]);

  const stats = useMemo(() => ({
    totalSubjects: subjects.length,
    totalTopics: topics.length,
    completedTopics: topics.filter(t => t.isCompleted).length,
    activeAssignments: assignments.filter(a => a.status === "pending").length,
    overdueAssignments: assignments.filter(a => a.status === "overdue").length,
    upcomingExams: exams.filter(e => new Date(`${e.date}T${e.time || "09:00"}`) > new Date()).length,
    mcqSessions: mcqSessions.length,
    documents: documents.length,
  }), [subjects, topics, assignments, exams, mcqSessions, documents]);

  const filteredTopics = useMemo(() => topics.filter(t => {
    const sub = subjects.find(s => s.id === t.subjectId);
    const hay = `${t.title} ${t.lecturerName || ""} ${sub?.name || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
    return hay.includes(topicSearch.toLowerCase()) && (topicSubjectFilter === "all" || t.subjectId === topicSubjectFilter) && (topicStatusFilter === "all" || t.status === topicStatusFilter) && (topicPriorityFilter === "all" || t.priority === topicPriorityFilter);
  }), [topics, subjects, topicSearch, topicSubjectFilter, topicStatusFilter, topicPriorityFilter]);

  const filteredAssignments = useMemo(() => assignmentFilter === "all" ? assignments : assignments.filter(a => a.status === assignmentFilter), [assignments, assignmentFilter]);

  const activityData = useMemo(() => {
    const map = {};
    const last14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); const k = d.toISOString().slice(0, 10); map[k] = { date: k.slice(5), topicsCompleted: 0 }; return k; });
    topics.forEach(t => { const k = (t.updatedAt || t.createdAt || "").slice(0, 10); if (map[k] && t.isCompleted) map[k].topicsCompleted += 1; });
    return last14.map(k => map[k]);
  }, [topics]);

  const calendarEvents = useMemo(() => {
    const events = [
      ...topics.filter(t => t.lectureDate).map(t => ({ id: t.id, type: "Lecture", title: t.title, date: t.lectureDate, sub: subjects.find(s => s.id === t.subjectId)?.name || "", color: subjects.find(s => s.id === t.subjectId)?.color || "#6366f1" })),
      ...assignments.filter(a => a.dueDate).map(a => ({ id: a.id, type: "Assignment", title: a.title, date: a.dueDate, sub: a.status, color: a.status === "overdue" ? "#ef4444" : "#f59e0b" })),
      ...exams.filter(e => e.date).map(e => ({ id: e.id, type: "Exam", title: e.name, date: e.date, sub: e.venue || "", color: "#8b5cf6" })),
    ];
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [topics, assignments, exams, subjects]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  function saveSubject(form) {
    patch(prev => { const now = new Date().toISOString(); const exists = prev.subjects.find(s => s.id === form.id); return { subjects: exists ? prev.subjects.map(s => s.id === form.id ? { ...s, ...form, updatedAt: now } : s) : [{ ...form, createdAt: now, updatedAt: now }, ...prev.subjects] }; });
    setSubjectModal({ open: false, item: null });
  }

  async function saveTopic(form) {
    const { newDocFile, ...topicData } = form;
    let docId = topicData.documentId || "";
    let docPages = 0;
    if (newDocFile) {
      await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = evt => {
          const isImage = newDocFile.type.startsWith("image/");
          const content = isImage ? "" : evt.target.result;
          const dataUrl = isImage ? evt.target.result : null;
          const pages = isImage ? 1 : parseDocIntoPages(content, newDocFile.name).length;
          docPages = pages;
          const newDoc = { id: uid(), name: newDocFile.name, size: newDocFile.size, type: newDocFile.type, content, dataUrl, pageCount: pages, uploadedAt: new Date().toISOString(), topicId: null, topicTitle: topicData.title };
          docId = newDoc.id;
          patch(prev => ({ documents: [newDoc, ...(prev.documents || [])] }));
          resolve();
        };
        if (newDocFile.type.startsWith("image/")) reader.readAsDataURL(newDocFile);
        else reader.readAsText(newDocFile);
      });
    } else if (docId) {
      const existingDoc = documents.find(d => d.id === docId);
      docPages = existingDoc?.pageCount || 0;
    }
    const finalTopic = { ...topicData, documentId: docId, docPageCount: docPages, updatedAt: new Date().toISOString(), createdAt: topicData.createdAt || new Date().toISOString(), isCompleted: topicData.status === "completed" };
    patch(prev => {
      const exists = prev.topics.find(t => t.id === finalTopic.id);
      const newTopics = exists ? prev.topics.map(t => t.id === finalTopic.id ? { ...t, ...finalTopic } : t) : [finalTopic, ...prev.topics];
      const newDocs = docId ? (prev.documents || []).map(d => d.id === docId ? { ...d, topicId: finalTopic.id, topicTitle: finalTopic.title } : d) : prev.documents || [];
      return { topics: newTopics, documents: newDocs };
    });
    setTopicModal({ open: false, item: null });
  }

  function saveAssignment(form) {
    patch(prev => { const exists = prev.assignments.find(a => a.id === form.id); return { assignments: exists ? prev.assignments.map(a => a.id === form.id ? { ...a, ...form } : a) : [form, ...prev.assignments] }; });
    setAssignmentModal({ open: false, item: null });
  }
  function saveExam(form) {
    patch(prev => { const exists = (prev.exams || []).find(e => e.id === form.id); return { exams: exists ? prev.exams.map(e => e.id === form.id ? { ...e, ...form } : e) : [form, ...(prev.exams || [])] }; });
    setExamModal({ open: false, item: null });
  }
  function saveMCQSession(session) {
    patch(prev => { const exists = (prev.mcqSessions || []).find(s => s.id === session.id); return { mcqSessions: exists ? (prev.mcqSessions || []).map(s => s.id === session.id ? session : s) : [...(prev.mcqSessions || []), session] }; });
  }
  function uploadDocument(doc) { patch(prev => ({ documents: [doc, ...(prev.documents || [])] })); }
  function deleteDocument(id) { patch(prev => ({ documents: (prev.documents || []).filter(d => d.id !== id), topics: prev.topics.map(t => t.documentId === id ? { ...t, documentId: "" } : t) })); }
  function attachDocToTopic(docId, topicId, topicTitle, pageCount) {
    patch(prev => ({ documents: (prev.documents || []).map(d => d.id === docId ? { ...d, topicId, topicTitle } : d), topics: prev.topics.map(t => t.id === topicId ? { ...t, documentId: docId, docPageCount: pageCount } : t) }));
  }
  function toggleTopic(id) { patch(prev => ({ topics: prev.topics.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted, status: !t.isCompleted ? "completed" : "in_progress", updatedAt: new Date().toISOString() } : t) })); }
  function toggleAssignment(id) { patch(prev => ({ assignments: prev.assignments.map(a => a.id === id ? { ...a, isSubmitted: !a.isSubmitted, updatedAt: new Date().toISOString() } : a) })); }
  function deleteItem(key, id) { patch(prev => ({ [key]: prev[key].filter(x => x.id !== id) })); }

  function handleFileUploadForDocs(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = evt => {
        const isImage = file.type.startsWith("image/");
        const content = isImage ? "" : evt.target.result;
        const dataUrl = isImage ? evt.target.result : null;
        const pages = isImage ? 1 : parseDocIntoPages(content, file.name).length;
        uploadDocument({ id: uid(), name: file.name, size: file.size, type: file.type, content, dataUrl, pageCount: pages, uploadedAt: new Date().toISOString(), topicId: null, topicTitle: null });
      };
      if (file.type.startsWith("image/")) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
  }

  function exportCSV() {
    const rows = ["=== SUBJECTS ===", ["Name", "Code", "Semester", "Topics"].join(","), ...subjectProgress.map(s => [s.name, s.courseCode, s.semester, `${s.completedTopics}/${s.totalTopics}`].join(",")), "", "=== TOPICS ===", ["Title", "Subject", "Lecturer", "Date", "Status", "Priority"].join(","), ...topics.map(t => { const s = subjects.find(x => x.id === t.subjectId); return [t.title, s?.name || "", t.lecturerName || "", t.lectureDate || "", t.status, t.priority].join(","); }), "", "=== MCQ SESSIONS ===", ["Topic", "Subject", "Questions", "Score", "Date"].join(","), ...mcqSessions.map(s => [s.topicName, s.subjectName, s.numQuestions, s.score !== null ? `${Math.round((s.score / s.numQuestions) * 100)}%` : "n/a", fmtDate(s.createdAt)].join(","))].join("\n");
    const blob = new Blob([rows], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `readtrack-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function resetAll() {
    if (!window.confirm("Delete ALL data? This cannot be undone.")) return;
    const fresh = { ...DEFAULT_DATA, subjects: makeDefaultSubjects() };
    setData(fresh); persist(fresh);
  }

  const NAV = [
    { key: "dashboard",   label: "Dashboard",      icon: I.dashboard },
    { key: "subjects",    label: "Subjects",        icon: I.book },
    { key: "topics",      label: "Topics",          icon: I.list },
    { key: "documents",   label: "Documents",       icon: I.reader, badge: documents.length > 0 ? String(documents.length) : null },
    { key: "assignments", label: "Assignments",     icon: I.clip },
    { key: "exams",       label: "Exam Countdown",  icon: I.exam },
    { key: "mcq",         label: "MCQ Generator",   icon: I.mcq, badge: "AI" },
    { key: "calendar",    label: "Calendar",        icon: I.calendar },
    { key: "analytics",   label: "Analytics",       icon: I.chart },
    { key: "settings",    label: "Settings",        icon: I.settings },
  ];

  const docFileRef = useRef();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="flex h-screen overflow-hidden">
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* SIDEBAR */}
        <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"><Icon path={I.book} size={15} className="text-white" /></div>
              <span className="font-extrabold text-sm tracking-tight">ReadTrack</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600"><Icon path={I.close} size={18} /></button>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
            {NAV.map(({ key, label, icon, badge }) => {
              const active = page === key;
              return (
                <button key={key} onClick={() => { setPage(key); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"}`}>
                  <Icon path={icon} size={15} />
                  <span className="flex-1 text-left">{label}</span>
                  {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20 text-white" : key === "mcq" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"}`}>{badge}</span>}
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button onClick={() => { setHomelanderOpen(true); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 transition shadow-sm">
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">H</div>
              <span className="flex-1 text-left">Homelander AI</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">Chat</span>
            </button>
            <button onClick={() => patch(prev => ({ profile: { ...prev.profile, theme: prev.profile.theme === "dark" ? "light" : prev.profile.theme === "light" ? "system" : "dark" } }))} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
              <Icon path={data.profile.theme === "dark" ? I.sun : I.moon} size={15} /><span className="capitalize">{data.profile.theme} mode</span>
            </button>
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{(data.profile.name || "S")[0].toUpperCase()}</div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{data.profile.name}</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 lg:px-6 shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><Icon path={I.menu} size={20} /></button>
            <div className="hidden lg:flex items-center gap-2 text-sm"><span className="font-semibold text-slate-900 dark:text-slate-100">{NAV.find(n => n.key === page)?.label}</span></div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => setHomelanderOpen(true)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-semibold hover:from-indigo-600 hover:to-violet-600 transition shadow-sm">
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">H</div>Ask Homelander
              </button>
              <Button variant="ghost" size="sm" onClick={exportCSV}><Icon path={I.download} size={14} /><span className="hidden sm:inline">Export</span></Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 lg:p-6">

              {/* DASHBOARD */}
              {page === "dashboard" && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
                    <h1 className="text-2xl font-extrabold">{getGreeting(data.profile.name)}</h1>
                    <p className="mt-1 text-indigo-200 text-sm">{encouragement}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0" onClick={() => setTopicModal({ open: true, item: null })}><Icon path={I.plus} size={14} />Add Topic</Button>
                      <Button variant="ghost" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0" onClick={() => setPage("documents")}><Icon path={I.reader} size={14} />Open Reader</Button>
                      <Button variant="ghost" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0" onClick={() => setPage("mcq")}><Icon path={I.sparkle} size={14} />Generate MCQs</Button>
                      <Button variant="ghost" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0" onClick={() => setHomelanderOpen(true)}><div className="w-3.5 h-3.5 rounded-full bg-white/30 flex items-center justify-center text-[8px] font-bold">H</div>Homelander</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard label="Subjects" value={stats.totalSubjects} icon={I.book} color="#6366f1" bg="#eef2ff" />
                    <StatCard label="Topics Done" value={`${stats.completedTopics}/${stats.totalTopics}`} sub="completed" icon={I.check} color="#10b981" bg="#ecfdf5" />
                    <StatCard label="Documents" value={stats.documents} sub="in library" icon={I.reader} color="#3b82f6" bg="#eff6ff" />
                    <StatCard label="Assignments" value={stats.activeAssignments} sub={stats.overdueAssignments > 0 ? `${stats.overdueAssignments} overdue` : "on track"} icon={I.clip} color={stats.overdueAssignments > 0 ? "#ef4444" : "#f59e0b"} bg={stats.overdueAssignments > 0 ? "#fef2f2" : "#fffbeb"} />
                    <StatCard label="MCQ Sessions" value={stats.mcqSessions} sub="practice quizzes" icon={I.mcq} color="#8b5cf6" bg="#f5f3ff" />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-2 p-5">
                      <h3 className="font-bold mb-1">Topics completed — last 14 days</h3>
                      <p className="text-xs text-slate-500 mb-4">Daily study activity</p>
                      <MiniBarChart data={activityData} valueKey="topicsCompleted" labelKey="date" color="#6366f1" />
                    </Card>
                    <Card className="p-5">
                      <h3 className="font-bold mb-3">Next exam</h3>
                      {(() => {
                        const now = new Date();
                        const next = [...exams].filter(e => new Date(`${e.date}T${e.time || "09:00"}`) > now).sort((a, b) => new Date(`${a.date}T${a.time || "09:00"}`) - new Date(`${b.date}T${b.time || "09:00"}`))[0];
                        if (!next) return <div className="text-sm text-slate-400 text-center py-6">No upcoming exams.<br /><button className="text-indigo-600 underline mt-1" onClick={() => { setPage("exams"); setExamModal({ open: true, item: null }); }}>Add one</button></div>;
                        const sub = subjects.find(s => s.id === next.subjectId);
                        const diff = new Date(`${next.date}T${next.time || "09:00"}`) - now;
                        const days = Math.floor(diff / 86400000);
                        return (<div className="cursor-pointer" onClick={() => setPage("exams")}><div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40"><p className="font-bold">{next.name}</p>{sub && <div className="flex items-center gap-1.5 mt-1"><div className="w-2 h-2 rounded-full" style={{ background: sub.color }} /><span className="text-xs text-slate-500">{sub.name}</span></div>}<div className="mt-3 grid grid-cols-3 gap-1.5">{[{ v: days, l: "days" }, { v: Math.floor((diff % 86400000) / 3600000), l: "hrs" }, { v: Math.floor((diff % 3600000) / 60000), l: "min" }].map(({ v, l }) => <div key={l} className="bg-white dark:bg-slate-900 rounded-lg p-2 text-center"><div className="text-lg font-extrabold text-indigo-600 tabular-nums">{v}</div><div className="text-[10px] text-slate-500 uppercase">{l}</div></div>)}</div><p className="text-xs text-slate-500 mt-2">{fmtDate(next.date)}</p></div></div>);
                      })()}
                    </Card>
                  </div>
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Subject progress</h3><button className="text-xs text-indigo-600 font-semibold hover:underline" onClick={() => setPage("subjects")}>View all →</button></div>
                    {subjects.length === 0 ? <EmptyState title="No subjects" description="Add a subject to start tracking." action={<Button onClick={() => setSubjectModal({ open: true, item: null })}><Icon path={I.plus} size={14} />Add subject</Button>} /> : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {subjectProgress.map(s => (<div key={s.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-sm transition"><div className="flex items-center gap-2 mb-3"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} /><span className="font-semibold text-sm truncate">{s.name}</span><Badge variant={s.topicPct === 100 ? "success" : s.topicPct > 50 ? "info" : "default"} className="ml-auto shrink-0">{s.topicPct}%</Badge></div><div className="flex justify-between text-xs text-slate-500 mb-1"><span>Topics</span><span>{s.completedTopics}/{s.totalTopics}</span></div><ProgressBar value={s.topicPct} color={s.color} /></div>))}
                      </div>
                    )}
                  </Card>
                  {documents.length > 0 && (
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-4"><h3 className="font-bold">Recent Documents</h3><button className="text-xs text-indigo-600 font-semibold hover:underline" onClick={() => setPage("documents")}>View all →</button></div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {documents.slice(0, 3).map(doc => (<div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition" onClick={() => setReaderDoc(doc)}><div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0", doc.type?.startsWith("image/") ? "bg-pink-500" : "bg-indigo-600")}><Icon path={doc.type?.startsWith("image/") ? I.image : I.file} size={14} /></div><div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{doc.name}</p><p className="text-[10px] text-slate-500">{doc.pageCount}p</p></div><Icon path={I.reader} size={14} className="text-indigo-400 shrink-0" /></div>))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* SUBJECTS */}
              {page === "subjects" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between"><div><h2 className="text-2xl font-extrabold">Subjects</h2><p className="text-sm text-slate-500 mt-0.5">{subjects.length} course{subjects.length !== 1 ? "s" : ""}</p></div><Button onClick={() => setSubjectModal({ open: true, item: null })}><Icon path={I.plus} size={14} />Add subject</Button></div>
                  {subjects.length === 0 ? <EmptyState icon={<Icon path={I.book} size={28} />} title="No subjects yet" action={<Button onClick={() => setSubjectModal({ open: true, item: null })}><Icon path={I.plus} size={14} />Add subject</Button>} /> : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {subjectProgress.map(s => (<Card key={s.id} className="p-5 hover:shadow-md transition-shadow"><div className="flex items-start gap-3 mb-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.color + "22" }}><div className="w-4 h-4 rounded-full" style={{ background: s.color }} /></div><div className="flex-1 min-w-0"><h3 className="font-extrabold truncate">{s.name}</h3><p className="text-xs text-slate-500">{s.courseCode || "No code"} · {s.semester || "No semester"}</p></div><Badge variant={s.topicPct === 100 ? "success" : "default"}>{s.topicPct}%</Badge></div>{s.description && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{s.description}</p>}<div className="mb-4"><div className="flex justify-between text-xs text-slate-500 mb-1.5"><span>Topics</span><span>{s.completedTopics}/{s.totalTopics}</span></div><ProgressBar value={s.topicPct} color={s.color} /></div><div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"><Button variant="secondary" size="sm" className="flex-1" onClick={() => setSubjectModal({ open: true, item: s })}><Icon path={I.edit} size={12} />Edit</Button><Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => deleteItem("subjects", s.id)}><Icon path={I.trash} size={12} /></Button></div></Card>))}
                    </div>
                  )}
                </div>
              )}

              {/* TOPICS */}
              {page === "topics" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between"><div><h2 className="text-2xl font-extrabold">Topics</h2><p className="text-sm text-slate-500 mt-0.5">{filteredTopics.length} of {topics.length} shown</p></div><Button onClick={() => setTopicModal({ open: true, item: null })} disabled={subjects.length === 0}><Icon path={I.plus} size={14} />Add topic</Button></div>
                  <Card className="p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="relative sm:col-span-2 lg:col-span-1"><Icon path={I.search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={topicSearch} onChange={e => setTopicSearch(e.target.value)} placeholder="Search topics…" className="pl-8" /></div><Select value={topicSubjectFilter} onChange={setTopicSubjectFilter}><option value="all">All subjects</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select value={topicStatusFilter} onChange={setTopicStatusFilter}><option value="all">All status</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></Select><Select value={topicPriorityFilter} onChange={setTopicPriorityFilter}><option value="all">All priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select></div></Card>
                  {subjects.length === 0 ? <EmptyState icon={<Icon path={I.book} size={28} />} title="Add a subject first" action={<Button onClick={() => setPage("subjects")}><Icon path={I.book} size={14} />Go to Subjects</Button>} /> : filteredTopics.length === 0 ? <EmptyState icon={<Icon path={I.list} size={28} />} title="No topics found" action={<Button onClick={() => setTopicModal({ open: true, item: null })}><Icon path={I.plus} size={14} />Add topic</Button>} /> : (
                    <div className="space-y-2">
                      {filteredTopics.map(t => {
                        const sub = subjects.find(s => s.id === t.subjectId);
                        const doc = documents.find(d => d.id === t.documentId);
                        return (
                          <Card key={t.id} className={`p-4 hover:shadow-sm transition-all ${t.isCompleted ? "opacity-70" : ""}`}>
                            <div className="flex items-start gap-3">
                              <button onClick={() => toggleTopic(t.id)} className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${t.isCompleted ? "bg-emerald-500 border-emerald-500" : "border-slate-300 dark:border-slate-600 hover:border-emerald-400"}`}>{t.isCompleted && <Icon path={I.check} size={10} className="text-white" strokeWidth={3} />}</button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2 flex-wrap">
                                  <h3 className={`font-semibold text-sm ${t.isCompleted ? "line-through text-slate-400 dark:text-slate-600" : ""}`}>{t.title}</h3>
                                  <Badge variant={t.status === "completed" ? "success" : t.status === "in_progress" ? "warning" : "default"}>{t.status.replace("_", " ")}</Badge>
                                  <Badge variant={t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "default"}>{t.priority}</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                                  {sub && <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: sub.color }} />{sub.name}</span>}
                                  {t.lecturerName && <span>{t.lecturerName}</span>}
                                  {t.lectureDate && <span>{fmtDateShort(t.lectureDate)}</span>}
                                  {(t.tags || []).map(tag => <span key={tag} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full text-[10px]">{tag}</span>)}
                                </div>
                                {doc && <button onClick={() => setReaderDoc(doc)} className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"><Icon path={I.reader} size={12} />{doc.name} — {doc.pageCount}p · Open reader</button>}
                                {(t.summary || t.notes) && <div className="mt-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-1.5 line-clamp-2">{t.summary || t.notes}</div>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setTopicModal({ open: true, item: t })} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"><Icon path={I.edit} size={14} /></button>
                                <button onClick={() => deleteItem("topics", t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"><Icon path={I.trash} size={14} /></button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENTS */}
              {page === "documents" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between"><div><h2 className="text-2xl font-extrabold">Documents</h2><p className="text-sm text-slate-500 mt-0.5">{documents.length} document{documents.length !== 1 ? "s" : ""} · Full reading environment</p></div><Button onClick={() => docFileRef.current?.click()}><Icon path={I.upload} size={14} />Upload Document</Button></div>
                  <input ref={docFileRef} type="file" accept=".txt,.md,.text,image/*" multiple className="hidden" onChange={e => handleFileUploadForDocs(e.target.files)} />
                  <div onDrop={e => { e.preventDefault(); handleFileUploadForDocs(e.dataTransfer.files); }} onDragOver={e => e.preventDefault()} onClick={() => docFileRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition group">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform"><Icon path={I.upload} size={28} className="text-indigo-600" /></div>
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Drop files here or click to upload</p>
                    <p className="text-sm text-slate-400 mt-1">TXT, MD, images · Pages auto-detected</p>
                  </div>
                  {documents.length === 0 ? <EmptyState icon={<Icon path={I.reader} size={28} />} title="No documents yet" description="Upload lecture notes, images, or any study material to read in the built-in reader." /> : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {documents.map(doc => {
                        const topic = topics.find(t => t.id === doc.topicId);
                        const sub = topic ? subjects.find(s => s.id === topic.subjectId) : null;
                        const isImage = doc.type?.startsWith("image/");
                        function fmtSize(b) { if (b < 1024) return `${b}B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`; return `${(b / 1024 / 1024).toFixed(1)}MB`; }
                        return (
                          <Card key={doc.id} className="p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3 mb-3">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white", isImage ? "bg-pink-500" : "bg-indigo-600")}><Icon path={isImage ? I.image : I.file} size={18} /></div>
                              <div className="flex-1 min-w-0"><h3 className="font-bold text-sm truncate">{doc.name}</h3><p className="text-xs text-slate-500">{fmtSize(doc.size)} · {doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""} · {fmtDateShort(doc.uploadedAt)}</p></div>
                            </div>
                            {topic ? (<div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800"><div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sub?.color || "#6366f1" }} /><p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 truncate">{topic.title}</p></div>) : (<div className="mb-3"><Badge variant="default">Unattached</Badge></div>)}
                            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <Button variant="primary" size="sm" className="flex-1" onClick={() => setReaderDoc(doc)}><Icon path={I.reader} size={12} />Read</Button>
                              <button onClick={() => deleteDocument(doc.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"><Icon path={I.trash} size={14} /></button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ASSIGNMENTS */}
              {page === "assignments" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between"><div><h2 className="text-2xl font-extrabold">Assignments</h2><p className="text-sm text-slate-500 mt-0.5">{stats.overdueAssignments > 0 ? <span className="text-red-500 font-semibold">{stats.overdueAssignments} overdue!</span> : "All under control"}</p></div><div className="flex items-center gap-2"><Select value={assignmentFilter} onChange={setAssignmentFilter} className="w-36"><option value="all">All</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="overdue">Overdue</option></Select><Button onClick={() => setAssignmentModal({ open: true, item: null })}><Icon path={I.plus} size={14} />Add</Button></div></div>
                  {filteredAssignments.length === 0 ? <EmptyState icon={<Icon path={I.clip} size={28} />} title="No assignments" action={<Button onClick={() => setAssignmentModal({ open: true, item: null })}><Icon path={I.plus} size={14} />Add assignment</Button>} /> : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredAssignments.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).map(a => {
                        const sub = subjects.find(s => s.id === a.subjectId);
                        const sv = a.status === "submitted" ? "success" : a.status === "overdue" ? "danger" : "warning";
                        return (<Card key={a.id} className={`p-5 ${a.status === "overdue" ? "border-red-300 dark:border-red-900" : ""}`}><div className="flex items-start justify-between gap-2 mb-3"><div className="min-w-0"><h3 className="font-bold truncate">{a.title}</h3><div className="flex items-center gap-1.5 mt-0.5">{sub && <><div className="w-2 h-2 rounded-full" style={{ background: sub.color }} /><span className="text-xs text-slate-500">{sub.name}</span></>}</div></div><Badge variant={sv}>{a.status}</Badge></div><div className="space-y-1 text-xs text-slate-500 mb-3"><div className="flex justify-between"><span>Due</span><span className={`font-semibold ${a.status === "overdue" ? "text-red-500" : ""}`}>{fmtDate(a.dueDate)}</span></div>{a.lecturerName && <div className="flex justify-between"><span>Lecturer</span><span>{a.lecturerName}</span></div>}<div className="flex justify-between"><span>Priority</span><Badge variant={a.priority === "high" ? "danger" : a.priority === "medium" ? "warning" : "default"}>{a.priority}</Badge></div></div>{a.notes && <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-1.5 mb-3 line-clamp-2">{a.notes}</p>}<div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"><button onClick={() => toggleAssignment(a.id)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${a.isSubmitted ? "bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400"}`}><Icon path={a.isSubmitted ? I.close : I.check} size={12} />{a.isSubmitted ? "Unsubmit" : "Mark submitted"}</button><button onClick={() => setAssignmentModal({ open: true, item: a })} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition"><Icon path={I.edit} size={14} /></button><button onClick={() => deleteItem("assignments", a.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"><Icon path={I.trash} size={14} /></button></div></Card>);
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* EXAMS */}
              {page === "exams" && <ExamCountdown exams={exams} subjects={subjects} onAdd={() => setExamModal({ open: true, item: null })} onEdit={item => setExamModal({ open: true, item })} onDelete={id => deleteItem("exams", id)} />}

              {/* MCQ */}
              {page === "mcq" && <MCQPage subjects={subjects} topics={topics} documents={documents} mcqSessions={mcqSessions} onSaveSession={saveMCQSession} />}

              {/* CALENDAR */}
              {page === "calendar" && (
                <div className="space-y-5">
                  <div><h2 className="text-2xl font-extrabold">Calendar</h2><p className="text-sm text-slate-500 mt-0.5">Lectures, assignments, and exams in chronological order.</p></div>
                  {calendarEvents.length === 0 ? <EmptyState icon={<Icon path={I.calendar} size={28} />} title="Nothing on the calendar" description="Add topics, assignments, or exams to populate your calendar." /> : (
                    <div className="space-y-1">
                      {(() => { const groups = {}; calendarEvents.forEach(e => { if (!groups[e.date]) groups[e.date] = []; groups[e.date].push(e); }); return Object.entries(groups).map(([date, events]) => (<div key={date}><div className="flex items-center gap-3 py-2"><div className="text-xs font-bold text-slate-500 uppercase tracking-wider w-24 shrink-0">{fmtDate(date)}</div><div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div><div className="space-y-1.5 pl-0 sm:pl-28">{events.map(ev => <div key={`${ev.type}-${ev.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-sm transition"><div className="w-2 h-2 rounded-full shrink-0" style={{ background: ev.color }} /><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{ev.title}</p>{ev.sub && <p className="text-xs text-slate-500">{ev.sub}</p>}</div><Badge variant={ev.type === "Exam" ? "purple" : ev.type === "Assignment" ? "warning" : "default"}>{ev.type}</Badge></div>)}</div></div>)); })()}
                    </div>
                  )}
                </div>
              )}

              {/* ANALYTICS */}
              {page === "analytics" && <AnalyticsPage topics={topics} subjects={subjects} assignments={assignments} stats={stats} subjectProgress={subjectProgress} />}

              {/* SETTINGS */}
              {page === "settings" && (
                <div className="space-y-5 max-w-2xl">
                  <div><h2 className="text-2xl font-extrabold">Settings</h2><p className="text-sm text-slate-500 mt-0.5">All data saved locally. No account needed.</p></div>
                  <Card className="p-5 space-y-5">
                    <FormField label="Your name"><Input value={data.profile.name} onChange={e => patch(prev => ({ profile: { ...prev.profile, name: e.target.value } }))} placeholder="Your name" /></FormField>
                    <FormField label="Theme"><div className="flex gap-2">{["light", "dark", "system"].map(t => <button key={t} onClick={() => patch(prev => ({ profile: { ...prev.profile, theme: t } }))} className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold border-2 transition capitalize ${data.profile.theme === t ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400" : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"}`}>{t}</button>)}</div></FormField>
                  </Card>
                  {data._migratedFrom && (
                    <Card className="p-5 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                      <h3 className="font-bold text-emerald-800 dark:text-emerald-300 mb-2">✅ Data Migration</h3>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">Data was migrated from <code className="bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded">{data._migratedFrom}</code> on {fmtDate(data._migratedAt)}. Your original data is still preserved under the old key in case you need it.</p>
                    </Card>
                  )}
                  <Card className="p-5 space-y-4">
                    <h3 className="font-bold">Data</h3>
                    <Button variant="outline" onClick={exportCSV} className="w-full justify-center"><Icon path={I.download} size={14} />Export all data (CSV)</Button>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800"><p className="text-xs text-slate-500 mb-3">⚠️ Deletes everything. Cannot be undone.</p><Button variant="danger" onClick={resetAll}><Icon path={I.trash} size={14} />Reset all data</Button></div>
                  </Card>
                  <Card className="p-5"><h3 className="font-bold mb-3">About ReadTrack</h3><div className="text-sm text-slate-500 space-y-1.5"><p>📖 Full document reader — WPS-style with highlights, notes, AI explanations</p><p>🤖 MCQ Generator + Homelander AI powered by Claude</p><p>📱 Offline-first — all data in localStorage</p><p>🔄 Automatic migration from previous versions</p><p>🌙 Light / dark / system theme</p></div></Card>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>

      {/* Document Reader (fullscreen) */}
      {readerDoc && <DocumentReader document={readerDoc} onClose={() => setReaderDoc(null)} onAttachToTopic={attachDocToTopic} subjects={subjects} topics={topics} />}

      {/* Floating Homelander button */}
      {!homelanderOpen && !readerDoc && (
        <button onClick={() => setHomelanderOpen(true)} className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center" title="Chat with Homelander" style={{ animation: "slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <span className="text-lg font-extrabold">H</span>
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Homelander */}
      {homelanderOpen && <HomelanderChat data={data} subjects={subjects} topics={topics} assignments={assignments} exams={exams} stats={stats} documents={documents} onClose={() => setHomelanderOpen(false)} />}

      {/* Migration banner */}
      {showMigrationBanner && <MigrationBanner data={data} onDismiss={() => setShowMigrationBanner(false)} />}

      {/* Modals */}
      <Modal open={subjectModal.open} onClose={() => setSubjectModal({ open: false, item: null })} title={subjectModal.item ? "Edit subject" : "Add subject"}><SubjectForm initial={subjectModal.item} onSave={saveSubject} onClose={() => setSubjectModal({ open: false, item: null })} /></Modal>
      <Modal open={topicModal.open} onClose={() => setTopicModal({ open: false, item: null })} title={topicModal.item ? "Edit topic" : "Add topic"} wide><TopicForm subjects={subjects} initial={topicModal.item ? { ...topicModal.item, tags: (topicModal.item.tags || []).join(", ") } : null} documents={documents} onSave={saveTopic} onClose={() => setTopicModal({ open: false, item: null })} /></Modal>
      <Modal open={assignmentModal.open} onClose={() => setAssignmentModal({ open: false, item: null })} title={assignmentModal.item ? "Edit assignment" : "Add assignment"} wide><AssignmentForm subjects={subjects} topics={topics} initial={assignmentModal.item} onSave={saveAssignment} onClose={() => setAssignmentModal({ open: false, item: null })} /></Modal>
      <Modal open={examModal.open} onClose={() => setExamModal({ open: false, item: null })} title={examModal.item ? "Edit exam" : "Add exam"}><ExamForm subjects={subjects} initial={examModal.item} onSave={saveExam} onClose={() => setExamModal({ open: false, item: null })} /></Modal>
    </div>
  );
}
