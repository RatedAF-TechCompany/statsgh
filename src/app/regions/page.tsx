import { pageMeta } from "@/lib/pageMeta";
import { RegionsPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/regions", "Ghana's 16 regions in numbers", "Population of each of Ghana's 16 regions at the 2010 and 2021 censuses, growth and share, from the Ghana Statistical Service.");
export default function Page() { return <RegionsPage />; }
