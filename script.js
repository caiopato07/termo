import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    getFirestore, doc, setDoc, getDoc, updateDoc,
    collection, query, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA1kEPSYYtoLLJjkUSObuTlDepr7y6holQ",
    authDomain: "termo-9d8c3.firebaseapp.com",
    projectId: "termo-9d8c3",
    storageBucket: "termo-9d8c3.firebasestorage.app",
    messagingSenderId: "748478542611",
    appId: "1:748478542611:web:e8ba2708190b40efd220e6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências HTML (Login e Jogo)
const authContainer = document.getElementById("auth-container");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnCadastro = document.getElementById("btnCadastro");
const authMessage = document.getElementById("auth-message");

const userInfo = document.getElementById("user-info");
const welcomeMsg = document.getElementById("welcome-msg");
const btnLogout = document.getElementById("btnLogout");

const boardElement = document.getElementById("boards-container");
const keyboardDiv = document.getElementById("keyboard");

const rankingContainer = document.getElementById("ranking-container");
const userAuraSpan = document.getElementById("user-aura");
const dailyCountSpan = document.getElementById("daily-count");
const rankingList = document.getElementById("ranking-list");

let isUserLoggedIn = false;
let currentUserDocRef = null;
let userData = null;

// Truque do Email
const formatEmail = (user) => `${user.trim().toLowerCase()}@meutermo.com`;

// --- LÓGICA DE INTERFACE E BANCO DE DADOS ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        isUserLoggedIn = true;

        authContainer.style.setProperty('display', 'none', 'important');
        userInfo.style.setProperty('display', 'flex', 'important');
        rankingContainer.style.setProperty('display', 'block', 'important');

        // 1. O GRANDE TRUQUE: Extrai o nome de usuário direto do e-mail!
        // Pega "joao@meutermo.com" e transforma em "joao"
        const nomeCorreto = user.email.split('@')[0];

        welcomeMsg.innerText = `Olá, ${nomeCorreto}!`;

        // Busca os dados no Firestore
        currentUserDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(currentUserDocRef);
        const today = new Date().toISOString().split('T')[0];

        if (!userSnap.exists()) {
            // Primeiro acesso do usuário: cria os 3 contadores zerados
            userData = {
                displayName: nomeCorreto,
                aura: 0,
                lastPlayedDate: today,
                termoPlayed: 0,
                duetoPlayed: 0,
                quartetoPlayed: 0
            };
            await setDoc(currentUserDocRef, userData);
        } else {
            userData = userSnap.data();
            let needsUpdate = false;

            if (!userData.displayName || userData.displayName === "null" || userData.displayName === null) {
                userData.displayName = nomeCorreto;
                needsUpdate = true;
            }

            // Verifica se o dia virou e ZERA OS 3 CONTADORES
            if (userData.lastPlayedDate !== today) {
                userData.termoPlayed = 0;
                userData.duetoPlayed = 0;
                userData.quartetoPlayed = 0;
                userData.lastPlayedDate = today;
                needsUpdate = true;
            }

            // Proteção para usuários antigos que ainda não tinham essas variáveis
            if (userData.termoPlayed === undefined) { userData.termoPlayed = 0; needsUpdate = true; }
            if (userData.duetoPlayed === undefined) { userData.duetoPlayed = 0; needsUpdate = true; }
            if (userData.quartetoPlayed === undefined) { userData.quartetoPlayed = 0; needsUpdate = true; }

            if (needsUpdate) {
                await updateDoc(currentUserDocRef, {
                    displayName: userData.displayName,
                    lastPlayedDate: userData.lastPlayedDate,
                    termoPlayed: userData.termoPlayed,
                    duetoPlayed: userData.duetoPlayed,
                    quartetoPlayed: userData.quartetoPlayed
                });
            }
        }

        atualizarTelaEstatisticas();
        carregarRanking();
        verificarEIniciarJogo();

    } else {
        isUserLoggedIn = false;

        authContainer.style.setProperty('display', 'flex', 'important');
        userInfo.style.setProperty('display', 'none', 'important');
        boardElement.style.setProperty('display', 'none', 'important');
        keyboardDiv.style.setProperty('display', 'none', 'important');
        if (rankingContainer) rankingContainer.style.setProperty('display', 'none', 'important');

        passwordInput.value = "";
    }
});

