// Official StatsGH social handles and follow links.
// WHATSAPP_CHANNEL_URL: paste the real WhatsApp Channel invite link (https://whatsapp.com/channel/...)
// once Zeb creates the channel, or set NEXT_PUBLIC_WHATSAPP_CHANNEL_URL at build time.
// While empty, every "Follow on WhatsApp" button stays hidden.
export const X_URL = "https://x.com/StatsGH";
export const X_HANDLE = "@StatsGH";
export const WHATSAPP_CHANNEL_URL = process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_URL || "";
// Google's documented deeplink for adding a site as a preferred source in Top Stories.
// https://developers.google.com/search/docs/appearance/preferred-sources
export const GOOGLE_PREFERRED_SOURCE_URL = "https://www.google.com/preferences/source?q=statsgh.com";
