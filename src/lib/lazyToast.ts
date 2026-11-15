// Drop-in for `import { toast } from "sonner"` in components that ship on public pages.
// sonner (~9 KB gz) loads on the first toast instead of in every page's initial JS; the
// <Sonner /> container itself mounts at idle (app/providers.tsx).
type Msg = Parameters<typeof import("sonner").toast.success>[0];
type Opts = Parameters<typeof import("sonner").toast.success>[1];
const call = (kind: "success" | "error" | "info" | "message", m: Msg, o?: Opts) => {
  void import("sonner").then((s) => s.toast[kind](m, o));
};
export const toast = {
  success: (m: Msg, o?: Opts) => call("success", m, o),
  error: (m: Msg, o?: Opts) => call("error", m, o),
  info: (m: Msg, o?: Opts) => call("info", m, o),
  message: (m: Msg, o?: Opts) => call("message", m, o),
};
