import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Users,
  Database,
  Globe,
  Scale,
} from "lucide-react";

const EditorialStandards = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <header className="mb-10">
          <Badge variant="default" className="mb-3">Standards</Badge>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            Editorial Standards
          </h1>
          <p className="text-muted-foreground text-lg">
            How StatsGH selects, verifies, and publishes data-driven news about Ghana's economy.
          </p>
        </header>

        <div className="prose prose-sm max-w-none space-y-8">
          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <Shield size={20} className="text-primary" />
                Our Mission
              </h2>
              <p className="text-muted-foreground">
                StatsGH exists to make Ghana's economic and social data accessible, understandable, 
                and actionable. We believe that informed citizens make better decisions, and that 
                data transparency strengthens democratic accountability.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <CheckCircle size={20} className="text-primary" />
                How We Select Stories
              </h2>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li><strong>Data-first</strong>: Every story must contain at least one verifiable statistic or data point relevant to Ghana.</li>
                <li><strong>Ghana relevance</strong>: Content must directly concern Ghana's economy, policy, markets, or social indicators.</li>
                <li><strong>Source credibility</strong>: We prioritise official sources — GSS, Bank of Ghana, World Bank, IMF, NPA, COCOBOD.</li>
                <li><strong>Timeliness</strong>: News is processed within 72 hours of publication by the original source.</li>
                <li><strong>No opinion as news</strong>: Opinion and editorial content is clearly labelled and separated from data reporting.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <Database size={20} className="text-primary" />
                Data Verification
              </h2>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li><strong>Primary sources</strong>: All indicator data is sourced from official statistical agencies and central banks.</li>
                <li><strong>Cross-referencing</strong>: Key figures are cross-checked against multiple sources (e.g., World Bank vs. GSS).</li>
                <li><strong>Provenance tracking</strong>: Every data point on StatsGH links back to its source institution and methodology.</li>
                <li><strong>Estimate labels</strong>: Provisional and estimated figures are clearly tagged — never presented as final.</li>
                <li><strong>Corrections policy</strong>: When we publish an error, we issue a transparent correction with the original and corrected values.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <BookOpen size={20} className="text-primary" />
                Content Processing
              </h2>
              <p className="text-muted-foreground mb-3">
                StatsGH uses AI-assisted restructuring to make complex economic reporting accessible:
              </p>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li><strong>Plain language</strong>: Articles are rewritten in clear, simple English with technical terms explained in brackets.</li>
                <li><strong>Key Numbers section</strong>: Every article includes a highlighted section with the most important statistics.</li>
                <li><strong>Attribution</strong>: Original author names and source publications are always preserved and credited.</li>
                <li><strong>No fabrication</strong>: AI is used for restructuring only — never for inventing facts, quotes, or statistics.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <Globe size={20} className="text-primary" />
                Our Data Sources
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div className="p-3 border rounded-lg">
                  <p className="font-semibold text-foreground">Ghana Statistical Service</p>
                  <p>CPI, GDP, population, employment</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-semibold text-foreground">Bank of Ghana</p>
                  <p>Policy rate, reserves, exchange rates</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-semibold text-foreground">World Bank</p>
                  <p>Development indicators, poverty data</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-semibold text-foreground">IMF</p>
                  <p>Economic projections, debt sustainability</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-semibold text-foreground">National Petroleum Authority</p>
                  <p>Fuel prices, petroleum data</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-semibold text-foreground">COCOBOD</p>
                  <p>Cocoa prices, production data</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <Scale size={20} className="text-primary" />
                Independence & Conflicts of Interest
              </h2>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>StatsGH is editorially independent and not affiliated with any political party, government body, or corporate interest.</li>
                <li>Sponsored content, if any, is clearly labelled and separated from editorial content.</li>
                <li>Data is never adjusted or selectively presented to favour any political or commercial narrative.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <AlertTriangle size={20} className="text-primary" />
                Complaints & Corrections
              </h2>
              <p className="text-muted-foreground">
                If you believe we have published inaccurate data or misleading content, please 
                contact us at{" "}
                <a href="mailto:corrections@statsgh.com" className="text-primary hover:underline">
                  corrections@statsgh.com
                </a>. 
                We commit to reviewing complaints within 48 hours and publishing corrections 
                where warranted. All corrections are noted at the top of the affected article.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold mb-3 !mt-0">
                <Users size={20} className="text-primary" />
                Comments Policy
              </h2>
              <p className="text-muted-foreground">
                Comments on StatsGH require email verification to prevent spam and abuse. 
                We welcome constructive debate and data-driven discussion. Comments containing 
                hate speech, personal attacks, or misinformation will be removed.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default EditorialStandards;
