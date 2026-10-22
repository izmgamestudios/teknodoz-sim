import type { TaskKind } from '../tasks'

export type TaskText = { title: string; desc: string }

export const tr = {
  langName: 'Türkçe',
  nav: { dashboard: 'Panel', personas: 'Personalar', runs: 'Simülasyonlar', faq: 'SSS', admin: 'Admin', credits: 'Credits' },
  brand: { simulation: 'Simulation', beta: 'Beta · Erken Erişim' },
  sidebar: { menu: 'Menüyü aç', theme: 'Tema değiştir', dark: '☾ Dark', light: '☀ Light', version: 'v0.3.0 · Beta', language: 'Dil' },
  dashboard: {
    title: 'Panel',
    text: "Teknodoz Simulation'a hoş geldin. Ürünlerini ve hizmetlerini sanal kullanıcı personalarıyla test et.",
  },
  personas: { title: 'Personalar', text: 'Sanal kullanıcı personalarını keşfet ve seç.' },
  soon: 'Yakında — beta erken erişim kapsamında geliştiriliyor.',
  kinds: {
    survey: 'Anket', chat: 'Chatbot', web: 'Web', 'os-app': 'Uygulama', 'computer-use': 'Bilgisayar',
  } as Record<TaskKind, string>,
  sim: {
    title: 'Simülasyonlar',
    intro: 'Bir görev seç, ayarları belirle ve simülasyonu doğrudan buradan başlat.',
    all: 'Tümü', task: 'Görev', personas: 'Persona sayısı', seed: 'Seed', model: 'Model', mode: 'Mod',
    modeSmoke: 'Hızlı test (API key gerekmez)', modeAuto: 'Gerçek çalıştırma (API key gerekir)',
    dockerWarn: 'Bu görev Docker gerektirir.',
    start: 'Simülasyonu başlat', starting: 'Başlatılıyor…',
    loginTitle: 'Giriş gerekli', loginText: 'Simülasyon başlatmak için admin olarak giriş yapmalısın.', goLogin: 'Admin girişine git',
    history: 'Çalıştırma geçmişi', noRuns: 'Henüz çalıştırma yok.', cancel: 'İptal et', log: 'Çıktı', hideLog: 'Gizle',
    status: { queued: 'Sırada', running: 'Çalışıyor', done: 'Tamamlandı', failed: 'Başarısız', canceled: 'İptal edildi' },
    setupRun: 'Kurulum',
    errors: {
      busy: 'Şu an başka bir çalıştırma sürüyor.', invalid_task: 'Geçersiz görev.', invalid_sample_size: 'Persona sayısı 1–100 olmalı.',
      invalid_seed: 'Geçersiz seed.', invalid_model: 'Geçersiz model.', unauthorized: 'Oturum süresi doldu, tekrar giriş yap.',
      server_error: 'Sunucu hatası.',
    } as Record<string, string>,
  },
  admin: {
    title: 'Admin paneli', loginTitle: 'Admin girişi', email: 'E-posta', password: 'Şifre', login: 'Giriş yap', loggingIn: 'Giriş yapılıyor…',
    logout: 'Çıkış yap', signedInAs: 'Giriş yapan:',
    statusTitle: 'Sistem durumu', refresh: 'Yenile',
    uv: 'uv (Python yöneticisi)', docker: 'Docker', matraix: 'MatrAIx klasörü', venv: 'MatrAIx ortamı (.venv)',
    anthropicKey: 'ANTHROPIC_API_KEY', openaiKey: 'OPENAI_API_KEY', ok: 'Hazır', missing: 'Yok',
    setupTitle: 'MatrAIx kurulumu', setupText: 'MatrAIx eksikse buradan kurabilirsin (klonlama + Python ortamı).',
    setupBtn: 'MatrAIx kur / güncelle', setupNeedsUv: 'Önce sunucuya uv kurulmalı.',
    keyHint: 'API key değerleri güvenlik için panelden girilmez; sunucudaki .env dosyasına yazılır.',
    errors: {
      invalid_credentials: 'E-posta veya şifre hatalı.', too_many_attempts: 'Çok fazla deneme. 15 dakika sonra tekrar dene.',
      not_configured: 'Admin hesabı sunucuda henüz yapılandırılmamış (.env).', server_error: 'Sunucu hatası.',
    } as Record<string, string>,
  },
  faq: {
    title: 'Sık Sorulan Sorular',
    intro: 'Teknodoz Simulation hakkında merak edilenler.',
    items: [
      { q: 'Teknodoz Simulation nedir?', a: 'Ürün, hizmet ve arayüzlerini sanal kullanıcı personalarıyla test etmeni sağlayan bir platformdur. Altyapıda açık kaynak MatrAIx persona simülasyon motoru çalışır.' },
      { q: 'Persona nedir?', a: 'Yaş, meslek, değerler ve alışkanlıklar gibi özellikleri olan sanal bir kullanıcı profilidir. Yapay zekâ ajanları bu profillerle görevleri gerçek kullanıcı gibi tamamlamaya çalışır.' },
      { q: 'Sonuçlar gerçek kullanıcıların yerini tutar mı?', a: 'Hayır. Simülasyon; keşif, stres testi ve hipotez üretimi içindir. Önemli kararlar için gerçek kullanıcı verisiyle doğrulama yapmalısın.' },
      { q: 'Beta Erken Erişim ne demek?', a: 'Platform geliştirme aşamasında. Özellikler değişebilir ve hatalar olabilir. Geri bildirimlerin ürünü şekillendiriyor.' },
      { q: 'Ücret var mı, API key gerekir mi?', a: 'Hızlı test modu API key gerektirmez. Gerçek çalıştırmalar sunucuda tanımlı model API key’ini kullanır; kullanım maliyeti model sağlayıcısına ödenir.' },
      { q: 'Görevler neden İngilizce çalışıyor?', a: 'MatrAIx görev içerikleri (anket soruları, senaryolar) İngilizcedir. Arayüz, görev başlıkları ve açıklamaları ise seçtiğin dile çevrilir.' },
      { q: 'Erişim ve destek için kime ulaşırım?', a: 'Credits sayfasındaki e-posta, WhatsApp ve LinkedIn bağlantılarından ulaşabilirsin.' },
    ],
  },
  credits: {
    title: 'Credits',
    text: 'İzmir Game Studios tarafından geliştirilmektedir. Beta erken erişim sürecinde geri bildirimlerin için bize ulaş.',
    email: 'E-posta', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', infra: 'Simülasyon altyapısı:',
  },
  tasks: {
    'example-survey_product-feedback': { title: 'Ürün Geri Bildirim Anketi (FocusLoop)', desc: 'Personalar, aile koordinasyon uygulaması konsepti FocusLoop’un tanıtımını okur; fiyatlandırma, deneme isteği ve ev yaşamına uyumu hakkında anketi doldurur.' },
    'survey_annual-checkup-habits': { title: 'Yıllık Sağlık Kontrolü Alışkanlıkları Anketi', desc: 'Personalar, kendi demografik özellikleri ve değerlerine göre yıllık sağlık kontrolünü nasıl ve neden yaptırdıklarını (ya da yaptırmadıklarını) yanıtlar.' },
    'survey_price-sensitivity-hasbro-gaming-candy-land': { title: 'Fiyat Hassasiyeti: Candy Land Kingdom', desc: 'Fiyatı 12,99 $’dan 16,24 $’a çıkan bir oyuncak ilanına tepki verilir; fiyatın hangi noktada fazla gelmeye başladığı ölçülür.' },
    'chat_meal-planning-nutrition': { title: 'Yemek Planı Asistanı', desc: 'Personalar, hedefleri, bütçesi, mutfak tercihleri ve diyet kısıtlarına uygun çok günlük bir yemek planı için beslenme asistanıyla sohbet eder.' },
    'chat_openbb-corporate-action-honesty': { title: 'Hisse Fiyat Kontrolü (Dürüstlük Testi)', desc: 'Personalar, araştırma sohbetinden dört hissenin (HCP, ANSS, CMG, LAZR) güncel fiyatını ve yıllık değişimini sorar; asistanın birleşme gibi şirket olaylarını dürüstçe ele alıp almadığı test edilir.' },
    'example-chat-api_support_chatbot': { title: 'Destek Chatbotu (API)', desc: 'Personalar, geciken #4521 numaralı siparişi için Acme destek botuyla yazışır ve çözüm yolu sunulup sunulmadığını değerlendirir. Bot API üzerinden bağlanır.' },
    'example-chat-mcp_support_chatbot': { title: 'Destek Chatbotu (MCP)', desc: 'Aynı destek senaryosu; bu kez bot MCP protokolü üzerinden bağlanır. İki bağlantı yönteminin sonuçlarını karşılaştırmak için kullanılır.' },
    'web_mit-ocw-course-choice': { title: 'MIT OpenCourseWare Ders Seçimi', desc: 'Personalar canlı MIT OCW kataloğunda gezinir, en az üç ders sayfasını inceler, karşılaştırır ve sıradaki dersini seçer.' },
    'web_notion-plan-comparison': { title: 'Notion Plan Karşılaştırması', desc: 'Personalar, canlı Notion fiyat sayfasındaki dört standart planı karşılaştırır ve gerçekçi olarak seçeceği planı belirler.' },
    'example-web-browser-use_laptop-choice': { title: 'Laptop Kısa Listesi (Browser Use)', desc: 'Personalar bir mağazada gezinir, ciddiyetle düşüneceği bir laptop seçer ve ana nedenini (fiyat, kalite, güven vb.) belirtir.' },
    'example-web-cocoa_plan-choice': { title: 'Plan Tercihi (Cocoa)', desc: 'Personalar bir demo sitede kendilerine uyan abonelik planını seçer ve seçim nedenini kaydeder.' },
    'example-web-cua_bookshop-choice': { title: 'Kitapçı Seçimi (CUA)', desc: 'Personalar, bilgisayar kullanan bir ajanla çevrimiçi kitapçıda gezinir ve ciddiyetle düşüneceği bir kitap seçer.' },
    'example-web-playwright_quote-choice': { title: 'Kaydedilecek Alıntı (Playwright)', desc: 'Personalar, Playwright ile yönetilen bir tarayıcıda alıntı sitesini gezer ve kendilerine en çok hitap eden alıntıyı seçer.' },
    'os-app-ios_news-subscription-decision': { title: 'News+ Abonelik Kararı (iOS)', desc: 'Personalar iOS’taki News+ teklif ekranını (özellikler, kapaklar, fiyat) inceler ve abone olup olmayacaklarına karar verir.' },
    'os-app-macos_stocks-mu-sentiment': { title: 'Hisse Görüşü: Micron (macOS)', desc: 'Personalar macOS Stocks uygulamasında MU hissesini (fiyat grafikleri, bilanço bağlamı) inceler ve al/sat/tut görüşü oluşturur.' },
    'example-computer-use-ios_photo-access-review': { title: 'Fotoğraf Erişimi İncelemesi (iOS)', desc: 'Personalar iOS Gizlilik ayarlarını açar, fotoğraf kullanan bir uygulama seçer ve verecekleri en kısıtlı erişim düzeyine (tam, seçili fotoğraflar, hiçbiri) karar verir.' },
    'example-computer-use-linux_note-to-csv': { title: 'Notu CSV’ye Temizleme (Linux)', desc: 'Personalar kısa bir notu item, quantity, priority sütunlu bir CSV dosyasına dönüştürür ve yapı tercihini açıklar.' },
    'example-computer-use-macos_calendar-reminder-handoff': { title: 'Takvim + Hatırlatıcı Devri (macOS)', desc: 'Personalar bir Takvim etkinliği (diş hekimi kontrolü) ve bir Hatırlatıcı (sigorta kartını getir) oluşturur, özet bir devir dosyası kaydeder.' },
  } as Record<string, TaskText>,
}

export type Dict = typeof tr
