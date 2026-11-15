# Third-party notices

Earth Trends Observatory's project code is covered by the included `LICENSE` (MIT). That license does not replace the separate notices and terms for fonts, upstream data, or cited publications below.

## Web typography

The application stylesheet requests **DM Sans** and **Manrope** through Google Fonts (`fonts.googleapis.com`); the browser may retrieve font files from Google's font service. System fonts are fallbacks. No Google font binaries are bundled in the source project.

- **DM Sans** — Copyright 2014 The DM Sans Project Authors. SIL Open Font License 1.1. [Official Google Fonts license](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt). Full unmodified retrieved text: `licenses/DM-Sans-OFL-1.1.txt`.
- **Manrope** — Copyright 2018 The Manrope Project Authors. SIL Open Font License 1.1. [Official Google Fonts license](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt). Full unmodified retrieved text: `licenses/Manrope-OFL-1.1.txt`.

Both upstream license texts, including their copyright notices, were retrieved on November 15, 2026. Copies are also served under `dist/licenses/`. The project has not modified either font. The HTML demo wrapper uses the browser's Arial/sans-serif fallback stack.

## Presentation typography

The editable PowerPoint uses the installed Windows **Arial** system font (regular/bold), including its theme and chart references. No Arial font file or embedded font binary is redistributed. Arial is not covered by the SIL OFL notices above. The seven-page PDF contains rasterized slide images rather than embedded fonts; its default Helvetica resource paints no visible text. The captured dashboard image includes the web typography as rendered. The rasterized output does not redistribute the font software.

## NASA POWER and MERRA-2 data

Bundled meteorological observations were obtained from NASA Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project, funded through NASA's Earth Science Division. The service is the **POWER Monthly and Annual API v2.10.0**, accessed **November 15, 2026**. Responses identify MERRA2 and POWER as sources. The project preserves original observations and separately documents its transformations and derived statistics.

Follow the upstream [POWER Referencing Guide](https://power.larc.nasa.gov/docs/referencing/), [Monthly API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), and [meteorological source methodology](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/). Exact queries, dates, and raw hashes are in the included data manifest and `docs/data-provenance.md`. This project's MIT license does not assert ownership of NASA data or override upstream guidance. POWER requests notification of publication and redistribution uses; no notification is represented as sent by this project.

## Cited methodological resource

Acker, J. G., McMahon, E., Shen, S., Hearty, T., and Casey, N. (2009). *Time-Series Analysis of Remotely-Sensed SeaWiFS Chlorophyll in River-Influenced Coastal Regions*. NASA Technical Reports Server document 20090042747, EARSeL eProceedings 8(2). [Official NTRS record](https://ntrs.nasa.gov/citations/20090042747), marked Public Use Permitted.

The project cites and adapts the described least-squares/significance method. The article and its original figures are not copied into the distributed application or source package. The project's own calculations use NASA POWER observations. Citation of NASA resources does not imply NASA endorsement.

## Runtime dependencies

No third-party JavaScript data or statistics library is used by the application. Browser APIs and the included numerical module provide the runtime behavior. Node.js is a separate prerequisite for the optional local server; it is not bundled.
