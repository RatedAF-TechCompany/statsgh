"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-16 text-center">
        <h1 className="font-serif text-4xl font-semibold text-foreground mb-4">
          404
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Return to Homepage</Link>
        </Button>
      </main>
    </div>
  );
}
