import { readPublishedFantasyProsProjections } from "@/lib/fantasyProsProjectionSource";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(readPublishedFantasyProsProjections(), { headers: { "Cache-Control": "no-store" } });
}
