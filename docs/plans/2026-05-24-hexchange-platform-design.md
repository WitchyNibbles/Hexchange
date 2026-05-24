# Hexchange Platform Design

> Date: 2026-05-24
> Scope: local-first research and product design for a single-operator autonomous trading platform across stocks and crypto

## Summary

Hexchange should be a locally run operator console for systematic trading, not a black-box "AI prints money" app. The product goal is to discover, validate, and execute trading opportunities with disciplined risk controls and radical transparency about what the system is doing, why it is doing it, and whether it is actually making money after fees, slippage, and drawdowns.

The recommended product shape is:

- local-first desktop/web platform
- single primary operator
- paper-trading-first validation ladder
- guarded live trading only after strategy-specific gates pass
- custom WitchyNibbles-inspired UX layered over a proven trading/research engine

## Product Intent

### Primary user

You, running the platform locally as the only operator in phase 1.

### Core outcome

Produce a trustworthy trading workstation that can:

- ingest market data for stocks and crypto
- research and score opportunities
- simulate and paper trade strategies realistically
- explain each trade and the resulting PnL
- graduate selected strategies into tightly controlled live trading

### Non-goals for phase 1

- multi-user SaaS
- social trading
- "guaranteed profit" claims
- high-frequency trading
- margin-heavy or leverage-first automation
- full broker/exchange coverage

## Research Conclusions

### What is actually credible

There are credible execution and research platforms, but not credible public proof of universal AI profit generation. The trustworthy pattern is:

1. structured research and backtesting
2. forward paper validation
3. small-size live deployment
4. continuous monitoring and automatic de-risking

### Recommended platform posture

Build Hexchange around validation and operator trust, not around aggressive marketing claims. "Proven" should mean reproducible evidence inside the product:

- backtest performance with stated assumptions
- walk-forward and out-of-sample behavior
- forward paper-trading results
- paper-to-live drift reports
- realized live execution metrics

## Product Principles

1. Local authority first

The operator owns the machine, secrets, configuration, and decision thresholds.

2. Transparent autonomy

Every automated action must be explainable in plain language with supporting metrics.

3. Validation before capital

No strategy reaches live mode without passing explicit promotion gates.

4. Risk before return

The system should protect capital, detect degraded behavior, and halt safely.

5. Charming but serious UX

The interface can feel magical and alive while still reading like a trading instrument panel.

## Chosen Direction

### Recommended architecture

Use a proven strategy/backtest/live-trading core and build custom orchestration and UX around it.

### Why

- avoids rebuilding fills, brokerage adapters, and research primitives from scratch
- shortens the path to a realistic paper-trading environment
- lets the custom work focus on signal evaluation, operator controls, and transparency
- reduces false confidence from naive homemade simulations

### Engine recommendation

Use LEAN/QuantConnect as the first execution and research engine candidate because it is open source, supports local workflows, and already models the backtest/live split. Hexchange should treat the engine as an internal subsystem, not as the user-facing product.

## Connector Strategy

### Day-one target path

- Alpaca for the first stock and crypto paper/live connector

### Day-two expansions

- Interactive Brokers for broader equities support
- Coinbase Advanced Trade for additional crypto execution
- Kraken for additional crypto execution

### Why Alpaca first

- supports both stocks and crypto
- offers paper trading
- simpler starting path for a single local operator
- good fit for initial validation before broader venue coverage

## Validation Ladder

Every strategy moves through the same lifecycle:

1. Research hypothesis
2. Historical backtest
3. Walk-forward or rolling-window validation
4. Paper trading in real-time
5. Small-size live deployment
6. Promotion, throttling, or automatic retirement

Each stage should record:

- return metrics
- drawdown metrics
- trade frequency
- fee/slippage impact
- regime sensitivity
- failure conditions

## Functional Architecture

## 1. Operator Console

The local web UI used to monitor and control the system.

Responsibilities:

- view system status
- inspect active strategies
- view positions, orders, and PnL
- audit trade reasoning
- arm or disarm live trading
- manage risk thresholds and kill switches

## 2. Strategy Engine Adapter

A boundary around the execution engine that normalizes:

- strategy runs
- generated signals
- orders and fills
- positions
- backtest and paper results

This keeps the UI and orchestration layer independent from any single engine.

## 3. Market Data Layer

Provides normalized stocks and crypto data to the strategy layer and UI.

Responsibilities:

- pull historical data
- stream current market updates
- maintain symbol metadata
- cache local datasets where appropriate

