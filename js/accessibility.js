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
        reducedMotion: false,
        highContrast: false,
        underlineLinks: false
    }
};

// Raccourcis clavier
const KEYBOARD_SHORTCUTS = {
    'Alt+A': { action: 'openA11yPanel', description: 'Ouvrir l\'accessibilité' },
    'Alt+H': { action: 'goHome', description: 'Aller à l\'accueil' },
    'Alt+M': { action: 'goMessages', description: 'Aller aux messages' },
    'Alt+N': { action: 'goNotes', description: 'Aller aux notes' },
    'Alt+D': { action: 'goDocs', description: 'Aller aux documents' },
    'Ctrl+K': { action: 'openSearch', description: 'Recherche globale' },
    'Escape': { action: 'closeModals', description: 'Fermer' },
    '?': { action: 'showShortcuts', description: 'Afficher les raccourcis' }
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

    // Créer la recherche globale
    createGlobalSearch();

    // Créer le modal des raccourcis
    createShortcutsModal();

    // Initialiser les raccourcis clavier
    initKeyboardShortcuts();

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
    applyHighContrast(a11ySettings.highContrast);
    applyUnderlineLinks(a11ySettings.underlineLinks);
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

/**
 * Applique le mode contraste élevé
 */
function applyHighContrast(enabled) {
    const html = document.documentElement;

    if (enabled) {
        html.setAttribute('data-high-contrast', 'true');
    } else {
        html.removeAttribute('data-high-contrast');
    }

    a11ySettings.highContrast = enabled;
    updateA11yPanelState();
}

/**
 * Applique le soulignement des liens
 */
function applyUnderlineLinks(enabled) {
    const html = document.documentElement;

    if (enabled) {
        html.setAttribute('data-underline-links', 'true');
    } else {
        html.removeAttribute('data-underline-links');
    }

    a11ySettings.underlineLinks = enabled;
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

            <!-- Contraste élevé -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-adjust" aria-hidden="true"></i> Contraste</h3>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Contraste élevé</strong>
                        <span>Mode noir/blanc/jaune (WCAG AAA)</span>
                    </div>
                    <label class="a11y-toggle">
                        <input type="checkbox" id="a11y-contrast" onchange="handleContrastChange(this.checked)">
                        <span class="a11y-toggle-slider"></span>
                    </label>
                </div>
                <div class="a11y-option">
                    <div class="a11y-option-label">
                        <strong>Souligner les liens</strong>
                        <span>Rendre tous les liens plus visibles</span>
                    </div>
                    <label class="a11y-toggle">
                        <input type="checkbox" id="a11y-underline" onchange="handleUnderlineChange(this.checked)">
                        <span class="a11y-toggle-slider"></span>
                    </label>
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

            <!-- Raccourcis clavier -->
            <div class="a11y-section">
                <h3 class="a11y-section-title"><i class="fas fa-keyboard" aria-hidden="true"></i> Raccourcis clavier</h3>
                <div class="a11y-option" style="flex-direction: column; align-items: stretch;">
                    <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: var(--a11y-text-secondary);">
                        Appuyez sur <kbd style="background: var(--a11y-bg-tertiary); padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace;">?</kbd> pour voir tous les raccourcis
                    </p>
                    <button class="a11y-reset-btn" onclick="showShortcutsModal()" style="margin-top: 0.5rem;">
                        <i class="fas fa-keyboard" aria-hidden="true"></i>
                        Voir les raccourcis
                    </button>
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

    // Attacher les événements (les inline handlers ne fonctionnent pas bien avec innerHTML)
    document.getElementById('a11y-theme').addEventListener('change', function() {
        handleThemeChange(this.value);
    });
    document.getElementById('a11y-colorblind').addEventListener('change', function() {
        handleColorblindChange(this.value);
    });
    document.getElementById('a11y-dyslexic').addEventListener('change', function() {
        handleDyslexicChange(this.checked);
    });
    document.getElementById('a11y-ruler').addEventListener('change', function() {
        handleRulerChange(this.checked);
    });
    document.getElementById('a11y-falc').addEventListener('change', function() {
        handleFalcChange(this.checked);
    });
    document.getElementById('a11y-fontsize').addEventListener('input', function() {
        handleFontSizeChange(this.value);
    });
    document.getElementById('a11y-contrast').addEventListener('change', function() {
        handleContrastChange(this.checked);
    });
    document.getElementById('a11y-underline').addEventListener('change', function() {
        handleUnderlineChange(this.checked);
    });
    document.getElementById('a11y-motion').addEventListener('change', function() {
        handleMotionChange(this.checked);
    });

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

    // Contraste élevé
    const contrastCheckbox = document.getElementById('a11y-contrast');
    if (contrastCheckbox) contrastCheckbox.checked = a11ySettings.highContrast;

    // Liens soulignés
    const underlineCheckbox = document.getElementById('a11y-underline');
    if (underlineCheckbox) underlineCheckbox.checked = a11ySettings.underlineLinks;
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

function handleContrastChange(checked) {
    applyHighContrast(checked);
    saveA11ySettings();
    showToast(`Contraste élevé ${checked ? 'activé' : 'désactivé'}`, 'success');
}

function handleUnderlineChange(checked) {
    applyUnderlineLinks(checked);
    saveA11ySettings();
    showToast(`Liens soulignés ${checked ? 'activés' : 'désactivés'}`, 'success');
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
// RECHERCHE GLOBALE
// ==========================================

// Données de recherche
const SEARCH_DATA = {
    pages: [
        { id: 'dashboard', title: 'Tableau de bord', icon: 'fa-tachometer-alt', keywords: ['accueil', 'home', 'dashboard'] },
        { id: 'schedule', title: 'Emploi du temps', icon: 'fa-calendar-alt', keywords: ['planning', 'cours', 'horaires'] },
        { id: 'grades', title: 'Notes et résultats', icon: 'fa-chart-line', keywords: ['notes', 'bulletin', 'moyenne'] },
        { id: 'messages', title: 'Messagerie', icon: 'fa-envelope', keywords: ['messages', 'mail', 'communication'] },
        { id: 'documents', title: 'Documents', icon: 'fa-folder', keywords: ['fichiers', 'pdf', 'attestation'] },
        { id: 'absences', title: 'Absences', icon: 'fa-user-times', keywords: ['retard', 'présence'] },
        { id: 'profile', title: 'Mon profil', icon: 'fa-user', keywords: ['compte', 'informations', 'paramètres'] },
        { id: 'settings', title: 'Paramètres', icon: 'fa-cog', keywords: ['configuration', 'options'] }
    ],
    actions: [
        { id: 'new-message', title: 'Nouveau message', icon: 'fa-pen', action: () => openNewMessage?.() },
        { id: 'toggle-theme', title: 'Changer le thème', icon: 'fa-moon', action: () => handleThemeChange(a11ySettings.theme === 'dark' ? 'light' : 'dark') },
        { id: 'toggle-contrast', title: 'Activer contraste élevé', icon: 'fa-adjust', action: () => handleContrastChange(!a11ySettings.highContrast) },
        { id: 'logout', title: 'Déconnexion', icon: 'fa-sign-out-alt', action: () => logout?.() }
    ]
};

let searchSelectedIndex = 0;
let searchResults = [];

/**
 * Crée la recherche globale
 */
function createGlobalSearch() {
    const overlay = document.createElement('div');
    overlay.id = 'global-search-overlay';
    overlay.className = 'global-search-overlay';
    overlay.onclick = (e) => {
        if (e.target === overlay) closeGlobalSearch();
    };

    overlay.innerHTML = `
        <div class="global-search-container">
            <div class="global-search-header">
                <i class="fas fa-search" aria-hidden="true"></i>
                <input type="text" class="global-search-input" id="global-search-input"
                       placeholder="Rechercher une page, une action..."
                       autocomplete="off">
                <button class="global-search-close" onclick="closeGlobalSearch()">Échap</button>
            </div>
            <div class="global-search-results" id="global-search-results">
                <div class="global-search-empty">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <p>Commencez à taper pour rechercher</p>
                </div>
            </div>
            <div class="global-search-footer">
                <div class="search-footer-hint">
                    <span><kbd>↑</kbd><kbd>↓</kbd> Naviguer</span>
                    <span><kbd>↵</kbd> Sélectionner</span>
                    <span><kbd>Échap</kbd> Fermer</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Événements de recherche
    const input = document.getElementById('global-search-input');
    input.addEventListener('input', handleSearchInput);
    input.addEventListener('keydown', handleSearchKeydown);
}

/**
 * Ouvre la recherche globale
 */
function openGlobalSearch() {
    const overlay = document.getElementById('global-search-overlay');
    overlay.classList.add('open');

    const input = document.getElementById('global-search-input');
    input.value = '';
    input.focus();

    // Afficher les résultats par défaut
    showDefaultSearchResults();
    searchSelectedIndex = 0;
}

/**
 * Ferme la recherche globale
 */
function closeGlobalSearch() {
    const overlay = document.getElementById('global-search-overlay');
    overlay.classList.remove('open');
}

/**
 * Affiche les résultats par défaut
 */
function showDefaultSearchResults() {
    const resultsContainer = document.getElementById('global-search-results');
    searchResults = [...SEARCH_DATA.pages.slice(0, 5), ...SEARCH_DATA.actions.slice(0, 3)];

    resultsContainer.innerHTML = `
        <div class="search-result-group">
            <div class="search-result-group-title">Pages récentes</div>
            ${SEARCH_DATA.pages.slice(0, 5).map((item, i) => createSearchResultItem(item, 'page', i)).join('')}
        </div>
        <div class="search-result-group">
            <div class="search-result-group-title">Actions rapides</div>
            ${SEARCH_DATA.actions.slice(0, 3).map((item, i) => createSearchResultItem(item, 'action', i + 5)).join('')}
        </div>
    `;

    updateSearchSelection();
}

/**
 * Crée un élément de résultat de recherche
 */
function createSearchResultItem(item, type, index) {
    return `
        <div class="search-result-item" data-id="${item.id}" data-type="${type}" data-index="${index}"
             onclick="selectSearchResult(${index})" onmouseenter="searchSelectedIndex = ${index}; updateSearchSelection()">
            <div class="search-result-icon">
                <i class="fas ${item.icon}" aria-hidden="true"></i>
            </div>
            <div class="search-result-content">
                <div class="search-result-title">${item.title}</div>
                <div class="search-result-subtitle">${type === 'page' ? 'Page' : 'Action'}</div>
            </div>
        </div>
    `;
}

/**
 * Gère la saisie dans la recherche
 */
function handleSearchInput(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('global-search-results');

    if (!query) {
        showDefaultSearchResults();
        return;
    }

    // Filtrer les résultats
    const pageResults = SEARCH_DATA.pages.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.keywords.some(k => k.includes(query))
    );

    const actionResults = SEARCH_DATA.actions.filter(a =>
        a.title.toLowerCase().includes(query)
    );

    searchResults = [...pageResults, ...actionResults];
    searchSelectedIndex = 0;

    if (searchResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="global-search-empty">
                <i class="fas fa-search" aria-hidden="true"></i>
                <p>Aucun résultat pour "${query}"</p>
            </div>
        `;
        return;
    }

    let html = '';

    if (pageResults.length > 0) {
        html += `
            <div class="search-result-group">
                <div class="search-result-group-title">Pages</div>
                ${pageResults.map((item, i) => createSearchResultItem(item, 'page', i)).join('')}
            </div>
        `;
    }

    if (actionResults.length > 0) {
        html += `
            <div class="search-result-group">
                <div class="search-result-group-title">Actions</div>
                ${actionResults.map((item, i) => createSearchResultItem(item, 'action', i + pageResults.length)).join('')}
            </div>
        `;
    }

    resultsContainer.innerHTML = html;
    updateSearchSelection();
}

/**
 * Gère les touches dans la recherche
 */
function handleSearchKeydown(e) {
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            searchSelectedIndex = Math.min(searchSelectedIndex + 1, searchResults.length - 1);
            updateSearchSelection();
            break;
        case 'ArrowUp':
            e.preventDefault();
            searchSelectedIndex = Math.max(searchSelectedIndex - 1, 0);
            updateSearchSelection();
            break;
        case 'Enter':
            e.preventDefault();
            selectSearchResult(searchSelectedIndex);
            break;
        case 'Escape':
            e.preventDefault();
            closeGlobalSearch();
            break;
    }
}

/**
 * Met à jour la sélection visuelle
 */
function updateSearchSelection() {
    const items = document.querySelectorAll('.search-result-item');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === searchSelectedIndex);
    });

    // Scroll si nécessaire
    const selectedItem = items[searchSelectedIndex];
    if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
    }
}

