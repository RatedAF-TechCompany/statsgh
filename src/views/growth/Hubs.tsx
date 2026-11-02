"use client";
import { Link } from "react-router-dom";
import { ArticleHubList, PageShell, Prose, Section, UpdatesNote } from "./ArticleHub";
import { ContactForm } from "@/components/ContactForm";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { REGIONS, CENSUS_SOURCE } from "@/lib/regionsCensus";
import { DATASETS, LICENCE } from "@/lib/dataVault";
import { EMBED_SERIES } from "@/views/EmbedChart";

export const ExplainersPage = () => (
  <PageShell title="Explain this number" intro="Short explainers on the figures behind Ghana's economy: what a number measures, who publishes it and why it moves.">
    <ArticleHubList tags={["explainer", "explainers", "explain-this-number"]} titleTerms={["explainer", "explained", "what is ", "what are ", "how does ", "why does "]}
      empty="No explainers published yet. New explainers will appear here as they are published." />
    <Section title="Also useful"><Prose><p>Definitions of the terms we use are in the <Link to="/glossary">Glossary</Link>; sources and methods are on <Link to="/about#methodology">Data sources and methodology</Link>.</p></Prose></Section>
  </PageShell>
);

export const FactCheckPage = () => (
  <PageShell title="Claims vs data" intro="We test public claims about Ghana's economy against official figures, and show our sources.">
    <ArticleHubList tags={["fact-check", "factcheck", "claims-vs-data"]} titleTerms={["fact-check", "fact check", "claims vs data", "claim:"]}
      empty="No fact-checks published yet. Send us a claim below and an editor will look at it." />
    <Section title="How we check"><Prose><ul>
      <li>We quote the claim word for word and link to where it was made.</li>
      <li>We compare it with the latest official figure (Ghana Statistical Service, Bank of Ghana, Ministry of Finance, IMF, World Bank) and link to it.</li>
      <li>Mistakes are fixed and listed on our <Link to="/corrections">Corrections page</Link>.</li>
    </ul></Prose></Section>
    <Section title="Send a claim to check"><ContactForm kind="factcheck" /></Section>
  </PageShell>
);

export const ElectionsPage = () => (
  <PageShell title="Elections data hub" intro="StatsGH reporting on Ghana's elections, electoral data and campaign claims, in one place.">
    <UpdatesNote />
    <ArticleHubList tags={["election", "elections", "electoral-commission"]} titleTerms={["election", "electoral", "polling station", "voter register", "presidential primaries", "parliamentary primaries"]}
      empty="No election stories published yet. Stories will appear here as they are published." />
    <Section title="Check a campaign claim"><Prose><p>Heard a number on the campaign trail? <Link to="/fact-check">Send it to Claims vs data</Link>.</p></Prose></Section>
  </PageShell>
);

export const BudgetPage = () => (
  <PageShell title="Budget tracker" intro="Ghana's budget, mid-year review and public debt: our stories, with the data behind them.">
    <UpdatesNote />
    <Section title="The data"><Prose><ul>
      <li><Link to="/dashboards/budget-and-debt">Budget and debt dashboard</Link></li>
      <li><Link to="/data-vault/fiscal-and-debt">Fiscal and debt dataset</Link> (CSV and API)</li>
      <li><Link to="/data-vault/treasury-bill-rates">Treasury bill rates</Link></li>
    </ul></Prose></Section>
    <Section title="Stories">
      <ArticleHubList tags={["budget", "mid-year-review", "public-debt", "imf"]} titleTerms={["budget", "mid-year review", "public debt", "fiscal", "debt restructuring"]}
        empty="No budget stories published yet." />
    </Section>
  </PageShell>
);

