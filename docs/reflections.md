# Reflections and next steps

## What this prototype made clearer

Data preparation is part of the scientific result. Summing monthly precipitation rates without accounting for days would produce the wrong units, while incomplete years could make different periods difficult to compare. The implementation therefore preserves source values, excludes incomplete NASA years and records the annualization method with the exported evidence.

Regional comparison needs a clear distinction between **measurement level** and **change over time**. Raw values remain useful, but a shared axis can hide variation when two regions have very different average conditions. The added deviation-from-period-mean view centers each region on its own selected-period mean. It preserves units and leaves the regression statistics unchanged. Its baseline changes with the chosen period, so it should not be described as a fixed climatological anomaly.

An apparently strong trend still depends on assumptions. The added adjacent-year residual correlation is a descriptive prompt to inspect time dependence. It is not a significance test, a causal explanation, or a correction to the reported OLS interval. Making that boundary visible is more useful than presenting extra decimal places as stronger certainty.

Source URLs, retrieval timestamps, raw hashes, complete-year rules and exportable observations make an investigation easier to check. Passing software tests establishes that those operations behave as specified. It does not establish local weather accuracy, community benefit or readiness for operational decisions. No field testing, user interviews or independent scientific validation are claimed.

## Submission reflection draft

Developing this prototype reinforced that a useful environmental chart must preserve the reasoning behind it. Complete-year coverage and calendar-day weighting matter because temperature means and precipitation rates require different aggregation. Comparing regions also exposed a presentation problem: large differences in average conditions can obscure changes over time. The added deviation-from-period-mean view addresses that display issue while retaining raw observations and unchanged trend statistics. A descriptive residual-correlation readout makes another limitation easier to notice: time dependence can affect ordinary least-squares uncertainty. Provenance, downloadable evidence and explicit assumptions support reproducible exploration, but software checks are not field validation. The next stage is scientific review of correlation-aware inference, broader spatial coverage and evaluation with intended users before making operational claims. These remain future steps rather than completed outcomes.

## Version 1.1 release notes

- Added Actual values / Deviation from period mean chart views.
- Centered each region independently around its own selected-period mean; retained raw CSV values and original trend statistics.
- Recorded chart view and baseline information in shared settings and evidence exports.
- Added a descriptive correlation of residual pairs from adjacent calendar years, with no formal p-value or correction claim.
- Added this reflection and clarified project credits, sources and continuing-development guidance.

Release verification should record the actual test and browser results after integration. These notes do not claim that an unfinished check has passed.

## Next development steps

1. Review inference methods with an Earth-science/statistics specialist, including approaches appropriate for serially correlated residuals. Validate any new method against independently established reference cases.
2. Add regional or gridded coverage with documented spatial aggregation, coverage thresholds and missing-data treatment.
3. Evaluate the interface with intended learners and data explorers, recording real feedback and changes rather than assuming usability from visual inspection.
4. Define an explicit data-refresh process that retains reproducible snapshots and records upstream revisions.
5. Keep exploratory interpretation distinct from causal attribution, forecasting and operational decision support.
