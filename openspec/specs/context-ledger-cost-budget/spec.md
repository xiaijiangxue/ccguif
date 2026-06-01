# context-ledger-cost-budget Specification

## Purpose

Defines cost projection, budget threshold, degraded pricing, and StatusPanel cost display behavior.
## Requirements
### Requirement: Cost Projection MUST Be Computed From Thread / Session Usage Snapshots

The system MUST compute per-turn, per-session, per-engine, and aggregated workspace cost from `ThreadTokenUsage` data already present in `src/types.ts`. Block-level cost attribution MUST NOT be computed in this capability; block estimate values are not authoritative token counts.

#### Scenario: cost projection uses ThreadTokenUsage as the authoritative input

- **WHEN** the system computes a cost projection for an active session
- **THEN** the projection MUST be derived from `ThreadTokenUsage` (turn / session level)
- **AND** the projection MUST NOT consume `ContextLedgerBlock.estimate.value` as a cost base

#### Scenario: block-level cost is explicitly out of scope

- **WHEN** a consumer requests block-level cost from this capability
- **THEN** the capability MUST report "block-level cost not supported in this version"
- **AND** the future block-level attribution MUST require its own follow-up change

### Requirement: Pricing Source MUST Be Traceable On Every Cost Record

Every cost record produced by this capability MUST embed a reference to the pricing source used (engine, model, source kind, last-updated timestamp). The pricing source registry MUST live at `src/features/context-ledger/pricing/` and MUST distinguish at least three source kinds: `fixture`, `config`, `remote`.

#### Scenario: every cost record carries pricing source metadata

- **WHEN** a cost record is produced
- **THEN** the record MUST include `pricingSource.engine`, `pricingSource.model`, `pricingSource.source`, and `pricingSource.lastUpdatedAt`

#### Scenario: pricing source kind drives staleness detection

- **WHEN** `pricingSource.source` is `fixture` and `pricingSource.lastUpdatedAt` is older than the configured staleness threshold
- **THEN** the cost record MUST be marked `degraded: true`
- **AND** the degradation reason MUST be exposable via an i18n key

### Requirement: Unknown Pricing MUST Produce Degraded Cost State, Not Silent Zero

When no pricing source is available for a given engine/model, the system MUST NOT default the cost to zero or to any silent estimate. The cost record MUST be flagged degraded with an explicit reason and the UI MUST surface a degraded indicator.

#### Scenario: missing pricing yields explicit degraded record

- **WHEN** the pricing registry has no entry for an engine/model used in the session
- **THEN** the cost record for that turn MUST set `degraded: true` and `degradationReason: 'pricing-unavailable'`
- **AND** the record MUST NOT contain a numeric cost amount that implies a known price

#### Scenario: cross-engine aggregate flags partial when any engine is degraded

- **WHEN** an aggregate cost is computed across multiple engines and at least one engine is `degraded`
- **THEN** the aggregate MUST set `partial: true`
- **AND** the aggregate MUST expose the per-engine breakdown so the user can identify which engine is degraded

### Requirement: Session Budget MUST Support Three Threshold Tiers Without Forcing Runtime Interruption

The system MUST support per-session budget configuration with three threshold tiers: `info`, `warn`, `block`. Crossing a tier MUST produce a UI signal at the corresponding severity. Crossing the `block` tier MUST NOT forcibly interrupt the runtime in this capability; runtime interruption is the responsibility of a separate policy-chain or runtime change.

#### Scenario: crossing info / warn / block tiers emits matching UI severity

- **WHEN** session cost crosses the `info`, `warn`, or `block` threshold
- **THEN** StatusPanel MUST display the matching severity indicator using i18n-keyed text

#### Scenario: block tier does not forcibly interrupt a running turn

- **WHEN** session cost crosses the `block` threshold mid-turn
- **THEN** this capability MUST NOT terminate the turn
- **AND** the budget signal MUST remain a visual indicator until a separate policy or user action acts on it

### Requirement: Cross-Engine Cost Aggregate MUST NOT Conflate Differing Pricing Sources