const n = (x: number) => x.toLocaleString("en-GB");
export const RegionsPage = () => {
  const total10 = REGIONS.reduce((s, r) => s + r.pop2010, 0);
  const total21 = REGIONS.reduce((s, r) => s + r.pop2021, 0);
  const rows = [...REGIONS].sort((a, b) => b.pop2021 - a.pop2021);
  return (
    <PageShell wide title="Ghana's 16 regions in numbers" intro="Population of every region at the 2010 and 2021 censuses, and how fast each grew. More regional indicators will be added as official data is stored.">
      <div className="overflow-x-auto">
        <table className="w-full font-ui text-[14px] border-collapse">
          <thead><tr className="border-b-2 border-[#121212] text-left">
            <th className="py-2 pr-3">Region</th><th className="py-2 pr-3 text-right">2010 census</th><th className="py-2 pr-3 text-right">2021 census</th>
            <th className="py-2 pr-3 text-right">Change</th><th className="py-2 pr-3 text-right">Share of Ghana, 2021</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-[#D9D9D9]">
                <td className="py-2 pr-3 font-semibold">{r.name}{r.formerly && <span className="font-normal text-[12px] text-[#5B5B5B]"> (part of {r.formerly} in 2010)</span>}</td>
                <td className="py-2 pr-3 text-right">{n(r.pop2010)}</td>
                <td className="py-2 pr-3 text-right">{n(r.pop2021)}</td>
                <td className="py-2 pr-3 text-right">{(((r.pop2021 - r.pop2010) / r.pop2010) * 100).toFixed(1)}%</td>
                <td className="py-2 pr-3 text-right">{((r.pop2021 / total21) * 100).toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[#121212] font-bold">
              <td className="py-2 pr-3">Ghana</td><td className="py-2 pr-3 text-right">{n(total10)}</td><td className="py-2 pr-3 text-right">{n(total21)}</td>
              <td className="py-2 pr-3 text-right">{(((total21 - total10) / total10) * 100).toFixed(1)}%</td><td className="py-2 pr-3 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="font-ui text-[12px] text-[#5B5B5B] mt-3">Source: <a className="underline" href={CENSUS_SOURCE.gss}>Ghana Statistical Service</a>, 2010 and 2021 Population and Housing Census, regional totals as tabulated by <a className="underline" href={CENSUS_SOURCE.url}>citypopulation.de</a>. 2010 figures for the six regions created in 2018–19 are re-tabulated to today's boundaries. Change and share are StatsGH calculations.</p>
    </PageShell>
  );
};

export const WhatsAppPage = () => (
  <PageShell title="StatsGH on WhatsApp" intro="Ghana's key numbers on your phone: the cedi, fuel prices, inflation and big data releases.">
    <Prose><p>Our WhatsApp channel is being set up. Leave your email and we will tell you the moment it opens. Until then, get the same alerts by email or follow <a href="https://x.com/StatsGH">@StatsGH on X</a>.</p></Prose>
    <Section title="Tell me when it opens"><ContactForm kind="whatsapp" /></Section>
    <Section title="Or get the email digest"><NewsletterSignup /></Section>
  </PageShell>
);

export const SponsoredReportsPage = () => (
  <PageShell title="Sponsored data reports" intro="Commission an independent, data-led report on a Ghanaian sector, market or policy question.">
    <Prose>
      <h2>What you get</h2>
      <ul><li>A report built on official and verifiable data, with charts and a downloadable dataset.</li>
        <li>Publication on StatsGH and promotion to our readers.</li>
        <li>Clear labelling: every sponsored report says who paid for it.</li></ul>
      <h2>Our rules</h2>
      <ul><li>Sponsors do not approve findings or edit copy. StatsGH keeps full editorial control.</li>
        <li>We do not share reader data with sponsors.</li>
        <li>See our <Link to="/editorial-standards">editorial standards</Link> and <Link to="/advertise">advertising options</Link>.</li></ul>
    </Prose>
    <Section title="Enquire"><ContactForm kind="sponsored" /></Section>
  </PageShell>
);

export const FellowsPage = () => (
  <PageShell title="StatsGH data fellows" intro="A programme for university students in Ghana who want to report with data.">
    <Prose>
      <h2>What fellows do</h2>
      <ul><li>Find, clean and check official datasets for the <Link to="/data-vault">Data Vault</Link>.</li>
        <li>Research and co-write data stories with a StatsGH editor, with a byline credit.</li>
        <li>Learn verification: every number must trace to its source.</li></ul>
      <h2>Who can apply</h2>
      <p>Students on any course at a Ghanaian university with an interest in statistics, economics, journalism or computing. Remote-friendly.</p>
      <p>Applications are reviewed by the StatsGH editor. We reply to every applicant.</p>
    </Prose>
    <Section title="Apply"><ContactForm kind="fellowship" /></Section>
  </PageShell>
);

export const DevelopersPage = () => (
  <PageShell wide title="StatsGH data API" intro="Free, open access to the datasets in the StatsGH Data Vault, as JSON or CSV.">
    <Prose>
      <h2>Free tier</h2>
      <ul><li>No key needed. Limit: 60 requests a minute per IP address.</li>
        <li>Endpoint: <code>https://www.statsgh.com/api/data/&lt;dataset&gt;</code>; add <code>?format=csv</code> for CSV.</li>
        <li>Licence: <a href={LICENCE.url}>{LICENCE.name}</a>. Credit "{LICENCE.attribution}" and the original source.</li></ul>
    </Prose>
    <Section title="Datasets">
      <div className="overflow-x-auto"><table className="w-full font-ui text-[13px] border-collapse">
        <thead><tr className="border-b-2 border-[#121212] text-left"><th className="py-2 pr-3">Dataset</th><th className="py-2 pr-3">Source</th><th className="py-2 pr-3">Frequency</th><th className="py-2 pr-3">Endpoints</th></tr></thead>
        <tbody>{DATASETS.map((d) => (
          <tr key={d.slug} className="border-b border-[#D9D9D9] align-top">
            <td className="py-2 pr-3"><Link to={`/data-vault/${d.slug}`} className="font-semibold hover:text-[#E3120B]">{d.title}</Link></td>
            <td className="py-2 pr-3">{d.source}</td><td className="py-2 pr-3">{d.frequency}</td>
            <td className="py-2 pr-3 whitespace-nowrap"><a className="underline" href={`/api/data/${d.slug}`}>JSON</a> · <a className="underline" href={`/api/data/${d.slug}?format=csv`}>CSV</a></td>
          </tr>))}</tbody>
      </table></div>
    </Section>
    <Section title="Higher limits and bulk access">
      <Prose><p>Need more requests, webhooks or a service agreement? A paid tier is planned. Tell us what you need and we will reply.</p></Prose>
      <ContactForm kind="api" />
    </Section>
  </PageShell>
);

export const EmbedsPage = () => (
  <PageShell title="Embed StatsGH charts" intro="Put live StatsGH charts on your own site for free. Each chart credits StatsGH and its original source.">
    {Object.entries(EMBED_SERIES).map(([k, s]) => {
      const code = `<iframe src="https://www.statsgh.com/embed/${k}" width="100%" height="320" style="border:0" title="${s.title} — StatsGH" loading="lazy"></iframe>`;
      return (
        <Section key={k} title={s.title}>
          <iframe src={`/embed/${k}`} width="100%" height="320" style={{ border: "1px solid #D9D9D9" }} title={`${s.title} — StatsGH`} loading="lazy" />
          <p className="font-ui text-[12px] text-[#5B5B5B] mt-2">Source: {s.source}. Copy this code:</p>
          <textarea readOnly value={code} className="w-full font-mono text-[12px] border border-[#D9D9D9] p-2 h-16" onFocus={(e) => e.currentTarget.select()} />
        </Section>
      );
    })}
    <Section title="Data, not just charts"><Prose><p>Download the underlying data from the <Link to="/data-vault">Data Vault</Link> or use the <Link to="/developers">free API</Link>.</p></Prose></Section>
  </PageShell>
);
