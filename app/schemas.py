from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ActionRequest(BaseModel):
    """A proposed AI agent action, submitted to the gateway before it executes."""

    action_type: str = Field(..., description="e.g. refund, wire_transfer, machine_control, chat_response")
    description: Optional[str] = Field("", description="Free-text description / prompt for the action")
    amount: Optional[float] = Field(None, description="Monetary amount involved, if any (EUR)")
    parameters: Optional[Dict[str, Any]] = Field(
        default=None, description="Structured parameters checked against hard safety constraints (e.g. {'rpm': 8000})"
    )


class ResolutionRequest(BaseModel):
    """A human operator's decision on a pending escalation."""

    approve: bool
    operator: str
    note: Optional[str] = ""
