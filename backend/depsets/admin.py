from django.contrib import admin
from .models import Depset, DepsetPackage


class DepsetPackageInline(admin.TabularInline):
    """Inline admin for DepsetPackage to show in Depset admin."""
    model = DepsetPackage
    extra = 1
    fields = ('package_name', 'version_spec', 'order', 'notes')
    ordering = ['order', 'package_name']


@admin.register(Depset)
class DepsetAdmin(admin.ModelAdmin):
    """Admin interface for Depset model."""
    list_display = (
        'name',
        'slug',
        'team',
        'runtime_type',
        'runtime_version',
        'is_public',
        'package_count',
        'created_at',
    )
    list_filter = ('is_public', 'runtime_type', 'runtime_version', 'created_at', 'team')
    search_fields = ('name', 'slug', 'description', 'team__name')
    readonly_fields = ('created_at', 'updated_at', 'created_by', 'requirements_preview')
    prepopulated_fields = {'slug': ('name',)}
    autocomplete_fields = ['team', 'created_by']
    inlines = [DepsetPackageInline]

    fieldsets = (
        (None, {
            'fields': ('name', 'slug', 'description', 'team')
        }),
        ('Configuration', {
            'fields': ('runtime_type', 'runtime_version', 'is_public')
        }),
        ('Requirements', {
            'fields': ('requirements_preview',),
            'classes': ('collapse',),
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def package_count(self, obj):
        """Display the number of packages in this depset."""
        return obj.packages.count()
    package_count.short_description = "Packages"

    def requirements_preview(self, obj):
        """Show a preview of the requirements.txt format."""
        if obj.pk:  # Only show if object is saved
            return obj.get_requirements_txt() or "No packages added yet"
        return "Save the depset first to see requirements"
    requirements_preview.short_description = "Requirements.txt Preview"

    def save_model(self, request, obj, form, change):
        """Set created_by when creating a new depset."""
        if not change:  # Only set on creation
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('team', 'created_by').prefetch_related('packages')


@admin.register(DepsetPackage)
class DepsetPackageAdmin(admin.ModelAdmin):
    """Admin interface for DepsetPackage model."""
    list_display = ('package_name', 'version_spec', 'depset', 'order')
    list_filter = ('depset__team', 'depset')
    search_fields = ('package_name', 'depset__name', 'notes')
    autocomplete_fields = ['depset']
    ordering = ['depset', 'order', 'package_name']

    fieldsets = (
        (None, {
            'fields': ('depset', 'package_name', 'version_spec')
        }),
        ('Options', {
            'fields': ('order', 'notes'),
        }),
    )

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('depset', 'depset__team')
