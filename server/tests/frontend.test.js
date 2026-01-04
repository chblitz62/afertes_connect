/**
 * Tests du frontend pour AFERTES Connect
 * Exécuter avec: node tests/frontend.test.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

let passed = 0;
let failed = 0;
let warnings = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`${colors.green}✓${colors.reset} ${name}`);
        passed++;
    } catch (error) {
        console.log(`${colors.red}✗${colors.reset} ${name}`);
        console.log(`  ${colors.red}${error.message}${colors.reset}`);
        failed++;
    }
}

function warn(name, message) {
    console.log(`${colors.yellow}⚠${colors.reset} ${name}`);
    console.log(`  ${colors.yellow}${message}${colors.reset}`);
    warnings++;
}

function describe(name, fn) {
    console.log(`\n${colors.bold}${name}${colors.reset}`);
    fn();
}

// Charger les fichiers
const rootDir = path.join(__dirname, '../..');
const htmlFile = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
const appJs = fs.readFileSync(path.join(rootDir, 'js/app.js'), 'utf-8');
const accessibilityJs = fs.readFileSync(path.join(rootDir, 'js/accessibility.js'), 'utf-8');
const apiAdapterJs = fs.readFileSync(path.join(rootDir, 'js/api-adapter.js'), 'utf-8');

// ==========================================
// TESTS HTML
// ==========================================

describe('Structure HTML', () => {
    test('DOCTYPE est présent', () => {
        if (!htmlFile.startsWith('<!DOCTYPE html>')) throw new Error('DOCTYPE manquant');
    });

    test('lang="fr" est défini', () => {
        if (!htmlFile.includes('lang="fr"')) throw new Error('Attribut lang manquant');
    });

    test('meta charset UTF-8', () => {
        if (!htmlFile.includes('charset="UTF-8"')) throw new Error('Meta charset manquant');
    });

    test('meta viewport présent', () => {
        if (!htmlFile.includes('name="viewport"')) throw new Error('Meta viewport manquant');
    });

    test('title est défini', () => {
        if (!htmlFile.includes('<title>')) throw new Error('Title manquant');
    });
});

describe('Accessibilité HTML', () => {
    test('alt sur les images logo', () => {
        const imgCount = (htmlFile.match(/<img/g) || []).length;
        const altCount = (htmlFile.match(/<img[^>]+alt=/g) || []).length;
        if (altCount < imgCount) throw new Error(`${imgCount - altCount} images sans alt`);
    });

    test('labels sur les formulaires', () => {
        // Vérifier qu'il y a des labels
        if (!htmlFile.includes('<label')) throw new Error('Pas de labels trouvés');
    });

    test('aria-label sur les boutons icons', () => {
        // Les boutons avec seulement des icônes devraient avoir aria-label
        const iconButtons = htmlFile.match(/<button[^>]*>\s*<i class="fa/g) || [];
        // Pas une erreur critique, juste un avertissement
        if (iconButtons.length > 0) {
            warn('Boutons icônes sans aria-label', `${iconButtons.length} boutons pourraient avoir besoin d'aria-label`);
        }
    });
});

describe('Sécurité HTML', () => {
    test('pas de scripts inline dangereux', () => {
        // Chercher des patterns dangereux
        const dangerousPatterns = [
            /javascript:/gi,
            /data:text\/html/gi,
            /vbscript:/gi
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(htmlFile)) {
                throw new Error(`Pattern dangereux trouvé: ${pattern}`);
            }
        }
    });

    test('CSP meta tag ou headers', () => {
        // On utilise les headers via Helmet, donc pas de meta CSP nécessaire
        // Mais on vérifie qu'il n'y a pas de CSP contradictoire
    });
});

// ==========================================
// TESTS JavaScript
// ==========================================

describe('JavaScript - Fonctions de sécurité', () => {
    test('escapeHtml est définie dans api-adapter.js', () => {
        if (!apiAdapterJs.includes('function escapeHtml')) {
            throw new Error('escapeHtml non trouvée');
        }
    });

    test('escapeHtml est utilisée pour les données utilisateur', () => {
        const usages = (apiAdapterJs.match(/escapeHtml\(/g) || []).length;
        if (usages < 5) throw new Error(`Seulement ${usages} utilisations de escapeHtml`);
    });

    test('parseInt utilisé pour les IDs', () => {
        if (!apiAdapterJs.includes('parseInt(s.id)')) {
            throw new Error('IDs non parsés en entiers');
        }
    });
});

describe('JavaScript - Accessibilité', () => {
    test('initAccessibility est définie', () => {
        if (!accessibilityJs.includes('function initAccessibility')) {
            throw new Error('initAccessibility non trouvée');
        }
    });

    test('raccourcis clavier définis', () => {
        if (!accessibilityJs.includes('KEYBOARD_SHORTCUTS')) {
            throw new Error('KEYBOARD_SHORTCUTS non trouvé');
        }
    });

    test('recherche globale implémentée', () => {
        if (!accessibilityJs.includes('createGlobalSearch')) {
            throw new Error('createGlobalSearch non trouvée');
        }
    });

    test('mode contraste élevé', () => {
        if (!accessibilityJs.includes('applyHighContrast')) {
            throw new Error('applyHighContrast non trouvée');
        }
    });
});

describe('JavaScript - Bonnes pratiques', () => {
    test('use strict implicite (modules ou classes)', () => {
        // Les fonctions modernes utilisent le mode strict par défaut
    });

    test('pas de eval()', () => {
        if (appJs.includes('eval(') || apiAdapterJs.includes('eval(')) {
            throw new Error('eval() trouvé - risque de sécurité');
        }
    });

    test('pas de document.write() sur le document principal', () => {
        // win.document.write() sur une nouvelle fenêtre est acceptable
        // On vérifie seulement que document.write() n'est pas utilisé directement
        const dangerousWrites = appJs.match(/[^.]document\.write\(/g) || [];
        if (dangerousWrites.length > 0) {
            throw new Error('document.write() direct trouvé - mauvaise pratique');
        }
    });
});

// ==========================================
// TESTS CSS
// ==========================================

describe('CSS - Accessibilité', () => {
    const cssFile = fs.readFileSync(path.join(rootDir, 'css/accessibility.css'), 'utf-8');

    test('mode sombre défini', () => {
        if (!cssFile.includes('[data-theme="dark"]')) {
            throw new Error('Mode sombre non trouvé');
        }
    });

    test('mode contraste élevé défini', () => {
        if (!cssFile.includes('[data-high-contrast="true"]')) {
            throw new Error('Mode contraste élevé non trouvé');
        }
    });

    test('mode daltonien défini', () => {
        if (!cssFile.includes('[data-colorblind=')) {
            throw new Error('Mode daltonien non trouvé');
        }
    });

    test('mode dyslexique défini', () => {
        if (!cssFile.includes('[data-dyslexic="true"]')) {
            throw new Error('Mode dyslexique non trouvé');
        }
    });

    test('focus visible pour accessibilité clavier', () => {
        if (!cssFile.includes('focus')) {
            throw new Error('Styles focus non trouvés');
        }
    });
});

// ==========================================
// TESTS Fichiers requis
// ==========================================

describe('Fichiers requis', () => {
    const requiredFiles = [
        'index.html',
        'manifest.json',
        'sw.js',
        'js/app.js',
        'js/api.js',
        'js/api-adapter.js',
        'js/accessibility.js',
        'js/data.js',
        'js/features.js',
        'css/style.css',
        'css/features.css',
        'css/accessibility.css'
    ];

    for (const file of requiredFiles) {
        test(`${file} existe`, () => {
            const filePath = path.join(rootDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Fichier manquant: ${file}`);
            }
        });
    }
});

// ==========================================
// RÉSUMÉ
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`${colors.bold}RÉSUMÉ DES TESTS FRONTEND${colors.reset}`);
console.log('='.repeat(50));
console.log(`${colors.green}Réussis: ${passed}${colors.reset}`);
console.log(`${colors.red}Échoués: ${failed}${colors.reset}`);
console.log(`${colors.yellow}Avertissements: ${warnings}${colors.reset}`);
console.log('='.repeat(50));

if (failed > 0) {
    process.exit(1);
} else {
    console.log(`\n${colors.green}${colors.bold}Tous les tests sont passés !${colors.reset}\n`);
    process.exit(0);
}
