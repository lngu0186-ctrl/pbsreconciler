/**
 * Parse a money-like token from PBS / Z Dispense outputs.
 * Handles: $1,234.56 ; -1234.56 ; (1,234.56) ; 1234.56CR
 */
export function parseMoney(input: string | undefined | null): number | undefined {
  if (input === undefined || input === null) return undefined;
  let s = String(input).trim();
  if (!s) return undefined;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/CR$/i.test(s)) {
    negative = true;
    s = s.replace(/CR$/i, "");
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  if (Number.isNaN(n)) return undefined;
  return negative ? -n : n;
}

export function parseInt0(input: string | undefined | null): number | undefined {
  if (!input) return undefined;
  const s = String(input).replace(/[,\s]/g, "");
  if (!/^-?\d+$/.test(s)) return undefined;
  return Number(s);
}
