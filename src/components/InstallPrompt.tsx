"use client";
import { useEffect, useState } from "react";

const KEY = "statsgh-install-dismissed";

/** Small "add to home screen" prompt (Android/desktop install event; iOS gets a how-to hint). */
export const InstallPrompt = () => {
  const [evt, setEvt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(KEY) || window.matchMedia("(display-mode: standalone)").matches) return;
    const h = (e: Event) => { e.preventDefault(); setEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && !(navigator as any).standalone) setTimeout(() => setIos(true), 8000);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt && !ios) return null;
  const close = () => { localStorage.setItem(KEY, "1"); setEvt(null); setIos(false); };
  return (
    <div role="dialog" aria-label="Install StatsGH" className="fixed bottom-3 left-3 right-3 md:left-auto md:w-[340px] z-50 bg-white border border-[#121212] shadow-lg p-3 font-ui text-[13px]">
      <p className="font-semibold mb-1">Add StatsGH to your home screen</p>
      <p className="text-[#5B5B5B] mb-2">{ios ? "Tap the Share button, then \u201cAdd to Home Screen\u201d." : "Open Ghana's numbers in one tap."}</p>
      <div className="flex gap-2">
        {evt && <button onClick={async () => { evt.prompt(); await evt.userChoice; close(); }} className="bg-[#E3120B] text-white font-semibold px-3 h-8">Install</button>}
        <button onClick={close} className="border border-[#D9D9D9] px-3 h-8">Not now</button>
      </div>
    </div>
  );
};
