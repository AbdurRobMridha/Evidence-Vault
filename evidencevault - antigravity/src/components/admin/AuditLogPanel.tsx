import React, { useState } from 'react';
import { Clock, Filter, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import type { AuditEntry, AuditAction } from '../../lib/auditLog';
import { ACTION_LABELS, ACTION_COLORS } from '../../lib/auditLog';

interface Props {
    entries: AuditEntry[];
}

const ALL_ACTIONS: AuditAction[] = [
    'case_created', 'case_updated', 'status_changed', 'priority_changed',
    'evidence_uploaded', 'evidence_verified', 'report_generated', 'case_exported',
    'case_locked', 'case_unlocked', 'case_archived', 'case_deleted',
    'investigator_assigned', 'investigator_removed',
    'emergency_release', 'emergency_override',
    'invitation_sent', 'invitation_accepted',
    'tamper_detected', 'integrity_verified', 'note_added',
];

export default function AuditLogPanel({ entries }: Props) {
    const [filter, setFilter] = useState<AuditAction | 'all'>('all');
    const [expanded, setExpanded] = useState(false);

    const filtered = filter === 'all' ? entries : entries.filter(e => e.action === filter);
    const display = expanded ? filtered : filtered.slice(0, 20);

    return (
        <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-zinc-500" />
                <div className="relative">
                    <select
                        value={filter}
                        onChange={e => setFilter(e.target.value as AuditAction | 'all')}
                        className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-lg pl-3 pr-8 py-2 appearance-none focus:outline-none focus:border-emerald-500"
                    >
                        <option value="all">All Actions ({entries.length})</option>
                        {ALL_ACTIONS.map(a => {
                            const count = entries.filter(e => e.action === a).length;
                            return count > 0 ? (
                                <option key={a} value={a}>{ACTION_LABELS[a]} ({count})</option>
                            ) : null;
                        })}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <span className="text-xs text-zinc-600 ml-auto">{filtered.length} entries</span>
            </div>

            {/* Table */}
            {display.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                    No audit entries found.
                </div>
            ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                                <th className="text-left px-4 py-3 font-medium">Time</th>
                                <th className="text-left px-4 py-3 font-medium">Action</th>
                                <th className="text-left px-4 py-3 font-medium">Actor</th>
                                <th className="text-left px-4 py-3 font-medium">Case</th>
                                <th className="text-left px-4 py-3 font-medium">Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {display.map(entry => (
                                <tr key={entry.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-3 text-xs font-mono text-zinc-500 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(entry.timestamp), 'MMM d HH:mm')}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-semibold ${ACTION_COLORS[entry.action] || 'text-zinc-400'}`}>
                                            {ACTION_LABELS[entry.action] || entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-300 text-xs">{entry.actor}</td>
                                    <td className="px-4 py-3 text-xs font-mono text-zinc-500">{entry.caseId}</td>
                                    <td className="px-4 py-3 text-xs text-zinc-400 max-w-xs truncate">{entry.detail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Show More */}
            {filtered.length > 20 && !expanded && (
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full text-center text-sm text-emerald-400 hover:text-emerald-300 py-2 transition-colors"
                >
                    Show all {filtered.length} entries
                </button>
            )}
        </div>
    );
}
