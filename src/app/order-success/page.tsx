
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type OrderStatus = {
  orderId: string;
  paymentStatus: string;
  totalInr: number;
};

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function verifyOrder() {
      if (!orderId) {
        setError("No order number was provided.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/order-status?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to verify your order.");
        }

        if (!cancelled) {
          setOrder(result);
          if (result.paymentStatus !== "paid") {
            setError(
              "Your payment is not confirmed yet. Please check again later before attempting another payment."
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to verify your order."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    verifyOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const paid = order?.paymentStatus === "paid";

  return (
    <main className="min-h-screen bg-[#fff8f3] px-5 py-16 text-[#58352e]">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm underline">
          ← Back to Little Hug
        </a>

        <section className="mt-10 rounded-3xl border border-[#ecd7cb] bg-white px-6 py-12 text-center shadow-sm sm:px-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f5e5db] text-4xl">
            {loading ? "…" : paid ? "✓" : "!"}
          </div>

          <p className="mt-7 text-xs uppercase tracking-[0.25em] text-[#b66f5c]">
            A LITTLE EXTRA LOVE
          </p>

          <h1 className="mt-3 font-serif text-4xl sm:text-5xl">
            {loading ? "Checking your order…" : paid ? "Thank you!" : "Order status"}
          </h1>

          <p className="mt-5 leading-7 text-[#8a6a60]" role="status">
            {loading
              ? "Please wait while we check your payment."
              : paid
              ? "Your Little Hug payment has been verified. Thank you for choosing a thoughtful gift."
              : error || "Your payment is not confirmed yet."}
          </p>

          {order && (
            <div className="mt-8 rounded-xl bg-[#fff8f3] p-5 text-left">
              <p className="text-sm text-[#8a6a60]">Your order number</p>
              <p className="mt-2 break-all font-medium">{order.orderId}</p>
              <p className="mt-3 text-sm">
                Payment status: <strong>{order.paymentStatus}</strong>
              </p>
              {paid && (
                <p className="mt-3">
                  Amount paid: ₹{order.totalInr}
                </p>
              )}
            </div>
          )}

          {!loading && !paid && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg border border-[#58352e] px-5 py-3"
            >
              Check again
            </button>
          )}

          <p className="mt-8 font-serif text-xl">
            A little care. A little comfort. A lot of love.
          </p>

          <a
            href="/"
            className="mt-8 inline-block rounded-lg bg-[#58352e] px-7 py-3 text-white transition hover:bg-[#77483d]"
          >
            Continue shopping
          </a>
        </section>

        <p className="mt-6 text-center text-xs text-[#a18479]">
          Little Hug · Made with care
        </p>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fff8f3] p-10 text-[#58352e]">
          Loading your confirmation...
        </main>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
