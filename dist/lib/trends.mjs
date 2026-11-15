/**
 * Earth Trends numerical utilities.
 * AI-assisted implementation. The participant selected the project direction.
 * No external packages; observations are never replaced by generated values.
 */

/** Parse RFC-4180-style CSV into string-valued row objects. */
export function parseCsv(text) {
  if (typeof text !== 'string') throw new TypeError('CSV input must be text.');
  text = text.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], field = '', quoted = false, inQuotes = false, afterQuote = false;
  const endField = () => {
    row.push(quoted ? field : field.trim());
    field = ''; quoted = false; afterQuote = false;
  };
  const endRow = () => {
    endField();
    if (row.some(value => value.trim() !== '')) records.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (inQuotes) {
      if (character === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; afterQuote = true; }
      } else field += character;
      continue;
    }
    if (afterQuote && character !== ',' && character !== '\r' && character !== '\n') {
      if (character === ' ' || character === '\t') continue;
      throw new Error('Malformed CSV: unexpected text after a closing quote.');
    }
    if (character === ',') endField();
    else if (character === '\r' || character === '\n') {
      endRow();
      if (character === '\r' && text[i + 1] === '\n') i++;
    } else if (character === '"') {
      if (field.trim() !== '') throw new Error('Malformed CSV: quote inside an unquoted field.');
      field = ''; quoted = true; inQuotes = true;
    } else field += character;
  }
  if (inQuotes) throw new Error('Malformed CSV: quoted field is not closed.');
  if (field.length || row.length || afterQuote) endRow();
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records.shift().map(header => header.trim());
  if (headers.some(header => !header)) throw new Error('CSV headers must not be empty.');
  if (new Set(headers.map(header => header.toLowerCase())).size !== headers.length) {
    throw new Error('CSV headers must be unique.');
  }
  const rows = records.map((values, index) => {
    if (values.length > headers.length) throw new Error(`CSV row ${index + 2} has more values than headers.`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
  });
  return { headers, rows };
}

function numericValue(value, missingValues = []) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const cleaned = typeof value === 'string' ? value.trim() : value;
  if (cleaned === '' || /^(?:na|n\/a|null|nan|missing)$/i.test(String(cleaned))) return null;
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  for (const missing of missingValues) {
    if (missing !== null && missing !== undefined && String(missing).trim() !== '' && Number(missing) === number) return null;
  }
  return number;
}

/** Return finite points sorted by numeric year; never silently combine duplicate years. */
export function normalizeSeries(points, { missingValues = [] } = {}) {
  if (!Array.isArray(points)) throw new TypeError('Time series must be an array.');
  const result = [];
  for (const point of points) {
    const year = numericValue(point?.year);
    const value = numericValue(point?.value, missingValues);
    if (year !== null && value !== null) result.push({ year, value });
  }
  result.sort((a, b) => a.year - b.year);
  for (let i = 1; i < result.length; i++) {
    if (result[i].year === result[i - 1].year) {
      throw new Error(`Duplicate year ${result[i].year}; aggregate or remove duplicate observations first.`);
    }
  }
  return result;
}

function sum(values) {
  let total = 0, compensation = 0;
  for (const value of values) {
    const corrected = value - compensation;
    const next = total + corrected;
    compensation = (next - total) - corrected;
    total = next;
  }
  return total;
}

