import { useState, useEffect } from 'react';
import { Clock, ShieldAlert, CheckCircle2, AlertTriangle, Save, Mail, Send, ToggleLeft, ToggleRight, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState<any[]>([]);
  const [intervalHours, setIntervalHours] = useState<number>(24);
  const [reminderMinutes, setReminderMinutes] = useState<number>(60);

  // Emergency Release State
  const [emergencyEnabled, setEmergencyEnabled] = useState(false);
  const [emergencyCustomMsg, setEmergencyCustomMsg] = useState('');
  const [lastRelease, setLastRelease] = useState<string | null>(null);
  const [releaseSent, setReleaseSent] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [savingEmergency, setSavingEmergency] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testToEmail, setTestToEmail] = useState('');

  const formatTimestamp = (val: any) => {
    if (!val) return 'Never';
    try {
      if (val.toDate) return format(val.toDate(), 'MMM d, yyyy HH:mm:ss');
      return format(new Date(val), 'MMM d, yyyy HH:mm:ss');
    } catch (e) {
      return String(val);
    }
  };

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => setUser(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // load safety settings
    fetch('/api/safety')
      .then(r => r.json())
      .then(data => {
        setTrustedContacts(data.trustedContacts || []);
        setIntervalHours(Number(data.deadManIntervalHours) || 24);
        setReminderMinutes(Number(data.reminderMinutesBefore) || 60);
      })
      .catch(() => { });
  }, []);

  // Load emergency release config
  useEffect(() => {
    fetch('/api/emergency-release/config')
      .then(r => r.json())
      .then(data => {
        setEmergencyEnabled(data.enabled || false);
        setEmergencyCustomMsg(data.customMessage || '');
        setLastRelease(data.lastRelease || null);
        setReleaseSent(data.releaseSent || false);
        setSmtpConfigured(data.smtpConfigured || false);
      })
      .catch(() => { });
  }, []);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await fetch('/api/deadman/checkin', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setUser({ ...user, next_checkin: data.next_checkin, last_checkin: data.last_checkin || user.last_checkin, status: 'active' });
        // Reset emergency release sent flag on check-in
        setReleaseSent(false);
        fetch('/api/emergency-release/reset', { method: 'POST' }).catch(() => { });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSaveEmergency = async () => {
    setSavingEmergency(true);
    try {
      const res = await fetch('/api/emergency-release/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: emergencyEnabled, customMessage: emergencyCustomMsg })
      });
      if (res.ok) {
        alert('Emergency release settings saved.');
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Save failed: ' + (err.error || res.statusText));
      }
    } catch (e) {
      alert('Save failed');
    } finally {
      setSavingEmergency(false);
    }
  };

  const handleTestEmail = async () => {
    if (testingEmail) return;
    const allContacts = testToEmail
      ? [{ email: testToEmail }, ...trustedContacts]
      : trustedContacts;
    setTestingEmail(true);
    try {
      const res = await fetch('/api/emergency-release/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trustedContacts: allContacts,
          toEmail: testToEmail || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isDemoMode && data.previewUrl) {
          // Open the Ethereal preview in a new tab automatically
          window.open(data.previewUrl, '_blank');
          alert(`✅ Demo email sent via Ethereal! Preview opened in new tab.\n\nURL: ${data.previewUrl}\n\n(No real email was sent — this is a demo preview)`);
        } else {
          alert(`✅ Email sent successfully to: ${data.sentTo?.join(', ')}`);
        }
      } else {
        alert(`❌ ${data.error || 'Failed to send test email'}`);
      }
    } catch (e) {
      alert('Failed to send test email. Check server console for details.');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleResetRelease = async () => {
    setResetting(true);
    try {
      await fetch('/api/emergency-release/reset', { method: 'POST' });
      setReleaseSent(false);
      alert('Emergency release reset. Will re-trigger on next missed check-in.');
    } catch {
      alert('Reset failed');
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="p-8 text-zinc-500 animate-pulse">Loading settings...</div>;

  const isOverdue = user.next_checkin && new Date(user.next_checkin) < new Date();
  const hasTrustedEmails = trustedContacts.some((c: any) => c.email);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight mb-2">Safety Settings</h1>
        <p className="text-zinc-400">Manage your Dead-Man Switch, trusted contacts, and emergency email release.</p>
      </div>

      <div className="space-y-8">
        {/* Dead-Man Switch Status */}
        <div className={`border rounded-2xl p-8 relative overflow-hidden ${isOverdue ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-900 border-zinc-800'
          }`}>
          {isOverdue && <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>}

          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                {isOverdue ? <AlertTriangle className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">Dead-Man Switch</h2>
                <p className={`text-sm ${isOverdue ? 'text-red-400' : 'text-zinc-400'}`}>
                  {isOverdue ? 'OVERDUE - Cases Escalated' : 'Active and Monitoring'}
                </p>
              </div>
            </div>

            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {checkingIn ? 'Confirming...' : 'I am safe (Check-in)'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 text-zinc-500 mb-2 text-sm font-medium uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                Last Check-in
              </div>
              <div className="text-lg text-zinc-200 font-mono">
                {formatTimestamp(user?.last_checkin)}
              </div>
            </div>
            <div className={`border rounded-xl p-5 ${isOverdue ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-950 border-zinc-800'}`}>
              <div className={`flex items-center gap-2 mb-2 text-sm font-medium uppercase tracking-wider ${isOverdue ? 'text-red-400' : 'text-zinc-500'}`}>
                <AlertTriangle className="w-4 h-4" />
                Next Check-in Deadline
              </div>
              <div className={`text-lg font-mono ${isOverdue ? 'text-red-400 font-bold' : 'text-zinc-200'}`}>
                {user?.next_checkin ? formatTimestamp(user.next_checkin) : 'Not set'}
              </div>
            </div>
          </div>

          <p className="text-sm text-zinc-500 mt-6 max-w-2xl">
            If you fail to check in before the deadline, the system will automatically package your evidence, generate a legal report, and transmit it to your trusted contacts and designated authorities.
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-lg font-medium text-zinc-100 mb-6">Configuration</h2>

          <div className="space-y-6 max-w-md">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Check-in Interval (Hours)</label>
              <select
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="12">Every 12 Hours</option>
                <option value="24">Every 24 Hours</option>
                <option value="48">Every 48 Hours</option>
                <option value="72">Every 72 Hours</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Reminder Before Expiry (minutes)</label>
              <input type="number" value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100" />
            </div>

            <button onClick={async () => {
              try {
                const res = await fetch('/api/safety', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trustedContacts, deadManIntervalHours: intervalHours, reminderMinutesBefore: reminderMinutes }) });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  alert('Settings saved');
                  // update UI immediately with returned next_checkin
                  if (data.next_checkin) {
                    setUser(prev => ({ ...(prev || {}), next_checkin: data.next_checkin, last_checkin: data.last_checkin || prev?.last_checkin }));
                  }
                } else {
                  alert('Save failed: ' + (data.error || res.statusText));
                }
              } catch (e) { alert('Save failed'); }
            }} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </button>

            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Trusted Contacts</h3>
              <div className="space-y-3">
                {trustedContacts.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-100">{c.fullName || c.name}</div>
                      <div className="text-xs text-zinc-400">{c.email} {c.phone ? ` • ${c.phone}` : ''} {c.relationship ? ` • ${c.relationship}` : ''}</div>
                    </div>
                    <button onClick={() => setTrustedContacts(prev => prev.filter((_, i) => i !== idx))} className="text-sm text-red-400">Remove</button>
                  </div>
                ))}
                <AddContactForm onAdd={(ct) => setTrustedContacts(prev => [...prev, ct])} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════ EMERGENCY EMAIL RELEASE ═══════════════ */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 relative overflow-hidden">
          {/* Accent border */}
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-500 via-amber-500 to-red-500"></div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Mail className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Emergency Email Release</h2>
              <p className="text-sm text-zinc-400">Auto-send forensic report via Gmail when Dead-Man Switch triggers</p>
            </div>
          </div>

          {/* SMTP Status */}
          <div className={`rounded-xl px-4 py-3 mb-6 flex items-center gap-3 ${smtpConfigured
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${smtpConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-pulse'
              }`}></div>
            <span className={`text-sm font-medium ${smtpConfigured ? 'text-emerald-400' : 'text-blue-400'
              }`}>
              {smtpConfigured
                ? 'Gmail SMTP Configured ✓'
                : '🧪 Demo Mode — Using Ethereal (free preview emails, no signup needed)'}
            </span>
          </div>

          {/* Toggle */}
          <div className="space-y-5 max-w-lg">
            <div className="flex items-center justify-between py-3 px-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div>
                <p className="text-sm font-medium text-zinc-200">Enable Gmail Auto-Release</p>
                <p className="text-xs text-zinc-500 mt-0.5">Send evidence package to trusted contacts when switch triggers</p>
              </div>
              <button
                onClick={() => {
                  if (!hasTrustedEmails && !emergencyEnabled) {
                    alert('Add at least one trusted contact with an email address first.');
                    return;
                  }
                  setEmergencyEnabled(!emergencyEnabled);
                }}
                className="flex items-center"
              >
                {emergencyEnabled ? (
                  <ToggleRight className="w-10 h-10 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-zinc-600" />
                )}
              </button>
            </div>

            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Custom Message (Optional)</label>
              <textarea
                value={emergencyCustomMsg}
                onChange={(e) => setEmergencyCustomMsg(e.target.value)}
                placeholder="Personal message included in the emergency email..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* Save */}
            <button
              onClick={handleSaveEmergency}
              disabled={savingEmergency}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              {savingEmergency ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Emergency Settings
            </button>

            {/* Quick test email input */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Quick Test To (optional)</label>
              <input
                type="email"
                value={testToEmail}
                onChange={(e) => setTestToEmail(e.target.value)}
                placeholder="Send test to this email directly..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">Leave blank to use trusted contacts list</p>
            </div>

            {/* Actions Row */}
            <div className="flex flex-wrap gap-3 pt-2">
              {/* Test Email */}
              <button
                onClick={handleTestEmail}
                disabled={testingEmail}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {testingEmail ? 'Sending...' : smtpConfigured ? 'Send Test Email' : 'Send Demo Email (Ethereal)'}
              </button>

              {/* Reset Release */}
              {releaseSent && (
                <button
                  onClick={handleResetRelease}
                  disabled={resetting}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-zinc-950 font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Reset Release Flag
                </button>
              )}
            </div>

            {/* Status Info */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Release Status</p>
                <p className={`text-sm font-semibold ${releaseSent ? 'text-red-400' : 'text-emerald-400'}`}>
                  {releaseSent ? '🚨 Release Sent' : '✓ Standing By'}
                </p>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Last Release</p>
                <p className="text-sm font-mono text-zinc-300">
                  {lastRelease ? formatTimestamp(lastRelease) : 'Never'}
                </p>
              </div>
            </div>

            {/* Info */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                <strong className="text-zinc-300">How it works:</strong> When the Dead-Man Switch triggers (missed check-in),
                the system generates a forensic report, attaches case metadata and SHA-256 hashes,
                and emails everything to your trusted contacts via Gmail SMTP. The email includes
                a secure access token link valid for 24 hours. No passwords or credentials are ever
                sent — only a time-limited investigation access link.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddContactForm({ onAdd }: { onAdd: (c: any) => void }) {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('');
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded p-3">
      <input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Full name" className="w-full mb-2 px-3 py-2 rounded bg-zinc-900 text-zinc-100" />
      <input value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="Email" className="w-full mb-2 px-3 py-2 rounded bg-zinc-900 text-zinc-100" />
      <input value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full mb-2 px-3 py-2 rounded bg-zinc-900 text-zinc-100" />
      <input value={relationship} onChange={(e: any) => setRelationship(e.target.value)} placeholder="Relationship (optional)" className="w-full mb-2 px-3 py-2 rounded bg-zinc-900 text-zinc-100" />
      <div className="flex justify-end">
        <button onClick={() => { if (!email || !name) return alert('Name and email required'); onAdd({ fullName: name, email, phone, relationship }); setName(''); setEmail(''); setPhone(''); setRelationship(''); }} className="px-3 py-1 bg-emerald-500 rounded text-sm">Add</button>
      </div>
    </div>
  );
}
