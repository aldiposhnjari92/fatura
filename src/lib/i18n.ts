/*
  Bilingual copy for Fatura.co — Albanian and English.

  Albanian is the source of truth: `sq` defines the key set, and `en` is typed
  as having exactly the same keys, so a missing or misspelt translation is a
  build error rather than a string that silently falls back to Albanian in front
  of an English-speaking customer.

  How the language is chosen differs by page type, deliberately:

    • SSR pages (/app, /admin, auth) read a cookie in middleware and expose
      `Astro.locals.lang`. One URL, switchable in place.
    • The marketing pages are prerendered and must stay that way, so they exist
      once per language as real routes (`/` and `/en/`). Static output, and
      search engines get two indexable pages instead of one that changes under
      them.
*/

/*
  English is switched off for now.

  The dictionary and every t() call stay exactly as they are — only the list of
  languages a visitor may choose is narrowed. Re-enabling is a one-line change
  back to ['sq', 'en'], with no page or component to revisit.

  `Lang` deliberately still includes 'en' because the *invoice document* is
  still bilingual: a business invoicing a foreign client picks English per
  invoice. That is a separate choice from the interface language.
*/
export const LANGS = ['sq'] as const satisfies readonly Lang[];
export type Lang = 'sq' | 'en';

export const DEFAULT_LANG: Lang = 'sq';
export const LANG_COOKIE = 'fatura-lang';

export function isLang(value: unknown): value is Lang {
  return value === 'sq' || value === 'en';
}

/** Is this a language a visitor may actually select right now? */
export function isSelectableLang(value: unknown): value is Lang {
  return (LANGS as readonly string[]).includes(value as string);
}

/** Language names shown in the switcher, each in its own language. */
export const LANG_LABEL: Record<Lang, string> = {
  sq: 'Shqip',
  en: 'English',
};

