## What

<!-- What changes and why. One concern per PR. -->

## Checklist

- [ ] Affected package suites run locally (list them below with results)
- [ ] No new dependencies or lockfiles in zero-dependency packages
- [ ] No runtime `.telos/` artifacts, secrets, `.env*`, or `*.pem` files committed
- [ ] Hash-pinned/signed artifacts untouched (or regenerated through their own
      runners, with the regeneration described below)
- [ ] If governance records or contracts changed:
      `node docs/institutional-memory/verify-contracts.mjs` and
      `node docs/runs/clotho-self-weave/run.mjs --verify-committed` both pass

## Test results

<!-- e.g. `cd forge && npm test` -> all suites green -->
