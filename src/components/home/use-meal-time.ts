"use client";

import { useEffect, useState } from "react";
import { now } from "@/lib/clock";
import { toISODate } from "@/lib/domain/dates";
import { mealForHour } from "@/lib/domain/recipes";

function localMealTime() {
  const date = now();
  return { today: toISODate(date), meal: mealForHour(date.getHours()) };
}

/** Actualizează masa și ziua fără reîncărcare, inclusiv după revenirea în aplicație. */
export function useMealTime() {
  const [time, setTime] = useState(localMealTime);
  useEffect(() => {
    const refresh = () => {
      const next = localMealTime();
      setTime(previous => previous.today === next.today && previous.meal === next.meal ? previous : next);
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return time;
}
