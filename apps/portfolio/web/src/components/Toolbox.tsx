import { profile } from "@/data/profile";

export function Toolbox() {
  return (
    <section id="toolbox" className="border-t border-slate-200/90 bg-slate-50/70 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid md:grid-cols-12 gap-10 mb-14">
          <div className="md:col-span-4">
            <div className="text-xs uppercase tracking-[0.25em] text-blue-600 font-bold mb-4">
              03 — Toolbox
            </div>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight text-slate-900">
              What I reach for.
            </h2>
          </div>
          <div className="md:col-span-8 flex items-end">
            <p className="text-slate-600 text-lg leading-relaxed font-light">
              Technologies, design systems, and platforms I have applied across ten years of shipping software at
              scale.
            </p>
          </div>
        </div>

        {/* Skill Categories Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {profile.skills.map((category) => (
            <div
              key={category.category}
              className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs hover:shadow-md hover:border-blue-300 transition card-print"
            >
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider font-mono">
                {category.category}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {category.items.map((skill) => (
                  <li
                    key={skill}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono font-medium hover:border-blue-400 hover:text-blue-700 transition shadow-2xs"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
