// Ghana Statistical Service, Population and Housing Census (PHC) 2010 and 2021, regional totals.
// Transcribed from citypopulation.de (which cites GSS) on 2 Nov 2026; 2021 regions sum to 30,832,019,
// the GSS 2021 PHC national total. 2010 figures for the six regions created in 2018/19 are GSS re-tabulations.
export const CENSUS_SOURCE = { name: "Ghana Statistical Service, 2010 and 2021 Population and Housing Census (via citypopulation.de)", url: "https://www.citypopulation.de/en/ghana/admin/", gss: "https://census2021.statsghana.gov.gh/" };
export const REGIONS: { name: string; formerly?: string; pop2010: number; pop2021: number }[] = [
  { name: "Ahafo", formerly: "Brong Ahafo", pop2010: 484210, pop2021: 564668 },
  { name: "Ashanti", pop2010: 4780380, pop2021: 5440463 },
  { name: "Bono", formerly: "Brong Ahafo", pop2010: 922617, pop2021: 1208649 },
  { name: "Bono East", formerly: "Brong Ahafo", pop2010: 904156, pop2021: 1203400 },
  { name: "Central", pop2010: 2201863, pop2021: 2859821 },
  { name: "Eastern", pop2010: 2633154, pop2021: 2925653 },
  { name: "Greater Accra", pop2010: 4010054, pop2021: 5455692 },
  { name: "North East", formerly: "Northern", pop2010: 465005, pop2021: 658946 },
  { name: "Northern", pop2010: 1544946, pop2021: 2310939 },
  { name: "Oti", formerly: "Volta", pop2010: 636889, pop2021: 747248 },
  { name: "Savannah", formerly: "Northern", pop2010: 469510, pop2021: 653266 },
  { name: "Upper East", pop2010: 1046545, pop2021: 1301226 },
  { name: "Upper West", pop2010: 702110, pop2021: 901502 },
  { name: "Volta", pop2010: 1481363, pop2021: 1659040 },
  { name: "Western", pop2010: 1664586, pop2021: 2060585 },
  { name: "Western North", formerly: "Western", pop2010: 711435, pop2021: 880921 },
];
