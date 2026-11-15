"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchCorrectionsLog } from "@/lib/correctionsLog";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const Corrections = () => {
  const { data: corrections, isLoading } = useQuery({ queryKey: ["corrections-log"], queryFn: fetchCorrectionsLog });

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header />
      <main className="max-w-[680px] mx-auto px-4 py-8 lg:py-12">
        <span className="section-label mb-3 inline-block">Transparency</span>
        <h1 className="font-headline text-[32px] md:text-[38px] font-bold leading-[1.15] text-[#121212] mb-4">
          Corrections &amp; Clarifications
        </h1>
        <p className="font-ui text-sm text-[#5B5B5B] mt-2 mb-4">Chief Editor: <a href="/authors/hawa-kokonu" className="underline hover:text-[#E3120B]">Hawa Kokonu</a>. Research Editor: <a href="/authors/zebrilla-najib" className="underline hover:text-[#E3120B]">Zebrilla Najib</a>. Stories carry the byline of the desk journalist who wrote them; research articles carry Zebrilla Najib's byline, and other stories are credited to Abubakar Saddique, StatsGH's in-house data journalist.</p>
        <p className="font-serif text-[17px] leading-[1.75] text-[#3B3B3B] mb-3">
          StatsGH corrects errors promptly and visibly. When we get something wrong, we fix the
          article and record the correction on the article and in this log, newest first.
        </p>
        <p className="font-ui text-[13px] text-[#5B5B5B] mb-10">
          Spot an error? Email{" "}
          <a href="mailto:Officeofnajib@gmail.com?subject=Correction%20request" className="text-[#E3120B] hover:underline">
            Officeofnajib@gmail.com
          </a>{" "}
          or see our <Link to="/about#corrections" className="text-[#E3120B] hover:underline">corrections policy</Link>.
        </p>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-28 w-full skeleton-ft" />
            <Skeleton className="h-28 w-full skeleton-ft" />
          </div>
        ) : !corrections || corrections.length === 0 ? (
          <div className="border-t border-b border-[#D9D9D9] py-10 text-center">
            <p className="font-ui text-[15px] text-[#5B5B5B]">No corrections yet.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {corrections.map((c) => (
              <article key={c.id} className="border-t border-[#D9D9D9] py-6">
                <div className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#5B5B5B] mb-2">
                  Corrected {format(new Date(c.date), "d MMMM yyyy")}
                </div>
                <h2 className="font-headline text-lg font-bold text-[#121212] mb-3">
                  <Link to={c.articleUrl} className="hover:text-[#E3120B] hover:underline">
                    {c.articleTitle}
                  </Link>
                </h2>
                <div className="space-y-2 font-serif text-[15px] leading-[1.7] text-[#3B3B3B]">
                  {c.summary ? (
                    <p>{c.summary}</p>
                  ) : (
                    <>
                      <p>
                        <span className="font-ui text-xs font-bold uppercase tracking-[0.1em] text-[#E3120B]">What was wrong: </span>
                        {c.wrong}
                      </p>
                      <p>
                        <span className="font-ui text-xs font-bold uppercase tracking-[0.1em] text-[#121212]">What it now says: </span>
                        {c.fixed}
                      </p>
                    </>
                  )}
                </div>
              </article>
            ))}
            <div className="border-t border-[#D9D9D9]" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Corrections;
