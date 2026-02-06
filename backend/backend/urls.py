from django.contrib import admin
from django.urls import path, include
from users.api import router as users_router
from vault.api import router as vault_router
from depsets.api import router as depsets_router
from functions.api import router as functions_router
from ninja_extra import NinjaExtraAPI
from django.views.generic.base import RedirectView
from users.views import *

api = NinjaExtraAPI(title="FaaS API", version="1.0", docs_url=None)

api.add_router("/accounts/", users_router)
api.add_router("/vault/", vault_router)
api.add_router("/depsets/", depsets_router)
api.add_router("/functions/", functions_router)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    path('accounts/auth/', include('users.urls')),
    path('accounts/email/', RedirectView.as_view(url='/', permanent=False), name='account_email'),
    path('accounts/inactive/', RedirectView.as_view(url='/', permanent=False), name='account_inactive'),
    # path('accounts/3rdparty/', RedirectView.as_view(url='/', permanent=False), name='redirect_3rdparty'),
    # path('accounts/social/login/cancelled/', RedirectView.as_view(url='/', permanent=False), name='redirect_social_login_cancelled'),
    # path('accounts/social/login/error/', RedirectView.as_view(url='/', permanent=False), name='redirect_social_login_error'),
    # path('accounts/social/signup/', RedirectView.as_view(url='/', permanent=False), name='redirect_social_signup'),
    # path('accounts/social/connections/', RedirectView.as_view(url='/', permanent=False), name='redirect_social_connections'),
    path('accounts/password/reset/', RedirectView.as_view(url='/', permanent=False), name='account_reset_password'),
    path('accounts/', include('allauth.urls')),
]