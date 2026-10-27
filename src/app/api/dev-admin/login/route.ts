
import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSession,
  isLocalDevelopment,
} from "@/lib/dev-admin";

export async function POST(request: NextRequest) {
  if (!isLocalDevelopment(request)) {
    return NextResponse.json(
      { error: "Local development only." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const username = body?.username;
    const password = body?.password;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !process.env.DEV_ADMIN_USERNAME ||
      !process.env.DEV_ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    if (
      username !== process.env.DEV_ADMIN_USERNAME ||
      password !== process.env.DEV_ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const session = createAdminSession();
    const response = NextResponse.json({ success: true });

    response.cookies.set(session.name, session.value, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/",
      maxAge: session.maxAge,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
