const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>OmniVisibility Autopilot — Development</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f9fa; color: #152b3a; font: 16px system-ui, sans-serif; }
      main { max-width: 38rem; margin: 2rem; padding: 2rem; border: 1px solid #d6e0e4; border-radius: 12px; background: white; }
      h1 { margin: 0 0 .75rem; font-size: 1.5rem; }
      p { line-height: 1.5; }
    </style>
  </head>
  <body><main><h1>OmniVisibility Autopilot</h1><p>This development environment is being connected to Convex. The app will appear here after migration and verification.</p></main></body>
</html>`;

export default {
  fetch() {
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  },
};
