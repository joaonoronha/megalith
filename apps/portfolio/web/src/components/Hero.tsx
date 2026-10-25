import { ArrowRight, MapPin, Sparkles, ExternalLink } from "lucide-react";
import { profile } from "@/data/profile";

interface HeroProps {
  onExploreAi: () => void;
}

export function Hero({ onExploreAi }: HeroProps) {
  return (
    <section id="top" className="mx-auto max-w-6xl px-6 pt-12 pb-16 md:pt-20 md:pb-24">
      <div className="grid md:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column: Editorial Headline & Bio */}
        <div className="md:col-span-7">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-700 mb-8 shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="flex items-center gap-1.5 font-medium text-slate-800">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              {profile.location}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-700 font-semibold">{profile.status}</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.98] tracking-tight text-slate-900 text-balance font-normal">
            Engineering leader building{" "}
            <span className="italic text-blue-600 font-medium">
              AI-native
            </span>{" "}
            products &amp; teams.
          </h1>

          <p className="mt-8 max-w-xl text-lg md:text-xl text-slate-600 leading-relaxed text-pretty font-light">
            I'm <strong className="font-semibold text-slate-900">João Noronha</strong> — Engineering Manager at{" "}
            <span className="text-slate-900 font-medium">Dialpad</span>. Ten years shipping SaaS, AI platforms, and
            developer tooling. Leading the <span className="text-blue-600 font-semibold">agentic frontend</span> and{" "}
            <span className="text-blue-600 font-semibold">ingestion source pipeline</span> end-to-end.
          </p>

          {/* Action links */}
          <div className="mt-10 flex flex-wrap items-center gap-3.5">
            <a
              href="#experience"
              className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold tracking-wide transition duration-200 shadow-md hover:shadow-blue-500/25 flex items-center gap-2"
            >
              <span>See my trajectory</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onExploreAi}
              className="px-5 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-blue-400 text-sm font-medium transition duration-200 shadow-xs flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>How I build with AI</span>
            </button>

            <a
              href={profile.contact.linkedin}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-3 rounded-full bg-white border border-slate-200 hover:border-slate-400 text-slate-700 hover:text-slate-900 text-sm font-medium transition flex items-center gap-1.5 shadow-2xs"
            >
              <span>LinkedIn</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60 text-slate-500" />
            </a>
          </div>
        </div>

        {/* Right Column: Full Natural Color Portrait Frame */}
        <div className="md:col-span-5 flex justify-center md:justify-end">
          <div className="relative group max-w-[340px] md:max-w-none w-full">
            {/* Luminous colorful ambient glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 via-indigo-500/15 to-amber-500/20 rounded-3xl blur-2xl opacity-70 group-hover:opacity-90 transition duration-500" />

            <div className="relative rounded-2xl overflow-hidden border-4 border-white bg-white shadow-xl transition-transform duration-300 group-hover:scale-[1.01]">
              <img
                src="/joao-portrait.jpeg"
                alt="Portrait of João Noronha"
                className="w-full h-[400px] sm:h-[460px] md:h-[500px] object-cover transition-all duration-500"
              />
              <div className="p-3.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono">
                <span className="font-semibold text-slate-800">João Noronha</span>
                <span className="font-serif italic text-blue-700 text-sm">— Lisbon, Portugal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights Strip */}
      <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-6 pt-10 border-t border-slate-200/90">
        {profile.highlights.map((h) => (
          <div
            key={h.key}
            className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-300 hover:shadow-md transition space-y-1.5"
          >
            <div className="font-serif text-4xl sm:text-5xl text-blue-600 tracking-tight font-medium">
              {h.key}
            </div>
            <div className="text-sm font-bold text-slate-900">{h.label}</div>
            <div className="text-xs text-slate-500 leading-relaxed font-light">{h.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
