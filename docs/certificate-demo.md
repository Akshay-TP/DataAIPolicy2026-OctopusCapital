# Loan-closure certificate demonstration

This is a synthetic two-institution prototype, not an actual Sahayog certificate, deployment or acceptance agreement. It implements one claim only: closure of one specified institutional loan. It does not certify a worker’s reported advance debt, legality, identity, creditworthiness or eligibility for a new loan.

## Run two isolated workspaces

```sh
npm ci
npm run demo:exchange
```

Open http://127.0.0.1:3020 and http://127.0.0.1:3021 and sign into each demo. The two workspaces have separate encrypted databases and session cookies. The launcher creates separate demonstration signing keys under ignored `.local/exchange-keys/`, outside the databases, and provisions an approved **public** registry to both environments. Their initial signed withdrawal snapshots are exchanged out of band at setup. Neither workspace receives the other’s private key through an API or a certificate.

Each contains `DEMO-CLOSED-LOAN`, a fictional, fully settled principal-only loan. Existing demonstration data is retained when the launcher restarts. Set `CERTIFICATE_DEMO_ROOT` to a different directory for a separate test run; do not use a real installation’s data directory.

## Issue A → receive B

1. In institution A, open **Lending & sharing → Loan-closure certificates → Prepare & issue**.
2. Choose **Prepare closure claim** and the synthetic closed loan. Choose B as recipient and enter the internal reconciliation reference and assessment date.
3. Reconcile the authoritative source and confirm closure, final payments and absence of unresolved corrections. When BR.NET or another system is authoritative, this is a manual reconciliation, not a live integration. Missing or non-settling local records block preparation.
4. Review the precise disclosed references, statement, assessment date, expiry, recipient and certificate identifier with the borrower. Do not use full identity numbers. Record approval and purpose-specific permission, or a correction request. Technical payload details are available in the exact-data preview.
5. An administrator or supervisor separately approves signing. If the approved source changes, signing is blocked until a new review is prepared. Signing uses Node’s native Ed25519 implementation; there is no handwritten cryptographic algorithm.
6. Download the signed JSON and/or printable QR. The QR contains the same complete signed envelope, not a tracking URL. Save a new **withdrawal snapshot after issuance** as well: a snapshot older than the certificate cannot establish its withdrawal status.
7. In B, select **Receive & verify**. Upload the JSON or an image of the complete printed QR, then import A’s signed withdrawal snapshot. QR decoding and signature verification run on the recipient’s device without an issuer request.
8. Inspect the format, approved key, integrity, dates, intended recipient, snapshot timestamp and age. Record presenter identity matching separately. Only then record whether this evidence meets the simulated closure-letter authentication requirement. This is not a lending decision or a real institutional acceptance agreement.
9. Reverse A and B to demonstrate receiving external evidence in the simulated Sahayog workflow.

## Negative demonstrations

- Edit a signed field without re-signing: **invalid signature**.
- Present an unknown issuer or unapproved key: **unrecognised key**, requiring manual review.
- Present an unsupported claim definition: **unsupported format**.
- Present an expired certificate: **expired**.
- Record an identity mismatch: the document may pass cryptographic checks but cannot be accepted as belonging to that applicant.
- Withdraw a certificate in A, export the updated signed snapshot, and import it into B: **withdrawn**. An older or incomplete snapshot cannot replace newer cached withdrawal information.
- Change an approved payment in A: existing certificates are automatically withdrawn conservatively; original signed contents and history remain intact. Prepare a replacement review and obtain borrower permission again.
- Set B’s maximum status age below the snapshot’s age, or require live issuer confirmation: cached evidence is incomplete and acceptance is blocked.

## Offline demonstration

Prepare B through **Offline records → Unlock records**, using a device passphrase. Cache the approved registry, policy and relevant status snapshots while connected. Stop the servers or disconnect, reload and unlock the saved workspace, then open **Receive & verify** and load the signed file or QR image again. The signature, claim and expiry checks work locally. The screen still shows exactly when its status information was issued and how old it is.

Even an in-policy cached snapshot cannot exclude a newer withdrawal. Verification does not establish live status. Where the recipient requires a fresher check or live issuer confirmation, the check remains incomplete. An offline documentary-review record is provisional until server revalidation on sync.

## Encoding and security boundary

The envelope is `{format, algorithm, payload, signature}`. The V1 payload has a strict set of fields, fixed claim definition and fixed statement; unknown fields or claim definitions are unsupported. Object keys are recursively sorted with JavaScript’s deterministic default ordering and encoded as UTF-8 JSON. This is a **narrow application encoding**, not a general claim of RFC 8785 compliance. The format plus a newline prefixes the signed bytes, separating certificate signatures from withdrawal-list signatures. The algorithm is fixed to Ed25519. Public keys supplied by a presenter are never automatically trusted.

Verification uses the receiving institution’s previously approved keys and their validity intervals. It checks issuer identity/name, signature integrity, dates, intended recipient and the available signed withdrawal list. Source truth and staff authority still require real organisational controls. A signed false source assertion remains false; cryptography does not correct it.

The status list includes issuer/key identifiers, a monotonic sequence, issue and refresh dates, and withdrawn certificate IDs. Imports reject older timestamps/sequences and loss of previously known withdrawals. Private source reconciliation details and full repayment histories are absent from the certificate and QR. Institution-scoped source reviews and issued records remain in the encrypted database; signing keys are separate and are excluded from application backups.

## Private hosting configuration

Signing is disabled in private mode unless `CERTIFICATE_ISSUER_FILE` is configured. Supply an issuer JSON file containing `issuerId`, `name`, `keyId`, `privateKeyFile`, `validFrom` and `validUntil`; `privateKeyFile` must point to a protected Ed25519 PKCS#8 PEM outside `DATA_DIR`. The server validates its algorithm and checks the configured public registry against its own key.

`CERTIFICATE_TRUST_FILE` contains `{keys, statusLists}`. Each approved key has `issuerId`, `name`, `keyId`, base64url raw Ed25519 `publicKey`, `validFrom`, `validUntil`, and optional `disabled`. This is a receiving-institution approval, not something imported from a presented certificate. A verification-only installation can set `CERTIFICATE_RECIPIENT_ID` without enabling signing. `SESSION_COOKIE_NAME` distinguishes separate installations sharing a host in the demo.

Retain signing keys securely, separately from encrypted database backups, and restore the original approved public registry and issuer configuration when recovering issued evidence. The prototype does not implement HSM/KMS custody, automated key rotation, institutional onboarding, live issuer status queries or live banking integrations. A real pilot requires those operational arrangements as appropriate, confirmed documentary acceptance, agreed correction procedures and reviewed retention/consent rules.

## Pilot measurements

Measure authentication calls avoided, repeat visits, time to the documentary decision, unnecessary fields disclosed, verification/identity errors, stale-status cases and successful presentation by people using paper. Distinguish successful document checks from lending outcomes and household financial health. No real-world benefit is claimed from synthetic demonstrations alone.
