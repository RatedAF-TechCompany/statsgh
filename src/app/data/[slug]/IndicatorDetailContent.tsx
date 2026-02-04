"use client";

import IndicatorDetail from "@/views/IndicatorDetail";

interface IndicatorDetailContentProps {
  slug: string;
}

export default function IndicatorDetailContent({ slug }: IndicatorDetailContentProps) {
  return <IndicatorDetail />;
}
