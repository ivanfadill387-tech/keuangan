# Security Specification — KasVault Firestore Rules

## 1. Data Invariants
1. Every document under `/users/{userId}` and its subcollections belongs exclusively to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. Every subcollection document (`emergencyConfig`, `transactions`, `emergencyLogs`) requires the parent `/users/{userId}` document to exist (`exists(...)`), preventing orphaned records.
3. All `uid` fields in payloads must strictly match `request.auth.uid` and remain immutable after creation.
4. `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on creation and update.
5. Numeric amounts (`amount`, `targetAmount`, `currentBalance`, `monthlyExpenseBaseline`, `monthlyRuleValue`, `roundUpSaved`) are strictly bounded and validated (`> 0` or `>= 0` as appropriate).
6. All string fields enforce explicit `.size()` bounds and regex format validation (`date`, `monthKey`, `id`).
7. `EmergencyLog` entries are append-only audit records (`allow update: if false;` or owner delete only when cleaning up), preserving audit integrity.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Reading `/users/alice/transactions/tx1` with `auth == null`.
2. **Cross-Tenant Read/List**: User `bob` listing `/users/alice/transactions` or getting `/users/alice/emergencyConfig/default`.
3. **UID Spoofing on Create**: User `bob` writing to `/users/bob/transactions/tx1` with payload `{ uid: "alice", ... }`.
4. **Shadow/Ghost Field Injection**: Creating a `Transaction` with extra field `isAdmin: true` or `verified: true`.
5. **Client Timestamp Forgery**: Creating a `Transaction` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
6. **Immutable Field Mutation**: Updating `Transaction.uid` or `Transaction.createdAt` on an existing document.
7. **Negative / Poisoned Amount**: Creating a `Transaction` with `amount: -500000` or `EmergencyConfig` with `currentBalance: -100`.
8. **Invalid Enum / Type Poisoning**: Updating `Transaction.type` to `"hacked"` or `EmergencyConfig.monthlyRuleType` to `12345`.
9. **Path Variable ID Poisoning**: Creating a document at `/users/bob/transactions/${"a".repeat(300)}` or containing `/` / `$`.
10. **String Resource Exhaustion**: Creating a `Transaction` with `title` of length 5000 characters.
11. **Unverified Email Token Spoof**: Authenticated user with `email_verified: false` attempting to create/update `emergencyConfig`.
12. **Orphaned Subcollection Write**: Creating `/users/bob/transactions/tx1` before `/users/bob` root document exists.
