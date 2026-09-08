// =========================================
// REPOSITORIO: web (PRINCIPAL)
// ARCHIVO: script.js
// =========================================

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSpVWFPsuWkDT5wtr5mM8H0JFC8d0ePBCKJxcXDyyfX7M5FOZ1UXUqRrPiOaLeq_tYt9n9-a1iabKPR/pub?output=csv';
// NUEVO: endpoint en vivo (Código.gs, ?accion=csv) para la carga por etapas/idioma — a
// diferencia de CSV_URL (publicar en la web, cacheado por Google varios minutos), este
// se puede pedir con &idiomas=xx para traer solo las columnas que hacen falta, y siempre
// devuelve el contenido real de la hoja. CSV_URL se mantiene como último recurso si este
// endpoint fallara (p.ej. problema de CORS puntual).
const LIVE_CSV_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxzwOUB9Bb7HbngjGuvqhDPF0JCQsuOfwnqZNsUBzS6TDTrJjuC3ZTTe0N0sZElu1jXrg/exec';
// NUEVO: idiomas que se precargan en segundo plano justo después del primer render (además
// del idioma del cliente, que siempre va primero). El resto de los 26 solo se piden bajo
// demanda, cuando alguien los elige en el selector "Más...".
const ESSENTIAL_LANGS = ['ES', 'EN', 'DE', 'FR', 'IT'];
// NUEVO: idiomas que se leen de derecha a izquierda. El árabe (y cualquier idioma RTL que se
// añada en el futuro, p.ej. hebreo) necesita que toda la fila del plato se refleje (precio a
// la izquierda, nombre/descripción pegados al margen derecho) en vez de quedar con
// justificación izquierda como el resto de idiomas — ver updateLanguageUI().
const RTL_LANGS = ['AR'];
// NUEVO: Se registra la URL actualizada del App Script para las peticiones de sincronización del sistema
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzwOUB9Bb7HbngjGuvqhDPF0JCQsuOfwnqZNsUBzS6TDTrJjuC3ZTTe0N0sZElu1jXrg/exec';
const APP_VERSION = 'v1.9.0-clubhouse';
// NUEVO (26 agosto, caché local + delta por hash): clave de localStorage donde se guarda la
// última copia conocida de allData (más un sello de versión de la app) para poder pintar la
// web al instante en visitas recurrentes, sin esperar a ningún fetch. Ver leerCacheLocal /
// guardarCacheLocal / sincronizarConCache. Lleva "V1" a propósito: si el formato de los datos
// cambia en el futuro de forma incompatible, basta con subir a "V2" para que las cachés viejas
// se ignoren solas (leerCacheLocal ya compara appVersion, pero esto cubre además cambios de
// forma dentro de la misma versión visible de la app).
const MENU_CACHE_KEY = 'rgMenuCacheV1';
// NUEVO: sello de caché para la imagen fija del vino "El Tenista" (imagenes/vinos/tenista_pegado.webp).
// Se calcula una vez al cargar la página y se añade como ?v= a la URL de la imagen en los dos
// sitios donde se usa, para que el navegador no siga sirviendo una copia cacheada antigua tras
// reemplazar el archivo en GitHub (esta imagen se inserta dinámicamente por JS, y un Ctrl+F5 no
// siempre invalida el caché de imágenes insertadas así).
const TENISTA_IMG_CACHE_BUST = Date.now();

// MODIFICADO: Agregado Coreano (KO) con su respectivo emoji compatible
const IDIOMAS = {
    ES: "🇪🇸 Español", EN: "🇬🇧 English", DE: "🇩🇪 Deutsch", FR: "🇫🇷 Français", IT: "🇮🇹 Italiano",
    RU: "🇷🇺 Русский", NL: "🇳🇱 Nederlands", PL: "🇵🇱 Polski", SV: "🇸🇪 Svenska", NO: "🇳🇴 Norsk",
    DA: "🇩🇰 Dansk", FI: "🇫🇮 Suomi", PT: "🇵🇹 Português", RO: "🇷🇴 Română", HU: "🇭🇺 Magyar",
    CS: "🇨🇿 Čeština", EL: "🇬🇷 Ελληνικά", TR: "🇹🇷 Türkçe", AR: "🇦🇪 العربية", ZH: "🇨🇳 中文", JA: "🇯🇵 日本語",
    KO: "🇰🇷 한국어",     
    CA: "🏰 Català",     
    EU: "🌳 Euskara",    
    GL: "🐙 Galego",     
    VA: "🥘 Valencià"    
};

const MENU_TEXTS = {
    ES: "Menú", EN: "Menu", DE: "Menü", FR: "Menu", IT: "Menu",
    RU: "Меню", NL: "Menu", PL: "Menu", SV: "Meny", NO: "Meny",
    DA: "Menu", FI: "Menu", PT: "Menu", RO: "Meniu", HU: "Menü",
    CS: "Menu", EL: "Μενού", TR: "Menü", AR: "قائمة", ZH: "菜单", JA: "メニュー",
    KO: "메뉴", CA: "Menú", EU: "Menu", GL: "Menú", VA: "Menú"
};

// NUEVO (26 agosto): texto "Cargando..." traducido, para el indicador visual que aparece al
// pulsar un idioma que todavía no está descargado (ver changeLanguage). Se muestra en el
// idioma que se está PIDIENDO, no en el idioma actual — así alguien que pulsa "DE" ve
// "Wird geladen...", no "Cargando...".
const LOADING_TEXTS = {
    ES: "Cargando...", EN: "Loading...", DE: "Wird geladen...", FR: "Chargement...", IT: "Caricamento...",
    RU: "Загрузка...", NL: "Laden...", PL: "Ładowanie...", SV: "Laddar...", NO: "Laster...",
    DA: "Indlæser...", FI: "Ladataan...", PT: "A carregar...", RO: "Se încarcă...", HU: "Betöltés...",
    CS: "Načítání...", EL: "Φόρτωση...", TR: "Yükleniyor...", AR: "جارٍ التحميل...", ZH: "加载中...", JA: "読み込み中...",
    KO: "로딩 중...", CA: "Carregant...", EU: "Kargatzen...", GL: "Cargando...", VA: "Carregant..."
};

let allData = [];

// NUEVO: además de pestañas completas, la hoja "Categorias" del backend también puede traer
// dos interruptores GLOBALES para toda la web (no por sección): id "fotos" (icono 📸 de
// galería, incluida la miniatura fija del vino "El Tenista") e id "info" (icono ℹ️ de
// descripción/preguntas). Se leen y guardan con el mismo mecanismo que las pestañas
// (fetchCategoriasDeshabilitadas), solo que generateItemHtml() los consulta directamente por
// su id fijo en vez de por pestanaId.
let idsGlobalesDesactivados = new Set();
let currentLang = 'ES', currentCat = 'sugerencias';
let currentGalleryPath = '', currentPhotoIndex = 1, maxPhotosFound = 1;
let verifiedImages = {}; 
let preloadQueue = [];
let isPreloading = false;
let currentPreloadSession = 0;

