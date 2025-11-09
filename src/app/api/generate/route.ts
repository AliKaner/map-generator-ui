import { NextRequest, NextResponse } from "next/server";

import {
  MapRequest,
  generateMap,
  normalizeRequest,
} from "@/lib/map-generator";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let payload: MapRequest;
  try {
    payload = (await request.json()) as MapRequest;
  } catch (error) {
    return NextResponse.json(
      {
        error: `invalid JSON: ${error instanceof Error ? error.message : "unknown error"}`,
      },
      { status: 400 },
    );
  }

  try {
    const params = normalizeRequest(payload);
    const result = generateMap(params);

    return new NextResponse(result.data, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Tile-Batches": result.batches.toString(),
        "X-Tile-Count": result.totalPlacements.toString(),
        "X-Seed": result.seedValue.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 400 },
    );
  }
}

