import { describe, it, expect } from "vitest";
import { experience } from "@/data/experience";
import { profile } from "@/data/profile";
import { aiWorkflowData } from "@/data/ai-workflow";

describe("Portfolio Data Contracts", () => {
  it("contains updated leadership metrics for 9 direct reports", () => {
    const dialpadEm = experience.find((e) => e.id === "dialpad-em");
    expect(dialpadEm).toBeDefined();
    expect(dialpadEm?.leadership?.teamSize).toBe("9 direct reports");

    const highlightStat = profile.highlights.find((h) => h.key === "9");
    expect(highlightStat).toBeDefined();
    expect(highlightStat?.label).toBe("Direct reports");
    expect(highlightStat?.description).toContain("agentic frontend");
    expect(highlightStat?.description).toContain("ingestion source pipeline");
    expect(highlightStat?.description).toContain("E2E");
  });

  it("contains E2E Ingestion Source Pipeline in Dialpad EM projects", () => {
    const dialpadEm = experience.find((e) => e.id === "dialpad-em");
    const ingestionProject = dialpadEm?.projects?.find((p) =>
      p.name.includes("Ingestion Source Pipeline")
    );
    expect(ingestionProject).toBeDefined();
    expect(ingestionProject?.technologies).toContain("TypeScript");
    expect(ingestionProject?.technologies).toContain("Node.js");
  });

  it("contains complete historical career timeline", () => {
    const roleIds = experience.map((e) => e.id);
    expect(roleIds).toEqual([
      "dialpad-em",
      "dialpad-senior",
      "dialpad-swe",
      "hugo-boss",
      "att",
    ]);
  });

  it("has valid AI workflow stages and principles", () => {
    expect(aiWorkflowData.featureWorkflow.length).toBe(7);
    expect(aiWorkflowData.debugWorkflow.length).toBe(4);
    expect(aiWorkflowData.principles.length).toBeGreaterThanOrEqual(5);
  });
});
