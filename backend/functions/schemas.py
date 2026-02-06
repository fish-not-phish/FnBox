from ninja import Schema
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import field_validator


class FunctionCreateIn(Schema):
    """Schema for creating a new function"""
    name: str
    slug: Optional[str] = None
    description: str = ""
    code: str
    handler: str = "handler"
    runtime: str = "python3.11"
    memory_mb: int = 128
    vcpu_count: int = 1
    timeout_seconds: int = 30
    status: str = "draft"
    is_public: bool = False
    team_id: int
    depset_ids: List[int] = []
    secret_ids: List[int] = []

    @field_validator('memory_mb')
    @classmethod
    def validate_memory(cls, v):
        """Validate memory is within cluster LimitRange constraints"""
        if v < 64:
            raise ValueError('Memory must be at least 64MB')
        if v > 4096:
            raise ValueError('Memory cannot exceed 4096MB (4GB) per container due to cluster limits')
        return v

    @field_validator('vcpu_count')
    @classmethod
    def validate_vcpu(cls, v):
        """Validate vCPU is within cluster LimitRange constraints"""
        if v < 0.05:
            raise ValueError('vCPU count must be at least 0.05 (50 millicores)')
        if v > 2:
            raise ValueError('vCPU count cannot exceed 2 cores per container due to cluster limits')
        return v

    @field_validator('timeout_seconds')
    @classmethod
    def validate_timeout(cls, v):
        """Validate timeout is reasonable"""
        if v < 1:
            raise ValueError('Timeout must be at least 1 second')
        if v > 3600:
            raise ValueError('Timeout cannot exceed 3600 seconds (1 hour) - reasonable limit for function execution')
        return v


class FunctionUpdateIn(Schema):
    """Schema for updating a function"""
    name: Optional[str] = None
    description: Optional[str] = None
    code: Optional[str] = None
    handler: Optional[str] = None
    runtime: Optional[str] = None
    memory_mb: Optional[int] = None
    vcpu_count: Optional[int] = None
    timeout_seconds: Optional[int] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None
    depset_ids: Optional[List[int]] = None
    secret_ids: Optional[List[int]] = None

    @field_validator('memory_mb')
    @classmethod
    def validate_memory(cls, v):
        """Validate memory is within cluster LimitRange constraints"""
        if v is not None:
            if v < 64:
                raise ValueError('Memory must be at least 64MB')
            if v > 4096:
                raise ValueError('Memory cannot exceed 4096MB (4GB) per container due to cluster limits')
        return v

    @field_validator('vcpu_count')
    @classmethod
    def validate_vcpu(cls, v):
        """Validate vCPU is within cluster LimitRange constraints"""
        if v is not None:
            if v < 0.05:
                raise ValueError('vCPU count must be at least 0.05 (50 millicores)')
            if v > 2:
                raise ValueError('vCPU count cannot exceed 2 cores per container due to cluster limits')
        return v

    @field_validator('timeout_seconds')
    @classmethod
    def validate_timeout(cls, v):
        """Validate timeout is reasonable"""
        if v is not None:
            if v < 1:
                raise ValueError('Timeout must be at least 1 second')
            if v > 3600:
                raise ValueError('Timeout cannot exceed 3600 seconds (1 hour) - reasonable limit for function execution')
        return v


class FunctionListOut(Schema):
    """Schema for function list view"""
    id: int
    uuid: UUID
    name: str
    slug: str
    description: str
    runtime: str
    status: str
    invocation_count: int
    last_invoked_at: Optional[datetime] = None
    created_at: datetime


class FunctionDetailOut(Schema):
    """Schema for detailed function view"""
    id: int
    uuid: UUID
    name: str
    slug: str
    description: str
    team_id: int
    team_name: str
    code: str
    handler: str
    runtime: str
    memory_mb: int
    vcpu_count: int
    timeout_seconds: int
    status: str
    is_public: bool
    invocation_count: int
    last_invoked_at: Optional[datetime] = None
    last_deployed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by_username: Optional[str] = None
    depset_count: int
    secret_count: int
    depset_ids: List[int]
    secret_ids: List[int]
    trigger_count: int
    deployment_name: Optional[str] = None
    service_name: Optional[str] = None
    k8s_namespace: Optional[str] = None


class TriggerCreateIn(Schema):
    """Schema for creating a new trigger"""
    name: str
    trigger_type: str  # 'scheduled' or 'http'
    schedule: Optional[str] = None  # Cron expression for scheduled triggers
    enabled: bool = True


class TriggerUpdateIn(Schema):
    """Schema for updating a trigger"""
    name: Optional[str] = None
    schedule: Optional[str] = None
    enabled: Optional[bool] = None


class TriggerOut(Schema):
    """Schema for trigger output"""
    id: int
    uuid: UUID
    function_id: int
    function_name: str
    function_uuid: UUID
    name: str
    trigger_type: str
    schedule: Optional[str] = None
    enabled: bool
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime] = None
    created_by_username: Optional[str] = None


class DeployOut(Schema):
    """Schema for deployment response"""
    success: bool
    message: str
    deployment_name: Optional[str] = None
    service_name: Optional[str] = None
    status: Optional[str] = None
    deployed_at: datetime


class UndeployOut(Schema):
    """Schema for undeployment response"""
    success: bool
    message: str


class DeploymentStatusOut(Schema):
    """Schema for deployment status polling"""
    status: str  # 'draft', 'deploying', 'active', 'undeploying', 'error'
    deployment_name: Optional[str] = None
    service_name: Optional[str] = None
    k8s_namespace: Optional[str] = None
    last_deployed_at: Optional[datetime] = None


class InvocationOut(Schema):
    """Schema for invocation/log output"""
    id: int
    request_id: str
    status: str
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    error_message: str
    duration_ms: Optional[int] = None
    memory_used_mb: Optional[int] = None
    logs: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class InvocationListOut(Schema):
    """Schema for team-level invocation list with function details"""
    id: int
    request_id: str
    status: str
    function_id: int
    function_uuid: UUID
    function_name: str
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    error_message: str
    duration_ms: Optional[int] = None
    memory_used_mb: Optional[int] = None
    logs: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