const sq = {
  // ---- Chrome: navigation, shell, generic actions ----------------------
  'nav.dashboard': 'Paneli',
  'nav.invoices': 'Faturat',
  'nav.clients': 'Klientët',
  'nav.settings': 'Cilësimet',
  'nav.subscription': 'Abonimi',
  'nav.newInvoice': 'Faturë e re',
  'nav.newInvoiceShort': '+ Faturë e re',
  'nav.signOut': 'Dil',
  'nav.adminConsole': 'Paneli i administratorit',
  'nav.backToApp': 'Kthehu te aplikacioni',
  'nav.menu': 'Menyja',
  'nav.close': 'Mbyll',
  'nav.language': 'Gjuha',
  'nav.accountMenu': 'Menuja e llogarisë',
  'nav.yourBusiness': 'Biznesi yt',
  'nav.signOutAccount': 'Dil nga llogaria',
  'plan.freeBadge': 'FALAS',
  'plan.proBadge': 'PRO',
  'sub.activeUntil': 'Aktiv deri më {date}.',
  'sub.unlimitedInvoices': 'Fatura të palimituara.',
  'usage.remaining': '{left} nga {max} fatura të mbetura këtë muaj',

  'action.save': 'Ruaj',
  'action.saveChanges': 'Ruaj ndryshimet',
  'action.cancel': 'Anulo',
  'action.delete': 'Fshi',
  'action.edit': 'Ndrysho',
  'action.back': 'Kthehu',
  'action.search': 'Kërko',
  'action.retry': 'Provo sërish',
  'action.copy': 'Kopjo',
  'action.copied': 'U kopjua',
  'action.close': 'Mbyll',
  'action.confirm': 'Konfirmo',

  'common.loading': 'Duke u ngarkuar…',
  'common.none': 'Asnjë',
  'common.all': 'Të gjitha',
  'common.yes': 'Po',
  'common.no': 'Jo',
  'common.optional': 'opsionale',
  'common.required': 'e detyrueshme',
  'common.unexpectedError': 'Gabim i papritur.',

  // ---- Auth ------------------------------------------------------------
  'auth.loginTitle': 'Mirë se u ktheve',
  'auth.loginSubtitle': 'Hyr për të parë faturat dhe klientët e tu.',
  'auth.registerTitle': 'Krijo llogarinë falas',
  'auth.registerSubtitle': 'Fatura profesionale në 2 minuta. Pa kartë krediti.',
  'auth.email': 'Email',
  'auth.password': 'Fjalëkalimi',
  'auth.businessName': 'Emri i biznesit',
  'auth.city': 'Qyteti',
  'auth.signIn': 'Hyr',
  'auth.signUp': 'Krijo llogarinë',
  'auth.noAccount': "S'ke llogari?",
  'auth.createFree': 'Krijo një falas',
  'auth.haveAccount': 'Ke llogari?',
  'auth.signInLink': 'Hyr',
  'auth.confirmSent':
    'Të dërguam një email konfirmimi. Hape linkun për të aktivizuar llogarinë.',

  // ---- Dashboard -------------------------------------------------------
  'dash.greeting': 'Përshëndetje',
  'dash.overview': 'Përmbledhje',
  'dash.totalInvoiced': 'Faturuar gjithsej',
  'dash.paid': 'E paguar',
  'dash.unpaid': 'E papaguar',
  'dash.overdue': 'E vonuar',
  'dash.thisMonth': 'Këtë muaj',
  'dash.recentInvoices': 'Faturat e fundit',
  'dash.noInvoices': 'Ende asnjë faturë.',
  'dash.createFirst': 'Krijo faturën e parë',
  'dash.viewAll': 'Shiko të gjitha',

  // ---- Invoices --------------------------------------------------------
  'inv.title': 'Faturat',
  'inv.new': 'Faturë e re',
  'inv.edit': 'Ndrysho faturën',
  'inv.number': 'Numri i faturës',
  'inv.client': 'Klienti',
  'inv.status': 'Statusi',
  'inv.issueDate': 'Data e lëshimit',
  'inv.dueDate': 'Afati i pagesës',
  'inv.language': 'Gjuha e faturës',
  'inv.details': 'Të dhënat e faturës',
  'inv.items': 'Artikujt',
  'inv.description': 'Përshkrimi',
  'inv.descriptionPlaceholder': 'Përshkrimi i shërbimit ose produktit',
  'inv.quantity': 'Sasia',
  'inv.price': 'Çmimi',
  'inv.amount': 'Vlera',
  'inv.addItem': 'Shto artikull',
  'inv.notes': 'Shënime',
  'inv.summary': 'Përmbledhje',
  'inv.subtotal': 'Nëntotali',
  'inv.discount': 'Zbritje',
  'inv.vat': 'TVSH',
  'inv.total': 'TOTALI',
  'inv.save': 'Ruaj faturën',
  'inv.saveDraft': 'Ruaj si draft',
  'inv.confirm': 'Konfirmo faturën',
  'inv.confirmed': 'Fatura u konfirmua.',
  'inv.created': 'Fatura u krijua.',
  'inv.saved': 'Fatura u ruajt.',
  'inv.downloadPdf': 'Shkarko PDF',
  'inv.preview': 'Shiko faturën',
  'inv.share': 'Dërgo',
  'inv.pdfNote':
    'PDF-ja krijohet në telefonin tënd. Asnjë të dhënë nuk shkon te ndonjë server i tretë.',
  'inv.searchPlaceholder': 'Kërko sipas numrit ose klientit…',
  'inv.empty': 'Asnjë faturë ende.',
  'inv.emptyHint': 'Krijo faturën e parë dhe shkarkoje si PDF në pak sekonda.',
  'inv.deleteConfirm': 'Ta fshijmë këtë faturë?',
  'inv.deleteWarning': 'Ky veprim nuk kthehet mbrapsht.',
  'inv.paidLocked': 'E paguar — përfundimtare',
  'inv.paidLockedHint': 'Një faturë e paguar nuk mund të kthehet në një gjendje tjetër.',
  'adm.invoiceActivity': 'Aktiviteti i faturave',
  'adm.manager': 'Menaxher',
  'adm.makeManager': 'Bëje menaxher',
  'adm.removeManager': 'Hiq nga menaxher',
  'inv.markPaid': 'Shëno si të paguar',
  'inv.markUnpaid': 'Hiq shënimin e pagesës',
  'inv.paidOn': 'Paguar më {date}',
  'inv.payment': 'Pagesa',
  'inv.notPaidYet': 'Ende e papaguar',
  'inv.overdueBy': 'Vonuar me {n} ditë',
  'inv.dueOn': 'Afati: {date}',
  'inv.markPaidFailed': 'Ndryshimi i pagesës dështoi.',
  'inv.staleReload': 'Faqja u përditësua ndërkohë. Rifreskoje për të shkarkuar PDF-në.',
  'inv.reloadPage': 'Rifresko faqen',
  'inv.clientPlaceholder': 'Zgjidh klientin…',
  'inv.clientNameLabel': 'Emri i klientit',
  'inv.saveClient': 'Ruaj klientin',
  'inv.noDueDate': 'Pa afat',
  'inv.notesPlaceholder': 'p.sh. Pagesa kryhet me transfertë bankare në llogarinë ...',
  'inv.clientAdded': 'Klienti u shtua.',
  'inv.pdfDownloaded': 'PDF-ja u shkarkua.',
  'inv.itemDescriptionAria': 'Përshkrimi i artikullit {n}',
  'inv.itemQtyAria': 'Sasia e artikullit {n}',
  'inv.itemPriceAria': 'Çmimi i artikullit {n}',
  'inv.itemDeleteAria': 'Fshi artikullin {n}',
  'inv.errNumberRequired': 'Numri i faturës është i detyrueshëm.',
  'inv.errClientRequired': 'Zgjidh një klient për faturën.',
  'inv.errIssueDateRequired': 'Data e lëshimit është e detyrueshme.',
  'inv.errNoItems': 'Shto të paktën një artikull me përshkrim.',
  'inv.errSessionExpired': 'Sesioni skadoi. Hyr sërish.',
  'inv.errNumberTaken': 'Numri "{number}" është përdorur tashmë. Ndrysho numrin e faturës.',
  'inv.errQuota': 'Ke arritur limitin e planit falas për këtë muaj. Kalo në Pro për fatura të palimituara.',
  'inv.errPdfFailed': 'PDF-ja dështoi',
  'inv.errShareFailed': 'Ndarja dështoi',
  'inv.errPreviewFailed': 'Hapja e faturës dështoi',
  'inv.warnLimitReached': 'Ke arritur limitin e planit falas për këtë muaj. Mund ta shkarkosh PDF-në, por ruajtja do të dështojë derisa të kalosh në Pro.',
  'inv.warnProfileIncomplete': 'Të dhënat e biznesit janë të paplota.',
  'inv.warnProfileLink': 'Plotëso NIPT-in dhe logon',
  'inv.warnProfileTail': 'që fatura të dalë profesionale.',

  'status.draft': 'Draft',
  'status.unpaid': 'E papaguar',
  'status.paid': 'E paguar',
  'status.overdue': 'E vonuar',

  // ---- Clients ---------------------------------------------------------
  'cli.title': 'Klientët',
  'cli.new': 'Klient i ri',
  'cli.name': 'Emri',
  'cli.nipt': 'NIPT',
  'cli.address': 'Adresa',
  'cli.city': 'Qyteti',
  'cli.email': 'Email',
  'cli.phone': 'Telefoni',
  'cli.empty': 'Asnjë klient ende.',
  'cli.emptyHint': 'Shto klientët një herë dhe zgjidhi me një klik në çdo faturë.',
  'cli.searchPlaceholder': 'Kërko klient…',
  'cli.deleteConfirm': 'Ta fshijmë këtë klient?',
  'cli.saved': 'Klienti u ruajt.',

  // ---- Settings --------------------------------------------------------
  'set.title': 'Cilësimet',
  'set.business': 'Të dhënat e biznesit',
  'set.businessHint': 'Këto dalin në krye të çdo fature.',
  'set.logo': 'Logo',
  'set.logoUpload': 'Ngarko logo',
  'set.logoChange': 'Ndrysho logon',
  'set.logoRemove': 'Hiq logon',
  'set.logoCrop': 'Prit dhe rregullo',
  'set.account': 'Llogaria',
  'set.plan': 'Plani',
  'set.saved': 'Cilësimet u ruajtën.',
  'pw.section': 'Fjalëkalimi',
  'pw.sectionHint': 'Ndrysho fjalëkalimin e llogarisë tënde.',
  'pw.new': 'Fjalëkalimi i ri',
  'pw.confirm': 'Përsërite fjalëkalimin',
  'pw.submit': 'Ndrysho fjalëkalimin',
  'pw.show': 'Shfaq fjalëkalimin',
  'pw.hide': 'Fshih fjalëkalimin',
  'pw.updated': 'Fjalëkalimi u ndryshua.',
  'pw.hint': 'Të paktën {n} karaktere. Do të të duhet ky fjalëkalim herës tjetër që hyn.',
  'pw.errTooShort': 'Fjalëkalimi duhet të ketë të paktën {n} karaktere.',
  'pw.errMismatch': 'Fjalëkalimet nuk përputhen.',

  // ---- Subscription ----------------------------------------------------
  'sub.title': 'Abonimi',
  'sub.yourSubscription': 'Abonimi yt',
  'sub.upgrade': 'Kalo në Pro',
  'sub.tagline': 'Fatura të palimituara për 2000 Lekë në muaj. Anulo kur të duash.',
  'sub.yourPlan': 'Plani yt',
  'sub.planFree': 'Falas',
  'sub.planPro': 'Pro',
  'sub.active': 'Aktiv',
  'sub.notRenewing': 'Nuk rinovohet',
  'sub.extend': 'Zgjat abonimin',
  'sub.cancel': 'Anulo abonimin',
  'sub.resume': 'Rikthe abonimin',
  'sub.daysToRenewal': 'ditë deri në rinovim',
  'sub.daysLeft': 'ditë të mbetura',
  'sub.details': 'Detajet e abonimit',
  'sub.renewsOn': 'Rinovohet më',
  'sub.endsOn': 'Mbaron më',
  'sub.paymentMethod': 'Mënyra e pagesës',
  'sub.invoicesThisMonth': 'Fatura këtë muaj',
  'sub.unlimitedInPro': 'pa limit në Pro',
  'sub.chooseTerm': 'Zgjidh kohëzgjatjen',
  'sub.extendHowLong': 'Sa gjatë do ta zgjatësh?',
  'sub.whatProIncludes': 'Çfarë përfshin Pro',
  'sub.paymentHistory': 'Historiku i pagesave',
  'sub.transferDetails': 'Të dhënat e transfertës',
  'sub.getReference': 'Merr referencën e pagesës',
  'sub.beneficiary': 'Përfituesi',
  'sub.bank': 'Banka',
  'sub.amount': 'Shuma',
  'sub.reference': 'Përshkrimi (i detyrueshëm)',
  'sub.monthly': 'Abonim mujor',
  'sub.yearly': 'Abonim vjetor',
  'sub.bestValue': 'Më i mirë',

  'pay.bankTransfer': 'Transfertë bankare',
  'pay.card': 'Kartë',
  'pay.paypal': 'PayPal',
  'pay.pending': 'Në pritje',
  'pay.confirmed': 'E konfirmuar',
  'pay.rejected': 'E refuzuar',
  'pay.refunded': 'E rimbursuar',

  // ---- Admin console ---------------------------------------------------
  'adm.console': 'Konsola',
  'adm.overview': 'Përmbledhje',
  'adm.users': 'Përdoruesit',
  'adm.payments': 'Pagesat',
  'adm.waitlist': 'Lista e pritjes',
  'adm.audit': 'Regjistri',
  'adm.totalUsers': 'Përdorues gjithsej',
  'adm.proUsers': 'Përdorues Pro',
  'adm.cancelling': 'Në anulim',
  'adm.mrr': 'MRR',
  'adm.revenue': 'Të ardhura',
  'adm.pendingPayments': 'Pagesa në pritje',
  'adm.totalInvoices': 'Fatura gjithsej',
  'adm.activeUsers': 'Përdorues aktivë',
  'adm.newUsers': 'Përdorues të rinj',
  'adm.last30d': '30 ditët e fundit',
  'adm.last7d': '7 ditët e fundit',
  'adm.approve': 'Aprovo',
  'adm.reject': 'Refuzo',
  'adm.grantPro': 'Jep Pro',
  'adm.revokePro': 'Hiq Pro',
  'adm.makeAdmin': 'Bëje admin',
  'adm.removeAdmin': 'Hiq nga admin',
  'adm.deleteUser': 'Fshi përdoruesin',
  'adm.business': 'Biznesi',
  'adm.joined': 'U regjistrua',
  'adm.actions': 'Veprime',
  'adm.noResults': 'Asnjë rezultat.',
  'adm.notifications': 'Njoftimet',
  'adm.viewAll': 'Shiko të gjitha',
  'adm.confirmPaymentPrompt': 'Konfirmo që pagesa ka mbërritur në llogari. Kjo aktivizon Pro-n.',
  'adm.thisWeek': '+{n} këtë javë',
  'adm.conversion': '{n}% konvertim',
  'adm.ofBase': '{n}% e bazës',
  'adm.signupsLegend': 'Regjistrime',
  'adm.noPending': 'Asnjë pagesë në pritje.',
  'adm.businessesHint': 'emri dhe qyteti — pa NIPT apo kontakte',
  'adm.newIn7d': 'Të rinj (7 ditë)',
  'adm.newIn30d': 'Të rinj (30 ditë)',
  'adm.activeIn7d': 'Aktivë (7 ditë)',
  'adm.waitlist7d': 'Listë pritjeje (7 ditë)',
  'adm.privacyNote': 'Kjo faqe lexon vetëm shifra të përmbledhura. Faturat, NIPT-et dhe kontaktet e bizneseve mbeten të palexueshme — RLS nuk hiqet për adminët.',
  'adm.overviewPageTitle': 'Përmbledhje — Admin Fatura.co',
  'adm.perSubscriberHint': '2000 Lekë / abonent',
  'adm.noBusinesses': 'Ende asnjë biznes i regjistruar.',
  'adm.city': 'Qyteti',
  'adm.registered': 'Regjistruar',
  'adm.noName': 'pa emër',
  'adm.overviewTitle': 'Përmbledhje e platformës',
  'adm.overviewSub': 'Gjendja e sistemit në një vështrim.',
  'adm.usersTotal': 'Përdorues gjithsej',
  'adm.proSubscribers': 'Abonentë Pro',
  'adm.perSubscriber': '2000 Lekë / abonent',
  'adm.active30d': 'Aktivë (30 ditë)',
  'adm.collectedTotal': 'Arkëtuar gjithsej',
  'adm.collected30d': 'Arkëtuar (30 ditë)',
  'adm.invoicesTotal': 'Fatura gjithsej',
  'adm.invoices30d': 'Fatura (30 ditë)',
  'adm.invoicedValue': 'Vlera e faturuar',
  'adm.invoicedPaid': 'Prej saj e paguar',
  'adm.clientsSaved': 'Klientë të ruajtur',
  'adm.profileComplete': 'Kanë plotësuar profilin',
  'adm.uploadedLogo': 'Kanë ngarkuar logo',
  'adm.activity30d': 'Aktiviteti — 30 ditët e fundit',
  'adm.recentBusinesses': 'Bizneset e fundit',
  'adm.otherNumbers': 'Statistika të tjera',
  'adm.revenueSection': 'Të ardhurat',
  'adm.growth': 'Rritja',
  'adm.noData': 'Ende pa të dhëna.',
  'adm.signups': 'regjistrime',
  'adm.invoicesWord': 'fatura',

  // ---- Marketing -------------------------------------------------------
  'mk.login': 'Hyr',
  'mk.startFree': 'Fillo falas',
  'mk.goToApp': 'Shko te paneli',
  'mk.howItWorks': 'Si funksionon',
  'mk.features': 'Veçoritë',
  'mk.pricing': 'Çmimet',
  'mk.faq': 'Pyetje të shpeshta',
  'mk.terms': 'Kushtet e përdorimit',
  'mk.privacy': 'Privatësia',
  'mk.createAccount': 'Krijo llogari',
} as const;

