-- StatsGH: backfill GSE end-of-day share prices for 2, 9 and 11 Nov 2026 into public.gse_daily_prices. Schema public ONLY.
-- PREPARED 15 Nov 2026 by StatsGH Web. NOT RUN. Needs Zeb's go-ahead (production data write).
-- Source per day: GSE's own published "Daily Shares" table on https://gse.com.gh/trading-and-data/ (same table the gse-scrape
-- edge function reads; raw copy saved at /workspace/statsgh-bot/tmp/gse-fix/raw/t39.json). Column mapping identical to gse-scrape.
-- All three were trading days: GSE's own index table lists Mon 2 Nov, Mon 9 Nov and Wed 11 Nov 2026 with volumes; no Ghana public holiday.
-- Checks done before preparing (read-only):
--   * 40 equities each day, every one with a close > 0 (no gaps); same 40 symbols as the stored days.
--   * Sum of volumes = GSE index-table volume for that day exactly: 503,067 / 1,425,030 / 570,598. 2 Nov value traded GH¢2,954,318.17
--     also matches SIC Brokerage's Morning Brief of 4 Nov 2026.
--   * Every backfilled previous_close equals our stored close for the trading day before, and every stored next-day previous_close
--     equals the backfilled close (0 mismatches across 120 rows).
--   * AADS and ZEN: name taken from public.companies (gse-scrape's own list has no name for them); sector left NULL, as in companies.
-- Idempotent: ON CONFLICT (trade_date, symbol) DO NOTHING; never overwrites an existing row.

begin;
create table if not exists public.gse_daily_prices_backup_20261115 as table public.gse_daily_prices with no data;
insert into public.gse_daily_prices_backup_20261115 select * from public.gse_daily_prices p
  where p.trade_date in ('2026-11-02','2026-11-09','2026-11-11')
    and not exists (select 1 from public.gse_daily_prices_backup_20261115 b where b.id = p.id);   -- expect 0 rows today
alter table public.gse_daily_prices_backup_20261115 enable row level security;
revoke all on public.gse_daily_prices_backup_20261115 from anon, authenticated;

insert into public.gse_daily_prices (trade_date, symbol, name, sector, close, previous_close, open, last_trade, change, change_percent, volume, value_traded, year_high, year_low, source, source_url)
select v.trade_date, v.symbol, coalesce(v.name, c.name), coalesce(v.sector, c.sector), v.close, v.previous_close, v.open, v.last_trade,
       v.change, v.change_percent, v.volume, v.value_traded, v.year_high, v.year_low, v.source, v.source_url
from (values
-- 2026-11-02: 40 equities, GSE 'Daily Shares' table (wpDataTables id 39) on https://gse.com.gh/trading-and-data/, read 15 Nov 2026 ~10:15 GMT
  (date '2026-11-02', 'AADS', NULL, NULL, 0.46, 0.46, 0.46, 0.46, 0, 0, 0, 0, 0.46, 0.42, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'ACCESS', 'Access Bank Ghana', 'Banking', 20.79, 20.79, 20.79, 20.79, 0, 0, 41, 852.39, 46.64, 16.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'ADB', 'Agricultural Development Bank', 'Banking', 5.3, 5.3, 5.3, 5.3, 0, 0, 0, 0, 5.3, 5.06, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'AGA', 'AngloGold Ashanti', 'Mining', 37, 37, 37, 37, 0, 0, 0, 0, 37, 37, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'ALLGH', 'Atlantic Lithium', 'Mining', 5.3, 5.3, 5.3, 5.3, 0, 0, 0, 0, 8.46, 5.3, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'ALW', 'Aluworks', 'Manufacturing', 0.1, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0.1, 0.1, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'ASG', 'Asante Gold Corporation', 'Mining', 8.89, 8.89, 8.89, 8.89, 0, 0, 0, 0, 8.89, 8.89, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'BOPP', 'Benso Oil Palm Plantation', 'Agriculture', 70, 70, 70, 70, 0, 0, 2, 140, 100, 55.82, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'CAL', 'CAL Bank', 'Banking', 0.74, 0.74, 0.74, 0.74, 0, 0, 6763, 5004.62, 0.94, 0.61, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'CLYD', 'Clydestone (Ghana)', 'Technology', 3.85, 3.85, 3.85, 3.85, 0, 0, 250, 962.5, 6.57, 0.46, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'CMLT', 'Camelot Ghana', 'Manufacturing', 0.14, 0.14, 0.14, 0.14, 0, 0, 0, 0, 0.14, 0.14, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'CPC', 'Cocoa Processing Company', 'Manufacturing', 0.38, 0.38, 0.38, 0.38, 0, 0, 0, 0, 0.38, 0.05, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'DASPHARMA', 'Dannex Ayrton Starwin', 'Pharmaceuticals', 0.93, 0.93, 0.93, 0.93, 0, 0, 0, 0, 1.98, 0.38, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'DIGICUT', 'Digicut Production & Advertising', 'Media', 0.39, 0.39, 0.39, 0.39, 0, 0, 0, 0, 0.56, 0.09, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'EGH', 'Ecobank Ghana', 'Banking', 39, 39, 39, 39, 0, 0, 138, 5520, 57, 25, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'EGL', 'Enterprise Group', 'Insurance', 8.4, 8.4, 8.4, 8.4, 0, 0, 26, 219.6, 12.16, 3.48, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'ETI', 'Ecobank Transnational', 'Banking', 1.44, 1.44, 1.44, 1.44, 0, 0, 29031, 41789.64, 2.82, 0.76, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'FAB', 'First Atlantic Bank', 'Banking', 8.4, 8.4, 8.4, 8.4, 0, 0, 0, 0, 8.4, 7.71, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'FML', 'Fan Milk', 'Food & Beverage', 13.99, 13.99, 13.99, 13.99, 0, 0, 2111, 29532.89, 16.35, 8, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'GCB', 'GCB Bank', 'Banking', 42.08, 42.08, 42.08, 42.08, 0, 0, 610, 25668.8, 52, 20.11, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'GGBL', 'Guinness Ghana Breweries', 'Food & Beverage', 10.66, 10.66, 10.66, 10.66, 0, 0, 18, 191.88, 16.5, 6.6, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'GLD', 'NewGold ETF', 'ETF', 462.36, 462.36, 462.36, 462.36, 0, 0, 0, 0, 533.93, 462.36, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'GOIL', 'GOIL', 'Oil & Gas', 5.5, 5.5, 5.5, 5.5, 0, 0, 67, 368.5, 8.01, 2.96, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'HORDS', 'Hords', 'Manufacturing', 0.75, 0.75, 0.75, 0.75, 0, 0, 0, 0, 0.88, 0.09, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'IIL', 'Intravenous Infusions', 'Pharmaceuticals', 0.54, 0.54, 0.54, 0.54, 0, 0, 39306, 21618.3, 0.93, 0.05, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'KASA', 'Kasapreko', 'Food & Beverage', 1.8, 1.85, 1.85, 1.8, -0.05, -2.7, 8793, 15843.87, 2.3, 1.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'MAC', 'Mega African Capital', 'Financial Services', 5.2, 5.2, 5.2, 5.2, 0, 0, 0, 0, 5.2, 5.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'MMH', 'Meridian-Marshalls Holdings', 'Distribution', 0.14, 0.14, 0.14, 0.14, 0, 0, 0, 0, 0.14, 0.1, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'MTNGH', 'MTN Ghana', 'Telecommunications', 6.75, 6.75, 6.75, 6.75, 0, 0, 406216, 2742190.72, 7.15, 4.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'PBC', 'Produce Buying Company', 'Agriculture', 0.02, 0.02, 0.02, 0.02, 0, 0, 0, 0, 0.02, 0.02, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'RBGH', 'Republic Bank Ghana', 'Banking', 4, 4, 4, 4, 0, 0, 48, 192, 5.58, 1.3, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'SAMBA', 'Samba Foods', 'Food & Beverage', 0.55, 0.55, 0.55, 0.55, 0, 0, 0, 0, 0.55, 0.55, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'SCB', 'Standard Chartered Bank Ghana', 'Banking', 69.87, 69.87, 69.87, 69.87, 0, 0, 4, 268, 79.41, 29.22, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'SCBPREF', 'Standard Chartered Bank Ghana (Preference)', 'Banking', 0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0, 0.99, 0.9, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'SIC', 'SIC Insurance', 'Insurance', 5, 5, 5, 5, 0, 0, 9187, 45935, 6.09, 1.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'SOGEGH', 'Societe Generale Ghana', 'Banking', 4.63, 4.63, 4.63, 4.63, 0, 0, 0, 0, 11.51, 4.49, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'TLW', 'Tullow Oil', 'Oil & Gas', 13.11, 13.11, 13.11, 13.11, 0, 0, 0, 0, 13.11, 11.92, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'TOTAL', 'TotalEnergies Marketing Ghana', 'Oil & Gas', 39.99, 39.99, 39.99, 39.99, 0, 0, 165, 6524.96, 42, 32.91, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'UNIL', 'Unilever Ghana', 'Consumer Goods', 39.5, 39.5, 39.5, 39.5, 0, 0, 291, 11494.5, 40, 19.79, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-02', 'ZEN', NULL, NULL, 9.01, 9.01, 9.01, 9.01, 0, 0, 0, 0, 12.61, 5, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
-- 2026-11-09: 40 equities, GSE 'Daily Shares' table (wpDataTables id 39) on https://gse.com.gh/trading-and-data/, read 15 Nov 2026 ~10:15 GMT
  (date '2026-11-09', 'AADS', NULL, NULL, 0.46, 0.46, 0.46, 0.46, 0, 0, 0, 0, 0.46, 0.42, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'ACCESS', 'Access Bank Ghana', 'Banking', 20.79, 20.79, 20.79, 20.79, 0, 0, 1407, 29251.53, 46.64, 16.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'ADB', 'Agricultural Development Bank', 'Banking', 5.3, 5.3, 5.3, 5.3, 0, 0, 0, 0, 5.3, 5.06, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'AGA', 'AngloGold Ashanti', 'Mining', 37, 37, 37, 37, 0, 0, 0, 0, 37, 37, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'ALLGH', 'Atlantic Lithium', 'Mining', 5.3, 5.3, 5.3, 5.3, 0, 0, 271, 1436.3, 8.46, 5.3, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'ALW', 'Aluworks', 'Manufacturing', 0.1, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0.1, 0.1, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'ASG', 'Asante Gold Corporation', 'Mining', 8.89, 8.89, 8.89, 8.89, 0, 0, 2, 17.78, 8.89, 8.89, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'BOPP', 'Benso Oil Palm Plantation', 'Agriculture', 70, 70, 70, 70, 0, 0, 0, 0, 100, 55.82, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'CAL', 'CAL Bank', 'Banking', 0.74, 0.75, 0.75, 0.74, -0.01, -1.33, 332996, 247481.08, 0.94, 0.61, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'CLYD', 'Clydestone (Ghana)', 'Technology', 3.59, 3.85, 3.85, 3.59, -0.26, -6.75, 6043, 21487.1, 6.57, 0.46, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'CMLT', 'Camelot Ghana', 'Manufacturing', 0.14, 0.14, 0.14, 0.14, 0, 0, 0, 0, 0.14, 0.14, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'CPC', 'Cocoa Processing Company', 'Manufacturing', 0.53, 0.49, 0.49, 0.53, 0.04, 8.16, 65788, 34751.39, 0.53, 0.05, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'DASPHARMA', 'Dannex Ayrton Starwin', 'Pharmaceuticals', 1.12, 1.04, 1.04, 1.12, 0.08, 7.69, 12774, 13437.48, 1.98, 0.38, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'DIGICUT', 'Digicut Production & Advertising', 'Media', 0.35, 0.35, 0.35, 0.35, 0, 0, 6930, 2494.8, 0.56, 0.09, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'EGH', 'Ecobank Ghana', 'Banking', 36.65, 36.65, 36.65, 36.65, 0, 0, 87, 3188.55, 57, 25, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'EGL', 'Enterprise Group', 'Insurance', 8.47, 8.47, 8.47, 8.47, 0, 0, 39056, 330804.32, 12.16, 3.48, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'ETI', 'Ecobank Transnational', 'Banking', 1.41, 1.39, 1.39, 1.41, 0.02, 1.44, 82920, 117571.24, 2.82, 0.76, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'FAB', 'First Atlantic Bank', 'Banking', 8.4, 8.4, 8.4, 8.4, 0, 0, 68, 571.2, 8.4, 7.71, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'FML', 'Fan Milk', 'Food & Beverage', 13, 13, 13, 13, 0, 0, 1705, 22165, 16.35, 8, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'GCB', 'GCB Bank', 'Banking', 41.73, 42, 42, 41.73, -0.27, -0.64, 8603, 359149.3, 52, 20.11, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'GGBL', 'Guinness Ghana Breweries', 'Food & Beverage', 10.66, 10.66, 10.66, 10.66, 0, 0, 50, 533, 16.5, 6.6, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'GLD', 'NewGold ETF', 'ETF', 462.36, 462.36, 462.36, 462.36, 0, 0, 3, 1387.08, 533.93, 462.36, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'GOIL', 'GOIL', 'Oil & Gas', 5.2, 5.2, 5.2, 5.2, 0, 0, 24112, 125395.4, 8.01, 2.96, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'HORDS', 'Hords', 'Manufacturing', 0.74, 0.75, 0.75, 0.74, -0.01, -1.33, 14438, 10684.12, 0.88, 0.09, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'IIL', 'Intravenous Infusions', 'Pharmaceuticals', 0.56, 0.56, 0.56, 0.56, 0, 0, 44404, 24751.19, 0.93, 0.05, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'KASA', 'Kasapreko', 'Food & Beverage', 1.8, 1.78, 1.78, 1.8, 0.02, 1.12, 146641, 263534.4, 2.3, 1.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'MAC', 'Mega African Capital', 'Financial Services', 5.2, 5.2, 5.2, 5.2, 0, 0, 0, 0, 5.2, 5.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'MMH', 'Meridian-Marshalls Holdings', 'Distribution', 0.16, 0.16, 0.16, 0.16, 0, 0, 0, 0, 0.15, 0.1, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'MTNGH', 'MTN Ghana', 'Telecommunications', 6.58, 6.58, 6.58, 6.58, 0, 0, 594596, 3908773.13, 7.15, 4.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'PBC', 'Produce Buying Company', 'Agriculture', 0.02, 0.02, 0.02, 0.02, 0, 0, 0, 0, 0.02, 0.02, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'RBGH', 'Republic Bank Ghana', 'Banking', 4, 4, 4, 4, 0, 0, 875, 3500, 5.58, 1.3, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'SAMBA', 'Samba Foods', 'Food & Beverage', 0.55, 0.55, 0.55, 0.55, 0, 0, 0, 0, 0.55, 0.55, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'SCB', 'Standard Chartered Bank Ghana', 'Banking', 69.87, 69.87, 69.87, 69.87, 0, 0, 15, 1005, 79.41, 29.22, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'SCBPREF', 'Standard Chartered Bank Ghana (Preference)', 'Banking', 0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0, 0.99, 0.9, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'SIC', 'SIC Insurance', 'Insurance', 4.37, 4.65, 4.65, 4.37, -0.28, -6.02, 13269, 60461.66, 6.09, 1.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'SOGEGH', 'Societe Generale Ghana', 'Banking', 4.63, 4.65, 4.65, 4.63, -0.02, -0.43, 11859, 54923.81, 11.51, 4.49, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'TLW', 'Tullow Oil', 'Oil & Gas', 13.11, 13.11, 13.11, 13.11, 0, 0, 35, 458.85, 13.11, 11.92, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'TOTAL', 'TotalEnergies Marketing Ghana', 'Oil & Gas', 34.8, 34.8, 34.8, 34.8, 0, 0, 15676, 545511.33, 42, 32.91, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'UNIL', 'Unilever Ghana', 'Consumer Goods', 43, 43, 43, 43, 0, 0, 171, 7353, 43, 19.79, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-09', 'ZEN', NULL, NULL, 9.01, 9.01, 9.01, 9.01, 0, 0, 236, 2126.36, 12.61, 5, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
-- 2026-11-11: 40 equities, GSE 'Daily Shares' table (wpDataTables id 39) on https://gse.com.gh/trading-and-data/, read 15 Nov 2026 ~10:15 GMT
  (date '2026-11-11', 'AADS', NULL, NULL, 0.46, 0.46, 0.46, 0.46, 0, 0, 0, 0, 0.46, 0.42, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'ACCESS', 'Access Bank Ghana', 'Banking', 20.79, 20.79, 20.79, 20.79, 0, 0, 901, 18731.79, 46.64, 16.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'ADB', 'Agricultural Development Bank', 'Banking', 5.3, 5.3, 5.3, 5.3, 0, 0, 4, 21.2, 5.3, 5.06, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'AGA', 'AngloGold Ashanti', 'Mining', 37, 37, 37, 37, 0, 0, 0, 0, 37, 37, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'ALLGH', 'Atlantic Lithium', 'Mining', 5.3, 5.3, 5.3, 5.3, 0, 0, 40, 212, 8.46, 5.3, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'ALW', 'Aluworks', 'Manufacturing', 0.1, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0.1, 0.1, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'ASG', 'Asante Gold Corporation', 'Mining', 8.89, 8.89, 8.89, 8.89, 0, 0, 2, 17.78, 8.89, 8.89, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'BOPP', 'Benso Oil Palm Plantation', 'Agriculture', 70, 70, 70, 70, 0, 0, 0, 0, 100, 55.82, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'CAL', 'CAL Bank', 'Banking', 0.75, 0.75, 0.75, 0.75, 0, 0, 100150, 74763.83, 0.94, 0.61, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'CLYD', 'Clydestone (Ghana)', 'Technology', 3.59, 3.59, 3.59, 3.59, 0, 0, 1144, 4106.96, 6.57, 0.46, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'CMLT', 'Camelot Ghana', 'Manufacturing', 0.14, 0.14, 0.14, 0.14, 0, 0, 0, 0, 0.14, 0.14, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'CPC', 'Cocoa Processing Company', 'Manufacturing', 0.63, 0.58, 0.58, 0.63, 0.05, 8.62, 4000, 2520, 0.63, 0.05, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'DASPHARMA', 'Dannex Ayrton Starwin', 'Pharmaceuticals', 1.14, 1.14, 1.14, 1.14, 0, 0, 506, 574.78, 1.98, 0.38, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'DIGICUT', 'Digicut Production & Advertising', 'Media', 0.36, 0.33, 0.33, 0.36, 0.03, 9.09, 6001, 2160.36, 0.56, 0.09, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'EGH', 'Ecobank Ghana', 'Banking', 36.65, 36.65, 36.65, 36.65, 0, 0, 1956, 71687.4, 57, 25, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'EGL', 'Enterprise Group', 'Insurance', 8.47, 8.47, 8.47, 8.47, 0, 0, 2321, 19658.87, 12.16, 3.48, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'ETI', 'Ecobank Transnational', 'Banking', 1.4, 1.41, 1.41, 1.4, -0.01, -0.71, 33370, 47043.62, 2.82, 0.76, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'FAB', 'First Atlantic Bank', 'Banking', 8.4, 8.4, 8.4, 8.4, 0, 0, 23, 193.2, 8.4, 7.71, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'FML', 'Fan Milk', 'Food & Beverage', 13, 13, 13, 13, 0, 0, 372, 4836, 16.35, 8, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'GCB', 'GCB Bank', 'Banking', 39.96, 40, 40, 39.96, -0.04, -0.1, 30442, 1216068.8, 52, 20.11, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'GGBL', 'Guinness Ghana Breweries', 'Food & Beverage', 10.66, 10.66, 10.66, 10.66, 0, 0, 819, 8730.54, 16.5, 6.6, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'GLD', 'NewGold ETF', 'ETF', 462.35, 462.36, 462.36, 462.35, -0.01, 0, 2, 924.7, 533.93, 462.35, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'GOIL', 'GOIL', 'Oil & Gas', 5.2, 5.2, 5.2, 5.2, 0, 0, 17322, 90074.4, 8.01, 2.96, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'HORDS', 'Hords', 'Manufacturing', 0.74, 0.74, 0.74, 0.74, 0, 0, 555, 410.7, 0.88, 0.09, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'IIL', 'Intravenous Infusions', 'Pharmaceuticals', 0.5, 0.51, 0.51, 0.5, -0.01, -1.96, 30044, 15045.05, 0.93, 0.05, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'KASA', 'Kasapreko', 'Food & Beverage', 1.63, 1.75, 1.75, 1.63, -0.12, -6.86, 159039, 258686.44, 2.3, 1.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'MAC', 'Mega African Capital', 'Financial Services', 5.2, 5.2, 5.2, 5.2, 0, 0, 9, 46.8, 5.2, 5.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'MMH', 'Meridian-Marshalls Holdings', 'Distribution', 0.16, 0.16, 0.16, 0.16, 0, 0, 0, 0, 0.15, 0.1, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'MTNGH', 'MTN Ghana', 'Telecommunications', 6.61, 6.55, 6.55, 6.61, 0.06, 0.92, 163430, 1080702.19, 7.15, 4.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'PBC', 'Produce Buying Company', 'Agriculture', 0.02, 0.02, 0.02, 0.02, 0, 0, 0, 0, 0.02, 0.02, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'RBGH', 'Republic Bank Ghana', 'Banking', 4, 4, 4, 4, 0, 0, 667, 2668, 5.58, 1.3, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'SAMBA', 'Samba Foods', 'Food & Beverage', 0.55, 0.55, 0.55, 0.55, 0, 0, 0, 0, 0.55, 0.55, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'SCB', 'Standard Chartered Bank Ghana', 'Banking', 69.87, 69.87, 69.87, 69.87, 0, 0, 1, 67, 79.41, 29.22, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'SCBPREF', 'Standard Chartered Bank Ghana (Preference)', 'Banking', 0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0, 0.99, 0.9, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'SIC', 'SIC Insurance', 'Insurance', 4.97, 4.52, 4.52, 4.97, 0.45, 9.96, 11388, 56590.71, 6.09, 1.2, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'SOGEGH', 'Societe Generale Ghana', 'Banking', 4.6, 4.63, 4.63, 4.6, -0.03, -0.65, 5369, 24708.47, 11.51, 4.49, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'TLW', 'Tullow Oil', 'Oil & Gas', 13.11, 13.11, 13.11, 13.11, 0, 0, 1, 13.11, 13.11, 11.92, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'TOTAL', 'TotalEnergies Marketing Ghana', 'Oil & Gas', 34.8, 34.8, 34.8, 34.8, 0, 0, 0, 0, 42, 32.91, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'UNIL', 'Unilever Ghana', 'Consumer Goods', 43, 43, 43, 43, 0, 0, 35, 1537, 43, 19.79, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/'),
  (date '2026-11-11', 'ZEN', NULL, NULL, 9.01, 9.01, 9.01, 9.01, 0, 0, 685, 6171.85, 12.61, 5, 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'https://gse.com.gh/trading-and-data/')
) as v(trade_date, symbol, name, sector, close, previous_close, open, last_trade, change, change_percent, volume, value_traded, year_high, year_low, source, source_url)
left join public.companies c on c.symbol = v.symbol
on conflict (trade_date, symbol) do nothing;

select trade_date, count(*) n, sum(volume) vol from public.gse_daily_prices where trade_date in ('2026-11-02','2026-11-09','2026-11-11') group by 1 order by 1;
-- expect 2026-11-02 40 503067 | 2026-11-09 40 1425030 | 2026-11-11 40 570598
commit;

-- ROLLBACK: delete from public.gse_daily_prices where trade_date in ('2026-11-02','2026-11-09','2026-11-11')
--   and id not in (select id from public.gse_daily_prices_backup_20261115);
