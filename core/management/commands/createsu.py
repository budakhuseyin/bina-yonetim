from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = "Create default superuser"

    def handle(self, *args, **kwargs):
        User = get_user_model()
        if not User.objects.filter(username="huseyin").exists():
            User.objects.create_superuser(
                username="huseyin",
                email="huseyin@example.com",
                password="huseyin"
            )
            print("Superuser created: huseyin / huseyin")
        else:
            print("Superuser already exists")
