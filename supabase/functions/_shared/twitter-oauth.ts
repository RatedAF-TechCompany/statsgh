// Shared OAuth 1.0a helper for posting to X. Extracted from hourly-tweet-poster
// so every tweet-posting function signs requests identically.

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

async function createOAuthSignature(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): Promise<string> {
  const sortedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const base = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export interface TwitterCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export function loadTwitterCredentials(): TwitterCredentials | null {
  const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
  const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
  const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) return null;
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
}

export interface PostTweetResult {
  ok: boolean;
  status: number;
  tweetId?: string;
  raw: unknown;
}

export async function postTweet(text: string, creds: TwitterCredentials): Promise<PostTweetResult> {
  const url = "https://api.x.com/2/tweets";
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const signature = await createOAuthSignature(
    "POST",
    url,
    oauthParams,
    creds.consumerSecret,
    creds.accessTokenSecret,
  );
  const authHeader = "OAuth " +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ");

  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const raw = await resp.json().catch(() => ({}));
  const tweetId = (raw as any)?.data?.id ?? undefined;
  return { ok: resp.ok, status: resp.status, tweetId, raw };
}
