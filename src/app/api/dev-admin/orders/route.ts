import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/dev-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";


export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (
    process.env.NODE_ENV !== "development" ||
    !["localhost:3000", "127.0.0.1:3000"].includes(host)
  ) {
    return NextResponse.json(
      { error: "Local development only." },
      { status: 403 }
    );
  }

  if (!hasAdminSession(request)) {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Admin orders fetch failed:", error.message);
      return NextResponse.json(
        { error: "Could not load orders." },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    console.error("Admin orders fetch failed:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

if (
  process.env.NODE_ENV !== "development" ||
  !["localhost:3000", "127.0.0.1:3000"].includes(host)
) {
  return NextResponse.json(
    { error: "Local development only." },
    { status: 403 }
  );
}

  if (!hasAdminSession(request)) {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const orderId = body?.orderId;

    // Validate the order ID before querying the database.
    if (
      typeof orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      return NextResponse.json(
        { error: "Invalid order ID." },
        { status: 400 }
      );
    }

    // Read the order first. Never delete a paid order.
    const { data: order, error: lookupError } = await supabaseAdmin
      .from("orders")
      .select("id, status, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (lookupError) {
      console.error("Order lookup failed:", lookupError.message);
      return NextResponse.json(
        { error: "Could not verify the order." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // Delete related items first because of the foreign-key constraint.
    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (itemsError) {
      console.error("Order items deletion failed:", itemsError.message);
      return NextResponse.json(
        { error: "Could not delete the order items." },
        { status: 500 }
      );
    }

// Delete only if the order is still unpaid.
// The paid-order check above protects confirmed payments.
const { data: deletedOrders, error: deleteError } = await supabaseAdmin
  .from("orders")
  .delete()
  .eq("id", orderId)
  .select("id");

    if (deleteError) {
      console.error("Order deletion failed:", deleteError.message);
      return NextResponse.json(
        { error: "Could not delete the order." },
        { status: 500 }
      );
    }

    if (!deletedOrders || deletedOrders.length === 0) {
      return NextResponse.json(
        {
          error:
            "Order was not deleted. It may have been paid or changed; check its status.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Unpaid order deleted.",
      orderId,
    });
  } catch (error) {
    console.error("Admin order deletion failed:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
