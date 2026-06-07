import { useEffect } from "react";

interface PageMeta {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: object | object[];
  robots?: string;
}

function setMeta(selector: string, attr: string, value: string, create: () => HTMLElement) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/**
 * Sets dynamic <title>, description, OG tags, and optional JSON-LD per route.
 * Use alongside CanonicalManager (which handles canonical + og:url).
 */
export function usePageMeta(meta: PageMeta) {
  const { title, description, ogTitle, ogDescription, ogImage, ogType, jsonLd } = meta;

  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      setMeta('meta[name="description"]', "content", description, () => {
        const m = document.createElement("meta");
        m.setAttribute("name", "description");
        return m;
      });
    }

    const finalOgTitle = ogTitle || title;
    if (finalOgTitle) {
      setMeta('meta[property="og:title"]', "content", finalOgTitle, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:title");
        return m;
      });
      setMeta('meta[name="twitter:title"]', "content", finalOgTitle, () => {
        const m = document.createElement("meta");
        m.setAttribute("name", "twitter:title");
        return m;
      });
    }

    const finalOgDesc = ogDescription || description;
    if (finalOgDesc) {
      setMeta('meta[property="og:description"]', "content", finalOgDesc, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:description");
        return m;
      });
      setMeta('meta[name="twitter:description"]', "content", finalOgDesc, () => {
        const m = document.createElement("meta");
        m.setAttribute("name", "twitter:description");
        return m;
      });
    }

    if (ogImage) {
      setMeta('meta[property="og:image"]', "content", ogImage, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:image");
        return m;
      });
      setMeta('meta[name="twitter:image"]', "content", ogImage, () => {
        const m = document.createElement("meta");
        m.setAttribute("name", "twitter:image");
        return m;
      });
    }

    if (ogType) {
      setMeta('meta[property="og:type"]', "content", ogType, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", "og:type");
        return m;
      });
    }

    // JSON-LD injected per-route, removed on unmount/change
    const addedScripts: HTMLScriptElement[] = [];
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((data) => {
        const s = document.createElement("script");
        s.type = "application/ld+json";
        s.dataset.dynamic = "true";
        s.text = JSON.stringify(data);
        document.head.appendChild(s);
        addedScripts.push(s);
      });
    }

    return () => {
      addedScripts.forEach((s) => s.remove());
    };
  }, [title, description, ogTitle, ogDescription, ogImage, ogType, JSON.stringify(jsonLd)]);
}
