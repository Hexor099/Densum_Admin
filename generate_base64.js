const fs = require('fs');
const img = fs.readFileSync('C:/Users/balee/.gemini/antigravity-ide/brain/c3e8c30e-c819-4e00-84dc-4c85a0a819bc/.user_uploaded/media_1787584227993.jpg', 'base64');
fs.writeFileSync('C:/Users/balee/Desktop/master lab app/src/lib/logoBase64.ts', 'export const logoBase64 = "data:image/jpeg;base64,' + img + '";');
console.log('Success');
