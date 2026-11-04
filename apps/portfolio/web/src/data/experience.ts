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
    period: "Oct 2024 - Present",
    short:
      "Manage fully remote teams of ~15 people across North America, Europe, and Asia-Pacific (PMs, designers, direct reports, engineers on loan), leading the Agentic Frontend and Ingestion Source Pipeline end to end.",
    overview:
      "Managing fully remote teams of around 15 people across North America, Europe, and Asia-Pacific, including product managers, designers, direct reports, and engineers on loan from other teams. I lead Dialpad's Agentic Frontend and Ingestion Source Pipeline end to end, coordinating architecture, bi-weekly releases, and asynchronous alignment across time zones.",
    projects: [
      {
        name: "Agentic Skill Builder",
        description:
          "A tool that lets non-technical users build and test AI agents through prompts, guardrails, and tool actions.",
        challenges:
          "Designing an authoring workflow where non-engineers can define agent behavior, tool calls, and safety rules without creating brittle agents.",
        responsibilities: [
          "Led architecture and delivery across the frontend team",
          "Built the ProseMirror-based editor and real-time rule verification",
          "Partnered with Product and Design on the authoring interface",
        ],
        technologies: ["Vue 3", "TypeScript", "ProseMirror", "MCP", "Claude"],
        impact:
          "Allowed non-technical teams to create and test agents across Dialpad's customer base of 70,000+ organizations.",
      },
      {
        name: "Ingestion Source Pipeline",
        description:
          "The data pipeline connecting customer enterprise knowledge sources into Dialpad's AI systems.",
        challenges:
          "Handling diverse third-party data sources, keeping sync reliable, and handling failures without slowing down live conversations.",
        responsibilities: [
          "Guided the architecture between frontend configuration and background ingestion services",
          "Established automated verification and retry logic for sync jobs",
        ],
        technologies: ["TypeScript", "Node.js", "Python", "GCP Datastore", "Kafka"],
        impact:
          "Feeds up-to-date customer knowledge into AI responses automatically without requiring custom integration code from customers.",
      },
      {
        name: "Skill Mining",
        description:
          "Automated discovery of common customer questions and conversation patterns to seed the Skill Builder.",
        responsibilities: [
          "Coordinated the technical approach with Product, Engineering, and ML teams",
          "Led frontend architecture, review, and release",
        ],
        technologies: ["Vue 3", "TypeScript", "LLM Pipelines"],
        impact:
          "Helped new customers deploy agents faster by suggesting high-frequency skills directly from their conversation logs.",
      },
      {
        name: "Frontend Platform",
        description:
          "The shared frontend foundation and component library that 50+ engineers build agentic products on.",
        responsibilities: [
          "Defined shared patterns, component tokens, and integration with the Dialtone design system",
          "Onboarded and supported engineers across multiple teams",
        ],
        technologies: ["Vue 3", "TypeScript", "Dialtone", "Vite"],
        impact:
          "Standardized how agentic interfaces are built org-wide, helping squads release new surfaces faster.",
      },
    ],
    leadership: {
      teamSize: "~15 people (direct reports, PMs, designers, and engineers on loan across North America, Europe, and Asia-Pacific)",
      mentoring: "Open 1:1s, pair programming, and walking through trade-offs together so engineers make the technical call",
      performanceReviews: "Continuous feedback with no surprises, annual performance reviews, and promotions",
      hiring: "Led interview loops, hiring decisions, and team onboarding",
      crossFunctional: "Quarterly planning sheets (LOE, target dates, design dependencies, 30/60/90-day Gantt charts) and PM onboarding guides",
      releaseOwnership: "Bi-weekly release cadence with dedicated sprint capacity for maintenance and mid-cycle pivots",
      qa: "DRI for QA and engineering coordination, video walkthroughs, and public release notes",
    },
    stack: {
      frontend: ["React", "TypeScript", "Vue 3", "ProseMirror", "Dialtone"],
      backend: ["Node.js", "Go", "Python"],
      infrastructure: ["Docker", "Kubernetes", "Google Cloud Datastore"],
      ai: ["Claude", "Model Context Protocol (MCP)", "LLM Pipelines", "Agentic Workflows"],
      devx: ["Spec-First Development", "Vite", "30/60/90-Day Gantt", "AI-Assisted Scaffolding"],
    },
    achievements: [
      "Built a reliable remote operating rhythm for ~15 cross-functional teammates across three global regions",
      "Promoted to Engineering Manager following consistent delivery",
      "Established spec-first pull requests, reciprocal reviews, and quarterly roadmap planning",
      "Maintained a bi-weekly release schedule across production and beta with dedicated maintenance capacity",
    ],
  },
  {
    id: "dialpad-senior",
    company: "Dialpad",
    role: "Senior Software Engineer",
    period: "May 2023 - Oct 2024",
    short:
      "Led frontend work integrating Kare's acquired AI products into Dialpad, rebuilding customer chat and knowledge tooling.",
    overview:
      "Led technical initiatives integrating Kare's acquired AI products into Dialpad. Rebuilt customer chat and internal knowledge tools, and modernized the codebase to TypeScript and modern component patterns.",
    projects: [
      {
        name: "Customer Chat Rebuild",
        description:
          "Rewrote the customer-facing chat product using Dialpad's core design system and messaging backend.",
        responsibilities: [
          "Led frontend architecture and state management refactoring",
          "Partnered with Product and Design on user experience improvements",
        ],
        technologies: ["Vue 3", "React", "Redux", "TypeScript", "Node.js"],
        impact: "Delivered a stable, accessible chat foundation for customer support teams.",
      },
      {
        name: "Knowledge Management Tooling",
        description:
          "Rebuilt the internal knowledge management interface that powers automated answers.",
        technologies: ["Vue 3", "TypeScript"],
        impact: "Made it easier for teams to test and update knowledge-backed answers.",
      },
      {
        name: "TypeScript Migration",
        description:
          "Migrated legacy JavaScript surfaces to TypeScript across acquired products.",
        impact: "Caught bugs before production and improved build and test speed.",
      },
    ],
    leadership: {
      mentoring: "Mentored engineers on frontend architecture and modern TypeScript patterns",
      crossFunctional: "Close day-to-day partnership with Product and Design",
    },
    stack: {
      frontend: ["Vue 2/3", "React", "Redux", "TypeScript", "JavaScript"],
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
    period: "Jun 2021 - May 2023",
    short:
      "Joined through the Kare acquisition and rebuilt AI chat products within the Dialpad ecosystem.",
    overview:
      "Joined Dialpad through the Kare acquisition, helping rebuild AI chat products used across customer communication channels.",
    projects: [
      {
        name: "AI Chat Integration",
        description:
          "Integrated Kare's AI chat into Dialpad's communication surfaces.",
        technologies: ["Vue", "TypeScript", "Node.js"],
        impact: "Shipped customer-facing AI chat across customer accounts.",
      },
    ],
    stack: {
      frontend: ["Vue", "React", "Redux", "TypeScript", "JavaScript"],
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
    company: "Hugo Boss, Lisbon Nearshore",
    role: "Frontend Developer",
    period: "2018 - 2021",
    short:
      "Led frontend development for internal enterprise applications and vendor portals.",
    overview:
      "Led frontend development across internal enterprise applications at Hugo Boss's Lisbon Nearshore office, maintaining and refactoring business-critical tools.",
    projects: [
      {
        name: "Profit Calculation Platform",
        description:
          "An internal tool used to calculate margins and profitability for clothing items globally.",
        challenges:
          "A legacy ASP.NET codebase that had become difficult to update without risking accounting calculations.",
        solution:
          "Refactored the application, modernizing the frontend while keeping financial calculations intact.",
        impactPoints: [
          "Improved maintainability for an internal tool used across product lines",
          "Reduced technical debt and made future updates easier",
          "Kept existing financial logic working without downtime",
        ],
        technologies: ["ASP.NET", "C#", "jQuery", "Kendo UI"],
      },
      {
        name: "Digital Showroom",
        description:
          "An application that allowed internal teams and partners to browse and order clothing collections digitally.",
        challenges:
          "Fast catalog search and high-resolution image rendering across diverse devices.",
        solution:
          "Built new interface features and worked with European teams on stable deployments.",
        impactPoints: [
          "Added catalog browsing features for wholesale buyers",
          "Maintained a stable catalog platform across seasonal collection launches",
        ],
        technologies: ["Angular", "Node.js", "TypeScript"],
      },
    ],
    leadership: {
      crossFunctional: "Coordinated with European engineering teams and external partners",
    },
    stack: {
      frontend: ["Angular", "TypeScript", "jQuery", "Kendo UI"],
      backend: ["ASP.NET", "C#", "Node.js"],
    },
    achievements: ["Owned frontend architecture for internal business applications"],
  },
  {
    id: "att",
    company: "AT&T",
    role: "Backup, Storage & Automation Specialist",
    period: "2017 - 2018",
    short:
      "Automation specialist for the EMEA Backup and Storage team, building tools to reduce manual infrastructure tasks.",
    overview:
      "Served as an automation specialist for the EMEA Backup and Storage team, writing scripts and tools that reduced manual maintenance across server infrastructure.",
    projects: [
      {
        name: "Enterprise Backup Upgrade Automation",
        description:
          "Automated backup software upgrades across more than 10,000 Linux servers.",
        challenges:
          "Upgrading enterprise backup software across 10,000+ servers was previously a manual, repetitive process that required individual server checks.",
        solution:
          "Developed Python automation that orchestrated deployment, pre-flight checks, and reporting across the server fleet.",
        impactPoints: [
          "Automated software updates across 10,000+ Linux servers",
          "Cut hours of repetitive manual checks for operations engineers",
          "Made deployment steps consistent across data centers",
          "Allowed the operations team to run upgrades in parallel with clear logs",
        ],
        technologies: ["Python", "Shell Scripting", "Linux"],
      },
      {
        name: "Internal Automation Scripts",
        description:
          "Automated routine storage checks and operational tasks across the team.",
        challenges:
          "Daily operations relied on manual checks across different storage systems.",
        solution:
          "Wrote Python and shell scripts to standardize routine checks and automate common operational tasks.",
        impactPoints: [
          "Reduced routine manual tickets for the EMEA team",
          "Standardized recurring operational checks",
        ],
        technologies: ["Python", "Bash", "Enterprise Storage"],
      },
    ],
    stack: {
      backend: ["Python", "Shell Scripting"],
      infrastructure: ["Linux", "Enterprise Backup Systems"],
      devx: ["Internal Tooling", "Process Automation"],
    },
    achievements: [
      "Subject matter expert for EMEA backup automation",
      "Automated server maintenance across 10,000+ Linux machines",
      "Built internal tooling that reduced routine operations overhead",
    ],
  },
];
