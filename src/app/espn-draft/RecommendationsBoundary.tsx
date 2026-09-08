"use client";

import { Component, type ReactNode } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RecommendationsIssue({ message, retry }: { message: string; retry: () => void }) {
  return <Alert variant="destructive">
    <AlertTitle>Recommendations paused</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
    <Button variant="outline" onClick={retry}>Try again</Button>
  </Alert>;
}

export class RecommendationsBoundary extends Component<{
  children: ReactNode;
  recoveryKey: string;
  retry: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ recoveryKey: string }>) {
    if (this.state.failed && previous.recoveryKey !== this.props.recoveryKey) {
      this.setState({ failed: false });
    }
  }
  render() {
    return this.state.failed
      ? <RecommendationsIssue message="Your ESPN draft is still open. Try again to restore recommendations." retry={() => {
        this.props.retry();
        this.setState({ failed: false });
      }} />
      : this.props.children;
  }
}
