
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "little_hug_dev_admin";
const SESSION_DURATION = 60 * 60 * 8; // 8 hours

function getSecret() {
  const secret = process.env.DEV_ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "DEV_ADMIN_SESSION_SECRET must be at least 32 characters."
    );
  }

  return secret;
}

export function isLocalDevelopment(request: NextRequest) {
  const host = request.headers.get("host");

  return (
    process.env.NODE_ENV === "development" &&
    (host === "localhost:3000" ||
      host === "127.0.0.1:3000")
  );
}

function sign(value: string) {
  return createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");
}

export function createAdminSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const value = String(expires);

  return {
    name: COOKIE_NAME,
    value: `${value}.${sign(value)}`,
    maxAge: SESSION_DURATION,
  };
}

export function hasAdminSession(request: NextRequest) {
  if (!isLocalDevelopment(request)) return false;

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return false;

  const [expires, suppliedSignature] = cookie.split(".");
  if (!expires || !suppliedSignature) return false;

  const expiry = Number(expires);
  if (!Number.isSafeInteger(expiry) ||
      expiry <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = Buffer.from(sign(expires), "hex");
  const supplied = Buffer.from(suppliedSignature, "hex");

  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

export { COOKIE_NAME };
