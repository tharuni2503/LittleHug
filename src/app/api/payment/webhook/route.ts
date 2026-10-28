
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
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

    throw new Error("Could not persist payment recovery record.");
  }
}


export async function POST(request: Request) {
  let eventId: string | null = null;
  let claimToken: string | null = null;

  async function recordFailure(message: string) {
    if (!eventId || !claimToken) return;

    const { error } = await supabaseAdmin
      .from("razorpay_webhook_events")
      .update({
        last_error: message.slice(0, 1000),
        processing_started_at: null,
      })
      .eq("event_id", eventId)
      .eq("claim_token", claimToken)
      .eq("processed", false);

    if (error) {
      console.error("Could not record webhook failure:", error.message);
    }
  }

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: "Webhook configuration is missing." },
        { status: 500 }
      );
    }

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const received = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.event;

    if (
      eventType !== "payment.captured" &&
      eventType !== "payment.failed" &&
      eventType !== "order.paid"
    ) {
      return NextResponse.json({ received: true });
    }

    eventId = request.headers.get("x-razorpay-event-id");

    if (!eventId || !eventId.trim()) {
      return NextResponse.json(
        { error: "Webhook event ID is missing." },
        { status: 400 }
      );
    }

    const { data: token, error: claimError } =
      await supabaseAdmin.rpc("claim_razorpay_webhook_event", {
        p_event_id: eventId,
        p_event_type: eventType,
      });

    if (claimError) {
      console.error("Webhook event claim failed:", claimError.message);
      return NextResponse.json(
        { error: "Could not claim webhook event." },
        { status: 500 }
      );
    }

    claimToken = typeof token === "string" ? token : null;

    if (!claimToken) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("razorpay_webhook_events")
        .select("processed, event_type")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json(
          { error: "Could not check webhook event." },
          { status: 500 }
        );
      }

      if (existing?.event_type !== eventType) {
        return NextResponse.json(
          { error: "Webhook event ID conflict." },
          { status: 409 }
        );
      }

      if (existing?.processed === true) {
        return NextResponse.json({ received: true });
      }

      return NextResponse.json(
        { error: "Webhook event is already being processed." },
        { status: 500 }
      );
    }

    async function markProcessed() {
      const { data, error } = await supabaseAdmin
        .from("razorpay_webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_started_at: null,
          last_error: null,
        })
        .eq("event_id", eventId)
        .eq("claim_token", claimToken)
        .eq("processed", false)
        .select("event_id")
        .maybeSingle();

      if (error) {
        throw new Error(`Could not mark event processed: ${error.message}`);
      }

      if (!data) {
        throw new Error("Webhook claim expired or was replaced.");
      }
    }

    let paymentId: string | undefined;
    let razorpayOrderId: string | undefined;

    if (
      eventType === "payment.captured" ||
      eventType === "payment.failed"
    ) {
      const paymentEntity = event?.payload?.payment?.entity;
      paymentId = paymentEntity?.id;
      razorpayOrderId = paymentEntity?.order_id;
    } else {
      razorpayOrderId = event?.payload?.order?.entity?.id;

      if (typeof razorpayOrderId === "string") {
        const payments =
          await razorpay.orders.fetchPayments(razorpayOrderId);

        const capturedPayment = payments.items?.find(
          (item) =>
            item.status === "captured" &&
            item.order_id === razorpayOrderId
        );

        paymentId = capturedPayment?.id;
      }
    }

    if (typeof razorpayOrderId !== "string") {
      throw new Error("Webhook order reference is missing.");
    }

    const { data: order, error: lookupError } = await supabaseAdmin
      .from("orders")
      .select("id, total_inr, razorpay_order_id")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Order lookup failed: ${lookupError.message}`);
    }

    if (!order) {
      // A valid event for another application is not retried indefinitely.
      await markProcessed();
      return NextResponse.json({ received: true });
    }

    if (eventType === "payment.failed") {
      // A failed attempt does not prove that another attempt wasn't captured.
      // Never release stock from this event.
      console.info("Payment attempt failed; stock was not released.", {
        orderId: order.id,
        eventId,
      });

      await markProcessed();
      return NextResponse.json({ received: true });
    }

    if (typeof paymentId !== "string") {
      throw new Error(
        "Captured payment ID unavailable; reconciliation required."
      );
    }

    const payment = await razorpay.payments.fetch(paymentId);

    if (
      payment.order_id !== razorpayOrderId ||
      payment.status !== "captured" ||
      payment.currency !== "INR" ||
      payment.amount !== order.total_inr * 100
    ) {
      throw new Error("Captured payment details do not match the order.");
    }

    const { data: result, error: finalizeError } =
      await supabaseAdmin.rpc("finalize_reserved_order", {
        p_order_id: order.id,
        p_razorpay_payment_id: paymentId,
      });


if (finalizeError) {
  await recordPaymentRecovery({
    orderId: order.id,
    paymentId,
    razorpayOrderId,
    amountInr: order.total_inr,
    reason: `finalization_error: ${finalizeError.message}`,
  });

  throw new Error(
    `Order finalization failed: ${finalizeError.message}`
  );
}

if (!result?.success) {
  const reason = result?.reason ?? "unknown reason";

  await recordPaymentRecovery({
    orderId: order.id,
    paymentId,
    razorpayOrderId,
    amountInr: order.total_inr,
    reason: `finalization_rejected: ${reason}`,
  });

  throw new Error(
    `Payment needs reconciliation: ${reason}`
  );
}


    await markProcessed();

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown webhook error";

    console.error("Razorpay webhook processing failed:", message);
    await recordFailure(message);

    return NextResponse.json(
      { error: "Webhook processing failed; retry or reconcile." },
      { status: 500 }
    );
  }
}
