import React from 'react';
import type { CaseStatus, CasePriority } from '../../lib/caseStore';
import { STATUS_COLORS, PRIORITY_COLORS } from '../../lib/caseStore';

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
    const c = STATUS_COLORS[status] || STATUS_COLORS['Draft'];
    return (
        <span className={`inline-flex items-center text-xs font-mono font-semibold px-2.5 py-1 rounded-full border ${c.text} ${c.bg} ${c.border}`}>
            {status}
        </span>
    );
}

export function CasePriorityBadge({ priority }: { priority: CasePriority }) {
    const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS['Medium'];
    return (
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${c.text} ${c.bg} ${c.border}`}>
            {priority}
        </span>
    );
}

export default CaseStatusBadge;
