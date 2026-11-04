import { describe, it, expect } from "vitest";
import { experience } from "@/data/experience";
import { profile } from "@/data/profile";
import { aiWorkflowData } from "@/data/ai-workflow";

describe("Portfolio Data Contracts", () => {
  it("contains updated leadership metrics for ~15 remote team members across global time zones", () => {
    const dialpadEm = experience.find((e) => e.id === "dialpad-em");
    expect(dialpadEm).toBeDefined();
    expect(dialpadEm?.leadership?.teamSize).toContain("~15 people");
    expect(dialpadEm?.leadership?.teamSize).toContain("North America, Europe, and Asia-Pacific");

    const highlightStat = profile.highlights.find((h) => h.key === "~15");
    expect(highlightStat).toBeDefined();
    expect(highlightStat?.label).toBe("Remote team members led");
    expect(highlightStat?.description).toContain("North America, Europe, and Asia-Pacific");
  });

  it("contains managerial way of working practices and leadership style", () => {
    expect(profile.wayOfWorking).toBeDefined();
    expect(profile.wayOfWorking.howWeWork.length).toBe(3);
    expect(profile.wayOfWorking.challengesAndAdjustments.length).toBe(3);
    expect(profile.wayOfWorking.leadershipStyle.points.length).toBe(4);

    const specFirst = profile.wayOfWorking.howWeWork.find((p) => p.title.includes("Spec-first"));
    expect(specFirst).toBeDefined();
    expect(specFirst?.summary).toContain("pull requests");

    const reviewBottlenecks = profile.wayOfWorking.challengesAndAdjustments.find((c) =>
      c.title.includes("PR review bottlenecks")
    );
    expect(reviewBottlenecks).toBeDefined();
    expect(reviewBottlenecks?.details.join(" ")).toContain("reciprocal review norm");
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

  it("has valid AI workflow stages and principles reflecting spec-first delivery and review velocity", () => {
    expect(aiWorkflowData.featureWorkflow.length).toBe(7);
    expect(aiWorkflowData.debugWorkflow.length).toBe(4);
    expect(aiWorkflowData.principles.length).toBeGreaterThanOrEqual(5);

    const step1 = aiWorkflowData.featureWorkflow[0];
    expect(step1.title).toBe("Spec-first development");

    const deadlockStep = aiWorkflowData.featureWorkflow.find((s) =>
      s.title.toLowerCase().includes("deadlock")
    );
    expect(deadlockStep).toBeDefined();
  });
});