The aggregate view MUST allow the user to expand per-engine breakdown and MUST clearly distinguish cost contributions across engines whose pricing sources differ. The aggregate MUST NOT silently sum cost values that originate from different pricing source kinds without exposing the divergence.

#### Scenario: aggregate exposes per-engine breakdown alongside total

- **WHEN** the UI renders an aggregate cost
- **THEN** the per-engine cost breakdown MUST be reachable from the aggregate view
- **AND** any engine whose pricing source kind differs from the dominant source MUST be flagged

### Requirement: StatusPanel Cost Section MUST Behave Consistently In Dock And Popover Hosts

The Cost & Budget section in StatusPanel MUST render with the same data, severity, and i18n behavior in both the dock host and the popover host. Differences between hosts MUST be limited to layout density, not data semantics.

#### Scenario: dock and popover hosts render equivalent cost summary

- **WHEN** the same workspace cost data is rendered in dock and popover
- **THEN** the displayed summary value, currency, and degraded marker MUST be identical
- **AND** any host-specific layout MUST NOT hide degraded state

### Requirement: Cost & Budget i18n Keys MUST Be Provided In Both zh And en

Every user-visible string introduced by this capability MUST be sourced from i18n keys under `statusPanel.cost.*` and `statusPanel.budget.*`. Both `zh` and `en` locale files MUST contain matching keys at the time the spec is synced.

#### Scenario: zh and en keys exist for every new visible string

- **WHEN** CI runs the i18n parity check
- **THEN** every new `statusPanel.cost.*` or `statusPanel.budget.*` key MUST be present in both `zh` and `en`

### Requirement: Cost-Context-Budget Capability MUST Be Validated By CI

The system MUST provide `npm run check:context-ledger-cost-budget` that asserts pricing schema validity, cost projection invariants, budget threshold behavior, and i18n parity. This check MUST pass on three CI platforms.

#### Scenario: CI parity passes on three platforms

- **WHEN** CI executes the cost-context-budget check
- **THEN** the check MUST pass on `ubuntu-latest`, `macos-latest`, and `windows-latest`

#### Scenario: OpenSpec strict validation gates this capability

- **WHEN** CI or release validation runs OpenSpec validation
- **THEN** `openspec validate evolve-context-ledger-to-cost-budget --strict --no-interactive` MUST pass

### Requirement: Cost Budget UI MUST Distinguish Pricing Usage And Budget Gaps
The Cost/Budget surface MUST distinguish pricing unavailability, stale pricing, usage unavailability, unconfigured budget, and threshold crossings. These states MUST NOT be collapsed into a generic partial or unknown message.

#### Scenario: missing pricing is actionable
- **WHEN** the active engine/model has usage but no pricing source
- **THEN** the UI MUST show pricing unavailable as the reason
- **AND** the row MUST identify the engine and model
- **AND** the row MUST provide an action such as adding pricing, configuring an alias, or marking the model as not tracked

#### Scenario: unconfigured budget is not displayed as a failed budget
- **WHEN** cost can be projected but no budget is configured
- **THEN** the UI MUST identify the budget as unconfigured
- **AND** the UI MUST NOT imply that the budget check failed

#### Scenario: missing usage does not invent zero cost
- **WHEN** token usage is unavailable
- **THEN** the cost surface MUST show usage unavailable or omit cost projection
- **AND** it MUST NOT display a numeric zero that implies known cost

### Requirement: Cost Budget Evidence MUST Be Eligible For Governance Grouping
Cost and budget degraded states MUST be representable as governance evidence or an equivalent grouped StatusPanel view model so they can appear in needs-action or watch groups.

#### Scenario: pricing unavailable contributes needs-action evidence
- **WHEN** pricing is unavailable for an active model with usage
- **THEN** the grouped governance view MUST be able to classify the cost row as needs-action

#### Scenario: budget unconfigured contributes watch evidence
- **WHEN** cost is projectable but budget is not configured
- **THEN** the grouped governance view MUST be able to classify the budget row as watch or guidance rather than failure

#### Scenario: threshold crossed keeps advisory runtime semantics
- **WHEN** a budget threshold is crossed
- **THEN** the UI MUST show the threshold tier
- **AND** this capability MUST NOT forcibly interrupt the running runtime

