import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';
import type { PostHogQueryCredentials } from '../services/posthogApi';

interface PostHogSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (creds: PostHogQueryCredentials) => void;
  onReset: () => void;
  isLive: boolean;
  initialCredentials?: PostHogQueryCredentials | null;
  isConfiguredFromEnv?: boolean;
}

export const PostHogSettingsModal: React.FC<PostHogSettingsModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onReset,
  isLive,
  initialCredentials,
  isConfiguredFromEnv,
}) => {
  const [host, setHost] = useState(initialCredentials?.host || 'https://eu.i.posthog.com');
  const [projectId, setProjectId] = useState(initialCredentials?.projectId || '');
  const [personalApiKey, setPersonalApiKey] = useState(initialCredentials?.personalApiKey || '');

  useEffect(() => {
    if (initialCredentials) {
      if (initialCredentials.host) setHost(initialCredentials.host);
      if (initialCredentials.projectId) setProjectId(initialCredentials.projectId);
      if (initialCredentials.personalApiKey) setPersonalApiKey(initialCredentials.personalApiKey);
    }
  }, [initialCredentials]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId.trim() || !personalApiKey.trim()) {
      alert('Please provide both Project ID and Personal API Key.');
      return;
    }
    onConnect({
      host: host.trim(),
      projectId: projectId.trim(),
      personalApiKey: personalApiKey.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">PostHog API Configuration</h2>
            <p className="text-xs text-slate-400">Live query credentials for your centralized metrics</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Credentials are kept in browser memory and used exclusively to run read-only HogQL analytics queries against your PostHog EU cloud instance.
          </span>
        </p>

        {isConfiguredFromEnv && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Active: Pre-configured from environment variables (.env.local)</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              PostHog Host
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              placeholder="https://eu.i.posthog.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono"
              placeholder="e.g. 12345"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Personal API Key
            </label>
            <input
              type="password"
              value={personalApiKey}
              onChange={(e) => setPersonalApiKey(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-mono"
              placeholder="phx_..."
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Create in PostHog Settings &rarr; Personal API Keys (read-only)
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {isLive ? (
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Switch back to Demo Feed
              </button>
            ) : (
              <span className="text-xs text-slate-500">Currently showing: Demo Feed</span>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                Connect Live
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