// REESCRITO para Club House: la lista de categorías/pestañas de la web pública y el rango de
// IDs de plato que cae dentro de cada una. A diferencia de RG (donde el ID de categoría era un
// simple prefijo del ID de plato, p.ej. categoría "1" = platos "1xxx"), en Club House varias
// categorías pequeñas conviven dentro del mismo rango de miles (p.ej. Tostadas e Ingredientes
// extra tostadas están las dos en 1xxx), así que cada categoría lleva su(s) rango(s) explícito(s)
// de ID en vez de deducirse por prefijo — ver CATEGORY_RANGES e isItemInCategory() más abajo.
// NUEVO: "let" en vez de "const" — init() reasigna esta lista tras filtrar las pestañas que el
// Web Editor Pro haya desactivado (ver fetchCategoriasDeshabilitadas()).
let categoriesList = [
    {
        id: 'sugerencias',
        ES: 'Sugerencias', EN: "Chef's Suggestions", DE: 'Empfehlungen des Chefs', FR: 'Suggestions du Chef', IT: 'Suggerimenti dello Chef',
        RU: 'Рекомендации шеф-повара', NL: 'Aanbevelingen van de Chef', PL: 'Sugestie Szefa Kuchni', SV: 'Kockens Förslag', NO: 'Kokkens Forslag',
        DA: 'Kokkens Forslag', FI: 'Kokin Suositukset', PT: 'Sugestões do Chef', RO: 'Recomandările Bucătarului-Șef', HU: 'A Séf Ajánlata',
        CS: 'Doporučení Šéfkuchaře', EL: 'Προτάσεις του Σεφ', TR: 'Şefin Önerileri', AR: 'اقتراحات الشيف', ZH: '主厨推荐', JA: 'シェフのおすすめ',
        KO: '셰프의 추천', CA: 'Suggeriments del Xef', EU: 'Sukaldariaren Gomendioak', GL: 'Suxestións do Chef', VA: 'Suggeriments del Xef'
    },
    {
        id: 'tostadas',
        ES: 'Tostadas', EN: 'Toasts', DE: 'Toasts', FR: 'Toasts', IT: 'Toast',
        RU: 'Тосты', NL: 'Toosties', PL: 'Tosty', SV: 'Rostat Bröd', NO: 'Ristet Brød',
        DA: 'Ristet Brød', FI: 'Paahtoleivät', PT: 'Torradas', RO: 'Toasturi', HU: 'Pirítósok',
        CS: 'Toasty', EL: 'Τοστ', TR: 'Tostlar', AR: 'التوست', ZH: '吐司', JA: 'トースト',
        KO: '토스트', CA: 'Torrades', EU: 'Ogi Txigortuak', GL: 'Torradas', VA: 'Torrades'
    },
    {
        id: 'creps',
        ES: 'Creps', EN: 'Crêpes', DE: 'Crêpes', FR: 'Crêpes', IT: 'Crêpe',
        RU: 'Блины', NL: 'Crêpes', PL: 'Naleśniki', SV: 'Crêpes', NO: 'Crêpes',
        DA: 'Crêpes', FI: 'Crêpet', PT: 'Crepes', RO: 'Clătite', HU: 'Palacsinta',
        CS: 'Palačinky', EL: 'Κρέπες', TR: 'Krep', AR: 'كريب', ZH: '可丽饼', JA: 'クレープ',
        KO: '크레페', CA: 'Crêpes', EU: 'Krepeak', GL: 'Crepes', VA: 'Crêpes'
    },
    {
        id: 'bocadillos',
        ES: 'Bocadillos', EN: 'Baguette Sandwiches', DE: 'Baguette-Sandwiches', FR: 'Sandwichs Baguette', IT: 'Panini Baguette',
        RU: 'Багеты-сэндвичи', NL: 'Baguette Sandwiches', PL: 'Kanapki Bagietkowe', SV: 'Baguettesmörgåsar', NO: 'Baguettesmørbrød',
        DA: 'Baguettesandwich', FI: 'Patonkivoileivät', PT: 'Sanduíches de Baguete', RO: 'Sandvișuri Baghetă', HU: 'Bagett Szendvicsek',
        CS: 'Bagetové Sendviče', EL: 'Σάντουιτς Μπαγκέτα', TR: 'Baget Sandviçler', AR: 'سندويشات الباغيت', ZH: '法棍三明治', JA: 'バゲットサンド',
        KO: '바게트 샌드위치', CA: 'Entrepans de Baguet', EU: 'Baguette Ogitartekoak', GL: 'Bocadillos de Baguete', VA: 'Entrepans de Baguet'
    },
    {
        id: 'sandwich',
        ES: 'Sandwich', EN: 'Sandwiches', DE: 'Sandwiches', FR: 'Sandwichs', IT: 'Sandwich',
        RU: 'Сэндвичи', NL: 'Sandwiches', PL: 'Kanapki', SV: 'Smörgåsar', NO: 'Smørbrød',
        DA: 'Sandwich', FI: 'Voileivät', PT: 'Sandes', RO: 'Sandvișuri', HU: 'Szendvicsek',
        CS: 'Sendviče', EL: 'Σάντουιτς', TR: 'Sandviçler', AR: 'السندويتشات', ZH: '三明治', JA: 'サンドイッチ',
        KO: '샌드위치', CA: 'Sandvitxos', EU: 'Ogitartekoak', GL: 'Sandwiches', VA: 'Sandvitxos'
    },
    {
        // MODIFICADO (8 septiembre): pestaña renombrada de "Entrantes" a "Para Picar" a
        // petición del usuario. Solo se cambia ES por ahora -- el usuario decidirá más
        // adelante cómo aplicar esto en el resto de idiomas (EN/DE/FR/IT se dejan igual
        // que antes hasta que lo indique).
        id: 'entrantes',
        ES: 'Para Picar', EN: 'Starters', DE: 'Vorspeisen', FR: 'Entrées', IT: 'Antipasti',
        RU: 'Закуски', NL: 'Voorgerechten', PL: 'Przystawki', SV: 'Förrätter', NO: 'Forretter',
        DA: 'Forretter', FI: 'Alkuruoat', PT: 'Entradas', RO: 'Aperitive', HU: 'Előételek',
        CS: 'Předkrmy', EL: 'Ορεκτικά', TR: 'Başlangıçlar', AR: 'المقبلات', ZH: '前菜', JA: '前菜',
        KO: '애피타이저', CA: 'Entrants', EU: 'Hastekoak', GL: 'Entrantes', VA: 'Entrants'
    },
    {
        id: 'pizzas',
        ES: 'Pizzas', EN: 'Pizzas', DE: 'Pizzen', FR: 'Pizzas', IT: 'Pizze',
        RU: 'Пицца', NL: "Pizza's", PL: 'Pizze', SV: 'Pizzor', NO: 'Pizzaer',
        DA: 'Pizzaer', FI: 'Pizzat', PT: 'Pizzas', RO: 'Pizza', HU: 'Pizzák',
        CS: 'Pizzy', EL: 'Πίτσες', TR: 'Pizzalar', AR: 'البيتزا', ZH: '披萨', JA: 'ピザ',
        KO: '피자', CA: 'Pizzes', EU: 'Pizzak', GL: 'Pizzas', VA: 'Pizzes'
    },
    {
        id: 'ensaladas',
        ES: 'Ensaladas', EN: 'Salads', DE: 'Salate', FR: 'Salades', IT: 'Insalate',
        RU: 'Салаты', NL: 'Salades', PL: 'Sałatki', SV: 'Sallader', NO: 'Salater',
        DA: 'Salater', FI: 'Salaatit', PT: 'Saladas', RO: 'Salate', HU: 'Saláták',
        CS: 'Saláty', EL: 'Σαλάτες', TR: 'Salatalar', AR: 'السلطات', ZH: '沙拉', JA: 'サラダ',
        KO: '샐러드', CA: 'Amanides', EU: 'Entsaladak', GL: 'Ensaladas', VA: 'Amanides'
    },
    {
        id: 'hamburguesas',
        ES: 'Hamburguesas', EN: 'Burgers', DE: 'Burger', FR: 'Burgers', IT: 'Hamburger',
        RU: 'Бургеры', NL: 'Burgers', PL: 'Burgery', SV: 'Hamburgare', NO: 'Burgere',
        DA: 'Burgere', FI: 'Hampurilaiset', PT: 'Hambúrgueres', RO: 'Burgeri', HU: 'Hamburgerek',
        CS: 'Hamburgery', EL: 'Μπέργκερ', TR: 'Burgerler', AR: 'البرغر', ZH: '汉堡', JA: 'ハンバーガー',
        KO: '버거', CA: 'Hamburgueses', EU: 'Hanburgesak', GL: 'Hamburguesas', VA: 'Hamburgueses'
    },
    {
        id: 'principales',
        ES: 'Platos Principales', EN: 'Main Courses', DE: 'Hauptgerichte', FR: 'Plats Principaux', IT: 'Piatti Principali',
        RU: 'Основные блюда', NL: 'Hoofdgerechten', PL: 'Dania Główne', SV: 'Huvudrätter', NO: 'Hovedretter',
        DA: 'Hovedretter', FI: 'Pääruoat', PT: 'Pratos Principais', RO: 'Feluri Principale', HU: 'Főételek',
        CS: 'Hlavní Jídla', EL: 'Κυρίως Πιάτα', TR: 'Ana Yemekler', AR: 'الأطباق الرئيسية', ZH: '主菜', JA: 'メインディッシュ',
        KO: '메인 요리', CA: 'Plats Principals', EU: 'Plater Nagusiak', GL: 'Pratos Principais', VA: 'Plats Principals'
    },
    {
        id: 'ninos',
        ES: 'Niños', EN: 'Kids', DE: 'Kinder', FR: 'Enfants', IT: 'Bambini',
        RU: 'Детское меню', NL: 'Kinderen', PL: 'Dla Dzieci', SV: 'Barn', NO: 'Barn',
        DA: 'Børn', FI: 'Lapset', PT: 'Crianças', RO: 'Copii', HU: 'Gyerekeknek',
        CS: 'Pro Děti', EL: 'Παιδικά', TR: 'Çocuklar', AR: 'الأطفال', ZH: '儿童餐', JA: 'キッズメニュー',
        KO: '어린이 메뉴', CA: 'Nens', EU: 'Umeak', GL: 'Nenos', VA: 'Xiquets'
    },
    {
        id: 'postres',
        ES: 'Postres', EN: 'Desserts', DE: 'Desserts', FR: 'Desserts', IT: 'Dolci',
        RU: 'Десерты', NL: 'Desserts', PL: 'Desery', SV: 'Efterrätter', NO: 'Desserter',
        DA: 'Desserter', FI: 'Jälkiruoat', PT: 'Sobremesas', RO: 'Deserturi', HU: 'Desszertek',
        CS: 'Dezerty', EL: 'Επιδόρπια', TR: 'Tatlılar', AR: 'الحلويات', ZH: '甜点', JA: 'デザート',
        KO: '디저트', CA: 'Postres', EU: 'Postreak', GL: 'Sobremesas', VA: 'Postres'
    },
    {
        id: 'cafes',
        ES: 'Cafés e Infusiones', EN: 'Coffees & Teas', DE: 'Kaffee & Tee', FR: 'Cafés & Infusions', IT: 'Caffè e Tisane',
        RU: 'Кофе и чай', NL: 'Koffie & Thee', PL: 'Kawa i Herbaty', SV: 'Kaffe & Te', NO: 'Kaffe & Te',
        DA: 'Kaffe & Te', FI: 'Kahvit & Teet', PT: 'Cafés e Infusões', RO: 'Cafele și Ceaiuri', HU: 'Kávék és Teák',
        CS: 'Káva a Čaje', EL: 'Καφέδες & Ροφήματα', TR: 'Kahveler ve Çaylar', AR: 'القهوة والشاي', ZH: '咖啡与茶', JA: 'コーヒーとお茶',
        KO: '커피 & 차', CA: 'Cafès i Infusions', EU: 'Kafeak eta Infusioak', GL: 'Cafés e Infusións', VA: 'Cafès i Infusions'
    },
    {
        id: 'bebidas',
        ES: 'Bebidas', EN: 'Drinks', DE: 'Getränke', FR: 'Boissons', IT: 'Bibite',
        RU: 'Напитки', NL: 'Dranken', PL: 'Napoje', SV: 'Drycker', NO: 'Drikke',
        DA: 'Drikkevarer', FI: 'Juomat', PT: 'Bebidas', RO: 'Băuturi', HU: 'Italok',
        CS: 'Nápoje', EL: 'Ποτά', TR: 'İçecekler', AR: 'المشروبات', ZH: '饮料', JA: 'ドリンク',
        KO: '음료', CA: 'Begudes', EU: 'Edariak', GL: 'Bebidas', VA: 'Begudes'
    },
    {
        // NUEVO (8 septiembre): pestaña nueva insertada entre "Bebidas" y "Cervezas" a petición
        // del usuario. Con 2 subcategorías propias (ver SUBCATEGORIAS_RANGES): "Zumos Saludables"
        // y "Botellas Saludables".
        id: 'bebidas_saludables',
        ES: 'Bebidas Saludables', EN: 'Healthy Drinks', DE: 'Gesunde Getränke', FR: 'Boissons Saines', IT: 'Bevande Salutari',
        RU: 'Полезные напитки', NL: 'Gezonde Dranken', PL: 'Zdrowe Napoje', SV: 'Hälsosamma Drycker', NO: 'Sunne Drikker',
        DA: 'Sunde Drikke', FI: 'Terveelliset Juomat', PT: 'Bebidas Saudáveis', RO: 'Băuturi Sănătoase', HU: 'Egészséges Italok',
        CS: 'Zdravé Nápoje', EL: 'Υγιεινά Ποτά', TR: 'Sağlıklı İçecekler', AR: 'المشروبات الصحية', ZH: '健康饮品', JA: 'ヘルシードリンク',
        KO: '건강 음료', CA: 'Begudes Saludables', EU: 'Edari Osasungarriak', GL: 'Bebidas Saudables', VA: 'Begudes Saludables'
    },
    {
        id: 'cervezas',
        ES: 'Cervezas', EN: 'Beers', DE: 'Biere', FR: 'Bières', IT: 'Birre',
        RU: 'Пиво', NL: 'Bieren', PL: 'Piwa', SV: 'Öl', NO: 'Øl',
        DA: 'Øl', FI: 'Oluet', PT: 'Cervejas', RO: 'Beri', HU: 'Sörök',
        CS: 'Piva', EL: 'Μπύρες', TR: 'Biralar', AR: 'البيرة', ZH: '啤酒', JA: 'ビール',
        KO: '맥주', CA: 'Cerveses', EU: 'Garagardoak', GL: 'Cervexas', VA: 'Cerveses'
    },
    {
        // NUEVO (8 septiembre): pestaña nueva insertada entre "Cervezas" y "Vinos Blancos" a
        // petición del usuario. Con 2 subcategorías propias (ver SUBCATEGORIAS_RANGES):
        // "Aperitivos" y "Copas de vino y sangría".
        id: 'aperitivos',
        ES: 'Aperitivos', EN: 'Aperitifs', DE: 'Aperitifs', FR: 'Apéritifs', IT: 'Aperitivi',
        RU: 'Аперитивы', NL: 'Aperitieven', PL: 'Aperitify', SV: 'Aperitifer', NO: 'Aperitiffer',
        DA: 'Aperitiffer', FI: 'Aperitiivit', PT: 'Aperitivos', RO: 'Aperitive', HU: 'Aperitifek',
        CS: 'Aperitivy', EL: 'Απεριτίφ', TR: 'Aperitifler', AR: 'المقبلات الفاتحة للشهية', ZH: '开胃酒', JA: 'アペリティフ',
        KO: '아페리티프', CA: 'Aperitius', EU: 'Aperitiboak', GL: 'Aperitivos', VA: 'Aperitius'
    },
    {
        id: 'vinos_blancos',
        ES: 'Vinos Blancos', EN: 'White Wines', DE: 'Weissweine', FR: 'Vins Blancs', IT: 'Vini Bianchi',
        RU: 'Белые вина', NL: 'Witte Wijnen', PL: 'Białe Wina', SV: 'Vita Viner', NO: 'Hvite Viner',
        DA: 'Hvidvine', FI: 'Valkoviinit', PT: 'Vinhos Brancos', RO: 'Vinuri Albe', HU: 'Fehérborok',
        CS: 'Bílá Vína', EL: 'Λευκά Κρασιά', TR: 'Beyaz Şaraplar', AR: 'النبيذ الأبيض', ZH: '白葡萄酒', JA: '白ワイン',
        KO: '화이트 와인', CA: 'Vins Blancs', EU: 'Ardo Zuriak', GL: 'Viños Brancos', VA: 'Vins Blancs'
    },
    {
        id: 'vinos_rosados',
        ES: 'Vinos Rosados', EN: 'Rosé Wines', DE: 'Roséweine', FR: 'Vins Rosés', IT: 'Vini Rosati',
        RU: 'Розовые вина', NL: 'Rosé Wijnen', PL: 'Wina Różowe', SV: 'Roséviner', NO: 'Roséviner',
        DA: 'Rosévine', FI: 'Roseeviinit', PT: 'Vinhos Rosés', RO: 'Vinuri Roze', HU: 'Rozé Borok',
        CS: 'Růžová Vína', EL: 'Ροζέ Κρασιά', TR: 'Roze Şaraplar', AR: 'النبيذ الوردي', ZH: '桃红葡萄酒', JA: 'ロゼワイン',
        KO: '로제 와인', CA: 'Vins Rosats', EU: 'Ardo Arrosak', GL: 'Viños Rosados', VA: 'Vins Rosats'
    },
    {
        id: 'vinos_tintos',
        ES: 'Vinos Tintos', EN: 'Red Wines', DE: 'Rotweine', FR: 'Vins Rouges', IT: 'Vini Rossi',
        RU: 'Красные вина', NL: 'Rode Wijnen', PL: 'Czerwone Wina', SV: 'Röda Viner', NO: 'Røde Viner',
        DA: 'Rødvine', FI: 'Punaviinit', PT: 'Vinhos Tintos', RO: 'Vinuri Roșii', HU: 'Vörösborok',
        CS: 'Červená Vína', EL: 'Κόκκινα Κρασιά', TR: 'Kırmızı Şaraplar', AR: 'النبيذ الأحمر', ZH: '红葡萄酒', JA: '赤ワイン',
        KO: '레드 와인', CA: 'Vins Negres', EU: 'Ardo Beltzak', GL: 'Viños Tintos', VA: 'Vins Negres'
    },
    {
        id: 'cavas',
        ES: 'Cavas & Champagne', EN: 'Cava & Champagne', DE: 'Cava & Champagne', FR: 'Cava & Champagne', IT: 'Cava & Champagne',
        RU: 'Кава и шампанское', NL: 'Cava & Champagne', PL: 'Cava i Szampan', SV: 'Cava & Champagne', NO: 'Cava og Champagne',
        DA: 'Cava & Champagne', FI: 'Cava & Samppanja', PT: 'Cavas e Champanhe', RO: 'Cava și Șampanie', HU: 'Cava és Pezsgő',
        CS: 'Cava a Šampaňské', EL: 'Cava & Σαμπάνια', TR: 'Kava ve Şampanya', AR: 'الكافا والشمبانيا', ZH: '卡瓦与香槟', JA: 'カヴァ&シャンパン',
        KO: '카바 & 샴페인', CA: 'Caves i Xampany', EU: 'Cava eta Xanpaina', GL: 'Cavas e Champán', VA: 'Caves i Xampany'
    },
    {
        // NUEVO (8 septiembre): última pestaña, al final de todas. A diferencia del resto, no
        // tiene platos (no hay rango de IDs asociado a propósito, no hace falta añadirla a
        // CATEGORY_RANGES/SUBCATEGORIAS_RANGES): es una página fija de contenido informativo
        // (leyenda de iconos de alérgenos + aviso), ver renderMenu().
        id: 'alergenos',
        ES: 'Alérgenos e Intolerancias', EN: 'Allergens & Intolerances', DE: 'Allergene & Unverträglichkeiten', FR: 'Allergènes & Intolérances', IT: 'Allergeni e Intolleranze',
        RU: 'Аллергены и непереносимость', NL: 'Allergenen & Intoleranties', PL: 'Alergeny i Nietolerancje', SV: 'Allergener & Intoleranser', NO: 'Allergener & Intoleranser',
        DA: 'Allergener & Intolerancer', FI: 'Allergeenit & Intoleranssit', PT: 'Alergénios e Intolerâncias', RO: 'Alergeni și Intoleranțe', HU: 'Allergének és Intoleranciák',
        CS: 'Alergeny a Intolerance', EL: 'Αλλεργιογόνα & Δυσανεξίες', TR: 'Alerjenler ve İntoleranslar', AR: 'مسببات الحساسية وعدم التحمل', ZH: '过敏原与不耐受', JA: 'アレルゲンと不耐性',
        KO: '알레르기 유발물질 및 불내증', CA: 'Al·lèrgens i Intoleràncies', EU: 'Alergenoak eta Intolerantziak', GL: 'Alérxenos e Intolerancias', VA: 'Al·lèrgens i Intoleràncies'
    }
];
// MODIFICADO (8 septiembre): el usuario pidió completar los 26 idiomas en todas las pestañas
// (antes solo se habían rellenado ES/EN/DE/FR/IT, los 5 "ESSENTIAL_LANGS", y el resto caía en
// EN/ES por el fallback de renderCategories()/renderMenu() -- c[currentLang] || c['EN'] || c['ES']).
// Ese fallback se mantiene tal cual por seguridad (por si en el futuro se añade una pestaña
// nueva sin completar los 26 de inmediato), pero ya no debería activarse en el uso normal.

// NUEVO (Club House): rangos de ID de plato que pertenecen a cada pestaña — varias filas de la
// tabla que dio el usuario para esta carta (ver conversación) caen dentro de la misma pestaña:
// los "ingredientes extra" de tostadas/bocadillos/ensaladas se muestran DENTRO de su categoría
// (no como pestaña propia), y Carne + Pescado + Guarnición extra se unen en "Platos Principales".
const CATEGORY_RANGES = {
    sugerencias:    [[12001, 12999]], // más adelante se añadirán subcategorías internas (pendiente)
    tostadas:       [[1001, 1099], [1101, 1199]], // + Ingredientes extra tostadas
    creps:          [[1201, 1299]],
    bocadillos:     [[1301, 1399], [1401, 1499]], // + Ingredientes extra bocadillos
    sandwich:       [[1501, 1599]],
    entrantes:      [[1601, 1699]],
    pizzas:         [[1701, 1799]],
    ensaladas:      [[2001, 2099], [2101, 2199]], // + Ingrediente extra ensaladas
    hamburguesas:   [[3901, 3999]],
    principales:    [[4001, 4099], [4201, 4299], [5001, 5099]], // Carne + Pescado + Guarnición extra
    ninos:          [[6001, 6099]],
    postres:        [[7001, 7099]],
    cafes:          [[9001, 9099], [9100, 9199]], // Cafés + Té e infusiones
    bebidas:        [[10001, 10099], [10100, 10199], [10200, 10299]], // Refrescos + Zumos + Otras bebidas
    bebidas_saludables: [[10301, 10399], [10401, 10499]], // Zumos Saludables + Botellas Saludables
    cervezas:       [[11001, 11099]],
    aperitivos:     [[11101, 11199], [11201, 11299]], // Aperitivos + Copas de vino y sangría
    vinos_blancos:  [[13100, 13199]],
    vinos_rosados:  [[13200, 13299]],
    vinos_tintos:   [[13300, 13399]],
    cavas:          [[13400, 13499]]
};

