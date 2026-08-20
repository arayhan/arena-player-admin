import type { NextRequest } from "next/server";

/**
 * Derives an absolute redirect URL that honors the incoming reverse proxy's
 * `x-forwarded-host`, `host`, and `x-forwarded-proto` headers.
 *
 * When hosted behind reverse proxies or containers (like Hostinger, Nginx, or Docker),
 * Node's internal bound socket is often `0.0.0.0:3000` or `127.0.0.1:3000`. Relying solely
 * on `new URL(path, request.url)` yields `https://0.0.0.0:3000/...` which sends the user
 * to an unresolvable address.
 */
export function getRedirectUrl(request: NextRequest, targetPath: string): URL {
  const forwardHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();

  let host = forwardHost ?? hostHeader ?? request.nextUrl?.host;
  if (!host || host.startsWith("0.0.0.0")) {
    if (request.nextUrl?.host && !request.nextUrl.host.startsWith("0.0.0.0")) {
      host = request.nextUrl.host;
    } else {
      try {
        const parsedReqUrl = new URL(request.url);
        if (parsedReqUrl.host && !parsedReqUrl.host.startsWith("0.0.0.0")) {
          host = parsedReqUrl.host;
        }
      } catch {
        // ignore parse error
      }
    }
  }

  const forwardProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardProto ??
    (request.nextUrl?.protocol
      ? request.nextUrl.protocol.replace(":", "")
      : request.url.startsWith("https")
        ? "https"
        : "http");

  if (host && !host.startsWith("0.0.0.0")) {
    return new URL(targetPath, `${proto}://${host}`);
  }

  return new URL(targetPath, request.nextUrl ?? request.url);
}
