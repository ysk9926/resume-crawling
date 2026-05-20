export const SESSION_COOKIE_NAME = "rw_session";

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/logout" ||
    pathname === "/auth/confirm"
  );
}
