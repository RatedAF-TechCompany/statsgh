"use client";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/markets/MarketBits";
import { ContactForm } from "@/components/ContactForm";
import { NewsletterSignup } from "@/components/NewsletterSignup";

export const CONTACT_EMAIL = "officeofstatsgh@gmail.com";
const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-[#E3120B]">{CONTACT_EMAIL}</a>;
const Prose = ({ children }: { children: React.ReactNode }) => (
  <div className="font-serif text-[17px] leading-[1.75] text-[#121212] space-y-4 [&_h2]:kicker [&_h2]:pt-4 [&_ul]:list-disc [&_ul]:pl-6">{children}</div>
);

export const ContactPage = () => (
  <PageShell title="Contact StatsGH" intro="Questions, tips, data requests or corrections: we read every message.">
    <Prose>
      <p>Email: <Mail /></p>
      <p>To report an error in a story, include the article link and what you think is wrong. Corrections are listed on our <Link to="/corrections" className="underline text-[#E3120B]">Corrections page</Link>.</p>
    </Prose>
    <div className="border-t border-[#D9D9D9] mt-6 pt-6"><ContactForm kind="contact" /></div>
  </PageShell>
);

export const PrivacyPage = () => (
  <PageShell title="Privacy policy" intro="What we collect when you use StatsGH, and why.">
    <Prose>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Page views:</strong> when you read an article we record the article, the time, your browser type and the referring page. We use these records to count readers and rank Most Read stories. We do not use them to identify you.</li>
        <li><strong>Newsletter sign-ups:</strong> your email address and where you signed up. We use it only to send the StatsGH digest.</li>
        <li><strong>Contact and advertising forms:</strong> your name, email, any organisation and your message. We use these only to reply to you.</li>
        <li><strong>Comments:</strong> the name, email and text you submit with a comment.</li>
      </ul>
      <h2>What we do not do</h2>
      <p>We do not sell personal data. We do not share it with advertisers. Sponsors never receive reader lists.</p>
      <h2>Storage and access</h2>
      <p>Data is stored with our hosting provider. Only StatsGH administrators can read submitted personal data.</p>
      <h2>Your choices</h2>
      <p>To unsubscribe, or to ask us to see or delete your data, email <Mail />. We will act on requests within 30 days.</p>
    </Prose>
  </PageShell>
);

export const TermsPage = () => (
  <PageShell title="Terms of use" intro="The rules for using StatsGH content and data.">
    <Prose>
      <h2>Our content</h2>
      <p>StatsGH articles, charts and compilations are © StatsGH. You may quote short extracts and share links. You may also embed our charts using the embed codes we provide, as long as you credit StatsGH with a link.</p>
      <h2>Data</h2>
      <p>Figures shown on StatsGH come from the named official and published sources linked beside them. Each figure keeps its source's own terms. We work hard to reproduce figures accurately, but always check the original source before making financial decisions. Nothing on StatsGH is investment advice.</p>
      <h2>Accuracy and corrections</h2>
      <p>When we get something wrong we correct it visibly. See our <Link to="/corrections" className="underline text-[#E3120B]">Corrections page</Link> and <Link to="/editorial-standards" className="underline text-[#E3120B]">editorial standards</Link>.</p>
      <h2>Sponsored content</h2>
      <p>Paid content is always labelled "Sponsored". It is kept separate from our news reporting.</p>
      <h2>Acceptable use</h2>
      <p>Do not scrape the site at a rate that harms service. Do not misrepresent our content or post unlawful comments.</p>
      <h2>Contact</h2>
      <p><Mail /></p>
    </Prose>
  </PageShell>
);

export const AdvertisePage = () => (
  <PageShell title="Advertise with StatsGH" intro="Reach readers who follow Ghana's economy, markets and policy through numbers.">
    <Prose>
      <h2>Our audience</h2>
      <p>StatsGH readers follow the cedi, interest rates, inflation, company results and public finance. They include business owners, finance professionals, investors, students, policymakers and journalists in Ghana and the diaspora. Ask us for current traffic figures. We share real analytics rather than estimates.</p>
      <h2>Formats</h2>
      <ul>
        <li><strong>Sponsored articles:</strong> written with or for your organisation and published with a clear "Sponsored" label.</li>
        <li><strong>Newsletter sponsorship:</strong> a labelled sponsor slot in the StatsGH daily digest.</li>
        <li><strong>Display placements:</strong> banners on the homepage, section pages and articles.</li>
        <li><strong>Data partnerships:</strong> sponsorship of a tracker or dashboard, credited "Supported by".</li>
      </ul>
      <h2>Our rules</h2>
      <p>Sponsored content is <strong>always labelled "Sponsored"</strong> and never presented as news. Sponsors have no say over our editorial coverage. Statistics in sponsored content must be sourced, the same as in our own reporting.</p>
      <p>Email <Mail /> or use the form below.</p>
    </Prose>
    <div className="border-t border-[#D9D9D9] mt-6 pt-6"><ContactForm kind="advertise" /></div>
  </PageShell>
);

export const NewsletterPage = () => (
  <PageShell title="The StatsGH daily digest" intro="Ghana's key numbers in your inbox: the cedi, rates, inflation and the stories behind them.">
    <Prose>
      <p>One short email, with every figure sourced. Unsubscribe any time. We never share your address. See our <Link to="/privacy" className="underline text-[#E3120B]">privacy policy</Link>.</p>
    </Prose>
    <div className="max-w-[440px]"><NewsletterSignup source="newsletter-page" /></div>
  </PageShell>
);
