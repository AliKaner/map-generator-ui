import { PNG } from "pngjs";
import seedrandom from "seedrandom";

export type MapMode =
  | "center"
  | "weighted"
  | "islands"
  | "dual-continents"
  | "ring";

export type MapRequest = {
  w?: number;
  h?: number;
  tiles?: string;
  ka?: number;
  cap?: number;
  mode?: string;
  rings?: number;
  ringStart?: number;
  ringEnd?: number;
  seed?: string;
  logTone?: number;
  brownCap?: number;
  bgA?: number;
  islands?: number;
  islandRFrac?: number;
  rot?: number;
  n22?: number;
  n21?: number;
  n11?: number;
  polish?: boolean;
};

type TileSpec = {
  w: number;
  h: number;
  count: number;
};

type TileBatch = {
  w: number;
  h: number;
  count: number;
};

const MODE_ALIASES: Partial<Record<string, MapMode>> = {
  merkez: "center",
  center: "center",
  agirlik: "weighted",
  weighted: "weighted",
  adalar: "islands",
  islands: "islands",
  "iki-kita": "dual-continents",
  "dual-continents": "dual-continents",
  "dual-continent": "dual-continents",
  "two-continents": "dual-continents",
  ring: "ring",
};

type GenerationParams = {
  width: number;
  height: number;
  tileString: string;
  ka: number;
  cap: number;
  mode: MapMode;
  rings: number;
  ringStart: number;
  ringEnd: number;
  seed: string;
  logTone: boolean;
  brownCap: number;
  bgAlpha: number;
  islands: number;
  islandRFrac: number;
  rotate: boolean;
  polish: boolean;
  n22: number;
  n21: number;
  n11: number;
};

type GenerationResult = {
  data: Buffer;
  batches: number;
  totalPlacements: number;
  seedValue: number;
};

type Point = {
  x: number;
  y: number;
};

class RNG {
  private readonly uniform: seedrandom.PRNG;
  private spare: number | null = null;

  constructor(seed: number) {
    this.uniform = seedrandom(String(seed), { state: true });
  }

  intn(n: number) {
    if (n <= 0) return 0;
    return Math.floor(this.uniform.quick() * n);
  }

  float() {
    return this.uniform.quick();
  }

  normFloat64() {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return value;
    }
    const u = this.float() || Number.EPSILON;
    const v = this.float() || Number.EPSILON;
    const mag = Math.sqrt(-2 * Math.log(u));
    const z0 = mag * Math.cos(2 * Math.PI * v);
    const z1 = mag * Math.sin(2 * Math.PI * v);
    this.spare = z1;
    return z0;
  }
}

class Generator {
  private readonly width: number;
  private readonly height: number;
  private readonly mode: MapMode;
  private rings: number;
  private ringStart: number;
  private ringEnd: number;
  private readonly islands: number;
  private readonly islandRFrac: number;
  private readonly rng: RNG;
  private islandCenters: Point[] = [];
  private continentCenters: Point[] = [];
  private ringBoundaries: number[] = [];
  private totalArea = 0;
  private sumX = 0;
  private sumY = 0;

  constructor(params: GenerationParams, rng: RNG) {
    this.width = params.width;
    this.height = params.height;
    this.mode = params.mode;
    this.rings = params.rings;
    this.ringStart = params.ringStart;
    this.ringEnd = params.ringEnd;
    this.islands = params.islands;
    this.islandRFrac = params.islandRFrac;
    this.rng = rng;

    switch (this.mode) {
      case "islands":
        this.initIslands();
        break;
      case "dual-continents":
        this.initContinents();
        break;
      case "ring":
        this.initRingBands();
        break;
      default:
        break;
    }
  }

  private initIslands() {
    const count = Math.max(1, this.islands || 3);
    const minDim = Math.min(this.width, this.height);
    const margin = Math.floor(minDim * 0.1);
    this.islandCenters = Array.from({ length: count }).map(() => {
      const x =
        margin +
        (this.width - 2 * margin > 0
          ? this.rng.intn(this.width - 2 * margin)
          : 0);
      const y =
        margin +
        (this.height - 2 * margin > 0
          ? this.rng.intn(this.height - 2 * margin)
          : 0);
      return { x, y };
    });
  }

