import type { DiffResult, ValidationFinding } from "@timbenniks/contentstack-stacksmith-core";

const blockedKinds = new Set<DiffResult["operations"][number]["kind"]>(["delete_entity", "remove_field"]);

export const validateDiff = (diff: DiffResult): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];

  for (const operation of diff.operations) {
    if (blockedKinds.has(operation.kind)) {
      findings.push({
        level: "blocker",
        code: "DESTRUCTIVE_CHANGE",
        message: `${operation.summary} is blocked in phase 1 because it can destroy remote data.`,
        entityId: operation.entity.id,
        fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
        operationId: operation.id,
      });
      continue;
    }

    if (operation.kind === "update_field") {
      const kindChange = operation.details.find((detail) => detail.path.endsWith(".kind"));
      const requiredTightening = operation.details.find(
        (detail) => detail.path.endsWith(".required") && detail.before === false && detail.after === true,
      );
      const uniqueTightening = operation.details.find(
        (detail) => detail.path.endsWith(".unique") && detail.before === false && detail.after === true,
      );
      const multipleReduction = operation.details.find(
        (detail) => detail.path.endsWith(".multiple") && detail.before === true && detail.after === false,
      );
      const enumChoicesNarrowing = operation.details.find((detail) => {
        if (!detail.path.endsWith(".enumChoices")) return false;
        const before = Array.isArray(detail.before) ? detail.before as string[] : [];
        const after = Array.isArray(detail.after) ? detail.after as string[] : [];
        return before.some((choice) => !after.includes(choice));
      });
      const globalFieldRefChange = operation.details.find((detail) => detail.path.endsWith(".globalFieldRef"));
      const referenceTargetNarrowing = operation.details.find((detail) => {
        if (!detail.path.endsWith(".referenceTo")) return false;
        const before = Array.isArray(detail.before) ? detail.before as string[] : [];
        const after = Array.isArray(detail.after) ? detail.after as string[] : [];
        return before.some((ref) => !after.includes(ref));
      });

      if (kindChange || requiredTightening || uniqueTightening || multipleReduction || enumChoicesNarrowing || globalFieldRefChange || referenceTargetNarrowing) {
        findings.push({
          level: "blocker",
          code: "BREAKING_FIELD_MUTATION",
          message: `${operation.summary} is blocked because it changes field shape or validation in a breaking way.`,
          entityId: operation.entity.id,
          fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
          operationId: operation.id,
        });
      } else {
        findings.push({
          level: "low",
          code: "SAFE_FIELD_UPDATE",
          message: `${operation.summary} is classified as a low-risk field update.`,
          entityId: operation.entity.id,
          fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
          operationId: operation.id,
        });
      }
    }

    if (operation.kind === "add_field") {
      const fieldSnapshot = operation.details[0]?.after as { required?: boolean } | undefined;
      findings.push({
        level: fieldSnapshot?.required ? "high" : "low",
        code: fieldSnapshot?.required ? "RISKY_REQUIRED_FIELD" : "SAFE_ADDITIVE_CHANGE",
        message: fieldSnapshot?.required
          ? `${operation.summary} adds a required field and needs future migration support.`
          : `${operation.summary} is a safe additive field change.`,
        entityId: operation.entity.id,
        fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
        operationId: operation.id,
      });
    }

    if (operation.kind === "create_entity" || operation.kind === "update_entity" || operation.kind === "reorder_fields") {
      findings.push({
        level: "low",
        code: "SAFE_ENTITY_CHANGE",
        message: `${operation.summary} is safe to apply in phase 1.`,
        entityId: operation.entity.id,
        operationId: operation.id,
      });
    }

    if (operation.kind === "rename_field") {
      // A rename collides when both the old and new uids exist on the remote.
      // diffSchemas surfaces this with a "Cannot rename" message in the details.
      const collision = operation.details.some((detail) => typeof detail.message === "string" && detail.message.startsWith("Cannot rename"));
      findings.push({
        level: collision ? "blocker" : "low",
        code: collision ? "RENAME_COLLISION" : "SAFE_FIELD_RENAME",
        message: collision
          ? `${operation.summary} is blocked: both the old and new uid already exist on the remote. Remove one manually before re-running.`
          : `${operation.summary} is classified as a low-risk rename.`,
        entityId: operation.entity.id,
        fieldId: operation.fieldUid ? `${operation.entity.id}.field:${operation.fieldUid}` : undefined,
        operationId: operation.id,
      });
    }
  }

  return findings;
};
