import { Award, Trophy, Star } from "lucide-react";
import { profile } from "@/data/profile";

export function Recognition() {
  return (
    <section id="recognition" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="grid md:grid-cols-12 gap-10 mb-12">
        <div className="md:col-span-5">
          <div className="text-xs uppercase tracking-[0.25em] text-blue-600 font-bold mb-4">
            04 — Recognition
          </div>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight text-slate-900">
            Outcomes &amp; milestones.
          </h2>
        </div>
        <div className="md:col-span-7 flex items-end">
          <p className="text-slate-600 text-lg leading-relaxed font-light">
            Recognized consistently for speed of execution, technical excellence, and team mentorship.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {profile.achievements.map((item, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition space-y-3 card-print"
          >
            <div className="flex items-center gap-2.5 text-blue-600">
              {idx === 1 ? (
                <Trophy className="w-5 h-5 text-blue-600" />
              ) : idx === 2 ? (
                <Star className="w-5 h-5 text-blue-600" />
              ) : (
                <Award className="w-5 h-5 text-blue-600" />
              )}
              <span className="font-mono text-xs text-slate-400 font-bold">0{idx + 1}</span>
            </div>
            <p className="text-base text-slate-900 font-semibold leading-snug">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
