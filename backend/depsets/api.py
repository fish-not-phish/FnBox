from ninja import Router
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from django.db import models
from typing import List
from users.auth import session_mfa_auth
from users.models import Team, TeamMember
from .models import Depset, DepsetPackage
from .schemas import *

router = Router(tags=["depsets"])


def check_team_access(user, team_id: int, required_roles: List[str] = None):
    """
    Check if user has access to the team and optionally has required roles.
    Returns the team if access is granted, raises 404 otherwise.
    """
    team = get_object_or_404(Team, id=team_id)
    membership = TeamMember.objects.filter(team=team, user=user).first()

    if not membership:
        raise get_object_or_404(Team, id=-1)  # Raise 404 to hide team existence

    if required_roles:
        has_required_role = any(membership.has_role(role) for role in required_roles)
        if not has_required_role:
            raise get_object_or_404(Team, id=-1)  # Raise 404

    return team


@router.get("/teams/{team_id}/depsets", response=List[DepsetListOut], auth=session_mfa_auth)
def list_depsets(request, team_id: int, runtime_type: str = None, runtime_version: str = None):
    """
    List all depsets for a team (includes public depsets from other teams).
    Optional filtering by runtime_type and runtime_version.
    """
    team = check_team_access(request.user, team_id)

    # Get team's own depsets + public depsets from other teams
    query = models.Q(team=team) | models.Q(is_public=True)

    # Apply runtime filters if provided
    if runtime_type:
        query &= models.Q(runtime_type=runtime_type)
    if runtime_version:
        query &= models.Q(runtime_version=runtime_version)

    depsets = Depset.objects.filter(query).prefetch_related('packages').select_related('team')

    return [
        {
            "id": depset.id,
            "name": depset.name,
            "slug": depset.slug,
            "description": depset.description,
            "runtime_type": depset.runtime_type,
            "runtime_version": depset.runtime_version,
            "python_version": depset.python_version,  # Backward compatibility
            "is_public": depset.is_public,
            "package_count": depset.packages.count(),
            "created_at": depset.created_at,
        }
        for depset in depsets
    ]


@router.get("/teams/{team_id}/depsets/{slug}", response=DepsetDetailOut, auth=session_mfa_auth)
def get_depset(request, team_id: int, slug: str):
    """Get detailed information about a specific depset"""
    team = check_team_access(request.user, team_id)

    # Can view own team's depsets or public depsets
    depset = get_object_or_404(
        Depset.objects.select_related('team', 'created_by').prefetch_related('packages'),
        slug=slug
    )

    # Check access: must be team's depset or public
    if depset.team_id != team.id and not depset.is_public:
        raise get_object_or_404(Depset, id=-1)

    packages = depset.packages.all()

    return {
        "id": depset.id,
        "name": depset.name,
        "slug": depset.slug,
        "description": depset.description,
        "runtime_type": depset.runtime_type,
        "runtime_version": depset.runtime_version,
        "python_version": depset.python_version,  # Backward compatibility
        "is_public": depset.is_public,
        "team_id": depset.team_id,
        "team_name": depset.team.name,
        "package_count": packages.count(),
        "created_at": depset.created_at,
        "updated_at": depset.updated_at,
        "created_by_username": depset.created_by.email if depset.created_by else None,
        "packages": [
            {
                "id": pkg.id,
                "package_name": pkg.package_name,
                "version_spec": pkg.version_spec,
                "order": pkg.order,
                "notes": pkg.notes,
            }
            for pkg in packages
        ],
        "requirements_txt": depset.get_requirements_txt(),
    }


