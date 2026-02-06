import os
from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from django.conf import settings


class Command(BaseCommand):
    help = 'Updates the Django Site domain to match CUSTOM_DOMAIN environment variable'

    def add_arguments(self, parser):
        parser.add_argument(
            '--domain',
            type=str,
            help='Override domain (instead of using CUSTOM_DOMAIN env var)',
        )

    def handle(self, *args, **options):
        # Get domain from command line arg or environment variable
        custom_domain = options.get('domain') or os.environ.get('CUSTOM_DOMAIN') or settings.CUSTOM_DOMAIN

        if not custom_domain:
            self.stdout.write(
                self.style.ERROR('No domain specified. Set CUSTOM_DOMAIN environment variable or use --domain flag.')
            )
            return

        # Update or create the site with ID=1 (default site)
        site, created = Site.objects.get_or_create(
            pk=1,
            defaults={
                'domain': custom_domain,
                'name': f'FaaS Platform - {custom_domain}'
            }
        )

        if not created:
            # Site already existed, update it
            site.domain = custom_domain
            site.name = f'FaaS Platform - {custom_domain}'
            site.save()
            self.stdout.write(
                self.style.SUCCESS(f'✓ Updated site domain to: {custom_domain}')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'✓ Created site with domain: {custom_domain}')
            )

        # Display current configuration
        self.stdout.write('')
        self.stdout.write('Current site configuration:')
        self.stdout.write(f'  Domain: {site.domain}')
        self.stdout.write(f'  Name: {site.name}')
