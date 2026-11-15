import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, normalizeSeries, annualize, studentTPValue, studentTCritical, analyzeTrend } from '../dist/lib/trends.mjs';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('CSV preserves quoted commas, escaped quotes, multiline text and missing cells', () => {
  const result = parseCsv('\uFEFFYear,"value, mean",Note\r\n2000,1.2,"line one\nline ""two"""\r\n2001,,\r\n2002,3.4\r\n\r\n');
  assert.deepEqual(result.headers, ['Year', 'value, mean', 'Note']);
  assert.deepEqual(result.rows, [
    { Year: '2000', 'value, mean': '1.2', Note: 'line one\nline "two"' },
    { Year: '2001', 'value, mean': '', Note: '' },
    { Year: '2002', 'value, mean': '3.4', Note: '' },
  ]);
});

test('CSV does not execute formula-like input or treat prototype keys as object properties', () => {
  const result = parseCsv('year,value,__proto__\n2000,=1+2,content');
  assert.equal(result.rows[0].value, '=1+2');
  assert.equal(Object.getPrototypeOf(result.rows[0]), Object.prototype);
  assert.equal(Object.hasOwn(result.rows[0], '__proto__'), true);
  assert.equal(result.rows[0].__proto__, 'content');
});

test('CSV rejects malformed quoting, ambiguous headers and extra columns', () => {
  assert.throws(() => parseCsv('year,value\n2000,"unclosed'), /not closed/);
  assert.throws(() => parseCsv('year,value\n2000,"1"oops'), /closing quote/);
  assert.throws(() => parseCsv('year,value\n2000,a"b'), /unquoted/);
  assert.throws(() => parseCsv('year, Year\n2000,1'), /unique/);
  assert.throws(() => parseCsv('year,\n2000,1'), /empty/);
  assert.throws(() => parseCsv('year,value\n2000,1,extra'), /more values/);
  assert.deepEqual(parseCsv(' \n\r\n'), { headers: [], rows: [] });
});

test('series normalization sorts, removes missing values and honors numeric sentinels', () => {
  assert.deepEqual(normalizeSeries([
    { year: '2002', value: '3' }, { year: 2001, value: '' },
    { year: 2000, value: '1' }, { year: 1999, value: -999 },
    { year: 2003, value: null }, { year: 2004, value: true },
    { year: 'bad', value: 5 }, { year: 2005, value: 'Infinity' },
  ], { missingValues: [-999] }), [{ year: 2000, value: 1 }, { year: 2002, value: 3 }]);
  assert.throws(() => normalizeSeries([{ year: 2000, value: 1 }, { year: '2000', value: 2 }]), /Duplicate year/);
});

test('annualization keeps coverage, excludes incomplete years and does not interpolate', () => {
  const monthly = Array.from({ length: 12 }, (_, index) => ({ year: 2000, month: index + 1, value: index + 1 }));
  monthly.push(...Array.from({ length: 12 }, (_, index) => ({ year: 2001, month: index + 1, value: index === 3 ? -999 : 10 })));
  const result = annualize(monthly, { missingValues: [-999] });
  assert.deepEqual(result.points, [{ year: 2000, value: 6.5, count: 12, coverage: 1 }]);
  assert.equal(result.excludedYears[0].year, 2001);
  assert.equal(result.excludedYears[0].count, 11);
  assert.equal(result.missingValueCount, 1);
  const relaxed = annualize(monthly, { missingValues: [-999], minMonths: 11, aggregation: 'sum' });
  assert.equal(relaxed.points[1].value, 110);
  assert.throws(() => annualize([...monthly, monthly[0]]), /Duplicate monthly/);
});

test('calendar-day weighting handles leap years and reports invalid dates', () => {
  const result = annualize([
    { year: 2000, month: 1, value: 0 }, { year: 2000, month: 2, value: 10 },
    { year: 2000, month: 13, value: 99 },
  ], { minMonths: 2, weighting: 'days' });
  near(result.points[0].value, 29 * 10 / 60);
  assert.equal(result.invalidDateCount, 1);
  assert.equal(result.points[0].count, 2);
  const rates = [2000, 2001].flatMap(year => Array.from({ length: 12 }, (_, index) => ({ year, month: index + 1, value: 1 })));
  const totals = annualize(rates, { aggregation: 'daily-rate-total' });
  assert.deepEqual(totals.points.map(point => point.value), [366, 365]);
});

