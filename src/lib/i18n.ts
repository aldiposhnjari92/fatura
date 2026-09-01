/*
  Interface copy for Fatura.co.

  This was a bilingual dictionary with a language switcher, an interface-language
  cookie and per-language marketing routes. Fatura.co offers one language —
  Albanian — so the whole selection layer is gone: no switcher, no cookie, no
  Accept-Language negotiation, no `/en` routes. What remains is the strings
  themselves and a lookup that fills `{name}` placeholders.

  Call it the same way as before: `const t = useTranslations()`, then
  `t('nav.invoices')`.
*/

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
  'inv.errQuota': 'Ke arritur limitin e planit tënd për këtë muaj. Kalo në një plan më të lartë për më shumë fatura.',
  'inv.errPdfFailed': 'PDF-ja dështoi',
  'inv.errShareFailed': 'Ndarja dështoi',
  'inv.errPreviewFailed': 'Hapja e faturës dështoi',
  'inv.warnLimitReached': 'Ke arritur limitin e planit tënd për këtë muaj. Mund ta shkarkosh PDF-në, por ruajtja do të dështojë derisa të kalosh në një plan më të lartë.',
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

  // ---- Action feedback (toasts) ---------------------------------------
  // Every toast is a title plus a description. The title is what happened; the
  // description says what it means, so it never just restates the title.
  'inv.deleted': 'Fatura u fshi.',
  'inv.shared': 'Fatura u shpërnda.',
  'inv.previewOpened': 'Fatura u hap në një skedë të re.',
  'inv.markedPaid': 'Fatura u shënua si e paguar.',
  'inv.markedUnpaid': 'Fatura u shënua si e papaguar.',
  'adm.paymentApproved': 'Pagesa u konfirmua.',
  'adm.paymentRejected': 'Pagesa u refuzua.',

  'inv.savedDesc': 'Ndryshimet në faturën {number} u ruajtën.',
  'inv.createdDesc': 'Fatura {number} u shtua në listën tënde.',
  'inv.confirmedDesc': 'Fatura {number} u lëshua dhe pret pagesën.',
  'inv.clientAddedDesc': '{name} u zgjodh për këtë faturë.',
  'inv.pdfDownloadedDesc': 'Fatura {number} u ruajt në pajisjen tënde.',
  'inv.sharedDesc': 'Fatura {number} u dërgua me aplikacionin që zgjodhe.',
  'inv.previewOpenedDesc': 'Kjo është vetëm parapamje — fatura nuk u ruajt.',
  'inv.markedPaidDesc': 'Pagesa u regjistrua më {date}.',
  'inv.markedUnpaidDesc': 'Fatura kthehet te pagesat në pritje.',
  'adm.paymentApprovedDesc': 'Abonimi i përdoruesit u aktivizua.',
  'adm.paymentRejectedDesc': 'Abonimi nuk u aktivizua.',
  'pw.updatedDesc': 'Herën tjetër hyr me fjalëkalimin e ri.',

  // Error titles. The failure message itself becomes the description.
  'inv.errSaveTitle': 'Fatura nuk u ruajt',
  'inv.errClientTitle': 'Klienti nuk u shtua',
  'pw.errTitle': 'Fjalëkalimi nuk u ndryshua',
  'adm.errPaymentTitle': 'Vendimi nuk u regjistrua',

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
  'sub.upgradeStarter': 'Kalo në Starter',
  'plan.starterBadge': 'STARTER',
  'sub.tagline': 'Starter 1000 Lekë/muaj për 30 fatura, Pro 2000 Lekë/muaj pa limit. Anulo kur të duash.',
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
  'adm.perSubscriberHint': 'Starter {starter} · Pro {pro}',
  'adm.noBusinesses': 'Ende asnjë biznes i regjistruar.',
  'adm.city': 'Qyteti',
  'adm.registered': 'Regjistruar',
  'adm.noName': 'pa emër',
  'adm.overviewTitle': 'Përmbledhje e platformës',
  'adm.overviewSub': 'Gjendja e sistemit në një vështrim.',
  'adm.usersTotal': 'Përdorues gjithsej',
  'adm.proSubscribers': 'Abonentë me pagesë',
  'adm.perSubscriber': 'Starter {starter} · Pro {pro}',
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

/**
 * Look up a string. `vars` fills `{name}` placeholders.
 *
 * Falls back to the key itself rather than throwing — a missing string should
 * never take a page down, and the key showing through makes the gap obvious in
 * review.
 */
export function translate(
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  let out: string = sq[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}

/** `const t = useTranslations()` then `t('nav.invoices')`. */
export function useTranslations() {
  return (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(key, vars);
}

/* =====================================================================
   Invoice document strings

   Kept separate from the interface dictionary above because it is the wording
   of a legal-ish document rather than of a screen: these strings are printed
   on paper a customer sends to their client, so they change on a different
   schedule and under different scrutiny.

   Consumed by src/lib/pdf.ts as `invoiceStrings()`. Invoices used to carry a
   per-document language; every invoice is Albanian now.
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

const INVOICE_STRINGS: InvoiceStrings = {
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
};

/** Wording printed on the invoice PDF. */
export function invoiceStrings(): InvoiceStrings {
  return INVOICE_STRINGS;
}
