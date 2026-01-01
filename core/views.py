from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Sum
from django.utils import timezone
from .models import (
    User, Building, Transaction, Announcement,
    Due, PaymentNotification, Message
)

from .serializers import (
    RegisterSerializer,
    MeSerializer,
    TransactionSerializer,
    AnnouncementSerializer,
    DueSerializer,
    PaymentNotificationSerializer,   # 🔥 BUNU EKLE
    MessageSerializer
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

    def put(self, request):
        user = request.user
        data = request.data

        # Verileri güncelle
        if "first_name" in data:
            user.first_name = data["first_name"]
        if "last_name" in data:
            user.last_name = data["last_name"]
        if "phone" in data:
            user.phone = data["phone"]
        
        # Email değişecekse unique kontrolü yap
        if "email" in data and data["email"] != user.email:
            new_email = data["email"]
            if User.objects.filter(email=new_email).exists():
                return Response({"error": "Bu e-posta adresi zaten kullanılıyor."}, status=400)
            user.email = new_email

        user.save()
        
        serializer = MeSerializer(user)
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

# core/views.py içindeki member_detail fonksiyonunu bununla değiştir:

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

    # Üyenin ödenmiş aidatlarını çek (Son 10 tanesi)
    paid_dues = Due.objects.filter(user=member, status='paid').order_by('-paid_date')[:10]
    
    payments_data = [
        {
            "amount": d.amount,
            "month": d.month, # Hangi ayın aidatı
            "paid_date": d.paid_date, # Ne zaman ödedi
        }
        for d in paid_dues
    ]

    data = {
        "id": member.id,
        "email": member.email,
        "first_name": member.first_name,
        "last_name": member.last_name,
        "role": member.role,
        "approved": member.approved,
        "phone": member.phone,                 # <--- YENİ
        "apartment_number": member.apartment_number, # <--- YENİ
        "date_joined": member.date_joined,     # <--- YENİ
        "building": member.building.name if member.building else None,
        "aidat_bilgileri": payments_data,      # <--- DOLU LİSTE
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
        
        # --- TARİH FİLTRESİ ---
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if start_date:
            transactions = transactions.filter(date__gte=start_date)
        if end_date:
            transactions = transactions.filter(date__lte=end_date)
            
        # Varsayılan sıralama
        transactions = transactions.order_by('-date')

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

        # --- GELİŞMİŞ RAPOR VERİLERİ ---
        # 1. Toplam Borç (Ödenmemiş tüm aidatlar)
        total_debt = Due.objects.filter(building=building).exclude(status='paid').aggregate(total=Sum('amount'))['total'] or 0

        # 2. Tahsilat Oranı (Bu ay)
        # Bu ay beklenen toplam (status farketmeksizin)
        expected_total = Due.objects.filter(
            building=building, 
            month__year=now.year, 
            month__month=now.month
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Bu ay toplanan (sadece paid)
        collected_total = Due.objects.filter(
            building=building, 
            month__year=now.year, 
            month__month=now.month,
            status='paid'
        ).aggregate(total=Sum('amount'))['total'] or 0

        collection_rate = 0
        if expected_total > 0:
            collection_rate = (collected_total / expected_total) * 100

        return Response({
            "income_total": float(income_total),
            "expense_total": float(expense_total),
            "net_total": float(income_total - expense_total),
            "pending_count": pending_count,
            "recent_transactions": transactions_data,
            "recent_announcements": announcements_data,
            # Yeni Rapor Verileri
            "total_debt": float(total_debt),
            "collection_rate": round(collection_rate, 1)
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
        due=n.due  # <--- BAĞLANTIYI KURUYORUZ
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
@permission_classes([IsAuthenticated])
def list_all_dues(request):
    try:
        user = request.user
        if user.role != "manager":
            return Response({"detail": "Yetkisiz"}, status=403)

        dues = Due.objects.filter(building=user.building).order_by("-month")
        serializer = DueSerializer(dues, many=True)
        return Response(serializer.data, status=200)
    except Exception as e:
        import traceback
        with open("debug_errors.log", "a", encoding="utf-8") as f:
            f.write(f"\n--- ERROR IN list_all_dues AT {timezone.now()} ---\n")
            f.write(traceback.format_exc())
            f.write("\n------------------------------\n")
        return Response({"detail": "Sunucu hatası"}, status=500)


# Tüm ödeme bildirimlerini listele (Manager)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_payment_notifications(request):
    try:
        user = request.user
        if user.role != "manager":
            return Response({"detail": "Yetkisiz"}, status=403)

        notifications = PaymentNotification.objects.filter(
            resident__building=user.building
        ).select_related('resident', 'due').order_by("-created_at")

        serializer = PaymentNotificationSerializer(notifications, many=True)
        return Response(serializer.data, status=200)
    except Exception as e:
        import traceback
        with open("debug_errors.log", "a", encoding="utf-8") as f:
            f.write(f"\n--- ERROR IN list_payment_notifications AT {timezone.now()} ---\n")
            f.write(traceback.format_exc())
            f.write("\n------------------------------\n")
        return Response({"detail": "Sunucu hatası"}, status=500)

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
    due_type = request.data.get("type", "aidat") # Varsayılan aidat

    if not (month and amount and due_date):
        return Response({"detail": "month/amount/due_date zorunlu"}, status=400)

    try:
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
                    "type": due_type,
                    "status": "pending",
                    "paid_date": None
                }
            )
            created += 1

        return Response({"message": f"{created} aidat oluşturuldu"}, status=201)
    except Exception as e:
        import traceback
        with open("debug_errors.log", "a", encoding="utf-8") as f:
            f.write(f"\n--- ERROR IN create_monthly_dues AT {timezone.now()} ---\n")
            f.write(traceback.format_exc())
            f.write("\n------------------------------\n")
        return Response({"detail": f"Sunucu hatası: {str(e)}"}, status=500)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_due_status(request, due_id):
    """
    Aidat durumunu manuel güncelleme (Arşive alma / Geri yükleme)
    """
    if request.user.role != "manager":
        return Response({"detail": "Yetkisiz"}, status=403)
        
    due = get_object_or_404(Due, id=due_id, building=request.user.building)
    
    action = request.data.get("action") # "archive" or "restore" or "status_update" (paid/pending)
    
    # 1. Arşivleme İşlemi (Ödeme durumundan bağımsız)
    if action == "archive":
        due.is_archived = True
        due.save()
        return Response({"message": "Arşivlendi", "is_archived": True}, status=200)
    
    elif action == "restore":
        due.is_archived = False
        due.save()
        return Response({"message": "Arşivden çıkarıldı", "is_archived": False}, status=200)

    # 2. Eskisi gibi status update (OPSİYONEL - eğer hala kullanılıyorsa)
    # Ancak kullanıcı "Arşivleme otomatik ödeme yapmasın" dediği için bunu ayırıyoruz.
    status = request.data.get("status")
    if status:
        if status == "paid":
            due.status = "paid"
            due.paid_date = timezone.now().date()
            
            # --- TRANSACTION OLUŞTUR (GELİR) ---
            # Eğer daha önce oluşturulmamışsa
            Transaction.objects.get_or_create(
                due=due,
                defaults={
                    "type": "income",
                    "category": due.type.upper() if due.type else "AIDAT",
                    "description": f"{due.month} - {due.get_type_display()} Ödemesi ({due.user.first_name} {due.user.last_name})",
                    "amount": due.amount,
                    "date": timezone.now().date(),
                    "created_by": request.user,
                    "building": request.user.building,
                    "visible_to_residents": True
                }
            )

        elif status == "pending":
            due.status = "pending"
            due.paid_date = None
            
            # --- TRANSACTION SİL (GELİR İPTALİ) ---
            Transaction.objects.filter(due=due).delete()

        due.save()
    
    return Response({"message": "Güncellendi", "status": due.status}, status=200)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_due(request, due_id):
    if request.user.role != "manager":
        return Response({"detail": "Yetkisiz"}, status=403)
        
    due = get_object_or_404(Due, id=due_id, building=request.user.building)
    due.delete()
    return Response({"message": "Aidat silindi"}, status=200)


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
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_payment_notification(request, notif_id):
    """
    Yönetici ödeme bildirimini reddeder.
    """
    if request.user.role != 'manager':
        return Response({"error": "Yetkisiz işlem."}, status=403)

    try:
        notif = PaymentNotification.objects.get(id=notif_id, due__building=request.user.building)
    except PaymentNotification.DoesNotExist:
        return Response({"error": "Bildirim bulunamadı."}, status=404)

    notif.status = 'rejected'
    notif.save()
    
    # Due durumunu güncellemiyoruz, beklemede kalıyor veya tekrar bildirim atabilir.
    
    return Response({"message": "Ödeme bildirimi reddedildi."})


# ================================================================
#   MESSAGING VIEWS (RESIDENT SIDE)
# ================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def resident_messages(request):
    """
    GET: Resident'ın gönderdiği mesajları listeler.
    POST: Yöneticiye yeni mesaj gönderir.
    """
    if request.user.role != 'resident':
        return Response({"error": "Sadece sakinler mesaj gönderebilir."}, status=403)

    if not request.user.building:
        return Response({"error": "Herhangi bir binaya kayıtlı değilsiniz."}, status=400)

    try:
        if request.method == 'GET':
            # Arşivlenmemişleri getir (varsayılan)
            # ?archived=true parametresi gelirse arşivlenmişleri getir
            is_archived = request.query_params.get('archived', 'false') == 'true'
            msgs = Message.objects.filter(
                sender=request.user, 
                archived_by_resident=is_archived
            ).order_by('-created_at')
            
            serializer = MessageSerializer(msgs, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            content = request.data.get('content')
            if not content:
                return Response({"error": "Mesaj içeriği boş olamaz."}, status=400)

            msg = Message.objects.create(
                sender=request.user,
                building=request.user.building,
                content=content
            )
            serializer = MessageSerializer(msg)
            return Response(serializer.data, status=201)
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        try:
            with open("debug_errors.log", "a", encoding="utf-8") as f:
                f.write(f"\n--- ERROR AT {timezone.now()} ---\n")
                f.write(error_msg)
                f.write("\n------------------------------\n")
        except:
            print("Loglama hatası")
            
        return Response({"error": f"Sunucu Hatası: {str(e)}"}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resident_message_archive(request, msg_id):
    """
    Mesajı resident tarafında arşivler/arşivden çıkarır.
    """
    try:
        msg = Message.objects.get(id=msg_id, sender=request.user)
    except Message.DoesNotExist:
        return Response({"error": "Mesaj bulunamadı."}, status=404)

    # Toggle archive status
    msg.archived_by_resident = not msg.archived_by_resident
    msg.save()
    return Response({"status": "updated", "archived": msg.archived_by_resident})


# ================================================================
#   MESSAGING VIEWS (MANAGER SIDE)
# ================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_messages(request):
    """
    Yöneticinin binasındaki sakinlerden gelen mesajları listeler.
    """
    if request.user.role != 'manager':
        return Response({"error": "Yetkisiz işlem."}, status=403)

    if not request.user.building:
        return Response({"error": "Yönettiğiniz bir bina yok."}, status=400)

    is_archived = request.query_params.get('archived', 'false') == 'true'
    msgs = Message.objects.filter(
        building=request.user.building,
        archived_by_manager=is_archived
    ).order_by('-created_at')

    serializer = MessageSerializer(msgs, many=True)
    return Response(serializer.data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def manager_message_mark_read(request, msg_id):
    """
    Yönetici mesajı okundu olarak işaretler.
    """
    if request.user.role != 'manager':
        return Response({"error": "Yetkisiz işlem."}, status=403)

    try:
        msg = Message.objects.get(id=msg_id, building=request.user.building)
    except Message.DoesNotExist:
        return Response({"error": "Mesaj bulunamadı."}, status=404)

    msg.is_read = True
    msg.save()
    return Response({"status": "marked_as_read"})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def manager_message_archive(request, msg_id):
    """
    Mesajı yönetici tarafında arşivler/arşivden çıkarır.
    """
    if request.user.role != 'manager':
        return Response({"error": "Yetkisiz işlem."}, status=403)

    try:
        msg = Message.objects.get(id=msg_id, building=request.user.building)
    except Message.DoesNotExist:
        return Response({"error": "Mesaj bulunamadı."}, status=404)

    # Toggle archive status
    msg.archived_by_manager = not msg.archived_by_manager
    msg.save()
    return Response({"status": "updated", "archived": msg.archived_by_manager})