  private initContinents() {
    this.continentCenters = [
      { x: Math.floor(this.width / 4), y: Math.floor(this.height / 2) },
      { x: Math.floor((3 * this.width) / 4), y: Math.floor(this.height / 2) },
    ];
  }

  private initRingBands() {
    let start = clampFloat(this.ringStart, 0, 1);
    let end = clampFloat(this.ringEnd, 0, 1);
    if (end <= start) {
      if (end >= 1) {
        start = clampFloat(end - 0.1, 0, 1);
      } else {
        end = clampFloat(start + 0.1, 0, 1);
      }
    }

    const segments = Math.max(1, this.rings);
    this.ringStart = start;
    this.ringEnd = end;
    this.ringBoundaries = new Array(segments + 1).fill(0);
    this.ringBoundaries[0] = 0;

    if (segments === 1) {
      this.ringBoundaries[1] = Math.max(start, Math.min(1, end));
      return;
    }

    let span = end - start;
    if (span <= 0) {
      span = 0.1;
      end = clampFloat(start + span, start, 1);
    }
    const step = span / (segments - 1);
    let prev = 0;

    for (let i = 1; i <= segments; i++) {
      let val: number;
      if (i === 1) {
        val = start;
      } else if (i === segments) {
        val = end;
      } else {
        val = start + (i - 1) * step;
      }
      val = clampFloat(val, prev, 1);
      this.ringBoundaries[i] = val;
      prev = val;
    }
  }

  positionForTile(tw: number, th: number): Point {
    if (tw >= this.width || th >= this.height) {
      return { x: 0, y: 0 };
    }

    switch (this.mode) {
      case "center":
        return this.positionCenter(tw, th);
      case "weighted":
        return this.positionWeighted(tw, th);
      case "islands":
        return this.positionIslands(tw, th);
      case "dual-continents":
        return this.positionDualContinents(tw, th);
      case "ring":
        return this.positionRing(tw, th);
      default:
        return this.positionWeighted(tw, th);
    }
  }

  private randomPlacement(tw: number, th: number): Point {
    const spanX = Math.max(0, this.width - tw);
    const spanY = Math.max(0, this.height - th);
    const x = spanX > 0 ? this.rng.intn(spanX + 1) : 0;
    const y = spanY > 0 ? this.rng.intn(spanY + 1) : 0;
    return { x, y };
  }

  private selectRingSegment(): number {
    const segments = this.ringBoundaries.length - 1;
    if (segments <= 0) return -1;

    const start = clampFloat(this.ringStart, 0, 1);
    const end = clampFloat(this.ringEnd, start, 1);
    const span = Math.max(end - start, 1e-3);

    const weights = new Array<number>(segments);
    let totalWeight = 0;

    for (let i = 0; i < segments; i++) {
      const rawInner = this.ringBoundaries[i];
      const rawOuter = this.ringBoundaries[i + 1];
      const inner = Math.max(rawInner, start);
      const outer = Math.min(rawOuter, end);
      if (outer <= inner) {
        weights[i] = 0;
        continue;
      }
      const mid = (inner + outer) / 2;
      const normalized = clampFloat((mid - start) / span, 0, 1);
      const falloff = 0.02 + Math.pow(normalized, 1.5);
      weights[i] = falloff;
      totalWeight += falloff;
    }

    if (totalWeight <= 0) {
      return segments - 1;
    }

    let threshold = this.rng.float() * totalWeight;
    for (let i = 0; i < segments; i++) {
      threshold -= weights[i];
      if (threshold <= 0) {
        return i;
      }
    }

    return segments - 1;
  }

