"use client";

/**
 * Compatibility shim that maps the small surface of `react-router-dom` used
 * across the app onto Next.js' App Router primitives. `react-router-dom` is
 * aliased to this module in next.config.mjs, so existing components keep
 * working unchanged during the migration.
 *
 * Only the APIs actually used in the codebase are implemented:
 * Link, NavLink, useNavigate, useParams, useLocation, useSearchParams, Navigate.
 */

import * as React from "react";
import NextLink from "next/link";
import {
  useRouter,
  usePathname,
  useParams as useNextParams,
  useSearchParams as useNextSearchParams,
} from "next/navigation";

type To = string;

// --- useNavigate -----------------------------------------------------------
export function useNavigate() {
  const router = useRouter();
  return React.useCallback(
    (to: To | number, opts?: { replace?: boolean }) => {
      if (typeof to === "number") {
        // react-router navigate(-1) style
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      if (opts?.replace) router.replace(to);
      else router.push(to);
    },
    [router]
  );
}

// --- useParams -------------------------------------------------------------
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const params = useNextParams();
  // Next returns string | string[]; flatten arrays to first value to match RR.
  const flat: Record<string, string | undefined> = {};
  for (const key in params) {
    const v = (params as Record<string, string | string[]>)[key];
    flat[key] = Array.isArray(v) ? v[0] : v;
  }
  return flat as T;
}

// --- useLocation -----------------------------------------------------------
export function useLocation() {
  const pathname = usePathname() || "/";
  const searchParams = useNextSearchParams();
  const search = searchParams && searchParams.toString() ? `?${searchParams.toString()}` : "";
  return {
    pathname,
    search,
    hash: "",
    state: null as unknown,
    key: "default",
  };
}

// --- useSearchParams -------------------------------------------------------
// react-router returns [URLSearchParams, setSearchParams]
export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams), opts?: { replace?: boolean }) => void
] {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const nextParams = useNextSearchParams();
  const current = new URLSearchParams(nextParams ? nextParams.toString() : "");

  const setSearchParams = React.useCallback(
    (
      next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams),
      opts?: { replace?: boolean }
    ) => {
      let resolved: URLSearchParams;
      if (typeof next === "function") {
        resolved = next(new URLSearchParams(current.toString()));
      } else if (next instanceof URLSearchParams) {
        resolved = next;
      } else {
        resolved = new URLSearchParams(next);
      }
      const qs = resolved.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts?.replace) router.replace(url);
      else router.push(url);
    },
    [router, pathname, current]
  );

  return [current, setSearchParams];
}

// --- Link ------------------------------------------------------------------
type LinkProps = Omit<React.ComponentProps<typeof NextLink>, "href"> & {
  to: To;
  replace?: boolean;
  state?: unknown;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, state, replace, ...rest }, ref) => {
    return <NextLink ref={ref} href={to} replace={replace} {...rest} />;
  }
);
Link.displayName = "Link";

// --- NavLink ---------------------------------------------------------------
export type NavLinkProps = Omit<React.ComponentProps<typeof NextLink>, "href" | "className" | "style"> & {
  to: To;
  end?: boolean;
  replace?: boolean;
  className?: string | ((props: { isActive: boolean }) => string);
  style?: React.CSSProperties | ((props: { isActive: boolean }) => React.CSSProperties);
  children?: React.ReactNode | ((props: { isActive: boolean }) => React.ReactNode);
};

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, end, className, style, children, replace, ...rest }, ref) => {
    const pathname = usePathname() || "/";
    const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
    const resolvedClassName = typeof className === "function" ? className({ isActive }) : className;
    const resolvedStyle = typeof style === "function" ? style({ isActive }) : style;
    const resolvedChildren = typeof children === "function" ? children({ isActive }) : children;
    return (
      <NextLink ref={ref} href={to} replace={replace} className={resolvedClassName} style={resolvedStyle} {...rest}>
        {resolvedChildren}
      </NextLink>
    );
  }
);
NavLink.displayName = "NavLink";

// --- Navigate --------------------------------------------------------------
export function Navigate({ to, replace }: { to: To; replace?: boolean }) {
  const router = useRouter();
  React.useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}

// --- Outlet (no-op passthrough; App Router handles nesting via layouts) -----
export function Outlet() {
  return null;
}