function daysInMonth(year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Aggregate monthly observations into annual means or annual sums.
 * minMonths defaults to 12: incomplete years are excluded, not interpolated.
 * weighting='days' weights monthly means by calendar days; sums ignore weighting.
 * Use sum only for monthly totals, never monthly average rates.
 * daily-rate-total multiplies each month's daily rate by calendar days, then sums.
 */
export function annualize(monthly, { minMonths = 12, missingValues = [], aggregation = 'mean', weighting = 'equal' } = {}) {
  if (!Array.isArray(monthly)) throw new TypeError('Monthly observations must be an array.');
  if (!Number.isInteger(minMonths) || minMonths < 1 || minMonths > 12) throw new RangeError('minMonths must be 1 through 12.');
  if (!['mean', 'sum', 'daily-rate-total'].includes(aggregation)) throw new Error('aggregation must be mean, sum or daily-rate-total.');
  if (!['equal', 'days'].includes(weighting)) throw new Error('weighting must be equal or days.');
  const years = new Map();
  let invalidDateCount = 0, missingValueCount = 0;
  for (const point of monthly) {
    const year = numericValue(point?.year), month = numericValue(point?.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      invalidDateCount++; continue;
    }
    if (!years.has(year)) years.set(year, new Map());
    const observations = years.get(year);
    if (observations.has(month)) throw new Error(`Duplicate monthly observation: ${year}-${String(month).padStart(2, '0')}.`);
    const value = numericValue(point?.value, missingValues);
    observations.set(month, value);
    if (value === null) missingValueCount++;
  }
  const points = [], excludedYears = [];
  for (const [year, observations] of [...years.entries()].sort((a, b) => a[0] - b[0])) {
    const valid = [...observations.entries()].filter(([, value]) => value !== null);
    const count = valid.length, coverage = count / 12;
    if (count < minMonths) {
      excludedYears.push({ year, count, coverage, reason: `Fewer than ${minMonths} valid months.` });
      continue;
    }
    const weights = valid.map(([month]) => weighting === 'days' ? daysInMonth(year, month) : 1);
    const value = aggregation === 'sum'
      ? sum(valid.map(([, observation]) => observation))
      : aggregation === 'daily-rate-total'
        ? sum(valid.map(([month, observation]) => observation * daysInMonth(year, month)))
        : sum(valid.map(([, observation], index) => observation * weights[index])) / sum(weights);
    points.push({ year, value, count, coverage });
  }
  return { points, excludedYears, invalidDateCount, missingValueCount, minMonths, aggregation, weighting };
}

// Lanczos log-gamma and continued-fraction regularized incomplete beta.
// These give Student-t probabilities without a normal approximation for small n.
const GAMMA_COEFFICIENTS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

function logGamma(value) {
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let x = 0.99999999999980993;
  GAMMA_COEFFICIENTS.forEach((coefficient, index) => { x += coefficient / (z + index + 1); });
  const t = z + GAMMA_COEFFICIENTS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a, b, x) {
  const small = 1e-300, tolerance = 3e-14;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < small) d = small;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 10000; m++) {
    const twice = 2 * m;
    let aa = m * (b - m) * x / ((qam + twice) * (a + twice));
    d = 1 + aa * d; if (Math.abs(d) < small) d = small;
    c = 1 + aa / c; if (Math.abs(c) < small) c = small;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + twice) * (qap + twice));
    d = 1 + aa * d; if (Math.abs(d) < small) d = small;
    c = 1 + aa / c; if (Math.abs(c) < small) c = small;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < tolerance) return h;
  }
  throw new Error('Student-t calculation did not converge.');
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  const result = x < (a + 1) / (a + b + 2)
    ? front * betaFraction(a, b, x) / a
    : 1 - front * betaFraction(b, a, 1 - x) / b;
  return Math.min(1, Math.max(0, result));
}

/** Two-sided probability P(|T_df| >= |t|). */
export function studentTPValue(t, degreesOfFreedom) {
  if (!(degreesOfFreedom > 0) || !Number.isFinite(degreesOfFreedom)) throw new RangeError('Degrees of freedom must be positive.');
  if (typeof t !== 'number' || Number.isNaN(t)) throw new TypeError('t must be a number.');
  if (!Number.isFinite(t)) return 0;
  if (t === 0) return 1;
  return regularizedBeta(degreesOfFreedom / (degreesOfFreedom + t * t), degreesOfFreedom / 2, 0.5);
}

