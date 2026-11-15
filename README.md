# Earth Trends Observatory

Explore how regional temperature, rainfall and humidity change over time using authentic NASA data. Select a location and period, compare regions, inspect a linear trend and its uncertainty, and export the evidence needed to reproduce the result.

Project lead: **William Osei Aborah**, Kumasi, Ghana. Created for the 2026 NASA Space Apps [Earth System Trend Detective challenge](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

[Live application](https://earth-trends-observatory-2026.cubicmarshmallow32.chatgpt.site) · [Seven-slide demo](https://earth-trends-observatory-2026.cubicmarshmallow32.chatgpt.site/downloads/earth-trends-demo.pdf) · [NASA entry](https://www.spaceappschallenge.org/2026/find-a-team/earth-trends-observatory/?tab=project) · [GitHub repository](https://github.com/William-osei/earth-trends-observatory)

NASA confirmed the initial submission for judging on **November 15, 2026, at 23:02 GMT**. Later improvements and any revised submission confirmation should be recorded separately from that initial receipt.

## Run locally

Install Node.js, then run the included static server from the project directory:

    npm start

Open http://127.0.0.1:4173. No dependency installation, API key or account is required. The server listens only on the local computer. Browser modules require HTTP, so opening index.html directly is not the supported launch method. A static host can publish dist/.

Run the tests with:

    npm test

Tests cover numerical reference cases, CSV parsing, calendar aggregation, source hashes and view transformations. They check software behavior; they do not establish scientific or operational validity.

## Investigate a trend

1. Select Accra, Ahmedabad, Manaus or Longyearbyen, a measurement, and a period within 1981–2025.
2. Read the change per decade, 95% slope interval, two-sided p-value and R² beside the annual time series.
3. Compare another region. Use **Actual values** to compare levels or **Deviation from period mean** to compare the shape of changes around each region's own selected-period mean.
4. Inspect the descriptive adjacent-year residual correlation alongside the existing uncertainty assumptions.
5. Download annual CSV values or a JSON evidence report. Share links reproduce bundled-data settings.

Custom coordinates fetch monthly values directly from NASA POWER when the network and API are available. Annual CSV import stays in the browser and requires a dataset label, consistent units and a source. The bundled snapshots remain available without an external data request when served locally.

## Version 1.1 improvements

- A centered chart view makes regional changes easier to compare when absolute measurement levels differ substantially. It subtracts each series' own selected-period mean for display, preserving units. It is **not** a fixed-baseline climatological anomaly.
- Display centering does not change the underlying regression slope, p-value, R² or slope interval. CSV export retains raw annual observations; evidence reports record the selected view and baselines.
- A descriptive residual correlation uses adjacent calendar years only. It can draw attention to time dependence, but it is not a formal test and does not correct the OLS interval or p-value.
- Sources, credits, reflections and future development are documented for continued maintenance. See [project reflections](docs/reflections.md).

## Data and methods

The four snapshots contain authentic NASA POWER monthly data for 1981–2025: T2M air temperature, RH2M relative humidity and PRECTOTCORR precipitation. NASA source values are preserved, with exact request URLs, retrieval times and raw SHA-256 hashes in dist/data/manifest.json and [data provenance](docs/data-provenance.md).

Only complete valid years enter NASA analyses. Temperature and humidity use calendar-day-weighted annual means. Precipitation multiplies each monthly mean daily rate by the month's number of days before summing annual millimetres. Ordinary least squares uses actual calendar years and a Student-t slope test. [Methodology](docs/methodology.md) explains the calculations and assumptions.

The regional time-series, least-squares and significance workflow adapts the challenge-listed [Acker et al. (2009) NASA NTRS resource](https://ntrs.nasa.gov/citations/20090042747). The data here are NASA POWER/MERRA-2 meteorology, not that paper's SeaWiFS measurements. This project does not reproduce its chlorophyll findings or monthly-anomaly procedure.

## Interpretation limits

MERRA-2 combines observations and models on an approximately 0.5° latitude × 0.625° longitude grid. A point represents a coarse grid cell, not a street, farm or weather station. OLS inference assumes a linear relationship, independent errors and constant variance, with approximately normal residuals for small-sample inference. Serial correlation, multiple comparisons, and measurement or model uncertainty are not corrected.

A fitted trend does not establish a cause or forecast conditions. A non-significant result does not prove that nothing is changing. Separate regional slope tests do not establish that the slopes differ significantly. This independent prototype supports education and exploratory analysis; it has not been endorsed, adopted or operationally validated by NASA.

## Credits and licensing

William directed the project task, practical focus, review and presentation. ChatGPT/OpenAI Codex assisted research, implementation, analysis, writing, design and presentation; [contribution details](AI-DISCLOSURE.md) remain with the project. The running app uses deterministic statistical code and does not call an AI service.

Original project code is [MIT licensed](LICENSE). NASA data and referenced publications retain their applicable terms. DM Sans and Manrope use the SIL Open Font License 1.1; full notices are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and licenses/.

## Continuing the project

Keep downloaded source values and provenance together. Add meaningful tests for new transformations, document assumptions before adding inference methods, and distinguish software verification from external scientific validation. The [reflection and roadmap](docs/reflections.md) describes the next steps, including reviewed correlation-aware inference and broader spatial coverage.
