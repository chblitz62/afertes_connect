/**
 * Module Messagerie
 * Gère les conversations privées et les messages de groupe
 */

// ===========================================
// Variables d'état
// ===========================================
let activeConversation = null;
let currentGroupId = null;

// ===========================================
// Conversations privées
// ===========================================

function loadConversations() {
    const conversations = getConversations();
    const container = document.getElementById('conversations-items');
    if (!container) return;

    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item ${conv.unread ? 'unread' : ''}" onclick="openConversation(${conv.id})">
            <img src="${conv.avatar}" alt="${conv.name}" class="conversation-avatar">
            <div class="conversation-info">
                <h4>${escapeHtml(conv.name)}</h4>
                <p>${escapeHtml(conv.lastMessage)}</p>
            </div>
            <div class="conversation-meta">
                <span class="time">${formatDate(conv.lastDate)}</span>
                ${conv.unread ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function openConversation(id) {
    activeConversation = id;
    const conversations = getConversations();
    const conv = conversations.find(c => c.id === id);
    const messages = getConversationMessages(id);
    const container = document.getElementById('chat-container');
    if (!container || !conv) return;

    // Marquer la conversation comme lue
    if (conv.unread) {
        conv.unread = false;
        conv.unreadCount = 0;
        localStorage.setItem('afertes_conversations', JSON.stringify(conversations));
        loadConversations();
    }

    container.innerHTML = `
        <div class="chat-header">
            <img src="${conv.avatar}" alt="${escapeHtml(conv.name)}" style="width: 40px; height: 40px; border-radius: 50%;">
            <div>
                <h4 style="font-size: 0.95rem;">${escapeHtml(conv.name)}</h4>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(conv.role || '')}</span>
            </div>
        </div>
        <div class="chat-messages" id="chat-messages">
            ${messages.map(msg => `
                <div class="message ${msg.sent ? 'sent' : 'received'}">
                    <div class="message-content">${escapeHtml(msg.content)}</div>
                    <span class="message-time">${formatTime(msg.date)}</span>
                </div>
            `).join('')}
        </div>
        <div class="chat-input">
            <input type="text" id="message-input" placeholder="Écrivez votre message..." onkeypress="handleMessageKeypress(event)">
            <button onclick="sendMessage()">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;

    // Scroll to bottom
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function handleMessageKeypress(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content || !activeConversation) return;

    // Ajouter le message
    const messages = document.getElementById('chat-messages');
    if (messages) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message sent';
        msgDiv.innerHTML = `
            <div class="message-content">${escapeHtml(content)}</div>
            <span class="message-time">${formatTime(new Date())}</span>
        `;
        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight;
    }

    input.value = '';

    // Sauvegarder le message
    saveMessage(activeConversation, content);
}

function saveMessage(conversationId, content) {
    const key = `afertes_messages_${conversationId}`;
    const messages = JSON.parse(localStorage.getItem(key) || '[]');
    const now = new Date().toISOString();

    messages.push({
        id: Date.now(),
        content,
        sent: true,
        date: now
    });
    localStorage.setItem(key, JSON.stringify(messages));

    // Mettre à jour le lastMessage de la conversation
    updateConversationLastMessage(conversationId, content, now);
}

function updateConversationLastMessage(conversationId, content, date) {
    const conversations = getConversations();
    const convIndex = conversations.findIndex(c => c.id === conversationId);

    if (convIndex !== -1) {
        // Tronquer le message si trop long
        const truncated = content.length > 50 ? content.substring(0, 47) + '...' : content;
        conversations[convIndex].lastMessage = truncated;
        conversations[convIndex].lastDate = date;

        // Déplacer la conversation en haut de la liste
        const [conv] = conversations.splice(convIndex, 1);
        conversations.unshift(conv);

        localStorage.setItem('afertes_conversations', JSON.stringify(conversations));
        loadConversations();
    }
}

function newConversation() {
    const users = getAllUsers().filter(u => u.id !== window.currentUser?.id);

    showModal(`
        <h2><i class="fas fa-plus" style="color: var(--primary-color);"></i> Nouvelle conversation</h2>
        <div class="form-group" style="margin-top: 16px;">
            <label>Rechercher un contact</label>
            <input type="text" id="contact-search" placeholder="Nom, prénom..." oninput="filterContacts()">
        </div>
        <div id="contacts-list" style="max-height: 300px; overflow-y: auto;">
            ${users.map(user => `
                <div class="conversation-item" onclick="startConversation(${user.id})" style="cursor: pointer;">
                    <img src="${user.avatar}" class="conversation-avatar">
                    <div class="conversation-info">
                        <h4>${escapeHtml(user.firstname)} ${escapeHtml(user.lastname)}</h4>
                        <p>${user.role === 'teacher' ? 'Formateur' : escapeHtml(window.APP_CONFIG?.formations[user.formation] || '')}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `);
}

function filterContacts() {
    const search = document.getElementById('contact-search').value.toLowerCase();
    const users = getAllUsers().filter(u => u.id !== window.currentUser?.id);
    const filtered = users.filter(u =>
        u.firstname.toLowerCase().includes(search) ||
        u.lastname.toLowerCase().includes(search)
    );

    const container = document.getElementById('contacts-list');
    if (container) {
        container.innerHTML = filtered.map(user => `
            <div class="conversation-item" onclick="startConversation(${user.id})" style="cursor: pointer;">
                <img src="${user.avatar}" class="conversation-avatar">
                <div class="conversation-info">
                    <h4>${escapeHtml(user.firstname)} ${escapeHtml(user.lastname)}</h4>
                    <p>${user.role === 'teacher' ? 'Formateur' : escapeHtml(window.APP_CONFIG?.formations[user.formation] || '')}</p>
                </div>
            </div>
        `).join('');
    }
}

function startConversation(userId) {
    closeModal();

    const conversations = getConversations();
    const user = getAllUsers().find(u => u.id === userId);

    if (!user) {
        showToast('Utilisateur introuvable', 'error');
        return;
    }

    // Vérifier si une conversation existe déjà avec cet utilisateur
    const existingConv = conversations.find(c => c.userId === userId);

    if (existingConv) {
        // Ouvrir la conversation existante
        openConversation(existingConv.id);
        showToast('Conversation ouverte', 'success');
    } else {
        // Créer une nouvelle conversation
        const newConv = {
            id: Date.now(),
            userId: user.id,
            name: `${user.firstname} ${user.lastname}`,
            avatar: user.avatar || 'img/default-avatar.svg',
            role: user.role === 'teacher' ? 'Formateur' : (window.APP_CONFIG?.formations[user.formation] || 'Étudiant'),
            lastMessage: '',
            lastDate: new Date().toISOString(),
            unread: false,
            unreadCount: 0
        };

        conversations.unshift(newConv);
        localStorage.setItem('afertes_conversations', JSON.stringify(conversations));

        // Envoyer une notification email si le destinataire n'est pas connecté
        if (typeof sendEmailNotification === 'function') {
            sendEmailNotification(user, 'new_conversation', {
                senderName: `${window.currentUser?.firstname} ${window.currentUser?.lastname}`
            });
        }

        // Recharger la liste et ouvrir la conversation
        loadConversations();
        openConversation(newConv.id);
        showToast('Nouvelle conversation créée', 'success');
    }
}

// ===========================================
// Messagerie de groupe
// ===========================================

function initGroupMessages() {
    if (!localStorage.getItem('afertes_groups')) {
        localStorage.setItem('afertes_groups', JSON.stringify([
            {
                id: 1,
                name: 'Promo ES 2024-2027',
                type: 'promo',
                formation: 'es',
                promo: '2024-2027',
                members: [],
                messages: []
            },
            {
                id: 2,
                name: 'Promo ME 2024-2026',
                type: 'promo',
                formation: 'me',
                promo: '2024-2026',
                members: [],
                messages: []
            }
        ]));
    }
    loadGroups();
}

function loadGroups() {
    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    const container = document.getElementById('groups-items');
    if (!container) return;

    const userGroups = groups.filter(g => {
        if (g.type === 'promo') {
            return (window.currentUser?.formation === g.formation && window.currentUser?.promo === g.promo) ||
                   window.currentUser?.role === 'teacher' ||
                   window.currentUser?.role === 'secretary';
        }
        return g.members?.includes(window.currentUser?.id);
    });

    if (userGroups.length === 0) {
        container.innerHTML = '<p style="padding: 16px; color: var(--text-muted);">Aucun groupe disponible</p>';
        return;
    }

    container.innerHTML = userGroups.map(group => {
        const lastMsg = group.messages?.[group.messages.length - 1];
        return `
            <div class="group-item" onclick="openGroupChat(${group.id})">
                <div class="group-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div class="group-info">
                    <h4>${escapeHtml(group.name)}</h4>
                    <p>${lastMsg ? escapeHtml(lastMsg.text.substring(0, 30)) + '...' : 'Aucun message'}</p>
                </div>
                <div class="group-meta">
                    <span class="time">${lastMsg ? formatTimeAgo(lastMsg.timestamp) : ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

function openGroupChat(groupId) {
    currentGroupId = groupId;
    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.group-item[onclick="openGroupChat(${groupId})"]`)?.classList.add('active');

    const container = document.getElementById('group-chat-container');
    if (!container) return;

    container.innerHTML = `
        <div class="chat-header">
            <div class="group-avatar" style="width: 40px; height: 40px;">
                <i class="fas fa-users"></i>
            </div>
            <div>
                <h4>${escapeHtml(group.name)}</h4>
                <span style="font-size: 0.85rem; color: var(--text-light);">${group.type === 'promo' ? 'Groupe de promotion' : 'Groupe privé'}</span>
            </div>
        </div>
        <div class="chat-messages" id="group-messages">
            ${renderGroupMessages(group.messages || [])}
        </div>
        <div class="chat-input">
            <input type="text" id="group-message-input" placeholder="Écrire un message..." onkeypress="handleGroupMessageKeypress(event)">
            <button onclick="sendGroupMessage()"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;

    const messagesDiv = document.getElementById('group-messages');
    if (messagesDiv) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function renderGroupMessages(messages) {
    const users = JSON.parse(localStorage.getItem('afertes_users') || '[]');
    return messages.map(msg => {
        const sender = users.find(u => u.id === msg.senderId);
        const isMine = msg.senderId === window.currentUser?.id;
        return `
            <div class="message ${isMine ? 'sent' : 'received'}">
                ${!isMine ? `<div style="font-size: 0.75rem; color: var(--text-light); margin-bottom: 4px;">${escapeHtml(sender?.firstname || 'Utilisateur')}</div>` : ''}
                <div class="message-content">${escapeHtml(msg.text)}</div>
                <div class="message-time">${formatTimeAgo(msg.timestamp)}</div>
            </div>
        `;
    }).join('');
}

function sendGroupMessage() {
    const input = document.getElementById('group-message-input');
    const text = input.value.trim();
    if (!text || !currentGroupId) return;

    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    const groupIdx = groups.findIndex(g => g.id === currentGroupId);
    if (groupIdx === -1) return;

    if (!groups[groupIdx].messages) groups[groupIdx].messages = [];
    groups[groupIdx].messages.push({
        id: Date.now(),
        senderId: window.currentUser?.id,
        text: text,
        timestamp: new Date().toISOString()
    });

    localStorage.setItem('afertes_groups', JSON.stringify(groups));
    input.value = '';
    openGroupChat(currentGroupId);
}

function handleGroupMessageKeypress(e) {
    if (e.key === 'Enter') sendGroupMessage();
}

function createGroup() {
    const name = prompt('Nom du groupe:');
    if (!name) return;

    const groups = JSON.parse(localStorage.getItem('afertes_groups') || '[]');
    groups.push({
        id: Date.now(),
        name: name,
        type: 'custom',
        members: [window.currentUser?.id],
        messages: [],
        createdBy: window.currentUser?.id,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('afertes_groups', JSON.stringify(groups));
    loadGroups();
    showToast('Groupe créé', 'success');
}

// ===========================================
// Utilitaires
// ===========================================

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Fonction d'échappement HTML si non définie
function escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') {
        return window.escapeHtml(str);
    }
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

// ===========================================
// Export des fonctions pour utilisation globale
// ===========================================

window.loadConversations = loadConversations;
window.openConversation = openConversation;
window.handleMessageKeypress = handleMessageKeypress;
window.sendMessage = sendMessage;
window.saveMessage = saveMessage;
window.updateConversationLastMessage = updateConversationLastMessage;
window.newConversation = newConversation;
window.filterContacts = filterContacts;
window.startConversation = startConversation;
window.initGroupMessages = initGroupMessages;
window.loadGroups = loadGroups;
window.openGroupChat = openGroupChat;
window.renderGroupMessages = renderGroupMessages;
window.sendGroupMessage = sendGroupMessage;
window.handleGroupMessageKeypress = handleGroupMessageKeypress;
window.createGroup = createGroup;
window.formatTimeAgo = formatTimeAgo;
