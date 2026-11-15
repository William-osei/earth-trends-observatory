// AI-assisted checks. NASA source values are never generated or rewritten here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { annualize, analyzeTrend } from '../dist/lib/trends.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('dist/data/manifest.json', root), 'utf8'));
const variables = ['T2M', 'PRECTOTCORR', 'RH2M'];
const monthlyOnly = parameter => Object.entries(parameter)
  .filter(([key]) => /^\d{4}(?:0[1-9]|1[0-2])$/.test(key))
  .map(([key, value]) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(4)), value }));
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('snapshot manifest identifies exactly four independently traceable NASA locations', () => {
  assert.deepEqual(manifest.snapshots.map(snapshot => snapshot.location.id).sort(), ['accra', 'ahmedabad', 'longyearbyen', 'manaus']);
  for (const snapshot of manifest.snapshots) {
    const url = new URL(snapshot.sourceUrl);
    assert.equal(url.origin, 'https://power.larc.nasa.gov');
    assert.equal(url.pathname, '/api/temporal/monthly/point');
    assert.equal(url.searchParams.get('start'), '1981');
    assert.equal(url.searchParams.get('end'), '2025');
    assert.equal(Number(url.searchParams.get('latitude')), snapshot.location.latitude);
    assert.equal(Number(url.searchParams.get('longitude')), snapshot.location.longitude);
    assert.deepEqual(url.searchParams.get('parameters').split(',').sort(), [...variables].sort());
    assert.ok(Number.isFinite(Date.parse(snapshot.retrievedAt)));
    assert.match(snapshot.rawSha256, /^[a-f0-9]{64}$/);
    assert.match(snapshot.dataType, /reanalysis/i);
  }
});

for (const snapshot of manifest.snapshots) {
  test(`${snapshot.location.id}: exact raw SHA-256 and all NASA payload fields preserved`, async () => {
    const rawBytes = await readFile(new URL(snapshot.rawFile, root));
    assert.equal(createHash('sha256').update(rawBytes).digest('hex'), snapshot.rawSha256);
    const raw = JSON.parse(rawBytes.toString('utf8'));
    const bundled = JSON.parse(await readFile(new URL(`dist/data/${snapshot.file}`, root), 'utf8'));
    // The bundle may add provenance, but NASA values, units and metadata must match.
    for (const [field, value] of Object.entries(raw)) assert.deepEqual(bundled[field], value, `NASA field changed: ${field}`);
    assert.equal(raw.header.fill_value, -999);
    assert.equal(raw.header.start, '19810101');
    assert.equal(raw.header.end, '20251231');
    assert.equal(raw.parameters.T2M.units, 'C');
    assert.equal(raw.parameters.PRECTOTCORR.units, 'mm/day');
    assert.equal(raw.parameters.RH2M.units, '%');
    assert.ok(Math.abs(raw.geometry.coordinates[0] - snapshot.location.longitude) < 0.001);
    assert.ok(Math.abs(raw.geometry.coordinates[1] - snapshot.location.latitude) < 0.001);
  });

  test(`${snapshot.location.id}: 540 real months produce 45 complete annual observations per variable`, async () => {
    const raw = JSON.parse(await readFile(new URL(snapshot.rawFile, root), 'utf8'));
    for (const variable of variables) {
      const parameter = raw.properties.parameter[variable];
      const months = monthlyOnly(parameter);
      assert.equal(months.length, 540);
      assert.equal(new Set(months.map(point => `${point.year}-${point.month}`)).size, 540);
      assert.equal(Object.keys(parameter).filter(key => /^\d{4}13$/.test(key)).length, 45, 'NASA annual API entries exist and must not enter monthly aggregation');
      assert.equal(months.filter(point => !Number.isFinite(point.value) || point.value === raw.header.fill_value).length, 0);
      assert.equal(snapshot.counts[variable].months, months.length);
      assert.equal(snapshot.counts[variable].missing, 0);
      const annual = annualize(months, {
        missingValues: [raw.header.fill_value], weighting: 'days',
        aggregation: variable === 'PRECTOTCORR' ? 'daily-rate-total' : 'mean',
      });
      assert.equal(annual.points.length, 45);
      assert.deepEqual(annual.points.map(point => point.year), Array.from({ length: 45 }, (_, index) => 1981 + index));
      assert.ok(annual.points.every(point => point.count === 12 && point.coverage === 1 && Number.isFinite(point.value)));
      assert.equal(annual.excludedYears.length, 0);
      const trend = analyzeTrend(annual.points);
      assert.equal(trend.n, 45);
      assert.ok(Number.isFinite(trend.slopePerDecade));
      assert.ok(trend.pValue >= 0 && trend.pValue <= 1);
    }
  });
}

test('annual values match independent calendar-weighted calculations for leap/non-leap years and negative temperatures', async () => {
  // Reference arithmetic separately sums each raw monthly value × calendar days.
  // These are derived observations, not the POWER YYYY13 annual convenience field.
  const expected = [
    { id: 'accra', year: 1981, T2M: 26.339506849315075, RH2M: 81.6047397260274, PRECTOTCORR: 1297.23 },
    { id: 'accra', year: 1984, T2M: 25.87833333333333, RH2M: 83.13609289617487, PRECTOTCORR: 1294.71 },
    { id: 'longyearbyen', year: 2020, T2M: -6.865928961748635, RH2M: 93.9796174863388, PRECTOTCORR: 702.02 },
    { id: 'manaus', year: 2025, T2M: 27.93994520547945, RH2M: 78.38197260273972, PRECTOTCORR: 1677 },
  ];
  for (const reference of expected) {
    const raw = JSON.parse(await readFile(new URL(`data/raw/power-${reference.id}.json`, root), 'utf8'));
    for (const variable of variables) {
      const annual = annualize(monthlyOnly(raw.properties.parameter[variable]), {
        weighting: 'days', aggregation: variable === 'PRECTOTCORR' ? 'daily-rate-total' : 'mean',
      });
      near(annual.points.find(point => point.year === reference.year).value, reference[variable]);
    }
  }
});
