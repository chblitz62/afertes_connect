/**
 * Service d'envoi d'emails
 * Configure automatiquement selon les variables d'environnement
 */

const nodemailer = require('nodemailer');

// Configuration du transporteur
let transporter = null;

/**
 * Initialise le transporteur d'email
 */
function initTransporter() {
    // Si déjà initialisé, retourner
    if (transporter) return transporter;

    // Vérifier si les variables SMTP sont configurées
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
        // Configuration SMTP réelle
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: smtpPort === '465',
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });

        console.log('[Mailer] Transporteur SMTP configuré:', smtpHost);
    } else {
        // Mode démo - utiliser un compte de test Ethereal
        console.log('[Mailer] Variables SMTP non configurées - mode démo activé');
        console.log('[Mailer] Configurez SMTP_HOST, SMTP_USER, SMTP_PASS dans .env pour l\'envoi réel');
        transporter = null;
    }

    return transporter;
}

/**
 * Envoie un email
 * @param {object} options - Options de l'email
 * @param {string} options.to - Destinataire
 * @param {string} options.subject - Sujet
 * @param {string} options.text - Contenu texte
 * @param {string} options.html - Contenu HTML (optionnel)
 * @returns {object} - Résultat de l'envoi
 */
async function sendMail({ to, subject, text, html }) {
    const transport = initTransporter();

    if (!transport) {
        // Mode démo - simuler l'envoi
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║  EMAIL SIMULÉ (MODE DÉMO - SMTP non configuré)                    ║');
        console.log('╠═══════════════════════════════════════════════════════════════════╣');
        console.log(`║  À: ${to}`);
        console.log(`║  Sujet: ${subject}`);
        console.log('║');
        console.log('║  Contenu:');
        text.split('\n').forEach(line => {
            console.log(`║  ${line}`);
        });
        console.log('╚═══════════════════════════════════════════════════════════════════╝');
        console.log('');

        return {
            success: true,
            demo: true,
            message: 'Email simulé en mode démo'
        };
    }

    try {
        const info = await transport.sendMail({
            from: process.env.SMTP_FROM || `"AFERTES Connect" <noreply@afertes.org>`,
            to,
            subject,
            text,
            html: html || text.replace(/\n/g, '<br>')
        });

        console.log(`[Mailer] Email envoyé à ${to}: ${info.messageId}`);

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error('[Mailer] Erreur envoi email:', error);
        throw error;
    }
}

/**
 * Envoie un email de réinitialisation de mot de passe
 * @param {object} user - Utilisateur
 * @param {string} token - Token de réinitialisation
 * @param {string} baseUrl - URL de base de l'application
 */
async function sendPasswordResetEmail(user, token, baseUrl) {
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    const subject = 'Réinitialisation de votre mot de passe - AFERTES Connect';

    const text = `Bonjour ${user.first_name || 'utilisateur'},

Vous avez demandé la réinitialisation de votre mot de passe sur AFERTES Connect.

Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :
${resetLink}

Ce lien expire dans 1 heure.

Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.

Cordialement,
L'équipe AFERTES Connect`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #253672; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #253672; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .button:hover { background: #1a2650; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AFERTES Connect</h1>
        </div>
        <div class="content">
            <h2>Réinitialisation de mot de passe</h2>
            <p>Bonjour ${user.first_name || 'utilisateur'},</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe sur AFERTES Connect.</p>
            <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
            <p style="text-align: center;">
                <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
            </p>
            <div class="warning">
                <strong>Ce lien expire dans 1 heure.</strong>
            </div>
            <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
            <p style="word-break: break-all; font-size: 12px; color: #666;">${resetLink}</p>
            <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
        </div>
        <div class="footer">
            <p>AFERTES - Centre de formation en travail social</p>
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
    </div>
</body>
</html>`;

    return await sendMail({ to: user.email, subject, text, html });
}

/**
 * Vérifie si l'envoi d'email est configuré
 */
function isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

module.exports = {
    sendMail,
    sendPasswordResetEmail,
    isConfigured,
    initTransporter
};
