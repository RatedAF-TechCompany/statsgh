// World Bank WDI topic dashboards. Data is written only by the macro-refresh edge function
// (supabase/functions/macro-refresh, same codes) into macro_series with source + URL; pages read stored rows only.
export type TopicSeries = { key: string; code: string; name: string; unit: string };
export type TopicDashboard = { slug: string; title: string; intro: string; series: TopicSeries[] };
export const TOPIC_DASHBOARDS: TopicDashboard[] = [
  {
    "slug": "trade",
    "title": "Ghana Trade Dashboard",
    "intro": "Exports, imports, the current account and foreign reserves, from the World Bank.",
    "series": [
      {
        "key": "wb_exports",
        "code": "NE.EXP.GNFS.ZS",
        "name": "Exports of goods and services",
        "unit": "% of GDP"
      },
      {
        "key": "wb_imports",
        "code": "NE.IMP.GNFS.ZS",
        "name": "Imports of goods and services",
        "unit": "% of GDP"
      },
      {
        "key": "wb_current_account",
        "code": "BN.CAB.XOKA.GD.ZS",
        "name": "Current account balance",
        "unit": "% of GDP"
      },
      {
        "key": "wb_reserves",
        "code": "FI.RES.TOTL.CD",
        "name": "Total reserves incl. gold",
        "unit": "US$ bn"
      },
      {
        "key": "wb_fuel_exports",
        "code": "TX.VAL.FUEL.ZS.UN",
        "name": "Fuel exports",
        "unit": "% of merchandise exports"
      }
    ]
  },
  {
    "slug": "agriculture",
    "title": "Ghana Agriculture Dashboard",
    "intro": "Farming's share of the economy and jobs, cereal yields and food production, from the World Bank.",
    "series": [
      {
        "key": "wb_agri_va",
        "code": "NV.AGR.TOTL.ZS",
        "name": "Agriculture, forestry and fishing value added",
        "unit": "% of GDP"
      },
      {
        "key": "wb_agri_jobs",
        "code": "SL.AGR.EMPL.ZS",
        "name": "Employment in agriculture (ILO modelled)",
        "unit": "% of employment"
      },
      {
        "key": "wb_cereal_yield",
        "code": "AG.YLD.CREL.KG",
        "name": "Cereal yield",
        "unit": "kg per hectare"
      },
      {
        "key": "wb_food_index",
        "code": "AG.PRD.FOOD.XD",
        "name": "Food production index",
        "unit": "2014-16 = 100"
      }
    ]
  },
  {
    "slug": "energy",
    "title": "Ghana Energy Dashboard",
    "intro": "Electricity access and renewable energy, from the World Bank. Pump prices are on the Fuel & Cedi tracker.",
    "series": [
      {
        "key": "wb_elec_access",
        "code": "EG.ELC.ACCS.ZS",
        "name": "Access to electricity",
        "unit": "% of population"
      },
      {
        "key": "wb_elec_rural",
        "code": "EG.ELC.ACCS.RU.ZS",
        "name": "Access to electricity, rural",
        "unit": "% of rural population"
      },
      {
        "key": "wb_renew_cons",
        "code": "EG.FEC.RNEW.ZS",
        "name": "Renewable energy consumption",
        "unit": "% of final energy"
      },
      {
        "key": "wb_renew_elec",
        "code": "EG.ELC.RNEW.ZS",
        "name": "Renewable electricity output",
        "unit": "% of electricity output"
      }
    ]
  },
  {
    "slug": "jobs",
    "title": "Ghana Jobs Dashboard",
    "intro": "Unemployment, youth unemployment, labour force participation and vulnerable employment (ILO modelled estimates via the World Bank).",
    "series": [
      {
        "key": "wb_unemp",
        "code": "SL.UEM.TOTL.ZS",
        "name": "Unemployment (ILO modelled)",
        "unit": "% of labour force"
      },
      {
        "key": "wb_youth_unemp",
        "code": "SL.UEM.1524.ZS",
        "name": "Youth unemployment, 15-24 (ILO modelled)",
        "unit": "% of labour force 15-24"
      },
      {
        "key": "wb_lfpr",
        "code": "SL.TLF.CACT.ZS",
        "name": "Labour force participation (ILO modelled)",
        "unit": "% of population 15+"
      },
      {
        "key": "wb_vuln_emp",
        "code": "SL.EMP.VULN.ZS",
        "name": "Vulnerable employment (ILO modelled)",
        "unit": "% of employment"
      }
    ]
  },
  {
    "slug": "health",
    "title": "Ghana Health Dashboard",
    "intro": "Maternal and child mortality, life expectancy and health spending, from the World Bank.",
    "series": [
      {
        "key": "wb_mmr",
        "code": "SH.STA.MMRT",
        "name": "Maternal mortality ratio (modelled)",
        "unit": "per 100,000 live births"
      },
      {
        "key": "wb_u5mr",
        "code": "SH.DYN.MORT",
        "name": "Under-5 mortality",
        "unit": "per 1,000 live births"
      },
      {
        "key": "wb_life_exp",
        "code": "SP.DYN.LE00.IN",
        "name": "Life expectancy at birth",
        "unit": "years"
      },
      {
        "key": "wb_health_spend",
        "code": "SH.XPD.CHEX.GD.ZS",
        "name": "Current health expenditure",
        "unit": "% of GDP"
      }
    ]
  },
  {
    "slug": "education",
    "title": "Ghana Education Dashboard",
    "intro": "School enrolment, adult literacy and public education spending, from the World Bank.",
    "series": [
      {
        "key": "wb_prim_enrol",
        "code": "SE.PRM.ENRR",
        "name": "Primary school enrolment (gross)",
        "unit": "%"
      },
      {
        "key": "wb_sec_enrol",
        "code": "SE.SEC.ENRR",
        "name": "Secondary school enrolment (gross)",
        "unit": "%"
      },
      {
        "key": "wb_literacy",
        "code": "SE.ADT.LITR.ZS",
        "name": "Adult literacy rate, 15+",
        "unit": "%"
      },
      {
        "key": "wb_edu_spend",
        "code": "SE.XPD.TOTL.GD.ZS",
        "name": "Government education expenditure",
        "unit": "% of GDP"
      }
    ]
  },
  {
    "slug": "living-standards",
    "title": "Ghana Living Standards Dashboard",
    "intro": "Poverty, drinking water, sanitation and electricity access, from the World Bank.",
    "series": [
      {
        "key": "wb_poverty_intl",
        "code": "SI.POV.DDAY",
        "name": "Poverty at $3.00 a day (2021 PPP)",
        "unit": "% of population"
      },
      {
        "key": "wb_poverty_nat",
        "code": "SI.POV.NAHC",
        "name": "Poverty at national poverty lines",
        "unit": "% of population"
      },
      {
        "key": "wb_water",
        "code": "SH.H2O.BASW.ZS",
        "name": "At least basic drinking water",
        "unit": "% of population"
      },
      {
        "key": "wb_sanitation",
        "code": "SH.STA.BASS.ZS",
        "name": "At least basic sanitation",
        "unit": "% of population"
      },
      {
        "key": "wb_elec_access",
        "code": "EG.ELC.ACCS.ZS",
        "name": "Access to electricity",
        "unit": "% of population"
      }
    ]
  }
];
export const getTopicDashboard = (slug: string) => TOPIC_DASHBOARDS.find((t) => t.slug === slug);
