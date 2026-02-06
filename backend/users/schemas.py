from ninja import Schema
from typing import List, Optional
from datetime import datetime

class AuthStatusOut(Schema):
    isLoggedIn: bool


class MessageOut(Schema):
    success: bool
    message: str

class MeOut(Schema):
    id: int
    username: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    isAdmin: bool


class PasswordChangeIn(Schema):
    current_password: str
    new_password: str


class ProfileUpdateIn(Schema):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserSearchOut(Schema):
    """Schema for user search results"""
    id: int
    username: str
    email: str
    first_name: str | None = None
    last_name: str | None = None


# ============ Team Schemas ============

class TeamMemberOut(Schema):
    """Schema for team member information"""
    id: int
    username: str
    email: str
    roles: List[str]
    joined_at: datetime


class TeamOut(Schema):
    """Schema for team details"""
    id: int
    name: str
    slug: str
    team_type: str
    owner_id: int
    owner_username: str
    member_count: int
    created_at: datetime
    updated_at: datetime


class TeamDetailOut(TeamOut):
    """Extended team schema with member list"""
    members: List[TeamMemberOut]


class TeamListOut(Schema):
    """Schema for list of teams (minimal info)"""
    id: int
    name: str
    slug: str
    team_type: str
    member_count: int
    is_owner: bool
    my_roles: List[str]


class TeamCreateIn(Schema):
    """Schema for creating a new team"""
    name: str
    slug: Optional[str] = None  # Auto-generated from name if not provided


class TeamUpdateIn(Schema):
    """Schema for updating team details"""
    name: Optional[str] = None
    slug: Optional[str] = None


class TeamMemberAddIn(Schema):
    """Schema for adding a member to team"""
    email: str
    roles: List[str] = ['viewer']  # Default to viewer role


class TeamMemberUpdateIn(Schema):
    """Schema for updating member roles"""
    roles: List[str]


class DashboardStatsOut(Schema):
    """Schema for dashboard statistics"""
    total_functions: int
    total_invocations: int
    total_deployments: int
    recent_invocations: int  # Last 24 hours


class InvocationTrendDataPoint(Schema):
    """Schema for invocation trend data point"""
    hour: str
    invocations: int
    errors: int


class FunctionUsageDataPoint(Schema):
    """Schema for function usage data"""
    name: str
    invocations: int
    runtime: str


class RuntimeDistributionDataPoint(Schema):
    """Schema for runtime distribution"""
    name: str
    value: int
    color: str


class RecentActivityItem(Schema):
    """Schema for recent activity item"""
    function_name: str
    status: str
    created_at: str
    duration_ms: Optional[int] = None


class EnhancedDashboardStatsOut(Schema):
    """Schema for enhanced dashboard statistics"""
    stats: DashboardStatsOut
    invocation_trend: List[InvocationTrendDataPoint]
    top_functions: List[FunctionUsageDataPoint]
    runtime_distribution: List[RuntimeDistributionDataPoint]
    recent_activity: List[RecentActivityItem]


# ============ OIDC Provider Schemas ============

class OIDCProviderOut(Schema):
    """Schema for OIDC provider details"""
    id: int
    provider_type: str
    provider_name: str
    client_id: str
    server_url: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class OIDCProviderCreateIn(Schema):
    """Schema for creating a new OIDC provider"""
    provider_type: str  # authelia, keycloak, or authentik
    provider_name: str
    client_id: str
    client_secret: str
    server_url: str
    enabled: bool = True


class OIDCProviderUpdateIn(Schema):
    """Schema for updating an OIDC provider"""
    provider_name: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None  # Only update if provided
    server_url: Optional[str] = None
    enabled: Optional[bool] = None


# ============ Site Settings Schemas ============

class SiteSettingsOut(Schema):
    """Schema for site settings"""
    allow_registration: bool


class SiteSettingsUpdateIn(Schema):
    """Schema for updating site settings"""
    allow_registration: bool
