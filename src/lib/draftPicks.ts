import { z } from "zod";
import { DraftPick, DraftPickSchema } from "./schemas";

export async function fetchDraftPicks(draftId: string): Promise<DraftPick[]> {
  const response = await fetch(
    `https://api.sleeper.app/v1/draft/${draftId}/picks`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch drafted players");
  }

  const jsonData = await response.json();

  // Handle the case where no picks have been made (API returns an empty array)
  if (Array.isArray(jsonData) && jsonData.length === 0) {
    return []; // Return an empty array if no picks have been made
  }

  // Validate the response using Zod
  const parsedData = z.array(DraftPickSchema).safeParse(jsonData);
  if (!parsedData.success) {
    console.error("Zod Validation Errors:", parsedData.error); // Log the validation errors
    throw new Error("fetchDraftPicks: Invalid data structure from Sleeper API");
  }

  // Add normalized name and handle cases where first_name or last_name are missing
  return parsedData.data;
}
