// Small numeric helpers used in TELOS documentation examples.

// Clamp a value to the inclusive [min, max] range.
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return min;
  return value;
}

// Return the average of a list of numbers.
export function average(numbers) {
  let total = 0;
  for (const n of numbers) total += n;
  return total / numbers.length;
}
