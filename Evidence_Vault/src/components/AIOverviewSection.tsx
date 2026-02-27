import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, ArrowRight, ShieldAlert, Target, ShieldCheck, ListChecks, Activity } from 'lucide-react';

export default function AIOverviewSection({ isLoggedIn }: { isLoggedIn: boolean }) {
    const navigate = useNavigate();

    const features = [
        {
            icon: Target,
            title: 'Intelligent Risk Detection',
            desc: 'Automatically evaluates uploaded evidence for risk indicators and forensic relevance.'
        },
        {
            icon: Activity,
            title: 'Suspicious Pattern Identification',
            desc: 'Detects anomalies in metadata, file structures, and hidden threat signatures.'
        },
        {
            icon: ShieldCheck,
            title: 'SHA-256 Integrity Validation',
            desc: 'Cross-references cryptographic hashes to ensure evidence remains untampered.'
        },
        {
            icon: ListChecks,
            title: 'Recommended Investigative Actions',
            desc: 'Generates structured, actionable next steps based on detected threat levels.'
        },
        {
            icon: Cpu,
            title: 'Dynamic Confidence Scoring',
            desc: 'Calculates the reliability of findings using a weighted heuristic scoring engine.'
        }
    ];

    const workflowSteps = [
        'Upload Evidence',
        'AI Risk Analysis',
        'Actionable Insights'
    ];

    return (
        <section id="ai-overview" className="ev-section-padding py-20 md:py-28 bg-zinc-950 border-t border-b border-zinc-800/40">
            <div className="max-w-6xl mx-auto px-5 md:px-8">
                {/* Header */}
                <div className="ev-reveal text-center mb-14">
                    <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase mb-4 px-4 py-1.5 rounded-full border border-purple-500/20 text-purple-400 bg-purple-500/10">
                        <Cpu className="w-3.5 h-3.5" />
                        AI Analysis
                    </span>
                    <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">
                        AI-Powered Evidence Risk Assessment
                    </h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        Instantly evaluate digital evidence with our client-side forensic analysis engine.
                        Designed to detect threats, identify patterns, and guide your investigation.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left: Features List */}
                    <div className="space-y-6">
                        {features.map((feature, i) => (
                            <div key={i} className={`ev-reveal ev-delay-${i} flex items-start gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:border-purple-500/30 hover:bg-zinc-900/80 transition-all duration-300`}>
                                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                    <feature.icon className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-zinc-100 mb-1">{feature.title}</h4>
                                    <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right: Visual Element & Workflow */}
                    <div className="ev-reveal ev-delay-2 space-y-8">
                        {/* Mini Workflow Visual */}
                        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-5 text-center">Analysis Workflow</h3>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                {workflowSteps.map((step, i) => (
                                    <React.Fragment key={i}>
                                        <div className="text-center group">
                                            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-3 group-hover:border-purple-500/50 group-hover:bg-purple-500/10 transition-colors">
                                                <span className="text-sm font-bold text-zinc-300 group-hover:text-purple-400">{i + 1}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-zinc-400">{step}</span>
                                        </div>
                                        {i < workflowSteps.length - 1 && (
                                            <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-zinc-700 to-transparent relative">
                                                <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 -mr-2" />
                                            </div>
                                        )}
                                        {i < workflowSteps.length - 1 && (
                                            <div className="sm:hidden h-4 w-px bg-zinc-700" />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* Premium Visual Card */}
                        <div className="relative group perspective-1000">
                            {/* Glowing effect background */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                            <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <ShieldAlert className="w-8 h-8 text-red-400 animate-pulse" />
                                        <div>
                                            <p className="text-lg font-bold text-red-400">CRITICAL RISK</p>
                                            <p className="text-xs text-zinc-500">Executable payload detected</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-red-400">9/10</p>
                                        <p className="text-xs text-zinc-500">Risk Score</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="text-zinc-400 uppercase font-semibold">AI Confidence</span>
                                            <span className="text-purple-400 font-bold">82%</span>
                                        </div>
                                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                            <div className="bg-purple-500 h-2 rounded-full w-[82%] relative">
                                                <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-zinc-800/50 flex justify-between items-center">
                                        <span className="text-xs text-zinc-500"><ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-emerald-400" /> Integrity Verified</span>
                                        <span className="text-xs text-zinc-500">Local Engine Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="text-center pt-2">
                            <button
                                onClick={() => navigate(isLoggedIn ? '/ai-analysis' : '/login')}
                                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                            >
                                {isLoggedIn ? 'Go to AI Analysis' : 'Sign In to Use AI Analysis'}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
