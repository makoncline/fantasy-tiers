import { z } from "zod";

export const SleeperPlayerMeta = z.object({
  full_name: z.string().optional(),
  name: z.string().optional(),
  // Add other fields as needed based on actual data structure
});

export const SleeperPlayersMeta = z.record(z.string(), SleeperPlayerMeta);

export type SleeperPlayersMetaT = z.infer<typeof SleeperPlayersMeta>;
