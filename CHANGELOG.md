# Changelog

All notable engineering changes to this repository are documented here.

The format follows the intent of [Keep a Changelog](https://keepachangelog.com/) and uses semantic versioning principles where releases are created.

## [Unreleased]

### Runtime intelligence
- Added relevance-ranked session memory recall while preserving strict session isolation.
- Added ordered multi-intent deterministic planning for explicit memory and calculator requests.
- Wired runtime, provider and tool execution into bounded telemetry.
- Added per-response execution metrics and telemetry/recall API endpoints.
- Prevented memory-search requests from retrieving the current search prompt itself.

### Engineering
- Added repository ownership and structured contribution workflows.
- Added Dependabot coverage for Python and GitHub Actions dependencies.
- Added issue and pull-request templates focused on reproducibility, validation, risk, and rollback.
- Added consistent editor configuration and engineering standards.

## Release policy

A release should describe user-visible behavior, compatibility notes, validation evidence, and any migration or rollback requirements. Repository history remains the source of truth for individual commits.
