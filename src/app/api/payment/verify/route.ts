
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { razorpay } from "@/lib/razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body ?? {};

    if (
      typeof orderId !== "string" ||
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      return NextResponse.json(
        { error: "Invalid payment verification details." },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total_inr, status, payment_status, razorpay_order_id")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      console.error("Verification order lookup failed:", error?.message);
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({
        verified: true,
        message: "This order is already marked as paid.",
      });
    }

    // Only verify the Razorpay order ID saved on our server.
    if (
      !order.razorpay_order_id ||
      order.razorpay_order_id !== razorpay_order_id
    ) {
      return NextResponse.json(
        { error: "Payment order does not match." },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      throw new Error("Missing Razorpay secret.");
    }
    
const expectedSignature = createHmac("sha256", secret)
  .update(`${order.razorpay_order_id}|${razorpay_payment_id}`)
  .digest("hex");

// Validate signature format before comparing.
if (!/^[a-f0-9]{64}$/i.test(razorpay_signature)) {
  return NextResponse.json(
    { error: "Invalid payment signature format." },
    { status: 400 }
  );
}

const supplied = Buffer.from(razorpay_signature, "hex");
const expected = Buffer.from(expectedSignature, "hex");

if (
  supplied.length !== expected.length ||
  !timingSafeEqual(supplied, expected)
) {
  return NextResponse.json(
    { error: "Payment signature verification failed." },
    { status: 400 }
  );
}


    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 }
      );
    }

    // Check the payment status and amount directly with Razorpay.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== order.razorpay_order_id ||
      payment.amount !== order.total_inr * 100 ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return NextResponse.json(
        {
          error:
            "Payment is not captured yet. Your order has not been marked as paid.",
        },
        { status: 409 }
      );
    }

    const { data: updatedOrder, error: updateError } =
      await supabaseAdmin
        .from("orders")
        .update({
  razorpay_payment_id,
  payment_status: "paid",
}) 
        .eq("id", order.id)
        .eq("razorpay_order_id", order.razorpay_order_id)
        .eq("payment_status", "pending")
        .select("id, payment_status, status")
        .maybeSingle();

    if (updateError) {
      console.error("Could not update payment status:", updateError.message);
      return NextResponse.json(
        { error: "Payment was verified, but the order update failed." },
        { status: 500 }
      );
    }

if (!updatedOrder) {
  const { data: latestOrder, error: latestError } =
    await supabaseAdmin
      .from("orders")
      .select("id, payment_status, razorpay_payment_id")
      .eq("id", order.id)
      .maybeSingle();

  if (
    !latestError &&
    latestOrder?.payment_status?.toLowerCase() === "paid" &&
    latestOrder.razorpay_payment_id === razorpay_payment_id
  ) {
    return NextResponse.json({
      verified: true,
      message: "Payment was already verified.",
      order: latestOrder,
    });
  }

  return NextResponse.json(
    { error: "Order status changed. Please check your order." },
    { status: 409 }
  );
}

    return NextResponse.json({
      verified: true,
      message: "Payment verified successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Payment verification failed:", error);
    return NextResponse.json(
      { error: "Could not verify payment. Please contact support if charged." },
      { status: 500 }
    );
  }
}
