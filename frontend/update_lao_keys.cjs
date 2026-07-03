const fs = require('fs');
const filePath = 'e:/pjei_portfolios/frontend/src/context/LanguageContext.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const additionalKeys = `
            scrollAbout: "ກ່ຽວກັບ",
            scrollSkills: "ທັກສະ",
            scrollExperience: "ປະສົບການ",
            scrollEducation: "ການສຶກສາ",
            scrollProjects: "ໂຄງການ",
            scrollPortfolio: "ຜົນງານ",
            scrollContact: "ຕິດຕໍ່",`;

content = content.replace(/scrollHome: "ໜ້າຫຼັກ",/, 'scrollHome: "ໜ້າຫຼັກ",' + additionalKeys);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done!');
