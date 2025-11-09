"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MapMode = "center" | "weighted" | "islands" | "dual-continents" | "ring";

type MapRequest = {
  w: number;
  h: number;
  tiles?: string;
  mode: MapMode;
  seed?: string;
  islands?: number;
  islandRFrac?: number;
  ka?: number;
  cap?: number;
  rings?: number;
  logTone?: 0 | 1;
  brownCap?: number;
  bgA?: number;
  rot?: 0 | 1;
  n22?: number;
  n21?: number;
  n11?: number;
  polish: boolean;
};

type TileEntry = {
  width: number;
  height: number;
  count: number;
};

type TileEditorProps = {
  tiles: TileEntry[];
  onChange: (tiles: TileEntry[]) => void;
};

const parseTiles = (tiles?: string): TileEntry[] => {
  if (!tiles?.trim()) {
    return [];
  }
  return tiles
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => {
      const [dimensions, countRaw] = entry
        .split("*")
        .map((segment) => segment.trim());
      const [wRaw, hRaw] = (dimensions ?? "")
        .split("x")
        .map((value) => value.trim());
      const width = Number(wRaw);
      const height = Number(hRaw);
      const count = countRaw ? Number(countRaw) : 1;
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isFinite(count) ||
        width <= 0 ||
        height <= 0 ||
        count <= 0
      ) {
        return null;
      }
      return { width, height, count };
    })
    .filter((entry): entry is TileEntry => entry !== null);
};

const formatTiles = (tiles: TileEntry[]) =>
  tiles
    .map(({ width, height, count }) => `${width}x${height}*${count}`)
    .join(",");