  private positionRing(tw: number, th: number): Point {
    const minDim = Math.min(this.width, this.height);
    const radiusMax = minDim / 2;
    for (let attempt = 0; attempt < 12; attempt++) {
      const segment = this.selectRingSegment();
      if (segment < 0 || segment + 1 >= this.ringBoundaries.length) {
        continue;
      }
      const inner = Math.max(this.ringBoundaries[segment], this.ringStart);
      const outer = Math.min(
        Math.max(inner, this.ringBoundaries[segment + 1]),
        this.ringEnd
      );
      if (outer <= inner) continue;
      const radiusFrac = inner + this.rng.float() * (outer - inner);
      const theta = this.rng.float() * 2 * Math.PI;
      const radius = radiusFrac * radiusMax;
      const cx = this.width / 2 + Math.cos(theta) * radius;
      const cy = this.height / 2 + Math.sin(theta) * radius;
      const x = clampInt(
        Math.round(cx) - Math.floor(tw / 2),
        0,
        this.width - tw
      );
      const y = clampInt(
        Math.round(cy) - Math.floor(th / 2),
        0,
        this.height - th
      );
      return { x, y };
    }
    const fallbackSpan = Math.max(this.ringEnd - this.ringStart, 0);
    if (fallbackSpan > 0) {
      const radiusFrac = this.ringStart + this.rng.float() * fallbackSpan;
      const theta = this.rng.float() * 2 * Math.PI;
      const radius = radiusFrac * radiusMax;
      const cx = this.width / 2 + Math.cos(theta) * radius;
      const cy = this.height / 2 + Math.sin(theta) * radius;
      const x = clampInt(
        Math.round(cx) - Math.floor(tw / 2),
        0,
        this.width - tw
      );
      const y = clampInt(
        Math.round(cy) - Math.floor(th / 2),
        0,
        this.height - th
      );
      return { x, y };
    }
    return this.randomPlacement(tw, th);
  }

  private positionCenter(tw: number, th: number): Point {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const roll = this.rng.float();

    const sampleCenteredDisk = (fraction: number): Point => {
      const regionRadiusX = Math.min(
        this.width / 2,
        (this.width * fraction) / 2
      );
      const regionRadiusY = Math.min(
        this.height / 2,
        (this.height * fraction) / 2
      );
      const maxOffsetX = Math.max(
        0,
        Math.min(regionRadiusX, this.width / 2 - tw / 2)
      );
      const maxOffsetY = Math.max(
        0,
        Math.min(regionRadiusY, this.height / 2 - th / 2)
      );

      if (maxOffsetX === 0 && maxOffsetY === 0) {
        const x = clampInt(Math.round(centerX - tw / 2), 0, this.width - tw);
        const y = clampInt(Math.round(centerY - th / 2), 0, this.height - th);
        return { x, y };
      }

      for (let attempt = 0; attempt < 16; attempt++) {
        const theta = this.rng.float() * 2 * Math.PI;
        const radiusFactor = Math.sqrt(this.rng.float());
        const dx = Math.cos(theta) * maxOffsetX * radiusFactor;
        const dy = Math.sin(theta) * maxOffsetY * radiusFactor;
        const tileCenterX = clampFloat(
          centerX + dx,
          tw / 2,
          this.width - tw / 2
        );
        const tileCenterY = clampFloat(
          centerY + dy,
          th / 2,
          this.height - th / 2
        );
        const x = clampInt(
          Math.round(tileCenterX - tw / 2),
          0,
          this.width - tw
        );
        const y = clampInt(
          Math.round(tileCenterY - th / 2),
          0,
          this.height - th
        );
        if (x >= 0 && x <= this.width - tw && y >= 0 && y <= this.height - th) {
          return { x, y };
        }
      }

      const fallbackX = clampInt(
        Math.round(centerX - tw / 2),
        0,
        this.width - tw
      );
      const fallbackY = clampInt(
        Math.round(centerY - th / 2),
        0,
        this.height - th
      );
      return { x: fallbackX, y: fallbackY };
    };

    if (roll < 0.7) {
      return sampleCenteredDisk(0.3);
    }
    if (roll < 0.99) {
      return sampleCenteredDisk(0.5);
    }
    return this.randomPlacement(tw, th);
  }

