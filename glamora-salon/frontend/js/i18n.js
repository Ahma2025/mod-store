// ============================================================
// Velour i18n — Arabic ↔ English
// Strategy: AR text is the source of truth.
//   applyTranslations() walks all text nodes + key attributes
//   and replaces Arabic with English when lang === 'en'.
//   On switch back to AR the page reloads (gets fresh AR HTML).
// ============================================================

window.VELOUR_LANG = localStorage.getItem('velour_lang') || 'ar';

// ---- Translation dictionary: Arabic → English ----
const TR = {
  // === SPLASH / ONBOARDING ===
  'جمالك، أولويتنا': 'Your Beauty, Our Priority',
  'اكتشفي أفضل صالونات المنطقة': 'Discover the Best Salons Near You',
  'صالونات فاخرة مختارة بعناية، مراجعات حقيقية، أسعار شفافة': 'Handpicked luxury salons, real reviews, transparent prices',
  'احجزي موعدك بثواني': 'Book Your Appointment in Seconds',
  'اختاري كوفيرتك المفضلة، الخدمة، والوقت المناسب - كل شيء بنقرة واحدة': 'Choose your stylist, service & time — all in one tap',
  'نقاط مكافآت وعروض حصرية': 'Rewards & Exclusive Offers',
  'اكسبي نقاط مع كل زيارة واستمتعي بخصومات وعروض VIP': 'Earn points with every visit and enjoy VIP discounts',
  'ابدئي رحلتك': 'Start Your Journey',
  'حساب جديد': 'Create Account',

  // === AUTH ===
  'أهلاً بك مجدداً': 'Welcome Back',
  'سجّلي دخولك للمتابعة': 'Sign in to continue',
  'رقم الهاتف': 'Phone Number',
  'كلمة المرور': 'Password',
  'دخول': 'Sign In',
  'ما عندك حساب؟': "Don't have an account?",
  'سجّلي الآن': 'Register Now',
  'انضمي إلينا': 'Join Us',
  'أنشئي حسابك وابدئي رحلة الجمال': 'Create your account and start your beauty journey',
  'الاسم الكامل': 'Full Name',
  'البريد الإلكتروني (اختياري)': 'Email (Optional)',
  '6 أحرف على الأقل': 'At least 6 characters',
  'نوع الحساب': 'Account Type',
  'زبونة': 'Client',
  'كوفيرة': 'Stylist',
  'إنشاء حساب مجاناً': 'Create Free Account',
  'عندك حساب؟': 'Already have an account?',

  // === HOME ===
  'مرحباً بك': 'Welcome',
  'أوجدي صالونك المفضل واحجزي لحظتك الخاصة ✨': 'Find your favorite salon and book your special moment ✨',
  'ابحثي عن صالون أو خدمة...': 'Search for a salon or service...',
  '📍 الأقرب إليك': '📍 Near You',
  'مشاهدة المزيد ←': 'See More ←',
  '🌸 الخدمات الشائعة': '🌸 Popular Services',
  'مكياج': 'Makeup',
  'أظافر': 'Nails',
  'شعر': 'Hair',
  'عناية بالبشرة': 'Skin Care',
  'عرائس': 'Bridal',
  'علاجات': 'Treatments',
  '⭐ الأعلى تقييماً': '⭐ Top Rated',
  'جميع الصالونات': 'All Salons',
  'الرئيسية': 'Home',

  // === BOOKINGS TAB ===
  'حجوزاتي': 'My Bookings',
  'القادمة': 'Upcoming',
  'السابقة': 'Past',

  // === CHAT TAB ===
  'رسائلي': 'Messages',
  'الرسائل': 'Messages',
  'اكتبي رسالتك...': 'Type your message...',
  'رسالة صوتية': 'Voice message',
  'إرسال صورة': 'Send image',
  'متاحة الآن': 'Available now',
  'أهلاً وسهلاً! كيف أقدر أساعدك؟ 💖': 'Welcome! How can I help you? 💖',
  'تم الحجز بنجاح، بنتشرف بزيارتك 🌸': 'Booking confirmed, we look forward to your visit 🌸',
  'عذراً الموعد هذا غير متاح، هل يناسبك وقت آخر؟': 'Sorry, this slot is unavailable. Would another time work?',
  'شكراً لتواصلك، سيتم الرد قريباً 🙏': 'Thank you for reaching out, we\'ll reply soon 🙏',
  'يمكنك الاطلاع على أسعارنا من قسم الخدمات في صفحة الصالون 💅': 'You can view our prices in the Services section 💅',
  'أهلاً 💖': 'Hello 💖',
  'تم الحجز ✅': 'Booked ✅',
  'غير متاح ❌': 'Unavailable ❌',
  'شكراً 🙏': 'Thanks 🙏',
  'الأسعار 💅': 'Prices 💅',

  // === PROFILE TAB ===
  'حسابي': 'My Account',
  'نقاط المكافآت': 'Reward Points',
  'فضي': 'Silver',
  'ذهبي': 'Gold',
  'بلاتيني': 'Platinum',
  'وردي': 'Pink',
  'ملفي الجمالي': 'My Beauty Profile',
  'شعري، بشرتي، حساسيتي، وصفات الألوان': 'Hair, skin, allergies & color formulas',
  'مستشارة التسريحة AI': 'AI Hairstyle Advisor',
  'ارفعي صورتك واحصلي على توصيات ذكية': 'Upload your photo and get smart recommendations',
  'حاسبة لون الشعر': 'Hair Color Calculator',
  'اكتشفي أنسب لون لبشرتك وعيونك': 'Find the perfect hair color for your skin & eyes',
  'تاريخ ألوان شعري': 'My Hair Color History',
  'فورمولات جميع الصبغات السابقة': 'All previous color formulas',
  'سجل النقاط': 'Points History',
  'كيف كسبتِ نقاطك': 'How you earned your points',
  'تسجيل الخروج': 'Sign Out',

  // === SALON DETAIL ===
  'تقييم': 'review',
  'تقييمات': 'reviews',
  'الخدمات': 'Services',
  'الكوفيرات': 'Stylists',
  'التقييمات': 'Reviews',
  'المعلومات': 'Info',
  'لا توجد تقييمات بعد': 'No reviews yet',
  'قيّمي هذا الصالون': 'Rate this salon',
  '🧹 النظافة': '🧹 Cleanliness',
  '⏰ الالتزام بالوقت': '⏰ Punctuality',
  '✨ النتيجة': '✨ Results',
  'اكتبي تعليقك (اختياري)...': 'Write your comment (optional)...',
  '📷 قبل': '📷 Before',
  '📷 بعد': '📷 After',
  'إرسال التقييم': 'Submit Review',
  'دقيقة': 'min',
  'خبرة': 'Experience',
  'سنة': 'yr',
  'سنوات': 'yrs',
  'احجزي مع': 'Book with',
  'احجزي الآن': 'Book Now',
  'عرض الخريطة': 'Show Map',
  'اتصال': 'Call',
  'مشاركة': 'Share',
  'مفتوح': 'Open',
  'مغلق': 'Closed',

  // === BOOKING WIZARD ===
  'احجزي موعدك': 'Book Your Appointment',
  'اختاري الخدمة': 'Select Service',
  'اختاري كوفيرتك': 'Choose Your Stylist',
  'اختاري الوقت': 'Choose Time',
  'تأكيد الحجز': 'Confirm Booking',
  'ملاحظات (اختياري)': 'Notes (Optional)',
  'أي تفاصيل إضافية للكوفيرة...': 'Any additional details for the stylist...',
  'السابق': 'Back',
  'التالي ›': 'Next ›',
  'الخدمة': 'Service',
  'الخدمات': 'Services',
  'الكوفيرة': 'Stylist',
  'التاريخ': 'Date',
  'الوقت': 'Time',
  'المدة': 'Duration',
  'المدة الإجمالية': 'Total Duration',
  'السعر الإجمالي': 'Total Price',

  // === SUCCESS MODAL ===
  'تم إرسال طلب الحجز!': 'Booking Request Sent!',
  'موعدك محجوز، بنتظرك!': 'Your appointment is booked, see you soon!',
  'حسناً، انتظري الموافقة': 'OK, Waiting for Approval',
  'بانتظار موافقة الكوفيرة - ستصلك إشعار عند التأكيد': 'Waiting for stylist approval — you\'ll be notified when confirmed',

  // === NOTIFICATIONS ===
  'الإشعارات': 'Notifications',
  'لا توجد إشعارات': 'No notifications',

  // === BEAUTY PROFILE ===
  'ملفي الجمالي': 'My Beauty Profile',
  'حان وقت صبغة شعرك!': 'Time to refresh your hair color!',
  '💇 معلومات شعري': '💇 My Hair Info',
  'اللون الحالي': 'Current Color',
  'اختاري...': 'Choose...',
  'أسود': 'Black',
  'بني داكن': 'Dark Brown',
  'بني متوسط': 'Medium Brown',
  'بني فاتح': 'Light Brown',
  'أشقر داكن': 'Dark Blonde',
  'أشقر': 'Blonde',
  'أحمر': 'Red',
  'مصبوغ / هايلايت': 'Dyed / Highlights',
  'نوع الشعر': 'Hair Type',
  'ناعم مستقيم': 'Straight',
  'موجي': 'Wavy',
  'مجعد خفيف': 'Slightly Curly',
  'مجعد كثيف': 'Curly',
  'كيرلي': 'Very Curly',
  'لون البشرة': 'Skin Tone',
  'فاتح جداً': 'Very Fair',
  'واضح': 'Fair',
  'قمحي': 'Wheat',
  'زيتوني': 'Olive',
  'أسمر': 'Brown',
  'داكن': 'Dark',
  'شكل الوجه': 'Face Shape',
  'بيضاوي': 'Oval',
  'مستدير': 'Round',
  'مربع': 'Square',
  'قلب': 'Heart',
  'مستطيل': 'Rectangle',
  'ماسي': 'Diamond',
  '⚕️ حساسية وملاحظات': '⚕️ Allergies & Notes',
  'حساسية (إذا وجدت)': 'Allergies (if any)',
  'مثال: لا أتحمل الأمونيا...': 'e.g. Ammonia intolerance...',
  'ملاحظات للكوفيرة': 'Notes for Stylist',
  'مثال: أحب الألوان الدافئة، لا تعالج الشعر أكثر من اللازم...': 'e.g. I prefer warm tones, don\'t over-process...',
  '💾 حفظ الملف الجمالي': '💾 Save Beauty Profile',
  '🎨 وصفات الألوان المحفوظة': '🎨 Saved Color Formulas',
  '⏰ تذكير صبغة الشعر': '⏰ Hair Color Reminder',
  'سنذكّرك عند حلول موعد تجديد لون شعرك': "We'll remind you when it's time to refresh your color",
  '4 أسابيع': '4 Weeks',
  '6 أسابيع': '6 Weeks',
  '8 أسابيع': '8 Weeks',

  // === AI HAIRSTYLE ===
  '🤖 مستشارة التسريحة': '🤖 Hairstyle Advisor',
  'اكتشفي التسريحة المناسبة لك': 'Discover Your Perfect Hairstyle',
  'ارفعي صورة وجهك أو اختاري شكل وجهك وسنقترح تسريحات ولون شعر يناسبك': 'Upload your photo or select your face shape and we\'ll suggest styles & colors',
  '📸 صورة وجهك (اختياري)': '📸 Your Face Photo (Optional)',
  '📷 رفع صورة وجهك': '📷 Upload Your Photo',
  'أو اختاري شكل وجهك': 'Or Select Your Face Shape',
  '🥚 بيضاوي': '🥚 Oval',
  '⭕ مستدير': '⭕ Round',
  '⬜ مربع': '⬜ Square',
  '🩷 قلب': '🩷 Heart',
  '✨ احصلي على توصياتك': '✨ Get Your Recommendations',
  '💇 تسريحات مقترحة': '💇 Suggested Hairstyles',
  '🎨 ألوان مقترحة': '🎨 Suggested Colors',

  // === COLOR CALCULATOR ===
  '🎨 حاسبة لون الشعر': '🎨 Hair Color Calculator',
  'لون بشرتك؟': 'Your skin tone?',
  '🌸 فاتح جداً': '🌸 Very Fair',
  '🍑 واضح': '🍑 Fair',
  '🌾 قمحي': '🌾 Wheat',
  '🫒 زيتوني': '🫒 Olive',
  '🍫 أسمر': '🍫 Brown',
  'لون عيونك؟': 'Your eye color?',
  '🔵 أزرق': '🔵 Blue',
  '🟢 أخضر': '🟢 Green',
  '🟤 بندقي': '🟤 Hazel',
  '🫗 بني': '🫗 Brown',
  '⚫ أسود': '⚫ Black',
  'أسلوبك المفضل؟': 'Your preferred style?',
  '🌿 طبيعي وهادئ': '🌿 Natural & Soft',
  '🔥 جريء ومميز': '🔥 Bold & Striking',
  '☀️ دافئ ومشرق': '☀️ Warm & Radiant',
  '❄️ بارد وأنيق': '❄️ Cool & Elegant',
  'لون موصى به': 'Recommended Color',
  '↩ إعادة الحساب': '↩ Recalculate',
  'التالي ›': 'Next ›',

  // === COLOR HISTORY ===
  'تاريخ ألوان شعري': 'My Hair Color History',
  'لا توجد وصفات محفوظة بعد': 'No saved formulas yet',

  // === STYLIST DASHBOARD ===
  'لوحة التحكم': 'Dashboard',
  'صالوني': 'My Salon',
  'الفريق': 'Team',
  'الحجوزات': 'Bookings',
  'لم تُسجّلي صالونك بعد': "You haven't registered your salon yet",
  'أضيفي تفاصيل صالونك لتبدأ باستقبال الحجوزات': 'Add your salon details to start receiving bookings',
  '+ أضيفي صالونك': '+ Add Your Salon',
  'موقع الصالون على الخريطة': 'Salon Location on Map',
  'تحديد الموقع': 'Set Location',
  'لم يتم تحديد الموقع بعد': 'Location not set yet',
  'مواعيد الدوام': 'Working Hours',
  'تعديل': 'Edit',
  'الخدمات': 'Services',
  '+ إضافة خدمة': '+ Add Service',
  'صور الصالون': 'Salon Photos',
  '+ رفع صورة': '+ Upload Photo',
  '🎁 العروض الخاصة': '🎁 Special Offers',
  '+ عرض جديد': '+ New Offer',
  'حجب المواعيد': 'Block Time Slots',
  '+ حجب وقت': '+ Block Time',
  'أغلقي وقتاً محدداً ليتوقف الحجز فيه': 'Block a specific time to stop bookings during it',
  '📦 المخزون': '📦 Inventory',
  '+ إضافة': '+ Add',
  'لا يوجد منتجات مضافة بعد': 'No products added yet',
  '📊 التحليلات': '📊 Analytics',
  '👥 الزبونات': '👥 Clients',

  // === ANALYTICS ===
  'التحليلات': 'Analytics',
  'اليوم': 'Today',
  'الأسبوع': 'This Week',
  'الشهر': 'This Month',
  'الكل': 'All Time',
  'الدخل': 'Revenue',
  'بانتظار التأكيد': 'Pending',
  'مؤكدة': 'Confirmed',
  'مكتملة': 'Completed',
  'أكثر خدمة مطلوبة': 'Most Requested Service',
  '🔄 تصفير الدخل': '🔄 Reset Revenue',
  'أكثر وقت حجزاً': 'Busiest Booking Time',
  'لا توجد بيانات بعد': 'No data yet',
  'الساعة': 'At',
  'مرة': 'times',
  'فشل تحميل التحليلات': 'Failed to load analytics',

  // === CLIENTS ===
  'قائمة الزبونات': 'Client List',
  'آخر زيارة:': 'Last visit:',
  'إجمالي': 'total',
  'حجز': 'booking',
  'لا توجد زبونات بعد': 'No clients yet',
  'فشل التحميل': 'Failed to load',

  // === INVENTORY ===
  'إضافة / تعديل منتج': 'Add / Edit Product',
  'اسم المنتج *': 'Product Name *',
  'مثال: شامبو أرجان': 'e.g. Argan Shampoo',
  'الكمية': 'Quantity',
  'الوحدة': 'Unit',
  'قطعة / لتر / كغ': 'Piece / Liter / Kg',
  'تحذير نقص عند وصول الكمية لـ': 'Low stock warning when quantity reaches',
  'مخزون منخفض ⚠️': 'Low Stock ⚠️',

  // === STYLIST TEAM ===
  'فريق الصالون': 'Salon Team',
  '+ إضافة كوفيرة': '+ Add Stylist',
  'لا يوجد كوفيرات بعد': 'No stylists added yet',
  'تحديد أوقات الدوام': 'Set Working Hours',

  // === STYLIST BOOKINGS ===
  'الكل': 'All',
  'اليوم': 'Today',
  'القادمة': 'Upcoming',
  'السابقة': 'Past',
  'تأكيد': 'Confirm',
  'رفض': 'Reject',
  'لا توجد حجوزات': 'No bookings',
  'بانتظار التأكيد': 'Pending',
  'مؤكد': 'Confirmed',
  'مكتمل': 'Completed',
  'مرفوض': 'Rejected',
  'ملغي': 'Cancelled',

  // === PROFILE STYLIST ===
  'إحصائياتي': 'My Stats',
  'حجوزات': 'Bookings',
  'تقييم': 'Rating',
  'صور': 'Photos',
  'تعديل المعلومات': 'Edit Info',
  'الاسم': 'Name',
  'حفظ': 'Save',
  'إلغاء': 'Cancel',
  'رفع صورة شخصية': 'Upload Profile Photo',

  // === OFFERS ===
  '🎁 إضافة عرض خاص': '🎁 Add Special Offer',
  'سيُرسل إشعار فوري لجميع زبوناتك': 'An instant notification will be sent to all your clients',
  'عنوان العرض *': 'Offer Title *',
  'مثال: خصم 20% على المكياج هذا الأسبوع': 'e.g. 20% off makeup this week',
  'وصف العرض': 'Offer Description',
  'نسبة الخصم %': 'Discount %',
  'صالحة حتى': 'Valid Until',
  'إضافة العرض': 'Add Offer',

  // === BLOCK SLOTS ===
  'حجب موعد': 'Block Time Slot',
  'التاريخ': 'Date',
  'من': 'From',
  'إلى': 'To',
  'سبب (اختياري)': 'Reason (Optional)',
  'حجب الوقت': 'Block Time',

  // === SERVICES ===
  'إضافة خدمة': 'Add Service',
  'اسم الخدمة': 'Service Name',
  'الفئة': 'Category',
  'السعر (₪)': 'Price (₪)',
  'مدة الخدمة (دقيقة)': 'Duration (minutes)',
  'وصف الخدمة (اختياري)': 'Description (Optional)',
  'حفظ الخدمة': 'Save Service',
  'تعديل الخدمة': 'Edit Service',
  'حذف': 'Delete',

  // === HOURS ===
  'الأحد': 'Sunday',
  'الاثنين': 'Monday',
  'الثلاثاء': 'Tuesday',
  'الأربعاء': 'Wednesday',
  'الخميس': 'Thursday',
  'الجمعة': 'Friday',
  'السبت': 'Saturday',
  'يوم إجازة': 'Day Off',
  'حفظ المواعيد': 'Save Hours',
  'من الساعة': 'From',
  'إلى الساعة': 'To',

  // === TOASTS / ERRORS ===
  '⚠️ اختاري خدمة واحدة على الأقل': '⚠️ Select at least one service',
  '⚠️ اختاري الكوفيرة': '⚠️ Please choose a stylist',
  '⚠️ اختاري التاريخ والوقت': '⚠️ Please choose date and time',
  '⚠️ بيانات الحجز غير مكتملة': '⚠️ Booking information is incomplete',
  'تم الحفظ ✓': 'Saved ✓',
  'تم الحذف ✓': 'Deleted ✓',
  'فشل الحفظ': 'Save failed',
  'فشل الحذف': 'Delete failed',
  'فشل إرسال الرد': 'Failed to send reply',
  'تم إرسال الرد ✓': 'Reply sent ✓',
  'اكتبي الرد أولاً': 'Write your reply first',
  'اسم المنتج مطلوب': 'Product name is required',
  'تم إضافة الصالون بنجاح': 'Salon added successfully',
  'تم تحديث الصالون': 'Salon updated',
  'فشل تحميل التقييمات': 'Failed to load reviews',
  'حدث خطأ ما': 'Something went wrong',
  'خطأ في إنشاء الحجز': 'Booking creation failed',
  'يرجى تعبئة جميع الحقول المطلوبة': 'Please fill all required fields',
  'هذا الوقت محجوز، اختاري وقتاً آخر': 'This time slot is taken, please choose another',
  'لا توجد مواعيد متاحة في هذا اليوم': 'No available slots on this day',
  'تعذر تحميل المواعيد': 'Failed to load time slots',
  'محاولات كثيرة، انتظري 15 دقيقة': 'Too many attempts, wait 15 minutes',
  'طلبات كثيرة جداً': 'Too many requests',

  // === BOOKING STATUS ===
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'completed': 'Completed',
  'rejected': 'Rejected',
  'cancelled': 'Cancelled',
  'بانتظار التأكيد': 'Pending Approval',

  // === BOOKING CARDS ===
  'إلغاء الحجز': 'Cancel Booking',
  'تقييم الجلسة': 'Rate Session',
  'عرض التفاصيل': 'View Details',
  'التواصل مع الكوفيرة': 'Contact Stylist',
  'لا توجد حجوزات قادمة': 'No upcoming bookings',
  'لا توجد حجوزات سابقة': 'No past bookings',
  'احجزي أول موعد لك!': 'Book your first appointment!',

  // === MAP / LOCATION ===
  'الأقرب إليك': 'Nearest to You',
  'كم': 'km',
  'لا توجد صالونات في منطقتك': 'No salons in your area',
  'يتطلب تفعيل خدمة الموقع': 'Location permission required',

  // === LOYALTY ===
  'نقطة': 'point',
  'نقاط': 'points',
  'للذهبي': 'to Gold',
  'للبلاتيني': 'to Platinum',
  'نقاط المكافآت': 'Reward Points',

  // === MISC ===
  'تحميل...': 'Loading...',
  'لا يوجد نتائج': 'No results found',
  'خطأ': 'Error',
  'نعم': 'Yes',
  'لا': 'No',
  'تم': 'Done',
  'إغلاق': 'Close',
  'مزيد': 'More',
  'جديد': 'New',
  'موقع': 'Location',
  'حذف المنتج؟': 'Delete product?',
  'خبرة سنة': '1 yr exp',
  'تقييم صفر': 'No rating',
  'لا يوجد وصف': 'No description',

  // === REVIEW PROMPTS ===
  'كيف كانت تجربتك؟': 'How was your experience?',
  'قيّمي جلستك': 'Rate your session',
  'تقييمك يساعد الكوفيرات الأخريات': 'Your review helps other clients',
  'إرسال التقييم': 'Submit Review',
  'شكراً على تقييمك!': 'Thank you for your review!',

  // === SALON CREATE/EDIT ===
  'اسم الصالون *': 'Salon Name *',
  'المدينة *': 'City *',
  'العنوان *': 'Address *',
  'رقم الهاتف': 'Phone Number',
  'وصف الصالون': 'Salon Description',
  'إنشاء الصالون': 'Create Salon',
  'تحديث الصالون': 'Update Salon',

  // === AVAILABILITY ===
  'متاح': 'Available',
  'غير متاح': 'Unavailable',
  'إجازة': 'Day Off',

  // === LANGUAGE TOGGLE ===
  'English': 'English',
  'عربي': 'عربي',

  // === NAVIGATION / COMMON BUTTONS ===
  '← رجوع': '← Back',
  'الخريطة': 'Map',
  'خريطة الصالونات': 'Salons Map',
  'اضغطي على موقع الصالون': 'Tap salon location on map',
  'فتح': 'Unblock',
  'صورة': 'Photo',
  'فيديو': 'Video',
  'غلاف ✓': 'Cover ✓',
  '+ رفع': '+ Upload',
  'إعادة المحاولة': 'Retry',

  // === HOME / SALONS ===
  'لا توجد صالونات تقدم هذه الخدمة حالياً': 'No salons offer this service right now',
  '✓ موثّق': '✓ Verified',
  '✨ جديد': '✨ New',
  '🔥 الأكثر حجزاً': '🔥 Most Booked',
  'خطأ في تحميل الصالونات': 'Failed to load salons',
  'يرجى السماح بالوصول للموقع': 'Please allow location access',
  'تأكدي إن خدمات الموقع مفعّلة بالإعدادات': 'Make sure location services are enabled in settings',
  'خطأ في تحميل مواقع الصالونات': 'Failed to load salon locations',
  'موقعك الحالي': 'Your Location',
  'عرض الصالون ←': 'View Salon ←',
  'خطأ في تحميل بيانات الصالون': 'Failed to load salon data',
  'فيديو الصالون': 'Salon Video',
  'لا يوجد أيام إجازة': 'No days off',
  'لا يوجد أيام إجازة — الصالون مفتوح كل الأيام': 'No days off — salon open every day',
  'هاتف': 'Phone',
  'أيام الإجازة': 'Days Off',
  'عن الصالون': 'About the Salon',

  // === AUTH ERRORS ===
  'أدخلي رقم الهاتف وكلمة المرور': 'Please enter your phone and password',
  'يرجى تعبئة الحقول المطلوبة': 'Please fill the required fields',
  'كلمة المرور يجب أن تكون 6 أحرف على الأقل': 'Password must be at least 6 characters',

  // === LOCATION PICKER ===
  'اضغطي على الخريطة لتحديد الموقع': 'Tap the map to set location',
  'خطأ في حفظ الموقع': 'Failed to save location',
  '📍 تحديد الموقع على الخريطة': '📍 Set Location on Map',

  // === REVIEWS ===
  'كوني أول من يقيّم!': 'Be the first to review!',
  '💬 رد الصالون': '💬 Salon Reply',
  'يجب تسجيل الدخول أولاً': 'You must sign in first',
  'اختاري عدد النجوم أولاً': 'Please select a star rating first',
  'خطأ: بيانات الصالون غير محملة': 'Error: salon data not loaded',
  '✅ شكراً على تقييمك!': '✅ Thank you for your review!',
  'اكتبي ردك على هذا التقييم...': 'Write your reply to this review...',
  'إرسال الرد': 'Send Reply',
  'زبونة': 'Client',

  // === SALON FORM (modal) ===
  'إضافة صالون': 'Add Salon',
  'إضافة صالون جديد': 'Add New Salon',
  'تعديل معلومات الصالون': 'Edit Salon Info',
  'أيقونة الصالون': 'Salon Icon',
  'صورة الصالون': 'Salon Photo',
  '📷 اختاري صورة': '📷 Choose Photo',
  'JPG أو PNG · حجم أقصى 5MB': 'JPG or PNG · Max 5MB',
  'الاسم والمدينة والعنوان مطلوبة': 'Name, city and address are required',
  'تم إنشاء الصالون': 'Salon created',
  'مثال: صالون فيلور': 'e.g. Velour Salon',
  'رام الله، نابلس...': 'Ramallah, Nablus...',
  'شارع...': 'Street...',
  'اكتبي وصفاً مختصراً...': 'Write a brief description...',

  // === CATEGORIES SECTION ===
  'أنا متخصصة في': 'My Specialties',
  'اختاري الخدمات التي تقدمينها — صالونك سيظهر عند البحث عنها': 'Select the services you offer — your salon will appear when clients search for them',
  '💇 شعر': '💇 Hair',
  '💄 مكياج': '💄 Makeup',
  '💅 أظافر': '💅 Nails',
  '🧖 عناية بالبشرة': '🧖 Skin Care',
  '👰 عرائس': '👰 Bridal',
  '💆 علاجات': '💆 Treatments',
  'تم حفظ التخصصات ✓': 'Specialties saved ✓',

  // === SALON MEDIA ===
  'حتى 4 صور + فيديو واحد • اضغطي على صورة لتعيينها غلافاً': 'Up to 4 photos + 1 video • Tap a photo to set it as cover',
  '⏳ جاري رفع الملف...': '⏳ Uploading file...',
  'تم رفع الملف': 'File uploaded',
  'فشل الرفع': 'Upload failed',
  'تم تعيين الغلاف': 'Cover photo set',
  'حذف هذه الصورة؟': 'Delete this photo?',

  // === SERVICES FORM ===
  'إضافة خدمة جديدة': 'Add New Service',
  'تعديل الخدمة': 'Edit Service',
  'يرجى تعبئة جميع الحقول': 'Please fill all fields',
  'تم تحديث الخدمة': 'Service updated',
  'تمت إضافة الخدمة': 'Service added',
  'هل تريدين حذف هذه الخدمة؟': 'Delete this service?',
  'تم حذف الخدمة': 'Service deleted',
  'وصف مختصر...': 'Brief description...',
  'صبغ الشعر': 'Hair Coloring',
  'قص': 'Haircut',
  'تصفيف': 'Styling',
  '🎨 صبغ الشعر': '🎨 Hair Coloring',
  '✂️ قص': '✂️ Haircut',
  '💇 شعر': '💇 Hair',
  '💆 علاجات': '💆 Treatments',
  '👑 تصفيف': '👑 Styling',

  // === STYLIST FORM ===
  'إضافة كوفيرة': 'Add Stylist',
  'اسم الكوفيرة': 'Stylist Name',
  'متخصصة في...': 'Specializes in...',
  'نبذة عنها': 'About Her',
  'سنوات الخبرة': 'Years of Experience',
  'الاسم والهاتف مطلوبان': 'Name and phone are required',
  'يجب إنشاء الصالون أولاً': 'You must create the salon first',
  'جاري الإضافة...': 'Adding...',
  'تمت إضافة الكوفيرة - كلمة مرورها الافتراضية: 123456': 'Stylist added — default password: 123456',
  'صاحبة صالون': 'Salon Owner',
  'كوفيرة': 'Stylist',

  // === TEAM / AVAILABILITY ===
  'فريق الكوفيرات': 'Stylist Team',
  'لا توجد كوفيرات بعد': 'No stylists yet',
  'لا توجد خدمات بعد': 'No services yet',
  '⚠️ لم تُضبط مواعيد الدوام بعد': '⚠️ Working hours not set yet',
  '⏰ ضبط مواعيد الدوام': '⏰ Set Working Hours',
  'أيام إجازة الصالون': 'Salon Days Off',
  'اختاري أيام إجازة الصالون — الكوفيرات لن تتمكن من الحجز في هذه الأيام': 'Select days off — clients cannot book on these days',
  'إجازة': 'Day Off',
  'دوام': 'Working',
  'تم حفظ أيام الإجازة': 'Days off saved',
  'مواعيد دوام الكوفيرة ⏰': 'Stylist Working Hours ⏰',
  'يمكنك تفعيل شيفتين لكل يوم (صباحي + مسائي)': 'You can enable two shifts per day (morning + evening)',
  '+ إضافة شيفت مسائي': '+ Add Evening Shift',
  '🌅 الصباحي': '🌅 Morning',
  '🌙 المسائي': '🌙 Evening',
  'تم حفظ مواعيد الدوام': 'Working hours saved',
  '⚠️ لم يتم تحديد الموقع بعد — اضغطي على "تحديد الموقع"': '⚠️ Location not set — tap "Set Location"',

  // === BOOKINGS (STYLIST) ===
  'تقييمات الزبونات': 'Client Reviews',
  '✅ مؤكدة': '✅ Confirmed',
  'مؤكد ✅': 'Confirmed ✅',
  'بانتظار الموافقة ⏳': 'Pending Approval ⏳',
  'ملغي ❌': 'Cancelled ❌',
  'مرفوض ❌': 'Rejected ❌',
  'مكتمل ✔️': 'Completed ✔️',
  'قبول الحجز': 'Accept Booking',
  'تم قبول الحجز وإشعار الزبونة': 'Booking accepted and client notified',
  'تم رفض الحجز': 'Booking rejected',
  'حدث خطأ': 'An error occurred',
  'خطأ في التحميل': 'Load error',

  // === MESSAGES ===
  'لا توجد رسائل': 'No messages',

  // === BLOCKED SLOTS ===
  'لا توجد أوقات محجوبة': 'No blocked slots',
  'اختاري الكوفيرة...': 'Select a stylist...',
  'اختاري الكوفيرة': 'Select stylist',
  'مثال: مشوار شخصي، راحة...': 'e.g. Personal errand, break...',
  'التاريخ والوقت مطلوبان': 'Date and time are required',
  'وقت البداية يجب أن يكون قبل وقت النهاية': 'Start time must be before end time',
  'تم حجب الوقت': 'Time blocked',
  'تم فتح الوقت': 'Time unblocked',

  // === OFFERS ===
  'لا توجد عروض نشطة': 'No active offers',
  'إرسال العرض 🎁': 'Send Offer 🎁',
  'الوصف (اختياري)': 'Description (Optional)',
  'تفاصيل إضافية...': 'Additional details...',
  'نسبة الخصم % (اختياري)': 'Discount % (Optional)',
  'صالح حتى (اختياري)': 'Valid Until (Optional)',
  'أدخلي عنوان العرض': 'Enter offer title',
  '✅ تم إرسال العرض وإشعار الزبونات!': '✅ Offer sent and clients notified!',
  'تم حذف العرض': 'Offer deleted',

  // === PROFILE (STYLIST) ===
  'تعديل المعلومات الشخصية': 'Edit Personal Info',
  'الاسم، رقم الهاتف': 'Name, phone number',
  'إشعارات الحجوزات والرسائل': 'Booking and message notifications',
  'الحجوزات والتقييمات': 'Bookings and ratings',
  '✏️ تعديل المعلومات': '✏️ Edit Info',
  'كلمة المرور الجديدة (اتركها فارغة إذا لا تريدين التغيير)': 'New password (leave blank to keep current)',
  'كلمة مرور جديدة...': 'New password...',
  'حفظ التغييرات': 'Save Changes',
  'تم حفظ التغييرات': 'Changes saved',
  'الاسم مطلوب': 'Name is required',
  'إجمالي الحجوزات': 'Total Bookings',
  'إجمالي الدخل': 'Total Revenue',
  'تعذر تحميل الإحصائيات': 'Failed to load statistics',
  'بانتظار': 'Pending',

  // === MISC DYNAMIC ===
  'قطعة': 'Piece',
  'اسمك': 'Your name',
  'جاري التحميل...': 'Loading...',
  'تم الحذف': 'Deleted',

  // === DYNAMIC STRINGS (app.js / stylist-dashboard.js) ===
  '✅ مؤكد': '✅ Confirmed',
  '⏳ بانتظار': '⏳ Pending',
  '❌ ملغي': '❌ Cancelled',
  '❌ مرفوض': '❌ Rejected',
  '✔️ مكتمل': '✔️ Completed',
  'جاري تحديد موقعك...': 'Getting your location...',
  'لا توجد خدمات': 'No services',
  'لا توجد كوفيرات': 'No stylists',
  'لا توجد كوفيرات متاحة': 'No stylists available',
  'لا توجد تقييمات بعد': 'No reviews yet',
  'لا توجد محادثات بعد': 'No conversations yet',
  'تواصلي مع كوفيرتك من صفحة الحجوزات': 'Contact your stylist from the Bookings page',
  'لا توجد إشعارات': 'No notifications',
  'لا توجد حجوزات قادمة': 'No upcoming bookings',
  'لا توجد حجوزات سابقة': 'No past bookings',
  'احجزي موعدك الأول الآن!': 'Book your first appointment now!',
  '⏳ بانتظار موافقة الكوفيرة - ستصلك إشعار فور التأكيد': '⏳ Waiting for stylist approval — you\'ll be notified soon',
  '❌ تم رفض الحجز - يمكنك اختيار وقت آخر': '❌ Booking rejected — you can choose another time',
  'تم إلغاء الحجز': 'Booking cancelled',
  'جاري الإرسال...': 'Sending...',
  '⏳ جاري الحجز...': '⏳ Booking...',
  'جاري تحميل...': 'Loading...',
  'فشل رفع الصورة': 'Image upload failed',
  '⚠️ فشل رفع الصورة': '⚠️ Image upload failed',
  '📤 جاري رفع الصورة...': '📤 Uploading image...',
  '🎤 جاري التسجيل...': '🎤 Recording...',
  '📤 جاري إرسال الرسالة الصوتية...': '📤 Sending voice message...',
  '⚠️ فشل إرسال الرسالة الصوتية': '⚠️ Voice message failed',
  'فشل الاتصال بالسيرفر': 'Server connection failed',
  'لا توجد وصفات محفوظة بعد': 'No saved formulas yet',
  '✅ تم حفظ موقع الصالون على الخريطة': '✅ Salon location saved',
  '✅ تم تحديد الموقع': '✅ Location set',
  'لا توجد صالونات بمواقع محددة بعد — أضيفي موقع صالونك من الداشبورد': 'No salons with locations yet — add your salon location from the dashboard',
  'لا توجد صالونات بمواقع محددة بعد': 'No salons with locations yet',
  'بانتظار موافقة الكوفيرة - ستصلك إشعار عند التأكيد': 'Waiting for stylist approval — you\'ll be notified when confirmed',
  'تقييم الجلسة': 'Rate Session',
  'إلغاء الحجز': 'Cancel Booking',
  'التواصل': 'Contact',
  'خدمة': 'service',
  'مع': 'with',
  'اليوم': 'Today',
  'غداً': 'Tomorrow',
  'تقييم': 'rating',
  'نقطة للذهبي': 'pts to Gold',
  'نقطة للبلاتيني': 'pts to Platinum',
  'تحميل المزيد': 'Load More',
  'لا يوجد نتائج': 'No results',
  'ابحثي...': 'Search...',
  'مواعيد متاحة': 'Available slots',
  'اختاري يوماً أولاً': 'Select a day first',
  'تعذر تحميل المواعيد': 'Could not load time slots',
  'لا توجد مواعيد متاحة في هذا اليوم': 'No available slots on this day',
  'لا توجد كوفيرات في هذا الصالون': 'No stylists in this salon',
  'قبل': 'Before',
  'بعد': 'After',
  'نتيجة': 'Result',
  'الصالون': 'Salon',
  'المدينة': 'City',
  'العنوان': 'Address',
  'ساعة': 'hr',
  'ساعات': 'hrs',
  'تقييمات': 'reviews',
  'خبرة سنة': '1 yr exp.',
  'تحديث': 'Update',
  'إضافة': 'Add',
  'حذف المنتج؟': 'Delete this product?',
  'مخزون منخفض ⚠️': 'Low Stock ⚠️',
  'آخر زيارة': 'Last visit',
  'الساعة': 'At',
  'مرة': 'times',

  // === REGISTRATION / AUTH ===
  'ما عندك حساب؟': "Don't have an account?",
  'سنذكّرك عند حلول موعد تجديد لون شعرك': "We'll remind you when it's time to refresh your hair color",

  // === STYLIST DASHBOARD STATIC ===
  'لم تُسجّلي صالونك بعد': "You haven't registered your salon yet",
  'أضيفي عرضاً وسيُرسل إشعار فوري لزبوناتك': 'Add an offer and your clients will be notified instantly',
  'الزبونات': 'Clients',
  'حجب وقت': 'Block Time',
  'السبب (اختياري)': 'Reason (optional)',
  'حجب الوقت 🔒': 'Block Time 🔒',

  // === SERVICE FORM ===
  'اسم الخدمة *': 'Service Name *',
  'التصنيف *': 'Category *',
  'السعر (₪) *': 'Price (₪) *',
  'المدة (دقيقة) *': 'Duration (min) *',
  'وصف الخدمة': 'Service Description',

  // === STYLIST / PERSON FORM ===
  'الاسم *': 'Name *',
  'رقم الهاتف *': 'Phone *',
  'سنوات الخبرة': 'Years of Experience',
  'التخصصات': 'Specialties',
  'نبذة': 'Bio',

  // === DEMO NAMES (placeholder text) ===
  'سارة': 'Sarah',
  'سارة أحمد': 'Sarah Ahmed',
  'صالون غلامورا': 'Glamora Salon',
  'رام الله': 'Ramallah',
  'مريم الكوفيرة': 'Mariam the Stylist',
  'مثال: بالياج': 'e.g. Balayage',

  // === AI BEAUTY ADVISOR (customer) ===
  'مستشارة الجمال AI': 'AI Beauty Advisor',
  'جوري ✨': 'Jouri ✨',
  'جوري 🌹 مستشارة جمالك': 'Jouri 🌹 Your Beauty Advisor',
  'جوري 🌹 مساعِدتك': 'Jouri 🌹 Your Assistant',
  'حللي صورتك واسألي عن أظافرك ومكياجك وشعرك وبشرتك': 'Analyze your photo & ask about your nails, makeup, hair & skin',
  'خبيرة تجميل • ذكاء اصطناعي': 'Beauty Expert • AI',
  '📎 صورة مرفقة': '📎 Photo attached',
  'اسألي عن أظافرك، مكياجك، شعرك، بشرتك...': 'Ask about your nails, makeup, hair, skin...',

  // === AI ADVISOR PRODUCTS (stylist) ===
  '🧴 منتجات المستشار AI': '🧴 AI Advisor Products',
  'منتجات المستشار AI': 'AI Advisor Products',
  '➕ إضافة منتج': '➕ Add Product',
  '➕ إضافة المنتج': '➕ Add Product',
  '📦 المنتجات الحالية': '📦 Current Products',
  '📷 اضغطي لإضافة صورة المنتج': '📷 Tap to add product photo',
  'المنتجات الي تضيفيها هون بيقترحها الذكاء الاصطناعي على الزبونات حسب حالتهن، بصورها وشرحها.': 'Products you add here are recommended by the AI to clients based on their needs — with photos and details.',
  '🧴 بشرة': '🧴 Skin',
  '💅 أظافر': '💅 Nails',
  '💄 مكياج': '💄 Makeup',
  '💇 شعر': '💇 Hair',
  'اسم المنتج *': 'Product name *',
  'الماركة (اختياري)': 'Brand (optional)',
  'مناسب لـ (افصلي بفاصلة): بشرة دهنية، تفتيح...': 'Suitable for (comma-separated): oily skin, brightening...',
  'وصف قصير للمنتج': 'Short product description',
  'طريقة الاستخدام': 'How to use',
  'السعر (₪) — اختياري': 'Price (₪) — optional',

  // === STYLIST AI ASSISTANT ===
  'مساعِدتك الذكية': 'Your Smart Assistant',
  'أعمال • تسويق • تقني • ردود': 'Business • Marketing • Technical • Replies',
  'اسأليني عن أرقامك، عرض، رد لزبونة، أو فورمولا...': 'Ask about your numbers, an offer, a client reply, or a formula...',

  // === STYLIST DASHBOARD (previously untranslated) ===
  '+ إضافة عرض': '+ Add Offer',
  '📊 إحصائياتي': '📊 My Analytics',
  '👥 قائمة الزبونات': '👥 Clients List',
  '📦 إضافة / تعديل منتج': '📦 Add / Edit Product',
};

