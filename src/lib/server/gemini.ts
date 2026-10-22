// Ce au în comun cererile către Gemini ale funcțiilor Edge (bonul, traducerea):
// cum se cere „fără gândire” pentru fiecare serie de model și motivul unui refuz.
// Logică fără Deno, împachetată în core.js-ul fiecărei funcții.

/** Motivul scris de Google la o cerere refuzată (fără datele trimise: imaginea bonului, textul rețetei), scurt, pentru jurnal. */
export async function googleReason(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
  const message = body?.error?.message;
  return typeof message === "string" ? `: ${message.replace(/\s+/g, " ").slice(0, 300)}` : "";
}

/**
 * „Fără gândire” pentru model: seria 2.5 o oprește cu `thinkingBudget: 0`; din
 * seria 3 se cere cu `thinkingLevel` (cu bugetul vechi, 3.8 Flash gândea peste
 * 40 s la un bon, iar „minimal” a primit 400; „low” îl au toate modelele 3, 20 oct. 2026).
 */
export function noThinking(model: string): { thinkingBudget: 0 } | { thinkingLevel: "low" } {
  return /^gemini-[12]\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
}
