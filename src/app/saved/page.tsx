import { Metadata } from "next";
import Saved from "@/views/Saved";

export const metadata: Metadata = {
  title: "Saved Articles - StatsGH",
  description: "Your saved articles on StatsGH.",
};

export default function SavedPage() {
  return <Saved />;
}
