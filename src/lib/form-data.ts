type TextOptions = {
  required?: boolean;
  maxLength?: number;
};

type NumberOptions = {
  min?: number;
  max?: number;
  decimalPlaces?: number;
};

export function readFormText(
  formData: FormData,
  key: string,
  label: string,
  options: TextOptions = {},
) {
  const raw = formData.get(key);
  if (raw !== null && typeof raw !== "string") {
    throw new Error(`${label} must be text`);
  }

  const value = typeof raw === "string" ? raw.trim() : "";
  if (options.required && !value) throw new Error(`${label} is required`);
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new Error(`${label} must be ${options.maxLength} characters or fewer`);
  }
  return value;
}

export function readFormNumber(
  formData: FormData,
  key: string,
  label: string,
  options: NumberOptions = {},
) {
  const raw = formData.get(key);
  const text = typeof raw === "string" ? raw.trim() : "";
  if (typeof raw !== "string" || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`);
  }

  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`Enter a valid ${label.toLowerCase()}`);
  if (options.min !== undefined && value < options.min) {
    throw new Error(`${label} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(`${label} must be no more than ${options.max}`);
  }
  if (
    options.decimalPlaces !== undefined &&
    (text.split(".")[1]?.length ?? 0) > options.decimalPlaces
  ) {
    throw new Error(`${label} can have at most ${options.decimalPlaces} decimal places`);
  }
  return value;
}

export function readFormDate(formData: FormData, key: string, label: string): Date;
export function readFormDate(formData: FormData, key: string, label: string, optional: true): Date | null;
export function readFormDate(formData: FormData, key: string, label: string, optional = false): Date | null {
  const value = readFormText(formData, key, label);
  if (!value && optional) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Enter a valid ${label.toLowerCase()}`);

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`);
  }
  return date;
}

export function ensureMaxFormLines(formData: FormData, maxLines: number, label: string) {
  for (const key of formData.keys()) {
    const match = /^(?:product|quantity|unitCost)_(\d+)$/.exec(key);
    if (match && Number(match[1]) >= maxLines) {
      throw new Error(`${label} can have at most ${maxLines} line items`);
    }
  }
}
