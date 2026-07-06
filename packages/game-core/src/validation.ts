export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateBrushSize(value: number): ValidationResult<number> {
  if (!Number.isFinite(value) || value < 1 || value > 80) {
    return { ok: false, error: "Brush size must be between 1 and 80 pixels." };
  }

  return { ok: true, value };
}

export function validateRotationDegrees(
  value: number,
): ValidationResult<number> {
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Rotation must be a finite number." };
  }

  return { ok: true, value: ((value % 360) + 360) % 360 };
}
