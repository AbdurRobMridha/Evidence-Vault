import React, { useState, useMemo } from 'react';
import {
    Clock, Filter, ChevronDown, Download, Trash2, Search,
    ShieldAlert, AlertTriangle, Activity, Users, FileText,
    X, RefreshCw, CalendarRange, BarChart3, Eye, EyeOff,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { AuditEntry, AuditAction } from '../../lib/auditLog';
import {
    ACTION_LABELS, ACTION_COLORS,
    deleteAuditEntry, clearAuditLog, clearFilteredAuditLog,
    getAuditStats,
} from '../../lib/auditLog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
    entries: AuditEntry[];
    onRefresh: () => void;  // called after any mutation
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ACTIONS: AuditAction[] = [
    'case_created', 'case_updated', 'status_changed', 'priority_changed',
    'evidence_uploaded', 'evidence_verified', 'report_generated', 'case_exported',
    'case_locked', 'case_unlocked', 'case_archived', 'case_deleted',
    'investigator_assigned', 'investigator_removed',
    'emergency_release', 'emergency_override',
    'invitation_sent', 'invitation_accepted',
    'tamper_detected', 'integrity_verified', 'note_added',
    'ai_analysis_completed',
];

const DANGER_ACTIONS: AuditAction[] = [
    'case_deleted', 'tamper_detected', 'emergency_release',
    'emergency_override', 'investigator_removed',
];

const PAGE_SIZE = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateGroupLabel(ts: string): string {
    const d = new Date(ts);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
}

function getActionBadgeBg(action: AuditAction): string {
    if (DANGER_ACTIONS.includes(action)) return 'bg-red-500/10 border-red-500/20';
    if (action === 'case_created' || action === 'evidence_uploaded' || action === 'integrity_verified')
        return 'bg-emerald-500/10 border-emerald-500/20';
    if (action === 'emergency_release' || action === 'emergency_override')
        return 'bg-red-500/10 border-red-500/20';
    if (action.includes('locked') || action === 'priority_changed')
        return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-zinc-800 border-zinc-700';
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = 'text-emerald-400' }: {
    icon: React.ReactNode; label: string; value: number | string; sub?: string; color?: string;
}) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color === 'text-red-400' ? 'bg-red-500/10' : color === 'text-amber-400' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                <span className={color}>{icon}</span>
            </div>
            <div>
                <p className="text-xs text-zinc-500 font-medium">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
                {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AuditLogPanel({ entries, onRefresh }: Props) {
    // Filters
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState<AuditAction | 'all'>('all');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [filterActor, setFilterActor] = useState<string>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showDangerOnly, setShowDangerOnly] = useState(false);

    // View
    const [page, setPage] = useState(1);
    const [groupByDate, setGroupByDate] = useState(true);
    const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

    // Stats
    const stats = useMemo(() => getAuditStats(), [entries]);

    // Unique roles + actors for filter dropdowns
    const uniqueRoles = useMemo(() => [...new Set(entries.map(e => e.actorRole))].sort(), [entries]);
    const uniqueActors = useMemo(() => [...new Set(entries.map(e => e.actor))].sort(), [entries]);

    // Apply all filters
    const filtered = useMemo(() => {
        let result = entries;
        if (filterAction !== 'all') result = result.filter(e => e.action === filterAction);
        if (filterRole !== 'all') result = result.filter(e => e.actorRole === filterRole);
        if (filterActor) result = result.filter(e => e.actor === filterActor);
        if (showDangerOnly) result = result.filter(e => DANGER_ACTIONS.includes(e.action));
        if (dateFrom) {
            const from = new Date(dateFrom).getTime();
            result = result.filter(e => new Date(e.timestamp).getTime() >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo + 'T23:59:59').getTime();
            result = result.filter(e => new Date(e.timestamp).getTime() <= to);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(e =>
                e.actor.toLowerCase().includes(q) ||
                e.detail.toLowerCase().includes(q) ||
                e.caseId.toLowerCase().includes(q) ||
                ACTION_LABELS[e.action]?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [entries, filterAction, filterRole, filterActor, showDangerOnly, dateFrom, dateTo, search]);

    // Paginate
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Group by date label
    const grouped = useMemo((): Record<string, AuditEntry[]> | null => {
        if (!groupByDate) return null;
        const map: Record<string, AuditEntry[]> = {};
        paged.forEach(e => {
            const g = dateGroupLabel(e.timestamp);
            if (!map[g]) map[g] = [];
            map[g].push(e);
        });
        return map;
    }, [paged, groupByDate]);

    const resetFilters = () => {
        setSearch(''); setFilterAction('all'); setFilterRole('all');
        setFilterActor(''); setDateFrom(''); setDateTo('');
        setShowDangerOnly(false); setPage(1);
    };

    const hasActiveFilters = search || filterAction !== 'all' || filterRole !== 'all' ||
        filterActor || dateFrom || dateTo || showDangerOnly;

    // ── Mutations ──────────────────────────────────────────────────────────────

    const handleDeleteEntry = (e: React.MouseEvent, entry: AuditEntry) => {
        e.stopPropagation();
        if (!window.confirm(`Delete this audit entry?\n\n"${ACTION_LABELS[entry.action]} — ${entry.detail}"\n\nThis removes the entry from the log permanently.`)) return;
        deleteAuditEntry(entry.id);
        onRefresh();
    };

    const handleClearFiltered = () => {
        if (filtered.length === 0) return;
        const label = hasActiveFilters ? `${filtered.length} filtered entries` : `ALL ${filtered.length} entries`;
        if (!window.confirm(
            `⚠️ Permanently delete ${label} from the audit log?\n\nThis action cannot be undone and will remove the selected entries from the immutable record.`
        )) return;

        if (hasActiveFilters) {
            // Only delete the filtered subset
            const ids = new Set(filtered.map(e => e.id));
            clearFilteredAuditLog(e => ids.has(e.id));
        } else {
            clearAuditLog();
        }
        onRefresh();
        resetFilters();
    };

    // ── Exports ─────────────────────────────────────────────────────────────────

    const exportJSON = () => {
        const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); URL.revokeObjectURL(url);
    };

    const exportCSV = () => {
        const header = ['ID', 'Timestamp', 'Action', 'Actor', 'Role', 'Case ID', 'Detail'];
        const rows = filtered.map(e => [
            e.id, e.timestamp, ACTION_LABELS[e.action], e.actor, e.actorRole, e.caseId,
            `"${e.detail.replace(/"/g, '""')}"`,
        ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    // ── Render entry rows ──────────────────────────────────────────────────────

    const renderEntry = (entry: AuditEntry) => {
        const isExpanded = expandedEntry === entry.id;
        const isDanger = DANGER_ACTIONS.includes(entry.action);
        return (
            <tr
                key={entry.id}
                onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                className={`group border-b border-zinc-800/50 transition-colors cursor-pointer ${isDanger ? 'hover:bg-red-500/5' : 'hover:bg-zinc-800/30'} ${isExpanded ? (isDanger ? 'bg-red-500/5' : 'bg-zinc-800/20') : ''}`}
            >
                {/* Time */}
                <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs font-mono text-zinc-500">
                        {format(new Date(entry.timestamp), 'MMM d')}
                    </div>
                    <div className="text-xs font-mono text-zinc-600">
                        {format(new Date(entry.timestamp), 'HH:mm:ss')}
                    </div>
                </td>

                {/* Action badge */}
                <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${getActionBadgeBg(entry.action)} ${ACTION_COLORS[entry.action] || 'text-zinc-400'}`}>
                        {isDanger && <ShieldAlert className="w-2.5 h-2.5" />}
                        {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                </td>

                {/* Actor */}
                <td className="px-4 py-3">
                    <div className="text-xs text-zinc-300 font-medium truncate max-w-[140px]" title={entry.actor}>{entry.actor}</div>
                    <div className="text-xs text-zinc-600 capitalize">{entry.actorRole}</div>
                </td>

                {/* Case */}
                <td className="px-4 py-3">
                    <code className="text-xs text-zinc-500 font-mono">{entry.caseId.slice(0, 16)}{entry.caseId.length > 16 ? '…' : ''}</code>
                </td>

                {/* Detail + expand */}
                <td className="px-4 py-3 max-w-xs">
                    {isExpanded ? (
                        <div className="text-xs text-zinc-300 whitespace-pre-wrap">{entry.detail}</div>
                    ) : (
                        <div className="text-xs text-zinc-400 truncate">{entry.detail}</div>
                    )}
                </td>

                {/* ── Delete — always-visible button on every row ── */}
                <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={(e) => handleDeleteEntry(e, entry)}
                        title="Delete this audit entry"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                            bg-red-500/10 text-red-400/70 border border-red-500/20
                            hover:bg-red-500/25 hover:text-red-400 hover:border-red-500/50
                            active:scale-95 transition-all duration-150 whitespace-nowrap"
                    >
                        <Trash2 className="w-3 h-3" />
                        Delete
                    </button>
                </td>
            </tr>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">

            {/* ── Stats Row ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                <StatCard icon={<Activity className="w-4 h-4" />} label="Total Entries" value={stats.total} />
                <StatCard icon={<Clock className="w-4 h-4" />} label="Today" value={stats.today} sub="new since midnight" />
                <StatCard icon={<ShieldAlert className="w-4 h-4" />} label="Emergency Events" value={stats.emergencies} color="text-red-400" />
                <StatCard icon={<Trash2 className="w-4 h-4" />} label="Case Deletions" value={stats.deletions} color="text-amber-400" />
                <StatCard icon={<Users className="w-4 h-4" />} label="Unique Actors" value={stats.uniqueActors} />
                <StatCard icon={<FileText className="w-4 h-4" />} label="Cases Touched" value={stats.uniqueCases} />
                <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Top Actor" value={stats.topActor ? stats.topActor.split('@')[0] : '—'} sub={stats.topActor || ''} />
            </div>

            {/* ── Filter bar ────────────────────────────────────────────────── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                {/* Row 1: search + toggles */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search actor, case ID, detail…"
                            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Danger toggle */}
                    <button
                        onClick={() => { setShowDangerOnly(v => !v); setPage(1); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${showDangerOnly ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <AlertTriangle className="w-3 h-3" /> Danger Only
                    </button>

                    {/* Group by date */}
                    <button
                        onClick={() => setGroupByDate(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${groupByDate ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <CalendarRange className="w-3 h-3" /> Group by Date
                    </button>

                    {hasActiveFilters && (
                        <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                            <X className="w-3 h-3" /> Clear filters
                        </button>
                    )}

                    <span className="text-xs text-zinc-500 ml-auto">
                        {filtered.length} / {entries.length} entries
                    </span>
                </div>

                {/* Row 2: dropdowns + date range */}
                <div className="flex flex-wrap items-center gap-3">
                    <Filter className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />

                    {/* Action filter */}
                    <div className="relative">
                        <select value={filterAction} onChange={e => { setFilterAction(e.target.value as AuditAction | 'all'); setPage(1); }}
                            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg pl-3 pr-7 py-2 appearance-none focus:outline-none focus:border-emerald-500">
                            <option value="all">All Actions</option>
                            {ALL_ACTIONS.filter(a => entries.some(e => e.action === a)).map(a => (
                                <option key={a} value={a}>{ACTION_LABELS[a]} ({entries.filter(e => e.action === a).length})</option>
                            ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Role filter */}
                    <div className="relative">
                        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}
                            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg pl-3 pr-7 py-2 appearance-none focus:outline-none focus:border-emerald-500">
                            <option value="all">All Roles</option>
                            {uniqueRoles.map(r => <option key={r} value={r}>{r} ({entries.filter(e => e.actorRole === r).length})</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Actor filter */}
                    <div className="relative">
                        <select value={filterActor} onChange={e => { setFilterActor(e.target.value); setPage(1); }}
                            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg pl-3 pr-7 py-2 appearance-none focus:outline-none focus:border-emerald-500">
                            <option value="">All Actors</option>
                            {uniqueActors.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Date range */}
                    <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                        title="From date" />
                    <span className="text-zinc-600 text-xs">→</span>
                    <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                        title="To date" />
                </div>
            </div>

            {/* ── Action toolbar ────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Exports */}
                <button onClick={exportJSON} disabled={filtered.length === 0}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg disabled:opacity-40 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
                <button onClick={exportCSV} disabled={filtered.length === 0}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg disabled:opacity-40 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                </button>

                <div className="flex-1" />

                {/* Bulk delete */}
                <button onClick={handleClearFiltered} disabled={filtered.length === 0}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg disabled:opacity-40 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                    {hasActiveFilters ? `Delete filtered (${filtered.length})` : `Clear all logs (${entries.length})`}
                </button>
            </div>

            {/* ── Log Table ─────────────────────────────────────────────────── */}
            {filtered.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                    <Search className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-400 font-semibold">No entries match your filters</p>
                    <button onClick={resetFilters} className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                        Clear all filters
                    </button>
                </div>
            ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                                <th className="text-left px-4 py-3 font-medium">Time</th>
                                <th className="text-left px-4 py-3 font-medium">Action</th>
                                <th className="text-left px-4 py-3 font-medium">Actor</th>
                                <th className="text-left px-4 py-3 font-medium">Case ID</th>
                                <th className="text-left px-4 py-3 font-medium">Detail</th>
                                <th className="px-4 py-3 w-10" />
                            </tr>
                        </thead>
                        <tbody className="group">
                            {groupByDate && grouped ? (
                                Object.entries(grouped).map(([dateLabel, grpEntries]) => (
                                    <React.Fragment key={dateLabel}>
                                        <tr className="bg-zinc-800/40 border-b border-zinc-800">
                                            <td colSpan={6} className="px-4 py-2">
                                                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{dateLabel}</span>
                                                <span className="ml-2 text-xs text-zinc-600">({grpEntries.length} entries)</span>
                                            </td>
                                        </tr>
                                        {grpEntries.map(entry => renderEntry(entry))}
                                    </React.Fragment>
                                ))
                            ) : (
                                paged.map(entry => renderEntry(entry))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ────────────────────────────────────────────────── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                        Page {page} of {totalPages} · showing {Math.min(PAGE_SIZE, filtered.length - (page - 1) * PAGE_SIZE)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(1)} disabled={page === 1}
                            className="text-xs px-2 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">«</button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">‹ Prev</button>

                        {/* Page number buttons */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                            return (
                                <button key={pageNum} onClick={() => setPage(pageNum)}
                                    className={`text-xs w-7 h-7 rounded-lg border transition-colors ${pageNum === page ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-bold' : 'border-zinc-700 text-zinc-500 hover:text-zinc-200'}`}>
                                    {pageNum}
                                </button>
                            );
                        })}

                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">Next ›</button>
                        <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                            className="text-xs px-2 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">»</button>
                    </div>
                </div>
            )}

            {/* ── Click-to-expand hint ──────────────────────────────────────── */}
            {filtered.length > 0 && (
                <p className="text-xs text-zinc-600 text-center">
                    Click any row to expand its full detail · Hover to reveal the delete button
                </p>
            )}
        </div>
    );
}
