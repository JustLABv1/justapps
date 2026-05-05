const getMetricsUrl = () => {
  const apiUrlValue =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8080/api/v1";

  try {
    const apiUrl = new URL(apiUrlValue);
    const backendBasePath = apiUrl.pathname.replace(/\/api\/v1\/?$/, "");

    apiUrl.pathname = `${backendBasePath.replace(/\/$/, "")}/metrics`;
    apiUrl.search = "";
    apiUrl.hash = "";

    return apiUrl;
  } catch {
    return new URL("http://localhost:8080/metrics");
  }
};

export async function GET() {
  const upstreamResponse = await fetch(getMetricsUrl(), {
    cache: "no-store",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: {
      "cache-control": upstreamResponse.headers.get("cache-control") || "no-store",
      "content-type":
        upstreamResponse.headers.get("content-type") ||
        "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}