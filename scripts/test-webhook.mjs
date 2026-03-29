/**
 * Test script to simulate Lemon Squeezy order_created webhook
 * Run with: node scripts/test-webhook.mjs
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
let webhookSecret = "dummy_secret_for_local_testing";
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  const match = envFile.match(/LEMONSQUEEZY_WEBHOOK_SECRET=(.*)/);
  if (match && match[1]) {
    webhookSecret = match[1].trim();
  }
}

const WEBHOOK_SECRET = webhookSecret;

const mockPayload = {
  meta: {
    event_name: "order_created",
    custom_data: {
      user_id: "test_user_67890" // ID của người mua giả lập
    }
  },
  data: {
    type: "orders",
    id: "123456", // Lemon Squeezy Order ID
    attributes: {
      store_id: 1,
      customer_id: 67890,
      identifier: "LS-1234-5678",
      order_number: 1234,
      user_name: "John Doe",
      user_email: "john@example.com",
      currency: "USD",
      currency_rate: "1.0000",
      subtotal: 5000,
      total: 5000,
      tax: 0,
      status: "paid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      first_order_item: {
        id: 1001,
        order_id: 123456,
        product_id: 888,
        variant_id: 999, // ID ảo của LemonSqueezy Variant, cần giống trong bảng products
        product_name: "Masterclass: Guitar Soloing",
        variant_name: "Default",
        price: 5000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        test_mode: true
      }
    }
  }
};

async function runTest() {
  const payloadString = JSON.stringify(mockPayload);
  
  // Calculate signature
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const signature = hmac.update(payloadString).digest("hex");

  console.log("Sending mock Lemon Squeezy webhook...");
  console.log("Signature:", signature);
  
  try {
    const res = await fetch("http://localhost:3000/api/webhooks/lemonsqueezy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature
      },
      body: payloadString
    });

    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Body:", data);
    
    if (res.status === 200) {
      console.log("✅ Webhook hit successful!");
      console.log("Check your Next.js terminal for the [Webhook] logs.");
      console.log("Note: It may warn about missing variantId if 'products' collection is barren, which is expected!");
    } else {
      console.error("❌ Webhook failed.");
    }
  } catch (error) {
    console.error("Error calling local webhook:", error);
  }
}

runTest();