  private positionWeighted(tw: number, th: number): Point {
    const targetX = this.width / 2;
    const targetY = this.height / 2;
    const centerX = clampInt(
      Math.round(targetX) - Math.floor(tw / 2),
      0,
      this.width - tw
    );
    const centerY = clampInt(
      Math.round(targetY) - Math.floor(th / 2),
      0,
      this.height - th
    );

    let bestX = centerX;
    let bestY = centerY;
    let bestScore = this.distanceAfterPlacement(
      centerX,
      centerY,
      tw,
      th,
      targetX,
      targetY
    );

    const com = this.centerOfMass();
    let currentDist = Number.POSITIVE_INFINITY;
    if (com) {
      const [cx, cy] = com;
      currentDist = Math.hypot(cx - targetX, cy - targetY);
      const mirrorCenterX = targetX * 2 - cx;
      const mirrorCenterY = targetY * 2 - cy;
      const mirrorX = clampInt(
        Math.round(mirrorCenterX) - Math.floor(tw / 2),
        0,
        this.width - tw
      );
      const mirrorY = clampInt(
        Math.round(mirrorCenterY) - Math.floor(th / 2),
        0,
        this.height - th
      );
      const mirrorScore = this.distanceAfterPlacement(
        mirrorX,
        mirrorY,
        tw,
        th,
        targetX,
        targetY
      );
      if (mirrorScore < bestScore) {
        bestScore = mirrorScore;
        bestX = mirrorX;
        bestY = mirrorY;
      }
    }

    for (let attempt = 0; attempt < 24; attempt++) {
      const { x, y } = this.randomPlacement(tw, th);
      const score = this.distanceAfterPlacement(x, y, tw, th, targetX, targetY);
      if (score < bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
        if (
          currentDist !== Number.POSITIVE_INFINITY &&
          score <= currentDist * 0.7
        ) {
          break;
        }
      }
    }

    return { x: bestX, y: bestY };
  }

  private positionIslands(tw: number, th: number): Point {
    if (!this.islandCenters.length) {
      return this.positionCenter(tw, th);
    }
    const center = this.islandCenters[this.rng.intn(this.islandCenters.length)];
    const radiusFrac = Math.max(this.islandRFrac || 0.25, 0.05);
    const maxRadius = radiusFrac * Math.min(this.width, this.height);
    const radius = this.rng.float() * maxRadius;
    const theta = this.rng.float() * 2 * Math.PI;
    const cx = center.x + Math.cos(theta) * radius;
    const cy = center.y + Math.sin(theta) * radius;
    const x = clampInt(Math.round(cx) - Math.floor(tw / 2), 0, this.width - tw);
    const y = clampInt(
      Math.round(cy) - Math.floor(th / 2),
      0,
      this.height - th
    );
    return { x, y };
  }

  private positionDualContinents(tw: number, th: number): Point {
    if (!this.continentCenters.length) {
      return this.positionCenter(tw, th);
    }
    const center =
      this.continentCenters[this.rng.intn(this.continentCenters.length)];
    const sigmaX = this.width / 10;
    const sigmaY = this.height / 6;
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = Math.round(center.x + this.rng.normFloat64() * sigmaX);
      const y = Math.round(center.y + this.rng.normFloat64() * sigmaY);
      if (x >= 0 && x <= this.width - tw && y >= 0 && y <= this.height - th) {
        return { x, y };
      }
    }
    return this.positionCenter(tw, th);
  }

  recordPlacement(x: number, y: number, tw: number, th: number) {
    const area = tw * th;
    if (area <= 0) return;
    const centerX = x + tw / 2;
    const centerY = y + th / 2;
    this.totalArea += area;
    this.sumX += centerX * area;
    this.sumY += centerY * area;
  }

  private centerOfMass(): [number, number] | null {
    if (this.totalArea <= 0) return null;
    return [this.sumX / this.totalArea, this.sumY / this.totalArea];
  }

  private distanceAfterPlacement(
    x: number,
    y: number,
    tw: number,
    th: number,
    targetX: number,
    targetY: number
  ): number {
    const area = tw * th;
    if (area <= 0) {
      const com = this.centerOfMass();
      if (!com) return 0;
      return Math.hypot(com[0] - targetX, com[1] - targetY);
    }
    const total = this.totalArea + area;
    const tileCenterX = x + tw / 2;
    const tileCenterY = y + th / 2;
    const newCx = (this.sumX + tileCenterX * area) / total;
    const newCy = (this.sumY + tileCenterY * area) / total;
    return Math.hypot(newCx - targetX, newCy - targetY);
  }
}

