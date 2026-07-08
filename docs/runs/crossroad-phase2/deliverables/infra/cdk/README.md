# Crossroad Threads — Static Plane (AWS CDK)

This package provisions the **static plane** of Crossroad Threads on **AWS**, per
`audit/LAUNCH-ARCHITECTURE.md` §2.1 ("Static plane (the storefront)"). It fronts a
private **S3** bucket with **CloudFront** (TLS via **ACM**, **DNS** via Route 53)
and adds an `/api/*` behavior to reach the commerce containers.

```
Route 53 (DNS) ──> CloudFront (CDN, TLS via ACM) ──> S3 (private, OAC) : out/ static export
                                     │
                                     └── /api/* behavior ──> API Gateway / ALB ──> commerce containers
```

## What this stack builds (Phase-2 items 7–9 and 1)

- A **private** S3 bucket (no public access, `blockPublicAccess: BLOCK_ALL`) holding
  the contents of `out/` — the Next.js `output: "export"` artifact.
- **CloudFront** as the single public entry point, using an **Origin Access Control (OAC)**
  to read the private bucket (no public bucket policy).
- An **ACM certificate in `us-east-1`** (CloudFront requires certs in `us-east-1`).
- **Route 53** A/AAAA alias records for the apex and `www`.
- A **CloudFront Function** that:
  - rewrites directory paths to `index.html` (matches `trailingSlash: true` export layout), and
  - issues a **301** to the canonical apex host.
- An **`/api/*`** behavior pointing at an API origin (API Gateway / ALB) for the
  commerce containers.

## Prerequisites

- Node.js 18+ and the AWS CDK v2 CLI (`npm i -g aws-cdk`).
- AWS credentials for the target account.
- A Route 53 **public hosted zone** already existing for the apex domain
  (`crossroadthreads.com`). This stack looks it up by zone name.

## Deploy

```bash
cd infra/cdk
npm install

# Bootstrap once per account/region (CloudFront + us-east-1 ACM require us-east-1 for cert)
cdk bootstrap

# Build the static export from the app root first (produces out/)
#   (from repo root)
#   DEPLOY_TARGET=aws npm run build   # -> out/

# Synthesize and deploy the static plane
cdk synth
cdk deploy CrossroadThreadsStaticStack
```

After `cdk deploy`, upload the exported `out/` directory to the private bucket
(the bucket name is emitted as a stack output) and invalidate the distribution:

```bash
aws s3 sync ../../out s3://<BucketName-from-output> --delete
aws cloudfront create-invalidation --distribution-id <DistributionId-from-output> --paths '/*'
```

## basePath decoupling (DEPLOY_TARGET env, default `''` for AWS)

This is the crux of moving off GitHub Pages. Per `source/next.config.ts`, the
current config derives the prefix from the **GitHub runner** variable:

```ts
// source/next.config.ts
const repo = "CrossroadThreads";
const isPages = process.env.GITHUB_ACTIONS === "true";
const basePath = isPages ? `/${repo}` : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};
```

### Why this matters on AWS

`audit/LAUNCH-ARCHITECTURE.md` §1.1 enumerates the coupling points:

1. `basePath: basePath` — on Pages every route is prefixed with `/CrossroadThreads`.
   On our own domain served at root, that prefix is **wrong**.
2. `assetPrefix: basePath` — all static asset URLs get the `/CrossroadThreads`
   prefix; on S3+CloudFront at the domain root these **404**.
3. `env.NEXT_PUBLIC_BASE_PATH` — the prefix is baked into the client bundle at
   build time, so hand-built URLs concatenating `NEXT_PUBLIC_BASE_PATH` must
   resolve to `""` on AWS.
4. `process.env.GITHUB_ACTIONS === "true"` — the *switch itself* is a Pages
   assumption. On AWS CI this variable is unset, so `basePath` collapses to
   `""` automatically — but the audit says we should make the intent explicit.

### The decoupling contract: `DEPLOY_TARGET`

Because the current `source/next.config.ts` keys off `GITHUB_ACTIONS`, the AWS
build simply must **not** run under a GitHub Pages runner (or must override the
switch) so that `basePath` collapses to the empty string `""`. We make the
intent explicit with a `DEPLOY_TARGET` environment variable whose **default is
`''` (empty basePath) for AWS**:

| `DEPLOY_TARGET` | `basePath` | Target |
| --------------- | ---------- | ------ |
| `aws` (default) | `''`       | S3 + CloudFront at domain root (this stack) |
| `pages`         | `/CrossroadThreads` | GitHub Pages (legacy) |

Concretely, for an AWS build the intended `next.config.ts` shape is:

```ts
// DEPLOY_TARGET defaults to 'aws' -> basePath '' (domain root).
// Only DEPLOY_TARGET === 'pages' reintroduces the /CrossroadThreads prefix.
const target = process.env.DEPLOY_TARGET ?? "aws";
const basePath = target === "pages" ? "/CrossroadThreads" : "";
```

This keeps the S3/CloudFront artifact prefix-free: the static export served at
the domain root has correct route and asset URLs, and any component reading
`NEXT_PUBLIC_BASE_PATH` receives `""`. See `source/next.config.ts` for the
values being decoupled and `audit/LAUNCH-ARCHITECTURE.md` §1.1–1.2 for the
full coupling analysis.

> Note: the values in `infra/cdk/lib/static-stack.ts` are all inlined (domain
> name, subdomain, API origin) so this package is self-contained and reads no
> external path at runtime.
