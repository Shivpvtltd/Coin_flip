document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const coin = document.getElementById('coin');
    const coinWrapper = document.getElementById('coin-wrapper');
    const headsButton = document.getElementById('heads-button');
    const tailsButton = document.getElementById('tails-button');
    const betAmountInput = document.getElementById('bet-amount');
    const walletAmountSpan = document.getElementById('wallet-amount');
    const historyList = document.getElementById('history-list');
    const resultText = document.getElementById('result-text');
    const toast = document.getElementById('toast-notification');
    const betMinusBtn = document.getElementById('bet-minus');
    const betMinBtn = document.getElementById('bet-min');
    const betPlusBtn = document.getElementById('bet-plus');
    const betMaxBtn = document.getElementById('bet-max');
    const countdownDisplay = document.getElementById('countdown-display');

    // --- Config & State ---
    const API_BASE_URL = 'https://coinflip-backend-1.onrender.com'; 
    let USER_ID = null;
    const MIN_BET = 1;
    let MAX_BET = 100000;
    const ANIMATION_DURATION = 3000;

    let state = {
        balance: 0,
        history: [],
        isFlipping: false,
        gameReady: false, // Prevents playing before initialization
    };
    
    const getUserId = () => {
        try {
            const tg = window.Telegram.WebApp;
            if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) {
                console.log("Telegram User ID found:", tg.initDataUnsafe.user.id);
                return tg.initDataUnsafe.user.id.toString();
            }
        } catch (e) {
            console.error("Could not get Telegram User ID:", e);
        }
        console.warn("Telegram WebApp data not found. Using fallback user ID.");
        return "demo_user_local_test";
    };

    // --- Countdown Logic ---
    const showCountdown = (callback) => {
        let count = 3;
        const interval = setInterval(() => {
            countdownDisplay.textContent = count;
            countdownDisplay.classList.remove('visible');
            void countdownDisplay.offsetWidth; // Trigger reflow
            countdownDisplay.classList.add('visible');

            count--;
            if (count < 0) {
                clearInterval(interval);
                countdownDisplay.classList.remove('visible');
                callback();
            }
        }, 1000);
    };

    // --- Core Game Flow ---
    const initiateBet = async (choice) => {
        if (state.isFlipping) return;

        const betAmount = parseInt(betAmountInput.value, 10);
        if (isNaN(betAmount) || betAmount < MIN_BET) {
            showToast(`Bet must be at least ₹${MIN_BET}.`, "loss");
            handleBetChange(MIN_BET);
            return;
        }
        if (betAmount > state.balance) {
            showToast("Insufficient Balance!", "loss");
            handleBetChange(state.balance);
            return;
        }

        state.isFlipping = true;
        setControls(false);
        resultText.textContent = "Get Ready...";

        try {
            // Pre-fetch result from backend BEFORE countdown/animation
            const response = await fetch(`${API_BASE_URL}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: USER_ID, bet_amount: betAmount, choice }),
            });
            const resultData = await response.json();
            if (!response.ok) throw new Error(resultData.error || 'API request failed');

            // Now that we have the result, start the countdown
            showCountdown(() => {
                playAnimationAndRevealResult(resultData, betAmount);
            });

        } catch (error) {
            console.error("API Error:", error);
            showToast(error.message, 'loss');
            state.isFlipping = false;
            setControls(true);
            resultText.innerHTML = ' ';
        }
    };

    // --- Controlled Animation and Result Reveal ---
    const playAnimationAndRevealResult = (resultData, betAmount) => {
        resultText.textContent = "Flipping...";

        // Reset animation states and trigger flip
        coinWrapper.style.animation = 'none';
        coin.style.animation = 'none';
        void coin.offsetWidth; // Trigger reflow
        coinWrapper.style.animation = `toss-arc ${ANIMATION_DURATION/1000}s cubic-bezier(0.3, 0, 0.45, 1) forwards`;
        coin.style.animation = `spin ${ANIMATION_DURATION/1000}s cubic-bezier(0.3, 0, 0.45, 1) forwards`;

        setTimeout(() => {
            const { result, winning_side, new_balance } = resultData;
            
            // Stop animation and FORCE the result side
            coin.style.animation = 'none'; 
            coin.style.transform = winning_side === 'tails' ? 'rotateY(180deg)' : 'rotateY(0deg)';

            state.balance = new_balance;

            // Show win/loss toast
            if (result === 'win') {
                const profit = (betAmount * 0.91).toFixed(2);
                showToast(`You Won ₹${profit}!`, 'win');
            } else {
                showToast(`You Lost ₹${betAmount.toFixed(2)}`, 'loss');
            }

            // Update history and UI, then re-enable controls
            updateHistory(winning_side);
            updateUI();
            state.isFlipping = false;
            setControls(true);
            resultText.textContent = `Result was ${winning_side.charAt(0).toUpperCase() + winning_side.slice(1)}`;

            setTimeout(() => {
                if (!state.isFlipping) resultText.innerHTML = ' ';
            }, 2500);

        }, ANIMATION_DURATION);
    };

    // --- UI & State Helpers ---
    const updateUI = () => {
        walletAmountSpan.textContent = `₹${state.balance.toFixed(2)}`;
        MAX_BET = Math.floor(state.balance);
        renderHistory();
        updateBetButtonsState();
    };

    const setControls = (enabled) => {
        const isGameActive = enabled && state.gameReady;
        headsButton.disabled = !isGameActive;
        tailsButton.disabled = !isGameActive;
        betAmountInput.disabled = !isGameActive;
        betMinusBtn.disabled = !isGameActive;
        betMinBtn.disabled = !isGameActive;
        betPlusBtn.disabled = !isGameActive;
        betMaxBtn.disabled = !isGameActive;
        if (isGameActive) updateBetButtonsState();
    };
    
    const handleBetChange = (amount) => {
        const maxPossibleBet = Math.floor(Math.min(state.balance, 100000));
        let newAmount = parseInt(amount, 10) || 0;
        if (state.balance > 0) {
            newAmount = Math.max(MIN_BET, newAmount);
            newAmount = Math.min(newAmount, maxPossibleBet);
        } else {
            newAmount = MIN_BET;
        }
        betAmountInput.value = newAmount;
        updateBetButtonsState();
    };

    const updateBetButtonsState = () => {
        if (!state.gameReady) return;
        const currentBet = parseInt(betAmountInput.value, 10) || 0;
        const maxPossibleBet = Math.floor(state.balance);
        betMinusBtn.disabled = currentBet <= MIN_BET;
        betMinBtn.disabled = currentBet === MIN_BET;
        betPlusBtn.disabled = currentBet >= maxPossibleBet || maxPossibleBet < MIN_BET;
        betMaxBtn.disabled = currentBet === maxPossibleBet || state.balance < MIN_BET;
    };
    
    const showToast = (message, type) => {
        toast.textContent = message;
        toast.className = `toast-notification show ${type}`;
        setTimeout(() => toast.className = toast.className.replace('show', ''), 2800);
    };

    const updateHistory = (result) => {
        state.history.unshift(result);
        if (state.history.length > 20) state.history.pop();
        renderHistory();
    };

    const renderHistory = () => {
        historyList.innerHTML = '';
        state.history.forEach(result => {
            const li = document.createElement('li');
            li.className = `history-item history-${result}`;
            li.textContent = result.charAt(0).toUpperCase();
            historyList.appendChild(li);
        });
    };

    // --- Game Initialization ---
    const initializeGame = async () => {
        if (state.gameReady) return; // Prevent re-initialization
        USER_ID = getUserId();
        if (!USER_ID) {
            showToast("Could not identify user. Please restart.", "loss");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/get-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: USER_ID })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            state.balance = data.wallet_balance;
            state.gameReady = true;
            updateUI();
            setControls(true);
        } catch (error) {
            console.error("Failed to initialize game:", error);
            walletAmountSpan.textContent = "Error";
            showToast("Could not load balance.", "loss");
            setControls(false);
        }
    };

    // --- Event Listeners & App Start ---
    const isTelegram = () => !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);

    if (isTelegram()) {
        window.Telegram.WebApp.ready();
    }
    
    initializeGame(); // Start the game automatically
    
    headsButton.addEventListener('click', () => initiateBet('heads'));
    tailsButton.addEventListener('click', () => initiateBet('tails'));
    betAmountInput.addEventListener('input', () => handleBetChange(betAmountInput.value));
    betAmountInput.addEventListener('blur', () => {
        if (betAmountInput.value === '' || parseInt(betAmountInput.value, 10) < MIN_BET) {
            handleBetChange(MIN_BET);
        }
    });
    // --- MODIFIED LINES AS PER REQUEST ---
    betMinusBtn.addEventListener('click', () => handleBetChange(parseInt(betAmountInput.value, 10) - 1));
    betPlusBtn.addEventListener('click', () => handleBetChange(parseInt(betAmountInput.value, 10) + 1));
    betMinBtn.addEventListener('click', () => handleBetChange(MIN_BET));
    betMaxBtn.addEventListener('click', () => handleBetChange(state.balance));
});