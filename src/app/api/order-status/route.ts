
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (
      !orderId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        orderId
      )
    ) {
      return NextResponse.json(
        { error: "A valid order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, total_inr")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Order status lookup failed:", error.message);
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

    return NextResponse.json({
      orderId: order.id,
      paymentStatus: order.payment_status,
      totalInr: order.total_inr,
    });
  } catch (error) {
    console.error("Order status API failed:", error);
    return NextResponse.json(
      { error: "Could not check order status." },
      { status: 500 }
    );
  }
}
