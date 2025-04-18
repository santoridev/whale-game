let tg = window.Telegram.WebApp;
tg.ready();
tg.setHeaderColor('#000000');
tg.expand();

// Optimize for Telegram WebApp
document.body.style.width = `${window.innerWidth}px`;
document.body.style.height = `${window.innerHeight}px`;
window.addEventListener('resize', () => {
    document.body.style.width = `${window.innerWidth}px`;
    document.body.style.height = `${window.innerHeight}px`;
    // Ensure bottom-nav stays fixed
    const bottomNav = document.querySelector('.bottom-nav');
    bottomNav.style.position = 'fixed';
    bottomNav.style.bottom = '10px';
});

const telegramUser = tg.initDataUnsafe?.user || {};
const telegramId = telegramUser?.id || 0;
const username = telegramUser?.username || "WhalePlayer" + Math.round(Math.sqrt(telegramId));
const isPremium = telegramUser?.is_premium || false;

let bananaCount = 0;
let friendsCount = 0;
let hasCompletedWelcome = false;
let miningLevel = 0;

const characters = [
    { name: "Shrimp", image: "🦐", requiredBananas: 0 },
    { name: "Dolphin", image: "🐬", requiredBananas: 30000 },
    { name: "Whale", image: "🐳", requiredBananas: 50000 }
];

let currentCharacterIndex = 0;

function calculateWelcomeBonus(user) {
    let bonus = 100;
    if (user.is_premium) bonus += 4000;
    const ageFactor = Math.max(0, 1 - (user.id / 1000000000));
    bonus += Math.round(ageFactor * 10000);
    if (user.username) bonus += 500;
    if (user.first_name) bonus += 300;
    if (user.last_name) bonus += 200;
    if (user.photo_url) bonus += 400;
    return Math.max(100, bonus);
}

async function fetchUserState() {
    try {
        const response = await fetch(`/get_user_state`);
        if (response.ok) {
            const data = await response.json();
            bananaCount = data.banana_count || 0;
            friendsCount = data.referrals || 0;
            hasCompletedWelcome = data.has_completed_welcome || false;
            miningLevel = data.mining_level || 0;
            document.getElementById('banana-count').textContent = bananaCount;
            document.getElementById('friends-count').textContent = friendsCount;
        }
    } catch (error) {
        console.error('Error fetching user state:', error);
    }
}

async function updateUserState(banana_count, has_completed_welcome) {
    try {
        const response = await fetch('/update_user_state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: telegramId,
                banana_count: banana_count !== undefined ? banana_count : bananaCount,
                has_completed_welcome: has_completed_welcome !== undefined ? has_completed_welcome : hasCompletedWelcome
            })
        });
        if (response.ok) {
            await fetchUserState();
        }
    } catch (error) {
        console.error('Error updating user state:', error);
    }
}

async function authenticateWithServer() {
    try {
        const response = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: Telegram.WebApp.initData })
        });
        if (response.ok) {
            await fetchUserState();
        }
    } catch (error) {
        console.error('Error authenticating:', error);
    }
}

async function showWelcomeScreen() {
    await authenticateWithServer();
    const welcomeScreen = document.getElementById('welcome-screen');
    if (hasCompletedWelcome) {
        welcomeScreen.style.display = 'none';
        startMainScreen();
        return;
    }

    welcomeScreen.classList.add('active');
    const bonus = calculateWelcomeBonus(telegramUser);
    setTimeout(() => {
        document.getElementById('welcome-bonus').innerHTML = `
            <strong>Welcome Bonus:</strong> ${bonus} !<br>
            ${isPremium ? "⭐ Premium bonus applied!" : ""}
        `;
    }, 1000);

    document.getElementById('start-button').addEventListener('click', async function startHandler() {
        await updateUserState(bonus, true);
        welcomeScreen.classList.remove('active');
        welcomeScreen.style.display = 'none';
        startMainScreen();
        this.removeEventListener('click', startHandler);
    });
}

