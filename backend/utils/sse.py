"""
SSE (Server-Sent Events) helper utilities.

Provides a consistent format for all SSE events emitted by the worker.
"""


def sse_event(event_type: str, data: dict) -> dict:
    """
    Create a standardized SSE event dict.

    Args:
        event_type: One of plan_step, tool_call, tool_result, client_action,
                    knowledge_used, approval_required, final_response, error, stream_end
        data: Event payload (will be JSON-serialized by the SSE transport)

    Returns:
        Dict with "event" and "data" keys
    """
    return {"event": event_type, "data": data}