export type TranslationKey = keyof typeof sq;

const en: Record<TranslationKey, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.invoices': 'Invoices',
  'nav.clients': 'Clients',
  'nav.settings': 'Settings',
  'nav.subscription': 'Subscription',
  'nav.newInvoice': 'New invoice',
  'nav.newInvoiceShort': '+ New invoice',
  'nav.signOut': 'Sign out',
  'nav.adminConsole': 'Admin console',
  'nav.backToApp': 'Back to the app',
  'nav.menu': 'Menu',
  'nav.close': 'Close',
  'nav.language': 'Language',
  'nav.accountMenu': 'Account menu',
  'nav.yourBusiness': 'Your business',
  'nav.signOutAccount': 'Sign out',
  'plan.freeBadge': 'FREE',
  'plan.proBadge': 'PRO',
  'sub.activeUntil': 'Active until {date}.',
  'sub.unlimitedInvoices': 'Unlimited invoices.',
  'usage.remaining': '{left} of {max} invoices left this month',

  'action.save': 'Save',
  'action.saveChanges': 'Save changes',
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.edit': 'Edit',
  'action.back': 'Back',
  'action.search': 'Search',
  'action.retry': 'Try again',
  'action.copy': 'Copy',
  'action.copied': 'Copied',
  'action.close': 'Close',
  'action.confirm': 'Confirm',

  'common.loading': 'Loading…',
  'common.none': 'None',
  'common.all': 'All',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.optional': 'optional',
  'common.required': 'required',
  'common.unexpectedError': 'Something went wrong.',

  'auth.loginTitle': 'Welcome back',
  'auth.loginSubtitle': 'Sign in to see your invoices and clients.',
  'auth.registerTitle': 'Create your free account',
  'auth.registerSubtitle': 'Professional invoices in 2 minutes. No credit card.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.businessName': 'Business name',
  'auth.city': 'City',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.noAccount': "Don't have an account?",
  'auth.createFree': 'Create one free',
  'auth.haveAccount': 'Already have an account?',
  'auth.signInLink': 'Sign in',
  'auth.confirmSent':
    'We sent you a confirmation email. Open the link to activate your account.',

  'dash.greeting': 'Hello',
  'dash.overview': 'Overview',
  'dash.totalInvoiced': 'Total invoiced',
  'dash.paid': 'Paid',
  'dash.unpaid': 'Unpaid',
  'dash.overdue': 'Overdue',
  'dash.thisMonth': 'This month',
  'dash.recentInvoices': 'Recent invoices',
  'dash.noInvoices': 'No invoices yet.',
  'dash.createFirst': 'Create your first invoice',
  'dash.viewAll': 'View all',

  'inv.title': 'Invoices',
  'inv.new': 'New invoice',
  'inv.edit': 'Edit invoice',
  'inv.number': 'Invoice number',
  'inv.client': 'Client',
  'inv.status': 'Status',
  'inv.issueDate': 'Issue date',
  'inv.dueDate': 'Due date',
  'inv.language': 'Invoice language',
  'inv.details': 'Invoice details',
  'inv.items': 'Items',
  'inv.description': 'Description',
  'inv.descriptionPlaceholder': 'Service or product description',
  'inv.quantity': 'Qty',
  'inv.price': 'Price',
  'inv.amount': 'Amount',
  'inv.addItem': 'Add item',
  'inv.notes': 'Notes',
  'inv.summary': 'Summary',
  'inv.subtotal': 'Subtotal',
  'inv.discount': 'Discount',
  'inv.vat': 'VAT',
  'inv.total': 'TOTAL',
  'inv.save': 'Save invoice',
  'inv.saveDraft': 'Save as draft',
  'inv.confirm': 'Confirm invoice',
  'inv.confirmed': 'Invoice confirmed.',
  'inv.created': 'Invoice created.',
  'inv.saved': 'Invoice saved.',
  'inv.downloadPdf': 'Download PDF',
  'inv.preview': 'View invoice',
  'inv.share': 'Send',
  'inv.pdfNote':
    'The PDF is generated on your own device. No data is sent to a third-party server.',
  'inv.searchPlaceholder': 'Search by number or client…',
  'inv.empty': 'No invoices yet.',
  'inv.emptyHint': 'Create your first invoice and download it as a PDF in seconds.',
  'inv.deleteConfirm': 'Delete this invoice?',
  'inv.deleteWarning': 'This cannot be undone.',
  'inv.paidLocked': 'Paid — final',
  'inv.paidLockedHint': 'A paid invoice cannot be moved back to another state.',
  'adm.invoiceActivity': 'Invoice activity',
  'adm.manager': 'Manager',
  'adm.makeManager': 'Make manager',
  'adm.removeManager': 'Remove manager',
  'inv.markPaid': 'Mark as paid',
  'inv.markUnpaid': 'Mark as unpaid',
  'inv.paidOn': 'Paid on {date}',
  'inv.payment': 'Payment',
  'inv.notPaidYet': 'Not paid yet',
  'inv.overdueBy': '{n} days overdue',
  'inv.dueOn': 'Due {date}',
  'inv.markPaidFailed': 'Could not update the payment.',
  'inv.staleReload': 'The page was updated in the meantime. Refresh it to download the PDF.',
  'inv.reloadPage': 'Refresh the page',
  'inv.clientPlaceholder': 'Choose a client…',
  'inv.clientNameLabel': 'Client name',
  'inv.saveClient': 'Save client',
  'inv.noDueDate': 'No due date',
  'inv.notesPlaceholder': 'e.g. Payment by bank transfer to account ...',
  'inv.clientAdded': 'Client added.',
  'inv.pdfDownloaded': 'PDF downloaded.',
  'inv.itemDescriptionAria': 'Description of item {n}',
  'inv.itemQtyAria': 'Quantity of item {n}',
  'inv.itemPriceAria': 'Price of item {n}',
  'inv.itemDeleteAria': 'Delete item {n}',
  'inv.errNumberRequired': 'The invoice number is required.',
  'inv.errClientRequired': 'Choose a client for this invoice.',
  'inv.errIssueDateRequired': 'The issue date is required.',
  'inv.errNoItems': 'Add at least one item with a description.',
  'inv.errSessionExpired': 'Your session expired. Sign in again.',
  'inv.errNumberTaken': 'Number "{number}" is already in use. Choose a different one.',
  'inv.errQuota': 'You have reached the free plan limit for this month. Upgrade to Pro for unlimited invoices.',
  'inv.errPdfFailed': 'The PDF failed',
  'inv.errShareFailed': 'Sharing failed',
  'inv.errPreviewFailed': 'Opening the invoice failed',
  'inv.warnLimitReached': 'You have reached the free plan limit for this month. You can still download the PDF, but saving will fail until you upgrade to Pro.',
  'inv.warnProfileIncomplete': 'Your business details are incomplete.',
  'inv.warnProfileLink': 'Add your VAT number and logo',
  'inv.warnProfileTail': 'so the invoice looks professional.',

  'status.draft': 'Draft',
  'status.unpaid': 'Unpaid',
  'status.paid': 'Paid',
  'status.overdue': 'Overdue',

  'cli.title': 'Clients',
  'cli.new': 'New client',
  'cli.name': 'Name',
  'cli.nipt': 'VAT no. (NIPT)',
  'cli.address': 'Address',
  'cli.city': 'City',
  'cli.email': 'Email',
  'cli.phone': 'Phone',
  'cli.empty': 'No clients yet.',
  'cli.emptyHint': 'Add clients once and pick them with one click on every invoice.',
  'cli.searchPlaceholder': 'Search clients…',
  'cli.deleteConfirm': 'Delete this client?',
  'cli.saved': 'Client saved.',

  'set.title': 'Settings',
  'set.business': 'Business details',
  'set.businessHint': 'These appear at the top of every invoice.',
  'set.logo': 'Logo',
  'set.logoUpload': 'Upload logo',
  'set.logoChange': 'Change logo',
  'set.logoRemove': 'Remove logo',
  'set.logoCrop': 'Crop and adjust',
  'set.account': 'Account',
  'set.plan': 'Plan',
  'set.saved': 'Settings saved.',
  'pw.section': 'Password',
  'pw.sectionHint': 'Change your account password.',
  'pw.new': 'New password',
  'pw.confirm': 'Repeat the password',
  'pw.submit': 'Change password',
  'pw.show': 'Show password',
  'pw.hide': 'Hide password',
  'pw.updated': 'Password changed.',
  'pw.hint': 'At least {n} characters. You will need this password next time you sign in.',
  'pw.errTooShort': 'The password must be at least {n} characters.',
  'pw.errMismatch': 'The passwords do not match.',

  'sub.title': 'Subscription',
  'sub.yourSubscription': 'Your subscription',
  'sub.upgrade': 'Upgrade to Pro',
  'sub.tagline': 'Unlimited invoices for 2000 Lekë a month. Cancel anytime.',
  'sub.yourPlan': 'Your plan',
  'sub.planFree': 'Free',
  'sub.planPro': 'Pro',
  'sub.active': 'Active',
  'sub.notRenewing': 'Not renewing',
  'sub.extend': 'Extend subscription',
  'sub.cancel': 'Cancel subscription',
  'sub.resume': 'Resume subscription',
  'sub.daysToRenewal': 'days until renewal',
  'sub.daysLeft': 'days left',
  'sub.details': 'Subscription details',
  'sub.renewsOn': 'Renews on',
  'sub.endsOn': 'Ends on',
  'sub.paymentMethod': 'Payment method',
  'sub.invoicesThisMonth': 'Invoices this month',
  'sub.unlimitedInPro': 'unlimited on Pro',
  'sub.chooseTerm': 'Choose a term',
  'sub.extendHowLong': 'How long do you want to extend?',
  'sub.whatProIncludes': "What's included in Pro",
  'sub.paymentHistory': 'Payment history',
  'sub.transferDetails': 'Bank transfer details',
  'sub.getReference': 'Get a payment reference',
  'sub.beneficiary': 'Beneficiary',
  'sub.bank': 'Bank',
  'sub.amount': 'Amount',
  'sub.reference': 'Reference (required)',
  'sub.monthly': 'Monthly plan',
  'sub.yearly': 'Yearly plan',
  'sub.bestValue': 'Best value',

  'pay.bankTransfer': 'Bank transfer',
  'pay.card': 'Card',
  'pay.paypal': 'PayPal',
  'pay.pending': 'Pending',
  'pay.confirmed': 'Confirmed',
  'pay.rejected': 'Rejected',
  'pay.refunded': 'Refunded',

  'adm.console': 'Console',
  'adm.overview': 'Overview',
  'adm.users': 'Users',
  'adm.payments': 'Payments',
  'adm.waitlist': 'Waitlist',
  'adm.audit': 'Audit log',
  'adm.totalUsers': 'Total users',
  'adm.proUsers': 'Pro users',
  'adm.cancelling': 'Cancelling',
  'adm.mrr': 'MRR',
  'adm.revenue': 'Revenue',
  'adm.pendingPayments': 'Pending payments',
  'adm.totalInvoices': 'Total invoices',
  'adm.activeUsers': 'Active users',
  'adm.newUsers': 'New users',
  'adm.last30d': 'Last 30 days',
  'adm.last7d': 'Last 7 days',
  'adm.approve': 'Approve',
  'adm.reject': 'Reject',
  'adm.grantPro': 'Grant Pro',
  'adm.revokePro': 'Revoke Pro',
  'adm.makeAdmin': 'Make admin',
  'adm.removeAdmin': 'Remove admin',
  'adm.deleteUser': 'Delete user',
  'adm.business': 'Business',
  'adm.joined': 'Joined',
  'adm.actions': 'Actions',
  'adm.noResults': 'No results.',
  'adm.notifications': 'Notifications',
  'adm.viewAll': 'View all',
  'adm.confirmPaymentPrompt': 'Confirm the payment has arrived in the account. This activates Pro.',
  'adm.thisWeek': '+{n} this week',
  'adm.conversion': '{n}% conversion',
  'adm.ofBase': '{n}% of the base',
  'adm.signupsLegend': 'Signups',
  'adm.noPending': 'No pending payments.',
  'adm.businessesHint': 'name and city — no VAT number or contacts',
  'adm.newIn7d': 'New (7 days)',
  'adm.newIn30d': 'New (30 days)',
  'adm.activeIn7d': 'Active (7 days)',
  'adm.waitlist7d': 'Waitlist (7 days)',
  'adm.privacyNote': 'This page reads aggregate figures only. Invoices, VAT numbers and business contacts stay unreadable — RLS is never lifted for admins.',
  'adm.overviewPageTitle': 'Overview — Fatura.co admin',
  'adm.perSubscriberHint': '2000 Lekë / subscriber',
  'adm.noBusinesses': 'No businesses registered yet.',
  'adm.city': 'City',
  'adm.registered': 'Registered',
  'adm.noName': 'no name',
  'adm.overviewTitle': 'Platform overview',
  'adm.overviewSub': 'The state of the system at a glance.',
  'adm.usersTotal': 'Total users',
  'adm.proSubscribers': 'Pro subscribers',
  'adm.perSubscriber': '2000 Lekë / subscriber',
  'adm.active30d': 'Active (30 days)',
  'adm.collectedTotal': 'Collected in total',
  'adm.collected30d': 'Collected (30 days)',
  'adm.invoicesTotal': 'Total invoices',
  'adm.invoices30d': 'Invoices (30 days)',
  'adm.invoicedValue': 'Invoiced value',
  'adm.invoicedPaid': 'Of which paid',
  'adm.clientsSaved': 'Saved clients',
  'adm.profileComplete': 'Completed their profile',
  'adm.uploadedLogo': 'Uploaded a logo',
  'adm.activity30d': 'Activity — last 30 days',
  'adm.recentBusinesses': 'Recent businesses',
  'adm.otherNumbers': 'Other statistics',
  'adm.revenueSection': 'Revenue',
  'adm.growth': 'Growth',
  'adm.noData': 'No data yet.',
  'adm.signups': 'signups',
  'adm.invoicesWord': 'invoices',

  'mk.login': 'Log in',
  'mk.startFree': 'Start free',
  'mk.goToApp': 'Go to dashboard',
  'mk.howItWorks': 'How it works',
  'mk.features': 'Features',
  'mk.pricing': 'Pricing',
  'mk.faq': 'FAQ',
  'mk.terms': 'Terms of use',
  'mk.privacy': 'Privacy',
  'mk.createAccount': 'Create account',
};

