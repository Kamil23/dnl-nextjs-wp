import { NextRequest, NextResponse } from "next/server";

// Protects /admin/* (except the login page). The cookie is an HMAC of a
// fixed message under ADMIN_SECRET — recompute it here (edge runtime) and
// compare with what the login endpoint issued.
async function expectedToken() {
  const secret = process.env.ADMIN_SECRET || "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("dnl-admin-session-v1")
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get("dnl_admin")?.value;
  if (!cookie || cookie !== (await expectedToken())) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
