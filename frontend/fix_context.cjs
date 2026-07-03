const fs = require('fs');
const filePath = 'e:/pjei_portfolios/frontend/src/context/LanguageContext.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// The file currently ends with:
//         }
//     };
//   }
//   return context;
// }

// We need to cut off after `};` and append the proper context code.
const properEnd = `};

type LanguageContextType = {
  language: Language;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations.en) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'lo' : 'en'));
  };

  const t = (key: keyof typeof translations.en) => {
    return (translations[language] as any)[key] || translations.en[key];
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
`;

const newContent = content.substring(0, content.lastIndexOf('};') + 2) + '\n\n' + properEnd;
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('Fixed!');
