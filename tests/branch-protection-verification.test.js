import test from "node:test";
import assert from "node:assert/strict";

// Temporary negative test: intentionally fails to verify branch protection.
// Never merge this file into main.
test("branch protection prevents merging a failing test", () => {
  assert.fail("INTENTIONAL_FAILURE_BRANCH_PROTECTION_CHECK");
});