async function switchScreen(screenName) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
        screen.style.visibility = 'hidden';
    });

    const activeScreen = document.getElementById(`${screenName}-screen`);
    activeScreen.classList.add('active');
    activeScreen.style.display = 'block';
    activeScreen.style.visibility = 'visible';

    const navLinks = document.querySelectorAll('.bottom-nav a');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-screen') === screenName) {
            link.classList.add('active');
        }
    });

    if (screenName === 'leaders') await loadLeaders();
    if (screenName === 'tasks') await loadTasks();
}

function startMainScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.style.display = 'none';
    welcomeScreen.style.visibility = 'hidden';
    
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
        screen.style.visibility = 'hidden';
    });

    const homeScreen = document.getElementById('home-screen');
    homeScreen.classList.add('active');
    homeScreen.style.display = 'block';
    homeScreen.style.visibility = 'visible';
    
    const bottomNav = document.querySelector('.bottom-nav');
    bottomNav.style.display = 'flex';
    bottomNav.style.position = 'fixed';
    bottomNav.style.bottom = '10px';
    bottomNav.style.zIndex = '1000';
    
    const navLinks = document.querySelectorAll('.bottom-nav a');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-screen') === 'home') {
            link.classList.add('active');
        }
    });

    updateCharacterDisplay();
}

async function loadLeaders() {
    const kingContainer = document.getElementById('king-container');
    const leadersContainer = document.getElementById('leaders-container');
    try {
        const response = await fetch('/leaderboard?limit=1000');
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        const data = await response.json();
        const leaders = data.leaders;

        function truncateUsername(username, maxLength = 18) {
            if (username.length > maxLength) {
                return username.substring(0, maxLength - 3) + '...';
            }
            return username;
        }

        function getRankEmoji(bananaCount) {
            if (bananaCount >= 50000) return '🐳';
            if (bananaCount >= 30000) return '🐬';
            if (bananaCount >= 5000) return '🦐';
            return '🐟';
        }

        if (leaders && leaders.length > 0) {
            const topLeader = leaders[0];
            kingContainer.innerHTML = `
                <div class="king-card">
                    <h3>🐳 Top Whale: ${truncateUsername(topLeader.username)}</h3>
                    <p>Tokens: ${topLeader.banana_count} ${getRankEmoji(topLeader.banana_count)}</p>
                </div>
            `;
        } else {
            kingContainer.innerHTML = `
                <div class="king-card">
                    <h3>🐳 Top Whale</h3>
                    <p>No Whale yet!</p>
                </div>
            `;
        }

        leadersContainer.innerHTML = leaders.length ? leaders.map(leader => `
            <div class="leader-card d-flex align-items-center ${leader.is_current_user ? 'bg-warning bg-opacity-10' : ''}">
                <div class="leader-position">${leader.rank}</div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between">
                        <strong>${truncateUsername(leader.username)}${leader.is_current_user ? ' (You)' : ''}</strong>
                        <span class="text-warning">${leader.banana_count} ${getRankEmoji(leader.banana_count)}</span>
                    </div>
                    <div class="progress mt-2" style="height: 5px;">
                        <div class="progress-bar bg-warning" style="width: ${Math.min(100, (leader.banana_count / leaders[0].banana_count) * 100)}%"></div>
                    </div>
                </div>
            </div>
        `).join('') : '<p class="text-muted text-center">No leaders yet!</p>';
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        kingContainer.innerHTML = '<p class="text-muted text-center">Error loading King</p>';
        leadersContainer.innerHTML = '<p class="text-muted text-center">Error loading leaderboard</p>';
    }
}

function shareInviteLink() {
    const shareText = `Join me on Become a Whale Game and let's earn  together! Use my invite link:`;
    const referralUrl = `https://t.me/wwwhalegame_bot/whale?startapp=${telegramId}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`);
    setTimeout(fetchUserState, 5000);
}

