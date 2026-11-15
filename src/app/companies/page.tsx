export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import Companies from "@/views/Companies";
import { Prefetched } from "@/components/ssr/Prefetched";
import { fetchCompanies } from "@/lib/companiesData";
import { fetchLatestGse } from "@/lib/gse";

export const metadata = pageMeta("/companies", "Ghana Stock Exchange listed companies", "Profiles of every GSE-listed company: latest end-of-day share price, sector, and all StatsGH reporting on each company.");
export default function Page() {
  return (
    <Prefetched queries={[{ queryKey: ["companies"], queryFn: fetchCompanies }, { queryKey: ["gse-latest"], queryFn: fetchLatestGse }]}>
      <Companies />
    </Prefetched>
  );
}
