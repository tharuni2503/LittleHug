
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createHash, randomBytes } from "node:crypto";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, slug, description, price_inr, image_url, is_active, stock_quantity"
      )
      .eq("is_active", true)
      .order("price_inr", { ascending: true });

    if (error) {
      console.error("Products query failed:", error.message);
      return NextResponse.json(
        { error: "Could not load products" },
        { status: 500 }
      );
    }

    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    console.error("Products API failed:", error);
    return NextResponse.json(
      { error: "Could not load products" },
      { status: 500 }
    );
  }
}

type OrderRequest = {
  productId: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
};


export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid order details." },
        { status: 400 }
      );
    }

    const {
      productId,
      quantity,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
    } = body;

    if (
      typeof productId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 5 ||
      typeof customerName !== "string" ||
      customerName.trim().length < 2 ||
      customerName.trim().length > 100 ||
      typeof customerEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
      typeof customerPhone !== "string" ||
      !/^[6-9]\d{9}$/.test(customerPhone) ||
      !shippingAddress ||
      typeof shippingAddress !== "object" ||
      typeof shippingAddress.address !== "string" ||
      shippingAddress.address.trim().length < 5 ||
      shippingAddress.address.trim().length > 500 ||
      typeof shippingAddress.city !== "string" ||
      shippingAddress.city.trim().length < 2 ||
      typeof shippingAddress.state !== "string" ||
      shippingAddress.state.trim().length < 2 ||
      typeof shippingAddress.pincode !== "string" ||
      !/^[1-9]\d{5}$/.test(shippingAddress.pincode)
    ) {
      return NextResponse.json(
        { error: "Please provide valid order and delivery details." },
        { status: 400 }
      );
    }
const accessToken = randomBytes(32).toString("hex");

const accessTokenHash = createHash("sha256")
  .update(accessToken)
  .digest("hex");
    const { data: order, error } = await supabaseAdmin.rpc(
      "create_reserved_order",
      {
        p_access_token_hash: accessTokenHash,
        p_product_id: productId,
        p_quantity: quantity,
        p_customer_name: customerName.trim(),
        p_customer_email: customerEmail.trim().toLowerCase(),
        p_customer_phone: customerPhone.trim(),
        p_shipping_address: {
          address: shippingAddress.address.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
          pincode: shippingAddress.pincode.trim(),
          country: "India",
        },
      }
    );

    if (error || !order) {
      const message = error?.message ?? "";

      if (
        message.includes("Insufficient stock") ||
        message.includes("Product unavailable")
      ) {
        return NextResponse.json(
          { error: "This gift box is unavailable or has insufficient stock." },
          { status: 409 }
        );
      }

      console.error("Atomic order creation failed:", message);

      return NextResponse.json(
        { error: "Could not create your order. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Order created and stock reserved successfully.",
        accessToken,
        order: {
          id: order.id,
          total_inr: order.total_inr,
          status: order.status,
          payment_status: order.payment_status,
          reservation_expires_at: order.reservation_expires_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order API failed:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while creating your order." },
      { status: 500 }
    );
  }
}