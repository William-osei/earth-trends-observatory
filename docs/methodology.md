# Methodology and interpretation

## Challenge alignment

The selected [Earth System Trend Detective challenge](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/) asks participants to examine regional Earth-system time series, estimate changes, and assess their statistical significance. Earth Trends implements a transparent linear-trend workflow for meteorological variables and allows a user to change the location, variable, and observation window.

The challenge Resources list Acker et al. (2009), [Time-Series Analysis of Remotely-Sensed SeaWiFS Chlorophyll in River-Influenced Coastal Regions](https://ntrs.nasa.gov/citations/20090042747). Its methods use least-squares trends, R², and an ANOVA significance test. This prototype adapts the linear-fit and significance approach to annual NASA POWER meteorology. For a regression with one predictor and an intercept, its two-sided slope test is equivalent to the regression F test, with F = t². It does not reproduce that study's chlorophyll observations, its calendar-month anomaly workflow, or its scientific findings.

## Input and annual aggregation

Bundled input consists of monthly NASA POWER JSON for 1981–2025. Months use keys YYYY01 through YYYY12. YYYY13 is the API's annual field and is excluded from monthly aggregation. Fill values such as -999, blanks, and nonfinite values are missing, not zero. Duplicate months or years are rejected. No missing observations are interpolated.

Only years containing twelve valid monthly observations enter a bundled-data annual series. Leap years follow the Gregorian calendar.

- Temperature (T2M, °C): sum of monthly mean × month days, divided by total year days.
- Relative humidity (RH2M, %): the same day-weighted mean; a slope is reported in percentage points, not relative percent growth.
- Precipitation (PRECTOTCORR, mm/day): sum of monthly mean daily rate × month days, giving an annual total in mm. Summing the twelve daily-rate values directly would have incorrect units.

An imported annual CSV is already annualized by its provider. Its values need consistent units and a documented source; the software cannot establish those facts merely by parsing it. Never mix a rate and a total in one series.

## Regression

For n valid observations with year x and annual value y, fit y = a + b x. At least three distinct valid observations are required. Years are numeric calendar years, so gaps retain their actual duration.

```text
Sxx = Σ(x - mean(x))²
Sxy = Σ(x - mean(x))(y - mean(y))
b = Sxy / Sxx
a = mean(y) - b mean(x)
SSE = Σ(y - fitted(y))²
SE(b) = sqrt[(SSE / (n - 2)) / Sxx]
t = b / SE(b), with n - 2 degrees of freedom
95% slope interval = b ± t(0.975, n - 2) SE(b)
rate per decade = 10 b
R² = 1 - SSE / Σ(y - mean(y))²
```

The p-value is two-sided. The significance threshold is p < 0.05. Student-t probabilities use the regularized incomplete beta function, and the critical value is found numerically. A constant response has slope zero and undefined inferential statistics; the app reports those statistics as unavailable rather than manufacturing certainty. A perfect nonconstant line can produce zero residual variance and a degenerate interval.

The displayed modeled change is the slope multiplied by the span between the first and last included years. It is not necessarily the difference between the two endpoint observations. R² describes fit within the observed interval; it does not measure data quality or causal strength.

## Assumptions and limits

Inference assumes a linear relationship, independent residuals, constant error variance, and approximately normal residuals. Earth-system data may violate these assumptions. Annualization reduces seasonal variation but does not eliminate serial correlation or structural breaks. No autocorrelation correction, robust-error model, nonlinear fit, change-point test, Mann–Kendall test, attribution study, forecast, or multiple-testing correction is implemented.

POWER is a gridded reanalysis product: assimilated observations combined with modeling. A named location represents a source grid cell rather than a local station. Differences between locations are descriptive comparisons; the app does not test whether two fitted slopes differ significantly. An apparent trend should be examined for source consistency, outliers, selected period, missingness, and sensitivity to other reasonable choices.

## Audit path

The numerical implementation is `dist/lib/trends.mjs`; tests are `tests/trends.test.mjs`. Raw API responses, the snapshot manifest, query URLs, retrieval times, and SHA-256 hashes provide the data audit trail. Analysis exports should retain the selected data, units, period, source, method, assumptions, and AI-assistance acknowledgement. Test results and any browser checks must be reported separately from scientific and operational validation.