test('Student t probabilities and critical values match reference quantiles', () => {
  near(studentTPValue(1, 1), 0.5, 1e-12);
  near(studentTPValue(0, 10), 1);
  near(studentTPValue(2.2281388519649385, 10), 0.05, 2e-12);
  near(studentTCritical(1), 12.706204736432095, 2e-9);
  near(studentTCritical(2), 4.302652729696142, 2e-10);
  near(studentTCritical(10), 2.2281388519649385, 2e-10);
  near(studentTPValue(-3, 7), studentTPValue(3, 7));
  assert.equal(studentTPValue(Infinity, 2), 0);
  assert.throws(() => studentTPValue(1, 0), /positive/);
  assert.throws(() => studentTCritical(3, 1), /Confidence/);
});

test('known perfect linear trend has correct units, fit and zero residual', () => {
  const result = analyzeTrend([2004, 2001, 2003, 2000, 2002].map(year => ({ year, value: 1 + 0.2 * (year - 2000) })));
  near(result.slopePerYear, 0.2);
  near(result.slopePerDecade, 2);
  near(result.intercept, -399);
  near(result.modeledChange, 0.8);
  near(result.rSquared, 1);
  assert.equal(result.residualSumSquares, 0);
  assert.equal(result.pValue, 0);
  assert.deepEqual(result.confidence95.slopePerDecade.map(value => Math.round(value * 1e10) / 1e10), [2, 2]);
  assert.equal(result.startYear, 2000);
  assert.equal(result.endYear, 2004);
});

test('noisy trend uses actual year spacing and a small-sample Student t interval', () => {
  const result = analyzeTrend([
    { year: 2000, value: 1 }, { year: 2001, value: 3 },
    { year: 2002, value: 2 }, { year: 2003, value: 5 }, { year: 2004, value: 4 },
  ]);
  near(result.slopePerYear, 0.8);
  near(result.intercept, -1598.6);
  near(result.residualSumSquares, 3.6);
  near(result.rSquared, 0.64);
  near(result.slopeStandardError, Math.sqrt(0.12));
  assert.ok(result.confidence95.slopePerYear[0] < 0);
  assert.ok(result.confidence95.slopePerYear[1] > 0.8);
  assert.ok(result.pValue > 0.05);
  assert.equal(result.significant, false);
  const spaced = analyzeTrend([{ year: 2000, value: 0 }, { year: 2010, value: 1 }, { year: 2020, value: 2 }]);
  near(spaced.slopePerDecade, 1);
});

test('regression inference matches independent exact small-sample reference cases', () => {
  // For df=2 the two-sided t tail is 1 - t/sqrt(t² + 2).
  const first = analyzeTrend([0, 1, 1, 2].map((value, year) => ({ year, value })));
  near(first.slopePerYear, 0.6);
  near(first.intercept, 0.1);
  near(first.rSquared, 0.9);
  near(first.pValue, 1 - 3 / Math.sqrt(10), 1e-12);
  near(first.confidence95.slopePerYear[0], -0.008486984482214632, 1e-10);
  near(first.confidence95.slopePerYear[1], 1.2084869844822146, 1e-10);
  // df=1 is a Cauchy distribution, giving p=1/3 at t=sqrt(3).
  const second = analyzeTrend([0, 0, 2].map((value, year) => ({ year, value })));
  near(second.slopePerYear, 1);
  near(second.intercept, -1 / 3);
  near(second.pValue, 1 / 3, 1e-12);
  near(second.confidence95.slopePerYear[0], -6.335930724957568, 1e-9);
});

test('constant, insufficient and duplicate series are handled explicitly', () => {
  const constant = analyzeTrend([2000, 2001, 2002].map(year => ({ year, value: 2 })));
  assert.equal(constant.slopePerYear, 0);
  assert.equal(constant.isConstant, true);
  assert.equal(constant.rSquared, null);
  assert.equal(constant.pValue, null);
  assert.equal(constant.confidence95, null);
  assert.equal(analyzeTrend([2000, 2001, 2002].map(year => ({ year, value: 0.1 }))).isConstant, true);
  assert.throws(() => analyzeTrend([{ year: 2000, value: 1 }, { year: 2001, value: null }]), /three/);
  assert.throws(() => analyzeTrend([{ year: 2000, value: 1 }, { year: 2000, value: 2 }, { year: 2001, value: 3 }]), /Duplicate/);
});
