from ninja import Router
from django.middleware.csrf import get_token
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from django.contrib.auth.models import User
from django.db import models
from typing import List
from .schemas import *
from .models import UserProfile, Team, TeamMember, OIDCProvider, SiteSettings
from .auth import session_mfa_auth
from ninja.errors import HttpError

router = Router(tags=["auth"])


def is_admin_user(user):
    """Check if user is an administrator (staff, superuser, or custom admin)"""
    if user.is_staff or user.is_superuser:
        return True
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile.is_admin


# ======================
# CSRF
# ======================

@router.get("/csrf", response=dict)
def get_csrf(request: HttpRequest):
    """
    Fetch CSRF token for frontend (Next.js, etc.)
    """
    return {"csrfToken": get_token(request)}


# ======================
# Auth status
# ======================

@router.get("/status", response=AuthStatusOut)
def auth_status(request: HttpRequest):
    return {"isLoggedIn": request.user.is_authenticated}

@router.get("/me", response=MeOut, auth=session_mfa_auth)
def me(request):
    u = request.auth
    return {
        "id": u.id,
        "username": getattr(u, "get_username")() if hasattr(u, "get_username") else u.username,
        "email": getattr(u, "email", None),
        "first_name": getattr(u, "first_name", None),
        "last_name": getattr(u, "last_name", None),
        "isAdmin": is_admin_user(u)
    }


@router.post("/change-password", response=MessageOut, auth=session_mfa_auth)
def change_password(request, payload: PasswordChangeIn):
    """Change user password"""
    user = request.auth

    # Verify current password
    if not user.check_password(payload.current_password):
        return {"success": False, "message": "Current password is incorrect"}

    # Validate new password length
    if len(payload.new_password) < 8:
        return {"success": False, "message": "New password must be at least 8 characters"}

    # Set new password
    user.set_password(payload.new_password)
    user.save()

    return {"success": True, "message": "Password changed successfully"}


@router.patch("/profile", response=MeOut, auth=session_mfa_auth)
def update_profile(request, payload: ProfileUpdateIn):
    """Update user profile information"""
    user = request.auth

    # Update fields if provided
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name

    user.save()

    return {
        "id": user.id,
        "username": getattr(user, "get_username")() if hasattr(user, "get_username") else user.username,
        "email": getattr(user, "email", None),
        "first_name": getattr(user, "first_name", None),
        "last_name": getattr(user, "last_name", None),
        "isAdmin": is_admin_user(user)
    }


@router.get("/users/search", response=List[UserSearchOut], auth=session_mfa_auth)
def search_users(request, q: str = ""):
    """Search for users by email or username"""
    if not q or len(q) < 2:
        return []

    # Search for users matching the query (case-insensitive)
    users = User.objects.filter(
        models.Q(email__icontains=q) |
        models.Q(username__icontains=q) |
        models.Q(first_name__icontains=q) |
        models.Q(last_name__icontains=q)
    )[:10]  # Limit to 10 results

    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
        }
        for u in users
    ]


# ============ Team CRUD ============

@router.get("/teams", response=List[TeamListOut], auth=session_mfa_auth)
def list_teams(request):
    """List all teams the authenticated user is a member of"""
    user = request.auth
    teams = Team.objects.filter(members=user).prefetch_related('members')

    return [
        {
            "id": team.id,
            "name": team.name,
            "slug": team.slug,
            "team_type": team.team_type,
            "member_count": team.members.count(),
            "is_owner": team.owner_id == user.id,
            "my_roles": TeamMember.objects.get(team=team, user=user).roles
        }
        for team in teams
    ]


@router.get("/teams/{slug}", response=TeamDetailOut, auth=session_mfa_auth)
def get_team(request, slug: str):
    """Get detailed information about a specific team"""
    user = request.auth
    team = get_object_or_404(Team, slug=slug, members=user)

    members = TeamMember.objects.filter(team=team).select_related('user')

    return {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "team_type": team.team_type,
        "owner_id": team.owner_id,
        "owner_username": team.owner.username,
        "member_count": members.count(),
        "created_at": team.created_at,
        "updated_at": team.updated_at,
        "members": [
            {
                "id": m.user.id,
                "username": m.user.username,
                "email": m.user.email,
                "roles": m.roles,
                "joined_at": m.joined_at
            }
            for m in members
        ]
    }


