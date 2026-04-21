# Security Specification for El Desempate

## Data Invariants
- `Decision`: Must have `userId` exactly matching the authenticated user.
- `Decision`: `type` must be one of the allowed analysis frameworks.
- `Decision`: `createdAt` is immutable after creation.
- `Decision`: `updatedAt` always matches request time.

## The Dirty Dozen Payloads (Negative Tests)
1. Creating a decision with a different `userId`.
2. Updating someone else's decision.
3. Reading someone else's decision.
4. Creating a decision with an invalid `type` (e.g., "invalid_type").
5. Deleting someone else's decision.
6. Updating `createdAt` field after creation.
7. Injecting 1MB of text into the `title` field.
8. Creating a decision without being signed in.
9. Updating a decision with a spoofed `updatedAt` (not matching request time).
10. Using a very long string as a document ID to cause resource exhaustion.
11. Listing all decisions without a userId filter (query validation).
12. Creating a decision with missing required fields like `analysis`.

## Security Rules Implementation Strategy
- Global safety net: `allow read, write: if false;`.
- Helper functions: `isSignedIn()`, `isOwner()`, `isValidDecision()`.
- Explicit `match` block for `/decisions/{decisionId}`.
- `allow list` with mandatory `resource.data.userId == request.auth.uid`.
