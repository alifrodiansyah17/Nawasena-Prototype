"use client";
import { useEffect } from "react";
import { track } from "./track";

export function TrackView({ name, props }: { name: string; props?: Record<string, unknown> }) {
  useEffect(() => {
    track(name, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
