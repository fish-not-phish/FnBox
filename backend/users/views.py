from django.shortcuts import redirect
from allauth.mfa.models import Authenticator
from django.http import HttpResponseRedirect
from django.contrib.auth import logout
from functools import wraps
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.conf import settings
from .models import UserProfile

@login_required
def auth_gate(request):
    # Redirect back to Next.js frontend after successful authentication
    protocol = 'https' if not settings.DEBUG else 'http'
    frontend_url = f"{protocol}://{settings.CUSTOM_DOMAIN}/dashboard"
    return redirect(frontend_url)