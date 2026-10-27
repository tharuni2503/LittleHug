
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  isLocalDevelopment,
} from "@/lib/dev-admin";

export async function POST(request: NextRequest) {
  if (!isLocalDevelopment(request)) {
    return NextResponse.json(
      { error: "Local development only." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}
