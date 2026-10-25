export interface Project {
  name: string;
  icon?: string;
  description: string;
  challenges?: string;
  solution?: string;
  responsibilities?: string[];
  technologies?: string[];
  impact?: string;
  impactPoints?: string[];
}

export interface TechStack {
  frontend?: string[];
  backend?: string[];
  infrastructure?: string[];
  ai?: string[];
  devx?: string[];
}

export interface Leadership {
  teamSize?: string;
  mentoring?: string;
  performanceReviews?: string;
  hiring?: string;
  crossFunctional?: string;
  releaseOwnership?: string;
  qa?: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  period: string;
  short: string;
  overview: string;
  projects?: Project[];
  leadership?: Leadership;
  stack?: TechStack;
  achievements?: string[];
}

export const experience: ExperienceItem[] = [
  {
    id: "dialpad-em",
    company: "Dialpad",
    role: "Engineering Manager",
    period: "Oct 2024 — Present",
    short:
      "Lead a team of 9 engineers delivering the entire Agentic Frontend and the Ingestion Source Pipeline E2E while steering architecture and release cadence.",
    overview:
      "Leading 9 engineers building Dialpad's Agentic AI platform, with full end-to-end ownership across the agentic frontend and ingestion source pipelines. Hands-on in technical strategy, platform architecture, and system design. DRI for QA ↔ Engineering and owner of the bi-weekly beta and production release cadence.",
    projects: [
      {
        name: "Agentic Skill Builder",
        icon: "🧠",
        description:
          "A no-code surface that lets non-technical users author and orchestrate AI agents through prompts, guardrails, and MCP actions.",
        challenges:
          "Designing a safe authoring model where non-engineers compose LLM behaviour, tool calls, and guardrails without producing brittle or unpredictable agents.",
        responsibilities: [
          "Owned end-to-end architecture and technical delivery",
          "Designed the ProseMirror-based interactive editor and real-time LLM-powered linter",
          "Partnered closely with Product and Design on the human authoring paradigm",
        ],
        technologies: ["Vue 3", "TypeScript", "ProseMirror", "MCP", "Claude"],
        impact:
          "Unlocked agent creation for non-technical teams across a customer base of 70,000+ organisations.",
      },
      {
        name: "Ingestion Source Pipeline E2E",
        icon: "⚡",
        description:
          "End-to-end architecture connecting customer enterprise knowledge sources into the Dialpad agentic ecosystem.",
        challenges:
          "Handling heterogeneous external data sources, ensuring high-throughput extraction and resilient synchronization without impacting conversational latency.",
        responsibilities: [
          "Steered end-to-end architecture across frontend configuration and ingestion worker pipelines",
          "Established robust verification and error recovery protocols",
        ],
        technologies: ["TypeScript", "Node.js", "Python", "GCP Datastore", "Kafka"],
        impact:
          "Drives automated context injection for enterprise agents with zero customer engineering required.",
      },
      {
        name: "Skill Mining",
        icon: "🔍",
        description:
          "Automated discovery of reusable agent skills from real customer voice and chat conversations to seed the Skill Builder.",
        responsibilities: [
          "Shaped the technical approach with Product, Engineering, and ML squads",
          "Owned the frontend architecture, UX flow, and delivery",
        ],
        technologies: ["Vue 3", "TypeScript", "LLM Pipelines"],
        impact:
          "Eliminated the cold-start problem for new enterprise agent deployments by surfacing high-signal skills automatically.",
      },
      {
        name: "Agentic Frontend Platform",
        icon: "🚀",
        description:
          "The shared frontend foundation and component primitives that 50+ engineers across the company build agentic products on.",
        responsibilities: [
          "Defined core architectural patterns, design tokens, and Dialtone integration",
          "Onboarded and mentored engineers across multiple squads",
        ],
        technologies: ["Vue 3", "TypeScript", "Dialtone", "Vite"],
        impact:
          "Standardised how agentic surfaces are built org-wide, drastically cutting time-to-first-feature for new teams.",
      },
    ],
    leadership: {
      teamSize: "9 direct reports",
      mentoring: "1:1s, professional growth plans, career pathing, and architectural coaching",
      performanceReviews: "Full-cycle performance reviews, calibration, and compensation alignment",
      hiring: "Delivered team expansion, hiring panels, and career promotions",
      crossFunctional: "Continuous partnership with Product, Design, QA, and Machine Learning",
      releaseOwnership: "Owner of bi-weekly production and beta release cadence",
      qa: "DRI for QA ↔ Engineering coordination and test health",
    },
    stack: {
      frontend: ["React", "TypeScript", "Vue 3", "ProseMirror", "Dialtone"],
      backend: ["Node.js", "Go", "Python"],
      infrastructure: ["Docker", "Kubernetes", "Google Cloud Datastore"],
      ai: ["Claude", "Model Context Protocol (MCP)", "LLM Linting", "Agentic Workflows"],
      devx: ["Vite", "Spec-Driven Engineering", "LLM-Assisted Delivery"],
    },
    achievements: [
      "Promoted to Engineering Manager leading 9 direct reports",
      "Owner of the platform 50+ engineers build on",
      "Bi-weekly release cadence sustained across production and beta with zero major regressions",
    ],
  },
  {
    id: "dialpad-senior",
    company: "Dialpad",
    role: "Senior Software Engineer",
    period: "May 2023 — Oct 2024",
    short:
      "Led technical initiatives integrating Kare's acquired AI products into Dialpad, rebuilding customer-facing chat and knowledge tooling.",
    overview:
      "Led technical initiatives integrating Kare's acquired AI products into Dialpad, rebuilding customer-facing chat and knowledge tooling and modernising the codebase to modern TypeScript and component architectures.",
    projects: [
      {
        name: "Customer Chat Rebuild",
        icon: "💬",
        description:
          "Rewrote the customer-facing chat product on top of Dialpad's core design system and real-time infrastructure.",
        responsibilities: [
          "Led frontend architecture and state management redesign",
          "Partnered with Product and Design on the unified UX",
        ],
        technologies: ["Vue 3", "React 17", "Redux", "TypeScript", "Node.js"],
        impact: "Delivered a rock-solid, scalable foundation for AI chat experiences across web and mobile.",
      },
      {
        name: "Knowledge Management Application",
        icon: "📚",
        description:
          "Rebuilt the internal knowledge management application powering AI answers and agent workflows.",
        technologies: ["Vue 3", "TypeScript"],
        impact: "Enabled faster iteration and instant verification for knowledge-backed AI features.",
      },
      {
        name: "TypeScript Organization Migration",
        icon: "🛠️",
        description:
          "Migrated legacy JavaScript surfaces to strict TypeScript across acquired products.",
        impact: "Significantly reduced runtime regressions and accelerated developer velocity.",
      },
    ],
    leadership: {
      mentoring: "Mentored engineers on frontend architecture, state management, and modern tooling",
      crossFunctional: "Close day-to-day partnership with Product and Design",
    },
    stack: {
      frontend: ["Vue 2/3", "React 17", "Redux", "TypeScript", "JavaScript"],
      backend: ["Node.js"],
      infrastructure: ["Docker"],
    },
    achievements: [
      "Promoted to Engineering Manager following this role",
      "Outstanding Performance rating",
    ],
  },
  {
    id: "dialpad-swe",
    company: "Dialpad",
    role: "Software Engineer",
    period: "Jun 2021 — May 2023",
    short:
      "Joined through the Kare acquisition and rebuilt AI chat products within the Dialpad ecosystem.",
    overview:
      "Joined Dialpad through the Kare acquisition and contributed to rebuilding AI chat products used across a platform serving 70,000+ customers.",
    projects: [
      {
        name: "AI Chat Integration",
        icon: "🤖",
        description:
          "Contributed to the integration of Kare's AI chat into Dialpad's unified customer experience surfaces.",
        technologies: ["Vue", "TypeScript", "Node.js"],
        impact: "Shipped customer-facing AI chat to 70,000+ customers.",
      },
    ],
    stack: {
      frontend: ["Vue", "React 17", "Redux", "TypeScript", "JavaScript"],
      backend: ["Node.js"],
    },
    achievements: [
      "Two-time Dialpad Hackathon winner",
      "Outstanding Performance rating",
      "Promoted to Senior Software Engineer",
    ],
  },
  {
    id: "hugo-boss",
    company: "Hugo Boss — Lisbon Nearshore",
    role: "Frontend Developer",
    period: "2018 — 2021",
    short:
      "Led frontend development across enterprise applications and owned multiple internal products end-to-end.",
    overview:
      "Led frontend development across enterprise applications at Hugo Boss's Lisbon Nearshore hub, owning multiple products and building vendor integration platforms.",
    projects: [
      {
        name: "Profit Calculation Platform",
        icon: "📊",
        description:
          "A business-critical enterprise application used by Hugo Boss to calculate the profitability of individual clothing items globally.",
        challenges:
          "A legacy ASP.NET application with high technical debt that had become difficult to maintain and evolve without risking critical financial reporting.",
        solution:
          "Refactored the application, modernizing large parts of the codebase while preserving all business-critical accounting logic.",
        impactPoints: [
          "Improved maintainability of a business-critical application",
          "Substantially reduced technical debt in a complex codebase",
          "Enabled continuous feature evolution without disrupting day-to-day fashion business operations",
        ],
        technologies: ["ASP.NET", "C#", "jQuery", "Kendo UI"],
      },
      {
        name: "Digital Showroom",
        icon: "👔",
        description:
          "Enabled internal teams and global partners to browse and manage clothing collections digitally.",
        challenges:
          "Required high-fidelity visual rendering, rapid search, and fluid performance across diverse partner devices.",
        solution:
          "Contributed to the development and maintenance of the platform, collaborating with cross-functional European teams for stable releases.",
        impactPoints: [
          "Delivered new interactive functionality for enterprise wholesale buyers",
          "Maintained a high-reliability platform supporting multi-market fashion collections",
        ],
        technologies: ["Angular", "Node.js", "TypeScript"],
      },
    ],
    leadership: {
      crossFunctional: "Worked across distributed enterprise teams and external international vendors",
    },
    stack: {
      frontend: ["Angular", "TypeScript", "jQuery", "Kendo UI"],
      backend: ["ASP.NET", "C#", "Node.js"],
    },
    achievements: ["Owned multiple enterprise products end-to-end across full lifecycles"],
  },
  {
    id: "att",
    company: "AT&T",
    role: "Backup, Storage & Automation Specialist",
    period: "2017 — 2018",
    short:
      "Served as EMEA automation SME, orchestrating backup automation across 10,000+ Linux servers.",
    overview:
      "Worked as the Automation Subject Matter Expert for the EMEA Backup & Storage organisation, building internal automation platforms, developer tooling, and operational systems that eliminated manual work across enterprise infrastructure fleets.",
    projects: [
      {
        name: "Enterprise Backup Upgrade Automation",
        icon: "⚙️",
        description:
          "Automated backup software upgrades across a fleet of 10,000+ Linux servers.",
        challenges:
          "Upgrading backup software across 10,000+ production Linux servers was a manual, high-risk operational chore requiring extensive manual intervention.",
        solution:
          "Designed and developed a Python-based automation platform that orchestrated upgrade execution, validation, pre-flight checks, and reporting across the fleet.",
        impactPoints: [
          "Successfully automated upgrades across 10,000+ Linux servers",
          "Eliminated hundreds of hours of manual operational risk",
          "Drastically increased upgrade reliability and repeatability across data centers",
          "Enabled operations to execute upgrades in parallel with zero downtime",
        ],
        technologies: ["Python", "Shell Scripting", "Linux"],
      },
      {
        name: "Internal Automation Platform",
        icon: "🔧",
        description:
          "Developed operational scripts and internal tooling to streamline workflows across the EMEA Backup & Storage organization.",
        challenges:
          "Daily infrastructure operations were slowed down by disparate, manual checks and disparate storage vendor interfaces.",
        solution:
          "Standardized common workflows with Python scripts and command-line automation adopted across regional engineering pods.",
        impactPoints: [
          "Reduced manual operational overhead across EMEA",
          "Improved consistency and auditability of day-to-day infrastructure changes",
        ],
        technologies: ["Python", "Bash", "Enterprise Storage"],
      },
    ],
    stack: {
      backend: ["Python", "Shell Scripting"],
      infrastructure: ["Linux", "Enterprise Backup Systems"],
      devx: ["Internal Tooling", "Process Automation", "Operational Platforms"],
    },
    achievements: [
      "Automation Subject Matter Expert for the EMEA Backup & Storage organisation",
      "Designed and delivered an automation platform used to upgrade 10,000+ Linux servers",
      "Built internal developer tooling that eliminated hundreds of hours of operational overhead",
    ],
  },
];
