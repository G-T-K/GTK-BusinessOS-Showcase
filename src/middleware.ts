export { default } from "next-auth/middleware";

// Every route under these paths requires a signed-in session.
// Tenant scoping itself happens per-request in server code, using
// session.user.businessId — never trust a businessId passed from the client.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/inventory/:path*",
    "/sales/:path*",
    "/purchases/:path*",
    "/expenses/:path*",
    "/reports/:path*",
    "/copilot/:path*",
    "/settings/:path*",
    "/finance/:path*",
    "/payroll/:path*",
  ],
};
