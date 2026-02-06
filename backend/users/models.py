from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True)
    is_admin = models.BooleanField(default=False)

    def __str__(self):
        return f"Profile for {self.user.username if self.user else 'Unknown'}"


class Team(models.Model):
    """
    Represents a team that users can belong to.
    Each user gets a personal team created automatically on signup.
    """
    TEAM_TYPE_CHOICES = [
        ('personal', 'Personal'),
        ('shared', 'Shared'),
    ]

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    team_type = models.CharField(
        max_length=20,
        choices=TEAM_TYPE_CHOICES,
        default='shared'
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='owned_teams'
    )
    members = models.ManyToManyField(
        User,
        through='TeamMember',
        related_name='teams'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['owner']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_team_type_display()})"


class TeamMember(models.Model):
    """
    Explicit through model for Team-User many-to-many relationship.
    Tracks roles (multiple allowed), join date, and membership status.

    Permission hierarchy and inheritance:
    - Owner: Full control, inherits all permissions
    - Admin: Inherits viewer, runner, and editor permissions
    - Editor: Can create, edit, and deploy functions
    - Runner: Can execute functions but not modify them
    - Viewer: Read-only access to functions and team

    Users can have multiple roles (except owner/admin which auto-grant others).
    """
    AVAILABLE_ROLES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('editor', 'Editor'),
        ('runner', 'Runner'),
        ('viewer', 'Viewer'),
    ]

    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    roles = models.JSONField(default=list)  # Array of role strings
    joined_at = models.DateTimeField(auto_now_add=True)

    def get_effective_roles(self):
        """
        Returns all effective roles including inherited ones.
        Owner inherits everything.
        Admin inherits viewer, runner, and editor.
        """
        effective = set(self.roles)

        if 'owner' in self.roles:
            effective.update(['admin', 'editor', 'runner', 'viewer'])
        elif 'admin' in self.roles:
            effective.update(['editor', 'runner', 'viewer'])

        return list(effective)

    def has_role(self, role):
        """Check if user has a specific role (including inherited)."""
        return role in self.get_effective_roles()

    class Meta:
        unique_together = ('team', 'user')
        ordering = ['-joined_at']
        indexes = [
            models.Index(fields=['team', 'user']),
        ]

    def __str__(self):
        return f"{self.user.username} in {self.team.name} ({self.role})"


class OIDCProvider(models.Model):
    """
    OIDC authentication provider configuration.
    Site-wide setting - admins can configure OIDC providers for the entire platform.
    """
    PROVIDER_TYPE_CHOICES = [
        ('authelia', 'Authelia'),
        ('keycloak', 'Keycloak'),
        ('authentik', 'Authentik'),
    ]

    provider_type = models.CharField(
        max_length=20,
        choices=PROVIDER_TYPE_CHOICES,
        unique=True,
        help_text="Type of OIDC provider (only one per type allowed)"
    )
    provider_name = models.CharField(
        max_length=255,
        help_text="Custom display name for this provider"
    )
    client_id = models.CharField(max_length=255)
    client_secret = models.CharField(
        max_length=500,
        help_text="OIDC client secret (should be encrypted in production)"
    )
    server_url = models.URLField(
        max_length=500,
        help_text="OIDC well-known configuration endpoint URL"
    )
    enabled = models.BooleanField(
        default=True,
        help_text="Whether this provider is active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['enabled']),
        ]

    def __str__(self):
        return f"{self.provider_name} ({self.get_provider_type_display()})"

    @property
    def provider_id(self):
        """Generate unique provider ID for django-allauth"""
        return f"{self.provider_type}_{self.id}"


class SiteSettings(models.Model):
    """
    Site-wide settings that control platform behavior.
    This is a singleton model - only one instance should exist.
    """
    allow_registration = models.BooleanField(
        default=True,
        help_text="Allow new users to register. When disabled, signup page redirects to login."
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='site_settings_updates'
    )

    class Meta:
        verbose_name = "Site Settings"
        verbose_name_plural = "Site Settings"

    def __str__(self):
        return "Site Settings"

    @classmethod
    def get_settings(cls):
        """Get or create the singleton settings instance"""
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings