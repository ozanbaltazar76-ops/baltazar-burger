/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Menu,
  ChevronLeft,
  Plus,
  Edit2,
  Trash2,
  Settings,
  X,
  Save,
  Image as ImageIcon,
  ArrowRight,
  Sparkles,
  Loader2,
  ShoppingCart,
  CheckCircle,
  Clock,
  ClipboardList,
  MessageSquare,
  Flame,
  Truck,
  LogOut,
  LogIn,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Bell,
  MapPin,
  ChefHat,
  PackageCheck,
  QrCode,
  ShoppingBag
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  updateDoc,
  deleteDoc,
  orderBy,
  where,
  limit,
  getDoc,
  getDocs,
  increment,
  writeBatch
} from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { GoogleGenAI, Type } from "@google/genai";
import { db, auth, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

// --- Types ---
interface Category {
  id: string;
  name: string;
  name_en?: string;
  name_ar?: string;
  image: string;
  order?: number;
}
interface ItemVariant {
  label: string;
  label_en?: string;
  label_ar?: string;
  priceOverride?: number;
}

interface Item {
  id: string;
  categoryId: string;
  name: string;
  name_en?: string;
  name_ar?: string;
  price: number;
  description: string;
  description_en?: string;
  description_ar?: string;
  image: string;
  inStock?: boolean;
  variants?: ItemVariant[];
}

interface OrderItem {
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant?: string;
}

interface CartItem extends Item {
  cartItemId: string;
  quantity: number;
  selectedVariant?: ItemVariant;
}

interface AppTable {
  id: string;
  number: string;
  last_reset_at: number;
}

interface Order {
  id: string;
  table: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  paymentStatus?: 'unpaid' | 'paid';
  note?: string;
  timestamp: number;
}

// --- Translations ---
const TRANSLATIONS: Record<string, any> = {
  tr: {
    back: 'Geri Dön',
    admin: 'Yönetici Paneli',
    categories: 'Kategoriler',
    items: 'Ürünler',
    orders: 'Siparişler',
    add_item: 'Yeni Ürün Tanımla',
    add_cat: 'Yeni Kategori Ekle',
    edit: 'Düzenle',
    delete: 'Sil',
    save: 'Kaydet ve Kapat',
    apply: 'Değişiklikleri Uygula',
    price: 'Fiyat',
    description: 'İçerik Açıklaması',
    name: 'İsim',
    img_url: 'Görsel URL',
    listed_count: 'Ürün Listelendi',
    empty_cat: 'Bu kategori şimdilik boş görünüyor.',
    cat_settings: 'Kategori Ayarları',
    select_cat: 'Kategori Seçiniz',
    admin_desc: 'Düzenlemek istediğiniz kategoriyi sağ üstten seçin.',
    update_item: 'Ürünü Güncelle',
    manage_cat: 'Kategoriyi Yönet',
    add_to_cart: 'Ekle',
    auto_translate: 'Otomatik Çevir',
    translating: 'Çevriliyor...',
    cart_title: 'Siparişiniz',
    empty_cart: 'Sepetiniz boş.',
    total: 'Toplam',
    place_order: 'Siparişi Tamamla',
    table_no: 'Masa Numarası',
    order_success: 'Sipariş Alındı!',
    order_desc: 'Siparişiniz mutfağa iletildi. Afiyet olsun.',
    new_order: 'Yeni Sipariş',
    pending: 'Bekliyor',
    preparing: 'Hazırlanıyor',
    ready: 'Hazır',
    delivered: 'Teslim Edildi',
    note: 'Not Ekle',
    note_label: 'Sipariş Notu',
    customer_note: 'Müşteri Notu',
    login_admin: 'Yönetici Girişi',
    logout: 'Çıkış Yap',
    error_auth: 'Yetkisiz erişim. Lütfen yönetici hesabı ile giriş yapın.',
    error_generic: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    call_waiter: 'Garson Çağır',
    waiter_called: 'Garson Çağrıldı!',
    waiter_desc: 'Garsonumuz en kısa sürede masanıza gelecektir.',
    complete_payment: 'Ödemeyi Tamamla',
    print_receipt: 'Fiş Yazdır',
    service_calls: 'Servis Çağrıları',
    no_calls: 'Bekleyen çağrı yok.',
    complete_call: 'Tamamla',
    dashboard: 'Panel',
    revenue: 'Gelir',
    total_orders: 'Toplam Sipariş',
    pending_orders: 'Bekleyen Sipariş',
    today: 'Bugün',
    reset_day: 'Günü Sıfırla',
    reset_confirm: 'Tüm aktif siparişler teslim edildi olarak işaretlensin mi?',
    order_history: 'Sipariş Geçmişi',
    active_orders: 'Aktif Siparişler',
    no_active_orders: 'Şu anda aktif sipariş yok.',
    waiter_needed: 'Garson Bekleniyor',
    settings: 'Ayarlar',
    admin_emails: 'Yönetici E-postaları',
    add: 'Ekle',
    welcome_title: 'Hoş Geldiniz',
    welcome_desc: 'Sipariş vermek için lütfen masa numaranızı girin.',
    start_order: 'Siparişe Başla',
    table_required: 'Masa no zorunlu',
    in_stock: 'Stokta Var',
    item_variants: 'Ürün Varyantları',
    add_variant: 'Varyant Ekle',
    variant_label_ex: 'Etiket (örn: 150g)',
    enable_ordering: 'Siparişi Aktif Et'
  },
  en: {
    back: 'Go Back',
    admin: 'Admin Panel',
    categories: 'Categories',
    items: 'Items',
    orders: 'Orders',
    add_item: 'Add New Item',
    add_cat: 'Add New Category',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save and Close',
    apply: 'Apply Changes',
    price: 'Price',
    description: 'Content Description',
    name: 'Name',
    img_url: 'Image URL',
    listed_count: 'Items Listed',
    empty_cat: 'This category looks empty for now.',
    cat_settings: 'Category Settings',
    select_cat: 'Select Category',
    admin_desc: 'Select a category from the top right to edit.',
    update_item: 'Update Item',
    manage_cat: 'Manage Category',
    add_to_cart: 'Add',
    auto_translate: 'Auto Translate',
    translating: 'Translating...',
    cart_title: 'Your Order',
    empty_cart: 'Your cart is empty.',
    total: 'Total',
    place_order: 'Place Order',
    table_no: 'Table Number',
    order_success: 'Order Received!',
    order_desc: 'Your order is in the kitchen. Enjoy!',
    new_order: 'New Order',
    pending: 'Pending',
    preparing: 'Preparing',
    ready: 'Ready',
    delivered: 'Delivered',
    note: 'Add Note',
    note_label: 'Order Note',
    customer_note: 'Customer Note',
    login_admin: 'Admin Login',
    logout: 'Logout',
    error_auth: 'Unauthorized access. Please login with an admin account.',
    error_generic: 'An error occurred. Please try again.',
    call_waiter: 'Call Waiter',
    waiter_called: 'Waiter Called!',
    waiter_desc: 'A waiter will be at your table shortly.',
    complete_payment: 'Complete Payment',
    print_receipt: 'Print Receipt',
    service_calls: 'Service Calls',
    no_calls: 'No pending calls.',
    complete_call: 'Complete',
    dashboard: 'Dashboard',
    revenue: 'Revenue',
    total_orders: 'Total Orders',
    pending_orders: 'Pending Orders',
    today: 'Today',
    reset_day: 'Reset Day',
    reset_confirm: 'Mark all active orders as delivered for today?',
    order_history: 'Order History',
    active_orders: 'Active Orders',
    no_active_orders: 'No active orders right now.',
    waiter_needed: 'Waiter Needed',
    settings: 'Settings',
    admin_emails: 'Admin Emails',
    add: 'Add',
    welcome_title: 'Welcome',
    welcome_desc: 'Please enter your table number to start ordering.',
    start_order: 'Start Order',
    table_required: 'Table required',
    in_stock: 'In Stock',
    item_variants: 'Item Variants',
    add_variant: 'Add Variant',
    variant_label_ex: 'Label (ex: 150g)',
    enable_ordering: 'Enable Ordering System'
  },
  ar: {
    back: 'العودة',
    admin: 'لوحة التحكم',
    categories: 'الفئات',
    items: 'الأصناف',
    orders: 'الطلبات',
    add_item: 'إضافة صنف جديد',
    add_cat: 'إضافة فئة جديدة',
    edit: 'تعديل',
    delete: 'حذف',
    save: 'حفظ وإغلاق',
    apply: 'تطبيق التغييرات',
    price: 'السعر',
    description: 'وصف المحتوى',
    name: 'الاسم',
    img_url: 'رابط الصورة',
    listed_count: 'صنفاً معروضاً',
    empty_cat: 'هذه الفئة تبدو فارغة حالياً.',
    cat_settings: 'إعدادات الفئة',
    select_cat: 'اختر الفئة',
    admin_desc: 'اختر فئة من أعلى اليمين للبدء في التعديل.',
    update_item: 'تحديث الصنف',
    manage_cat: 'إدارة الفئة',
    add_to_cart: 'أضف',
    auto_translate: 'ترجمة تلقائية',
    translating: 'جاري الترجمة...',
    cart_title: 'طلبك',
    empty_cart: 'سلتك فارغة.',
    total: 'المجموع',
    place_order: 'إتمام الطلب',
    table_no: 'رقم الطاولة',
    order_success: 'تم استلام الطلب!',
    order_desc: 'طلبك في المطبخ الآن. بالعافية!',
    new_order: 'طلب جديد',
    pending: 'قيد الانتظار',
    preparing: 'قيد التحضير',
    ready: 'جاهز',
    delivered: 'تم التوصيل',
    note: 'إضافة ملاحظة',
    note_label: 'ملاحظة الطلب',
    customer_note: 'ملاحظة العميل',
    login_admin: 'دخول المسؤول',
    logout: 'تسجيل الخروج',
    error_auth: 'دخول غير مصرح به. يرجى تسجيل الدخول بحساب المسؤول.',
    error_generic: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
    call_waiter: 'طلب النادل',
    waiter_called: 'تم طلب النادل!',
    waiter_desc: 'سيأتي النادل إلى طاولتك قريباً.',
    complete_payment: 'إتمام الدفع',
    print_receipt: 'طباعة الفاتورة',
    service_calls: 'طلبات الخدمة',
    no_calls: 'لا توجد طلبات.',
    complete_call: 'إكمال',
    dashboard: 'لوحة المعلومات',
    revenue: 'الإيرادات',
    total_orders: 'إجمالي الطلبات',
    pending_orders: 'الطلبات المعلقة',
    today: 'اليوم',
    reset_day: 'إعادة تعيين اليوم',
    reset_confirm: 'هل تريد تحديد جميع الطلبات النشطة كمُسلَّمة؟',
    order_history: 'سجل الطلبات',
    active_orders: 'الطلبات النشطة',
    no_active_orders: 'لا توجد طلبات نشطة حالياً.',
    waiter_needed: 'مطلوب نادل',
    settings: 'الإعدادات',
    admin_emails: 'رسائل البريد الإلكتروني للمسؤول',
    add: 'إضافة',
    welcome_title: 'مرحباً',
    welcome_desc: 'يرجى إدخال رقم الطاولة لبدء الطلب.',
    start_order: 'ابدأ الطلب',
    table_required: 'رقم الطاولة مطلوب',
    in_stock: 'متوفر',
    item_variants: 'خيارات الصنف',
    add_variant: 'إضافة خيار',
    variant_label_ex: 'الاسم (مثال: ١٥٠غ)',
    enable_ordering: 'تفعيل نظام الطلب'
  }
};

// --- Initial Data (Fallbacks) ---
const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Burgerler', name_en: 'Burgers', name_ar: 'برجر', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500' },
  { id: '2', name: 'Atıştırmalıklar', name_en: 'Snacks', name_ar: 'سناك', image: 'https://images.unsplash.com/photo-1573019606806-9695d0a9739d?w=500' },
  { id: '3', name: 'Hafif Yemekler', name_en: 'Light Meals', name_ar: 'وجبات خفيفة', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500' },
  { id: '4', name: 'Çocuklar İçin', name_en: 'For Kids', name_ar: 'للأطفال', image: 'https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=500' },
];

