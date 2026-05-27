import {
  createHeaderReviewIdentityAdapter,
  createReviewPrincipalAdapter
} from "devgod/src/index.ts";

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
    subjectHeader: "x-devgod-review-subject",
    verifiedHeader: "x-devgod-review-verified",
    verifiedValue: "true",
    displayNameHeader: "x-devgod-review-name",
    emailHeader: "x-devgod-review-email",
    groupsHeader: "x-devgod-review-groups"
  })
};

export default createReviewPrincipalAdapter(async () => {
  throw new Error(
    "Implement devgod/review-identity-adapter.ts with your authenticated principal lookup or select DEVGOD_REVIEW_IDENTITY_BACKEND from reviewIdentityAdapters before trusting review actions"
  );
});