async function loadTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '<p class="text-muted text-center">Loading tasks...</p>';
    try {
        const response = await fetch(`/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const data = await response.json();
        const tasks = data.tasks;
        container.innerHTML = tasks.length ? tasks.map(createTaskHTML).join('') : '<p class="text-muted text-center">No tasks available!</p>';
    } catch (error) {
        console.error('Error loading tasks:', error);
        container.innerHTML = '<p class="text-muted text-center">Error loading tasks</p>';
    }
}

window.goClicked = window.goClicked || {};

function createTaskHTML(task) {
    const isReferralTask = task.required !== null;
    const progressPercent = isReferralTask ? (task.progress / task.required) * 100 : 100;
    const canComplete = isReferralTask ? (task.progress >= task.required && !task.completed) : !task.completed;
    const claimEnabled = isReferralTask ? canComplete : (window.goClicked[task.id] && !task.completed);

    return `
        <div class="task-card" id="task-${task.id}">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h5 class="mb-0">${task.title}</h5>
                <span class="task-reward">+${task.reward}</span>
            </div>
           <p class="small white-text mb-2">${task.description}</p>
            ${isReferralTask ? `
                <div class="task-requirements">Friends: ${task.progress}/${task.required}</div>
                <div class="task-progress"><div class="task-progress-bar" style="width: ${progressPercent}%"></div></div>
            ` : ''}
            <div class="d-flex justify-content-between mt-2">
                <button class="btn btn-sm ${task.completed ? 'btn-secondary' : 'btn-warning'}" 
                        ${task.completed ? 'disabled' : ''} 
                        onclick="${isReferralTask ? 'shareInviteLink()' : `handleGoClick('${task.id}', '${task.link}')`}">
                    ${isReferralTask ? 'Invite' : 'Go'}
                </button>
                <button class="btn btn-sm ${task.completed ? 'btn-success' : claimEnabled ? 'btn-primary' : 'btn-secondary'}" 
                        id="claim-btn-${task.id}" onclick="checkTask('${task.id}')" 
                        ${task.completed || !claimEnabled ? 'disabled' : ''}>
                    ${task.completed ? 'Completed' : 'Claim'}
                </button>
            </div>
        </div>
    `;
}

window.handleGoClick = function(taskId, link) {
    window.goClicked[taskId] = true;
    window.open(link, '_blank');
    const claimButton = document.getElementById(`claim-btn-${taskId}`);
    if (claimButton) {
        claimButton.classList.replace('btn-secondary', 'btn-primary');
        claimButton.removeAttribute('disabled');
    }
};

async function checkTask(taskId) {
    try {
        const response = await fetch('/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: telegramId, task_id: taskId })
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Failed to complete task');
        const data = await response.json();
        bananaCount = data.banana_count;
        document.getElementById('banana-count').textContent = bananaCount;
        const claimButton = document.getElementById(`claim-btn-${taskId}`);
        if (claimButton) {
            claimButton.textContent = 'Completed';
            claimButton.classList.replace('btn-primary', 'btn-success');
            claimButton.setAttribute('disabled', 'true');
        }
        await fetchUserState();
        loadLeaders();
    } catch (error) {
        console.error('Error checking task:', error);
        Toastify({ text: error.message, duration: 3000, gravity: "top", position: "center", backgroundColor: "#ff4444", stopOnFocus: true }).showToast();
    }
}

function updateCharacterDisplay() {
    const characterImg = document.getElementById('character');
    const characterName = document.getElementById('character-name');
    const currentCharacter = characters[currentCharacterIndex];
    
    characterImg.textContent = currentCharacter.image;
    characterImg.style.fontSize = '100px';
    characterImg.style.display = 'block';
    characterImg.style.margin = '0 auto';
    
    characterName.textContent = bananaCount >= currentCharacter.requiredBananas 
        ? currentCharacter.name 
        : `${currentCharacter.name} (Unlock at ${currentCharacter.requiredBananas})`;

    document.getElementById('prev-character').disabled = currentCharacterIndex === 0;
    document.getElementById('next-character').disabled = 
        currentCharacterIndex === characters.length - 1 || 
        bananaCount < characters[currentCharacterIndex + 1].requiredBananas;
}

async function showMiningModal() {
    const modalBody = document.getElementById('mining-modal-body');
    modalBody.innerHTML = '<p>Loading mining information...</p>';

    try {
        await fetchUserState(); // Ensure we have the latest mining level
        const miningInfo = {
            1: { points_per_8h: 100, cost_stars: 499 },
            2: { points_per_8h: 400, cost_stars: 499 },
            3: { points_per_8h: 1000, cost_stars: 499 }
        };
        
        const nextLevel = miningLevel + 1;
        if (nextLevel > 3) {
            modalBody.innerHTML = '<p>You have reached the maximum mining level!</p>';
            document.getElementById('mining-buy-button').disabled = true;
            return;
        }

        modalBody.innerHTML = `
            <p><strong>Current Mining Level:</strong> ${miningLevel} ${miningLevel > 0 ? `(${miningInfo[miningLevel].points_per_8h} points every 8 hours)` : '(None)'}</p>
            <p><strong>Next Level (${nextLevel}):</strong> ${miningInfo[nextLevel].points_per_8h} points every 8 hours</p>
            <p><strong>Cost:</strong> ${miningInfo[nextLevel].cost_stars} Stars</p>
        `;
        document.getElementById('mining-buy-button').disabled = false;
    } catch (error) {
        console.error('Error loading mining info:', error);
        modalBody.innerHTML = '<p>Error loading mining information.</p>';
        document.getElementById('mining-buy-button').disabled = true;
    }
}

async function handleMiningPurchase() {
    try {
        const response = await fetch('/stars', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: 499 })
        });
        if (!response.ok) throw new Error('Failed to create invoice');
        const data = await response.json();
        if (data.status && data.invoice_link) {
            tg.openTelegramLink(data.invoice_link);
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('miningModal'));
            modal.hide();
            Toastify({
                text: "Invoice opened in Telegram!",
                duration: 3000,
                gravity: "top",
                position: "center",
                backgroundColor: "#00ff00",
                stopOnFocus: true
            }).showToast();
        } else {
            throw new Error(data.message || 'Failed to get invoice link');
        }
    } catch (error) {
        console.error('Error purchasing mining level:', error);
        Toastify({
            text: error.message || "Error creating invoice",
            duration: 3000,
            gravity: "top",
            position: "center",
            backgroundColor: "#ff4444",
            stopOnFocus: true
        }).showToast();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await showWelcomeScreen();

    const character = document.getElementById('character');
    character.removeEventListener('click', handleCharacterClick);
    character.addEventListener('click', handleCharacterClick);

    const prevChar = document.getElementById('prev-character');
    const nextChar = document.getElementById('next-character');
    prevChar.removeEventListener('click', handlePrevCharacter);
    nextChar.removeEventListener('click', handleNextCharacter);
    prevChar.addEventListener('click', handlePrevCharacter);
    nextChar.addEventListener('click', handleNextCharacter);

    const navLinks = document.querySelectorAll('.bottom-nav a');
    navLinks.forEach(link => {
        link.removeEventListener('click', handleNavClick);
        link.addEventListener('click', handleNavClick);
    });

    // Mining button event listener
    const miningButton = document.getElementById('mining-button');
    miningButton.addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('miningModal'));
        showMiningModal();
        modal.show();
    });

    // Mining buy button event listener
    const miningBuyButton = document.getElementById('mining-buy-button');
    miningBuyButton.addEventListener('click', handleMiningPurchase);
});

function handleCharacterClick() {
    updateUserState(bananaCount + 1);
    updateCharacterDisplay();
    document.getElementById('banana-count').textContent = bananaCount;
}

function handlePrevCharacter() {
    if (currentCharacterIndex > 0) {
        currentCharacterIndex--;
        updateCharacterDisplay();
    }
}

function handleNextCharacter() {
    if (currentCharacterIndex < characters.length - 1 && 
        bananaCount >= characters[currentCharacterIndex + 1].requiredBananas) {
        currentCharacterIndex++;
        updateCharacterDisplay();
    } else if (bananaCount < characters[currentCharacterIndex + 1].requiredBananas) {
        Toastify({
            text: `Need ${characters[currentCharacterIndex + 1].requiredBananas}  to unlock!`,
            duration: 3000,
            gravity: "top",
            position: "center",
            backgroundColor: "#ff4444",
            stopOnFocus: true
        }).showToast();
    }
}

function handleNavClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const screen = e.currentTarget.getAttribute('data-screen');
    switchScreen(screen);
}