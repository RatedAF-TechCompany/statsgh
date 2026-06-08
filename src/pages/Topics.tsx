import { Header } from "@/components/Header";
import TopicsOverview from "@/components/TopicsOverview";
import { usePageMeta } from "@/hooks/usePageMeta";

const Topics = () => {
  usePageMeta({
    title: "Topics — Explore Data and Research | StatsGH",
    description:
      "Browse StatsGH coverage by topic: economy, markets, energy, agriculture, demographics, politics, and more. Data-driven reporting on Ghana.",
    ogType: "website",
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-6">
          Explore Data and Research by Topic
        </h1>
        <TopicsOverview showHeader={true} />
      </main>
    </div>
  );
};

export default Topics;
