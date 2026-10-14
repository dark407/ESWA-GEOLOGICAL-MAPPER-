# Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth
- **Master Admin Authority**: Only the Master Owner (`dhoniakash407@gmail.com` with `email_verified == true`, or a verified document in `/admins/{uid}`) has full administrative privileges to list all access requests, issue/modify/revoke `software_licenses`, manage `master_pcs`, and publish `software_releases`.
- **1-PC Hardware Lock Invariant**: A `SoftwareLicense` document (`/software_licenses/{userId}`) can only be activated/updated by a client PC if:
  1. The license `status` is `'ACTIVE'`.
  2. The client provides the matching `password` and `licenseKey` (unchanged from existing document).
  3. Either `existing().boundPcHardwareId == ''` (first-time activation on a single PC) OR `existing().boundPcHardwareId == incoming().boundPcHardwareId` (same locked PC). Any attempt to bind a different `boundPcHardwareId` once bound is rejected by Firestore rules unless performed by `isAdmin()`.
- **Access Request Submission**: Unauthenticated or newly downloaded clients can `create` a strictly schema-validated `AccessRequest` with initial `status == 'PENDING'`, `assignedUserId == ''`, and `assignedLicenseKey == ''`. Clients can `get` their own submitted request by its `requestId` to view approval status, but cannot `list` all requests.
- **Software Update Broadcasts**: Published `software_releases` (`status == 'PUBLISHED'`) can be read by software clients to receive update alerts, while creation, modification, and deletion are strictly restricted to `isAdmin()`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on AccessRequest**: Adding `"isAdmin": true` to `/access_requests/{id}` -> Rejected by `hasOnly()`.
2. **Pre-Approved AccessRequest Spoofing**: Creating `/access_requests/{id}` with `status: "APPROVED"` -> Rejected by `incoming().status == 'PENDING'`.
3. **Oversized String DoW Attack**: Sending a 5,000-character `purposeNotes` in `/access_requests/{id}` -> Rejected by `.size() <= 500`.
4. **Invalid ID Poisoning**: Creating `/access_requests/bad$id!` -> Rejected by `isValidId()`.
5. **Unauthorized License Creation**: Non-admin attempting to `create` `/software_licenses/hacker1` -> Rejected by `isAdmin()`.
6. **Cross-PC License Theft (2nd PC Login Attempt)**: Updating `/software_licenses/user1` where `existing().boundPcHardwareId == 'PC-AAA'` with `incoming().boundPcHardwareId == 'PC-BBB'` -> Rejected by hardware lock invariant.
7. **License Key / Password Tampering by Client**: Client updating `password` or `status` on `/software_licenses/user1` -> Rejected by `affectedKeys().hasOnly(['boundPcHardwareId', 'boundPcName', 'installedVersion', 'lastSeenAtIso'])`.
8. **Unverified Admin Email Spoofing**: Authenticated user with `email == 'dhoniakash407@gmail.com'` but `email_verified == false` attempting admin write -> Rejected by `request.auth.token.email_verified == true`.
9. **Unauthorized Release Publishing**: Non-admin creating `/software_releases/rel_1` -> Rejected by `isAdmin()`.
10. **Unauthorized Master PC Registration**: Non-admin creating `/master_pcs/PC-HACK` -> Rejected by `isAdmin()`.
11. **Blanket Scraping of Access Requests**: Non-admin executing `list` on `/access_requests` -> Rejected by `allow list: if isAdmin()`.
12. **Blanket Scraping of Licenses**: Non-admin executing `list` on `/software_licenses` -> Rejected by `allow list: if isAdmin()`.
