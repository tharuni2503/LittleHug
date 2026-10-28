
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_inr: number;
};

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: { color: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    callback: (response: {
      error?: { description?: string };
    }) => void
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayCheckoutOptions
    ) => RazorpayCheckoutInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const selectedBox = searchParams.get("box");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completedOrderId, setCompletedOrderId] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");
        const data = await response.json();

        if (!response.ok) {
          throw new Error("Unable to load products.");
        }

        setProducts(data.products ?? []);
      } catch {
        setError("Unable to load gift boxes. Please refresh.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const product = products.find(
    (item) => item.name === selectedBox
  );

  const total = product ? product.price_inr * quantity : 0;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!product || submitting || completedOrderId) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      // 1. Load Razorpay Checkout.
      const loaded = await loadRazorpayScript();

      if (!loaded || !window.Razorpay) {
        throw new Error(
          "Unable to load Razorpay. Check your internet connection."
        );
      }

      // 2. Save the order in Supabase.
      const orderResponse = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          shippingAddress: {
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
          },
        }),
      });

      const orderResult = await orderResponse.json();

      if (!orderResponse.ok || !orderResult.order?.id) {
        throw new Error(
          orderResult.error || "Unable to create your order."
        );
      }

      const orderId: string = orderResult.order.id;
      const accessToken: string = orderResult.accessToken;

      // 3. Create the Razorpay order on the server.
      const paymentOrderResponse = await fetch(
        "/api/payment/create-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        }
      );

      const paymentOrder = await paymentOrderResponse.json();

      if (
        !paymentOrderResponse.ok ||
        !paymentOrder.keyId ||
        !paymentOrder.razorpayOrderId
      ) {
        throw new Error(
          paymentOrder.error || "Unable to start payment."
        );
      }

      // 4. Open Razorpay Checkout and wait for its result.
      await new Promise<void>((resolve, reject) => {
        let finished = false;

        const finish = (error?: Error) => {
          if (finished) return;
          finished = true;

          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };

        const checkout = new window.Razorpay!({
          key: paymentOrder.keyId,
          amount: paymentOrder.amount,
          currency: paymentOrder.currency,
          name: "Little Hug",
          description: product.name,
          order_id: paymentOrder.razorpayOrderId,
          prefill: {
            name: name.trim(),
            email: email.trim(),
            contact: phone.trim(),
          },
          theme: { color: "#58352e" },

          handler: async (payment) => {
            try {
              // 5. Verify the signature and payment on the server.
              const verifyResponse = await fetch(
                "/api/payment/verify",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    orderId,
                    accessToken,
                    razorpay_order_id: payment.razorpay_order_id,
                    razorpay_payment_id: payment.razorpay_payment_id,
                    razorpay_signature: payment.razorpay_signature,
                  }),
                }
              );

              const verification = await verifyResponse.json();

              if (
                !verifyResponse.ok ||
                !verification.verified
              ) {
                throw new Error(
                  verification.error ||
                    "Payment verification failed. If you were charged, contact support before paying again."
                );
              }

             window.location.href =
  `/order-success?orderId=${encodeURIComponent(orderId)}&accessToken=${encodeURIComponent(accessToken)}`;
finish();
            } catch (err) {
              finish(
                err instanceof Error
                  ? err
                  : new Error("Payment verification failed.")
              );
            }
          },

          modal: {
            ondismiss: () => {
              finish(
                new Error(
                  "Checkout closed. Your order remains pending until payment is verified."
                )
              );
            },
          },
        });

        checkout.on("payment.failed", (response) => {
          finish(
            new Error(
              response.error?.description ||
                "Payment failed. Please try again."
            )
          );
        });

        checkout.open();
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fff8f3] p-10 text-[#58352e]">
        Loading your Little Hug...
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#fff8f3] p-10 text-[#58352e]">
        <h1 className="text-3xl">Your Little Hug</h1>
        <p className="mt-4">
          {error || "Please choose a gift box from our shop first."}
        </p>
        <a className="mt-6 inline-block underline" href="/#shop">
          Return to the shop
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff8f3] px-5 py-12 text-[#58352e]">
      <div className="mx-auto max-w-5xl">
        <a href="/#shop" className="text-sm underline">
          ← Back to gift boxes
        </a>

        <header className="mb-10 mt-8">
          <p className="text-xs uppercase tracking-[0.25em] text-[#b66f5c]">
            A LITTLE EXTRA LOVE
          </p>
          <h1 className="mt-3 text-4xl font-serif sm:text-5xl">
            Your Little Hug
          </h1>
          <p className="mt-3 text-[#8a6a60]">
            Add delivery details for your thoughtful gift.
          </p>
        </header>

        {completedOrderId ? (
          <section
            className="rounded-2xl border border-[#ecd7cb] bg-white p-8"
            role="status"
          >
            <h2 className="text-3xl font-serif">
              Payment successful!
            </h2>
            <p className="mt-4">
              Thank you for choosing Little Hug. Your payment has
              been verified.
            </p>
            <p className="mt-3 break-all text-sm">
              Order ID: {completedOrderId}
            </p>
            <p className="mt-3">
              Amount paid: ₹{total}
            </p>
            <a
              href="/"
              className="mt-6 inline-block rounded-lg bg-[#58352e] px-5 py-3 text-white"
            >
              Back to home
            </a>
          </section>
        ) : (
          <div className="grid gap-10 md:grid-cols-[1.4fr_0.8fr]">
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-2xl border border-[#ecd7cb] bg-white p-6 sm:p-8"
            >
              <h2 className="text-2xl font-serif">
                Delivery details
              </h2>

              <div>
                <label htmlFor="name" className="mb-2 block text-sm">
                  Full name
                </label>
                <input
                  id="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#e7d2c7] p-3 outline-none focus:border-[#b66f5c]"
                  placeholder="Recipient's full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#e7d2c7] p-3 outline-none focus:border-[#b66f5c]"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-sm">
                  Mobile number
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="numeric"
                  pattern="[6-9][0-9]{9}"
                  title="Enter a valid 10-digit Indian mobile number."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-[#e7d2c7] p-3 outline-none focus:border-[#b66f5c]"
                  placeholder="10-digit mobile number"
                />
              </div>

              <div>
                <label htmlFor="address" className="mb-2 block text-sm">
                  House number, street and address
                </label>
                <textarea
                  id="address"
                  required
                  minLength={5}
                  maxLength={500}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="min-h-24 w-full rounded-lg border border-[#e7d2c7] p-3 outline-none focus:border-[#b66f5c]"
                  placeholder="Complete delivery address"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="city" className="mb-2 block text-sm">
                    City
                  </label>
                  <input
                    id="city"
                    required
                    minLength={2}
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-[#e7d2c7] p-3 outline-none focus:border-[#b66f5c]"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="mb-2 block text-sm">
                    State
                  </label>
                  <input
                    id="state"
                    required
                    minLength={2}
                    autoComplete="address-level1"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-lg border border-[#e7d2c7] p-3 outline-none focus:border-[#b66f5c]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pincode" className="mb-2 block text-sm">
                  PIN code
                </label>
                <input
                  id="pincode"
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[1-9][0-9]{5}"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full rounded-lg border border-[#e7d2c7] p-3 outline-none focus:border-[#b66f5c]"
                  placeholder="6-digit PIN code"
                />
              </div>

              <div>
                <label htmlFor="quantity" className="mb-2 block text-sm">
                  Quantity
                </label>
                <select
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#e7d2c7] bg-white p-3"
                >
                  {[1, 2, 3, 4, 5].map((number) => (
                    <option key={number} value={number}>
                      {number}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#58352e] px-5 py-4 text-white transition hover:bg-[#77483d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Opening secure checkout..."
                  : `Pay securely — ₹${total}`}
              </button>

              {submitError && (
                <p role="alert" className="text-sm text-red-700">
                  {submitError}
                </p>
              )}

              <p className="text-xs text-[#8a6a60]">
                Secure checkout powered by Razorpay. Your order is
                marked paid only after server-side verification.
              </p>
            </form>

            <aside className="h-fit rounded-2xl border border-[#ecd7cb] bg-[#f5e5db] p-6 sm:p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-[#a96351]">
                YOUR GIFT
              </p>

              <h2 className="mt-4 text-3xl font-serif">
                {product.name}
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#8a6a60]">
                {product.description}
              </p>

              <div className="my-6 border-t border-[#e2c9bb]" />

              <div className="flex justify-between gap-4 text-sm">
                <span>Price per box</span>
                <span>₹{product.price_inr}</span>
              </div>

              <div className="mt-4 flex justify-between gap-4 text-sm">
                <span>Quantity</span>
                <span>{quantity}</span>
              </div>

              <div className="my-6 border-t border-[#e2c9bb]" />

              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">Total</span>
                <strong className="text-3xl font-serif">
                  ₹{total}
                </strong>
              </div>

              <p className="mt-5 text-xs leading-5 text-[#8a6a60]">
                A little care. A little comfort. A lot of love.
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fff8f3] p-10 text-[#58352e]">
          Loading your Little Hug checkout...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