@router.post("/teams", response=TeamOut, auth=session_mfa_auth)
def create_team(request, payload: TeamCreateIn):
    """Create a new shared team"""
    user = request.auth

    # Auto-generate slug from name if not provided
    if not payload.slug:
        base_slug = slugify(payload.name)
        slug = base_slug
        counter = 1
        while Team.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
    else:
        slug = slugify(payload.slug)
        if Team.objects.filter(slug=slug).exists():
            return {"error": "Slug already exists"}, 400

    # Create team
    team = Team.objects.create(
        name=payload.name,
        slug=slug,
        team_type='shared',
        owner=user
    )

    # Add creator as owner member
    TeamMember.objects.create(team=team, user=user, roles=['owner'])

    return {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "team_type": team.team_type,
        "owner_id": team.owner_id,
        "owner_username": team.owner.username,
        "member_count": 1,
        "created_at": team.created_at,
        "updated_at": team.updated_at
    }


@router.patch("/teams/{slug}", response=TeamOut, auth=session_mfa_auth)
def update_team(request, slug: str, payload: TeamUpdateIn):
    """Update team details (owner/admin only)"""
    user = request.auth
    team = get_object_or_404(Team, slug=slug)

    # Check permissions
    membership = TeamMember.objects.filter(team=team, user=user).first()
    if not membership or not (membership.has_role('owner') or membership.has_role('admin')):
        return {"error": "Permission denied"}, 403

    # Update fields
    if payload.name:
        team.name = payload.name

    if payload.slug:
        new_slug = slugify(payload.slug)
        if new_slug != team.slug and Team.objects.filter(slug=new_slug).exists():
            return {"error": "Slug already exists"}, 400
        team.slug = new_slug

    team.save()

    return {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "team_type": team.team_type,
        "owner_id": team.owner_id,
        "owner_username": team.owner.username,
        "member_count": team.members.count(),
        "created_at": team.created_at,
        "updated_at": team.updated_at
    }


@router.delete("/teams/{slug}", response=MessageOut, auth=session_mfa_auth)
def delete_team(request, slug: str):
    """Delete a team (owner only, cannot delete personal teams)"""
    user = request.auth
    team = get_object_or_404(Team, slug=slug, owner=user)

    if team.team_type == 'personal':
        return {"success": False, "message": "Cannot delete personal team"}

    team.delete()
    return {"success": True, "message": "Team deleted successfully"}


# ============ Team Membership Management ============

@router.post("/teams/{slug}/members", response=MessageOut, auth=session_mfa_auth)
def add_team_member(request, slug: str, payload: TeamMemberAddIn):
    """Add a member to the team (owner/admin only)"""
    user = request.auth
    team = get_object_or_404(Team, slug=slug)

    # Check permissions
    membership = TeamMember.objects.filter(team=team, user=user).first()
    if not membership or not (membership.has_role('owner') or membership.has_role('admin')):
        return {"success": False, "message": "Permission denied"}

    # Get user to add by email
    new_member = get_object_or_404(User, email=payload.email)

    # Check if already a member
    if TeamMember.objects.filter(team=team, user=new_member).exists():
        return {"success": False, "message": "User is already a member"}

    # Validate roles
    valid_roles = ['owner', 'admin', 'editor', 'runner', 'viewer']
    for role in payload.roles:
        if role not in valid_roles:
            return {"success": False, "message": f"Invalid role: {role}"}

    # Only owner can add other owners
    if 'owner' in payload.roles and not membership.has_role('owner'):
        return {"success": False, "message": "Only owner can add other owners"}

    # Apply role inheritance: if owner or admin, set only that role
    final_roles = payload.roles
    if 'owner' in payload.roles:
        final_roles = ['owner']
    elif 'admin' in payload.roles:
        final_roles = ['admin']

    # Add member
    TeamMember.objects.create(team=team, user=new_member, roles=final_roles)

    return {"success": True, "message": "Member added successfully"}


