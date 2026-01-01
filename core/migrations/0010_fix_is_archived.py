from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_fix_payment_type'),
    ]

    operations = [
        migrations.RunSQL(
            # SQL to make the column nullable so we can ignore it
            sql="ALTER TABLE core_due ALTER COLUMN is_archived DROP NOT NULL;",
            # Reverse SQL (optional, leaving empty/safe)
            reverse_sql=""
        ),
    ]
