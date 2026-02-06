from django.apps import AppConfig


class FunctionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'functions'

    def ready(self):
        """Import signals when the app is ready."""
        import functions.signals  # noqa