const INITIAL_ITEMS: Item[] = [
  {
    id: 'i1',
    categoryId: '1',
    name: 'Baltazar Classic',
    name_en: 'Baltazar Classic',
    name_ar: 'بالتازار كلاسيك',
    price: 250,
    description: 'Dana köfte, karamelize soğan, cheddar peyniri.',
    description_en: 'Beef patty, caramelized onions, cheddar cheese.',
    description_ar: 'قطعة لحم بقري، بصل مكرمل، جبنة شيدر.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500'
  },
];

// --- Constants ---
const ADMIN_EMAILS = [
  "adam.osama60@gmail.com",
  "ozanbaltazar76@gmail.com",
  "hakan.4444fb@gmail.com"
];
const translationModel = "gemini-2.5-flash-lite";

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

// --- Helpers ---
const cleanJson = (text: string) => {
  return text.replace(/```json\n?|```/g, '').trim();
};

const getTimeElapsed = (timestamp: number, lang: string = 'en') => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);

  if (lang === 'tr') {
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins}dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}s önce`;
    return `${Math.floor(hours / 24)}g önce`;
  }

  if (lang === 'ar') {
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${Math.floor(hours / 24)} يوم`;
  }

  // Default to EN
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [lang, setLang] = useState('tr');
  // Validate restored view — only allow 'admin' if the user is actually admin.
  // On load: if a tracked order ID exists in localStorage, auto-route to 'track'.
  // Admin view requires authLoading to complete before we know if the user is admin.
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('lastView') || 'menu';
    // If last view was admin, keep it — onAuthStateChanged will validate
    if (saved === 'admin') return 'admin';
    if (!localStorage.getItem('tableNumber')) return 'welcome';
    if (localStorage.getItem('trackedOrderId')) return 'track';
    return saved;
  });
  const [adminSubView, setAdminSubView] = useState<'dashboard' | 'orders' | 'takeaway' | 'categories' | 'items' | 'calls' | 'settings' | 'tables'>(() => (localStorage.getItem('lastAdminSubView') as any) || 'dashboard');
  const [dbAdmins, setDbAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(null);
  const [newTableNumber, setNewTableNumber] = useState('');

  // fetch admins when settings view opens
  useEffect(() => {
    if (adminSubView === 'settings' && isAdmin) {
      getDocs(collection(db, 'admins')).then(snap => {
        const emails = snap.docs.map(doc => doc.id);
        setDbAdmins(emails);
      }).catch(e => console.error(e));
    }
  }, [adminSubView, isAdmin]);

  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tables, setTables] = useState<AppTable[]>([]);
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [serviceCalls, setServiceCalls] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [takeawayStats, setTakeawayStats] = useState(0);
  const [tableNumber, setTableNumber] = useState(() => localStorage.getItem('tableNumber') || '');
  const [orderNote, setOrderNote] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (file: File, type: 'category' | 'item') => {
    if (!isAdmin) {
      console.error("Upload attempt without admin privileges");
      setError(t.error_auth);
      return null;
    }

    try {
      console.log("Starting image upload for:", file.name, "type:", type, "size:", (file.size / 1024).toFixed(2), "KB");
      setIsUploading(true);

      let fileToUpload = file;

      /* Skipping compression for now to isolate issues with the library
      try {
        console.log("Attempting compression...");
        const options = {
          maxSizeMB: 0.7,
          maxWidthOrHeight: 1200,
          useWebWorker: false,
        };
        fileToUpload = await imageCompression(file, options);
        console.log("Compression successful. New size:", (fileToUpload.size / 1024).toFixed(2), "KB");
      } catch (err) {
        console.warn("Compression failed, uploading original file:", err);
      }
      */

      const storageRef = ref(storage, `${type}-images/${Date.now()}-${file.name}`);
      console.log("Uploading to path:", storageRef.fullPath);

      const result = await uploadBytes(storageRef, fileToUpload);
      console.log("Upload resolved:", result.metadata.fullPath);

      const downloadURL = await getDownloadURL(storageRef);
      console.log("Obtained download URL:", downloadURL);

      setIsUploading(false);
      return downloadURL;
    } catch (error: any) {
      console.error("Storage upload error details:", error);
      // Detailed error reporting back to UI
      const errorMessage = error.code ? `Storage Error: ${error.code}` : t.error_generic;
      setError(errorMessage);
      setIsUploading(false);
      return null;
    }
  };
  const [isOrdering, setIsOrdering] = useState(false);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [lastOrder, setLastOrder] = useState<Order | null>(() => {
    const saved = localStorage.getItem('lastOrder');
    return saved ? JSON.parse(saved) : null;
  });
  // Separate stable tracked order ID — persisted in localStorage.
  // Stored independently so it survives page refresh for the tracking view.
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(
    () => localStorage.getItem('trackedOrderId')
  );
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderingEnabled, setIsOrderingEnabled] = useState(true);

  // When ordering is disabled, automatically skip the welcome screen (table selection)
  useEffect(() => {
    if (!isOrderingEnabled && (view === 'welcome' || view === 'cart')) {
      setView('menu');
    }
  }, [isOrderingEnabled, view]);

  const t = TRANSLATIONS[lang];
  const isRtl = lang === 'ar';

  const prevOrdersCount = React.useRef(0);
  const prevCallsCount = React.useRef(0);

  // Persistence Effects
  useEffect(() => {
    if (!localStorage.getItem('deviceId')) {
      localStorage.setItem('deviceId', uuidv4());
    }

    // Auto-login from QR Code
    const params = new URLSearchParams(window.location.search);
    const tbl = params.get('table');
    if (tbl) {
      if (tbl === 'takeaway') {
        setTableNumber('takeaway');
        setView('menu');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        getDoc(doc(db, 'tables', tbl)).then((snap) => {
          if (snap.exists()) {
            setTableNumber(tbl);
            setView('menu');
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            alert('Invalid table. Please call waiter.');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    // Block accidental back-swipes
    window.history.pushState(null, '', window.location.href);
    window.onpopstate = () => {
      window.history.pushState(null, '', window.location.href);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('lastView', view);
  }, [view]);

  useEffect(() => {
    let devStart = parseInt(localStorage.getItem('session_start') || '0', 10);
    if (!devStart) {
      devStart = Date.now();
      localStorage.setItem('session_start', devStart.toString());
    }

    if (tableNumber) {
      const tbl = tables.find(t => t.id === tableNumber || t.number === tableNumber);
      if (tbl && tbl.last_reset_at > devStart) {
        devStart = Date.now();
        localStorage.setItem('session_start', devStart.toString());
        setView('welcome');
        setTableNumber('');
        localStorage.removeItem('tableNumber');
        localStorage.removeItem('trackedOrderId');
        setLastOrder(null);
        return;
      }

      const unsubscribe = onSnapshot(doc(db, 'carts', tableNumber), (snap) => {
        if (snap.exists()) {
          setCart(snap.data().items || []);
        } else {
          setCart([]);
        }
      });
      return () => unsubscribe();
    }
  }, [tableNumber, tables]);

  useEffect(() => {
    localStorage.setItem('lastAdminSubView', adminSubView);
  }, [adminSubView]);

  useEffect(() => {
    localStorage.setItem('tableNumber', tableNumber);
  }, [tableNumber]);

  useEffect(() => {
    if (lastOrder) {
      localStorage.setItem('lastOrder', JSON.stringify(lastOrder));
    } else {
      localStorage.removeItem('lastOrder');
    }
  }, [lastOrder]);

  // Notification Sound Effect — plays /assets/notification.mp3 for new orders/calls
  useEffect(() => {
    if (!isAdmin) return;

    const playSound = () => {
      const audio = new Audio("/notification.mp3");
      audio.play().catch(e => console.log("Audio play blocked by browser", e));
    };

    let intervalId: any = null;
    const hasPendingBill = serviceCalls.some(c => c.type === 'bill' && c.status === 'pending');

    if (hasPendingBill) {
      playSound();
      intervalId = setInterval(playSound, 4000); // loop sound for bill every 4s
    } else {
      if (liveOrders.length > prevOrdersCount.current) {
        playSound();
      }
      if (serviceCalls.length > prevCallsCount.current) {
        playSound();
      }
    }

    prevOrdersCount.current = liveOrders.length;
    prevCallsCount.current = serviceCalls.length;

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAdmin, liveOrders.length, serviceCalls]);

  // Auth Persistence Initialization
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
  }, []);

  // Lazy GenAI initialization
  // Vite exposes env vars via import.meta.env; must be prefixed VITE_
  const getGenAI = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY is missing from environment variables");
    }
    return new GoogleGenAI({ apiKey });
  };

  const handleFirestoreError = useCallback((err: any, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: err instanceof Error ? err.message : String(err),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError("An error occurred with the database. Please try again.");
  }, []);

  // --- Auth & Admin Verification ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        let isVerifiedAdmin = ADMIN_EMAILS.includes(currentUser.email || "");

        // Unified Admin Authorization: Check admins collection
        if (!isVerifiedAdmin && currentUser.email) {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', currentUser.email));
            if (adminDoc.exists()) {
              isVerifiedAdmin = true;
            }
          } catch (e) {
            console.error("Admin check failed:", e);
          }
        }

        // Check legacy users collection
        if (!isVerifiedAdmin) {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
              isVerifiedAdmin = true;
            }
          } catch (e) {
            console.error("User role check failed:", e);
          }
        }

        setIsAdmin(isVerifiedAdmin);
        if (isVerifiedAdmin) {
          const savedView = localStorage.getItem('lastView');
          if (savedView === 'admin') setView('admin');
        } else {
          // Not admin — kick out of admin view if they were there
          setView(prev => prev === 'admin' ? 'welcome' : prev);
        }
      } else {
        setIsAdmin(false);
        setView(prev => prev === 'admin' ? 'welcome' : prev);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Timer Update ---
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const loginAdmin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;

      let isVerifiedAdmin = ADMIN_EMAILS.includes(currentUser.email || "");

      if (!isVerifiedAdmin) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          isVerifiedAdmin = true;
        }
      }

      if (isVerifiedAdmin) {
        setIsAdmin(true);
        setView('admin');
      } else {
        setError(t.error_auth);
        await signOut(auth);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(t.error_auth);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setView(localStorage.getItem('tableNumber') ? 'menu' : 'welcome');
  };

  // --- Data Fetching ---
  useEffect(() => {
    // Categories
    const unsubscribeCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      // Always include doc.id so edit/delete work for any document
      const cats = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Category))
        .filter(c => c.id !== 'admin_settings')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (cats.length === 0 && isAdmin) {
        // Seed initial categories if empty and user is admin
        INITIAL_CATEGORIES.forEach(cat => {
          setDoc(doc(db, 'categories', cat.id), cat).catch(e => handleFirestoreError(e, OperationType.WRITE, 'categories'));
        });
        // Still stop loading — next snapshot will populate categories
        setIsLoading(false);
      } else {
        setCategories(cats);
        setIsLoading(false);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'categories');
      setIsLoading(false);
    });

    // Items
    const unsubscribeItems = onSnapshot(collection(db, 'items'), (snapshot) => {
      const its = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Item));
      if (its.length === 0 && isAdmin) {
        INITIAL_ITEMS.forEach(item => {
          setDoc(doc(db, 'items', item.id), item).catch(e => handleFirestoreError(e, OperationType.WRITE, 'items'));
        });
      } else {
        setItems(its);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'items'));

    // Tables
    const unsubscribeTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const ts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppTable));
      setTables(ts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tables'));

    // Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'siteConfig'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.isOrderingEnabled !== undefined) {
          setIsOrderingEnabled(data.isOrderingEnabled);
        }
      } else {
        if (isAdmin) {
          setDoc(doc(db, 'settings', 'siteConfig'), { isOrderingEnabled: true }, { merge: true });
        }
      }
    });

    return () => {
      unsubscribeCats();
      unsubscribeItems();
      unsubscribeTables();
      unsubscribeSettings();
    };
  }, [isAdmin, handleFirestoreError]);

  // Customer Order Tracking
  // Uses a stable `trackedOrderId` (set only when a new order is placed)
  // instead of `lastOrder?.id` to prevent an infinite re-subscription loop
  // where setLastOrder() inside the listener would re-trigger this effect.
  useEffect(() => {
    if (!trackedOrderId) return;
    const unsubscribe = onSnapshot(doc(db, 'orders', trackedOrderId), (docSnap) => {
      if (docSnap.exists()) {
        const updatedOrder = { id: docSnap.id, ...docSnap.data() } as Order;
        setLastOrder(updatedOrder);
      } else {
        // Order was deleted entirely or completed and removed
        setLastOrder(null);
        setTrackedOrderId(null);
        localStorage.removeItem('trackedOrderId');
        localStorage.removeItem('lastOrder');
        setView('menu');
      }
    }, (error) => {
      console.error("Order tracking snapshot error:", error);
    });
    return () => unsubscribe();
  }, [trackedOrderId]);

  // Table-wide session tracking for customers (all unpaid orders)
  useEffect(() => {
    if (!tableNumber || isAdmin) return;
    const q = query(
      collection(db, 'orders'),
      where('table', '==', tableNumber),
      where('paymentStatus', '==', 'unpaid'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setSessionOrders(orders);
    }, (error) => {
      console.error("Session tracking error:", error);
    });
    return () => unsubscribe();
  }, [tableNumber, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    // Active / Unpaid Orders
    const q = query(
      collection(db, 'orders'),
      where('paymentStatus', '==', 'unpaid'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setLiveOrders(orders);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    // Service Calls
    const qCalls = query(
      collection(db, 'service_calls'),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeCalls = onSnapshot(qCalls, (snapshot) => {
      const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServiceCalls(calls);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'service_calls'));

    // Today's Orders for Dashboard
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const qToday = query(
      collection(db, 'orders'),
      where('timestamp', '>=', startOfDay.getTime()),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setTodayOrders(orders);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    return () => {
      unsubscribeOrders();
      unsubscribeCalls();
      unsubscribeToday();
    };
  }, [isAdmin]);

  // --- Logic ---
  const filteredItems = useMemo(() => {
    if (!activeCategory) return [];
    return items.filter(item => item.categoryId === activeCategory.id);
  }, [items, activeCategory]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * item.quantity), 0);
  }, [cart]);

  const sessionTotal = useMemo(() => {
    return sessionOrders.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
  }, [sessionOrders]);

  const liveOrdersByTable = useMemo(() => {
    const groups: { [key: string]: Order[] } = {};
    liveOrders.forEach(order => {
      const tNum = String(order.table);
      if (!groups[tNum]) groups[tNum] = [];
      groups[tNum].push(order);
    });
    return groups;
  }, [liveOrders]);

  const addToCart = async (item: Item, selectedVariant?: ItemVariant) => {
    const price = selectedVariant?.priceOverride !== undefined && selectedVariant?.priceOverride !== null
      ? selectedVariant.priceOverride
      : item.price;

    const cartItemId = selectedVariant ? `${item.id}-${selectedVariant.label}` : item.id;

    const existing = cart.find(i => i.cartItemId === cartItemId);
    let newCart = [];
    if (existing) {
      newCart = cart.map(i => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      newCart = [...cart, {
        ...item,
        cartItemId,
        price,
        quantity: 1,
        selectedVariant,
        name: selectedVariant ? `${item.name} (${selectedVariant.label})` : item.name,
        name_en: item.name_en && selectedVariant ? `${item.name_en} (${selectedVariant.label})` : item.name_en,
        name_ar: item.name_ar && selectedVariant ? `${item.name_ar} (${selectedVariant.label})` : item.name_ar,
      }];
    }
    setCart(newCart); // Optimistic UI
    if (tableNumber) {
      try {
        const safeTableId = String(tableNumber).replace(/\//g, '-').trim() || 'unknown';
        await setDoc(doc(db, 'carts', safeTableId), { items: newCart }, { merge: true });
      } catch (err: any) {
        console.error(`Cart add error [${err?.code}]:`, err);
      }
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    const existing = cart.find(i => i.cartItemId === cartItemId);
    let newCart = [];
    if (existing && existing.quantity > 1) {
      newCart = cart.map(i => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity - 1 } : i);
    } else {
      newCart = cart.filter(i => i.cartItemId !== cartItemId);
    }
    setCart(newCart); // Optimistic UI
    if (tableNumber) {
      try {
        const safeTableId = String(tableNumber).replace(/\//g, '-').trim() || 'unknown';
        await setDoc(doc(db, 'carts', safeTableId), { items: newCart }, { merge: true });
      } catch (err: any) {
        console.error(`Cart remove error [${err?.code}]:`, err);
      }
    }
  };

  const sendToKitchen = async () => {
    if (!tableNumber || cart.length === 0) return;
    setIsOrdering(true);
    try {
      const newItems = cart.map(i => ({
        id: uuidv4(),
        name: i.name || 'Unknown Item',
        price: Number(i.price) || 0,
        image: i.image || '',
        quantity: Number(i.quantity) || 1,
        variant: i.selectedVariant?.label || null,
        status: 'sent',
        timestamp: Date.now()
      }));

      // addDoc auto-generates a unique Firestore document ID — no collisions possible
      const orderRef = await addDoc(collection(db, 'orders'), {
        table: String(tableNumber),
        items: newItems,
        total: Number(cartTotal) || 0,
        status: 'pending',
        paymentStatus: 'unpaid',
        note: orderNote || "",
        timestamp: Date.now()
      });

      // Clear the cart for this table (public carts collection — no auth required)
      try {
        const safeTableId = String(tableNumber).replace(/\//g, '-').trim() || 'unknown';
        await setDoc(doc(db, 'carts', safeTableId), { items: [] });
      } catch (cartErr: any) {
        console.error(`Cart clear error [${cartErr?.code}]:`, cartErr);
      }

      setOrderNote('');
      // Track newest order for status updates
      setTrackedOrderId(orderRef.id);
      localStorage.setItem('trackedOrderId', orderRef.id);
      // Navigate to track view — customer can navigate back to menu for additional orders
      setView('track');
    } catch (err: any) {
      // Log Firestore-specific error code for debugging permission issues
      const code = err?.code || 'unknown';
      const message = err?.message || String(err);
      console.error(`Order error [${code}]:`, message, err);
      setError(`${t.error_generic} [${code}]`);
    } finally {
      setIsOrdering(false);
    }
  };

  const requestBill = async () => {
    if (!tableNumber) return;
    try {
      await addDoc(collection(db, 'service_calls'), {
        table: tableNumber,
        type: 'bill',
        status: 'pending',
        timestamp: Date.now()
      });
      alert(lang === 'tr' ? 'Hesap istendi. Lütfen bekleyin.' : (lang === 'ar' ? 'تم طلب الفاتورة' : 'Bill has been requested.'));
    } catch (err) {
      console.error(err);
    }
  };

  const callWaiter = async () => {
    if (!tableNumber) {
      setError(t.table_no + " required");
      return;
    }
    if (isCallingWaiter) return; // Prevent double-submission
    setIsCallingWaiter(true);
    try {
      await addDoc(collection(db, 'service_calls'), {
        table: tableNumber,
        status: 'pending',
        timestamp: Date.now()
      });
      setView('waiter_success');
    } catch (err) {
      console.error("Call waiter error:", err);
      setError(t.error_generic);
    } finally {
      setIsCallingWaiter(false);
    }
  };

  const completeCall = async (callId: string) => {
    try {
      await updateDoc(doc(db, 'service_calls', callId), { status: 'completed' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `service_calls/${callId}`);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const markTableAsPaid = async (tableNum: string) => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('table', '==', tableNum),
        where('paymentStatus', '==', 'unpaid')
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.update(d.ref, {
          paymentStatus: 'paid',
          status: 'delivered'
        });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'orders');
    }
  };

  const confirmPayment = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        paymentStatus: 'paid',
        status: 'delivered'
      });
    } catch (err: any) {
      const code = err?.code || 'unknown';
      console.error(`Payment confirm error [${code}]:`, err);
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const performTranslation = async (item: Partial<Item> & { name: string }, type: 'item' | 'category' = 'item') => {
    if (!item.name) return null;
    setIsTranslating(true);
    try {
      const resp = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, type })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Server error');
      }

      const response = await resp.json();
      const text = response.text || "";
      let parsed: any = {};
      try {
        parsed = JSON.parse(cleanJson(text || '{}'));
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr, "Raw Text:", text);
        parsed = { name_en: text, name_ar: text, description_en: '', description_ar: '' };
      }
      if (parsed.variants && item.variants) {
        parsed.variants = item.variants.map((v, i) => ({
          ...v,
          label_en: parsed.variants[i]?.label_en || (v as any).label_en,
          label_ar: parsed.variants[i]?.label_ar || (v as any).label_ar,
        }));
      }
      return parsed;
    } catch (e: any) {
      console.error("Translation error details:", e);
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`DİKKAT: Çeviri Hatası!\nMesaj: ${msg}\n\nLütfen Vercel Cloud Functions'ın (API Proxy) çalıştığından emin olun.`);
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAutoTranslateItem = async () => {
    if (!editingItem) return;
    const trans = await performTranslation(editingItem, 'item');
    if (trans) {
      setEditingItem({
        ...editingItem,
        ...trans
      });
    }
  };

  const handleAutoTranslateCategory = async () => {
    if (!editingCategory) return;
    const trans = await performTranslation(editingCategory, 'category');
    if (trans) {
      setEditingCategory({
        ...editingCategory,
        ...trans
      });
    }
  };

  const getLocalized = (obj: any, field: string) => {
    if (lang === 'en' && obj[`${field}_en`]) return obj[`${field}_en`];
    if (lang === 'ar' && obj[`${field}_ar`]) return obj[`${field}_ar`];
    return obj[field];
  };

  // --- Admin Actions ---
  const saveCategory = async (cat: Category) => {
    try {
      await setDoc(doc(db, 'categories', cat.id), cat);
      setEditingCategory(null);
    } catch (err) {
      console.error("Save cat error:", err);
    }
  };

  const removeCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
      // Also remove items in this category
      const its = items.filter(i => i.categoryId === id);
      for (const item of its) {
        await deleteDoc(doc(db, 'items', item.id));
      }
      setEditingCategory(null);
    } catch (err) {
      console.error("Delete cat error:", err);
    }
  };

  const saveItem = async (item: Item) => {
    try {
      await setDoc(doc(db, 'items', item.id), item);
      setEditingItem(null);
    } catch (err) {
      console.error("Save item error:", err);
    }
  };

  const removeItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'items', id));
      setEditingItem(null);
    } catch (err) {
      console.error("Delete item error:", err);
    }
  };

  const resetDay = async () => {
    setShowResetConfirm(false);
    try {
      // Archive active orders by marking them delivered (not deleting)
      const activeOrders = todayOrders.filter(o => o.status !== 'delivered');
      if (activeOrders.length > 0) {
        await Promise.all(
          activeOrders.map(o => updateDoc(doc(db, 'orders', o.id), { status: 'delivered' }))
        );
      }
      // Clear pending service calls
      if (serviceCalls.length > 0) {
        await Promise.all(
          serviceCalls.map(c => deleteDoc(doc(db, 'service_calls', c.id)))
        );
      }
      // Update last_reset_at for all tables so customer devices clear their session
      if (tables.length > 0) {
        await Promise.all(
          tables.map(t => updateDoc(doc(db, 'tables', t.id), { last_reset_at: Date.now() }))
        );
      }
    } catch (err: any) {
      const code = err?.code || 'unknown';
      console.error(`Reset day error [${code}]:`, err);
      handleFirestoreError(err, OperationType.DELETE, 'bulk/reset');
    }
  };

  const downloadQRCode = (tableNum: string) => {
    const canvas = document.getElementById(`qr-canvas-${tableNum}`) as HTMLCanvasElement;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `Baltazar_QR_Table_${tableNum}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Block entire UI while auth state is resolving to prevent view flicker
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
          <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D2D2D] font-sans selection:bg-orange-100 transition-all duration-300" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="p-3 md:p-6 flex justify-between items-center bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2 md:gap-4">
          {view !== 'menu' && view !== 'welcome' && (
            <button onClick={() => setView('menu')} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Go back">
              <ChevronLeft className={`w-5 h-5 md:w-6 md:h-6 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="flex items-center h-10 md:h-16">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-full w-auto object-contain cursor-pointer"
              onClick={() => setView('menu')}
              onError={(e) => {
                // Inline SVG fallback — no external dependency
                const el = e.target as HTMLImageElement;
                el.onerror = null;
                el.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50" viewBox="0 0 150 50"><rect width="150" height="50" fill="#1a1a1a" rx="8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f97316" font-family="sans-serif" font-size="14" font-weight="bold">BALTAZAR</text></svg>')}}`;
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {['tr', 'en', 'ar'].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${lang === l ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {isOrderingEnabled && cart.length > 0 && view !== 'cart' && (
            <button onClick={() => setView('cart')} className="relative p-2 md:p-3 bg-orange-600 text-white rounded-xl shadow-lg transition-transform active:scale-95">
              <ShoppingCart size={20} />
              <span className="absolute -top-1 -right-1 bg-white text-orange-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-orange-600 animate-in zoom-in">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            </button>
          )}

          {lastOrder && view !== 'track' && (
            <button
              onClick={() => setView('track')}
              className={`p-2 md:p-3 rounded-xl transition-colors flex items-center gap-2 ${lastOrder.status === 'pending' ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' :
                  lastOrder.status === 'preparing' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' :
                    lastOrder.status === 'ready' ? 'bg-green-50 text-green-600 hover:bg-green-100' :
                      'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
            >
              {lastOrder.status === 'pending' ? <MapPin size={20} /> :
                lastOrder.status === 'preparing' ? <ChefHat size={20} /> :
                  lastOrder.status === 'ready' ? <PackageCheck size={20} /> :
                    <Truck size={20} />}
              <span className="hidden sm:inline text-xs font-bold">
                {lastOrder.status === 'pending' ? t.pending :
                  lastOrder.status === 'preparing' ? t.preparing :
                    lastOrder.status === 'ready' ? t.ready :
                      t.delivered}
              </span>
            </button>
          )}

          {tableNumber && view === 'menu' && (
            <button onClick={callWaiter} disabled={isCallingWaiter} className="p-2 md:p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60">
              {isCallingWaiter ? <Loader2 size={20} className="animate-spin" /> : <MessageSquare size={20} />}
              <span className="hidden sm:inline text-xs font-bold">{t.call_waiter}</span>
            </button>
          )}

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setView('admin')} className={`p-2 md:p-3 rounded-xl transition-colors ${view === 'admin' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`} aria-label="Admin panel">
                <Settings size={20} />
              </button>
              <button onClick={logout} className="p-2 md:p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" aria-label="Logout">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button onClick={loginAdmin} className="p-2 md:p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors" aria-label="Login as admin">
              <LogIn size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12">
        {view === 'welcome' && !isLoading && (
          <div className="flex flex-col items-center justify-center py-10 md:py-20 animate-in zoom-in-95 max-w-sm mx-auto">
            <h2 className="text-4xl font-black mb-2 text-center text-orange-600">{t.welcome_title}</h2>
            <p className="text-gray-500 mb-10 text-center font-bold px-4">{t.welcome_desc}</p>
            <div className="w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col items-center">
              <LogOut size={40} className="text-orange-200 mb-6 rotate-180" />
              <input
                type="number"
                className="w-full bg-gray-50 rounded-2xl p-4 mb-6 text-2xl font-black text-center outline-none focus:ring-2 focus:ring-orange-500"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder={t.table_no}
              />
              <button
                onClick={() => {
                  if (tableNumber) {
                    localStorage.setItem('tableNumber', tableNumber);
                    setView('menu');
                  }
                }}
                disabled={!tableNumber}
                className="w-full bg-orange-600 text-white font-black py-4 rounded-[1.8rem] shadow-lg disabled:opacity-50 transition-all hover:bg-orange-700 active:scale-95 text-lg"
              >
                {t.start_order}
              </button>

              <div className="w-full flex items-center justify-center my-4 opacity-30">
                <div className="h-px bg-black flex-grow"></div>
                <span className="px-4 text-xs font-bold uppercase">{lang === 'tr' ? 'veya' : 'OR'}</span>
                <div className="h-px bg-black flex-grow"></div>
              </div>

              <button
                onClick={async () => {
                  try {
                    const today = new Date().toISOString().split('T')[0];
                    const statsRef = doc(db, 'daily_stats', today);

                    try {
                      // Atomic operation
                      await setDoc(statsRef, { takeaway_count: increment(1) }, { merge: true });
                    } catch (err: any) {
                      console.warn(`Increment failed [${err?.code}], initializing or falling back`, err);
                      await setDoc(statsRef, { takeaway_count: 1 }, { merge: true });
                    }

                    const snap = await getDoc(statsRef);
                    const count = snap.exists() && snap.data().takeaway_count ? snap.data().takeaway_count : 1;

                    // Each takeaway session gets a unique ID — prevents collisions on repeat orders
                    const virtualTable = `TW-${count}-${uuidv4().slice(0, 6)}`;
                    setTableNumber(virtualTable);
                    localStorage.setItem('tableNumber', virtualTable);
                    // Clear any previous session tracking
                    localStorage.removeItem('trackedOrderId');
                    setTrackedOrderId(null);
                    setLastOrder(null);
                    setView('menu');
                  } catch (err) {
                    console.error("Takeaway initialization error:", err);
                    // Fallback: fully unique ID even without Firestore
                    const fallback = `TW-${uuidv4().slice(0, 8)}`;
                    setTableNumber(fallback);
                    localStorage.setItem('tableNumber', fallback);
                    localStorage.removeItem('trackedOrderId');
                    setTrackedOrderId(null);
                    setLastOrder(null);
                    setView('menu');
                  }
                }}
                className="w-full bg-white text-orange-600 border-2 border-orange-100 font-black py-4 rounded-[1.8rem] transition-all hover:bg-orange-50 active:scale-95 text-lg flex items-center justify-center gap-2"
              >
                <PackageCheck size={20} />
                {lang === 'tr' ? 'Paket Servis Olarak Başla' : 'Order Takeaway'}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
            <p className="text-gray-400 font-bold animate-pulse">Loading menu...</p>
          </div>
        )}

        {!isLoading && categories.length === 0 && view === 'menu' && (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <ClipboardList size={40} />
            </div>
            <h2 className="text-2xl font-black mb-2">No Categories Found</h2>
            <p className="text-gray-500 mb-8 px-8">The menu is currently empty. If you are an administrator, please log in to seed the initial data or add categories manually.</p>
            {!user && (
              <button onClick={loginAdmin} className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all flex items-center gap-2 mx-auto">
                <LogIn size={20} /> {t.login_admin}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 animate-in fade-in">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-full" aria-label="Dismiss error"><X size={16} /></button>
          </div>
        )}

        {view === 'menu' && !isLoading && categories.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 animate-in fade-in slide-in-from-bottom-4">
            {categories.map((cat) => (
              <div key={cat.id} onClick={() => { setActiveCategory(cat); setView('category'); }} className="group relative cursor-pointer overflow-hidden rounded-3xl shadow-sm hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="aspect-square relative">
                  <img src={cat.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" alt={getLocalized(cat, 'name')} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-4">
                    <h2 className="text-white font-bold uppercase tracking-wider">{getLocalized(cat, 'name')}</h2>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'category' && activeCategory && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <h2 className={`text-2xl md:text-5xl font-black mb-8 border-orange-500 uppercase text-orange-900 ${isRtl ? 'border-r-8 pr-4' : 'border-l-8 pl-4'}`}>
              {getLocalized(activeCategory, 'name')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => {
                const desc = getLocalized(item, 'description');
                const isOut = item.inStock === false;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isOut) return;
                      setSelectedItem(item);
                      setSelectedVariant(item.variants?.[0] || null);
                    }}
                    className={`bg-white p-4 rounded-[2.5rem] flex gap-4 shadow-sm border border-gray-100 transition-all duration-300 select-none relative overflow-hidden ${isOut ? 'opacity-60 cursor-not-allowed grayscale-[0.5]' : 'hover:shadow-md cursor-pointer'}`}
                  >
                    {isOut && (
                      <div className="absolute inset-0 bg-white/40 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <div className="bg-red-600 text-white font-black px-6 py-2 rounded-full uppercase tracking-widest shadow-xl rotate-[-10deg]">
                          {lang === 'tr' ? 'Tükendi' : (lang === 'ar' ? 'نفذت الكمية' : 'Sold Out')}
                        </div>
                      </div>
                    )}
                    <img src={item.image} className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-[1.8rem] flex-shrink-0 shadow-inner" referrerPolicy="no-referrer" alt={getLocalized(item, 'name')} />
                    <div className="flex flex-col justify-between flex-grow min-w-0 py-1">
                      <div>
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h3 className="font-bold text-sm md:text-xl truncate">{getLocalized(item, 'name')}</h3>
                          <span className="text-orange-600 font-bold text-sm md:text-lg whitespace-nowrap">₺{item.price}</span>
                        </div>
                        <p className="text-gray-400 text-xs md:text-sm leading-relaxed line-clamp-2">
                          {desc}
                        </p>
                      </div>
                      {isOrderingEnabled && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (!isOut) addToCart(item); }}
                          disabled={isOut}
                          className="w-max bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1 mt-2 disabled:opacity-50"
                        >
                          {t.add_to_cart} <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'cart' && (
          <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black mb-8 flex items-center gap-2"><ShoppingCart className="text-orange-600" /> {t.cart_title}</h2>
            {cart.length > 0 ? (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-3xl flex justify-between items-center shadow-sm border border-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" referrerPolicy="no-referrer" alt={getLocalized(item, 'name')} />
                        <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                          {item.quantity}
                        </span>
                      </div>
                      <div>
                        <div className="font-black text-lg">{getLocalized(item, 'name')}</div>
                        <div className="text-orange-600 font-bold text-sm">₺{item.price}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => addToCart(item, item.selectedVariant)} className="p-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors" aria-label="Add one more">
                        <Plus size={18} />
                      </button>
                      <button onClick={() => removeFromCart(item.cartItemId)} className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors" aria-label="Remove from cart">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <label className="text-xs font-black text-gray-400 uppercase ml-2 flex items-center gap-2 mb-2">
                    <MessageSquare size={14} /> {t.note_label}
                  </label>
                  <textarea
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-orange-500 h-24 resize-none"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder={t.note}
                  />
                </div>

                <div className="mt-8 bg-white p-6 rounded-[2.5rem] border border-orange-100 shadow-xl shadow-orange-50">
                  <div className="flex justify-between items-center text-2xl font-black mb-6">
                    <span>{t.total}</span>
                    <span className="text-orange-600">₺{cartTotal}</span>
                  </div>
                  <input type="number" className="w-full bg-gray-50 rounded-2xl p-4 mb-6 text-xl font-black text-center outline-none focus:ring-2 focus:ring-orange-500" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder={t.table_no} />
                  <button
                    onClick={sendToKitchen}
                    disabled={!tableNumber || isOrdering}
                    className="w-full bg-orange-600 text-white font-black py-5 rounded-[1.8rem] shadow-xl disabled:opacity-50 transition-all hover:bg-orange-700 flex items-center justify-center gap-2"
                  >
                    {isOrdering ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                    {lang === 'tr' ? 'Mutfağa Gönder' : (lang === 'ar' ? 'أرسل للمطبخ' : 'Send to Kitchen')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-gray-300"><p>{t.empty_cart}</p></div>
            )}
          </div>
        )}

        {view === 'admin' && isAdmin && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-2xl w-max mx-auto mb-10">
              <button onClick={() => setAdminSubView('dashboard')} className={`px-6 py-2 rounded-xl font-bold transition-all ${adminSubView === 'dashboard' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>{t.dashboard}</button>
              <button onClick={() => setAdminSubView('orders')} className={`relative px-6 py-2 rounded-xl font-bold transition-all ${adminSubView === 'orders' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>
                {t.orders}
                {liveOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-lg">{liveOrders.length}</span>}
              </button>
              <button onClick={() => setAdminSubView('calls')} className={`relative px-6 py-2 rounded-xl font-bold transition-all ${adminSubView === 'calls' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>
                {t.service_calls}
                {serviceCalls.length > 0 && <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-lg">{serviceCalls.length}</span>}
              </button>
              <button onClick={() => setAdminSubView('categories')} className={`px-6 py-2 rounded-xl font-bold transition-all ${adminSubView === 'categories' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>{t.categories}</button>
              <button onClick={() => setAdminSubView('settings')} className={`px-6 py-2 rounded-xl font-bold transition-all ${adminSubView === 'settings' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>{t.settings}</button>
              <button onClick={() => setAdminSubView('tables')} className={`px-6 py-2 rounded-xl font-bold transition-all ${adminSubView === 'tables' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>{lang === 'tr' ? 'Masalar' : (lang === 'ar' ? 'الطاولات' : 'Tables')}</button>
              <button onClick={() => setAdminSubView('takeaway')} className={`px-6 py-2 rounded-xl font-bold transition-all ${adminSubView === 'takeaway' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}>{lang === 'tr' ? 'Paket Servis' : (lang === 'ar' ? 'سفري' : 'Takeaway')}</button>
            </div>

            {adminSubView === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4">
                      <ClipboardList size={32} />
                    </div>
                    <div className="text-4xl font-black mb-1">{todayOrders.length}</div>
                    <div className="text-gray-400 font-bold uppercase text-xs tracking-widest">{t.total_orders} ({t.today})</div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                      <Clock size={32} />
                    </div>
                    <div className="text-4xl font-black mb-1">{todayOrders.filter(o => o.status !== 'delivered').length}</div>
                    <div className="text-gray-400 font-bold uppercase text-xs tracking-widest">{t.pending_orders}</div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                      <TrendingUp size={32} />
                    </div>
                    <div className="text-4xl font-black mb-1">₺{todayOrders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)}</div>
                    <div className="text-gray-400 font-bold uppercase text-xs tracking-widest">{t.revenue} ({t.today})</div>
                  </div>
                </div>

                {/* DB Initialization Section */}
                {(categories.length === 0 || tables.length === 0) && (
                  <div className="bg-orange-50 border-2 border-orange-200 p-8 rounded-[2.5rem] text-center">
                    <AlertCircle className="mx-auto text-orange-600 mb-4" size={48} />
                    <h3 className="text-xl font-black mb-2">Database Empty</h3>
                    <p className="text-gray-600 mb-6 max-w-sm mx-auto font-medium">Critical collections are missing. Please initialize the database to start using the system.</p>
                    <button
                      onClick={async () => {
                        try {
                          // 1. Create a default table
                          await setDoc(doc(db, 'tables', '1'), {
                            id: '1',
                            number: '1',
                            last_reset_at: Date.now()
                          });

                          // 2. Create daily_stats for today
                          const today = new Date().toISOString().split('T')[0];
                          await setDoc(doc(db, 'daily_stats', today), {
                            takeaway_count: 0
                          }, { merge: true });

                          // 3. Sync current admin to users collection
                          if (user) {
                            await setDoc(doc(db, 'users', user.uid), {
                              uid: user.uid,
                              email: user.email,
                              role: 'admin'
                            });
                          }

                          // 4. Create initial category
                          await setDoc(doc(db, 'categories', 'welcome'), {
                            id: 'welcome',
                            name: 'Ana Menü',
                            name_en: 'Main Menu',
                            name_ar: 'القائمة الرئيسية',
                            image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=800',
                            order: 1
                          });

                          alert("Database Initialized Successfully!");
                        } catch (err) {
                          console.error(err);
                          alert("Initialization failed. Check console and firestore rules.");
                        }
                      }}
                      className="bg-orange-600 shadow-lg shadow-orange-200 text-white font-black px-10 py-4 rounded-2xl hover:bg-orange-700 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                    >
                      <Sparkles size={20} /> Initialize Database
                    </button>
                  </div>
                )}

                {/* Reset Day Button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-2xl font-bold hover:bg-red-100 transition-all active:scale-95 shadow-sm"
                  >
                    <Trash2 size={16} /> {t.reset_day}
                  </button>
                </div>

                {/* Full Order History */}
                <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <Clock className="text-orange-600" /> {t.order_history} — {t.today} ({todayOrders.length})
                  </h3>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {todayOrders.map(order => (
                      <div key={order.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                        {/* Order header */}
                        <div className={`flex items-center justify-between px-5 py-3 ${order.status === 'pending' ? 'bg-orange-50' :
                          order.status === 'preparing' ? 'bg-blue-50' :
                            order.status === 'ready' ? 'bg-green-50' :
                              'bg-gray-50'
                          }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shadow-sm ${order.status === 'pending' ? 'bg-orange-500 text-white' :
                              order.status === 'preparing' ? 'bg-blue-500 text-white' :
                                order.status === 'ready' ? 'bg-green-500 text-white' :
                                  'bg-gray-300 text-white'
                              }`}>
                              #{order.table}
                            </div>
                            <div>
                              <div className="font-black text-sm">₺{order.total}</div>
                              <div className="text-[10px] text-gray-400 uppercase font-bold">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} · {getTimeElapsed(order.timestamp, lang)}</div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${order.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                            order.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                              order.status === 'ready' ? 'bg-green-100 text-green-600' :
                                'bg-gray-200 text-gray-500'
                            }`}>
                            {t[order.status as keyof typeof t] || order.status}
                          </div>
                        </div>
                        {/* Order items */}
                        <div className="px-5 py-3 space-y-2 bg-white">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-orange-100 text-orange-600 text-[10px] font-black rounded-full flex items-center justify-center">{item.quantity}×</span>
                                <span className="font-medium text-gray-800">{item.name}</span>
                              </div>
                              <span className="font-black text-orange-600">₺{item.price * item.quantity}</span>
                            </div>
                          ))}
                          {order.note && (
                            <div className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2 font-medium">
                              📝 {order.note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {todayOrders.length === 0 && (
                      <div className="text-center py-10 text-gray-300 font-bold">No orders yet today.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {adminSubView === 'calls' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                {serviceCalls.length > 0 ? serviceCalls.map(call => (
                  <div key={call.id} className="bg-white p-8 rounded-[2.5rem] border-4 border-blue-500 bb-pulse-call flex justify-between items-center relative overflow-hidden">
                    {/* Vivid top accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-blue-500" />
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 text-white text-3xl font-black rounded-2xl flex items-center justify-center shadow-xl ${call.type === 'bill' ? 'bg-orange-500 shadow-orange-200' : 'bg-blue-600 shadow-blue-200'}`}>
                        #{call.table}
                      </div>
                      <div>
                        <div className={`font-black text-lg ${call.type === 'bill' ? 'text-orange-700' : 'text-blue-700'}`}>
                          {call.type === 'bill' ? (lang === 'tr' ? 'Hesap İstiyor' : (lang === 'ar' ? 'يطلب الفاتورة' : 'Requests Bill')) : t.waiter_needed}
                        </div>
                        <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1 mt-1">
                          <Clock size={11} /> {getTimeElapsed(call.timestamp, lang)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => completeCall(call.id)}
                      className="bg-blue-600 text-white px-5 py-3 rounded-2xl text-sm font-black hover:bg-blue-700 active:scale-95 transition-all shadow-lg"
                    >
                      {t.complete_call}
                    </button>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center text-gray-300 font-bold">{t.no_calls}</div>
                )}
              </div>
            )}

            {adminSubView === 'takeaway' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm text-center">
                  <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                    <PackageCheck size={40} />
                  </div>
                  <h3 className="text-3xl font-black mb-2">{lang === 'tr' ? 'Paket Servis İstatistikleri' : (lang === 'ar' ? 'إحصائيات سفري' : 'Takeaway Stats')}</h3>
                  <p className="text-gray-500 mb-8 max-w-sm mx-auto font-medium">{lang === 'tr' ? 'Bugün otomatik olarak oluşturulan toplam paket servis sanal masa sayısı.' : 'Total virtual takeaway tables automatically generated today.'}</p>

                  <div className="text-7xl font-black text-orange-600 mb-3">{takeawayStats}</div>
                  <div className="text-sm font-bold tracking-widest text-gray-400 uppercase">{lang === 'tr' ? 'Bugünün Paket Servis Oranı' : 'Takeaway Count Today'}</div>
                </div>
              </div>
            )}

            {adminSubView === 'tables' && (
              <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
                <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <QrCode className="text-orange-600" /> {lang === 'tr' ? 'Masa Yönetimi' : 'Table Management'}
                  </h3>

                  <div className="flex gap-2 mb-8">
                    <input
                      type="text"
                      placeholder={lang === 'tr' ? 'Masa No (örn: 5)' : 'Table No (e.g., 5)'}
                      className="flex-1 bg-gray-50 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-orange-500"
                      value={newTableNumber}
                      onChange={(e) => setNewTableNumber(e.target.value)}
                    />
                    <button
                      onClick={async () => {
                        if (!newTableNumber) return;
                        try {
                          await setDoc(doc(db, 'tables', newTableNumber), {
                            id: newTableNumber,
                            number: newTableNumber,
                            last_reset_at: Date.now()
                          });
                          setNewTableNumber('');
                        } catch (e) {
                          alert("Error adding table");
                        }
                      }}
                      className="bg-black text-white px-8 rounded-2xl font-black hover:bg-gray-800 transition-all active:scale-95"
                    >
                      {t.add}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Menu Only QR Card */}
                    <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-200 relative group flex flex-col items-center">
                      <div className="text-xl font-black mb-2 text-blue-600 uppercase text-center leading-tight">
                        {lang === 'tr' ? 'Sadece Menü' : 'Menu Only'}
                      </div>
                      <div className="bg-white p-2 rounded-xl mb-4 shadow-sm">
                        <QRCodeCanvas
                          id="qr-canvas-menu-only"
                          value={`${window.location.origin}/`}
                          size={1024}
                          level="H"
                          includeMargin={true}
                          style={{ width: '120px', height: '120px' }}
                          imageSettings={{
                            src: "/logo.png",
                            x: undefined,
                            y: undefined,
                            height: 256,
                            width: 256,
                            excavate: true,
                          }}
                        />
                      </div>
                      <button
                        onClick={() => downloadQRCode('menu-only')}
                        className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all active:scale-95"
                        title="Download Menu Only QR"
                      >
                        <QrCode size={18} />
                      </button>
                    </div>

                    {/* Takeaway QR Card */}
                    <div className="bg-orange-50 p-6 rounded-3xl border-2 border-orange-200 relative group flex flex-col items-center">
                      <div className="text-xl font-black mb-2 text-orange-600 uppercase">Takeaway</div>
                      <div className="bg-white p-2 rounded-xl mb-4 shadow-sm">
                        <QRCodeCanvas
                          id="qr-canvas-takeaway"
                          value={`${window.location.origin}/?table=takeaway`}
                          size={1024}
                          level="H"
                          includeMargin={true}
                          style={{ width: '120px', height: '120px' }}
                          imageSettings={{
                            src: "/logo.png",
                            x: undefined,
                            y: undefined,
                            height: 256,
                            width: 256,
                            excavate: true,
                          }}
                        />
                      </div>
                      <button
                        onClick={() => downloadQRCode('takeaway')}
                        className="bg-orange-600 text-white p-2 rounded-xl hover:bg-orange-700 transition-all active:scale-95"
                        title="Download Takeaway QR"
                      >
                        <ShoppingBag size={18} />
                      </button>
                    </div>

                    {tables.map(table => (
                      <div key={table.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 relative group flex flex-col items-center">
                        <div className="text-3xl font-black mb-2">#{table.number}</div>
                        <div className="bg-white p-2 rounded-xl mb-4 shadow-sm">
                          <QRCodeCanvas
                            id={`qr-canvas-${table.number}`}
                            value={`${window.location.origin}/?table=${table.number}`}
                            size={1024}
                            level="H"
                            includeMargin={true}
                            style={{ width: '120px', height: '120px' }}
                            imageSettings={{
                              src: "/logo.png",
                              x: undefined,
                              y: undefined,
                              height: 256,
                              width: 256,
                              excavate: true,
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadQRCode(table.number)}
                            className="bg-gray-800 text-white p-2 rounded-xl hover:bg-gray-900 transition-all active:scale-95"
                            title="Download QR"
                          >
                            <QrCode size={18} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("Delete table #" + table.number + "?")) {
                                await deleteDoc(doc(db, 'tables', table.id));
                              }
                            }}
                            className="bg-red-50 text-red-400 p-2 rounded-xl hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100"
                            aria-label="Delete table"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {tables.length === 0 && (
                      <div className="col-span-full py-10 text-center text-gray-300 font-bold">No tables defined yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {adminSubView === 'orders' && (
              <div className="space-y-8 animate-in fade-in">
                {/* Active live orders */}
                <div>
                  <h3 className="text-lg font-black text-gray-700 mb-4 flex items-center gap-2">
                    <Bell size={18} className="text-orange-500" /> {t.active_orders}
                    {liveOrders.length > 0 && <span className="bg-orange-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{liveOrders.length}</span>}
                  </h3>
                  {liveOrders.length === 0 ? (
                    <div className="py-12 text-center text-gray-300 font-bold bg-gray-50 rounded-3xl">{t.no_active_orders}</div>
                  ) : (
                    <div className="space-y-12">
                      {(Object.entries(liveOrdersByTable) as [string, Order[]][]).sort((a, b) => a[0].localeCompare(b[0])).map(([tableNum, orders]) => {
                        const tableTotal = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        return (
                          <div key={tableNum} className="bb-table-group animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-end mb-6 px-4">
                              <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t.table_no}</div>
                                <div className="text-6xl font-black text-gray-900 leading-none">#{tableNum}</div>
                              </div>
                              <div className="flex flex-col items-end">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t.total}</div>
                                <div className="flex items-center gap-4">
                                  <div className="text-4xl font-black text-gray-900 leading-none">₺{tableTotal}</div>
                                  <button
                                    onClick={() => markTableAsPaid(tableNum)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-green-100 transition-all active:scale-95"
                                  >
                                    <DollarSign size={24} /> {t.complete_payment}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {orders.map(order => (
                                <div
                                  key={order.id}
                                  className={`bg-white p-6 rounded-[2.5rem] border-4 transition-all ${order.status === 'pending'
                                    ? 'border-orange-500 shadow-2xl shadow-orange-100 bb-pulse-pending'
                                    : order.status === 'preparing'
                                      ? 'border-blue-400 shadow-xl shadow-blue-50'
                                      : order.status === 'ready'
                                        ? 'border-green-500 shadow-xl shadow-green-50'
                                        : 'border-gray-200'
                                    }`}
                                >
                                  {/* High-contrast header */}
                                  <div className={`-mx-6 -mt-6 mb-5 px-6 py-4 rounded-t-[2.5rem] flex justify-between items-center ${order.status === 'pending' ? 'bg-orange-500 text-white' :
                                    order.status === 'preparing' ? 'bg-blue-500 text-white' :
                                      order.status === 'ready' ? 'bg-green-500 text-white' :
                                        'bg-gray-100 text-gray-400'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                      <div className="text-2xl font-black uppercase tracking-tighter">{order.status}</div>
                                      {order.status === 'pending' && <Bell size={18} className="animate-bounce" />}
                                    </div>
                                    <div className="text-right">
                                      <div className="text-[10px] font-black opacity-80 uppercase">{getTimeElapsed(order.timestamp, lang)}</div>
                                      <div className="text-[10px] opacity-70">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                                    </div>
                                  </div>

                                  {order.note && (
                                    <div className="mb-4 p-3 bg-amber-50 rounded-2xl border-l-4 border-amber-400">
                                      <div className="text-[10px] font-black text-amber-500 uppercase mb-1">{t.customer_note}</div>
                                      <div className="text-sm font-medium">{order.note}</div>
                                    </div>
                                  )}

                                  <div className="space-y-3 mb-5 max-h-52 overflow-y-auto pr-1">
                                    {order.items.map((item, i) => (
                                      <div key={i} className="flex items-center gap-3 border-b border-gray-50 pb-2 last:border-0">
                                        <img src={item.image} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" alt={item.name} />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-black leading-tight truncate">{item.name}</div>
                                          <div className="text-[10px] text-gray-400 font-bold">₺{item.price} × {item.quantity} {item.variant ? `(${item.variant})` : ''}</div>
                                        </div>
                                        <div className="text-sm font-black text-orange-600">₺{item.price * item.quantity}</div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Single Order Total & Status Buttons */}
                                  <div className="flex items-center justify-between pt-3 border-t mb-5">
                                    <div className="font-black text-2xl">₺{order.total}</div>
                                    <button onClick={() => deleteOrder(order.id)} className="text-red-300 hover:text-red-500 transition-colors p-1" aria-label="Delete order">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    <button
                                      onClick={() => updateOrderStatus(order.id, 'preparing')}
                                      className={`flex flex-col items-center justify-center py-3 rounded-xl text-[10px] font-bold transition-all ${order.status === 'preparing' ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                    >
                                      <Flame size={16} className="mb-1" /> {t.preparing}
                                    </button>
                                    <button
                                      onClick={() => updateOrderStatus(order.id, 'ready')}
                                      className={`flex flex-col items-center justify-center py-3 rounded-xl text-[10px] font-bold transition-all ${order.status === 'ready' ? 'bg-green-600 text-white shadow-lg' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >
                                      <CheckCircle size={16} className="mb-1" /> {t.ready}
                                    </button>
                                    <button
                                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                                      className={`flex flex-col items-center justify-center py-3 rounded-xl text-[10px] font-bold transition-all ${order.status === 'delivered' ? 'bg-gray-600 text-white shadow-lg' : 'bg-gray-50 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                      <Truck size={16} className="mb-1" /> {t.delivered}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Full day order history */}
                <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <ClipboardList className="text-orange-600" /> {t.order_history} — {t.today} ({todayOrders.length})
                  </h3>
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    {todayOrders.length === 0 && (
                      <div className="text-center py-10 text-gray-300 font-bold">No orders yet today.</div>
                    )}
                    {todayOrders.map(order => (
                      <div key={order.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                        {/* Order header row */}
                        <div className={`flex items-center justify-between px-5 py-3 ${order.status === 'pending' ? 'bg-orange-50' :
                          order.status === 'preparing' ? 'bg-blue-50' :
                            order.status === 'ready' ? 'bg-green-50' :
                              'bg-gray-50'
                          }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${order.status === 'pending' ? 'bg-orange-500 text-white' :
                              order.status === 'preparing' ? 'bg-blue-500 text-white' :
                                order.status === 'ready' ? 'bg-green-500 text-white' :
                                  'bg-gray-400 text-white'
                              }`}>
                              #{order.table}
                            </div>
                            <div>
                              <div className="font-black text-sm">₺{order.total}</div>
                              <div className="text-[10px] text-gray-400 uppercase font-bold">
                                {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} · {getTimeElapsed(order.timestamp, lang)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${order.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                              order.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                                order.status === 'ready' ? 'bg-green-100 text-green-600' :
                                  'bg-gray-200 text-gray-500'
                              }`}>
                              {t[order.status as keyof typeof t] || order.status}
                            </div>
                            <button onClick={() => deleteOrder(order.id)} className="text-red-300 hover:text-red-500 transition-colors p-1" aria-label="Delete order">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {/* Full item details */}
                        <div className="px-5 py-3 bg-white space-y-2">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <img src={item.image} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" alt={item.name} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-800 truncate">{item.name}</div>
                                <div className="text-[10px] text-gray-400 font-bold">₺{item.price} × {item.quantity}</div>
                              </div>
                              <div className="text-sm font-black text-orange-600">₺{item.price * item.quantity}</div>
                            </div>
                          ))}
                          {order.note && (
                            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2 font-medium">
                              📝 {order.note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}




            {adminSubView === 'settings' && (
              <div className="animate-in fade-in max-w-2xl mx-auto space-y-6">
                <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <Settings className="text-orange-600" /> Site Settings
                  </h3>
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                    <span className="font-bold flex items-center gap-2">
                      <ShoppingBag size={20} className="text-orange-600" /> {t.enable_ordering}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await setDoc(doc(db, 'settings', 'siteConfig'), {
                            isOrderingEnabled: !isOrderingEnabled
                          }, { merge: true });
                        } catch (err: any) {
                          console.error("Failed to update ordering settings", err);
                          setError(err.message || 'Failed to update settings.');
                        }
                      }}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${isOrderingEnabled ? 'bg-orange-600' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isOrderingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <Settings className="text-orange-600" /> {t.admin_emails}
                  </h3>
                  <div className="flex gap-2 mb-6">
                    <input
                      type="email"
                      className="flex-1 bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="Email"
                    />
                    <button
                      onClick={async () => {
                        if (!newAdminEmail || !newAdminEmail.includes('@')) return;
                        try {
                          await setDoc(doc(db, 'admins', newAdminEmail), {
                            email: newAdminEmail,
                            addedAt: Date.now()
                          });
                          setDbAdmins([...dbAdmins, newAdminEmail]);
                          setNewAdminEmail('');
                        } catch (err: any) {
                          console.error("Failed to add admin", err);
                          setError(err.message || 'Failed to add admin email.');
                        }
                      }}
                      className="bg-black text-white px-6 rounded-2xl font-bold hover:bg-gray-800 transition-colors"
                    >
                      {t.add}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {ADMIN_EMAILS.map(email => (
                      <div key={email} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl opacity-70">
                        <span className="font-bold">{email}</span>
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded-full uppercase font-black">System</span>
                      </div>
                    ))}
                    {dbAdmins.map(email => (
                      <div key={email} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                        <span className="font-bold">{email}</span>
                        <button aria-label="Remove admin email"
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'admins', email));
                              setDbAdmins(dbAdmins.filter(e => e !== email));
                            } catch (err: any) {
                              console.error("Failed to remove admin", err);
                              setError(err.message || 'Failed to remove admin email.');
                            }
                          }}
                          className="text-red-400 hover:text-red-600 p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {adminSubView === 'categories' && (
              <div className="animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl">{t.cat_settings}</h3>
                  <button
                    onClick={() => setEditingCategory({ id: crypto.randomUUID(), name: '', image: '' })}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95"
                  >
                    + {t.add_cat}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {categories.map(c => (
                    <div key={c.id} className="bg-white p-4 rounded-3xl border border-gray-100 hover:shadow-md transition-shadow">
                      <img src={c.image} className="w-full aspect-square object-cover rounded-2xl mb-4" referrerPolicy="no-referrer" alt={getLocalized(c, 'name')} />
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm truncate pr-2">{getLocalized(c, 'name')}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingCategory(c)} className="text-orange-600 hover:scale-110 transition-transform" aria-label="Edit category"><Edit2 size={16} /></button>
                          <button onClick={() => { setActiveCategory(c); setAdminSubView('items'); }} className="text-blue-600 hover:scale-110 transition-transform" aria-label="View items"><Menu size={16} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminSubView === 'items' && activeCategory && (
              <div className="animate-in fade-in slide-in-from-left-4">
                <div className="flex justify-between items-center mb-6">
                  <button onClick={() => setAdminSubView('categories')} className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors"><ChevronLeft size={18} /> {t.back}</button>
                  <h3 className="font-bold text-xl">{getLocalized(activeCategory, 'name')} {t.items}</h3>
                  <button
                    onClick={() => setEditingItem({
                      id: crypto.randomUUID(),
                      categoryId: activeCategory.id,
                      name: '',
                      price: 0,
                      description: '',
                      image: ''
                    })}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95"
                  >
                    + {t.add_item}
                  </button>
                </div>
                <div className="space-y-4">
                  {filteredItems.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-100">
                      <div className="flex items-center gap-4">
                        <img src={item.image} className="w-12 h-12 rounded-lg object-cover" referrerPolicy="no-referrer" alt={getLocalized(item, 'name')} />
                        <div>
                          <div className="font-bold">{getLocalized(item, 'name')}</div>
                          <div className="text-sm text-gray-400 font-mono">₺{item.price}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingItem(item)} className="p-2 text-gray-400 hover:text-orange-600 transition-colors" aria-label="Edit item"><Edit2 size={18} /></button>
                        <button onClick={() => removeItem(item.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" aria-label="Delete item"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'success' && (
          <div className="max-w-md mx-auto text-center py-20 animate-in zoom-in-95">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner transition-colors duration-500 ${lastOrder?.status === 'pending' ? 'bg-orange-100 text-orange-600' :
              lastOrder?.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                lastOrder?.status === 'ready' ? 'bg-green-100 text-green-600' :
                  'bg-gray-100 text-gray-600'
              }`}>
              {lastOrder?.status === 'pending' ? <Clock size={48} /> :
                lastOrder?.status === 'preparing' ? <Flame size={48} /> :
                  lastOrder?.status === 'ready' ? <CheckCircle size={48} /> :
                    <Truck size={48} />}
            </div>
            <h2 className="text-4xl font-black mb-4">
              {lastOrder?.status === 'pending' ? t.pending :
                lastOrder?.status === 'preparing' ? t.preparing :
                  lastOrder?.status === 'ready' ? t.ready :
                    t.delivered}
            </h2>
            <p className="text-gray-500 mb-8">{t.order_desc}</p>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => window.print()}
                className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <ClipboardList size={20} /> {t.print_receipt}
              </button>
              <button onClick={() => setView('menu')} className="bg-black text-white px-8 py-4 rounded-2xl font-bold transition-transform active:scale-95">{t.back}</button>
            </div>

            {/* Hidden Receipt for Printing */}
            <div className="hidden print:block text-left p-8 font-mono text-sm bg-white">
              <div className="text-center mb-4">
                <h1 className="text-xl font-bold">BALTAZAR BURGER</h1>
                <p>Table: #{lastOrder?.table}</p>
                <p>{new Date().toLocaleString()}</p>
              </div>
              <div className="border-t border-b border-dashed py-2 mb-2">
                {lastOrder?.items.map((item, i) => (
                  <div key={i} className="flex justify-between mb-1">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₺{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>TOTAL</span>
                <span>₺{lastOrder?.total}</span>
              </div>
              <div className="text-center mt-8">
                <p>Thank you for your visit!</p>
              </div>
            </div>
          </div>
        )}

        {view === 'track' && (
          (() => {
            // Define the four steps of the progress pipeline
            const steps: { key: Order['status']; label: string; icon: React.ReactNode }[] = [
              { key: 'pending', label: t.pending, icon: <MapPin size={28} /> },
              { key: 'preparing', label: t.preparing, icon: <ChefHat size={28} /> },
              { key: 'ready', label: t.ready, icon: <PackageCheck size={28} /> },
              { key: 'delivered', label: t.delivered, icon: <Truck size={28} /> },
            ];
            const currentIndex = steps.findIndex(s => s.key === lastOrder?.status);
            const progressPct = currentIndex < 0 ? 0 : Math.round(((currentIndex) / (steps.length - 1)) * 100);

            return (
              <div className="max-w-lg mx-auto py-16 animate-in fade-in slide-in-from-bottom-4">
                {/* Status icon */}
                <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner transition-all duration-700 ${lastOrder?.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                  lastOrder?.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                    lastOrder?.status === 'ready' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-500'
                  }`}>
                  {lastOrder?.status === 'pending' ? <MapPin size={52} /> :
                    lastOrder?.status === 'preparing' ? <ChefHat size={52} /> :
                      lastOrder?.status === 'ready' ? <PackageCheck size={52} /> :
                        <Truck size={52} />}
                </div>

                <h2 className="text-4xl font-black text-center mb-2">
                  {lastOrder?.status === 'pending' ? t.pending :
                    lastOrder?.status === 'preparing' ? t.preparing :
                      lastOrder?.status === 'ready' ? t.ready :
                        t.delivered}
                </h2>
                <p className="text-center text-gray-400 mb-10">Table #{lastOrder?.table}</p>

                {/* Progress track */}
                <div className="relative mb-12">
                  {/* Background rail */}
                  <div className="absolute top-6 left-0 right-0 h-2 bg-gray-200 rounded-full" />
                  {/* Active fill with shimmer */}
                  <div
                    ref={(el) => { if (el) el.style.setProperty('--progress', `${progressPct}%`); }}
                    className={`absolute top-6 left-0 h-2 rounded-full transition-all duration-700 ease-in-out bb-progress-fill ${lastOrder?.status === 'delivered' ? 'bg-gray-400' : 'bb-progress-active'
                      }`}
                  />
                  {/* Step dots */}
                  <div className="relative flex justify-between">
                    {steps.map((step, idx) => {
                      const done = idx < currentIndex;
                      const active = idx === currentIndex;
                      return (
                        <div key={step.key} className="flex flex-col items-center gap-2 bb-step-col">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-500 border-4 ${done
                            ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200'
                            : active
                              ? 'bg-white border-orange-500 text-orange-600 shadow-xl'
                              : 'bg-white border-gray-200 text-gray-300'
                            }`}>
                            {step.icon}
                          </div>
                          <span className={`text-[11px] font-black uppercase text-center leading-tight ${active ? 'text-orange-600' : done ? 'text-gray-500' : 'text-gray-300'
                            }`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order summary */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-6">
                  <div className="text-xs font-black text-gray-400 uppercase mb-4">{t.cart_title}</div>
                  <div className="space-y-4 mb-4 font-mono">
                    {sessionOrders.map((order, oIdx) => (
                      <div key={order.id} className={oIdx > 0 ? "pt-4 border-t border-dashed border-gray-100" : ""}>
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{item.quantity}× {item.name}</span>
                            <span className="font-bold text-orange-600">₺{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t-2 border-dashed border-gray-100">
                    <div className="text-sm font-black text-gray-400 uppercase">{t.total}</div>
                    <div className="text-3xl font-black text-orange-600">₺{sessionTotal}</div>
                  </div>
                </div>

                {/* Payment status banner */}
                {lastOrder?.paymentStatus === 'paid' && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 text-center">
                    <div className="text-green-600 font-black text-lg">✓ {lang === 'tr' ? 'Ödeme Alındı' : 'Payment Confirmed'}</div>
                  </div>
                )}

                {/* Allow placing another order anytime — multi-order support */}
                <button
                  onClick={() => setView('menu')}
                  className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-orange-700 transition-all active:scale-95 mb-3"
                >
                  {t.new_order}
                </button>
                <button
                  onClick={requestBill}
                  className="w-full bg-orange-100 text-orange-600 font-bold py-3 rounded-2xl hover:bg-orange-200 transition-all active:scale-95 mb-3"
                >
                  {lang === 'tr' ? 'Hesap İste' : (lang === 'ar' ? 'طلب الفاتورة' : 'Request Bill')}
                </button>
              </div>
            );
          })()
        )}

        {view === 'waiter_success' && (
          <div className="max-w-md mx-auto text-center py-20 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><MessageSquare size={48} /></div>
            <h2 className="text-4xl font-black mb-4">{t.waiter_called}</h2>
            <p className="text-gray-500 mb-8">{t.waiter_desc}</p>
            <button onClick={() => setView('menu')} className="bg-black text-white px-8 py-4 rounded-2xl font-bold transition-transform active:scale-95">{t.back}</button>
          </div>
        )}
      </main>

      {/* Item Detail Modal overlay */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300" onClick={() => setSelectedItem(null)}>
          <div
            className="bg-white w-full max-w-lg md:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full md:slide-in-from-bottom-10"
            onClick={e => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="relative w-full h-64 md:h-80 bg-gray-100">
              <img src={selectedItem.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={getLocalized(selectedItem, 'name')} />
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
                aria-label="Close item detail"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 flex flex-col max-h-[50vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4 gap-4">
                <h3 className="text-2xl md:text-3xl font-black">{getLocalized(selectedItem, 'name')}</h3>
                <span className="text-orange-600 font-black text-xl md:text-2xl whitespace-nowrap">₺{selectedItem.price}</span>
              </div>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-6 whitespace-pre-line">
                {getLocalized(selectedItem, 'description')}
              </p>

              {selectedItem.variants && selectedItem.variants.length > 0 && (
                <div className="mb-6 space-y-2">
                  <h4 className="font-black text-sm text-gray-400 uppercase tracking-widest">Size / Selection</h4>
                  <div className="flex flex-col gap-2">
                    {selectedItem.variants.map((variant, i) => (
                      <label key={i} onClick={(e) => e.stopPropagation()} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-colors ${selectedVariant?.label === variant.label ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            className="hidden"
                            name="variant"
                            checked={selectedVariant?.label === variant.label}
                            onChange={() => setSelectedVariant(variant)}
                          />
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedVariant?.label === variant.label ? 'border-orange-500' : 'border-gray-300'}`}>
                            {selectedVariant?.label === variant.label && <div className="w-3 h-3 bg-orange-500 rounded-full" />}
                          </div>
                          <span className="font-bold text-gray-800">{getLocalized(variant, 'label')}</span>
                        </div>
                        {variant.priceOverride !== undefined && <span className="font-black text-orange-600 text-lg">₺{variant.priceOverride}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {isOrderingEnabled && (
                <button
                  onClick={() => { addToCart(selectedItem, selectedVariant || undefined); setSelectedItem(null); }}
                  className="w-full mt-auto bg-orange-600 text-white px-6 py-4 rounded-2xl font-black text-lg shadow-xl shadow-orange-100 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {t.add_to_cart} <Plus size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">{t.update_item}</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors" aria-label="Close editor"><X /></button>
            </div>
            <div className="space-y-4">
              <input className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500" value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} placeholder="İsim (TR)" />
              <input className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500" value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })} placeholder="Price" />
              <textarea className="w-full bg-gray-50 p-4 rounded-2xl outline-none h-24 focus:ring-2 focus:ring-orange-500" value={editingItem.description} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} placeholder="Açıklama (TR)" />
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase text-gray-400 ml-2">{t.img_url}</div>
                <input
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-orange-500 mb-2"
                  value={editingItem.image}
                  onChange={(e) => setEditingItem({ ...editingItem, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    title="Upload item image"
                    className="flex-1 bg-gray-50 p-4 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-orange-500"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = await handleImageUpload(file, 'item');
                        if (url) setEditingItem({ ...editingItem, image: url });
                      }
                    }}
                  />
                  {isUploading && <Loader2 className="animate-spin text-orange-600 self-center" />}
                </div>
                {editingItem.image && (
                  <div className="mt-2 relative group">
                    <img src={editingItem.image} className="w-20 h-20 rounded-xl object-cover border border-gray-100" alt="Item preview" />
                    <button
                      onClick={() => setEditingItem({ ...editingItem, image: '' })}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Translation fields */}
              <div className="bg-orange-50 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black uppercase tracking-widest text-orange-500 mb-2">English</div>
                <input className="w-full bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm" value={editingItem.name_en || ''} onChange={(e) => setEditingItem({ ...editingItem, name_en: e.target.value })} placeholder="Name (EN)" />
                <textarea className="w-full bg-white p-3 rounded-xl outline-none h-20 focus:ring-2 focus:ring-orange-400 text-sm" value={editingItem.description_en || ''} onChange={(e) => setEditingItem({ ...editingItem, description_en: e.target.value })} placeholder="Description (EN)" />
              </div>

              <div className="bg-blue-50 rounded-2xl p-4 space-y-3" dir="rtl">
                <div className="text-xs font-black uppercase tracking-widest text-blue-500 mb-2">Arabic — العربية</div>
                <input className="w-full bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 text-sm" value={editingItem.name_ar || ''} onChange={(e) => setEditingItem({ ...editingItem, name_ar: e.target.value })} placeholder="الاسم" />
                <textarea className="w-full bg-white p-3 rounded-xl outline-none h-20 focus:ring-2 focus:ring-blue-400 text-sm" value={editingItem.description_ar || ''} onChange={(e) => setEditingItem({ ...editingItem, description_ar: e.target.value })} placeholder="الوصف" />
              </div>

              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                <span className="font-bold text-gray-700">{t.in_stock}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={editingItem.inStock !== false} onChange={(e) => setEditingItem({ ...editingItem, inStock: e.target.checked })} title="Toggle in stock" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              <div className="bg-gray-100 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-500">{t.item_variants}</div>
                  <button onClick={() => setEditingItem({ ...editingItem, variants: [...(editingItem.variants || []), { label: '' }] })} className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-black transition-colors">+ {t.add_variant}</button>
                </div>
                {(editingItem.variants || []).map((variant, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="flex-1 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm" value={variant.label} onChange={(e) => {
                      const newVariants = [...(editingItem.variants || [])];
                      newVariants[i].label = e.target.value;
                      setEditingItem({ ...editingItem, variants: newVariants });
                    }} placeholder={t.variant_label_ex} />
                    <input type="number" className="w-24 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm" value={variant.priceOverride || ''} onChange={(e) => {
                      const newVariants = [...(editingItem.variants || [])];
                      newVariants[i].priceOverride = e.target.value ? Number(e.target.value) : undefined;
                      setEditingItem({ ...editingItem, variants: newVariants });
                    }} placeholder={t.price} />
                    <button onClick={() => {
                      const newVariants = [...(editingItem.variants || [])];
                      newVariants.splice(i, 1);
                      setEditingItem({ ...editingItem, variants: newVariants });
                    }} className="text-red-400 hover:text-red-600 p-2" aria-label="Remove variant"><Trash2 size={18} /></button>
                  </div>
                ))}
                {(!editingItem.variants || editingItem.variants.length === 0) && (
                  <div className="text-xs text-gray-400 mt-2">No variants added. The item will be added directly to the cart.</div>
                )}
              </div>

              <button
                onClick={handleAutoTranslateItem}
                disabled={isTranslating}
                className="w-full bg-orange-100 text-orange-700 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-orange-200 transition-colors disabled:opacity-50"
              >
                {isTranslating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />} {t.auto_translate}
              </button>

              <button onClick={() => saveItem(editingItem)} className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95">{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">{t.manage_cat}</h3>
              <button onClick={() => setEditingCategory(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors" aria-label="Close editor"><X /></button>
            </div>
            <div className="space-y-4">
              <input className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} placeholder="Title (TR)" />

              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase text-gray-400 ml-2">{t.img_url}</div>
                <input
                  className="w-full bg-gray-50 p-4 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-orange-500 mb-2"
                  value={editingCategory.image}
                  onChange={(e) => setEditingCategory({ ...editingCategory, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    title="Upload category image"
                    className="flex-1 bg-gray-50 p-4 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-orange-500"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = await handleImageUpload(file, 'category');
                        if (url) setEditingCategory({ ...editingCategory, image: url });
                      }
                    }}
                  />
                  {isUploading && <Loader2 className="animate-spin text-orange-600 self-center" />}
                </div>
                {editingCategory.image && (
                  <div className="mt-2 relative group w-20 h-20">
                    <img src={editingCategory.image} className="w-20 h-20 rounded-xl object-cover border border-gray-100" alt="Category preview" />
                    <button
                      onClick={() => setEditingCategory({ ...editingCategory, image: '' })}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Translation fields */}
              <div className="bg-orange-50 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black uppercase tracking-widest text-orange-500 mb-2">English</div>
                <input className="w-full bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm" value={editingCategory.name_en || ''} onChange={(e) => setEditingCategory({ ...editingCategory, name_en: e.target.value })} placeholder="Name (EN)" />
              </div>

              <div className="bg-blue-50 rounded-2xl p-4 space-y-3" dir="rtl">
                <div className="text-xs font-black uppercase tracking-widest text-blue-500 mb-2">Arabic — العربية</div>
                <input className="w-full bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 text-sm" value={editingCategory.name_ar || ''} onChange={(e) => setEditingCategory({ ...editingCategory, name_ar: e.target.value })} placeholder="الاسم" />
              </div>

              <button
                onClick={handleAutoTranslateCategory}
                disabled={isTranslating}
                className="w-full bg-orange-100 text-orange-700 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-orange-200 transition-colors disabled:opacity-50"
              >
                {isTranslating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />} {t.auto_translate}
              </button>
              <button onClick={() => saveCategory(editingCategory)} className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95">{t.save}</button>
              <button onClick={() => removeCategory(editingCategory.id)} className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-xl text-sm transition-colors hover:bg-red-100">{t.delete}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Day Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-5 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-center mb-3">{t.reset_day}</h3>
            <p className="text-gray-500 text-sm text-center mb-8">{t.reset_confirm}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-2xl hover:bg-gray-200 transition-colors"
              >
                {t.back}
              </button>
              <button
                onClick={resetDay}
                className="flex-1 bg-red-600 text-white font-black py-3 rounded-2xl hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
              >
                {t.reset_day}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-10 text-center opacity-20 text-[10px] font-black uppercase tracking-widest">
        © 2026 Baltazar Burger Restaurant
      </footer>
    </div>
  );
}
