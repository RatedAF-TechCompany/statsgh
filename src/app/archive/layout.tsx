import { Header } from "@/components/Header";
import Footer from "@/components/Footer";

// Archive pages are public listings. Refresh at most every two minutes, and
// /api/revalidate drops the cache for the affected day when a story publishes.
export const revalidate = 120;

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header />
      <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-10">{children}</main>
      <Footer />
    </div>
  );
}
