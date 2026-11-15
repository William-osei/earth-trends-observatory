# Data provenance

## Dataset

The four bundled examples are NASA POWER Monthly and Annual API responses retrieved on November 15, 2026, for 1981–2025. Each contains 540 monthly values per variable, with no missing monthly values recorded in the manifest. The response identifies POWER API v2.10.0, MERRA2/POWER sources, a -999 fill value, and local-solar-time metadata.

These meteorological data derive from NASA's MERRA-2 reanalysis. They are gridded estimates, not local station measurements. The bundled provenance records a 0.5° latitude × 0.625° longitude source grid. A requested coordinate identifies a grid location; it is not a city-wide average. [NASA POWER Monthly API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), [meteorological source methodology](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

| Snapshot | Requested latitude | Requested longitude | Raw response SHA-256 |
| --- | ---: | ---: | --- |
| Accra, Ghana | 5.6037 | -0.1870 | f48f3044f75780bf404685d33de28091e73de24dcb0d0ca0512255b182cf07d0 |
| Ahmedabad, India | 23.0225 | 72.5714 | 726b99fbdfbf2e8daf4de9c309ac9aeacc443f1a307080353d5bf67d295eb748 |
| Manaus, Brazil | -3.1190 | -60.0217 | a16b5e428850b74434667909c0519142b08181d99f7ca9d0508f8ae6768aca84 |
| Longyearbyen, Svalbard | 78.2232 | 15.6469 | 960586f47f8666f9ab6b5d5e6a02235c13fd2acef4625616aa526ffb5bf8a7aa |

## Reproduce a request

For each coordinate, the request uses these arguments:

```text
https://power.larc.nasa.gov/api/temporal/monthly/point
  ?parameters=T2M,PRECTOTCORR,RH2M
  &community=AG
  &longitude=LONGITUDE
  &latitude=LATITUDE
  &format=JSON
  &start=1981
  &end=2025
```

Exact executable URLs and retrieval timestamps are in `dist/data/manifest.json`. For example, [the Accra request](https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,RH2M&community=AG&longitude=-0.187&latitude=5.6037&format=JSON&start=1981&end=2025) retrieves all three parameters. A later response may differ after upstream revisions, so retain the original snapshot when reproducing a result.

## Files and transformations

- `data/raw/power-LOCATION.json` preserves the original API response. The table hashes refer to these raw files.
- `dist/data/power-LOCATION.json` preserves API observations and adds a `provenance` object for browser use; its byte hash will differ from the raw response.
- `dist/data/manifest.json` records filenames, query, date, raw hash, units/processing guidance, and coverage counts.

T2M is temperature at 2 m in °C; RH2M is relative humidity at 2 m in %; PRECTOTCORR is corrected precipitation in mm/day. Annualization and trends are calculated by code, as described in [methodology](methodology.md). No NASA observations were generated, filled, or altered by AI. Derived statistics are calculations on the retrieved data, not additional observations.

Live custom-coordinate requests are separate network operations and are not the bundled retrieval. Record their returned source metadata and request in any evidence export. Imported CSVs require the user to supply their own provenance; do not label an arbitrary imported file NASA data.

## Attribution and eligibility

Credit NASA POWER and NASA GMAO/MERRA-2 in any reuse, alongside the exact request, period, variable, and transformations. Review upstream [POWER documentation](https://power.larc.nasa.gov/docs/) for current attribution guidance.

The selected challenge lists the Acker et al. methodological paper genuinely used by this project. The live submission form requests NASA data or a NASA resource. POWER is declared as additional NASA data and has not been verified as a named dataset in that challenge's Resources. These declarations describe the actual work and do not guarantee an award or judging outcome. See `THIRD-PARTY-NOTICES.md` for attribution and upstream guidance.
