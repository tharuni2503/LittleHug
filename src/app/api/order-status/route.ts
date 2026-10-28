
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    const accessToken = url.searchParams.get("accessToken");
    try {
    if (
      !orderId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        orderId
      ) ||
      !accessToken ||
      !/^[a-f0-9]{64}$/i.test(accessToken)
    ) {
      return NextResponse.json(
        { error: "A valid order ID and access token are required." },
        { status: 400 }
      );
    }

    const accessTokenHash = createHash("sha256")
      .update(accessToken)
      .digest("hex");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, total_inr, access_token_hash")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Order status lookup failed:", error.message);

      return NextResponse.json(
        { error: "Could not verify the order." },
        { status: 500 }
      );
    }

    if (!order || !order.access_token_hash) {
      return NextResponse.json(
        { error: "Order not found or access denied." },
        { status: 404 }
      );
    }

    const storedHash = order.access_token_hash;

    if (!/^[a-f0-9]{64}$/i.test(storedHash)) {
      console.error("Stored order access token hash is invalid.");

      return NextResponse.json(
        { error: "Could not verify the order." },
        { status: 500 }
      );
    }

    const suppliedBuffer = Buffer.from(accessTokenHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (
      suppliedBuffer.length !== storedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, storedBuffer)
    ) {
      return NextResponse.json(
        { error: "Order not found or access denied." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        orderId: order.id,
        paymentStatus: order.payment_status,
        totalInr: order.total_inr,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Order status API failed:", error);

    return NextResponse.json(
      { error: "Could not check order status." },
      { status: 500 }
    );
  }
}
