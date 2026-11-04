export interface WorkflowStepItem {
  num: string;
  title: string;
  iconName: string;
  summary: string;
  body: string[];
  bullets?: string[];
  tail?: string;
}

export interface PrincipleItem {
  title: string;
  body: string;
}

export interface AiWorkflowData {
  title: string;
  subtitle: string;
  featureWorkflow: WorkflowStepItem[];
  debugWorkflow: WorkflowStepItem[];
  principles: PrincipleItem[];
}

export const aiWorkflowData: AiWorkflowData = {
  title: "How We Work and Build with AI",
  subtitle:
    "A spec-first approach for remote teams: clear technical contracts, practical AI assistance, local verification, and early deadlock resolution.",
  featureWorkflow: [
    {
      num: "01",
      title: "Spec-first development",
      iconName: "FileText",
      summary: "Write architecture specs and review them in pull requests before writing code.",
      body: [
        "Before writing code, engineers write an architecture spec and review it in a pull request.",
        "Getting agreement on system constraints upfront cuts down on meetings and gives teammates in other time zones the context they need to work independently.",
        "This prevents costly rewrites late in a release cycle and makes system design explicit.",
      ],
      bullets: [
        "Architecture specs reviewed in pull requests before implementation",
        "Early agreement on data models, system boundaries, and constraints",
        "Fewer sync meetings and greater autonomy across time zones",
      ],
    },
    {
      num: "02",
      title: "AI-assisted scaffolding and planning",
      iconName: "Terminal",
      summary: "Scaffold boilerplate code and break down implementation steps.",
      body: [
        "Once a spec is settled, we use AI tools to scaffold boilerplate code and break down implementation steps.",
        "I review the plan with the engineer to confirm it matches our platform patterns and design system.",
        "AI handles mechanical boilerplate, while engineers stay focused on system architecture and product logic.",
      ],
      bullets: [
        "Scaffolding component boilerplate and type definitions with AI tools",
        "Breaking large features into modular, reviewable pull requests",
        "Reviewing implementation plans before code generation",
      ],
    },
    {
      num: "03",
      title: "Breaking discussion deadlocks",
      iconName: "GitBranch",
      summary: "Direct investigation, quick prototypes, and practical testing.",
      body: [
        "When async discussions drag on, I step in to investigate the issue directly or use AI tools to build quick prototypes and evaluate trade-offs with domain experts in Confluence.",
        "If a thread stops making progress, we pick a direction, ship an initial version, and adjust based on real results.",
      ],
      bullets: [
        "Investigating directly when discussions stall in tickets or comment threads",
        "Building quick prototypes to test assumptions in hours instead of days",
        "Evaluating trade-offs with domain experts in Confluence",
        "Picking a clear direction, shipping an initial version, and adjusting from real usage",
      ],
    },
    {
      num: "04",
      title: "Local build verification and QA walkthroughs",
      iconName: "CheckCircle2",
      summary: "Verify builds locally and record walkthroughs for QA.",
      body: [
        "I verify builds locally to check real-world behavior, edge cases, and performance before merging.",
        "To make handoffs smooth across time zones, engineers record short video walkthroughs showing the flow, test coverage, and key paths for QA.",
      ],
      bullets: [
        "Local build execution and automated test verification",
        "Recorded video walkthroughs for QA teammates in other time zones",
        "Clear validation checklists that speed up test sign-off",
      ],
    },
    {
      num: "05",
      title: "Managing review queues",
      iconName: "Eye",
      summary: "Simplified checklists, prompt reciprocal reviews, and cross-project reviews.",
      body: [
        "Generating code faster with AI quickly overwhelmed our review queue.",
        "We simplified our review checklist to focus on maintainability, readability, and consistency with existing patterns.",
        "We set an expectation that engineers review incoming PRs promptly if they want their own reviewed quickly, and I ask engineers to review code across project boundaries to help clear backlogs.",
      ],
      bullets: [
        "Simplified review checklist prioritizing maintainability over formatting nitpicks",
        "Reciprocal review expectations: review incoming PRs promptly to keep work moving",
        "Cross-project review allocation to clear queue backlogs and prevent knowledge silos",
      ],
    },
    {
      num: "06",
      title: "Public ship summaries",
      iconName: "Sparkles",
      summary: "Keep distributed teams aligned with transparent release updates.",
      body: [
        "When changes ship, we post brief summaries in public channels so Product, Design, QA, and adjacent engineering teams know what went out.",
        "This keeps everyone informed across our bi-weekly release schedule without requiring extra sync meetings.",
      ],
      bullets: [
        "Clear release notes with visual demos and links to documentation",
        "Instant visibility for Product, Support, and adjacent engineering teams",
        "Consistent communication across our customer-facing products",
      ],
    },
    {
      num: "07",
      title: "Dedicated maintenance and quick pivots",
      iconName: "Layers",
      summary: "Reserve sprint capacity for maintenance and handle priority shifts smoothly.",
      body: [
        "I always reserve sprint capacity for KTLO (keep-the-lights-on) work so maintenance and live escalations don't derail planned deliverables.",
        "At the same time, I am used to fast-paced environments where priorities can shift from one week to the next.",
        "When we need to pivot mid-cycle, we discuss the trade-offs with stakeholders right away and realign team scope to the new direction.",
      ],
      bullets: [
        "Protected sprint capacity prevents maintenance from delaying roadmap deliverables",
        "Readiness to handle mid-cycle priority adjustments without confusion",
        "Immediate trade-off discussions with stakeholders when project scope changes",
      ],
    },
  ],
  debugWorkflow: [
    {
      num: "01",
      title: "Direct investigation and triage",
      iconName: "Search",
      summary: "Isolate root causes before writing code.",
      body: [
        "Before touching code, we isolate the failure boundary using telemetry, customer logs, and reproducible tests in isolated environments.",
        "I step in directly whenever an engineer is stuck on a hard operational issue.",
      ],
    },
    {
      num: "02",
      title: "Quick prototypes and trade-offs",
      iconName: "GitBranch",
      summary: "Test hypotheses with domain experts.",
      body: [
        "We formulate testable hypotheses and use AI tools to quickly generate minimal reproducers and patch prototypes.",
        "We evaluate architectural trade-offs in Confluence with domain specialists before settling on a permanent fix.",
      ],
    },
    {
      num: "03",
      title: "Targeted fix and regression tests",
      iconName: "Wrench",
      summary: "Minimal patch paired with automated test coverage.",
      body: [
        "We implement the targeted fix alongside a regression test that fails before the patch and cleanly passes afterward.",
      ],
    },
    {
      num: "04",
      title: "Verification and release",
      iconName: "SquareCheck",
      summary: "Local build verification, recorded walkthrough, and release inclusion.",
      body: [
        "The fix is verified locally, accompanied by a quick walkthrough video, reviewed promptly via cross-project PR, and rolled out safely in our bi-weekly release schedule.",
      ],
    },
  ],
  principles: [
    {
      title: "Asynchronous teams need written clarity and obvious priorities",
      body:
        "Working across wide time zones (North America, Europe, Asia-Pacific) taught me that remote teams only stay aligned when technical plans are written down clearly and team priorities are obvious.",
    },
    {
      title: "Spec-first development reduces meetings",
      body:
        "Reviewing architecture specs in pull requests before coding cuts down on sync meetings and gives teammates across time zones the context to work independently.",
    },
    {
      title: "Prototypes resolve discussions faster than comments",
      body:
        "When discussions drag on, building a quick prototype and testing real trade-offs beats circular debates. Pick a direction, ship an initial version, and adjust from real results.",
    },
    {
      title: "Review speed must match generation speed",
      body:
        "Generating code faster with AI can quickly overwhelm review queues. Simplified checklists, reciprocal reviews, and cross-project support keep pull requests moving.",
    },
    {
      title: "Proactive planning preserves product continuity",
      body:
        "Partnering closely with product managers on quarterly planning sheets (LOE, target dates, design dependencies, 30/60/90-day Gantt charts) keeps execution stable through team changes.",
    },
    {
      title: "Reserve maintenance capacity to protect commitments",
      body:
        "Reserving sprint capacity for maintenance and live escalations keeps roadmap work predictable, while giving the team room to handle mid-cycle pivots.",
    },
    {
      title: "Stay close to the code and support the team",
      body:
        "I stay close to the code by pair programming and reviewing complex changes. In 1:1s, we walk through trade-offs together so engineers make the technical call.",
    },
  ],
};