const DICT: Record<Lang, Record<TranslationKey, string>> = { sq, en };

/**
 * Look up a string. `vars` fills `{name}` placeholders.
 *
 * Falls back to Albanian and then to the key itself rather than throwing —
 * a missing string should never take a page down, and the key showing through
 * makes the gap obvious in review.
 */
export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const table = DICT[lang] ?? DICT[DEFAULT_LANG];
  let out: string = table[key] ?? DICT[DEFAULT_LANG][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}

/** Bind a language once: `const t = useTranslations(lang)` then `t('nav.invoices')`. */
export function useTranslations(lang: Lang) {
  return (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);
}

/**
 * Pick a language for a request. Explicit choice beats browser preference, and
 * Albanian wins ties — this is an Albanian product first.
 */
export function resolveLang(
  cookieValue: string | undefined,
  acceptLanguage: string | null | undefined
): Lang {
  // Only honour a cookie naming a language that is currently offered — a stale
  // `en` cookie from before must not strand someone in a language the
  // switcher no longer shows.
  if (isSelectableLang(cookieValue)) return cookieValue;

  if (acceptLanguage) {
    // Only switch to English when it is preferred *over* Albanian.
    const entries = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag, ...params] = part.trim().split(';');
        const q = params.find((p) => p.trim().startsWith('q='));
        return { tag: tag.toLowerCase(), q: q ? Number(q.split('=')[1]) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { tag } of entries) {
      if (isSelectableLang(tag.slice(0, 2))) return tag.slice(0, 2) as Lang;
    }
  }

  return DEFAULT_LANG;
}

