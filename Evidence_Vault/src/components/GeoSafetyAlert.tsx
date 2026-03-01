// ═══════════════════════════════════════════════════════════════
// Evidence Vault — Geo-Safety Alert Component
// ═══════════════════════════════════════════════════════════════
// Shown on High/Critical priority cases.
// Displays the nearest hardcoded support centers (demo logic).
// ───────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
    MapPin, Phone, Clock, ChevronDown, ChevronUp,
    ShieldAlert, ExternalLink, Megaphone, Ambulance, Scale,
} from 'lucide-react';
import type { CasePriority } from '../lib/caseStore';

// ─── Hardcoded Support Center Data (Demo) ────────────────────────────────────

interface SupportCenter {
    id: string;
    name: string;
    type: 'police' | 'shelter' | 'legal' | 'medical';
    address: string;
    phone: string;
    hotline?: string;
    distance: string;       // demo text, no real GPS
    available: '24/7' | 'Office hours' | 'By appointment';
    urgencyLevel: 'emergency' | 'moderate' | 'all';
    mapUrl: string;
}

const SUPPORT_CENTERS: SupportCenter[] = [
    {
        id: 'sc-001',
        name: 'National Emergency Police Control Room',
        type: 'police',
        address: 'Police Headquarters, Ramna, Dhaka-1000',
        phone: '999',
        hotline: '01320-000999',
        distance: '~2.3 km',
        available: '24/7',
        urgencyLevel: 'emergency',
        mapUrl: 'https://maps.google.com/?q=Police+Headquarters+Ramna+Dhaka',
    },
    {
        id: 'sc-002',
        name: 'Women & Children Repression Prevention Center',
        type: 'legal',
        address: 'Bangladesh National Women Lawyers Association, Dhaka',
        phone: '16492',
        hotline: '01711-528911',
        distance: '~3.1 km',
        available: '24/7',
        urgencyLevel: 'emergency',
        mapUrl: 'https://maps.google.com/?q=BNWLA+Dhaka',
    },
    {
        id: 'sc-003',
        name: 'One-Stop Crisis Center (OCC)',
        type: 'medical',
        address: 'Dhaka Medical College Hospital, Dhaka-1000',
        phone: '+880 2-55165088',
        hotline: '01974-103174',
        distance: '~1.8 km',
        available: '24/7',
        urgencyLevel: 'emergency',
        mapUrl: 'https://maps.google.com/?q=Dhaka+Medical+College+Hospital',
    },
    {
        id: 'sc-004',
        name: 'Ain o Salish Kendra (ASK) Legal Aid',
        type: 'legal',
        address: 'House 14/1, Rd 16 (Old 27), Dhanmondi, Dhaka',
        phone: '+880 2-9126902',
        hotline: '01712-702234',
        distance: '~4.5 km',
        available: 'Office hours',
        urgencyLevel: 'all',
        mapUrl: 'https://maps.google.com/?q=Ain+o+Salish+Kendra+Dhanmondi+Dhaka',
    },
    {
        id: 'sc-005',
        name: 'Bangladesh National Cyber Crime Unit',
        type: 'police',
        address: 'CID, 36 Outer Circular Road, Dhaka-1000',
        phone: '+880 2-9331193',
        hotline: '16477',
        distance: '~3.9 km',
        available: '24/7',
        urgencyLevel: 'all',
        mapUrl: 'https://maps.google.com/?q=CID+Outer+Circular+Road+Dhaka',
    },
    {
        id: 'sc-006',
        name: 'Shelter for Violence Survivors — BWSF',
        type: 'shelter',
        address: 'Bangladesh Women Solidarity Foundation, Mirpur, Dhaka',
        phone: '+880 2-8013044',
        hotline: '01714-202030',
        distance: '~6.2 km',
        available: '24/7',
        urgencyLevel: 'moderate',
        mapUrl: 'https://maps.google.com/?q=Bangladesh+Women+Solidarity+Foundation+Mirpur',
    },
];

// ─── Type Icon Map ─────────────────────────────────────────────────────────────

const TYPE_META: Record<SupportCenter['type'], { icon: React.ElementType; color: string; label: string }> = {
    police: { icon: ShieldAlert, color: 'text-blue-400', label: 'Law Enforcement' },
    shelter: { icon: Megaphone, color: 'text-amber-400', label: 'Safe Shelter' },
    legal: { icon: Scale, color: 'text-purple-400', label: 'Legal Aid' },
    medical: { icon: Ambulance, color: 'text-red-400', label: 'Medical / Crisis' },
};

const AVAILABILITY_COLOR: Record<SupportCenter['available'], string> = {
    '24/7': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'Office hours': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    'By appointment': 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
};

// ─── Component ─────────────────────────────────────────────────────────────────

interface GeoSafetyAlertProps {
    priority: CasePriority;
    caseTitle?: string;
}

