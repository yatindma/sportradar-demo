/**
 * useAgentStream — Core SSE hook for SportScout AI
 *
 * Sends user messages to the backend via POST /api/chat and parses the
 * SSE event stream in real-time. Manages all agent state: messages,
 * plan steps, trace entries, chart/table data, knowledge sources,
 * approval flow, and streaming response.
 *
 * SSE Event Types Handled (ReAct Agent):
 *   agent_thinking, knowledge_used, plan_step,
 *   tool_call, tool_result, tool_retry, client_action, response_chunk,
 *   approval_required, final_response, error, stream_end
 */
import { useState, useCallback, useRef } from "react";

/** Base URL for all API calls */
const API_BASE = "/api";
const SUPPORTED_CHART_TYPES = ["radar", "bar", "line", "area", "pie", "scatter", "histogram", "gaussian"];

const CHART_COLORS = ["#f97316", "#3b82f6", "#f43f5e", "#f59e0b", "#22c55e", "#06b6d4"];

/**
 * Normalize backend chart payloads to frontend chart contract.
 * Supports:
 * - Native frontend shape: { labels, datasets }
 * - Backend chart rows: { chart_type: string, data: [{ category, ...players }] }
 *
 * @param {object} payload
 * @returns {object|null}
 */
function normalizeChartPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  // Already in frontend shape
  if (Array.isArray(payload.labels) && Array.isArray(payload.datasets)) {
    return payload;
  }

  // Backend chart shape from compare_entities tool
  if (SUPPORTED_CHART_TYPES.includes(payload.chart_type) && Array.isArray(payload.data)) {
    const rows = payload.data;
    const labels = rows.map((row) => row.category ?? row.stat ?? row.label ?? "");

    // Extract player names — try payload.players first, then infer from row keys
    const playerNames =
      Array.isArray(payload.players) && payload.players.length > 0
        ? payload.players
        : Object.keys(rows[0] || {}).filter((k) => !["category", "stat", "label"].includes(k));

    // Build datasets — if the exact name key doesn't match (encoding), try fuzzy match
    const datasets = playerNames.map((name, i) => {
      const values = rows.map((row) => {
        if (row[name] !== undefined) return Number(row[name]);
        // Fuzzy fallback: find key that matches after normalizing Unicode
        const normalizedName = name.normalize("NFC");
        const matchKey = Object.keys(row).find(
          (k) => k !== "category" && k !== "stat" && k !== "label" && k.normalize("NFC") === normalizedName
        );
        return matchKey !== undefined ? Number(row[matchKey]) : 0;
      });
      return {
        name,
        values,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });

    return {
      chart_type: payload.chart_type,
      title: payload.title || (playerNames.length > 0 ? `${playerNames.join(" vs ")} Comparison` : undefined),
      labels,
      datasets,
    };
  }

  return null;
}

/**
 * Generate a unique session ID (UUID v4 approximation).
 * @returns {string} A random session identifier.
 */
function generateSessionId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parse an SSE text buffer into discrete events.
 * Handles chunked data by buffering until a double-newline delimiter.
 *
 * @param {string} raw - Raw SSE text chunk (may contain partial events)
 * @param {string} buffer - Carry-over buffer from previous chunk
 * @returns {{ events: Array<{event: string, data: string}>, remaining: string }}
 */
function parseSSE(raw, buffer = "") {
  // Normalize CRLF/LF so parsing works across SSE servers/platforms.
  const combined = (buffer + raw).replace(/\r\n/g, "\n");
  const blocks = combined.split("\n\n");
  const remaining = blocks.pop() || "";
  const events = [];

  for (const block of blocks) {
    if (!block.trim()) continue;

    let eventType = "message";
    let dataLines = [];

    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      } else if (line.startsWith(":")) {
        // SSE comment — ignore (keep-alive)
      }
    }

    if (dataLines.length > 0) {
      events.push({ event: eventType, data: dataLines.join("\n") });
    }
  }

  return { events, remaining };
}

/**
 * React hook for managing the SportScout AI agent stream.
 *
 * @returns {{
 *   messages: Array,
 *   planSteps: Array,
 *   traceEntries: Array,
 *   chartData: object|null,
 *   tableData: object|null,
 *   knowledgeSources: Array,
 *   approvalRequest: object|null,
 *   planningPhase: string|null,
 *   planningThinking: string|null,
 *   streamingResponse: string,
 *   isStreaming: boolean,
 *   toasts: Array,
 *   sendMessage: (text: string) => Promise<void>,
 *   sendApproval: (stepId: number, approved: boolean) => Promise<void>,
 *   clearResults: () => void,
 *   dismissToast: (id: number) => void,
 * }}
 */