/** Positive Student-t cutoff for a central confidence interval (default 95%). */
export function studentTCritical(degreesOfFreedom, confidence = 0.95) {
  if (!(confidence > 0 && confidence < 1)) throw new RangeError('Confidence must be between zero and one.');
  studentTPValue(0, degreesOfFreedom);
  const alpha = 1 - confidence;
  let low = 0, high = 1;
  while (studentTPValue(high, degreesOfFreedom) > alpha) high *= 2;
  for (let i = 0; i < 100; i++) {
    const middle = (low + high) / 2;
    if (studentTPValue(middle, degreesOfFreedom) > alpha) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export const OLS_ASSUMPTIONS = 'Exploratory ordinary least squares: linear trend, independent errors, constant residual variance, and approximately normal residuals for p-values and confidence intervals. Serial correlation is not corrected. A trend does not establish causation.';

/**
 * Fit value = intercept + slopePerYear * year using actual numeric years.
 * At least three distinct finite points are required. Gaps are not interpolated.
 * Constant observations have no inferential p-value or confidence interval.
 */
export function analyzeTrend(input, { missingValues = [] } = {}) {
  const points = normalizeSeries(input, { missingValues });
  const n = points.length;
  if (n < 3) throw new RangeError('At least three distinct valid observations are required for a trend.');
  const meanYear = sum(points.map(point => point.year)) / n;
  const isConstant = points.every(point => point.value === points[0].value);
  const meanValue = isConstant ? points[0].value : sum(points.map(point => point.value)) / n;
  const xx = sum(points.map(point => (point.year - meanYear) ** 2));
  const yy = sum(points.map(point => (point.value - meanValue) ** 2));
  const xy = sum(points.map(point => (point.year - meanYear) * (point.value - meanValue)));
  if (!(xx > 0) || !Number.isFinite(xx) || !Number.isFinite(yy) || !Number.isFinite(xy)) {
    throw new RangeError('The observation range cannot be analyzed numerically.');
  }
  const slopePerYear = xy / xx;
  const intercept = meanValue - slopePerYear * meanYear;
  const residuals = points.map(point => {
    const fitted = meanValue + slopePerYear * (point.year - meanYear);
    return { year: point.year, observed: point.value, fitted, residual: point.value - fitted };
  });
  let residualSumSquares = sum(residuals.map(point => point.residual ** 2));
  const roundoff = Number.EPSILON ** 2 * n * Math.max(1, meanValue ** 2, yy);
  if (residualSumSquares <= roundoff) residualSumSquares = 0;
  const degreesOfFreedom = n - 2;
  const slopeStandardError = Math.sqrt(residualSumSquares / degreesOfFreedom / xx);
  const tStatistic = isConstant ? null : slopeStandardError === 0
    ? (slopePerYear === 0 ? 0 : Math.sign(slopePerYear) * Infinity)
    : slopePerYear / slopeStandardError;
  const pValue = isConstant ? null : studentTPValue(tStatistic, degreesOfFreedom);
  const margin = studentTCritical(degreesOfFreedom) * slopeStandardError;
  const lower = slopePerYear - margin, upper = slopePerYear + margin;
  const confidence95 = isConstant ? null : {
    slopePerYear: [lower, upper],
    slopePerDecade: [lower * 10, upper * 10],
  };
  return {
    n, points, startYear: points[0].year, endYear: points[n - 1].year,
    meanYear, meanValue, slopePerYear, slopePerDecade: slopePerYear * 10,
    intercept, rSquared: isConstant ? null : Math.max(0, Math.min(1, 1 - residualSumSquares / yy)),
    residualSumSquares, slopeStandardError, degreesOfFreedom, tStatistic, pValue,
    confidence95, isConstant, significant: pValue !== null && pValue < 0.05,
    fitted: residuals.map(({ year, fitted: value }) => ({ year, value })), residuals,
    modeledChange: slopePerYear * (points[n - 1].year - points[0].year),
    assumptions: OLS_ASSUMPTIONS,
  };
}