/**
 * Language of a prerendered marketing route, taken from its own URL.
 * `/en` and `/en/...` are English; everything else is Albanian.
 */
export function langFromPath(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : DEFAULT_LANG;
}

/** The same page in the other language, for the marketing switcher. */
export function alternatePath(pathname: string, target: Lang): string {
  const stripped = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  if (target === 'en') return stripped === '/' ? '/en' : `/en${stripped}`;
  return stripped;
}

/* =====================================================================
   Invoice document strings

   Separate from the interface dictionary above on purpose: this is the
   language of the *printed document*, chosen per invoice (an Albanian
   business invoicing a foreign client sets that one invoice to English while
   their own UI stays Albanian). Changing the interface language must never
   silently re-language a customer's issued paperwork.

   Consumed by src/lib/pdf.ts as `t(invoice.language)`.
   ===================================================================== */

export interface InvoiceStrings {
  invoice: string;
  from: string;
  billTo: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  nipt: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  discount: string;
  vat: string;
  total: string;
  notes: string;
  status: string;
  thanks: string;
  generatedWith: string;
  currency: string;
  statuses: { draft: string; paid: string; unpaid: string; overdue: string };
}

const INVOICE_STRINGS: Record<Lang, InvoiceStrings> = {
  "sq": {
    "invoice": "FATURË",
    "from": "Nga",
    "billTo": "Faturuar për",
    "invoiceNo": "Fatura Nr.",
    "issueDate": "Data e lëshimit",
    "dueDate": "Afati i pagesës",
    "nipt": "NIPT",
    "description": "Përshkrimi",
    "qty": "Sasia",
    "unitPrice": "Çmimi",
    "amount": "Vlera",
    "subtotal": "Nëntotali",
    "discount": "Zbritje",
    "vat": "TVSH",
    "total": "TOTALI",
    "notes": "Shënime",
    "status": "Statusi",
    "thanks": "Faleminderit për bashkëpunimin!",
    "generatedWith": "Krijuar me Fatura.co",
    "currency": "Lekë",
    "statuses": {
      "draft": "Draft",
      "paid": "E PAGUAR",
      "unpaid": "E PAPAGUAR",
      "overdue": "E VONUAR"
    }
  },
  "en": {
    "invoice": "INVOICE",
    "from": "From",
    "billTo": "Bill to",
    "invoiceNo": "Invoice No.",
    "issueDate": "Issue date",
    "dueDate": "Due date",
    "nipt": "VAT ID",
    "description": "Description",
    "qty": "Qty",
    "unitPrice": "Unit price",
    "amount": "Amount",
    "subtotal": "Subtotal",
    "discount": "Discount",
    "vat": "VAT",
    "total": "TOTAL",
    "notes": "Notes",
    "status": "Status",
    "thanks": "Thank you for your business!",
    "generatedWith": "Created with Fatura.co",
    "currency": "ALL",
    "statuses": {
      "draft": "DRAFT",
      "paid": "PAID",
      "unpaid": "UNPAID",
      "overdue": "OVERDUE"
    }
  }
};

/** Document strings for one invoice. Defaults to Albanian for anything odd. */
export function t(lang: string): InvoiceStrings {
  return INVOICE_STRINGS[isLang(lang) ? lang : DEFAULT_LANG];
}
