from rest_framework import serializers
from .models import User, Building
from django.contrib.auth.password_validation import validate_password
from .models import User, Building, Transaction, Announcement, Due


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    building_id = serializers.IntegerField()
    apartment_number = serializers.CharField()   # 🔥 EKLENDİ
    role = serializers.ChoiceField(
        choices=[("manager", "manager"), ("resident", "resident")]
    )

    def validate(self, attrs):
        # 🔹 Bina kontrolü
        try:
            building = Building.objects.get(id=attrs["building_id"])
        except Building.DoesNotExist:
            raise serializers.ValidationError({"building_id": "Bu ID'ye ait bina yok."})

        # 🔹 Email benzersiz mi?
        if User.objects.filter(email__iexact=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Bu e-posta zaten kayıtlı."})

        # 🔹 Aynı bina içinde aynı daire numarası kullanımda mı?
        if User.objects.filter(
            building=building,
            apartment_number=attrs["apartment_number"]
        ).exists():
            raise serializers.ValidationError({
                "apartment_number": "Bu daire numarası bu binada zaten kayıtlı."
            })

        # 🔹 Şifre kontrolü
        validate_password(attrs["password"])

        attrs["building"] = building
        return attrs

    def create(self, validated):
        first, *rest = validated["full_name"].split(" ")
        last = " ".join(rest) if rest else ""

        user = User.objects.create(
            email=validated["email"],
            first_name=first,
            last_name=last,
            role=validated.get("role", "resident"),
            building=validated["building"],
            apartment_number=validated["apartment_number"],  # 🔥 EKLENDİ
            approved=False,
            is_active=True,
        )

        user.set_password(validated["password"])
        user.save()
        return user


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
        )


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'
        # created_by ve building otomatik dolacak ama serializer kaydederken izin verelim
        extra_kwargs = {
            'created_by': {'required': False, 'allow_null': True},
            'building': {'required': False, 'allow_null': True},
        }

class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ['id', 'title', 'message', 'level', 'date_created']


class DueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Due
        fields = "__all__"
        extra_kwargs = {
            "user": {"required": False, "allow_null": True},
            "building": {"required": False, "allow_null": True},
        }

