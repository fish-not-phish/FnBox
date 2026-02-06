from ninja import Router
from ninja.errors import HttpError
from typing import List
from uuid import UUID
from django.shortcuts import get_object_or_404
from pydantic import BaseModel, Field

from users.auth import session_mfa_auth
from users.models import Team, TeamMember
from .models import Secret

router = Router(tags=["Vault"])


class SecretCreateIn(BaseModel):
    """Schema for creating a new secret."""
    key: str = Field(..., min_length=1, max_length=255)
    value: str = Field(..., min_length=1)
    description: str = ""


class SecretUpdateIn(BaseModel):
    """Schema for updating a secret."""
    key: str | None = None
    value: str | None = None
    description: str | None = None


class SecretOut(BaseModel):
    """Schema for secret output (without the actual value)."""
    id: int
    uuid: UUID
    key: str
    description: str
    created_at: str
    updated_at: str
    created_by_username: str | None

    @staticmethod
    def from_orm(secret: Secret):
        return SecretOut(
            id=secret.id,
            uuid=secret.uuid,
            key=secret.key,
            description=secret.description,
            created_at=secret.created_at.isoformat(),
            updated_at=secret.updated_at.isoformat(),
            created_by_username=secret.created_by.email if secret.created_by else None,
        )


@router.get("/", response=List[SecretOut])
def list_secrets(request, team_id: int = None):
    """
    List all secrets accessible to the current user.
    Optionally filter by team_id.
    """
    if not request.user.is_authenticated:
        return []

    # Get user's team memberships
    user_teams = TeamMember.objects.filter(user=request.user).values_list('team_id', flat=True)

    # If team_id is provided, filter by specific team
    if team_id is not None:
        # Verify user has access to this team
        if team_id not in user_teams:
            return []
        secrets = Secret.objects.filter(team_id=team_id).select_related('created_by', 'team')
    else:
        secrets = Secret.objects.filter(team_id__in=user_teams).select_related('created_by', 'team')

    return [SecretOut.from_orm(secret) for secret in secrets]


@router.post("/", response=SecretOut, auth=session_mfa_auth)
def create_secret(request, payload: SecretCreateIn, team_id: int):
    """
    Create a new secret.
    User must be a member of the team with editor, admin, or owner role.
    """
    # Check team access
    team = get_object_or_404(Team, id=team_id)
    membership = TeamMember.objects.filter(user=request.user, team=team).first()

    if not membership:
        raise HttpError(403, "You don't have access to this team")

    # Check if user has required role
    if not membership.has_role('editor') and not membership.has_role('admin') and not membership.has_role('owner'):
        raise HttpError(403, "You need editor, admin, or owner role to create secrets")

    # Check if secret with this key already exists
    if Secret.objects.filter(team=team, key=payload.key.upper()).exists():
        raise HttpError(400, f"Secret with key '{payload.key}' already exists for this team")

    secret = Secret(
        team=team,
        key=payload.key,
        description=payload.description,
        created_by=request.user,
    )
    secret.set_value(payload.value)
    secret.save()

    return SecretOut.from_orm(secret)


@router.put("/{secret_id}", response=SecretOut, auth=session_mfa_auth)
def update_secret(request, secret_id: str, payload: SecretUpdateIn):
    """
    Update a secret by UUID.
    User must be a member of the secret's team with editor, admin, or owner role.
    """
    secret = get_object_or_404(Secret, uuid=secret_id)

    # Check team access
    membership = TeamMember.objects.filter(user=request.user, team=secret.team).first()

    if not membership:
        raise HttpError(403, "You don't have access to this team")

    # Check if user has required role
    if not membership.has_role('editor') and not membership.has_role('admin') and not membership.has_role('owner'):
        raise HttpError(403, "You need editor, admin, or owner role to update secrets")

    # Update fields if provided
    if payload.key is not None:
        secret.key = payload.key
    if payload.description is not None:
        secret.description = payload.description
    if payload.value is not None:
        secret.set_value(payload.value)

    secret.save()

    return SecretOut.from_orm(secret)


@router.delete("/{secret_id}", auth=session_mfa_auth)
def delete_secret(request, secret_id: str):
    """
    Delete a secret by UUID.
    User must be a member of the secret's team with editor, admin, or owner role.
    """
    secret = get_object_or_404(Secret, uuid=secret_id)

    # Check team access
    membership = TeamMember.objects.filter(user=request.user, team=secret.team).first()

    if not membership:
        raise HttpError(403, "You don't have access to this team")

    # Check if user has required role
    if not membership.has_role('editor') and not membership.has_role('admin') and not membership.has_role('owner'):
        raise HttpError(403, "You need editor, admin, or owner role to delete secrets")

    secret.delete()
    return {"success": True}
