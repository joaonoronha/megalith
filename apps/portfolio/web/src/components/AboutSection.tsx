import { useState } from "react";
import {
  Layers,
  FileCode2,
  Cpu,
  ShieldCheck,
  Globe2,
  Workflow,
  Sparkles,
  GitPullRequest,
  CalendarDays,
  LifeBuoy,
  Code2,
  MessageSquareHeart,
  Target,
  Users2,
  Compass,
} from "lucide-react";
import { profile } from "@/data/profile";

export function AboutSection() {
  const [activeTab, setActiveTab] = useState<"how-we-work" | "challenges" | "leadership" | "focus-areas">("how-we-work");

  const { wayOfWorking } = profile;

  return (
    <section id="about" className="border-t border-slate-200/90 bg-slate-50/70 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 space-y-16">
        {/* Section Header */}
        <div className="grid md:grid-cols-12 gap-10 items-end">
          <div className="md:col-span-5">
            <div className="text-xs uppercase tracking-[0.25em] text-blue-600 font-bold mb-4">
              01 / Leadership and way of working
            </div>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight text-slate-900">
              Leading remote teams across global time zones.
            </h2>
          </div>
          <div className="md:col-span-7">
            <p className="text-slate-600 text-lg leading-relaxed font-light">
              Managing fully remote, cross-functional squads of ~15 people across North America, Europe, and Asia-Pacific.
              Grounding distributed velocity in written clarity, spec-first engineering, hands-on technical proximity, and high psychological safety.
            </p>
          </div>
        </div>

        {/* Operating Context Banner */}
        <div className="p-7 md:p-9 rounded-3xl border border-blue-100 bg-white shadow-xs relative overflow-hidden card-print">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
              <Globe2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Global remote context</span>
            </div>
            <p className="text-slate-800 text-lg md:text-xl font-normal leading-relaxed text-pretty">
              &ldquo;{wayOfWorking.context}&rdquo;
            </p>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-sm text-slate-700 font-medium flex items-start gap-3">
              <Compass className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Asynchronous work:</strong> {wayOfWorking.timeZonePhilosophy}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Way of Working Navigation */}
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-200/70 w-fit no-print">
            <button
              type="button"
              onClick={() => setActiveTab("how-we-work")}
              className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition ${
                activeTab === "how-we-work"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              How we work
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("challenges")}
              className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition ${
                activeTab === "challenges"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Challenges and adjustments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("leadership")}
              className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition ${
                activeTab === "leadership"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Leadership and 1:1s
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("focus-areas")}
              className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition ${
                activeTab === "focus-areas"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Architecture and strategy
            </button>
          </div>

          {/* TAB 1: How We Work */}
          {activeTab === "how-we-work" && (
            <div className="grid md:grid-cols-3 gap-6">
              {wayOfWorking.howWeWork.map((practice, idx) => (
                <div
                  key={practice.title}
                  className="p-7 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 space-y-4 flex flex-col justify-between card-print"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                        {idx === 0 ? (
                          <FileCode2 className="w-5 h-5 text-blue-600" />
                        ) : idx === 1 ? (
                          <Sparkles className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Workflow className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-400">0{idx + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{practice.title}</h3>
                      <p className="text-xs text-blue-700 font-medium mt-0.5">{practice.subtitle}</p>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-light">{practice.summary}</p>
                  </div>
                  <ul className="space-y-2 pt-4 border-t border-slate-100 text-xs text-slate-600">
                    {practice.details.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold mt-0.5">✦</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: Challenges and Adjustments */}
          {activeTab === "challenges" && (
            <div className="grid md:grid-cols-3 gap-6">
              {wayOfWorking.challengesAndAdjustments.map((item, idx) => (
                <div
                  key={item.title}
                  className="p-7 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 space-y-4 flex flex-col justify-between card-print"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                        {idx === 0 ? (
                          <GitPullRequest className="w-5 h-5 text-amber-700" />
                        ) : idx === 1 ? (
                          <CalendarDays className="w-5 h-5 text-amber-700" />
                        ) : (
                          <LifeBuoy className="w-5 h-5 text-amber-700" />
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-400">0{idx + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{item.title}</h3>
                      <p className="text-xs text-amber-800 font-medium mt-0.5">{item.subtitle}</p>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-light">{item.summary}</p>
                  </div>
                  <ul className="space-y-2 pt-4 border-t border-slate-100 text-xs text-slate-600">
                    {item.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold mt-0.5">✦</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Leadership Style and 1:1s */}
          {activeTab === "leadership" && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                {wayOfWorking.leadershipStyle.points.map((pt, idx) => (
                  <div
                    key={pt.label}
                    className="p-7 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 space-y-3 card-print"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                        {idx === 0 ? (
                          <Code2 className="w-5 h-5 text-blue-600" />
                        ) : idx === 1 ? (
                          <MessageSquareHeart className="w-5 h-5 text-blue-600" />
                        ) : idx === 2 ? (
                          <Target className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Users2 className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-base">{pt.label}</h4>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-light">{pt.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Architecture & Strategy Focus Areas */}
          {activeTab === "focus-areas" && (
            <div className="grid sm:grid-cols-2 gap-6">
              {profile.about.focusAreas.map((area, idx) => (
                <div
                  key={area.title}
                  className="p-7 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 space-y-3 card-print"
                >
                  <div className="flex items-center gap-3.5 mb-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                      {idx === 0 ? (
                        <Layers className="w-5 h-5 text-blue-600" />
                      ) : idx === 1 ? (
                        <Globe2 className="w-5 h-5 text-blue-600" />
                      ) : idx === 2 ? (
                        <Cpu className="w-5 h-5 text-blue-600" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-base">{area.title}</h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed font-light">{area.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
