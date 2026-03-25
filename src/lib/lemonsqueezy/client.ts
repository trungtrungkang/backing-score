import {
  lemonSqueezySetup,
  createCheckout as lsCreateCheckout,
  getSubscription as lsGetSubscription,
  cancelSubscription as lsCancelSubscription,
  type NewCheckout,
} from "@lemonsqueezy/lemonsqueezy.js";

// Initialize LemonSqueezy SDK
const apiKey = process.env.LEMONSQUEEZY_API_KEY;
if (!apiKey) {
  console.warn("[LemonSqueezy] LEMONSQUEEZY_API_KEY not set — payment features disabled");
}

lemonSqueezySetup({ apiKey: apiKey || "" });

const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || "";

/**
 * Create a LemonSqueezy checkout session for a user.
 * @param userId Appwrite user ID (stored as custom data for webhook matching)
 * @param userEmail User's email (pre-fills the checkout)
 * @param variantId LemonSqueezy variant ID (monthly/yearly plan)
 * @returns Checkout URL to redirect user to
 */
export async function createCheckout(
  userId: string,
  userEmail: string,
  variantId: string,
): Promise<string> {
  const checkoutData: NewCheckout = {
    productOptions: {
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://backingscore.com"}/en/dashboard?checkout=success`,
    },
    checkoutData: {
      email: userEmail,
      custom: { user_id: userId },
    },
  };

  const response = await lsCreateCheckout(STORE_ID, variantId, checkoutData);

  if (response.error) {
    throw new Error(`LemonSqueezy checkout error: ${response.error.message}`);
  }

  const url = response.data?.data.attributes.url;
  if (!url) {
    throw new Error("No checkout URL returned from LemonSqueezy");
  }

  return url;
}

/**
 * Fetch a subscription's current status from LemonSqueezy.
 */
export async function getSubscription(subscriptionId: string) {
  const response = await lsGetSubscription(subscriptionId);
  if (response.error) {
    throw new Error(`LemonSqueezy getSubscription error: ${response.error.message}`);
  }
  return response.data?.data;
}

/**
 * Cancel a subscription at the end of the current billing period.
 */
export async function cancelSubscription(subscriptionId: string) {
  const response = await lsCancelSubscription(subscriptionId);
  if (response.error) {
    throw new Error(`LemonSqueezy cancel error: ${response.error.message}`);
  }
  return response.data?.data;
}
