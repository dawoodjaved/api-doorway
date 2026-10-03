"use client";

import { useEffect, useState } from "react";
import { Play, Copy, CheckCircle2, Code2, FileText } from "lucide-react";

interface APIPlaygroundProps {
  apiKey?: string;
  apiSlug?: string;
  version?: string;
  endpoints?: Array<{
    method: string;
    path: string;
    description?: string;
  }>;
}

export function APIPlayground({
  apiKey,
  apiSlug,
  version = "1.0.0",
  endpoints = [],
}: APIPlaygroundProps) {
  const [selectedMethod, setSelectedMethod] = useState(
    endpoints[0]?.method || "GET"
  );
  const [selectedPath, setSelectedPath] = useState(endpoints[0]?.path || "/");
  const [requestBody, setRequestBody] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requestHistory, setRequestHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!endpoints.length) return;
    const match = endpoints.find(
      (e) => e.path === selectedPath && e.method === selectedMethod
    );
    if (!match) {
      setSelectedMethod(endpoints[0].method);
      setSelectedPath(endpoints[0].path);
    }
  }, [endpoints, selectedPath, selectedMethod]);

  const gatewayPath = apiSlug
    ? `/api/gateway/${apiSlug}/${version}${selectedPath.startsWith("/") ? selectedPath : `/${selectedPath}`}`
    : "";

  const handleSendRequest = async () => {
    if (!apiKey || !apiSlug) {
      alert("API key and API slug are required");
      return;
    }

    setLoading(true);
    try {
      const options: RequestInit = {
        method: selectedMethod,
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
      };

      if (selectedMethod !== "GET" && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(gatewayPath, options);
      const data = await res.json();

      const requestInfo = {
        method: selectedMethod,
        path: selectedPath,
        status: res.status,
        timestamp: new Date().toISOString(),
        response: data,
      };

      setResponse(requestInfo);
      setRequestHistory([requestInfo, ...requestHistory.slice(0, 9)]);
    } catch (error) {
      setResponse({
        error: error instanceof Error ? error.message : "Request failed",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCurl = () => {
    if (!apiKey || !apiSlug || typeof window === "undefined") return "";

    const url = `${window.location.origin}${gatewayPath}`;
    let curl = `curl -X ${selectedMethod} "${url}" \\\n  -H "X-API-Key: ${apiKey}"`;

    if (selectedMethod !== "GET" && requestBody) {
      curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${requestBody.replace(/'/g, "'\\''")}'`;
    }

    return curl;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSelectEndpoint = (value: string) => {
    const [method, ...pathParts] = value.split(" ");
    const path = pathParts.join(" ") || "/";
    setSelectedMethod(method);
    setSelectedPath(path);
  };

  return (
    <div className="rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-4 shadow-soft sm:p-6">
      <div className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-semibold text-ink sm:text-2xl">
          <Code2 className="h-5 w-5 shrink-0 text-accent sm:h-6 sm:w-6" />
          API Playground
        </h2>
        <p className="text-sm text-ink-muted sm:text-base">
          Test your API endpoints interactively
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Method</label>
            <div className="flex flex-wrap gap-2">
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSelectedMethod(method)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    selectedMethod === method
                      ? "bg-accent text-white"
                      : "border border-[rgba(11,18,32,0.08)] bg-canvas text-ink-muted hover:border-accent/40"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Endpoint</label>
            {endpoints.length > 0 ? (
              <select
                value={`${selectedMethod} ${selectedPath}`}
                onChange={(e) => onSelectEndpoint(e.target.value)}
                className="w-full rounded-lg border border-[rgba(11,18,32,0.08)] bg-canvas px-4 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {endpoints.map((endpoint, idx) => (
                  <option key={idx} value={`${endpoint.method} ${endpoint.path}`}>
                    {endpoint.method} {endpoint.path}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                placeholder="/endpoint/path"
                className="w-full rounded-lg border border-[rgba(11,18,32,0.08)] bg-canvas px-4 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            )}
          </div>

          {selectedMethod !== "GET" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">
                Request Body (JSON)
              </label>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={8}
                className="w-full rounded-lg border border-[rgba(11,18,32,0.08)] bg-canvas px-4 py-2 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleSendRequest}
            disabled={loading || !apiKey}
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                Sending...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Send Request
              </>
            )}
          </button>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-ink">cURL Command</label>
              <button
                type="button"
                onClick={() => copyToClipboard(generateCurl())}
                className="flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="w-full overflow-x-auto rounded-lg border border-[rgba(11,18,32,0.08)] bg-canvas px-4 py-3 font-mono text-xs text-ink-soft">
              {generateCurl() || "Select method and endpoint to generate cURL"}
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
              <FileText className="h-5 w-5" />
              Response
            </label>
            <div className="h-96 w-full overflow-auto rounded-lg border border-[rgba(11,18,32,0.08)] bg-canvas px-4 py-3 font-mono text-xs text-ink-soft">
              {response ? (
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(response, null, 2)}
                </pre>
              ) : (
                <div className="py-12 text-center text-ink-faint">
                  Send a request to see the response here
                </div>
              )}
            </div>
          </div>

          {requestHistory.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">
                Request History
              </label>
              <div className="max-h-32 space-y-2 overflow-y-auto">
                {requestHistory.map((req, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setResponse(req)}
                    className="w-full rounded-lg border border-[rgba(11,18,32,0.08)] bg-canvas px-3 py-2 text-left transition-all hover:border-accent/40"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-xs">
                      <span className="shrink-0 font-medium text-accent">{req.method}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-muted">{req.path}</span>
                      <span
                        className={
                          req.status >= 200 && req.status < 300
                            ? "shrink-0 text-emerald-600"
                            : "shrink-0 text-red-600"
                        }
                      >
                        {req.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
