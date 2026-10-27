
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { razorpay } from "@/lib/razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body?.orderId;

    if (
      typeof orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      return NextResponse.json(
        { error: "A valid order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total_inr, payment_status, razorpay_order_id")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      console.error("Order lookup failed:", error?.message);
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: "This order has already been paid." },
        { status: 409 }
      );
    }

    // Reuse the existing Razorpay order if the customer retries.
    if (order.razorpay_order_id) {
      return NextResponse.json({
        keyId: process.env.RAZORPAY_KEY_ID,
        razorpayOrderId: order.razorpay_order_id,
        amount: order.total_inr * 100,
        currency: "INR",
        receiptOrderId: order.id,
      });
    }

    const amount = order.total_inr * 100;

    if (!Number.isSafeInteger(amount) || amount < 100) {
      return NextResponse.json(
        { error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    const paymentOrder = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: order.id,
      notes: { supabase_order_id: order.id },
    });

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ razorpay_order_id: paymentOrder.id })
      .eq("id", order.id)
      .eq("payment_status", "pending");

    if (updateError) {
      console.error("Could not save Razorpay order ID:", updateError.message);
      return NextResponse.json(
        { error: "Could not link the payment to your order." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      receiptOrderId: order.id,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 500 }
    );
  }
}