// NUEVO (Club House): dentro de las pestañas que fusionan "ingredientes/guarnición extra" con
// sus platos normales, este rango se pinta APARTE, con su propia subcabecera — a petición del
// usuario, para que quede claro que no son platos en sí sino extras que se añaden a uno.
const EXTRA_RANGES = {
    tostadas: {
        start: 1101, end: 1199,
        ES: 'Ingredientes Extra', EN: 'Extra Ingredients', DE: 'Extra-Zutaten', FR: 'Suppléments', IT: 'Ingredienti Extra',
        RU: 'Дополнительные ингредиенты', NL: 'Extra Ingrediënten', PL: 'Dodatkowe Składniki', SV: 'Extra Ingredienser', NO: 'Ekstra Ingredienser',
        DA: 'Ekstra Ingredienser', FI: 'Lisätäytteet', PT: 'Ingredientes Extra', RO: 'Ingrediente Suplimentare', HU: 'Extra Hozzávalók',
        CS: 'Extra Ingredience', EL: 'Επιπλέον Υλικά', TR: 'Ekstra Malzemeler', AR: 'مكونات إضافية', ZH: '额外配料', JA: '追加具材',
        KO: '추가 재료', CA: 'Ingredients Extra', EU: 'Osagai Gehigarriak', GL: 'Ingredientes Extra', VA: 'Ingredients Extra'
    },
    bocadillos: {
        start: 1401, end: 1499,
        ES: 'Ingredientes Extra', EN: 'Extra Ingredients', DE: 'Extra-Zutaten', FR: 'Suppléments', IT: 'Ingredienti Extra',
        RU: 'Дополнительные ингредиенты', NL: 'Extra Ingrediënten', PL: 'Dodatkowe Składniki', SV: 'Extra Ingredienser', NO: 'Ekstra Ingredienser',
        DA: 'Ekstra Ingredienser', FI: 'Lisätäytteet', PT: 'Ingredientes Extra', RO: 'Ingrediente Suplimentare', HU: 'Extra Hozzávalók',
        CS: 'Extra Ingredience', EL: 'Επιπλέον Υλικά', TR: 'Ekstra Malzemeler', AR: 'مكونات إضافية', ZH: '额外配料', JA: '追加具材',
        KO: '추가 재료', CA: 'Ingredients Extra', EU: 'Osagai Gehigarriak', GL: 'Ingredientes Extra', VA: 'Ingredients Extra'
    },
    ensaladas: {
        start: 2101, end: 2199,
        ES: 'Ingredientes Extra', EN: 'Extra Ingredients', DE: 'Extra-Zutaten', FR: 'Suppléments', IT: 'Ingredienti Extra',
        RU: 'Дополнительные ингредиенты', NL: 'Extra Ingrediënten', PL: 'Dodatkowe Składniki', SV: 'Extra Ingredienser', NO: 'Ekstra Ingredienser',
        DA: 'Ekstra Ingredienser', FI: 'Lisätäytteet', PT: 'Ingredientes Extra', RO: 'Ingrediente Suplimentare', HU: 'Extra Hozzávalók',
        CS: 'Extra Ingredience', EL: 'Επιπλέον Υλικά', TR: 'Ekstra Malzemeler', AR: 'مكونات إضافية', ZH: '额外配料', JA: '追加具材',
        KO: '추가 재료', CA: 'Ingredients Extra', EU: 'Osagai Gehigarriak', GL: 'Ingredientes Extra', VA: 'Ingredients Extra'
    },
    principales: {
        start: 5001, end: 5099,
        ES: 'Guarnición Extra', EN: 'Extra Side Dishes', DE: 'Extra-Beilagen', FR: 'Garnitures Supplémentaires', IT: 'Contorni Extra',
        RU: 'Дополнительные гарниры', NL: 'Extra Bijgerechten', PL: 'Dodatkowe Dodatki', SV: 'Extra Tillbehör', NO: 'Ekstra Tilbehør',
        DA: 'Ekstra Tilbehør', FI: 'Ylimääräiset Lisäkkeet', PT: 'Acompanhamentos Extra', RO: 'Garnituri Suplimentare', HU: 'Extra Köretek',
        CS: 'Extra Přílohy', EL: 'Επιπλέον Συνοδευτικά', TR: 'Ekstra Garnitürler', AR: 'أطباق جانبية إضافية', ZH: '额外配菜', JA: '追加サイドディッシュ',
        KO: '추가 사이드 메뉴', CA: 'Guarnicions Extra', EU: 'Gehigarrizko Garnizioak', GL: 'Garnicións Extra', VA: 'Guarnicions Extra'
    }
};

// NUEVO (8 septiembre): pestañas que se dividen ENTERAS en varias subcategorías con subcabecera
// propia siempre visible (a diferencia de EXTRA_RANGES, que es "platos normales + UN extra al
// final"). Cada pestaña listada aquí ignora el reparto normal de renderMenu y en su lugar pinta,
// en el ORDEN dado, una subcabecera + sus platos por cada bloque de este array. Un plato de la
// pestaña que no caiga en NINGÚN rango de aquí se pinta de todos modos, suelto, ANTES de la
// primera subcabecera (red de seguridad para no perder ningún plato por error de rango).
const SUBCATEGORIAS_RANGES = {
    bebidas_saludables: [
        {
            start: 10301, end: 10399,
            ES: 'Zumos Saludables', EN: 'Healthy Juices', DE: 'Gesunde Säfte', FR: 'Jus Sains', IT: 'Succhi Salutari',
            RU: 'Полезные соки', NL: 'Gezonde Sappen', PL: 'Zdrowe Soki', SV: 'Hälsosamma Juicer', NO: 'Sunne Juicer',
            DA: 'Sunde Juicer', FI: 'Terveelliset Mehut', PT: 'Sumos Saudáveis', RO: 'Sucuri Sănătoase', HU: 'Egészséges Levek',
            CS: 'Zdravé Šťávy', EL: 'Υγιεινοί Χυμοί', TR: 'Sağlıklı Meyve Suları', AR: 'عصائر صحية', ZH: '健康果汁', JA: 'ヘルシージュース',
            KO: '건강 주스', CA: 'Sucs Saludables', EU: 'Zuku Osasungarriak', GL: 'Zumos Saudables', VA: 'Sucs Saludables'
        },
        {
            start: 10401, end: 10499,
            ES: 'Botellas Saludables', EN: 'Healthy Bottled Drinks', DE: 'Gesunde Flaschengetränke', FR: 'Boissons en Bouteille Saines', IT: 'Bevande in Bottiglia Salutari',
            RU: 'Полезные напитки в бутылках', NL: 'Gezonde Flesdranken', PL: 'Zdrowe Napoje Butelkowane', SV: 'Hälsosamma Flaskdrycker', NO: 'Sunne Flaskedrikker',
            DA: 'Sunde Flaskedrikke', FI: 'Terveelliset Pullojuomat', PT: 'Bebidas Saudáveis Engarrafadas', RO: 'Băuturi Îmbuteliate Sănătoase', HU: 'Egészséges Palackozott Italok',
            CS: 'Zdravé Lahvové Nápoje', EL: 'Υγιεινά Εμφιαλωμένα Ποτά', TR: 'Sağlıklı Şişe İçecekler', AR: 'مشروبات معبأة صحية', ZH: '健康瓶装饮料', JA: 'ヘルシーボトル飲料',
            KO: '건강 병 음료', CA: 'Ampolles Saludables', EU: 'Botilako Edari Osasungarriak', GL: 'Botellas Saudables', VA: 'Botelles Saludables'
        }
    ],
    aperitivos: [
        {
            start: 11101, end: 11199,
            ES: 'Aperitivos', EN: 'Aperitifs', DE: 'Aperitifs', FR: 'Apéritifs', IT: 'Aperitivi',
            RU: 'Аперитивы', NL: 'Aperitieven', PL: 'Aperitify', SV: 'Aperitifer', NO: 'Aperitiffer',
            DA: 'Aperitiffer', FI: 'Aperitiivit', PT: 'Aperitivos', RO: 'Aperitive', HU: 'Aperitifek',
            CS: 'Aperitivy', EL: 'Απεριτίφ', TR: 'Aperitifler', AR: 'المقبلات الفاتحة للشهية', ZH: '开胃酒', JA: 'アペリティフ',
            KO: '아페리티프', CA: 'Aperitius', EU: 'Aperitiboak', GL: 'Aperitivos', VA: 'Aperitius'
        },
        {
            start: 11201, end: 11299,
            ES: 'Copas de vino y sangría', EN: 'Wine & Sangria by the Glass', DE: 'Wein & Sangria im Glas', FR: 'Vin & Sangria au Verre', IT: 'Vino e Sangria al Calice',
            RU: 'Вино и сангрия по бокалам', NL: 'Wijn & Sangria per Glas', PL: 'Wino i Sangria na Kieliszki', SV: 'Vin & Sangria på Glas', NO: 'Vin & Sangria i Glass',
            DA: 'Vin & Sangria på Glas', FI: 'Viini & Sangria Lasillisina', PT: 'Vinho e Sangria a Copo', RO: 'Vin și Sangria la Pahar', HU: 'Bor és Sangria Pohárban',
            CS: 'Víno a Sangria na Skleničky', EL: 'Κρασί & Σανγκρία σε Ποτήρι', TR: 'Kadehte Şarap ve Sangria', AR: 'النبيذ والسانجريا بالكأس', ZH: '杯装葡萄酒与桑格利亚汽酒', JA: 'グラスワイン＆サングリア',
            KO: '잔술 와인 & 상그리아', CA: 'Copes de Vi i Sangria', EU: 'Ardoa eta Sangria Kopan', GL: 'Copas de Viño e Sangría', VA: 'Copes de Vi i Sangria'
        }
    ]
};

// NUEVO (8 septiembre): etiquetas de la cabecera "1/2 | Entero" que aparece encima de una
// categoría en cuanto ALGÚN plato de esa pestaña tiene precio de media ración (item.precioMedia,
// ver PRECIO_MEDIA en parseCSV/Código.gs). MODIFICADO: completados los 26 idiomas (a petición
// del usuario), igual que el resto de textos de la web.
const PRICE_HEADER_LABELS = {
    half: {
        ES: '1/2', EN: 'Half', DE: 'Halb', FR: '1/2', IT: '1/2',
        RU: 'Половина', NL: 'Half', PL: 'Połowa', SV: 'Halv', NO: 'Halv',
        DA: 'Halv', FI: 'Puolikas', PT: 'Meia', RO: 'Jumătate', HU: 'Fél',
        CS: 'Půl', EL: 'Μισή', TR: 'Yarım', AR: 'نصف', ZH: '半份', JA: 'ハーフ',
        KO: '하프', CA: '1/2', EU: 'Erdia', GL: 'Media', VA: '1/2'
    },
    full: {
        ES: 'Entero', EN: 'Whole', DE: 'Ganz', FR: 'Entier', IT: 'Intero',
        RU: 'Целая', NL: 'Heel', PL: 'Cała', SV: 'Hel', NO: 'Hel',
        DA: 'Hel', FI: 'Kokonainen', PT: 'Inteira', RO: 'Întreagă', HU: 'Egész',
        CS: 'Celá', EL: 'Ολόκληρη', TR: 'Tam', AR: 'كامل', ZH: '整份', JA: 'フル',
        KO: '풀', CA: 'Sencer', EU: 'Osoa', GL: 'Enteira', VA: 'Sencer'
    }
};

// NUEVO (8 septiembre): "notas informativas" — filas puntuales sin precio (p.ej. "Opción de pan
// sin gluten", ID 1105) que no son un plato en sí y se pintan centradas a todo el ancho de la
// fila, SIN reservar la columna de precio (ni siquiera vacía) al lado. De momento son casos muy
// puntuales, así que basta con listar aquí sus IDs a mano según los vaya indicando el usuario.
const NOTAS_INFORMATIVAS_IDS = [1105, 1703, 1705, 2101];

