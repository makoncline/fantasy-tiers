import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  fetchSleeperPlayersMeta,
  SleeperPlayersMetaSchema,
} from "@/lib/sleeper";

export async function GET(_req: NextRequest) {
  const data = await fetchSleeperPlayersMeta();
  return NextResponse.json(SleeperPlayersMetaSchema.parse(data));
}