btnCadastro.addEventListener("click", () => {
    const user = usernameInput.value;
    const pass = passwordInput.value;

    if (user.length < 3) {
        authMessage.style.color = "red";
        authMessage.innerText = "Usuário muito curto!";
        return;
    }

    createUserWithEmailAndPassword(auth, formatEmail(user), pass)
        .then((userCredential) => {
            return updateProfile(userCredential.user, { displayName: user });
        })
        .then(() => {
            return signOut(auth);
        })
        .then(() => {
            authMessage.style.color = "#1070ee";
            authMessage.innerText = "Conta criada com sucesso! Por favor, clique em Entrar.";
            passwordInput.value = "";
        })
        .catch((error) => {
            authMessage.style.color = "red";
            if (error.code === 'auth/email-already-in-use') {
                authMessage.innerText = "Este usuário já existe!";
            } else {
                authMessage.innerText = "Erro ao cadastrar.";
            }
        });
});

btnLogin.addEventListener("click", () => {
    signInWithEmailAndPassword(auth, formatEmail(usernameInput.value), passwordInput.value)
        .catch(() => authMessage.innerText = "Usuário ou senha incorretos.");
});

btnLogout.addEventListener("click", () => {
    signOut(auth)
    const msg = document.getElementById("message");
    msg.remove();
});

function atualizarTelaEstatisticas() {
    if (userAuraSpan) userAuraSpan.innerText = userData.aura;
    
    if (dailyCountSpan) {
        let jogadas = 0;
        if (currentMode === 'termo') jogadas = userData.termoPlayed || 0;
        if (currentMode === 'dueto') jogadas = userData.duetoPlayed || 0;
        if (currentMode === 'quarteto') jogadas = userData.quartetoPlayed || 0;
        dailyCountSpan.innerText = jogadas; // Mostra as jogadas do modo selecionado
    }
}

async function carregarRanking() {
    if (!rankingList) return;

    // Continua buscando os 10 melhores
    const q = query(collection(db, "users"), orderBy("aura", "desc"), limit(10));
    const querySnapshot = await getDocs(q);

    rankingList.innerHTML = "";
    let index = 0;

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        let li = document.createElement("li");

        let nomeExibido = (data.displayName && data.displayName !== "null") ? data.displayName : "Anônimo";

        // Cuidado: aqui você deve manter a estrutura HTML que já está usando para ficar bonito com o seu CSS.
        // Se você mudou algo no HTML do "li" para pôr as medalhas, mantenha a sua versão!
        li.innerHTML = `<strong>${nomeExibido}</strong>: ${data.aura} aura`;

        // NOVO: Se for o 6º lugar ou abaixo, esconde e adiciona a classe "rank-extra"
        if (index >= 5) {
            li.classList.add("rank-extra");
            li.style.display = "none"; // Esconde por padrão
        }

        rankingList.appendChild(li);
        index++;
    });

    // NOVO: Lógica do botão "Ver Mais"
    let btnToggle = document.getElementById("btn-toggle-ranking");

    // Se o botão ainda não existir, nós o criamos
    if (!btnToggle) {
        btnToggle = document.createElement("button");
        btnToggle.id = "btn-toggle-ranking";

        // Alguns estilos diretos no JS para ele combinar com o jogo (você pode mudar depois no CSS)
        btnToggle.style.marginTop = "15px";
        btnToggle.style.padding = "8px 15px";
        btnToggle.style.cursor = "pointer";
        btnToggle.style.borderRadius = "5px";
        btnToggle.style.border = "none";
        btnToggle.style.backgroundColor = "#1e90ff"; // Azul do Termo
        btnToggle.style.color = "white";
        btnToggle.style.fontWeight = "bold";
        btnToggle.style.width = "100%";
        btnToggle.style.transition = "0.2s";

        // Adiciona o botão logo abaixo da lista de ranking
        rankingContainer.appendChild(btnToggle);
    }

    // Só mostra o botão se tivermos mais de 5 jogadores cadastrados

    btnToggle.style.display = "block";
    btnToggle.innerText = "Ver Top 10 ▼";

    // Ação de clicar no botão
    btnToggle.onclick = () => {

        const extras = rankingList.querySelectorAll(".rank-extra");

        // Verifica se o primeiro extra está escondido
        const isHidden = extras[0].style.display === "none";

        extras.forEach(item => {
            // Se estava escondido, tira o "none" (volta ao original do CSS), se não, esconde
            item.style.display = isHidden ? "" : "none";
        });

        // Muda o texto e a setinha do botão
        btnToggle.innerText = isHidden ? "Ocultar ▲" : "Ver Top 10 ▼";
        btnToggle.style.backgroundColor = isHidden ? "#3a3a3c" : "#1e90ff"; // Fica cinza quando expande

        const top10 = document.getElementById('topranking');
        top10.innerText = isHidden ? " Top 10 Aura " : " Top 5 Aura ";


    }
}
// ==========================================
// LÓGICA DOS MODOS: TERMO, DUETO E QUARTETO
// ==========================================

