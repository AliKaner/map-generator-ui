# PNG Map Generator UI

A slick Next.js interface for generating procedural PNG maps on demand. Tweak tile batches, experiment with multiple growth modes, and download production-ready images without leaving the browser.

https://github.com/aliknr/map-generator-ui

## Features

- Interactive map controls for width/height, seed strings, polishing, and water alpha
- Tile batch editor with add/edit/remove support and automatic payload formatting
- Five generation modes (`center`, `weighted`, `islands`, `dual-continents`, `ring`) including deterministic seeds
- Live preview with instant retries and one-click PNG download
- Next.js API route powered by a TypeScript port of the original PNG map generator

## Tech Stack

- [Next.js 16](https://nextjs.org/) App Router
- React 19 with the new React Compiler
- Tailwind-style utility classes (PostCSS + Tailwind CSS v4)
- Procedural map core implemented in TypeScript using [`pngjs`](https://github.com/lukeapage/pngjs) and [`seedrandom`](https://github.com/davidbau/seedrandom)

## Getting Started

### Prerequisites

- Node.js 18.18+ (Next.js 16 requirement)
- [pnpm](https://pnpm.io/) 8+

### Installation

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to use the UI. The page auto-refreshes on save.

### Other scripts

```bash
pnpm build   # production build
pnpm start   # serve the build
pnpm lint    # run eslint
```

## Usage

1. Adjust core dimensions and edit tile batches via the “Tiles” panel.
2. Pick a generation mode and optional seed to get deterministic results.
3. Toggle advanced fields (rings, polish, background alpha, etc.) as needed.
4. Click **Generate Map** or **Run Again** to produce a fresh image.
5. Use **Download PNG** to save the most recent render.

### Tile batch format

- Comma-separated entries: `WIDTHxHEIGHT*COUNT`
- Example: `2x2*4000,2x1*3000,1x1*1200`
- `COUNT` defaults to `1` when omitted.

The UI keeps the list in sync with the API payload, so you can manage batches visually without worrying about formatting errors.

## API

The UI talks to `POST /api/generate`. You can call it directly to integrate the generator elsewhere.

```json
{
  "w": 320,
  "h": 320,
  "tiles": "2x2*4000,2x1*3000,1x1*1200",
  "mode": "center",
  "seed": "demo",
  "rings": 10,
  "logTone": 1,
  "brownCap": 8,
  "bgA": 0,
  "polish": false
}
```

### Request fields

| Field                    | Type    | Default                      | Notes                                                                                  |
| ------------------------ | ------- | ---------------------------- | -------------------------------------------------------------------------------------- | --------------------------------- |
| `w`, `h`                 | number  | `320`                        | Canvas size in pixels. Must be positive.                                               |
| `tiles`                  | string  | `2x2*4000,2x1*3000,1x1*1200` | Tile batches in the format above.                                                      |
| `mode`                   | string  | `center`                     | One of `center`, `weighted`, `islands`, `dual-continents`, `ring` (aliases supported). |
| `seed`                   | string  | `""`                         | Deterministic seed. Empty string yields pseudo-random runs.                            |
| `rings`                  | number  | `10`                         | Band count for `ring` mode.                                                            |
| `ringStart`, `ringEnd`   | number  | `0.1`, `0.8`                 | Radial bounds (0–1) for ring growth.                                                   |
| `ka`                     | number  | `1`                          | Multiplier applied to every tile count.                                                |
| `cap`                    | number  | `0`                          | Hard ceiling for total tile placements (0 = uncapped).                                 |
| `logTone`                | `0      | 1`                           | `1`                                                                                    | Enables logarithmic tone mapping. |
| `brownCap`               | number  | `8`                          | Max terrain density before brown shading kicks in.                                     |
| `bgA`                    | number  | `0`                          | Background alpha (0–255).                                                              |
| `rot`                    | `0      | 1`                           | `1`                                                                                    | Toggles tile rotation randomness. |
| `polish`                 | boolean | `false`                      | Enables lightweight tile edge smoothing.                                               |
| `islands`, `islandRFrac` | number  | `4`, `0.25`                  | Extra knobs for `islands` mode.                                                        |
| `n22`, `n21`, `n11`      | number  | `0`                          | Legacy boosts for specific tile sizes.                                                 |

Successful responses return PNG binary data. Helpful metadata is exposed via headers:

- `X-Tile-Batches` — total number of tile batches after normalization
- `X-Tile-Count` — total placements performed
- `X-Seed` — numeric seed used in the PRNG

Errors are returned as JSON with an `error` field and a `400` status code.

## Project Structure

- `src/app/page.tsx` — main client UI with form logic, preview, and tile editor
- `src/app/api/generate/route.ts` — API handler proxying requests to the generator core
- `src/lib/map-generator.ts` — procedural generation engine, request normalization, and PNG rendering
- `public/logo.png` — branding used in the UI header

## Contributing

Issues and PRs are welcome. Please run `pnpm lint` before submitting a pull request.

## License

No license file has been provided yet. Reach out to the repository owner if you need clarity on usage rights.
