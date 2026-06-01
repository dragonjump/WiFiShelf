// make-ico.js
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

pngToIco([path.join(__dirname, 'public', 'square.png')])
    .then(buf => {
        fs.writeFileSync(path.join(__dirname, 'public', 'icon.ico'), buf);
        console.log('Successfully created public/icon.ico');
    })
    .catch(err => {
        console.error('Error creating ico file:', err);
        process.exit(1);
    });
