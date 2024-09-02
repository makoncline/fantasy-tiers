"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

const LeagueManagerContent = dynamic(
  () => import("./LeagueManagerContent").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <div>Loading...</div>,
  }
);

export default function LeagueManagerPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>
        <LeagueManagerContent />
      </Suspense>
    </QueryClientProvider>
  );
}