export default function GeoSafetyAlert({ priority, caseTitle }: GeoSafetyAlertProps) {
    const [expanded, setExpanded] = useState(true);
    const [activeType, setActiveType] = useState<SupportCenter['type'] | 'all'>('all');

    const isHighRisk = priority === 'High' || priority === 'Critical';
    if (!isHighRisk) return null;

    // For Critical, show emergency-only centers first; for High show all
    const sorted = [...SUPPORT_CENTERS].sort((a, b) => {
        if (priority === 'Critical') {
            const ap = a.urgencyLevel === 'emergency' ? 0 : 1;
            const bp = b.urgencyLevel === 'emergency' ? 0 : 1;
            return ap - bp;
        }
        return 0;
    });

    const filtered = activeType === 'all'
        ? sorted
        : sorted.filter(c => c.type === activeType);

    const accentColor = priority === 'Critical' ? 'red' : 'amber';

    return (
        <div className={`rounded-2xl border overflow-hidden ${priority === 'Critical'
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-amber-500/5 border-amber-500/20'
            }`}>
            {/* ── Header ── */}
            <button
                onClick={() => setExpanded(v => !v)}
                className={`w-full flex items-center justify-between px-6 py-4 text-left transition-colors ${priority === 'Critical'
                        ? 'hover:bg-red-500/10'
                        : 'hover:bg-amber-500/10'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${priority === 'Critical'
                            ? 'bg-red-500/15 border border-red-500/30'
                            : 'bg-amber-500/15 border border-amber-500/30'
                        }`}>
                        <MapPin className={`w-5 h-5 ${priority === 'Critical' ? 'text-red-400' : 'text-amber-400'}`} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={`font-semibold text-base ${priority === 'Critical' ? 'text-red-300' : 'text-amber-300'}`}>
                                🛡️ Geo-Safety Alert — Nearest Support Centers
                            </h3>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priority === 'Critical'
                                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                }`}>
                                {priority} RISK
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {caseTitle
                                ? `"${caseTitle}" — Suggest immediate contact with a nearby center`
                                : 'High-risk case detected — Suggest immediate contact with a nearby center'}
                        </p>
                    </div>
                </div>
                <div className={`p-1.5 rounded-lg ${priority === 'Critical' ? 'text-red-400' : 'text-amber-400'}`}>
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </button>

            {/* ── Body ── */}
            {expanded && (
                <div className="px-6 pb-6">
                    {/* Demo badge */}
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-zinc-900/80 border border-zinc-700/50 rounded-lg">
                        <span className="text-xs font-mono text-zinc-400">
                            🧪 <strong className="text-zinc-300">Demo Mode:</strong> Locations are hardcoded representative centers. In production, real GPS lookup would find the closest facility.
                        </span>
                    </div>

                    {/* Type filter tabs */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {(['all', 'police', 'legal', 'medical', 'shelter'] as const).map(t => {
                            const meta = t === 'all' ? null : TYPE_META[t];
                            const Icon = meta?.icon;
                            return (
                                <button
                                    key={t}
                                    onClick={() => setActiveType(t)}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${activeType === t
                                            ? `bg-zinc-700 text-zinc-100 border-zinc-600`
                                            : `bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300`
                                        }`}
                                >
                                    {Icon ? <Icon className={`w-3 h-3 ${meta?.color}`} /> : <MapPin className="w-3 h-3" />}
                                    {t === 'all' ? 'All Centers' : meta?.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Centers grid */}
                    <div className="grid gap-3 md:grid-cols-2">
                        {filtered.map((center, i) => {
                            const meta = TYPE_META[center.type];
                            const Icon = meta.icon;
                            const isEmergency = center.urgencyLevel === 'emergency';
                            return (
                                <div
                                    key={center.id}
                                    className={`group relative bg-zinc-900 border rounded-xl p-4 transition-all hover:border-zinc-600 ${isEmergency && i === 0
                                            ? 'border-red-500/30 bg-red-500/5'
                                            : 'border-zinc-800'
                                        }`}
                                >
                                    {isEmergency && i === 0 && (
                                        <div className="absolute top-3 right-3">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                                                Nearest
                                            </span>
                                        </div>
                                    )}

                                    {/* Name & Type */}
                                    <div className="flex items-start gap-2.5 mb-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-zinc-800 border border-zinc-700`}>
                                            <Icon className={`w-4 h-4 ${meta.color}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-zinc-100 leading-snug">{center.name}</p>
                                            <p className={`text-[10px] font-medium mt-0.5 ${meta.color}`}>{meta.label}</p>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="flex items-start gap-1.5 text-xs text-zinc-500 mb-2">
                                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-zinc-600" />
                                        <span>{center.address}</span>
                                    </div>

                                    {/* Availability */}
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <Clock className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${AVAILABILITY_COLOR[center.available]}`}>
                                            {center.available}
                                        </span>
                                        <span className="ml-auto text-[10px] text-zinc-600 font-mono">{center.distance}</span>
                                    </div>

                                    {/* Contact buttons */}
                                    <div className="flex flex-wrap gap-2">
                                        <a
                                            href={`tel:${center.phone}`}
                                            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                        >
                                            <Phone className="w-3 h-3" />
                                            {center.phone}
                                        </a>
                                        {center.hotline && (
                                            <a
                                                href={`tel:${center.hotline}`}
                                                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                                            >
                                                <Phone className="w-3 h-3" />
                                                {center.hotline}
                                            </a>
                                        )}
                                        <a
                                            href={center.mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Map
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Emergency strip */}
                    <div className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl ${priority === 'Critical'
                            ? 'bg-red-500/10 border border-red-500/20'
                            : 'bg-amber-500/10 border border-amber-500/20'
                        }`}>
                        <Phone className={`w-5 h-5 flex-shrink-0 ${priority === 'Critical' ? 'text-red-400' : 'text-amber-400'}`} />
                        <div>
                            <p className={`text-sm font-bold ${priority === 'Critical' ? 'text-red-300' : 'text-amber-300'}`}>
                                National Emergency: <a href="tel:999" className="underline underline-offset-2 hover:opacity-80">999</a>
                                &nbsp;·&nbsp;
                                Women Helpline: <a href="tel:10921" className="underline underline-offset-2 hover:opacity-80">10921</a>
                                &nbsp;·&nbsp;
                                Cyber Crime: <a href="tel:16477" className="underline underline-offset-2 hover:opacity-80">16477</a>
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">Call immediately if you are in danger. Evidence preserved.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
