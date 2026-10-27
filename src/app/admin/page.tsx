
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OrderItem = {
  product_name: string;
  unit_price_inr: number;
  quantity: number;
};

type Address = {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: Address | null;
  total_inr: number;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: OrderItem[];
};

type Period = "today" | "7d" | "30d" | "all";

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const shortDate = (date: Date) =>
  date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function isPaid(order: Order) {
  return order.payment_status?.toLowerCase() === "paid";
}

function isPending(order: Order) {
  return order.payment_status?.toLowerCase() === "pending";
}

function StatusPill({ value }: { value: string }) {
  const status = (value || "unknown").toLowerCase();
  const style = status === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : status === "pending"
      ? "bg-amber-50 text-amber-800"
      : "bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

function RevenueChart({ orders }: { orders: Order[] }) {
  const [currentTime, setCurrentTime] = useState<number | null>(null);

useEffect(() => {
  setCurrentTime(Date.now());
}, []);

const points = useMemo(() => {
  if (currentTime === null) return [];

  const now = new Date(currentTime);
  const start = new Date(currentTime);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const total = orders.reduce((sum, order) => {
        const created = new Date(order.created_at);
        const createdKey = `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`;

        return isPaid(order) && createdKey === key
          ? sum + Number(order.total_inr || 0)
          : sum;
      }, 0);

      return { date, total };
    });

    return days;
 }, [orders, currentTime]);

  const max = Math.max(...points.map((point) => point.total), 1);
  const chartWidth = 620;
  const chartHeight = 205;
  const left = 38;
  const right = 12;
  const top = 14;
  const bottom = 30;
  const innerWidth = chartWidth - left - right;
  const innerHeight = chartHeight - top - bottom;

  const coordinates = points.map((point, index) => ({
    ...point,
    x: left + (index / 6) * innerWidth,
    y: top + innerHeight - (point.total / max) * innerHeight,
  }));

  const line = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const area = `${line} L ${left + innerWidth} ${top + innerHeight} L ${left} ${top + innerHeight} Z`;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-[#8d7770]">Paid revenue</p>
          <p className="mt-1 text-xs text-[#a58e85]">Daily · last 7 days</p>
        </div>
        <span className="flex items-center gap-2 text-xs text-[#7d554a]">
          <span className="h-2 w-2 rounded-full bg-[#a85f4d]" />
          Revenue
        </span>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Paid revenue for each of the last seven days"
        className="w-full overflow-visible"
      >
        {[0, 1, 2, 3].map((step) => {
          const y = top + (innerHeight / 3) * step;

          return (
            <g key={step}>
              <line
                x1={left}
                x2={chartWidth - right}
                y1={y}
                y2={y}
                stroke="#efe3dc"
                strokeDasharray="4 5"
              />
              <text
                x={left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#a58e85"
              >
                {Math.round(max * (1 - step / 3))}
              </text>
            </g>
          );
        })}

        <path d={area} fill="#f5e3dc" opacity="0.8" />
        <path
          d={line}
          fill="none"
          stroke="#a85f4d"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coordinates.map((point, index) => (
          <g key={point.date.toISOString()}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#fff"
              stroke="#a85f4d"
              strokeWidth="2"
            />
            <text
              x={point.x}
              y={chartHeight - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#8d7770"
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                point.date.getDay()
              ]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

useEffect(() => {
  setCurrentTime(Date.now());
}, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/dev-admin/orders", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.status === 401 || response.status === 403) {
        router.replace("/admin/login");
        return;
      }

      const responseText = await response.text();

let result;
try {
  result = responseText ? JSON.parse(responseText) : {};
} catch {
  throw new Error(
    `Server returned an invalid response (HTTP ${response.status}).`
  );
}

      if (!response.ok) {
        throw new Error(result.error || "Could not load orders.");
      }

      setOrders(result.orders ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load orders."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function logout() {
    try {
      await fetch("/api/dev-admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }
  
async function deleteOrder(order: Order) {
  const confirmed = window.confirm(
    `Delete order ${order.id} for ${order.customer_name}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  setError("");

  try {
    const response = await fetch("/api/dev-admin/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ orderId: order.id }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not delete order.");
    }

    setOrders((current) =>
      current.filter((item) => item.id !== order.id)
    );

    if (selectedOrder?.id === order.id) {
      setSelectedOrder(null);
    }
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Could not delete order."
    );
  }
}

const filteredByDate = useMemo(() => {
  if (period === "all") return orders;
  if (currentTime === null) return [];

  const now = new Date(currentTime);
  const start = new Date(currentTime);
  start.setHours(0, 0, 0, 0);

  if (period === "7d") {
    start.setDate(start.getDate() - 6);
  }

  if (period === "30d") {
    start.setDate(start.getDate() - 29);
  }

  return orders.filter((order) => {
    const created = new Date(order.created_at);
    return created >= start && created <= now;
  });
}, [orders, period, currentTime]);

  const paidOrders = filteredByDate.filter(isPaid);
  const pendingOrders = filteredByDate.filter(isPending);

  const revenue = paidOrders.reduce(
    (sum, order) => sum + Number(order.total_inr || 0),
    0
  );

  const filteredOrders = filteredByDate.filter((order) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query) ||
      order.id.toLowerCase().includes(query);

    const matchesPayment =
      paymentFilter === "all" ||
      order.payment_status?.toLowerCase() === paymentFilter;

    return matchesSearch && matchesPayment;
  });

  const navItems = [
    { label: "Overview", symbol: "◫", target: "overview" },
    { label: "Orders", symbol: "▤", target: "orders" },
  ];

  return (
    <main className="min-h-screen bg-[#faf6f2] text-[#432d27]">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#eee2da] bg-white transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-[#f0e6df] px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#59372e] font-serif text-xl text-white">
              L
            </div>
            <div>
              <p className="font-serif text-xl">Little Hug</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-[#b57967]">
                Store studio
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ad9a91]">
            Workspace
          </p>

          <nav className="mt-3 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.target}
                href={`#${item.target}`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                  item.target === "overview"
                    ? "bg-[#f6ebe5] font-medium text-[#794b3d]"
                    : "text-[#806b62] hover:bg-[#faf5f1]"
                }`}
              >
                <span className="text-lg">{item.symbol}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-[#faf4ef] p-4">
            <p className="text-sm font-medium">A little extra love</p>
            <p className="mt-1 text-xs leading-5 text-[#927a70]">
              Thoughtful care, managed in one place.
            </p>
          </div>

          <button
            onClick={logout}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#805e53] hover:bg-[#faf4ef]"
          >
            <span className="text-lg">↗</span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#eee2da] bg-[#fffdfb]/95 px-4 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="rounded-xl border border-[#eadbd2] px-3 py-2 md:hidden"
            >
              ☰
            </button>
            <div>
              <p className="text-xs text-[#a58e85]">Workspace / Overview</p>
              <h1 className="mt-1 font-serif text-2xl sm:text-3xl">
                Good to see you
              </h1>
            </div>
          </div>

          <button
            onClick={() => void loadOrders()}
            disabled={loading}
            className="rounded-xl border border-[#e7d6cc] bg-white px-3 py-2.5 text-sm transition hover:bg-[#faf4ef] disabled:opacity-50 sm:px-4"
          >
            <span className="sm:hidden">↻</span>
            <span className="hidden sm:inline">
              {loading ? "Refreshing..." : "↻ Refresh"}
            </span>
          </button>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-7 p-4 sm:p-7">
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
              !
            </span>
            <p>
              <strong>Development-only admin.</strong> This temporary login
              must not be deployed to a public website.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-700">
              {error}
              <button
                onClick={() => void loadOrders()}
                className="ml-3 underline"
              >
                Try again
              </button>
            </div>
          )}

          <section id="overview" className="scroll-mt-24">
            <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-serif text-2xl">Store overview</h2>
                <p className="mt-1 text-sm text-[#9b857b]">
                  A clear picture of your orders and sales.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  ["today", "Today"],
                  ["7d", "7 days"],
                  ["30d", "30 days"],
                  ["all", "All time"],
                ] as [Period, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setPeriod(value)}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm ${
                      period === value
                        ? "bg-[#59372e] text-white"
                        : "border border-[#e9d9cf] bg-white text-[#82695f] hover:bg-[#f8eee8]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total orders",
                  value: filteredByDate.length.toLocaleString("en-IN"),
                  note: "Orders in selected period",
                  mark: "▤",
                },
                {
                  label: "Paid orders",
                  value: paidOrders.length.toLocaleString("en-IN"),
                  note: "Successfully marked paid",
                  mark: "✓",
                },
                {
                  label: "Pending payments",
                  value: pendingOrders.length.toLocaleString("en-IN"),
                  note: "Awaiting payment confirmation",
                  mark: "◷",
                },
                {
                  label: "Paid revenue",
                  value: money(revenue),
                  note: "Paid orders only",
                  mark: "₹",
                },
              ].map((stat, index) => (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-[#eee1d8] bg-white p-5 shadow-[0_3px_12px_rgba(74,44,34,0.025)]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#907a70]">{stat.label}</p>
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${
                        index === 3
                          ? "bg-[#f4e4dc] text-[#9a5947]"
                          : "bg-[#faf3ee] text-[#9b796b]"
                      }`}
                    >
                      {stat.mark}
                    </span>
                  </div>
                  <p className="mt-5 break-words font-serif text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs text-[#a18c82]">{stat.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <article className="min-w-0 rounded-2xl border border-[#eee1d8] bg-white p-5 sm:p-6">
              <RevenueChart orders={orders} />
              <p className="mt-2 text-xs text-[#a18c82]">
                Chart shows the last seven calendar days, regardless of the
                selected order-table period. Values use orders marked paid.
              </p>
            </article>

            <article className="rounded-2xl border border-[#eee1d8] bg-white p-5 sm:p-6">
              <h3 className="font-serif text-xl">Payment snapshot</h3>
              <p className="mt-1 text-sm text-[#9b857b]">
                Current selected period
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-[#806b62]">Paid</span>
                    <span className="font-medium">{paidOrders.length}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f3ebe5]">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{
                        width: `${
                          filteredByDate.length
                            ? (paidOrders.length / filteredByDate.length) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-[#806b62]">Pending</span>
                    <span className="font-medium">{pendingOrders.length}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f3ebe5]">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{
                        width: `${
                          filteredByDate.length
                            ? (pendingOrders.length / filteredByDate.length) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-7 rounded-xl bg-[#faf4ef] p-4">
                <p className="text-xs text-[#9b857b]">Revenue in period</p>
                <p className="mt-1 font-serif text-2xl">{money(revenue)}</p>
                <p className="mt-1 text-xs text-[#9b857b]">
                  Only confirmed paid orders count toward revenue.
                </p>
              </div>
            </article>
          </section>

          <section
            id="orders"
            className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#eee1d8] bg-white"
          >
            <div className="flex flex-col gap-4 border-b border-[#f0e6df] p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="font-serif text-2xl">Orders</h2>
                <p className="mt-1 text-sm text-[#9b857b]">
                  Select an order to view its details.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customer or order ID"
                  className="min-w-0 rounded-xl border border-[#e8d8cf] px-4 py-3 text-sm outline-none transition placeholder:text-[#b09a90] focus:border-[#9d6958] sm:w-64"
                />

                <select
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                  className="rounded-xl border border-[#e8d8cf] bg-white px-3 py-3 text-sm outline-none focus:border-[#9d6958]"
                  aria-label="Filter by payment status"
                >
                  <option value="all">All payments</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            {loading && orders.length === 0 ? (
              <p className="p-8 text-sm text-[#9b857b]">Loading orders...</p>
            ) : filteredOrders.length === 0 ? (
              <p className="p-10 text-center text-sm text-[#9b857b]">
                No orders match these filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#fcf8f5] text-xs uppercase tracking-wider text-[#9b857b]">
                    <tr>
                      <th className="px-5 py-4 font-medium">Customer</th>
                      <th className="px-5 py-4 font-medium">Order items</th>
                      <th className="px-5 py-4 font-medium">Total</th>
                      <th className="px-5 py-4 font-medium">Payment</th>
                      <th className="px-5 py-4 font-medium">Date</th>
                      <th className="px-5 py-4 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2e8e1]">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="transition hover:bg-[#fdf9f6]">
                        <td className="px-5 py-4">
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="mt-1 text-xs text-[#9b857b]">
                            {order.customer_email}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="max-w-52 space-y-1">
                            {(order.order_items ?? []).map((item, index) => (
                              <p key={`${item.product_name}-${index}`}>
                                {item.product_name}{" "}
                                <span className="text-[#9b857b]">
                                  × {item.quantity}
                                </span>
                              </p>
                            ))}
                            {!order.order_items?.length && (
                              <span className="text-[#9b857b]">No items</span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-medium">
                          {money(order.total_inr)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill value={order.payment_status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-[#907a70]">
                          {new Date(order.created_at).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </td>
                        <td className="px-5 py-4">
                          
<div className="flex items-center gap-2">
  <button
    onClick={() => setSelectedOrder(order)}
    className="whitespace-nowrap rounded-lg border border-[#ead9cf] px-3 py-2 text-xs font-medium text-[#794b3d] transition hover:bg-[#f8eee8]"
  >
    View order →
  </button>

  <button
    onClick={() => void deleteOrder(order)}
    className="whitespace-nowrap rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
  >
    Delete
  </button>
</div>

                          
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-[#f0e6df] px-5 py-4 text-xs text-[#9b857b]">
              Showing {filteredOrders.length} of {filteredByDate.length} orders
              in this period.
            </div>
          </section>

          <footer className="pb-4 text-center text-xs text-[#aa958b]">
            Little Hug · Made with care
          </footer>
        </div>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#2d1d18]/45 sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrder(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-dialog-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#b57967]">
                  Order details
                </p>
                <h2 id="order-dialog-title" className="mt-2 font-serif text-2xl">
                  {selectedOrder.customer_name}
                </h2>
                <p className="mt-1 break-all text-xs text-[#9b857b]">
                  {selectedOrder.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="rounded-xl border border-[#eadbd2] px-3 py-2 hover:bg-[#faf4ef]"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#faf5f1] p-4">
                <p className="text-xs text-[#9b857b]">Order total</p>
                <p className="mt-2 font-serif text-2xl">
                  {money(selectedOrder.total_inr)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#faf5f1] p-4">
                <p className="text-xs text-[#9b857b]">Payment status</p>
                <div className="mt-3">
                  <StatusPill value={selectedOrder.payment_status} />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-medium">Customer</h3>
                <p className="mt-3 break-all text-sm">
                  {selectedOrder.customer_email}
                </p>
                <p className="mt-2 text-sm">{selectedOrder.customer_phone}</p>
              </div>
              <div>
                <h3 className="font-medium">Delivery address</h3>
                <p className="mt-3 text-sm leading-6 text-[#806b62]">
                  {selectedOrder.shipping_address
                    ? [
                        selectedOrder.shipping_address.address,
                        selectedOrder.shipping_address.city,
                        selectedOrder.shipping_address.state,
                        selectedOrder.shipping_address.pincode,
                        selectedOrder.shipping_address.country,
                      ]
                        .filter(Boolean)
                        .join(", ")
                    : "No delivery address saved."}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <h3 className="font-medium">Items ordered</h3>
              <div className="mt-3 divide-y divide-[#f0e6df] rounded-xl border border-[#f0e6df] px-4">
                {(selectedOrder.order_items ?? []).map((item, index) => (
                  <div
                    key={`${item.product_name}-${index}`}
                    className="flex items-center justify-between gap-4 py-4 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="mt-1 text-xs text-[#9b857b]">
                        {money(item.unit_price_inr)} × {item.quantity}
                      </p>
                    </div>
                    <p className="whitespace-nowrap font-medium">
                      {money(item.unit_price_inr * item.quantity)}
                    </p>
                  </div>
                ))}
                {!selectedOrder.order_items?.length && (
                  <p className="py-4 text-sm text-[#9b857b]">
                    No order items found.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0e6df] pt-5">
              <div>
                <p className="text-xs text-[#9b857b]">Order placed</p>
                <p className="mt-1 text-sm">
                  {new Date(selectedOrder.created_at).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(selectedOrder.id);
                }}
                className="rounded-xl border border-[#ead9cf] px-4 py-2.5 text-sm hover:bg-[#faf4ef]"
              >
                Copy order ID
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