export function normalizeRequest(req: MapRequest): GenerationParams {
  const width = req.w && req.w > 0 ? req.w : 100;
  const height = req.h && req.h > 0 ? req.h : 100;
  if (width <= 0) throw new Error("width must be positive");
  if (height <= 0) throw new Error("height must be positive");

  const rawMode = (req.mode ?? "center").toLowerCase();
  const mode = MODE_ALIASES[rawMode];
  if (!mode) {
    throw new Error(`unsupported mode ${req.mode}`);
  }

  const rings = req.rings && req.rings > 0 ? req.rings : 10;
  const ringStart = clampFloat(req.ringStart ?? 0.1, 0, 1);
  let ringEnd = clampFloat(req.ringEnd ?? 0.8, 0, 1);
  if (ringEnd <= ringStart) {
    const adjusted = clampFloat(ringStart + 0.05, ringStart, 1);
    if (adjusted === ringStart) {
      throw new Error("ringEnd must be greater than ringStart");
    }
    ringEnd = adjusted;
  }

  const ka = req.ka ?? 1;
  const cap = req.cap && req.cap > 0 ? req.cap : 0;
  const logTone = req.logTone == null ? true : req.logTone !== 0;
  const brownCap = req.brownCap && req.brownCap > 0 ? req.brownCap : 8;
  const bgAlpha = clampInt(req.bgA ?? 0, 0, 255);
  const islands = req.islands && req.islands > 0 ? req.islands : 4;
  const islandRFrac =
    req.islandRFrac && req.islandRFrac > 0 ? req.islandRFrac : 0.25;
  const rotate = req.rot == null ? true : req.rot !== 0;
  const polish = req.polish === true;

  return {
    width,
    height,
    tileString: req.tiles ?? "",
    ka,
    cap,
    mode,
    rings,
    ringStart,
    ringEnd,
    seed: req.seed ?? "",
    logTone,
    brownCap,
    bgAlpha,
    islands,
    islandRFrac,
    rotate,
    polish,
    n22: req.n22 ?? 0,
    n21: req.n21 ?? 0,
    n11: req.n11 ?? 0,
  };
}

export function generateMap(params: GenerationParams): GenerationResult {
  const specs = finalizeSpecs(params);
  if (!specs.length) {
    throw new Error("no tiles to place after cap adjustment");
  }

  const seedValue = seedFromString(params.seed);
  const rng = new RNG(seedValue);
  const generator = new Generator(params, rng);

  const png = new PNG({
    width: params.width,
    height: params.height,
    colorType: 6,
    inputHasAlpha: true,
  });

  const coverage = new Uint16Array(params.width * params.height);
  const totalInfo = placeTiles(generator, params, specs, coverage, rng);

  const green = { r: 34, g: 139, b: 34, a: 255 };
  const brown = { r: 139, g: 69, b: 19, a: 255 };
  const water = {
    r: 22,
    g: 75,
    b: 135,
    a: clampInt(params.bgAlpha || 255, 0, 255),
  };

  for (let y = 0; y < params.height; y++) {
    for (let x = 0; x < params.width; x++) {
      const idx = y * params.width + x;
      const cov = coverage[idx];
      const baseOffset = idx * 4;
      if (cov === 0) {
        png.data[baseOffset] = water.r;
        png.data[baseOffset + 1] = water.g;
        png.data[baseOffset + 2] = water.b;
        png.data[baseOffset + 3] = water.a;
        continue;
      }
      const color = coverageToColor(
        cov,
        params.brownCap,
        params.logTone,
        green,
        brown
      );
      png.data[baseOffset] = color.r;
      png.data[baseOffset + 1] = color.g;
      png.data[baseOffset + 2] = color.b;
      png.data[baseOffset + 3] = color.a;
    }
  }

  const buffer = PNG.sync.write(png);
  return {
    data: buffer,
    batches: specs.length,
    totalPlacements: totalInfo.totalPlacements,
    seedValue,
  };
}

