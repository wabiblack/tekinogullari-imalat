# Tekinoğulları Yönetim (Android)

Bu Android uygulaması tek bir işletme telefonunda çalıştırılmak üzere hazırlanmıştır. Yönetim panelini `https://tekinogullari-imalat.vercel.app/admin/` adresinden WebView'da açar. Teklif, müşteri değerlendirmeleri, WhatsApp ve mali yönetim aynı canlı Supabase sistemini kullanır.

- Play Store veya yeni bir Supabase projesi gerekmez.
- Başlatıcı simgesi, projedeki `assets/to-icon.svg` logonun **aynı çizgileri ve renkleri** korunarak Android vektör formatında kullanılmış hâlidir. Mevcut web logosu değiştirilmemiştir.
- Uygulama internet bağlantısı gerektirir.
- WhatsApp bağlantıları cihazın WhatsApp/WhatsApp Business uygulamasında açılır.
- Giriş ekranı mevcut yetkili e-posta ve şifrenizle çalışır; parola APK içine konmaz.
- Google Play Store'a dağıtım yapılmadığından test için oluşturulan `app-debug.apk` telefona doğrudan kurulabilir.
- Debug APK'nın imzası her GitHub Actions çalıştırmasında değişebilir. İleride yeni APK kurarken önceki sürümü kaldırmak gerekebilir, ancak teklif/mali veriler Supabase'de kalır.

## APK üretimi

GitHub Actions `Tekinoğulları Android APK` iş akışında üretilen `tekinogullari-yonetim-apk` dosyasını indirin, ZIP'i açın ve içindeki `app-debug.apk` dosyasını Android telefonda çalıştırın. Bilinmeyen uygulama yükleme izni gerekebilir. Android 7.0 veya üzeri gereklidir.
