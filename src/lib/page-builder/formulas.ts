import { isNumericField } from './collections';
import type { CollectionField, FormulaToken, RecordValue } from '@/models/page-builder';

// ---- Formulas -------------------------------------------------------------

function tokenize(src: string): FormulaToken[] | null {
  const out: FormulaToken[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if ('+-*/()×÷−'.includes(ch)) {
      out.push({ t: 'op', v: ch === '×' ? '*' : ch === '÷' ? '/' : ch === '−' ? '-' : ch });
      i += 1;
    } else if (ch === '{') {
      const end = src.indexOf('}', i);
      if (end === -1) return null;
      out.push({ t: 'ref', v: src.slice(i + 1, end).trim() });
      i = end + 1;
    } else if (/[\d.,]/.test(ch)) {
      let j = i;
      while (j < src.length && /[\d.,]/.test(src[j])) j += 1;
      const n = Number(src.slice(i, j).replace(',', '.'));
      if (!Number.isFinite(n)) return null;
      out.push({ t: 'num', v: n });
      i = j;
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Evaluates a stored formula against a record's values. Returns null when the
 * formula is malformed or divides by zero — shown as "—", never as a crash.
 */
export function evaluateFormula(
  formula: string,
  resolve: (ref: string) => number
): number | null {
  const parsed = tokenize(formula);
  if (!parsed || parsed.length === 0) return null;
  const tokens: FormulaToken[] = parsed;
  let pos = 0;
  const peek = () => tokens[pos];

  function primary(): number | null {
    const tok = tokens[pos++];
    if (!tok) return null;
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'ref') return resolve(tok.v);
    if (tok.v === '-') {
      const v = primary();
      return v === null ? null : -v;
    }
    if (tok.v === '(') {
      const v = sum();
      if (peek()?.t !== 'op' || peek()?.v !== ')') return null;
      pos += 1;
      return v;
    }
    return null;
  }

  function product(): number | null {
    let left = primary();
    while (left !== null && peek()?.t === 'op' && (peek()!.v === '*' || peek()!.v === '/')) {
      const op = tokens[pos++].v;
      const right = primary();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function sum(): number | null {
    let left = product();
    while (left !== null && peek()?.t === 'op' && (peek()!.v === '+' || peek()!.v === '-')) {
      const op = tokens[pos++].v;
      const right = product();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = sum();
  if (pos !== tokens.length || result === null || !Number.isFinite(result)) return null;
  return Math.round(result * 100) / 100;
}

/** A field's numeric value on a record — formulas worked out, one level deep. */
export function numericValue(
  field: CollectionField,
  data: Record<string, RecordValue>,
  fields: CollectionField[],
  depth = 0
): number | null {
  if (field.type === 'formula') {
    // A formula may use another formula, but not loop back on itself forever.
    if (depth > 4 || !field.formula) return null;
    return evaluateFormula(field.formula, (ref) => {
      const other = fields.find((f) => f.id === ref);
      return other ? (numericValue(other, data, fields, depth + 1) ?? 0) : 0;
    });
  }
  const n = Number(data[field.id]);
  return Number.isFinite(n) ? n : null;
}

/** `{a1b2} * {c3d4}` → `{Kosto} * {Sasia}`, for the admin to read and edit. */
export function formulaToLabels(formula: string, fields: CollectionField[]): string {
  return formula.replace(/\{([^}]*)\}/g, (_, ref: string) => {
    const f = fields.find((x) => x.id === ref.trim());
    return `{${f ? f.label : ref}}`;
  });
}

/**
 * `{Kosto} * {Sasia}` → `{a1b2} * {c3d4}`. Returns the unknown label instead
 * when one does not match a number field, so the dialog can say which.
 */
export function formulaToIds(
  text: string,
  fields: CollectionField[]
): { formula: string } | { unknown: string } {
  let unknown: string | null = null;
  const formula = text.replace(/\{([^}]*)\}/g, (_, label: string) => {
    const f = fields.find(
      (x) => isNumericField(x) && x.label.trim().toLowerCase() === label.trim().toLowerCase()
    );
    if (!f) unknown ??= label.trim();
    return `{${f ? f.id : label}}`;
  });
  return unknown !== null ? { unknown } : { formula };
}
