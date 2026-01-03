/**
 * AFERTES Connect - Gestionnaire d'accessibilité
 * Thème sombre, Mode daltonien, Mode dyslexique, Mode FALC
 */

// ==========================================
// CONFIGURATION
// ==========================================

const A11Y_CONFIG = {
    storageKey: 'afertes_accessibility',
    defaults: {
        theme: 'auto', // 'light', 'dark', 'auto'
        colorblind: 'none', // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
        dyslexic: false,
        readingRuler: false,
        falc: false,
        fontSize: 100, // pourcentage
        reducedMotion: false
    }
};

// État courant
let a11ySettings = { ...A11Y_CONFIG.defaults };

// ==========================================
// INITIALISATION
// ==========================================

/**
 * Initialise le gestionnaire d'accessibilité
 */
function initAccessibility() {
    // Charger les paramètres sauvegardés
    loadA11ySettings();

    // Appliquer les paramètres
    applyAllA11ySettings();

    // Créer le panneau d'accessibilité
    createA11yPanel();

    // Créer le bouton flottant
    createA11yFab();

    // Écouter les changements de préférence système
    listenToSystemPreferences();

    console.log('Accessibilité initialisée:', a11ySettings);
}

/**
 * Charge les paramètres depuis le localStorage
 */
function loadA11ySettings() {
    try {
        const saved = localStorage.getItem(A11Y_CONFIG.storageKey);
        if (saved) {
            a11ySettings = { ...A11Y_CONFIG.defaults, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('Erreur chargement paramètres accessibilité:', e);
    }
}

/**
 * Sauvegarde les paramètres dans le localStorage
 */
function saveA11ySettings() {
    try {
        localStorage.setItem(A11Y_CONFIG.storageKey, JSON.stringify(a11ySettings));
    } catch (e) {
        console.error('Erreur sauvegarde paramètres accessibilité:', e);
    }
}

// ==========================================
// APPLICATION DES PARAMÈTRES
// ==========================================

/**
 * Applique tous les paramètres d'accessibilité
 */
function applyAllA11ySettings() {
    applyTheme(a11ySettings.theme);
    applyColorblindMode(a11ySettings.colorblind);
    applyDyslexicMode(a11ySettings.dyslexic);
    applyReadingRuler(a11ySettings.readingRuler);
    applyFalcMode(a11ySettings.falc);
    applyFontSize(a11ySettings.fontSize);
    applyReducedMotion(a11ySettings.reducedMotion);
}

/**
 * Applique le thème (clair/sombre/auto)
 */
function applyTheme(theme) {
    const html = document.documentElement;

    if (theme === 'auto') {
        // Utiliser la préférence système
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', theme);
    }

    a11ySettings.theme = theme;
    updateA11yPanelState();
}

/**
 * Applique le mode daltonien
 */
function applyColorblindMode(mode) {
    const html = document.documentElement;

    if (mode === 'none') {
        html.removeAttribute('data-colorblind');
    } else {
        html.setAttribute('data-colorblind', mode);
    }

    a11ySettings.colorblind = mode;
    updateA11yPanelState();
}

/**
 * Applique le mode dyslexique
 */
function applyDyslexicMode(enabled) {
    const html = document.documentElement;

    if (enabled) {
        html.setAttribute('data-dyslexic', 'true');
    } else {
        html.removeAttribute('data-dyslexic');
    }

    a11ySettings.dyslexic = enabled;
    updateA11yPanelState();
}

/**
 * Applique la règle de lecture
 */
function applyReadingRuler(enabled) {
    const html = document.documentElement;
    let ruler = document.getElementById('reading-ruler');

    if (enabled) {
        html.setAttribute('data-reading-ruler', 'true');

        if (!ruler) {
            ruler = document.createElement('div');
            ruler.id = 'reading-ruler';
            ruler.className = 'reading-ruler';
            document.body.appendChild(ruler);

            // Suivre la souris
            document.addEventListener('mousemove', updateReadingRulerPosition);
        }
    } else {
        html.removeAttribute('data-reading-ruler');

        if (ruler) {
            ruler.remove();
            document.removeEventListener('mousemove', updateReadingRulerPosition);
        }
    }

    a11ySettings.readingRuler = enabled;
    updateA11yPanelState();
}

/**
 * Met à jour la position de la règle de lecture
 */
function updateReadingRulerPosition(e) {
    const ruler = document.getElementById('reading-ruler');
    if (ruler) {
        ruler.style.top = (e.clientY - 24) + 'px';
    }
}

/**
 * Applique le mode FALC
 */
function applyFalcMode(enabled) {
    const html = document.documentElement;

    if (enabled) {
        html.setAttribute('data-falc', 'true');
    } else {
        html.removeAttribute('data-falc');
    }

    a11ySettings.falc = enabled;
    updateA11yPanelState();
}

/**
 * Applique la taille de police
 */
function applyFontSize(percentage) {
    document.documentElement.style.fontSize = (percentage / 100) + 'rem';
    a11ySettings.fontSize = percentage;
    updateA11yPanelState();
}

/**
 * Applique la réduction des animations
 */
function applyReducedMotion(enabled) {
    const html = document.documentElement;

    if (enabled) {
        html.style.setProperty('--animation-duration', '0.01ms');
        html.style.setProperty('--transition-duration', '0.01ms');
    } else {
        html.style.removeProperty('--animation-duration');
        html.style.removeProperty('--transition-duration');
    }

    a11ySettings.reducedMotion = enabled;
    updateA11yPanelState();
}

// ==========================================
// PANNEAU D'ACCESSIBILITÉ
// ==========================================

/**
 * Crée le panneau d'accessibilité
 */
function createA11yPanel() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'a11y-overlay';
    overlay.className = 'accessibility-overlay';
    overlay.onclick = closeA11yPanel;
    document.body.appendChild(overlay);

    // Panneau
    const panel = document.createElement('div');
    panel.id = 'a11y-panel';
    panel.className = 'accessibility-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'a11y-panel-title');

    panel.innerHTML = `
        <div class="accessibility-panel-header">
            <h2 id="a11y-panel-title"><i class="fas fa-universal-access" aria-hidden="true"></i> Accessibilité</h2>
            <button class="accessibility-panel-close" onclick="closeA11yPanel()" aria-label="Fermer le panneau">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </div>
        <div class="accessibility-panel-body">
            <!-- Thème -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-moon" aria-hidden="true"></i> Thème</h3>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Mode d'affichage</strong>
                        <span>Choisir entre clair, sombre ou automatique</span>
                    </div>
                    <select class="a11y-select" id="a11y-theme" onchange="handleThemeChange(this.value)">
                        <option value="auto">Automatique</option>
                        <option value="light">Clair</option>
                        <option value="dark">Sombre</option>
                    </select>
                </div>
            </div>

            <!-- Daltonisme -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-eye" aria-hidden="true"></i> Daltonisme</h3>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Adaptation des couleurs</strong>
                        <span>Optimiser les couleurs selon votre vision</span>
                    </div>
                    <select class="a11y-select" id="a11y-colorblind" onchange="handleColorblindChange(this.value)">
                        <option value="none">Désactivé</option>
                        <option value="protanopia">Protanopie (rouge)</option>
                        <option value="deuteranopia">Deutéranopie (vert)</option>
                        <option value="tritanopia">Tritanopie (bleu)</option>
                    </select>
                </div>
            </div>

            <!-- Dyslexie -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-font" aria-hidden="true"></i> Dyslexie</h3>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Police adaptée</strong>
                        <span>Police OpenDyslexic et espacement amélioré</span>
                    </div>
                    <label class="a11y-toggle">
                        <input type="checkbox" id="a11y-dyslexic" onchange="handleDyslexicChange(this.checked)">
                        <span class="a11y-toggle-slider"></span>
                    </label>
                </div>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Règle de lecture</strong>
                        <span>Surlignage qui suit le curseur</span>
                    </div>
                    <label class="a11y-toggle">
                        <input type="checkbox" id="a11y-ruler" onchange="handleRulerChange(this.checked)">
                        <span class="a11y-toggle-slider"></span>
                    </label>
                </div>
            </div>

            <!-- FALC -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-book-reader" aria-hidden="true"></i> Lecture simplifiée</h3>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Mode FALC</strong>
                        <span>Facile à Lire et à Comprendre</span>
                    </div>
                    <label class="a11y-toggle">
                        <input type="checkbox" id="a11y-falc" onchange="handleFalcChange(this.checked)">
                        <span class="a11y-toggle-slider"></span>
                    </label>
                </div>
            </div>

            <!-- Taille du texte -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-text-height" aria-hidden="true"></i> Taille du texte</h3>
                <div class="a11y-option" style="flex-direction: column; align-items: stretch; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>A</span>
                        <input type="range" id="a11y-fontsize" min="80" max="150" step="10"
                               style="flex: 1; margin: 0 1rem;"
                               onchange="handleFontSizeChange(this.value)"
                               oninput="handleFontSizeChange(this.value)">
                        <span style="font-size: 1.5rem;">A</span>
                    </div>
                    <div style="text-align: center; font-weight: 600;">
                        <span id="a11y-fontsize-value">100</span>%
                    </div>
                </div>
            </div>

            <!-- Animations -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-magic" aria-hidden="true"></i> Animations</h3>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Réduire les animations</strong>
                        <span>Désactiver les effets de mouvement</span>
                    </div>
                    <label class="a11y-toggle">
                        <input type="checkbox" id="a11y-motion" onchange="handleMotionChange(this.checked)">
                        <span class="a11y-toggle-slider"></span>
                    </label>
                </div>
            </div>

            <!-- Reset -->
            <button class="a11y-reset-btn" onclick="resetA11ySettings()">
                <i class="fas fa-undo" aria-hidden="true"></i>
                Réinitialiser les paramètres
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    // Mettre à jour l'état initial
    updateA11yPanelState();
}

/**
 * Crée le bouton flottant d'accessibilité
 */
function createA11yFab() {
    const fab = document.createElement('button');
    fab.id = 'a11y-fab';
    fab.className = 'accessibility-fab';
    fab.setAttribute('aria-label', 'Ouvrir les paramètres d\'accessibilité');
    fab.onclick = openA11yPanel;
    fab.innerHTML = '<i class="fas fa-universal-access" aria-hidden="true"></i>';
    document.body.appendChild(fab);
}

/**
 * Ouvre le panneau d'accessibilité
 */
function openA11yPanel() {
    const panel = document.getElementById('a11y-panel');
    const overlay = document.getElementById('a11y-overlay');

    panel.classList.add('open');
    overlay.classList.add('open');

    // Focus sur le panneau
    panel.querySelector('.accessibility-panel-close').focus();

    // Trap focus
    trapFocus(panel);

    // Annoncer aux lecteurs d'écran
    if (typeof announceToScreenReader === 'function') {
        announceToScreenReader('Panneau d\'accessibilité ouvert');
    }
}

/**
 * Ferme le panneau d'accessibilité
 */
function closeA11yPanel() {
    const panel = document.getElementById('a11y-panel');
    const overlay = document.getElementById('a11y-overlay');

    panel.classList.remove('open');
    overlay.classList.remove('open');

    // Remettre le focus sur le bouton
    document.getElementById('a11y-fab').focus();
}

/**
 * Met à jour l'état du panneau selon les paramètres actuels
 */
function updateA11yPanelState() {
    const panel = document.getElementById('a11y-panel');
    if (!panel) return;

    // Thème
    const themeSelect = document.getElementById('a11y-theme');
    if (themeSelect) themeSelect.value = a11ySettings.theme;

    // Daltonisme
    const colorblindSelect = document.getElementById('a11y-colorblind');
    if (colorblindSelect) colorblindSelect.value = a11ySettings.colorblind;

    // Dyslexie
    const dyslexicCheckbox = document.getElementById('a11y-dyslexic');
    if (dyslexicCheckbox) dyslexicCheckbox.checked = a11ySettings.dyslexic;

    // Règle de lecture
    const rulerCheckbox = document.getElementById('a11y-ruler');
    if (rulerCheckbox) rulerCheckbox.checked = a11ySettings.readingRuler;

    // FALC
    const falcCheckbox = document.getElementById('a11y-falc');
    if (falcCheckbox) falcCheckbox.checked = a11ySettings.falc;

    // Taille de police
    const fontSizeSlider = document.getElementById('a11y-fontsize');
    const fontSizeValue = document.getElementById('a11y-fontsize-value');
    if (fontSizeSlider) fontSizeSlider.value = a11ySettings.fontSize;
    if (fontSizeValue) fontSizeValue.textContent = a11ySettings.fontSize;

    // Animations
    const motionCheckbox = document.getElementById('a11y-motion');
    if (motionCheckbox) motionCheckbox.checked = a11ySettings.reducedMotion;
}

// ==========================================
// GESTIONNAIRES D'ÉVÉNEMENTS
// ==========================================

function handleThemeChange(value) {
    applyTheme(value);
    saveA11ySettings();
    showToast(`Thème ${value === 'auto' ? 'automatique' : value === 'dark' ? 'sombre' : 'clair'} activé`, 'success');
}

function handleColorblindChange(value) {
    applyColorblindMode(value);
    saveA11ySettings();

    const labels = {
        'none': 'désactivé',
        'protanopia': 'protanopie',
        'deuteranopia': 'deutéranopie',
        'tritanopia': 'tritanopie'
    };
    showToast(`Mode daltonien ${labels[value]}`, 'success');
}

function handleDyslexicChange(checked) {
    applyDyslexicMode(checked);
    saveA11ySettings();
    showToast(`Mode dyslexique ${checked ? 'activé' : 'désactivé'}`, 'success');
}

function handleRulerChange(checked) {
    applyReadingRuler(checked);
    saveA11ySettings();
    showToast(`Règle de lecture ${checked ? 'activée' : 'désactivée'}`, 'success');
}

function handleFalcChange(checked) {
    applyFalcMode(checked);
    saveA11ySettings();
    showToast(`Mode FALC ${checked ? 'activé' : 'désactivé'}`, 'success');
}

function handleFontSizeChange(value) {
    applyFontSize(parseInt(value));
    saveA11ySettings();

    const fontSizeValue = document.getElementById('a11y-fontsize-value');
    if (fontSizeValue) fontSizeValue.textContent = value;
}

function handleMotionChange(checked) {
    applyReducedMotion(checked);
    saveA11ySettings();
    showToast(`Animations ${checked ? 'réduites' : 'activées'}`, 'success');
}

/**
 * Réinitialise tous les paramètres d'accessibilité
 */
function resetA11ySettings() {
    a11ySettings = { ...A11Y_CONFIG.defaults };
    applyAllA11ySettings();
    saveA11ySettings();
    showToast('Paramètres d\'accessibilité réinitialisés', 'success');
}

// ==========================================
// PRÉFÉRENCES SYSTÈME
// ==========================================

/**
 * Écoute les changements de préférences système
 */
function listenToSystemPreferences() {
    // Thème sombre
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', (e) => {
        if (a11ySettings.theme === 'auto') {
            applyTheme('auto');
        }
    });

    // Mouvement réduit
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotionQuery.matches && !a11ySettings.reducedMotion) {
        // Suggérer la réduction des animations
        console.log('Préférence système : réduction des animations détectée');
    }
}

// ==========================================
// INITIALISATION AU CHARGEMENT
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser après un court délai pour s'assurer que le DOM est prêt
    setTimeout(initAccessibility, 100);
});

// Export des fonctions globales
window.initAccessibility = initAccessibility;
window.openA11yPanel = openA11yPanel;
window.closeA11yPanel = closeA11yPanel;
window.handleThemeChange = handleThemeChange;
window.handleColorblindChange = handleColorblindChange;
window.handleDyslexicChange = handleDyslexicChange;
window.handleRulerChange = handleRulerChange;
window.handleFalcChange = handleFalcChange;
window.handleFontSizeChange = handleFontSizeChange;
window.handleMotionChange = handleMotionChange;
window.resetA11ySettings = resetA11ySettings;
