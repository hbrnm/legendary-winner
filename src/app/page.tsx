"use client";

import { useState } from "react";
import { AppShell } from "@/components/app/shell";
import { HomeScreen } from "@/components/home/home-screen";

export default function Page() {
  const [captureTarget, setCaptureTarget] = useState<HTMLDivElement | null>(null);

  return (
    <AppShell captureTarget={captureTarget} mainClassName="home-today">
      <HomeScreen captureRef={setCaptureTarget} />
    </AppShell>
  );
}
