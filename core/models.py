from django.db import models
from django.contrib.auth.models import AbstractUser


class Building(models.Model):
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True, null=True)

    ROLE_CHOICES = (
        ("manager", "manager"),
        ("resident", "resident"),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="resident")

    building = models.ForeignKey(
        Building, null=True, blank=True, on_delete=models.SET_NULL
    )

    apartment_number = models.CharField(max_length=10, default="0")

    approved = models.BooleanField(default=False)
    REQUIRED_FIELDS = ['email']

    def save(self, *args, **kwargs):
        if not self.username and self.email:
            self.username = self.email
        super().save(*args, **kwargs)

class Due(models.Model):
    STATUS = [
        ("pending", "Bekliyor"),
        ("paid", "Ödendi"),
        ("overdue", "Gecikmiş"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    building = models.ForeignKey(Building, on_delete=models.CASCADE)
    month = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS, default="pending")
    paid_date = models.DateField(null=True, blank=True)

    TYPE_CHOICES = [
        ("aidat", "Aidat"),
        ("bakim", "Bakım Ücreti"),
        ("onarim", "Onarım"),
        ("elektrik", "Ortak Alan Elektrik"),
        ("ozel", "Özel Ödeme"),
    ]
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="aidat")
    is_archived = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user} - {self.month} - {self.amount}"

class Transaction(models.Model):
    TYPE_CHOICES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
    ]

    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    category = models.CharField(max_length=100)
    description = models.TextField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField(auto_now_add=True)
    visible_to_residents = models.BooleanField(default=True)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    building = models.ForeignKey(Building, on_delete=models.CASCADE)
    due = models.ForeignKey('Due', null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.type} - {self.amount}"

# PaymentNotification modeli içinde file zorunlu olmasın:
class PaymentNotification(models.Model):
    resident = models.ForeignKey(User, on_delete=models.CASCADE)
    due = models.ForeignKey(Due, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    file = models.FileField(upload_to="receipts/", blank=True, null=True)  # ✅ opsiyonel
    status = models.CharField(max_length=20, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)


class Announcement(models.Model):
    LEVEL_CHOICES = [
        ("high", "High Importance"),
        ("medium", "Medium Importance"),
        ("low", "Low Importance"),
    ]

    title = models.CharField(max_length=200)
    message = models.TextField()
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default="low")
    date_created = models.DateTimeField(auto_now_add=True)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    building = models.ForeignKey(Building, on_delete=models.CASCADE)

    def __str__(self):
        return f"[{self.level.upper()}] {self.title}"


class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="messages")
    content = models.TextField()
    is_read = models.BooleanField(default=False)  # Yönetici okudu mu?
    
    # Arşivleme alanları
    archived_by_resident = models.BooleanField(default=False)
    archived_by_manager = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message from {self.sender} - {self.created_at}"



