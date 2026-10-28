
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasAdminSession } from "@/lib/dev-admin";



function isAllowedLocalRequest(request: NextRequest): boolean {
  const host = request.headers.get("host");

  return (
    process.env.NODE_ENV === "development" &&
    (host === "localhost:3000" || host === "127.0.0.1:3000")
  );
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// GET: Fetch orders for the local development admin dashboard.
export async function GET(request: NextRequest) {
  if (!isAllowedLocalRequest(request) || !hasAdminSession(request)) {
    return NextResponse.json(
      { error: "Unauthorized access." },
      { status: 403 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          unit_price_inr,
          quantity
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch admin orders:", error.message);

      return NextResponse.json(
        { error: "Unable to fetch orders." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { orders: orders ?? [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Admin orders GET error:", error);

    return NextResponse.json(
      { error: "An internal server error occurred." },
      { status: 500 }
    );
  }
}

// DELETE: Temporarily disabled until secure, atomic deletion is implemented.
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Order deletion is temporarily disabled while secure deletion is implemented.",
    },
    { status: 403 }
  );
}
