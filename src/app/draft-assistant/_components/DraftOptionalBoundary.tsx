"use client";
import { Component, type ReactNode } from "react";

/** Scope errors to optional scenario rendering. Mount with a new key to retry. */
export class DraftOptionalBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p role="status" data-testid="next-pick-unavailable" className="text-sm text-muted-foreground">Preview unavailable. The current recommendation above is unchanged.</p>
      : this.props.children;
  }
}
