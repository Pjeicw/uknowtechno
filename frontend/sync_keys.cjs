const fs = require('fs');
const filePath = 'e:/pjei_portfolios/frontend/src/context/LanguageContext.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Find the translations object
const translationsMatch = content.match(/const translations = (\{[\s\S]*?\});\n\n/);
if (translationsMatch) {
    let translationsObjStr = translationsMatch[1];
    // This is a bit hacky to parse JS object, so let's just use eval
    const translations = eval('(' + translationsObjStr + ')');
    
    // Copy missing keys from en to lo
    for (const key in translations.en) {
        if (!(key in translations.lo)) {
            translations.lo[key] = translations.en[key];
        }
    }
    
    // Stringify back
    const newTranslationsStr = JSON.stringify(translations, null, 4)
        // clean up the quotes on keys to make it look nice, though not strictly required
        .replace(/"([^"]+)":/g, '$1:');
        
    content = content.replace(/const translations = \{[\s\S]*?\};\n\n/, 'const translations = ' + newTranslationsStr + ';\n\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Done!');
} else {
    console.log('Not found');
}