function TileEditor({ tiles, onChange }: TileEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ width: "", height: "", count: "" });
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const closeDialog = () => {
    setIsOpen(false);
    setError(null);
    setForm({ width: "", height: "", count: "" });
    setEditingIndex(null);
  };

  const openForAdd = () => {
    setEditingIndex(null);
    setForm({ width: "", height: "", count: "" });
    setIsOpen(true);
  };

  const openForEdit = (index: number) => {
    const tile = tiles[index];
    setEditingIndex(index);
    setForm({
      width: String(tile.width),
      height: String(tile.height),
      count: String(tile.count),
    });
    setIsOpen(true);
  };

  const handleSave = () => {
    const width = Number(form.width);
    const height = Number(form.height);
    const count = Number(form.count);
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(count) ||
      width <= 0 ||
      height <= 0 ||
      count <= 0
    ) {
      setError("Please provide positive numeric values.");
      return;
    }

    if (editingIndex === null) {
      onChange([...tiles, { width, height, count }]);
    } else {
      const next = [...tiles];
      next[editingIndex] = { width, height, count };
      onChange(next);
    }
    closeDialog();
  };

  const handleRemove = (index: number) => {
    onChange(tiles.filter((_, idx) => idx !== index));
  };

  return (
    <div className="rounded-lg border border-white/20 bg-slate-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-100">Tiles</div>
        <button
          type="button"
          onClick={openForAdd}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-lg font-semibold text-white transition hover:bg-sky-400"
          aria-label="Add tile"
        >
          +
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {tiles.length > 0 ? (
          tiles.map((tile, index) => (
            <div
              key={`${tile.width}x${tile.height}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
            >
              <span className="text-slate-200">
                {tile.width}x{tile.height} × {tile.count}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openForEdit(index)}
                  className="rounded-md border border-white/10 px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="rounded-md border border-white/10 px-2 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <span className="text-sm text-slate-400">
            No tiles defined. Add at least one tile batch.
          </span>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingIndex === null ? "Add Tile Batch" : "Edit Tile Batch"}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md px-2 py-1 text-sm text-slate-300 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <label className="flex flex-col gap-1 text-slate-300">
                Width
                <input
                  type="number"
                  min={1}
                  value={form.width}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, width: event.target.value }))
                  }
                  className="rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                Height
                <input
                  type="number"
                  min={1}
                  value={form.height}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, height: event.target.value }))
                  }
                  className="rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                Count
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.count}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, count: event.target.value }))
                  }
                  className="rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-slate-100 focus:border-sky-400 focus:outline-none"
                />
              </label>
            </div>
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
              >
                {editingIndex === null ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_REQUEST: MapRequest = {
  w: 320,
  h: 320,
  tiles: "2x2*4000,2x1*3000,1x1*1200",
  mode: "center",
  rings: 10,
  logTone: 1,
  brownCap: 8,
  polish: false,
};

const API_URL = "/api/generate";

export default function Home() {
  const [request, setRequest] = useState<MapRequest>(DEFAULT_REQUEST);
  const [tiles, setTiles] = useState<TileEntry[]>(() =>
    parseTiles(DEFAULT_REQUEST.tiles)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const effectivePayload = useMemo(() => {
    const normalizedTiles = tiles.length ? formatTiles(tiles) : undefined;
    return {
      ...request,
      tiles: normalizedTiles,
    };
  }, [request, tiles]);

  const handleChange = <K extends keyof MapRequest>(
    key: K,
    value: MapRequest[K]
  ) => {
    setRequest((prev) => ({ ...prev, [key]: value }));
  };

  const handleTilesChange = (nextTiles: TileEntry[]) => {
    setTiles(nextTiles);
    setRequest((prev) => ({
      ...prev,
      tiles: nextTiles.length ? formatTiles(nextTiles) : undefined,
    }));
  };

  const generateMap = async () => {
    setLoading(true);
    setError(null);
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(effectivePayload),
      });

      if (!response.ok) {
        const contentType = response.headers.get("Content-Type") ?? "";
        if (contentType.includes("application/json")) {
          const { error: apiError } = await response.json();
          throw new Error(apiError ?? `Request failed: ${response.status}`);
        }
        throw new Error(`Request failed: ${response.status}`);
      }

      const pngBlob = await response.blob();
      const url = URL.createObjectURL(pngBlob);
      setBlob(pngBlob);
      setImageUrl(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      setBlob(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void generateMap();
  };

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `map-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="PNG Map Generator logo"
              width={48}
              height={48}
              className="rounded-lg"
              priority
            />
            <div>
              <h1 className="text-xl font-semibold">PNG Map Generator UI</h1>
              <p className="text-sm text-slate-300">
                Preview, download, and regenerate procedural PNG maps powered by
                the runtime API.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRequest(DEFAULT_REQUEST);
              setTiles(parseTiles(DEFAULT_REQUEST.tiles));
              setError(null);
              if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
                setImageUrl(null);
              }
              setBlob(null);
            }}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            Load Defaults
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8 lg:flex-row">
        <section className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur lg:w-2/5">
          <h2 className="text-lg font-semibold">Map Settings</h2>
          <form className="flex flex-col gap-4 text-sm" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span>Width (w)</span>
                <input
                  type="number"
                  min={1}
                  value={request.w}
                  onChange={(e) => handleChange("w", Number(e.target.value))}
                  className="rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 focus:border-sky-400 focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>Height (h)</span>
                <input
                  type="number"
                  min={1}
                  value={request.h}
                  onChange={(e) => handleChange("h", Number(e.target.value))}
                  className="rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 focus:border-sky-400 focus:outline-none"
                  required
                />
              </label>
            </div>

            <TileEditor tiles={tiles} onChange={handleTilesChange} />

            <label className="flex flex-col gap-1">
              <span>Mode</span>
              <select
                value={request.mode}
                onChange={(e) =>
                  handleChange("mode", e.target.value as MapMode)
                }
                className="rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 focus:border-sky-400 focus:outline-none"
              >
                <option value="center">Center Growth</option>
                <option value="ring">Ring Bands</option>
                <option value="weighted">Weighted Balance</option>
                <option value="islands">Islands</option>
                <option value="dual-continents">Dual Continents</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span>Seed</span>
              <input
                type="text"
                value={request.seed ?? ""}
                onChange={(e) =>
                  handleChange(
                    "seed",
                    e.target.value.trim() === "" ? undefined : e.target.value
                  )
                }
                placeholder="demo"
                className="rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 focus:border-sky-400 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={request.polish}
                onChange={(e) => handleChange("polish", e.target.checked)}
                className="h-5 w-5 rounded border border-white/20 bg-slate-950/80 accent-sky-500"
              />
              <span>Polish tiles</span>
            </label>

            {request.mode === "islands" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span>Islands</span>
                  <input
                    type="number"
                    min={1}
                    value={request.islands ?? 4}
                    onChange={(e) =>
                      handleChange("islands", Number(e.target.value))
                    }
                    className="rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 focus:border-sky-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Island R Frac</span>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={request.islandRFrac ?? 0.25}
                    onChange={(e) =>
                      handleChange("islandRFrac", Number(e.target.value))
                    }
                    className="rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 focus:border-sky-400 focus:outline-none"
                  />
                </label>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {loading ? "Generating map…" : "Generate Map"}
              </button>
              <button
                type="button"
                onClick={() => void generateMap()}
                disabled={loading}
                className="rounded-lg border border-white/20 px-4 py-2 font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Run Again
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
        </section>

        <section className="flex w-full flex-1 flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Preview</h2>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!blob}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Download PNG
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/30 p-4">
            {loading && (
              <span className="text-sm text-slate-300">Generating map…</span>
            )}
            {!loading && imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Generated map"
                className="max-h-full w-full max-w-full rounded-lg object-contain shadow-lg"
              />
            )}
            {!loading && !imageUrl && (
              <span className="text-sm text-slate-400">
                No map generated yet. Configure parameters and start a run.
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