// ---- Core translation function ----
window.t = function(key) {
  if (window.VELOUR_LANG === 'ar') return key;
  return TR[key] || key;
};

// ---- Switch language ----
window.setLang = function(lang) {
  if (lang === window.VELOUR_LANG) return;
  localStorage.setItem('velour_lang', lang);
  window.VELOUR_LANG = lang;
  if (lang === 'ar') {
    // Reload to restore original Arabic HTML
    location.reload();
    return;
  }
  document.documentElement.setAttribute('lang', 'en');
  document.documentElement.setAttribute('dir', 'ltr');
  applyTranslations();
  startObserver();
  updateLangToggle();
};

// ---- Apply translations to a DOM subtree ----
window.applyTranslations = function(root) {
  if (window.VELOUR_LANG === 'ar') return;
  const container = root || document.body;

  // Walk text nodes
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return NodeFilter.FILTER_REJECT;
      // Skip elements marked translate="no" (user-entered DB content)
      if (parent.closest('[translate="no"]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    const trimmed = node.textContent.trim();
    if (!trimmed) return;
    const en = TR[trimmed];
    if (en) node.textContent = node.textContent.replace(trimmed, en);
  });

  // Translate placeholder, title, alt attributes
  container.querySelectorAll('[placeholder]').forEach(el => {
    const en = TR[el.placeholder];
    if (en) el.placeholder = en;
  });
  container.querySelectorAll('[title]').forEach(el => {
    const en = TR[el.title];
    if (en) el.title = en;
  });
  container.querySelectorAll('[alt]').forEach(el => {
    const en = TR[el.alt];
    if (en) el.alt = en;
  });
};

// ---- Update language toggle button ----
function updateLangToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  if (!btn) return;
  btn.textContent = window.VELOUR_LANG === 'ar' ? 'EN' : 'ع';
}

// ---- MutationObserver: auto-translate dynamic content ----
let _translating = false;
function startObserver() {
  if (window.VELOUR_LANG !== 'en') return;
  const observer = new MutationObserver((mutations) => {
    if (_translating) return;
    _translating = true;
    requestAnimationFrame(() => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (!node.closest('[translate="no"]')) applyTranslations(node);
          } else if (node.nodeType === 3 && node.textContent.trim()) {
            if (!node.parentElement?.closest('[translate="no"]')) {
              const en = TR[node.textContent.trim()];
              if (en) node.textContent = node.textContent.replace(node.textContent.trim(), en);
            }
          }
        });
      });
      _translating = false;
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: false });
}

// ---- On page load: apply if English ----
document.addEventListener('DOMContentLoaded', () => {
  updateLangToggle();
  if (window.VELOUR_LANG === 'en') {
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('dir', 'ltr');
    applyTranslations();
    startObserver();
  }
});
