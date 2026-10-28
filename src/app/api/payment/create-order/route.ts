
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { razorpay } from "@/lib/razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body?.orderId;

    if (
      typeof orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        orderId
      )
    ) {
      return NextResponse.json(
        { error: "A valid order ID is required." },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;

    if (!keyId) {
      console.error("RAZORPAY_KEY_ID is not configured.");

      return NextResponse.json(
        { error: "Payment configuration is missing." },
        { status: 500 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, total_inr, payment_status, razorpay_order_id, stock_reserved, reservation_expires_at"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Order lookup failed:", error.message);

      return NextResponse.json(
        { error: "Could not load your order." },
        { status: 500 }
      );
    }

    if (!order) {
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

    // Only start payment for a valid, active stock reservation.
    if (
      order.payment_status !== "pending" ||
      order.stock_reserved !== true ||
      !order.reservation_expires_at ||
      new Date(order.reservation_expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "Your stock reservation has expired. Please start a new order.",
        },
        { status: 409 }
      );
    }

    const amount = order.total_inr * 100;

    if (
      !Number.isSafeInteger(order.total_inr) ||
      !Number.isSafeInteger(amount) ||
      amount < 100
    ) {
      return NextResponse.json(
        { error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    // Reuse an existing Razorpay order when available.
    if (order.razorpay_order_id) {
      try {
        const existingPaymentOrder = await razorpay.orders.fetch(
          order.razorpay_order_id
        );

        if (
          existingPaymentOrder.amount !== amount ||
          existingPaymentOrder.currency !== "INR" ||
          existingPaymentOrder.receipt !== order.id
        ) {
          console.error("Existing Razorpay order details do not match.");

          return NextResponse.json(
            { error: "Could not validate the existing payment order." },
            { status: 409 }
          );
        }

        return NextResponse.json({
          keyId,
          razorpayOrderId: existingPaymentOrder.id,
          amount: existingPaymentOrder.amount,
          currency: existingPaymentOrder.currency,
          receiptOrderId: order.id,
        });
      } catch (error) {
        console.error("Could not retrieve existing Razorpay order:", error);

        return NextResponse.json(
          {
            error:
              "Could not retrieve your existing payment order. Please try again.",
          },
          { status: 502 }
        );
      }
    }

    // Create a Razorpay order using the amount stored in Supabase.
    const paymentOrder = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: order.id,
      notes: {
        supabase_order_id: order.id,
      },
    });

    // Save the Razorpay order ID only while this reservation is still valid.
    const { data: updatedOrder, error: updateError } =
      await supabaseAdmin
        .from("orders")
        .update({
          razorpay_order_id: paymentOrder.id,
        })
        .eq("id", order.id)
        .eq("payment_status", "pending")
        .eq("stock_reserved", true)
        .gt("reservation_expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

    if (updateError || !updatedOrder) {
      console.error(
        "Could not save Razorpay order ID:",
        updateError?.message
      );

      return NextResponse.json(
        {
          error:
            "The order reservation changed. Please check your order before retrying payment.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      keyId,
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
