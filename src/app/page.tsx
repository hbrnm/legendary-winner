"use client";

import { AppShell } from "@/components/app/shell";
import { HomeScreen } from "@/components/home/home-screen";

export default function Page() {
  return (
    <AppShell>
      <HomeScreen />
    </AppShell>
  );
}
