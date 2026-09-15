import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [ip4("0.0.0.0"), ip4("0.255.255.255")],
  [ip4("10.0.0.0"), ip4("10.255.255.255")],
  [ip4("100.64.0.0"), ip4("100.127.255.255")], // shared/carrier-grade NAT
  [ip4("127.0.0.0"), ip4("127.255.255.255")],
  [ip4("169.254.0.0"), ip4("169.254.255.255")], // link-local, incl. cloud metadata
  [ip4("172.16.0.0"), ip4("172.31.255.255")],
  [ip4("192.0.0.0"), ip4("192.0.0.255")],
  [ip4("192.168.0.0"), ip4("192.168.255.255")],
  [ip4("198.18.0.0"), ip4("198.19.255.255")],
];

function ip4(addr: string): number {
  return addr
    .split(".")
    .reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIpv4(addr: string): boolean {
  const n = ip4(addr);
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIpv6(addr: string): boolean {
  const a = addr.toLowerCase();
  return (
    a === "::1" ||
    a.startsWith("fe80:") || // link-local
    a.startsWith("fc") ||
    a.startsWith("fd") || // unique local
    a.startsWith("::ffff:127.") ||
    a.startsWith("::ffff:10.") ||
    a.startsWith("::ffff:169.254.")
  );
}

/**
 * Fetches a user-supplied URL while blocking requests to private/internal
 * network destinations (SSRF guard), since the URL comes from client input.
 */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported.");
  }

  const hostname = parsed.hostname;
  const ipVersion = isIP(hostname);

  if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    throw new Error("That URL points to a private network address and can't be fetched.");
  }
  if (ipVersion === 6 && isPrivateIpv6(hostname)) {
    throw new Error("That URL points to a private network address and can't be fetched.");
  }
  if (ipVersion === 0) {
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      throw new Error("That URL points to a private network address and can't be fetched.");
    }
    const records = await lookup(hostname, { all: true });
    for (const record of records) {
      if (record.family === 4 && isPrivateIpv4(record.address)) {
        throw new Error("That URL resolves to a private network address and can't be fetched.");
      }
      if (record.family === 6 && isPrivateIpv6(record.address)) {
        throw new Error("That URL resolves to a private network address and can't be fetched.");
      }
    }
  }

  return fetch(parsed, { ...init, redirect: "follow" });
}