@router.post("/teams/{team_id}/depsets", response=DepsetOut, auth=session_mfa_auth)
def create_depset(request, team_id: int, payload: DepsetCreateIn):
    """Create a new depset (requires editor, admin, or owner role)"""
    team = check_team_access(request.user, team_id, ['editor', 'admin', 'owner'])

    # Generate slug if not provided
    if not payload.slug:
        base_slug = slugify(payload.name)
        slug = base_slug
        counter = 1
        while Depset.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
    else:
        slug = slugify(payload.slug)
        if Depset.objects.filter(slug=slug).exists():
            return {"error": "Slug already exists"}, 400

    # Handle backward compatibility for python_version
    runtime_type = payload.runtime_type
    runtime_version = payload.runtime_version

    # If python_version is provided but runtime fields are defaults, use python_version
    if payload.python_version and payload.runtime_type == "python" and payload.runtime_version == "3.11":
        runtime_version = payload.python_version

    # Create depset
    depset = Depset.objects.create(
        name=payload.name,
        slug=slug,
        description=payload.description,
        runtime_type=runtime_type,
        runtime_version=runtime_version,
        python_version=runtime_version if runtime_type == "python" else "3.11",  # Sync for compatibility
        is_public=payload.is_public,
        team=team,
        created_by=request.user
    )

    # Add packages
    for pkg_data in payload.packages:
        DepsetPackage.objects.create(
            depset=depset,
            package_name=pkg_data.package_name,
            version_spec=pkg_data.version_spec,
            order=pkg_data.order,
            notes=pkg_data.notes
        )

    return {
        "id": depset.id,
        "name": depset.name,
        "slug": depset.slug,
        "description": depset.description,
        "runtime_type": depset.runtime_type,
        "runtime_version": depset.runtime_version,
        "python_version": depset.python_version,  # Backward compatibility
        "is_public": depset.is_public,
        "team_id": depset.team_id,
        "team_name": depset.team.name,
        "package_count": depset.packages.count(),
        "created_at": depset.created_at,
        "updated_at": depset.updated_at,
        "created_by_username": depset.created_by.email if depset.created_by else None,
    }


@router.patch("/teams/{team_id}/depsets/{slug}", response=DepsetOut, auth=session_mfa_auth)
def update_depset(request, team_id: int, slug: str, payload: DepsetUpdateIn):
    """Update depset details (requires editor, admin, or owner role)"""
    team = check_team_access(request.user, team_id, ['editor', 'admin', 'owner'])

    depset = get_object_or_404(Depset, slug=slug, team=team)

    # Update fields
    if payload.name is not None:
        depset.name = payload.name
    if payload.description is not None:
        depset.description = payload.description
    if payload.runtime_type is not None:
        depset.runtime_type = payload.runtime_type
    if payload.runtime_version is not None:
        depset.runtime_version = payload.runtime_version
        # Keep python_version in sync for backward compatibility
        if depset.runtime_type == "python":
            depset.python_version = payload.runtime_version
    # Backward compatibility: if python_version is provided, update runtime_version too
    if payload.python_version is not None:
        depset.python_version = payload.python_version
        if depset.runtime_type == "python":
            depset.runtime_version = payload.python_version
    if payload.is_public is not None:
        depset.is_public = payload.is_public

    depset.save()

    # Update packages if provided
    if payload.packages is not None:
        # Remove existing packages
        depset.packages.all().delete()

        # Add new packages
        for pkg_data in payload.packages:
            DepsetPackage.objects.create(
                depset=depset,
                package_name=pkg_data.package_name,
                version_spec=pkg_data.version_spec,
                order=pkg_data.order,
                notes=pkg_data.notes
            )

    return {
        "id": depset.id,
        "name": depset.name,
        "slug": depset.slug,
        "description": depset.description,
        "runtime_type": depset.runtime_type,
        "runtime_version": depset.runtime_version,
        "python_version": depset.python_version,  # Backward compatibility
        "is_public": depset.is_public,
        "team_id": depset.team_id,
        "team_name": depset.team.name,
        "package_count": depset.packages.count(),
        "created_at": depset.created_at,
        "updated_at": depset.updated_at,
        "created_by_username": depset.created_by.email if depset.created_by else None,
    }


@router.delete("/teams/{team_id}/depsets/{slug}", response=dict, auth=session_mfa_auth)
def delete_depset(request, team_id: int, slug: str):
    """Delete a depset (requires editor, admin, or owner role)"""
    team = check_team_access(request.user, team_id, ['editor', 'admin', 'owner'])

    depset = get_object_or_404(Depset, slug=slug, team=team)
    depset.delete()

    return {"success": True, "message": "Depset deleted successfully"}
