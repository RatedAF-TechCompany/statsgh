export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import Deals from "@/views/Deals";

export const metadata = pageMeta("/deals", "Ghana deals tracker: M&A, bonds, IPOs and capital raises", "Corporate deals, mergers and acquisitions, bond and Eurobond issues, IPOs, capital raises and large contracts reported by StatsGH, with filters and CSV.");
export default function Page() { return <Deals />; }