// NUEVO (8 septiembre): leyenda de la pestaña fija "Alérgenos e Intolerancias" (última pestaña,
// sin platos). "code" es el nombre exacto del archivo en imagenes/alergenos/ (ya usado por cada
// plato en generateItemHtml, ver alergenosHtml) -- se reutilizan los mismos 16 iconos, no hace
// falta subir ninguno nuevo. Orden y agrupación en 2 columnas iguales a la imagen de referencia
// que dio el usuario (carta impresa): columna izquierda = alérgenos "de siempre" + los 2 tipos
// de plato al final; columna derecha = el resto.
const ALERGENOS_INFO_COL_IZQUIERDA = [
    { code: 'GLUTEN',
        ES: 'Gluten', EN: 'Gluten', DE: 'Gluten', FR: 'Gluten', IT: 'Glutine',
        RU: 'Глютен', NL: 'Gluten', PL: 'Gluten', SV: 'Gluten', NO: 'Gluten',
        DA: 'Gluten', FI: 'Gluteeni', PT: 'Glúten', RO: 'Gluten', HU: 'Glutén',
        CS: 'Lepek', EL: 'Γλουτένη', TR: 'Gluten', AR: 'الغلوتين', ZH: '麸质', JA: 'グルテン',
        KO: '글루텐', CA: 'Gluten', EU: 'Glutena', GL: 'Glute', VA: 'Gluten'
    },
    { code: 'LACTOSA',
        ES: 'Lactosa', EN: 'Lactose', DE: 'Laktose', FR: 'Lactose', IT: 'Lattosio',
        RU: 'Лактоза', NL: 'Lactose', PL: 'Laktoza', SV: 'Laktos', NO: 'Laktose',
        DA: 'Laktose', FI: 'Laktoosi', PT: 'Lactose', RO: 'Lactoză', HU: 'Laktóz',
        CS: 'Laktóza', EL: 'Λακτόζη', TR: 'Laktoz', AR: 'اللاكتوز', ZH: '乳糖', JA: '乳糖',
        KO: '유당', CA: 'Lactosa', EU: 'Laktosa', GL: 'Lactosa', VA: 'Lactosa'
    },
    { code: 'FRUTOSCASCARA',
        ES: 'Frutos de Cáscara', EN: 'Tree Nuts', DE: 'Schalenfrüchte', FR: 'Fruits à Coque', IT: 'Frutta a Guscio',
        RU: 'Орехи', NL: 'Noten', PL: 'Orzechy', SV: 'Nötter', NO: 'Nøtter',
        DA: 'Nødder', FI: 'Pähkinät', PT: 'Frutos de Casca Rija', RO: 'Fructe cu Coajă', HU: 'Diófélék',
        CS: 'Skořápkové plody', EL: 'Ξηροί Καρποί', TR: 'Kabuklu Yemişler', AR: 'المكسرات', ZH: '坚果', JA: 'ナッツ類',
        KO: '견과류', CA: 'Fruits de Closca', EU: 'Fruitu Lehorrak', GL: 'Froitos Secos', VA: 'Fruits de Closca'
    },
    { code: 'SULFITOS',
        ES: 'Sulfitos', EN: 'Sulphites', DE: 'Sulfite', FR: 'Sulfites', IT: 'Solfiti',
        RU: 'Сульфиты', NL: 'Sulfieten', PL: 'Siarczyny', SV: 'Sulfiter', NO: 'Sulfitter',
        DA: 'Sulfitter', FI: 'Sulfiitit', PT: 'Sulfitos', RO: 'Sulfiți', HU: 'Szulfitok',
        CS: 'Siřičitany', EL: 'Θειώδη', TR: 'Sülfitler', AR: 'الكبريتيت', ZH: '亚硫酸盐', JA: '亜硫酸塩',
        KO: '아황산염', CA: 'Sulfits', EU: 'Sulfitoak', GL: 'Sulfitos', VA: 'Sulfits'
    },
    { code: 'HUEVO',
        ES: 'Huevo', EN: 'Egg', DE: 'Ei', FR: 'Œuf', IT: 'Uovo',
        RU: 'Яйца', NL: 'Ei', PL: 'Jajka', SV: 'Ägg', NO: 'Egg',
        DA: 'Æg', FI: 'Kananmuna', PT: 'Ovo', RO: 'Ou', HU: 'Tojás',
        CS: 'Vejce', EL: 'Αυγό', TR: 'Yumurta', AR: 'البيض', ZH: '鸡蛋', JA: '卵',
        KO: '계란', CA: 'Ou', EU: 'Arrautza', GL: 'Ovo', VA: 'Ou'
    },
    { code: 'MOLUSCO',
        ES: 'Molusco', EN: 'Molluscs', DE: 'Weichtiere', FR: 'Mollusques', IT: 'Molluschi',
        RU: 'Моллюски', NL: 'Weekdieren', PL: 'Mięczaki', SV: 'Blötdjur', NO: 'Bløtdyr',
        DA: 'Bløddyr', FI: 'Nilviäiset', PT: 'Moluscos', RO: 'Moluște', HU: 'Puhatestűek',
        CS: 'Měkkýši', EL: 'Μαλάκια', TR: 'Yumuşakçalar', AR: 'الرخويات', ZH: '软体动物', JA: '軟体動物',
        KO: '연체동물', CA: 'Mol·luscos', EU: 'Moluskuak', GL: 'Moluscos', VA: 'Mol·luscs'
    },
    { code: 'PESCADO',
        ES: 'Pescado', EN: 'Fish', DE: 'Fisch', FR: 'Poisson', IT: 'Pesce',
        RU: 'Рыба', NL: 'Vis', PL: 'Ryby', SV: 'Fisk', NO: 'Fisk',
        DA: 'Fisk', FI: 'Kala', PT: 'Peixe', RO: 'Pește', HU: 'Hal',
        CS: 'Ryby', EL: 'Ψάρι', TR: 'Balık', AR: 'السمك', ZH: '鱼类', JA: '魚',
        KO: '생선', CA: 'Peix', EU: 'Arraina', GL: 'Peixe', VA: 'Peix'
    },
    { code: 'VEGETARIANO',
        ES: 'Plato Vegetariano', EN: 'Vegetarian Dish', DE: 'Vegetarisches Gericht', FR: 'Plat Végétarien', IT: 'Piatto Vegetariano',
        RU: 'Вегетарианское блюдо', NL: 'Vegetarisch Gerecht', PL: 'Danie Wegetariańskie', SV: 'Vegetarisk Rätt', NO: 'Vegetarrett',
        DA: 'Vegetarisk Ret', FI: 'Kasvisruoka', PT: 'Prato Vegetariano', RO: 'Fel Vegetarian', HU: 'Vegetáriánus Étel',
        CS: 'Vegetariánské Jídlo', EL: 'Χορτοφαγικό Πιάτο', TR: 'Vejetaryen Yemek', AR: 'طبق نباتي', ZH: '素食菜肴', JA: 'ベジタリアン料理',
        KO: '채식 요리', CA: 'Plat Vegetarià', EU: 'Plater Begetarianoa', GL: 'Prato Vexetariano', VA: 'Plat Vegetarià'
    },
    { code: 'VEGANO',
        ES: 'Plato Vegano', EN: 'Vegan Dish', DE: 'Veganes Gericht', FR: 'Plat Végétalien', IT: 'Piatto Vegano',
        RU: 'Веганское блюдо', NL: 'Veganistisch Gerecht', PL: 'Danie Wegańskie', SV: 'Vegansk Rätt', NO: 'Vegansk Rett',
        DA: 'Vegansk Ret', FI: 'Vegaaniruoka', PT: 'Prato Vegan', RO: 'Fel Vegan', HU: 'Vegán Étel',
        CS: 'Veganské Jídlo', EL: 'Βίγκαν Πιάτο', TR: 'Vegan Yemek', AR: 'طبق نباتي صرف', ZH: '纯素菜肴', JA: 'ビーガン料理',
        KO: '비건 요리', CA: 'Plat Vegà', EU: 'Plater Beganoa', GL: 'Prato Vegano', VA: 'Plat Vegà'
    }
];
const ALERGENOS_INFO_COL_DERECHA = [
    { code: 'SOJA',
        ES: 'Soja', EN: 'Soy', DE: 'Soja', FR: 'Soja', IT: 'Soia',
        RU: 'Соя', NL: 'Soja', PL: 'Soja', SV: 'Soja', NO: 'Soya',
        DA: 'Soja', FI: 'Soija', PT: 'Soja', RO: 'Soia', HU: 'Szója',
        CS: 'Sója', EL: 'Σόγια', TR: 'Soya', AR: 'الصويا', ZH: '大豆', JA: '大豆',
        KO: '대두', CA: 'Soja', EU: 'Soja', GL: 'Soia', VA: 'Soja'
    },
    { code: 'SESAMO',
        ES: 'Sésamo', EN: 'Sesame', DE: 'Sesam', FR: 'Sésame', IT: 'Sesamo',
        RU: 'Кунжут', NL: 'Sesam', PL: 'Sezam', SV: 'Sesam', NO: 'Sesam',
        DA: 'Sesam', FI: 'Seesami', PT: 'Sésamo', RO: 'Susan', HU: 'Szezámmag',
        CS: 'Sezam', EL: 'Σουσάμι', TR: 'Susam', AR: 'السمسم', ZH: '芝麻', JA: 'ごま',
        KO: '참깨', CA: 'Sèsam', EU: 'Ajonjolia', GL: 'Sésamo', VA: 'Sèsam'
    },
    { code: 'ALTRAMUCES',
        ES: 'Altramuces', EN: 'Lupin', DE: 'Lupinen', FR: 'Lupin', IT: 'Lupini',
        RU: 'Люпин', NL: 'Lupine', PL: 'Łubin', SV: 'Lupin', NO: 'Lupin',
        DA: 'Lupin', FI: 'Lupiini', PT: 'Tremoço', RO: 'Lupin', HU: 'Csillagfürt',
        CS: 'Vlčí bob', EL: 'Λούπινο', TR: 'Acı Bakla', AR: 'الترمس', ZH: '羽扇豆', JA: 'ルピナス豆',
        KO: '루핀', CA: 'Tramussos', EU: 'Altramuzak', GL: 'Chocho', VA: 'Tramussos'
    },
    { code: 'MOSTAZA',
        ES: 'Mostaza', EN: 'Mustard', DE: 'Senf', FR: 'Moutarde', IT: 'Senape',
        RU: 'Горчица', NL: 'Mosterd', PL: 'Gorczyca', SV: 'Senap', NO: 'Sennep',
        DA: 'Sennep', FI: 'Sinappi', PT: 'Mostarda', RO: 'Muștar', HU: 'Mustár',
        CS: 'Hořčice', EL: 'Μουστάρδα', TR: 'Hardal', AR: 'الخردل', ZH: '芥末', JA: 'マスタード',
        KO: '겨자', CA: 'Mostassa', EU: 'Mostaza', GL: 'Mostaza', VA: 'Mostassa'
    },
    { code: 'CACAHUETE',
        ES: 'Cacahuete', EN: 'Peanuts', DE: 'Erdnüsse', FR: 'Arachides', IT: 'Arachidi',
        RU: 'Арахис', NL: "Pinda's", PL: 'Orzeszki Ziemne', SV: 'Jordnötter', NO: 'Peanøtter',
        DA: 'Jordnødder', FI: 'Maapähkinä', PT: 'Amendoim', RO: 'Arahide', HU: 'Földimogyoró',
        CS: 'Arašídy', EL: 'Αράπικο Φιστίκι', TR: 'Yer Fıstığı', AR: 'الفول السوداني', ZH: '花生', JA: 'ピーナッツ',
        KO: '땅콩', CA: 'Cacauet', EU: 'Kakahuetea', GL: 'Cacahuete', VA: 'Cacauet'
    },
    { code: 'CRUSTACEO',
        ES: 'Crustáceo', EN: 'Crustaceans', DE: 'Krebstiere', FR: 'Crustacés', IT: 'Crostacei',
        RU: 'Ракообразные', NL: 'Schaaldieren', PL: 'Skorupiaki', SV: 'Kräftdjur', NO: 'Skalldyr',
        DA: 'Skaldyr', FI: 'Äyriäiset', PT: 'Crustáceos', RO: 'Crustacee', HU: 'Rákfélék',
        CS: 'Korýši', EL: 'Καρκινοειδή', TR: 'Kabuklular', AR: 'القشريات', ZH: '甲壳类', JA: '甲殻類',
        KO: '갑각류', CA: 'Crustacis', EU: 'Krustazeoak', GL: 'Crustáceos', VA: 'Crustacis'
    },
    { code: 'APIO',
        ES: 'Apio', EN: 'Celery', DE: 'Sellerie', FR: 'Céleri', IT: 'Sedano',
        RU: 'Сельдерей', NL: 'Selderij', PL: 'Seler', SV: 'Selleri', NO: 'Selleri',
        DA: 'Selleri', FI: 'Selleri', PT: 'Aipo', RO: 'Țelină', HU: 'Zeller',
        CS: 'Celer', EL: 'Σέλινο', TR: 'Kereviz', AR: 'الكرفس', ZH: '芹菜', JA: 'セロリ',
        KO: '셀러리', CA: 'Api', EU: 'Apioa', GL: 'Apio', VA: 'Api'
    }
];
// Frase de aviso debajo de la leyenda -- propuesta por Claude (el usuario pidió que se
// redactara una), pendiente de que la confirme o la sustituya por un texto propio. MODIFICADO:
// traducida a los 26 idiomas a petición del usuario.
const ALERGENOS_AVISO_TEXTO = {
    ES: 'Si padece alguna alergia o intolerancia alimentaria, por favor infórmenos antes de realizar su pedido. Estaremos encantados de ayudarle a elegir las mejores opciones.',
    EN: 'If you have any food allergy or intolerance, please let us know before placing your order. We will be happy to help you choose the best options.',
    DE: 'Wenn Sie an einer Lebensmittelallergie oder -unverträglichkeit leiden, informieren Sie uns bitte vor der Bestellung. Wir helfen Ihnen gerne bei der Auswahl der besten Optionen.',
    FR: 'Si vous souffrez d\'une allergie ou d\'une intolérance alimentaire, merci de nous en informer avant de passer commande. Nous serons heureux de vous aider à choisir les meilleures options.',
    IT: 'Se soffre di un\'allergia o intolleranza alimentare, vi preghiamo di avvisarci prima di ordinare. Saremo lieti di aiutarvi a scegliere le opzioni migliori.',
    RU: 'Если у вас есть пищевая аллергия или непереносимость, пожалуйста, сообщите нам об этом перед заказом. Мы будем рады помочь вам выбрать лучшие варианты.',
    NL: 'Als u een voedselallergie of -intolerantie heeft, laat het ons dan weten voordat u bestelt. Wij helpen u graag de beste opties te kiezen.',
    PL: 'Jeśli masz jakąkolwiek alergię lub nietolerancję pokarmową, poinformuj nas przed złożeniem zamówienia. Chętnie pomożemy Ci wybrać najlepsze opcje.',
    SV: 'Om du har någon matallergi eller intolerans, vänligen meddela oss innan du beställer. Vi hjälper dig gärna att välja de bästa alternativen.',
    NO: 'Hvis du har en matallergi eller intoleranse, vennligst gi oss beskjed før du bestiller. Vi hjelper deg gjerne med å velge de beste alternativene.',
    DA: 'Hvis du har en fødevareallergi eller intolerance, bedes du give os besked, inden du bestiller. Vi hjælper dig gerne med at vælge de bedste muligheder.',
    FI: 'Jos sinulla on ruoka-allergia tai -intoleranssi, ilmoita siitä meille ennen tilaamista. Autamme mielellämme valitsemaan parhaat vaihtoehdot.',
    PT: 'Se sofre de alguma alergia ou intolerância alimentar, informe-nos antes de fazer o seu pedido. Teremos todo o gosto em ajudá-lo a escolher as melhores opções.',
    RO: 'Dacă suferiți de vreo alergie sau intoleranță alimentară, vă rugăm să ne informați înainte de a comanda. Vom fi bucuroși să vă ajutăm să alegeți cele mai bune opțiuni.',
    HU: 'Ha bármilyen ételallergiája vagy -intoleranciája van, kérjük, tájékoztasson minket rendelés előtt. Szívesen segítünk a legjobb lehetőségek kiválasztásában.',
    CS: 'Pokud trpíte jakoukoli potravinovou alergií nebo intolerancí, informujte nás prosím před objednáním. Rádi vám pomůžeme vybrat ty nejlepší možnosti.',
    EL: 'Εάν έχετε κάποια τροφική αλλεργία ή δυσανεξία, παρακαλούμε ενημερώστε μας πριν παραγγείλετε. Θα χαρούμε να σας βοηθήσουμε να επιλέξετε τις καλύτερες επιλογές.',
    TR: 'Herhangi bir gıda alerjiniz veya intoleransınız varsa, lütfen siparişinizi vermeden önce bize bildirin. En iyi seçenekleri seçmenize yardımcı olmaktan memnuniyet duyarız.',
    AR: 'إذا كنت تعاني من أي حساسية أو عدم تحمل غذائي، يرجى إخبارنا قبل تقديم طلبك. سيسعدنا مساعدتك في اختيار أفضل الخيارات.',
    ZH: '如果您有任何食物过敏或不耐受，请在点餐前告知我们。我们将很乐意帮助您选择最佳选项。',
    JA: '食物アレルギーや不耐性がある場合は、ご注文の前にお知らせください。最適なメニューをお選びするお手伝いをいたします。',
    KO: '식품 알레르기나 불내증이 있으시면 주문 전에 알려주시기 바랍니다. 최선의 선택을 하실 수 있도록 기꺼이 도와드리겠습니다.',
    CA: 'Si pateix alguna al·lèrgia o intolerància alimentària, informi\'ns abans de fer la seva comanda. Estarem encantats d\'ajudar-lo a triar les millors opcions.',
    EU: 'Elikagai-alergiaren edo intolerantziaren bat baduzu, mesedez jakinarazi eskaera egin aurretik. Pozik lagunduko dizugu aukerarik onenak hautatzen.',
    GL: 'Se padece algunha alerxia ou intolerancia alimentaria, por favor infórmenos antes de facer o seu pedido. Estaremos encantados de axudarlle a escoller as mellores opcións.',
    VA: 'Si patix alguna al·lèrgia o intolerància alimentària, per favor informe\'ns abans de fer la seua comanda. Estarem encantats d\'ajudar-lo a triar les millors opcions.'
};

