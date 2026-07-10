import calabasheAd from "@/assets/calabashe-ad.png";

const CalabasheAdBanner = () => (
  <div className="my-8">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 text-center">
      Advertisement
    </p>
    <a
      href="https://calabashe.com"
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="block"
    >
      <img
        src={calabasheAd.src}
        alt="Got a Ghanaian doctor you'd recommend for others? Leave a review on Calabashe.com"
        className="w-full max-w-2xl mx-auto rounded-md"
      />
    </a>
  </div>
);

export default CalabasheAdBanner;
