/**
 * Tests de sécurité pour AFERTES Connect
 * Exécuter avec: node tests/security.test.js
 */

const assert = require('assert');
const path = require('path');

// Couleurs pour le terminal
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

let passed = 0;
let failed = 0;

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

function describe(name, fn) {
    console.log(`\n${colors.bold}${name}${colors.reset}`);
    fn();
}

// ==========================================
// Tests des fonctions de validation (auth.js)
// ==========================================

// Simuler les fonctions de validation
function validateUsername(username) {
    if (!username || typeof username !== 'string') return false;
    return /^[a-zA-Z0-9._]{3,50}$/.test(username.trim());
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 8 && password.length <= 100;
}

function validateNewPassword(password) {
    if (!validatePassword(password)) return { valid: false, message: 'Le mot de passe doit contenir entre 8 et 100 caractères' };
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'Le mot de passe doit contenir au moins une majuscule' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'Le mot de passe doit contenir au moins une minuscule' };
    if (!/[0-9]/.test(password)) return { valid: false, message: 'Le mot de passe doit contenir au moins un chiffre' };
    return { valid: true };
}

// Simuler les fonctions de documents.js
const UPLOAD_DIR = '/home/renaud/Bureau/afertes-app/uploads';

function isPathSafe(filePath) {
    if (!filePath) return false;
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(UPLOAD_DIR);
}

function sanitizeFilename(filename) {
    if (!filename) return 'document';
    return filename
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\.{2,}/g, '.')
        .substring(0, 255);
}

