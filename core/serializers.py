from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import (
    User, Building, Transaction, Announcement,
    Due, PaymentNotification
)


# ================================================================
#   REGISTER SERIALIZER
# ================================================================
class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    building_id = serializers.IntegerField()
    apartment_number = serializers.CharField()
    role = serializers.ChoiceField(
        choices=[("manager", "manager"), ("resident", "resident")]
    )

    def validate(self, attrs):
        # Bina kontrolü
        try:
            building = Building.objects.get(id=attrs["building_id"])
        except Building.DoesNotExist:
            raise serializers.ValidationError({"building_id": "Bu ID'ye ait bina yok."})

        # Email benzersiz mi?
        if User.objects.filter(email__iexact=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Bu e-posta zaten kayıtlı."})

        # Aynı bina içinde aynı daire var mı?
        if User.objects.filter(
            building=building,
            apartment_number=attrs["apartment_number"]
        ).exists():
            raise serializers.ValidationError({
                "apartment_number": "Bu daire numarası bu binada zaten kayıtlı."
            })

        # Şifre kontrolü
        validate_password(attrs["password"])

        attrs["building"] = building
        return attrs

    def create(self, validated):
        full = validated["full_name"].strip()
        parts = full.split(" ")
        first = parts[0]
        last = " ".join(parts[1:]) if len(parts) > 1 else ""

        user = User.objects.create(
            email=validated["email"],
            first_name=first,
            last_name=last,
            role=validated.get("role", "resident"),
            building=validated["building"],
            apartment_number=validated["apartment_number"],
            approved=False,
            is_active=True,
        )

        user.set_password(validated["password"])
        user.save()
        return user


# ================================================================
#   ME SERIALIZER
# ================================================================
class MeSerializer(serializers.ModelSerializer):
    building_name = serializers.CharField(source="building.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "approved",
            "building",
            "building_name",
            "apartment_number",
        )


# ================================================================
#   TRANSACTION SERIALIZER
# ================================================================
class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = "__all__"
        extra_kwargs = {
            "created_by": {"required": False, "allow_null": True},
            "building": {"required": False, "allow_null": True},
        }


# ================================================================
#   ANNOUNCEMENT SERIALIZER
# ================================================================
class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ["id", "title", "message", "level", "date_created"]


# ================================================================
#   DUE SERIALIZER
# ================================================================
class DueSerializer(serializers.ModelSerializer):
    resident_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Due
        fields = [
            "id",
            "user",
            "resident_name",
            "building",
            "month",
            "amount",
            "due_date",
            "status",
            "paid_date"
        ]
        extra_kwargs = {
            "user": {"required": False, "allow_null": True},
            "building": {"required": False, "allow_null": True},
        }

    def get_resident_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name if name else obj.user.email


# ================================================================
#   PAYMENT NOTIFICATION SERIALIZER
# ================================================================
# ================================================================
#   PAYMENT NOTIFICATION SERIALIZER (GÜNCEL)
# ================================================================
class PaymentNotificationSerializer(serializers.ModelSerializer):
    resident_name = serializers.SerializerMethodField(read_only=True)
    resident_flat = serializers.CharField(source="resident.apartment_number", read_only=True)

    class Meta:
        model = PaymentNotification
        fields = ["id", "resident", "resident_name", "resident_flat", "due", "amount", "file", "status", "created_at"]
        read_only_fields = ["resident", "status", "created_at"]
        extra_kwargs = {
            "file": {"required": False, "allow_null": True},
        }

    def get_resident_name(self, obj):
        if not obj.resident:
            return "Bilinmeyen Üye"
        name = f"{obj.resident.first_name} {obj.resident.last_name}".strip()
        return name if name else obj.resident.email