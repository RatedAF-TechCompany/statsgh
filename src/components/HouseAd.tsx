import { HOUSE_AD_HTML } from "@/lib/house-ad";
export default function HouseAd() {
  return <div dangerouslySetInnerHTML={{ __html: HOUSE_AD_HTML }} />;
}
