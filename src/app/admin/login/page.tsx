
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OrderItem = {
  product_name: string;
  unit_price_inr: number;
  quantity: number;
};

type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: {
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;
  total_inr: number;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: OrderItem[];
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const response = await fetch("/api/dev-admin/orders", {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          router.replace("/admin/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load orders.");
        }

        if (active) setOrders(result.orders ?? []);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Something went wrong."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      active = false;
    };
  }, [router]);

  const paidOrders = orders.filter(
    (order) => order.payment_status === "paid"
  );

  const pendingOrders = orders.filter(
    (order) => order.payment_status === "pending"
  );

  const revenue = paidOrders.reduce(
    (total, order) => total + order.total_inr,
    0
  );

  const filteredOrders = orders.filter((order) => {
    const query = search.toLowerCase();

    return (
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query) ||
      order.id.toLowerCase().includes(query)
    );
  });

  async function logout() {
    await fetch("/api/dev-admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#fff8f3] text-[#58352e]">
      <header className="border-b border-[#ecd7cb] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#b66f5c]">
              Little Hug
            </p>
            <h1 className="mt-1 font-serif text-3xl">Admin dashboard</h1>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-[#e8d4c8] px-4 py-2 text-sm hover:bg-[#fff8f3]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Local-development preview only. Do not deploy this temporary admin
          system to a public website.
        </div>

        {loading ? (
          <p className="py-12">Loading your orders...</p>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white p-5 text-red-700">
            {error}
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Orders loaded", value: orders.length },
                { label: "Paid orders", value: paidOrders.length },
                { label: "Pending payments", value: pendingOrders.length },
                { label: "Paid revenue", value: money(revenue) },
              ].map((stat) => (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-[#ecd7cb] bg-white p-6"
                >
                  <p className="text-sm text-[#8a6a60]">{stat.label}</p>
                  <p className="mt-3 font-serif text-3xl">{stat.value}</p>
                </article>
              ))}
            </section>

            <section className="mt-8 overflow-hidden rounded-2xl border border-[#ecd7cb] bg-white">
              <div className="flex flex-col gap-4 border-b border-[#f0e1d8] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-serif text-2xl">Recent orders</h2>
                  <p className="mt-1 text-sm text-[#8a6a60]">
                    Showing up to 100 latest orders
                  </p>
                </div>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email or order ID"
                  className="w-full rounded-xl border border-[#e8d4c8] px-4 py-3 text-sm outline-none focus:border-[#58352e] sm:max-w-sm"
                />
              </div>

              {filteredOrders.length === 0 ? (
                <p className="p-8 text-center text-[#8a6a60]">
                  No matching orders found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-[#fffaf7] text-[#8a6a60]">
                      <tr>
                        <th className="px-5 py-4 font-medium">Customer</th>
                        <th className="px-5 py-4 font-medium">Gift box</th>
                        <th className="px-5 py-4 font-medium">Amount</th>
                        <th className="px-5 py-4 font-medium">Payment</th>
                        <th className="px-5 py-4 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e1d8]">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="align-top hover:bg-[#fffaf7]">
                          <td className="px-5 py-4">
                            <p className="font-medium">{order.customer_name}</p>
                            <p className="mt-1 text-xs text-[#8a6a60]">
                              {order.customer_email}
                            </p>
                            <p className="mt-1 text-xs text-[#8a6a60]">
                              {order.customer_phone}
                            </p>
                            <p className="mt-2 max-w-xs text-xs text-[#8a6a60]">
                              {order.shipping_address
                                ? [
                                    order.shipping_address.address,
                                    order.shipping_address.city,
                                    order.shipping_address.state,
                                    order.shipping_address.pincode,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")
                                : "No address saved"}
                            </p>
                            <p className="mt-2 break-all text-[11px] text-[#a18479]">
                              ID: {order.id}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {order.order_items?.length
                              ? order.order_items.map((item, index) => (
                                  <p key={`${item.product_name}-${index}`}>
                                    {item.product_name} × {item.quantity}
                                  </p>
                                ))
                              : "No items"}
                          </td>
                          <td className="px-5 py-4 font-medium">
                            {money(order.total_inr)}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-xs ${
                                order.payment_status === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : order.payment_status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-[#8a6a60]">
                            {new Date(order.created_at).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