// NUEVO: pinta la página fija de la pestaña "Alérgenos e Intolerancias" -- 2 columnas de
// icono+texto (mismos iconos que ya usa cada plato en imagenes/alergenos/) más la frase de
// aviso debajo. No depende de allData/CATEGORY_RANGES porque no es una lista de platos.
function generateAlergenosPageHtml() {
    const renderCol = (items) => items.map(a => {
        const label = a[currentLang] || a['EN'] || a['ES'];
        return `<div class="alergeno-info-row"><img src="imagenes/alergenos/${a.code}.webp" loading="lazy" onerror="this.style.display='none'"><span>${label}</span></div>`;
    }).join('');
    const aviso = ALERGENOS_AVISO_TEXTO[currentLang] || ALERGENOS_AVISO_TEXTO.EN || ALERGENOS_AVISO_TEXTO.ES;
    return `<div class="alergenos-page">
        <div class="alergenos-page-columns">
            <div class="alergenos-page-col">${renderCol(ALERGENOS_INFO_COL_IZQUIERDA)}</div>
            <div class="alergenos-page-col">${renderCol(ALERGENOS_INFO_COL_DERECHA)}</div>
        </div>
        <p class="alergenos-page-aviso">${aviso}</p>
    </div>`;
}

// REESCRITO: antes se descargaban las 26 columnas de nombre + info de golpe en un único
// fetch (~470 KB con los datos actuales). Ahora se hace en 3 niveles de prioridad:
//  1) Idioma del cliente (+ ES, que se usa siempre como referencia secundaria bajo el
//     nombre principal) -> primer render lo antes posible.
//  2) Los 5 idiomas esenciales (ES/EN/DE/FR/IT) -> se piden en segundo plano justo después,
//     sin bloquear lo que ya se ve en pantalla.
//  3) El resto de los 26 idiomas -> solo se piden bajo demanda, si alguien los elige en el
//     selector "Más..." (ver changeLanguage).
// Si el endpoint en vivo fallara por lo que sea, se cae automáticamente al CSV_URL de
// siempre (con todas las columnas) para no dejar la web sin datos.
// NUEVO: lee la hoja "Categorias" del backend (Código.gs, ?accion=categorias) y devuelve el
// Set de ids de pestaña que están desactivadas (activa=NO). Si algo falla (red, endpoint aún
// no actualizado, etc.) devuelve un Set vacío — es decir, se muestran TODAS las pestañas, el
// mismo comportamiento de siempre. Nunca debe poder romper la carga del menú.
async function fetchCategoriasDeshabilitadas() {
    try {
        const url = `${LIVE_CSV_ENDPOINT}?accion=categorias&zx=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const text = await response.text();
        const filas = text.split(/\r?\n/).filter(f => f.trim() !== '');
        const deshabilitadas = new Set();
        filas.forEach((f, i) => {
            if (i === 0) return; // cabecera "ID,Activa"
            const c = f.split(',');
            const id = (c[0] || '').trim();
            const activa = (c[1] || '').trim().toUpperCase();
            if (id && activa === 'NO') deshabilitadas.add(id);
        });
        return deshabilitadas;
    } catch (e) {
        console.warn('[Pestañas] No se pudo comprobar qué secciones están desactivadas, se muestran todas:', e.message);
        return new Set();
    }
}

async function init() {
    try {
        injectVisualIndicatorStyles();
        populateLanguageSelect();

        const userLang = (navigator.language || navigator.userLanguage).split('-')[0].toUpperCase();
        currentLang = IDIOMAS[userLang] ? userLang : 'EN';

        // Copia SIN filtrar de categoriesList — se usa como base cada vez que se aplica un
        // estado de pestañas desactivadas, para poder tanto ocultar como volver a mostrar una
        // categoría según el estado más reciente (filtrar en el sitio sería irreversible: una
        // vez quitada una categoría no habría forma de "recuperarla" si luego resulta que sigue
        // activa de verdad).
        const categoriesListOriginal = categoriesList.slice();

        // NUEVO: se pide en paralelo con la carga de platos (no depende de ella) para no
        // añadir latencia al primer render.
        const categoriasPromise = fetchCategoriasDeshabilitadas();

        // NUEVO (27 agosto, recordar último estado de toggles): antes de saber la respuesta real
        // del servidor (puede tardar de 1,5 a varios segundos), se aplica el último estado
        // CONFIRMADO en una visita anterior si lo hay — así el primer pintado ya acierta, sin
        // fotos/info/pestañas que en realidad llevan tiempo desactivadas apareciendo un instante
        // y desapareciendo después. Si no hay nada guardado (primera visita, o se borró), se
        // sigue asumiendo "todo activo" como hasta ahora.
        const togglesConocidos = leerTogglesCacheLocal();
        if (togglesConocidos) {
            idsGlobalesDesactivados = togglesConocidos;
            categoriesList = categoriesListOriginal.filter(c => !togglesConocidos.has(c.id));
            if (!categoriesList.some(c => c.id === currentCat)) {
                currentCat = categoriesList.length > 0 ? categoriesList[0].id : currentCat;
            }
        }

        // NUEVO (26 agosto, caché local + delta por hash): si este navegador ya tiene una copia
        // guardada de una visita anterior (y de esta misma versión de la app), se pinta con ella
        // AL INSTANTE — cero fetches antes del primer render — y la comprobación de qué ha
        // cambiado de verdad desde entonces se hace después, en segundo plano (ver
        // sincronizarConCache). Si no hay caché (primera visita en este navegador, se borró, o
        // es de una versión de la app distinta), se cae al flujo de siempre por etapas.
        const cache = leerCacheLocal();
        if (cache) {
            allData = cache.data;
            renderCategories();
            renderMenu();
            updateLanguageUI();
            managePreload();
            setupScrollListener();

            categoriasPromise.then(categoriasDeshabilitadas => {
                // Se guarda SIEMPRE el estado real confirmado, para que la próxima visita ya
                // parta de él (ver leerTogglesCacheLocal más arriba).
                guardarTogglesCacheLocal(categoriasDeshabilitadas);
                // Si coincide con lo que ya se había aplicado (desde la caché de toggles, o
                // porque no había ninguna y "todo activo" resultó ser correcto), no hay nada que
                // corregir ni que repintar — este es ahora el caso normal en visitas repetidas.
                if (idsIguales(categoriasDeshabilitadas, idsGlobalesDesactivados)) return;

                idsGlobalesDesactivados = categoriasDeshabilitadas;
                // La managePreload() de más arriba pudo haberse lanzado con un estado de "Fotos"
                // desactualizado; ahora que se confirma el real, se relanza para que cargue o
                // corte lo que corresponda (currentPreloadSession invalida la anterior si hacía
                // falta cortarla).
                managePreload();
                categoriesList = categoriesListOriginal.filter(c => !categoriasDeshabilitadas.has(c.id));
                if (!categoriesList.some(c => c.id === currentCat)) {
                    currentCat = categoriesList.length > 0 ? categoriesList[0].id : currentCat;
                }
                renderCategories();
                renderMenu();
            }).catch(e => console.warn('[Pestañas] No se pudo aplicar el estado de categorías:', e.message));

            // NUEVO: si el idioma del navegador cambió desde la última visita y no estaba entre
            // los ya cacheados, se pide igual que siempre bajo demanda (independiente de la
            // comprobación general de cambios, para no retrasarlo).
            if (!isLangLoaded(currentLang)) {
                fetchAndParseCsv([currentLang])
                    .then(items => { mergeIntoAllData(items); renderCategories(); renderMenu(); updateLanguageUI(); guardarCacheLocal(); })
                    .catch(e => console.warn('[Caché local] No se pudo precargar el idioma del cliente:', e.message));
            }

            sincronizarConCache(cache.data)
                .catch(e => console.warn('[Caché local] Fallo comprobando cambios en segundo plano:', e.message));
            return;
        }

        const idiomasEtapa1 = Array.from(new Set([currentLang, 'ES']));

        try {
            allData = await fetchAndParseCsv(idiomasEtapa1);
        } catch (e) {
            console.warn('[Carga por etapas] Fallo en el endpoint en vivo, usando CSV completo de reserva:', e.message);
            const response = await fetch(CSV_URL);
            const csvText = await response.text();
            allData = parseCSV(csvText);
        }

        // MODIFICADO (22 agosto, velocidad de apertura): antes se esperaba SIEMPRE a "categorias"
        // además del CSV antes de pintar nada — dos peticiones independientes a Apps Script, así
        // que si "categorias" tardaba más que el CSV (nada lo garantiza, aunque en la práctica
        // suele ser la más rápida de las dos), retrasaba el primer pintado sin necesidad. Ahora
        // se pinta en cuanto llega el CSV, con el supuesto por defecto de que nada está oculto
        // (que es el caso normal — "una pestaña ausente de la hoja se considera ACTIVA por
        // defecto"); si "categorias" resuelve después y de verdad hay algo desactivado, se repinta
        // solo entonces (repintado gratis en el caso normal, porque no hay nada que ocultar).
        if (allData.length > 0) {
            renderCategories();
            renderMenu();
            updateLanguageUI();
            managePreload();
            setupScrollListener();
            // NUEVO (26 agosto): se guarda ya lo que tenemos (idioma cliente + ES) por si el
            // usuario cierra la pestaña antes de que terminen las etapas 2/3 — así la próxima
            // visita ya parte de algo cacheado en vez de ir de cero. Se vuelve a guardar (con más
            // idiomas) al terminar cada etapa siguiente.
            guardarCacheLocal();
        }

        categoriasPromise.then(categoriasDeshabilitadas => {
            guardarTogglesCacheLocal(categoriasDeshabilitadas);
            if (idsIguales(categoriasDeshabilitadas, idsGlobalesDesactivados)) return;

            idsGlobalesDesactivados = categoriasDeshabilitadas; // fotos/info conviven en el mismo Set
            categoriesList = categoriesListOriginal.filter(c => !categoriasDeshabilitadas.has(c.id));
            if (!categoriesList.some(c => c.id === currentCat)) {
                currentCat = categoriesList.length > 0 ? categoriesList[0].id : currentCat;
            }
            if (allData.length > 0) {
                managePreload();
                renderCategories();
                renderMenu();
            }
        }).catch(e => console.warn('[Pestañas] No se pudo aplicar el estado de categorías:', e.message));

        // NUEVO: etapa 2 en segundo plano — no se espera ni bloquea el primer render.
        const idiomasPendientesEsenciales = ESSENTIAL_LANGS.filter(l => !idiomasEtapa1.includes(l));
        const etapa2 = idiomasPendientesEsenciales.length > 0
            ? fetchAndParseCsv(idiomasPendientesEsenciales).then(items => { mergeIntoAllData(items); guardarCacheLocal(); }).catch(e => console.warn('[Carga por etapas] No se pudieron precargar los idiomas esenciales restantes:', e.message))
            : Promise.resolve();

        // NUEVO: etapa 3 — el resto de los 26 idiomas, en segundo plano y SOLO después de que
        // la etapa 2 termine (para no competir por ancho de banda con lo prioritario). Pesa
        // poco por idioma (nombres cortos, sin INFO_* salvo en ES/EN), así que en conexiones
        // normales no cuesta nada tenerlo ya listo si alguien acaba abriendo el selector
        // "Más...". Si la conexión es lenta (Save-Data / 2G / 3G), se salta esta etapa.
        etapa2.then(() => {
            const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn && (conn.saveData || /2g|3g/.test(conn.effectiveType || ''))) return;

            const idiomasRestantes = Object.keys(IDIOMAS).filter(l => !idiomasEtapa1.includes(l) && !ESSENTIAL_LANGS.includes(l));
            if (idiomasRestantes.length === 0) return;
            fetchAndParseCsv(idiomasRestantes)
                .then(items => { mergeIntoAllData(items); guardarCacheLocal(); })
                .catch(e => console.warn('[Carga por etapas] No se pudo precargar el resto de idiomas:', e.message));
        });
    } catch (e) { console.error("Error en la inicialización:", e); }
}

function injectVisualIndicatorStyles() {
    if (document.getElementById('indicator-styles')) return;
    const style = document.createElement('style');
    style.id = 'indicator-styles';
    style.textContent = `
        .nav-container-interactive {
            position: relative;
            width: 100%;
            margin-bottom: 5px;
        }
        #category-selector {
            display: flex;
            overflow-x: auto;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            white-space: nowrap;
            padding-right: 50px !important;
        }
        #category-selector::-webkit-scrollbar {
            display: none;
        }
        .scroll-hint-hand {
            position: absolute;
            right: 25px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 28px;
            pointer-events: none;
            z-index: 100;
            opacity: 0.85;
            background: rgba(255,255,255,0.9);
            width: 44px;
            height: 44px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            animation: swipeHand 1.6s ease-in-out infinite;
            transition: opacity 0.4s ease, transform 0.4s ease;
        }
        @keyframes swipeHand {
            0% { transform: translateY(-50%) translateX(10px); opacity: 0; }
            30% { opacity: 0.9; }
            70% { transform: translateY(-50%) translateX(-55px); opacity: 0.9; }
            100% { transform: translateY(-50%) translateX(-65px); opacity: 0; }
        }
        /* MODIFICADO (27 agosto, visibilidad de "hay más categorías"): el degradado blanco del
           borde bajaba de 45px a opacidad casi total (0.95) — eso tapaba justo la porción del
           siguiente botón que ya asoma de forma natural por el borde del contenedor (el propio
           recorte del overflow, sin necesitar JS), que es la pista más clara y universal de "esto
           continúa". Se deja mucho más estrecho y suave para que ese trocito de botón se siga
           viendo, y el borde no quede "borrado" en blanco.
        */
        .nav-container-interactive::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 18px;
            height: 100%;
            background: linear-gradient(to right, rgba(255,255,255,0), rgba(255, 255, 255, 0.55));
            pointer-events: none;
            z-index: 5;
        }
        /* NUEVO (26 agosto): indicador visual de "cargando idioma" — ver changeLanguage(). El
           anillo usa currentColor en el trazo superior para heredar automáticamente el color de
           texto del elemento donde se inserta (botón activo/inactivo, píldora...), sin tener que
           declarar colores propios que pudieran desentonar con el tema de cada web. */
        .lang-spinner {
            display: inline-block;
            width: 11px;
            height: 11px;
            margin-right: 6px;
            border: 2px solid rgba(128, 128, 128, 0.35);
            border-top-color: currentColor;
            border-radius: 50%;
            vertical-align: -1px;
            animation: lang-spin 0.7s linear infinite;
        }
        @keyframes lang-spin {
            to { transform: rotate(360deg); }
        }
        #language-selector button:disabled,
        #more-langs:disabled {
            opacity: 0.65;
            cursor: default;
        }
        .lang-loading-pill {
            display: inline-flex;
            align-items: center;
            margin-left: 8px;
            padding: 3px 10px;
            font-size: 0.8em;
            border-radius: 999px;
            background: rgba(128, 128, 128, 0.15);
            white-space: nowrap;
            vertical-align: middle;
        }
    `;
    document.head.appendChild(style);
}

function setupScrollListener() {
    const selector = document.getElementById('category-selector');
    if (!selector) return;

    const hideHint = () => {
        const hint = document.querySelector('.scroll-hint-hand');
        if (hint) {
            hint.style.opacity = '0';
            hint.style.transform = 'translateY(-50%) scale(0.5)';
            setTimeout(() => hint.remove(), 400); 
        }
        selector.removeEventListener('scroll', hideHint);
        selector.removeEventListener('touchstart', hideHint);
    };

    selector.addEventListener('scroll', hideHint);
    selector.addEventListener('touchstart', hideHint);
}

function populateLanguageSelect() {
    const select = document.getElementById('more-langs');
    if (!select) return;
     
    select.innerHTML = '<option value="">🌐 Más...</option>';
     
    const ordenPrioritario = ['CA', 'EU', 'VA', 'GL'];
    
    ordenPrioritario.forEach(code => {
        if (IDIOMAS[code]) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = IDIOMAS[code];
            select.appendChild(opt);
        }
    });
    
    Object.entries(IDIOMAS).forEach(([code, name]) => {
        if (!['ES','EN','DE','FR','IT'].includes(code) && !ordenPrioritario.includes(code)) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = name; 
            select.appendChild(opt);
        }
    });
}

function updateLanguageUI() {
    // NUEVO: activa/desactiva la maquetación de derecha a izquierda según el idioma actual.
    // Al ir en <html>, se hereda a toda la página (cabecera, pestañas de categorías, filas de
    // platos y el modal de info incluidos) sin tener que tocar CSS de cada componente uno a
    // uno: con dir="rtl" el texto se alinea a la derecha y flexbox invierte visualmente filas
    // como .item-row (el precio pasa a la izquierda, el nombre queda pegado al margen derecho).
    document.documentElement.dir = RTL_LANGS.includes(currentLang) ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang.toLowerCase();

    const menuTitleEl = document.getElementById('header-menu-title');
    if (menuTitleEl) {
        menuTitleEl.textContent = MENU_TEXTS[currentLang] || MENU_TEXTS['ES'];
    }

    document.querySelectorAll('#language-selector button').forEach(b => {
        b.classList.remove('active');
        const code = b.id.replace('btn-', '');
        if (IDIOMAS[code]) {
            b.textContent = IDIOMAS[code];
        }
    });
     
    const btn = document.getElementById(`btn-${currentLang}`);
    const select = document.getElementById('more-langs');
     
    if (btn) {
        btn.classList.add('active');
        if (select) select.value = '';
    } else {
        if (select) select.value = currentLang;
    }
}

// REESCRITO: antes leía por POSICIÓN fija de columna (col[0]..col[31], info a partir de la
// 32 en orden alfabético fijo). Eso rompía en cuanto el CSV traía menos columnas (como los
// que ahora sirve LIVE_CSV_ENDPOINT con &idiomas=). Ahora lee la fila de cabeceras y mapea
// por NOMBRE, así funciona igual de bien con el CSV completo (26 idiomas) que con uno
// parcial (p.ej. solo Nombre_KO/INFO_KO). Un nombre_xx / info_xx que no venga en este CSV se
// deja "undefined" a propósito — así isLangLoaded() puede distinguir "aún no cargado" de
// "cargado pero vacío".
function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (lines.length < 2) return rows;

    const clean = (val) => val ? val.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : "";

    const headerCols = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => clean(h).toUpperCase());
    const idx = {};
    headerCols.forEach((h, i) => { if (h) idx[h] = i; });
    if (idx['ID'] === undefined) return rows;

    for (let i = 1; i < lines.length; i++) {
        const col = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const get = (headerName) => {
            const colIdx = idx[headerName];
            return (colIdx !== undefined && col[colIdx] !== undefined) ? clean(col[colIdx]) : undefined;
        };

        const idVal = get('ID');
        if (!idVal) continue;

        const item = {
            id: idVal,
            precio: (get('PRECIO') || '0').replace(',', '.'),
            // NUEVO (8 septiembre): precio opcional de "1/2 ración" — '' si el plato no la tiene
            // (a diferencia de precio, aquí no se sustituye por '0', para poder distinguir "sin
            // media ración" de "media ración gratis"). Requiere que Código.gs sirva también la
            // columna PRECIO_MEDIA (ver COLUMNAS_BASE en el propio Código.gs).
            precioMedia: (get('PRECIO_MEDIA') || '').replace(',', '.'),
            activa: (get('ACTIVA') || '').toUpperCase(),
            carpeta: get('CARPETA') || '',
            archivo: get('ARCHIVO_FOTO') || '',
            alergenos: (() => { const a = get('ALERGENOS_COD'); return a ? a.split(',').map(x => x.trim()).filter(x => x) : []; })(),
            // NUEVO (paridad con US Open): posiciones (1, 2, 3...) de las palabras entre
            // "//.../ /" del nombre que están desactivadas para este plato — p.ej. "2,5". Es
            // la misma lista para todos los idiomas (ver processName/generateItemHtml, que la
            // aplican por posición). Requiere que Código.gs sirva también la columna
            // OPCIONES_INACTIVAS (ver COLUMNAS_BASE en el propio Código.gs).
            opcionesInactivas: (() => { const o = get('OPCIONES_INACTIVAS'); return o ? o.split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n)) : []; })(),
            // NUEVO (26 agosto, caché local + delta por hash): hash de la fila calculado por el
            // servidor (ver Código.gs > calcularHashFila). Permite comparar "¿ha cambiado este
            // plato desde mi última visita?" sin descargar su contenido completo — ver
            // sincronizarConCache/diffHashes. '' si el servidor todavía no sirve esta columna
            // (versión antigua de Código.gs sin desplegar) o si esta respuesta concreta no la
            // incluye.
            hash: get('HASH_FILA') || ''
        };

        Object.keys(idx).forEach(h => {
            if (h.indexOf('NOMBRE_') === 0) {
                item[`nombre_${h.replace('NOMBRE_', '').toLowerCase()}`] = get(h) || '';
            } else if (h.indexOf('INFO_') === 0) {
                item[`info_${h.replace('INFO_', '').toLowerCase()}`] = get(h) || '';
            }
        });

        rows.push(item);
    }
    return rows;
}

// NUEVO: pide al endpoint en vivo solo las columnas de los idiomas indicados.
async function fetchAndParseCsv(langs) {
    const idiomasParam = langs.join(',');
    const url = `${LIVE_CSV_ENDPOINT}?accion=csv&idiomas=${encodeURIComponent(idiomasParam)}&zx=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    return parseCSV(text);
}