### Requirement: Cost Panel MUST Render Token Breakdown When Usage Is Known
The cost surface MUST render a token breakdown whenever `ThreadTokenUsage` is available, regardless of whether pricing is available.

#### Scenario: token breakdown renders without pricing
- **WHEN** token usage is available
- **AND** pricing is unavailable for the active model
- **THEN** the token breakdown MUST remain visible
- **AND** monetary values MUST be hidden or marked unavailable

#### Scenario: zero segments are omitted cleanly
- **WHEN** one token category has zero tokens
- **THEN** that category MUST NOT render as a broken zero-width visual artifact
- **AND** remaining categories MUST still be legible

### Requirement: Cost Panel MUST Support Accumulated Session Today And Month Cost
The cost surface MUST be able to display accumulated cost for the current session, current local day, and current local month when pricing and cost history are available.

#### Scenario: session accumulation follows active thread id
- **WHEN** active thread id is available
- **THEN** session cost MUST aggregate entries for that session id
- **AND** the UI MUST NOT display a generic dash when a valid active session exists

#### Scenario: day and month accumulation use local time boundaries
- **WHEN** cost history contains entries across local day or month boundaries
- **THEN** today and month totals MUST include only entries in their respective local periods

#### Scenario: local history failure degrades safely
- **WHEN** local cost history storage is unavailable or fails to write
- **THEN** the UI MUST continue with in-memory or session-only data
- **AND** it MUST surface a non-blocking warning

### Requirement: Budget Bar MUST Visualize Monthly Limit Consumption
The cost surface MUST be able to render a Budget Bar from a locally configured monthly budget limit and warning thresholds.

#### Scenario: unset budget prompts configuration
- **WHEN** no monthly budget is configured
- **THEN** the Budget Bar slot MUST show a configuration prompt or watch state
- **AND** it MUST NOT imply that the budget check failed

#### Scenario: budget threshold warning is visual only
- **WHEN** month-to-date cost crosses a warning or exceeded threshold
- **THEN** the Budget Bar MUST show the corresponding visual state
- **AND** the UI MUST NOT block AI requests by itself

#### Scenario: settings update is reflected without restart
- **WHEN** the user sets, edits, or clears the monthly budget in settings
- **THEN** the StatusPanel budget state MUST update in the same app session

### Requirement: Cost V2 UI MUST Be Feature-Flagged
The expanded cost UI containing Token Breakdown, Accumulated Cost, and Budget Bar MUST be guarded by a feature flag such as `statusPanel.costV2`, while correctness fixes such as token-only fallback MAY ship outside the flag.

#### Scenario: feature flag disabled preserves legacy UI
- **WHEN** the cost V2 feature flag is disabled
- **THEN** the StatusPanel MUST render the legacy cost surface
- **AND** expanded V2 subcomponents MUST NOT mount

#### Scenario: feature flag enabled renders decision modules
- **WHEN** the cost V2 feature flag is enabled
- **THEN** the StatusPanel MAY render Token Breakdown, Accumulated Cost, and Budget Bar modules according to available data

### Requirement: Pricing Source Configuration MUST Remain Explicit
Pricing source lookup MUST continue to reject unknown engine/model pricing instead of silently falling back to unrelated rates. Any model alias or configured pricing source MUST be explicit and traceable.

#### Scenario: unknown model does not use a silent fallback price
- **WHEN** the active model is not present in fixture, config, remote, or alias pricing sources
- **THEN** cost projection MUST report pricing unavailable
- **AND** it MUST NOT reuse another model's price without an explicit alias

#### Scenario: configured alias preserves provenance
- **WHEN** a configured alias maps an active model to a pricing source
- **THEN** the cost record MUST expose the resolved pricing source
- **AND** the UI MUST be able to show that an alias or configured source was used

#### Scenario: pricing freshness is visible
- **WHEN** monetary cost is displayed
- **THEN** the UI MUST expose pricing source freshness such as `lastUpdatedAt`, `pricedAt`, or equivalent source date
- **AND** stale pricing MUST be distinguishable from missing pricing

