/**
 * Display transformations and descriptive residual checks.
 * AI-assisted implementation. These utilities do not change fitted trend inference.
 */

function compensatedSum(values) {
  let total = 0, compensation = 0;
  for (const value of values) {
    const corrected = value - compensation;
    const next = total + corrected;
    compensation = (next - total) - corrected;
    total = next;
  }
  return total;
}

function mean(values) {
  if (values.every(value => value === values[0])) return values[0];
  // Dividing first avoids overflow from the sum of large, finite observations.
  return compensatedSum(values.map(value => value / values.length));
}

/**
 * Shift a series for display, retaining its units and point metadata.
 * The default baseline is that series' arithmetic mean over the supplied period.
 * This is a constant offset, not seasonal adjustment or standardization.
 * Original observations and fitted trend statistics must remain available separately.
 */
export function centerSeries(points, baseline) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new TypeError('Centering requires at least one observation.');
  }
  if (points.some(point => !Number.isFinite(point?.year) || !Number.isFinite(point?.value))) {
    throw new TypeError('Centering requires finite numeric years and values.');
  }
  const baselineType = baseline === undefined ? 'selected-period mean' : 'provided';
  const reference = baseline === undefined ? mean(points.map(point => point.value)) : baseline;
  if (!Number.isFinite(reference)) throw new TypeError('The display baseline must be a finite number.');
  const shifted = points.map(point => ({ ...point, value: point.value - reference }));
  if (shifted.some(point => !Number.isFinite(point.value))) {
    throw new RangeError('The centered observations exceed the supported numeric range.');
  }
  return { points: shifted, baseline: reference, baselineType, n: points.length };
}

/**
 * Pearson correlation between residuals in adjacent years only.
 * Missing/invalid observations are skipped; gaps are never joined into lag pairs.
 * This is descriptive: it supplies no p-value, threshold, or correction to OLS.
 */
export function residualLagOneCorrelation(residuals) {
  if (!Array.isArray(residuals)) throw new TypeError('Residuals must be an array.');
  const rows = residuals
    .filter(row => Number.isFinite(row?.year) && Number.isFinite(row?.residual))
    .map(row => ({ year: row.year, residual: row.residual }))
    .sort((left, right) => left.year - right.year);
  for (let index = 1; index < rows.length; index++) {
    if (rows[index].year === rows[index - 1].year) {
      throw new Error(`Duplicate residual year ${rows[index].year}.`);
    }
  }
  const previous = [], next = [];
  for (let index = 1; index < rows.length; index++) {
    if (rows[index].year - rows[index - 1].year === 1) {
      previous.push(rows[index - 1].residual);
      next.push(rows[index].residual);
    }
  }
  const pairCount = previous.length;
  if (pairCount < 3) {
    return { correlation: null, pairCount, interpretation: 'At least three consecutive-year residual pairs are needed for this descriptive check.' };
  }
  if (previous.every(value => value === previous[0]) || next.every(value => value === next[0])) {
    return { correlation: null, pairCount, interpretation: 'Correlation is undefined because a residual-pair series has no variance.' };
  }
  const previousMean = mean(previous), nextMean = mean(next);
  const previousDeviations = previous.map(value => value - previousMean);
  const nextDeviations = next.map(value => value - nextMean);
  const previousScale = Math.max(...previousDeviations.map(Math.abs));
  const nextScale = Math.max(...nextDeviations.map(Math.abs));
  if (!(previousScale > 0) || !(nextScale > 0) || !Number.isFinite(previousScale) || !Number.isFinite(nextScale)) {
    return { correlation: null, pairCount, interpretation: 'The residual variation cannot be resolved numerically.' };
  }
  const x = previousDeviations.map(value => value / previousScale);
  const y = nextDeviations.map(value => value / nextScale);
  const cross = compensatedSum(x.map((value, index) => value * y[index]));
  const squares = Math.sqrt(compensatedSum(x.map(value => value * value)) * compensatedSum(y.map(value => value * value)));
  const correlation = Math.max(-1, Math.min(1, cross / squares));
  return {
    correlation, pairCount,
    interpretation: 'Descriptive correlation of adjacent-year residuals only; it does not test significance or correct the OLS confidence interval.',
  };
}