## 4. Opportunity and Strategy Layer

Runs candidate strategies and converts raw signals into ranked actions.

Phase 1 should favor auditable approaches:

- momentum
- mean reversion
- breakout
- volatility or regime filters
- portfolio/risk overlays

ML should be used narrowly at first for:

- regime classification
- signal ranking
- anomaly detection
- position sizing suggestions

## 5. Risk and Promotion Layer

The trust boundary between analysis and capital deployment.

Responsibilities:

- cap position size
- cap per-strategy capital
- set daily drawdown halts
- detect abnormal slippage or execution failure
- enforce promotion gates between paper and live

## 6. Audit and Explanation Layer

Stores the evidence behind each trade.

Each trade should record:

- strategy id
- market and symbol
- signal reason
- expected edge
- confidence or regime tag
- order path
- fill quality
- realized PnL
- post-trade evaluation

## UX Direction

### Visual language

The WitchyNibbles reference suggests:

- deep midnight and cobalt backgrounds
- luminous cyan highlights
- moon, star, sigil, and familiar-like accents used sparingly
- rounded glass panels and layered glow
- playful character without sacrificing readability

### Product feeling

The platform should feel like a magical observatory for markets:

- alive but calm
- advanced but not intimidating
- transparent rather than mysterious

### Core screens

1. Observatory

Top-level dashboard for live state, total PnL, risk posture, and current engine activity.

2. Spellbook

Strategy library showing status, validation stage, performance, and promotion eligibility.

3. Ritual Log

Event stream of signals, orders, fills, pauses, warnings, and model notes.

4. Familiar View

Human-readable "what the system is doing now" panel with concise natural-language summaries.

5. Ledger

Per-trade attribution and portfolio analytics.

### UX rules

- always show whether the system is in research, paper, or live mode
- never show profit without drawdown and exposure context
- every action should have a linked explanation trail
- live-mode controls should feel deliberate and hard to trigger accidentally

## Safety and Compliance Posture

Hexchange should be designed as an operator-controlled research and execution tool. It must not promise profit or conceal uncertainty.

Phase 1 safety requirements:

- encrypted secret storage or OS-backed secret handling
- explicit venue credential scopes
- default-off live trading
- emergency kill switch
- max loss and max exposure rules
- venue-health and data-health checks
- stale-signal rejection
- audit logs that survive restarts

## Recommended First Slice

Build this first:

- local app shell
- operator dashboard
- LEAN-backed strategy runner boundary
- Alpaca paper trading integration
- one stock strategy
- one crypto strategy
- trade journal with explanation cards
- promotion gate report from backtest to paper

This first slice is small enough to validate the architecture and strong enough to expose the biggest risks early.

## Success Criteria

The design is succeeding when Hexchange can:

- run locally with a single-command startup
- paper trade stocks and crypto through one realistic connector path
- show strategy decisions and paper PnL transparently
- measure paper-vs-backtest drift
- require explicit operator approval before live deployment

## Source Notes

- [CFTC: AI Trading Bots and Scams](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html)
- [SEC/FINRA/NASAA: Artificial Intelligence Investment Fraud](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/artificial-intelligence-fraud)
- [LEAN GitHub Repository](https://github.com/QuantConnect/Lean)
- [QuantConnect Paper Trading Docs](https://www.quantconnect.com/docs/v2/lean-cli/live-trading/paper-trading)
- [QuantConnect Brokerage Integrations](https://www.quantconnect.com/brokerages)
- [Alpaca Trading API](https://docs.alpaca.markets/us/v1.4.2/docs/trading-api)
- [Alpaca Crypto Trading](https://docs.alpaca.markets/us/docs/crypto-trading)
- [Alpaca Automated Trading Risks](https://files.alpaca.markets/disclosures/library/RisksAutoTrading.pdf)
- [Interactive Brokers API](https://www.interactivebrokers.com/en/trading/ib-api.php)
- [Coinbase Advanced Trade Sandbox](https://docs.cdp.coinbase.com/coinbase-business/advanced-trade-apis/sandbox)
- [Kraken Add Order API](https://docs.kraken.com/api/docs/rest-api/add-order/)
- [Kraken Derivatives Demo/API Testing Environment](https://support.kraken.com/articles/360024809011-api-testing-environment-derivatives)
- [TradeStation SIM vs Live](https://api.tradestation.com/docs/fundamentals/sim-vs-live/)
