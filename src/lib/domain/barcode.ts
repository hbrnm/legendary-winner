export function isGtin(code: string): boolean {
  if (!/^(?:\d{8}|\d{12,14})$/.test(code)) return false;
  return [...code].reverse().reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0;
}
