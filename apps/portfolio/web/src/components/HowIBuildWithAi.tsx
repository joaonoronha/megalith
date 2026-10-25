import { useState } from "react";
import {
  Lightbulb,
  MessageSquare,
  FileText,
  Terminal,
  Eye,
  CheckCircle2,
  Layers,
  Search,
  GitBranch,
  Wrench,
  SquareCheck,
  Sparkles,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { aiWorkflowData } from "@/data/ai-workflow";

interface HowIBuildWithAiProps {
  onBack?: () => void;
  isStandalone?: boolean;
}

export function HowIBuildWithAi({ onBack, isStandalone = false }: HowIBuildWithAiProps) {
  const [activeTab, setActiveTab] = useState<"feature" | "debug">("feature");

  const getStepIcon = (iconName: string) => {
    switch (iconName) {
      case "Lightbulb":
        return <Lightbulb className="w-5 h-5 text-blue-600" />;
      case "MessageSquare":
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case "FileText":
        return <FileText className="w-5 h-5 text-blue-600" />;
      case "Terminal":
        return <Terminal className="w-5 h-5 text-blue-600" />;
      case "Eye":
        return <Eye className="w-5 h-5 text-blue-600" />;
      case "CheckCircle2":
        return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
      case "Layers":
        return <Layers className="w-5 h-5 text-blue-600" />;
      case "Search":
        return <Search className="w-5 h-5 text-blue-600" />;
      case "GitBranch":
        return <GitBranch className="w-5 h-5 text-blue-600" />;
      case "Wrench":
        return <Wrench className="w-5 h-5 text-blue-600" />;
      case "SquareCheck":
        return <SquareCheck className="w-5 h-5 text-blue-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-blue-600" />;
    }
  };

  const currentWorkflow =
    activeTab === "feature" ? aiWorkflowData.featureWorkflow : aiWorkflowData.debugWorkflow;

  return (
    <div id="ai-workflow" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      {/* Optional Standalone Header Back Action */}
      {isStandalone && onBack && (
        <div className="mb-10 no-print">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-400 transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to main portfolio</span>
          </button>
        </div>
      )}

      {/* Section Header */}
      <div className="max-w-3xl mb-14">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-blue-600 font-bold mb-4">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Engineering Methodology</span>
        </div>
        <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight text-slate-900 text-balance font-normal">
          How I build software with{" "}
          <span className="italic text-blue-600 font-medium">
            AI agents
          </span>
          .
        </h2>
        <p className="mt-6 text-slate-600 text-lg md:text-xl font-light leading-relaxed text-pretty">
          {aiWorkflowData.subtitle}
        </p>
      </div>

      {/* Workflow Tabs Switcher */}
      <div className="flex flex-wrap items-center gap-3 p-1.5 rounded-2xl bg-slate-100 border border-slate-200 w-fit mb-12 shadow-2xs no-print">
        <button
          type="button"
          onClick={() => setActiveTab("feature")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === "feature"
              ? "bg-blue-600 text-white font-bold shadow-xs"
              : "text-slate-700 hover:text-slate-900"
          }`}
        >
          Feature Delivery Sequence (7 Stages)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("debug")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
            activeTab === "debug"
              ? "bg-blue-600 text-white font-bold shadow-xs"
              : "text-slate-700 hover:text-slate-900"
          }`}
        >
          Systematic Diagnostics &amp; Bug Fixing
        </button>
      </div>

      {/* Workflow Steps Pipeline */}
      <div className="relative border-l-2 border-slate-200 ml-5 sm:ml-7 space-y-10 pb-8">
        {currentWorkflow.map((step) => (
          <div key={step.num} className="relative pl-8 sm:pl-10">
            {/* Step badge on left axis */}
            <div className="absolute -left-[21px] sm:-left-[23px] top-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-200 bg-white text-blue-700 font-mono text-xs font-bold shadow-sm">
              {step.num}
            </div>

            {/* Step Card */}
            <div className="p-6 md:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition space-y-4 card-print">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                    {getStepIcon(step.iconName)}
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl text-slate-900 font-medium">
                    {step.title}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-semibold">
                  Stage {step.num}
                </span>
              </div>

              <p className="text-blue-700 text-sm font-bold">{step.summary}</p>

              <div className="space-y-3 text-slate-600 text-base leading-relaxed font-light">
                {step.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {step.bullets && (
                <ul className="space-y-2 pt-2 border-t border-slate-100 text-sm text-slate-700">
                  {step.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-blue-600 font-serif mt-0.5">✦</span>
                      <span className="font-light">{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {step.tail && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 italic">
                  {step.tail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Core Principles Section */}
      <div className="mt-20 pt-16 border-t border-slate-200">
        <div className="max-w-2xl mb-10">
          <div className="text-xs uppercase tracking-[0.25em] text-blue-600 font-bold mb-2">
            Philosophy
          </div>
          <h3 className="font-serif text-3xl md:text-4xl text-slate-900 font-normal">
            Guiding Principles for AI-Native Engineering
          </h3>
          <p className="mt-2 text-slate-500 text-sm font-light">
            How we maintain architectural integrity, human ownership, and long-term maintainability.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {aiWorkflowData.principles.map((pr, idx) => (
            <div
              key={pr.title}
              className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition space-y-3 card-print"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs text-blue-700 font-bold px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200">
                  0{idx + 1}
                </span>
                <h4 className="font-bold text-slate-900 text-base">{pr.title}</h4>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-light">{pr.body}</p>
            </div>
          ))}

          {/* Golden Rule Card */}
          <div className="p-6 rounded-2xl border border-blue-200 bg-blue-50/70 space-y-3 sm:col-span-2 lg:col-span-1 card-print">
            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 text-blue-700" />
              <span>The Cardinal Invariant</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-normal">
              Never let an agent guess what a human engineer should have specified. High velocity is a byproduct of high
              clarity, not rapid prompt iteration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