@router.patch("/teams/{slug}/members/{user_id}", response=MessageOut, auth=session_mfa_auth)
def update_team_member_role(request, slug: str, user_id: int, payload: TeamMemberUpdateIn):
    """Update a team member's roles (owner/admin only)"""
    user = request.auth
    team = get_object_or_404(Team, slug=slug)

    # Check requester permissions
    requester_membership = TeamMember.objects.filter(team=team, user=user).first()
    if not requester_membership or not (requester_membership.has_role('owner') or requester_membership.has_role('admin')):
        return {"success": False, "message": "Permission denied"}

    # Get target member
    target_member = get_object_or_404(TeamMember, team=team, user_id=user_id)

    # Validate roles
    valid_roles = ['owner', 'admin', 'editor', 'runner', 'viewer']
    for role in payload.roles:
        if role not in valid_roles:
            return {"success": False, "message": f"Invalid role: {role}"}

    # Only owner can change roles to/from owner
    if ('owner' in payload.roles or target_member.has_role('owner')) and not requester_membership.has_role('owner'):
        return {"success": False, "message": "Only owner can manage owner role"}

    # Cannot demote yourself if you're the only owner
    if user_id == user.id and target_member.has_role('owner'):
        owner_count = sum(1 for m in TeamMember.objects.filter(team=team) if m.has_role('owner'))
        if owner_count <= 1 and 'owner' not in payload.roles:
            return {"success": False, "message": "Cannot demote the only owner"}

    # Apply role inheritance: if owner or admin, set only that role
    final_roles = payload.roles
    if 'owner' in payload.roles:
        final_roles = ['owner']
    elif 'admin' in payload.roles:
        final_roles = ['admin']

    # Update roles
    target_member.roles = final_roles
    target_member.save()

    return {"success": True, "message": "Member roles updated successfully"}


@router.delete("/teams/{slug}/members/{user_id}", response=MessageOut, auth=session_mfa_auth)
def remove_team_member(request, slug: str, user_id: int):
    """Remove a member from the team (owner/admin only, or self-removal)"""
    user = request.auth
    team = get_object_or_404(Team, slug=slug)

    # Personal teams cannot have members removed
    if team.team_type == 'personal':
        return {"success": False, "message": "Cannot remove members from personal team"}

    # Get target membership
    target_member = get_object_or_404(TeamMember, team=team, user_id=user_id)

    # Allow self-removal
    if user_id == user.id:
        # Cannot leave if you're the only owner
        if target_member.has_role('owner'):
            owner_count = sum(1 for m in TeamMember.objects.filter(team=team) if m.has_role('owner'))
            if owner_count <= 1:
                return {"success": False, "message": "Cannot leave as the only owner"}
        target_member.delete()
        return {"success": True, "message": "Left team successfully"}

    # Check permissions for removing others
    requester_membership = TeamMember.objects.filter(team=team, user=user).first()
    if not requester_membership or not (requester_membership.has_role('owner') or requester_membership.has_role('admin')):
        return {"success": False, "message": "Permission denied"}

    # Only owner can remove owner
    if target_member.has_role('owner') and not requester_membership.has_role('owner'):
        return {"success": False, "message": "Only owner can remove other owners"}

    target_member.delete()
    return {"success": True, "message": "Member removed successfully"}


# ======================
# Dashboard Stats
# ======================

@router.get("/teams/{slug}/stats", response=DashboardStatsOut, auth=session_mfa_auth)
def get_team_stats(request, slug: str):
    """Get dashboard statistics for a team"""
    from functions.models import Function, FunctionInvocation
    from django.utils import timezone
    from datetime import timedelta

    user = request.auth
    team = get_object_or_404(Team, slug=slug)

    # Check if user is a member of this team
    if not TeamMember.objects.filter(team=team, user=user).exists():
        return {"total_functions": 0, "total_invocations": 0, "total_deployments": 0, "recent_invocations": 0}

    # Get counts
    total_functions = Function.objects.filter(team=team).count()
    total_invocations = FunctionInvocation.objects.filter(function__team=team).count()

    # Count deployments (functions with last_deployed_at set)
    total_deployments = Function.objects.filter(team=team, last_deployed_at__isnull=False).count()

    # Recent invocations (last 24 hours)
    twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
    recent_invocations = FunctionInvocation.objects.filter(
        function__team=team,
        created_at__gte=twenty_four_hours_ago
    ).count()

    return {
        "total_functions": total_functions,
        "total_invocations": total_invocations,
        "total_deployments": total_deployments,
        "recent_invocations": recent_invocations
    }


