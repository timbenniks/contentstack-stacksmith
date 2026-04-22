# Internal Validators Package

Internal validation and risk-analysis helpers for normalized schemas, diffs, and execution plans.

This workspace package is private. Public consumers should use `@timbenniks/contentstack-stacksmith`, which re-exports the supported validation API.

## Public Exports

- `validateSchema`
- `validateDiff`
- `analyzePlanRisk`

## What Gets Checked

`validateSchema()` inspects compiled schemas for issues like:

- duplicate entity UIDs
- duplicate field UIDs
- missing reference targets
- missing global field references
- empty modular blocks
- content types without a required `title` field

`validateDiff()` classifies operations for the current safe-apply phase:

- blocks destructive operations like entity deletion and field removal
- blocks risky field mutations like kind changes, validation tightening, reference narrowing, and global-field ref changes
- marks optional additive fields as low risk
- marks required additive fields as high risk

`analyzePlanRisk()` summarizes plan-level risk from the operation totals.

## Example

```ts
import { createPlan, diffSchemas } from "@timbenniks/contentstack-stacksmith";
import { analyzePlanRisk, validateDiff, validateSchema } from "@timbenniks/contentstack-stacksmith";

const schemaFindings = validateSchema(localSchema);
const diff = diffSchemas(localSchema, remoteSchema);
const diffFindings = validateDiff(diff);
const plan = createPlan(diff, undefined, [...schemaFindings, ...diffFindings]);
const planFindings = analyzePlanRisk(plan);
```