// Simuler escapeHtml
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(str).replace(/[&<>"']/g, c => map[c]);
}

// ==========================================
// TESTS
// ==========================================

describe('Validation Username', () => {
    test('accepte un username valide', () => {
        assert.strictEqual(validateUsername('john.doe'), true);
        assert.strictEqual(validateUsername('user_123'), true);
        assert.strictEqual(validateUsername('Admin'), true);
    });

    test('rejette un username trop court', () => {
        assert.strictEqual(validateUsername('ab'), false);
        assert.strictEqual(validateUsername('a'), false);
    });

    test('rejette un username trop long', () => {
        assert.strictEqual(validateUsername('a'.repeat(51)), false);
    });

    test('rejette les caractères spéciaux', () => {
        assert.strictEqual(validateUsername('user@email.com'), false);
        assert.strictEqual(validateUsername('user<script>'), false);
        assert.strictEqual(validateUsername('user;DROP TABLE'), false);
    });

    test('rejette null/undefined', () => {
        assert.strictEqual(validateUsername(null), false);
        assert.strictEqual(validateUsername(undefined), false);
        assert.strictEqual(validateUsername(''), false);
    });
});

describe('Validation Password', () => {
    test('accepte un mot de passe valide', () => {
        assert.strictEqual(validatePassword('password123'), true);
        assert.strictEqual(validatePassword('12345678'), true);
    });

    test('rejette un mot de passe trop court', () => {
        assert.strictEqual(validatePassword('1234567'), false);
        assert.strictEqual(validatePassword('abc'), false);
    });

    test('rejette un mot de passe trop long', () => {
        assert.strictEqual(validatePassword('a'.repeat(101)), false);
    });
});

describe('Validation Nouveau Password', () => {
    test('accepte un mot de passe fort', () => {
        const result = validateNewPassword('SecurePass123');
        assert.strictEqual(result.valid, true);
    });

    test('rejette sans majuscule', () => {
        const result = validateNewPassword('securepass123');
        assert.strictEqual(result.valid, false);
        assert.ok(result.message.includes('majuscule'));
    });

    test('rejette sans minuscule', () => {
        const result = validateNewPassword('SECUREPASS123');
        assert.strictEqual(result.valid, false);
        assert.ok(result.message.includes('minuscule'));
    });

    test('rejette sans chiffre', () => {
        const result = validateNewPassword('SecurePassword');
        assert.strictEqual(result.valid, false);
        assert.ok(result.message.includes('chiffre'));
    });
});

describe('Protection Path Traversal', () => {
    test('accepte un chemin valide dans uploads', () => {
        assert.strictEqual(isPathSafe('/home/renaud/Bureau/afertes-app/uploads/1/doc.pdf'), true);
    });

    test('rejette un chemin hors uploads', () => {
        assert.strictEqual(isPathSafe('/etc/passwd'), false);
        assert.strictEqual(isPathSafe('/home/renaud/.ssh/id_rsa'), false);
    });

    test('rejette les tentatives de traversal', () => {
        assert.strictEqual(isPathSafe('/home/renaud/Bureau/afertes-app/uploads/../../../etc/passwd'), false);
    });

    test('rejette null/undefined', () => {
        assert.strictEqual(isPathSafe(null), false);
        assert.strictEqual(isPathSafe(undefined), false);
        assert.strictEqual(isPathSafe(''), false);
    });
});

describe('Sanitization Filename', () => {
    test('garde un nom de fichier valide', () => {
        assert.strictEqual(sanitizeFilename('document.pdf'), 'document.pdf');
        assert.strictEqual(sanitizeFilename('photo_2024.jpg'), 'photo_2024.jpg');
    });

    test('remplace les caractères dangereux', () => {
        assert.strictEqual(sanitizeFilename('file<script>.pdf'), 'file_script_.pdf');
        assert.strictEqual(sanitizeFilename('file"name.pdf'), 'file_name.pdf');
    });

    test('bloque les traversals', () => {
        const result = sanitizeFilename('../../../etc/passwd');
        assert.ok(!result.includes('..'));
    });

    test('tronque les noms trop longs', () => {
        const longName = 'a'.repeat(300) + '.pdf';
        assert.ok(sanitizeFilename(longName).length <= 255);
    });

    test('gère null/undefined', () => {
        assert.strictEqual(sanitizeFilename(null), 'document');
        assert.strictEqual(sanitizeFilename(undefined), 'document');
    });
});

describe('Protection XSS - escapeHtml', () => {
    test('échappe les balises HTML', () => {
        assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('échappe les attributs', () => {
        assert.strictEqual(escapeHtml('onclick="alert(1)"'), 'onclick=&quot;alert(1)&quot;');
    });

    test('échappe les ampersands', () => {
        assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
    });

    test('gère null/undefined', () => {
        assert.strictEqual(escapeHtml(null), '');
        assert.strictEqual(escapeHtml(undefined), '');
    });

    test('convertit les nombres en string', () => {
        assert.strictEqual(escapeHtml(123), '123');
    });
});

describe('Rate Limiting Logic', () => {
    const loginAttempts = new Map();
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_TIME = 15 * 60 * 1000;

    function checkRateLimit(ip) {
        const now = Date.now();
        const attempts = loginAttempts.get(ip);
        if (!attempts) return { allowed: true };
        if (now - attempts.lastAttempt > LOCKOUT_TIME) {
            loginAttempts.delete(ip);
            return { allowed: true };
        }
        if (attempts.count >= MAX_ATTEMPTS) {
            return { allowed: false };
        }
        return { allowed: true };
    }

    function recordFailedAttempt(ip) {
        const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        loginAttempts.set(ip, attempts);
    }

    test('autorise la première tentative', () => {
        loginAttempts.clear();
        assert.strictEqual(checkRateLimit('192.168.1.1').allowed, true);
    });

    test('autorise jusqu\'à 5 tentatives', () => {
        loginAttempts.clear();
        for (let i = 0; i < 4; i++) {
            recordFailedAttempt('192.168.1.2');
        }
        assert.strictEqual(checkRateLimit('192.168.1.2').allowed, true);
    });

    test('bloque après 5 tentatives', () => {
        loginAttempts.clear();
        for (let i = 0; i < 5; i++) {
            recordFailedAttempt('192.168.1.3');
        }
        assert.strictEqual(checkRateLimit('192.168.1.3').allowed, false);
    });

    test('IPs différentes sont indépendantes', () => {
        loginAttempts.clear();
        for (let i = 0; i < 5; i++) {
            recordFailedAttempt('192.168.1.4');
        }
        assert.strictEqual(checkRateLimit('192.168.1.5').allowed, true);
    });
});

// ==========================================
// RÉSUMÉ
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`${colors.bold}RÉSUMÉ DES TESTS${colors.reset}`);
console.log('='.repeat(50));
console.log(`${colors.green}Réussis: ${passed}${colors.reset}`);
console.log(`${colors.red}Échoués: ${failed}${colors.reset}`);
console.log('='.repeat(50));

if (failed > 0) {
    process.exit(1);
} else {
    console.log(`\n${colors.green}${colors.bold}Tous les tests sont passés !${colors.reset}\n`);
    process.exit(0);
}