@router.get("/teams/{slug}/enhanced-stats", response=EnhancedDashboardStatsOut, auth=session_mfa_auth)
def get_enhanced_team_stats(request, slug: str):
    """Get enhanced dashboard statistics with charts data"""
    from functions.models import Function, FunctionInvocation
    from django.utils import timezone
    from django.db.models import Count, Q
    from datetime import timedelta
    from collections import defaultdict

    user = request.auth
    team = get_object_or_404(Team, slug=slug)

    # Check if user is a member of this team
    if not TeamMember.objects.filter(team=team, user=user).exists():
        # Return empty data
        return {
            "stats": {
                "total_functions": 0,
                "total_invocations": 0,
                "total_deployments": 0,
                "recent_invocations": 0
            },
            "invocation_trend": [],
            "top_functions": [],
            "runtime_distribution": [],
            "recent_activity": []
        }

    # Basic stats
    total_functions = Function.objects.filter(team=team).count()
    total_invocations = FunctionInvocation.objects.filter(function__team=team).count()
    total_deployments = Function.objects.filter(team=team, last_deployed_at__isnull=False).count()

    twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
    recent_invocations = FunctionInvocation.objects.filter(
        function__team=team,
        created_at__gte=twenty_four_hours_ago
    ).count()

    # Invocation trend (last 24 hours, grouped by hour)
    invocation_trend = []
    now = timezone.now()
    for i in range(24):
        hour_start = now - timedelta(hours=24-i)
        hour_end = hour_start + timedelta(hours=1)

        hour_invocations = FunctionInvocation.objects.filter(
            function__team=team,
            created_at__gte=hour_start,
            created_at__lt=hour_end
        )

        total = hour_invocations.count()
        errors = hour_invocations.filter(status='error').count()

        invocation_trend.append({
            "hour": f"{i}:00",
            "invocations": total,
            "errors": errors
        })

    # Top functions (last 7 days)
    seven_days_ago = timezone.now() - timedelta(days=7)
    top_functions_data = Function.objects.filter(
        team=team
    ).annotate(
        recent_invocations=Count(
            'invocations',
            filter=Q(invocations__created_at__gte=seven_days_ago)
        )
    ).filter(recent_invocations__gt=0).order_by('-recent_invocations')[:5]

    top_functions = [
        {
            "name": func.name,
            "invocations": func.recent_invocations,
            "runtime": func.runtime
        }
        for func in top_functions_data
    ]

    # Runtime distribution
    runtime_counts = defaultdict(int)
    for func in Function.objects.filter(team=team):
        # Extract base runtime (e.g., "python3.12" -> "Python")
        runtime = func.runtime.lower()
        if 'python' in runtime:
            runtime_counts['Python'] += 1
        elif 'node' in runtime or 'nodejs' in runtime:
            runtime_counts['Node.js'] += 1
        elif 'ruby' in runtime:
            runtime_counts['Ruby'] += 1
        else:
            runtime_counts['Other'] += 1

    runtime_colors = {
        'Python': '#3b82f6',
        'Node.js': '#10b981',
        'Ruby': '#ef4444',
        'Other': '#6b7280'
    }

    runtime_distribution = [
        {
            "name": name,
            "value": count,
            "color": runtime_colors.get(name, '#6b7280')
        }
        for name, count in runtime_counts.items()
        if count > 0
    ]

    # Recent activity (last 10 invocations)
    recent_invocations_qs = FunctionInvocation.objects.filter(
        function__team=team
    ).select_related('function').order_by('-created_at')[:10]

    recent_activity = [
        {
            "function_name": inv.function.name,
            "status": inv.status,
            "created_at": inv.created_at.isoformat(),
            "duration_ms": inv.duration_ms
        }
        for inv in recent_invocations_qs
    ]

    return {
        "stats": {
            "total_functions": total_functions,
            "total_invocations": total_invocations,
            "total_deployments": total_deployments,
            "recent_invocations": recent_invocations
        },
        "invocation_trend": invocation_trend,
        "top_functions": top_functions,
        "runtime_distribution": runtime_distribution,
        "recent_activity": recent_activity
    }


# ======================
# SITE SETTINGS
# ======================

@router.get("/site-settings", response=SiteSettingsOut, auth=session_mfa_auth)
def get_site_settings(request):
    """Get site settings (admin only)"""
    user = request.auth

    # Check if user is admin/staff
    if not is_admin_user(user):
        raise HttpError(403, "Only administrators can view site settings")

    settings = SiteSettings.get_settings()
    return {
        "allow_registration": settings.allow_registration
    }


@router.put("/site-settings", response=SiteSettingsOut, auth=session_mfa_auth)
def update_site_settings(request, payload: SiteSettingsUpdateIn):
    """Update site settings (admin only)"""
    user = request.auth

    # Check if user is admin/staff
    if not is_admin_user(user):
        raise HttpError(403, "Only administrators can update site settings")

    settings = SiteSettings.get_settings()
    settings.allow_registration = payload.allow_registration
    settings.updated_by = user
    settings.save()

    return {
        "allow_registration": settings.allow_registration
    }