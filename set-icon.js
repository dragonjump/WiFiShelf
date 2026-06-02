// set-icon.js
const rcedit = require('rcedit');
const path = require('path');

async function main() {
    try {
// The exe is created in the dist folder and the icon lives in the public folder
        const exePath = path.join(__dirname, 'dist', 'WifiShelf.exe');
        const iconPath = path.join(__dirname, 'public', 'icon.ico');
        await rcedit(exePath, {
            'icon': iconPath,
            'file-version': '1.0.0',
            'product-version': '1.0.0',
            'version-string': {
                'CompanyName': 'WifiShelf',
                'FileDescription': 'A lightweight remote file viewer and manager built in Node.js',
                'ProductName': 'WifiShelf',
                'LegalCopyright': 'Copyright © 2026 WifiShelf'
            }
        });
        console.log('Successfully modified WifiShelf.exe metadata and icon!');
    } catch (err) {
        console.error('rcedit failed:', err);
        process.exit(1);
    }
}

main();
