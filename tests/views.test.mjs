import test from 'node:test';
import assert from 'node:assert/strict';
import { centerSeries, residualLagOneCorrelation } from '../dist/lib/views.mjs';
import { analyzeTrend } from '../dist/lib/trends.mjs';

const close = (actual, expected, tolerance = 1e-11) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const residualRows = (values, firstYear = 2000) => values.map((residual, index) => ({ year: firstYear + index, residual }));

test('centering uses its own period mean and preserves observations and metadata', () => {
  const original = Object.freeze([
    Object.freeze({ year: 2000, value: -6, count: 12, coverage: 1 }),
    Object.freeze({ year: 2001, value: -3, count: 12, coverage: 1 }),
    Object.freeze({ year: 2002, value: 0, count: 12, coverage: 1 }),
  ]);
  const result = centerSeries(original);
  assert.equal(result.baseline, -3);
  assert.equal(result.baselineType, 'selected-period mean');
  assert.equal(result.n, 3);
  assert.deepEqual(result.points.map(point => point.value), [-3, 0, 3]);
  assert.equal(result.points[0].count, 12);
  assert.equal(result.points[0].coverage, 1);
  assert.equal(original[0].value, -6);
  assert.notEqual(result.points[0], original[0]);
});

test('regional series have independent baselines while retaining their physical units', () => {
  const tropical = [26, 27, 28].map((value, index) => ({ year: 2000 + index, value }));
  const polar = [-8, -6, -4].map((value, index) => ({ year: 2000 + index, value }));
  const first = centerSeries(tropical), second = centerSeries(polar);
  assert.equal(first.baseline, 27);
  assert.equal(second.baseline, -6);
  assert.deepEqual(first.points.map(point => point.value), [-1, 0, 1]);
  assert.deepEqual(second.points.map(point => point.value), [-2, 0, 2]);
  assert.deepEqual(centerSeries(tropical, 0).points, tropical);
  assert.equal(centerSeries(tropical, 25).baselineType, 'provided');
});

test('constant-offset centering leaves slope, significance, R² and slope interval unchanged', () => {
  const points = [11.8, 12.5, 12.1, 13.6, 12.7, 14.2, 13.8, 15.1].map((value, index) => ({ year: 1990 + index * 2, value }));
  const raw = analyzeTrend(points);
  for (const baseline of [undefined, 0, 50, -100]) {
    const centered = centerSeries(points, baseline);
    const shifted = analyzeTrend(centered.points);
    close(shifted.slopePerDecade, raw.slopePerDecade);
    close(shifted.pValue, raw.pValue);
    close(shifted.rSquared, raw.rSquared);
    shifted.confidence95.slopePerDecade.forEach((bound, index) => close(bound, raw.confidence95.slopePerDecade[index]));
    close(shifted.intercept, raw.intercept - centered.baseline);
  }
});

test('centering rejects missing values and invalid baselines instead of implying filled observations', () => {
  assert.throws(() => centerSeries([]), /at least one/);
  assert.throws(() => centerSeries([{ year: 2000, value: null }]), /finite numeric/);
  assert.throws(() => centerSeries([{ year: 2000, value: 1 }], Infinity), /finite number/);
});

test('adjacent-year residual correlation matches independently calculated Pearson values', () => {
  const result = residualLagOneCorrelation(residualRows([1, 3, 2, 0, -1]));
  assert.equal(result.pairCount, 4);
  close(result.correlation, 3 / Math.sqrt(50));
  assert.match(result.interpretation, /does not test significance/);
  close(residualLagOneCorrelation(residualRows([1, 2, 4, 8, 16])).correlation, 1);
  close(residualLagOneCorrelation(residualRows([1, -1, 1, -1, 1])).correlation, -1);
});

test('residual gaps do not become adjacent pairs and unsorted rows are handled', () => {
  const rows = [
    { year: 2007, residual: 20000 }, { year: 2000, residual: 1 },
    { year: 2004, residual: 200 }, { year: 2001, residual: 2 },
    { year: 2006, residual: 10000 }, { year: 2003, residual: 100 },
  ];
  const result = residualLagOneCorrelation(rows);
  assert.equal(result.pairCount, 3);
  close(result.correlation, 1);
  assert.equal(rows[0].year, 2007);
});

test('insufficient pairs, missing observations and zero residual variance are explicit', () => {
  assert.deepEqual(residualLagOneCorrelation(residualRows([1, 2, 3])).correlation, null);
  assert.equal(residualLagOneCorrelation(residualRows([1, 2, 3])).pairCount, 2);
  const missing = residualLagOneCorrelation([
    { year: 2000, residual: 1 }, { year: 2001, residual: NaN },
    { year: 2002, residual: 2 }, { year: 2003, residual: 3 },
  ]);
  assert.equal(missing.pairCount, 1);
  assert.equal(missing.correlation, null);
  assert.equal(residualLagOneCorrelation(residualRows([0.1, 0.1, 0.1, 0.1, 0.1])).correlation, null);
  assert.equal(residualLagOneCorrelation(residualRows([0, 0, 0, 1])).correlation, null);
  assert.throws(() => residualLagOneCorrelation([{ year: 2000, residual: 1 }, { year: 2000, residual: 2 }]), /Duplicate residual year/);
});
