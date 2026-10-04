import { SITE_SECTIONS } from "@/lib/navigation";
import { Link } from "react-router-dom";
import { X_URL, X_HANDLE, WHATSAPP_CHANNEL_URL } from "@/lib/social";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { ChannelButtons } from "@/components/ChannelButtons";

const Footer = () => {
  return (
    <footer className="bg-white border-t border-[#D9D9D9]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* About */}
          <div>
            <h3 className="kicker mb-4">About StatsGH</h3>
            <p className="font-serif text-[15px] text-[#5B5B5B] leading-[1.6]">
              Ghana's premier data journalism platform. We retell the story with
              numbers openly sourced in Ghanaian news, providing accurate,
              data-driven reporting on Ghana's economy, markets, and public
              policy.
            </p>
            <ul className="mt-4 space-y-2">
              <li><Link to="/about" className="font-ui text-[13px] text-[#E3120B] hover:underline">About &amp; Methodology</Link></li>
              <li><Link to="/corrections" className="font-ui text-[13px] text-[#E3120B] hover:underline">Corrections</Link></li>
              <li><Link to="/contact" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">Contact</Link></li>
              <li><Link to="/advertise" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">Advertise</Link></li>
              <li><Link to="/newsletter" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">Newsletter</Link></li>
              <li><Link to="/privacy" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">Privacy</Link></li>
              <li><Link to="/terms" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">Terms</Link></li>
              <li><Link to="/glossary" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">Glossary</Link></li>
              <li><Link to="/editorial-standards" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">Editorial standards</Link></li>
              <li><a href="/feed.xml" className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B]">RSS feed</a></li>
            </ul>
            <NewsletterSignup source="footer" />
          </div>

          {/* Sections */}
          <div>
            <h3 className="kicker mb-4">Sections</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {SITE_SECTIONS.map((section) => (
                <li key={section.slug}>
                  <Link
                    to={section.href}
                    className="font-ui text-[13px] text-[#5B5B5B] hover:text-[#E3120B] transition-colors"
                  >
                    {section.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Data Sources */}
          <div>
            <h3 className="kicker mb-4">Data Sources</h3>
            <ul className="space-y-2">
              {[
                "World Bank",
                "International Monetary Fund",
                "Bank of Ghana",
                "Ghana Statistical Service",
                "Ghana Stock Exchange",
              ].map((source) => (
                <li key={source} className="font-ui text-[13px] text-[#5B5B5B]">
                  {source}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-[#D9D9D9]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-ui text-[12px] text-[#757575]">
            © 2026 StatsGH. Accuracy is our policy.
          </p>
          <div className="text-[#E3120B]"><ChannelButtons /></div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
