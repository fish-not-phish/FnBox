from django.contrib import admin
from django.forms import ModelForm, PasswordInput
from .models import Secret


class SecretAdminForm(ModelForm):
    """Custom form to handle secret value input."""
    class Meta:
        model = Secret
        fields = '__all__'
        widgets = {
            'encrypted_value': PasswordInput(render_value=False),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make encrypted_value optional in form (we'll handle it specially)
        self.fields['encrypted_value'].required = False
        self.fields['encrypted_value'].label = "Secret Value"
        self.fields['encrypted_value'].help_text = "Enter the plain-text secret value (will be encrypted automatically)"

    def save(self, commit=True):
        instance = super().save(commit=False)
        # If a new value was provided, encrypt it
        plain_value = self.cleaned_data.get('encrypted_value')
        if plain_value:
            instance.set_value(plain_value)
        if commit:
            instance.save()
        return instance


@admin.register(Secret)
class SecretAdmin(admin.ModelAdmin):
    """Admin interface for Secret model."""
    form = SecretAdminForm
    list_display = ('key', 'team', 'description_preview', 'created_by', 'created_at', 'updated_at')
    list_filter = ('team', 'created_at')
    search_fields = ('key', 'description', 'team__name')
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ['team', 'created_by']

    fieldsets = (
        (None, {
            'fields': ('team', 'key', 'encrypted_value', 'description')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def description_preview(self, obj):
        """Show first 50 chars of description."""
        if obj.description:
            return obj.description[:50] + ('...' if len(obj.description) > 50 else '')
        return '-'
    description_preview.short_description = 'Description'

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related('team', 'created_by')

    def save_model(self, request, obj, form, change):
        """Set created_by on creation."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
