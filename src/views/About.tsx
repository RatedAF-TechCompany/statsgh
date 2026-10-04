"use client";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "officeofstatsgh@gmail.com";

const Section = ({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="py-6 border-t border-[#D9D9D9] scroll-mt-32">
    <h2 className="kicker mb-3">{title}</h2>
    <div className="font-serif text-[17px] leading-[1.75] text-[#121212] space-y-4">{children}</div>
  </section>
);

const About = () => (
  <div className="min-h-screen bg-white">
    <Header />
    <main className="max-w-[760px] mx-auto px-4 md:px-6 py-8">
      <div className="border-b border-[#E3120B] pb-3 mb-2">
        <h1 className="section-label text-base">About &amp; Methodology</h1>
      </div>
      <p className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] py-4">
        StatsGH is a Ghana data-journalism site. Every story we publish is built around a real, sourced
        statistic, and links to where that number came from.
      </p>

      <Section id="methodology" title="Data sources and methodology">
        <p>
          Our stories start from reporting by Ghanaian news outlets and from primary publishers: the Bank of
          Ghana, the Ghana Statistical Service, the Ministry of Finance, the Ghana Stock Exchange, regulators,
          courts and international bodies such as the IMF and World Bank.
        </p>
        <p>
          Market figures on the site come from named feeds. Each one shows its source and the date it refers
          to. Exchange rates come from ExchangeRate-API. Brent and WTI oil prices are U.S. EIA figures and cocoa
          is the IMF monthly price, both published via FRED. If a feed is unavailable, we say so instead of
          showing an estimate.
        </p>
        <p>
          Official Bank of Ghana rates, Ghana Stock Exchange end-of-day prices, World Bank and IMF series are
          stored with their source link and date. You can browse and download every dataset in
          our <Link to="/data-vault" className="text-[#E3120B] hover:underline">Data Vault</Link>, and read the
          automatically compiled <Link to="/reports" className="text-[#E3120B] hover:underline">reports</Link> built from them.
        </p>
      </Section>

      <Section title="How we verify">
        <p>Before a story is published it must pass checks that:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>it contains at least one current, substantive statistic that measures the news itself. Dates, times, durations and edition numbers don't count;</li>
          <li>the story is about Ghana or has a clear Ghanaian impact;</li>
          <li>it is not a duplicate of an event we have already covered. A genuine update with new figures is published as an update;</li>
          <li>it links to the original source.</li>
        </ul>
        <p>
          The numbers in a story's &ldquo;Key numbers&rdquo; box are taken from the story itself and are shown only when real
          statistics are present. See also our <Link to="/editorial-standards" className="text-[#E3120B] hover:underline">editorial standards</Link>.
        </p>
      </Section>

      <Section id="corrections" title="Corrections policy">
        <p>
          If we get something wrong, we correct it promptly and openly. Corrected stories carry a note saying what
          changed and when. We don&rsquo;t quietly edit numbers. If a story can&rsquo;t be corrected because its central figure
          was wrong, we remove it and say so.
        </p>
        <p>
          To report an error, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}?subject=Correction%20request`} className="text-[#E3120B] hover:underline">{CONTACT_EMAIL}</a>{" "}
          with the story link, the figure in question and, if possible, the correct source.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          General enquiries, tips and corrections:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#E3120B] hover:underline">{CONTACT_EMAIL}</a>.
          On X: <a href="https://twitter.com/StatsGH" target="_blank" rel="noopener noreferrer" className="text-[#E3120B] hover:underline">@StatsGH</a>.
          Experts can submit analysis through our <Link to="/submit" className="text-[#E3120B] hover:underline">submission form</Link>.
        </p>
      </Section>
    </main>
    <Footer />
  </div>
);

export default About;