// MODIFICADO (26 agosto, caché local + delta por hash): antes solo se pisaban las claves
// nombre_*/info_* (pensado para cuando cada lote descargado era SIEMPRE un idioma nuevo, nunca
// contenido ya visto). Ahora que también se usa para aplicar filas cambiadas (precio, activa,
// alérgenos, hash...) tras la comprobación de cambios en segundo plano, se pisa CUALQUIER clave
// que venga en el lote — precio/activa/carpeta/archivo/alergenos/opcionesInactivas/hash
// incluidos. Esto no cambia el comportamiento de las etapas 1/2/3 ni de changeLanguage(): un
// lote pedido solo con &idiomas= sigue trayendo las columnas base (Código.gs las incluye
// siempre, ver COLUMNAS_BASE), así que overwrite total. Sigue añadiendo el item entero si el id
// es nuevo (plato/vino recién creado en la hoja).
function mergeIntoAllData(newItems) {
    const byId = {};
    allData.forEach(it => { byId[it.id] = it; });
    newItems.forEach(ni => {
        const existente = byId[ni.id];
        if (existente) {
            Object.keys(ni).forEach(k => { existente[k] = ni[k]; });
        } else {
            allData.push(ni);
            byId[ni.id] = ni;
        }
    });
}

// NUEVO: ¿ya tenemos descargado el nombre de ese idioma para los platos? (undefined = nunca
// se pidió esa columna todavía; '' = se pidió y está vacía, que es distinto).
function isLangLoaded(lang) {
    if (allData.length === 0) return false;
    return allData[0][`nombre_${lang.toLowerCase()}`] !== undefined;
}

// =========================================================================================
// NUEVO (26 agosto): caché local (localStorage) + sincronización por hash. Objetivo: en una
// visita recurrente desde el mismo navegador, pintar la carta al instante con la última copia
// conocida (sin esperar ningún fetch) y comprobar en segundo plano qué ha cambiado de verdad
// desde entonces, descargando solo eso — en vez de repetir siempre la carga completa por
// etapas. Si algo falla en cualquier punto de este bloque (localStorage bloqueado/lleno, red,
// servidor con Código.gs aún sin actualizar...) se degrada solo, sin romper la carga normal:
// ver los try/catch y los "return null"/early-return de cada función.
// =========================================================================================

// Lee la caché guardada en este navegador. Devuelve null si no existe, está corrupta, o es de
// una versión de la app distinta a la que se está ejecutando ahora (para que un cambio futuro
// en la forma de los datos no se quede pisado con un objeto de forma antigua).
function leerCacheLocal() {
    try {
        const raw = localStorage.getItem(MENU_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.data) || parsed.data.length === 0) return null;
        if (parsed.appVersion !== APP_VERSION) return null;
        return parsed;
    } catch (e) {
        console.warn('[Caché local] No se pudo leer la caché, se ignora:', e.message);
        return null;
    }
}

// Guarda el estado actual de allData en localStorage. Se llama varias veces a lo largo de la
// carga (tras el primer pintado, tras cada etapa) para que incluso si el usuario cierra la
// pestaña antes de que termine todo, la próxima visita ya parta de algo en vez de ir de cero.
function guardarCacheLocal() {
    try {
        localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({
            data: allData,
            ts: Date.now(),
            appVersion: APP_VERSION
        }));
    } catch (e) {
        console.warn('[Caché local] No se pudo guardar la caché (¿localStorage lleno o bloqueado?):', e.message);
    }
}

// NUEVO (27 agosto): recordar el último estado CONFIRMADO de pestañas/fotos/info entre visitas.
// Objetivo: la web pinta el menú al instante (desde MENU_CACHE_KEY) mucho antes de que responda
// ?accion=categorias (1,5 a varios segundos) — hasta ahora, mientras tanto, se asumía "todo
// activo", así que si en realidad "Fotos" (o una pestaña) estaba desactivada, se veía un
// instante y desaparecía al llegar la respuesta real ("flash"), además de arrancar una precarga
// de fotos que luego había que cortar. Guardando aquí el último estado real, la visita
// SIGUIENTE ya puede partir de él desde el primer pintado — sin esperar nada — y solo hace
// falta corregir si de verdad ha cambiado desde entonces (ver idsIguales más abajo).
const TOGGLES_CACHE_KEY = 'rgTogglesCacheV1';

// Compara dos Set de ids por contenido (no por referencia).
function idsIguales(a, b) {
    if (a.size !== b.size) return false;
    for (const id of a) { if (!b.has(id)) return false; }
    return true;
}

function leerTogglesCacheLocal() {
    try {
        const raw = localStorage.getItem(TOGGLES_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.ids)) return null;
        return new Set(parsed.ids);
    } catch (e) {
        console.warn('[Toggles] No se pudo leer el último estado conocido, se asume todo activo:', e.message);
        return null;
    }
}

function guardarTogglesCacheLocal(idsDeshabilitados) {
    try {
        localStorage.setItem(TOGGLES_CACHE_KEY, JSON.stringify({ ids: Array.from(idsDeshabilitados) }));
    } catch (e) {
        console.warn('[Toggles] No se pudo guardar el último estado conocido:', e.message);
    }
}

// Pide SOLO las columnas base (incluida HASH_FILA) de todas las filas — una petición de unos
// pocos KB pensada únicamente para comprobar qué ha cambiado, no para renderizar nada con ella
// directamente (los nombre_*/info_* de estas filas vendrán "undefined", como espera parseCSV).
async function fetchHashesBase() {
    const url = `${LIVE_CSV_ENDPOINT}?accion=csv&soloBase=1&zx=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    return parseCSV(text);
}

// Pide el contenido completo (columnas base + los idiomas indicados) de solo las filas cuyo ID
// esté en la lista — para traer SOLO lo que ha cambiado, tras compararlo con fetchHashesBase.
async function fetchFilasPorId(ids, langs) {
    if (!ids || ids.length === 0) return [];
    const idiomasParam = langs.join(',');
    const idsParam = ids.join(',');
    const url = `${LIVE_CSV_ENDPOINT}?accion=csv&idiomas=${encodeURIComponent(idiomasParam)}&ids=${encodeURIComponent(idsParam)}&zx=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    return parseCSV(text);
}

// Qué idiomas tiene ya cargados (nombre_xx presente, aunque sea vacío) un conjunto de datos
// dado — se usa para saber qué idiomas pedir de las filas que han cambiado, sin perder ninguno
// de los que este navegador ya tenía descargados antes de la comprobación.
function detectarIdiomasEnData(data) {
    if (!data || data.length === 0) return [];
    const langs = new Set();
    Object.keys(data[0]).forEach(k => {
        if (k.startsWith('nombre_')) langs.add(k.replace('nombre_', '').toUpperCase());
    });
    return Array.from(langs);
}

