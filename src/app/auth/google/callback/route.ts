import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/api/integrations/google-sheets/callback";
  return NextResponse.redirect(url);
}