// IMPORTANTE: COLOQUE A SUA LISTA const words = [...] AQUI!!!
// IMPORTANTE: COLOQUE A SUA LISTA const wordsAc = [...] AQUI!!! (Se tiver)

let currentMode = "termo"; // Pode ser "termo", "dueto" ou "quarteto"
let numBoards = 1;         // Quantidade de tabuleiros ativos
let maxAttempts = 6;       // Limite de tentativas

let targetWords = [];      // Array com as palavras do jogo atual
let boardsCompleted = [];  // Array para saber quais tabuleiros já foram acertados
let currentAttempt = 0;
let activeCol = 0;
let currentGuess = ["", "", "", "", ""]; // Guarda as 5 letras da tentativa atual
let gameOver = false;

const removeAcentos = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "");

// 1. FUNÇÃO DE TROCAR DE MODO
window.changeMode = function (mode) {
    if (currentMode === mode) return;

    currentMode = mode;

    // Atualiza os botões visuais
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.mode-btn[onclick="changeMode('${mode}')"]`).classList.add('active');

    // Atualiza a classe do container para ajustar o CSS
    if (boardElement) boardElement.className = `mode-${mode}`;

    // ... (o código antigo da função continua igual)
    if (mode === 'termo') { numBoards = 1; maxAttempts = 6; }
    else if (mode === 'dueto') { numBoards = 2; maxAttempts = 7; }
    else if (mode === 'quarteto') { numBoards = 4; maxAttempts = 9; }

    atualizarTelaEstatisticas(); // Atualiza o contador de partidas na tela
    verificarEIniciarJogo();     // Verifica se esse novo modo já estourou o limite e desenha o tabuleiro
};

    resetarTabuleiro();


// 2. CONSTRÓI OS TABULEIROS DINAMICAMENTE
function buildBoardsDOM() {
    if (!boardElement) return;

    for (let b = 0; b < 4; b++) {
        let boardDiv = document.getElementById(`board-${b}`);
        if (!boardDiv) continue;

        boardDiv.innerHTML = ""; // Limpa a grade antiga

        if (b < numBoards) {
            boardDiv.classList.remove("hidden");
            for (let r = 0; r < maxAttempts; r++) {
                let row = document.createElement("div");
                row.className = "row";
                for (let c = 0; c < 5; c++) {
                    let tile = document.createElement("div");
                    tile.id = `tile-${b}-${r}-${c}`;
                    tile.className = "tile";
                    tile.onclick = () => {
                        if (!gameOver && r === currentAttempt) setActiveColumn(c);
                    };
                    row.appendChild(tile);
                }
                boardDiv.appendChild(row);
            }
        } else {
            boardDiv.classList.add("hidden");
        }
    }
}

// 3. TECLADO
const keyboardLayout = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "⌫"],
    ["Z", "X", "C", "V", "B", "N", "M", "ENTER"],
];

keyboardLayout.forEach((row) => {
    let rowDiv = document.createElement("div");
    rowDiv.className = "key-row";
    row.forEach((key) => {
        let btn = document.createElement("button");
        btn.className = "key";
        if (key === "ENTER" || key === "⌫") btn.classList.add("large");
        btn.innerText = key;
        btn.id = `key-${key}`;
        btn.onclick = () => {
            if (key === "⌫") handleInput("Backspace");
            else if (key === "ENTER") handleInput("Enter");
            else handleInput(key);
        };
        rowDiv.appendChild(btn);
    });
    keyboardDiv.appendChild(rowDiv);
});

// 4. RESETAR TABULEIRO (Agora suporta múltiplos)
function resetarTabuleiro() {
    buildBoardsDOM();

    // Escolhe as palavras sem repetição
    targetWords = [];
    boardsCompleted = [];
    for (let i = 0; i < numBoards; i++) {
        let rndWord = words[Math.floor(Math.random() * words.length)];

        // Garante palavras diferentes se o dicionário for grande
        while (targetWords.includes(rndWord) && words.length >= numBoards) {
            rndWord = words[Math.floor(Math.random() * words.length)];
        }
        targetWords.push(rndWord);
        boardsCompleted.push(false); // Nenhum foi acertado ainda
    }

    currentAttempt = 0;
    activeCol = 0;
    currentGuess = ["", "", "", "", ""];
    gameOver = false;

    document.getElementById("message").innerText = "";

    // Limpa teclado e animações
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove("correct", "present", "absent");
    });
    for (let b = 0; b < 4; b++) {
        let boardDiv = document.getElementById(`board-${b}`);
        if (boardDiv) boardDiv.classList.remove("win-anim", "lose-anim");
    }

    setActiveColumn(0);
}

function verificarEIniciarJogo() {
    const msgEl = document.getElementById("message");

    // Descobre quantas jogadas o usuário já fez NO MODO ATUAL
    let jogadasNoModoAtual = 0;
    if (currentMode === 'termo') jogadasNoModoAtual = userData.termoPlayed || 0;
    if (currentMode === 'dueto') jogadasNoModoAtual = userData.duetoPlayed || 0;
    if (currentMode === 'quarteto') jogadasNoModoAtual = userData.quartetoPlayed || 0;

    // Verifica se ele já atingiu o limite de 5 neste modo específico
    if (jogadasNoModoAtual >= 5) {
        boardElement.style.setProperty('display', 'none', 'important');
        keyboardDiv.style.setProperty('display', 'none', 'important');

        // Mensagem dinâmica avisando o modo que bloqueou
        msgEl.innerText = `Você já jogou suas 5 partidas de ${currentMode.toUpperCase()} hoje! Volte amanhã ou jogue os outros modos.`;
        msgEl.style.color = "#da385b";
        msgEl.style.display = "block";
        msgEl.style.marginTop = "40px";
        msgEl.style.fontSize = "1.2rem";
    } else {
        boardElement.style.display = ""; 
        keyboardDiv.style.display = "";
        msgEl.style.marginTop = "0px";
        msgEl.style.display = "";
        msgEl.innerText = "";

        resetarTabuleiro();
    }
}

async function finalizarPartida(ganhou, auraAmount) {
    if (!userData) return;

    userData.aura = (userData.aura || 0) + auraAmount;

    // Aumenta o contador do modo que ele acabou de jogar
    if (currentMode === 'termo') userData.termoPlayed = (userData.termoPlayed || 0) + 1;
    if (currentMode === 'dueto') userData.duetoPlayed = (userData.duetoPlayed || 0) + 1;
    if (currentMode === 'quarteto') userData.quartetoPlayed = (userData.quartetoPlayed || 0) + 1;

    atualizarTelaEstatisticas();

    try {
        await updateDoc(currentUserDocRef, {
            aura: userData.aura,
            termoPlayed: userData.termoPlayed,
            duetoPlayed: userData.duetoPlayed,
            quartetoPlayed: userData.quartetoPlayed
        });
    } catch (e) {
        console.error("Erro ao salvar no banco, mas o jogo vai continuar:", e);
    }

    carregarRanking();

    setTimeout(() => {
        verificarEIniciarJogo();
    }, 4000);
}

// 7. CONTROLE DA COLUNA ATIVA
function setActiveColumn(col) {
    // Limpa a seleção antiga em TODOS os tabuleiros ativos
    for (let b = 0; b < numBoards; b++) {
        if (!boardsCompleted[b]) {
            for (let i = 0; i < 5; i++) {
                let tile = document.getElementById(`tile-${b}-${currentAttempt}-${i}`);
                if (tile) tile.classList.remove('selected');
            }
        }
    }

    activeCol = col;

    // Aplica a nova seleção
    for (let b = 0; b < numBoards; b++) {
        if (!boardsCompleted[b]) {
            let activeTile = document.getElementById(`tile-${b}-${currentAttempt}-${activeCol}`);
            if (activeTile) activeTile.classList.add('selected');
        }
    }
}

function showMessage(msg, color = "white") {
    const msgEl = document.getElementById("message");
    msgEl.innerText = msg;
    msgEl.style.color = color;
    if (!msg.includes("Volte amanhã") && !msg.includes("Fim!")) {
        setTimeout(() => { msgEl.innerText = ""; msgEl.style.color = "white"; }, 3000);
    }
}

// 8. DIGITAÇÃO E INPUT (Manda as letras para todos os quadros)
function handleInput(key) {
    if (gameOver) return;

    if (key === "Enter") {
        let guessStr = currentGuess.join("");
        let isWordsAcDefined = typeof wordsAc !== 'undefined';
        let isValidWord = false;

        if (isWordsAcDefined) {
            isValidWord = wordsAc.some(w => removeAcentos(w).trim().toUpperCase() === guessStr.toUpperCase());
        }
        if (!isValidWord) {
            isValidWord = words.some(w => removeAcentos(w).trim().toUpperCase() === guessStr.toUpperCase());
        }

        if (guessStr.length === 5 && isValidWord) {
            checkAttempt();
        } else {
            showMessage("Palavra inválida ou incompleta!", "red");
        }
    } else if (key === "Backspace") {
        if (currentGuess[activeCol] !== "") {
            updateGuess(activeCol, "");
        } else if (activeCol > 0) {
            setActiveColumn(activeCol - 1);
            updateGuess(activeCol, "");
        }
    } else if (/^[A-Z]$/.test(key)) {
        updateGuess(activeCol, key);

        let firstEmptyCol = -1;
        for (let i = 0; i < 5; i++) {
            if (currentGuess[i] === "") {
                firstEmptyCol = i;
                break;
            }
        }

        if (firstEmptyCol !== -1 && activeCol == 4) {
            setActiveColumn(firstEmptyCol);
        } else if (firstEmptyCol !== -1) {
            setActiveColumn(activeCol + 1);
        }
    }
}

function updateGuess(col, letter) {
    currentGuess[col] = letter;
    for (let b = 0; b < numBoards; b++) {
        if (!boardsCompleted[b]) {
            let tile = document.getElementById(`tile-${b}-${currentAttempt}-${col}`);
            if (tile) tile.innerText = letter;
        }
    }
}

// 9. VERIFICAÇÃO FINAL DA TENTATIVA (A MAGIA DOS MULTI-TABULEIROS)
function checkAttempt() {
    let guessStr = currentGuess.join("").toUpperCase(); // Garante maiúsculo
    let guessArray = [...currentGuess];

    for (let b = 0; b < numBoards; b++) {
        if (boardsCompleted[b]) continue; // Se já acertou essa palavra, pula

        let targetWordClean = removeAcentos(targetWords[b]).toUpperCase(); // Garante maiúsculo
        let targetArray = targetWordClean.split("");
        let tileColors = ["absent", "absent", "absent", "absent", "absent"];
        let targetLetterCount = {};

        for (let letter of targetArray) {
            targetLetterCount[letter] = (targetLetterCount[letter] || 0) + 1;
        }

        // Primeira passada: Corretos
        for (let i = 0; i < 5; i++) {
            if (guessArray[i] === targetArray[i]) {
                tileColors[i] = "correct";
                targetLetterCount[guessArray[i]] -= 1;
            }
        }

        // Segunda passada: Presentes
        for (let i = 0; i < 5; i++) {
            if (tileColors[i] === "correct") continue;
            if (targetLetterCount[guessArray[i]] > 0) {
                tileColors[i] = "present";
                targetLetterCount[guessArray[i]] -= 1;
            }
        }

        // Aplica as cores na tela
        for (let i = 0; i < 5; i++) {
            const letter = guessArray[i];
            const colorClass = tileColors[i];
            const tile = document.getElementById(`tile-${b}-${currentAttempt}-${i}`);

            tile.classList.remove('selected');
            tile.classList.add(colorClass);

            // Coloca o acento na letra certa, se houver
            if (colorClass === "correct" && targetWords[b][i].toUpperCase() !== letter) {
                tile.innerText = targetWords[b][i].toUpperCase();
            }

            // Atualiza o Teclado
            const keyBtn = document.getElementById(`key-${letter}`);
            if (keyBtn) {
                if (colorClass === "correct") {
                    keyBtn.classList.remove("present", "absent");
                    keyBtn.classList.add("correct");
                } else if (colorClass === "present" && !keyBtn.classList.contains("correct")) {
                    keyBtn.classList.remove("absent");
                    keyBtn.classList.add("present");
                } else if (colorClass === "absent" && !keyBtn.classList.contains("correct") && !keyBtn.classList.contains("present")) {
                    keyBtn.classList.add("absent");
                }
            }
        }

        // Verifica se ganhou ESTE tabuleiro
        if (guessStr === targetWordClean) {
            boardsCompleted[b] = true;
            deactivateRemainingRows(b, currentAttempt);
            document.getElementById(`board-${b}`).classList.add("win-anim");
        }
    }

    // Verifica estado GLOBAL do jogo (se ganhou todos ou perdeu)
    if (boardsCompleted.every(val => val === true)) {
        gameOver = true;
        // Aura extra pela dificuldade: Termo +10, Dueto +15, Quarteto +20
        let auraGanha = numBoards === 1 ? 10 : (numBoards === 2 ? 15 : 20);
        showMessage(`Incrível! Você venceu! +${auraGanha} Aura`, "#1e90ff");
        finalizarPartida(true, auraGanha);
    } else {
        currentAttempt++;
        if (currentAttempt >= maxAttempts) {
            gameOver = true;
            let faltaram = [];
            for (let b = 0; b < numBoards; b++) {
                if (!boardsCompleted[b]) {
                    faltaram.push(targetWords[b]);
                    document.getElementById(`board-${b}`).classList.add("lose-anim");
                }
            }
            showMessage(`Fim! Faltou: ${faltaram.join(", ")}. -7 Aura`, "red");
            finalizarPartida(false, -7);
        } else {
            // Prepara a próxima linha e reseta as letras digitadas
            currentGuess = ["", "", "", "", ""];
            setActiveColumn(0);
        }
    }
}

document.addEventListener("keydown", (e) => {
    if (!isUserLoggedIn) return;
    if (e.target.tagName === "INPUT") return;

    if (e.key === "ArrowLeft") {
        if (activeCol > 0) setActiveColumn(activeCol - 1);
    } else if (e.key === "ArrowRight") {
        if (activeCol < 4) setActiveColumn(activeCol + 1);
    } else if (e.key === "Enter" || e.key === "Backspace") {
        handleInput(e.key);
    } else if (/^[a-zA-Z]$/.test(e.key) && e.key.length === 1) {
        handleInput(e.key.toUpperCase());
    }
});

// Função para apagar as linhas restantes de um tabuleiro concluído
function deactivateRemainingRows(boardIndex, attemptIndex) {
    let board = document.getElementById(`board-${boardIndex}`);
    if (!board) return;

    // Pega todas as linhas e desativa as que estão abaixo do acerto
    let rows = board.querySelectorAll('.row');
    for (let i = attemptIndex + 1; i < rows.length; i++) {
        rows[i].classList.add('disabled-row');

        let tiles = rows[i].querySelectorAll('.tile');
        tiles.forEach(tile => tile.classList.remove('selected'));
    }
}
// Começa da linha seguinte (attemptIndex + 1) até o final do tabuleiro
for (let row = attemptIndex + 1; row < maxAttempts; row++) {
    for (let col = 0; col < 5; col++) {
        let tile = document.getElementById(`tile-${boardIndex}-${row}-${col}`);
        if (tile) {
            // Adiciona a classe que criamos no CSS
            tile.classList.add('disabled-tile');
            // Garante que o cursor 'selected' seja removido se estiver lá
            tile.classList.remove('selected');
        }
    }
}
