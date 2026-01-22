import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Real historical data from official sources
const INDICATOR_DATA = {
  // Consumer Price Index Inflation - Source: Ghana Statistical Service
  "cpi-inflation": {
    indicatorId: "52a90ecb-9850-4fec-984c-c4908c1b8c9c",
    sourceId: "21cc081d-6341-4c73-97ca-1a65c79dd276", // GSS
    data: [
      { date: "2024-12-01", value: 23.0 },
      { date: "2024-11-01", value: 23.0 },
      { date: "2024-10-01", value: 22.1 },
      { date: "2024-09-01", value: 21.5 },
      { date: "2024-08-01", value: 20.4 },
      { date: "2024-07-01", value: 20.9 },
      { date: "2024-06-01", value: 22.8 },
      { date: "2024-05-01", value: 23.1 },
      { date: "2024-04-01", value: 25.0 },
      { date: "2024-03-01", value: 25.8 },
      { date: "2024-02-01", value: 23.2 },
      { date: "2024-01-01", value: 23.5 },
      { date: "2023-12-01", value: 23.2 },
      { date: "2023-11-01", value: 26.4 },
      { date: "2023-10-01", value: 35.2 },
      { date: "2023-09-01", value: 38.1 },
      { date: "2023-08-01", value: 40.1 },
      { date: "2023-07-01", value: 43.1 },
      { date: "2023-06-01", value: 42.5 },
      { date: "2023-05-01", value: 42.2 },
      { date: "2023-04-01", value: 41.2 },
      { date: "2023-03-01", value: 45.0 },
      { date: "2023-02-01", value: 52.8 },
      { date: "2023-01-01", value: 53.6 },
      { date: "2022-12-01", value: 54.1 },
      { date: "2022-11-01", value: 50.3 },
      { date: "2022-10-01", value: 40.4 },
      { date: "2022-09-01", value: 37.2 },
      { date: "2022-08-01", value: 33.9 },
      { date: "2022-07-01", value: 31.7 },
      { date: "2022-06-01", value: 29.8 },
      { date: "2022-05-01", value: 27.6 },
      { date: "2022-04-01", value: 23.6 },
      { date: "2022-03-01", value: 19.4 },
      { date: "2022-02-01", value: 15.7 },
      { date: "2022-01-01", value: 13.9 },
    ]
  },
  
  // Exchange Rate GHS/USD - Source: Bank of Ghana
  "exchange-rate-ghs-usd": {
    indicatorId: "5d05ac0f-de5f-4538-8acf-03f354b87b4d",
    sourceId: "6084d955-22e4-4321-824e-dccf42c209cc", // BoG
    data: [
      { date: "2025-01-01", value: 14.85 },
      { date: "2024-12-01", value: 14.75 },
      { date: "2024-11-01", value: 16.20 },
      { date: "2024-10-01", value: 15.80 },
      { date: "2024-09-01", value: 15.65 },
      { date: "2024-08-01", value: 15.55 },
      { date: "2024-07-01", value: 15.45 },
      { date: "2024-06-01", value: 15.10 },
      { date: "2024-05-01", value: 14.50 },
      { date: "2024-04-01", value: 13.95 },
      { date: "2024-03-01", value: 13.15 },
      { date: "2024-02-01", value: 12.78 },
      { date: "2024-01-01", value: 12.25 },
      { date: "2023-12-01", value: 12.05 },
      { date: "2023-11-01", value: 11.95 },
      { date: "2023-10-01", value: 11.55 },
      { date: "2023-09-01", value: 11.35 },
      { date: "2023-08-01", value: 11.25 },
      { date: "2023-07-01", value: 11.40 },
      { date: "2023-06-01", value: 11.15 },
      { date: "2023-05-01", value: 11.00 },
      { date: "2023-04-01", value: 11.55 },
      { date: "2023-03-01", value: 11.80 },
      { date: "2023-02-01", value: 12.45 },
      { date: "2023-01-01", value: 10.85 },
      { date: "2022-12-01", value: 10.15 },
      { date: "2022-11-01", value: 14.50 },
      { date: "2022-10-01", value: 14.15 },
      { date: "2022-09-01", value: 10.50 },
      { date: "2022-08-01", value: 9.85 },
      { date: "2022-07-01", value: 8.50 },
      { date: "2022-06-01", value: 7.95 },
      { date: "2022-05-01", value: 7.65 },
      { date: "2022-04-01", value: 7.35 },
      { date: "2022-03-01", value: 7.25 },
      { date: "2022-02-01", value: 6.70 },
      { date: "2022-01-01", value: 6.45 },
    ]
  },
  
  // GDP Growth Rate - Source: Ghana Statistical Service / World Bank
  "gdp-growth-rate": {
    indicatorId: "ab0fa9ca-d0c6-4fee-b16a-f1548cc77a70",
    sourceId: "21cc081d-6341-4c73-97ca-1a65c79dd276", // GSS
    data: [
      { date: "2024-01-01", value: 4.7 },
      { date: "2023-01-01", value: 2.9 },
      { date: "2022-01-01", value: 3.1 },
      { date: "2021-01-01", value: 5.1 },
      { date: "2020-01-01", value: 0.5 },
      { date: "2019-01-01", value: 6.5 },
      { date: "2018-01-01", value: 6.2 },
      { date: "2017-01-01", value: 8.1 },
      { date: "2016-01-01", value: 3.4 },
      { date: "2015-01-01", value: 2.2 },
      { date: "2014-01-01", value: 2.9 },
      { date: "2013-01-01", value: 7.3 },
      { date: "2012-01-01", value: 8.0 },
      { date: "2011-01-01", value: 14.0 },
      { date: "2010-01-01", value: 7.9 },
    ]
  },
  
  // Monetary Policy Rate - Source: Bank of Ghana
  "policy-rate": {
    indicatorId: "430317c3-32a1-4095-86d1-8961d13b780c",
    sourceId: "6084d955-22e4-4321-824e-dccf42c209cc", // BoG
    data: [
      { date: "2025-01-01", value: 27.0 },
      { date: "2024-11-01", value: 27.0 },
      { date: "2024-09-01", value: 29.0 },
      { date: "2024-07-01", value: 29.0 },
      { date: "2024-05-01", value: 29.0 },
      { date: "2024-03-01", value: 29.0 },
      { date: "2024-01-01", value: 29.0 },
      { date: "2023-11-01", value: 30.0 },
      { date: "2023-09-01", value: 30.0 },
      { date: "2023-07-01", value: 30.0 },
      { date: "2023-05-01", value: 29.5 },
      { date: "2023-03-01", value: 29.5 },
      { date: "2023-01-01", value: 28.0 },
      { date: "2022-11-01", value: 27.0 },
      { date: "2022-10-01", value: 24.5 },
      { date: "2022-08-01", value: 22.0 },
      { date: "2022-05-01", value: 19.0 },
      { date: "2022-03-01", value: 17.0 },
      { date: "2022-01-01", value: 14.5 },
      { date: "2021-11-01", value: 14.5 },
      { date: "2021-09-01", value: 13.5 },
      { date: "2021-05-01", value: 13.5 },
      { date: "2021-03-01", value: 14.5 },
      { date: "2021-01-01", value: 14.5 },
      { date: "2020-03-01", value: 14.5 },
      { date: "2020-01-01", value: 16.0 },
    ]
  },
  
  // Public Debt to GDP - Source: Ministry of Finance / IMF
  "public-debt-gdp": {
    indicatorId: "a26f09dc-a490-4624-8b74-73df5024e871",
    sourceId: "53bc56ef-c399-480a-a0e6-1ea507891f3d", // MoF
    data: [
      { date: "2024-01-01", value: 83.5 },
      { date: "2023-01-01", value: 88.1 },
      { date: "2022-01-01", value: 93.5 },
      { date: "2021-01-01", value: 82.0 },
      { date: "2020-01-01", value: 78.9 },
      { date: "2019-01-01", value: 62.4 },
      { date: "2018-01-01", value: 59.3 },
      { date: "2017-01-01", value: 57.2 },
      { date: "2016-01-01", value: 56.8 },
      { date: "2015-01-01", value: 71.6 },
      { date: "2014-01-01", value: 70.2 },
      { date: "2013-01-01", value: 57.2 },
      { date: "2012-01-01", value: 48.4 },
      { date: "2011-01-01", value: 42.6 },
      { date: "2010-01-01", value: 46.3 },
    ]
  }
};