export default function useAgentStream({ authToken = null } = {}) {
  const [messages, setMessages] = useState([]);
  const [planSteps, setPlanSteps] = useState([]);
  const [traceEntries, setTraceEntries] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [downloadFile, setDownloadFile] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [planningPhase, setPlanningPhase] = useState(null); // "thinking" | null (simplified for ReAct)
  const [planningThinking, setPlanningThinking] = useState(null); // Agent's reasoning text
  const [streamingResponse, setStreamingResponse] = useState(""); // Token-by-token final response
  const [knowledgeSources, setKnowledgeSources] = useState([]); // Active knowledge sources

  // Refs to track current values for final_response (avoids nested setState / StrictMode double-invoke)
  const chartDataRef = useRef(null);
  const tableDataRef = useRef(null);
  const downloadFileRef = useRef(null);
  const planStepsRef = useRef([]);
  const planningThinkingRef = useRef(null);
  const knowledgeSourcesRef = useRef([]);

  const sessionIdRef = useRef(generateSessionId());
  const toastIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  /**
   * Add a toast notification.
   * @param {string} message
   * @param {"info"|"success"|"error"} type
   */
  const addToast = useCallback((message, type = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  /**
   * Dismiss a specific toast by ID.
   * @param {number} id
   */
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Handle a parsed SSE event and update the appropriate state.
   * @param {string} eventType
   * @param {object} data
   */
  const handleEvent = useCallback(
    (eventType, data) => {
      switch (eventType) {
        case "agent_thinking": {
          setPlanningPhase("thinking");
          setPlanningThinking(data.thinking || null);
          planningThinkingRef.current = data.thinking || null;
          break;
        }

        case "knowledge_used": {
          setKnowledgeSources(data.sources || []);
          knowledgeSourcesRef.current = data.sources || [];
          break;
        }

        // Legacy event support (backwards compat)
        case "planning_started": {
          setPlanningPhase("thinking");
          break;
        }
        case "planning_thinking": {
          setPlanningPhase("thinking");
          setPlanningThinking(data.thinking || null);
          planningThinkingRef.current = data.thinking || null;
          break;
        }
        case "planning_complete": {
          break;
        }

        case "response_chunk": {
          setStreamingResponse((prev) => prev + (data.chunk || ""));
          break;
        }

        case "plan_step": {
          setPlanSteps((prev) => {
            const updated = prev.find((s) => s.id === data.id)
              ? prev.map((s) => (s.id === data.id ? { ...s, ...data } : s))
              : [...prev, data];
            planStepsRef.current = updated;
            return updated;
          });
          break;
        }

        case "tool_call": {
          setTraceEntries((prev) => [
            ...prev,
            {
              type: "tool_call",
              stepId: data.step_id,
              tool: data.tool,
              params: data.params,
              timestamp: Date.now(),
            },
          ]);
          break;
        }

        case "tool_retry": {
          setTraceEntries((prev) => [
            ...prev,
            {
              type: "tool_retry",
              stepId: data.step_id,
              attempt: data.attempt,
              maxRetries: data.max_retries,
              backoffSeconds: data.backoff_seconds,
              endpoint: data.endpoint,
              timestamp: Date.now(),
            },
          ]);
          addToast(
            `Rate limited — retried ${data.endpoint?.split("/").pop() || "request"} (attempt ${data.attempt}/${data.max_retries})`,
            "info"
          );
          break;
        }

        case "tool_result": {
          setTraceEntries((prev) => [
            ...prev,
            {
              type: "tool_result",
              stepId: data.step_id,
              status: data.status,
              elapsedMs: data.elapsed_ms,
              summary: data.summary,
              error: data.error,
              data: data.data,
              timestamp: Date.now(),
            },
          ]);
          // Update plan step with elapsed time + error info
          setPlanSteps((prev) => {
            const updated = prev.map((s) =>
              s.id === data.step_id
                ? {
                    ...s,
                    elapsedMs: data.elapsed_ms,
                    summary: data.summary,
                    resultStatus: data.status,
                    error: data.error,
                  }
                : s
            );
            planStepsRef.current = updated;
            return updated;
          });
          break;
        }


        case "client_action": {
          if (Array.isArray(data)) {
            data.forEach((action) => handleClientAction(action));
          } else {
            handleClientAction(data);
          }
          break;
        }

        case "approval_required": {
          setApprovalRequest(data);
          break;
        }

        case "final_response": {
          // Read current values from refs (safe — no nested setState / StrictMode issues)
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.message,
              timestamp: Date.now(),
              chartData: chartDataRef.current || undefined,
              tableData: tableDataRef.current || undefined,
              downloadFile: downloadFileRef.current || undefined,
              reasoning: {
                thinking: planningThinkingRef.current || null,
                steps: planStepsRef.current.length > 0 ? [...planStepsRef.current] : [],
                sources: knowledgeSourcesRef.current.length > 0 ? [...knowledgeSourcesRef.current] : [],
              },
            },
          ]);
          // Clear streaming state
          setStreamingResponse("");
          setPlanningPhase(null);
          break;
        }

        case "error": {
          addToast(data.message || "An error occurred", "error");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Error: ${data.message}`,
              timestamp: Date.now(),
              isError: true,
            },
          ]);
          break;
        }

        case "stream_end": {
          setIsStreaming(false);
          setPlanningPhase(null);
          setPlanningThinking(null);
          setStreamingResponse("");
          break;
        }

        default:
          break;
      }
    },
    [addToast]
  );

  /**
   * Handle client_action events (chart, download, table, toast).
   * @param {object} action
   */
  const handleClientAction = useCallback(
    (action) => {
      switch (action.type) {
        case "render_chart": {
          const normalized = normalizeChartPayload(action.payload || action);
          setChartData(normalized);
          chartDataRef.current = normalized;
          break;
        }

        case "render_table": {
          const tbl = action.payload || action;
          setTableData(tbl);
          tableDataRef.current = tbl;
          break;
        }

        case "download_file": {
          // Store download info — user must click a button to trigger download
          const payload = action.payload || action;
          const { filename, content, mime_type } = payload;
          if (content && filename) {
            setDownloadFile({ filename, content, mime_type: mime_type || "text/plain" });
            downloadFileRef.current = { filename, content, mime_type: mime_type || "text/plain" };
            // Clear chart/table so they don't render as empty blocks alongside the download
            setChartData(null);
            setTableData(null);
            chartDataRef.current = null;
            tableDataRef.current = null;
          }
          break;
        }

        case "show_toast":
          addToast(action.payload?.message || action.message || "Done", "success");
          break;

        default:
          break;
      }
    },
    [addToast]
  );

  /**
   * Send a user message to the backend and begin streaming the response.
   * @param {string} text - The user's natural language query
   */
  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || isStreaming) return;
      if (!authToken) {
        addToast("Please login first.", "error");
        return;
      }

      // Reset transient state for new query
      setPlanSteps([]);
      setTraceEntries([]);
      setChartData(null);
      setTableData(null);
      setApprovalRequest(null);
      setDownloadFile(null);
      setPlanningPhase(null);
      setPlanningThinking(null);
      setStreamingResponse("");
      setKnowledgeSources([]);

      // Reset refs for new query
      chartDataRef.current = null;
      tableDataRef.current = null;
      downloadFileRef.current = null;
      planStepsRef.current = [];
      planningThinkingRef.current = null;
      knowledgeSourcesRef.current = [];

      // Add user message
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, timestamp: Date.now() },
      ]);

      setIsStreaming(true);

      // Cancel any in-flight request before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        let parsedEventCount = 0;
        const response = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            session_id: sessionIdRef.current,
            auth_token: authToken,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const { events, remaining } = parseSSE(chunk, buffer);
          buffer = remaining;

          for (const evt of events) {
            try {
              const data = JSON.parse(evt.data);
              handleEvent(evt.event, data);
              parsedEventCount += 1;
            } catch {
              // Non-JSON data line — skip
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const { events } = parseSSE(buffer + "\n\n", "");
          for (const evt of events) {
            try {
              const data = JSON.parse(evt.data);
              handleEvent(evt.event, data);
              parsedEventCount += 1;
            } catch {
              // skip
            }
          }
        }

        if (parsedEventCount === 0) {
          addToast("Stream received but no events were parsed. Please refresh and retry.", "error");
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        addToast(`Connection failed: ${err.message}`, "error");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Failed to connect to the server. Please ensure the backend is running.`,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, handleEvent, addToast, authToken]
  );

  /**
   * Send an approval or denial for a gated action.
   * @param {number} stepId - The plan step awaiting approval
   * @param {boolean} approved - Whether to approve or deny
   */
  const sendApproval = useCallback(
    async (stepId, approved) => {
      if (!authToken) {
        addToast("Please login first.", "error");
        return;
      }
      try {
        await fetch(`${API_BASE}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step_id: stepId,
            session_id: sessionIdRef.current,
            approved,
            auth_token: authToken,
          }),
        });
        setApprovalRequest(null);
      } catch (err) {
        addToast(`Approval request failed: ${err.message}`, "error");
      }
    },
    [addToast, authToken]
  );

  /**
   * Clear all result panel data.
   */
  const clearResults = useCallback(() => {
    setChartData(null);
    setTableData(null);
  }, []);

  return {
    messages,
    planSteps,
    traceEntries,
    chartData,
    tableData,
    approvalRequest,
    downloadFile,
    isStreaming,
    toasts,
    planningPhase,
    planningThinking,
    streamingResponse,
    knowledgeSources,
    sendMessage,
    sendApproval,
    clearResults,
    dismissToast,
  };
}
