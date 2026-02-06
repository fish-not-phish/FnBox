from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model

User = get_user_model()


class MySocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom adapter to link OIDC accounts to existing users by email.

    When a user logs in via OIDC:
    1. If they already have a social account linked -> login normally
    2. If their email matches an existing verified user -> link accounts
    3. Otherwise -> create new user account
    """

    def pre_social_login(self, request, sociallogin):
        """
        Invoked just after a user successfully authenticates via social login,
        but before the login is fully processed.

        This is where we can connect the social account to an existing user.
        """
        # If this social account is already connected to a user, do nothing
        if sociallogin.is_existing:
            return

        # Try to get email from the social account data
        email = sociallogin.account.extra_data.get('email')
        if not email:
            # No email provided by the OIDC provider
            return

        # Try to find an existing user with this email
        try:
            # First, try to find a verified email address
            email_address = EmailAddress.objects.get(
                email__iexact=email,
                verified=True
            )
            # Connect this social login to the existing user
            sociallogin.connect(request, email_address.user)

        except EmailAddress.DoesNotExist:
            # No verified email found, try to find user by email field directly
            try:
                user = User.objects.get(email__iexact=email)
                # Connect this social login to the existing user
                sociallogin.connect(request, user)

            except User.DoesNotExist:
                # No existing user with this email, will create a new account
                pass
            except User.MultipleObjectsReturned:
                # Multiple users with same email (shouldn't happen in a well-configured system)
                # Don't link to avoid ambiguity
                pass
