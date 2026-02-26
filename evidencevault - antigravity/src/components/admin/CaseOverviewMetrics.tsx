import React from 'react';
import { FolderOpen, Search, AlertTriangle, Archive, Lock, ShieldAlert, BarChart3, FileWarning } from 'lucide-react';
import type { CaseMetrics } from '../../lib/caseStore';

interface Props {
    metrics: CaseMetrics;
}

export default function CaseOverviewMetrics({ metrics }: Props) {
    const cards = [
        { label: 'Total Cases', value: metrics.total, icon: FolderOpen, color: 'text-zinc-100', bg: 'bg-zinc-800' },
        { label: 'Active Investigations', value: metrics.underInvestigation, icon: Search, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Critical Priority', value: metrics.critical, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Evidence Verified', value: metrics.evidenceVerified, icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Reports Generated', value: metrics.reportGenerated, icon: FileWarning, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { label: 'Closed Cases', value: metrics.closed, icon: Lock, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
        { label: 'Archived', value: metrics.archived, icon: Archive, color: 'text-zinc-500', bg: 'bg-zinc-900' },
        { label: 'Tamper Alerts', value: metrics.tampered, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                            <Icon className={`w-4.5 h-4.5 ${color}`} />
                        </div>
                        <span className={`text-2xl font-bold ${color}`}>{value}</span>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium">{label}</p>
                </div>
            ))}
        </div>
    );
}
