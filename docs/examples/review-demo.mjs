// Throwaway example used to demonstrate the automatic Claude code review
// workflow (.github/workflows/code-review.yml). This file is not imported by
// any package and exists only so a test PR has a reviewable diff.

// Sum the positive numbers in a list.
export function sumPositive(numbers) {
  let total = 0;
  // NOTE: intentionally uses `<=` so the review has a concrete bug to catch —
  // this reads numbers[numbers.length] (undefined) on the final iteration.
  for (let i = 0; i <= numbers.length; i++) {
    if (numbers[i] > 0) {
      total += numbers[i];
    }
  }
  return total;
}
