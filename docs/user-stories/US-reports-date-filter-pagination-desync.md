# User Story: Reconcile Date-Filtered Sales Count and Totals Between Reports and Dashboard

### User Story US-REPORTS-03 (GitHub Issue [#12](https://github.com/SriSatyaLokesh/vikretha/issues/12)):

- **Summary:** Ensure date-filtered reports load all sales in the selected period without being prematurely capped by page limits, matching the Dashboard count

#### Use Case:
- **As a** shop owner or accountant reviewing monthly sales performance
- **I want to** see the true total count and revenue for any selected month or date range in Reports (matching the Dashboard Monthly Report)
- **so that** business decisions and monthly revenue comparisons between Reports and Dashboard are completely consistent and reliable.

#### Acceptance Criteria:

- **Scenario:** Filtering sales by month in Reports reflects all sales without 25-item cap
  - **Given:** A store has 36 sales recorded in the month of June
  - **and Given:** The Dashboard Monthly Report for June displays 36 sales
  - **When:** I navigate to Reports > Sales and apply the June date range or month preset
  - **Then:** Reports loads all 36 sales for June, displaying "36 sales" and the complete monthly revenue in the summary stats bar matching the Dashboard.

- **Scenario:** Summary stats bar calculates totals across the complete filtered date period
  - **Given:** A date range filter (`_fromDate` and `_toDate`) is active in Reports
  - **When:** Sales records are loaded and rendered
  - **Then:** The query constraint does not truncate results to a default 25-item page limit, ensuring total sales count, total revenue, average order value, and payment breakdowns encompass the entire filtered date range.

- **Scenario:** Consistent data between Reports list, summary stats, export, and Dashboard
  - **Given:** A user views the monthly report on the Dashboard and then navigates to Reports
  - **When:** Comparing the monthly count and revenue figures across both views
  - **Then:** Both views show identical sales counts and revenue totals for the same selected month.

#### Technical Details & Root Cause:
- **Location:** `modules/reports.js` in `_buildQuery()` (lines ~126–143) and `_hasAdvancedFilters()` (lines ~189–192)
- **Root Cause:**
  1. In `modules/reports.js`, `_buildQuery()` imposes a hard limit of 25 unless `_hasAdvancedFilters()` is true:
     `const constraints = [orderBy('timestamp', 'desc'), limit(_hasAdvancedFilters() ? 500 : 25)];`
  2. `_hasAdvancedFilters()` only checks payment mode, amount range, and sort order:
     `return _payFilter !== 'all' || _amtMin != null || _amtMax != null || _sortOrder !== 'newest';`
  3. Date range filters (`_fromDate` / `_toDate`) are excluded from `_hasAdvancedFilters()`. Consequently, when filtering by month (e.g. June 1 to June 30), `_hasAdvancedFilters()` evaluates to `false`, and Firestore returns only the first page of 25 sales.
  4. In contrast, `modules/dashboard.js` (`_showMonthlyReport`) queries all sales within `monthStart` and `monthEnd` without a 25-item limit, accurately returning all 36 sales.
- **Recommended Fix:**
  1. Include date range filters (`_fromDate || _toDate`) in `_hasAdvancedFilters()` so date-filtered queries use a high ceiling (e.g., 500/1000) or load all sales for the selected period.
  2. Ensure pagination handles pagination batches transparently while computing stats across the full date range, or automatically load all records for explicit date filter selections.
