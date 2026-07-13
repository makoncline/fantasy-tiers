import { notFound } from "next/navigation";

import MockDraftRoom from "./MockDraftRoom";

export default function MockDraftPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MockDraftRoom />;
}
