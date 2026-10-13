import Stripe from "stripe";
import { PLANS } from "./plans";

export { PLANS };

function readStripeKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (
    key.includes("placeholder") ||
    key.includes("your_") ||
    key.includes("xxx") ||
    key === "sk_test_" ||
    key.length < 20
  ) {
    return null;
  }
  return key;
}

export function isStripeConfigured(): boolean {
  return Boolean(readStripeKey());
}

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  const key = readStripeKey();
  if (!key) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }
  if (!_stripe) {
    _stripe = new Stripe(key, {
      apiVersion: "2025-12-15.clover",
    });
  }
  return _stripe;
}

/** Lazy proxy — no hardcoded placeholder secret key in source. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe() as any;
    const value = client[prop];
    return typeof value === "function"
      ? value.bind(client)
      : Reflect.get(client, prop, receiver);
  },
});
