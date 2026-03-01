import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing URL", { status: 400 });
  }

  try {
    const url = new URL(targetUrl);
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const proxyBase = `${new URL(request.url).origin}/api/proxy?url=`;

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    let html = await response.text();

    // 1. Inject <base> tag so relative images/styles work
    const baseTag = `<base href="${baseUrl}/">`;
    
    // 2. Inject "Link Hijacker" Script
    // This script intercepts clicks at the document level to bypass JS framework behavior
    const hijackerScript = `
      <script>
        (function() {
          const PROXY_URL = "${proxyBase}";
          
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href) {
              // Prevent standard navigation
              e.preventDefault();
              e.stopPropagation();
              
              let targetHref = link.href;
              
              // If it's already a proxied URL, just use it
              if (targetHref.startsWith(window.location.origin + '/api/proxy')) {
                window.location.href = targetHref;
                return;
              }

              // Route through proxy and force self
              const newUrl = PROXY_URL + encodeURIComponent(targetHref);
              window.location.href = newUrl;
            }
          }, true);

          // Periodically force target="_self" on all links as a backup
          setInterval(() => {
            document.querySelectorAll('a').forEach(a => {
              a.setAttribute('target', '_self');
            });
          }, 1000);
        })();
      </script>
    `;

    // Combine injections
    html = html.replace("<head>", `<head>${baseTag}${hijackerScript}`);

    // 3. Static rewrite for safety (handles non-JS environments)
    html = html.replace(/target="_blank"/g, 'target="_self"');

    const newResponse = new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "X-Frame-Options": "ALLOWALL",
        "Access-Control-Allow-Origin": "*",
        "Content-Security-Policy": "frame-ancestors *",
      },
    });

    return newResponse;
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse("Failed to fetch content", { status: 500 });
  }
}
