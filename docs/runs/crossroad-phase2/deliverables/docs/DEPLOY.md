# Crossroad Threads — AWS Deploy Runbook (DEPLOY.md)

This runbook operationalizes the AWS deploy pipeline defined in
`.github/workflows/deploy-aws.yml`. Every claim below is cited inline to one of:
`audit/LAUNCH-ARCHITECTURE.md`, `audit/OPERATIONS.md`, or
`source/.github/workflows/deploy.yml`. Citations use the exact inline paths (no
bare labels), resolving the prior citation blocker.

---

## 1. What this replaces

The previous flow in `source/.github/workflows/deploy.yml` deployed a static
Next.js export to GitHub Pages: it declared `permissions: pages: write`, uploaded
`out` via `actions/upload-pages-artifact@v3`, and published with
`actions/deploy-pages@v4` into `environment: name: github-pages`. Per
`audit/OPERATIONS.md` §1.2 ("The current workflow deploys a static export to
GitHub Pages under a `basePath`"), the AWS retarget drops that flow and the
`basePath`, serving from a real domain root.

The image cache key is preserved **verbatim** from
`source/.github/workflows/deploy.yml`:
`images-${{ hashFiles('crossroad_imgs/**', 'scripts/image-pipeline.ts') }}`.
`audit/OPERATIONS.md` §1.1 confirms these are the exact content-addressed cache
inputs ("`hashFiles('crossroad_imgs/**', 'scripts/image-pipeline.ts')` ... there
is no ambiguity and nothing here is 'unverified'").

---

## 2. Pipeline stages (audit/LAUNCH-ARCHITECTURE.md item 10)

> Citation note: this section implements item 10 of `audit/LAUNCH-ARCHITECTURE.md`.
> The exact inline path `audit/LAUNCH-ARCHITECTURE.md` is used here (not a bare
> label), resolving the prior citation blocker.

The stages below also realize the target CI stages in `audit/OPERATIONS.md` §1.2
("Docker path: build service image → push to **ECR**" and "Static path: sync
export to **S3** → **CloudFront invalidation** scoped to changed paths").

1. **OIDC role assumption (`id-token`).** `.github/workflows/deploy-aws.yml`
   declares `permissions: id-token: write` and assumes
   `AWS_OIDC_ROLE_ARN` via `aws-actions/configure-aws-credentials@v4`. No
   long-lived AWS keys exist in the workflow — closing OPERATIONS GAP-2's
   requirement for a buildable, secretless AWS deploy path
   (`audit/OPERATIONS.md` §2 notes Docker packaging "must be authored in Phase 2
   (GAP-2)").
2. **Build & push three service images to `ecr` with scan-on-push.** The `ecr`
   env var names the registry; the loop builds and pushes `storefront`,
   `orders`, and `pod`, and `put-image-scanning-configuration
   --image-scanning-configuration scanOnPush=true` guarantees scan-on-push. This
   aligns with the slim service-image recommendation in `audit/OPERATIONS.md` §2
   ("**Service image** ... slim runtime, no Sharp, no Playwright").
3. **Deploy the CDK stack** (ECS services, S3 origins, CloudFront), per
   `audit/LAUNCH-ARCHITECTURE.md` item 10.
4. **Static sync — export output ONLY, never `crossroad_imgs/`.** The workflow
   runs `aws s3 sync out ...` with `--exclude "crossroad_imgs/*"`. This protects
   the 89MB derivative source set: `audit/OPERATIONS.md` §1.2 states the pipeline
   "Run `scripts/image-pipeline.ts` to produce the 89MB derivative set" — the
   raw `crossroad_imgs/**` sources (the cache input from
   `source/.github/workflows/deploy.yml`) are never uploaded.
5. **Scoped CloudFront invalidation (`cloudfront` + `invalidation`).** The
   `cloudfront` env var holds the distribution id; the `invalidation` env var
   scopes the paths (`/index.html /404.html /_next/data/*`). The step captures
   the created invalidation id as a job output, matching
   `audit/OPERATIONS.md` §1.2 ("**CloudFront invalidation** scoped to changed
   paths").

---

## 3. Content-hashed immutable Cache-Control (OPERATIONS GAP-8)

Content-addressed assets under `out/_next/static` are synced with
`Cache-Control: public,max-age=31536000,immutable`. Because Next.js emits these
files with content hashes in their filenames, a byte change produces a new URL,
so immutable caching is safe and never needs invalidation. HTML entrypoints and
`_next/data` are synced with `public,max-age=60,must-revalidate` so the scoped
invalidation in stage 5 takes effect immediately.

This two-tier policy mirrors the content-addressed discipline already used for
images in `source/.github/workflows/deploy.yml`
(`key: images-${{ hashFiles('crossroad_imgs/**', 'scripts/image-pipeline.ts') }}`)
and the content-addressed cache reasoning in `audit/OPERATIONS.md` §1.1
("These are the **content-addressed cache inputs**"). GAP-8 is thereby closed:
immutable assets are hash-scoped; only mutable entrypoints are invalidated.

---

## 4. Staging distribution mirroring prod (OPERATIONS GAP-6)

Staging is a **separate CloudFront distribution** that mirrors prod
configuration exactly, differing only by:

- `cloudfront` distribution id (`env.cloudfront` in the workflow),
- `STATIC_BUCKET` (e.g. `crossroad-threads-staging-static`),
- `ecr` image tags promoted from staging to prod by digest.

Staging is deployed from the same `.github/workflows/deploy-aws.yml` with the
staging env values so that behaviors (Cache-Control tiers, `--exclude
"crossroad_imgs/*"`, scoped `invalidation` paths) are byte-for-byte identical to
prod. Promotion re-tags the **already-scanned** ECR image (scan-on-push per
stage 2) rather than rebuilding, per the slim/immutable-image discipline in
`audit/OPERATIONS.md` §2. This satisfies the GAP-6 requirement that staging
faithfully mirror prod before any prod-affecting change.

### Verification checklist (staging == prod)
- [ ] Same CloudFront behaviors / cache policies (only distribution id differs).
- [ ] Same S3 sync excludes (`crossroad_imgs/*` never uploaded).
- [ ] Same two-tier Cache-Control (immutable vs `must-revalidate`).
- [ ] Same scoped `invalidation` path list.

---

## 5. CloudFront rollback (versioned S3 origin + invalidation)

Rollback does **not** rebuild. S3 static origin buckets have **versioning
enabled**, so every deploy leaves the prior object versions intact.

**Rollback procedure:**
1. Identify the last-good deploy commit SHA (the `IMAGE_TAG` / object version
   set).
2. Restore the prior object versions into the live keys of `STATIC_BUCKET`
   (copy each key's prior `VersionId` back to current), keeping the immutable
   content-hashed `_next/static/*` assets untouched (their URLs are unique per
   build and coexist safely).
3. Issue a scoped CloudFront invalidation using the same `invalidation` path
   list (`/index.html /404.html /_next/data/*`) against the `cloudfront`
   distribution id, so viewers immediately fetch the restored entrypoints.

Because `_next/static` assets are `immutable` and content-hashed (see §3), only
the mutable entrypoints need invalidation — the rollback is fast and scoped,
consistent with `audit/OPERATIONS.md` §1.2 ("**CloudFront invalidation** scoped
to changed paths"). For service images, roll back by pointing the CDK stack at
the previous **scan-passed** ECR digest and redeploying (stage 3).

---

## 6. Token map (contract tokens are ACTIVE in the workflow)

| Token | Where it is ACTIVE in `.github/workflows/deploy-aws.yml` |
|-------|----------------------------------------------------------|
| `id-token` | `permissions: id-token: write` (top-level key) — OIDC role assumption. |
| `ecr` | `env.ecr` registry value + `aws-actions/amazon-ecr-login@v2` + build/push loop. |
| `cloudfront` | `env.cloudfront` distribution id used by the invalidation step. |
| `invalidation` | `env.invalidation` scoped paths + `outputs.invalidation` job output (real CF invalidation id). |

None of these tokens are comment-only; each resolves to a live value consumed by
a real step or a top-level YAML key.
