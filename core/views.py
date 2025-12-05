from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Sum
from django.utils import timezone
from .models import User, Transaction, Announcement, Due, PaymentNotification

from .serializers import (
    RegisterSerializer,
    MeSerializer,
    TransactionSerializer,
    AnnouncementSerializer,
    DueSerializer,
    PaymentNotificationSerializer,   # 🔥 BUNU EKLE
)




# =========================================
# 🔹 Kullanıcı kayıt endpoint'i
# =========================================
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "message": "Kayıt alındı! Yönetici onayından sonra giriş yapabilirsiniz.",
                    "status": "pending",
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =========================================
# 🔹 Kullanıcı bilgilerini döndüren endpoint (dashboard için)
# =========================================
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)


# =========================================
# 🔹 Yöneticiye özel: Üye Onay / Reddetme Sistemi
# =========================================

# Bekleyen kullanıcıları listele
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_members(request):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Sadece yöneticiler erişebilir."}, status=403)

    pending_users = User.objects.filter(
        building=user.building, approved=False, role="resident"
    )

    data = [
        {
            "id": u.id,
            "email": u.email,
            "phone": u.phone,
            "building": u.building.name if u.building else None,
        }
        for u in pending_users
    ]
    return Response(data, status=200)


# Kullanıcıyı onayla
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_member(request, user_id):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Sadece yöneticiler onay verebilir."}, status=403)

    try:
        member = User.objects.get(id=user_id, building=user.building, role="resident")
    except User.DoesNotExist:
        return Response({"detail": "Kullanıcı bulunamadı."}, status=404)

    member.approved = True
    member.is_active = True
    member.save()

    return Response(
        {"message": f"{member.email} kullanıcısı onaylandı."},
        status=status.HTTP_200_OK
    )


# Kullanıcıyı reddet (tamamen sil)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_member(request, user_id):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Sadece yöneticiler işlem yapabilir."}, status=403)

    try:
        member = User.objects.get(id=user_id, building=user.building, role="resident")
    except User.DoesNotExist:
        return Response({"detail": "Kullanıcı bulunamadı."}, status=404)

    # ✅ Kullanıcıyı kalıcı olarak sil
    member.delete()

    return Response(
        {"message": f"{member.email} kullanıcısı reddedildi ve sistemden silindi."},
        status=status.HTTP_200_OK
    )


# =========================================
# 🔹 Yöneticinin tüm üyeleri listelemesi
# =========================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_members(request):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Sadece yöneticiler erişebilir."}, status=403)

    members = User.objects.filter(building=user.building)
    data = [
        {
            "id": m.id,
            "email": m.email,
            "first_name": m.first_name,
            "last_name": m.last_name,
            "role": m.role,
            "approved": m.approved,
            "building": m.building.name if m.building else None,
        }
        for m in members
    ]
    return Response(data, status=200)


# =========================================
# 🔹 Tek bir üyenin detayını görüntüleme
# =========================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def member_detail(request, user_id):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Sadece yöneticiler erişebilir."}, status=403)

    try:
        member = User.objects.get(id=user_id, building=user.building)
    except User.DoesNotExist:
        return Response({"detail": "Kullanıcı bulunamadı."}, status=404)

    data = {
        "id": member.id,
        "email": member.email,
        "first_name": member.first_name,
        "last_name": member.last_name,
        "role": member.role,
        "approved": member.approved,
        "building": member.building.name if member.building else None,
        "aidat_bilgileri": [],  # 🔹 Şimdilik boş — ileride buraya aidat tablosu eklenecek
    }
    return Response(data, status=200)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def transactions(request):
    user = request.user

    if request.method == 'GET':
        if user.role == 'manager':
            transactions = Transaction.objects.filter(building=user.building)
        else:
            transactions = Transaction.objects.filter(building=user.building, visible_to_residents=True)
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data, status=200)

    elif request.method == 'POST':
        if user.role != 'manager':
            return Response({"detail": "Sadece yöneticiler işlem ekleyebilir."}, status=403)

        serializer = TransactionSerializer(data=request.data)
        if serializer.is_valid():
            # 🔹 burada save içinde elle created_by ve building’i set ediyoruz
            transaction = serializer.save(
                created_by=user,
                building=user.building
            )
            return Response(TransactionSerializer(transaction).data, status=201)

        print("❌ Serializer Errors:", serializer.errors)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def announcements(request):
    user = request.user

    # GET: listeleme
    if request.method == 'GET':
        if user.role == 'manager':
            qs = Announcement.objects.filter(building=user.building).order_by('-date_created')
        else:
            qs = Announcement.objects.filter(building=user.building)
        serializer = AnnouncementSerializer(qs, many=True)
        return Response(serializer.data, status=200)

    # POST: yeni duyuru ekleme
    if request.method == 'POST':
        if user.role != 'manager':
            return Response({"detail": "Sadece yöneticiler duyuru ekleyebilir."}, status=403)

        serializer = AnnouncementSerializer(data=request.data)
        if serializer.is_valid():
            ann = serializer.save(created_by=user, building=user.building)
            return Response(AnnouncementSerializer(ann).data, status=201)
        return Response(serializer.errors, status=400)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_announcement(request, ann_id):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Sadece yöneticiler silebilir."}, status=403)
    try:
        ann = Announcement.objects.get(id=ann_id, building=user.building)
        ann.delete()
        return Response({"message": "Duyuru silindi."}, status=200)
    except Announcement.DoesNotExist:
        return Response({"detail": "Duyuru bulunamadı."}, status=404)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_announcement(request, ann_id):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Sadece yöneticiler düzenleyebilir."}, status=403)
    try:
        ann = Announcement.objects.get(id=ann_id, building=user.building)
    except Announcement.DoesNotExist:
        return Response({"detail": "Duyuru bulunamadı."}, status=404)

    serializer = AnnouncementSerializer(ann, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=200)
    return Response(serializer.errors, status=400)


class ManagerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "manager":
            return Response({"detail": "Sadece yöneticiler erişebilir."}, status=403)

        building = user.building
        now = timezone.now()
        start_of_month = now.replace(day=1)

        # Bu ayki gelir ve gider
        incomes = Transaction.objects.filter(building=building, type='income', date__gte=start_of_month)
        expenses = Transaction.objects.filter(building=building, type='expense', date__gte=start_of_month)

        income_total = incomes.aggregate(total=Sum('amount'))['total'] or 0
        expense_total = expenses.aggregate(total=Sum('amount'))['total'] or 0

        # Bekleyen üye sayısı
        pending_count = User.objects.filter(building=building, approved=False, role='resident').count()

        # Son 5 ödeme (Transaction tablosundan)
        recent_transactions = Transaction.objects.filter(building=building).order_by('-date')[:5]
        transactions_data = [
            {
                "category": t.category,
                "description": t.description,
                "amount": float(t.amount),
                "type": t.type,
                "date": t.date,
            }
            for t in recent_transactions
        ]

        # Son 3 duyuru
        announcements = Announcement.objects.filter(building=building).order_by('-date_created')[:3]
        announcements_data = [
            {
                "title": a.title,
                "level": a.level,
                "date": a.date_created.date(),
            }
            for a in announcements
        ]

        return Response({
            "income_total": float(income_total),
            "expense_total": float(expense_total),
            "net_total": float(income_total - expense_total),
            "pending_count": pending_count,
            "recent_transactions": transactions_data,
            "recent_announcements": announcements_data,
        })
    
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def resident_dashboard(request):
    user = request.user

    # Bu kullanıcının tüm aidatları
    dues = Due.objects.filter(user=user).order_by("due_date")

    # Mevcut bakiye: ödenmemiş (paid olmayan) tüm aidatlar
    balance = sum(d.amount for d in dues if d.status != "paid")

    # En yakın son ödeme tarihi (pending)
    next_due_obj = dues.filter(status="pending").order_by("due_date").first()
    next_due = (
        {
            "amount": float(next_due_obj.amount),
            "due_date": next_due_obj.due_date,
        }
        if next_due_obj
        else None
    )

    # Son yapılmış ödeme (paid)
    last_payment_obj = dues.filter(status="paid").order_by("-paid_date").first()
    last_payment = (
        {
            "amount": float(last_payment_obj.amount),
            "paid_date": last_payment_obj.paid_date,
        }
        if last_payment_obj
        else None
    )

    # Yaklaşan ödemeler: en fazla 3 adet pending kayıt
    upcoming_qs = dues.filter(status="pending").order_by("due_date")[:3]
    upcoming = [
        {
            "month": d.month,
            "amount": float(d.amount),
            "status": d.status,
        }
        for d in upcoming_qs
    ]

    # Son 3 bina duyurusu
    announcements_qs = Announcement.objects.filter(
        building=user.building
    ).order_by("-date_created")[:3]
    announcements = [
        {
            "title": a.title,
            "level": a.level,
            "date": a.date_created.date(),
        }
        for a in announcements_qs
    ]

    return Response(
        {
            "balance": float(balance),
            "next_due": next_due,
            "last_payment": last_payment,
            "upcoming_dues": upcoming,
            "announcements": announcements,
        },
        status=200,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def resident_dues(request):
    user = request.user
    dues = Due.objects.filter(user=user).order_by("-month")
    serializer = DueSerializer(dues, many=True)
    return Response(serializer.data, status=200)


    user = request.user
    if user.role != "manager":
        return Response({"detail": "Yetki yok"}, status=403)

    try:
        n = PaymentNotification.objects.get(id=notif_id, resident__building=user.building)
    except PaymentNotification.DoesNotExist:
        return Response({"detail": "Bildirim bulunamadı"}, status=404)

    # 1) Status değiştir
    n.status = "approved"
    n.save()

    # 2) Transaction ekle
    Transaction.objects.create(
        type="income",
        category="aidat",
        amount=n.amount,
        description=f"{n.resident.first_name} {n.resident.last_name} - {n.due.month.strftime('%B %Y')} aidat ödemesi",
        building=user.building,
        created_by=user,
    )

    # 3) Ondan sonra due kaydını güncelle
    n.due.status = "paid"
    n.due.paid_date = timezone.now()
    n.due.save()

    return Response({"message": "Ödeme onaylandı"}, status=200)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resident_payment_notify(request):
    user = request.user
    if user.role != "resident":
        return Response({"detail": "Sadece bina sakinleri gönderebilir."}, status=403)

    serializer = PaymentNotificationSerializer(data=request.data)
    if serializer.is_valid():
        notif = serializer.save(resident=user)

        return Response({
            "message": "Ödeme bildiriminiz yöneticinin onayına gönderildi.",
            "id": notif.id
        }, status=201)

    return Response(serializer.errors, status=400)

# Aidat kayıtlarını listele (Manager)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_all_dues(request):
    user = request.user

    if user.role != "manager":
        return Response({"detail": "Yetkisiz"}, status=403)

    dues = Due.objects.filter(building=user.building).order_by("-month")
    serializer = DueSerializer(dues, many=True)
    return Response(serializer.data, status=200)


# Tüm ödeme bildirimlerini listele (Manager)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_payment_notifications(request):
    user = request.user

    if user.role != "manager":
        return Response({"detail": "Yetkisiz"}, status=403)

    notifications = PaymentNotification.objects.filter(
        resident__building=user.building
    ).order_by("-created_at")

    serializer = PaymentNotificationSerializer(notifications, many=True)
    return Response(serializer.data, status=200)

from django.shortcuts import get_object_or_404

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_monthly_dues(request):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Yetkisiz"}, status=403)

    month = request.data.get("month")   # "YYYY-MM"
    amount = request.data.get("amount")
    due_date = request.data.get("due_date")

    if not (month and amount and due_date):
        return Response({"detail": "month/amount/due_date zorunlu"}, status=400)

    # ayı DateField'e çevir (YYYY-MM -> YYYY-MM-01)
    month_date = f"{month}-01"

    residents = User.objects.filter(building=user.building, role="resident", approved=True)
    created = 0

    for r in residents:
        Due.objects.update_or_create(
            user=r,
            building=user.building,
            month=month_date,
            defaults={
                "amount": amount,
                "due_date": due_date,
                "status": "pending",
                "paid_date": None
            }
        )
        created += 1

    return Response({"message": f"{created} aidat oluşturuldu"}, status=201)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def approve_payment_notification(request, notif_id):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Yetki yok"}, status=403)

    n = get_object_or_404(
        PaymentNotification,
        id=notif_id,
        resident__building=user.building
    )

    if n.status != "pending":
        return Response({"detail": "Bu bildirim zaten işlenmiş."}, status=400)

    n.status = "approved"
    n.save()

    # income transaction ekle
    Transaction.objects.create(
        type="income",
        category="aidat",
        amount=n.amount,
        description=f"{n.resident.first_name} {n.resident.last_name} - {n.due.month.strftime('%B %Y')} aidat ödemesi",
        building=user.building,
        created_by=user,
    )

    # due güncelle
    n.due.status = "paid"
    n.due.paid_date = timezone.now().date()
    n.due.save()

    return Response({"message": "Ödeme onaylandı"}, status=200)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def reject_payment_notification(request, notif_id):
    user = request.user
    if user.role != "manager":
        return Response({"detail": "Yetki yok"}, status=403)

    n = get_object_or_404(
        PaymentNotification,
        id=notif_id,
        resident__building=user.building
    )

    if n.status != "pending":
        return Response({"detail": "Bu bildirim zaten işlenmiş."}, status=400)

    n.status = "rejected"
    n.save()
    return Response({"message": "Ödeme reddedildi"}, status=200)
