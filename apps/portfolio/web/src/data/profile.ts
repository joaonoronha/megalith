export interface StatHighlight {
  key: string;
  label: string;
  description: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
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
  status: "Available for the right advisory or leadership conversation",
  headline: "Engineering leader building AI-native products & teams.",
  subheadline:
    "Engineering Manager at Dialpad with 10+ years shipping SaaS, AI platforms, and developer tooling. Hands-on with platform architecture, patient with people, and dedicated to pragmatic execution.",
  about: {
    lead: "Engineering Manager at Dialpad, scaling team execution from 25 to 150+ engineers across the company.",
    paragraphs: [
      "I lead a team of 9 engineers inside Dialpad's Agentic AI division, leading the entire agentic frontend and the ingestion source pipeline end-to-end, while remaining hands-on in technical strategy and platform architecture.",
      "Promoted from Software Engineer to Senior SWE to Engineering Manager, I have navigated acquisitions, legacy modernization, and high-velocity greenfield AI initiatives.",
      "I thrive at the intersection of specification-driven engineering, LLM-assisted delivery (Claude in the loop), and empowering small, agile squads to ship resilient, high-leverage software.",
    ],
    focusAreas: [
      {
        title: "Platform Architecture",
        description:
          "Designed and stewarded the shared agentic frontend architecture and component primitives that 50+ engineers actively build on today.",
      },
      {
        title: "Ingestion Pipeline E2E",
        description:
          "Spearheading the end-to-end source ingestion architecture that feeds customer enterprise knowledge into Dialpad's agentic systems.",
      },
      {
        title: "Flagship AI Products",
        description:
          "Architected and delivered core authoring surfaces including the Agentic Skill Builder and automated Skill Mining from customer conversations.",
      },
      {
        title: "Operational Excellence",
        description:
          "DRI for QA ↔ Engineering coordination and owner of the bi-weekly production and beta release cadence across 70,000+ global organizations.",
      },
    ],
  },
  highlights: [
    {
      key: "10+",
      label: "Years shipping product",
      description: "From enterprise modernization to bleeding-edge agentic AI systems.",
    },
    {
      key: "70k+",
      label: "Customers reached",
      description: "Global business telephony, contact center, and AI knowledge customers.",
    },
    {
      key: "50+",
      label: "Engineers onboarded",
      description: "Building atop shared platform architecture, design tokens, and primitives.",
    },
    {
      key: "9",
      label: "Direct reports",
      description: "Leading the agentic frontend and ingestion source pipeline teams E2E.",
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
      category: "AI & Agentic Systems",
      items: [
        "Model Context Protocol (MCP)",
        "Claude & LLM Workflows",
        "Agentic Skill Authoring",
        "Ingestion Pipelines",
        "LLM-Powered Linting",
        "RAG Architecture",
      ],
    },
    {
      category: "Backend & Systems",
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
      category: "Platform, DevX & Operations",
      items: [
        "Kubernetes",
        "Docker",
        "CI/CD (GitHub Actions)",
        "Spec-Driven Engineering",
        "Bi-Weekly Release Cadence",
        "Cross-Functional Squad Leadership",
      ],
    },
  ],
  achievements: [
    "Promoted from SWE → Senior SWE → Engineering Manager in under three years",
    "Two-time Dialpad Global Hackathon winner",
    "Three consecutive Outstanding Performance ratings",
    "Architecture owner of the shared frontend platform 50+ engineers build on",
    "DRI for QA ↔ Engineering coordination and bi-weekly production releases across 70k+ orgs",
    "Delivered internal masterclasses on Web Components and Agentic Frontend onboarding",
  ],
  contact: {
    email: "jmdsnoronha@gmail.com",
    phone: "+351 915 861 171",
    linkedin: "https://linkedin.com/in/joaonoronha36",
    github: "https://github.com/joaonoronha",
    location: "Lisbon, Portugal",
  },
};
