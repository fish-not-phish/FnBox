from django.contrib import admin
from .models import Function, FunctionInvocation, FunctionTrigger


@admin.register(Function)
class FunctionAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'team', 'runtime', 'status', 'invocation_count', 'created_at')
    list_filter = ('status', 'runtime', 'is_public', 'team')
    search_fields = ('name', 'slug', 'description')
    readonly_fields = ('created_at', 'updated_at', 'last_deployed_at', 'invocation_count', 'last_invoked_at', 'created_by')
    prepopulated_fields = {'slug': ('name',)}
    autocomplete_fields = ['team', 'created_by']
    filter_horizontal = ('depsets', 'secrets')

    fieldsets = (
        (None, {'fields': ('name', 'slug', 'description', 'team', 'status')}),
        ('Code', {'fields': ('code', 'handler', 'runtime')}),
        ('Configuration', {'fields': ('memory_mb', 'timeout_seconds', 'is_public')}),
        ('Dependencies & Secrets', {'fields': ('depsets', 'secrets')}),
        ('Statistics', {
            'fields': ('invocation_count', 'last_invoked_at', 'last_deployed_at'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(FunctionInvocation)
class FunctionInvocationAdmin(admin.ModelAdmin):
    list_display = ('request_id', 'function', 'status', 'duration_ms', 'created_at')
    list_filter = ('status', 'function__team')
    search_fields = ('request_id', 'function__name')
    readonly_fields = ('created_at', 'started_at', 'completed_at')
    autocomplete_fields = ['function']

    fieldsets = (
        (None, {'fields': ('function', 'request_id', 'status')}),
        ('Data', {'fields': ('input_data', 'output_data', 'error_message')}),
        ('Metrics', {'fields': ('duration_ms', 'memory_used_mb')}),
        ('Logs', {'fields': ('logs',)}),
        ('Timestamps', {'fields': ('created_at', 'started_at', 'completed_at')}),
    )


@admin.register(FunctionTrigger)
class FunctionTriggerAdmin(admin.ModelAdmin):
    list_display = ('name', 'function', 'trigger_type', 'schedule', 'enabled', 'last_triggered_at', 'created_at')
    list_filter = ('trigger_type', 'enabled', 'function__team')
    search_fields = ('name', 'function__name')
    readonly_fields = ('uuid', 'created_at', 'updated_at', 'last_triggered_at', 'created_by')
    autocomplete_fields = ['function', 'created_by']

    fieldsets = (
        (None, {'fields': ('name', 'function', 'trigger_type', 'enabled')}),
        ('Schedule Configuration', {
            'fields': ('schedule',),
            'description': 'Cron expression for scheduled triggers (e.g., "*/5 * * * *" for every 5 minutes)'
        }),
        ('Tracking', {
            'fields': ('uuid', 'last_triggered_at'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
