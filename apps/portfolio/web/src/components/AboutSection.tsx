import { Layers, Database, Cpu, ShieldCheck } from "lucide-react";
import { profile } from "@/data/profile";

export function AboutSection() {
  const getIcon = (idx: number) => {
    switch (idx) {
      case 0:
        return <Layers className="w-5 h-5 text-blue-600" />;
      case 1:
        return <Database className="w-5 h-5 text-blue-600" />;
      case 2:
        return <Cpu className="w-5 h-5 text-blue-600" />;
      case 3:
      default:
        return <ShieldCheck className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <section id="about" className="border-t border-slate-200/90 bg-slate-50/70 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-4">
          <div className="text-xs uppercase tracking-[0.25em] text-blue-600 font-bold mb-4">
            01 — Leadership &amp; Vision
          </div>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight text-slate-900">
            Scaling platforms, teams &amp; AI agents.
          </h2>
          <p className="mt-4 text-sm text-slate-500 leading-relaxed font-light">
            Guiding high-velocity squads from ambiguity to resilient, high-volume production deployments.
          </p>
        </div>

        <div className="md:col-span-8 space-y-8">
          <div className="space-y-4 text-lg text-slate-700 leading-relaxed font-light text-pretty">
            {profile.about.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Focus Areas Grid */}
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            {profile.about.focusAreas.map((area, idx) => (
              <div
                key={area.title}
                className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition card-print"
              >
                <div className="flex items-center gap-3.5 mb-2.5">
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                    {getIcon(idx)}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{area.title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-light">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
