# Security Specification - TPM SmartAssist

## Data Invariants
1. **Owner Isolation**: Every `Machine` and `MaintenanceReport` document belongs strictly to `ownerId == request.auth.uid`, and only verified accounts (`request.auth.token.email_verified == true`) may create, read, update, or delete records.
2. **Referential Integrity**: A `MaintenanceReport` cannot be created unless `machineId` references an existing `/machines/{machineId}` document owned by the same user (`get(...).data.ownerId == request.auth.uid`).
3. **Immutable Audit Fields**: `ownerId`, `createdAt`, `folio`, and `machineId` on reports, and `ownerId` and `createdAt` on machines, are immutable after creation.
4. **Server Timestamps**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
5. **Bounded Types & Strict Keys**: Every document enforces exact allowed/required keys via `hasAll` and `hasOnly` (on create) and `affectedKeys().hasOnly(...)` (on update), with strict numeric bounds, regex patterns, and string length limits.
6. **Bounded Allowlisted Tasks**: `completedTaskIds` on `MaintenanceReport` is strictly bounded (`size() <= 5`) and allowlisted to `['oil', 'air_filter', 'lubrication', 'pressure_check', 'visual_inspection']`.

## Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Machine Create**: Request without `request.auth` creating `/machines/PRENSA-01`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` creating a machine.
3. **Identity Spoofing**: User A creating a machine with `ownerId: "user-B-uid"`.
4. **Shadow Field Injection**: Valid machine create payload containing extra field `isAdmin: true`.
5. **Client Timestamp Forgery**: Machine create payload with `createdAt` set to a past client timestamp instead of `request.time`.
6. **ID Poisoning**: Creating `/machines/` with a 300-character document ID or invalid characters (`$bad!id`).
7. **Orphan Report Creation**: Creating a report whose `machineId` does not exist in `/machines/`.
8. **Cross-Tenant Report Attachment**: User A creating a report referencing a `machineId` owned by User B.
9. **Task Array Poisoning**: Creating a report with `completedTaskIds: ["arbitrary_script"]` or more than 5 items.
10. **Immutable Owner Mutation**: Updating a machine to change `ownerId` or `createdAt`.
11. **Unbounded Observation Payload**: Creating or updating a report with a 5,000-character `observations` string (`> 1000`).
12. **Blanket List Scraping**: Listing `/machines` or `/reports` without constraining `ownerId == request.auth.uid`.
