from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import exceptions
from core.models import User


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"  # 🔹 Giriş alanı artık email olacak

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if not email or not password:
            raise exceptions.AuthenticationFailed("Email ve şifre gerekli.")

        # 🔹 Kullanıcıyı kontrol et
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed("Geçersiz kullanıcı.")

        # 🔹 Şifre doğru mu?
        if not user.check_password(password):
            raise exceptions.AuthenticationFailed("Geçersiz şifre.")

        # 🔹 Yönetici onayı var mı?
        if not user.approved:
            raise exceptions.AuthenticationFailed("Hesabınız henüz yönetici tarafından onaylanmamış.")

        # 🔹 Kullanıcı aktif mi?
        if not user.is_active:
            raise exceptions.AuthenticationFailed("Hesabınız devre dışı bırakılmış.")

        # ✅ Token oluşturma
        refresh = self.get_token(user)
        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "approved": user.approved,
            },
        }
        return data


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
