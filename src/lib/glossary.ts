// Static plain-English glossary of common Ghana economic terms.
// `match` is tested against key-number labels to power "Explain this number".
export type GlossaryTerm = { slug: string; term: string; definition: string; match: RegExp };

export const GLOSSARY: GlossaryTerm[] = [
  { slug: "cpi", term: "Consumer Price Index (CPI)", definition: "A measure of the average price of a fixed basket of goods and services bought by households. The Ghana Statistical Service publishes it monthly.", match: /\bcpi\b|consumer price/i },
  { slug: "inflation", term: "Inflation rate", definition: "How much prices have risen compared with the same month a year earlier. 5% inflation means something that cost GHS 100 a year ago now costs about GHS 105.", match: /inflation/i },
  { slug: "food-inflation", term: "Food inflation", definition: "The year-on-year rise in the prices of food and non-alcoholic drinks within the CPI.", match: /food (inflation|price)/i },
  { slug: "non-food-inflation", term: "Non-food inflation", definition: "The year-on-year rise in prices of everything in the CPI basket except food, such as rent, transport and utilities.", match: /non-food/i },
  { slug: "core-inflation", term: "Core inflation", definition: "Inflation excluding volatile items such as energy and some food, used to see the underlying price trend.", match: /core inflation/i },
  { slug: "ppi", term: "Producer Price Index (PPI)", definition: "Measures changes in the prices producers receive for their output. It often signals future consumer price changes.", match: /\bppi\b|producer price/i },
  { slug: "policy-rate", term: "Monetary policy rate", definition: "The Bank of Ghana's main interest rate. It guides what banks charge each other and their customers; raising it aims to slow inflation.", match: /policy rate|\bmpr\b/i },
  { slug: "inflation-target", term: "Inflation target", definition: "The Bank of Ghana aims to keep inflation at 8%, within a band of plus or minus 2 percentage points.", match: /inflation target/i },
  { slug: "t-bill-yield", term: "Treasury bill (T-bill) yield", definition: "The annual return investors earn on short-term government borrowing, usually 91, 182 or 364 days. Higher yields mean government borrowing costs more.", match: /t-?bill|treasury bill/i },
  { slug: "bond-yield", term: "Bond yield", definition: "The annual return on a government or company bond. Yields rise when investors see more risk or expect higher inflation.", match: /bond yield|\byield\b/i },
  { slug: "interbank-rate", term: "Interbank rate", definition: "The interest rate banks charge each other for short-term loans. It usually moves close to the policy rate.", match: /interbank/i },
  { slug: "lending-rate", term: "Average lending rate", definition: "The typical interest rate banks charge on loans to businesses and households.", match: /lending rate/i },
  { slug: "cedi-depreciation", term: "Cedi depreciation", definition: "A fall in the cedi's value against another currency, meaning more cedis are needed to buy one dollar, pound or euro. It makes imports dearer.", match: /depreciat|cedi (fell|loss|weaken)/i },
  { slug: "cedi-appreciation", term: "Cedi appreciation", definition: "A rise in the cedi's value, so fewer cedis buy one unit of foreign currency. It makes imports cheaper.", match: /appreciat/i },
  { slug: "exchange-rate", term: "Exchange rate", definition: "The price of one currency in another, for example how many cedis buy one US dollar.", match: /exchange rate|usd\/ghs|ghs per|forex rate/i },
  { slug: "gdp", term: "Gross Domestic Product (GDP)", definition: "The total value of goods and services produced in Ghana over a period. It is the broadest measure of the size of the economy.", match: /\bgdp\b(?! growth)|gross domestic/i },
  { slug: "gdp-growth", term: "GDP growth", definition: "How much the economy's output grew compared with the same period a year earlier, after adjusting for price changes.", match: /gdp growth|economic growth|growth rate/i },
  { slug: "non-oil-gdp", term: "Non-oil GDP", definition: "Economic output excluding oil and gas production, showing how the rest of the economy is doing.", match: /non-oil/i },
  { slug: "debt-to-gdp", term: "Debt-to-GDP ratio", definition: "Government debt as a share of the economy's annual output. A higher ratio means debt is larger relative to the country's ability to pay.", match: /debt[- ]to[- ]gdp/i },
  { slug: "public-debt", term: "Public debt", definition: "The total amount the government owes to domestic and foreign lenders.", match: /public debt|national debt|total debt|government debt/i },
  { slug: "fiscal-deficit", term: "Fiscal (budget) deficit", definition: "When government spending exceeds its revenue in a period. It is often shown as a share of GDP.", match: /deficit/i },
  { slug: "primary-balance", term: "Primary balance", definition: "The government's budget balance excluding interest payments on debt. A surplus means revenue covers spending before interest.", match: /primary (balance|surplus)/i },
  { slug: "revenue", term: "Government revenue", definition: "Money the government collects, mainly taxes, plus grants and other income such as oil revenue.", match: /revenue|tax collect/i },
  { slug: "gra", term: "Ghana Revenue Authority (GRA)", definition: "The agency that collects taxes and customs duties in Ghana.", match: /\bgra\b/i },
  { slug: "vat", term: "Value Added Tax (VAT)", definition: "A tax added to the price of most goods and services at each stage of sale, paid finally by consumers.", match: /\bvat\b|value added/i },
  { slug: "reserves", term: "Gross international reserves", definition: "Foreign currency and gold held by the Bank of Ghana. Often expressed as months of import cover — how long reserves could pay for imports.", match: /reserve|import cover/i },
  { slug: "trade-balance", term: "Trade balance", definition: "The value of exports minus imports. A surplus means Ghana sold more abroad than it bought.", match: /trade (balance|surplus|deficit)/i },
  { slug: "current-account", term: "Current account", definition: "A record of trade in goods and services plus income and transfers with the rest of the world, including remittances.", match: /current account/i },
  { slug: "remittances", term: "Remittances", definition: "Money sent home by Ghanaians living abroad. It is a major source of foreign currency.", match: /remittance/i },
  { slug: "fdi", term: "Foreign direct investment (FDI)", definition: "Investment by foreign companies or individuals in businesses and assets in Ghana.", match: /\bfdi\b|foreign direct/i },
  { slug: "imf-programme", term: "IMF programme (ECF)", definition: "A loan arrangement with the International Monetary Fund, paid in tranches when Ghana meets agreed economic targets.", match: /\bimf\b|extended credit/i },
  { slug: "eurobond", term: "Eurobond", definition: "A bond Ghana issues on international markets, usually in US dollars.", match: /eurobond/i },
  { slug: "debt-restructuring", term: "Debt restructuring", definition: "Renegotiating the terms of existing debt — lower interest, longer repayment or reduced principal — when a borrower cannot pay as agreed.", match: /restructur|haircut|ddep/i },
  { slug: "money-supply", term: "Money supply (M2+)", definition: "The total amount of money in the economy, including cash and bank deposits. Fast growth can push inflation up.", match: /money supply|\bm2\+?\b/i },
  { slug: "npl", term: "Non-performing loans (NPL) ratio", definition: "The share of bank loans where borrowers have stopped paying as agreed, usually for 90 days or more.", match: /non-performing|\bnpl/i },
  { slug: "unemployment", term: "Unemployment rate", definition: "The share of people in the labour force who are without work and actively looking for it.", match: /unemploy/i },
  { slug: "poverty-rate", term: "Poverty rate", definition: "The share of people living below a set poverty line of income or consumption.", match: /poverty/i },
  { slug: "gse-ci", term: "GSE Composite Index (GSE-CI)", definition: "An index tracking the overall price movement of shares listed on the Ghana Stock Exchange.", match: /gse|composite index|stock exchange/i },
  { slug: "market-cap", term: "Market capitalisation", definition: "The total market value of a company's shares, or of all shares on an exchange.", match: /market cap/i },
  { slug: "cocoa-output", term: "Cocoa production", definition: "The quantity of cocoa beans harvested and bought in a season, usually measured in tonnes. Cocoa is a top export earner.", match: /cocoa/i },
  { slug: "gold-exports", term: "Gold exports", definition: "The value or volume of gold Ghana sells abroad — its largest export by value.", match: /gold/i },
  { slug: "crude-oil-price", term: "Crude oil price (Brent)", definition: "The world benchmark price of a barrel of crude oil. It feeds into Ghana's fuel pump prices and oil revenue.", match: /brent|crude|oil price/i },
  { slug: "pump-price", term: "Fuel pump price", definition: "The price per litre of petrol or diesel at the pump, set in pricing windows by fuel companies under NPA guidelines.", match: /pump|petrol|diesel|fuel price/i },
  { slug: "utility-tariff", term: "Utility tariff", definition: "The approved price for electricity or water, set by the Public Utilities Regulatory Commission (PURC).", match: /tariff|purc/i },
];

export function explainLabel(label: string): GlossaryTerm | undefined {
  return GLOSSARY.find((g) => g.match.test(label));
}
