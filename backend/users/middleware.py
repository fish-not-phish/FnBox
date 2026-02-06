from django.shortcuts import redirect
from django.urls import resolve, reverse
from .models import SiteSettings


class RegistrationControlMiddleware:
    """
    Middleware to control user registration.
    When allow_registration is disabled, redirects signup page to login.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if this is a signup request
        try:
            resolved = resolve(request.path_info)

            # Check if it's the allauth signup page
            if resolved.url_name == 'account_signup':
                settings = SiteSettings.get_settings()

                # If registration is disabled, redirect to login
                if not settings.allow_registration:
                    return redirect('account_login')

        except Exception:
            # If anything goes wrong, just continue normally
            pass

        response = self.get_response(request)
        return response
