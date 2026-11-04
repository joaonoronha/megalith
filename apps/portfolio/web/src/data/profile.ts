export interface StatHighlight {
  key: string;
  label: string;
  description: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface ManagerialPractice {
  title: string;
  subtitle: string;
  summary: string;
  details: string[];
}

export interface ManagerialWayOfWorking {
  context: string;
  timeZonePhilosophy: string;
  howWeWork: ManagerialPractice[];
  challengesAndAdjustments: ManagerialPractice[];
  leadershipStyle: {
    title: string;
    description: string;
    points: { label: string; text: string }[];
  };
}

export interface ProfileData {
  name: string;
  nickname: string;
  role: string;
  company: string;
  location: string;
  status: string;
  headline: string;
  subheadline: string;
  about: {
    lead: string;
    paragraphs: string[];
    focusAreas: { title: string; description: string }[];
  };
  wayOfWorking: ManagerialWayOfWorking;
  highlights: StatHighlight[];
  skills: SkillCategory[];
  achievements: string[];
  contact: {
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    location: string;
  };
}

export const profile: ProfileData = {
  name: "João Noronha",
  nickname: "João N.",
  role: "Engineering Manager",
  company: "Dialpad",
  location: "Lisbon, Portugal",
  status: "Open to engineering leadership conversations",
  headline: "Engineering leader building AI-native products and teams.",
  subheadline:
    "Engineering Manager at Dialpad with ten years shipping SaaS, AI platforms, and developer tooling. I manage fully remote teams across North America, Europe, and Asia-Pacific. I stay close to the code, focus on clear written communication, and build teams where engineers make sound technical decisions.",
  about: {
    lead: "Engineering Manager at Dialpad, running distributed engineering teams across global time zones.",
    paragraphs: [
      "Over the last several years, I have managed fully remote teams of around 15 people across North America, Europe, and Asia-Pacific. The groups included product managers, designers, direct reports, and engineers on loan from other teams.",
      "Working across wide time zones taught me that asynchronous teams only stay aligned when technical plans are written down clearly and team priorities are obvious.",
      "Inside Dialpad's Agentic AI division, I lead the agentic frontend and the ingestion source pipeline end to end, while staying hands-on with architecture and day-to-day implementation.",
    ],
    focusAreas: [
      {
        title: "Frontend platform and ingestion pipelines",
        description:
          "I lead both the shared agentic frontend architecture, which 50+ engineers build on, and the ingestion pipelines that feed customer knowledge into Dialpad's AI systems.",
      },
      {
        title: "Asynchronous team alignment",
        description:
          "I coordinate work across North America, Europe, and Asia-Pacific through written architecture specs, clear priorities, and quarterly roadmaps.",
      },
      {
        title: "Customer-facing AI products",
        description:
          "Led development of the Skill Builder, which lets non-technical teams build agents with prompts, guardrails, and tool integrations, along with Skill Mining from conversation data.",
      },
      {
        title: "Release management and operational health",
        description:
          "DRI for coordination between QA and engineering. I manage our bi-weekly release schedule and reserve sprint capacity for maintenance and live issues.",
      },
    ],
  },
  wayOfWorking: {
    context:
      "Over the last several years, I have managed fully remote teams of around 15 people across North America, Europe, and Asia-Pacific. The groups included product managers, designers, direct reports, and engineers on loan from other teams.",
    timeZonePhilosophy:
      "Working across wide time zones taught me that asynchronous teams only stay aligned when technical plans are written down clearly and team priorities are obvious.",
    howWeWork: [
      {
        title: "Spec-first development",
        subtitle: "Technical alignment before writing code",
        summary:
          "Before writing code, engineers write architecture specs and review them in pull requests. Getting agreement on system constraints upfront cuts down on meetings and gives teammates in other time zones the context they need to work independently.",
        details: [
          "Engineers draft architecture specs and review them in pull requests before implementation",
          "Teams align early on system boundaries, constraints, and dependencies",
          "Cuts down unnecessary meetings and lets distributed teammates work on their own schedule",
        ],
      },
      {
        title: "AI-assisted implementation",
        subtitle: "Scaffold boilerplate, verify locally, share updates publicly",
        summary:
          "Once a spec is settled, we use AI tools to scaffold boilerplate code and break down implementation steps. I review the plan, verify builds locally, and record walkthroughs for QA. When changes ship, we post summaries in public channels so other teams know what went out.",
        details: [
          "Use AI to scaffold repetitive code and map out implementation steps",
          "Review plans with the team and verify builds on local machines",
          "Record short walkthrough videos for QA to speed up review across time zones",
          "Post release summaries in public channels so adjacent teams know what shipped",
        ],
      },
      {
        title: "Breaking discussion deadlocks",
        subtitle: "Direct investigation, quick prototypes, and practical testing",
        summary:
          "When async discussions drag on, I step in to investigate the issue directly or use AI tools to build quick prototypes and evaluate trade-offs with domain experts in Confluence. If a thread stops making progress, we pick a direction, ship an initial version, and adjust based on real results.",
        details: [
          "Investigate directly when discussions stall in comments or tickets",
          "Build quick prototypes to test assumptions in hours instead of days",
          "Work through trade-offs with domain experts in Confluence",
          "Pick a clear direction, ship an initial version, and adjust from real results",
        ],
      },
    ],
    challengesAndAdjustments: [
      {
        title: "PR review bottlenecks",
        subtitle: "Keeping review queues moving alongside fast code generation",
        summary:
          "Generating code faster with AI quickly overwhelmed our review queue. We simplified our review checklist and set an expectation that engineers review incoming PRs promptly if they want their own reviewed quickly. I also asked engineers to review code across project boundaries to help clear backlogs.",
        details: [
          "Trimmed the review checklist to focus on maintainability, readability, and system consistency",
          "Set a reciprocal review norm: review incoming pull requests promptly to keep your own work moving",
          "Encouraged engineers to review code outside their immediate projects to clear backlogs",
        ],
      },
      {
        title: "Product continuity and planning",
        subtitle: "Quarterly planning sheets, 30/60/90-day Gantt charts, and PM onboarding",
        summary:
          "Navigating an early period of frequent PM turnover turned product planning into a permanent part of my role. I now partner closely with PMs to shape the roadmap and produce realistic estimates. Each quarter, I put together a planning sheet detailing what each engineer will work on, level of effort (LOE), target date ranges, and design dependencies, alongside a 30/60/90-day Gantt chart. I also maintain an onboarding guide to help incoming PMs get up to speed quickly.",
        details: [
          "Partner closely with product managers to shape roadmaps and technical estimates",
          "Maintain a quarterly planning sheet tracking engineer assignments, effort levels, dates, and design dependencies",
          "Use a 30/60/90-day Gantt chart to track dependencies across squads",
          "Maintain a practical onboarding guide so new PMs ramp up without losing project momentum",
        ],
      },
      {
        title: "Handling operational load and rapid pivots",
        subtitle: "Dedicated maintenance capacity and straightforward mid-cycle realignment",
        summary:
          "I always reserve sprint capacity for KTLO (keep-the-lights-on) work so maintenance and live escalations don't derail planned deliverables. At the same time, I am used to fast-paced environments where priorities can shift from one week to the next. When we need to pivot mid-cycle, we discuss the trade-offs with stakeholders right away and realign team scope to the new direction.",
        details: [
          "Reserve sprint capacity for maintenance and production escalations",
          "Keep scheduled roadmap work from being derailed by day-to-day operations",
          "Adapt quickly when company priorities shift mid-quarter",
          "Discuss trade-offs with stakeholders immediately and adjust scope without drama",
        ],
      },
    ],
    leadershipStyle: {
      title: "Staying close to the code and supporting the team",
      description:
        "Technical leadership through hands-on involvement, open communication, and an environment where every engineer has ownership.",
      points: [
        {
          label: "Staying close to the code",
          text: "I stay close to the code by pair programming, reviewing complex changes, and stepping in directly when an engineer gets stuck on a hard problem.",
        },
        {
          label: "Open and direct 1:1s",
          text: "In 1:1s, I keep things open and direct. Engineers know they can bring up any question or concern without hesitation. When they need guidance, we walk through scenarios and trade-offs together so they can arrive at the solution and make the call themselves.",
        },
        {
          label: "Consistent feedback",
          text: "I give consistent performance feedback so people always know where they stand and can jump on new opportunities early.",
        },
        {
          label: "Mutual respect",
          text: "Above all, I treat everyone on the team with the same respect, keep myself open to their feedback, and make sure everyone feels comfortable bringing their ideas to the table.",
        },
      ],
    },
  },
  highlights: [
    {
      key: "10+",
      label: "Years shipping software",
      description: "From enterprise refactoring to production AI systems.",
    },
    {
      key: "70k+",
      label: "Customers reached",
      description: "Business communication, contact center, and AI knowledge customers.",
    },
    {
      key: "50+",
      label: "Engineers onboarded",
      description: "Building on shared platform architecture, design tokens, and primitives.",
    },
    {
      key: "~15",
      label: "Remote team members led",
      description: "Direct reports, PMs, designers, and engineers on loan across North America, Europe, and Asia-Pacific.",
    },
  ],
  skills: [
    {
      category: "Frontend & Architecture",
      items: [
        "TypeScript",
        "React",
        "Vue 2 / Vue 3",
        "Redux",
        "ProseMirror",
        "Vite",
        "Tailwind CSS",
        "Dialtone Design System",
      ],
    },
    {
      category: "AI & Systems",
      items: [
        "Model Context Protocol (MCP)",
        "Claude & LLM Workflows",
        "Agentic Skill Authoring",
        "Ingestion Pipelines",
        "LLM-Assisted Linting",
        "RAG Architecture",
      ],
    },
    {
      category: "Backend & Storage",
      items: [
        "Node.js",
        "Python",
        "Go",
        "C# / ASP.NET",
        "PostgreSQL",
        "Google Cloud Datastore",
      ],
    },
    {
      category: "Management & Delivery",
      items: [
        "Spec-First Development",
        "Asynchronous Team Alignment",
        "30/60/90-Day Gantt & Planning",
        "Kubernetes & Docker",
        "CI/CD (GitHub Actions)",
        "Bi-Weekly Releases & KTLO",
      ],
    },
  ],
  achievements: [
    "Managed fully remote teams of ~15 people across North America, Europe, and Asia-Pacific",
    "Promoted from SWE to Senior SWE to Engineering Manager in under three years",
    "Two-time Dialpad Global Hackathon winner",
    "Three consecutive Outstanding Performance ratings",
    "Owned the shared frontend platform that 50+ engineers build on",
    "Introduced spec-first PR reviews, reciprocal review norms, and quarterly roadmap planning",
    "DRI for QA and engineering coordination across bi-weekly production releases",
  ],
  contact: {
    email: "jmdsnoronha@gmail.com",
    phone: "+351 915 861 171",
    linkedin: "https://linkedin.com/in/joaonoronha36",
    github: "https://github.com/joaonoronha",
    location: "Lisbon, Portugal",
  },
};