/**
 * Sélectionne un résultat de recherche
 */
function selectSearchResult(index) {
    const result = searchResults[index];
    if (!result) return;

    closeGlobalSearch();

    // Naviguer vers la page ou exécuter l'action
    if (result.action) {
        result.action();
    } else if (typeof navigateTo === 'function') {
        navigateTo(result.id);
    } else {
        // Fallback : chercher le lien dans la navigation
        const navItem = document.querySelector(`.nav-item[data-page="${result.id}"]`);
        if (navItem) navItem.click();
    }
}

// ==========================================
// RACCOURCIS CLAVIER
// ==========================================

/**
 * Crée le modal des raccourcis
 */
function createShortcutsModal() {
    const modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.onclick = (e) => {
        if (e.target === modal) closeShortcutsModal();
    };

    modal.innerHTML = `
        <div class="modal shortcuts-modal">
            <div class="modal-header">
                <h2><i class="fas fa-keyboard" aria-hidden="true"></i> Raccourcis clavier</h2>
                <button class="modal-close" onclick="closeShortcutsModal()" aria-label="Fermer">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="modal-body">
                <ul class="shortcuts-list">
                    <li>
                        <span>Recherche globale</span>
                        <span class="shortcut-key"><kbd>Ctrl</kbd><kbd>K</kbd></span>
                    </li>
                    <li>
                        <span>Accessibilité</span>
                        <span class="shortcut-key"><kbd>Alt</kbd><kbd>A</kbd></span>
                    </li>
                    <li>
                        <span>Accueil</span>
                        <span class="shortcut-key"><kbd>Alt</kbd><kbd>H</kbd></span>
                    </li>
                    <li>
                        <span>Messages</span>
                        <span class="shortcut-key"><kbd>Alt</kbd><kbd>M</kbd></span>
                    </li>
                    <li>
                        <span>Notes</span>
                        <span class="shortcut-key"><kbd>Alt</kbd><kbd>N</kbd></span>
                    </li>
                    <li>
                        <span>Documents</span>
                        <span class="shortcut-key"><kbd>Alt</kbd><kbd>D</kbd></span>
                    </li>
                    <li>
                        <span>Afficher ce panneau</span>
                        <span class="shortcut-key"><kbd>?</kbd></span>
                    </li>
                    <li>
                        <span>Fermer</span>
                        <span class="shortcut-key"><kbd>Échap</kbd></span>
                    </li>
                </ul>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Affiche le modal des raccourcis
 */
function showShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('open'), 10);
}

/**
 * Ferme le modal des raccourcis
 */
function closeShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    modal.classList.remove('open');
    setTimeout(() => modal.style.display = 'none', 300);
}

/**
 * Initialise les raccourcis clavier
 */
function initKeyboardShortcuts() {
    document.addEventListener('keydown', handleGlobalKeydown);
}

/**
 * Gère les raccourcis clavier globaux
 */
function handleGlobalKeydown(e) {
    // Ignorer si on est dans un champ de saisie (sauf pour certains raccourcis)
    const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;

    // Ctrl+K : Recherche globale (fonctionne même dans les champs)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openGlobalSearch();
        return;
    }

    // Escape : Fermer les modals
    if (e.key === 'Escape') {
        const searchOverlay = document.getElementById('global-search-overlay');
        const a11yPanel = document.getElementById('a11y-panel');
        const shortcutsModal = document.getElementById('shortcuts-modal');

        if (searchOverlay?.classList.contains('open')) {
            closeGlobalSearch();
        } else if (a11yPanel?.classList.contains('open')) {
            closeA11yPanel();
        } else if (shortcutsModal?.style.display === 'flex') {
            closeShortcutsModal();
        }
        return;
    }

    // Ne pas traiter les autres raccourcis si on est dans un champ
    if (isInputField) return;

    // ? : Afficher les raccourcis
    if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        showShortcutsModal();
        return;
    }

    // Alt + touche : Navigation
    if (e.altKey) {
        switch(e.key.toLowerCase()) {
            case 'a':
                e.preventDefault();
                openA11yPanel();
                break;
            case 'h':
                e.preventDefault();
                navigateToPage('dashboard');
                break;
            case 'm':
                e.preventDefault();
                navigateToPage('messages');
                break;
            case 'n':
                e.preventDefault();
                navigateToPage('grades');
                break;
            case 'd':
                e.preventDefault();
                navigateToPage('documents');
                break;
        }
    }
}

/**
 * Navigation vers une page
 */
function navigateToPage(pageId) {
    if (typeof navigateTo === 'function') {
        navigateTo(pageId);
    } else {
        const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
        if (navItem) navItem.click();
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
window.handleContrastChange = handleContrastChange;
window.handleUnderlineChange = handleUnderlineChange;
window.resetA11ySettings = resetA11ySettings;
window.openGlobalSearch = openGlobalSearch;
window.closeGlobalSearch = closeGlobalSearch;
window.selectSearchResult = selectSearchResult;
window.showShortcutsModal = showShortcutsModal;
window.closeShortcutsModal = closeShortcutsModal;
