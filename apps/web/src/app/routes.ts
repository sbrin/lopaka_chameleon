export type AppRoute = "create" | "play";

export const defaultRoute: AppRoute = "play";

export function routeFromPathname(pathname: string): AppRoute {
  return pathname === "/create" ? "create" : defaultRoute;
}
