/**
 * SafeHer Multilingual Support (English, Telugu, Hindi)
 */

const I18N = {
    currentLang: localStorage.getItem('safeher_lang') || 'en',

    dict: {
        en: {
            appName: 'SafeHer',
            tagline: 'Safety that works even without your phone',
            sosButton: 'EMERGENCY SOS',
            sosSub: 'Tap or hold to activate',
            shareTrip: 'Share My Trip',
            shareTripDesc: 'Send a live tracking link to loved ones',
            contactsTitle: 'Trusted Contacts',
            contactsDesc: 'Family & friends alerted in emergencies',
            devicesTitle: 'Wearable IoT Devices',
            devicesDesc: 'Smartwatch, band, pendant or earring pairing',
            safetyScoreTitle: 'AI Area Safety Score',
            safetyScoreDesc: 'Live risk rating calculated for this area',
            routesTitle: 'Safe Route Suggestion',
            routesDesc: 'Compare illuminated avenues vs dark alleys',
            deadmanTitle: "Safety Check-in Timer",
            deadmanDesc: "Auto-alerts contacts if you don't confirm safe",
            fakeCallTitle: 'Fake Incoming Call',
            fakeCallDesc: 'Escape uncomfortable situations discreetly',
            nearbyTitle: 'Nearby Help Finder',
            nearbyDesc: 'Police stations, hospitals and 24x7 pharmacies',
            cancelCountdown: 'Cancel Alert (5s)',
            imSafe: "I am Safe",
            police112: 'Police: 112',
            women1091: 'Women Helpline: 1091',
            ambulance108: 'Ambulance: 108'
        },
        te: {
            appName: 'సేఫ్‌హెర్ (SafeHer)',
            tagline: 'మీ ఫోన్ లేకపోయినా రక్షణ కల్పించే వ్యవస్థ',
            sosButton: 'అత్యవసర SOS',
            sosSub: 'సహాయం కోసం నొక్కండి',
            shareTrip: 'నా ప్రయాణాన్ని పంచుకోండి',
            shareTripDesc: 'లైవ్ ట్రాకింగ్ లింక్‌ను కుటుంబానికి పంపండి',
            contactsTitle: 'నమ్మకమైన పరిచయాలు',
            contactsDesc: 'అత్యవసర సమయాల్లో అప్రమత్తం చేయబడే స్నేహితులు',
            devicesTitle: 'ధరించగల IoT పరికరాలు',
            devicesDesc: 'స్మార్ట్‌వాచ్, పెండెంట్ లేదా బ్యాండ్ జత చేయండి',
            safetyScoreTitle: 'AI ప్రాంత భద్రతా స్కోరు',
            safetyScoreDesc: 'ఈ ప్రాంతం యొక్క భద్రతా అంచనా',
            routesTitle: 'సురక్షితమైన మార్గాల సూచన',
            routesDesc: 'చీకటి సందులకు బదులుగా వెలుతురున్న మార్గాలు',
            deadmanTitle: 'భద్రతా చెక్-ఇన్ టైమర్',
            deadmanDesc: 'సమయానికి స్పందించకపోతే ఆటోమేటిక్ అలర్ట్',
            fakeCallTitle: 'ఫేక్ ఇన్‌కమింగ్ కాల్',
            fakeCallDesc: 'ఇబ్బందికరమైన పరిస్థితుల నుండి తప్పించుకోండి',
            nearbyTitle: 'సమీప సహాయ కేంద్రాలు',
            nearbyDesc: 'పోలీస్ స్టేషన్లు, ఆసుపత్రులు మరియు ఫార్మసీలు',
            cancelCountdown: 'రద్దు చేయండి (5 సెకన్లు)',
            imSafe: 'నేను సురక్షితంగా ఉన్నాను',
            police112: 'పోలీస్: 112',
            women1091: 'మహిళా హెల్ప్‌లైన్: 1091',
            ambulance108: 'అంబులెన్స్: 108'
        },
        hi: {
            appName: 'सेफहेर (SafeHer)',
            tagline: 'सुरक्षा जो आपके फोन के बिना भी काम करती है',
            sosButton: 'आपातकालीन SOS',
            sosSub: 'मदद के लिए टैप करें',
            shareTrip: 'मेरी यात्रा साझा करें',
            shareTripDesc: 'परिजनों को लाइव ट्रैकिंग लिंक भेजें',
            contactsTitle: 'विश्वसनीय संपर्क',
            contactsDesc: 'आपातकाल में तुरंत सूचित किए जाने वाले लोग',
            devicesTitle: 'वेयरेबल IoT उपकरण',
            devicesDesc: 'स्मार्टवॉच, पेंडेंट या बैंड कनेक्ट करें',
            safetyScoreTitle: 'AI क्षेत्र सुरक्षा स्कोर',
            safetyScoreDesc: 'इस इलाके की वास्तविक समय सुरक्षा रेटिंग',
            routesTitle: 'सुरक्षित मार्ग सुझाव',
            routesDesc: 'अंधेरी गलियों के बजाय सुरक्षित मुख्य सड़कें',
            deadmanTitle: 'सुरक्षा चेक-इन टाइमर',
            deadmanDesc: 'सुरक्षित न पहुंचने पर स्वचालित अलर्ट',
            fakeCallTitle: 'फेक इनकमिंग कॉल',
            fakeCallDesc: 'असहज स्थितियों से सुरक्षित बाहर निकलें',
            nearbyTitle: 'निकटतम सहायता खोजें',
            nearbyDesc: 'पुलिस स्टेशन, अस्पताल और 24x7 दवा की दुकानें',
            cancelCountdown: 'अलर्ट रद्द करें (5s)',
            imSafe: 'मैं सुरक्षित हूँ',
            police112: 'पुलिस: 112',
            women1091: 'महिला हेल्पलाइन: 1091',
            ambulance108: 'एम्बुलेंस: 108'
        }
    },

    t(key) {
        const lang = this.currentLang;
        return (this.dict[lang] && this.dict[lang][key]) || (this.dict['en'][key]) || key;
    },

    setLanguage(lang) {
        if (this.dict[lang]) {
            this.currentLang = lang;
            localStorage.setItem('safeher_lang', lang);
            this.applyToDOM();
        }
    },

    applyToDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation) {
                if (el.tagName === 'INPUT' && el.placeholder) {
                    el.placeholder = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });
    }
};
