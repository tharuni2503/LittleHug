
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
    const body = (await request.json()) as OrderRequest;

    const {
      productId,
      quantity,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
    } = body;

    // Validate order and delivery details.
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
      typeof shippingAddress.address !== "string" ||
      shippingAddress.address.trim().length < 5 ||
      shippingAddress.address.length > 500 ||
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

    // Verify the product using the server-side admin client.
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_inr, is_active, stock_quantity")
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      console.error("Product lookup failed:", productError.message);
      return NextResponse.json(
        { error: "Unable to verify the selected product." },
        { status: 500 }
      );
    }

    if (!product || !product.is_active) {
      return NextResponse.json(
        { error: "This gift box is currently unavailable." },
        { status: 404 }
      );
    }

    if (product.stock_quantity < quantity) {
      return NextResponse.json(
        { error: "Insufficient stock for the selected quantity." },
        { status: 409 }
      );
    }

    const totalInr = product.price_inr * quantity;

    if (!Number.isSafeInteger(totalInr) || totalInr <= 0) {
      return NextResponse.json(
        { error: "Invalid order amount." },
        { status: 400 }
      );
    }

    // Create the order using the admin client.
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim().toLowerCase(),
        customer_phone: customerPhone,
        shipping_address: {
          address: shippingAddress.address.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
          pincode: shippingAddress.pincode,
          country: "India",
        },
        total_inr: totalInr,
        status: "pending",
        payment_status: "pending",
      })
      .select("id, total_inr, status, payment_status")
      .single();

    if (orderError || !order) {
      console.error("Order creation failed:", orderError?.message);
      return NextResponse.json(
        { error: "Could not create your order." },
        { status: 500 }
      );
    }

    // Save order items using the admin client.
    const { error: itemError } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        unit_price_inr: product.price_inr,
        quantity,
      });

    if (itemError) {
      console.error("Order item creation failed:", itemError.message);

      // Remove the incomplete pending order.
      const { error: cleanupError } = await supabaseAdmin
        .from("orders")
        .delete()
        .eq("id", order.id)
        .eq("payment_status", "pending");

      if (cleanupError) {
        console.error("Order cleanup failed:", cleanupError.message);
      }

      return NextResponse.json(
        { error: "Could not save your order items. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Order created successfully.",
        order: {
          id: order.id,
          total_inr: order.total_inr,
          status: order.status,
          payment_status: order.payment_status,
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
