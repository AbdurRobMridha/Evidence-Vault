import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Upload, Hash, FileCheck, Link2, ScrollText, Package,
    ShieldCheck, Eye, HardDrive, ClipboardList, FolderOpen, Zap,
    Lock, CheckCircle, ArrowRight, ChevronDown, Fingerprint, Clock,
    AlertTriangle, Bell, UserCheck, Mail, FileText, Activity,
    ShieldAlert, Timer, RefreshCw, Send, KeyRound
} from 'lucide-react';
import './HomePage.css';
import AIOverviewSection from '../components/AIOverviewSection';

// ─── Intersection Observer Hook ─────────────────────────────────────────────────
function useRevealOnScroll() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('ev-visible');
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );

        const el = ref.current;
        if (el) {
            const children = el.querySelectorAll('.ev-reveal');
            children.forEach((child) => observer.observe(child));
        }

        return () => observer.disconnect();
    }, []);

    return ref;
}

// ─── Section Wrapper ───────────────────────────────────────────────────────────
function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
    return (
        <section id={id} className={`ev-section-padding py-20 md:py-28 ${className}`}>
            <div className="max-w-6xl mx-auto px-5 md:px-8">{children}</div>
        </section>
    );
}

function SectionTitle({ label, title, subtitle, labelColor = 'emerald' }: {
    label: string;
    title: string;
    subtitle?: string;
    labelColor?: 'emerald' | 'amber';
}) {
    const colorMap = {
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };
    return (
        <div className="ev-reveal text-center mb-14">
            <span className={`inline-block text-xs font-bold tracking-[0.2em] uppercase mb-3 px-4 py-1.5 rounded-full border ${colorMap[labelColor]}`}>
                {label}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">{title}</h2>
            {subtitle && <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
        </div>
    );
}

// ─── Dead-Man Switch Section ──────────────────────────────────────────────────
function DeadManSwitchSection() {
    const steps = [
        {
            icon: Timer,
            num: '01',
            title: 'Set Check-In Interval',
            desc: 'Configure how frequently you must check in — hourly, daily, or weekly — based on your safety needs.',
        },
        {
            icon: CheckCircle,
            num: '02',
            title: 'Confirm "I Am Safe"',
            desc: 'Periodically tap the check-in button to confirm your safety and reset the monitoring timer.',
        },
        {
            icon: Activity,
            num: '03',
            title: 'System Monitors Inactivity',
            desc: 'Our automated system continuously tracks your last check-in. Missed deadlines trigger escalating alerts.',
        },
        {
            icon: Bell,
            num: '04',
            title: 'Emergency Release Triggered',
            desc: 'If no check-in occurs within the configured window, the emergency protocol activates automatically.',
        },
        {
            icon: Send,
            num: '05',
            title: 'Trusted Contact Notified',
            desc: 'Your designated trusted contact receives the forensic evidence package via secure email release.',
        },
    ];

    const securityPillars = [
        {
            icon: Hash,
            title: 'SHA-256 Integrity',
            desc: 'Every released file is cryptographically verified. The hash accompanying the email proves zero tampering occurred during release.',
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
        },
        {
            icon: Clock,
            title: 'Timestamp Logging',
            desc: 'Precise UTC timestamps are recorded for every check-in, missed deadline, and release event — creating an immutable audit trail.',
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20',
        },
        {
            icon: Link2,
            title: 'Chain of Custody',
            desc: 'The release event is logged like all other forensic actions — preserving controlled, documented, and legally traceable evidence delivery.',
            color: 'text-purple-400',
            bg: 'bg-purple-500/10 border-purple-500/20',
        },
        {
            icon: KeyRound,
            title: 'Secure Token Access',
            desc: 'Trusted contacts receive a one-time secure access token — no passwords shared, no account access required.',
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20',
        },
    ];

    return (
        <Section id="deadman" className="bg-zinc-900/20">
            {/* Section Header */}
            <SectionTitle
                label="Safety Protection"
                title="Dead-Man Switch"
                subtitle="An automated safety protocol that ensures your evidence reaches trusted contacts if you are ever unable to check in — protecting you when it matters most."
                labelColor="amber"
            />

            {/* Feature Overview Card */}
            <div className="ev-reveal ev-delay-1 ev-dms-glow-card rounded-2xl p-8 md:p-10 mb-14 max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Animated Shield */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-3">
                        <div className="ev-dms-shield w-24 h-24 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                            <ShieldAlert className="w-12 h-12 text-amber-400" />
                        </div>
                        <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Active</span>
                    </div>

                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-zinc-100 mb-2">Automated Safety Monitoring</h3>
                        <p className="text-zinc-400 leading-relaxed mb-5">
                            The Dead-Man Switch is a passive safety mechanism that continuously monitors your check-in activity.
                            If you are unable to respond — due to arrest, incapacitation, or emergency — the system
                            automatically initiates a controlled forensic evidence release on your behalf.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {[
                                { icon: RefreshCw, label: 'Periodic "I Am Safe" check-in' },
                                { icon: Activity, label: 'Missed check-in auto-detection' },
                                { icon: UserCheck, label: 'Trusted contact auto-release' },
                                { icon: Mail, label: 'Emergency Gmail forensic delivery' },
                                { icon: FileText, label: 'Complete audit log of release' },
                                { icon: Zap, label: 'Configurable check-in intervals' },
                            ].map(({ icon: Icon, label }, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-3.5 h-3.5 text-amber-400" />
                                    </div>
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* How It Works */}
            <div className="mb-16">
                <h3 className="ev-reveal text-center text-lg font-bold text-zinc-300 mb-8 tracking-wide uppercase text-sm">
                    How It Works
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
                    {steps.map(({ icon: Icon, num, title, desc }, i) => (
                        <div key={i} className={`ev-reveal ev-delay-${Math.min(i + 1, 5)} ev-dms-step`}>
                            <div className="ev-dms-step-num">{num}</div>
                            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                                <Icon className="w-5 h-5 text-amber-400" />
                            </div>
                            <h4 className="text-sm font-bold text-zinc-100 mb-2">{title}</h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Security Pillars */}
            <div>
                <h3 className="ev-reveal text-center text-sm font-bold text-zinc-300 mb-8 tracking-widest uppercase">
                    Security Guarantee
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {securityPillars.map(({ icon: Icon, title, desc, color, bg }, i) => (
                        <div key={i} className={`ev-reveal ev-delay-${Math.min(i + 1, 4)} ev-glass-card p-6`}>
                            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${bg}`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                            <h4 className="text-sm font-bold text-zinc-100 mb-2">{title}</h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </Section>
    );
}

// ─── Home Page Component ───────────────────────────────────────────────────────
export default function HomePage({ user }: { user?: any }) {
    const navigate = useNavigate();
    const pageRef = useRevealOnScroll();

    // Determine if logged in (prop from App or localStorage fallback)
    const isLoggedIn = !!user || !!localStorage.getItem('user');

    return (
        <div ref={pageRef} className="min-h-screen bg-zinc-950 text-zinc-50">

            {/* ═══════════════ NAVBAR ═══════════════ */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Shield className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <span className="font-bold text-zinc-100 tracking-tight">Evidence Vault</span>
                    </div>

                    {/* Nav Links */}
                    <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
                        <a href="#about" className="hover:text-emerald-400 transition-colors">About</a>
                        <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
                        <a href="#deadman" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            Safety
                        </a>
                        <a href="#security" className="hover:text-emerald-400 transition-colors">Security</a>
                    </div>

                    {/* Auth Buttons */}
                    <div className="flex items-center gap-3">
                        {isLoggedIn ? (
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold text-sm px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                Go to Dashboard
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-sm text-zinc-300 hover:text-zinc-100 font-medium px-4 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => navigate('/register')}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
                                >
                                    Register
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ═══════════════ HERO SECTION ═══════════════ */}
            <section className="ev-hero-bg min-h-screen flex items-center justify-center relative pt-16">
                {/* Particles */}
                <div className="ev-particles">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="ev-particle" />
                    ))}
                </div>

                <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center">
                    {/* Badge */}
                    <div className="ev-reveal inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-8">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-400 tracking-wide">SECURE DIGITAL FORENSICS</span>
                    </div>

                    {/* Title */}
                    <h1 className="ev-reveal ev-delay-1 ev-hero-title text-4xl md:text-5xl lg:text-6xl font-extrabold text-zinc-100 leading-[1.1] mb-6">
                        Secure Digital Evidence
                        <br />
                        <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-blue-400 bg-clip-text text-transparent">
                            Preservation Platform
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="ev-reveal ev-delay-2 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Cryptographically verified evidence integrity. Court-admissible
                        documentation. Immutable chain of custody — all in one platform.
                    </p>

                    {/* CTAs — Auth-Aware */}
                    <div className="ev-reveal ev-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
                        {isLoggedIn ? (
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="ev-btn-glow bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold px-10 py-3.5 rounded-xl text-base flex items-center gap-2 transition-all"
                            >
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="ev-btn-glow bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold px-8 py-3.5 rounded-xl text-base flex items-center gap-2 transition-all"
                                >
                                    Sign In
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => navigate('/register')}
                                    className="bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 font-semibold px-8 py-3.5 rounded-xl text-base transition-all"
                                >
                                    Get Started
                                </button>
                                <button
                                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-zinc-400 hover:text-emerald-400 font-semibold px-6 py-3.5 rounded-xl text-base transition-colors underline-offset-4 hover:underline"
                                >
                                    Explore Features
                                </button>
                            </>
                        )}
                    </div>

                    {/* Scroll Hint */}
                    <div className="ev-reveal ev-delay-5 mt-16 animate-bounce">
                        <ChevronDown className="w-5 h-5 text-zinc-600 mx-auto" />
                    </div>
                </div>
            </section>

            {/* ═══════════════ ABOUT THE SERVICE ═══════════════ */}
            <Section id="about" className="bg-zinc-950">
                <SectionTitle
                    label="About"
                    title="Preserving Digital Truth"
                    subtitle="Our platform ensures the integrity, authenticity, and legal admissibility of digital evidence through advanced cryptographic methods."
                />
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="ev-reveal ev-delay-1 space-y-5">
                        <p className="text-zinc-300 leading-relaxed">
                            Evidence Vault is a <span className="text-emerald-400 font-semibold">secure digital evidence preservation system</span> built
                            for legal professionals, investigators, and cybercrime reporters. Every file uploaded is
                            cryptographically hashed using SHA-256, creating an immutable record that proves
                            no modification has occurred.
                        </p>
                        <p className="text-zinc-400 leading-relaxed">
                            From the moment evidence enters the system, a complete chain of custody is maintained
                            with UTC timestamps, audit logs, and integrity verification at every stage. The platform
                            generates court-ready documentation packages that meet forensic standards.
                        </p>
                    </div>
                    <div className="ev-reveal ev-delay-2 grid grid-cols-2 gap-4">
                        {[
                            { icon: Hash, label: 'SHA-256 Verification', desc: 'Cryptographic integrity' },
                            { icon: Link2, label: 'Chain of Custody', desc: 'Complete audit trail' },
                            { icon: ScrollText, label: 'Court-Ready Docs', desc: 'Legal documentation' },
                            { icon: Lock, label: 'Secure Storage', desc: 'Tamper-proof system' },
                        ].map(({ icon: Icon, label, desc }, i) => (
                            <div key={i} className="ev-glass-card p-5 text-center">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                    <Icon className="w-5 h-5 text-emerald-400" />
                                </div>
                                <p className="text-sm font-semibold text-zinc-200 mb-1">{label}</p>
                                <p className="text-xs text-zinc-500">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ═══════════════ WORKFLOW / ACTIVITIES ═══════════════ */}
            <Section id="workflow" className="bg-zinc-900/30">
                <SectionTitle
                    label="Workflow"
                    title="How It Works"
                    subtitle="A step-by-step forensic-grade process from evidence upload to court submission."
                />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[
                        { icon: Upload, num: '01', title: 'Upload Evidence', desc: 'Select and upload digital evidence files securely into the platform.' },
                        { icon: Hash, num: '02', title: 'Generate SHA-256 Hash', desc: 'Cryptographic hash is computed client-side to verify file integrity.' },
                        { icon: FileCheck, num: '03', title: 'Preserve Case', desc: 'Evidence is linked to a case with immutable metadata and timestamps.' },
                        { icon: Link2, num: '04', title: 'Chain of Custody', desc: 'Every action is logged chronologically with UTC timestamps.' },
                        { icon: ScrollText, num: '05', title: 'Generate Forensic Report', desc: 'Court-admissible reports with integrity statements and legal declarations.' },
                        { icon: Package, num: '06', title: 'Export Court Package', desc: 'Download a ZIP with evidence, report, metadata, and hash verification.' },
                    ].map(({ icon: Icon, num, title, desc }, i) => (
                        <div key={i} className={`ev-reveal ev-delay-${Math.min(i + 1, 6)} ev-step-card`}>
                            <div className="ev-step-num">{num}</div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <Icon className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-base font-bold text-zinc-100 mb-2">{title}</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </Section>

            {/* ═══════════════ CORE FEATURES ═══════════════ */}
            <Section id="features" className="bg-zinc-950">
                <SectionTitle
                    label="Features"
                    title="Core Capabilities"
                    subtitle="Built for forensic integrity, legal compliance, and investigative efficiency."
                />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { icon: Eye, title: 'Tamper Detection', desc: 'SHA-256 hash comparison detects any unauthorized modification to evidence files.', color: 'text-red-400', bg: 'bg-red-500/10' },
                        { icon: ShieldCheck, title: 'Integrity Verification', desc: 'Client and server hashes are compared to confirm files were transmitted without alteration.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { icon: HardDrive, title: 'Secure Local Storage', desc: 'Evidence stored securely in browser localStorage with base64 encoding for demo mode.', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { icon: ClipboardList, title: 'Audit Logging', desc: 'Every action — upload, verify, export — is logged with timestamps and user identity.', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { icon: FolderOpen, title: 'Case Management', desc: 'Organize evidence under cases with status tracking, risk analysis, and AI threat assessment.', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { icon: ShieldAlert, title: 'Dead-Man Switch', desc: 'Automated emergency release to trusted contacts if periodic safety check-ins are missed.', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    ].map(({ icon: Icon, title, desc, color, bg }, i) => (
                        <div key={i} className={`ev-reveal ev-delay-${Math.min(i + 1, 6)} ev-glass-card p-6`}>
                            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                            </div>
                            <h3 className="text-base font-bold text-zinc-100 mb-2">{title}</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </Section>

            {/* ═══════════════ WHY CHOOSE US ═══════════════ */}
            <Section className="bg-zinc-900/30">
                <SectionTitle
                    label="Why Choose Us"
                    title="Built for Trust & Transparency"
                    subtitle="Designed from the ground up with forensic integrity and legal admissibility in mind."
                />
                <div className="ev-reveal ev-delay-1 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {[
                        { title: 'Reliable', desc: 'Consistent SHA-256 verification ensures evidence authenticity at every stage.' },
                        { title: 'Fast & Efficient', desc: 'Client-side hashing and report generation — no waiting for server processing.' },
                        { title: 'Transparent Audit Trail', desc: 'Every action is logged with UTC timestamps and user identification.' },
                        { title: 'Legally Structured', desc: 'Reports follow forensic documentation standards for court admissibility.' },
                        { title: 'Evidence Authenticity', desc: 'Cryptographic proofs guarantee files have not been altered since submission.' },
                        { title: 'Professional Documentation', desc: 'Generate formatted reports with legal declarations and integrity statements.' },
                    ].map(({ title, desc }, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-zinc-800/30 transition-colors">
                            <div className="mt-0.5">
                                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                            </div>
                            <div>
                                <p className="font-semibold text-zinc-200 mb-1">{title}</p>
                                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            {/* ═══════════════ SECURITY HIGHLIGHT ═══════════════ */}
            <Section id="security" className="bg-zinc-950">
                <div className="ev-reveal ev-glow-border max-w-4xl mx-auto">
                    <div className="bg-zinc-900 rounded-[18px] p-8 md:p-12 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-5">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500 blur-[150px]" />
                        </div>
                        <div className="relative z-10">
                            <div className="ev-shield-pulse w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                <Fingerprint className="w-10 h-10 text-emerald-400" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-4">
                                Evidence Integrity Guaranteed
                            </h2>
                            <p className="text-zinc-400 max-w-xl mx-auto leading-relaxed mb-8">
                                Every piece of evidence is cryptographically sealed with SHA-256 hashing.
                                Timestamps are immutable, records cannot be overwritten, and the complete
                                chain of custody is preserved from upload to court submission.
                            </p>
                            <div className="grid sm:grid-cols-3 gap-6">
                                {[
                                    { icon: Hash, label: 'Cryptographic Hashing', sub: 'SHA-256 verification' },
                                    { icon: Clock, label: 'Immutable Timestamps', sub: 'UTC-synchronized' },
                                    { icon: Lock, label: 'Tamper-Proof Records', sub: 'Cannot be modified' },
                                ].map(({ icon: Icon, label, sub }, i) => (
                                    <div key={i} className="p-4">
                                        <Icon className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                                        <p className="text-sm font-semibold text-zinc-200">{label}</p>
                                        <p className="text-xs text-zinc-500">{sub}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ═══════════════ AI OVERVIEW ═══════════════ */}
            <AIOverviewSection isLoggedIn={isLoggedIn} />

            {/* ═══════════════ DEAD-MAN SWITCH SECTION ═══════════════ */}
            <DeadManSwitchSection />

            {/* ═══════════════ ABOUT TEAM ═══════════════ */}
            <Section className="bg-zinc-900/30">
                <SectionTitle
                    label="Our Team"
                    title="About the Team"
                    subtitle="Dedicated to building trustworthy digital forensic tools."
                />
                <div className="ev-reveal ev-delay-1 ev-glass-card max-w-3xl mx-auto p-8 md:p-10 text-center">
                    <p className="text-zinc-300 leading-relaxed mb-4">
                        We are a team of developers, security researchers, and legal-tech professionals
                        committed to making digital evidence preservation accessible, reliable, and
                        legally admissible. Our platform combines cryptographic rigor with intuitive
                        design to serve investigators, legal professionals, and organizations worldwide.
                    </p>
                    <p className="text-zinc-500 text-sm">
                        Built with integrity. Designed for justice.
                    </p>
                    <div className="mt-6 pt-6 border-t border-zinc-800">
                        <p className="text-emerald-400 font-semibold">Abdur Rob Team — Dhaka</p>
                        <p className="text-zinc-500 text-sm mt-1">Digital Forensics & Legal Technology</p>
                    </div>
                </div>
            </Section>

            {/* ═══════════════ CTA BANNER ═══════════════ */}
            {!isLoggedIn && (
                <Section className="bg-zinc-950">
                    <div className="ev-reveal ev-glow-border max-w-3xl mx-auto">
                        <div className="bg-zinc-900 rounded-[18px] p-10 text-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-5">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-emerald-500 blur-[120px]" />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-3">
                                    Start Protecting Your Evidence Today
                                </h2>
                                <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                                    Join the platform trusted by investigators and legal professionals. Secure, preserve, and protect — for free.
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <button
                                        onClick={() => navigate('/register')}
                                        className="ev-btn-glow bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold px-8 py-3.5 rounded-xl text-base flex items-center gap-2 transition-all"
                                    >
                                        Get Started Free
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="text-zinc-300 hover:text-zinc-100 font-semibold px-8 py-3.5 text-base transition-colors"
                                    >
                                        Sign In →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>
            )}

            {/* ═══════════════ FOOTER ═══════════════ */}
            <footer className="bg-zinc-950 border-t border-zinc-800/60 py-12">
                <div className="max-w-6xl mx-auto px-5 md:px-8">
                    <div className="grid md:grid-cols-3 gap-8 mb-10">
                        {/* Brand */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <Shield className="w-4 h-4 text-emerald-400" />
                                </div>
                                <span className="font-bold text-zinc-100">Evidence Vault</span>
                            </div>
                            <p className="text-sm text-zinc-500 leading-relaxed">
                                Secure Digital Evidence Preservation & Forensic Integrity Platform.
                                Cryptographically verified. Court-ready.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h4 className="text-sm font-semibold text-zinc-300 mb-4">Quick Links</h4>
                            <div className="space-y-2">
                                <a href="#about" className="block text-sm text-zinc-500 hover:text-emerald-400 transition-colors">About</a>
                                <a href="#features" className="block text-sm text-zinc-500 hover:text-emerald-400 transition-colors">Features</a>
                                <a href="#deadman" className="block text-sm text-zinc-500 hover:text-amber-400 transition-colors flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    Dead-Man Switch
                                </a>
                                <a href="#security" className="block text-sm text-zinc-500 hover:text-emerald-400 transition-colors">Security</a>
                            </div>
                        </div>

                        {/* Safety & Legal */}
                        <div>
                            <h4 className="text-sm font-semibold text-zinc-300 mb-4">Safety & Legal</h4>
                            <div className="mb-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                                <div className="flex items-center gap-2 mb-1">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-xs font-semibold text-amber-400">Dead-Man Switch Active</span>
                                </div>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Automated emergency forensic release ensures your evidence reaches trusted contacts if you are unable to check in.
                                </p>
                            </div>
                            <p className="text-sm text-zinc-500 leading-relaxed">
                                This platform preserves cryptographic integrity but does not replace certified
                                forensic investigation by qualified professionals.
                            </p>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="pt-8 border-t border-zinc-800/60 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-zinc-600">
                            © 2026 Abdur Rob Team – Dhaka. All Rights Reserved.
                        </p>
                        <p className="text-xs text-zinc-700 font-mono">
                            Evidence Vault • Demo v1.0 • Secure Preservation System
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
