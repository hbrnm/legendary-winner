"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { Spinner } from "@/components/ui/misc";
import { ReceiptCapture } from "@/components/shopping/receipt-capture";
function Screen() { const params = useSearchParams(); return <ReceiptCapture initialListId={params.get("lista") ?? undefined} />; }
export default function Page() { return <AppShell><Suspense fallback={<Spinner />}><Screen /></Suspense></AppShell>; }
