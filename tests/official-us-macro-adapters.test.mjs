import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBlsMacroResponse,
  parseBeaRealGdpResponse,
} from '../.quant-test/officialUsMacroAdapters.js';

test('BLS parser calculates year-over-year CPI and monthly payroll change from matching periods', () => {
  const makeSeries = (seriesID, rows) => ({ seriesID, data: rows.map(([year, period, value]) => ({ year: String(year), period, value: String(value) })) });
  const payload = {
    status: 'REQUEST_SUCCEEDED',
    Results: { series: [
      makeSeries('CUUR0000SA0', [[2026, 'M03', 330], [2025, 'M03', 320]]),
      makeSeries('CUSR0000SA0L1E', [[2026, 'M03', 340], [2025, 'M03', 333]]),
      makeSeries('LNS14000000', [[2026, 'M03', 4.1]]),
      makeSeries('CES0000000001', [[2026, 'M03', 160100], [2026, 'M02', 160000]]),
    ] },
  };
  const result = parseBlsMacroResponse(payload);
  assert.equal(result.cpiYearOverYearPct, 3.125);
  assert.equal(result.coreCpiYearOverYearPct, (340 / 333 - 1) * 100);
  assert.equal(result.unemploymentRatePct, 4.1);
  assert.equal(result.nonfarmPayrollMonthlyChangeThousands, 100);
  assert.equal(result.payrollPeriod, '2026-M03');
});

test('BLS parser rejects malformed and unsuccessful provider responses', () => {
  assert.throws(() => parseBlsMacroResponse({ status: 'REQUEST_FAILED', Results: { series: [] } }), /BLS response/);
});

test('BEA parser selects the latest valid quarterly real GDP observation', () => {
  const result = parseBeaRealGdpResponse({
    BEAAPI: { Results: { Data: [
      { LineNumber: '1', TimePeriod: '2025Q4', DataValue: '2.7' },
      { LineNumber: '1', TimePeriod: '2026Q1', DataValue: '3.1%' },
      { LineNumber: '2', TimePeriod: '2026Q2', DataValue: '99.0' },
      { LineNumber: '1', TimePeriod: '2026Q2', DataValue: '(NA)' },
    ] } },
  });
  assert.deepEqual(result, { realGdpAnnualizedQuarterlyPct: 3.1, realGdpPeriod: '2026Q1' });
});

test('BEA parser rejects provider errors and missing series', () => {
  assert.throws(() => parseBeaRealGdpResponse({ BEAAPI: { Results: { Error: [{}] } } }), /BEA reported an API error/);
});
