// IndexNow (free): tells Bing, Yandex, Seznam, Naver etc. a URL changed. Google does not use it.
// The key file is served from /public/f70a60bf3e4b687b44870e6ce7d2b987.txt.
export const INDEXNOW_KEY = "f70a60bf3e4b687b44870e6ce7d2b987";

export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "www.statsgh.com",
        key: INDEXNOW_KEY,
        keyLocation: `https://www.statsgh.com/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    console.error("IndexNow ping failed", e); // never blocks publishing
  }
}
