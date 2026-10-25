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
  title: "How I Build Software with AI",
  subtitle:
    "A specification-driven engineering methodology combining rigorous product clarity with agentic code generation and uncompromising human verification.",
  featureWorkflow: [
    {
      num: "01",
      title: "Understand the Product",
      iconName: "Lightbulb",
      summary: "Every feature starts with deep problem clarity, not code.",
      body: [
        "Every feature starts with understanding the real user problem.",
        "I partner closely with Product and Design to deconstruct requirements, identify edge cases early, and define success metrics.",
        "Only once the core problem and customer expectations are crystal clear do I begin thinking about implementation.",
      ],
    },
    {
      num: "02",
      title: "Challenge the Requirements",
      iconName: "MessageSquare",
      summary: "Use LLMs to aggressively interrogate assumptions before building.",
      body: [
        "Once a PRD or technical proposal is drafted, I feed it into an LLM.",
        "The objective is not code generation—it is challenging assumptions.",
        "I direct the AI to expose ambiguities, surface unhandled edge cases, question architectural trade-offs, and stress-test the model before a single line of code is written.",
      ],
    },
    {
      num: "03",
      title: "Build the Implementation Prompt",
      iconName: "FileText",
      summary: "Crafting unambiguous, specification-driven contracts for coding agents.",
      body: [
        "After stress-testing requirements, I synthesize a comprehensive implementation brief.",
        "This specification contains everything necessary for deterministic, high-quality agentic implementation:",
      ],
      bullets: [
        "Product objectives & acceptance criteria",
        "Target architecture & module boundaries",
        "Technical constraints & backwards-compatibility requirements",
        "Specific coding conventions, lint rules, and test mandates",
        "Rollout considerations & failure modes",
      ],
      tail: "The fidelity of the implementation is a direct reflection of the clarity of the specification.",
    },
    {
      num: "04",
      title: "Agentic Implementation",
      iconName: "Terminal",
      summary: "Autonomous execution within isolated worktrees guided by strict plans.",
      body: [
        "I leverage agentic workflows to execute implementation.",
        "Rather than impulsively generating code, the agent follows a disciplined sequence:",
      ],
      bullets: [
        "Scans the codebase to understand established patterns",
        "Maps dependencies and surrounding architecture",
        "Raises clarifying questions and flags unknowns",
        "Produces a step-by-step implementation plan for review",
      ],
      tail:
        "Only once the plan is verified does code generation proceed. All development takes place inside isolated Git worktrees, allowing multiple parallel tracks with zero workspace pollution.",
    },
    {
      num: "05",
      title: "Meticulous Human Review",
      iconName: "Eye",
      summary: "Treating AI-generated code with the same scrutiny as human PRs.",
      body: ["Every generated change is reviewed manually. I scrutinize:"],
      bullets: [
        "Logical correctness and boundary conditions",
        "Long-term maintainability and readability",
        "Architectural consistency with monorepo patterns",
        "Runtime performance and memory profiles",
        "True product behaviour against specifications",
      ],
      tail:
        "Because coding agents adhere strictly to repository rules and design systems, reviews focus on design judgment rather than surface-level formatting.",
    },
    {
      num: "06",
      title: "Hands-on Verification & Tests",
      iconName: "CheckCircle2",
      summary: "Automated test suites paired with rigorous local manual verification.",
      body: ["Before proposing or merging any pull request, I:"],
      bullets: [
        "Execute automated test suites and verify clean exits",
        "Run the feature locally to validate end-to-end user flows",
        "Probe real-world failure modes and latency limits",
        "Confirm zero regressions against existing contracts",
      ],
      tail: "Only after passing full verification is work handed to QA and scheduled for release.",
    },
    {
      num: "07",
      title: "Continuous Process Codification",
      iconName: "Layers",
      summary: "Turning repeated patterns into durable skills and guidelines.",
      body: [
        "As we deliver features, I continuously identify recurring friction and patterns.",
        "Whenever a repeated debugging pattern or scaffolding routine emerges, I codify it into reusable agentic skills, rules, or tooling scripts.",
        "This compound learning permanently accelerates subsequent iterations across the entire squad.",
      ],
    },
  ],
  debugWorkflow: [
    {
      num: "01",
      title: "Triage & Blast Radius",
      iconName: "Search",
      summary: "Narrowing the problem space before touching any code.",
      body: [
        "Before writing a single fix, I locate the exact failure boundary.",
        "This involves collecting telemetry, analyzing customer session logs, reproducing the issue in an isolated test, and scoping the blast radius.",
      ],
    },
    {
      num: "02",
      title: "Systematic Root-Cause Analysis",
      iconName: "GitBranch",
      summary: "Disciplined hypothesis testing rather than guesswork.",
      body: [
        "Once reproducible, I provide a concise synopsis to the diagnostic agent.",
        "The agent executes a systematic root-cause sequence: inspecting stack traces, validating state transitions, and formulating testable hypotheses.",
      ],
    },
    {
      num: "03",
      title: "Targeted Implementation",
      iconName: "Wrench",
      summary: "Minimal blast radius patch adhering to project invariants.",
      body: [
        "The agent implements the targeted fix alongside a regression test that fails before the patch and passes after it.",
      ],
    },
    {
      num: "04",
      title: "Verification & Release",
      iconName: "SquareCheck",
      summary: "Regression confirmation and safe rollout.",
      body: [
        "Every fix is reviewed manually and verified against staging environments prior to production inclusion in our bi-weekly release cadence.",
      ],
    },
  ],
  principles: [
    {
      title: "AI accelerates execution, not thinking",
      body:
        "Code generation is no longer the bottleneck. True problem formulation, architectural design, and empathy for the user are where value is created.",
    },
    {
      title: "Better prompts come from better specifications",
      body:
        "The quality and elegance of generated software is a direct function of the intellectual rigor and clarity in the engineering specification behind it.",
    },
    {
      title: "Code review is non-negotiable",
      body:
        "Every change is inspected as though written by an external engineer. AI-generated code must earn trust through rigorous verification—never assume it.",
    },
    {
      title: "Codified workflows compound indefinitely",
      body:
        "One-off prompts provide ephemeral wins. Reusable skills, lint rules, and codified architecture guidelines compound velocity across the entire organization.",
    },
    {
      title: "Engineering judgment remains human",
      body:
        "Trade-offs, failure resilience, people leadership, and system aesthetics remain human responsibilities. AI enables engineering leaders to operate at 10x leverage.",
    },
  ],
};
