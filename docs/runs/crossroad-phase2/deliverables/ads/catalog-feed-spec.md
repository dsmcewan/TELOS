# Crossroad Threads — Catalog Feed Spec (Meta / Google)

> Machine-readable product **feed** spec for Meta Advantage+ / Dynamic Product Ads and Google Merchant Center.
> Certified source: `audit/ADVERTISING.md`; product data source: `source/designs.json`; generator: extend `scripts/build-catalog.ts`.
>
> **Epistemic note:** per `audit/ADVERTISING.md`, no ad **feed** is emitted today — the audit states "None of these emit an ad catalog feed today, which is why the feed is a Phase 2 item." This spec defines that Phase 2 artifact. All performance/audience claims elsewhere remain Hypotheses.

## Posture: own-domain URLs only

`audit/ADVERTISING.md` records the migration "from a static Next.js export served on GitHub Pages under a `basePath` to a real storefront on its own domain." Therefore every URL in the **feed** MUST be an absolute own-domain URL. **Do NOT** prepend any GitHub Pages `basePath`.

- Domain: `https://crossroadthreads.com`
- Product/landing route: per-slug exhibit page `src/app/exhibit/[slug]/page.tsx` → `https://crossroadthreads.com/exhibit/<slug>`

## Required feed fields (one row per exhibit slug)

Each product entry is keyed by the exhibit **slug** sourced from `source/designs.json`.

| Field | Type | Source | Rule |
|---|---|---|---|
| `id` | string | slug from `source/designs.json` | Stable unique per slug; reused across Meta & Google. |
| `title` | string | design title from `source/designs.json` | Museum-placard voice per `src/lib/copy.ts`. |
| `price` | string | price from commerce model (`src/lib/commerce.ts`, `src/lib/types.ts`) | Format `"NN.NN USD"`. |
| `image_link` | URL | design image, own domain | Absolute `https://crossroadthreads.com/...`; **no basePath**. |
| `link` | URL | per-slug exhibit route | `https://crossroadthreads.com/exhibit/<slug>`. |

The **required tokens** for this feed are the fields `id`, `title`, `price`, `image_link`, and `link`. Note the exact field name `image_link` (Meta/Google spelling; underscore, not `imageLink`).

## Generation: extend `scripts/build-catalog.ts`

Per `audit/ADVERTISING.md`, the catalog is generated at build time (`npm run catalog` → `tsx scripts/build-catalog.ts`, wired via package.json `predev`/`prebuild`/`catalog`). Extend that existing script to additionally emit the ad **feed** — do not add a new writer path elsewhere.

### Reference logic (to add to `scripts/build-catalog.ts`)

```ts
// Extension inside scripts/build-catalog.ts — emit Meta/Google feed rows.
// designs are already loaded from source/designs.json by this script.
const OWN_DOMAIN = "https://crossroadthreads.com"; // NO GitHub Pages basePath

type FeedRow = {
  id: string;
  title: string;
  price: string;       // "NN.NN USD"
  image_link: string;  // absolute own-domain URL
  link: string;        // absolute own-domain exhibit URL
};

function toFeedRow(design: {
  slug: string;
  title: string;
  price: number;
  image: string;
}): FeedRow {
  return {
    id: design.slug,
    title: design.title,
    price: `${design.price.toFixed(2)} USD`,
    image_link: `${OWN_DOMAIN}/${design.image.replace(/^\/+/, "")}`,
    link: `${OWN_DOMAIN}/exhibit/${design.slug}`,
  };
}

// feed = designs.map(toFeedRow);
// The build-catalog script writes this alongside the existing catalog output.
// (This spec file is documentation only and writes nothing.)
```

## Output formats

### CSV / TSV header (Meta & Google Merchant Center)

```
id\ttitle\tprice\timage_link\tlink
```

### JSON row example (own-domain, no basePath)

```json
{
  "id": "the-crossroads-bargain",
  "title": "The Crossroads Bargain — Placard No. 01",
  "price": "38.00 USD",
  "image_link": "https://crossroadthreads.com/img/the-crossroads-bargain.png",
  "link": "https://crossroadthreads.com/exhibit/the-crossroads-bargain"
}
```

## Validation checklist

- [ ] One feed row per exhibit slug in `source/designs.json`.
- [ ] `id`, `title`, `price`, `image_link`, `link` present and non-empty on every row.
- [ ] Every `image_link` and `link` is absolute and starts with `https://crossroadthreads.com/` — **no** GitHub Pages basePath prefix.
- [ ] `price` matches `^[0-9]+\.[0-9]{2} USD$`.
- [ ] Emitted by extending `scripts/build-catalog.ts` (no separate writer).

_Sources: `audit/ADVERTISING.md`, `source/designs.json`, `scripts/build-catalog.ts`, `src/app/exhibit/[slug]/page.tsx`._
