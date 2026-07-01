---
name: Data Cleaning
description: Clean and format raw datasets for analysis or machine learning tasks.
---

# Data Cleaning

## When to Use This Skill
Use when dealing with messy, missing, or inconsistent tabular data that needs to be prepared for downstream processing.

## When Not to Use This Skill
Do not use for complex feature engineering, domain-specific semantic transformations, or when raw data must be preserved exactly as-is.

## Goal
Produce a clean, standardized, and reliable dataset ready for analysis or modeling.

## Workflow
1. Load the dataset and inspect the schema and basic statistics.
2. Identify and handle missing values (e.g., impute, drop, or flag).
3. Standardize data formats (e.g., parse dates, normalize text casing).
4. Identify and remove duplicate records.
5. Validate the final output against the expected schema.

## Validation
- No unexpected nulls in critical columns.
- Consistent data types across all rows.
- No duplicate records (unless expected).

## Safety Rules
- Do not overwrite or delete the original raw data files.
- Do not silently drop large amounts of data without logging the action.
- Do not invent data to fill missing values without a clear imputation strategy.

## Output Format
A cleaned dataset file (e.g., CSV, Parquet) and a short summary log of the applied transformations and dropped rows.

## References
- Project data dictionary.
- Data quality standards and schema definitions.

## Stop and Escalate If
- A significant portion of the data (e.g., >20%) is missing or corrupted.
- The raw data format is completely unrecognized or malformed.
