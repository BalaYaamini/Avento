const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function walk(dir, callback) {
    fs.readdir(dir, function(err, files) {
        if (err) throw err;
        files.forEach(function(file) {
            let filepath = path.join(dir, file);
            fs.stat(filepath, function(err, stats) {
                if (stats.isDirectory()) {
                    walk(filepath, callback);
                } else if (stats.isFile() && filepath.endsWith('.jsx')) {
                    callback(filepath);
                }
            });
        });
    });
}

const replacements = [
    { regex: /bg-slate-950/g, replacement: 'bg-transparent' }, // Handled by App.jsx body
    { regex: /bg-slate-900\/60/g, replacement: 'bg-white/60' },
    { regex: /bg-slate-900\/40/g, replacement: 'bg-white/40' },
    { regex: /bg-slate-900\/30/g, replacement: 'bg-white/30' },
    { regex: /bg-slate-900\/20/g, replacement: 'bg-white/20' },
    { regex: /bg-slate-800\/60/g, replacement: 'bg-white/60' },
    { regex: /bg-slate-800\/50/g, replacement: 'bg-white/50' },
    { regex: /bg-slate-800\/40/g, replacement: 'bg-white/40' },
    { regex: /bg-slate-800\/30/g, replacement: 'bg-white/30' },
    { regex: /bg-slate-800\/20/g, replacement: 'bg-white/20' },
    { regex: /bg-slate-900/g, replacement: 'bg-white/50' },
    { regex: /bg-slate-800/g, replacement: 'bg-white/50' },
    { regex: /text-slate-100/g, replacement: 'text-slate-800' },
    { regex: /text-slate-200/g, replacement: 'text-slate-800' },
    { regex: /text-slate-300/g, replacement: 'text-slate-700' },
    { regex: /text-slate-400/g, replacement: 'text-slate-600' },
    { regex: /text-slate-500/g, replacement: 'text-slate-600' },
    { regex: /border-slate-800\/40/g, replacement: 'border-slate-200/40' },
    { regex: /border-slate-800/g, replacement: 'border-slate-200' },
    { regex: /border-slate-700\/50/g, replacement: 'border-slate-300/50' },
    { regex: /border-slate-700\/40/g, replacement: 'border-slate-300/40' },
    { regex: /border-slate-700\/30/g, replacement: 'border-slate-300/30' },
    { regex: /border-slate-700/g, replacement: 'border-slate-300' }
];

walk(directoryPath, function(filepath) {
    fs.readFile(filepath, 'utf8', function(err, data) {
        if (err) throw err;
        let original = data;
        let result = data;
        
        replacements.forEach(r => {
            result = result.replace(r.regex, r.replacement);
        });
        
        if (original !== result) {
            fs.writeFile(filepath, result, 'utf8', function(err) {
                if (err) throw err;
                console.log('Updated', filepath);
            });
        }
    });
});
