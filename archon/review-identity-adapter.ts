import { createHeaderReviewIdentityAdapter } from "archon/src/runtime/review-identity-adapters.ts";
import { createReviewPrincipalAdapter } from "archon/src/core/review-context.ts";

export const reviewIdentityAdapters = {
  auth_context_passthrough: createReviewPrincipalAdapter(async ({ authContext }) => {
    const candidate =
      typeof authContext === "object" && authContext !== null
        ? (authContext as Record<string, unknown>)
        : {};

    if (candidate.verified !== true) {
      throw new Error("Auth context principal is not verified");
    }

    return {
      provider: String(candidate.provider ?? ""),
      subject: String(candidate.subject ?? ""),
      verified: true,
      displayName: typeof candidate.displayName === "string" ? candidate.displayName : undefined,
      email: typeof candidate.email === "string" ? candidate.email : undefined
    };
  }),
  forwarded_headers: createHeaderReviewIdentityAdapter({
    provider: "forwarded_headers",
    subjectHeader: "x-archon-review-subject",
    verifiedHeader: "x-archon-review-verified",
    verifiedValue: "true",
    displayNameHeader: "x-archon-review-name",
    emailHeader: "x-archon-review-email",
    groupsHeader: "x-archon-review-groups"
  })
};

export default createReviewPrincipalAdapter(async () => {
  throw new Error(
    "Implement archon/review-identity-adapter.ts with your authenticated principal lookup or select ARCHON_REVIEW_IDENTITY_BACKEND from reviewIdentityAdapters before trusting review actions"
  );
});