// Compara la caché guardada contra las filas base recién descargadas (por hash) y devuelve qué
// IDs han cambiado (nuevo o hash distinto) y qué IDs de la caché ya no existen en la hoja.
function diffHashes(cachedData, freshBaseRows) {
    const cachedById = {};
    cachedData.forEach(it => { cachedById[it.id] = it; });
    const freshIds = new Set();
    const changedIds = [];
    freshBaseRows.forEach(row => {
        freshIds.add(row.id);
        const cached = cachedById[row.id];
        if (!cached || cached.hash !== row.hash) changedIds.push(row.id);
    });
    const deletedIds = cachedData.filter(it => !freshIds.has(it.id)).map(it => it.id);
    return { changedIds, deletedIds };
}

// Comprobación en segundo plano tras un arranque "en caliente" (pintado desde caché): pide solo
// los hashes, calcula qué ha cambiado/desaparecido desde la copia guardada, y solo si hay algo
// distinto descarga el contenido completo de esas filas concretas (en los idiomas que este
// navegador ya tenía cargados) y repinta. Si no hay ningún cambio, no se descarga ni se repinta
// nada más — la visita ya se sirvió entera desde la caché.
async function sincronizarConCache(cachedData) {
    const freshBaseRows = await fetchHashesBase();
    const { changedIds, deletedIds } = diffHashes(cachedData, freshBaseRows);

    if (changedIds.length === 0 && deletedIds.length === 0) return;

    if (deletedIds.length > 0) {
        const deletedSet = new Set(deletedIds.map(String));
        allData = allData.filter(it => !deletedSet.has(String(it.id)));
    }

    if (changedIds.length > 0) {
        const idiomasNecesarios = Array.from(new Set([currentLang, ...detectarIdiomasEnData(cachedData)]));
        const filasActualizadas = await fetchFilasPorId(changedIds, idiomasNecesarios);
        mergeIntoAllData(filasActualizadas);
    }

    renderCategories();
    renderMenu();
    guardarCacheLocal();
}

function isItemInCategory(itemId, catId) {
    const idNum = parseInt(itemId, 10);
    const rangos = CATEGORY_RANGES[catId];
    if (!rangos) return false;
    return rangos.some(([inicio, fin]) => idNum >= inicio && idNum <= fin);
}

function renderCategories() { 
    const nav = document.getElementById('category-selector'); 
    if (!nav) return;

    if (nav.parentNode && !nav.parentNode.classList.contains('nav-container-interactive')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'nav-container-interactive';
        nav.parentNode.insertBefore(wrapper, nav);
        wrapper.appendChild(nav);
         
        const handHint = document.createElement('div');
        handHint.className = 'scroll-hint-hand';
        handHint.innerHTML = '👉'; 
        wrapper.appendChild(handHint);
    }

    nav.innerHTML = categoriesList.map(c => {
        const catName = c[currentLang] || c['EN'] || c['ES'];
        const finalLabel = currentLang === 'ES' ? catName : `${catName} - ${c['ES']}`;
        return `<button onclick="filterCategory('${c.id}')" class="cat-btn ${currentCat === c.id ? 'active' : ''}">${finalLabel}</button>`;
    }).join('');
}

function renderMenu() { 
    const grid = document.getElementById('items-list'), title = document.getElementById('current-category-name'); 
    const catObj = categoriesList.find(c => c.id === currentCat); 
     
    const catName = catObj ? (catObj[currentLang] || catObj['EN'] || catObj['ES']) : "";
    const translatedTitle = currentLang === 'ES' ? catName : `${catName} - ${catObj['ES']}`;
     
    if (title) title.innerHTML = `${translatedTitle} <span style="font-size: 0.4em; opacity: 0.5; font-weight: normal; margin-left: 10px;">${APP_VERSION}</span>`;
    if (grid) grid.innerHTML = '';

    // NUEVO (8 septiembre): "Alérgenos e Intolerancias" es una página fija de contenido, no una
    // lista de platos -- se pinta aparte y se sale antes de tocar allData/CATEGORY_RANGES.
    if (currentCat === 'alergenos') {
        if (grid) grid.innerHTML = generateAlergenosPageHtml();
        return;
    }

    const filtered = allData.filter(item => {
        return isItemInCategory(item.id, currentCat) && item.activa === 'SI' && (item.id % 1000 !== 0);
    });

    // NUEVO (8 septiembre): si ALGÚN plato visible de esta pestaña tiene precio de media
    // ración, se pinta una fila de cabecera "1/2 | Entero" arriba de la lista y cada plato
    // muestra sus dos precios en columna (ver generateItemHtml). Si ninguno la tiene, la
    // pestaña se ve exactamente igual que antes (una sola columna de precio).
    const catShowsDual = filtered.some(item => parseFloat(item.precioMedia) > 0);
    if (catShowsDual && grid) {
        const labelHalf = PRICE_HEADER_LABELS.half[currentLang] || PRICE_HEADER_LABELS.half.EN || PRICE_HEADER_LABELS.half.ES;
        const labelFull = PRICE_HEADER_LABELS.full[currentLang] || PRICE_HEADER_LABELS.full.EN || PRICE_HEADER_LABELS.full.ES;
        grid.innerHTML += `<div class="price-columns-header"><span class="price-columns-spacer"></span><div class="price-box-dual price-box-header"><span class="price-cell price-cell-half">${labelHalf}</span><span class="price-cell price-cell-full">${labelFull}</span></div></div>`;
    }

    // REESCRITO para Club House: cada pestaña se pinta como lista plana, salvo que tenga un
    // rango "extra" fusionado (ver EXTRA_RANGES) — en ese caso los platos normales van primero
    // y los extras (ingredientes/guarnición extra) se separan debajo con su propia subcabecera,
    // para que quede claro que no son platos en sí. Las demás cosas de RG (Sugerencias en 4
    // bloques, subcategorías de vino por región) no aplican aquí porque el reparto de categorías
    // es distinto. "Sugerencias" queda pendiente de subcategorías propias (el usuario avisó que
    // las añadirá más adelante); mientras tanto se ve todo junto.
    // NUEVO (8 septiembre): pestañas 100% subcategorizadas (ver SUBCATEGORIAS_RANGES) — p.ej.
    // "Bebidas Saludables" con "Zumos Saludables" + "Botellas Saludables". Se pinta una
    // subcabecera por bloque, en el orden dado, y cualquier plato que no caiga en ningún rango
    // se pinta suelto ANTES de la primera subcabecera (red de seguridad).
    const subcategorias = SUBCATEGORIAS_RANGES[currentCat];
    if (subcategorias) {
        const sueltos = filtered.filter(item => {
            const idNum = parseInt(item.id, 10);
            return !subcategorias.some(sc => idNum >= sc.start && idNum <= sc.end);
        });
        if (grid) sueltos.forEach(item => { grid.innerHTML += generateItemHtml(item, false, catShowsDual); });

        subcategorias.forEach(sc => {
            const idsBloque = filtered.filter(item => {
                const idNum = parseInt(item.id, 10);
                return idNum >= sc.start && idNum <= sc.end;
            });
            if (idsBloque.length === 0 || !grid) return;
            const titleText = sc[currentLang] || sc['EN'] || sc['ES'];
            const finalTitle = currentLang === 'ES' ? titleText : `${titleText} - ${sc['ES']}`;
            grid.innerHTML += `<h3 class="sub-category-title">${finalTitle}</h3>`;
            idsBloque.forEach(item => { grid.innerHTML += generateItemHtml(item, false, catShowsDual); });
        });
        return;
    }

    const extraInfo = EXTRA_RANGES[currentCat];
    if (extraInfo) {
        const normales = [], extras = [];
        filtered.forEach(item => {
            const idNum = parseInt(item.id, 10);
            (idNum >= extraInfo.start && idNum <= extraInfo.end ? extras : normales).push(item);
        });
        normales.forEach(item => { if (grid) grid.innerHTML += generateItemHtml(item, false, catShowsDual); });
        if (extras.length > 0 && grid) {
            const titleText = extraInfo[currentLang] || extraInfo['EN'] || extraInfo['ES'];
            const finalTitle = currentLang === 'ES' ? titleText : `${titleText} - ${extraInfo['ES']}`;
            grid.innerHTML += `<h3 class="sub-category-title">${finalTitle}</h3>`;
            extras.forEach(item => { grid.innerHTML += generateItemHtml(item, false, catShowsDual); });
        }
    } else {
        filtered.forEach(item => {
            if (grid) grid.innerHTML += generateItemHtml(item, false, catShowsDual);
        });
    }
}

