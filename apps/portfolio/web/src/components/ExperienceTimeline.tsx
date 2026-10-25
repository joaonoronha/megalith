import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Award, Briefcase, Terminal } from "lucide-react";
import { experience, ExperienceItem, Project } from "@/data/experience";

export function ExperienceTimeline() {
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({
    "dialpad-em": true,
    "dialpad-senior": true,
  });

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    "Agentic Skill Builder": true,
    "Ingestion Source Pipeline E2E": true,
  });

  const toggleRole = (id: string) => {
    setExpandedRoles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleProject = (name: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  return (
    <section id="experience" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      {/* Section Header */}
      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <div className="md:col-span-5">
          <div className="text-xs uppercase tracking-[0.25em] text-blue-600 font-bold mb-4">
            02 — Experience
          </div>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight text-slate-900">
            A decade of shipping software.
          </h2>
        </div>
        <div className="md:col-span-7 flex items-end">
          <p className="text-slate-600 text-lg leading-relaxed font-light">
            From hands-on full-stack development and enterprise infrastructure automation to leading agentic engineering
            divisions and setting org-wide architectural standards.
          </p>
        </div>
      </div>

      {/* Roles Timeline */}
      <div className="space-y-10">
        {experience.map((item) => (
          <RoleCard
            key={item.id}
            item={item}
            isExpanded={!!expandedRoles[item.id]}
            onToggle={() => toggleRole(item.id)}
            expandedProjects={expandedProjects}
            onToggleProject={toggleProject}
          />
        ))}
      </div>
    </section>
  );
}

interface RoleCardProps {
  item: ExperienceItem;
  isExpanded: boolean;
  onToggle: () => void;
  expandedProjects: Record<string, boolean>;
  onToggleProject: (name: string) => void;
}

function RoleCard({
  item,
  isExpanded,
  onToggle,
  expandedProjects,
  onToggleProject,
}: RoleCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden card-print">
      {/* Role Header */}
      <div
        onClick={onToggle}
        className="p-6 md:p-8 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-serif text-2xl md:text-3xl text-slate-900 font-medium">
              {item.role}
            </span>
            <span className="text-blue-600 font-bold text-lg">@{item.company}</span>
          </div>
          <p className="text-slate-600 text-sm max-w-2xl font-light">{item.short}</p>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
          <span className="px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-semibold">
            {item.period}
          </span>
          <button
            type="button"
            aria-label={isExpanded ? "Collapse role details" : "Expand role details"}
            className="p-2 rounded-full hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 transition no-print"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Role Body */}
      <div className={`${isExpanded ? "block" : "hidden md:hidden"} print-expand p-6 md:p-8 space-y-8`}>
        {/* Role Overview */}
        <p className="text-slate-700 text-base md:text-lg leading-relaxed font-light">{item.overview}</p>

        {/* Leadership Details (if present) */}
        {item.leadership && (
          <div className="p-6 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-3.5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-blue-700 font-bold">
              <Users className="w-4 h-4" />
              <span>Leadership &amp; People Operations</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {item.leadership.teamSize && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-500 text-xs block mb-0.5">Team Scope</span>
                  <span className="text-slate-900 font-bold">{item.leadership.teamSize}</span>
                </div>
              )}
              {item.leadership.crossFunctional && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-500 text-xs block mb-0.5">Cross-Functional DRI</span>
                  <span className="text-slate-900 font-bold">{item.leadership.crossFunctional}</span>
                </div>
              )}
              {item.leadership.releaseOwnership && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-500 text-xs block mb-0.5">Release Cadence</span>
                  <span className="text-slate-900 font-bold">{item.leadership.releaseOwnership}</span>
                </div>
              )}
              {item.leadership.qa && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-500 text-xs block mb-0.5">QA &amp; Release Health</span>
                  <span className="text-slate-900 font-bold">{item.leadership.qa}</span>
                </div>
              )}
              {item.leadership.mentoring && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-500 text-xs block mb-0.5">Growth &amp; Mentoring</span>
                  <span className="text-slate-900 font-bold">{item.leadership.mentoring}</span>
                </div>
              )}
              {item.leadership.performanceReviews && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                  <span className="text-slate-500 text-xs block mb-0.5">Performance Reviews</span>
                  <span className="text-slate-900 font-bold">{item.leadership.performanceReviews}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Featured Projects */}
        {item.projects && item.projects.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-600 font-bold">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span>Key Initiatives &amp; Architectural Deliveries</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {item.projects.map((proj) => (
                <ProjectCard
                  key={proj.name}
                  project={proj}
                  isExpanded={!!expandedProjects[proj.name]}
                  onToggle={() => onToggleProject(proj.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tech Stack Pills */}
        {item.stack && (
          <div className="pt-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-600 font-bold mb-3">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>Technologies &amp; Systems Used</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(item.stack).flatMap(([category, list]) =>
                ((list as string[]) || []).map((t: string) => (
                  <span
                    key={`${category}-${t}`}
                    className="px-3 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono font-medium shadow-2xs"
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Achievements list */}
        {item.achievements && item.achievements.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-blue-700 font-bold mb-2.5">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Key Outcomes &amp; Recognition</span>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {item.achievements.map((ach) => (
                <li key={ach} className="flex items-start gap-2">
                  <span className="text-blue-600 font-serif mt-0.5">✦</span>
                  <span>{ach}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
}

function ProjectCard({ project, isExpanded, onToggle }: ProjectCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5 hover:border-blue-300 hover:shadow-sm transition shadow-2xs card-print">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" role="img" aria-label="Icon">
            {project.icon || "🚀"}
          </span>
          <h4 className="font-bold text-slate-900 text-base">{project.name}</h4>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? "Hide project details" : "Show project details"}
          className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 font-mono font-bold no-print"
        >
          {isExpanded ? "Collapse" : "Details"}
        </button>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed font-light">{project.description}</p>

      {/* Expandable details */}
      <div className={`${isExpanded ? "block" : "hidden md:hidden"} print-expand space-y-3 text-xs pt-2 border-t border-slate-100`}>
        {project.challenges && (
          <div>
            <span className="font-bold text-slate-800 block mb-0.5">Challenge:</span>
            <p className="text-slate-600 leading-relaxed font-light">{project.challenges}</p>
          </div>
        )}

        {project.solution && (
          <div>
            <span className="font-bold text-blue-700 block mb-0.5">Solution:</span>
            <p className="text-slate-600 leading-relaxed font-light">{project.solution}</p>
          </div>
        )}

        {project.responsibilities && (
          <div>
            <span className="font-bold text-slate-800 block mb-1">Responsibilities:</span>
            <ul className="space-y-1 text-slate-600 pl-3 font-light">
              {project.responsibilities.map((r, i) => (
                <li key={i} className="list-disc">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {project.impact && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
            <span className="font-bold block mb-0.5 text-emerald-950">Impact:</span>
            <p className="font-medium">{project.impact}</p>
          </div>
        )}

        {project.impactPoints && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 shadow-2xs">
            <span className="font-bold block mb-1 text-slate-900">Impact Highlights:</span>
            <ul className="space-y-1 pl-3 font-light">
              {project.impactPoints.map((pt, i) => (
                <li key={i} className="list-disc">
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tech pills */}
      {project.technologies && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {project.technologies.map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono font-medium text-slate-600"
            >
              {tech}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
