import type { PlanArtifact, ValidationFinding } from "@timbenniks/contentstack-stacksmith-core";

export const analyzePlanRisk = (plan: PlanArtifact): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];

  if (plan.summary.blocked > 0) {
    findings.push({
      level: "blocker",
      code: "PLAN_BLOCKED",
      message: `Plan contains ${plan.summary.blocked} blocked operation(s).`,
    });
  }

  if (plan.summary.highRisk > 0) {
    findings.push({
      level: "high",
      code: "HIGH_RISK_OPERATIONS",
      message: `Plan contains ${plan.summary.highRisk} high-risk operation(s).`,
    });
  }

  if (plan.summary.mediumRisk > 0) {
    findings.push({
      level: "medium",
      code: "MEDIUM_RISK_OPERATIONS",
      message: `Plan contains ${plan.summary.mediumRisk} medium-risk operation(s).`,
    });
  }

  return findings;
};