function finalizeSpecs(params: GenerationParams): TileBatch[] {
  let specs = parseTileList(params.tileString);
  specs = applyLegacyTiles(specs, params.n22, params.n21, params.n11);
  activateMultiplier(specs, params.ka);
  return finalizeTileBatches(specs, params.cap);
}

function parseTileList(input: string): TileSpec[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [
      { w: 2, h: 2, count: 400 },
      { w: 2, h: 1, count: 300 },
      { w: 1, h: 1, count: 100 },
    ];
  }
  const parts = trimmed.split(",");
  const result: TileSpec[] = [];
  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part) continue;
    const [dimStr, countStr] = part.split("*");
    const dims = dimStr.split("x");
    if (dims.length !== 2) {
      throw new Error(`invalid tile dimensions in ${part}`);
    }
    const w = parseInt(dims[0].trim(), 10);
    const h = parseInt(dims[1].trim(), 10);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      throw new Error(`tile dimensions must be positive in ${part}`);
    }
    let count = 1;
    if (countStr) {
      const countVal = parseFloat(countStr.trim());
      if (!Number.isFinite(countVal)) {
        throw new Error(`invalid tile count in ${part}`);
      }
      count = countVal;
    }
    if (count <= 0) continue;
    result.push({ w, h, count });
  }
  if (!result.length) {
    throw new Error("no valid tile definitions found");
  }
  return result;
}

function applyLegacyTiles(
  specs: TileSpec[],
  n22: number,
  n21: number,
  n11: number
) {
  const legacy = [
    { w: 2, h: 2, n: n22 },
    { w: 2, h: 1, n: n21 },
    { w: 1, h: 1, n: n11 },
  ];
  for (const entry of legacy) {
    if (!entry.n || entry.n <= 0) continue;
    const found = specs.find((s) => s.w === entry.w && s.h === entry.h);
    if (found) {
      found.count += entry.n;
    } else {
      specs.push({ w: entry.w, h: entry.h, count: entry.n });
    }
  }
  return specs;
}

function activateMultiplier(specs: TileSpec[], ka: number) {
  if (ka <= 0) {
    return;
  }
  if (ka === 1) return;
  for (const spec of specs) {
    spec.count *= ka;
  }
}

function finalizeTileBatches(specs: TileSpec[], capLimit: number): TileBatch[] {
  let sumCounts = 0;
  for (const s of specs) {
    sumCounts += s.count;
  }
  if (sumCounts === 0) return [];

  let scale = 1;
  if (capLimit > 0 && sumCounts > capLimit) {
    scale = capLimit / sumCounts;
  }

  const scaledTotals = new Array(specs.length).fill(0);
  const floors = new Array(specs.length).fill(0);
  const fractions: { index: number; frac: number }[] = [];
  let totalFloors = 0;

  specs.forEach((s, i) => {
    const adjusted = s.count * scale;
    if (adjusted <= 0) return;
    scaledTotals[i] = adjusted;
    const base = Math.floor(adjusted);
    floors[i] = base;
    totalFloors += base;
    const frac = adjusted - base;
    if (frac > 0) {
      fractions.push({ index: i, frac });
    }
  });

  let targetTotal = Math.round(scaledTotals.reduce((acc, val) => acc + val, 0));
  if (capLimit > 0) {
    targetTotal = scale < 1 ? capLimit : Math.min(capLimit, targetTotal);
  }

  if (targetTotal < totalFloors) {
    fractions
      .sort((a, b) => (a.frac === b.frac ? a.index - b.index : a.frac - b.frac))
      .slice(0, totalFloors - targetTotal)
      .forEach((fraction) => {
        if (floors[fraction.index] > 0) {
          floors[fraction.index]--;
        }
      });
    totalFloors = targetTotal;
  }

  if (totalFloors < targetTotal) {
    const remaining = targetTotal - totalFloors;
    fractions
      .sort((a, b) => (a.frac === b.frac ? a.index - b.index : b.frac - a.frac))
      .slice(0, remaining)
      .forEach((fraction) => {
        floors[fraction.index]++;
      });
  }

  const batches: TileBatch[] = [];
  specs.forEach((s, i) => {
    const count = floors[i];
    if (count <= 0) return;
    batches.push({ w: s.w, h: s.h, count });
  });
  return batches;
}

