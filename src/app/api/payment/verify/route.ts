
import { NextResponse } from "next/server";
import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { razorpay } from "@/lib/razorpay";


async function recordPaymentRecovery(input: {
  orderId: string;
  paymentId: string;
  razorpayOrderId: string;
  amountInr: number;
  reason: string;
}) {
  const { error } = await supabaseAdmin
    .from("payment_recovery")
    .upsert(
      {
        order_id: input.orderId,
        razorpay_payment_id: input.paymentId,
        razorpay_order_id: input.razorpayOrderId,
        amount_inr: input.amountInr,
        reason: input.reason,
      },
      {
        onConflict: "razorpay_payment_id",
        ignoreDuplicates: true,
      }
    );

  if (error) {
    console.error("CRITICAL: Could not record captured payment recovery:", {
      orderId: input.orderId,
      paymentId: input.paymentId,
      error: error.message,
    });
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      orderId,
      accessToken,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body ?? {};

    if (
      typeof orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        orderId
      ) ||
      typeof accessToken !== "string" ||
      !/^[a-f0-9]{64}$/i.test(accessToken) ||
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return NextResponse.json(
        { error: "Invalid payment verification details." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, total_inr, payment_status, razorpay_order_id, razorpay_payment_id, access_token_hash"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("Order lookup failed:", orderError.message);
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

    // Validate the private order access token.
    const suppliedHash = createHash("sha256")
      .update(accessToken)
      .digest("hex");

    if (!/^[a-f0-9]{64}$/i.test(order.access_token_hash)) {
      console.error("Stored access token hash is invalid.");
      return NextResponse.json(
        { error: "Could not verify the order." },
        { status: 500 }
      );
    }

    const suppliedBuffer = Buffer.from(suppliedHash, "hex");
    const storedBuffer = Buffer.from(order.access_token_hash, "hex");

    if (
      suppliedBuffer.length !== storedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, storedBuffer)
    ) {
      return NextResponse.json(
        { error: "Order not found or access denied." },
        { status: 404 }
      );
    }

    if (order.razorpay_order_id !== razorpay_order_id) {
      return NextResponse.json(
        { error: "Payment order does not match." },
        { status: 400 }
      );
    }

    // Handle repeat verification safely.
    if (order.payment_status === "paid") {
      if (order.razorpay_payment_id !== razorpay_payment_id) {
        return NextResponse.json(
          { error: "A different payment is already recorded for this order." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        verified: true,
        message: "Payment was already verified.",
        order: {
          id: order.id,
          payment_status: "paid",
          razorpay_payment_id,
        },
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      console.error("RAZORPAY_KEY_SECRET is not configured.");
      return NextResponse.json(
        { error: "Payment verification is not configured." },
        { status: 500 }
      );
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const signatureBuffer = Buffer.from(razorpay_signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return NextResponse.json(
        { error: "Invalid payment signature." },
        { status: 400 }
      );
    }

    // Confirm the payment directly with Razorpay.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== order.total_inr * 100 ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return NextResponse.json(
        {
          error:
            "Payment has not been confirmed as captured. If you were charged, please contact support before paying again.",
        },
        { status: 409 }
      );
    }

    // Finalize the reservation atomically in Supabase.
    const { data: result, error: finalizeError } =
      await supabaseAdmin.rpc("finalize_reserved_order", {
        p_order_id: order.id,
        p_razorpay_payment_id: razorpay_payment_id,
      });

    if (finalizeError) {
      console.error(
        "Could not finalize reserved order:",
        finalizeError.message
      );
      await recordPaymentRecovery({
  orderId: order.id,
  paymentId: razorpay_payment_id,
  razorpayOrderId: razorpay_order_id,
  amountInr: order.total_inr,
  reason: `finalization_error: ${finalizeError.message}`,
});

      return NextResponse.json(
        {
          error:
            "Payment was verified, but order finalization failed. If charged, please contact support.",
        },
        { status: 500 }
      );
    }

    if (!result?.success) {
      console.error("Order finalization rejected:", result?.reason);
      if (result?.reason === "reservation_expired") {
  await recordPaymentRecovery({
    orderId: order.id,
    paymentId: razorpay_payment_id,
    razorpayOrderId: razorpay_order_id,
    amountInr: order.total_inr,
    reason: "reservation_expired_after_payment_capture",
  });
}

      return NextResponse.json(
        {
          error:
            result?.reason === "reservation_expired"
              ? "Your stock reservation has expired. If charged, please contact support."
              : "The order status changed. Please check your order.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      verified: true,
      message: result.already_paid
        ? "Payment was already verified."
        : "Payment verified successfully.",
      order: {
        id: order.id,
        payment_status: "paid",
        razorpay_payment_id,
      },
    });
  } catch (error) {
    console.error("Payment verification failed:", error);

    return NextResponse.json(
      {
        error:
          "Could not verify payment. Please contact support if charged.",
      },
      { status: 500 }
    );
  }
}
