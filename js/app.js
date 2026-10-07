/**
 * ============================================================================
 * Ortek Proposal Studio - Ana Mantık (v2.9)
 * ============================================================================
 */

// Firebase Yapılandırması (Kullanıcının hesabı)
const firebaseConfig = {
  apiKey: "AIzaSyA2JuQyJuZG6TbYOzTmxfVJqadQZ90W1Vg",
  authDomain: "ortek-crm.firebaseapp.com",
  projectId: "ortek-crm",
  storageBucket: "ortek-crm.firebasestorage.app",
  messagingSenderId: "63670793010",
  appId: "1:63670793010:web:65160ef4d7fc5017075d2b",
  measurementId: "G-HKFTTG1BFD"
};

// Firebase Başlatma
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// Varsayılan Temiz Kalem Şablonu (Placeholder'lı ve Şeffaf Başlangıç)
const DEFAULT_ITEMS = [
  {
    title: "",
    marka: "",
    model: "",
    calismaAraligi: "",
    guc: "",
    cikis: "",
    extraDetails: "",
    customSpecs: [],
    qty: "",
    unitType: "Adet",
    isMeter: false,
    unitPrice: "",
    pricingCalc: {
      isOpen: false,
      mode: 'discount',
      listPrice: '',
      buyDiscount: '',
      sellDiscount: '',
      netCost: '',
      markupPercent: ''
    }
  }
];

class QuotationApp {
  constructor() {
    this.userFullProfiles = {
      'melih kurtgün': {
        preparedBy: 'Melih Kurtgün',
        signerRole: 'Makine Mühendisi',
        signerMobile: '+90 543 956 85 11',
        signerEmail: 'melih.kurtgun@ortek.com.tr',
        phsEmail: 'satisdestek@phspompa.com',
        pin: '1234'
      },
      'fatih yıldız': {
        preparedBy: 'Fatih Yıldız',
        signerRole: 'Satış Mühendisi',
        signerMobile: '+90 541 729 58 00',
        signerEmail: 'fatih.yildiz@ortek.com.tr',
        phsEmail: 'satisdestek@phspompa.com',
        pin: '1881'
      },
      'halil ibrahim çimen': {
        preparedBy: 'Halil İbrahim Çimen',
        signerRole: 'Satış Mühendisi',
        signerMobile: '+90 530 542 76 77',
        signerEmail: 'ibrahim.cimen@ortek.com.tr',
        phsEmail: 'satisdestek@phspompa.com',
        pin: '1907'
      },
      'enes altuğ': {
        preparedBy: 'Enes Altuğ',
        signerRole: 'Satış Mühendisi',
        signerMobile: '+90 533 303 10 81',
        signerEmail: 'enes@phspompa.com',
        phsEmail: 'enes@phspompa.com',
        pin: '1822'
      }
    };
    this.userPins = {
      'melih kurtgün': '2826',
      'fatih yıldız': '1881',
      'halil ibrahim çimen': '1907',
      'enes altuğ': '1822'
    };
    this.activeRateProvider = 'tcmb'; // 'tcmb' veya 'akbank'
    this.tcmbRates = {
      eur: 56.3657,
      usd: 48.5325,
      date: '08.09.2026',
      bulletinNo: '2026/168',
      isFetched: false
    };
    this.akbankRates = {
      eur: 56.8516,
      usd: 50.1250,
      date: '29.09.2026',
      isFetched: false
    };
    this.customRates = {
      eur: null,
      usd: null
    };
    this.calcSourceCurrency = 'EUR';
    this.calcVatMode = 'gross';
    this.customersData = [];
    this.initStorage();
    this.initState();
    this.bindDomElements();
    this.initEvents();
    this.restoreActiveDraft();
    this.render();
    this.checkFirstRun();
    this.initCloudSync();
    setTimeout(() => {
      this.fetchTcmbRates();
      this.fetchAkbankRates();
    }, 1000);
  }

  normalizeUserKey(name) {
    if (!name || typeof name !== 'string') return '';
    return name
      .trim()
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i');
  }

  getUserProfile(name) {
    if (!name || !this.userFullProfiles) return null;
    const targetNorm = this.normalizeUserKey(name);
    for (const [k, p] of Object.entries(this.userFullProfiles)) {
      if (this.normalizeUserKey(k) === targetNorm || (p && p.preparedBy && this.normalizeUserKey(p.preparedBy) === targetNorm)) {
        return p;
      }
    }
    return null;
  }

  getUserPin(name) {
    if (!name) return null;
    const p = this.getUserProfile(name);
    if (p && p.pin) return p.pin.toString().trim();
    const targetNorm = this.normalizeUserKey(name);
    if (this.userPins) {
      for (const [k, pin] of Object.entries(this.userPins)) {
        if (this.normalizeUserKey(k) === targetNorm) {
          return pin ? pin.toString().trim() : null;
        }
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Hafıza ve Başlangıç Durumu (LocalStorage Initialization)
  // --------------------------------------------------------------------------
  initStorage() {
    const oldQuotes = [
      { sfRef: '202600001', qRef: 'ORT-UNI14082026', to: 'Erzurum ESKİ', date: '14/08/2026', total: '€ 3.800,00', items: [{title: 'Xylem Grindex Minette'}], status: 'Reddedildi' },
      { sfRef: '202600002', qRef: 'ORT-UNI14082026', to: 'Yatağan Termik Santral', date: '14/08/2026', total: '€ 1.250,00', items: [{title: 'Xylem Lowara DOMO 15/B'}], status: 'Reddedildi' },
      { sfRef: '202600003', qRef: 'ORT-UNI14082026', to: 'ERDEMİR ÇELİK SERVİS MERKEZİ SAN. VE TİC. A.Ş.', date: '14/08/2026', total: '€ 2.250,00', items: [{title: 'Xylem Flygt MX 3069 HT 3~ 250'}, {title: 'Xylem Flygt Pedastal Seti'}], status: 'Onaylandı' },
      { sfRef: '202600004', qRef: 'ORT-UNI18082026', to: 'Bildik Pompa', date: '18/08/2026', total: '€ 230,00', items: [{title: 'Xylem Lowara DOC7/A ELP 220-240 50'}], status: 'Onaylandı' },
      { sfRef: '202600005', qRef: 'ORT-UNI31082026', to: 'ÜZÜMHANE MİMARLIK', date: '31/08/2026', total: '€ 5.400,00', items: [{title: 'Xylem Flygt Ready 8'}], status: 'Onaylandı' }
    ];
    
    let historyArr = this.getHistory();
    let hasChanges = false;

    // Sadece hafızada hiç olmayan eski teklifleri ekle (kullanıcının mevcut kayıtlarını veya durumlarını ASLA ezme)
    oldQuotes.forEach((q) => {
      const exists = historyArr.find(h => h.sfRef === q.sfRef);
      if (!exists) {
        const p = q.date.split('/');
        const dateISO = p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : new Date().toISOString().split('T')[0];
        const qd = {
          id: 'legacy_' + q.sfRef,
          sfRef: q.sfRef,
          qRef: q.qRef,
          date: q.date,
          dateISO: dateISO,
          customer: { to: q.to, enduser: '-', industry: '-' },
          items: q.items,
          remarksConfig: {},
          currency: 'EUR',
          activeCompany: 'ortek',
          grandTotal: q.total,
          savedAt: q.date + ' 10:00:00',
          preparedBy: 'Melih Kurtgün',
          signerMobile: '+90 543 956 85 11',
          signerEmail: 'melih.kurtgun@ortek.com.tr',
          endUser: '-',
          industry: '-',
          productGroups: q.items.map(i => i.title).join(', '),
          status: q.status
        };
        historyArr.push(qd);
        hasChanges = true;
      }
    });

    if (hasChanges || !localStorage.getItem('ortek_quotes_history')) {
      historyArr.sort((a, b) => b.sfRef.localeCompare(a.sfRef));
      localStorage.setItem('ortek_quotes_history', JSON.stringify(historyArr));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: historyArr });
      }
    }

    const currentCounter = parseInt(localStorage.getItem('ortek_sf_counter'), 10);
    if (!currentCounter || currentCounter < 6) {
      localStorage.setItem('ortek_sf_counter', '6');
    }
  }

  initState() {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const year = today.getFullYear();

    // Veritabanındaki teklifleri tara ve son işlemden sonraki numarayı belirle (Örn: en son 11 ise, sayaç 12)
    const history = this.getHistory();
    let maxCounter = 5;
    if (Array.isArray(history)) {
      history.forEach(q => {
        if (q.sfRef) {
          const cleanRef = q.sfRef.toString().replace(/R\d+$/i, '');
          const yearPrefix = cleanRef.substring(0, 4);
          if (yearPrefix === year.toString()) {
            const numPart = parseInt(cleanRef.substring(4), 10);
            if (!isNaN(numPart) && numPart > maxCounter) {
              maxCounter = numPart;
            }
          }
        }
      });
    }
    const counter = maxCounter + 1;
    localStorage.setItem('ortek_sf_counter', counter.toString());

    let preparedBy = localStorage.getItem('ortek_prepared_by') || '';
    let signerRole = localStorage.getItem('ortek_signer_role') || '';
    let signerMobile = localStorage.getItem('ortek_signer_mobile') || '';
    let signerEmail = localStorage.getItem('ortek_signer_email') || '';
    let phsSignerEmail = localStorage.getItem('ortek_phs_email') || 'satisdestek@phspompa.com';
    let securityPin = localStorage.getItem('ortek_security_pin') || '';

    // Eğer kullanıcı adı varsa ve varsayılan ekip profilinde kayıtlıysa eksik alanları tamamla
    if (preparedBy) {
      const known = this.getUserProfile(preparedBy);
      if (known) {
        if (!signerRole) signerRole = known.signerRole;
        if (!signerMobile) signerMobile = known.signerMobile;
        if (!signerEmail) signerEmail = known.signerEmail;
        if (!phsSignerEmail) phsSignerEmail = known.phsEmail;
        if (!securityPin) securityPin = known.pin;
      }
    }

    this.state = {
      activeCompany: 'ortek', // 'ortek' veya 'phs'
      language: 'tr',
      
      dateISO: todayISO, // YYYY-MM-DD
      salesForceYear: year,
      salesForceCounter: counter,
      baseSalesForceRef: this.formatSfRef(year, counter),
      
      // Revizyon Durumu
      isRevision: false,
      revisionLevel: 0, // 0 = Asıl Teklif, 1 = R1, 2 = R2, vb.

      // Dahili Referans Durumu
      hasInternalRef: false,
      internalRef: '',

      // Müşteri & Teklif Detayları (Temiz başlangıç, placeholder ile gösterim)
      customer: {
        to: '',
        address: '',
        attention: '',
        taxOffice: '',
        taxNumber: '',
        email: '',
        tel: '',
        subject: ''
      },

      // Hazırlayan / İletişim / İmza
      profile: {
        preparedBy: preparedBy,
        signerRole: signerRole,
        signerMobile: signerMobile,
        signerEmail: signerEmail,
        phsSignerEmail: phsSignerEmail,
        securityPin: securityPin
      },

      currency: 'EUR', // 'EUR', 'USD', 'TL'
      
      // Şartlar ve Koşullar (Remarks Alanları) - Şeffaf kutular, boşsa varsayılan metin kullanılır
      remarksConfig: {
        deliveryPlace: '',
        deliveryTime: '',
        validityDays: '',
        paymentTerms: '',
        scopeText: '',
        useAkbankRate: false
      },

      items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
      zoomLevel: 1.0,
      isPackagePrice: false,
      packagePrice: '',
      packageRowText: 'Proje Özel Fiyat',
      packageTotalText: 'Proje Özel Fiyat'
    };
  }

  // --------------------------------------------------------------------------
  // DOM Elemanlarını Bağlama
  // --------------------------------------------------------------------------
  bindDomElements() {
    // Üst Araç Butonları
    this.btnNewQuote = document.getElementById('btn-new-quote');
    this.btnQuickRev = document.getElementById('btn-quick-rev');
    this.btnPrint = document.getElementById('btn-print');
    this.btnProfileOpen = document.getElementById('btn-profile-open');
    this.btnHistoryOpen = document.getElementById('btn-history-open');
    this.btnCrmOpen = document.getElementById('btn-crm-open');
    this.headerUserName = document.getElementById('header-user-name');
    
    // CRM Modal & Elemanları
    this.modalCrm = document.getElementById('modal-crm');
    this.btnCloseCrm = document.getElementById('btn-close-crm');
    this.btnCloseCrmFooter = document.getElementById('btn-close-crm-footer');
    this.btnCrmExport = document.getElementById('btn-crm-export');
    this.crmTableBody = document.getElementById('crm-table-body');
    this.crmTotalCount = document.getElementById('crm-total-count');
    this.crmPendingCount = document.getElementById('crm-pending-count');
    this.crmWonEur = document.getElementById('crm-won-eur');
    this.crmWonUsd = document.getElementById('crm-won-usd');
    this.crmWonTry = document.getElementById('crm-won-try');
    this.crmFilterCompany = document.getElementById('crm-filter-company');
    this.crmFilterStatus = document.getElementById('crm-filter-status');
    this.crmFilterPreparedBy = document.getElementById('crm-filter-prepared-by');
    this.crmSearchInput = document.getElementById('crm-search-input');

    // Sol Form Alanları (1. Kart: Teklif & Ref)
    this.inputDate = document.getElementById('input-date');
    this.inputQuotationRef = document.getElementById('input-quotation-ref');
    this.inputSfRef = document.getElementById('input-sf-ref');
    this.sfCounterBadge = document.getElementById('sf-counter-badge');
    
    this.checkboxRevision = document.getElementById('checkbox-revision');
    this.revisionPanel = document.getElementById('revision-panel');
    this.revPillDisplay = document.getElementById('rev-pill-display');
    this.btnIncRev = document.getElementById('btn-inc-rev');
    this.btnDecRev = document.getElementById('btn-dec-rev');

    this.checkboxInternalRef = document.getElementById('checkbox-internal-ref');
    this.internalRefGroup = document.getElementById('internal-ref-group');
    this.inputInternalRef = document.getElementById('input-internal-ref');

    // 2. Kart: Müşteri Bilgileri
    this.inputTo = document.getElementById('input-to');
    this.inputEndUser = document.getElementById('input-enduser');
    this.chkEndUserSelf = document.getElementById('chk-enduser-self');
    this.inputIndustry = document.getElementById('input-industry');
    this.inputAddress = document.getElementById('input-address');
    this.inputTaxOffice = document.getElementById('input-tax-office');
    this.inputTaxNumber = document.getElementById('input-tax-number');
    this.inputAttention = document.getElementById('input-attention');
    this.inputTel = document.getElementById('input-tel');
    this.inputEmail = document.getElementById('input-email');
    this.inputSubject = document.getElementById('input-subject');
    this.btnSaveCustomerToDirectory = document.getElementById('btn-save-customer-to-directory');

    // Cari / Müşteri Otomatik Tamamlama & Cari Rehberi Elemanları
    this.btnOpenCustomersModal = document.getElementById('btn-open-customers-modal');
    this.btnSyncCustomersFromQuotes = document.getElementById('btn-sync-customers-from-quotes');
    this.customerAutocompleteDropdown = document.getElementById('customer-autocomplete-dropdown');
    this.modalCustomersDirectory = document.getElementById('modal-customers-directory');
    this.btnCloseCustomersDirectory = document.getElementById('btn-close-customers-directory');
    this.btnCloseCustomersFooter = document.getElementById('btn-close-customers-footer');
    this.inputSearchCustomers = document.getElementById('input-search-customers');
    this.customersTotalCount = document.getElementById('customers-total-count');
    this.customersTableBody = document.getElementById('customers-table-body');
    this.btnToggleAddCustomerForm = document.getElementById('btn-toggle-add-customer-form');
    this.txtToggleAddCustomer = document.getElementById('txt-toggle-add-customer');
    this.customerFormAccordion = document.getElementById('customer-form-accordion');
    this.customerFormTitle = document.getElementById('customer-form-title');
    this.btnCancelCustomerForm = document.getElementById('btn-cancel-customer-form');
    this.btnSaveCustomerForm = document.getElementById('btn-save-customer-form');
    this.custFormEditId = document.getElementById('cust-form-edit-id');
    this.custFormName = document.getElementById('cust-form-name');
    this.custFormAttention = document.getElementById('cust-form-attention');
    this.custFormTaxOffice = document.getElementById('cust-form-tax-office');
    this.custFormTaxNumber = document.getElementById('cust-form-tax-number');
    this.custFormTel = document.getElementById('cust-form-tel');
    this.custFormEmail = document.getElementById('cust-form-email');
    this.custFormIndustry = document.getElementById('cust-form-industry');
    this.custFormAddress = document.getElementById('cust-form-address');
    this.custFormEnduser = document.getElementById('cust-form-enduser');
    this.custFormSyncQuotes = document.getElementById('cust-form-sync-quotes');

    // 3. Kart: Hazırlayan & İmza Bilgileri (Sol Panel)
    this.sidebarPrepName = document.getElementById('sidebar-prep-name');
    this.sidebarPrepRole = document.getElementById('sidebar-prep-role');
    this.sidebarPrepMobile = document.getElementById('sidebar-prep-mobile');
    this.sidebarPrepEmail = document.getElementById('sidebar-prep-email');
    
    // Firma Seçimi (Ortek / PHS)
    this.companyRadios = document.querySelectorAll('input[name="activeCompany"]');
    this.languageRadios = document.querySelectorAll('input[name="activeLanguage"]');
    this.docLetterContent = document.getElementById('doc-letter-content');
    this.lblTo = document.getElementById('lbl-to');
    this.lblAddress = document.getElementById('lbl-address');
    this.lblDate = document.getElementById('lbl-date');
    this.lblQuotationRef = document.getElementById('lbl-quotation-ref');
    this.lblInternalRef = document.getElementById('lbl-internal-ref');
    this.lblSalesForceRef = document.getElementById('lbl-sales-force-ref');
    this.lblAttention = document.getElementById('lbl-attention');
    this.lblTel = document.getElementById('lbl-tel');
    this.lblEmail = document.getElementById('lbl-email');
    this.lblPreparedBy = document.getElementById('lbl-prepared-by');
    this.lblSubject = document.getElementById('lbl-subject');
    this.lblSignerName = document.getElementById('lbl-signer-name');
    this.lblSignerMobile = document.getElementById('lbl-signer-mobile');
    this.lblSignerEmail = document.getElementById('lbl-signer-email');
    
    // Modal & Ayarlar Elementleri Ekleri
    this.setupPhsEmail = document.getElementById('setup-phs-email');
    this.settingPhsEmail = document.getElementById('setting-phs-email');
    
    // Dinamik Arayüz Değişkenleri
    this.docCompanyShort = document.getElementById('doc-company-short');
    this.docAddressLine1 = document.getElementById('doc-address-line1');
    this.docAddressLine2 = document.getElementById('doc-address-line2');
    this.docAddressLine3 = document.getElementById('doc-address-line3');
    this.docCompanyTitle1 = document.getElementById('doc-company-title-1');
    this.docCompanyTitle2 = document.getElementById('doc-company-title-2');
    this.docLogoPage1 = document.getElementById('doc-logo-page1');
    this.docLogoPage2 = document.getElementById('doc-logo-page2');
    this.docLogoBoxRight = document.getElementById('doc-logo-box-right');
    this.phsLogoWrapperPage1 = document.getElementById('phs-logo-wrapper-page1');

    // 4. Kart: Kalemler, Proje Özel Fiyatı & Para Birimi
    this.selectCurrency = document.getElementById('select-currency');
    this.packagePriceBox = document.getElementById('package-price-box');
    this.checkPackagePrice = document.getElementById('check-package-price');
    this.packagePriceDetails = document.getElementById('package-price-details');
    this.packagePriceHeaderToggle = document.getElementById('package-price-header-toggle');
    this.btnPackageAccordion = document.getElementById('btn-package-accordion');
    this.packageLivePill = document.getElementById('package-live-pill');
    this.inputPackagePrice = document.getElementById('input-package-price');
    this.packageCurrencyLabel = document.getElementById('package-currency-label');
    this.inputPackageRowText = document.getElementById('input-package-row-text');
    this.inputPackageTotalText = document.getElementById('input-package-total-text');
    this.previewPackageGrandTotal = document.getElementById('preview-package-grand-total');
    this.itemsContainer = document.getElementById('items-container');
    this.btnAddItem = document.getElementById('btn-add-item');
    this.btnTemplateSondaj = document.getElementById('btn-template-sondaj');

    this.summarySubtotal = document.getElementById('summary-subtotal');
    this.summaryVat = document.getElementById('summary-vat');
    this.summaryGrandtotal = document.getElementById('summary-grandtotal');

    // 5. Kart: Şartlar ve Koşullar (Remarks)
    this.inputRemarkDeliveryPlace = document.getElementById('input-remark-delivery-place');
    this.inputRemarkDeliveryTime = document.getElementById('input-remark-delivery-time');
    this.inputRemarkValidityDays = document.getElementById('input-remark-validity-days');
    this.inputRemarkPayment = document.getElementById('input-remark-payment');
    this.inputRemarkScope = document.getElementById('input-remark-scope');
    this.btnToggleScopeShipping = document.getElementById('btn-toggle-scope-shipping');

    this.btnToggleRemarks = document.getElementById('btn-toggle-remarks');
    this.remarksEditorWrapper = document.getElementById('remarks-editor-wrapper');
    this.inputRemarks = document.getElementById('input-remarks');
    this.btnResetRemarks = document.getElementById('btn-reset-remarks');
    this.checkboxAkbankRate = document.getElementById('checkbox-akbank-rate');
    this.badgeAkbankRateStatus = document.getElementById('badge-akbank-rate-status');

    // Sağ Belge Sayfası 1 Elemanları
    this.docTo = document.getElementById('doc-to');
    this.docAddress = document.getElementById('doc-address');
    this.docAttention = document.getElementById('doc-attention');
    this.docPreparedByPage1 = document.getElementById('doc-prepared-by-page1');
    this.docEmail = document.getElementById('doc-email');
    this.docTel = document.getElementById('doc-tel');
    this.docDate = document.getElementById('doc-date');
    this.docQuotationRef = document.getElementById('doc-quotation-ref');
    this.docInternalRefRow = document.getElementById('doc-internal-ref-row');
    this.docInternalRef = document.getElementById('doc-internal-ref');
    this.docSfRef = document.getElementById('doc-sf-ref');
    this.docSubject = document.getElementById('doc-subject');
    this.docSalutation = document.getElementById('doc-salutation');
    this.docSignerBoxClickable = document.getElementById('doc-signer-box-clickable');
    this.docSignerName = document.getElementById('doc-signer-name');
    this.docSignerMobile = document.getElementById('doc-signer-mobile');
    this.docSignerEmail = document.getElementById('doc-signer-email');
    this.docSignerTitle = document.getElementById('doc-signer-title');

    // Sağ Belge Sayfası 2 Elemanları
    this.doc2Date = document.getElementById('doc2-date');
    this.doc2Ref = document.getElementById('doc2-ref');
    this.doc2From = document.getElementById('doc2-from');
    this.doc2PreparedBy = document.getElementById('doc2-prepared-by');
    this.thUnitPrice = document.getElementById('th-unit-price');
    this.thTotalPrice = document.getElementById('th-total-price');
    this.docTableBody = document.getElementById('doc-table-body');
    this.docRemarksList = document.getElementById('doc-remarks-list');
    this.doc2SignerTitle = document.getElementById('doc2-signer-title');

    // Zoom & Önizleme
    this.docContainer = document.getElementById('document-container');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomFit = document.getElementById('btn-zoom-fit');
    this.zoomIndicator = document.getElementById('zoom-indicator');

    // Modallar
    this.modalInitial = document.getElementById('modal-initial-setup');
    this.btnSaveInitial = document.getElementById('btn-save-initial-setup');
    this.setupPreparedBy = document.getElementById('setup-prepared-by');
    this.setupSignerRole = document.getElementById('setup-signer-role');
    this.setupSignerMobile = document.getElementById('setup-signer-mobile');
    this.setupSignerEmail = document.getElementById('setup-signer-email');

    this.modalProfile = document.getElementById('modal-profile');
    this.btnCloseProfile = document.getElementById('btn-close-profile');
    this.btnCancelProfile = document.getElementById('btn-cancel-profile');
    this.btnSaveProfile = document.getElementById('btn-save-profile');
    this.settingPreparedBy = document.getElementById('setting-prepared-by');
    this.settingSignerRole = document.getElementById('setting-signer-role');
    this.settingSignerMobile = document.getElementById('setting-signer-mobile');
    this.settingSignerEmail = document.getElementById('setting-signer-email');
    this.settingSfCounter = document.getElementById('setting-sf-counter');

    this.modalHistory = document.getElementById('modal-history');
    this.btnCloseHistory = document.getElementById('btn-close-history');
    this.btnCloseHistoryFooter = document.getElementById('btn-close-history-footer');
    this.btnSaveCurrentQuote = document.getElementById('btn-save-current-quote');
    this.historyListContainer = document.getElementById('history-list-container');
    this.historySearchInput = document.getElementById('history-search-input');
    this.editingOriginalSfRef = null;

    this.modalCrmNotes = document.getElementById('modal-crm-notes');
    this.btnCloseCrmNotes = document.getElementById('btn-close-crm-notes');
    this.btnCloseCrmNotesFooter = document.getElementById('btn-close-crm-notes-footer');
    this.btnSaveCrmNote = document.getElementById('btn-save-crm-note');
    this.inputNewCrmNote = document.getElementById('input-new-crm-note');
    this.notesListContainer = document.getElementById('notes-list-container');
    this.notesModalRef = document.getElementById('notes-modal-ref');
    this.notesModalCustomer = document.getElementById('notes-modal-customer');
    this.notesModalTotal = document.getElementById('notes-modal-total');
    this.notesModalStatus = document.getElementById('notes-modal-status');
    this.notesCountDisplay = document.getElementById('notes-count-display');
    this.notesCurrentAuthor = document.getElementById('notes-current-author');
    this.activeNotesQuoteRef = null;

    this.modalConfirmDelete = document.getElementById('modal-confirm-delete');
    this.btnCloseConfirmDelete = document.getElementById('btn-close-confirm-delete');
    this.btnCancelConfirmDelete = document.getElementById('btn-cancel-confirm-delete');
    this.btnSubmitConfirmDelete = document.getElementById('btn-submit-confirm-delete');
    this.confirmDeleteRef = document.getElementById('confirm-delete-ref');
    this.confirmDeleteCustomer = document.getElementById('confirm-delete-customer');
    this.confirmDeleteTotal = document.getElementById('confirm-delete-total');
    this.pendingDeleteQuote = null;

    // Sondaj Teklifi Şablon Modalı
    this.modalConfirmSondaj = document.getElementById('modal-confirm-sondaj');
    this.btnCloseSondajModal = document.getElementById('btn-close-sondaj-modal');
    this.btnCancelSondaj = document.getElementById('btn-cancel-sondaj');
    this.btnClearSondaj = document.getElementById('btn-clear-sondaj');
    this.btnConfirmSondajApply = document.getElementById('btn-confirm-sondaj-apply');
    this.sondajModalWarning = document.getElementById('sondaj-modal-warning');
    this.previousItemsBeforeTemplate = null;
    this.setupSecurityPin = document.getElementById('setup-security-pin');
    this.settingSecurityPin = document.getElementById('setting-security-pin');
    this.deletePinContainer = document.getElementById('delete-pin-container');
    this.deleteAuthorName = document.getElementById('delete-author-name');
    this.inputDeletePin = document.getElementById('input-delete-pin');
    this.userPins = this.userPins || {};
    this.profileActiveUserBadge = document.getElementById('profile-active-user-badge');
    this.userSwitchList = document.getElementById('user-switch-list');
    this.userSwitchPinArea = document.getElementById('user-switch-pin-area');
    this.userSwitchTargetLabel = document.getElementById('user-switch-target-label');
    this.userSwitchPinInput = document.getElementById('user-switch-pin-input');
    this.btnConfirmUserSwitch = document.getElementById('btn-confirm-user-switch');
    this.btnCancelUserSwitch = document.getElementById('btn-cancel-user-switch');
    this.btnNewUserForm = document.getElementById('btn-new-user-form');
    this.pendingSwitchUser = null;
    this.btnNotifBell = document.getElementById('btn-notifications-bell');
    this.notifBadge = document.getElementById('notif-badge');
    this.notifDropdown = document.getElementById('notifications-dropdown');
    this.notifItemsList = document.getElementById('notif-items-list');
    this.btnClearAllNotifs = document.getElementById('btn-clear-all-notifs');
    this.floatingNotifContainer = document.getElementById('floating-desktop-notif-container');
    this.userNotifications = [];
    this.lastKnownNotifTime = parseInt(localStorage.getItem('ortek_last_notif_time') || '0', 10);

    // Ekip Canlı Mesajlaşma DOM Elemanları & Durum
    this.btnTeamChatOpen = document.getElementById('btn-team-chat-open');
    this.modalTeamChat = document.getElementById('modal-team-chat');
    this.btnCloseTeamChat = document.getElementById('btn-close-team-chat');
    this.chatUsersList = document.getElementById('chat-users-list');
    this.chatUsersSearchInput = document.getElementById('chat-users-search-input');
    this.chatActiveUserName = document.getElementById('chat-active-user-name');
    this.chatActiveUserStatus = document.getElementById('chat-active-user-status');
    this.chatMessagesContainer = document.getElementById('chat-messages-container');
    this.chatComposerForm = document.getElementById('chat-composer-form');
    this.inputTeamChatMsg = document.getElementById('input-team-chat-msg');
    this.btnSendTeamChat = document.getElementById('btn-send-team-chat');
    this.chatTotalBadge = document.getElementById('chat-total-badge');
    this.teamChatPartner = null;
    this.teamMessages = [];
    this.teamUsers = [];
    this.userPresenceMap = {};

    // Geçerlilik Süresi Takip & Hatırlatma Elemanları
    this.expiryBanner = document.getElementById('expiry-reminder-banner');
    this.expiryBannerCount = document.getElementById('expiry-banner-count');
    this.btnBannerOpenNotifs = document.getElementById('btn-banner-open-notifs');
    this.btnBannerClose = document.getElementById('btn-banner-close');
    this.modalExpiryReminders = document.getElementById('modal-expiry-reminders');
    this.btnCloseExpiryModal = document.getElementById('btn-close-expiry-modal');
    this.btnCloseExpiryFooter = document.getElementById('btn-close-expiry-footer');
    this.expiryModalList = document.getElementById('expiry-modal-list');
    this.expiryModalSubtitle = document.getElementById('expiry-modal-subtitle');
    this.validityReminders = [];
    this.isExpiryBannerDismissed = false;

    this.toastContainer = document.getElementById('toast-container');

    // Kur Hesaplayıcı DOM Elemanları (TCMB & Akbank)
    this.btnOpenCurrencyCalc = document.getElementById('btn-open-currency-calc');
    this.btnCurrencyCalcLabel = document.getElementById('btn-currency-calc-label');
    this.btnCurrencyCalcPulse = document.getElementById('btn-currency-calc-pulse');
    this.modalCurrencyCalc = document.getElementById('modal-currency-calc');
    this.btnCloseCurrencyCalc = document.getElementById('btn-close-currency-calc');
    this.btnCloseCurrencyCalcFooter = document.getElementById('btn-close-currency-calc-footer');
    this.calcHeaderIconBox = document.getElementById('calc-header-icon-box');
    this.calcModalTitleWrap = document.getElementById('calc-modal-title-wrap');
    this.calcModalTitle = document.getElementById('calc-modal-title');
    this.calcModalSubtitle = document.getElementById('calc-modal-subtitle');
    this.btnSourceTcmb = document.getElementById('btn-source-tcmb');
    this.btnSourceAkbank = document.getElementById('btn-source-akbank');
    this.calcBulletinIcon = document.getElementById('calc-bulletin-icon');
    this.calcTcmbBulletinInfo = document.getElementById('calc-tcmb-bulletin-info');
    this.btnRefreshTcmbRates = document.getElementById('btn-refresh-tcmb-rates');
    this.btnRefreshRatesText = document.getElementById('btn-refresh-rates-text');
    this.lblRateEur = document.getElementById('lbl-rate-eur');
    this.lblRateUsd = document.getElementById('lbl-rate-usd');
    this.inputRateEur = document.getElementById('input-rate-eur');
    this.inputRateUsd = document.getElementById('input-rate-usd');
    this.badgeRateEur = document.getElementById('badge-rate-eur');
    this.badgeRateUsd = document.getElementById('badge-rate-usd');
    this.btnResetTcmbRates = document.getElementById('btn-reset-tcmb-rates');
    this.calcModalFooterNote = document.getElementById('calc-modal-footer-note');
    this.inputCalcAmount = document.getElementById('input-calc-amount');
    this.calcCurrencyToggles = document.querySelectorAll('#calc-currency-toggles .btn-currency-toggle');
    this.selectCalcVat = document.getElementById('select-calc-vat');
    this.thCalcVatCol = document.getElementById('th-calc-vat-col');
    this.btnCalcQuoteSubtotal = document.getElementById('btn-calc-quote-subtotal');
    this.badgeQuoteSubtotalPreview = document.getElementById('badge-quote-subtotal-preview');
    this.calcResultsTbody = document.getElementById('calc-results-tbody');

    // Marka Alış İskonto Oranları DOM Elemanları
    this.btnOpenBrandDiscounts = document.getElementById('btn-open-brand-discounts');
    this.modalBrandDiscounts = document.getElementById('modal-brand-discounts');
    this.btnCloseBrandDiscounts = document.getElementById('btn-close-brand-discounts');
    this.btnCloseBrandDiscountsFooter = document.getElementById('btn-close-brand-discounts-footer');
    this.inputSearchBrandDiscounts = document.getElementById('input-search-brand-discounts');
    this.btnViewAllDiscountHistory = document.getElementById('btn-view-all-discount-history');
    this.btnOpenAddBrand = document.getElementById('btn-open-add-brand');
    this.brandDiscountsList = document.getElementById('brand-discounts-list');
    this.brandDiscountsCounter = document.getElementById('brand-discounts-counter');

    // Kademeli Marka Detay Modalı DOM Elemanları
    this.modalTierDiscounts = document.getElementById('modal-tier-discounts');
    this.tierModalBrandTitle = document.getElementById('tier-modal-brand-title');
    this.btnCloseTierDiscounts = document.getElementById('btn-close-tier-discounts');
    this.btnCloseTierDiscountsFooter = document.getElementById('btn-close-tier-discounts-footer');
    this.tierItemsTableContainer = document.getElementById('tier-items-table-container');
    this.btnAddNewTierRow = document.getElementById('btn-add-new-tier-row');
    this.btnSaveTierDiscounts = document.getElementById('btn-save-tier-discounts');
    this.selectedTierBrandId = null;

    // İskonto Güvenlik & PIN Onay Modalı DOM Elemanları
    this.modalConfirmDiscountPin = document.getElementById('modal-confirm-discount-pin');
    this.btnCloseDiscountPin = document.getElementById('btn-close-discount-pin');
    this.btnCancelDiscountPin = document.getElementById('btn-cancel-discount-pin');
    this.btnSubmitDiscountPin = document.getElementById('btn-submit-discount-pin');
    this.inputDiscountPin = document.getElementById('input-discount-pin');
    this.btnToggleDiscountPin = document.getElementById('btn-toggle-discount-pin');
    this.discountPinError = document.getElementById('discount-pin-error');
    this.discountPinTargetName = document.getElementById('discount-pin-target-name');
    this.discountPinOldVal = document.getElementById('discount-pin-old-val');
    this.discountPinNewVal = document.getElementById('discount-pin-new-val');
    this.discountPinDiffRow = document.getElementById('discount-pin-diff-row');
    this.discountPinCustomDesc = document.getElementById('discount-pin-custom-desc');
    this.discountPinAuthor = document.getElementById('discount-pin-author');
    this.discountPinCallback = null;
    this.discountPinCancelCallback = null;

    // Değişiklik Geçmişi Modalı DOM Elemanları
    this.modalDiscountHistory = document.getElementById('modal-discount-history');
    this.btnCloseDiscountHistory = document.getElementById('btn-close-discount-history');
    this.btnCloseDiscountHistoryFooter = document.getElementById('btn-close-discount-history-footer');
    this.selectHistoryBrandFilter = document.getElementById('select-history-brand-filter');
    this.historyModalFilterBadge = document.getElementById('history-modal-filter-badge');
    this.discountHistoryTimelineContainer = document.getElementById('discount-history-timeline-container');
    this.historyTotalCount = document.getElementById('history-total-count');

    // Yeni Marka Ekle Modalı DOM Elemanları
    this.modalAddBrand = document.getElementById('modal-add-brand');
    this.btnCloseAddBrand = document.getElementById('btn-close-add-brand');
    this.btnCancelAddBrand = document.getElementById('btn-cancel-add-brand');
    this.btnSubmitAddBrand = document.getElementById('btn-submit-add-brand');
    this.inputNewBrandName = document.getElementById('input-new-brand-name');
    this.inputNewBrandRate = document.getElementById('input-new-brand-rate');
    this.groupNewBrandSingleRate = document.getElementById('group-new-brand-single-rate');
    this.groupNewBrandTieredHint = document.getElementById('group-new-brand-tiered-hint');

    this.brandDiscounts = [];
    this.discountHistory = [];
    this.initBrandDiscounts();

    // Geçerlilik Hatırlatması Başlatma
    setTimeout(() => {
      this.checkValidityReminders();
    }, 500);
    if (this.validityCheckInterval) clearInterval(this.validityCheckInterval);
    this.validityCheckInterval = setInterval(() => this.checkValidityReminders(), 300000);
  }

  setupBackdropClose(modalElement, closeCallback) {
    if (!modalElement) return;
    let isMouseDownOnBackdrop = false;
    modalElement.addEventListener('mousedown', (e) => {
      isMouseDownOnBackdrop = (e.target === modalElement);
    });
    modalElement.addEventListener('mouseup', (e) => {
      if (isMouseDownOnBackdrop && e.target === modalElement) {
        closeCallback();
      }
      isMouseDownOnBackdrop = false;
    });
  }

  // --------------------------------------------------------------------------
  // Olay Dinleyicileri (Event Listeners)
  // --------------------------------------------------------------------------
  initEvents() {
    // Genel Canlı Taslak Kaydı (Kullanıcı herhangi bir alana yazdığında veya değiştirdiğinde anında otomatik koruma)
    document.addEventListener('input', () => this.autoSaveDraft());
    document.addEventListener('change', () => this.autoSaveDraft());

    // Tarih Değişimi
    this.inputDate.addEventListener('input', (e) => {
      this.state.dateISO = e.target.value;
      this.syncDateAndRef();
      this.renderPreview();
    });

    // Quotation Ref Manuel Değişimi
    this.inputQuotationRef.addEventListener('input', (e) => {
      this.renderPreview();
    });

    // Sales Force Ref Manuel Değişimi
    this.inputSfRef.addEventListener('input', (e) => {
      this.state.baseSalesForceRef = e.target.value.replace(/R\d+$/i, '');
      this.renderPreview();
    });

    // Revizyon Kutucuğu Değişimi
    this.checkboxRevision.addEventListener('change', (e) => {
      this.state.isRevision = e.target.checked;
      if (this.state.isRevision && this.state.revisionLevel === 0) {
        this.state.revisionLevel = 1;
      } else if (!this.state.isRevision) {
        this.state.revisionLevel = 0;
      }
      this.revisionPanel.style.display = this.state.isRevision ? 'flex' : 'none';
      this.updateRevisionUI();
      this.renderPreview();
    });

    // Revizyon Artır / Azalt Butonları
    this.btnIncRev.addEventListener('click', () => {
      this.state.revisionLevel += 1;
      this.state.isRevision = true;
      this.checkboxRevision.checked = true;
      this.revisionPanel.style.display = 'flex';
      this.updateRevisionUI();
      this.renderPreview();
      this.showToast(`Revizyon seviyesi R${this.state.revisionLevel} olarak güncellendi!`, 'warning');
    });

    this.btnDecRev.addEventListener('click', () => {
      if (this.state.revisionLevel > 1) {
        this.state.revisionLevel -= 1;
      } else {
        this.state.revisionLevel = 0;
        this.state.isRevision = false;
        this.checkboxRevision.checked = false;
        this.revisionPanel.style.display = 'none';
      }
      this.updateRevisionUI();
      this.renderPreview();
    });

    // Üst Bar Hızlı Revizyon Ekleme Butonu
    this.btnQuickRev.addEventListener('click', () => {
      if (!this.state.isRevision) {
        this.state.isRevision = true;
        this.state.revisionLevel = 1;
        this.checkboxRevision.checked = true;
        this.revisionPanel.style.display = 'flex';
      } else {
        this.state.revisionLevel += 1;
      }
      this.updateRevisionUI();
      this.renderPreview();
      this.showToast(`Revizyon eklendi: R${this.state.revisionLevel}`, 'warning');
    });

    // Dahili Ref No Kutucuğu
    this.checkboxInternalRef.addEventListener('change', (e) => {
      this.state.hasInternalRef = e.target.checked;
      this.internalRefGroup.style.display = this.state.hasInternalRef ? 'block' : 'none';
      if (!this.state.hasInternalRef) {
        this.inputInternalRef.value = '';
      }
      this.renderPreview();
    });

    this.inputInternalRef.addEventListener('input', () => {
      this.renderPreview();
    });

    // Müşteri Bilgileri Dinleyicileri
    const customerInputs = [
      { el: this.inputTo, key: 'to' },
      { el: this.inputEndUser, key: 'enduser' },
      { el: this.inputIndustry, key: 'industry' },
      { el: this.inputAddress, key: 'address' },
      { el: this.inputTaxOffice, key: 'taxOffice' },
      { el: this.inputTaxNumber, key: 'taxNumber' },
      { el: this.inputAttention, key: 'attention' },
      { el: this.inputTel, key: 'tel' },
      { el: this.inputEmail, key: 'email' },
      { el: this.inputSubject, key: 'subject' }
    ];

    customerInputs.forEach(({ el, key }) => {
      if (el) {
        el.addEventListener('input', (e) => {
          let val = e.target.value;
          if (key === 'tel') {
            const digits = val.replace(/\D/g, '');
            const isFull = (digits.startsWith('0') && digits.length === 11) ||
                          (!val.startsWith('0') && !val.startsWith('+') && digits.length === 10) ||
                          (val.startsWith('+90') && digits.length === 12);
            if (isFull && !val.includes(' ')) {
              const formatted = this.formatPhoneNumber(val);
              if (formatted !== val) {
                e.target.value = formatted;
                val = formatted;
              }
            }
          }
          this.state.customer[key] = val;
          this.renderPreview();
        });
        if (key === 'tel') {
          el.addEventListener('paste', () => {
            setTimeout(() => {
              const formatted = this.formatPhoneNumber(el.value);
              if (formatted !== el.value) {
                el.value = formatted;
                this.state.customer.tel = formatted;
                this.renderPreview();
              }
            }, 10);
          });
          el.addEventListener('blur', (e) => {
            const formatted = this.formatPhoneNumber(e.target.value);
            if (formatted !== e.target.value) {
              e.target.value = formatted;
              this.state.customer.tel = formatted;
              this.renderPreview();
            }
          });
        }
      }
    });

    if (this.btnSaveCustomerToDirectory) {
      this.btnSaveCustomerToDirectory.addEventListener('click', () => {
        this.saveCustomerDirectlyFromEditor();
      });
    }

    // Son Kullanıcı "Kendisi" Mantığı
    if (this.chkEndUserSelf && this.inputEndUser && this.inputTo) {
      this.chkEndUserSelf.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.inputEndUser.value = this.inputTo.value;
          this.inputEndUser.disabled = true;
          this.state.customer['enduser'] = this.inputTo.value;
        } else {
          this.inputEndUser.disabled = false;
        }
        this.renderPreview();
      });

      this.inputTo.addEventListener('input', (e) => {
        if (this.chkEndUserSelf.checked) {
          this.inputEndUser.value = e.target.value;
          this.state.customer['enduser'] = e.target.value;
          this.renderPreview();
        }
      });
    }

    // Hazırlayan / İmza Bilgileri (Sol Panel Hızlı Düzenleme & Anında LocalStorage Kaydı)
    const profileInputs = [
      { el: this.sidebarPrepName, key: 'preparedBy', storageKey: 'ortek_prepared_by' },
      { el: this.sidebarPrepRole, key: 'signerRole', storageKey: 'ortek_signer_role' },
      { el: this.sidebarPrepMobile, key: 'signerMobile', storageKey: 'ortek_signer_mobile' },
      { el: this.sidebarPrepEmail, key: 'signerEmail', storageKey: 'ortek_signer_email' }
    ];

    profileInputs.forEach(({ el, key, storageKey }) => {
      if (!el) return;
      el.addEventListener('input', (e) => {
        let val = e.target.value;
        if (key === 'signerMobile') {
          const digits = val.replace(/\D/g, '');
          const isFull = (digits.startsWith('0') && digits.length === 11) ||
                        (!val.startsWith('0') && !val.startsWith('+') && digits.length === 10) ||
                        (val.startsWith('+90') && digits.length === 12);
          if (isFull && !val.includes(' ')) {
            const formatted = this.formatPhoneNumber(val);
            if (formatted !== val) {
              e.target.value = formatted;
              val = formatted;
            }
          }
        }
        this.state.profile[key] = val;
        localStorage.setItem(storageKey, val);
        this.renderPreview();
      });
      if (key === 'signerMobile') {
        el.addEventListener('paste', () => {
          setTimeout(() => {
            const formatted = this.formatPhoneNumber(el.value);
            if (formatted !== el.value) {
              el.value = formatted;
              this.state.profile[key] = formatted;
              localStorage.setItem(storageKey, formatted);
              this.renderPreview();
            }
          }, 10);
        });
        el.addEventListener('blur', (e) => {
          const formatted = this.formatPhoneNumber(e.target.value);
          if (formatted !== e.target.value) {
            e.target.value = formatted;
            this.state.profile[key] = formatted;
            localStorage.setItem(storageKey, formatted);
            this.renderPreview();
          }
        });
      }
    });

    // Firma (Ortek / PHS) Değişimi
    if (this.companyRadios) {
      this.companyRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.state.activeCompany = e.target.value;
          const currentQRef = this.inputQuotationRef.value.trim();
          if (!currentQRef || currentQRef.startsWith('ORT-UNI') || currentQRef.startsWith('PHS-UNI')) {
            this.inputQuotationRef.value = this.generateQuotationRef(this.state.dateISO);
          }
          this.renderPreview();
          this.renderRemarks();
        });
      });
    }

    // Dil (TR / EN) Değişimi
    if (this.languageRadios) {
      this.languageRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.state.language = e.target.value;
          localStorage.setItem('ortek_language', e.target.value);
          this.customRemarksList = null;

          // Standart nakliye kapsamı metnini yeni dile uyarla
          const curScope = (this.inputRemarkScope ? this.inputRemarkScope.value : '').trim();
          if (this.state.language === 'en') {
            if (curScope.includes('dâhil değildir') || curScope.includes('dahil değildir') || !curScope) {
              if (curScope.includes('nakliye dâhil') || curScope.includes('nakliye dahil')) {
                this.state.remarksConfig.scopeText = 'Prices include freight/shipping; insurance, assembly, commissioning and supervision services are not included.';
                if (this.inputRemarkScope) this.inputRemarkScope.value = this.state.remarksConfig.scopeText;
              } else if (curScope) {
                this.state.remarksConfig.scopeText = 'Prices do not include freight, insurance, assembly, commissioning and supervision services.';
                if (this.inputRemarkScope) this.inputRemarkScope.value = this.state.remarksConfig.scopeText;
              }
            }
          } else {
            if (curScope.includes('are not included') || curScope.includes('Prices include') || !curScope) {
              if (curScope.includes('Prices include')) {
                this.state.remarksConfig.scopeText = 'Fiyatlarımıza nakliye dâhil; sigorta, montaj, işletmeye alma ve süpervizyon hizmetleri dâhil değildir.';
                if (this.inputRemarkScope) this.inputRemarkScope.value = this.state.remarksConfig.scopeText;
              } else if (curScope) {
                this.state.remarksConfig.scopeText = 'Fiyatlarımıza nakliye, sigorta, montaj, işletmeye alma ve süpervizyon hizmetleri dâhil değildir.';
                if (this.inputRemarkScope) this.inputRemarkScope.value = this.state.remarksConfig.scopeText;
              }
            }
          }

          if (this.btnTemplateSondaj) {
            const span = this.btnTemplateSondaj.querySelector('span');
            if (span) {
              span.textContent = (this.state.language === 'en') ? '🌊 Drilling Proposal' : '🌊 Sondaj Teklifi';
            }
            this.btnTemplateSondaj.title = (this.state.language === 'en')
              ? 'Automatically loads 8 standard Drilling Proposal item titles'
              : '8 kalemlik standart Sondaj Teklifi ürün başlıklarını otomatik yükler';
          }

          this.renderPreview();
          this.renderRemarks();
          this.showToast(this.state.language === 'tr' ? 'Teklif dili Türkçe olarak güncellendi.' : 'Quotation language set to English.', 'info');
        });
      });
    }

    // Belge Üzerindeki İmzaya Tıklayınca Profil Modalı / Düzenleme Aç
    if (this.docSignerBoxClickable) {
      this.docSignerBoxClickable.addEventListener('click', () => {
        this.openProfileModal();
      });
    }

    if (this.docPreparedByPage1) {
      this.docPreparedByPage1.addEventListener('click', () => {
        this.openProfileModal();
      });
    }

    // Para Birimi Değişimi (EUR / USD / TL)
    this.selectCurrency.addEventListener('change', (e) => {
      this.state.currency = e.target.value;
      this.updateCurrencyLabels();
      this.renderItemsList();
      this.renderRemarks();
      this.updateTotalsSidebar();
      this.renderPreview();
      this.autoSaveDraft();
      this.showToast(`Para birimi ${this.state.currency} olarak güncellendi. Şartlar otomatik uyarlandı.`, 'info');
    });

    // Proje Özel Fiyatı Kontrolleri
    const updatePackageAccordionUI = (isOpen) => {
      if (this.packagePriceDetails) {
        this.packagePriceDetails.style.display = isOpen ? 'block' : 'none';
      }
      if (this.packagePriceBox) {
        this.packagePriceBox.classList.toggle('expanded', isOpen);
      }
    };

    if (this.checkPackagePrice) {
      this.checkPackagePrice.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        this.state.isPackagePrice = isChecked;
        if (this.packagePriceBox) {
          this.packagePriceBox.classList.toggle('active', isChecked);
        }
        updatePackageAccordionUI(isChecked);

        // Kalemlerin birim tipini temizle (varsa 1 Takım vb. kaldırıp standart Adet/Metre'ye döndür)
        this.state.items.forEach(item => {
          if (item.unitType && item.unitType !== 'Adet' && item.unitType !== 'Metre') {
            item.unitType = item.isMeter ? 'Metre' : 'Adet';
          }
        });
        this.renderItemsList();
        this.updateTotalsSidebar();
        this.renderPreview();
        this.autoSaveDraft();
      });
    }

    // Başlığa veya oka tıklandığında detayları aç / kapat (Açılır-Kapanır Accordion)
    if (this.packagePriceHeaderToggle) {
      this.packagePriceHeaderToggle.addEventListener('click', (e) => {
        if (e.target.id === 'check-package-price' || e.target.closest('#check-package-price')) return;

        if (!this.checkPackagePrice.checked) {
          this.checkPackagePrice.checked = true;
          this.checkPackagePrice.dispatchEvent(new Event('change'));
          return;
        }

        const isCurrentlyOpen = this.packagePriceDetails && this.packagePriceDetails.style.display !== 'none';
        updatePackageAccordionUI(!isCurrentlyOpen);
      });
    }

    if (this.inputPackagePrice) {
      this.inputPackagePrice.addEventListener('input', (e) => {
        this.state.packagePrice = e.target.value;
        this.updateTotalsSidebar();
        this.renderPreview();
        this.autoSaveDraft();
      });
    }

    if (this.inputPackageRowText) {
      this.inputPackageRowText.addEventListener('input', (e) => {
        this.state.packageRowText = e.target.value;
        this.renderItemsList();
        this.renderPreview();
        this.autoSaveDraft();
      });
    }

    if (this.inputPackageTotalText) {
      this.inputPackageTotalText.addEventListener('input', (e) => {
        this.state.packageTotalText = e.target.value;
        this.renderPreview();
        this.autoSaveDraft();
      });
    }

    // Kalem Ekleme Butonu
    this.btnAddItem.addEventListener('click', () => {
      this.addNewItem();
    });

    // Sondaj Teklifi Şablon Butonu
    if (this.btnTemplateSondaj) {
      this.btnTemplateSondaj.addEventListener('click', () => {
        this.openSondajModal();
      });
    }

    // Şartlar & Koşullar (Remarks) Hızlı Kontrolleri
    const onRemarkInputChange = () => {
      this.customRemarksList = null;
      this.renderRemarks();
      this.renderPreview();
    };

    this.inputRemarkDeliveryPlace.addEventListener('input', (e) => {
      this.state.remarksConfig.deliveryPlace = e.target.value;
      onRemarkInputChange();
    });

    this.inputRemarkDeliveryTime.addEventListener('input', (e) => {
      this.state.remarksConfig.deliveryTime = e.target.value;
      onRemarkInputChange();
    });

    this.inputRemarkValidityDays.addEventListener('input', (e) => {
      this.state.remarksConfig.validityDays = e.target.value;
      onRemarkInputChange();
    });

    this.inputRemarkPayment.addEventListener('input', (e) => {
      this.state.remarksConfig.paymentTerms = e.target.value;
      onRemarkInputChange();
    });

    this.inputRemarkScope.addEventListener('input', (e) => {
      this.state.remarksConfig.scopeText = e.target.value;
      onRemarkInputChange();
    });

    // Nakliye Dahil / Hariç Hızlı Toggle (Türkçe / İngilizce Uyumlu)
    this.btnToggleScopeShipping.addEventListener('click', () => {
      const isEn = (this.state.language === 'en');
      const current = (this.state.remarksConfig.scopeText || this.inputRemarkScope.value || '').toLowerCase();
      
      const isCurrentlyIncluded = current.includes('nakliye dâhil') || current.includes('nakliye dahil') || current.includes('prices include');

      if (isEn) {
        if (isCurrentlyIncluded) {
          this.state.remarksConfig.scopeText = 'Prices do not include freight, insurance, assembly, commissioning and supervision services.';
        } else {
          this.state.remarksConfig.scopeText = 'Prices include freight/shipping; insurance, assembly, commissioning and supervision services are not included.';
        }
      } else {
        if (isCurrentlyIncluded) {
          this.state.remarksConfig.scopeText = 'Fiyatlarımıza nakliye, sigorta, montaj, işletmeye alma ve süpervizyon hizmetleri dâhil değildir.';
        } else {
          this.state.remarksConfig.scopeText = 'Fiyatlarımıza nakliye dâhil; sigorta, montaj, işletmeye alma ve süpervizyon hizmetleri dâhil değildir.';
        }
      }

      this.inputRemarkScope.value = this.state.remarksConfig.scopeText;
      onRemarkInputChange();
      this.showToast(isEn ? 'Shipping terms toggled.' : 'Teklif kapsamı nakliye durumu güncellendi.', 'success');
    });

    // Şartlar & Koşullar Düzenleme
    this.btnToggleRemarks.addEventListener('click', () => {
      const isVisible = this.remarksEditorWrapper.style.display === 'block';
      this.remarksEditorWrapper.style.display = isVisible ? 'none' : 'block';
      this.btnToggleRemarks.textContent = isVisible ? 'Tüm Maddeleri Metin Olarak Gör / Düzenle' : 'Metin Editörünü Kapat';
      if (!isVisible) {
        this.inputRemarks.value = this.generateRemarksArray().join('\n');
      }
    });

    this.inputRemarks.addEventListener('input', (e) => {
      this.customRemarksList = e.target.value.split('\n').filter(r => r.trim() !== '');
      this.renderCustomRemarks(this.customRemarksList);
      this.renderPreview();
    });

    // Akbank Kuru Seçeneği Toggle
    if (this.checkboxAkbankRate) {
      this.checkboxAkbankRate.addEventListener('change', (e) => {
        const isAkbank = e.target.checked;
        if (!this.state.remarksConfig) this.state.remarksConfig = {};
        this.state.remarksConfig.useAkbankRate = isAkbank;
        this.updateAkbankRateBadge(isAkbank);
        this.updateCurrencyCalcButtonState(isAkbank);

        if (isAkbank) {
          this.fetchAkbankRates(false);
          if (this.modalCurrencyCalc && this.modalCurrencyCalc.classList.contains('active')) {
            this.switchRateProvider('akbank');
          }
        } else {
          if (this.modalCurrencyCalc && this.modalCurrencyCalc.classList.contains('active')) {
            this.switchRateProvider('tcmb');
          }
        }

        // Eğer kullanıcı manuel şartları düzenlediyse, o listedeki kur cümlesini otomatik dönüştür
        if (this.customRemarksList && this.customRemarksList.length > 0) {
          this.customRemarksList = this.customRemarksList.map(line => {
            if (isAkbank) {
              return line
                .replace(/TCMB efektif satış kuru/g, 'AKBANK satış kuru')
                .replace(/CBRT effective selling exchange rate/g, 'AKBANK selling exchange rate');
            } else {
              return line
                .replace(/AKBANK satış kuru/g, 'TCMB efektif satış kuru')
                .replace(/AKBANK selling exchange rate/g, 'CBRT effective selling exchange rate');
            }
          });
          if (this.inputRemarks) {
            this.inputRemarks.value = this.customRemarksList.join('\n');
          }
        }

        this.renderRemarks();
        this.renderPreview();
        const msg = isAkbank
          ? (this.state.language === 'en' ? 'Exchange rate clause set to AKBANK rate.' : 'Kur şartı AKBANK satış kuru olarak güncellendi.')
          : (this.state.language === 'en' ? 'Exchange rate clause set to CBRT rate.' : 'Kur şartı TCMB efektif satış kuru olarak güncellendi.');
        this.showToast(msg, 'info');
      });
    }

    this.btnResetRemarks.addEventListener('click', () => {
      this.customRemarksList = null;
      this.state.remarksConfig = {
        deliveryPlace: '',
        deliveryTime: '',
        validityDays: '',
        paymentTerms: '',
        scopeText: '',
        useAkbankRate: false
      };
      if (this.checkboxAkbankRate) {
        this.checkboxAkbankRate.checked = false;
      }
      this.updateAkbankRateBadge(false);
      this.updateCurrencyCalcButtonState(false);
      if (this.modalCurrencyCalc && this.modalCurrencyCalc.classList.contains('active')) {
        this.switchRateProvider('tcmb');
      }
      this.inputRemarkDeliveryPlace.value = '';
      this.inputRemarkDeliveryTime.value = '';
      this.inputRemarkValidityDays.value = '';
      this.inputRemarkPayment.value = '';
      this.inputRemarkScope.value = '';
      onRemarkInputChange();
      this.showToast('Standart şart ve koşullar sıfırlandı.', 'success');
    });

    // Yeni Teklif Başlat Butonu
    this.btnNewQuote.addEventListener('click', () => {
      this.startNewQuotation();
    });

    // Yazdır / PDF İndir Butonu
    this.btnPrint.addEventListener('click', () => {
      this.triggerPrint();
    });

    // PIN Göster / Gizle Göz İkonları
    const setupPinToggle = (inputId, btnId) => {
      const inp = document.getElementById(inputId);
      const btn = document.getElementById(btnId);
      if (!inp || !btn) return;
      const eyeOpen = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      const eyeClosed = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      
      btn.addEventListener('click', () => {
        if (inp.type === 'password') {
          inp.type = 'text';
          btn.innerHTML = eyeClosed;
          btn.title = 'Şifreyi Gizle';
        } else {
          inp.type = 'password';
          btn.innerHTML = eyeOpen;
          btn.title = 'Şifreyi Göster';
        }
      });
    };

    setupPinToggle('setup-security-pin', 'btn-toggle-setup-pin');
    setupPinToggle('setting-security-pin', 'btn-toggle-setting-pin');
    setupPinToggle('input-delete-pin', 'btn-toggle-delete-pin');

    // Profil Modalı
    this.btnProfileOpen.addEventListener('click', () => {
      this.openProfileModal();
    });
    this.btnCloseProfile.addEventListener('click', () => this.modalProfile.classList.remove('active'));
    if (this.btnCancelProfile) this.btnCancelProfile.addEventListener('click', () => this.modalProfile.classList.remove('active'));
    this.btnSaveProfile.addEventListener('click', () => this.saveProfileModal());

    if (this.btnConfirmUserSwitch) {
      this.btnConfirmUserSwitch.addEventListener('click', () => this.confirmUserSwitch());
    }
    if (this.btnCancelUserSwitch) {
      this.btnCancelUserSwitch.addEventListener('click', () => {
        if (this.userSwitchPinArea) this.userSwitchPinArea.style.display = 'none';
        this.pendingSwitchUser = null;
      });
    }
    if (this.userSwitchPinInput) {
      this.userSwitchPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.confirmUserSwitch();
        }
      });
    }
    if (this.btnNewUserForm) {
      this.btnNewUserForm.addEventListener('click', () => {
        if (this.settingPreparedBy) { this.settingPreparedBy.value = ''; this.settingPreparedBy.focus(); }
        if (this.settingSignerRole) this.settingSignerRole.value = 'Satış Mühendisi';
        if (this.settingSignerMobile) this.settingSignerMobile.value = '+90 ';
        if (this.settingSignerEmail) this.settingSignerEmail.value = '@ortek.com.tr';
        if (this.settingPhsEmail) this.settingPhsEmail.value = 'satisdestek@phspompa.com';
        if (this.settingSecurityPin) this.settingSecurityPin.value = '';
        if (this.userSwitchPinArea) this.userSwitchPinArea.style.display = 'none';
        this.showToast('Yeni kullanıcı bilgilerini ve 4 haneli PIN belirleyip "Ayarları Kaydet" butonuna basın.', 'info');
      });
    }
    document.querySelectorAll('.btn-quick-pick-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const uName = btn.getAttribute('data-user');
        const p = this.getUserProfile(uName);
        if (p) {
          if (this.setupPreparedBy) this.setupPreparedBy.value = p.preparedBy;
          if (this.setupSignerRole) this.setupSignerRole.value = p.signerRole;
          if (this.setupSignerMobile) this.setupSignerMobile.value = p.signerMobile;
          if (this.setupSignerEmail) this.setupSignerEmail.value = p.signerEmail;
          if (this.setupPhsEmail) this.setupPhsEmail.value = p.phsEmail;
          if (this.setupSecurityPin) this.setupSecurityPin.value = p.pin;
        }
      });
    });

    // Geçmiş Modalı
    this.btnHistoryOpen.addEventListener('click', () => this.openHistoryModal());
    this.btnCloseHistory.addEventListener('click', () => this.modalHistory.classList.remove('active'));
    this.btnCloseHistoryFooter.addEventListener('click', () => this.modalHistory.classList.remove('active'));
    this.btnSaveCurrentQuote.addEventListener('click', () => this.saveCurrentQuoteToHistory());
    if (this.historySearchInput) {
      this.historySearchInput.addEventListener('input', () => {
        this.renderHistoryModalList(this.historySearchInput.value);
      });
    }

    // Bildirim Butonu & Açılır Panel Olayları
    const bellBtn = this.btnNotifBell || document.getElementById('btn-notifications-bell');
    if (bellBtn) {
      bellBtn.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.toggleNotificationsDropdown(e);
      };
    }

    if (this.btnClearAllNotifs) {
      this.btnClearAllNotifs.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markAllNotificationsAsRead();
      });
    }

    document.addEventListener('click', (e) => {
      if (this.notifDropdown && (this.notifDropdown.style.display === 'flex' || this.notifDropdown.classList.contains('active'))) {
        const bell = this.btnNotifBell || document.getElementById('btn-notifications-bell');
        if (!this.notifDropdown.contains(e.target) && 
            (!bell || !bell.contains(e.target)) &&
            (!this.btnBannerOpenNotifs || !this.btnBannerOpenNotifs.contains(e.target))) {
          this.notifDropdown.style.display = 'none';
          this.notifDropdown.classList.remove('active');
        }
      }
    });

    // Ekip Canlı Mesajlaşma Modalı Olayları
    if (this.btnTeamChatOpen) {
      this.btnTeamChatOpen.addEventListener('click', () => this.openTeamChat());
    }
    if (this.btnCloseTeamChat) {
      this.btnCloseTeamChat.addEventListener('click', () => this.closeTeamChat());
    }
    if (this.chatUsersSearchInput) {
      this.chatUsersSearchInput.addEventListener('input', (e) => this.renderChatUsersList(e.target.value));
    }
    if (this.chatComposerForm) {
      this.chatComposerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendTeamChatMessage();
      });
    }
    if (this.inputTeamChatMsg) {
      this.inputTeamChatMsg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendTeamChatMessage();
        }
      });
    }

    // Cari / Müşteri Otomatik Tamamlama & Rehber Olayları
    this.setupCustomerAutocomplete();

    if (this.btnOpenCustomersModal) {
      this.btnOpenCustomersModal.addEventListener('click', () => this.openCustomersModal());
    }
    if (this.btnCloseCustomersDirectory) {
      this.btnCloseCustomersDirectory.addEventListener('click', () => this.closeCustomersModal());
    }
    if (this.btnCloseCustomersFooter) {
      this.btnCloseCustomersFooter.addEventListener('click', () => this.closeCustomersModal());
    }
    if (this.modalCustomersDirectory) {
      this.setupBackdropClose(this.modalCustomersDirectory, () => this.closeCustomersModal());
    }
    if (this.inputSearchCustomers) {
      this.inputSearchCustomers.addEventListener('input', (e) => this.renderCustomersTable(e.target.value));
    }
    if (this.btnToggleAddCustomerForm) {
      this.btnToggleAddCustomerForm.addEventListener('click', () => this.toggleCustomerForm());
    }
    if (this.btnCancelCustomerForm) {
      this.btnCancelCustomerForm.addEventListener('click', () => this.toggleCustomerForm(false));
    }
    if (this.btnSaveCustomerForm) {
      this.btnSaveCustomerForm.addEventListener('click', () => this.saveCustomerFromForm());
    }
    if (this.custFormTel) {
      this.custFormTel.addEventListener('input', (e) => {
        const raw = e.target.value;
        const digits = raw.replace(/\D/g, '');
        const isFull = (digits.startsWith('0') && digits.length === 11) ||
                      (!raw.startsWith('0') && !raw.startsWith('+') && digits.length === 10) ||
                      (raw.startsWith('+90') && digits.length === 12);
        if (isFull && !raw.includes(' ')) {
          e.target.value = this.formatPhoneNumber(raw);
        }
      });
      this.custFormTel.addEventListener('paste', () => {
        setTimeout(() => {
          this.custFormTel.value = this.formatPhoneNumber(this.custFormTel.value);
        }, 10);
      });
      this.custFormTel.addEventListener('blur', (e) => {
        e.target.value = this.formatPhoneNumber(e.target.value);
      });
    }
    if (this.btnSyncCustomersFromQuotes) {
      this.btnSyncCustomersFromQuotes.addEventListener('click', () => this.harvestCustomersFromQuotes(true));
    }
    if (this.customersTableBody) {
      this.customersTableBody.addEventListener('click', (e) => {
        const btnSelect = e.target.closest('.btn-cust-select');
        if (btnSelect) {
          const key = btnSelect.getAttribute('data-key');
          this.selectCustomerFromDirectory(key);
          return;
        }
        const btnEdit = e.target.closest('.btn-cust-edit');
        if (btnEdit) {
          const key = btnEdit.getAttribute('data-key');
          this.editCustomerInForm(key);
          return;
        }
        const btnDelete = e.target.closest('.btn-cust-delete');
        if (btnDelete) {
          const key = btnDelete.getAttribute('data-key');
          this.deleteCustomerFromDirectory(key);
          return;
        }
      });
    }

    // Geçerlilik Süresi Hatırlatma Bandı ve Modalı Olayları
    if (this.btnBannerOpenNotifs) {
      this.btnBannerOpenNotifs.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openExpiryRemindersModal();
      });
    }
    if (this.btnBannerClose && this.expiryBanner) {
      this.btnBannerClose.addEventListener('click', () => {
        this.expiryBanner.style.display = 'none';
        this.isExpiryBannerDismissed = true;
      });
    }
    if (this.btnCloseExpiryModal) {
      this.btnCloseExpiryModal.addEventListener('click', () => this.closeExpiryRemindersModal());
    }
    if (this.btnCloseExpiryFooter) {
      this.btnCloseExpiryFooter.addEventListener('click', () => this.closeExpiryRemindersModal());
    }
    if (this.modalExpiryReminders) {
      this.setupBackdropClose(this.modalExpiryReminders, () => this.closeExpiryRemindersModal());
    }

    // Kur Hesaplayıcı ve Döviz Çevirici Olayları (TCMB & Akbank)
    if (this.btnOpenCurrencyCalc) {
      this.btnOpenCurrencyCalc.addEventListener('click', () => this.openCurrencyCalcModal());
    }
    if (this.btnCloseCurrencyCalc) {
      this.btnCloseCurrencyCalc.addEventListener('click', () => this.closeCurrencyCalcModal());
    }
    if (this.btnCloseCurrencyCalcFooter) {
      this.btnCloseCurrencyCalcFooter.addEventListener('click', () => this.closeCurrencyCalcModal());
    }
    if (this.modalCurrencyCalc) {
      this.setupBackdropClose(this.modalCurrencyCalc, () => this.closeCurrencyCalcModal());
    }
    if (this.btnSourceTcmb) {
      this.btnSourceTcmb.addEventListener('click', () => this.switchRateProvider('tcmb'));
    }
    if (this.btnSourceAkbank) {
      this.btnSourceAkbank.addEventListener('click', () => this.switchRateProvider('akbank'));
    }
    if (this.btnRefreshTcmbRates) {
      this.btnRefreshTcmbRates.addEventListener('click', () => this.refreshActiveRates(true));
    }
    if (this.inputRateEur) {
      this.inputRateEur.addEventListener('focus', (e) => setTimeout(() => e.target.select(), 10));
      this.inputRateEur.addEventListener('input', () => this.onRateInputChange());
    }
    if (this.inputRateUsd) {
      this.inputRateUsd.addEventListener('focus', (e) => setTimeout(() => e.target.select(), 10));
      this.inputRateUsd.addEventListener('input', () => this.onRateInputChange());
    }
    if (this.btnResetTcmbRates) {
      this.btnResetTcmbRates.addEventListener('click', () => this.resetRatesToOriginal());
    }
    if (this.inputCalcAmount) {
      this.inputCalcAmount.addEventListener('focus', (e) => setTimeout(() => e.target.select(), 10));
      this.inputCalcAmount.addEventListener('input', () => this.calculateCurrencyTable());
      this.inputCalcAmount.addEventListener('blur', (e) => {
        const val = this.parseNumberInput(e.target.value);
        if (val > 0) {
          e.target.value = this.formatNumberInput(val);
        }
      });
    }
    if (this.calcCurrencyToggles) {
      this.calcCurrencyToggles.forEach(btn => {
        btn.addEventListener('click', () => {
          this.calcCurrencyToggles.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.calcSourceCurrency = btn.getAttribute('data-cur') || 'EUR';
          this.calculateCurrencyTable();
        });
      });
    }
    if (this.selectCalcVat) {
      this.selectCalcVat.addEventListener('change', () => this.calculateCurrencyTable());
    }
    if (this.btnCalcQuoteSubtotal) {
      this.btnCalcQuoteSubtotal.addEventListener('click', () => {
        const { subtotal } = this.calculateTotals ? this.calculateTotals() : { subtotal: 0 };
        if (this.inputCalcAmount) {
          this.inputCalcAmount.value = this.formatNumberInput(subtotal);
        }
        this.setCalcSourceCurrency(this.state.currency || 'EUR');
        this.calculateCurrencyTable();
      });
    }

    // Silme Onay Modalı Olayları
    if (this.btnCloseConfirmDelete) {
      this.btnCloseConfirmDelete.addEventListener('click', () => this.modalConfirmDelete.classList.remove('active'));
    }
    if (this.btnCancelConfirmDelete) {
      this.btnCancelConfirmDelete.addEventListener('click', () => this.modalConfirmDelete.classList.remove('active'));
    }
    if (this.btnSubmitConfirmDelete) {
      this.btnSubmitConfirmDelete.addEventListener('click', () => this.executeDeleteQuote());
    }

    // Sondaj Teklifi Şablon Modalı Olayları
    if (this.btnCloseSondajModal) {
      this.btnCloseSondajModal.addEventListener('click', () => this.closeSondajModal());
    }
    if (this.btnCancelSondaj) {
      this.btnCancelSondaj.addEventListener('click', () => this.closeSondajModal());
    }
    if (this.btnClearSondaj) {
      this.btnClearSondaj.addEventListener('click', () => this.clearSondajTemplate());
    }
    if (this.modalConfirmSondaj) {
      this.setupBackdropClose(this.modalConfirmSondaj, () => this.closeSondajModal());
    }
    if (this.btnConfirmSondajApply) {
      this.btnConfirmSondajApply.addEventListener('click', () => this.executeSondajTemplate());
    }

    // Marka Alış İskonto Oranları Olayları
    if (this.btnOpenBrandDiscounts) {
      this.btnOpenBrandDiscounts.addEventListener('click', () => this.openBrandDiscountsModal());
    }
    if (this.btnCloseBrandDiscounts) {
      this.btnCloseBrandDiscounts.addEventListener('click', () => this.closeBrandDiscountsModal());
    }
    if (this.btnCloseBrandDiscountsFooter) {
      this.btnCloseBrandDiscountsFooter.addEventListener('click', () => this.closeBrandDiscountsModal());
    }
    if (this.modalBrandDiscounts) {
      this.setupBackdropClose(this.modalBrandDiscounts, () => this.closeBrandDiscountsModal());
    }
    if (this.inputSearchBrandDiscounts) {
      this.inputSearchBrandDiscounts.addEventListener('input', (e) => {
        this.renderBrandDiscountsList(e.target.value);
      });
    }
    if (this.btnViewAllDiscountHistory) {
      this.btnViewAllDiscountHistory.addEventListener('click', () => {
        this.openDiscountHistoryModal('all');
      });
    }
    if (this.btnOpenAddBrand) {
      this.btnOpenAddBrand.addEventListener('click', () => {
        this.openAddBrandModal();
      });
    }

    // Kademeli Marka Detay Modalı Olayları
    if (this.btnCloseTierDiscounts) {
      this.btnCloseTierDiscounts.addEventListener('click', () => this.closeTierDiscountsModal());
    }
    if (this.btnCloseTierDiscountsFooter) {
      this.btnCloseTierDiscountsFooter.addEventListener('click', () => this.closeTierDiscountsModal());
    }
    if (this.modalTierDiscounts) {
      this.setupBackdropClose(this.modalTierDiscounts, () => this.closeTierDiscountsModal());
    }
    if (this.btnAddNewTierRow) {
      this.btnAddNewTierRow.addEventListener('click', () => {
        this.addNewTierToSelectedBrand();
      });
    }
    if (this.btnSaveTierDiscounts) {
      this.btnSaveTierDiscounts.addEventListener('click', () => {
        this.saveTierDiscountsChanges();
      });
    }

    // İskonto Güvenlik & PIN Onay Modalı Olayları
    if (this.btnCloseDiscountPin) {
      this.btnCloseDiscountPin.addEventListener('click', () => this.closeDiscountPinModal(false));
    }
    if (this.btnCancelDiscountPin) {
      this.btnCancelDiscountPin.addEventListener('click', () => this.closeDiscountPinModal(false));
    }
    if (this.btnSubmitDiscountPin) {
      this.btnSubmitDiscountPin.addEventListener('click', () => this.submitDiscountPinVerification());
    }
    if (this.modalConfirmDiscountPin) {
      this.setupBackdropClose(this.modalConfirmDiscountPin, () => this.closeDiscountPinModal(false));
    }
    if (this.inputDiscountPin) {
      this.inputDiscountPin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitDiscountPinVerification();
        } else if (e.key === 'Escape') {
          this.closeDiscountPinModal(false);
        }
      });
    }
    if (this.btnToggleDiscountPin) {
      this.btnToggleDiscountPin.addEventListener('click', () => {
        if (this.inputDiscountPin) {
          const isPass = (this.inputDiscountPin.type === 'password');
          this.inputDiscountPin.type = isPass ? 'text' : 'password';
          this.btnToggleDiscountPin.style.color = isPass ? '#fbbf24' : '#94a3b8';
        }
      });
    }

    // Değişiklik Geçmişi Modalı Olayları
    if (this.btnCloseDiscountHistory) {
      this.btnCloseDiscountHistory.addEventListener('click', () => this.closeDiscountHistoryModal());
    }
    if (this.btnCloseDiscountHistoryFooter) {
      this.btnCloseDiscountHistoryFooter.addEventListener('click', () => this.closeDiscountHistoryModal());
    }
    if (this.modalDiscountHistory) {
      this.setupBackdropClose(this.modalDiscountHistory, () => this.closeDiscountHistoryModal());
    }
    if (this.selectHistoryBrandFilter) {
      this.selectHistoryBrandFilter.addEventListener('change', (e) => {
        this.renderDiscountHistory(e.target.value);
      });
    }

    // Yeni Marka Ekleme Modalı Olayları
    if (this.btnCloseAddBrand) {
      this.btnCloseAddBrand.addEventListener('click', () => this.closeAddBrandModal());
    }
    if (this.btnCancelAddBrand) {
      this.btnCancelAddBrand.addEventListener('click', () => this.closeAddBrandModal());
    }
    if (this.modalAddBrand) {
      this.setupBackdropClose(this.modalAddBrand, () => this.closeAddBrandModal());
    }
    if (this.btnSubmitAddBrand) {
      this.btnSubmitAddBrand.addEventListener('click', () => this.submitNewBrand());
    }
    const radioBrandTypes = document.querySelectorAll('input[name="new-brand-type"]');
    radioBrandTypes.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'single') {
          if (this.groupNewBrandSingleRate) this.groupNewBrandSingleRate.style.display = 'block';
          if (this.groupNewBrandTieredHint) this.groupNewBrandTieredHint.style.display = 'none';
        } else {
          if (this.groupNewBrandSingleRate) this.groupNewBrandSingleRate.style.display = 'none';
          if (this.groupNewBrandTieredHint) this.groupNewBrandTieredHint.style.display = 'block';
        }
      });
    });

    // CRM Modalı & Analiz
    this.btnCrmOpen.addEventListener('click', () => this.openCrmModal());
    this.btnCloseCrm.addEventListener('click', () => this.modalCrm.classList.remove('active'));
    this.btnCloseCrmFooter.addEventListener('click', () => this.modalCrm.classList.remove('active'));
    this.btnCrmExport.addEventListener('click', () => this.exportCrmToExcel());
    
    // Görüşme Notu Silme Onay Modalı Olayları
    const modalDeleteNote = document.getElementById('modal-confirm-delete-note');
    const btnCloseDeleteNote = document.getElementById('btn-close-delete-note');
    const btnCancelDeleteNote = document.getElementById('btn-cancel-delete-note');
    const btnSubmitDeleteNote = document.getElementById('btn-submit-delete-note');

    if (btnCloseDeleteNote && modalDeleteNote) {
      btnCloseDeleteNote.addEventListener('click', () => {
        modalDeleteNote.classList.remove('active');
        this.pendingDeleteNote = null;
      });
    }
    if (btnCancelDeleteNote && modalDeleteNote) {
      btnCancelDeleteNote.addEventListener('click', () => {
        modalDeleteNote.classList.remove('active');
        this.pendingDeleteNote = null;
      });
    }
    if (btnSubmitDeleteNote) {
      btnSubmitDeleteNote.addEventListener('click', () => this.executeDeleteCrmNote());
    }

    // CRM Görüşme Notları Modalı Kapatma ve Kaydetme Olayları
    const closeNotesModal = () => {
      if (this.modalCrmNotes) this.modalCrmNotes.classList.remove('active');
    };
    const btnCloseNotes = document.getElementById('btn-close-crm-notes');
    if (btnCloseNotes) btnCloseNotes.addEventListener('click', closeNotesModal);
    const btnCloseNotesFooter = document.getElementById('btn-close-crm-notes-footer');
    if (btnCloseNotesFooter) btnCloseNotesFooter.addEventListener('click', closeNotesModal);
    
    const btnSaveNote = document.getElementById('btn-save-crm-note');
    if (btnSaveNote) btnSaveNote.addEventListener('click', () => this.saveCrmNote());

    const inputNote = document.getElementById('input-new-crm-note');
    if (inputNote) {
      inputNote.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.saveCrmNote();
        }
      });
    }

    // CRM Filtreleri
    this.crmFilterCompany.addEventListener('change', () => this.renderCrmTable());
    this.crmFilterStatus.addEventListener('change', () => this.renderCrmTable());
    this.crmFilterPreparedBy.addEventListener('change', () => this.renderCrmTable());
    this.crmSearchInput.addEventListener('input', () => this.renderCrmTable());
    this.btnSaveCurrentQuote.addEventListener('click', () => this.saveCurrentQuoteToHistory());

    // İlk Açılış Kaydet
    this.btnSaveInitial.addEventListener('click', () => this.saveInitialSetup());

    // Zoom Kontrolleri
    this.btnZoomIn.addEventListener('click', () => this.setZoom(this.state.zoomLevel + 0.1));
    this.btnZoomOut.addEventListener('click', () => this.setZoom(this.state.zoomLevel - 0.1));
    this.btnZoomFit.addEventListener('click', () => this.fitZoom());

    // Kısayol Tuşları (Ctrl+P -> Yazdır, Ctrl+S -> Kaydet)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.triggerPrint();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveCurrentQuoteToHistory();
      }
      if (e.key === 'Escape') {
        if (this.modalConfirmSondaj && this.modalConfirmSondaj.classList.contains('active')) {
          this.closeSondajModal();
        }
      }
    });

    // Pencere yeniden boyutlandığında fit zoom
    window.addEventListener('resize', () => {
      if (this.btnZoomFit.classList.contains('active')) {
        this.fitZoom();
      }
    });
  }

  // --------------------------------------------------------------------------
  // İlk Açılış Kontrolü
  // --------------------------------------------------------------------------
  checkFirstRun() {
    const prep = (this.state.profile.preparedBy || '').trim();
    if (!prep) {
      this.openProfileModal();
    }
  }

  saveInitialSetup() {
    const preparedBy = this.setupPreparedBy.value.trim();
    if (!preparedBy) {
      this.showToast('Lütfen adınızı soyadınızı giriniz veya yukarıdan seçiniz.', 'error');
      return;
    }
    const signerRole = this.setupSignerRole.value.trim() || 'Satış Mühendisi';
    const signerMobile = this.setupSignerMobile.value.trim() || '';
    const signerEmail = this.setupSignerEmail.value.trim() || '';
    const phsEmail = this.setupPhsEmail ? (this.setupPhsEmail.value.trim() || 'satisdestek@phspompa.com') : 'satisdestek@phspompa.com';

    const pin = this.setupSecurityPin ? (this.setupSecurityPin.value.trim() || '1234') : '1234';
    this.state.profile = {
      preparedBy,
      signerRole,
      signerMobile,
      signerEmail,
      phsSignerEmail: phsEmail,
      securityPin: pin
    };
    localStorage.setItem('ortek_security_pin', pin);
    localStorage.setItem('ortek_prepared_by', preparedBy);
    localStorage.setItem('ortek_signer_role', signerRole);
    localStorage.setItem('ortek_signer_mobile', signerMobile);
    localStorage.setItem('ortek_signer_email', signerEmail);
    localStorage.setItem('ortek_phs_email', phsEmail);
    localStorage.setItem('ortek_first_run_done', 'true');

    const key = this.normalizeUserKey(preparedBy) || preparedBy.toLowerCase();
    if (this.userFullProfiles) {
      // Önce bu kişiye ait olabilecek varyantları temizle
      Object.keys(this.userFullProfiles).forEach(k => {
        if (this.normalizeUserKey(k) === key) delete this.userFullProfiles[k];
      });
      this.userFullProfiles[key] = { preparedBy, signerRole, signerMobile, signerEmail, phsEmail, pin };
    }
    if (this.userPins) {
      Object.keys(this.userPins).forEach(k => {
        if (this.normalizeUserKey(k) === key) delete this.userPins[k];
      });
      this.userPins[key] = pin;
    }

    if (typeof db !== 'undefined' && db && preparedBy) {
      db.collection('user_profiles').doc(preparedBy).set({
        preparedBy,
        signerRole,
        signerMobile,
        signerEmail,
        phsEmail,
        pin,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(e => console.error(e));
    }

    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({
        key: 'ortek_settings',
        data: { ortek_first_run_done: true, preparedBy, signerRole, signerMobile, signerEmail, phsEmail }
      });
    }

    if (this.headerUserName) this.headerUserName.textContent = preparedBy;
    if (this.sidebarPrepName) this.sidebarPrepName.value = preparedBy;
    if (this.sidebarPrepRole) this.sidebarPrepRole.value = signerRole;
    if (this.sidebarPrepMobile) this.sidebarPrepMobile.value = signerMobile;
    if (this.sidebarPrepEmail) this.sidebarPrepEmail.value = signerEmail;

    this.modalInitial.classList.remove('active');
    this.updateUserPresence(true);
    this.checkValidityReminders();
    this.refreshTeamUsersList();
    this.render();
    this.showToast(`Hoş geldiniz ${preparedBy}!`, 'success');
  }

  // --------------------------------------------------------------------------
  // Veri ve Form Senkronizasyonu
  // --------------------------------------------------------------------------
  formatSfRef(year, counter) {
    return `${year}${String(counter).padStart(5, '0')}`;
  }

  getComputedSfRef() {
    let base = this.inputSfRef.value.trim() || this.state.baseSalesForceRef;
    base = base.replace(/R\d+$/i, '');
    if (this.state.isRevision && this.state.revisionLevel > 0) {
      return `${base}R${this.state.revisionLevel}`;
    }
    return base;
  }

  formatDateForDisplay(isoString) {
    if (!isoString) return '';
    const parts = isoString.split('-');
    if (parts.length !== 3) return isoString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }

  generateQuotationRef(isoString) {
    const prefix = this.state.activeCompany === 'phs' ? 'PHS-UNI' : 'ORT-UNI';
    if (!isoString) return prefix;
    const parts = isoString.split('-');
    if (parts.length !== 3) return prefix;
    return `${prefix}${parts[2]}${parts[1]}${parts[0]}`;
  }

  syncDateAndRef() {
    const formattedRef = this.generateQuotationRef(this.state.dateISO);
    this.inputQuotationRef.value = formattedRef;
  }

  updateRevisionUI() {
    this.revPillDisplay.textContent = `R${this.state.revisionLevel || 1}`;
    this.btnIncRev.textContent = `+ Revizyon Artır (R${this.state.revisionLevel || 1} → R${(this.state.revisionLevel || 1) + 1})`;
  }

  updateCurrencyLabels() {
    const c = this.state.currency;
    if (this.thUnitPrice) this.thUnitPrice.textContent = `Unit Price ${c}`;
    if (this.thTotalPrice) this.thTotalPrice.textContent = `Total Price ${c}`;
    if (this.packageCurrencyLabel) this.packageCurrencyLabel.textContent = c;
  }

  // --------------------------------------------------------------------------
  // Şartlar ve Koşullar (Remarks) Oluşturucu (Boşsa Varsayılanı Kullanır)
  // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------
  // Otomatik Türkçe -> İngilizce Akıllı Çeviri Motoru (EN Modu İçin)
  // --------------------------------------------------------------------------
    translateText(text) {
    if (!text || typeof text !== 'string') return text;
    let s = text.trim();

    // 1. Tam Eşleşen veya Öncelikli Bileşik Terimler (Exact / High-Priority)
    const exactRules = [
      // Teslim Yeri
      { r: /^(ortek|phs)?\s*depo(\s*teslim(i)?)?$/i, fn: () => 'Ex-Warehouse (Istanbul)' },
      { r: /^(müşteri\s*)?adres(e|i)?(\s*teslim(i)?)?$/i, fn: () => 'Delivered to Customer Address (DAP)' },
      { r: /^ambar(\s*teslim(i)?)?$/i, fn: () => 'Ex-Warehouse / Warehouse Terminal' },
      { r: /^şantiye(\s*teslim(i)?)?$/i, fn: () => 'Delivered to Site (DAP)' },
      { r: /^fabrika(\s*teslim(i)?)?$/i, fn: () => 'Ex-Works (Factory)' },
      { r: /^kargo\s*dahil$/i, fn: () => 'Including Courier/Shipping' },
      { r: /^kargo\s*hariç$/i, fn: () => 'Excluding Courier/Shipping' },
      { r: /^gümrük(\s*teslim(i)?)?$/i, fn: () => 'FOB / CIF Port' },
      { r: /^liman(\s*teslim(i)?)?$/i, fn: () => 'FOB Port' },

      // Teslim Süresi
      { r: /^stok(tan)?(\s*teslim(\.)?)?$/i, fn: () => 'Ex-Stock.' },
      { r: /^stokta\s*mevcut$/i, fn: () => 'In Stock.' },
      { r: /^hazır(\s*stok)?$/i, fn: () => 'Ready in Stock.' },
      { r: /^(\d+)\s*-\s*(\d+)\s*hafta$/i, fn: (m, p1, p2) => p1 + '-' + p2 + ' Weeks.' },
      { r: /^(\d+)\s*hafta$/i, fn: (m, p1) => p1 + ' Weeks.' },
      { r: /^(\d+)\s*-\s*(\d+)\s*iş\s*günü$/i, fn: (m, p1, p2) => p1 + '-' + p2 + ' Working Days.' },
      { r: /^(\d+)\s*iş\s*günü$/i, fn: (m, p1) => p1 + ' Working Days.' },
      { r: /^(\d+)\s*gün$/i, fn: (m, p1) => p1 + ' Days.' },

      // Ödeme Şekli
      { r: /^siparişle\s*birlikte\s*peşin$/i, fn: () => '100% Advance with Order' },
      { r: /^peşin$/i, fn: () => 'In Advance (100% Cash with Order)' },
      { r: /^nakit$/i, fn: () => 'Cash in Advance' },
      { r: /^kredi\s*kartı$/i, fn: () => 'Credit Card' },
      { r: /^banka\s*havale(si)?(\s*\/\s*eft)?$/i, fn: () => 'Bank Wire Transfer (T/T)' },
      { r: /^havale(\s*\/\s*eft)?$/i, fn: () => 'Bank Wire Transfer (T/T)' },
      { r: /^akreditif$/i, fn: () => 'Letter of Credit (L/C)' },
      { r: /^vadeli\s*çek$/i, fn: () => 'Post-dated Cheque' },
      { r: /^vadeli$/i, fn: () => 'Term / On Credit' },
      { r: /^(\d+)\s*gün\s*vadeli?$/i, fn: (m, p1) => p1 + ' Days Net Term' },
      { r: /^(\d+)\s*hafta\s*vadeli?$/i, fn: (m, p1) => p1 + ' Weeks Net Term' },
      { r: /^(\d+)\s*ay\s*vadeli?$/i, fn: (m, p1) => p1 + ' Months Net Term' },

      // Sondaj Teklifi Kalemleri
      { r: /^dalgıç\s*motor(u)?$/i, fn: () => 'Submersible Motor' },
      { r: /^dalgıç\s*pompa(sı)?$/i, fn: () => 'Submersible Pump' },
      { r: /^elektrik\s*kablosu$/i, fn: () => 'Submersible Power Cable' },
      { r: /^kontrol\s*panosu$/i, fn: () => 'Control Panel' },
      { r: /^kuyu\s*akıtma\s*başlığı\s*\(vanalı\)$/i, fn: () => 'Wellhead (With Valve)' },
      { r: /^kuyu\s*akıtma\s*başlığı$/i, fn: () => 'Wellhead' },
      { r: /^paslanmaz\s*klemens\s*\(halat\s*için\)$/i, fn: () => 'Stainless Steel Clamp (For Rope)' },
      { r: /^paslanmaz\s*klemens$/i, fn: () => 'Stainless Steel Clamp' },
      { r: /^izoleli\s*çelik\s*halat$/i, fn: () => 'Insulated Steel Wire Rope' },
      { r: /^çelik\s*halat$/i, fn: () => 'Steel Wire Rope' },
      { r: /^üst\s*kolon\s*boru\s*adaptörü$/i, fn: () => 'Top Column Pipe Adapter' },
      { r: /^kolon\s*boru\s*adaptörü$/i, fn: () => 'Column Pipe Adapter' }
    ];

    for (const rule of exactRules) {
      if (rule.r.test(s)) {
        return s.replace(rule.r, rule.fn);
      }
    }

    // 2. Parça / Cümle İçi Eşleştirmeler (General Sub-phrase Replacement)
    const subRules = [
      // Teslimat terimleri
      { r: /(ortek|phs)?\s*depo\s*teslim(i)?/gi, fn: () => 'Ex-Warehouse (Istanbul)' },
      { r: /ambar\s*teslim(i)?/gi, fn: () => 'Ex-Warehouse / Warehouse Terminal' },
      { r: /(müşteri\s*)?adres(e|i)?\s*teslim(i)?/gi, fn: () => 'Delivered to Customer Address (DAP)' },
      { r: /şantiye\s*teslim(i)?/gi, fn: () => 'Delivered to Site (DAP)' },
      { r: /fabrika\s*teslim(i)?/gi, fn: () => 'Ex-Works (Factory)' },
      { r: /kargo\s*dahil/gi, fn: () => 'Including Courier/Shipping' },
      { r: /kargo\s*hariç/gi, fn: () => 'Excluding Courier/Shipping' },

      // Süreler
      { r: /stok(tan)?\s*teslim(\.)?/gi, fn: () => 'Ex-Stock.' },
      { r: /(\d+)\s*-\s*(\d+)\s*hafta/gi, fn: (m, p1, p2) => p1 + '-' + p2 + ' Weeks' },
      { r: /(\d+)\s*hafta/gi, fn: (m, p1) => p1 + ' Weeks' },
      { r: /(\d+)\s*-\s*(\d+)\s*iş\s*günü/gi, fn: (m, p1, p2) => p1 + '-' + p2 + ' Working Days' },
      { r: /(\d+)\s*iş\s*günü/gi, fn: (m, p1) => p1 + ' Working Days' },
      { r: /(\d+)\s*gün/gi, fn: (m, p1) => p1 + ' Days' },
      { r: /(\d+)\s*ay\b/gi, fn: (m, p1) => p1 + ' Months' },
      { r: /\biş\s*günü/gi, fn: () => 'working days' },
      { r: /\bhafta/gi, fn: () => 'weeks' },
      { r: /\bgün/gi, fn: () => 'days' },
      { r: /\bay\b/gi, fn: () => 'months' },

      // Sipariş & Avans
      { r: /sipariş(i)?\s*müteakip/gi, fn: () => 'following order confirmation' },
      { r: /sipariş\s*onayından\s*sonra/gi, fn: () => 'after order confirmation' },
      { r: /avans\s*ödemesini\s*müteakip/gi, fn: () => 'following advance payment' },
      { r: /avans\s*ödemesinden\s*sonra/gi, fn: () => 'after advance payment' },

      // Ödeme
      { r: /vadeli\s*çek/gi, fn: () => 'Post-dated Cheque' },
      { r: /(\d+)\s*gün\s*vadeli/gi, fn: (m, p1) => p1 + ' Days Net Term' },
      { r: /\bvadeli\b/gi, fn: () => 'Term / On Credit' },
      { r: /\bpeşin\b/gi, fn: () => 'In Advance' },

      // Kapsam
      { r: /fiyatlarımıza\s*nakliye,\s*sigorta,\s*montaj,\s*işletmeye\s*alma\s*ve\s*süpervizyon\s*hizmetleri\s*d[aâ]hil\s*değildir(\.)?/gi, fn: () => 'Prices do not include freight, insurance, assembly, commissioning and supervision services.' },
      { r: /fiyatlarımıza\s*nakliye\s*d[aâ]hildir(\.)?/gi, fn: () => 'Prices include freight/shipping.' },
      { r: /fiyatlarımıza\s*nakliye\s*d[aâ]hil\s*değildir(\.)?/gi, fn: () => 'Prices do not include freight/shipping.' },
      { r: /d[aâ]hil\s*değildir/gi, fn: () => 'are not included' },
      { r: /d[aâ]hildir/gi, fn: () => 'are included' },

      // Pompa & Malzeme
      { r: /paslanmaz\s*çelik/gi, fn: () => 'Stainless Steel' },
      { r: /döküm/gi, fn: () => 'Cast Iron' },
      { r: /pik\s*döküm/gi, fn: () => 'Grey Cast Iron' },
      { r: /sfero\s*döküm/gi, fn: () => 'Ductile Iron' },
      { r: /karbon\s*çelik/gi, fn: () => 'Carbon Steel' },
      { r: /bronz/gi, fn: () => 'Bronze' },
      { r: /dalgıç\s*pompa(sı)?/gi, fn: () => 'Submersible Pump' },
      { r: /santrifüj\s*pompa(sı)?/gi, fn: () => 'Centrifugal Pump' },
      { r: /atık\s*su/gi, fn: () => 'Waste Water' },
      { r: /kirli\s*su/gi, fn: () => 'Sewage Water' },
      { r: /temiz\s*su/gi, fn: () => 'Clean Water' },
      { r: /hidrofor/gi, fn: () => 'Booster Set' },
      { r: /yangın\s*pompa(sı)?/gi, fn: () => 'Fire Fighting Pump' },
      { r: /frekans\s*konvertör(lü)?/gi, fn: () => 'Variable Speed / Inverter' },
      { r: /inverter(li)?/gi, fn: () => 'Inverter Driven' },
      { r: /monoblok/gi, fn: () => 'Monobloc' },
      { r: /akuple/gi, fn: () => 'Coupled' },
      { r: /yatay\s*milli/gi, fn: () => 'Horizontal' },
      { r: /dikey\s*milli/gi, fn: () => 'Vertical' },
      { r: /kademeli/gi, fn: () => 'Multistage' },
      { r: /tek\s*kademeli/gi, fn: () => 'Single Stage' },
      { r: /kendinden\s*emişli/gi, fn: () => 'Self-Priming' },
      { r: /manyetik\s*kavramalı/gi, fn: () => 'Magnetic Drive' },

      // Sondaj Kalemleri Sub-Rules
      { r: /dalgıç\s*motor(u)?/gi, fn: () => 'Submersible Motor' },
      { r: /elektrik\s*kablosu/gi, fn: () => 'Submersible Power Cable' },
      { r: /kontrol\s*panosu/gi, fn: () => 'Control Panel' },
      { r: /kuyu\s*akıtma\s*başlığı\s*\(vanalı\)/gi, fn: () => 'Wellhead (With Valve)' },
      { r: /kuyu\s*akıtma\s*başlığı/gi, fn: () => 'Wellhead' },
      { r: /paslanmaz\s*klemens\s*\(halat\s*için\)/gi, fn: () => 'Stainless Steel Clamp (For Rope)' },
      { r: /paslanmaz\s*klemens/gi, fn: () => 'Stainless Steel Clamp' },
      { r: /izoleli\s*çelik\s*halat/gi, fn: () => 'Insulated Steel Wire Rope' },
      { r: /çelik\s*halat/gi, fn: () => 'Steel Wire Rope' },
      { r: /üst\s*kolon\s*boru\s*adaptörü/gi, fn: () => 'Top Column Pipe Adapter' },
      { r: /kolon\s*boru\s*adaptörü/gi, fn: () => 'Column Pipe Adapter' }
    ];

    for (const rule of subRules) {
      s = s.replace(rule.r, rule.fn);
    }
    return s;
  }

  translateCustomSpecLabel(lbl) {
    if (!lbl) return '';
    const clean = lbl.trim().replace(/:$/, '').toLowerCase();
    const labelDict = {
      'marka': 'Brand',
      'model': 'Model',
      'çalışma aralığı': 'Operating Range',
      'calisma araligi': 'Operating Range',
      'güç': 'Power',
      'guc': 'Power',
      'çıkış': 'Outlet',
      'cikis': 'Outlet',
      'çıkış çapı': 'Outlet Diameter',
      'cikis capi': 'Outlet Diameter',
      'giriş': 'Inlet',
      'giris': 'Inlet',
      'giriş çapı': 'Inlet Diameter',
      'giris capi': 'Inlet Diameter',
      'kod': 'Code',
      'kod.': 'Code',
      'ek kod': 'Code / Part No',
      'ek kod / parça': 'Code / Part No',
      'parça no': 'Part No',
      'parca no': 'Part No',
      'gövde malzemesi': 'Casing Material',
      'govde malzemesi': 'Casing Material',
      'gövde': 'Casing',
      'çark malzemesi': 'Impeller Material',
      'cark malzemesi': 'Impeller Material',
      'çark': 'Impeller',
      'mil malzemesi': 'Shaft Material',
      'mil': 'Shaft',
      'mekanik salmastra': 'Mechanical Seal',
      'salmastra': 'Seal',
      'basma yüksekliği': 'Head (Hm)',
      'basma yuksekligi': 'Head (Hm)',
      'hm': 'Head (Hm)',
      'debi': 'Flow Rate (Q)',
      'kapasite': 'Capacity',
      'devir': 'Speed (RPM)',
      'hız': 'Speed (RPM)',
      'voltaj': 'Voltage',
      'gerilim': 'Voltage',
      'koruma sınıfı': 'Protection Class (IP)',
      'koruma': 'Protection (IP)',
      'ip': 'IP Class',
      'izolasyon sınıfı': 'Insulation Class',
      'izolasyon': 'Insulation',
      'sıvı sıcaklığı': 'Liquid Temperature',
      'akışkan sıcaklığı': 'Fluid Temperature',
      'ağırlık': 'Weight',
      'bağlantı': 'Connection',
      'bağlantı çapı': 'Connection Size',
      'flanş': 'Flange',
      'dişli': 'Threaded',
      'garanti': 'Warranty',
      'açıklama': 'Description',
      'not': 'Note'
    };

    if (labelDict[clean]) return labelDict[clean] + ':';
    return this.translateText(lbl);
  }

  generateRemarksArray() {
    const c = this.state.currency;
    const rc = this.state.remarksConfig || {};
    const isEn = (this.state.language === 'en');
    const isPhs = this.state.activeCompany === 'phs';
    const cName = isPhs ? 'PHS' : 'ORTEK';
    const cNameCap = isPhs ? 'PHS' : 'Ortek';

    // Sol paneldeki inputlardan anlık değerleri oku
    const placeVal = (this.inputRemarkDeliveryPlace && this.inputRemarkDeliveryPlace.value.trim()) ? this.inputRemarkDeliveryPlace.value.trim() : (rc.deliveryPlace || '');
    const timeVal = (this.inputRemarkDeliveryTime && this.inputRemarkDeliveryTime.value.trim()) ? this.inputRemarkDeliveryTime.value.trim() : (rc.deliveryTime || '');
    const valDays = (this.inputRemarkValidityDays && this.inputRemarkValidityDays.value.trim()) ? this.inputRemarkValidityDays.value.trim() : (rc.validityDays || '5');
    const payVal = (this.inputRemarkPayment && this.inputRemarkPayment.value.trim()) ? this.inputRemarkPayment.value.trim() : (rc.paymentTerms || '');
    const scopeVal = (this.inputRemarkScope && this.inputRemarkScope.value.trim()) ? this.inputRemarkScope.value.trim() : (rc.scopeText || '');

    const useAkbank = !!(rc && rc.useAkbankRate);

    if (isEn) {
      let currText = `Currency: Our prices are in Euro and 20% VAT will be added to the unit prices.`;
      if (c === 'USD') {
        currText = `Currency: Our prices are in USD and 20% VAT will be added to the unit prices.`;
      } else if (c === 'TL') {
        currText = `Currency: Our prices are in Turkish Lira and 20% VAT will be added to the unit prices.`;
      }

      const delPlace = placeVal ? this.translateText(placeVal) : 'Ex-Warehouse';
      const delTime = timeVal ? this.translateText(timeVal) : 'Ex-Stock.';
      const payTerms = payVal ? this.translateText(payVal) : 'In Advance';
      const scope = scopeVal ? this.translateText(scopeVal) : 'Prices do not include freight, insurance, assembly, commissioning and supervision services.';

      const invText = c === 'TL' ? 'Invoicing: Invoices will be issued in TL.' : `Invoicing: Invoices will be issued in ${c}. The exchange rate on the payment date will apply.`;
      const rateText = useAkbank
        ? `Exchange Rate: For payments in Turkish Lira, the AKBANK selling exchange rate on the payment date will be taken as the basis.`
        : `Exchange Rate: For payments in Turkish Lira, the CBRT effective selling exchange rate on the payment date will be taken as the basis.`;

      return [
        `This order is subject to ${cName} General Terms and Conditions of Sale,`,
        `Unless specifically accepted in writing by ${cName}, no additional or different terms in your purchase order or other forms will become part of this order.`,
        currText,
        `Delivery Place: ${delPlace}`,
        `Delivery Time: ${delTime}`,
        `Validity: Our proposal is valid for ${valDays} days.`,
        `Payment Terms: ${payTerms}`,
        invText,
        rateText,
        `Scope of Proposal: ${scope}`,
        `Warranty: Products are guaranteed against manufacturing and material defects for 24 months from the invoice date or 18 months from commissioning, whichever comes first.`,
        `Failures caused by installation errors and/or improper use are excluded from the warranty.`,
        `Consumables and wear parts are not covered by warranty. Warranty conditions apply provided that periodic maintenance is carried out exclusively by ${cNameCap} authorized services using original parts.`,
        `Order Cancellation: In case of order cancellation, the advance payment will not be refunded.`
      ];
    } else {
      let paraBirimiText = `Para Birimi: Fiyatlarımız Euro olup birim fiyatlara %20 KDV ilave edilecektir.`;
      if (c === 'USD') {
        paraBirimiText = `Para Birimi: Fiyatlarımız USD olup birim fiyatlara %20 KDV ilave edilecektir.`;
      } else if (c === 'TL') {
        paraBirimiText = `Para Birimi: Fiyatlarımız Türk Lirası olup birim fiyatlara %20 KDV ilave edilecektir.`;
      }

      const deliveryPlace = placeVal ? placeVal : 'Depo Teslim';
      const deliveryTime = timeVal ? timeVal : 'Stok teslim.';
      const paymentTerms = payVal ? payVal : 'Peşin';
      const scopeText = scopeVal ? scopeVal : 'Fiyatlarımıza nakliye, sigorta, montaj, işletmeye alma ve süpervizyon hizmetleri dâhil değildir.';
      const faturaText = c === 'TL' ? 'Fatura: Faturalar TL olarak kesilecektir.' : `Fatura: Faturalar ${c} olarak kesilecektir. Ödeme tarihindeki kur üzerinden TL’ye dönülecektir.`;
      const kurText = useAkbank
        ? "Kur: Türk Lirası üzerinden yapılan ödemelerde, ödeme tarihindeki AKBANK satış kuru baz alınır. Ödemelerin TL bedelli çek ile yapılması halinde, çeklerin vade tarihindeki AKBANK satış kuru baz alınarak kur farkı hesaplaması yapılacaktır."
        : "Kur: Türk Lirası üzerinden yapılan ödemelerde, ödeme tarihindeki TCMB efektif satış kuru baz alınır. Ödemelerin TL bedelli çek ile yapılması halinde, çeklerin vade tarihindeki TCMB efektif satış kuru baz alınarak kur farkı hesaplaması yapılacaktır.";

      return [
        `Bu sipariş, ${cName} Genel Ürün Satış ve Tedarik Koşullarına tabidir,`,
        `${cName} ‘in yazılı olarak özellikle kabul ettiği haller dışında, satın alma siparişinizde veya diğer formlarda yer alan hiçbir ek veya farklı koşul, ${cName} ‘in bu tür koşullara itiraz etmemesine bakılmaksızın, bu siparişin bir parçası olmayacaktır.`,
        paraBirimiText,
        `Teslim Yeri: ${deliveryPlace}`,
        `Teslim Süresi: ${deliveryTime}`,
        `Geçerlilik: Teklifimiz ${valDays} gün geçerlidir.`,
        `Ödeme Şekli: ${paymentTerms}`,
        faturaText,
        kurText,
        `Teklif Kapsamı: ${scopeText}`,
        "Garanti: Ürünler, fabrika imalat ve malzeme hatalarına karşı fatura tarihinden itibaren 24 ay, devreye alınmasından itibaren 18 ay garantilidir. Bu iki tarihten önce gelen tarih garanti bitiş tarihi olarak kabul edilecektir.",
        "Montaj hataları ve/veya yanlış kullanım nedeni ile oluşan arızalar garanti kapsamı dışındadır.",
        `Sarf malzemeler, normal kullanım ile aşınan parçalar garanti kapsamına girmez. Garanti şartları, periyodik bakımların Sadece ${cNameCap} yetkili servislerince orijinal parça kullanılarak yapılması şartıyla geçerlidir.`,
        "Sipariş İptali: Siparişin iptali halinde, ödenen avans meblağı iade edilmeyecektir."
      ];
    }
  }

  renderRemarks() {
    if (this.customRemarksList) {
      this.renderCustomRemarks(this.customRemarksList);
      return;
    }
    const remarks = this.generateRemarksArray();
    this.renderCustomRemarks(remarks);
  }

    renderCustomRemarks(list) {
    if (!this.docRemarksList) return;
    this.docRemarksList.innerHTML = '';
    list.forEach(rem => {
      const li = document.createElement('li');
      const parts = rem.split(':');
      if (parts.length > 1 && parts[0].length < 35 && !parts[0].includes('http')) {
        let restOfText = this.escapeHtml(parts.slice(1).join(':'));
        restOfText = restOfText.replace(/%20\s*KDV/gi, '<strong class="highlight-vat">%20 KDV</strong>');
        restOfText = restOfText.replace(/20%\s*VAT/gi, '<strong class="highlight-vat">20% VAT</strong>');
        li.innerHTML = `<strong>${this.escapeHtml(parts[0])}:</strong>${restOfText}`;
      } else {
        let escapedRem = this.escapeHtml(rem);
        escapedRem = escapedRem.replace(/%20\s*KDV/gi, '<strong class="highlight-vat">%20 KDV</strong>');
        escapedRem = escapedRem.replace(/20%\s*VAT/gi, '<strong class="highlight-vat">20% VAT</strong>');
        li.innerHTML = escapedRem;
      }
      this.docRemarksList.appendChild(li);
    });
  }

  updateAkbankRateBadge(isAkbank) {
    if (!this.badgeAkbankRateStatus) return;
    if (isAkbank) {
      this.badgeAkbankRateStatus.textContent = 'AKBANK Aktif';
      this.badgeAkbankRateStatus.style.background = 'rgba(255, 71, 87, 0.22)';
      this.badgeAkbankRateStatus.style.color = '#ff6b81';
      this.badgeAkbankRateStatus.style.borderColor = 'rgba(255, 71, 87, 0.6)';
    } else {
      this.badgeAkbankRateStatus.textContent = 'TCMB Aktif';
      this.badgeAkbankRateStatus.style.background = 'rgba(255, 255, 255, 0.08)';
      this.badgeAkbankRateStatus.style.color = 'var(--text-dim)';
      this.badgeAkbankRateStatus.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }
  }

  // --------------------------------------------------------------------------
  // Yeni Teklif Başlatma (Müşteri & Kalemler & Şartlar Temiz Placeholder)
  // --------------------------------------------------------------------------
  startNewQuotation() {
    const currentCounter = parseInt(localStorage.getItem('ortek_sf_counter') || '1', 10);
    const newCounter = currentCounter + 1;
    localStorage.setItem('ortek_sf_counter', newCounter.toString());

    const today = new Date();
    const year = today.getFullYear();

    this.state.dateISO = today.toISOString().split('T')[0];
    this.state.salesForceCounter = newCounter;
    this.state.salesForceYear = year;
    this.state.baseSalesForceRef = this.formatSfRef(year, newCounter);
    this.state.isRevision = false;
    this.state.revisionLevel = 0;
    this.state.hasInternalRef = false;
    this.state.internalRef = '';

    // Müşteri formunu sıfırla
    this.state.customer = {
      to: '',
      address: '',
      attention: '',
      email: '',
      tel: '',
      subject: ''
    };

    // Şartlar kutularını sıfırla (Akbank kuru eski düzene/TCMB'ye döner)
    this.customRemarksList = null;
    this.state.remarksConfig = {
      deliveryPlace: '',
      deliveryTime: '',
      validityDays: '',
      paymentTerms: '',
      scopeText: '',
      useAkbankRate: false
    };
    if (this.checkboxAkbankRate) {
      this.checkboxAkbankRate.checked = false;
    }
    // Proje Özel Fiyat durumunu sıfırla
    this.state.isPackagePrice = false;
    this.state.packagePrice = '';
    this.state.packageRowText = 'Proje Özel Fiyat';
    this.state.packageTotalText = 'Proje Özel Fiyat';
    if (this.checkPackagePrice) this.checkPackagePrice.checked = false;
    if (this.packagePriceDetails) this.packagePriceDetails.style.display = 'none';
    if (this.packagePriceBox) this.packagePriceBox.classList.remove('active');
    if (this.inputPackagePrice) this.inputPackagePrice.value = '';
    if (this.inputPackageRowText) this.inputPackageRowText.value = 'Proje Özel Fiyat';
    if (this.inputPackageTotalText) this.inputPackageTotalText.value = 'Proje Özel Fiyat';

    // Kalemleri temiz sıfırla
    this.state.items = JSON.parse(JSON.stringify(DEFAULT_ITEMS));

    this.render();
    this.autoSaveDraft();
    this.showToast(`Yeni Teklif Başlatıldı! Sayaç: #${newCounter} (Ref: ${this.state.baseSalesForceRef})`, 'success');
  }

  // --------------------------------------------------------------------------
  // TCMB & Akbank Güncel Döviz Kurları ve Çevirici
  // --------------------------------------------------------------------------
  async fetchTcmbRates(forceRefresh = false) {
    if (forceRefresh && this.btnRefreshTcmbRates && this.activeRateProvider === 'tcmb') {
      this.btnRefreshTcmbRates.disabled = true;
      if (this.btnRefreshRatesText) this.btnRefreshRatesText.textContent = 'Yenileniyor...';
    }

    try {
      let res = null;
      if (window.electronAPI && window.electronAPI.getTcmbRates) {
        res = await window.electronAPI.getTcmbRates();
      }

      if (res && res.success) {
        this.tcmbRates = {
          eur: res.eur.banknoteSelling || res.eur.forexSelling || 56.3657,
          usd: res.usd.banknoteSelling || res.usd.forexSelling || 48.5325,
          date: res.date || '08.09.2026',
          bulletinNo: res.bulletinNo || '2026/168',
          isFetched: true,
          fetchedAt: res.fetchedAt || new Date().toISOString()
        };

        if (this.activeRateProvider === 'tcmb') {
          if (this.calcTcmbBulletinInfo) {
            this.calcTcmbBulletinInfo.innerHTML = `TCMB Efektif Satış | Bülten: <strong>${this.tcmbRates.date}</strong> (No: ${this.tcmbRates.bulletinNo})`;
          }

          if (this.customRates.eur === null && this.inputRateEur) {
            this.inputRateEur.value = this.tcmbRates.eur.toFixed(4);
          }
          if (this.customRates.usd === null && this.inputRateUsd) {
            this.inputRateUsd.value = this.tcmbRates.usd.toFixed(4);
          }
          this.calculateCurrencyTable();
        }

        this.updateParityDisplay();
        if (forceRefresh && this.activeRateProvider === 'tcmb') {
          this.showToast('TCMB kurları başarıyla güncellendi.', 'success');
        }
      } else {
        if (this.activeRateProvider === 'tcmb' && this.calcTcmbBulletinInfo) {
          this.calcTcmbBulletinInfo.innerHTML = `TCMB Efektif Satış | Bülten: <strong>${this.tcmbRates.date}</strong> (No: ${this.tcmbRates.bulletinNo})`;
        }
        if (forceRefresh && this.activeRateProvider === 'tcmb') {
          this.showToast('TCMB güncel bültenine ulaşılamadı, son bülten kurları kullanılıyor.', 'warning');
        }
      }
    } catch (e) {
      console.warn('TCMB rates fetch error:', e);
    } finally {
      if (this.btnRefreshTcmbRates) {
        this.btnRefreshTcmbRates.disabled = false;
        if (this.btnRefreshRatesText) this.btnRefreshRatesText.textContent = 'Kurları Yenile';
      }
    }
  }

  async fetchAkbankRates(forceRefresh = false) {
    if (forceRefresh && this.btnRefreshTcmbRates && this.activeRateProvider === 'akbank') {
      this.btnRefreshTcmbRates.disabled = true;
      if (this.btnRefreshRatesText) this.btnRefreshRatesText.textContent = 'Yenileniyor...';
    }

    try {
      let res = null;
      if (window.electronAPI && window.electronAPI.getAkbankRates) {
        res = await window.electronAPI.getAkbankRates();
      }

      if (res && res.success) {
        this.akbankRates = {
          eur: res.eur.selling || 56.8516,
          usd: res.usd.selling || 50.1250,
          date: res.date || new Date().toLocaleString('tr-TR'),
          isFetched: true,
          fetchedAt: res.fetchedAt || new Date().toISOString()
        };

        if (this.activeRateProvider === 'akbank') {
          if (this.calcTcmbBulletinInfo) {
            this.calcTcmbBulletinInfo.innerHTML = `Akbank Canlı Gişe | Son Güncelleme: <strong>${this.akbankRates.date}</strong>`;
          }

          if (this.customRates.eur === null && this.inputRateEur) {
            this.inputRateEur.value = this.akbankRates.eur.toFixed(4);
          }
          if (this.customRates.usd === null && this.inputRateUsd) {
            this.inputRateUsd.value = this.akbankRates.usd.toFixed(4);
          }
          this.calculateCurrencyTable();
        }

        if (forceRefresh && this.activeRateProvider === 'akbank') {
          this.showToast('Akbank canlı kurları başarıyla güncellendi.', 'success');
        }
      } else {
        if (forceRefresh && this.activeRateProvider === 'akbank') {
          this.showToast('Akbank canlı kurlarına ulaşılamadı, son kayıtlı kurlar kullanılıyor.', 'warning');
        }
      }
    } catch (e) {
      console.warn('Akbank rates fetch error:', e);
    } finally {
      if (this.btnRefreshTcmbRates) {
        this.btnRefreshTcmbRates.disabled = false;
        if (this.btnRefreshRatesText) this.btnRefreshRatesText.textContent = 'Kurları Yenile';
      }
    }
  }

  refreshActiveRates(force = true) {
    if (this.activeRateProvider === 'akbank') {
      this.fetchAkbankRates(force);
    } else {
      this.fetchTcmbRates(force);
    }
  }

  updateCurrencyCalcButtonState(isAkbank) {
    if (this.btnOpenCurrencyCalc) {
      if (isAkbank) {
        this.btnOpenCurrencyCalc.classList.add('akbank-active');
        this.btnOpenCurrencyCalc.title = 'Akbank güncel canlı satış kurlarını çekip Euro, Dolar ve TL dönüşümlerini gösterir';
      } else {
        this.btnOpenCurrencyCalc.classList.remove('akbank-active');
        this.btnOpenCurrencyCalc.title = 'TCMB güncel Efektif Satış kurlarını çekip Euro, Dolar ve TL dönüşümlerini gösterir';
      }
    }
    if (this.btnCurrencyCalcLabel) {
      this.btnCurrencyCalcLabel.textContent = isAkbank ? 'Kur Hesapla (AKBANK)' : 'Kur Hesapla (TCMB)';
    }
  }

  switchRateProvider(provider) {
    if (provider !== 'tcmb' && provider !== 'akbank') provider = 'tcmb';
    this.activeRateProvider = provider;
    this.customRates.eur = null;
    this.customRates.usd = null;

    this.applyRateProviderUI();

    if (provider === 'akbank') {
      if (!this.akbankRates || !this.akbankRates.isFetched) {
        this.fetchAkbankRates(false);
      }
    } else {
      if (!this.tcmbRates || !this.tcmbRates.isFetched) {
        this.fetchTcmbRates(false);
      }
    }
  }

  applyRateProviderUI() {
    const isAkbank = (this.activeRateProvider === 'akbank');

    // Kaynak butonları
    if (this.btnSourceTcmb) {
      this.btnSourceTcmb.className = isAkbank ? 'btn-rate-source' : 'btn-rate-source active-tcmb';
    }
    if (this.btnSourceAkbank) {
      this.btnSourceAkbank.className = isAkbank ? 'btn-rate-source active-akbank' : 'btn-rate-source';
    }

    // Modal Başlığı ve İkon
    if (this.calcHeaderIconBox) {
      this.calcHeaderIconBox.style.background = isAkbank
        ? 'linear-gradient(135deg, #d63031, #ff4757)'
        : 'linear-gradient(135deg, #0077b6, #00b4d8)';
      this.calcHeaderIconBox.style.boxShadow = isAkbank
        ? '0 3px 10px rgba(255, 71, 87, 0.35)'
        : '0 3px 10px rgba(0, 180, 216, 0.35)';
    }

    if (this.calcModalTitleWrap) {
      this.calcModalTitleWrap.style.color = isAkbank ? '#ff6b81' : 'var(--accent-cyan)';
    }

    if (this.calcModalTitle) {
      this.calcModalTitle.textContent = isAkbank
        ? 'Akbank Döviz Çevirici & Kur Hesaplama'
        : 'TCMB Döviz Çevirici & Kur Hesaplama';
    }

    if (this.calcModalSubtitle) {
      this.calcModalSubtitle.innerHTML = isAkbank
        ? 'Akbank Canlı <strong>Gişe Satış (Bank Selling)</strong> kurları baz alınmaktadır.'
        : 'T.C. Merkez Bankası <strong>Efektif Satış (Banknote Selling)</strong> kurları baz alınmaktadır.';
      this.calcModalSubtitle.style.color = isAkbank ? '#ffd2d7' : '#8ecae6';
    }

    if (this.calcBulletinIcon) {
      this.calcBulletinIcon.setAttribute('stroke', isAkbank ? '#ff4757' : '#00b4d8');
    }

    // Bilgi çubuğu
    if (this.calcTcmbBulletinInfo) {
      if (isAkbank) {
        const akDate = this.akbankRates.date || new Date().toLocaleString('tr-TR');
        this.calcTcmbBulletinInfo.innerHTML = `Akbank Canlı Gişe | Son Güncelleme: <strong>${akDate}</strong>`;
      } else {
        const tcDate = this.tcmbRates.date || '08.09.2026';
        const tcNo = this.tcmbRates.bulletinNo ? `(No: ${this.tcmbRates.bulletinNo})` : '';
        this.calcTcmbBulletinInfo.innerHTML = `TCMB Efektif Satış | Bülten: <strong>${tcDate}</strong> ${tcNo}`;
      }
    }

    // Input etiketleri
    if (this.lblRateEur) {
      this.lblRateEur.textContent = isAkbank ? '💶 1 EURO (EUR) Akbank Satış:' : '💶 1 EURO (EUR) Efektif Satış:';
    }
    if (this.lblRateUsd) {
      this.lblRateUsd.textContent = isAkbank ? '💵 1 DOLAR (USD) Akbank Satış:' : '💵 1 DOLAR (USD) Efektif Satış:';
    }

    const currentRates = isAkbank ? this.akbankRates : this.tcmbRates;
    const activeEur = (this.customRates.eur !== null) ? this.customRates.eur : currentRates.eur;
    const activeUsd = (this.customRates.usd !== null) ? this.customRates.usd : currentRates.usd;

    if (this.inputRateEur) {
      this.inputRateEur.value = activeEur.toFixed(4);
      this.inputRateEur.style.color = isAkbank ? '#ff6b81' : '#00b4d8';
    }
    if (this.inputRateUsd) {
      this.inputRateUsd.value = activeUsd.toFixed(4);
      this.inputRateUsd.style.color = isAkbank ? '#ff6b81' : '#00b4d8';
    }

    // Footer notu
    if (this.calcModalFooterNote) {
      this.calcModalFooterNote.innerHTML = isAkbank
        ? '* Akbank Gişe Satış kurları akbank.com üzerinden anlık ve canlı olarak çekilmektedir.'
        : '* TCMB Efektif Satış kurları her iş günü 15:30\'da bültenleşir ve ertesi gün 15:30\'a kadar yürürlüktedir.';
    }

    this.updateRateBadges();
    this.calculateCurrencyTable();
  }

  openCurrencyCalcModal() {
    try {
      if (!this.modalCurrencyCalc) {
        this.modalCurrencyCalc = document.getElementById('modal-currency-calc');
      }
      if (!this.modalCurrencyCalc) {
        console.error('modalCurrencyCalc element not found!');
        return;
      }

      // Teklifin güncel toplamlarını hesapla (Kullanıcı isteği: işlem her zaman KDV'siz alınır)
      const { subtotal } = this.calculateTotals ? this.calculateTotals() : { subtotal: 0 };
      const curr = (this.state && this.state.currency) ? this.state.currency : 'EUR';

      if (this.badgeQuoteSubtotalPreview) {
        this.badgeQuoteSubtotalPreview.textContent = this.formatCurrency(subtotal);
      }

      // İlk açılışta teklifin KDV'siz ara toplamını getir (boşsa 1.000)
      const initialAmount = subtotal > 0 ? subtotal : 1000;
      if (this.inputCalcAmount) {
        this.inputCalcAmount.value = this.formatNumberInput(initialAmount);
      }

      // Kaynak para birimini teklifin para birimine ayarla
      this.setCalcSourceCurrency(curr);

      // Akbank kuru aktifse modalı otomatik Akbank kurlarıyla aç
      const isAkbank = !!(this.state && this.state.remarksConfig && this.state.remarksConfig.useAkbankRate);
      this.activeRateProvider = isAkbank ? 'akbank' : 'tcmb';

      this.applyRateProviderUI();

      // Modalı aç
      this.modalCurrencyCalc.classList.add('active');

      setTimeout(() => {
        if (this.inputCalcAmount) {
          this.inputCalcAmount.focus();
          this.inputCalcAmount.select();
        }
      }, 60);

      // Eğer kurlar henüz çekilmediyse arka planda çek
      if (this.activeRateProvider === 'akbank') {
        if (!this.akbankRates || !this.akbankRates.isFetched) {
          this.fetchAkbankRates(false);
        }
      } else {
        if (!this.tcmbRates || !this.tcmbRates.isFetched) {
          this.fetchTcmbRates(false);
        }
      }
    } catch (err) {
      console.error('openCurrencyCalcModal error:', err);
    }
  }

  closeCurrencyCalcModal() {
    if (!this.modalCurrencyCalc) {
      this.modalCurrencyCalc = document.getElementById('modal-currency-calc');
    }
    if (this.modalCurrencyCalc) {
      this.modalCurrencyCalc.classList.remove('active');
    }
  }

  setCalcSourceCurrency(curr) {
    const validCurr = ['EUR', 'USD', 'TRY'].includes(curr) ? curr : 'EUR';
    this.calcSourceCurrency = validCurr;
    if (this.calcCurrencyToggles) {
      this.calcCurrencyToggles.forEach(btn => {
        if (btn.getAttribute('data-cur') === validCurr) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }

  onRateInputChange() {
    const baseRates = (this.activeRateProvider === 'akbank') ? this.akbankRates : this.tcmbRates;
    const eurVal = parseFloat((this.inputRateEur ? this.inputRateEur.value : '').replace(',', '.'));
    const usdVal = parseFloat((this.inputRateUsd ? this.inputRateUsd.value : '').replace(',', '.'));

    if (!isNaN(eurVal) && eurVal > 0) {
      const isDiff = Math.abs(eurVal - baseRates.eur) > 0.0001;
      this.customRates.eur = isDiff ? eurVal : null;
    }
    if (!isNaN(usdVal) && usdVal > 0) {
      const isDiff = Math.abs(usdVal - baseRates.usd) > 0.0001;
      this.customRates.usd = isDiff ? usdVal : null;
    }

    this.updateRateBadges();
    this.calculateCurrencyTable();
  }

  updateRateBadges() {
    const isEurCustom = this.customRates.eur !== null;
    const isUsdCustom = this.customRates.usd !== null;
    const isAkbank = (this.activeRateProvider === 'akbank');
    const defaultBadgeText = isAkbank ? 'AKBANK' : 'TCMB';
    const defaultBadgeClass = isAkbank ? 'akbank' : 'tcmb';

    if (this.badgeRateEur) {
      this.badgeRateEur.textContent = isEurCustom ? 'Özel Kur' : defaultBadgeText;
      this.badgeRateEur.className = `rate-badge ${isEurCustom ? 'custom' : defaultBadgeClass}`;
    }
    if (this.badgeRateUsd) {
      this.badgeRateUsd.textContent = isUsdCustom ? 'Özel Kur' : defaultBadgeText;
      this.badgeRateUsd.className = `rate-badge ${isUsdCustom ? 'custom' : defaultBadgeClass}`;
    }
    if (this.btnResetTcmbRates) {
      this.btnResetTcmbRates.style.display = (isEurCustom || isUsdCustom) ? 'inline-block' : 'none';
      this.btnResetTcmbRates.textContent = isAkbank ? '↺ Akbank Kurlarına Dön' : '↺ TCMB Kurlarına Dön';
    }
  }

  resetRatesToOriginal() {
    this.customRates.eur = null;
    this.customRates.usd = null;
    const baseRates = (this.activeRateProvider === 'akbank') ? this.akbankRates : this.tcmbRates;
    if (this.inputRateEur) this.inputRateEur.value = baseRates.eur.toFixed(4);
    if (this.inputRateUsd) this.inputRateUsd.value = baseRates.usd.toFixed(4);
    this.updateRateBadges();
    this.calculateCurrencyTable();
    const provName = (this.activeRateProvider === 'akbank') ? 'Akbank Canlı Gişe Satış' : 'TCMB Efektif Satış';
    this.showToast(`Kurlar orijinal ${provName} değerlerine döndürüldü.`, 'info');
  }

  formatNumberInput(num) {
    if (isNaN(num) || num === null || num === undefined) return '0,00';
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  }

  parseNumberInput(str) {
    if (!str) return 0;
    if (typeof str === 'number') return isNaN(str) ? 0 : str;
    let s = str.toString().trim().replace(/[^\d.,-]/g, '');
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const val = parseFloat(s);
    return isNaN(val) ? 0 : val;
  }

  formatMoneyWithSymbol(amount, curCode) {
    const formatted = new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);

    const symbols = {
      'EUR': '€',
      'USD': '$',
      'TRY': '₺'
    };
    const sym = symbols[curCode] || curCode;
    return `${formatted} ${sym}`;
  }

  calculateCurrencyTable() {
    if (!this.calcResultsTbody) return;

    // Girilen tutar her zaman KDV'siz (Net) tutar olarak işlenir
    // Girilen tutar her zaman KDV'siz (Net) tutardır (Kullanıcı isteği: işlem KDV'siz alınır)
    const sourceNet = this.parseNumberInput(this.inputCalcAmount ? this.inputCalcAmount.value : '0');
    const sourceCur = this.calcSourceCurrency || 'EUR';
    const vatRate = parseFloat(this.selectCalcVat ? this.selectCalcVat.value : '20') || 0;

    // Aktif Efektif Satış Kurları (TL karşılıkları)
    const baseRates = (this.activeRateProvider === 'akbank') ? this.akbankRates : this.tcmbRates;
    const rateEur = (this.customRates.eur !== null) ? this.customRates.eur : baseRates.eur;
    const rateUsd = (this.customRates.usd !== null) ? this.customRates.usd : baseRates.usd;

    const sourceGross = sourceNet * (1 + (vatRate / 100));

    // TL cinsinden Net baz değeri bul
    let tlNet = 0;
    if (sourceCur === 'TRY') {
      tlNet = sourceNet;
    } else if (sourceCur === 'EUR') {
      tlNet = sourceNet * rateEur;
    } else if (sourceCur === 'USD') {
      tlNet = sourceNet * rateUsd;
    }

    // 3 para birimi için de değerleri türet
    const currencies = [
      { code: 'EUR', name: 'EURO', flag: '💶', sym: '€' },
      { code: 'USD', name: 'DOLAR', flag: '💵', sym: '$' },
      { code: 'TRY', name: 'TÜRK LİRASI', flag: '🇹🇷', sym: '₺' }
    ];

    if (this.thCalcVatCol) {
      this.thCalcVatCol.textContent = `KDV (%${vatRate})`;
    }

    let rowsHtml = '';
    currencies.forEach(c => {
      let curNet = 0;
      let appliedRateStr = '';

      if (c.code === 'TRY') {
        curNet = tlNet;
        appliedRateStr = '1 ₺ = 1,0000 ₺';
      } else if (c.code === 'EUR') {
        curNet = rateEur > 0 ? (tlNet / rateEur) : 0;
        appliedRateStr = `1 € = ${rateEur.toFixed(4)} ₺`;
      } else if (c.code === 'USD') {
        curNet = rateUsd > 0 ? (tlNet / rateUsd) : 0;
        appliedRateStr = `1 $ = ${rateUsd.toFixed(4)} ₺`;
      }

      const curVat = curNet * (vatRate / 100);
      const curGross = curNet + curVat;

      const isSource = (c.code === sourceCur);
      const rowClass = isSource ? 'active-source-row' : '';

      const netFormatted = this.formatMoneyWithSymbol(curNet, c.code);
      const vatFormatted = this.formatMoneyWithSymbol(curVat, c.code);
      const grossFormatted = this.formatMoneyWithSymbol(curGross, c.code);

      rowsHtml += `
        <tr class="${rowClass}">
          <td style="text-align: left;">
            <div class="calc-currency-badge">
              <span>${c.flag}</span>
              <span>${c.name}</span>
              ${isSource ? '<span style="font-size: 0.65rem; color: #00b4d8; background: rgba(0,180,216,0.15); padding: 1px 5px; border-radius: 4px; font-weight: 600;">Kaynak</span>' : ''}
            </div>
          </td>
          <td style="text-align: right; color: #cbd5e1; font-weight: 600;">${netFormatted}</td>
          <td style="text-align: right; color: #94a3b8;">${vatFormatted}</td>
          <td style="text-align: right; font-weight: 700; color: var(--accent-emerald); font-size: 0.95rem;">${grossFormatted}</td>
          <td style="text-align: right; color: #8ecae6; font-size: 0.76rem; font-family: monospace;">${appliedRateStr}</td>
          <td style="text-align: center;">
            <button type="button" class="btn-copy-calc" data-copy="${grossFormatted}" title="KDV Dahil Tutarı Kopyala">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Kopyala</span>
            </button>
          </td>
        </tr>
      `;
    });

    this.calcResultsTbody.innerHTML = rowsHtml;

    // Kopyalama butonlarını bağla
    this.calcResultsTbody.querySelectorAll('.btn-copy-calc').forEach(btn => {
      btn.addEventListener('click', () => {
        const textToCopy = btn.getAttribute('data-copy');
        if (navigator.clipboard && textToCopy) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            this.showToast(`Kopyalandı: ${textToCopy}`, 'info');
          });
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Marka Alış İskonto Oranları & Değişiklik Geçmişi (Audit Trail) Yönetimi
  // --------------------------------------------------------------------------
  getCurrentUserDisplay() {
    return (this.state && this.state.profile && this.state.profile.preparedBy) 
      ? this.state.profile.preparedBy.trim() 
      : (localStorage.getItem('ortek_prepared_by') || 'Melih Kurtgün');
  }

  formatDateDisplay(dateInput) {
    if (!dateInput) return '-';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch (e) {
      return String(dateInput);
    }
  }

  getDefaultBrandDiscounts() {
    return [
      { id: 'city_pumps', name: 'City Pumps', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'ebara', name: 'Ebara', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'element', name: 'Element', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'furnas', name: 'Furnas', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'hidrotank', name: 'Hidrotank', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      {
        id: 'impo',
        name: 'İmpo',
        type: 'tiered',
        rate: null,
        tiers: [
          { id: 'impo_t01', name: 'T01 Grubu', note: 'Dalgıç Pompalar', rate: 30 },
          { id: 'impo_t02_combo', name: 'T02-T10-T13-T16-T17-T18 Grubu', note: 'Motor & Standart Seri', rate: 48.97 },
          { id: 'impo_t04_combo', name: 'T04-T06-T07-T09-T11 Grubu', note: 'Özel Seri Grubu', rate: 43.3 },
          { id: 'impo_t10', name: 'T10 Grubu', note: 'Kontrol & Pano', rate: 48.97 },
          { id: 'impo_t5', name: 'T5 Grubu', note: 'Aksesuar & Yedek Parça', rate: 40 }
        ],
        updatedBy: 'Sistem',
        updatedAt: '2026-09-11T12:00:00.000Z',
        canDelete: false
      },
      { id: 'kresmak', name: 'Kresmak', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'lowara', name: 'Lowara', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'momentum', name: 'Momentum', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'alarko', name: 'Alarko', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'standart', name: 'Standart', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'sumak', name: 'Sumak', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      { id: 'tr_tank', name: 'TR Tank', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false },
      {
        id: 'wilo',
        name: 'Wilo',
        type: 'tiered',
        rate: null,
        tiers: [
          { id: 'wilo_1', name: 'Wilo Grup 1', note: 'Dalgıç & Sirkülasyon Grubu', rate: 35 },
          { id: 'wilo_2', name: 'Wilo Grup 2', note: 'Hidrofor & Atıksu Grubu', rate: 40 }
        ],
        updatedBy: 'Sistem',
        updatedAt: '2026-09-11T12:00:00.000Z',
        canDelete: false
      },
      { id: 'yildizsu', name: 'Yıldızsu', type: 'single', rate: 40, updatedBy: 'Sistem', updatedAt: '2026-09-11T12:00:00.000Z', canDelete: false }
    ];
  }

  initBrandDiscounts() {
    try {
      const savedBrands = localStorage.getItem('ortek_brand_discounts');
      const defaultBrands = this.getDefaultBrandDiscounts();
      if (savedBrands) {
        try {
          const parsed = JSON.parse(savedBrands);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const existingIds = new Set(parsed.map(b => b.id));
            defaultBrands.forEach(def => {
              if (!existingIds.has(def.id)) {
                parsed.push(def);
              }
            });
            this.brandDiscounts = parsed;
          } else {
            this.brandDiscounts = defaultBrands;
          }
        } catch (e) {
          this.brandDiscounts = defaultBrands;
        }
      } else {
        this.brandDiscounts = defaultBrands;
      }

      // Grunfos markasını listeden tamamen filtrele ve kaldır
      this.brandDiscounts = this.brandDiscounts.filter(b => b.id !== 'grunfos' && b.name.toLowerCase() !== 'grunfos' && b.name.toLowerCase() !== 'grundfos');
      localStorage.setItem('ortek_brand_discounts', JSON.stringify(this.brandDiscounts));

      const savedHistory = localStorage.getItem('ortek_discount_history');
      if (savedHistory) {
        try {
          this.discountHistory = JSON.parse(savedHistory) || [];
        } catch (e) {
          this.discountHistory = [];
        }
      }

      // Firestore Senkronizasyonu
      if (typeof db !== 'undefined' && db) {
        // Firestore'dan da Grunfos'u temizle
        db.collection('brand_discounts').doc('current').set({
          brands: this.brandDiscounts,
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: 'Sistem'
        }, { merge: true }).catch(err => console.warn('Firestore Grunfos remove error:', err));

        db.collection('brand_discounts').doc('current').onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            if (data && Array.isArray(data.brands) && data.brands.length > 0) {
              this.brandDiscounts = data.brands.filter(b => b.id !== 'grunfos' && b.name.toLowerCase() !== 'grunfos' && b.name.toLowerCase() !== 'grundfos');
              localStorage.setItem('ortek_brand_discounts', JSON.stringify(this.brandDiscounts));

              const isTypingInList = document.activeElement && this.brandDiscountsList && this.brandDiscountsList.contains(document.activeElement);
              if (!isTypingInList && this.modalBrandDiscounts && this.modalBrandDiscounts.classList.contains('active')) {
                const q = this.inputSearchBrandDiscounts ? this.inputSearchBrandDiscounts.value : '';
                this.renderBrandDiscountsList(q);
              }

              const isTypingInTierModal = document.activeElement && this.tierItemsTableContainer && this.tierItemsTableContainer.contains(document.activeElement);
              if (!isTypingInTierModal && this.modalTierDiscounts && this.modalTierDiscounts.classList.contains('active') && this.selectedTierBrandId) {
                this.renderTierDiscountsTable(this.selectedTierBrandId);
              }
            }
          }
        }, (err) => console.warn('Firestore brand_discounts onSnapshot error:', err));

        db.collection('discount_history').orderBy('timestamp', 'desc').limit(150).onSnapshot((snapshot) => {
          const hist = [];
          snapshot.forEach(d => {
            hist.push({ id: d.id, ...d.data() });
          });
          if (hist.length > 0) {
            this.discountHistory = hist;
            localStorage.setItem('ortek_discount_history', JSON.stringify(this.discountHistory));
            if (this.modalDiscountHistory && this.modalDiscountHistory.classList.contains('active')) {
              const f = this.selectHistoryBrandFilter ? this.selectHistoryBrandFilter.value : 'all';
              this.renderDiscountHistory(f);
            }
          }
        }, (err) => console.warn('Firestore discount_history onSnapshot error:', err));
      }
    } catch (err) {
      console.error('initBrandDiscounts error:', err);
    }
  }

  saveBrandDiscounts(historyEntry = null, reRenderTierTable = false, reRenderList = true) {
    try {
      localStorage.setItem('ortek_brand_discounts', JSON.stringify(this.brandDiscounts));

      if (typeof db !== 'undefined' && db) {
        db.collection('brand_discounts').doc('current').set({
          brands: this.brandDiscounts,
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: this.getCurrentUserDisplay()
        }).catch(err => console.warn('Firestore brand_discounts set error:', err));
      }

      if (historyEntry) {
        this.discountHistory.unshift(historyEntry);
        if (this.discountHistory.length > 200) {
          this.discountHistory = this.discountHistory.slice(0, 200);
        }
        localStorage.setItem('ortek_discount_history', JSON.stringify(this.discountHistory));

        if (typeof db !== 'undefined' && db) {
          db.collection('discount_history').add(historyEntry).catch(err => console.warn('Firestore discount_history add error:', err));
        }
      }

      if (reRenderList) {
        const isTyping = document.activeElement && this.brandDiscountsList && this.brandDiscountsList.contains(document.activeElement);
        if (!isTyping) {
          const q = this.inputSearchBrandDiscounts ? this.inputSearchBrandDiscounts.value : '';
          this.renderBrandDiscountsList(q);
        }
      }

      if (reRenderTierTable && this.modalTierDiscounts && this.modalTierDiscounts.classList.contains('active') && this.selectedTierBrandId) {
        this.renderTierDiscountsTable(this.selectedTierBrandId);
      }
    } catch (err) {
      console.error('saveBrandDiscounts error:', err);
    }
  }

  openBrandDiscountsModal() {
    try {
      if (!this.modalBrandDiscounts) {
        this.modalBrandDiscounts = document.getElementById('modal-brand-discounts');
      }
      if (!this.modalBrandDiscounts) return;

      if (this.inputSearchBrandDiscounts) {
        this.inputSearchBrandDiscounts.value = '';
      }
      this.renderBrandDiscountsList('');
      this.modalBrandDiscounts.classList.add('active');
    } catch (err) {
      console.error('openBrandDiscountsModal error:', err);
    }
  }

  closeBrandDiscountsModal() {
    if (this.modalBrandDiscounts) {
      this.modalBrandDiscounts.classList.remove('active');
    }
  }

  // --------------------------------------------------------------------------
  // İskonto Güvenlik & PIN Onay Yardımcıları
  // --------------------------------------------------------------------------
  parseDiscountRate(val) {
    if (val === null || val === undefined) return NaN;
    const s = String(val).trim().replace(',', '.');
    const num = parseFloat(s);
    return isNaN(num) ? NaN : Math.round(num * 100) / 100;
  }

  formatDiscountRate(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return String(val);
  }

  promptDiscountPinConfirmation({ targetName, oldValDisplay, newValDisplay, customDescription = '', onConfirm, onCancel }) {
    if (!this.modalConfirmDiscountPin) {
      this.modalConfirmDiscountPin = document.getElementById('modal-confirm-discount-pin');
    }
    if (!this.modalConfirmDiscountPin) {
      if (typeof onConfirm === 'function') onConfirm();
      return;
    }

    const currentAuthor = this.getCurrentUserDisplay();
    if (this.discountPinTargetName) this.discountPinTargetName.textContent = targetName || 'İskonto Değişikliği';
    if (this.discountPinOldVal) this.discountPinOldVal.textContent = oldValDisplay || '-';
    if (this.discountPinNewVal) this.discountPinNewVal.textContent = newValDisplay || '-';
    if (this.discountPinAuthor) this.discountPinAuthor.textContent = currentAuthor;

    if (this.discountPinCustomDesc) {
      if (customDescription) {
        this.discountPinCustomDesc.textContent = customDescription;
        this.discountPinCustomDesc.style.display = 'block';
      } else {
        this.discountPinCustomDesc.style.display = 'none';
      }
    }

    if (this.inputDiscountPin) {
      this.inputDiscountPin.value = '';
      this.inputDiscountPin.type = 'password';
      this.inputDiscountPin.classList.remove('pin-shake-anim');
    }
    if (this.discountPinError) {
      this.discountPinError.style.display = 'none';
      this.discountPinError.textContent = 'Hatalı PIN kodu!';
    }
    if (this.btnToggleDiscountPin) {
      this.btnToggleDiscountPin.style.color = '#94a3b8';
    }

    this.discountPinCallback = onConfirm;
    this.discountPinCancelCallback = onCancel;

    this.modalConfirmDiscountPin.classList.add('active');
    setTimeout(() => {
      if (this.inputDiscountPin) {
        this.inputDiscountPin.focus();
      }
    }, 60);
  }

  closeDiscountPinModal(isConfirmed = false) {
    if (this.modalConfirmDiscountPin) {
      this.modalConfirmDiscountPin.classList.remove('active');
    }
    if (!isConfirmed && typeof this.discountPinCancelCallback === 'function') {
      this.discountPinCancelCallback();
    }
    this.discountPinCallback = null;
    this.discountPinCancelCallback = null;
  }

  submitDiscountPinVerification() {
    if (!this.inputDiscountPin) return;
    const enteredPin = this.inputDiscountPin.value.trim();

    const currentAuthor = this.getCurrentUserDisplay();
    let expectedPin = this.getUserPin(currentAuthor);
    if (!expectedPin && this.state && this.state.profile && this.state.profile.securityPin) {
      expectedPin = String(this.state.profile.securityPin).trim();
    }
    if (!expectedPin) {
      expectedPin = '1234';
    }

    if (enteredPin !== expectedPin) {
      if (this.discountPinError) {
        this.discountPinError.textContent = `Hatalı PIN! (${currentAuthor} şifresi girilmelidir)`;
        this.discountPinError.style.display = 'block';
      }
      this.inputDiscountPin.classList.remove('pin-shake-anim');
      void this.inputDiscountPin.offsetWidth;
      this.inputDiscountPin.classList.add('pin-shake-anim');
      this.inputDiscountPin.value = '';
      this.inputDiscountPin.focus();
      return;
    }

    const cb = this.discountPinCallback;
    this.closeDiscountPinModal(true);
    if (typeof cb === 'function') {
      cb();
    }
  }

  renderBrandDiscountsList(searchQuery = '') {
    if (!this.brandDiscountsList) return;
    const q = (searchQuery || '').trim().toLowerCase();

    const filtered = (this.brandDiscounts || []).filter(b => {
      if (!q) return true;
      if (b.name && b.name.toLowerCase().includes(q)) return true;
      if (b.tiers && Array.isArray(b.tiers)) {
        return b.tiers.some(t => (t.name && t.name.toLowerCase().includes(q)) || (t.note && t.note.toLowerCase().includes(q)));
      }
      return false;
    });

    if (this.brandDiscountsCounter) {
      this.brandDiscountsCounter.textContent = `Toplam ${filtered.length} marka listeleniyor${q ? ' (filtrelendi)' : ''}`;
    }

    if (filtered.length === 0) {
      this.brandDiscountsList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #94a3b8; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.6;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style="font-size: 0.9rem; font-weight: 600;">"${searchQuery}" ile eşleşen marka bulunamadı.</div>
          <div style="font-size: 0.76rem; margin-top: 4px; color: #64748b;">Yeni marka eklemek için yukarıdaki "+ Yeni Marka Ekle" butonunu kullanabilirsiniz.</div>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(b => {
      const isTiered = (b.type === 'tiered');
      const updatedDisplay = `${b.updatedBy || 'Sistem'} • ${this.formatDateDisplay(b.updatedAt)}`;

      let bodyHtml = '';
      let headerBadgesExtra = '';

      if (isTiered) {
        const tiers = b.tiers || [];
        const tiersHtml = tiers.map(t => `
          <div class="brand-tier-row">
            <div class="tier-name-col" title="${t.note || ''}">
              <span class="tier-bullet"></span>
              <span class="tier-name-text">${t.name}</span>
              ${t.note ? `<span class="tier-note-text">(${t.note})</span>` : ''}
            </div>
            <div class="tier-rate-col">
              <div class="brand-rate-input-wrap">
                <input type="text" inputmode="decimal" autocomplete="off" class="brand-rate-input tier-rate-direct-input" 
                       data-brand-id="${b.id}" data-tier-id="${t.id}" value="${this.formatDiscountRate(t.rate)}" 
                       title="${t.name} iskontosunu değiştirmek için tıklayıp yeni değer yazınız">
                <span style="font-weight: 700; color: #38bdf8; font-size: 0.85rem;">%</span>
              </div>
            </div>
          </div>
        `).join('');

        headerBadgesExtra = `
          <button type="button" class="btn-edit-tiers" data-brand-id="${b.id}" title="${b.name} kademelerini düzenle / yeni kademe ekle">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Kademeleri Yönet / Ekle</span>
          </button>
        `;

        bodyHtml = `
          <div class="brand-tiers-list">
            ${tiersHtml}
          </div>
        `;
      } else {
        bodyHtml = `
          <div class="brand-rate-input-wrap">
            <span class="rate-label">Alış İskontosu:</span>
            <input type="text" inputmode="decimal" autocomplete="off" class="brand-rate-input single-rate-direct-input" data-brand-id="${b.id}" value="${this.formatDiscountRate(b.rate)}" title="İskonto oranını değiştirmek için tıklayıp yeni değer yazınız">
            <span style="font-weight: 700; color: #fbbf24; font-size: 0.85rem;">%</span>
          </div>
          <div style="font-size: 0.72rem; color: #94a3b8;">
            Tüm ürünlerde tek oran
          </div>
        `;
      }

      html += `
        <div class="brand-card ${isTiered ? 'tiered-brand' : 'single-brand'}" id="card-brand-${b.id}">
          <div class="brand-card-header">
            <div class="brand-card-title">
              <span>${b.name}</span>
            </div>
            <div class="brand-card-badges">
              <span class="badge-brand-type ${isTiered ? 'tiered' : 'single'}">
                ${isTiered ? (b.id === 'wilo' ? '2 Kademe' : 'Kademeli') : 'Tek Oran'}
              </span>
              ${headerBadgesExtra}
              ${b.canDelete ? `
                <button type="button" class="btn-brand-delete" data-brand-id="${b.id}" title="Bu markayı sil">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              ` : ''}
            </div>
          </div>

          <div class="brand-card-body" ${isTiered ? 'style="flex-direction: column; align-items: stretch; background: rgba(0,0,0,0.18);"' : ''}>
            ${bodyHtml}
          </div>

          <div class="brand-card-footer">
            <div class="brand-card-updated" title="Son güncelleyen ve tarih">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Son güncelleyen: <strong>${updatedDisplay}</strong></span>
            </div>
            <button type="button" class="btn-brand-history" data-brand-id="${b.id}" title="${b.name} için değişiklik geçmişini görüntüle">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M12 7v5l4 2"/>
              </svg>
              <span>Geçmiş</span>
            </button>
          </div>
        </div>
      `;
    });

    this.brandDiscountsList.innerHTML = html;

    // Tek oranlı input dinleyicileri
    this.brandDiscountsList.querySelectorAll('.single-rate-direct-input').forEach(input => {
      input.addEventListener('focus', (e) => e.target.select());
      input.addEventListener('click', (e) => e.target.select());

      const handleRateCommit = (e) => {
        const bId = e.target.getAttribute('data-brand-id');
        const targetBrand = this.brandDiscounts.find(x => x.id === bId);
        if (!targetBrand) return;

        const val = this.parseDiscountRate(e.target.value);
        if (isNaN(val) || val < 0 || val > 100) {
          this.showToast('Lütfen 0 ile 100 arasında geçerli bir iskonto oranı giriniz (örn: 40 veya 48.97).', 'warning');
          e.target.value = this.formatDiscountRate(targetBrand.rate);
          return;
        }

        const oldRate = parseFloat(targetBrand.rate);
        if (oldRate === val) {
          e.target.value = this.formatDiscountRate(val);
          return;
        }

        this.promptDiscountPinConfirmation({
          targetName: targetBrand.name,
          oldValDisplay: `% ${this.formatDiscountRate(oldRate)}`,
          newValDisplay: `% ${this.formatDiscountRate(val)}`,
          customDescription: `${targetBrand.name} alış iskonto oranı güncellenecektir.`,
          onConfirm: () => {
            const currentUser = this.getCurrentUserDisplay();
            const now = new Date();

            targetBrand.rate = val;
            targetBrand.updatedBy = currentUser;
            targetBrand.updatedAt = now.toISOString();

            const historyEntry = {
              id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              brandId: targetBrand.id,
              brandName: targetBrand.name,
              action: 'rate_update',
              oldRate: oldRate,
              newRate: val,
              description: `${targetBrand.name} iskontosu %${oldRate} ➔ %${val} olarak güncellendi`,
              updatedBy: currentUser,
              updatedAt: now.toISOString(),
              timestamp: Date.now()
            };

            const card = document.getElementById(`card-brand-${targetBrand.id}`);
            if (card) {
              const updatedEl = card.querySelector('.brand-card-updated strong');
              if (updatedEl) updatedEl.textContent = `${currentUser} • ${this.formatDateDisplay(now)}`;
            }

            e.target.value = this.formatDiscountRate(val);
            this.saveBrandDiscounts(historyEntry, false, false);
            this.showToast(`${targetBrand.name} iskontosu %${val} olarak güncellendi.`, 'success');
          },
          onCancel: () => {
            e.target.value = this.formatDiscountRate(targetBrand.rate);
          }
        });
      };

      input.addEventListener('change', handleRateCommit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });
    });

    // Kademeli marka doğrudan oran input dinleyicileri (Kart üzerindeki her kademe kutusu)
    this.brandDiscountsList.querySelectorAll('.tier-rate-direct-input').forEach(input => {
      input.addEventListener('focus', (e) => e.target.select());
      input.addEventListener('click', (e) => e.target.select());

      const handleTierRateCommit = (e) => {
        const bId = e.target.getAttribute('data-brand-id');
        const tId = e.target.getAttribute('data-tier-id');
        const targetBrand = this.brandDiscounts.find(x => x.id === bId);
        if (!targetBrand || !targetBrand.tiers) return;
        const targetTier = targetBrand.tiers.find(t => t.id === tId);
        if (!targetTier) return;

        const val = this.parseDiscountRate(e.target.value);
        if (isNaN(val) || val < 0 || val > 100) {
          this.showToast('Lütfen 0 ile 100 arasında geçerli bir iskonto oranı giriniz.', 'warning');
          e.target.value = this.formatDiscountRate(targetTier.rate);
          return;
        }

        const oldRate = parseFloat(targetTier.rate);
        if (oldRate === val) {
          e.target.value = this.formatDiscountRate(val);
          return;
        }

        this.promptDiscountPinConfirmation({
          targetName: `${targetBrand.name} (${targetTier.name})`,
          oldValDisplay: `% ${this.formatDiscountRate(oldRate)}`,
          newValDisplay: `% ${this.formatDiscountRate(val)}`,
          customDescription: `${targetBrand.name} markasının ${targetTier.name} grubu iskontosu güncellenecektir.`,
          onConfirm: () => {
            const currentUser = this.getCurrentUserDisplay();
            const now = new Date();

            targetTier.rate = val;
            targetBrand.updatedBy = currentUser;
            targetBrand.updatedAt = now.toISOString();

            const historyEntry = {
              id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              brandId: targetBrand.id,
              brandName: targetBrand.name,
              tierId: targetTier.id,
              tierName: targetTier.name,
              action: 'rate_update',
              oldRate: oldRate,
              newRate: val,
              description: `${targetBrand.name} (${targetTier.name}) iskontosu %${oldRate} ➔ %${val} olarak güncellendi`,
              updatedBy: currentUser,
              updatedAt: now.toISOString(),
              timestamp: Date.now()
            };

            const card = document.getElementById(`card-brand-${targetBrand.id}`);
            if (card) {
              const updatedEl = card.querySelector('.brand-card-updated strong');
              if (updatedEl) updatedEl.textContent = `${currentUser} • ${this.formatDateDisplay(now)}`;
            }

            e.target.value = this.formatDiscountRate(val);
            this.saveBrandDiscounts(historyEntry, false, false);
            this.showToast(`${targetBrand.name} (${targetTier.name}) iskontosu %${val} olarak güncellendi.`, 'success');
          },
          onCancel: () => {
            e.target.value = this.formatDiscountRate(targetTier.rate);
          }
        });
      };

      input.addEventListener('change', handleTierRateCommit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });
    });

    // Kademeleri Düzenle Butonları
    this.brandDiscountsList.querySelectorAll('.btn-edit-tiers').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = btn.getAttribute('data-brand-id');
        this.openTierDiscountsModal(bId);
      });
    });

    // Geçmiş Butonları (Saat ve Geri Dönüş Oku İkonlu)
    this.brandDiscountsList.querySelectorAll('.btn-brand-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = btn.getAttribute('data-brand-id');
        this.openDiscountHistoryModal(bId);
      });
    });

    // Marka Silme Butonları (varsa)
    this.brandDiscountsList.querySelectorAll('.btn-brand-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = btn.getAttribute('data-brand-id');
        this.deleteBrand(bId);
      });
    });
  }

  openTierDiscountsModal(brandId) {
    try {
      const brand = (this.brandDiscounts || []).find(b => b.id === brandId);
      if (!brand) return;

      this.selectedTierBrandId = brandId;
      if (this.tierModalBrandTitle) {
        this.tierModalBrandTitle.textContent = brand.name;
      }

      this.renderTierDiscountsTable(brandId);
      if (this.modalTierDiscounts) {
        this.modalTierDiscounts.classList.add('active');
      }
    } catch (err) {
      console.error('openTierDiscountsModal error:', err);
    }
  }

  closeTierDiscountsModal() {
    if (this.modalTierDiscounts) {
      this.modalTierDiscounts.classList.remove('active');
    }
    this.selectedTierBrandId = null;
    const q = this.inputSearchBrandDiscounts ? this.inputSearchBrandDiscounts.value : '';
    this.renderBrandDiscountsList(q);
  }

  renderTierDiscountsTable(brandId) {
    if (!this.tierItemsTableContainer) return;
    const brand = (this.brandDiscounts || []).find(b => b.id === brandId);
    if (!brand || !Array.isArray(brand.tiers)) return;

    let rowsHtml = '';
    brand.tiers.forEach((tier, index) => {
      rowsHtml += `
        <tr data-tier-id="${tier.id}">
          <td style="width: 42%;">
            <input type="text" class="form-control tier-name-input" data-tier-id="${tier.id}" value="${tier.name || ''}" placeholder="Kademe Adı (örn: T1 Grubu)" style="font-size: 0.82rem; font-weight: 600; width: 100%;">
          </td>
          <td style="width: 34%;">
            <input type="text" class="form-control tier-note-input" data-tier-id="${tier.id}" value="${tier.note || ''}" placeholder="Ürün Grubu / Açıklama (örn: Dalgıç Pompalar)" style="font-size: 0.78rem; color: #cbd5e1; width: 100%;">
          </td>
          <td style="width: 14%; text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 4px; justify-content: flex-end;">
              <input type="text" inputmode="decimal" autocomplete="off" class="form-control tier-rate-input" data-tier-id="${tier.id}" value="${this.formatDiscountRate(tier.rate)}" style="font-size: 0.88rem; font-weight: 700; width: 75px; text-align: right; color: #38bdf8;">
              <span style="font-weight: 700; color: #38bdf8;">%</span>
            </div>
          </td>
          <td style="width: 5%; text-align: center;">
            <button type="button" class="btn-brand-history btn-tier-history" data-brand-id="${brand.id}" data-tier-id="${tier.id}" title="${tier.name} geçmişini görüntüle" style="padding: 4px 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M12 7v5l4 2"/>
              </svg>
            </button>
          </td>
          <td style="width: 5%; text-align: center;">
            ${brand.tiers.length > 1 ? `
              <button type="button" class="btn-remove-item btn-delete-tier" data-tier-id="${tier.id}" title="Bu kademeyi sil" style="font-size: 1.1rem; padding: 2px 6px;">
                &times;
              </button>
            ` : '-'}
          </td>
        </tr>
      `;
    });

    this.tierItemsTableContainer.innerHTML = `
      <table class="tier-edit-table" style="width: 100%; table-layout: fixed;">
        <thead>
          <tr>
            <th style="width: 42%;">Kademe Adı</th>
            <th style="width: 34%;">Ürün Grubu / Açıklama</th>
            <th style="width: 14%; text-align: right; padding-right: 25px;">Alış İskontosu</th>
            <th style="width: 5%; text-align: center;">Geçmiş</th>
            <th style="width: 5%; text-align: center;">Sil</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    // Otomatik metin seçimi
    this.tierItemsTableContainer.querySelectorAll('.tier-rate-input').forEach(input => {
      input.addEventListener('focus', (e) => e.target.select());
      input.addEventListener('click', (e) => e.target.select());
    });

    // Kademe geçmiş butonu
    this.tierItemsTableContainer.querySelectorAll('.btn-tier-history').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openDiscountHistoryModal(brand.id);
      });
    });

    // Kademe sil butonu
    this.tierItemsTableContainer.querySelectorAll('.btn-delete-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = btn.getAttribute('data-tier-id');
        this.deleteTierFromSelectedBrand(tId);
      });
    });
  }

  saveTierDiscountsChanges() {
    if (!this.selectedTierBrandId) return;
    const brand = this.brandDiscounts.find(b => b.id === this.selectedTierBrandId);
    if (!brand || !Array.isArray(brand.tiers)) return;

    const rows = this.tierItemsTableContainer.querySelectorAll('tbody tr');
    const changes = [];
    const updatedTiers = [];

    for (const tr of rows) {
      const tId = tr.getAttribute('data-tier-id');
      const tier = brand.tiers.find(t => t.id === tId);
      if (!tier) continue;

      const nameInput = tr.querySelector('.tier-name-input');
      const noteInput = tr.querySelector('.tier-note-input');
      const rateInput = tr.querySelector('.tier-rate-input');

      const newName = nameInput ? nameInput.value.trim() : tier.name;
      const newNote = noteInput ? noteInput.value.trim() : (tier.note || '');
      const parsedRate = rateInput ? this.parseDiscountRate(rateInput.value) : tier.rate;

      if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
        this.showToast(`Lütfen "${newName || tier.name}" için 0-100 arasında geçerli bir iskonto oranı giriniz.`, 'warning');
        if (rateInput) rateInput.focus();
        return;
      }

      const isNameChanged = (newName !== tier.name);
      const isNoteChanged = (newNote !== (tier.note || ''));
      const isRateChanged = (parseFloat(tier.rate) !== parsedRate);

      if (isNameChanged || isNoteChanged || isRateChanged) {
        const diffParts = [];
        if (isNameChanged) diffParts.push(`İsim: ${tier.name} ➔ ${newName}`);
        if (isNoteChanged) diffParts.push(`Ürün Grubu: "${tier.note || '-'}" ➔ "${newNote}"`);
        if (isRateChanged) diffParts.push(`İskonto: %${tier.rate} ➔ %${parsedRate}`);

        changes.push({
          tierId: tier.id,
          tierName: newName,
          oldName: tier.name,
          oldNote: tier.note || '',
          newNote: newNote,
          oldRate: tier.rate,
          newRate: parsedRate,
          summary: diffParts.join(' | ')
        });
      }

      updatedTiers.push({
        ...tier,
        name: newName || tier.name,
        note: newNote,
        rate: parsedRate
      });
    }

    if (changes.length === 0) {
      this.showToast('Herhangi bir değişiklik yapılmadı.', 'info');
      return;
    }

    const changesListText = changes.map(c => `[${c.oldName}] ${c.summary}`).join(' • ');
    this.promptDiscountPinConfirmation({
      targetName: `${brand.name} Kademeleri`,
      oldValDisplay: 'Mevcut Bilgiler',
      newValDisplay: `${changes.length} Değişiklik`,
      customDescription: changesListText,
      onConfirm: () => {
        const currentUser = this.getCurrentUserDisplay();
        const now = new Date();

        brand.tiers = updatedTiers;
        brand.updatedBy = currentUser;
        brand.updatedAt = now.toISOString();

        changes.forEach(ch => {
          const hist = {
            id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            brandId: brand.id,
            brandName: brand.name,
            tierId: ch.tierId,
            tierName: ch.tierName,
            action: (ch.oldRate !== ch.newRate) ? 'rate_update' : 'tier_update',
            oldRate: ch.oldRate,
            newRate: ch.newRate,
            description: `${brand.name} (${ch.tierName}): ${ch.summary}`,
            updatedBy: currentUser,
            updatedAt: now.toISOString(),
            timestamp: Date.now()
          };
          this.discountHistory.unshift(hist);
        });

        this.saveBrandDiscounts(null, true, true);
        this.showToast(`${brand.name} kademe ve iskonto değişiklikleri başarıyla kaydedildi!`, 'success');
        this.closeTierDiscountsModal();
      }
    });
  }

  addNewTierToSelectedBrand() {
    if (!this.selectedTierBrandId) return;
    const brand = this.brandDiscounts.find(b => b.id === this.selectedTierBrandId);
    if (!brand) return;
    if (!Array.isArray(brand.tiers)) brand.tiers = [];

    const tierCount = brand.tiers.length + 1;
    const isImpo = (brand.id === 'impo');
    const isWilo = (brand.id === 'wilo');

    let tierDefaultName = `Kademe ${tierCount}`;
    if (isImpo) tierDefaultName = `T${tierCount} Grubu`;
    else if (isWilo) tierDefaultName = `Wilo Grup ${tierCount}`;

    this.promptDiscountPinConfirmation({
      targetName: `${brand.name} - Yeni Kademe`,
      oldValDisplay: `${brand.tiers.length} Kademe`,
      newValDisplay: `+1 Yeni Kademe`,
      customDescription: `"${tierDefaultName}" adında yeni bir kademe satırı eklenecektir.`,
      onConfirm: () => {
        const newTierId = brand.id + '_t' + Date.now();
        const newTier = {
          id: newTierId,
          name: tierDefaultName,
          note: 'Yeni Ürün Grubu',
          rate: 40
        };

        brand.tiers.push(newTier);
        const currentUser = this.getCurrentUserDisplay();
        const now = new Date();
        brand.updatedBy = currentUser;
        brand.updatedAt = now.toISOString();

        const historyEntry = {
          id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          brandId: brand.id,
          brandName: brand.name,
          tierId: newTier.id,
          tierName: newTier.name,
          action: 'add_tier',
          oldRate: null,
          newRate: newTier.rate,
          description: `${brand.name} bünyesine yeni kademe eklendi: ${newTier.name} (%${newTier.rate})`,
          updatedBy: currentUser,
          updatedAt: now.toISOString(),
          timestamp: Date.now()
        };

        this.saveBrandDiscounts(historyEntry, true, true);
        this.showToast(`${brand.name} için "${newTier.name}" kademesi eklendi.`, 'success');
      }
    });
  }

  deleteTierFromSelectedBrand(tierId) {
    if (!this.selectedTierBrandId) return;
    const brand = this.brandDiscounts.find(b => b.id === this.selectedTierBrandId);
    if (!brand || !brand.tiers) return;

    if (brand.tiers.length <= 1) {
      this.showToast('En az 1 kademe bulunmalıdır.', 'warning');
      return;
    }

    const tierIndex = brand.tiers.findIndex(t => t.id === tierId);
    if (tierIndex === -1) return;
    const tier = brand.tiers[tierIndex];

    this.promptDiscountPinConfirmation({
      targetName: `${brand.name} - Kademe Silme`,
      oldValDisplay: `${tier.name} (%${tier.rate})`,
      newValDisplay: 'Kalıcı Sil',
      customDescription: `"${tier.name}" kademesi ve tanımlı iskontosu sistemden tamamen silinecektir.`,
      onConfirm: () => {
        const tierName = tier.name;
        const oldRate = tier.rate;
        brand.tiers.splice(tierIndex, 1);

        const currentUser = this.getCurrentUserDisplay();
        const now = new Date();
        brand.updatedBy = currentUser;
        brand.updatedAt = now.toISOString();

        const historyEntry = {
          id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          brandId: brand.id,
          brandName: brand.name,
          tierId: tierId,
          tierName: tierName,
          action: 'delete_tier',
          oldRate: oldRate,
          newRate: null,
          description: `${brand.name} bünyesinden "${tierName}" kademesi silindi`,
          updatedBy: currentUser,
          updatedAt: now.toISOString(),
          timestamp: Date.now()
        };

        this.saveBrandDiscounts(historyEntry, true, true);
        this.showToast(`"${tierName}" kademesi silindi.`, 'warning');
      }
    });
  }

  openDiscountHistoryModal(filterBrandId = 'all') {
    try {
      if (!this.modalDiscountHistory) {
        this.modalDiscountHistory = document.getElementById('modal-discount-history');
      }
      if (!this.modalDiscountHistory) return;

      // Filtre seçeneklerini hazırla
      if (this.selectHistoryBrandFilter) {
        let optsHtml = '<option value="all">Tüm Markalar</option>';
        (this.brandDiscounts || []).forEach(b => {
          optsHtml += `<option value="${b.id}">${b.name}</option>`;
        });
        this.selectHistoryBrandFilter.innerHTML = optsHtml;
        this.selectHistoryBrandFilter.value = filterBrandId;
      }

      this.renderDiscountHistory(filterBrandId);
      this.modalDiscountHistory.classList.add('active');
    } catch (err) {
      console.error('openDiscountHistoryModal error:', err);
    }
  }

  closeDiscountHistoryModal() {
    if (this.modalDiscountHistory) {
      this.modalDiscountHistory.classList.remove('active');
    }
  }

  renderDiscountHistory(filterBrandId = 'all') {
    if (!this.discountHistoryTimelineContainer) return;

    let items = [...(this.discountHistory || [])];
    if (filterBrandId && filterBrandId !== 'all') {
      items = items.filter(h => h.brandId === filterBrandId);
    }

    // Tarihe göre yeniden eskiye sırala
    items.sort((a, b) => {
      const tA = a.timestamp || (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const tB = b.timestamp || (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return tB - tA;
    });

    if (this.historyTotalCount) {
      this.historyTotalCount.textContent = `${items.length} kayıt listeleniyor`;
    }

    if (this.historyModalFilterBadge) {
      if (filterBrandId === 'all') {
        this.historyModalFilterBadge.textContent = 'Tüm Kayıtlar';
      } else {
        const b = (this.brandDiscounts || []).find(x => x.id === filterBrandId);
        this.historyModalFilterBadge.textContent = b ? b.name : 'Seçili Marka';
      }
    }

    if (items.length === 0) {
      this.discountHistoryTimelineContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #64748b;">
          <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div style="font-size: 0.9rem; font-weight: 600; color: #94a3b8;">Henüz bir değişiklik geçmişi kaydı bulunmuyor</div>
          <div style="font-size: 0.75rem; margin-top: 5px; color: #64748b;">
            İskonto oranlarında yapılacak tüm güncellemeler kullanıcı ve zaman damgasıyla burada listelenecektir.
          </div>
        </div>
      `;
      return;
    }

    let html = '<div class="discount-timeline">';
    items.forEach(item => {
      const formattedDate = this.formatDateDisplay(item.updatedAt || item.timestamp);
      const user = item.updatedBy || 'Sistem';

      let detailHtml = '';
      if (item.action === 'rate_update') {
        const tierInfo = item.tierName ? ` <span style="font-size: 0.74rem; color: #38bdf8; font-weight: 500;">(${item.tierName})</span>` : '';
        detailHtml = `
          <div class="timeline-content">
            <div class="timeline-brand-info">${item.brandName || ''}${tierInfo}</div>
            <div class="timeline-rate-change">
              ${item.oldRate !== null && item.oldRate !== undefined ? `<span class="timeline-rate-old">%${item.oldRate}</span>` : ''}
              <span style="color: #94a3b8;">➔</span>
              <span class="timeline-rate-new">%${item.newRate}</span>
            </div>
          </div>
        `;
      } else {
        detailHtml = `
          <div class="timeline-content">
            <div class="timeline-brand-info">${item.brandName || ''}</div>
            <div style="font-size: 0.76rem; color: #38bdf8;">${item.description || item.action}</div>
          </div>
        `;
      }

      html += `
        <div class="timeline-item">
          <div class="timeline-header">
            <span class="timeline-user">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${user}
            </span>
            <span class="timeline-date">${formattedDate}</span>
          </div>
          ${detailHtml}
        </div>
      `;
    });
    html += '</div>';

    this.discountHistoryTimelineContainer.innerHTML = html;
  }

  openAddBrandModal() {
    try {
      if (this.inputNewBrandName) this.inputNewBrandName.value = '';
      if (this.inputNewBrandRate) this.inputNewBrandRate.value = '40';
      const singleRadio = document.querySelector('input[name="new-brand-type"][value="single"]');
      if (singleRadio) singleRadio.checked = true;
      if (this.groupNewBrandSingleRate) this.groupNewBrandSingleRate.style.display = 'block';
      if (this.groupNewBrandTieredHint) this.groupNewBrandTieredHint.style.display = 'none';

      if (this.modalAddBrand) {
        this.modalAddBrand.classList.add('active');
        if (this.inputNewBrandName) {
          setTimeout(() => this.inputNewBrandName.focus(), 150);
        }
      }
    } catch (err) {
      console.error('openAddBrandModal error:', err);
    }
  }

  closeAddBrandModal() {
    if (this.modalAddBrand) {
      this.modalAddBrand.classList.remove('active');
    }
  }

  submitNewBrand() {
    const name = this.inputNewBrandName ? this.inputNewBrandName.value.trim() : '';
    if (!name) {
      this.showToast('Lütfen marka adını giriniz.', 'warning');
      if (this.inputNewBrandName) this.inputNewBrandName.focus();
      return;
    }

    const exists = (this.brandDiscounts || []).some(b => b.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      this.showToast(`"${name}" adında bir marka zaten kayıtlı!`, 'warning');
      return;
    }

    const selectedTypeRadio = document.querySelector('input[name="new-brand-type"]:checked');
    const brandType = selectedTypeRadio ? selectedTypeRadio.value : 'single';
    const brandId = 'brand_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const currentUser = this.getCurrentUserDisplay();
    const now = new Date();

    let newBrandObj = null;
    if (brandType === 'tiered') {
      newBrandObj = {
        id: brandId,
        name: name,
        type: 'tiered',
        rate: null,
        tiers: [
          { id: brandId + '_t1', name: 'Kademe 1', note: 'Ürün Grubu 1', rate: 40 },
          { id: brandId + '_t2', name: 'Kademe 2', note: 'Ürün Grubu 2', rate: 40 }
        ],
        updatedBy: currentUser,
        updatedAt: now.toISOString(),
        canDelete: true
      };
    } else {
      const rateVal = this.inputNewBrandRate ? parseFloat(this.inputNewBrandRate.value) : 40;
      newBrandObj = {
        id: brandId,
        name: name,
        type: 'single',
        rate: isNaN(rateVal) ? 40 : rateVal,
        updatedBy: currentUser,
        updatedAt: now.toISOString(),
        canDelete: true
      };
    }

    this.brandDiscounts.push(newBrandObj);

    const historyEntry = {
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      brandId: newBrandObj.id,
      brandName: newBrandObj.name,
      action: 'add_brand',
      oldRate: null,
      newRate: newBrandObj.type === 'single' ? newBrandObj.rate : null,
      description: `Yeni marka sisteme eklendi: ${newBrandObj.name} (${newBrandObj.type === 'single' ? '%' + newBrandObj.rate : 'Kademeli'})`,
      updatedBy: currentUser,
      updatedAt: now.toISOString(),
      timestamp: Date.now()
    };

    this.saveBrandDiscounts(historyEntry);
    this.closeAddBrandModal();
    this.showToast(`"${name}" markası başarıyla eklendi!`, 'success');
  }

  deleteBrand(brandId) {
    const brandIndex = (this.brandDiscounts || []).findIndex(b => b.id === brandId);
    if (brandIndex === -1) return;
    const brand = this.brandDiscounts[brandIndex];

    if (!brand.canDelete) {
      this.showToast('Bu sistem markası silinemez.', 'warning');
      return;
    }

    this.promptDiscountPinConfirmation({
      targetName: `${brand.name} Markasını Sil`,
      oldValDisplay: brand.name,
      newValDisplay: 'Kalıcı Sil',
      customDescription: `"${brand.name}" markası ve bünyesindeki tüm iskonto tanımları sistemden silinecektir.`,
      onConfirm: () => {
        const currentUser = this.getCurrentUserDisplay();
        const now = new Date();
        const historyEntry = {
          id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          brandId: brand.id,
          brandName: brand.name,
          action: 'delete_brand',
          description: `"${brand.name}" markası sistemden silindi`,
          updatedBy: currentUser,
          updatedAt: now.toISOString(),
          timestamp: Date.now()
        };

        this.brandDiscounts.splice(brandIndex, 1);
        this.saveBrandDiscounts(historyEntry);
        this.showToast(`"${brand.name}" markası silindi.`, 'warning');
      }
    });
  }

  // --------------------------------------------------------------------------
  // Kalem (Ürün / Pompa) Yönetimi ve Dinamik Özellikler
  // --------------------------------------------------------------------------
  addNewItem() {
    this.state.items.push({
      title: '',
      marka: '',
      model: '',
      calismaAraligi: '',
      guc: '',
      cikis: '',
      extraDetails: '',
      customSpecs: [],
      qty: '',
      unitType: 'Adet',
      isMeter: false,
      unitPrice: '',
      pricingCalc: {
        isOpen: false,
        mode: 'discount',
        listPrice: '',
        buyDiscount: '',
        sellDiscount: '',
        netCost: '',
        markupPercent: ''
      }
    });
    this.renderItemsList();
    this.renderPreview();
  }

  applySondajTemplate() {
    this.openSondajModal();
  }

  openSondajModal() {
    if (!this.modalConfirmSondaj) {
      this.executeSondajTemplate();
      return;
    }

    const isEn = (this.state.language === 'en');

    // Mevcut kalemlerde kullanıcının girdiği veri var mı kontrol et
    const hasFilled = Array.isArray(this.state.items) && this.state.items.some(it =>
      (it.title && it.title.trim()) ||
      (it.marka && it.marka.trim()) ||
      (it.model && it.model.trim()) ||
      (it.qty !== '' && it.qty !== undefined && it.qty !== null) ||
      (it.unitPrice !== '' && it.unitPrice !== undefined && it.unitPrice !== null)
    );

    if (this.sondajModalWarning) {
      this.sondajModalWarning.style.display = hasFilled ? 'block' : 'none';
    }

    // Modal içi metinleri seçili dile göre güncelle
    const modalTitle = document.getElementById('sondaj-modal-title');
    const modalSubtitle = document.getElementById('sondaj-modal-subtitle');
    const modalWarningTitle = document.getElementById('sondaj-modal-warning-title');
    const modalWarningDesc = document.getElementById('sondaj-modal-warning-desc');
    const modalDesc = document.getElementById('sondaj-modal-desc');
    const modalPreview = document.getElementById('sondaj-modal-items-preview');
    const btnCancel = document.getElementById('btn-cancel-sondaj');
    const btnClearText = document.getElementById('sondaj-modal-clear-text');
    const btnSubmitText = document.getElementById('sondaj-modal-submit-text');

    if (modalTitle) modalTitle.textContent = isEn ? 'Drilling Proposal Template' : 'Sondaj Teklifi Şablonu';
    if (modalSubtitle) modalSubtitle.textContent = isEn ? '8 Standard Submersible & Drilling Proposal Titles' : '8 Kalemlik Standart Dalgıç & Sondaj Başlıkları';
    if (modalWarningTitle) modalWarningTitle.textContent = isEn ? 'Existing Items Will Be Replaced!' : 'Mevcut Kalemler Temizlenecektir!';
    if (modalWarningDesc) modalWarningDesc.textContent = isEn ? 'Current entered item details will be cleared and replaced with 8 standard drilling proposal items.' : 'Şu anda girdiğiniz ürün ve fiyat verileri silinerek yerine 8 standart sondaj kalemi yüklenecektir.';
    if (modalDesc) modalDesc.textContent = isEn ? 'The following 8 items will be loaded into your proposal with preset titles and unit modes:' : 'Aşağıdaki 8 kalem hazır başlık ve birim ayarlarıyla teklifinize eklenecektir:';
    if (btnCancel) btnCancel.textContent = isEn ? 'Cancel' : 'Vazgeç';
    if (btnClearText) btnClearText.textContent = isEn ? 'Delete Template' : 'Şablonu Sil';
    if (btnSubmitText) btnSubmitText.textContent = isEn ? 'Load Template' : 'Şablonu Yükle';

    if (modalPreview) {
      if (isEn) {
        modalPreview.innerHTML = `
          <div style="color: #fff;">1. Submersible Motor <span style="color: #888; font-size: 0.7rem;">(Pcs)</span></div>
          <div style="color: #fff;">2. Submersible Pump <span style="color: #888; font-size: 0.7rem;">(Pcs)</span></div>
          <div style="color: #fff;">3. Submersible Power Cable <span style="color: var(--accent-cyan); font-weight: 600; font-size: 0.7rem;">(Meter)</span></div>
          <div style="color: #fff;">4. Control Panel <span style="color: #888; font-size: 0.7rem;">(Pcs)</span></div>
          <div style="color: #fff;">5. Wellhead (With Valve) <span style="color: #888; font-size: 0.7rem;">(Pcs)</span></div>
          <div style="color: #fff;">6. Stainless Steel Clamp <span style="color: var(--accent-cyan); font-weight: 600; font-size: 0.7rem;">(Meter)</span></div>
          <div style="color: #fff;">7. Insulated Steel Wire Rope <span style="color: var(--accent-cyan); font-weight: 600; font-size: 0.7rem;">(Meter)</span></div>
          <div style="color: #fff;">8. Top Column Pipe Adapter <span style="color: #888; font-size: 0.7rem;">(Pcs)</span></div>
        `;
      } else {
        modalPreview.innerHTML = `
          <div style="color: #fff;">1. Dalgıç Motor <span style="color: #888; font-size: 0.7rem;">(Adet)</span></div>
          <div style="color: #fff;">2. Dalgıç Pompa <span style="color: #888; font-size: 0.7rem;">(Adet)</span></div>
          <div style="color: #fff;">3. Elektrik Kablosu <span style="color: var(--accent-cyan); font-weight: 600; font-size: 0.7rem;">(Metre)</span></div>
          <div style="color: #fff;">4. Kontrol Panosu <span style="color: #888; font-size: 0.7rem;">(Adet)</span></div>
          <div style="color: #fff;">5. Kuyu Akıtma Başlığı <span style="color: #888; font-size: 0.7rem;">(Adet)</span></div>
          <div style="color: #fff;">6. Paslanmaz Klemens <span style="color: var(--accent-cyan); font-weight: 600; font-size: 0.7rem;">(Metre)</span></div>
          <div style="color: #fff;">7. İzoleli Çelik Halat <span style="color: var(--accent-cyan); font-weight: 600; font-size: 0.7rem;">(Metre)</span></div>
          <div style="color: #fff;">8. Üst Kolon Adaptörü <span style="color: #888; font-size: 0.7rem;">(Adet)</span></div>
        `;
      }
    }

    this.modalConfirmSondaj.classList.add('active');

    // Yanlışlıkla basmaya karşı: Varsayılan olarak Vazgeç butonu odaklanır
    setTimeout(() => {
      if (this.btnCancelSondaj) this.btnCancelSondaj.focus();
    }, 50);
  }

  closeSondajModal() {
    if (this.modalConfirmSondaj) {
      this.modalConfirmSondaj.classList.remove('active');
    }
  }

  executeSondajTemplate() {
    const isEn = (this.state.language === 'en');

    // Geri alma (Undo) için mevcut kalemleri yedekle
    this.previousItemsBeforeTemplate = JSON.parse(JSON.stringify(this.state.items || []));

    const templateItems = isEn ? [
      { title: 'Submersible Motor', isMeter: false, unitType: 'Pcs' },
      { title: 'Submersible Pump', isMeter: false, unitType: 'Pcs' },
      { title: 'Submersible Power Cable', isMeter: true, unitType: 'Meter' },
      { title: 'Control Panel', isMeter: false, unitType: 'Pcs' },
      { title: 'Wellhead (With Valve)', isMeter: false, unitType: 'Pcs' },
      { title: 'Stainless Steel Clamp (For Rope)', isMeter: true, unitType: 'Meter' },
      { title: 'Insulated Steel Wire Rope', isMeter: true, unitType: 'Meter' },
      { title: 'Top Column Pipe Adapter', isMeter: false, unitType: 'Pcs' }
    ] : [
      { title: 'Dalgıç Motor', isMeter: false, unitType: 'Adet' },
      { title: 'Dalgıç Pompa', isMeter: false, unitType: 'Adet' },
      { title: 'Elektrik Kablosu', isMeter: true, unitType: 'Metre' },
      { title: 'Kontrol Panosu', isMeter: false, unitType: 'Adet' },
      { title: 'Kuyu Akıtma Başlığı (Vanalı)', isMeter: false, unitType: 'Adet' },
      { title: 'Paslanmaz Klemens (Halat İçin)', isMeter: true, unitType: 'Metre' },
      { title: 'İzoleli Çelik Halat', isMeter: true, unitType: 'Metre' },
      { title: 'Üst Kolon Boru Adaptörü', isMeter: false, unitType: 'Adet' }
    ];

    this.state.items = templateItems.map(t => ({
      title: t.title,
      marka: '',
      model: '',
      calismaAraligi: '',
      guc: '',
      cikis: '',
      extraDetails: '',
      customSpecs: [],
      qty: '',
      unitType: t.unitType,
      isMeter: t.isMeter,
      unitPrice: '',
      pricingCalc: {
        isOpen: false,
        mode: 'discount',
        listPrice: '',
        buyDiscount: '',
        sellDiscount: '',
        netCost: '',
        markupPercent: ''
      }
    }));

    this.renderItemsList();
    this.renderPreview();
    this.closeSondajModal();

    // Yanlışlıkla tıklamalara karşı 1 tıkla Geri Al (Undo) butonlu şık bildirim
    const undoBtnId = 'btn-undo-sondaj-' + Date.now();
    const msgHtml = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px;">
        <span style="font-size: 0.84rem;">${isEn ? '8 Drilling Proposal titles loaded.' : '8 standart Sondaj Teklifi kalemi yüklendi.'}</span>
        <button type="button" id="${undoBtnId}" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.38); color: #fff; border-radius: 4px; padding: 3px 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <span>${isEn ? 'Undo' : 'Geri Al'}</span>
        </button>
      </div>
    `;
    this.showToast(msgHtml, 'success', 7000);

    setTimeout(() => {
      const undoBtn = document.getElementById(undoBtnId);
      if (undoBtn) {
        undoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.undoSondajTemplate();
        });
      }
    }, 50);
  }

  undoSondajTemplate() {
    if (this.previousItemsBeforeTemplate && this.previousItemsBeforeTemplate.length > 0) {
      this.state.items = JSON.parse(JSON.stringify(this.previousItemsBeforeTemplate));
      this.renderItemsList();
      this.renderPreview();
      this.showToast(
        this.state.language === 'en' ? 'Previous items restored.' : 'Önceki kalemler geri yüklendi.',
        'info'
      );
      this.previousItemsBeforeTemplate = null;
    }
  }

  clearSondajTemplate() {
    const isEn = (this.state.language === 'en');

    // Eğer şablon yüklenmeden önce kullanıcının kendi kalemleri vardıysa onları geri yükle,
    // yoksa orijinal boş kalem şablonuna (DEFAULT_ITEMS) sıfırla.
    if (this.previousItemsBeforeTemplate && this.previousItemsBeforeTemplate.length > 0) {
      this.state.items = JSON.parse(JSON.stringify(this.previousItemsBeforeTemplate));
      this.previousItemsBeforeTemplate = null;
    } else {
      this.state.items = JSON.parse(JSON.stringify(DEFAULT_ITEMS));
    }

    this.renderItemsList();
    this.renderPreview();
    this.closeSondajModal();

    this.showToast(
      isEn ? 'Drilling template removed. Restored to original items.' : 'Sondaj şablonu silindi, orijinal kalemlere geri dönüldü.',
      'info'
    );
  }

  removeItem(index) {
    if (this.state.items.length <= 1) {
      this.showToast('En az 1 kalem ürün bulunmalıdır.', 'warning');
      return;
    }
    this.state.items.splice(index, 1);
    this.renderItemsList();
    this.renderPreview();
  }

  duplicateItem(index) {
    const copy = JSON.parse(JSON.stringify(this.state.items[index]));
    this.state.items.splice(index + 1, 0, copy);
    this.renderItemsList();
    this.renderPreview();
    this.showToast('Kalem kopyalandı.', 'success');
  }

  addCustomSpecToItem(itemIndex) {
    if (!this.state.items[itemIndex].customSpecs) {
      this.state.items[itemIndex].customSpecs = [];
    }
    this.state.items[itemIndex].customSpecs.push({
      label: '',
      value: ''
    });
    this.renderItemsList();
    this.renderPreview();
  }

  removeCustomSpecFromItem(itemIndex, specIndex) {
    this.state.items[itemIndex].customSpecs.splice(specIndex, 1);
    this.renderItemsList();
    this.renderPreview();
  }

  moveCustomSpec(itemIndex, fromIndex, toIndex) {
    const item = this.state.items[itemIndex];
    if (!item || !item.customSpecs) return;
    const specs = item.customSpecs;
    if (fromIndex < 0 || fromIndex >= specs.length) return;
    if (toIndex < 0 || toIndex >= specs.length) return;
    if (fromIndex === toIndex) return;

    const [movedSpec] = specs.splice(fromIndex, 1);
    specs.splice(toIndex, 0, movedSpec);

    this.renderItemsList();
    this.renderPreview();
  }

  calculateTotals() {
    let subtotal = 0;
    if (this.state.isPackagePrice) {
      subtotal = parseFloat(this.state.packagePrice) || 0;
    } else {
      this.state.items.forEach(item => {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.unitPrice) || 0;
        subtotal += q * p;
      });
    }
    const vat = subtotal * 0.20; // %20 KDV
    // Teklif belgesinde ve CRM'de Grand Total KDV HARİÇ net toplam fiyattır:
    const grandTotal = subtotal;
    const grandTotalWithVat = subtotal + vat;

    return { subtotal, vat, grandTotal, grandTotalWithVat };
  }

  formatCurrency(num) {
    const formatted = new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num || 0);
    return `${formatted} ${this.state.currency}`;
  }

  // --------------------------------------------------------------------------
  // Arayüz Çizimi (Render UI & Document)
  // --------------------------------------------------------------------------
  render() {
    // Form Elemanlarını Doldur
    this.inputDate.value = this.state.dateISO;
    this.syncDateAndRef();
    this.inputSfRef.value = this.state.baseSalesForceRef;
    this.sfCounterBadge.textContent = `Teklif #${this.state.salesForceCounter}`;

    this.checkboxRevision.checked = this.state.isRevision;
    this.revisionPanel.style.display = this.state.isRevision ? 'flex' : 'none';
    this.updateRevisionUI();

    this.checkboxInternalRef.checked = this.state.hasInternalRef;
    this.internalRefGroup.style.display = this.state.hasInternalRef ? 'block' : 'none';
    this.inputInternalRef.value = this.state.internalRef || '';

    this.inputTo.value = this.state.customer.to || '';
    this.inputEndUser.value = this.state.customer.enduser || '';
    this.inputIndustry.value = this.state.customer.industry || '';
    this.inputAddress.value = this.state.customer.address || '';
    if (this.inputTaxOffice) this.inputTaxOffice.value = this.state.customer.taxOffice || '';
    if (this.inputTaxNumber) this.inputTaxNumber.value = this.state.customer.taxNumber || '';
    this.inputAttention.value = this.state.customer.attention || '';
    this.inputTel.value = this.formatPhoneNumber(this.state.customer.tel || '');
    this.inputEmail.value = this.state.customer.email || '';
    this.inputSubject.value = this.state.customer.subject || '';

    // Profil Alanlarını Doldur (Sol Panel)
    this.sidebarPrepName.value = this.state.profile.preparedBy;
    this.sidebarPrepRole.value = this.state.profile.signerRole;
    this.sidebarPrepMobile.value = this.formatPhoneNumber(this.state.profile.signerMobile || '');
    this.sidebarPrepEmail.value = this.state.profile.signerEmail;

    this.headerUserName.textContent = this.state.profile.preparedBy;
    this.selectCurrency.value = this.state.currency;

    // Şartlar kutuları (kullanıcı yazmadıkça kutular boş kalır)
    this.inputRemarkDeliveryPlace.value = this.state.remarksConfig.deliveryPlace || '';
    this.inputRemarkDeliveryTime.value = this.state.remarksConfig.deliveryTime || '';
    this.inputRemarkValidityDays.value = this.state.remarksConfig.validityDays || '';
    this.inputRemarkPayment.value = this.state.remarksConfig.paymentTerms || '';
    this.inputRemarkScope.value = this.state.remarksConfig.scopeText || '';

    // Akbank kuru kutusu ve durum rozeti senkronizasyonu
    const isAkbank = !!(this.state.remarksConfig && this.state.remarksConfig.useAkbankRate);
    if (this.checkboxAkbankRate) {
      this.checkboxAkbankRate.checked = isAkbank;
    }
    this.updateAkbankRateBadge(isAkbank);
    this.updateCurrencyCalcButtonState(isAkbank);

    if (this.btnTemplateSondaj) {
      const span = this.btnTemplateSondaj.querySelector('span');
      if (span) {
        span.textContent = (this.state.language === 'en') ? '🌊 Drilling Proposal' : '🌊 Sondaj Teklifi';
      }
      this.btnTemplateSondaj.title = (this.state.language === 'en')
        ? 'Automatically loads 8 standard Drilling Proposal item titles'
        : '8 kalemlik standart Sondaj Teklifi ürün başlıklarını otomatik yükler';
    }

    // Paket / Proje Özel Fiyatı Senkronizasyonu
    const isPkg = !!this.state.isPackagePrice;
    if (this.checkPackagePrice) {
      this.checkPackagePrice.checked = isPkg;
    }
    if (this.packagePriceDetails) {
      this.packagePriceDetails.style.display = isPkg ? 'block' : 'none';
    }
    if (this.packagePriceBox) {
      this.packagePriceBox.classList.toggle('active', isPkg);
      this.packagePriceBox.classList.toggle('expanded', isPkg);
    }
    if (this.inputPackagePrice) {
      this.inputPackagePrice.value = (this.state.packagePrice !== undefined && this.state.packagePrice !== null) ? this.state.packagePrice : '';
    }
    if (this.inputPackageRowText) {
      this.inputPackageRowText.value = this.state.packageRowText || 'Proje Özel Fiyat';
    }
    if (this.inputPackageTotalText) {
      this.inputPackageTotalText.value = this.state.packageTotalText || 'Proje Özel Fiyat';
    }
    if (this.packageCurrencyLabel) {
      this.packageCurrencyLabel.textContent = this.state.currency || 'EUR';
    }

    this.updateCurrencyLabels();
    this.renderItemsList();
    this.renderRemarks();
    this.renderPreview();
    this.fitZoom();
  }

  calculateItemPricing(item) {
    if (!item.pricingCalc) {
      item.pricingCalc = {
        isOpen: false,
        mode: 'discount',
        listPrice: '',
        buyDiscount: '',
        sellDiscount: '',
        netCost: '',
        markupPercent: ''
      };
    }
    const pc = item.pricingCalc;
    let costPrice = 0;
    let sellPrice = 0;
    let profit = 0;
    let profitPercent = 0;
    let hasCost = false;
    let hasSell = false;
    let hasProfit = false;

    if (pc.mode === 'markup') {
      const hasNet = (pc.netCost !== '' && pc.netCost !== undefined && pc.netCost !== null);
      const net = hasNet ? parseFloat(pc.netCost) : 0;
      const hasMarkup = (pc.markupPercent !== '' && pc.markupPercent !== undefined && pc.markupPercent !== null);
      const markup = hasMarkup ? parseFloat(pc.markupPercent) : 0;

      if (hasNet && net > 0) {
        costPrice = net;
        hasCost = true;
        if (hasMarkup && markup >= 0) {
          sellPrice = net * (1 + markup / 100);
          hasSell = true;
          profit = sellPrice - costPrice;
          profitPercent = markup;
          hasProfit = true;
        }
      }
    } else {
      const hasList = (pc.listPrice !== '' && pc.listPrice !== undefined && pc.listPrice !== null);
      const list = hasList ? parseFloat(pc.listPrice) : 0;
      const hasBuyDisc = (pc.buyDiscount !== '' && pc.buyDiscount !== undefined && pc.buyDiscount !== null);
      const buyDisc = hasBuyDisc ? parseFloat(pc.buyDiscount) : 0;
      const hasSellDisc = (pc.sellDiscount !== '' && pc.sellDiscount !== undefined && pc.sellDiscount !== null);
      const sellDisc = hasSellDisc ? parseFloat(pc.sellDiscount) : 0;

      if (hasList && list > 0) {
        if (hasBuyDisc) {
          costPrice = list * (1 - buyDisc / 100);
          hasCost = true;
        }
        if (hasSellDisc) {
          sellPrice = list * (1 - sellDisc / 100);
          hasSell = true;
        }
        if (hasCost && hasSell && costPrice > 0) {
          profit = sellPrice - costPrice;
          profitPercent = (profit / costPrice) * 100;
          hasProfit = true;
        }
      }
    }

    return {
      costPrice: hasCost ? Number(costPrice.toFixed(2)) : null,
      sellPrice: hasSell ? Number(sellPrice.toFixed(2)) : null,
      profit: hasProfit ? Number(profit.toFixed(2)) : null,
      profitPercent: hasProfit ? Number(profitPercent.toFixed(1)) : null,
      hasCost,
      hasSell,
      hasProfit
    };
  }

  renderItemsList() {
    this.itemsContainer.innerHTML = '';

    this.state.items.forEach((item, index) => {
      if (!item.customSpecs) item.customSpecs = [];
      if (!item.pricingCalc) {
        item.pricingCalc = {
          isOpen: false,
          mode: 'discount',
          listPrice: '',
          buyDiscount: '',
          sellDiscount: '',
          netCost: '',
          markupPercent: ''
        };
      }
      const pricing = this.calculateItemPricing(item);
      const isEn = (this.state.language === 'en');

      const card = document.createElement('div');
      card.className = 'item-card';

      const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);

      // Dinamik Özel Özellik Satırları HTML'i
      let customSpecsHtml = '';
      if (item.customSpecs.length > 0) {
        customSpecsHtml = '<div class="custom-specs-list">';
        item.customSpecs.forEach((spec, specIdx) => {
          const isFirst = specIdx === 0;
          const isLast = specIdx === item.customSpecs.length - 1;
          customSpecsHtml += `
            <div class="custom-spec-row" data-item-idx="${index}" data-spec-idx="${specIdx}">
              <div class="spec-drag-handle" title="Sıralamayı değiştirmek için yukarı/aşağı sürükleyip bırakın">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="5" r="1.8"/>
                  <circle cx="15" cy="5" r="1.8"/>
                  <circle cx="9" cy="12" r="1.8"/>
                  <circle cx="15" cy="12" r="1.8"/>
                  <circle cx="9" cy="19" r="1.8"/>
                  <circle cx="15" cy="19" r="1.8"/>
                </svg>
              </div>
              <input type="text" class="form-control spec-label-input" style="flex: 1;" placeholder="Özellik Başlığı (Örn: Malzeme:)" value="${this.escapeHtml(spec.label || '')}" data-item-idx="${index}" data-spec-idx="${specIdx}">
              <input type="text" class="form-control spec-val-input" style="flex: 1.3;" placeholder="Değeri (Örn: Paslanmaz Çelik)" value="${this.escapeHtml(spec.value || '')}" data-item-idx="${index}" data-spec-idx="${specIdx}">
              <div class="spec-actions-group">
                <button type="button" class="btn-move-spec btn-move-spec-up" data-item-idx="${index}" data-spec-idx="${specIdx}" title="Yukarı Taşı" ${isFirst ? 'disabled' : ''}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button type="button" class="btn-move-spec btn-move-spec-down" data-item-idx="${index}" data-spec-idx="${specIdx}" title="Aşağı Taşı" ${isLast ? 'disabled' : ''}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button type="button" class="btn-remove-item btn-del-spec" data-item-idx="${index}" data-spec-idx="${specIdx}" title="Bu özelliği sil" style="padding: 0.2rem 0.35rem;">&times;</button>
              </div>
            </div>
          `;
        });
        customSpecsHtml += '</div>';
      }

      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-num">Kalem #${index + 1}</span>
          <div class="item-actions">
            <button type="button" class="btn-remove-item" title="Kopyala" data-action="duplicate" data-index="${index}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button type="button" class="btn-remove-item" title="Sil" data-action="delete" data-index="${index}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Ürün Başlığı (Şeffaf Placeholder) -->
        <div class="form-group" style="margin-bottom: 0.4rem;">
          <label class="form-label"><small>Ürün / Pompa Başlığı:</small></label>
          <input type="text" class="form-control item-input" data-field="title" data-index="${index}" value="${this.escapeHtml(item.title || '')}" placeholder="Örn: Flygt Pompa">
        </div>

        <!-- Marka & Model (Şeffaf Placeholder) -->
        <div class="form-grid" style="margin-bottom: 0.4rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>Marka:</small></label>
            <input type="text" class="form-control item-input" data-field="marka" data-index="${index}" value="${this.escapeHtml(item.marka || '')}" placeholder="Örn: Xylem Flygt">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>Model:</small></label>
            <input type="text" class="form-control item-input" data-field="model" data-index="${index}" value="${this.escapeHtml(item.model || '')}" placeholder="Örn: NS 3171 MT 3~ 432">
          </div>
        </div>

        <!-- Çalışma Aralığı & Güç (Şeffaf Placeholder) -->
        <div class="form-grid" style="margin-bottom: 0.4rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>Çalışma Aralığı (m³/h):</small></label>
            <input type="text" class="form-control item-input" data-field="calismaAraligi" data-index="${index}" value="${this.escapeHtml(this.formatDutyPoint(item.calismaAraligi || ''))}" placeholder="Örn: 247,86 m³/h @ 17,69mSS">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>Güç:</small></label>
            <input type="text" class="form-control item-input" data-field="guc" data-index="${index}" value="${this.escapeHtml(this.formatPower(item.guc || ''))}" placeholder="Örn: 18,5 kW veya 50HP">
          </div>
        </div>

        <!-- Çıkış Çapı & Ek Detay (Şeffaf Placeholder) -->
        <div class="form-grid" style="margin-bottom: 0.4rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>Çıkış Çapı:</small></label>
            <input type="text" class="form-control item-input" data-field="cikis" data-index="${index}" value="${this.escapeHtml(this.formatOutletDiameter(item.cikis || ''))}" placeholder="Örn: 150mm 6” veya 2½&quot;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>Ek Kod / Parça:</small></label>
            <input type="text" class="form-control item-input" data-field="extraDetails" data-index="${index}" value="${this.escapeHtml(item.extraDetails || '')}" placeholder="Örn: Code: 3800405">
          </div>
        </div>

        <!-- Dinamik Ek Özellikler Alanı -->
        ${customSpecsHtml}

        <!-- Ekstra Özellik Satırı Ekleme Butonu -->
        <button type="button" class="btn-add-spec" data-item-idx="${index}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>+ Özel Özellik / Satır Ekle (Her İki Tarafı Yazılabilir)</span>
        </button>

        <!-- Miktar, Birim Seçimi ve Fiyat (Şeffaf Placeholder) -->
        <div class="form-grid" style="margin-top: 0.4rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>${isEn ? 'Quantity:' : 'Miktar:'}</small></label>
            <input type="number" step="1" min="1" class="form-control item-input" data-field="qty" data-index="${index}" value="${item.qty !== undefined && item.qty !== null ? item.qty : ''}" placeholder="${this.state.isPackagePrice ? 'Örn: 1 (veya boş)' : 'Örn: 1'}">
            <div style="margin-top: 4px; display: flex; align-items: center; min-height: 24px;">
              <label class="unit-mode-toggle" style="margin-top: 0; margin-bottom: 0;">
                <input type="checkbox" class="custom-checkbox item-unit-check" data-index="${index}" ${item.isMeter ? 'checked' : ''}>
                <span>${isEn ? 'Write as meter' : 'Metre olarak yaz'}</span>
              </label>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label"><small>${isEn ? 'Unit Price' : 'Birim Fiyat'} (${this.state.currency}):</small></label>
            ${this.state.isPackagePrice ? `
              <div style="position: relative;">
                <input type="text" class="form-control item-input input-package-disabled" value="" placeholder="${this.escapeHtml(this.state.packageRowText || 'Proje Özel Fiyat')}" disabled style="opacity: 0.7; cursor: not-allowed; padding-right: 125px;">
                <span class="badge-package-item">🏷️ ${this.escapeHtml(this.state.packageRowText || 'Proje Özel Fiyat')}</span>
              </div>
              <div style="margin-top: 4px; display: flex; justify-content: flex-end; align-items: center; min-height: 24px;">
                <span style="font-size: 0.71rem; color: #38bdf8; opacity: 0.85;">(Proje Özel Fiyat Aktif)</span>
              </div>
            ` : `
              <input type="number" step="0.01" min="0" class="form-control item-input" data-field="unitPrice" data-index="${index}" value="${item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : ''}" placeholder="Örn: 0.00">
              <div style="margin-top: 4px; display: flex; justify-content: flex-end; align-items: center; min-height: 24px;">
                <button type="button" class="btn-pricing-calc-toggle ${item.pricingCalc.isOpen ? 'active' : ''}" data-index="${index}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
                  <span>${item.pricingCalc.isOpen ? (isEn ? 'Close Calc' : 'Hesaplayıcıyı Kapat') : (isEn ? 'Price Calculator' : 'Fiyat Hesaplayıcı')}</span>
                </button>
              </div>
            `}
          </div>
        </div>

        <!-- Fiyat ve İskonto Hesaplayıcı Kutusu -->
        <div class="item-pricing-calc-box" id="calc-box-${index}" style="display: ${(!this.state.isPackagePrice && item.pricingCalc.isOpen) ? 'block' : 'none'};">
          <div class="pricing-calc-tabs">
            <button type="button" class="pricing-calc-tab-btn ${item.pricingCalc.mode === 'discount' ? 'active' : ''}" data-index="${index}" data-mode="discount">
              ${isEn ? 'List Price & Discount' : 'Liste Fiyatı & İskonto'}
            </button>
            <button type="button" class="pricing-calc-tab-btn ${item.pricingCalc.mode === 'markup' ? 'active' : ''}" data-index="${index}" data-mode="markup">
              ${isEn ? 'Net Cost + Markup %' : 'Net Maliyet + % İlave'}
            </button>
          </div>

          <!-- Mod 1: Liste Fiyatı & İskonto -->
          <div class="calc-mode-view calc-mode-discount" style="display: ${item.pricingCalc.mode === 'discount' ? 'block' : 'none'};">
            <div class="pricing-calc-grid-3">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.72rem; margin-bottom: 2px;"><small>${isEn ? 'List Price' : 'Liste Fiyatı'} (${this.state.currency}):</small></label>
                <input type="number" step="any" min="0" class="form-control calc-input" data-index="${index}" data-calc-field="listPrice" value="${item.pricingCalc.listPrice ?? ''}" placeholder="Örn: 120">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.72rem; margin-bottom: 2px;"><small>${isEn ? 'Buy Disc. (%)' : 'Alış İsk. (%)'}:</small></label>
                <input type="number" step="any" min="0" max="100" class="form-control calc-input" data-index="${index}" data-calc-field="buyDiscount" value="${item.pricingCalc.buyDiscount ?? ''}" placeholder="Örn: 50">
                <span class="pricing-calc-badge" style="color: #94a3b8;">${isEn ? 'Cost' : 'Maliyet'}: <b class="calc-cost-val">${(pricing.hasCost && item.pricingCalc.mode === 'discount') ? pricing.costPrice + ' ' + this.state.currency : '-'}</b></span>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.72rem; margin-bottom: 2px;"><small>${isEn ? 'Sell Disc. (%)' : 'Satış İsk. (%)'}:</small></label>
                <input type="number" step="any" min="0" max="100" class="form-control calc-input" data-index="${index}" data-calc-field="sellDiscount" value="${item.pricingCalc.sellDiscount ?? ''}" placeholder="Örn: 45">
                <span class="pricing-calc-badge" style="color: #00e5ff;">${isEn ? 'Sale' : 'Satış'}: <b class="calc-sell-val">${(pricing.hasSell && item.pricingCalc.mode === 'discount') ? pricing.sellPrice + ' ' + this.state.currency : '-'}</b></span>
              </div>
            </div>
          </div>

          <!-- Mod 2: Net Maliyet + % İlave -->
          <div class="calc-mode-view calc-mode-markup" style="display: ${item.pricingCalc.mode === 'markup' ? 'block' : 'none'};">
            <div class="pricing-calc-grid-2">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.72rem; margin-bottom: 2px;"><small>${isEn ? 'Net Cost' : 'Net Maliyet'} (${this.state.currency}):</small></label>
                <input type="number" step="any" min="0" class="form-control calc-input" data-index="${index}" data-calc-field="netCost" value="${item.pricingCalc.netCost ?? ''}" placeholder="Örn: 60">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.72rem; margin-bottom: 2px;"><small>${isEn ? 'Markup %' : '% İlave (Kâr)'}:</small></label>
                <input type="number" step="any" min="0" class="form-control calc-input" data-index="${index}" data-calc-field="markupPercent" value="${item.pricingCalc.markupPercent ?? ''}" placeholder="Örn: 15">
                <span class="pricing-calc-badge" style="color: #00e5ff;">${isEn ? 'Sale' : 'Satış'}: <b class="calc-markup-sell-val">${(pricing.hasSell && item.pricingCalc.mode === 'markup') ? pricing.sellPrice + ' ' + this.state.currency : '-'}</b></span>
              </div>
            </div>
          </div>

          <!-- Özet Kâr Satırı -->
          <div class="pricing-calc-summary-row">
            <span style="color: #94a3b8;"><small>${isEn ? 'Calculated Unit Profit:' : 'Hesaplanan Birim Kâr:'}</small> <b class="calc-profit-val" style="color: #10b981;">${pricing.hasProfit ? '+' + pricing.profit + ' ' + this.state.currency + ' (+' + pricing.profitPercent + '%)' : '-'}</b></span>
            <span style="font-size: 0.7rem; color: #64748b;">${isEn ? 'Syncs directly to Unit Price' : 'Otomatik Birim Fiyata aktarılır'}</span>
          </div>
        </div>

        <div style="text-align: right; margin-top: 0.4rem; font-size: 0.78rem; color: var(--accent-emerald); font-weight: 600;">
          ${isEn ? 'Item Total:' : 'Satır Toplamı:'} <span class="item-line-total-val">${this.formatCurrency(lineTotal)}</span>
        </div>
      `;

      this.itemsContainer.appendChild(card);
    });

    // Dinamik input dinleyicileri
    const inputs = this.itemsContainer.querySelectorAll('.item-input');
    inputs.forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        const field = e.target.dataset.field;
        let val = e.target.value;
        if (field === 'qty' || field === 'unitPrice') {
          val = val === '' ? '' : parseFloat(val);
          const card = inp.closest('.item-card');
          if (card) {
            const currentQty = field === 'qty' ? (parseFloat(val) || 0) : (parseFloat(this.state.items[idx].qty) || 0);
            const currentPrice = field === 'unitPrice' ? (parseFloat(val) || 0) : (parseFloat(this.state.items[idx].unitPrice) || 0);
            const lineTotEl = card.querySelector('.item-line-total-val');
            if (lineTotEl) lineTotEl.textContent = this.formatCurrency(currentQty * currentPrice);
          }
        } else if (field === 'cikis') {
          if (/\b(?:1\/2|1\/4|3\/4|3\/8|5\/8|7\/8|1\/8|1\/3|2\/3)["' ]/.test(val) || val.endsWith('1/2"') || val.endsWith('1/4"') || val.endsWith('3/4"')) {
            const formatted = this.formatOutletDiameter(val);
            if (formatted !== val) {
              e.target.value = formatted;
              val = formatted;
            }
          }
        } else if (field === 'guc') {
          if (/\b(?:kw|hp)[ ]/i.test(val)) {
            const formatted = this.formatPower(val);
            if (formatted !== val) {
              e.target.value = formatted;
              val = formatted;
            }
          }
        } else if (field === 'calismaAraligi') {
          if (/\bmss[ ]/i.test(val)) {
            const formatted = this.formatDutyPoint(val);
            if (formatted !== val) {
              e.target.value = formatted;
              val = formatted;
            }
          }
        }
        this.state.items[idx][field] = val;
        this.updateTotalsSidebar();
        this.renderPreview();
      });

      inp.addEventListener('blur', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        const field = e.target.dataset.field;
        let val = e.target.value;
        if (field === 'guc') {
          const formatted = this.formatPower(val);
          if (formatted !== val) {
            e.target.value = formatted;
            this.state.items[idx].guc = formatted;
            this.renderPreview();
          }
        } else if (field === 'calismaAraligi') {
          const formatted = this.formatDutyPoint(val);
          if (formatted !== val) {
            e.target.value = formatted;
            this.state.items[idx].calismaAraligi = formatted;
            this.renderPreview();
          }
        } else if (field === 'cikis') {
          const formatted = this.formatOutletDiameter(val);
          if (formatted !== val) {
            e.target.value = formatted;
            this.state.items[idx].cikis = formatted;
            this.renderPreview();
          }
        }
      });
    });

    // Özel Özellik Ekle Butonları
    const addSpecBtns = this.itemsContainer.querySelectorAll('.btn-add-spec');
    addSpecBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const itemIdx = parseInt(btn.dataset.itemIdx, 10);
        this.addCustomSpecToItem(itemIdx);
      });
    });

    // Özel Özellik Input Dinleyicileri
    const specLabelInputs = this.itemsContainer.querySelectorAll('.spec-label-input');
    specLabelInputs.forEach(inp => {
      inp.addEventListener('input', (e) => {
        const itemIdx = parseInt(e.target.dataset.itemIdx, 10);
        const specIdx = parseInt(e.target.dataset.specIdx, 10);
        this.state.items[itemIdx].customSpecs[specIdx].label = e.target.value;
        this.renderPreview();
      });
    });

    const specValInputs = this.itemsContainer.querySelectorAll('.spec-val-input');
    specValInputs.forEach(inp => {
      inp.addEventListener('input', (e) => {
        const itemIdx = parseInt(e.target.dataset.itemIdx, 10);
        const specIdx = parseInt(e.target.dataset.specIdx, 10);
        let val = e.target.value;
        if (/\b(?:1\/2|1\/4|3\/4|3\/8|5\/8|7\/8|1\/8|1\/3|2\/3)["' ]/.test(val) || val.endsWith('1/2"') || val.endsWith('1/4"') || val.endsWith('3/4"')) {
          const formatted = this.formatOutletDiameter(val);
          if (formatted !== val) {
            e.target.value = formatted;
            val = formatted;
          }
        }
        this.state.items[itemIdx].customSpecs[specIdx].value = val;
        this.renderPreview();
      });

      inp.addEventListener('blur', (e) => {
        const itemIdx = parseInt(e.target.dataset.itemIdx, 10);
        const specIdx = parseInt(e.target.dataset.specIdx, 10);
        let val = e.target.value;
        const formatted = this.formatOutletDiameter(this.formatDutyPoint(this.formatPower(val)));
        if (formatted !== val) {
          e.target.value = formatted;
          this.state.items[itemIdx].customSpecs[specIdx].value = formatted;
          this.renderPreview();
        }
      });
    });

    // Özel Özellik Yukarı Taşıma Butonları
    const moveUpBtns = this.itemsContainer.querySelectorAll('.btn-move-spec-up');
    moveUpBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemIdx = parseInt(btn.dataset.itemIdx, 10);
        const specIdx = parseInt(btn.dataset.specIdx, 10);
        if (specIdx > 0) {
          this.moveCustomSpec(itemIdx, specIdx, specIdx - 1);
        }
      });
    });

    // Özel Özellik Aşağı Taşıma Butonları
    const moveDownBtns = this.itemsContainer.querySelectorAll('.btn-move-spec-down');
    moveDownBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemIdx = parseInt(btn.dataset.itemIdx, 10);
        const specIdx = parseInt(btn.dataset.specIdx, 10);
        const specs = this.state.items[itemIdx]?.customSpecs || [];
        if (specIdx < specs.length - 1) {
          this.moveCustomSpec(itemIdx, specIdx, specIdx + 1);
        }
      });
    });

    // Özel Özellik Sürükle ve Bırak (Drag & Drop) Olayları
    let draggedItemIdx = null;
    let draggedSpecIdx = null;

    const specRows = this.itemsContainer.querySelectorAll('.custom-spec-row');
    specRows.forEach(row => {
      const handle = row.querySelector('.spec-drag-handle');

      if (handle) {
        handle.addEventListener('mousedown', () => {
          row.setAttribute('draggable', 'true');
        });
        handle.addEventListener('mouseup', () => {
          row.setAttribute('draggable', 'false');
        });
      }

      row.addEventListener('dragstart', (e) => {
        draggedItemIdx = parseInt(row.dataset.itemIdx, 10);
        draggedSpecIdx = parseInt(row.dataset.specIdx, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${draggedItemIdx}:${draggedSpecIdx}`);
        setTimeout(() => row.classList.add('dragging'), 0);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        row.setAttribute('draggable', 'false');
        this.itemsContainer.querySelectorAll('.custom-spec-row').forEach(r => {
          r.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetItemIdx = parseInt(row.dataset.itemIdx, 10);
        if (targetItemIdx !== draggedItemIdx) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          row.classList.add('drag-over-top');
          row.classList.remove('drag-over-bottom');
        } else {
          row.classList.add('drag-over-bottom');
          row.classList.remove('drag-over-top');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over-top', 'drag-over-bottom');
        const targetItemIdx = parseInt(row.dataset.itemIdx, 10);
        const targetSpecIdx = parseInt(row.dataset.specIdx, 10);

        if (draggedItemIdx === null || draggedSpecIdx === null) return;
        if (targetItemIdx !== draggedItemIdx) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        let finalIdx = e.clientY < midY ? targetSpecIdx : targetSpecIdx + 1;
        if (draggedSpecIdx < finalIdx) finalIdx--;

        if (finalIdx !== draggedSpecIdx) {
          this.moveCustomSpec(targetItemIdx, draggedSpecIdx, finalIdx);
        }
      });
    });

    // Özel Özellik Silme Butonları
    const delSpecBtns = this.itemsContainer.querySelectorAll('.btn-del-spec');
    delSpecBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const itemIdx = parseInt(btn.dataset.itemIdx, 10);
        const specIdx = parseInt(btn.dataset.specIdx, 10);
        this.removeCustomSpecFromItem(itemIdx, specIdx);
      });
    });

    // Metre Checkbox dinleyicisi
    const unitChecks = this.itemsContainer.querySelectorAll('.item-unit-check');
    unitChecks.forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        this.state.items[idx].isMeter = e.target.checked;
        this.state.items[idx].unitType = e.target.checked ? 'Metre' : 'Adet';
        this.renderPreview();
      });
    });

    // Buton dinleyicileri (Sil / Kopyala)
    const actionBtns = this.itemsContainer.querySelectorAll('.btn-remove-item[data-action]');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.index, 10);
        if (action === 'delete') this.removeItem(idx);
        if (action === 'duplicate') this.duplicateItem(idx);
      });
    });

    // Fiyat & İskonto Hesaplayıcı Aç/Kapa Butonları
    const toggleCalcBtns = this.itemsContainer.querySelectorAll('.btn-pricing-calc-toggle');
    toggleCalcBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = this.state.items[idx];
        if (!item.pricingCalc) {
          item.pricingCalc = { isOpen: false, mode: 'discount', listPrice: '', buyDiscount: '', sellDiscount: '', netCost: '', markupPercent: '' };
        }
        item.pricingCalc.isOpen = !item.pricingCalc.isOpen;

        const box = document.getElementById(`calc-box-${idx}`);
        const span = btn.querySelector('span');
        const isEn = (this.state.language === 'en');

        if (item.pricingCalc.isOpen) {
          btn.classList.add('active');
          if (span) span.textContent = isEn ? 'Close Calc' : 'Hesaplayıcıyı Kapat';
          if (box) {
            box.style.display = 'block';
            const firstInp = box.querySelector(item.pricingCalc.mode === 'markup' ? 'input[data-calc-field="netCost"]' : 'input[data-calc-field="listPrice"]');
            if (firstInp) firstInp.focus();
          }
        } else {
          btn.classList.remove('active');
          if (span) span.textContent = isEn ? 'Price Calculator' : 'Fiyat Hesaplayıcı';
          if (box) box.style.display = 'none';
        }
      });
    });

    // Hesaplayıcı Sekme Değiştirme Butonları (Mode: discount vs markup)
    const tabBtns = this.itemsContainer.querySelectorAll('.pricing-calc-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index, 10);
        const mode = btn.dataset.mode;
        const item = this.state.items[idx];
        if (!item.pricingCalc) {
          item.pricingCalc = { isOpen: true, mode: 'discount', listPrice: '', buyDiscount: '', sellDiscount: '', netCost: '', markupPercent: '' };
        }
        item.pricingCalc.mode = mode;

        const card = btn.closest('.item-card');
        if (card) {
          card.querySelectorAll('.pricing-calc-tab-btn').forEach(tb => {
            tb.classList.toggle('active', tb.dataset.mode === mode);
          });

          const discPanel = card.querySelector('.calc-mode-discount');
          const markupPanel = card.querySelector('.calc-mode-markup');
          if (discPanel) discPanel.style.display = (mode === 'discount') ? 'block' : 'none';
          if (markupPanel) markupPanel.style.display = (mode === 'markup') ? 'block' : 'none';

          const pricing = this.calculateItemPricing(item);
          const costValEl = card.querySelector('.calc-cost-val');
          const sellValEl = card.querySelector('.calc-sell-val');
          const markupSellValEl = card.querySelector('.calc-markup-sell-val');
          const profitValEl = card.querySelector('.calc-profit-val');
          const unitPriceInp = card.querySelector('.item-input[data-field="unitPrice"]');
          const lineTotalEl = card.querySelector('.item-line-total-val');

          if (mode === 'discount') {
            if (costValEl) costValEl.textContent = pricing.hasCost ? `${pricing.costPrice} ${this.state.currency}` : '-';
            if (sellValEl) sellValEl.textContent = pricing.hasSell ? `${pricing.sellPrice} ${this.state.currency}` : '-';
          } else {
            if (markupSellValEl) markupSellValEl.textContent = pricing.hasSell ? `${pricing.sellPrice} ${this.state.currency}` : '-';
          }

          if (profitValEl) {
            profitValEl.textContent = pricing.hasProfit
              ? `+${pricing.profit} ${this.state.currency} (+${pricing.profitPercent}%)`
              : '-';
          }

          if (pricing.hasSell) {
            item.unitPrice = pricing.sellPrice;
            if (unitPriceInp) unitPriceInp.value = pricing.sellPrice;
            const qty = parseFloat(item.qty) || 0;
            const lineTot = qty * pricing.sellPrice;
            if (lineTotalEl) lineTotalEl.textContent = this.formatCurrency(lineTot);

            this.updateTotalsSidebar();
            this.renderPreview();
          }
        }
      });
    });

    // Hesaplayıcı Input Dinleyicileri (Gerçek Zamanlı Canlı Hesaplama)
    const calcInputs = this.itemsContainer.querySelectorAll('.calc-input');
    calcInputs.forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        const calcField = e.target.dataset.calcField;
        const val = e.target.value;
        const item = this.state.items[idx];
        if (!item.pricingCalc) {
          item.pricingCalc = { isOpen: true, mode: 'discount', listPrice: '', buyDiscount: '', sellDiscount: '', netCost: '', markupPercent: '' };
        }
        item.pricingCalc[calcField] = val;

        const pricing = this.calculateItemPricing(item);
        const card = e.target.closest('.item-card');
        if (card) {
          const costValEl = card.querySelector('.calc-cost-val');
          const sellValEl = card.querySelector('.calc-sell-val');
          const markupSellValEl = card.querySelector('.calc-markup-sell-val');
          const profitValEl = card.querySelector('.calc-profit-val');
          const unitPriceInp = card.querySelector('.item-input[data-field="unitPrice"]');
          const lineTotalEl = card.querySelector('.item-line-total-val');

          if (item.pricingCalc.mode === 'discount') {
            if (costValEl) costValEl.textContent = pricing.hasCost ? `${pricing.costPrice} ${this.state.currency}` : '-';
            if (sellValEl) sellValEl.textContent = pricing.hasSell ? `${pricing.sellPrice} ${this.state.currency}` : '-';
          } else {
            if (markupSellValEl) markupSellValEl.textContent = pricing.hasSell ? `${pricing.sellPrice} ${this.state.currency}` : '-';
          }

          if (profitValEl) {
            profitValEl.textContent = pricing.hasProfit
              ? `+${pricing.profit} ${this.state.currency} (+${pricing.profitPercent}%)`
              : '-';
          }

          if (pricing.hasSell) {
            item.unitPrice = pricing.sellPrice;
            if (unitPriceInp) unitPriceInp.value = pricing.sellPrice;
            const qty = parseFloat(item.qty) || 0;
            const lineTot = qty * pricing.sellPrice;
            if (lineTotalEl) lineTotalEl.textContent = this.formatCurrency(lineTot);

            this.updateTotalsSidebar();
            this.renderPreview();
          }
        }
      });
    });

    this.updateTotalsSidebar();
  }

  updateTotalsSidebar() {
    const { subtotal, vat, grandTotalWithVat } = this.calculateTotals();
    this.summarySubtotal.textContent = this.formatCurrency(subtotal);
    this.summaryVat.textContent = this.formatCurrency(vat);
    // Sol panelde müşteri sorarsa hızlıca bakabilmek için KDV Dahil toplam doğru hesaplanıp gösterilir:
    this.summaryGrandtotal.textContent = this.formatCurrency(grandTotalWithVat);

    // Paket / Proje Özel Fiyat kutucuğundaki canlı önizleme ve rozet
    if (this.packageLivePill) {
      if (this.state.isPackagePrice && subtotal > 0) {
        this.packageLivePill.textContent = this.formatCurrency(subtotal);
        this.packageLivePill.style.display = 'inline-block';
      } else {
        this.packageLivePill.style.display = 'none';
      }
    }
    if (this.previewPackageGrandTotal) {
      if (this.state.isPackagePrice && subtotal > 0) {
        this.previewPackageGrandTotal.value = this.formatCurrency(grandTotalWithVat) + ' (KDV Dahil)';
      } else {
        this.previewPackageGrandTotal.value = '0,00 ' + (this.state.currency || 'EUR');
      }
    }
  }

  renderPreview() {
    const isEn = (this.state.language === 'en');

    // 1. Sayfa Dil Etiketleri
    if (this.lblTo) this.lblTo.textContent = isEn ? 'To:' : 'Kime:';
    if (this.lblAddress) this.lblAddress.textContent = isEn ? 'Address:' : 'Adres:';
    if (this.lblDate) this.lblDate.textContent = isEn ? 'Date:' : 'Tarih:';
    if (this.lblQuotationRef) this.lblQuotationRef.textContent = isEn ? 'Quotation Ref:' : 'Teklif Ref:';
    if (this.lblInternalRef) this.lblInternalRef.textContent = isEn ? 'Internal Ref No:' : 'Dahili Ref No:';
    if (this.lblSalesForceRef) this.lblSalesForceRef.textContent = 'Sales Force Ref No:';
    if (this.lblAttention) this.lblAttention.textContent = isEn ? 'Attention:' : 'İlgili:';
    if (this.lblTel) this.lblTel.textContent = 'Tel:';
    if (this.lblEmail) this.lblEmail.textContent = isEn ? 'Email:' : 'E-Posta:';
    if (this.lblPreparedBy) this.lblPreparedBy.textContent = isEn ? 'Prepared By:' : 'Hazırlayan:';
    if (this.lblSubject) this.lblSubject.textContent = isEn ? 'Subject:' : 'Konu:';

    if (this.lblSignerName) this.lblSignerName.textContent = isEn ? 'Name:' : 'İsim:';
    if (this.lblSignerMobile) this.lblSignerMobile.textContent = isEn ? 'Mobile:' : 'Mobil:';
    if (this.lblSignerEmail) this.lblSignerEmail.textContent = isEn ? 'Email :' : 'E-Posta :';

    // 1. Sayfa Ön Yazı Metni (TR / EN)
    if (this.docLetterContent) {
      if (isEn) {
        this.docLetterContent.innerHTML = `
          <div class="letter-salutation">Dear Sir / Mdm,</div>
          <div class="letter-body-p">Thank you for the inquiry.</div>
          <div class="letter-body-p">Please find below our proposal as per request.<br>Should you have any questions or need further information regarding the same, please do not hesitate to contact us</div>
          <div class="letter-closing">Yours Sincerely,</div>
        `;
      } else {
        this.docLetterContent.innerHTML = `
          <div class="letter-salutation">Sayın Yetkili,</div>
          <div class="letter-body-p">Tarafımıza iletmiş olduğunuz talep ve ilginiz için teşekkür ederiz.</div>
          <div class="letter-body-p">Talebiniz doğrultusunda hazırladığımız fiyat teklifimiz aşağıda bilgilerinize sunulmuştur.<br>Teklifimizle ilgili her türlü soru ve ilave bilgi talebiniz için bizimle dilediğiniz zaman iletişime geçebilirsiniz.</div>
          <div class="letter-closing">Saygılarımızla,</div>
        `;
      }
    }

    // 1. Sayfa Değer Güncellemeleri
    const displayDate = this.formatDateForDisplay(this.state.dateISO);
    const quotationRef = this.inputQuotationRef.value.trim() || this.generateQuotationRef(this.state.dateISO);
    const sfRefComputed = this.getComputedSfRef();

    if (this.docTo) this.docTo.textContent = this.state.customer.to || '';
    if (this.docAddress) this.docAddress.textContent = this.state.customer.address || '';
    if (this.docAttention) this.docAttention.textContent = this.state.customer.attention || '';
    if (this.docEmail) this.docEmail.textContent = this.state.customer.email || '';
    if (this.docTel) this.docTel.textContent = this.formatPhoneNumber(this.state.customer.tel) || '';

    if (this.docDate) this.docDate.textContent = displayDate;
    if (this.docQuotationRef) this.docQuotationRef.textContent = quotationRef;
    
    // Internal Ref
    const internalVal = this.inputInternalRef ? this.inputInternalRef.value.trim() : '';
    if (this.docInternalRef) this.docInternalRef.textContent = internalVal;

    if (this.docSfRef) this.docSfRef.textContent = sfRefComputed;
    if (this.docSubject) this.docSubject.textContent = isEn ? this.translateText(this.state.customer.subject || '') : (this.state.customer.subject || '');

    if (this.docPreparedByPage1) {
      this.docPreparedByPage1.textContent = this.state.profile.preparedBy || 'Melih Kurtgün';
    }

    // 1. Sayfa İmza Bloğu
    if (this.docSignerName) this.docSignerName.textContent = this.state.profile.preparedBy || 'Melih Kurtgün';
    if (this.docSignerMobile) this.docSignerMobile.textContent = this.formatPhoneNumber(this.state.profile.signerMobile || '+90 543 956 85 11');
    
    // Ortek / PHS Şirket Geçişleri
    const isPhs = this.state.activeCompany === 'phs';
    const logoSrc = isPhs ? 'assets/PHS Logo.png' : 'assets/ortek-logo.png';
    const shortName = isPhs ? 'PHS Pompa ve Hidrofor Sistemleri' : 'Ortek Akışkan ve Pompa Teknolojileri';
    const longName = isPhs ? 'PHS Pompa ve Hidrofor Sistemleri San. Tic. Ltd. Şti.' : 'Ortek Akışkan ve Pompa Teknolojileri San.Tic.Ltd.Şti.';
    const currentEmail = isPhs ? (this.state.profile.phsSignerEmail || 'satisdestek@phspompa.com') : (this.state.profile.signerEmail || 'melih.kurtgun@ortek.com.tr');

    const addressL1 = isPhs ? 'Müeyyetzade, Necatibey Cd. No:5/E' : 'Müeyyetzade, Necatibey Cd. 5/27';
    const addressL2 = isPhs ? '34421 Beyoğlu/İstanbul' : 'Sait Demirbağ İş Hanı, 34425';
    const addressL3 = isPhs ? '' : 'Beyoğlu/İstanbul';

    if (this.docSignerEmail) this.docSignerEmail.textContent = currentEmail;

    if (this.docLogoBoxRight) {
      if (isPhs) {
        this.docLogoBoxRight.classList.add('phs-active');
      } else {
        this.docLogoBoxRight.classList.remove('phs-active');
      }
    }

    if (this.docLogoPage1 && this.phsLogoWrapperPage1) {
      if (isPhs) {
        this.docLogoPage1.style.setProperty('display', 'none', 'important');
        this.phsLogoWrapperPage1.style.setProperty('display', 'flex', 'important');
      } else {
        this.docLogoPage1.style.setProperty('display', 'block', 'important');
        this.docLogoPage1.src = 'assets/ortek-logo.png';
        this.phsLogoWrapperPage1.style.setProperty('display', 'none', 'important');
      }
    } else if (this.docLogoPage1) {
      this.docLogoPage1.src = logoSrc;
    }

    if (this.docCompanyShort) this.docCompanyShort.textContent = shortName;
    if (this.docAddressLine1) this.docAddressLine1.textContent = addressL1;
    if (this.docAddressLine2) this.docAddressLine2.textContent = addressL2;
    if (this.docAddressLine3) this.docAddressLine3.textContent = addressL3;
    if (this.docCompanyTitle1) this.docCompanyTitle1.textContent = longName;

    if (this.docSignerTitle) {
      this.docSignerTitle.textContent = `${this.state.profile.preparedBy} - ${this.state.profile.signerRole}`;
    }

    // DİNAMİK ÇOK SAYFALI TEKLİF VE TABLO ÇİZİMİ (Dynamic Multi-Page Engine)
    this.renderDynamicQuotationPages({
      displayDate,
      quotationRef,
      attention: this.state.customer.attention || '',
      preparedBy: this.state.profile.preparedBy || 'Melih Kurtgün',
      signerRole: this.state.profile.signerRole || 'Makine Mühendisi',
      logoSrc,
      longName,
      isPhs
    });
  }

  estimateItemHeight(item) {
    let lines = 1;
    if (item.title) lines++;
    if (item.marka) lines++;
    if (item.model) lines++;
    if (item.calismaAraligi) lines++;
    if (item.guc) lines++;
    if (item.cikis) lines++;
    if (item.extraDetails) lines += Math.ceil(item.extraDetails.length / 45);
    if (item.customSpecs && item.customSpecs.length > 0) {
      item.customSpecs.forEach(s => { if (s.label || s.value) lines++; });
    }
    return 8 + (lines * 16);
  }

  paginateQuote(items) {
    if (!items || items.length === 0) {
      return [{ items: [], hasGrandTotal: false, hasRemarks: true }];
    }

    // Sayfa altından tam olarak boşluk kalana kadar sayfayı tam doldurma sınırı (px):
    const PAGE_LIMIT = 830;
    const REMARKS_SPACE = 250;
    const GT_SPACE = 28;

    const pages = [];
    let remainingItems = [...items];
    let remarksPlaced = false;

    while (remainingItems.length > 0 || !remarksPlaced) {
      let currentItems = [];
      let currentHeight = 0;
      let hasGrandTotal = false;
      let hasRemarks = false;

      while (remainingItems.length > 0) {
        const nextItem = remainingItems[0];
        const nextH = this.estimateItemHeight(nextItem);
        const remainingIfTaken = remainingItems.length - 1;

        // Eğer bu son kalem ise:
        if (remainingIfTaken === 0) {
          // Hem tüm ürünler hem Grand Total hem de Remarks bu sayfaya sığıyor mu?
          if (currentHeight + nextH + GT_SPACE + REMARKS_SPACE <= PAGE_LIMIT) {
            currentItems.push(remainingItems.shift());
            currentHeight += nextH;
            hasGrandTotal = true;
            hasRemarks = true;
            remarksPlaced = true;
            break;
          } 
          // Sadece ürünler ve Grand Total sığıyorsa (Remarks sonraki sayfaya kalacak):
          else if (currentHeight + nextH + GT_SPACE <= PAGE_LIMIT) {
            currentItems.push(remainingItems.shift());
            currentHeight += nextH;
            hasGrandTotal = true;
            hasRemarks = false;
            break;
          } 
          // Son kalem bile bu sayfaya sığmıyorsa sonraki sayfaya bırak:
          else {
            break;
          }
        } 
        // Daha eklenecek başka kalemler de varsa:
        else {
          if (currentHeight + nextH > PAGE_LIMIT) {
            break; // Sayfa 4 satır sınırına kadar doldu, sonraki sayfaya geç
          }
          currentItems.push(remainingItems.shift());
          currentHeight += nextH;
        }
      }

      // Eğer tüm ürünler bitti ama Remarks henüz yerleşmediyse:
      if (!remarksPlaced && remainingItems.length === 0) {
        if (!hasRemarks) {
          if (currentItems.length === 0) {
            hasRemarks = true;
            remarksPlaced = true;
          }
        }
      }

      pages.push({
        items: currentItems,
        hasGrandTotal,
        hasRemarks
      });
    }

    return pages;
  }

  renderDocRow(item, index) {
    const isEn = (this.state.language === 'en');
    const q = parseFloat(item.qty) || 0;
    const p = parseFloat(item.unitPrice) || 0;
    const rowTotal = q * p;

    let titleText = item.title || '';
    if (isEn && titleText) {
      titleText = this.translateText(titleText);
    }

    let descHtml = '';
    if (titleText) {
      descHtml += `<div class="product-title-bold">${this.escapeHtml(titleText)}</div>`;
    }
    
    const lblBrand = isEn ? 'Brand:' : 'Marka:';
    const lblRange = isEn ? 'Operating Range:' : 'Çalışma Aralığı:';
    const lblPower = isEn ? 'Power:' : 'Güç:';
    const lblOutlet = isEn ? 'Outlet:' : 'Çıkış:';

    let specsHtml = '<div class="product-specs-wrapper">';
    if (item.marka) {
      specsHtml += `<div class="spec-line spec-brand">${lblBrand} <span class="spec-value">${this.escapeHtml(item.marka)}</span></div>`;
    }
    if (item.model) {
      specsHtml += `<div class="spec-line">Model: <span class="spec-value">${this.escapeHtml(item.model)}</span></div>`;
    }
    if (item.calismaAraligi) {
      let formattedCalisma = this.formatDutyPoint(item.calismaAraligi);
      let calismaFormatted = this.escapeHtml(formattedCalisma).replace(/m[3³]/g, 'm<sup>3</sup>');
      specsHtml += `<div class="spec-line">${lblRange} <span class="spec-value">${calismaFormatted}</span></div>`;
    }
    if (item.guc) {
      let formattedGuc = this.formatPower(item.guc);
      let gucVal = isEn ? this.translateText(formattedGuc) : formattedGuc;
      specsHtml += `<div class="spec-line">${lblPower} <span class="spec-value">${this.escapeHtml(gucVal)}</span></div>`;
    }
    if (item.cikis) {
      let formattedCikis = this.formatOutletDiameter(item.cikis);
      let cikisVal = isEn ? this.translateText(formattedCikis) : formattedCikis;
      specsHtml += `<div class="spec-line">${lblOutlet} <span class="spec-value">${this.escapeHtml(cikisVal)}</span></div>`;
    }
    if (item.extraDetails) {
      let extraVal = isEn ? this.translateText(item.extraDetails) : item.extraDetails;
      specsHtml += `<div class="spec-line"><span class="spec-value">${this.escapeHtml(extraVal)}</span></div>`;
    }

    if (item.customSpecs && item.customSpecs.length > 0) {
      item.customSpecs.forEach(spec => {
        if (spec.label || spec.value) {
          let specLabel = spec.label || '';
          let specVal = spec.value || '';
          if (isEn) {
            specLabel = this.translateCustomSpecLabel(specLabel);
            specVal = this.translateText(specVal);
          }
          let formattedVal = this.formatOutletDiameter(this.formatDutyPoint(this.formatPower(specVal)));
          let valFormatted = this.escapeHtml(formattedVal).replace(/m[3³]/g, 'm<sup>3</sup>');
          let labelFormatted = this.escapeHtml(specLabel);
          if (labelFormatted && !labelFormatted.endsWith(':')) labelFormatted += ':';
          specsHtml += `<div class="spec-line">${labelFormatted} <span class="spec-value">${valFormatted}</span></div>`;
        }
      });
    }

    specsHtml += '</div>';
    descHtml += specsHtml;

    let unitLabel = item.isMeter ? (isEn ? 'Meter' : 'Metre') : (item.unitType === 'Metre' ? (isEn ? 'Meter' : 'Metre') : (isEn ? 'Pcs' : 'Adet'));

    if (this.state.isPackagePrice) {
      const rowPriceText = this.escapeHtml(this.state.packageRowText || 'Proje Özel Fiyat');
      const qtyStr = (q > 0) ? `${q} ${this.escapeHtml(unitLabel)}` : '';

      return `
        <tr>
          <td class="col-no">${index + 1}</td>
          <td class="col-desc">${descHtml}</td>
          <td class="col-qty">${qtyStr}</td>
          <td class="col-price" style="font-weight: 600; font-size: 0.8rem; color: #0284c7;">${rowPriceText}</td>
          <td class="col-total" style="font-weight: 600; font-size: 0.8rem; color: #0284c7;">${rowPriceText}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="col-no">${index + 1}</td>
        <td class="col-desc">${descHtml}</td>
        <td class="col-qty">${q > 0 ? (q + ' ' + this.escapeHtml(unitLabel)) : ''}</td>
        <td class="col-price">${p > 0 ? this.formatCurrency(p) : ''}</td>
        <td class="col-total">${rowTotal > 0 ? this.formatCurrency(rowTotal) : ''}</td>
      </tr>
    `;
  }

    renderRemarksHtml() {
    const list = this.customRemarksList ? this.customRemarksList : this.generateRemarksArray();
    let html = '';
    list.forEach(rem => {
      const parts = rem.split(':');
      if (parts.length > 1 && parts[0].length < 35 && !parts[0].includes('http')) {
        let restOfText = this.escapeHtml(parts.slice(1).join(':'));
        restOfText = restOfText.replace(/%20\s*KDV/gi, '<strong class="highlight-vat">%20 KDV</strong>');
        restOfText = restOfText.replace(/20%\s*VAT/gi, '<strong class="highlight-vat">20% VAT</strong>');
        html += `<li><strong>${this.escapeHtml(parts[0])}:</strong>${restOfText}</li>`;
      } else {
        let escapedRem = this.escapeHtml(rem);
        escapedRem = escapedRem.replace(/%20\s*KDV/gi, '<strong class="highlight-vat">%20 KDV</strong>');
        escapedRem = escapedRem.replace(/20%\s*VAT/gi, '<strong class="highlight-vat">20% VAT</strong>');
        html += `<li>${escapedRem}</li>`;
      }
    });
    return html;
  }

  renderDynamicQuotationPages(meta) {
    if (!this.docContainer) return;
    const isEn = (this.state.language === 'en');
    
    // 1. Sayfa dışındaki tüm eski sayfaları temizle
    const pages = Array.from(this.docContainer.querySelectorAll('.a4-page'));
    for (let i = 1; i < pages.length; i++) {
      pages[i].remove();
    }

    const pageConfigs = this.paginateQuote(this.state.items);
    const totalPages = 1 + pageConfigs.length;

    // Sayfa 1 Tag'ini güncelle
    const page1Tag = document.querySelector('#page-1 .a4-page-tag');
    if (page1Tag) {
      page1Tag.innerHTML = isEn 
        ? `PAGE 1 / ${totalPages} &mdash; COVER LETTER`
        : `SAYFA 1 / ${totalPages} &mdash; TEKLİF ÖN YAZISI`;
    }

    const { grandTotal } = this.calculateTotals();
    const currencyLabel = this.state.currency || 'EUR';
    let currentGlobalIndex = 0;

    pageConfigs.forEach((pageCfg, pageIdx) => {
      const pageNum = 2 + pageIdx;
      
      let pageTitle = isEn ? 'PROPOSAL ITEMS' : 'TEKLİF KALEMLERİ';
      if (pageCfg.hasRemarks && pageCfg.items.length === 0) {
        pageTitle = isEn ? 'TERMS & CONDITIONS' : 'ŞARTLAR VE KOŞULLAR';
      } else if (pageCfg.hasRemarks) {
        pageTitle = isEn ? 'PROPOSAL ITEMS & TERMS' : 'TEKLİF KALEMLERİ VE ŞARTLAR';
      }

      const pageDiv = document.createElement('div');
      pageDiv.className = 'a4-page';
      pageDiv.id = `page-${pageNum}`;

      // Tablo satırlarını oluştur
      let rowsHtml = '';
      pageCfg.items.forEach((item) => {
        rowsHtml += this.renderDocRow(item, currentGlobalIndex);
        currentGlobalIndex++;
      });

      // Grand Total satırı bu sayfada ise ekle
      if (pageCfg.hasGrandTotal && grandTotal > 0) {
        let gtLabel = isEn ? 'Grand Total' : 'Toplam Tutar';
        if (this.state.isPackagePrice) {
          gtLabel = this.escapeHtml(this.state.packageTotalText || 'Proje Özel Fiyat');
        }
        rowsHtml += `
          <tr class="grand-total-row">
            <td colspan="3" class="grand-total-empty" style="border: none !important; background: transparent !important;"></td>
            <td class="grand-total-label">${gtLabel}</td>
            <td class="grand-total-amount">${this.formatCurrency(grandTotal)}</td>
          </tr>
        `;
      }

      let tableSectionHtml = '';
      if (pageCfg.items.length > 0 || pageCfg.hasGrandTotal) {
        const sectionTitle = chunkIdx => {
          if (chunkIdx === 0) return isEn ? 'Quotation' : 'Fiyat Teklifi';
          return isEn ? 'Quotation (Continuation)' : 'Fiyat Teklifi (Devamı)';
        };

        const thDesc = isEn ? 'Description' : 'Açıklama / Ürün Tanımı';
        const thQty = isEn ? 'Qty' : 'Miktar';
        const thUnit = isEn ? `Unit Price ${currencyLabel}` : `Birim Fiyat ${currencyLabel}`;
        const thTotal = isEn ? `Total Price ${currencyLabel}` : `Toplam Fiyat ${currencyLabel}`;

        tableSectionHtml = `
          <!-- Başlık: Quotation / Fiyat Teklifi -->
          <div class="doc-title-quotation">${sectionTitle(pageIdx)}</div>

          <!-- Ürün / Fiyat Tablosu -->
          <div class="quotation-table-wrapper">
            <table class="quotation-table">
              <thead>
                <tr>
                  <th class="col-no">No</th>
                  <th class="col-desc">${thDesc}</th>
                  <th class="col-qty">${thQty}</th>
                  <th class="col-price">${this.escapeHtml(thUnit)}</th>
                  <th class="col-total">${this.escapeHtml(thTotal)}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `;
      }

      let remarksAndSignoffHtml = '';
      if (pageCfg.hasRemarks) {
        const remarksHead = isEn ? 'Remarks : Terms and conditions:' : 'Remarks : Şartlar ve koşullar:';
        const closingText = isEn ? 'Saygılarımızla / Best Regards' : 'Saygılarımızla / Best Regards';

        remarksAndSignoffHtml = `
          <!-- Şartlar ve Koşullar (Remarks) -->
          <div class="remarks-section" style="${pageCfg.items.length === 0 ? 'margin-top: 1.5rem;' : ''}">
            <div class="remarks-header">${remarksHead}</div>
            <ul class="remarks-list">
              ${this.renderRemarksHtml()}
            </ul>
          </div>

          <!-- Sayfa Alt Kapanış Bloğu -->
          <div class="page2-signoff" style="page-break-inside: avoid !important; break-inside: avoid !important; display: block !important;">
            <div class="closing-text" style="page-break-inside: avoid !important; break-inside: avoid !important;">${closingText}</div>
            <div class="company-title" style="page-break-inside: avoid !important; break-inside: avoid !important;">${meta.longName}</div>
            <div class="person-role" style="page-break-inside: avoid !important; break-inside: avoid !important;">${meta.preparedBy} - ${meta.signerRole}</div>
          </div>
        `;
      }

      const lblDate2 = isEn ? 'Date:' : 'Tarih:';
      const lblFrom2 = isEn ? 'From:' : 'İlgili:';
      const lblPrep2 = isEn ? 'Prepared By:' : 'Hazırlayan:';

      pageDiv.innerHTML = `
        <div class="a4-page-tag no-print">${pageTitle} (${pageNum} / ${totalPages})</div>

        <!-- Üst Başlık: Sol Büyütülmüş Logo & Sağ Bilgi Bloğu -->
        <div class="page2-header">
          <div class="page2-logo-box">
            ${meta.isPhs ? `
              <div class="phs-logo-wrapper page2-phs-wrapper">
                <img src="assets/PHS Logo.png" alt="PHS Logo" class="phs-main-logo">
                <img src="assets/pompa-merkezi-logo.png" alt="Pompa Merkezi Logo" class="phs-sub-logo">
              </div>
            ` : `
              <img src="${meta.logoSrc}" alt="Logo">
            `}
          </div>
          <div class="page2-header-meta">
            <div class="page2-meta-row">
              <span class="page2-meta-label">${lblDate2}</span>
              <span>${meta.displayDate}</span>
            </div>
            <div class="page2-meta-row">
              <span class="page2-meta-label">Ref:</span>
              <span>${meta.quotationRef}</span>
            </div>
            <div class="page2-meta-row">
              <span class="page2-meta-label">${lblFrom2}</span>
              <span>${this.escapeHtml(meta.attention)}</span>
            </div>
            <div class="page2-meta-row">
              <span class="page2-meta-label">${lblPrep2}</span>
              <span>${this.escapeHtml(meta.preparedBy)}</span>
            </div>
          </div>
        </div>

        ${tableSectionHtml}
        ${remarksAndSignoffHtml}
      `;

      this.docContainer.appendChild(pageDiv);
    });
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#039;';
        default: return m;
      }
    });
  }

  // --------------------------------------------------------------------------
  // Akıllı Formatlayıcılar: Telefon, Güç (kW/HP), mSS ve Kesirli İnç (½, ¼, ¾)
  // --------------------------------------------------------------------------
  formatPhoneNumber(val) {
    if (!val) return '';
    let str = String(val).trim();
    if (!str) return '';

    // 1. Uluslararası numara kontrolü (+ ile başlayanlar)
    if (str.startsWith('+')) {
      const digits = str.replace(/\D/g, '');
      // Türkiye (+90)
      if (digits.startsWith('90')) {
        const d = digits.slice(2);
        if (d.length === 10) {
          return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
        }
        return `+90 ${d}`;
      }
      
      // Yabancı Uluslararası Numaralar (+1, +44, +49, +33, +971 vb.)
      if (digits.length >= 7 && digits.length <= 16) {
        let ccLen = 2; // varsayılan 2 hane
        if (digits.startsWith('1') || digits.startsWith('7')) {
          ccLen = 1;
        } else if (digits.startsWith('971') || digits.startsWith('966') || digits.startsWith('965') || digits.startsWith('974') || digits.startsWith('968') || digits.startsWith('973') || digits.startsWith('359') || digits.startsWith('381') || digits.startsWith('385') || digits.startsWith('372') || digits.startsWith('370')) {
          ccLen = 3;
        }
        const cc = digits.slice(0, ccLen);
        const rest = digits.slice(ccLen);
        if (rest.length <= 4) {
          return `+${cc} ${rest}`;
        } else if (rest.length <= 7) {
          return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3)}`;
        } else if (rest.length === 9) {
          return `+${cc} ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
        } else if (rest.length === 10) {
          return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
        } else {
          return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8)}`;
        }
      }
      return str;
    }

    // 00 ile başlayan uluslararası (+ yerine 00 yazılmışsa)
    if (str.startsWith('00') && !str.startsWith('000') && (str.startsWith('0090') || str.startsWith('001') || str.startsWith('0044') || str.startsWith('0049'))) {
      const without00 = '+' + str.slice(2);
      return this.formatPhoneNumber(without00);
    }

    // Sadece rakamlar
    let digits = str.replace(/\D/g, '');

    // Ekstra sıfır temizleme: 0 054... gibi çift sıfırla girilmişse birini temizle
    if (digits.startsWith('00') && digits.length === 12 && (digits.charAt(2) === '5' || digits.charAt(2) === '2' || digits.charAt(2) === '3' || digits.charAt(2) === '4')) {
      digits = digits.slice(1);
    }

    // 2. 0 ile başlayan 11 haneli numara (örn: 05546956525)
    // Kullanıcının talebi: "05546956525 şeklinde yazılırsa 0 554 695 65 25 olarak yaz"
    if (digits.startsWith('0') && digits.length === 11) {
      return `0 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
    }

    // 3. 0 OLMADAN yazılan 10 haneli numara (örn: 5546956525)
    // Kullanıcının talebi: "5546956525 yazılırsa 554 695 65 25 olarak yaz"
    if (!digits.startsWith('0') && digits.length === 10) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
    }

    // 4. 90 ile başlayıp 12 haneli (+ sız yazılmış)
    if (digits.startsWith('90') && digits.length === 12) {
      const d = digits.slice(2);
      return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
    }

    return str;
  }

  formatPower(val) {
    if (!val) return '';
    let str = String(val);
    // 4 kw, 4 KW, 4kw -> 4kW (kullanıcının talebi: "ben oraya 4 kw yazsam bile 4kW yazsın")
    str = str.replace(/(\d+(?:[.,]\d+)?)\s*kw\b/gi, '$1kW');
    str = str.replace(/\bkw\b/gi, 'kW');
    // 50 hp, 50hp, 50 HP -> 50HP
    str = str.replace(/(\d+(?:[.,]\d+)?)\s*hp\b/gi, '$1HP');
    str = str.replace(/\bhp\b/gi, 'HP');
    return str;
  }

  formatDutyPoint(val) {
    if (!val) return '';
    let str = String(val);
    // mss, MSS, Mss -> mSS
    return str.replace(/mss/gi, 'mSS');
  }

  formatOutletDiameter(val) {
    if (!val) return '';
    let str = String(val);

    // 2 1/2" -> 2½", 1 1/4" -> 1¼" vb.
    str = str.replace(/(\d+)\s*[- ]?\s*1\/2/g, '$1½');
    str = str.replace(/(\d+)\s*[- ]?\s*1\/4/g, '$1¼');
    str = str.replace(/(\d+)\s*[- ]?\s*3\/4/g, '$1¾');
    str = str.replace(/(\d+)\s*[- ]?\s*3\/8/g, '$1⅜');
    str = str.replace(/(\d+)\s*[- ]?\s*5\/8/g, '$1⅝');
    str = str.replace(/(\d+)\s*[- ]?\s*7\/8/g, '$1⅞');
    str = str.replace(/(\d+)\s*[- ]?\s*1\/8/g, '$1⅛');
    str = str.replace(/(\d+)\s*[- ]?\s*1\/3/g, '$1⅓');
    str = str.replace(/(\d+)\s*[- ]?\s*2\/3/g, '$1⅔');

    // Başına tam sayı gelmeyen yalın kesirler (örn: 1/2" -> ½")
    str = str.replace(/(?<!\d)1\/2/g, '½');
    str = str.replace(/(?<!\d)1\/4/g, '¼');
    str = str.replace(/(?<!\d)3\/4/g, '¾');
    str = str.replace(/(?<!\d)3\/8/g, '⅜');
    str = str.replace(/(?<!\d)5\/8/g, '⅝');
    str = str.replace(/(?<!\d)7\/8/g, '⅞');
    str = str.replace(/(?<!\d)1\/8/g, '⅛');
    str = str.replace(/(?<!\d)1\/3/g, '⅓');
    str = str.replace(/(?<!\d)2\/3/g, '⅔');

    // Çift tek tırnak '' veya tırnak işaretlerini standart çift tırnağa çevir
    str = str.replace(/''/g, '"').replace(/[“”]/g, '"');

    return str;
  }


  // --------------------------------------------------------------------------
  // Zoom ve Görünüm Kontrolleri
  // --------------------------------------------------------------------------
  setZoom(level) {
    this.state.zoomLevel = Math.max(0.4, Math.min(1.5, level));
    this.docContainer.style.transform = `scale(${this.state.zoomLevel})`;
    this.zoomIndicator.textContent = `${Math.round(this.state.zoomLevel * 100)}%`;
    this.btnZoomFit.classList.remove('active');
  }

  fitZoom() {
    const viewport = document.querySelector('.preview-viewport');
    if (!viewport) return;
    const availableWidth = viewport.clientWidth - 80;
    const a4WidthPx = 794;
    const scale = Math.min(1.5, availableWidth / a4WidthPx);
    this.state.zoomLevel = scale;
    this.docContainer.style.transform = `scale(${scale})`;
    this.zoomIndicator.textContent = `${Math.round(scale * 100)}%`;
    this.btnZoomFit.classList.add('active');
  }

  triggerPrint() {
    // 1. PDF oluşturulurken otomatik olarak geçmişe kaydet
    this.saveCurrentQuoteToHistory();

    const history = this.getHistory();
    const sfRef = this.getComputedSfRef();
    const quoteData = history.find(h => h.sfRef === sfRef) || history[0];

    const companyName = this.state.customer.to ? this.state.customer.to.trim() : 'Müşteri';
    const displayRef = sfRef || this.inputQuotationRef.value.trim() || Date.now();
    const safeRef = displayRef.toString().replace(/[\/\\?%*:|"<>]/g, '-'); // Windows dosya adı için geçersiz karakterleri temizle
    
    // İngilizce ise dosya adının sonuna EN ekle
    const isEn = (this.state.language === 'en');
    const langSuffix = isEn ? ' - EN' : '';
    const pdfName = `${companyName} Fiyat Teklifi - ${safeRef}${langSuffix}`;

    this.showToast('PDF arka planda oluşturuluyor, lütfen bekleyin...', 'info');

    if (window.electronAPI) {
      const activeCompany = this.state.activeCompany; // 'ortek' veya 'phs'
      window.electronAPI.savePdf({ companyName, pdfName, activeCompany })
        .then(data => {
          if (data.success) {
            const subFolder = activeCompany === 'phs' ? 'PHS Tekliflerim' : 'Ortek Tekliflerim';
            this.showToast(`PDF başarıyla kaydedildi ve açıldı: ${pdfName}.pdf`, 'success');
          } else {
            this.showToast(`Hata: ${data.error}`, 'error');
          }
        })
        .catch(err => {
          console.error(err);
          this.showToast('PDF oluşturulurken hata oluştu.', 'error');
        });
    } else {
      window.print();
    }
  }

  // --------------------------------------------------------------------------
  // Profil Modalı ve Kullanıcı Oturumu Değiştirme İşlemleri
  // --------------------------------------------------------------------------
  openProfileModal() {
    this.settingPreparedBy.value = this.state.profile.preparedBy || '';
    this.settingSignerRole.value = this.state.profile.signerRole || '';
    this.settingSignerMobile.value = this.state.profile.signerMobile || '';
    this.settingSignerEmail.value = this.state.profile.signerEmail || '';
    if (this.settingPhsEmail) this.settingPhsEmail.value = this.state.profile.phsSignerEmail || 'satisdestek@phspompa.com';
    if (this.settingSecurityPin) this.settingSecurityPin.value = this.state.profile.securityPin || '1234';
    this.settingSfCounter.value = this.state.salesForceCounter;
    
    if (this.userSwitchPinArea) this.userSwitchPinArea.style.display = 'none';
    this.pendingSwitchUser = null;
    this.renderUserSwitchList();
    this.modalProfile.classList.add('active');
  }

  renderUserSwitchList() {
    if (!this.userSwitchList) return;
    const currentPrep = (this.state.profile.preparedBy || '').trim();
    const currentNorm = this.normalizeUserKey(currentPrep);
    if (this.profileActiveUserBadge) {
      this.profileActiveUserBadge.textContent = currentPrep || 'Seçilmedi';
    }

    const uniqueProfiles = new Map();
    if (this.userFullProfiles) {
      Object.values(this.userFullProfiles).forEach(p => {
        if (p && p.preparedBy) {
          const normKey = this.normalizeUserKey(p.preparedBy);
          if (!uniqueProfiles.has(normKey)) {
            uniqueProfiles.set(normKey, p);
          }
        }
      });
    }

    let html = '';
    uniqueProfiles.forEach((p, normKey) => {
      const isCurrent = normKey === currentNorm;
      if (isCurrent) {
        html += `
          <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(46, 204, 113, 0.15); border: 1.5px solid #2ecc71; border-radius: 6px; font-size: 0.8rem; color: var(--text-main); font-weight: 600;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#2ecc71" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${p.preparedBy}</span>
            <span style="font-size: 0.68rem; color: #2ecc71; background: rgba(46, 204, 113, 0.2); padding: 1px 5px; border-radius: 4px;">Aktif</span>
          </div>
        `;
      } else {
        html += `
          <button type="button" class="btn btn-dark btn-user-switch-item" data-user="${p.preparedBy}" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>${p.preparedBy}</span>
          </button>
        `;
      }
    });

    this.userSwitchList.innerHTML = html;

    this.userSwitchList.querySelectorAll('.btn-user-switch-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetName = btn.getAttribute('data-user');
        this.promptUserSwitch(targetName);
      });
    });
  }

  promptUserSwitch(targetName) {
    const profile = this.getUserProfile(targetName);
    if (!profile) return;

    this.pendingSwitchUser = profile;
    if (this.userSwitchTargetLabel) {
      this.userSwitchTargetLabel.innerHTML = `<strong>${profile.preparedBy}</strong> oturumuna geçiş için 4 haneli PIN kodunuzu girin:`;
    }
    if (this.userSwitchPinInput) {
      this.userSwitchPinInput.value = '';
    }
    if (this.userSwitchPinArea) {
      this.userSwitchPinArea.style.display = 'block';
      if (this.userSwitchPinInput) this.userSwitchPinInput.focus();
    }
  }

  confirmUserSwitch() {
    if (!this.pendingSwitchUser) return;
    const pinEntered = this.userSwitchPinInput ? this.userSwitchPinInput.value.trim() : '';
    const requiredPin = (this.pendingSwitchUser.pin || '1234').toString().trim();

    if (pinEntered !== requiredPin) {
      this.showToast('Hatalı PIN kodu! Lütfen tekrar deneyin.', 'error');
      if (this.userSwitchPinInput) {
        this.userSwitchPinInput.value = '';
        this.userSwitchPinInput.focus();
      }
      return;
    }

    const u = this.pendingSwitchUser;

    if (this.state.profile.preparedBy && this.state.profile.preparedBy.trim().toLowerCase() !== u.preparedBy.toLowerCase()) {
      this.updateUserPresence(false);
    }

    this.state.profile.preparedBy = u.preparedBy;
    this.state.profile.signerRole = u.signerRole || 'Satış Mühendisi';
    this.state.profile.signerMobile = u.signerMobile || '';
    this.state.profile.signerEmail = u.signerEmail || '';
    this.state.profile.phsSignerEmail = u.phsEmail || 'satisdestek@phspompa.com';
    this.state.profile.securityPin = u.pin || '1234';

    localStorage.setItem('ortek_prepared_by', u.preparedBy);
    localStorage.setItem('ortek_signer_role', this.state.profile.signerRole);
    localStorage.setItem('ortek_signer_mobile', this.state.profile.signerMobile);
    localStorage.setItem('ortek_signer_email', this.state.profile.signerEmail);
    localStorage.setItem('ortek_phs_email', this.state.profile.phsSignerEmail);
    localStorage.setItem('ortek_security_pin', this.state.profile.securityPin);
    localStorage.setItem('ortek_first_run_done', 'true');

    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({
        key: 'ortek_settings',
        data: {
          ortek_first_run_done: true,
          preparedBy: u.preparedBy,
          signerRole: this.state.profile.signerRole,
          signerMobile: this.state.profile.signerMobile,
          signerEmail: this.state.profile.signerEmail,
          phsEmail: this.state.profile.phsSignerEmail,
          sfCounter: this.state.salesForceCounter
        }
      });
    }

    if (this.headerUserName) this.headerUserName.textContent = u.preparedBy;
    if (this.sidebarPrepName) this.sidebarPrepName.value = u.preparedBy;
    if (this.sidebarPrepRole) this.sidebarPrepRole.value = this.state.profile.signerRole;
    if (this.sidebarPrepMobile) this.sidebarPrepMobile.value = this.state.profile.signerMobile;
    if (this.sidebarPrepEmail) this.sidebarPrepEmail.value = this.state.profile.signerEmail;

    if (this.settingPreparedBy) this.settingPreparedBy.value = u.preparedBy;
    if (this.settingSignerRole) this.settingSignerRole.value = this.state.profile.signerRole;
    if (this.settingSignerMobile) this.settingSignerMobile.value = this.state.profile.signerMobile;
    if (this.settingSignerEmail) this.settingSignerEmail.value = this.state.profile.signerEmail;
    if (this.settingPhsEmail) this.settingPhsEmail.value = this.state.profile.phsSignerEmail;
    if (this.settingSecurityPin) this.settingSecurityPin.value = this.state.profile.securityPin;

    if (this.userSwitchPinArea) this.userSwitchPinArea.style.display = 'none';
    this.pendingSwitchUser = null;

    this.updateUserPresence(true);
    this.checkValidityReminders();
    this.refreshTeamUsersList();
    this.render();
    this.modalProfile.classList.remove('active');

    this.showToast(`Hoş geldiniz ${u.preparedBy}! Aktif oturumunuz başarıyla açıldı.`, 'success');
  }

  saveProfileModal() {
    const prep = this.settingPreparedBy.value.trim();
    if (!prep) {
      this.showToast('Lütfen hazırlayan kişi adını giriniz.', 'error');
      return;
    }
    const role = this.settingSignerRole.value.trim() || 'Satış Mühendisi';
    const mobile = this.settingSignerMobile.value.trim() || '';
    const email = this.settingSignerEmail.value.trim() || '';
    const pEmail = this.settingPhsEmail ? (this.settingPhsEmail.value.trim() || 'satisdestek@phspompa.com') : 'satisdestek@phspompa.com';

    let newCounter = parseInt(this.settingSfCounter.value, 10);
    if (isNaN(newCounter) || newCounter < 1) newCounter = 1;

    const pin = this.settingSecurityPin ? (this.settingSecurityPin.value.trim() || '1234') : '1234';
    if (!/^\d{4}$/.test(pin)) {
      this.showToast('Güvenlik PIN kodu tam 4 haneli rakamlardan oluşmalıdır (Örn: 1234).', 'error');
      return;
    }

    if (this.state.profile.preparedBy && this.state.profile.preparedBy.trim().toLowerCase() !== prep.toLowerCase()) {
      this.updateUserPresence(false);
    }

    this.state.profile.preparedBy = prep;
    this.state.profile.signerRole = role;
    this.state.profile.signerMobile = mobile;
    this.state.profile.signerEmail = email;
    this.state.profile.phsSignerEmail = pEmail;
    this.state.profile.securityPin = pin;
    this.state.salesForceCounter = newCounter;
    this.state.baseSalesForceRef = this.formatSfRef(this.state.salesForceYear, newCounter);

    localStorage.setItem('ortek_prepared_by', prep);
    localStorage.setItem('ortek_signer_role', role);
    localStorage.setItem('ortek_signer_mobile', mobile);
    localStorage.setItem('ortek_signer_email', email);
    localStorage.setItem('ortek_phs_email', pEmail);
    localStorage.setItem('ortek_security_pin', pin);
    localStorage.setItem('ortek_sf_counter', newCounter.toString());
    localStorage.setItem('ortek_first_run_done', 'true');

    const key = this.normalizeUserKey(prep) || prep.toLowerCase();
    if (this.userFullProfiles) {
      Object.keys(this.userFullProfiles).forEach(k => {
        if (this.normalizeUserKey(k) === key) delete this.userFullProfiles[k];
      });
      this.userFullProfiles[key] = { preparedBy: prep, signerRole: role, signerMobile: mobile, signerEmail: email, phsEmail: pEmail, pin };
    }
    if (this.userPins) {
      Object.keys(this.userPins).forEach(k => {
        if (this.normalizeUserKey(k) === key) delete this.userPins[k];
      });
      this.userPins[key] = pin;
    }

    if (typeof db !== 'undefined' && db && prep) {
      db.collection('user_profiles').doc(prep).set({
        preparedBy: prep,
        signerRole: role,
        signerMobile: mobile,
        signerEmail: email,
        phsEmail: pEmail,
        pin,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(e => console.error(e));
    }

    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({
        key: 'ortek_settings',
        data: { ortek_first_run_done: true, preparedBy: prep, signerRole: role, signerMobile: mobile, signerEmail: email, phsEmail: pEmail, sfCounter: newCounter }
      });
    }

    // Sol panel alanlarını da senkronize et
    if (this.sidebarPrepName) this.sidebarPrepName.value = prep;
    if (this.sidebarPrepRole) this.sidebarPrepRole.value = role;
    if (this.sidebarPrepMobile) this.sidebarPrepMobile.value = mobile;
    if (this.sidebarPrepEmail) this.sidebarPrepEmail.value = email;

    if (this.headerUserName) this.headerUserName.textContent = prep;
    this.modalProfile.classList.remove('active');
    this.updateUserPresence(true);
    this.checkValidityReminders();
    this.refreshTeamUsersList();
    this.render();
    this.showToast('Profil ve oturum bilgileri güncellendi.', 'success');
  }

  // --------------------------------------------------------------------------
  // Teklif Geçmişi (History)
  // --------------------------------------------------------------------------
  getHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem('ortek_quotes_history') || '[]');
      if (Array.isArray(arr)) {
        arr.sort((a, b) => (b.sfRef || '').localeCompare(a.sfRef || '', undefined, { numeric: true }));
      }
      return arr;
    } catch {
      return [];
    }
  }

  restoreActiveDraft() {
    try {
      const raw = localStorage.getItem('ortek_active_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft) return;

      const hasCustomerInfo = draft.customer && (draft.customer.to || draft.customer.address || draft.customer.attention || draft.customer.subject);
      const hasItemsInfo = Array.isArray(draft.items) && draft.items.some(it => it.title || it.model || it.marka || it.guc || it.calismaAraligi);
      const hasPkgPrice = draft.isPackagePrice && draft.packagePrice;

      if (!hasCustomerInfo && !hasItemsInfo && !hasPkgPrice) return;

      if (draft.customer) this.state.customer = { ...this.state.customer, ...draft.customer };
      if (draft.dateISO) this.state.dateISO = draft.dateISO;
      if (draft.currency) this.state.currency = draft.currency;
      if (draft.remarksConfig) this.state.remarksConfig = { ...this.state.remarksConfig, ...draft.remarksConfig };
      if (Array.isArray(draft.items) && draft.items.length > 0) {
        this.state.items = draft.items;
        this.state.items.forEach(item => {
          if (item.unitType && item.unitType !== 'Adet' && item.unitType !== 'Metre') {
            item.unitType = item.isMeter ? 'Metre' : 'Adet';
          }
        });
      }
      if (draft.isPackagePrice !== undefined) this.state.isPackagePrice = !!draft.isPackagePrice;
      if (draft.packagePrice !== undefined) this.state.packagePrice = draft.packagePrice;
      if (draft.packageRowText !== undefined) this.state.packageRowText = draft.packageRowText;
      if (draft.packageTotalText !== undefined) this.state.packageTotalText = draft.packageTotalText;
      if (draft.isRevision !== undefined) {
        this.state.isRevision = draft.isRevision;
        this.state.revisionLevel = draft.revisionLevel || 0;
      }
      if (draft.hasInternalRef !== undefined) {
        this.state.hasInternalRef = draft.hasInternalRef;
        this.state.internalRef = draft.internalRef || '';
      }
      if (draft.activeCompany) this.state.activeCompany = draft.activeCompany;
      if (draft.language) this.state.language = draft.language;
    } catch (err) {
      console.warn('restoreActiveDraft uyarısı:', err);
    }
  }

  autoSaveDraft() {
    if (this._draftSaveTimer) clearTimeout(this._draftSaveTimer);
    this._draftSaveTimer = setTimeout(() => {
      try {
        const draftData = {
          dateISO: this.state.dateISO,
          salesForceCounter: this.state.salesForceCounter,
          salesForceYear: this.state.salesForceYear,
          baseSalesForceRef: this.state.baseSalesForceRef,
          isRevision: this.state.isRevision,
          revisionLevel: this.state.revisionLevel,
          hasInternalRef: this.state.hasInternalRef,
          internalRef: this.state.internalRef,
          customer: { ...this.state.customer },
          profile: { ...this.state.profile },
          currency: this.state.currency,
          remarksConfig: { ...this.state.remarksConfig },
          items: JSON.parse(JSON.stringify(this.state.items)),
          isPackagePrice: !!this.state.isPackagePrice,
          packagePrice: this.state.packagePrice || '',
          packageRowText: this.state.packageRowText || 'Proje Özel Fiyat',
          packageTotalText: this.state.packageTotalText || 'Proje Özel Fiyat',
          activeCompany: this.state.activeCompany,
          language: this.state.language,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem('ortek_active_draft', JSON.stringify(draftData));
        if (window.electronAPI && window.electronAPI.saveJson) {
          window.electronAPI.saveJson({ key: 'ortek_active_draft', data: draftData });
        }
      } catch (err) {
        console.warn('autoSaveDraft uyarısı:', err);
      }
    }, 350);
  }

  saveCurrentQuoteToHistory() {
    let history = (this.crmData && this.crmData.length > 0) ? this.crmData : this.getHistory();
    let sfRef = this.getComputedSfRef();
    const qRef = this.inputQuotationRef.value.trim();
    const date = this.formatDateForDisplay(this.state.dateISO);
    const { grandTotal } = this.calculateTotals();

    // 1. ÇAKIŞMA KONTROLÜ (Aynı anda teklif oluşturulduysa veya numara dolduysa)
    const existIdx = history.findIndex(h => h.sfRef === sfRef);
    let quoteId = (existIdx >= 0 && history[existIdx].id) ? history[existIdx].id : Date.now().toString();
    
    if (existIdx >= 0) {
      const existing = history[existIdx];
      const isExplicitEdit = (this.editingOriginalSfRef === sfRef);
      const isSameCustomer = existing.customer && existing.customer.to && this.state.customer && (existing.customer.to.trim().toLowerCase() === (this.state.customer.to || '').trim().toLowerCase());
      const isSameAuthor = (existing.preparedBy || '').trim().toLowerCase() === (this.state.profile.preparedBy || '').trim().toLowerCase();
      
      // Eğer bu numara başka biri tarafından kullanılmışsa VEYA farklı bir müşteriye aitse -> Kesinlikle ÇAKIŞMA!
      // (Kullanıcı bu teklifi 'Aç / Düzenle' diyerek yüklediyse çakışma sayılmaz, mevcut teklif güncellenir)
      if (!isExplicitEdit && (!isSameAuthor || !isSameCustomer)) {
        const nextAvail = this.getNextAvailableSfRef();
        const oldRef = sfRef;
        sfRef = nextAvail.sfRef;
        
        // State ve formu bir sonraki boş teklif numarasına güncelle
        this.state.salesForceCounter = nextAvail.counter;
        this.state.baseSalesForceRef = nextAvail.sfRef;
        this.inputSfRef.value = nextAvail.sfRef;
        if (this.settingSfCounter) this.settingSfCounter.value = nextAvail.counter + 1;
        localStorage.setItem('ortek_sf_counter', (nextAvail.counter + 1).toString());
        
        this.syncDateAndRef();
        this.renderPreview();
        
        const existingAuthorName = existing.preparedBy ? existing.preparedBy.trim() : 'farklı bir kullanıcı';
        this.showToast(
          `<div style="display:flex; align-items:flex-start; gap:10px; width:100%;">
            <div style="width:28px; height:28px; border-radius:50%; background:rgba(245,158,11,0.2); border:1px solid rgba(245,158,11,0.4); display:flex; align-items:center; justify-content:center; color:#fbbf24; flex-shrink:0; margin-top:2px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700; color:#fbbf24; font-size:0.86rem; margin-bottom:3px; letter-spacing:0.3px;">
                Teklif Numarası Çakışması Önlendi
              </div>
              <div style="font-size:0.82rem; color:#e2e8f0; line-height:1.45;">
                <strong style="color:#fbbf24;">${oldRef}</strong> numarası <strong>${this.escapeHtml(existingAuthorName)}</strong> tarafından kullanıldığı için teklifiniz otomatik olarak <strong style="color:#2ecc71; font-size:0.92rem;">${sfRef}</strong> olarak kaydedildi.
              </div>
            </div>
          </div>`,
          'warning',
          6500
        );
      }
    }

    const existingStatus = existIdx >= 0 && history[existIdx].status ? history[existIdx].status : 'Bekliyor';
    const existingContacted = existIdx >= 0 ? !!history[existIdx].contacted : false;
    const existingContactedAt = existIdx >= 0 ? (history[existIdx].contactedAt || null) : null;
    const existingContactedBy = existIdx >= 0 ? (history[existIdx].contactedBy || null) : null;
    const rawValDays = (this.inputRemarkValidityDays && this.inputRemarkValidityDays.value.trim()) 
      ? parseInt(this.inputRemarkValidityDays.value.trim(), 10) 
      : (parseInt(this.state.remarksConfig?.validityDays, 10) || 5);
    const validityDays = (!isNaN(rawValDays) && rawValDays > 0) ? rawValDays : 5;

    const quoteData = {
      id: quoteId,
      sfRef,
      qRef: this.inputQuotationRef.value.trim() || qRef,
      date,
      dateISO: this.state.dateISO,
      customer: { ...this.state.customer },
      items: JSON.parse(JSON.stringify(this.state.items)),
      remarksConfig: { ...this.state.remarksConfig },
      validityDays: validityDays,
      contacted: existingContacted,
      contactedAt: existingContactedAt,
      contactedBy: existingContactedBy,
      currency: this.state.currency,
      activeCompany: this.state.activeCompany,
      language: this.detectQuoteLanguage({
        customer: this.state.customer,
        items: this.state.items,
        remarksConfig: this.state.remarksConfig,
        language: this.state.language
      }),
      grandTotal: this.formatCurrency(grandTotal),
      isPackagePrice: !!this.state.isPackagePrice,
      packagePrice: this.state.packagePrice || '',
      packageRowText: this.state.packageRowText || 'Proje Özel Fiyat',
      packageTotalText: this.state.packageTotalText || 'Proje Özel Fiyat',
      savedAt: new Date().toLocaleString('tr-TR'),
      // CRM / Takip Alanları
      preparedBy: this.state.profile.preparedBy || 'Bilinmiyor',
      authorPin: this.state.profile.securityPin || '1234',
      signerMobile: this.state.profile.signerMobile || '',
      signerEmail: this.state.profile.signerEmail || '',
      endUser: this.state.customer.enduser || '-',
      industry: this.state.customer.industry || '-',
      productGroups: this.state.items.map(item => item.title).filter(Boolean).join(', ') || 'Belirtilmedi',
      status: existingStatus
    };

    const finalIdx = history.findIndex(h => h.sfRef === sfRef);
    if (finalIdx >= 0) {
      history[finalIdx] = quoteData;
    } else {
      history.unshift(quoteData);
      
      // Yeni bir teklif kaydedildiyse sayacı otomatik artır
      const savedNum = parseInt(sfRef.toString().replace(/[^0-9]/g, '').slice(-5), 10);
      if (!isNaN(savedNum)) {
        const nextCount = savedNum + 1;
        const currentCount = parseInt(localStorage.getItem('ortek_sf_counter') || '1', 10);
        if (nextCount > currentCount) {
          localStorage.setItem('ortek_sf_counter', nextCount.toString());
          this.state.salesForceCounter = nextCount;
          this.state.baseSalesForceRef = this.formatSfRef(this.state.salesForceYear, nextCount);
          if (this.settingSfCounter) this.settingSfCounter.value = nextCount;
          if (this.sfCounterBadge) this.sfCounterBadge.textContent = `Teklif #${nextCount}`;
        }
      }
    }

    history.sort((a, b) => (b.sfRef || '').localeCompare(a.sfRef || '', undefined, { numeric: true }));
    localStorage.setItem('ortek_quotes_history', JSON.stringify(history.slice(0, 100)));
    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history.slice(0, 100) });
    }
    this.editingOriginalSfRef = null;
    this.checkValidityReminders();
    
    // Cari / Müşteri Bilgisini Otomatik Kaydet / Güncelle
    this.saveCustomerFromQuote(quoteData.customer, sfRef, quoteData.date);
    
    // FIREBASE BULUTUNA GÖNDER (Senkronizasyon)
    if (db) {
      db.collection('quotes').doc(sfRef).set(quoteData)
        .then(() => {
          console.log('Teklif Firebase bulutuna kaydedildi: ', sfRef);
          db.collection('deleted_quotes').doc(sfRef).delete().catch(() => {});
        })
        .catch(err => console.error('Firebase Kayıt Hatası:', err));

      db.collection('deleted_quotes').doc(sfRef).delete().catch(() => {});
    }

    this.showToast(`Teklif hafızaya ve buluta kaydedildi: ${sfRef}`, 'success');
  }

  // --------------------------------------------------------------------------
  // CRM ve Analiz Fonksiyonları
  // --------------------------------------------------------------------------
  
  // --------------------------------------------------------------------------
  // Ekip / Bulut Canlı Eşzamanlama (Team Live Sync & Anti-Collision)
  // --------------------------------------------------------------------------
  initCloudSync() {
    if (typeof db === 'undefined' || !db) return;
    
    try {
      // 1. Kullanıcı profillerini buluttan canlı dinle
      db.collection('user_profiles').onSnapshot((snapshot) => {
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data && data.preparedBy) {
            const prepName = data.preparedBy.trim();
            const norm = this.normalizeUserKey(prepName);
            const prof = {
              preparedBy: prepName,
              signerRole: data.signerRole || 'Satış Mühendisi',
              signerMobile: data.signerMobile || '',
              signerEmail: data.signerEmail || '',
              phsEmail: data.phsEmail || 'satisdestek@phspompa.com',
              pin: data.pin ? data.pin.toString().trim() : '1234'
            };
            // Clean up any old duplicate variations in userFullProfiles and userPins
            Object.keys(this.userFullProfiles).forEach(existingKey => {
              if (this.normalizeUserKey(existingKey) === norm) {
                delete this.userFullProfiles[existingKey];
              }
            });
            Object.keys(this.userPins).forEach(existingKey => {
              if (this.normalizeUserKey(existingKey) === norm) {
                delete this.userPins[existingKey];
              }
            });

            this.userFullProfiles[norm] = prof;
            if (data.pin) {
              this.userPins[norm] = data.pin.toString().trim();
            }
          }
        });
        this.renderUserSwitchList();
        this.refreshTeamUsersList();
      }, (err) => console.warn('user_profiles sync error:', err));

      // Kendi profilimizi de Firestore'a yükle
      const myPrep = (this.state.profile.preparedBy || '').trim();
      const myPin = (this.state.profile.securityPin || '1234').trim();
      if (myPrep) {
        db.collection('user_profiles').doc(myPrep).set({
          preparedBy: myPrep,
          signerRole: this.state.profile.signerRole || '',
          signerMobile: this.state.profile.signerMobile || '',
          signerEmail: this.state.profile.signerEmail || '',
          phsEmail: this.state.profile.phsSignerEmail || 'satisdestek@phspompa.com',
          pin: myPin,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(e => console.warn('User PIN upload error:', e));
      }

      // 2. Silinen Teklifleri Canlı Takip Et (Tüm Bilgisayarlardan Anında Silinmesi İçin)
      const deletedRefs = new Set();
      db.collection('deleted_quotes').onSnapshot((snapshot) => {
        deletedRefs.clear();
        snapshot.forEach(doc => {
          deletedRefs.add(doc.id);
        });

        if (deletedRefs.size > 0) {
          let localData = this.getHistory();
          const initialLen = localData.length;
          // Bulutta veya CRM verisinde aktif olan (silinmemiş) teklifleri asla silme!
          localData = localData.filter(q => {
            if (this.crmData && this.crmData.some(c => c.sfRef === q.sfRef && !c.isDeleted)) {
              return true;
            }
            return !deletedRefs.has(q.sfRef);
          });
          if (localData.length !== initialLen) {
            localStorage.setItem('ortek_quotes_history', JSON.stringify(localData));
            if (window.electronAPI && window.electronAPI.saveJson) {
              window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: localData });
            }
            this.crmData = localData;
            if (this.modalHistory && this.modalHistory.classList.contains('active')) {
              this.openHistoryModal();
            }
            if (this.modalCrm && this.modalCrm.classList.contains('active')) {
              this.renderCrmTable();
            }
          }
        }
      }, (err) => console.warn('deleted_quotes sync error:', err));

      // 3. Teklifleri Canlı Eşitle
      db.collection('quotes').onSnapshot((snapshot) => {
        const cloudMap = new Map();
        
        snapshot.forEach(doc => {
          const cloudData = doc.data();
          if (cloudData && cloudData.sfRef) {
            if (cloudData.isDeleted) {
              deletedRefs.add(cloudData.sfRef);
            } else {
              // Eğer bu teklif önceden deletedRefs içindeyse (eski test kalıntısı), aktif teklif üstündür!
              if (deletedRefs.has(cloudData.sfRef)) {
                deletedRefs.delete(cloudData.sfRef);
                db.collection('deleted_quotes').doc(cloudData.sfRef).delete().catch(() => {});
              }
              cloudMap.set(cloudData.sfRef, cloudData);
            }
          }
        });
        
        // Yerel veriden silinen teklifleri arındır (ancak bulutta aktif olanları kesinlikle koru)
        let localData = this.getHistory().filter(q => {
          if (cloudMap.has(q.sfRef)) return true;
          return !deletedRefs.has(q.sfRef);
        });
        
        const mergedMap = new Map();
        localData.forEach(q => mergedMap.set(q.sfRef, q));
        cloudMap.forEach((v, k) => mergedMap.set(k, v));
        
        const mergedArray = Array.from(mergedMap.values());
        mergedArray.sort((a, b) => (b.sfRef || '').localeCompare(a.sfRef || '', undefined, { numeric: true }));
        
        localStorage.setItem('ortek_quotes_history', JSON.stringify(mergedArray));
        if (window.electronAPI && window.electronAPI.saveJson) {
          window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: mergedArray });
        }
        
        this.crmData = mergedArray;
        this.checkValidityReminders();
        
        // Eğer CRM açık ise tabloyu anlık güncelle
        if (this.modalCrm && this.modalCrm.classList.contains('active')) {
          this.renderCrmTable();
        }
        if (this.modalHistory && this.modalHistory.classList.contains('active')) {
          this.openHistoryModal();
        }
        
        // Ekipteki en yüksek sayaç numarasını hesaplayıp otomatik artır (Teklif No Çakışmasını Önler)
        this.autoSyncCounter(mergedArray);
        
        const statusBadge = document.getElementById('crm-cloud-status');
        if (statusBadge) {
          statusBadge.textContent = 'Canlı Bulut Senkronizasyonu Aktif';
          statusBadge.style.background = 'rgba(39, 174, 96, 0.15)';
          statusBadge.style.color = '#2ecc71';
          statusBadge.style.borderColor = 'rgba(39, 174, 96, 0.35)';
        }
      }, (err) => {
        console.warn('Firestore onSnapshot error:', err);
        const statusBadge = document.getElementById('crm-cloud-status');
        if (statusBadge) {
          statusBadge.textContent = 'Bulut Veritabanı Etkinleştirilmeli';
          statusBadge.style.background = 'rgba(231, 76, 60, 0.15)';
          statusBadge.style.color = '#e74c3c';
          statusBadge.style.borderColor = 'rgba(231, 76, 60, 0.35)';
        }
      });

      // 4. Kullanıcı Çevrimiçi Varlığı (Presence) Canlı Eşitleme
      this.initUserPresence();

      // 5. Gelen Bildirimleri (Notlar & Mesajlar) Canlı Dinle
      this.initNotificationsSync();

      // 6. Ekip İçi Canlı Sohbet Mesajlarını Dinle & 7 Günlük Temizlik
      this.initTeamMessagesSync();

      // 7. Cari / Müşteri Canlı Bulut Senkronizasyonu & Hasat
      this.initCustomersSync();
    } catch (e) {
      console.warn('Cloud sync init error:', e);
    }
  }

  getNextAvailableSfRef() {
    const history = (this.crmData && this.crmData.length > 0) ? this.crmData : this.getHistory();
    const currentYear = (this.state && this.state.salesForceYear) || new Date().getFullYear();
    let maxCounter = 5;
    if (Array.isArray(history)) {
      history.forEach(q => {
        if (q.sfRef) {
          const cleanRef = q.sfRef.toString().replace(/R\d+$/i, '');
          const yearPrefix = cleanRef.substring(0, 4);
          if (yearPrefix === currentYear.toString()) {
            const numPart = parseInt(cleanRef.substring(4), 10);
            if (!isNaN(numPart) && numPart > maxCounter) {
              maxCounter = numPart;
            }
          }
        }
      });
    }
    const nextCounter = maxCounter + 1;
    return {
      counter: nextCounter,
      sfRef: this.formatSfRef(currentYear, nextCounter)
    };
  }

  autoSyncCounter(quotes) {
    if (!quotes || quotes.length === 0) return;
    let maxCounter = 5;
    const currentYear = (this.state && this.state.salesForceYear) || new Date().getFullYear();
    if (Array.isArray(quotes)) {
      quotes.forEach(q => {
        if (q.sfRef) {
          const cleanRef = q.sfRef.toString().replace(/R\d+$/i, '');
          const yearPrefix = cleanRef.substring(0, 4);
          if (yearPrefix === currentYear.toString()) {
            const numPart = parseInt(cleanRef.substring(4), 10);
            if (!isNaN(numPart) && numPart > maxCounter) {
              maxCounter = numPart;
            }
          }
        }
      });
    }
    
    const nextCounter = maxCounter + 1;
    const currentCounter = parseInt(localStorage.getItem('ortek_sf_counter') || '1', 10);
    if (nextCounter !== currentCounter) {
      localStorage.setItem('ortek_sf_counter', nextCounter.toString());
      if (this.state) {
        this.state.salesForceCounter = nextCounter;
        this.state.baseSalesForceRef = this.formatSfRef(currentYear, nextCounter);
      }
      if (this.settingSfCounter) this.settingSfCounter.value = nextCounter;
      if (this.sfCounterBadge) this.sfCounterBadge.textContent = `Teklif #${nextCounter}`;
      
      // Eğer kullanıcı şu an revizyon modunda değilse ve yeni teklif hazırlıyorsa numarayı otomatik güncelle
      if (this.inputSfRef && (!this.state || !this.state.isRevision || this.state.revisionLevel === 0)) {
        this.inputSfRef.value = (this.state && this.state.baseSalesForceRef) || this.formatSfRef(currentYear, nextCounter);
        if (this.syncDateAndRef) this.syncDateAndRef();
        if (this.renderPreview) this.renderPreview();
      }
    }
  }

  openCrmModal() {
    this.modalCrm.classList.add('active');
    this.crmTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Buluttan veriler çekiliyor, lütfen bekleyin...</td></tr>';
    this.fetchCrmFromCloud();
  }

  fetchCrmFromCloud() {
    if (!db) {
      this.crmData = this.getHistory();
      this.renderCrmTable();
      return;
    }
    db.collection('quotes').get().then((snapshot) => {
      const localData = this.getHistory();
      const mergedMap = new Map();
      localData.forEach(q => mergedMap.set(q.sfRef, q));
      snapshot.forEach(doc => {
        const cloudData = doc.data();
        if (cloudData && cloudData.sfRef) {
          mergedMap.set(cloudData.sfRef, cloudData); // Bulut verisi günceldir
        }
      });
      const mergedArray = Array.from(mergedMap.values());
      mergedArray.sort((a, b) => (b.sfRef || '').localeCompare(a.sfRef || '', undefined, { numeric: true }));
      this.crmData = mergedArray;

      // Lokal hafıza ve JSON dosyasını senkronize et
      localStorage.setItem('ortek_quotes_history', JSON.stringify(mergedArray));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: mergedArray });
      }

      this.renderCrmTable();
    }).catch(err => {
      console.warn("CRM fetch err:", err);
      this.crmData = this.getHistory();
      this.renderCrmTable();
    });
  }

  renderCrmTable() {
    if (!this.crmData) return;
    this.crmData.sort((a, b) => (b.sfRef || '').localeCompare(a.sfRef || '', undefined, { numeric: true }));
    
    const filterCompany = this.crmFilterCompany.value;
    const filterStatus = this.crmFilterStatus.value;
    const filterPreparedBy = this.crmFilterPreparedBy.value;
    const searchVal = (this.crmSearchInput.value || '').toLowerCase().trim();
    
    // Dinamik Hazırlayan (PreparedBy) Listesi Oluştur ve Seçimi Koru
    const currentPreparedSelection = this.crmFilterPreparedBy.value || 'all';
    const uniquePreps = [...new Set(this.crmData.map(item => item.preparedBy))].filter(Boolean);
    const existingOptions = Array.from(this.crmFilterPreparedBy.options).map(o => o.value).join(',');
    const newOptionsList = ['all', ...uniquePreps].join(',');
    if (existingOptions !== newOptionsList) {
      let prepOptions = '<option value="all">Tüm Ekip</option>';
      uniquePreps.forEach(prep => {
        prepOptions += `<option value="${prep}">${prep}</option>`;
      });
      this.crmFilterPreparedBy.innerHTML = prepOptions;
      if (uniquePreps.includes(currentPreparedSelection) || currentPreparedSelection === 'all') {
        this.crmFilterPreparedBy.value = currentPreparedSelection;
      }
    }

    let totalCount = 0;
    let pendingCount = 0;
    let wonEur = 0;
    let wonUsd = 0;
    let wonTry = 0;

    let html = '';
    
    this.crmData.forEach((item) => {
      const isApproved = item.status === 'Onaylandı' || item.status === 'Onaylandıı' || (item.status && item.status.startsWith('Onaylan'));
      const isRejected = item.status === 'Reddedildi' || (item.status && item.status.startsWith('Red'));
      const isPending = !isApproved && !isRejected;

      // 1. Üst Kartlar ve Metrikler için Filtreleme (Seçilen Kişi / Firma / Arama)
      if (filterCompany !== 'all' && item.activeCompany !== filterCompany) return;
      if (filterPreparedBy !== 'all' && item.preparedBy !== filterPreparedBy) return;
      if (searchVal) {
        const textToSearch = `${item.customer?.to || ''} ${item.sfRef || ''} ${item.industry || ''} ${item.productGroups || ''} ${item.preparedBy || ''}`.toLowerCase();
        if (!textToSearch.includes(searchVal)) return;
      }

      totalCount++;
      if (isPending) pendingCount++;
      if (isApproved) {
        const gT = String(item.grandTotal || "");
        // Binlik ayırıcı noktaları temizleyip virgülü noktaya çevir (Örn: 3.800,00 -> 3800.00)
        const cleanNumStr = gT.replace(/[^0-9,-]+/g, "").replace(/\./g, "").replace(",", ".");
        const val = parseFloat(cleanNumStr);
        const cCurr = (item.currency || "").toUpperCase();
        if (!isNaN(val) && val > 0) {
          if (gT.includes("USD") || gT.includes("$") || cCurr.includes("USD") || cCurr.includes("DOLAR")) {
            wonUsd += val;
          } else if (gT.includes("EUR") || gT.includes("€") || cCurr.includes("EUR") || cCurr.includes("EURO")) {
            wonEur += val;
          } else {
            wonTry += val;
          }
        }
      }

      // 2. Tablo Satırları için Durum Filtresi (Bekleyen / Onaylanan / Reddedilen)
      if (filterStatus !== 'all') {
        if (filterStatus.startsWith('Onaylan') && !isApproved) return;
        if (filterStatus.startsWith('Red') && !isRejected) return;
        if (filterStatus === 'Bekliyor' && !isPending) return;
      }

      const statusColor = isApproved ? '#27ae60' : (isRejected ? '#e74c3c' : '#f39c12');
      const currentStatusVal = isApproved ? 'Onaylandı' : (isRejected ? 'Reddedildi' : 'Bekliyor');
      
      let displayTotal = item.grandTotal || '0,00';
      if (!displayTotal.includes("€") && !displayTotal.includes("$") && !displayTotal.includes("EUR") && !displayTotal.includes("USD") && !displayTotal.includes("TL") && !displayTotal.includes("₺")) {
        if (item.currency === "EUR") displayTotal = "€ " + displayTotal;
        else if (item.currency === "USD") displayTotal = "$ " + displayTotal;
        else if (item.currency === "TRY" || item.currency === "TL") displayTotal = "₺ " + displayTotal;
      }

      html += `
        <tr style="border-bottom: 1px solid #333; background: #2A2A2D;">
          <td style="padding: 8px 6px; font-size: 0.78rem; white-space: nowrap;">${item.date || ''}</td>
          <td style="padding: 8px 6px; text-align: center;">
            <span style="background: #333; padding: 2px 5px; border-radius: 4px; font-size: 0.72rem; text-transform: uppercase;">
              ${item.activeCompany || 'ortek'}
            </span>
          </td>
          <td style="padding: 8px 6px; font-weight: bold; color: var(--accent-emerald); font-size: 0.82rem; white-space: nowrap;">${item.sfRef || ''}</td>
          <td style="padding: 8px 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
              <div style="font-weight: 600; font-size: 0.85rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(item.customer?.to || '')}">${item.customer?.to || 'İsimsiz Müşteri'}</div>
              ${(() => {
                const exp = this.calculateQuoteExpiry(item);
                if (item.contacted) {
                  return `<span class="badge-contacted-done" title="İletişime Geçildi: ${item.contactedBy || ''} (${item.contactedAt ? new Date(item.contactedAt).toLocaleDateString('tr-TR') : ''})">✓ İletişime Geçildi</span>`;
                } else if (exp && exp.isOverdue && isPending) {
                  return `<span class="badge-overdue-pending" title="Geçerlilik Bitiş: ${exp.expiryDateStr} (${exp.valDays} Gün)">⏰ Süre Doldu (${exp.expiryDateStr})</span>`;
                } else if (exp) {
                  return `<span style="font-size: 0.7rem; color: #888;">Geçerlilik: ${exp.expiryDateStr}</span>`;
                }
                return '';
              })()}
            </div>
            <div style="font-size: 0.72rem; color: #aaa;">${(item.customer?.taxOffice || item.customer?.taxNumber) ? `<span style="color: #10b981; font-weight: 500;">🏛️ ${this.escapeHtml(item.customer.taxOffice || '')} ${item.customer.taxNumber ? '(' + this.escapeHtml(item.customer.taxNumber) + ')' : ''}</span> &bull; ` : ''}Sektör: ${item.industry || '-'} &bull; <span style="color: #bbb;">${item.preparedBy || '-'}</span></div>
          </td>
          <td style="padding: 8px 6px; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(item.productGroups || '')}">
            ${item.productGroups || '-'}
          </td>
          <td style="padding: 8px 6px; font-weight: 600; font-size: 0.82rem; white-space: nowrap;">
            ${displayTotal}
          </td>
          <td style="padding: 8px 6px; text-align: center;">
            <button type="button" class="btn btn-sm" style="background: ${item.notes && item.notes.length > 0 ? 'rgba(0, 180, 216, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px ${item.notes && item.notes.length > 0 ? 'solid rgba(0, 180, 216, 0.4)' : 'dashed rgba(255, 255, 255, 0.2)'}; color: ${item.notes && item.notes.length > 0 ? 'var(--accent-cyan)' : '#888'}; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 5px; cursor: pointer; white-space: nowrap;" onclick="window.app.openCrmNotesModal('${item.sfRef}')" title="${item.notes && item.notes.length > 0 ? this.escapeHtml(item.notes[item.notes.length - 1].text) : 'Görüşme Notu Ekle'}">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>${item.notes && item.notes.length > 0 ? item.notes.length + ' Not' : '+ Not'}</span>
            </button>
          </td>
          <td style="padding: 8px 6px; text-align: center;">
            <select class="form-control" style="width: 100%; font-size: 0.75rem; padding: 3px 4px; border-color: ${statusColor}; color: ${statusColor};" onchange="window.app.updateCrmStatus('${item.sfRef}', this.value)">
              <option value="Bekliyor" ${currentStatusVal === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
              <option value="Onaylandı" ${currentStatusVal === 'Onaylandı' ? 'selected' : ''}>Onaylandı</option>
              <option value="Reddedildi" ${currentStatusVal === 'Reddedildi' ? 'selected' : ''}>Reddedildi</option>
            </select>
          </td>
        </tr>
      `;
    });

    if (totalCount === 0) {
      html = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Filtrelere uygun kayıt bulunamadı.</td></tr>';
    }

    this.crmTableBody.innerHTML = html;
    if (this.crmTotalCount) this.crmTotalCount.textContent = totalCount;
    if (this.crmPendingCount) this.crmPendingCount.textContent = pendingCount;
    if (this.crmWonEur) this.crmWonEur.textContent = '€ ' + wonEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (this.crmWonUsd) this.crmWonUsd.textContent = '$ ' + wonUsd.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (this.crmWonTry) this.crmWonTry.textContent = '₺ ' + wonTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --------------------------------------------------------------------------
  // Bildirim Merkezi (Notification Center) Metotları
  // --------------------------------------------------------------------------
  initNotificationsSync() {
    if (typeof db === 'undefined' || !db) return;
    const myCurrentName = (this.state.profile.preparedBy || '').trim().toLowerCase();
    db.collection('notifications').onSnapshot((snapshot) => {
      const myNotifs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data && data.targetUser && data.targetUser.trim().toLowerCase() === myCurrentName) {
          myNotifs.push({ ...data, id: doc.id });
        }
      });
      myNotifs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.handleIncomingNotifications(myNotifs);
    }, (err) => console.warn('notifications sync error:', err));
  }

  handleIncomingNotifications(notifs) {
    this.userNotifications = notifs || [];
    this.checkValidityReminders();

    // Yeni gelen okunmamış bildirim varsa sağ altta Windows tarzı bildirim kutusu göster
    const newestNotif = this.userNotifications[0];
    if (newestNotif && !newestNotif.read && (newestNotif.timestamp || 0) > this.lastKnownNotifTime) {
      this.lastKnownNotifTime = newestNotif.timestamp || Date.now();
      localStorage.setItem('ortek_last_notif_time', this.lastKnownNotifTime.toString());
      
      // Eğer sohbet açık ve o kullanıcıyla görüşüyorsak toast gösterme, direkt oku:
      if (newestNotif.type === 'chat_message' && 
          this.modalTeamChat && 
          this.modalTeamChat.classList.contains('active') && 
          this.teamChatPartner && 
          this.teamChatPartner.trim().toLowerCase() === (newestNotif.sender || '').trim().toLowerCase()) {
        this.markNotificationAsRead(newestNotif.id);
      } else {
        this.showFloatingDesktopNotification(newestNotif);
      }
    }

    if (this.notifDropdown && this.notifDropdown.style.display === 'flex') {
      this.renderNotificationsDropdown();
    }
  }

  showFloatingDesktopNotification(notif) {
    if (!this.floatingNotifContainer) return;
    const isChat = notif.type === 'chat_message';

    // Sistem yerel bildirimi (Windows Bildirim Merkezi)
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          const nativeNotif = new Notification(isChat ? `${notif.sender} mesaj gönderdi` : `${notif.sender} bir not ekledi`, {
            body: isChat ? `"${notif.messageText}"` : `${notif.customer || notif.sfRef}: "${notif.noteText}"`,
            icon: 'assets/notif-dual-logo.png'
          });
          nativeNotif.onclick = () => {
            if (isChat) {
              this.openTeamChat();
            } else if (notif.sfRef) {
              this.openCrmNotesModal(notif.sfRef);
            }
          };
        } catch (e) {
          console.warn('Native notification error:', e);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    // Program İçi Sağ Alt Windows Tarzı Kutu
    const initials = (notif.sender || 'EK')
      .split(' ')
      .filter(w => w.length > 0)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');

    const card = document.createElement('div');
    card.className = 'floating-desktop-notif';
    card.innerHTML = `
      <div class="floating-notif-top">
        <div class="floating-notif-app-info">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${isChat ? '#00d2ff' : 'var(--accent-cyan)'}" stroke-width="2.2">
            ${isChat ? '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' : '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'}
          </svg>
          <span>${isChat ? 'Teklif Programı • Canlı Mesaj' : 'Teklif Programı • Görüşme Notu'}</span>
        </div>
        <button type="button" class="floating-notif-close" title="Kapat">&times;</button>
      </div>
      <div class="floating-notif-body">
        <div class="floating-notif-avatar" style="${isChat ? 'background: linear-gradient(135deg, #0072ff, #00d2ff);' : ''}">${initials}</div>
        <div class="floating-notif-content">
          <div class="floating-notif-title">${this.escapeHtml(notif.sender)} ${isChat ? 'mesaj gönderdi' : 'not bıraktı'}</div>
          <div class="floating-notif-sub">${isChat ? '💬 Canlı Sohbet' : (this.escapeHtml(notif.sfRef || '') + ' • ' + this.escapeHtml(notif.customer || ''))}</div>
          <div class="floating-notif-text">"${this.escapeHtml(isChat ? notif.messageText : notif.noteText)}"</div>
        </div>
      </div>
    `;

    const closeBtn = card.querySelector('.floating-notif-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      card.remove();
    });

    card.addEventListener('click', () => {
      this.markNotificationAsRead(notif.id);
      card.remove();
      if (isChat) {
        this.openTeamChat(notif.sender);
      } else {
        this.openCrmNotesModal(notif.sfRef);
      }
    });

    this.floatingNotifContainer.appendChild(card);

    // 10 saniye sonra otomatik kaybolsun
    setTimeout(() => {
      if (card && card.parentNode) card.remove();
    }, 10000);
  }

  calculateQuoteExpiry(quote) {
    if (!quote) return null;

    let baseDate = null;
    if (quote.dateISO && typeof quote.dateISO === 'string' && quote.dateISO.includes('-')) {
      const parts = quote.dateISO.split('-');
      if (parts.length === 3) {
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    if (!baseDate || isNaN(baseDate.getTime())) {
      if (quote.date && typeof quote.date === 'string' && quote.date.includes('.')) {
        const parts = quote.date.split('.');
        if (parts.length === 3) {
          baseDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      }
    }
    if (!baseDate || isNaN(baseDate.getTime())) return null;

    let valDays = 5;
    if (quote.remarksConfig && quote.remarksConfig.validityDays) {
      const parsed = parseInt(quote.remarksConfig.validityDays, 10);
      if (!isNaN(parsed) && parsed > 0) valDays = parsed;
    } else if (quote.validityDays) {
      const parsed = parseInt(quote.validityDays, 10);
      if (!isNaN(parsed) && parsed > 0) valDays = parsed;
    }

    const expiry = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + valDays);
    expiry.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isOverdue = today.getTime() >= expiry.getTime();
    const expiryDateStr = ('0' + expiry.getDate()).slice(-2) + '.' + ('0' + (expiry.getMonth() + 1)).slice(-2) + '.' + expiry.getFullYear();
    const diffDays = Math.floor((today.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24));

    return {
      baseDate,
      expiryDate: expiry,
      expiryDateStr,
      valDays,
      isOverdue,
      diffDays
    };
  }

  checkValidityReminders() {
    const quotes = this.crmData || this.getHistory() || [];
    const overdueList = [];

    // İsim normalizasyonu (Türkçe karakter ve boşluk duyarsız eşleştirme)
    const normalizeAuthorName = (str) => {
      if (!str) return '';
      return str
        .trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, ' ');
    };

    const currentAuthorNorm = normalizeAuthorName(this.state.profile.preparedBy || '');

    quotes.forEach(quote => {
      // 1. Sadece teklifi hazırlayan aktif kullanıcıya ait hatırlatmaları filtrele
      const rawAuthor = quote.preparedBy || quote.author || (quote.profile && quote.profile.preparedBy) || '';
      const quoteAuthorNorm = normalizeAuthorName(rawAuthor);

      // Eğer teklifin hazırlayanı varsa ve aktif kullanıcı ile uyuşmuyorsa bu teklifi atla (Fatih'in teklifleri Melih'e, Melih'in teklifleri Fatih'e gözükmez)
      if (currentAuthorNorm && quoteAuthorNorm && quoteAuthorNorm !== currentAuthorNorm) {
        return;
      }

      // Sadece onaylanmamış/reddedilmemiş ve henüz iletişime geçilmemiş teklifleri kontrol et
      const isApproved = quote.status === 'Onaylandı' || (quote.status && quote.status.startsWith('Onaylan'));
      const isRejected = quote.status === 'Reddedildi' || (quote.status && quote.status.startsWith('Red'));
      if (isApproved || isRejected) return;
      if (quote.contacted) return;

      const expiryInfo = this.calculateQuoteExpiry(quote);
      if (expiryInfo && expiryInfo.isOverdue) {
        overdueList.push({
          quote,
          ...expiryInfo
        });
      }
    });

    // En çok gecikenler en üstte olacak şekilde sırala
    overdueList.sort((a, b) => b.diffDays - a.diffDays);
    this.validityReminders = overdueList;

    // 1. Ana Ekran Uyarı Bandını Güncelle
    if (this.expiryBanner && this.expiryBannerCount) {
      if (overdueList.length > 0 && !this.isExpiryBannerDismissed) {
        this.expiryBannerCount.textContent = `${overdueList.length} Teklifinizin`;
        this.expiryBanner.style.display = 'block';
      } else {
        this.expiryBanner.style.display = 'none';
      }
    }

    // 2. Bildirim Çan Rozetini Güncelle (Okunmamış bildirimler + İletişim bekleyen hatırlatmalar)
    const unreadUserNotifs = (this.userNotifications || []).filter(n => !n.read).length;
    const totalBadges = unreadUserNotifs + overdueList.length;

    if (this.notifBadge) {
      if (totalBadges > 0) {
        this.notifBadge.textContent = totalBadges > 9 ? '9+' : totalBadges;
        this.notifBadge.style.display = 'flex';
      } else {
        this.notifBadge.style.display = 'none';
      }
    }

    // 3. Bildirim paneli açıksa listeyi yeniden çiz
    if (this.notifDropdown && this.notifDropdown.style.display === 'flex') {
      this.renderNotificationsDropdown();
    }
    // 4. Geçerlilik hatırlatmaları modalı açıksa listeyi güncelle
    if (this.modalExpiryReminders && this.modalExpiryReminders.classList.contains('active')) {
      this.renderExpiryModalList();
    }
  }

  toggleQuoteContacted(sfRef, isContacted) {
    if (!sfRef) return;
    const currentAuthor = (this.state.profile.preparedBy || 'Melih Kurtgün').trim();
    const nowISO = new Date().toISOString();

    // 1. CRM Data güncelle
    if (this.crmData) {
      const q = this.crmData.find(x => x.sfRef === sfRef);
      if (q) {
        q.contacted = !!isContacted;
        q.contactedAt = isContacted ? nowISO : null;
        q.contactedBy = isContacted ? currentAuthor : null;
      }
    }

    // 2. History güncelle
    const history = this.getHistory();
    const hIdx = history.findIndex(x => x.sfRef === sfRef);
    if (hIdx >= 0) {
      history[hIdx].contacted = !!isContacted;
      history[hIdx].contactedAt = isContacted ? nowISO : null;
      history[hIdx].contactedBy = isContacted ? currentAuthor : null;
      localStorage.setItem('ortek_quotes_history', JSON.stringify(history));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history });
      }
    }

    // 3. Bulutta güncelle
    if (typeof db !== 'undefined' && db) {
      db.collection('quotes').doc(sfRef).set({
        contacted: !!isContacted,
        contactedAt: isContacted ? nowISO : null,
        contactedBy: isContacted ? currentAuthor : null
      }, { merge: true })
        .then(() => console.log('İletişim durumu buluta kaydedildi:', sfRef, isContacted))
        .catch(err => console.error('İletişim durumu buluta kaydedilemedi:', err));
    }

    // 4. Hatırlatmaları ve sayaçları anında güncelle
    this.checkValidityReminders();

    if (this.modalCrm && this.modalCrm.classList.contains('active')) {
      this.renderCrmTable();
    }

    if (isContacted) {
      this.showToast(`${sfRef}: Müşteriyle iletişime geçildi olarak kaydedildi.`, 'success');
    } else {
      this.showToast(`${sfRef}: İletişime geçildi işareti kaldırıldı, hatırlatmalara geri alındı.`, 'info');
    }
  }

  loadQuoteToEditor(sfRef) {
    if (!sfRef) return;
    const history = this.crmData || this.getHistory() || [];
    const quote = history.find(q => q.sfRef === sfRef);
    if (quote) {
      this.loadQuoteFromHistory(quote);
      if (this.notifDropdown) this.notifDropdown.style.display = 'none';
      if (this.modalCrm) this.modalCrm.classList.remove('active');
      if (this.modalExpiryReminders) this.modalExpiryReminders.classList.remove('active');
      this.showToast(`${sfRef} numaralı teklif düzenlenmek üzere yüklendi.`, 'info');
    }
  }

  openExpiryRemindersModal() {
    if (!this.modalExpiryReminders) return;
    this.renderExpiryModalList();
    this.modalExpiryReminders.classList.add('active');
  }

  closeExpiryRemindersModal() {
    if (!this.modalExpiryReminders) return;
    this.modalExpiryReminders.classList.remove('active');
  }

  renderExpiryModalList() {
    if (!this.expiryModalList) return;
    const reminders = this.validityReminders || [];

    const activeUserName = (this.state.profile.preparedBy || 'Kullanıcı').trim();
    if (this.expiryModalSubtitle) {
      if (reminders.length > 0) {
        this.expiryModalSubtitle.innerHTML = `<span style="color: #fbbf24; font-weight: 700;">${reminders.length} adet teklifinizin</span> geçerlilik süresi dolmuştur (${this.escapeHtml(activeUserName)}). Müşterilerinizle iletişime geçildiğinde aşağıdaki kutucuğu işaretleyebilirsiniz.`;
      } else {
        this.expiryModalSubtitle.textContent = `${activeUserName} adına bekleyen geçerlilik hatırlatması bulunmuyor.`;
      }
    }

    if (reminders.length === 0) {
      this.expiryModalList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #a0aec0;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(39, 174, 96, 0.15); border: 1px solid rgba(39, 174, 96, 0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px auto; color: #2ecc71;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 6px;">
            Harika! Bekleyen Hatırlatma Yok
          </div>
          <div style="font-size: 0.84rem; color: #888; max-width: 420px; margin: 0 auto;">
            Süresi dolup da müşteriyle henüz iletişime geçilmemiş herhangi bir teklifiniz bulunmuyor.
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    reminders.forEach(r => {
      const q = r.quote;
      const customerName = q.customer?.to || 'İsimsiz Müşteri';
      const author = q.profile?.preparedBy || q.author || 'Belirtilmedi';
      const totalAmount = q.grandTotal || '-';
      const delayText = r.diffDays === 0 ? 'Süre bugün doldu' : `${r.diffDays} gün önce doldu`;

      html += `
        <div style="background: #252528; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.2s;" onmouseover="this.style.borderColor='rgba(245, 158, 11, 0.7)'" onmouseout="this.style.borderColor='rgba(245, 158, 11, 0.35)'">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: #fbbf24; font-weight: 800; font-size: 1rem; font-family: monospace; letter-spacing: 0.5px;">
                ${this.escapeHtml(q.sfRef)}
              </span>
              <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 12px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-weight: 600;">
                ${delayText}
              </span>
            </div>
            <div style="font-size: 0.78rem; color: #a0aec0;">
              Teklif Tarihi: <strong style="color: #fff;">${this.escapeHtml(q.date || '-')}</strong>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;">
            <div>
              <div style="font-size: 0.92rem; font-weight: 700; color: #fff; margin-bottom: 3px;">
                ${this.escapeHtml(customerName)}
              </div>
              <div style="font-size: 0.78rem; color: #888; display: flex; gap: 14px; flex-wrap: wrap;">
                <span>Hazırlayan: <strong style="color: #00d2ff;">${this.escapeHtml(author)}</strong></span>
                <span>Geçerlilik: <strong style="color: #fbbf24;">${r.valDays} Gün</strong> (Son: ${r.expiryDateStr})</span>
                <span>Tutar: <strong style="color: #2ecc71;">${this.escapeHtml(totalAmount)}</strong></span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" class="btn btn-sm btn-dark" style="font-size: 0.78rem; padding: 6px 12px; display: flex; align-items: center; gap: 5px; border: 1px solid rgba(255,255,255,0.15);" onclick="window.app.loadQuoteToEditor('${this.escapeHtml(q.sfRef)}')">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Teklifi Aç
              </button>
            </div>
          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; display: flex; justify-content: flex-end;">
            <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 600; color: #2ecc71; cursor: pointer; background: rgba(39, 174, 96, 0.1); border: 1px solid rgba(39, 174, 96, 0.35); padding: 5px 12px; border-radius: 6px; user-select: none;">
              <input type="checkbox" style="accent-color: #2ecc71; cursor: pointer; width: 16px; height: 16px;" onchange="window.app.toggleQuoteContacted('${this.escapeHtml(q.sfRef)}', this.checked)">
              <span>Müşteriyle İletişime Geçildi</span>
            </label>
          </div>
        </div>
      `;
    });

    this.expiryModalList.innerHTML = html;
  }

  toggleNotificationsDropdown(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.notifDropdown) {
      this.notifDropdown = document.getElementById('notifications-dropdown');
    }
    if (!this.notifDropdown) return;
    const isVisible = (this.notifDropdown.style.display === 'flex' || this.notifDropdown.classList.contains('active'));
    if (isVisible) {
      this.notifDropdown.style.display = 'none';
      this.notifDropdown.classList.remove('active');
    } else {
      this.notifDropdown.style.display = 'flex';
      this.notifDropdown.classList.add('active');
      this.renderNotificationsDropdown();
    }
  }

  renderNotificationsDropdown() {
    try {
      if (!this.notifItemsList) {
        this.notifItemsList = document.getElementById('notif-items-list');
      }
      if (!this.notifItemsList) return;

      const reminders = this.validityReminders || [];
      const notifs = this.userNotifications || [];

      if (reminders.length === 0 && notifs.length === 0) {
        this.notifItemsList.innerHTML = `
          <div class="notif-empty" style="padding: 24px 16px; text-align: center; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--text-dim)" stroke-width="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span>Henüz yeni bir bildirim veya hatırlatmanız bulunmuyor.</span>
          </div>
        `;
        return;
      }

      let html = '';

      // A. ÖNCELİKLİ BÖLÜM: Geçerlilik Süresi Dolan Teklif Hatırlatmaları
      if (reminders.length > 0) {
        reminders.forEach(r => {
          if (!r) return;
          const q = r.quote || {};
          const customerName = (q.customer && q.customer.to) ? q.customer.to : 'İsimsiz Müşteri';
          const delayText = r.diffDays === 0 ? 'Süre bugün doldu' : `${r.diffDays || 0} gün önce doldu`;
          const sfRef = q.sfRef || r.sfRef || 'REF-YOK';
          const grandTotal = q.grandTotal !== undefined && q.grandTotal !== null ? q.grandTotal : '-';
          const valDays = r.valDays || 15;
          const expiryDateStr = r.expiryDateStr || '-';

          html += `
            <div class="notif-item reminder unread" data-sfref="${this.escapeHtml(sfRef)}">
              <div class="notif-avatar" style="background: linear-gradient(135deg, #d97706, #f59e0b); box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div class="notif-content">
                <div class="notif-meta">
                  <span class="notif-author" style="color: #fbbf24; font-weight: 800;">
                    ${this.escapeHtml(sfRef)}
                  </span>
                  <span class="notif-time" style="color: #fbbf24; font-weight: 600;">${delayText}</span>
                </div>
                <div class="notif-ref-tag" style="color: #e2e8f0; font-weight: 600;">
                  ${this.escapeHtml(customerName)} • Toplam: ${this.escapeHtml(grandTotal)}
                </div>
                <div class="notif-text" style="color: #cbd5e1; font-size: 0.77rem;">
                  Geçerlilik süresi (${valDays} Gün) doldu. Son geçerlilik: <strong>${this.escapeHtml(expiryDateStr)}</strong>
                </div>
                <div class="notif-contacted-container">
                  <label class="notif-contacted-label" onclick="event.stopPropagation()">
                    <input type="checkbox" onchange="window.app.toggleQuoteContacted('${this.escapeHtml(sfRef)}', this.checked)">
                    <span>Müşteriyle İletişime Geçildi</span>
                  </label>
                  <button type="button" class="btn btn-sm btn-dark" style="font-size: 0.72rem; padding: 2px 8px;" onclick="event.stopPropagation(); window.app.loadQuoteToEditor('${this.escapeHtml(sfRef)}')">
                    Teklifi Aç
                  </button>
                </div>
              </div>
            </div>
          `;
        });
      }

      // B. DİĞER BİLDİRİMLER: Mesajlar & Görüşme Notları
      notifs.forEach(notif => {
        if (!notif) return;
        const isChat = notif.type === 'chat_message';
        const sender = notif.sender || 'Ekip Üyesi';
        const initials = sender
          .split(' ')
          .filter(w => w.length > 0)
          .slice(0, 2)
          .map(w => w[0].toUpperCase())
          .join('') || 'EK';

        const textContent = isChat ? (notif.messageText || '') : (notif.noteText || '');

        html += `
          <div class="notif-item ${notif.read ? 'read' : 'unread'}" data-id="${notif.id || ''}" data-type="${isChat ? 'chat' : 'note'}" data-ref="${notif.sfRef || ''}" data-sender="${this.escapeHtml(sender)}">
            <div class="notif-avatar" style="${isChat ? 'background: linear-gradient(135deg, #0072ff, #00d2ff);' : ''}">${initials}</div>
            <div class="notif-content">
              <div class="notif-meta">
                <span class="notif-author">${this.escapeHtml(sender)}</span>
                <span class="notif-time">${this.escapeHtml(notif.createdAt || '')}</span>
              </div>
              <div class="notif-ref-tag" style="${isChat ? 'color: #00d2ff;' : ''}">${isChat ? '💬 Canlı Sohbet Mesajı' : (this.escapeHtml(notif.sfRef || '') + ' • ' + this.escapeHtml(notif.customer || ''))}</div>
              <div class="notif-text">"${this.escapeHtml(textContent)}"</div>
            </div>
          </div>
        `;
      });

      this.notifItemsList.innerHTML = html;

      // Normal bildirim öğelerine tıklama dinleyicisi
      this.notifItemsList.querySelectorAll('.notif-item:not(.reminder)').forEach(item => {
        item.addEventListener('click', () => {
          const notifId = item.dataset.id;
          const type = item.dataset.type;
          const sender = item.dataset.sender;
          const sfRef = item.dataset.ref;
          this.markNotificationAsRead(notifId);
          if (this.notifDropdown) this.notifDropdown.style.display = 'none';
          if (type === 'chat') {
            this.openTeamChat(sender);
          } else {
            this.openCrmNotesModal(sfRef);
          }
        });
      });

      // Hatırlatma kartına tıklayınca CRM'i aç
      this.notifItemsList.querySelectorAll('.notif-item.reminder').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('label')) return;
          if (this.notifDropdown) this.notifDropdown.style.display = 'none';
          this.openCrmModal();
        });
      });
    } catch (err) {
      console.error('renderNotificationsDropdown error:', err);
    }
  }

  markNotificationAsRead(notifId) {
    if (!notifId) return;
    const target = this.userNotifications.find(n => n.id === notifId);
    if (target) target.read = true;
    if (typeof db !== 'undefined' && db) {
      db.collection('notifications').doc(notifId).delete().catch(() => {
        db.collection('notifications').doc(notifId).update({ read: true }).catch(e => console.warn(e));
      });
    }
    // Geriye kalan okunmamış sayısını güncelle
    this.userNotifications = this.userNotifications.filter(n => n.id !== notifId || !n.read);
    const unreadUserNotifs = this.userNotifications.filter(n => !n.read).length;
    const totalBadges = unreadUserNotifs + (this.validityReminders || []).length;
    if (this.notifBadge) {
      this.notifBadge.textContent = totalBadges > 9 ? '9+' : totalBadges;
      this.notifBadge.style.display = totalBadges > 0 ? 'flex' : 'none';
    }
  }

  markAllNotificationsAsRead() {
    this.userNotifications.forEach(n => {
      n.read = true;
      if (typeof db !== 'undefined' && db) {
        db.collection('notifications').doc(n.id).delete().catch(() => {
          db.collection('notifications').doc(n.id).update({ read: true }).catch(e => console.warn(e));
        });
      }
    });
    this.userNotifications = [];
    const totalBadges = (this.validityReminders || []).length;
    if (this.notifBadge) {
      this.notifBadge.textContent = totalBadges > 9 ? '9+' : totalBadges;
      this.notifBadge.style.display = totalBadges > 0 ? 'flex' : 'none';
    }
    this.renderNotificationsDropdown();
    this.showToast('Tüm mesaj ve not bildirimleri okundu olarak işaretlendi.', 'info');
  }

  // --------------------------------------------------------------------------
  // Ekip İçi Canlı Mesajlaşma (Live Team Chat) & Çevrimiçi Varlık (Presence)
  // --------------------------------------------------------------------------
  initUserPresence() {
    if (typeof db === 'undefined' || !db) return;

    this.updateUserPresence(true);
    if (this.presenceInterval) clearInterval(this.presenceInterval);
    this.presenceInterval = setInterval(() => this.updateUserPresence(true), 35000);

    window.addEventListener('beforeunload', () => this.updateUserPresence(false));

    db.collection('user_presence').onSnapshot((snapshot) => {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data && data.name) {
          this.userPresenceMap[data.name.trim().toLowerCase()] = data;
        }
      });
      this.refreshTeamUsersList();
      if (this.modalTeamChat && this.modalTeamChat.classList.contains('active') && this.teamChatPartner) {
        this.updateActivePartnerStatusHeader();
      }
    }, (err) => console.warn('user_presence onSnapshot error:', err));
  }

  updateUserPresence(isOnline = true) {
    if (typeof db === 'undefined' || !db) return;
    const myName = (this.state.profile.preparedBy || 'Melih Kurtgün').trim();
    if (!myName) return;
    const userKey = myName.toLowerCase();
    
    db.collection('user_presence').doc(userKey).set({
      name: myName,
      lastSeen: Date.now(),
      online: isOnline,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(err => console.warn('updateUserPresence error:', err));
  }

  refreshTeamUsersList() {
    const userMap = new Map();

    // 1. Bilinen varsayılan ekip üyeleri
    const defaultTeam = ['Melih Kurtgün', 'Fatih Yıldız', 'Halil İbrahim Çimen'];
    defaultTeam.forEach(name => {
      userMap.set(this.normalizeUserKey(name), name.trim());
    });

    // 2. PIN profil tablosundaki kayıtlı tüm kullanıcılar
    if (this.userFullProfiles) {
      Object.values(this.userFullProfiles).forEach(p => {
        if (p && p.preparedBy) {
          const norm = this.normalizeUserKey(p.preparedBy);
          if (!userMap.has(norm)) {
            userMap.set(norm, p.preparedBy.trim());
          }
        }
      });
    }

    // 3. Geçmiş tekliflerde hazırlayan olarak geçen tüm kullanıcılar
    const history = this.crmData || this.getHistory() || [];
    history.forEach(q => {
      if (q.preparedBy && q.preparedBy.trim().length > 2) {
        const norm = this.normalizeUserKey(q.preparedBy);
        if (!userMap.has(norm)) {
          userMap.set(norm, q.preparedBy.trim());
        }
      }
    });

    // 4. Presence tablosundaki kullanıcılar
    Object.keys(this.userPresenceMap || {}).forEach(k => {
      if (this.userPresenceMap[k] && this.userPresenceMap[k].name) {
        const norm = this.normalizeUserKey(this.userPresenceMap[k].name);
        if (!userMap.has(norm)) {
          userMap.set(norm, this.userPresenceMap[k].name.trim());
        }
      }
    });

    // Listeyi oluştur
    const users = [];
    userMap.forEach((name, normKey) => {
      let presence = null;
      if (this.userPresenceMap) {
        for (const [pk, pVal] of Object.entries(this.userPresenceMap)) {
          if (this.normalizeUserKey(pk) === normKey || (pVal && pVal.name && this.normalizeUserKey(pVal.name) === normKey)) {
            presence = pVal;
            break;
          }
        }
      }
      const isOnline = !!(presence && presence.online && (Date.now() - (presence.lastSeen || 0) < 90000));
      const lastSeen = presence ? (presence.lastSeen || 0) : 0;
      users.push({
        name,
        key: normKey,
        isOnline,
        lastSeen
      });
    });

    // Çevrimiçi olanlar en üstte olacak şekilde sırala
    users.sort((a, b) => {
      if (a.isOnline === b.isOnline) {
        return a.name.localeCompare(b.name, 'tr');
      }
      return a.isOnline ? -1 : 1;
    });

    this.teamUsers = users;

    if (this.modalTeamChat && this.modalTeamChat.classList.contains('active')) {
      const filterVal = this.chatUsersSearchInput ? this.chatUsersSearchInput.value : '';
      this.renderChatUsersList(filterVal);
    }
  }

  formatLastSeen(timestamp) {
    if (!timestamp) return 'Çevrimdışı';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 90) return 'Çevrimiçi';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} sa önce`;
    const d = new Date(timestamp);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  renderChatUsersList(filterText = '') {
    if (!this.chatUsersList) return;
    const myKey = (this.state.profile.preparedBy || '').trim().toLowerCase();
    const search = (filterText || '').trim().toLowerCase();

    const filtered = (this.teamUsers || []).filter(u => {
      if (u.key === myKey) return false;
      if (search && !u.name.toLowerCase().includes(search)) return false;
      return true;
    });

    if (filtered.length === 0) {
      this.chatUsersList.innerHTML = `<div style="text-align: center; color: var(--text-dim); font-size: 0.78rem; padding: 25px 10px;">Kullanıcı bulunamadı</div>`;
      return;
    }

    let html = '';
    filtered.forEach(u => {
      const isSelected = this.teamChatPartner && this.teamChatPartner.trim().toLowerCase() === u.key;
      const initials = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const unreadCount = this.teamMessages.filter(m => m.senderKey === u.key && m.receiverKey === myKey && !m.read).length;

      html += `
        <div class="chat-user-item ${isSelected ? 'active' : ''}" data-name="${this.escapeHtml(u.name)}" onclick="window.app.selectChatPartner('${this.escapeHtml(u.name)}')">
          <div class="chat-user-avatar-wrapper">
            <div class="chat-user-avatar">${initials}</div>
            <span class="chat-user-status-dot ${u.isOnline ? 'online' : 'offline'}"></span>
          </div>
          <div class="chat-user-info">
            <div class="chat-user-name">${this.escapeHtml(u.name)}</div>
            <div class="chat-user-sub">${u.isOnline ? '🟢 Çevrimiçi' : this.formatLastSeen(u.lastSeen)}</div>
          </div>
          ${unreadCount > 0 ? `<span class="chat-user-badge">${unreadCount}</span>` : ''}
        </div>
      `;
    });

    this.chatUsersList.innerHTML = html;
  }

  updateActivePartnerStatusHeader() {
    if (!this.teamChatPartner || !this.chatActiveUserStatus) return;
    const partnerKey = this.teamChatPartner.trim().toLowerCase();
    const presence = this.userPresenceMap[partnerKey];
    const isOnline = !!(presence && presence.online && (Date.now() - (presence.lastSeen || 0) < 90000));

    this.chatActiveUserStatus.innerHTML = isOnline
      ? `<span class="chat-user-status-dot online" style="position: static; display: inline-block;"></span> <span>Çevrimiçi</span>`
      : `<span class="chat-user-status-dot offline" style="position: static; display: inline-block;"></span> <span style="color: var(--text-dim);">${this.formatLastSeen(presence?.lastSeen)}</span>`;
  }

  initTeamMessagesSync() {
    if (typeof db === 'undefined' || !db) return;

    // 1. 7 günden eski mesajları temizle
    this.cleanupOldTeamMessages();
    if (this.cleanupMessagesInterval) clearInterval(this.cleanupMessagesInterval);
    this.cleanupMessagesInterval = setInterval(() => this.cleanupOldTeamMessages(), 3600000);

    // 2. Canlı mesajları dinle
    const myKey = (this.state.profile.preparedBy || '').trim().toLowerCase();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    db.collection('team_messages').onSnapshot((snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data || !data.timestamp || data.timestamp < oneWeekAgo) return;

        const sKey = (data.senderKey || '').toLowerCase();
        const rKey = (data.receiverKey || '').toLowerCase();

        if (sKey === myKey || rKey === myKey) {
          msgs.push({ ...data, id: doc.id });
        }
      });

      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      this.teamMessages = msgs;

      // Toplam okunmamış mesaj sayısını hesapla
      const unreadTotal = msgs.filter(m => m.receiverKey === myKey && !m.read).length;
      if (this.chatTotalBadge) {
        this.chatTotalBadge.textContent = unreadTotal > 9 ? '9+' : unreadTotal;
        this.chatTotalBadge.style.display = unreadTotal > 0 ? 'flex' : 'none';
      }

      this.refreshTeamUsersList();

      if (this.modalTeamChat && this.modalTeamChat.classList.contains('active') && this.teamChatPartner) {
        this.renderChatMessages();
        this.markChatPartnerMessagesAsRead(this.teamChatPartner);
      }
    }, (err) => console.warn('team_messages onSnapshot error:', err));
  }

  cleanupOldTeamMessages() {
    if (typeof db === 'undefined' || !db) return;
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    db.collection('team_messages')
      .where('timestamp', '<', oneWeekAgo)
      .limit(100)
      .get()
      .then(snapshot => {
        if (snapshot.empty) return;
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        return batch.commit().then(() => {
          console.log(`[Bulut Temizliği] 7 günden eski ${snapshot.size} mesaj silindi.`);
        });
      })
      .catch(err => console.warn('cleanupOldTeamMessages error:', err));

    db.collection('notifications')
      .where('timestamp', '<', oneWeekAgo)
      .limit(100)
      .get()
      .then(snapshot => {
        if (snapshot.empty) return;
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        return batch.commit();
      })
      .catch(err => console.warn('notifications cleanup error:', err));
  }

  openTeamChat(targetUserName = null) {
    if (!this.modalTeamChat) return;
    this.modalTeamChat.classList.add('active');

    this.refreshTeamUsersList();

    if (targetUserName) {
      this.selectChatPartner(targetUserName);
    } else if (!this.teamChatPartner) {
      const myKey = (this.state.profile.preparedBy || '').trim().toLowerCase();
      const firstOther = (this.teamUsers || []).find(u => u.key !== myKey);
      if (firstOther) {
        this.selectChatPartner(firstOther.name);
      }
    } else {
      this.selectChatPartner(this.teamChatPartner);
    }

    setTimeout(() => {
      if (this.inputTeamChatMsg) this.inputTeamChatMsg.focus();
    }, 150);
  }

  closeTeamChat() {
    if (this.modalTeamChat) {
      this.modalTeamChat.classList.remove('active');
    }
  }

  selectChatPartner(partnerName) {
    if (!partnerName) return;
    this.teamChatPartner = partnerName;

    if (this.chatActiveUserName) this.chatActiveUserName.textContent = partnerName;
    this.updateActivePartnerStatusHeader();

    if (this.chatUsersList) {
      const partnerKey = partnerName.trim().toLowerCase();
      this.chatUsersList.querySelectorAll('.chat-user-item').forEach(item => {
        if ((item.dataset.name || '').trim().toLowerCase() === partnerKey) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    this.renderChatMessages();
    this.markChatPartnerMessagesAsRead(partnerName);
    this.scrollChatToBottom();
  }

  markChatPartnerMessagesAsRead(partnerName) {
    if (!partnerName || typeof db === 'undefined' || !db) return;
    const partnerKey = partnerName.trim().toLowerCase();
    const myKey = (this.state.profile.preparedBy || '').trim().toLowerCase();

    // 1. team_messages tablosundaki o partnerden gelen okunmamışları read: true yap
    const unreadMsgs = this.teamMessages.filter(m => m.senderKey === partnerKey && m.receiverKey === myKey && !m.read);
    if (unreadMsgs.length > 0) {
      unreadMsgs.forEach(m => {
        m.read = true;
        db.collection('team_messages').doc(m.id).update({ read: true }).catch(err => console.warn(err));
      });
      const unreadTotal = this.teamMessages.filter(m => m.receiverKey === myKey && !m.read).length;
      if (this.chatTotalBadge) {
        this.chatTotalBadge.textContent = unreadTotal > 9 ? '9+' : unreadTotal;
        this.chatTotalBadge.style.display = unreadTotal > 0 ? 'flex' : 'none';
      }
    }

    // 2. Bildirim çanındaki (notifications tablosundaki) o kişiden gelen mesaj bildirimlerini sil ve sayıyı düşür
    if (this.userNotifications && this.userNotifications.length > 0) {
      const partnerNotifs = this.userNotifications.filter(n => 
        n.type === 'chat_message' && 
        n.sender && n.sender.trim().toLowerCase() === partnerKey
      );

      if (partnerNotifs.length > 0) {
        partnerNotifs.forEach(n => {
          n.read = true;
          db.collection('notifications').doc(n.id).delete().catch(() => {
            db.collection('notifications').doc(n.id).update({ read: true }).catch(err => console.warn(err));
          });
        });

        this.userNotifications = this.userNotifications.filter(n => !partnerNotifs.some(pn => pn.id === n.id));
        const unreadBellCount = this.userNotifications.filter(n => !n.read).length;
        if (this.notifBadge) {
          this.notifBadge.textContent = unreadBellCount > 9 ? '9+' : unreadBellCount;
          this.notifBadge.style.display = unreadBellCount > 0 ? 'flex' : 'none';
        }
        this.renderNotificationsDropdown();
      }
    }
  }

  sendTeamChatMessage() {
    if (!this.inputTeamChatMsg) return;
    const text = this.inputTeamChatMsg.value.trim();
    if (!text) return;
    if (!this.teamChatPartner) {
      this.showToast('Lütfen mesaj göndermek için bir kişi seçin.', 'warning');
      return;
    }

    const myName = (this.state.profile.preparedBy || 'Melih Kurtgün').trim();
    const partnerName = this.teamChatPartner.trim();
    const myKey = myName.toLowerCase();
    const partnerKey = partnerName.toLowerCase();

    const threadId = [myKey, partnerKey].sort().join('___');
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const now = new Date();
    const createdAt = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const msgData = {
      id: msgId,
      threadId: threadId,
      sender: myName,
      senderKey: myKey,
      receiver: partnerName,
      receiverKey: partnerKey,
      text: text,
      timestamp: Date.now(),
      createdAt: createdAt,
      read: false
    };

    this.teamMessages.push(msgData);
    this.renderChatMessages();
    this.scrollChatToBottom();
    this.inputTeamChatMsg.value = '';
    this.inputTeamChatMsg.focus();

    if (typeof db !== 'undefined' && db) {
      db.collection('team_messages').doc(msgId).set(msgData)
        .catch(err => console.error('Mesaj iletilemedi:', err));

      const notifId = 'notif_msg_' + msgId;
      const notifData = {
        id: notifId,
        type: 'chat_message',
        targetUser: partnerName,
        sender: myName,
        messageText: text,
        createdAt: createdAt,
        timestamp: Date.now(),
        read: false
      };
      db.collection('notifications').doc(notifId).set(notifData)
        .catch(err => console.warn('Mesaj bildirimi iletilemedi:', err));
    }
  }

  renderChatMessages() {
    if (!this.chatMessagesContainer || !this.teamChatPartner) return;
    const partnerKey = this.teamChatPartner.trim().toLowerCase();
    const myKey = (this.state.profile.preparedBy || '').trim().toLowerCase();
    const threadId = [myKey, partnerKey].sort().join('___');

    const conversation = this.teamMessages.filter(m => m.threadId === threadId);

    if (conversation.length === 0) {
      this.chatMessagesContainer.innerHTML = `
        <div class="chat-empty-state">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--accent-cyan)" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div style="font-weight: 600; color: #fff; font-size: 0.95rem;">${this.escapeHtml(this.teamChatPartner)} ile henüz mesajlaşma yok</div>
          <div style="font-size: 0.78rem; color: var(--text-dim); max-width: 260px;">Aşağıdaki alandan ilk mesajınızı yazıp gönderebilirsiniz.</div>
        </div>
      `;
      return;
    }

    let html = '';
    conversation.forEach(msg => {
      const isMine = msg.senderKey === myKey;
      html += `
        <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
          <div class="chat-bubble-content">${this.escapeHtml(msg.text)}</div>
          <div class="chat-bubble-meta">${this.escapeHtml(msg.createdAt || '')}</div>
        </div>
      `;
    });

    this.chatMessagesContainer.innerHTML = html;
  }

  scrollChatToBottom() {
    if (this.chatMessagesContainer) {
      setTimeout(() => {
        this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
      }, 50);
    }
  }

  openCrmNotesModal(sfRef) {
    if (!sfRef) return;
    this.activeNotesQuoteRef = sfRef;
    
    const quote = (this.crmData || []).find(q => q.sfRef === sfRef) || this.getHistory().find(q => q.sfRef === sfRef);
    if (!quote) return;

    if (this.notesModalRef) this.notesModalRef.textContent = quote.sfRef || '-';
    if (this.notesModalCustomer) this.notesModalCustomer.textContent = quote.customer?.to || 'İsimsiz Müşteri';
    if (this.notesModalTotal) this.notesModalTotal.textContent = quote.grandTotal || '-';
    if (this.notesModalStatus) {
      this.notesModalStatus.textContent = quote.status || 'Bekliyor';
      const statusColor = quote.status === 'Onaylandı' ? '#27ae60' : (quote.status === 'Reddedildi' ? '#e74c3c' : '#f39c12');
      this.notesModalStatus.style.color = statusColor;
    }
    if (this.notesCurrentAuthor) {
      this.notesCurrentAuthor.textContent = this.state.profile.preparedBy || 'Melih Kurtgün';
    }
    if (this.inputNewCrmNote) {
      this.inputNewCrmNote.value = '';
    }

    this.renderCrmNotesList(sfRef);
    if (this.modalCrmNotes) {
      this.modalCrmNotes.classList.add('active');
    }
  }

  renderCrmNotesList(sfRef) {
    if (!this.notesListContainer) return;
    
    const quote = (this.crmData || []).find(q => q.sfRef === sfRef) || this.getHistory().find(q => q.sfRef === sfRef);
    const notes = (quote && Array.isArray(quote.notes)) ? quote.notes : [];

    if (this.notesCountDisplay) {
      this.notesCountDisplay.textContent = notes.length;
    }

    if (notes.length === 0) {
      this.notesListContainer.innerHTML = `
        <div style="text-align: center; padding: 22px 15px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed #444; color: #777; font-size: 0.85rem;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#555" style="margin-bottom: 6px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div>Bu teklife ait henüz bir görüşme notu bulunmuyor.</div>
          <div style="font-size: 0.75rem; color: #555; margin-top: 3px;">Müşteriyle yaptığınız görüşmeleri veya takip notlarını aşağıdan ekleyebilirsiniz.</div>
        </div>
      `;
      return;
    }

    let html = '';
    notes.forEach((note) => {
      html += `
        <div style="background: #2A2A2D; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 600; color: var(--accent-cyan); font-size: 0.82rem; display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>${this.escapeHtml(note.author || 'Ekip Üyesi')}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72rem; color: #888;">${note.createdAt || ''}</span>
              <button type="button" class="btn-remove-item" onclick="window.app.deleteCrmNote('${sfRef}', '${note.id}')" title="Notu Sil" style="font-size: 1.1rem; color: #777; cursor: pointer; padding: 0 4px; line-height: 1;">&times;</button>
            </div>
          </div>
          <div style="font-size: 0.85rem; color: #eee; line-height: 1.45; white-space: pre-wrap;">${this.escapeHtml(note.text)}</div>
        </div>
      `;
    });

    this.notesListContainer.innerHTML = html;
    this.notesListContainer.scrollTop = this.notesListContainer.scrollHeight;
  }

  saveCrmNote() {
    const sfRef = this.activeNotesQuoteRef;
    if (!sfRef) return;
    
    const inputEl = document.getElementById('input-new-crm-note') || this.inputNewCrmNote;
    const text = (inputEl ? inputEl.value : '').trim();
    if (!text) {
      this.showToast('Lütfen eklemek istediğiniz notu yazın.', 'warning');
      return;
    }

    const now = new Date();
    const createdAt = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const author = this.state.profile.preparedBy || 'Melih Kurtgün';
    
    const newNote = {
      id: 'note_' + Date.now(),
      author,
      text,
      createdAt,
      timestamp: Date.now()
    };

    // 1. RAM'de güncelle
    let targetQuote = (this.crmData || []).find(q => q.sfRef === sfRef);
    if (targetQuote) {
      if (!Array.isArray(targetQuote.notes)) targetQuote.notes = [];
      targetQuote.notes.push(newNote);
    }

    // 2. LocalStorage ve JSON dosyasında güncelle
    const history = this.getHistory();
    const hIdx = history.findIndex(q => q.sfRef === sfRef);
    if (hIdx >= 0) {
      if (!Array.isArray(history[hIdx].notes)) history[hIdx].notes = [];
      history[hIdx].notes.push(newNote);
      localStorage.setItem('ortek_quotes_history', JSON.stringify(history));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history });
      }
    }

    // 3. Firebase Bulutunda Güncelle (Merge ile tam güvenli kayıt)
    if (db) {
      const updatedNotes = targetQuote ? targetQuote.notes : (hIdx >= 0 ? history[hIdx].notes : [newNote]);
      db.collection('quotes').doc(sfRef).set({ notes: updatedNotes }, { merge: true })
        .then(() => console.log('Not Firebase bulutuna kaydedildi: ', sfRef))
        .catch(err => console.error('Not buluta kaydedilemedi:', err));

      // Eğer teklif başka bir ekip üyesine aitse ona anlık bildirim oluştur:
      const quoteAuthor = (targetQuote && targetQuote.preparedBy) ? targetQuote.preparedBy.trim() : ((hIdx >= 0 && history[hIdx].preparedBy) ? history[hIdx].preparedBy.trim() : '');
      const currentAuthor = (this.state.profile.preparedBy || '').trim();
      const customerName = (targetQuote && targetQuote.customer && targetQuote.customer.to) ? targetQuote.customer.to.trim() : ((hIdx >= 0 && history[hIdx].customer) ? (history[hIdx].customer.to || '').trim() : 'Müşteri');

      if (quoteAuthor && currentAuthor && quoteAuthor.toLowerCase() !== currentAuthor.toLowerCase()) {
        const notifId = 'notif_' + Date.now();
        const notifData = {
          id: notifId,
          type: 'crm_note',
          targetUser: quoteAuthor,
          sender: currentAuthor,
          sfRef: sfRef,
          customer: customerName,
          noteText: text,
          createdAt: createdAt,
          timestamp: Date.now(),
          read: false
        };
        db.collection('notifications').doc(notifId).set(notifData)
          .then(() => console.log('Bildirim buluta iletildi:', notifId))
          .catch(err => console.error('Bildirim iletilemedi:', err));
      }
    }

    if (inputEl) inputEl.value = '';
    this.renderCrmNotesList(sfRef);
    this.renderCrmTable();
    this.showToast('Görüşme notu kaydedildi ve tüm ekiple paylaşıldı.', 'success');
  }

  deleteCrmNote(sfRef, noteId) {
    this.confirmDeleteCrmNote(sfRef, noteId);
  }

  confirmDeleteCrmNote(sfRef, noteId) {
    if (!sfRef || !noteId) return;
    this.pendingDeleteNote = { sfRef, noteId };
    
    // Not önizleme verilerini doldur
    const targetQuote = (this.crmData || []).find(q => q.sfRef === sfRef) || (this.getHistory() || []).find(q => q.sfRef === sfRef);
    const note = targetQuote && Array.isArray(targetQuote.notes) ? targetQuote.notes.find(n => n.id === noteId) : null;

    const authorEl = document.getElementById('delete-note-author');
    const dateEl = document.getElementById('delete-note-date');
    const snippetEl = document.getElementById('delete-note-snippet');

    if (authorEl) authorEl.textContent = note ? (note.author || 'Bilinmiyor') : '-';
    if (dateEl) dateEl.textContent = note ? (note.createdAt || '') : '-';
    if (snippetEl) snippetEl.textContent = note ? (note.text || '') : '-';

    const modal = document.getElementById('modal-confirm-delete-note');
    if (modal) modal.classList.add('active');
  }

  executeDeleteCrmNote() {
    if (!this.pendingDeleteNote) return;
    const { sfRef, noteId } = this.pendingDeleteNote;

    let targetQuote = (this.crmData || []).find(q => q.sfRef === sfRef);
    if (targetQuote && Array.isArray(targetQuote.notes)) {
      targetQuote.notes = targetQuote.notes.filter(n => n.id !== noteId);
    }

    const history = this.getHistory();
    const hIdx = history.findIndex(q => q.sfRef === sfRef);
    if (hIdx >= 0 && Array.isArray(history[hIdx].notes)) {
      history[hIdx].notes = history[hIdx].notes.filter(n => n.id !== noteId);
      localStorage.setItem('ortek_quotes_history', JSON.stringify(history));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history });
      }
    }

    if (db) {
      const updatedNotes = targetQuote ? targetQuote.notes : (hIdx >= 0 ? history[hIdx].notes : []);
      db.collection('quotes').doc(sfRef).set({ notes: updatedNotes }, { merge: true })
        .catch(err => console.error('Not silme hatası:', err));
    }

    const modal = document.getElementById('modal-confirm-delete-note');
    if (modal) modal.classList.remove('active');
    this.pendingDeleteNote = null;

    this.renderCrmNotesList(sfRef);
    this.renderCrmTable();
    this.showToast('Not silindi.', 'warning');
  }

  updateCrmStatus(sfRef, newStatus) {
    // 1. Bulutta güncelle
    if (db) {
      db.collection('quotes').doc(sfRef).update({ status: newStatus })
        .then(() => this.showToast(`${sfRef} durumu ${newStatus} olarak güncellendi.`, 'success'))
        .catch(err => console.error("Update hatası", err));
    }
    // 2. RAM'de güncelle
    if (this.crmData) {
      const idx = this.crmData.findIndex(x => x.sfRef === sfRef);
      if (idx >= 0) this.crmData[idx].status = newStatus;
    }
    // 3. LocalStorage ve JSON'da güncelle
    const history = this.getHistory();
    const hIdx = history.findIndex(x => x.sfRef === sfRef);
    if (hIdx >= 0) {
      history[hIdx].status = newStatus;
      localStorage.setItem('ortek_quotes_history', JSON.stringify(history));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history });
      }
    }
    
    // Tabloyu ve sayıları yenile
    this.renderCrmTable();
  }

  exportCrmToExcel() {
    if (!this.crmData || this.crmData.length === 0) return;
    
    let csvContent = "Tarih;Sirket;Teklif No;Musteri;Sektor;Son Kullanici;Hazirlayan;Telefon;Email;Urun Grubu;Tutar;Son Gorusme Notu;Durum\n";
    
    this.crmData.forEach(row => {
      // CSV'yi bozmaması için noktalı virgülleri ve satır atlamalarını temizle
      const clean = (str) => {
        if (!str) return '';
        return String(str).replace(/;/g, ',').replace(/\n/g, ' ').trim();
      };
      
      const rDate = clean(row.date);
      const rComp = clean(row.activeCompany);
      const rRef = clean(row.sfRef);
      const rCust = clean(row.customer?.to);
      const rInd = clean(row.industry);
      const rEnd = clean(row.endUser);
      const rPrep = clean(row.preparedBy);
      const rTel = clean(row.signerMobile);
      const rEmail = clean(row.signerEmail);
      const rProd = clean(row.productGroups);
      const rTot = clean(row.grandTotal);
      const rStat = clean(row.status);

      const rNotes = clean(row.notes && row.notes.length > 0 ? row.notes.map(n => `[${n.createdAt} - ${n.author}]: ${n.text}`).join(" | ") : "-");
      csvContent += `${rDate};${rComp};${rRef};${rCust};${rInd};${rEnd};${rPrep};${rTel};${rEmail};${rProd};${rTot};${rNotes};${rStat}\n`;
    });

    // UTF-8 BOM ekle (Türkçe karakterler için)
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ortek_CRM_Raporu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  openHistoryModal() {
    if (this.historySearchInput) {
      this.historySearchInput.value = '';
    }
    this.renderHistoryModalList('');
    this.modalHistory.classList.add('active');
    if (this.historySearchInput) {
      setTimeout(() => this.historySearchInput.focus(), 100);
    }
  }

  renderHistoryModalList(filterVal = '') {
    const history = this.getHistory();
    history.sort((a, b) => (b.sfRef || '').localeCompare(a.sfRef || '', undefined, { numeric: true }));
    this.historyListContainer.innerHTML = '';

    const query = (filterVal || '').trim().toLowerCase();
    const filteredHistory = query ? history.filter(h => {
      const searchTarget = `${h.sfRef || ''} ${h.customer?.to || ''} ${h.customer?.subject || ''} ${h.preparedBy || ''} ${h.grandTotal || ''} ${h.date || ''}`.toLowerCase();
      return searchTarget.includes(query);
    }) : history;

    if (filteredHistory.length === 0) {
      this.historyListContainer.innerHTML = query ? `
        <div style="text-align: center; padding: 2rem; color: var(--text-dim);">
          "${this.escapeHtml(filterVal)}" ile eşleşen bir teklif bulunamadı.
        </div>
      ` : `
        <div style="text-align: center; padding: 2rem; color: var(--text-dim);">
          Henüz kaydedilmiş teklif bulunmuyor.<br>
          "Mevcut Teklifi Kaydet" butonuna basarak tekliflerinizi saklayabilirsiniz.
        </div>
      `;
      return;
    }

    filteredHistory.forEach((h) => {
      const item = document.createElement('div');
      item.style.cssText = `
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 0.85rem 1rem;
        margin-bottom: 0.65rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const statusColor = h.status === 'Onaylandı' ? '#2ecc71' : (h.status === 'Reddedildi' ? '#e74c3c' : '#f39c12');

      item.innerHTML = `
        <div>
          <div style="font-weight: 700; color: var(--accent-cyan); font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
            ${h.sfRef} <span style="font-size: 0.78rem; font-weight: normal; color: var(--text-dim);">(${h.date})</span>
            <span style="font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; background: #333; color: #aaa; text-transform: uppercase;">${h.activeCompany || 'ortek'}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-main); margin-top: 2px;">
            ${this.escapeHtml(h.customer?.to || 'Belirtilmedi')} &mdash; <span style="color: var(--text-muted);">${this.escapeHtml(h.customer?.subject || 'Fiyat Teklifi')}</span>
            ${(h.customer?.taxOffice || h.customer?.taxNumber) ? `<span style="font-size: 0.72rem; color: #10b981; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); padding: 1px 6px; border-radius: 3px; margin-left: 6px;">🏛️ ${this.escapeHtml(h.customer.taxOffice || '')} ${h.customer.taxNumber ? '(' + this.escapeHtml(h.customer.taxNumber) + ')' : ''}</span>` : ''}
          </div>
          <div style="font-size: 0.75rem; color: #888; margin-top: 3px; display: flex; gap: 10px;">
            <span>Hazırlayan: <strong style="color: #ddd;">${this.escapeHtml(h.preparedBy || 'Bilinmiyor')}</strong></span>
            <span>Tutar: <strong style="color: var(--accent-emerald);">${h.grandTotal || '-'}</strong></span>
            <span>Durum: <strong style="color: ${statusColor};">${h.status || 'Bekliyor'}</strong></span>
          </div>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <button type="button" class="btn btn-sm btn-primary btn-load-quote">Aç / Düzenle</button>
          <button type="button" class="btn btn-sm btn-remove-item btn-del-quote" style="padding: 0.35rem 0.5rem;">Sil</button>
        </div>
      `;

      const btnLoad = item.querySelector('.btn-load-quote');
      btnLoad.addEventListener('click', () => {
        this.loadQuoteFromHistory(h);
      });

      const btnDel = item.querySelector('.btn-del-quote');
      btnDel.addEventListener('click', () => {
        this.pendingDeleteQuote = h;
        this.pendingDeleteIdx = history.findIndex(q => q.sfRef === h.sfRef);

        const quoteAuthor = (h.preparedBy || '').trim();
        const currentAuthor = (this.state.profile.preparedBy || '').trim();
        const isOwnQuote = !quoteAuthor || (quoteAuthor.toLowerCase() === currentAuthor.toLowerCase());

        if (this.confirmDeleteRef) this.confirmDeleteRef.textContent = h.sfRef || '-';
        if (this.confirmDeleteCustomer) this.confirmDeleteCustomer.textContent = h.customer?.to || 'Belirtilmedi';
        if (this.confirmDeleteTotal) this.confirmDeleteTotal.textContent = h.grandTotal || '-';

        if (this.deletePinContainer) {
          if (isOwnQuote) {
            this.deletePinContainer.style.display = 'none';
          } else {
            this.deletePinContainer.style.display = 'block';
            if (this.deleteAuthorName) this.deleteAuthorName.textContent = quoteAuthor;
            if (this.inputDeletePin) {
              this.inputDeletePin.value = '';
              setTimeout(() => this.inputDeletePin.focus(), 150);
            }
            if (this.deletePinError) this.deletePinError.style.display = 'none';
          }
        }

        if (this.modalConfirmDelete) {
          this.modalConfirmDelete.classList.add('active');
        }
      });

      this.historyListContainer.appendChild(item);
    });
  }

  executeDeleteQuote() {
    if (!this.pendingDeleteQuote) return;
    
    const quoteToDelete = this.pendingDeleteQuote;
    const quoteAuthor = (quoteToDelete.preparedBy || '').trim();
    const currentAuthor = (this.state.profile.preparedBy || '').trim();
    const isOwnQuote = !quoteAuthor || (this.normalizeUserKey(quoteAuthor) === this.normalizeUserKey(currentAuthor));

    // Başkasının teklifini silerken SADECE VE SADECE hazırlayan kişinin PIN kodu geçerlidir:
    if (!isOwnQuote) {
      const enteredPin = this.inputDeletePin ? this.inputDeletePin.value.trim() : '';
      if (!enteredPin || enteredPin.length !== 4) {
        if (this.deletePinError) {
          this.deletePinError.textContent = 'Lütfen 4 haneli PIN kodunu giriniz!';
          this.deletePinError.style.display = 'block';
        }
        if (this.inputDeletePin) this.inputDeletePin.focus();
        return;
      }

      // Teklifi hazırlayan kişinin şifresini bul
      let authorRequiredPin = quoteToDelete.authorPin;
      if (!authorRequiredPin) {
        authorRequiredPin = this.getUserPin(quoteAuthor);
      }
      if (!authorRequiredPin) {
        authorRequiredPin = '1234';
      }

      // Kesin kural: Başka bir kullanıcının kendi şifresi burada GEÇERSİZDİR! Sadece teklifi hazırlayanın şifresi kabul edilir:
      if (enteredPin !== authorRequiredPin) {
        if (this.deletePinError) {
          this.deletePinError.textContent = `Hatalı PIN! Bu teklif ${quoteAuthor} tarafından hazırlanmıştır. Sadece ${quoteAuthor}'ın şifresi geçerlidir.`;
          this.deletePinError.style.display = 'block';
        }
        this.showToast(`Hatalı PIN kodu! Sadece ${quoteAuthor} tarafından belirlenen şifre ile silinebilir.`, 'error');
        if (this.inputDeletePin) {
          this.inputDeletePin.value = '';
          this.inputDeletePin.focus();
        }
        return;
      }
    }

    const sfRef = quoteToDelete.sfRef;
    const history = this.getHistory();
    const idx = history.findIndex(h => h.sfRef === sfRef);

    // 1. Buluttan sil ve tüm bilgisayarlardan silinmesi için deleted_quotes koleksiyonuna bildir:
    if (typeof db !== 'undefined' && db && sfRef) {
      db.collection('quotes').doc(sfRef).delete().catch(e => console.error(e));
      db.collection('deleted_quotes').doc(sfRef).set({
        sfRef: sfRef,
        deletedAt: new Date().toISOString(),
        deletedBy: currentAuthor || 'Bilinmiyor'
      }).catch(e => console.error('deleted_quotes error:', e));
    }

    // 2. Yerel bellekten sil:
    if (idx >= 0) {
      history.splice(idx, 1);
      localStorage.setItem('ortek_quotes_history', JSON.stringify(history));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history });
      }
    }

    if (this.modalConfirmDelete) {
      this.modalConfirmDelete.classList.remove('active');
    }

    this.openHistoryModal();
    this.showToast(`${sfRef} numaralı teklif kalıcı olarak silindi.`, 'warning');
    this.pendingDeleteQuote = null;
  }

    // Teklifin yazıldığı dili akıllı analiz et (Türkçe hazırlanmış projelerin asla EN açılmaması için)
  detectQuoteLanguage(quote) {
    if (!quote) return 'tr';
    if (quote.language === 'tr') return 'tr';
    
    const textToCheck = [
      quote.customer?.to || '',
      quote.customer?.subject || '',
      quote.customer?.address || '',
      quote.remarksConfig?.deliveryPlace || '',
      quote.remarksConfig?.deliveryTime || '',
      quote.remarksConfig?.paymentTerms || '',
      quote.remarksConfig?.scopeText || '',
      ...(quote.items || []).map(i => (i.title || '') + ' ' + (i.marka || '') + ' ' + (i.unitType || ''))
    ].join(' ');

    const hasTurkishChars = /[çğıöşüİĞŞÇÖÜ]/i.test(textToCheck);
    const hasTurkishWords = /\b(teklif|fiyat|adet|pompa|inşaat|sanayi|ticaret|teslim|peşin|vadeli|dahil|hariç)\b/i.test(textToCheck);

    if (hasTurkishChars || hasTurkishWords) {
      return 'tr';
    }

    return quote.language === 'en' ? 'en' : 'tr';
  }

  loadQuoteFromHistory(quote) {
    this.state.dateISO = quote.dateISO || new Date().toISOString().split('T')[0];
    this.state.customer = { ...quote.customer };
    this.state.items = JSON.parse(JSON.stringify(quote.items));
    if (quote.remarksConfig) this.state.remarksConfig = { ...quote.remarksConfig };
    this.customRemarksList = null;
    this.state.isPackagePrice = !!quote.isPackagePrice;
    this.state.packagePrice = quote.packagePrice || '';
    this.state.packageRowText = quote.packageRowText || 'Proje Özel Fiyat';
    this.state.packageTotalText = quote.packageTotalText || 'Proje Özel Fiyat';
    this.state.items.forEach(item => {
      if (item.unitType && item.unitType !== 'Adet' && item.unitType !== 'Metre') {
        item.unitType = item.isMeter ? 'Metre' : 'Adet';
      }
    });
    if (quote.currency) this.state.currency = quote.currency;
    if (quote.activeCompany) {
      this.state.activeCompany = quote.activeCompany;
      if (this.companyRadios) {
        this.companyRadios.forEach(r => {
          r.checked = (r.value === quote.activeCompany);
        });
      }
    }
    const targetLang = this.detectQuoteLanguage(quote);
    this.state.language = targetLang;
    if (this.languageRadios) {
      this.languageRadios.forEach(r => {
        r.checked = (r.value === targetLang);
      });
    }

    if (/R\d+$/i.test(quote.sfRef)) {
      const match = quote.sfRef.match(/R(\d+)$/i);
      this.state.isRevision = true;
      this.state.revisionLevel = parseInt(match[1], 10);
      this.state.baseSalesForceRef = quote.sfRef.replace(/R\d+$/i, '');
    } else {
      this.state.isRevision = false;
      this.state.revisionLevel = 0;
      this.state.baseSalesForceRef = quote.sfRef;
    }

    this.editingOriginalSfRef = quote.sfRef;
    const cleanNum = parseInt(this.state.baseSalesForceRef.replace(/[^0-9]/g, '').slice(-5), 10);
    if (!isNaN(cleanNum)) {
      this.state.salesForceCounter = cleanNum;
    }

    this.modalHistory.classList.remove('active');
    this.render();
    this.showToast(`Teklif yüklendi: ${quote.sfRef}`, 'success');
  }

  // --------------------------------------------------------------------------
  // Toast Bildirimleri (Hacker Notifications)
  // --------------------------------------------------------------------------
  showToast(message, type = 'info', duration = 3500) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0; margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2.5" style="flex-shrink:0; margin-top:1px;"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" style="flex-shrink:0; margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2.5" style="flex-shrink:0; margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    const isCustomHtml = message.includes('<div') || message.includes('<strong');
    if (isCustomHtml) {
      toast.innerHTML = message;
    } else {
      toast.innerHTML = `
        ${iconSvg}
        <span style="flex:1;">${message}</span>
      `;
    }

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.35s ease';
      setTimeout(() => {
        if (toast && toast.parentNode) toast.remove();
      }, 350);
    }, duration);
  }

  // --------------------------------------------------------------------------
  // Cari / Müşteri Yönetimi & Akıllı Otomatik Tamamlama (Customer Autocomplete & Directory)
  // --------------------------------------------------------------------------
  
  normalizeTr(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .trim()
      .replace(/İ/g, 'i')
      .replace(/I/g, 'i')
      .replace(/ı/g, 'i')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\.\,\-\_\/\\]+/g, ' ');
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  initCustomersSync() {
    // 1. Yerel depolamadan yükle
    try {
      const stored = localStorage.getItem('ortek_customers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) this.customersData = parsed;
      }
    } catch (e) {
      console.warn('Cari yerel yükleme hatası:', e);
    }

    // 2. Geçmiş tekliflerden mevcut carileri tara ve topla
    this.harvestCustomersFromQuotes();

    // 3. Firebase Firestore Bulut Senkronizasyonu
    if (typeof db !== 'undefined' && db) {
      db.collection('customers').onSnapshot((snapshot) => {
        const cloudMap = new Map();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data && data.name) {
            const key = (data.name.trim() + '___' + (data.attention || '').trim()).toLowerCase();
            cloudMap.set(key, { ...data, id: doc.id });
          }
        });

        // Yerel verilerle birleştir
        const mergedMap = new Map();
        (this.customersData || []).forEach(c => {
          const key = (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase();
          mergedMap.set(key, c);
        });

        cloudMap.forEach((v, k) => {
          mergedMap.set(k, v);
        });

        this.customersData = Array.from(mergedMap.values());
        this.customersData.sort((a, b) => (b.quoteCount || 0) - (a.quoteCount || 0) || a.name.localeCompare(b.name, 'tr-TR'));

        // Yerel sakla
        localStorage.setItem('ortek_customers', JSON.stringify(this.customersData));
        if (window.electronAPI && window.electronAPI.saveJson) {
          window.electronAPI.saveJson({ key: 'ortek_customers', data: this.customersData });
        }

        if (this.modalCustomersDirectory && this.modalCustomersDirectory.classList.contains('active')) {
          const searchVal = this.inputSearchCustomers ? this.inputSearchCustomers.value : '';
          this.renderCustomersTable(searchVal);
        }
      }, (err) => console.warn('customers sync error:', err));
    }
  }

  harvestCustomersFromQuotes(isManual = false) {
    const quotes = (this.crmData && this.crmData.length > 0) ? this.crmData : this.getHistory();
    if (!quotes || quotes.length === 0) {
      if (isManual) this.showToast('Taranacak geçmiş teklif bulunamadı.', 'info');
      return;
    }

    const quoteCounts = new Map();
    const lastQuotes = new Map();
    quotes.forEach(q => {
      if (!q || !q.customer || !q.customer.to) return;
      const name = q.customer.to.trim();
      if (!name) return;
      const attention = (q.customer.attention || '').trim();
      const key = (name + '___' + attention).toLowerCase();
      quoteCounts.set(key, (quoteCounts.get(key) || 0) + 1);
      if (!lastQuotes.has(key) || (q.date && q.date > (lastQuotes.get(key).date || ''))) {
        lastQuotes.set(key, q);
      }
    });

    const map = new Map();
    (this.customersData || []).forEach(c => {
      const key = (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase();
      map.set(key, { ...c });
    });

    quotes.forEach(q => {
      if (!q || !q.customer || !q.customer.to) return;
      const name = q.customer.to.trim();
      if (!name) return;
      const attention = (q.customer.attention || '').trim();
      const key = (name + '___' + attention).toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          id: 'cust_' + this.hashString(key),
          name: name,
          attention: attention,
          taxOffice: (q.customer.taxOffice || '').trim(),
          taxNumber: (q.customer.taxNumber || '').trim(),
          tel: (q.customer.tel || '').trim(),
          email: (q.customer.email || '').trim(),
          address: (q.customer.address || '').trim(),
          enduser: (q.customer.enduser || q.endUser || '').trim(),
          industry: (q.customer.industry || q.industry || '').trim(),
          quoteCount: quoteCounts.get(key) || 1,
          lastQuoteDate: q.date || '',
          lastRef: q.sfRef || '',
          updatedAt: Date.now()
        });
      } else {
        const item = map.get(key);
        item.quoteCount = quoteCounts.get(key) || item.quoteCount || 1;
        if (lastQuotes.has(key)) {
          const lq = lastQuotes.get(key);
          if (lq.date) item.lastQuoteDate = lq.date;
          if (lq.sfRef) item.lastRef = lq.sfRef;
        }
        if (!item.taxOffice && q.customer.taxOffice) item.taxOffice = q.customer.taxOffice.trim();
        if (!item.taxNumber && q.customer.taxNumber) item.taxNumber = q.customer.taxNumber.trim();
        if (!item.tel && q.customer.tel) item.tel = q.customer.tel.trim();
        if (!item.email && q.customer.email) item.email = q.customer.email.trim();
        if (!item.address && q.customer.address) item.address = q.customer.address.trim();
        if (!item.enduser && (q.customer.enduser || q.endUser)) item.enduser = (q.customer.enduser || q.endUser).trim();
        if (!item.industry && (q.customer.industry || q.industry)) item.industry = (q.customer.industry || q.industry).trim();
      }
    });

    // Halihazırda map'te olan ancak bu döngüde teklifi bulunmayan carilerin sayaçlarını koru veya güncelle
    map.forEach((item, k) => {
      if (quoteCounts.has(k)) {
        item.quoteCount = quoteCounts.get(k);
      }
    });

    this.customersData = Array.from(map.values());
    this.customersData.sort((a, b) => (b.quoteCount || 0) - (a.quoteCount || 0) || a.name.localeCompare(b.name, 'tr-TR'));

    localStorage.setItem('ortek_customers', JSON.stringify(this.customersData));
    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({ key: 'ortek_customers', data: this.customersData });
    }

    if (isManual) {
      this.renderCustomersTable(this.inputSearchCustomers ? this.inputSearchCustomers.value : '');
      this.showToast(`Geçmiş teklifler tarandı. Toplam ${this.customersData.length} kayıtlı cari eşitlendi.`, 'success');
    }
  }

  saveCustomerFromQuote(cust, sfRef = '', quoteDate = '') {
    if (!cust || !cust.to || !cust.to.trim()) return;
    const name = cust.to.trim();
    const attention = (cust.attention || '').trim();
    const key = (name + '___' + attention).toLowerCase();

    let target = (this.customersData || []).find(c => (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() === key);

    if (target) {
      target.quoteCount = (target.quoteCount || 0) + 1;
      if (cust.taxOffice && cust.taxOffice.trim()) target.taxOffice = cust.taxOffice.trim();
      if (cust.taxNumber && cust.taxNumber.trim()) target.taxNumber = cust.taxNumber.trim();
      if (cust.tel && cust.tel.trim()) target.tel = cust.tel.trim();
      if (cust.email && cust.email.trim()) target.email = cust.email.trim();
      if (cust.address && cust.address.trim()) target.address = cust.address.trim();
      if (cust.enduser && cust.enduser.trim()) target.enduser = cust.enduser.trim();
      if (cust.industry && cust.industry.trim()) target.industry = cust.industry.trim();
      if (quoteDate) target.lastQuoteDate = quoteDate;
      if (sfRef) target.lastRef = sfRef;
      target.updatedAt = Date.now();
    } else {
      target = {
        id: 'cust_' + this.hashString(key) + '_' + Date.now().toString(36),
        name: name,
        attention: attention,
        taxOffice: (cust.taxOffice || '').trim(),
        taxNumber: (cust.taxNumber || '').trim(),
        tel: (cust.tel || '').trim(),
        email: (cust.email || '').trim(),
        address: (cust.address || '').trim(),
        enduser: (cust.enduser || '').trim(),
        industry: (cust.industry || '').trim(),
        quoteCount: 1,
        lastQuoteDate: quoteDate || new Date().toLocaleDateString('tr-TR'),
        lastRef: sfRef || '',
        updatedAt: Date.now()
      };
      if (!Array.isArray(this.customersData)) this.customersData = [];
      this.customersData.push(target);
    }

    this.customersData.sort((a, b) => (b.quoteCount || 0) - (a.quoteCount || 0) || a.name.localeCompare(b.name, 'tr-TR'));

    localStorage.setItem('ortek_customers', JSON.stringify(this.customersData));
    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({ key: 'ortek_customers', data: this.customersData });
    }

    if (typeof db !== 'undefined' && db) {
      const docId = 'cust_' + this.hashString(key);
      db.collection('customers').doc(docId).set(target, { merge: true })
        .catch(err => console.warn('Customer cloud save error:', err));
    }
  }

  saveCustomerDirectlyFromEditor() {
    const name = (this.inputTo ? this.inputTo.value : (this.state.customer.to || '')).trim();
    if (!name) {
      this.showToast('Lütfen önce Firma Adı (To) alanını doldurunuz.', 'warning');
      if (this.inputTo) this.inputTo.focus();
      return;
    }

    const attention = (this.inputAttention ? this.inputAttention.value : (this.state.customer.attention || '')).trim();
    const taxOffice = (this.inputTaxOffice ? this.inputTaxOffice.value : (this.state.customer.taxOffice || '')).trim();
    const taxNumber = (this.inputTaxNumber ? this.inputTaxNumber.value : (this.state.customer.taxNumber || '')).trim();
    const tel = this.formatPhoneNumber((this.inputTel ? this.inputTel.value : (this.state.customer.tel || '')).trim());
    const email = (this.inputEmail ? this.inputEmail.value : (this.state.customer.email || '')).trim();
    const address = (this.inputAddress ? this.inputAddress.value : (this.state.customer.address || '')).trim();
    const enduser = (this.inputEndUser ? this.inputEndUser.value : (this.state.customer.enduser || '')).trim();
    const industry = (this.inputIndustry ? this.inputIndustry.value : (this.state.customer.industry || '')).trim();

    this.state.customer.to = name;
    this.state.customer.attention = attention;
    this.state.customer.taxOffice = taxOffice;
    this.state.customer.taxNumber = taxNumber;
    this.state.customer.tel = tel;
    if (this.inputTel) this.inputTel.value = tel;
    this.state.customer.email = email;
    this.state.customer.address = address;
    this.state.customer.enduser = enduser;
    this.state.customer.industry = industry;

    const key = (name + '___' + attention).toLowerCase();
    const docId = 'cust_' + this.hashString(key);

    const custObj = {
      id: docId,
      name: name,
      attention: attention,
      taxOffice: taxOffice,
      taxNumber: taxNumber,
      tel: tel,
      email: email,
      industry: industry,
      address: address,
      enduser: enduser,
      quoteCount: 1,
      lastQuoteDate: this.state.dateISO || new Date().toLocaleDateString('tr-TR'),
      lastRef: this.getComputedSfRef() || '',
      updatedAt: Date.now()
    };

    if (!Array.isArray(this.customersData)) this.customersData = [];
    const existingIdx = this.customersData.findIndex(c => (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() === key || (c.name.trim().toLowerCase() === name.toLowerCase() && !c.attention));
    if (existingIdx >= 0) {
      custObj.quoteCount = this.customersData[existingIdx].quoteCount || 1;
      this.customersData[existingIdx] = { ...this.customersData[existingIdx], ...custObj };
    } else {
      this.customersData.unshift(custObj);
    }

    localStorage.setItem('ortek_customers', JSON.stringify(this.customersData));
    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({ key: 'ortek_customers', data: this.customersData });
    }

    if (typeof db !== 'undefined' && db) {
      db.collection('customers').doc(docId).set(custObj, { merge: true })
        .catch(err => console.warn('Customer direct save error:', err));
    }

    // Geçmiş teklifleri de geriye dönük güncelle
    const normName = name.toLowerCase();
    let updatedQuotes = 0;
    const history = this.getHistory();
    history.forEach(q => {
      if (q && q.customer && q.customer.to && q.customer.to.trim().toLowerCase() === normName) {
        if (taxOffice) q.customer.taxOffice = taxOffice;
        if (taxNumber) q.customer.taxNumber = taxNumber;
        if (address) q.customer.address = address;
        updatedQuotes++;
        if (typeof db !== 'undefined' && db && q.sfRef) {
          db.collection('quotes').doc(q.sfRef).set({ customer: q.customer }, { merge: true }).catch(() => {});
        }
      }
    });
    if (updatedQuotes > 0) {
      localStorage.setItem('ortek_quotes_history', JSON.stringify(history.slice(0, 100)));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history.slice(0, 100) });
      }
    }

    this.showToast(`Müşteri Cari Rehberine başarıyla kaydedildi/güncellendi: ${name}`, 'success');
  }

  setupCustomerAutocomplete() {
    if (!this.inputTo || !this.customerAutocompleteDropdown) return;

    let selectedIndex = -1;
    let currentMatches = [];

    const closeDropdown = () => {
      if (this.customerAutocompleteDropdown) {
        this.customerAutocompleteDropdown.style.display = 'none';
        this.customerAutocompleteDropdown.innerHTML = '';
        selectedIndex = -1;
        currentMatches = [];
      }
    };

    const renderMatches = (matches) => {
      currentMatches = matches;
      selectedIndex = -1;
      if (matches.length === 0) {
        closeDropdown();
        return;
      }

      let html = '';
      matches.forEach((cust, idx) => {
        const quoteBadge = (cust.quoteCount && cust.quoteCount > 1) ? `${cust.quoteCount} Teklif` : 'Kayıtlı Cari';
        const addrSnippet = cust.address ? this.escapeHtml(cust.address) : 'Adres belirtilmedi';
        const taxSnippet = (cust.taxOffice || cust.taxNumber) 
          ? `<span style="color: #10b981; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 3px;">🏛️ ${this.escapeHtml(cust.taxOffice || 'V.D.')} ${cust.taxNumber ? '(' + this.escapeHtml(cust.taxNumber) + ')' : ''}</span>`
          : '';

        html += `
          <div class="customer-autocomplete-item" data-idx="${idx}">
            <div class="c-item-top">
              <span class="c-item-name">${this.escapeHtml(cust.name)}</span>
              <span class="c-item-badge">${quoteBadge}</span>
            </div>
            <div class="c-item-sub">
              ${cust.attention ? `
                <span class="c-item-attn">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  ${this.escapeHtml(cust.attention)}
                </span>` : ''}
              ${cust.tel ? `
                <span class="c-item-tel">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  ${this.escapeHtml(cust.tel)}
                </span>` : ''}
              ${cust.email ? `
                <span class="c-item-email">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  ${this.escapeHtml(cust.email)}
                </span>` : ''}
              ${taxSnippet}
            </div>
            <div class="c-item-addr">${addrSnippet}</div>
          </div>
        `;
      });

      this.customerAutocompleteDropdown.innerHTML = html;
      this.customerAutocompleteDropdown.style.display = 'block';

      this.customerAutocompleteDropdown.querySelectorAll('.customer-autocomplete-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const idx = parseInt(el.dataset.idx, 10);
          if (currentMatches[idx]) {
            this.applyCustomerToQuote(currentMatches[idx]);
            closeDropdown();
          }
        });
      });
    };

    const updateHighlight = () => {
      const items = this.customerAutocompleteDropdown.querySelectorAll('.customer-autocomplete-item');
      items.forEach((it, idx) => {
        if (idx === selectedIndex) {
          it.classList.add('selected');
          it.scrollIntoView({ block: 'nearest' });
        } else {
          it.classList.remove('selected');
        }
      });
    };

    const handleSearch = () => {
      const val = (this.inputTo.value || '').trim();
      if (!this.customersData || this.customersData.length === 0) {
        closeDropdown();
        return;
      }

      if (!val) {
        const topRecent = this.customersData.slice(0, 6);
        renderMatches(topRecent);
        return;
      }

      const normQuery = this.normalizeTr(val);
      const matches = this.customersData.filter(c => {
        const nName = this.normalizeTr(c.name);
        const nAttn = this.normalizeTr(c.attention);
        const nTaxOff = this.normalizeTr(c.taxOffice);
        const nTaxNum = this.normalizeTr(c.taxNumber);
        const nTel = this.normalizeTr(c.tel);
        const nEmail = this.normalizeTr(c.email);
        const nAddr = this.normalizeTr(c.address);
        return nName.includes(normQuery) || nAttn.includes(normQuery) || nTaxOff.includes(normQuery) || nTaxNum.includes(normQuery) || nTel.includes(normQuery) || nEmail.includes(normQuery) || nAddr.includes(normQuery);
      }).slice(0, 10);

      renderMatches(matches);
    };

    this.inputTo.addEventListener('input', () => {
      handleSearch();
    });

    this.inputTo.addEventListener('focus', () => {
      handleSearch();
    });

    this.inputTo.addEventListener('keydown', (e) => {
      if (this.customerAutocompleteDropdown.style.display === 'block' && currentMatches.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % currentMatches.length;
          updateHighlight();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = (selectedIndex - 1 + currentMatches.length) % currentMatches.length;
          updateHighlight();
        } else if (e.key === 'Enter') {
          if (selectedIndex >= 0 && currentMatches[selectedIndex]) {
            e.preventDefault();
            this.applyCustomerToQuote(currentMatches[selectedIndex]);
            closeDropdown();
          }
        } else if (e.key === 'Escape') {
          closeDropdown();
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (this.inputTo && !this.inputTo.contains(e.target) && 
          this.customerAutocompleteDropdown && !this.customerAutocompleteDropdown.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  applyCustomerToQuote(cust) {
    if (!cust) return;

    // 1. Firma Adı (To)
    this.inputTo.value = cust.name || '';
    this.state.customer.to = cust.name || '';

    // 2. Vergi Dairesi & Vergi No / VKN
    if (this.inputTaxOffice) {
      this.inputTaxOffice.value = cust.taxOffice || '';
      this.state.customer.taxOffice = cust.taxOffice || '';
    }
    if (this.inputTaxNumber) {
      this.inputTaxNumber.value = cust.taxNumber || '';
      this.state.customer.taxNumber = cust.taxNumber || '';
    }

    // 3. İlgili Kişi (Attention) -> Sayfa 2 From'a otomatik aktarılır
    if (this.inputAttention) {
      this.inputAttention.value = cust.attention || '';
      this.state.customer.attention = cust.attention || '';
    }

    // 4. Adres
    if (this.inputAddress) {
      this.inputAddress.value = cust.address || '';
      this.state.customer.address = cust.address || '';
    }

    // 5. Telefon
    if (this.inputTel) {
      const formattedTel = this.formatPhoneNumber(cust.tel || '');
      this.inputTel.value = formattedTel;
      this.state.customer.tel = formattedTel;
    }

    // 6. E-Posta
    if (this.inputEmail) {
      this.inputEmail.value = cust.email || '';
      this.state.customer.email = cust.email || '';
    }

    // 7. Sektör & Son Kullanıcı (varsa)
    if (cust.industry && this.inputIndustry) {
      this.inputIndustry.value = cust.industry;
      this.state.customer.industry = cust.industry;
    }
    if (cust.enduser && this.inputEndUser) {
      this.inputEndUser.value = cust.enduser;
      this.state.customer.enduser = cust.enduser;
    }

    // 8. Konu (Subject) kullanıcının özel isteği üzerine kesinlikle BOŞ bırakılır
    if (this.inputSubject) {
      this.inputSubject.value = '';
      this.state.customer.subject = '';
    }

    // Önizlemeyi güncelle
    this.renderPreview();

    const who = cust.attention ? ` (${cust.attention})` : '';
    this.showToast(`Cari bilgileri aktarıldı: ${cust.name}${who}`, 'success');
  }

  openCustomersModal() {
    if (!this.modalCustomersDirectory) return;
    this.harvestCustomersFromQuotes();
    this.modalCustomersDirectory.classList.add('active');
    if (this.inputSearchCustomers) {
      this.inputSearchCustomers.value = '';
      setTimeout(() => this.inputSearchCustomers.focus(), 150);
    }
    this.toggleCustomerForm(false);
    this.renderCustomersTable('');
  }

  closeCustomersModal() {
    if (this.modalCustomersDirectory) {
      this.modalCustomersDirectory.classList.remove('active');
    }
  }

  renderCustomersTable(filterText = '') {
    if (!this.customersTableBody) return;

    const q = this.normalizeTr(filterText);
    const list = (this.customersData || []).filter(c => {
      if (!q) return true;
      return this.normalizeTr(c.name).includes(q) ||
             this.normalizeTr(c.attention).includes(q) ||
             this.normalizeTr(c.taxOffice).includes(q) ||
             this.normalizeTr(c.taxNumber).includes(q) ||
             this.normalizeTr(c.tel).includes(q) ||
             this.normalizeTr(c.email).includes(q) ||
             this.normalizeTr(c.address).includes(q);
    });

    if (this.customersTotalCount) {
      this.customersTotalCount.textContent = list.length;
    }

    if (list.length === 0) {
      this.customersTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px 10px; color: #718096;">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#4a5568" style="margin-bottom: 8px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <div>Aradığınız kriterlere uygun cari kaydı bulunamadı.</div>
            <div style="font-size: 0.74rem; margin-top: 4px; color: #4a5568;">Yukarıdaki "Yeni Cari Ekle" butonu ile hemen yeni bir firma tanımlayabilirsiniz.</div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    list.forEach(c => {
      const qCount = c.quoteCount || 0;
      const key = (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase();
      const hasTax = !!(c.taxOffice || c.taxNumber);

      html += `
        <tr class="cust-table-row">
          <td style="overflow: hidden; box-sizing: border-box;">
            <div style="font-weight: 700; color: #ffffff; font-size: 0.84rem; word-break: break-word; line-height: 1.25;">${this.escapeHtml(c.name)}</div>
            ${hasTax ? `
              <div style="display: flex; gap: 4px; align-items: center; margin-top: 3px; font-size: 0.70rem; overflow: hidden;">
                <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 1px 6px; border-radius: 4px; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;" title="Vergi Dairesi: ${this.escapeHtml(c.taxOffice || '-')} | VKN: ${this.escapeHtml(c.taxNumber || '-')}">
                  🏛️ ${this.escapeHtml(c.taxOffice || 'V.D.')} ${c.taxNumber ? ' / VKN: ' + this.escapeHtml(c.taxNumber) : ''}
                </span>
              </div>` : `
              <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                🏛️ <em>Vergi Dairesi / VKN girilmedi</em>
              </div>`}
            ${c.address ? `<div style="font-size: 0.70rem; color: #94a3b8; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;" title="${this.escapeHtml(c.address)}">📍 ${this.escapeHtml(c.address)}</div>` : ''}
          </td>
          <td style="overflow: hidden; box-sizing: border-box;">
            ${c.attention ? `<div style="color: #38bdf8; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(c.attention)}">👤 ${this.escapeHtml(c.attention)}</div>` : '<span style="color: #64748b;">-</span>'}
          </td>
          <td style="overflow: hidden; box-sizing: border-box;">
            ${c.tel ? `<div style="color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(this.formatPhoneNumber(c.tel))}">📞 ${this.escapeHtml(this.formatPhoneNumber(c.tel))}</div>` : '<span style="color: #64748b;">-</span>'}
          </td>
          <td style="overflow: hidden; box-sizing: border-box;">
            ${c.email ? `<div style="color: #cbd5e1; font-size: 0.76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(c.email)}">✉️ ${this.escapeHtml(c.email)}</div>` : '<span style="color: #64748b;">-</span>'}
          </td>
          <td style="text-align: center; overflow: hidden; box-sizing: border-box;">
            <span style="background: ${qCount > 0 ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; color: ${qCount > 0 ? 'var(--accent-cyan)' : '#888'}; font-weight: 700; padding: 2px 7px; border-radius: 10px; font-size: 0.74rem;">${qCount}</span>
          </td>
          <td style="text-align: right; overflow: hidden; box-sizing: border-box;">
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; flex-wrap: nowrap;">
              <button type="button" class="btn-cust-select" data-key="${this.escapeHtml(key)}" title="Bu cariyi teklife aktar">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Aktar</span>
              </button>
              <button type="button" class="btn-cust-edit" data-key="${this.escapeHtml(key)}" title="Cariyi Düzenle (Vergi Dairesi, VKN vb. ekle)">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Düzenle</span>
              </button>
              <button type="button" class="btn-cust-delete" data-key="${this.escapeHtml(key)}" title="Cariyi Sil">
                &times;
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    this.customersTableBody.innerHTML = html;
  }

  selectCustomerFromDirectory(key) {
    const cust = (this.customersData || []).find(c => (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() === key || c.id === key);
    if (cust) {
      this.applyCustomerToQuote(cust);
      this.closeCustomersModal();
    }
  }

  toggleCustomerForm(show = null, editCust = null) {
    if (!this.customerFormAccordion) return;
    const isVisible = (this.customerFormAccordion.style.display === 'block');
    const shouldShow = (show !== null) ? show : !isVisible;

    this.customerFormAccordion.style.display = shouldShow ? 'block' : 'none';
    if (this.txtToggleAddCustomer) {
      this.txtToggleAddCustomer.textContent = shouldShow ? 'Formu Kapat' : 'Yeni Cari Ekle';
    }

    if (shouldShow) {
      if (editCust) {
        if (this.customerFormTitle) this.customerFormTitle.textContent = `Cari Düzenle: ${editCust.name}`;
        if (this.custFormEditId) this.custFormEditId.value = editCust.id || ('cust_' + this.hashString(editCust.name + '___' + (editCust.attention || '')));
        if (this.custFormName) this.custFormName.value = editCust.name || '';
        if (this.custFormAttention) this.custFormAttention.value = editCust.attention || '';
        if (this.custFormTaxOffice) this.custFormTaxOffice.value = editCust.taxOffice || '';
        if (this.custFormTaxNumber) this.custFormTaxNumber.value = editCust.taxNumber || '';
        if (this.custFormTel) this.custFormTel.value = this.formatPhoneNumber(editCust.tel || '');
        if (this.custFormEmail) this.custFormEmail.value = editCust.email || '';
        if (this.custFormIndustry) this.custFormIndustry.value = editCust.industry || '';
        if (this.custFormAddress) this.custFormAddress.value = editCust.address || '';
        if (this.custFormEnduser) this.custFormEnduser.value = editCust.enduser || '';
        if (this.btnSaveCustomerForm) this.btnSaveCustomerForm.textContent = 'Cariyi Güncelle';
        if (this.custFormTaxOffice) this.custFormTaxOffice.focus();
      } else {
        if (this.customerFormTitle) this.customerFormTitle.textContent = 'Yeni Cari Kartı Oluştur';
        if (this.custFormEditId) this.custFormEditId.value = '';
        if (this.custFormName) this.custFormName.value = '';
        if (this.custFormAttention) this.custFormAttention.value = '';
        if (this.custFormTaxOffice) this.custFormTaxOffice.value = '';
        if (this.custFormTaxNumber) this.custFormTaxNumber.value = '';
        if (this.custFormTel) this.custFormTel.value = '';
        if (this.custFormEmail) this.custFormEmail.value = '';
        if (this.custFormIndustry) this.custFormIndustry.value = '';
        if (this.custFormAddress) this.custFormAddress.value = '';
        if (this.custFormEnduser) this.custFormEnduser.value = '';
        if (this.btnSaveCustomerForm) this.btnSaveCustomerForm.textContent = 'Cariyi Kaydet';
        if (this.custFormName) this.custFormName.focus();
      }
    }
  }

  editCustomerInForm(key) {
    const cust = (this.customersData || []).find(c => (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() === key || c.id === key);
    if (!cust) return;
    this.toggleCustomerForm(true, cust);
    if (this.customerFormAccordion) {
      this.customerFormAccordion.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  saveCustomerFromForm() {
    const name = (this.custFormName ? this.custFormName.value : '').trim();
    const attention = (this.custFormAttention ? this.custFormAttention.value : '').trim();
    const taxOffice = (this.custFormTaxOffice ? this.custFormTaxOffice.value : '').trim();
    const taxNumber = (this.custFormTaxNumber ? this.custFormTaxNumber.value : '').trim();
    const tel = this.formatPhoneNumber((this.custFormTel ? this.custFormTel.value : '').trim());
    if (this.custFormTel) this.custFormTel.value = tel;
    const email = (this.custFormEmail ? this.custFormEmail.value : '').trim();
    const industry = (this.custFormIndustry ? this.custFormIndustry.value : '').trim();
    const address = (this.custFormAddress ? this.custFormAddress.value : '').trim();
    const enduser = (this.custFormEnduser ? this.custFormEnduser.value : '').trim();
    const editId = (this.custFormEditId ? this.custFormEditId.value : '').trim();

    if (!name) {
      this.showToast('Lütfen Firma Adı (To) alanını doldurunuz.', 'warning');
      if (this.custFormName) this.custFormName.focus();
      return;
    }

    const key = (name + '___' + attention).toLowerCase();
    const docId = editId || ('cust_' + this.hashString(key));

    const custObj = {
      id: docId,
      name: name,
      attention: attention,
      taxOffice: taxOffice,
      taxNumber: taxNumber,
      tel: tel,
      email: email,
      industry: industry,
      address: address,
      enduser: enduser,
      quoteCount: 0,
      lastQuoteDate: '',
      lastRef: '',
      updatedAt: Date.now()
    };

    if (!Array.isArray(this.customersData)) this.customersData = [];

    let existingIdx = -1;
    if (editId) {
      existingIdx = this.customersData.findIndex(c => c.id === editId || (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() === key);
    } else {
      existingIdx = this.customersData.findIndex(c => (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() === key);
    }

    if (existingIdx >= 0) {
      custObj.quoteCount = this.customersData[existingIdx].quoteCount || 0;
      custObj.lastQuoteDate = this.customersData[existingIdx].lastQuoteDate || '';
      custObj.lastRef = this.customersData[existingIdx].lastRef || '';
      this.customersData[existingIdx] = { ...this.customersData[existingIdx], ...custObj };
    } else {
      this.customersData.unshift(custObj);
    }

    this.customersData.sort((a, b) => (b.quoteCount || 0) - (a.quoteCount || 0) || a.name.localeCompare(b.name, 'tr-TR'));

    localStorage.setItem('ortek_customers', JSON.stringify(this.customersData));
    if (window.electronAPI && window.electronAPI.saveJson) {
      window.electronAPI.saveJson({ key: 'ortek_customers', data: this.customersData });
    }

    if (typeof db !== 'undefined' && db) {
      db.collection('customers').doc(docId).set(custObj, { merge: true })
        .catch(err => console.warn('Customer save error:', err));
    }

    // Geçmiş tekliflere geriye dönük eşitleme (Geriye dönük güncelleme kutusu işaretliyse)
    let retrospectiveUpdated = 0;
    if (this.custFormSyncQuotes && this.custFormSyncQuotes.checked) {
      const normName = name.toLowerCase();
      const history = this.getHistory();
      history.forEach(q => {
        if (q && q.customer && q.customer.to && q.customer.to.trim().toLowerCase() === normName) {
          if (taxOffice) q.customer.taxOffice = taxOffice;
          if (taxNumber) q.customer.taxNumber = taxNumber;
          if (address) q.customer.address = address;
          if (tel && !q.customer.tel) q.customer.tel = tel;
          if (email && !q.customer.email) q.customer.email = email;
          retrospectiveUpdated++;
          if (typeof db !== 'undefined' && db && q.sfRef) {
            db.collection('quotes').doc(q.sfRef).set({ customer: q.customer }, { merge: true }).catch(() => {});
          }
        }
      });
      if (this.crmData && Array.isArray(this.crmData)) {
        this.crmData.forEach(q => {
          if (q && q.customer && q.customer.to && q.customer.to.trim().toLowerCase() === normName) {
            if (taxOffice) q.customer.taxOffice = taxOffice;
            if (taxNumber) q.customer.taxNumber = taxNumber;
            if (address) q.customer.address = address;
          }
        });
      }
      if (retrospectiveUpdated > 0) {
        localStorage.setItem('ortek_quotes_history', JSON.stringify(history.slice(0, 100)));
        if (window.electronAPI && window.electronAPI.saveJson) {
          window.electronAPI.saveJson({ key: 'ortek_quotes_history', data: history.slice(0, 100) });
        }
      }
    }

    this.toggleCustomerForm(false);
    this.renderCustomersTable(this.inputSearchCustomers ? this.inputSearchCustomers.value : '');

    const syncInfo = retrospectiveUpdated > 0 ? ` (${retrospectiveUpdated} geçmiş teklife yansıtıldı)` : '';
    this.showToast(`Cari başarıyla ${editId ? 'güncellendi' : 'kaydedildi'}: ${name}${syncInfo}`, 'success');
  }

  deleteCustomerFromDirectory(key) {
    const cust = (this.customersData || []).find(c => (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() === key || c.id === key);
    if (!cust) return;

    if (confirm(`"${cust.name}${cust.attention ? ' - ' + cust.attention : ''}" carisini listeden silmek istediğinize emin misiniz?`)) {
      this.customersData = this.customersData.filter(c => (c.name.trim() + '___' + (c.attention || '').trim()).toLowerCase() !== key && c.id !== key);
      
      localStorage.setItem('ortek_customers', JSON.stringify(this.customersData));
      if (window.electronAPI && window.electronAPI.saveJson) {
        window.electronAPI.saveJson({ key: 'ortek_customers', data: this.customersData });
      }

      if (typeof db !== 'undefined' && db) {
        const docId = cust.id || ('cust_' + this.hashString(key));
        db.collection('customers').doc(docId).delete()
          .catch(err => console.warn('Customer delete error:', err));
      }

      this.renderCustomersTable(this.inputSearchCustomers ? this.inputSearchCustomers.value : '');
      this.showToast('Cari kaydı silindi.', 'info');
    }
  }
}

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', async () => {
  if (window.electronAPI && window.electronAPI.loadJson) {
    try {
      const resCust = await window.electronAPI.loadJson({ key: 'ortek_customers' });
      if (resCust && resCust.success && resCust.data && Array.isArray(resCust.data) && resCust.data.length > 0) {
        localStorage.setItem('ortek_customers', JSON.stringify(resCust.data));
      }
      const res = await window.electronAPI.loadJson({ key: 'ortek_quotes_history' });
      if (res && res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
        localStorage.setItem('ortek_quotes_history', JSON.stringify(res.data));
      }
      const resSettings = await window.electronAPI.loadJson({ key: 'ortek_settings' });
      if (resSettings && resSettings.success && resSettings.data) {
        const s = resSettings.data;
        if (s.ortek_first_run_done) localStorage.setItem('ortek_first_run_done', 'true');
        if (s.preparedBy) localStorage.setItem('ortek_prepared_by', s.preparedBy);
        if (s.signerRole) localStorage.setItem('ortek_signer_role', s.signerRole);
        if (s.signerMobile) localStorage.setItem('ortek_signer_mobile', s.signerMobile);
        if (s.signerEmail) localStorage.setItem('ortek_signer_email', s.signerEmail);
        if (s.phsEmail) localStorage.setItem('ortek_phs_email', s.phsEmail);
        if (s.sfCounter) localStorage.setItem('ortek_sf_counter', s.sfCounter.toString());
      }
    } catch (e) {
      console.warn('Disk load err:', e);
    }
  }
  
  try {
    window.app = new QuotationApp();
  } catch(e) {
    console.error('QuotationApp Init Error:', e);
  }
  
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 800);
  }
});