function coverageToColor(
  coverage: number,
  brownCap: number,
  logTone: boolean,
  green: { r: number; g: number; b: number; a: number },
  brown: { r: number; g: number; b: number; a: number }
) {
  if (coverage <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (coverage === 1) {
    return green;
  }
  const cap = Math.max(1, brownCap);
  let ratio: number;
  if (logTone) {
    ratio = Math.log(coverage) / Math.log(cap + 1);
  } else {
    ratio = (coverage - 1) / cap;
  }
  ratio = clampFloat(ratio, 0, 1);
  return blendColor(green, brown, ratio);
}

function blendColor(
  a: { r: number; g: number; b: number; a: number },
  b: { r: number; g: number; b: number; a: number },
  t: number
) {
  const clamp = (v: number) => {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return Math.round(v);
  };
  const alpha = (1 - t) * a.a + t * b.a || 1;
  return {
    r: clamp((1 - t) * a.r + t * b.r),
    g: clamp((1 - t) * a.g + t * b.g),
    b: clamp((1 - t) * a.b + t * b.b),
    a: clamp(alpha),
  };
}

function seedFromString(seed: string) {
  if (!seed) {
    return Date.now();
  }
  let h = BigInt("1469598103934665603");
  const prime = BigInt("1099511628211");
  for (let i = 0; i < seed.length; i++) {
    h ^= BigInt(seed.charCodeAt(i));
    h *= prime;
  }
  const mask = BigInt("0x7fffffffffffffff");
  return Number(h & mask);
}

function placeTiles(
  generator: Generator,
  params: GenerationParams,
  batches: TileBatch[],
  coverage: Uint16Array,
  rng: RNG
) {
  let totalPlacements = 0;
  for (const batch of batches) {
    totalPlacements += batch.count;
    for (let i = 0; i < batch.count; i++) {
      let { w, h } = batch;
      if (params.rotate && w !== h && rng.intn(2) === 0) {
        [w, h] = [h, w];
      }
      if (w <= 0 || h <= 0 || w > params.width || h > params.height) {
        continue;
      }
      const { x, y } = generator.positionForTile(w, h);
      generator.recordPlacement(x, y, w, h);
      if (!params.polish) {
        for (let yy = y; yy < y + h; yy++) {
          const rowOffset = yy * params.width;
          for (let xx = x; xx < x + w; xx++) {
            const idx = rowOffset + xx;
            coverage[idx] += 1;
          }
        }
        continue;
      }

      const padding = 1;
      const radiusSq = 1;
      const innerRight = x + w;
      const innerBottom = y + h;
      const startY = Math.max(0, y - padding);
      const endY = Math.min(params.height, innerBottom + padding);
      const startX = Math.max(0, x - padding);
      const endX = Math.min(params.width, innerRight + padding);

      for (let yy = startY; yy < endY; yy++) {
        const rowOffset = yy * params.width;
        const insideY = yy >= y && yy < innerBottom;
        for (let xx = startX; xx < endX; xx++) {
          const insideX = xx >= x && xx < innerRight;
          const idx = rowOffset + xx;
          if (insideX && insideY) {
            coverage[idx] += 1;
            continue;
          }

          const nearestX = xx < x ? x : xx >= innerRight ? innerRight - 1 : xx;
          const nearestY =
            yy < y ? y : yy >= innerBottom ? innerBottom - 1 : yy;
          const dx = xx - nearestX;
          const dy = yy - nearestY;
          if (dx * dx + dy * dy <= radiusSq) {
            coverage[idx] += 1;
          }
        }
      }
    }
  }
  return { totalPlacements };
}

function clampInt(v: number, minVal: number, maxVal: number) {
  if (v < minVal) return minVal;
  if (v > maxVal) return maxVal;
  return v;
}

function clampFloat(v: number, minVal: number, maxVal: number) {
  if (Number.isNaN(v)) return minVal;
  if (v < minVal) return minVal;
  if (v > maxVal) return maxVal;
  return v;
}