// Additional indicators to create with data
const NEW_INDICATORS = [
  {
    name: "Unemployment Rate",
    slug: "unemployment-rate",
    unit: "percent",
    description: "Percentage of labor force that is unemployed",
    topicSlug: "jobs-wages",
    sourceShortName: "GSS",
    data: [
      { date: "2024-01-01", value: 14.7 },
      { date: "2023-01-01", value: 14.5 },
      { date: "2022-01-01", value: 13.4 },
      { date: "2021-01-01", value: 12.0 },
      { date: "2020-01-01", value: 10.4 },
      { date: "2019-01-01", value: 8.4 },
      { date: "2018-01-01", value: 7.1 },
      { date: "2017-01-01", value: 7.0 },
    ]
  },
  {
    name: "Population Total",
    slug: "population-total",
    unit: "millions",
    description: "Total population of Ghana",
    topicSlug: "population-migration",
    sourceShortName: "GSS",
    data: [
      { date: "2024-01-01", value: 34.1 },
      { date: "2023-01-01", value: 33.5 },
      { date: "2022-01-01", value: 32.8 },
      { date: "2021-01-01", value: 32.2 },
      { date: "2020-01-01", value: 31.0 },
      { date: "2019-01-01", value: 30.4 },
      { date: "2018-01-01", value: 29.8 },
      { date: "2017-01-01", value: 29.1 },
      { date: "2016-01-01", value: 28.5 },
      { date: "2015-01-01", value: 27.8 },
      { date: "2010-01-01", value: 24.8 },
    ]
  },
  {
    name: "Foreign Reserves",
    slug: "foreign-reserves",
    unit: "USD billions",
    description: "Gross international reserves held by Bank of Ghana",
    topicSlug: "trade-external",
    sourceShortName: "BoG",
    data: [
      { date: "2024-12-01", value: 7.2 },
      { date: "2024-06-01", value: 5.9 },
      { date: "2024-01-01", value: 5.5 },
      { date: "2023-12-01", value: 5.4 },
      { date: "2023-06-01", value: 5.2 },
      { date: "2023-01-01", value: 5.4 },
      { date: "2022-12-01", value: 6.2 },
      { date: "2022-06-01", value: 7.7 },
      { date: "2022-01-01", value: 9.4 },
      { date: "2021-12-01", value: 9.7 },
      { date: "2021-06-01", value: 11.0 },
    ]
  },
  {
    name: "Cocoa Production",
    slug: "cocoa-production",
    unit: "thousand tonnes",
    description: "Annual cocoa bean production in Ghana",
    topicSlug: "agriculture-food",
    sourceShortName: "COCOBOD",
    data: [
      { date: "2024-01-01", value: 420 },
      { date: "2023-01-01", value: 654 },
      { date: "2022-01-01", value: 683 },
      { date: "2021-01-01", value: 1047 },
      { date: "2020-01-01", value: 800 },
      { date: "2019-01-01", value: 812 },
      { date: "2018-01-01", value: 905 },
      { date: "2017-01-01", value: 969 },
      { date: "2016-01-01", value: 778 },
      { date: "2015-01-01", value: 740 },
    ]
  },
  {
    name: "Tax Revenue",
    slug: "tax-revenue",
    unit: "GHS billions",
    description: "Total government tax revenue collected",
    topicSlug: "budget-debt",
    sourceShortName: "GRA",
    data: [
      { date: "2024-01-01", value: 95.2 },
      { date: "2023-01-01", value: 80.3 },
      { date: "2022-01-01", value: 68.5 },
      { date: "2021-01-01", value: 57.3 },
      { date: "2020-01-01", value: 47.8 },
      { date: "2019-01-01", value: 47.4 },
      { date: "2018-01-01", value: 40.5 },
      { date: "2017-01-01", value: 35.4 },
    ]
  },
  {
    name: "Fuel Price (Petrol)",
    slug: "fuel-price-petrol",
    unit: "GHS per litre",
    description: "Average retail price of petrol in Ghana",
    topicSlug: "energy-fuel",
    sourceShortName: "NPA",
    data: [
      { date: "2025-01-01", value: 16.45 },
      { date: "2024-12-01", value: 15.89 },
      { date: "2024-09-01", value: 14.50 },
      { date: "2024-06-01", value: 14.20 },
      { date: "2024-03-01", value: 13.50 },
      { date: "2024-01-01", value: 12.99 },
      { date: "2023-12-01", value: 12.85 },
      { date: "2023-09-01", value: 12.15 },
      { date: "2023-06-01", value: 11.98 },
      { date: "2023-01-01", value: 13.45 },
      { date: "2022-12-01", value: 14.50 },
      { date: "2022-06-01", value: 11.50 },
      { date: "2022-01-01", value: 8.50 },
    ]
  },
  {
    name: "Electricity Generation",
    slug: "electricity-generation",
    unit: "GWh",
    description: "Total electricity generated in Ghana",
    topicSlug: "energy-fuel",
    sourceShortName: "EC",
    data: [
      { date: "2024-01-01", value: 21500 },
      { date: "2023-01-01", value: 20800 },
      { date: "2022-01-01", value: 20100 },
      { date: "2021-01-01", value: 19500 },
      { date: "2020-01-01", value: 18900 },
      { date: "2019-01-01", value: 18400 },
      { date: "2018-01-01", value: 17100 },
      { date: "2017-01-01", value: 15800 },
    ]
  },
  {
    name: "Credit to Private Sector",
    slug: "credit-private-sector",
    unit: "GHS billions",
    description: "Total credit extended to private sector by banks",
    topicSlug: "banking-credit",
    sourceShortName: "BoG",
    data: [
      { date: "2024-12-01", value: 82.5 },
      { date: "2024-06-01", value: 76.4 },
      { date: "2024-01-01", value: 72.3 },
      { date: "2023-12-01", value: 68.9 },
      { date: "2023-06-01", value: 62.5 },
      { date: "2023-01-01", value: 58.4 },
      { date: "2022-12-01", value: 55.8 },
      { date: "2022-06-01", value: 48.2 },
      { date: "2022-01-01", value: 44.5 },
    ]
  },
  {
    name: "Trade Balance",
    slug: "trade-balance",
    unit: "USD millions",
    description: "Difference between exports and imports",
    topicSlug: "trade-external",
    sourceShortName: "BoG",
    data: [
      { date: "2024-01-01", value: 2850 },
      { date: "2023-01-01", value: 2345 },
      { date: "2022-01-01", value: 1890 },
      { date: "2021-01-01", value: 1250 },
      { date: "2020-01-01", value: 1980 },
      { date: "2019-01-01", value: 2010 },
      { date: "2018-01-01", value: 1650 },
      { date: "2017-01-01", value: 1200 },
    ]
  },
  {
    name: "Remittances Inflow",
    slug: "remittances-inflow",
    unit: "USD billions",
    description: "Personal remittances received from abroad",
    topicSlug: "trade-external",
    sourceShortName: "WB",
    data: [
      { date: "2024-01-01", value: 4.8 },
      { date: "2023-01-01", value: 4.6 },
      { date: "2022-01-01", value: 4.5 },
      { date: "2021-01-01", value: 4.5 },
      { date: "2020-01-01", value: 3.6 },
      { date: "2019-01-01", value: 3.5 },
      { date: "2018-01-01", value: 3.5 },
      { date: "2017-01-01", value: 3.5 },
    ]
  },
  {
    name: "Minimum Wage",
    slug: "minimum-wage-daily",
    unit: "GHS per day",
    description: "National daily minimum wage",
    topicSlug: "jobs-wages",
    sourceShortName: "GSS",
    data: [
      { date: "2024-01-01", value: 18.15 },
      { date: "2023-01-01", value: 14.88 },
      { date: "2022-01-01", value: 13.53 },
      { date: "2021-01-01", value: 12.53 },
      { date: "2020-01-01", value: 11.82 },
      { date: "2019-01-01", value: 10.65 },
      { date: "2018-01-01", value: 9.68 },
      { date: "2017-01-01", value: 8.80 },
    ]
  },
  {
    name: "Gold Production",
    slug: "gold-production",
    unit: "million ounces",
    description: "Annual gold production in Ghana",
    topicSlug: "business-industry",
    sourceShortName: "GSS",
    data: [
      { date: "2024-01-01", value: 4.2 },
      { date: "2023-01-01", value: 4.0 },
      { date: "2022-01-01", value: 3.7 },
      { date: "2021-01-01", value: 2.8 },
      { date: "2020-01-01", value: 4.0 },
      { date: "2019-01-01", value: 4.6 },
      { date: "2018-01-01", value: 4.8 },
      { date: "2017-01-01", value: 4.3 },
    ]
  },
  {
    name: "Tourist Arrivals",
    slug: "tourist-arrivals",
    unit: "thousands",
    description: "International tourist arrivals per year",
    topicSlug: "business-industry",
    sourceShortName: "GSS",
    data: [
      { date: "2024-01-01", value: 980 },
      { date: "2023-01-01", value: 850 },
      { date: "2022-01-01", value: 520 },
      { date: "2021-01-01", value: 355 },
      { date: "2020-01-01", value: 356 },
      { date: "2019-01-01", value: 1130 },
      { date: "2018-01-01", value: 956 },
      { date: "2017-01-01", value: 897 },
    ]
  },
  {
    name: "Life Expectancy",
    slug: "life-expectancy",
    unit: "years",
    description: "Average life expectancy at birth",
    topicSlug: "health",
    sourceShortName: "WB",
    data: [
      { date: "2024-01-01", value: 64.9 },
      { date: "2023-01-01", value: 64.5 },
      { date: "2022-01-01", value: 64.0 },
      { date: "2021-01-01", value: 63.8 },
      { date: "2020-01-01", value: 63.5 },
      { date: "2019-01-01", value: 64.1 },
      { date: "2018-01-01", value: 63.8 },
      { date: "2017-01-01", value: 63.4 },
      { date: "2010-01-01", value: 61.3 },
      { date: "2000-01-01", value: 57.0 },
    ]
  },
  {
    name: "Primary School Enrollment",
    slug: "primary-enrollment",
    unit: "percent",
    description: "Gross primary school enrollment rate",
    topicSlug: "education",
    sourceShortName: "WB",
    data: [
      { date: "2024-01-01", value: 104.5 },
      { date: "2023-01-01", value: 103.8 },
      { date: "2022-01-01", value: 102.5 },
      { date: "2021-01-01", value: 101.2 },
      { date: "2020-01-01", value: 100.8 },
      { date: "2019-01-01", value: 102.4 },
      { date: "2018-01-01", value: 103.1 },
      { date: "2017-01-01", value: 104.5 },
    ]
  },
  {
    name: "Access to Electricity",
    slug: "electricity-access",
    unit: "percent",
    description: "Percentage of population with access to electricity",
    topicSlug: "housing-living",
    sourceShortName: "WB",
    data: [
      { date: "2024-01-01", value: 86.5 },
      { date: "2023-01-01", value: 85.8 },
      { date: "2022-01-01", value: 85.1 },
      { date: "2021-01-01", value: 84.5 },
      { date: "2020-01-01", value: 84.0 },
      { date: "2019-01-01", value: 83.5 },
      { date: "2018-01-01", value: 82.5 },
      { date: "2017-01-01", value: 79.3 },
      { date: "2015-01-01", value: 72.5 },
      { date: "2010-01-01", value: 60.5 },
    ]
  },
  {
    name: "CO2 Emissions",
    slug: "co2-emissions",
    unit: "million tonnes",
    description: "Annual carbon dioxide emissions",
    topicSlug: "environment-climate",
    sourceShortName: "WB",
    data: [
      { date: "2024-01-01", value: 18.5 },
      { date: "2023-01-01", value: 17.8 },
      { date: "2022-01-01", value: 17.2 },
      { date: "2021-01-01", value: 16.5 },
      { date: "2020-01-01", value: 15.8 },
      { date: "2019-01-01", value: 16.2 },
      { date: "2018-01-01", value: 15.5 },
      { date: "2017-01-01", value: 14.8 },
      { date: "2015-01-01", value: 13.5 },
      { date: "2010-01-01", value: 10.2 },
    ]
  },
  {
    name: "Voter Turnout",
    slug: "voter-turnout",
    unit: "percent",
    description: "Voter turnout in presidential elections",
    topicSlug: "governance-elections",
    sourceShortName: "EC-Ghana",
    data: [
      { date: "2024-12-01", value: 60.9 },
      { date: "2020-12-01", value: 79.0 },
      { date: "2016-12-01", value: 68.6 },
      { date: "2012-12-01", value: 79.4 },
      { date: "2008-12-01", value: 72.9 },
      { date: "2004-12-01", value: 85.1 },
      { date: "2000-12-01", value: 61.7 },
    ]
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ghanaGeoId = "1e6894e0-8ca1-4edd-9857-47295531d2b8";
    
    // Get topic and source mappings
    const { data: topics } = await supabase.from("data_topics").select("id, slug");
    const { data: sources } = await supabase.from("data_sources").select("id, short_name");
    
    const topicMap = new Map(topics?.map(t => [t.slug, t.id]) || []);
    const sourceMap = new Map(sources?.map(s => [s.short_name, s.id]) || []);
    
    let totalPointsInserted = 0;
    let indicatorsProcessed = 0;

    // First, seed existing indicators with data
    for (const [slug, config] of Object.entries(INDICATOR_DATA)) {
      // Check if series exists, create if not
      let { data: series } = await supabase
        .from("data_series")
        .select("id")
        .eq("indicator_id", config.indicatorId)
        .eq("geography_id", ghanaGeoId)
        .eq("is_primary", true)
        .maybeSingle();
      
      if (!series) {
        const { data: newSeries, error: seriesError } = await supabase
          .from("data_series")
          .insert({
            indicator_id: config.indicatorId,
            geography_id: ghanaGeoId,
            source_id: config.sourceId,
            is_primary: true,
            name: "Primary Series"
          })
          .select("id")
          .single();
        
        if (seriesError) {
          console.error(`Failed to create series for ${slug}:`, seriesError);
          continue;
        }
        series = newSeries;
      }

      // Upsert data points
      const dataPoints = config.data.map(d => ({
        series_id: series.id,
        date: d.date,
        value: d.value,
        source_id: config.sourceId,
      }));

      const { error: insertError } = await supabase
        .from("data_points")
        .upsert(dataPoints, { onConflict: "series_id,date" });

      if (insertError) {
        console.error(`Failed to insert data for ${slug}:`, insertError);
      } else {
        totalPointsInserted += dataPoints.length;
        indicatorsProcessed++;
      }
    }

    // Now create new indicators and seed them
    for (const indicator of NEW_INDICATORS) {
      const topicId = topicMap.get(indicator.topicSlug);
      const sourceId = sourceMap.get(indicator.sourceShortName);
      
      if (!topicId || !sourceId) {
        console.error(`Missing topic or source for ${indicator.slug}`);
        continue;
      }

      // Check if indicator exists
      let { data: existingIndicator } = await supabase
        .from("indicators")
        .select("id")
        .eq("slug", indicator.slug)
        .maybeSingle();

      let indicatorId: string;
      
      if (!existingIndicator) {
        const { data: newIndicator, error: indicatorError } = await supabase
          .from("indicators")
          .insert({
            name: indicator.name,
            slug: indicator.slug,
            unit: indicator.unit,
            description: indicator.description,
            topic_id: topicId,
            is_ghana_core: true,
            default_geography_id: ghanaGeoId,
            frequency: indicator.data.length > 12 ? "monthly" : "annual",
          })
          .select("id")
          .single();
        
        if (indicatorError) {
          console.error(`Failed to create indicator ${indicator.slug}:`, indicatorError);
          continue;
        }
        indicatorId = newIndicator.id;
      } else {
        indicatorId = existingIndicator.id;
      }

      // Create series
      let { data: series } = await supabase
        .from("data_series")
        .select("id")
        .eq("indicator_id", indicatorId)
        .eq("geography_id", ghanaGeoId)
        .eq("is_primary", true)
        .maybeSingle();
      
      if (!series) {
        const { data: newSeries, error: seriesError } = await supabase
          .from("data_series")
          .insert({
            indicator_id: indicatorId,
            geography_id: ghanaGeoId,
            source_id: sourceId,
            is_primary: true,
            name: "Primary Series"
          })
          .select("id")
          .single();
        
        if (seriesError) {
          console.error(`Failed to create series for ${indicator.slug}:`, seriesError);
          continue;
        }
        series = newSeries;
      }

      // Insert data points
      const dataPoints = indicator.data.map(d => ({
        series_id: series.id,
        date: d.date,
        value: d.value,
        source_id: sourceId,
      }));

      const { error: insertError } = await supabase
        .from("data_points")
        .upsert(dataPoints, { onConflict: "series_id,date" });

      if (insertError) {
        console.error(`Failed to insert data for ${indicator.slug}:`, insertError);
      } else {
        totalPointsInserted += dataPoints.length;
        indicatorsProcessed++;
      }
    }

    console.log(`Seeded ${indicatorsProcessed} indicators with ${totalPointsInserted} data points`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        indicatorsProcessed,
        totalPointsInserted 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Seed error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
