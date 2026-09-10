import type { LocaleCode, TranslationResource } from "./types";

const en = {
  "language.selectorLabel": "Select interface language",
  "language.saved": "Language preference saved",
  "common.signIn": "Sign In",
  "common.signOut": "Sign Out",
  "common.loading": "Loading…",
  "common.close": "Close",
  "landing.headline": "Where evidence becomes opportunity.",
  "landing.body": "Turn resumes, code repositories, and assessments into evidence-linked skill records—then discover opportunities through transparent, deterministic matching.",
  "landing.cta": "Find my dream",
  "roles.student": "Student",
  "roles.recruiter": "Recruiter",
  "roles.faculty": "Faculty",
  "roles.institution": "Institution",
  "match.aria": "Deterministic match explanation",
  "match.provenance": "Algorithmic provenance breakdown",
  "match.title": "Deterministic Match Formula Audit",
  "match.subtitle": "Rendered directly from persisted database evidence records and exact scoring formulas.",
  "match.exact": "Exact Overlap (D)",
  "match.semantic": "Semantic Match (S)",
  "match.verification": "Verified Bonus (V)",
  "match.semanticNoteTitle": "Note on Semantic Near-Matches:",
  "match.semanticNote": "Semantic similarity indicates conceptual closeness based on vector embeddings. It does not imply exact verified possession of the required skill.",
  "match.missing": "Missing",
  "match.supportedBy": "Supported by evidence: {{title}}",
  "match.points": "+{{count}} pts",
  "match.exactSkills": "Verified & Exact Matched Skills ({{count}})",
  "match.semanticSkills": "Semantic Near-Matches ({{count}})",
  "match.missingSkills": "Missing Skill Requirements ({{count}})",
  "match.final": "Final Audit Score",
  "match.finalValue": "{{value}}% Final Score",
};

