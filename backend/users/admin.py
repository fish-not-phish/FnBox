from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import UserProfile, Team, TeamMember


class UserProfileInline(admin.StackedInline):
    """Inline admin for UserProfile to show in User admin."""
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Profile"
    fk_name = "user"


class UserAdmin(BaseUserAdmin):
    """Extended User admin with UserProfile inline."""
    inlines = (UserProfileInline,)
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
        "date_joined",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "groups")
    search_fields = ("username", "first_name", "last_name", "email")


class TeamMemberInline(admin.TabularInline):
    """Inline admin for TeamMember to show in Team admin."""
    model = TeamMember
    extra = 1
    readonly_fields = ("joined_at",)
    autocomplete_fields = ["user"]


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    """Admin interface for Team model."""
    list_display = (
        "name",
        "slug",
        "team_type",
        "owner",
        "member_count",
        "created_at",
    )
    list_filter = ("team_type", "created_at")
    search_fields = ("name", "slug", "owner__username")
    readonly_fields = ("created_at", "updated_at", "slug")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ["owner"]
    inlines = [TeamMemberInline]

    fieldsets = (
        (None, {
            "fields": ("name", "slug", "team_type", "owner")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    def member_count(self, obj):
        """Display the number of members in the team."""
        return obj.members.count()
    member_count.short_description = "Members"

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related("owner").prefetch_related("members")


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    """Admin interface for TeamMember model."""
    list_display = ("user", "team", "display_roles", "joined_at")
    list_filter = ("joined_at",)
    search_fields = ("user__username", "team__name")
    readonly_fields = ("joined_at",)
    autocomplete_fields = ["user", "team"]

    fieldsets = (
        (None, {
            "fields": ("team", "user", "roles")
        }),
        ("Metadata", {
            "fields": ("joined_at",),
            "classes": ("collapse",),
        }),
    )

    def display_roles(self, obj):
        """Display roles as comma-separated list."""
        return ", ".join(obj.roles) if obj.roles else "No roles"
    display_roles.short_description = "Roles"

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related("user", "team")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin interface for UserProfile model."""
    list_display = ("user", "is_admin")
    list_filter = ("is_admin",)
    search_fields = ("user__username", "user__email")
    autocomplete_fields = ["user"]


# Unregister the default User admin and register our custom one
admin.site.unregister(User)
admin.site.register(User, UserAdmin)