// NUEVO: helpers para pasar el JSON de info_* al onclick sin que ninguna comilla, apóstrofe
// o barra invertida del texto pueda romper el HTML/JS generado (ver showInfoModal).
function utf8ToB64(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64ToUtf8(str) { return decodeURIComponent(escape(atob(str))); }

// MODIFICADO: Lógica para incluir el icono de información dinámico y el manejo del popup de preguntas/respuestas
// NUEVO (8 septiembre): 3er parámetro catShowsDual — true si la pestaña actual tiene al menos
// un plato con precio de media ración (ver renderMenu). En ese caso este plato pinta SIEMPRE
// las dos columnas de precio (1/2 y Entero), aunque él en concreto no tenga media ración (se
// deja esa celda en blanco), para que la cabecera de columnas cuadre en todas las filas.
function generateItemHtml(item, isGuarni = false, catShowsDual = false) {
    // MODIFICADO (paridad con US Open): además del "Nombre // Detalle" de siempre (una sola
    // pareja de "//", usado para la uva de los vinos), ahora se admiten VARIAS palabras entre
    // "//.../ /" seguidas — cada una es una "opción" independiente (sabor, ingrediente...) que
    // se puede activar/desactivar por plato desde el editor (ver item.opcionesInactivas). OJO:
    // a propósito NO se filtran los trozos vacíos del split ANTES de separar nombre/opciones —
    // si se hiciera, un separador no vacío como " , " desplazaría la paridad par/impar y se
    // romperían las posiciones. Los índices IMPARES del split (1, 3, 5...) son siempre las
    // opciones; los PARES (0, 2, 4...) son el nombre y el texto de relleno entre opciones, que
    // se descarta.
    const processName = (text) => {
        if (!text) return { name: '', uvas: '', opciones: [] };
        const parts = text.split('//');
        const name = (parts[0] || '').trim();
        const opciones = [];
        for (let i = 1; i < parts.length; i += 2) {
            const tok = (parts[i] || '').trim();
            if (tok !== '') opciones.push(tok);
        }
        return { name, uvas: opciones[0] || '', opciones };
    };

    // NUEVO: texto final de la segunda línea — solo las opciones ACTIVAS (por posición
    // 1-based, misma lista para todos los idiomas), unidas por comas.
    const opcionesActivasTexto = (data) => {
        if (!data.opciones || data.opciones.length === 0) return '';
        const inactivas = item.opcionesInactivas || [];
        return data.opciones.filter((_, idx) => !inactivas.includes(idx + 1)).join(', ');
    };

    const currentData = processName(item[`nombre_${currentLang.toLowerCase()}`] || item.nombre_es);
    const secondaryData = processName(item.nombre_es);
    const currentOpcionesTexto = opcionesActivasTexto(currentData);
    const secondaryOpcionesTexto = opcionesActivasTexto(secondaryData);

    const price = (isGuarni && parseInt(item.id) < 6100) ? '' : (parseFloat(item.precio) > 0 ? `${parseFloat(item.precio).toFixed(2)}€` : '');
    // NUEVO (8 septiembre): precio de "1/2 ración" de ESTE plato en concreto ('' si no tiene).
    const priceMedia = parseFloat(item.precioMedia) > 0 ? `${parseFloat(item.precioMedia).toFixed(2)}€` : '';
    const alergenosHtml = item.alergenos.map(a => `<img src="imagenes/alergenos/${a}.webp" loading="lazy" onerror="this.style.display='none'">`).join('');  
     
    let photoIcon = ''; 
    let clickAction = ''; 
    let clickableStyle = '';

    if (!idsGlobalesDesactivados.has('fotos') && item.archivo && item.archivo.includes('01.webp')) {
        const base = `imagenes/${item.carpeta}/${item.archivo.split('01.webp')[0]}`;
        photoIcon = `<span class="emoji-photo">📸</span>`;
        clickAction = `onclick="openGallery('${base}')"`;
        clickableStyle = 'style="cursor: pointer;"';
    }

    // NUEVO: el plato ID 12990 (vino "El Tenista" en Sugerencias) muestra además una miniatura
    // FIJA y siempre visible en la propia fila (no detrás de un clic, no sustituye el sistema
    // de galería normal de arriba) — pequeña a propósito para no comerse la pantalla de
    // Sugerencias. Ver CSS .tenista-inline-thumb.
    // CORREGIDO: se añade ?v=timestamp a la URL para evitar que el navegador sirva una copia
    // cacheada antigua de la imagen tras reemplazarla en GitHub (Ctrl+F5 no siempre invalida
    // el caché de imágenes insertadas dinámicamente por JS).
    const tenistaThumbHtml = (!idsGlobalesDesactivados.has('fotos') && String(item.id) === '12990')
        ? `<div class="tenista-inline-thumb-wrapper"><img src="imagenes/vinos/tenista_pegado.webp?v=${TENISTA_IMG_CACHE_BUST}" class="tenista-inline-thumb" alt="" onclick="event.stopPropagation(); openTenistaImageLarge()" style="cursor:pointer;"></div>`
        : '';

    // NUEVO: Comprobar si existe información para el idioma actual y generar el icono correspondiente
    let infoIconHtml = '';
    const infoKey = `info_${currentLang.toLowerCase()}`;
    const infoData = item[infoKey];
    if (!idsGlobalesDesactivados.has('info') && infoData && infoData.trim() !== '') {
        // CORREGIDO: antes se escapaban las comillas a mano (' -> \' , " -> &quot;), pero si el
        // JSON ya traía una comilla interna escapada (\"), JS se comía la barra invertida al
        // evaluar el string y dejaba una comilla suelta -> JSON.parse fallaba en silencio y el
        // botón no hacía nada, solo en los platos cuyo texto llevaba una frase entrecomillada.
        // Base64 no tiene ese problema: no contiene comillas, apóstrofes ni barras invertidas.
        const b64Info = utf8ToB64(infoData);
        const infoClickHandler = `event.stopPropagation(); showInfoModal('${b64Info}')`;
        infoIconHtml = `<span class="emoji-info" onclick="${infoClickHandler}" title="Info">ℹ️</span>`;
    }

    // Lógica de ubicación del icono de info según las reglas solicitadas:
    // 1. Si existe foto, poner el icono de info justo al lado del icono de foto
    // 2. Si no existe foto pero hay descripción, ponerlo al final de la descripción
    // CORREGIDO: el nombre del plato debe mostrarse SIEMPRE; antes, cuando había foto, se sustituía por completo por los iconos
    const infoPlacement = `${currentData.name}${photoIcon ? ' ' + photoIcon : ''}${infoIconHtml ? ' ' + infoIconHtml : ''}`;

    // NUEVO (8 septiembre): con columnas dobles activas en la pestaña, cada fila pinta las dos
    // celdas de precio (1/2 y Entero) alineadas con la cabecera de renderMenu; si este plato en
    // concreto no tiene media ración se deja un guion en esa celda. Sin columnas dobles en la
    // pestaña, se mantiene el price-box de siempre (un único precio).
    const priceBoxHtml = catShowsDual
        ? `<div class="price-box price-box-dual"><span class="price-cell price-cell-half">${priceMedia}</span><span class="price-cell price-cell-full">${price}</span></div>`
        : `<div class="price-box">${price}</div>`;

    // NUEVO (8 septiembre): reestructurado en 2 líneas independientes para que la descripción y
    // los alérgenos puedan usar el ANCHO COMPLETO de la fila en vez de quedar apretados en la
    // columna que dejan libre los precios. Antes item-content (nombre+descripción+alérgenos) y
    // price-box compartían la misma fila flex, así que la descripción/alérgenos se veían
    // comprimidos por el hueco del precio en TODAS sus líneas, no solo en la del nombre.
    // Ahora: 1ª línea = nombre + precio(s) lado a lado; 2ª línea (ancho completo, sin el precio
    // al lado) = descripción/detalle, nombre en el idioma secundario, y alérgenos.
    const detailLineHtml = currentOpcionesTexto ? `<div class="item-detail-line">${currentOpcionesTexto}</div>` : '';
    const secondaryLineHtml = currentLang !== 'ES'
        ? `<div class="item-secondary-line">
               <span class="name-secondary">${secondaryData.name}</span>
               ${secondaryOpcionesTexto ? `<br><small class="item-detail-line-secondary">${secondaryOpcionesTexto}</small>` : ''}
           </div>`
        : '';

    // NUEVO (8 septiembre): notas informativas (ver NOTAS_INFORMATIVAS_IDS) — sin caja de precio
    // en absoluto (ni siquiera vacía), texto centrado a todo el ancho de la fila.
    const esNotaInformativa = NOTAS_INFORMATIVAS_IDS.includes(parseInt(item.id, 10));
    const topLineHtml = esNotaInformativa
        ? `<div class="item-top-line item-top-line-nota"><span class="name-selected nota-informativa-texto" ${clickAction} ${clickableStyle}>${infoPlacement}</span></div>`
        : `<div class="item-top-line"><span class="name-selected" ${clickAction} ${clickableStyle}>${infoPlacement}</span>${priceBoxHtml}</div>`;

    // NUEVO (8 septiembre): la nota informativa también centra su 2ª línea (el detalle "//.../ /",
    // el nombre en idioma secundario y los alérgenos) -- antes solo se centraba el nombre de la
    // 1ª línea, y el detalle se quedaba pegado a la izquierda igual que en un plato normal.
    const belowLineClass = esNotaInformativa ? 'item-below-line item-below-line-nota' : 'item-below-line';

    return `
    <div class="item-row">
        ${topLineHtml}
        <div class="${belowLineClass}" ${clickAction} ${clickableStyle}>
            ${detailLineHtml}
            ${secondaryLineHtml}
            <div class="alergenos-list">${alergenosHtml}</div>
        </div>
        ${tenistaThumbHtml}
    </div>`;
}

function managePreload() {
    currentPreloadSession++;
    const mySession = currentPreloadSession;
    isPreloading = false;
    preloadQueue = [];

    // NUEVO (27 agosto): si la opción global "Fotos" está desactivada, no tiene sentido
    // descargar en segundo plano fotos que el usuario nunca va a poder ver (generateItemHtml
    // ya oculta el icono/miniatura/galería en ese caso). Antes esta función ignoraba el
    // toggle y precargaba igualmente, gastando datos/batería sin ningún beneficio visible.
    // El incremento de currentPreloadSession de arriba ya invalida cualquier precarga que
    // estuviera en curso de una llamada anterior, así que basta con no encolar nada nuevo.
    if (idsGlobalesDesactivados.has('fotos')) {
        return;
    }

    const sortedData = [...allData].sort((a, b) => parseInt(a.id) - parseInt(b.id));

    // MODIFICADO (22 agosto, optimización de carga inicial): dos cambios respecto a antes.
    // (1) YA NO se precargan en segundo plano las fotos de TODAS las demás categorías (antes
    // "otherFoodItems") — con ~130 fotos en el repo eso disparaba varios megas de descarga
    // silenciosa justo tras el primer pintado aunque el usuario nunca llegara a abrir esas
    // secciones; ahora solo se precarga la categoría que se está viendo, y el resto se precarga
    // bajo demanda al cambiar de pestaña (filterCategory/changeLanguage ya llaman a
    // managePreload() en ese momento). (2) el nivel por defecto baja de 4 a 2 fotos por plato —
    // la mayoría no pasa de la 1ª/2ª foto de la galería; la 3ª y 4ª se comprueban bajo demanda
    // al abrir la galería (openGallery ya prueba sobre la marcha lo que falte, sin bloquear la
    // apertura). Los vinos se quedan igual que antes, en 1 sola foto precargada por botella.
    const addCategoryByLevels = (items, maxNivel = 2) => {
        const bases = items.map(item => `imagenes/${item.carpeta}/${item.archivo.split('01.webp')[0]}`);
        for (let level = 1; level <= maxNivel; level++) {
            bases.forEach(base => { preloadQueue.push({ base, n: level }); });
        }
    };

    const currentItems = sortedData.filter(i => isItemInCategory(i.id, currentCat) && i.archivo && i.activa === 'SI');
    const esCategoriaVinos = currentCat && currentCat.toString().startsWith('13');
    addCategoryByLevels(currentItems, esCategoriaVinos ? 1 : 2);

    processPreloadQueue(mySession);
}

async function processPreloadQueue(session) { 
    if (isPreloading) return; 
    isPreloading = true;

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && (conn.saveData || /2g|3g/.test(conn.effectiveType || ''))) {
        isPreloading = false;
        return;
    }

    while (preloadQueue.length > 0) { 
        if (session !== currentPreloadSession) { isPreloading = false; return; }  
        const task = preloadQueue.shift(); 
        const url = `${task.base}0${task.n}.webp`;

        if (task.n > 1) { 
            const prevUrl = `${task.base}0${task.n - 1}.webp`; 
            if (verifiedImages[prevUrl] === false) { verifiedImages[url] = false; continue; } 
        }

        if (verifiedImages[url] !== undefined) continue;

        await new Promise(resolve => setTimeout(resolve, 150));
        if (session !== currentPreloadSession) { isPreloading = false; return; }

        const success = await new Promise(resolve => { 
            const img = new Image(); 
            img.onload = () => resolve(true); 
            img.onerror = () => resolve(false); 
            img.src = url; 
        });

        verifiedImages[url] = success; 
    } 
    isPreloading = false;
}

// NUEVO: abre en grande la miniatura fija del plato ID 12990, reutilizando el mismo modal de
// fotos (ya tiene un tamaño responsive estándar: max-width 90% / max-height 80% de la
// pantalla, así en móvil se ajusta solo a un tamaño habitual sin desbordar). Es una sola foto,
// así que se ocultan las flechas de siguiente/anterior.
function openTenistaImageLarge() {
    const img = document.getElementById('modal-img');
    const prev = document.getElementById('prev-btn');
    const next = document.getElementById('next-btn');
    if (img) img.src = 'imagenes/vinos/tenista_pegado.webp?v=' + TENISTA_IMG_CACHE_BUST;
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';
    const modal = document.getElementById('photo-modal');
    if (modal) modal.style.display = 'flex';
}

async function openGallery(base) { 
    currentPreloadSession++;  
    currentGalleryPath = base;  
    currentPhotoIndex = 1;  
    maxPhotosFound = 1;

    updateModal(); 
    const modal = document.getElementById('photo-modal');
    if (modal) modal.style.display = 'flex';

    for (let i = 2; i <= 4; i++) { 
        const url = `${base}0${i}.webp`; 
        let exists = verifiedImages[url];

        if (exists === undefined) { 
            exists = await new Promise(r => {  
                const img = new Image();  
                img.onload = () => r(true);  
                img.onerror = () => r(false);  
                img.src = url;  
            }); 
            verifiedImages[url] = exists; 
        }

        if (exists) {  
            maxPhotosFound = i;  
            updateModal();  
        } else { 
            break;  
        } 
    } 
    processPreloadQueue(currentPreloadSession);
}

function updateModal() { 
    const img = document.getElementById('modal-img');
    const prev = document.getElementById('prev-btn');
    const next = document.getElementById('next-btn');

    if (img) img.src = `${currentGalleryPath}0${currentPhotoIndex}.webp`; 
    if (prev) prev.style.display = currentPhotoIndex > 1 ? 'block' : 'none'; 
    if (next) next.style.display = currentPhotoIndex < maxPhotosFound ? 'block' : 'none';
}

function changePhoto(n) { currentPhotoIndex += n; updateModal(); }
function closeModal() { const modal = document.getElementById('photo-modal'); if (modal) modal.style.display = 'none'; }

// NUEVO: Funcionalidad para mostrar el modal de información con preguntas y respuestas del plato
function showInfoModal(b64Str) {
    let data;
    try { 
        const jsonStr = b64ToUtf8(b64Str);
        data = JSON.parse(jsonStr); 
    } catch(e) { 
        console.error("Error al parsear info:", e); 
        return; 
    }

    let modal = document.getElementById('info-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'info-modal';
        document.body.appendChild(modal);
    }

    let html = `<div class="info-modal-content">
        <span class="close-modal" onclick="closeInfoModal()">&times;</span>
        <div class="info-desc">${data.desc || ''}</div>`;

    if (data.q1 && data.r1) html += `<div class="info-qa"><b>Q: ${data.q1}</b><br><span class="info-a">A: ${data.r1}</span></div>`;
    if (data.q2 && data.r2) html += `<div class="info-qa"><b>Q: ${data.q2}</b><br><span class="info-a">A: ${data.r2}</span></div>`;
    if (data.q3 && data.r3) html += `<div class="info-qa"><b>Q: ${data.q3}</b><br><span class="info-a">A: ${data.r3}</span></div>`;

    html += `</div>`;
    modal.innerHTML = html;
    modal.style.display = 'flex';
}

function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) modal.style.display = 'none';
}

// NUEVO (26 agosto): tiempo mínimo que se mantiene visible el indicador de "cargando idioma",
// aunque la respuesta llegue antes — para que en una red muy rápida no aparezca y desaparezca
// en un parpadeo casi imperceptible (peor sensación que no ponerlo, da la impresión de un tic).
const MIN_LOADING_VISIBLE_MS = 200;

// MODIFICADO (26 agosto): si el idioma elegido no es de los ya cargados (idioma del cliente, ES,
// o los esenciales), se pide bajo demanda al endpoint en vivo antes de renderizar. Antes, durante
// esa espera (los 1,5-3s típicos de latencia de Apps Script) no había NINGÚN cambio visible en
// los botones de idioma — solo se desactivaba el <select> de "Más...", así que pulsar un idioma
// del selector fijo (ES/EN/DE/FR/IT) podía dar la sensación de que el botón no había respondido.
// Ahora se muestra un anillo girando + el texto "cargando" traducido AL IDIOMA QUE SE PIDE (no al
// actual): si el idioma tiene botón fijo, el indicador sustituye el propio texto del botón; si
// viene del selector "Más...", se muestra como una pequeña píldora justo al lado (un <select>
// nativo no admite HTML dentro de sus opciones). Se bloquean todos los controles de idioma
// mientras dura la carga, para evitar dos peticiones solapadas si se pulsa dos veces seguidas.
async function changeLanguage(l) {
    if (!l) return;

    if (!isLangLoaded(l)) {
        const select = document.getElementById('more-langs');
        const btnEl = document.getElementById(`btn-${l}`);
        const textoCarga = LOADING_TEXTS[l] || LOADING_TEXTS['EN'];
        const spinnerHtml = `<span class="lang-spinner" aria-hidden="true"></span>${textoCarga}`;

        const originalBtnHtml = btnEl ? btnEl.innerHTML : null;
        let pillEl = null;

        document.querySelectorAll('#language-selector button').forEach(b => { b.disabled = true; });
        if (select) select.disabled = true;

        if (btnEl) {
            btnEl.innerHTML = spinnerHtml;
        } else if (select) {
            pillEl = document.createElement('span');
            pillEl.className = 'lang-loading-pill';
            pillEl.innerHTML = spinnerHtml;
            select.insertAdjacentElement('afterend', pillEl);
        }

        const inicioCarga = Date.now();
        let errorCarga = null;
        try {
            const nuevosItems = await fetchAndParseCsv([l]);
            mergeIntoAllData(nuevosItems);
        } catch (e) {
            errorCarga = e;
        }

        // NUEVO: fuerza el tiempo mínimo visible antes de quitar el indicador.
        const transcurrido = Date.now() - inicioCarga;
        if (transcurrido < MIN_LOADING_VISIBLE_MS) {
            await new Promise(r => setTimeout(r, MIN_LOADING_VISIBLE_MS - transcurrido));
        }

        if (btnEl && originalBtnHtml !== null) btnEl.innerHTML = originalBtnHtml;
        if (pillEl) pillEl.remove();
        document.querySelectorAll('#language-selector button').forEach(b => { b.disabled = false; });
        if (select) select.disabled = false;

        if (errorCarga) {
            console.error('Error cargando idioma bajo demanda:', errorCarga.message);
            return; // se queda en el idioma anterior si falla la descarga
        }
    }

    currentLang = l;
    updateLanguageUI();
    renderCategories();
    renderMenu();
    managePreload();
}

// NUEVO (28 agosto): la barra de categorías se puede arrastrar con el dedo/ratón, y al pulsar
// una pestaña que queda fuera de la parte visible de esa barra, el usuario perdía de vista cuál
// estaba activa (el resaltado oscuro de .cat-btn.active existe, pero de nada sirve si el propio
// botón está desplazado fuera de la pantalla). Esta función trae siempre de vuelta a la vista el
// botón de la categoría activa, sin mover el scroll vertical de la página (block:'nearest').
function scrollActiveCategoryIntoView() {
    const activeBtn = document.querySelector('#category-selector .cat-btn.active');
    if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

function filterCategory(id) {
    currentCat = id;
    renderCategories();
    renderMenu();
    window.scrollTo(0,0);
    managePreload();
    scrollActiveCategoryIntoView();
}

init();

window.addEventListener('hashchange', checkUrlHash);
window.addEventListener('DOMContentLoaded', checkUrlHash);

function checkUrlHash() { 
    const hash = window.location.hash.replace('#', ''); 
    if (hash && categoriesList.some(c => c.id === hash)) { filterCategory(hash); }
}

// NUEVO: Listener global para cerrar el modal de información al hacer clic fuera de él
document.addEventListener('click', function(e) {
    const modal = document.getElementById('info-modal');
    if (modal && e.target === modal) {
        closeInfoModal();
    }
});
