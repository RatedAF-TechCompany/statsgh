import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const CANONICAL_ORIGIN = "https://statsgh.com";

/**
 * Sets a self-referencing canonical <link> tag on every route change.
 * Normalizes:
 *  - origin → https://statsgh.com (strips www, http)
 *  - removes query string and hash
 *  - removes trailing slash (except for root "/")
 */
export function useCanonical(overrideHref?: string) {
  const location = useLocation();

  useEffect(() => {
    let href = overrideHref;

    if (!href) {
      let path = location.pathname || "/";
      // Strip trailing slash unless root
      if (path.length > 1 && path.endsWith("/")) {
        path = path.replace(/\/+$/, "");
      }
      href = `${CANONICAL_ORIGIN}${path}`;
    }

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);

    // Keep og:url in sync (unless a page sets its own richer OG tags afterwards)
    let ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute("content", href);
  }, [location.pathname, overrideHref]);
}

/**
 * Component wrapper that mounts inside <BrowserRouter> to apply canonical
 * tags globally on every route change.
 */
export function CanonicalManager() {
  useCanonical();
  return null;
}