const localizedCore: Record<Exclude<LocaleCode, "en">, Record<string, string>> = {
  as: { "language.selectorLabel": "আন্তঃপৃষ্ঠাৰ ভাষা বাছনি কৰক", "common.signIn": "প্ৰৱেশ কৰক", "common.signOut": "প্ৰস্থান কৰক", "landing.headline": "য'ত প্ৰমাণ সুযোগত পৰিণত হয়।", "landing.cta": "মোৰ সুযোগ বিচাৰক", "roles.student": "শিক্ষাৰ্থী", "roles.recruiter": "নিয়োগকৰ্তা", "roles.faculty": "অধ্যাপক", "roles.institution": "প্ৰতিষ্ঠান" },
  bn: { "language.selectorLabel": "ইন্টারফেসের ভাষা নির্বাচন করুন", "common.signIn": "সাইন ইন", "common.signOut": "সাইন আউট", "landing.headline": "যেখানে প্রমাণ সুযোগে পরিণত হয়।", "landing.cta": "আমার সুযোগ খুঁজুন", "roles.student": "শিক্ষার্থী", "roles.recruiter": "নিয়োগকারী", "roles.faculty": "শিক্ষক", "roles.institution": "প্রতিষ্ঠান" },
  brx: { "language.selectorLabel": "इन्टारफेसनि राव सायख", "common.signIn": "साइन इन", "common.signOut": "साइन आउट", "landing.headline": "जायगायाव फोरमान खाबुआव सोलायो।", "landing.cta": "आंनि खाबु नागिर", "roles.student": "फरायसा", "roles.recruiter": "थिसनग्रा", "roles.faculty": "फोरोंगिरि", "roles.institution": "मुलुगसोलोंसालि" },
  doi: { "language.selectorLabel": "इंटरफेस दी भाशा चुनो", "common.signIn": "साइन इन", "common.signOut": "साइन आउट", "landing.headline": "जित्थें सबूत मौका बनदा ऐ।", "landing.cta": "मेरा मौका खोजो", "roles.student": "विद्यार्थी", "roles.recruiter": "भर्ती करने आह्ला", "roles.faculty": "अध्यापक", "roles.institution": "संस्थान" },
  gu: { "language.selectorLabel": "ઇન્ટરફેસની ભાષા પસંદ કરો", "common.signIn": "સાઇન ઇન", "common.signOut": "સાઇન આઉટ", "landing.headline": "જ્યાં પુરાવો તક બને છે.", "landing.cta": "મારી તક શોધો", "roles.student": "વિદ્યાર્થી", "roles.recruiter": "ભરતીકર્તા", "roles.faculty": "અધ્યાપક", "roles.institution": "સંસ્થા" },
  hi: { "language.selectorLabel": "इंटरफ़ेस भाषा चुनें", "common.signIn": "साइन इन", "common.signOut": "साइन आउट", "landing.headline": "जहाँ प्रमाण अवसर बनता है।", "landing.cta": "मेरा अवसर खोजें", "roles.student": "विद्यार्थी", "roles.recruiter": "भर्तीकर्ता", "roles.faculty": "संकाय", "roles.institution": "संस्थान" },
  kn: { "language.selectorLabel": "ಇಂಟರ್ಫೇಸ್ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ", "common.signIn": "ಸೈನ್ ಇನ್", "common.signOut": "ಸೈನ್ ಔಟ್", "landing.headline": "ಪುರಾವೆ ಅವಕಾಶವಾಗುವ ಸ್ಥಳ.", "landing.cta": "ನನ್ನ ಅವಕಾಶ ಹುಡುಕಿ", "roles.student": "ವಿದ್ಯಾರ್ಥಿ", "roles.recruiter": "ನೇಮಕಾತಿದಾರ", "roles.faculty": "ಅಧ್ಯಾಪಕರು", "roles.institution": "ಸಂಸ್ಥೆ" },
  kok: { "language.selectorLabel": "इंटरफेसाची भास निवडात", "common.signIn": "साइन इन", "common.signOut": "साइन आउट", "landing.headline": "जंय पुरावो संद जातलो.", "landing.cta": "म्हजो संद सोदात", "roles.student": "विद्यार्थी", "roles.recruiter": "भरतीदार", "roles.faculty": "प्राध्यापक", "roles.institution": "संस्था" },
  mai: { "language.selectorLabel": "इंटरफेसक भाषा चुनू", "common.signIn": "साइन इन", "common.signOut": "साइन आउट", "landing.headline": "जतय प्रमाण अवसर बनैत अछि।", "landing.cta": "हमर अवसर खोजू", "roles.student": "विद्यार्थी", "roles.recruiter": "नियुक्तिकर्ता", "roles.faculty": "शिक्षक", "roles.institution": "संस्था" },
  ml: { "language.selectorLabel": "ഇന്റർഫേസ് ഭാഷ തിരഞ്ഞെടുക്കുക", "common.signIn": "സൈൻ ഇൻ", "common.signOut": "സൈൻ ഔട്ട്", "landing.headline": "തെളിവ് അവസരമാകുന്നിടം.", "landing.cta": "എന്റെ അവസരം കണ്ടെത്തുക", "roles.student": "വിദ്യാർത്ഥി", "roles.recruiter": "നിയമനദാതാവ്", "roles.faculty": "അധ്യാപകർ", "roles.institution": "സ്ഥാപനം" },
  mni: { "language.selectorLabel": "ꯏꯟꯇꯔꯐꯦꯁꯀꯤ ꯂꯣꯟ ꯈꯟꯕꯤꯌꯨ", "common.signIn": "ꯁꯥꯏꯟ ꯏꯟ", "common.signOut": "ꯁꯥꯏꯟ ꯑꯥꯎꯠ", "landing.headline": "ꯄ꯭ꯔꯃꯥꯟꯅ ꯈꯨꯗꯣꯡꯆꯥꯕ ꯑꯣꯏꯕ ꯃꯐꯝ꯫", "landing.cta": "ꯑꯩꯒꯤ ꯈꯨꯗꯣꯡꯆꯥꯕ ꯊꯤꯕꯤꯌꯨ", "roles.student": "ꯃꯍꯩꯔꯣꯏ", "roles.recruiter": "ꯊꯕꯛ ꯄꯤꯕ", "roles.faculty": "ꯑꯣꯖꯥ", "roles.institution": "ꯂꯨꯞ" },
  mr: { "language.selectorLabel": "इंटरफेसची भाषा निवडा", "common.signIn": "साइन इन", "common.signOut": "साइन आउट", "landing.headline": "जिथे पुरावा संधी बनतो.", "landing.cta": "माझी संधी शोधा", "roles.student": "विद्यार्थी", "roles.recruiter": "भरतीकर्ता", "roles.faculty": "प्राध्यापक", "roles.institution": "संस्था" },
  ne: { "language.selectorLabel": "इन्टरफेसको भाषा छान्नुहोस्", "common.signIn": "साइन इन", "common.signOut": "साइन आउट", "landing.headline": "जहाँ प्रमाण अवसर बन्छ।", "landing.cta": "मेरो अवसर खोज्नुहोस्", "roles.student": "विद्यार्थी", "roles.recruiter": "भर्तीकर्ता", "roles.faculty": "प्राध्यापक", "roles.institution": "संस्था" },
  or: { "language.selectorLabel": "ଇଣ୍ଟରଫେସ୍ ଭାଷା ବାଛନ୍ତୁ", "common.signIn": "ସାଇନ୍ ଇନ୍", "common.signOut": "ସାଇନ୍ ଆଉଟ୍", "landing.headline": "ଯେଉଁଠି ପ୍ରମାଣ ସୁଯୋଗ ହୁଏ।", "landing.cta": "ମୋ ସୁଯୋଗ ଖୋଜନ୍ତୁ", "roles.student": "ଛାତ୍ର", "roles.recruiter": "ନିଯୁକ୍ତିଦାତା", "roles.faculty": "ଅଧ୍ୟାପକ", "roles.institution": "ଅନୁଷ୍ଠାନ" },
  pa: { "language.selectorLabel": "ਇੰਟਰਫੇਸ ਭਾਸ਼ਾ ਚੁਣੋ", "common.signIn": "ਸਾਈਨ ਇਨ", "common.signOut": "ਸਾਈਨ ਆਉਟ", "landing.headline": "ਜਿੱਥੇ ਸਬੂਤ ਮੌਕਾ ਬਣਦਾ ਹੈ।", "landing.cta": "ਮੇਰਾ ਮੌਕਾ ਲੱਭੋ", "roles.student": "ਵਿਦਿਆਰਥੀ", "roles.recruiter": "ਭਰਤੀਕਾਰ", "roles.faculty": "ਅਧਿਆਪਕ", "roles.institution": "ਸੰਸਥਾ" },
  sa: { "language.selectorLabel": "अन्तरफलकस्य भाषां चिनुत", "common.signIn": "प्रविशतु", "common.signOut": "निर्गच्छतु", "landing.headline": "यत्र प्रमाणम् अवसरः भवति।", "landing.cta": "मम अवसरं अन्विष्यतु", "roles.student": "विद्यार्थी", "roles.recruiter": "नियोजकः", "roles.faculty": "अध्यापकः", "roles.institution": "संस्था" },
  sat: { "language.selectorLabel": "ᱤᱱᱴᱚᱨᱯᱷᱮᱥ ᱯᱟᱹᱨᱥᱤ ᱵᱟᱪᱷᱟᱣ ᱢᱮ", "common.signIn": "ᱥᱟᱭᱤᱱ ᱤᱱ", "common.signOut": "ᱥᱟᱭᱤᱱ ᱟᱣᱩᱴ", "landing.headline": "ᱚᱠᱟᱨᱮ ᱯᱨᱚᱢᱟᱬ ᱟᱹᱛᱩᱨ ᱦᱩᱭᱩᱜᱼᱟ।", "landing.cta": "ᱤᱧᱟᱹᱜ ᱟᱹᱛᱩᱨ ᱯᱟᱱᱛᱮ ᱢᱮ", "roles.student": "ᱯᱟᱹᱴᱷᱩᱣᱟᱹ", "roles.recruiter": "ᱠᱟᱹᱢᱤ ᱮᱢᱚᱜ", "roles.faculty": "ᱥᱤᱠᱷᱱᱟᱹᱛ", "roles.institution": "ᱥᱚᱝᱥᱛᱷᱟ" },
  ta: { "language.selectorLabel": "இடைமுக மொழியைத் தேர்ந்தெடுக்கவும்", "common.signIn": "உள்நுழைக", "common.signOut": "வெளியேறுக", "landing.headline": "ஆதாரம் வாய்ப்பாக மாறும் இடம்.", "landing.cta": "என் வாய்ப்பைக் கண்டறிக", "roles.student": "மாணவர்", "roles.recruiter": "ஆட்சேர்ப்பாளர்", "roles.faculty": "ஆசிரியர்", "roles.institution": "நிறுவனம்" },
  te: { "language.selectorLabel": "ఇంటర్‌ఫేస్ భాషను ఎంచుకోండి", "common.signIn": "సైన్ ఇన్", "common.signOut": "సైన్ అవుట్", "landing.headline": "ఆధారం అవకాశంగా మారే చోటు.", "landing.cta": "నా అవకాశాన్ని కనుగొనండి", "roles.student": "విద్యార్థి", "roles.recruiter": "నియామకుడు", "roles.faculty": "అధ్యాపకులు", "roles.institution": "సంస్థ" },
};

export const resources = Object.fromEntries(
  (["en", ...Object.keys(localizedCore)] as LocaleCode[]).map((code) => [
    code,
    { translation: code === "en" ? en : { ...en, ...localizedCore[code as Exclude<LocaleCode, "en">] } },
  ]),
) as unknown as Record<LocaleCode, TranslationResource>;

export const englishTranslation = en;
