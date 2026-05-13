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
const menuNavegacao = document.getElementById("menu-navegacao");
const authContainer = document.getElementById("auth-container");
const seletorModos = document.getElementById("mode-selector"); // Ajuste o ID se necessário
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

        // Esconde o login
        if (authContainer) authContainer.style.setProperty('display', 'none', 'important');
        
        // Mostra o menu superior
        if (menuNavegacao) menuNavegacao.style.setProperty('display', 'flex', 'important');
        
        // MOSTRA O JOGO EM SEGUNDO PLANO (Sempre ativo)
        const abaJogo = document.getElementById('aba-jogo');
        if (abaJogo) abaJogo.style.setProperty('display', 'flex', 'important');

        // Garante que nenhum pop-up inicie aberto
        fecharTodosModais();

        userInfo.style.setProperty('display', 'flex', 'important');
        rankingContainer.style.setProperty('display', 'block', 'important');

        if(seletorModos) seletorModos.style.setProperty('display', 'flex', 'important');

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

        if (authContainer) authContainer.style.setProperty('display', 'flex', 'important');
        
        // Esconde o menu, o jogo e qualquer pop-up
        if (menuNavegacao) menuNavegacao.style.setProperty('display', 'none', 'important');
        const abaJogo = document.getElementById('aba-jogo');
        if (abaJogo) abaJogo.style.setProperty('display', 'none', 'important');
        fecharTodosModais();

        passwordInput.value = "";
    }
});

// =========================
// SISTEMA DE AURA
// =========================
async function adicionarAura(valor) {
    if (!currentUserDocRef || !userData) return;

    userData.aura = (userData.aura || 0) + valor;

    try {
        await updateDoc(currentUserDocRef, {
            aura: userData.aura
        });

        atualizarTelaEstatisticas();
        carregarRanking();

    } catch (e) {
        console.error("Erro ao atualizar aura:", e);
    }
}

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
    if (userAuraSpan) userAuraSpan.innerText = userData?.aura || 0;
    
    if (dailyCountSpan) {
        let jogadas = 0;

        if (currentMode === 'termo') jogadas = userData?.termoPlayed || 0;
        if (currentMode === 'dueto') jogadas = userData?.duetoPlayed || 0;
        if (currentMode === 'quarteto') jogadas = userData?.quartetoPlayed || 0;

        dailyCountSpan.innerText = jogadas;
    }
}

function atualizarPosicaoNoPerfil(nomeUsuarioLogado, listaRanking) {
    // 1. Encontra o índice do usuário na lista (ordenada por aura)
    // Somamos +1 porque o array começa no 0, mas o ranking no 1º
    const posicao = listaRanking.findIndex(u => u.nome === nomeUsuarioLogado) + 1;
    
    const rankDisplay = document.getElementById('user-rank-display');
    
    if (posicao > 0) {
        rankDisplay.innerText = `#${posicao}`;
    } else {
        rankDisplay.innerText = "S/R"; // "Sem Ranking" se não estiver no top
    }
}

window.rankAnterior = null; // Guarda a posição para comparar depois

async function carregarRanking() {
    if (!rankingList) return;

    const q = query(collection(db, "users"), orderBy("aura", "desc"));
    const querySnapshot = await getDocs(q);

    rankingList.innerHTML = "";
    let index = 0;
    let rankDoUsuario = -1; 

    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let nomeExibido = (data.displayName && data.displayName !== "null") ? data.displayName : "Anônimo";

        if (auth.currentUser && docSnap.id === auth.currentUser.uid) {
            rankDoUsuario = index + 1; 
        }

        if (index < 10) {
            let li = document.createElement("li");
            li.innerHTML = `<strong>${nomeExibido}</strong>: ${data.aura} aura`;

            if (index >= 5) {
                li.classList.add("rank-extra");
                li.style.display = "none"; 
            }
            rankingList.appendChild(li);
        }
        index++;
    });

    // ====================================================
    // LÓGICA DE DETECTAR SE SUBIU OU CAIU NO RANKING
    // ====================================================
    if (rankDoUsuario > 0) {
        // Se já tínhamos um rank salvo e ele mudou
        if (window.rankAnterior !== null && window.rankAnterior !== rankDoUsuario) {
            
            if (rankDoUsuario < window.rankAnterior) {
                // Número menor = Posição melhor (ex: foi de 5 para 3)
                mostrarNotificacaoRanking(`Subiste para o Top #${rankDoUsuario}!`, 'up');
            } 
            else if (rankDoUsuario > window.rankAnterior) {
                // Número maior = Posição pior (ex: foi de 3 para 5)
                mostrarNotificacaoRanking(`Caíste para a posição #${rankDoUsuario}.`, 'down');
            }
        }
        
        // Atualiza a memória com o rank atual para a próxima vez
        window.rankAnterior = rankDoUsuario;
    }

    // Atualiza o perfil (código que já tínhamos feito)
    const rankDisplay = document.getElementById('user-rank-display');
    if (rankDisplay) {
        rankDisplay.innerText = rankDoUsuario > 0 ? `#${rankDoUsuario}` : "S/R";
    }

    // Lógica do botão "Ver Top 10" (mantenha a que você já tem no seu arquivo)
    // ...
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


// Dicionário para traduzir o status do seu jogo para as cores do CSS
const coresTeclado = {
    'certa': 'var(--cor-certa)',        // Verde
    'lugar-errado': 'var(--cor-lugar-errado)', // Amarelo
    'errada': 'var(--cor-errada)',      // Cinza escuro
    'padrao': 'var(--cor-padrao)'       // Cinza normal
};

// Função para pintar a tecla dividida no modo DUETO
window.pintarTeclaDueto = function(letra, statusEsquerda, statusDireita) {
    // Procura o botão no seu teclado que tenha a letra específica
    // (Ajuste o seletor abaixo caso as suas teclas tenham classes/IDs diferentes)
    const teclas = document.querySelectorAll('.keyboard-button'); 
    let teclaAlvo = null;

    teclas.forEach(btn => {
        if (btn.innerText.trim().toUpperCase() === letra.toUpperCase()) {
            teclaAlvo = btn;
        }
    });

    if (teclaAlvo) {
        // Adiciona a classe que ativa o gradiente
        teclaAlvo.classList.add('tecla-dueto');
        
        // Injeta as cores da esquerda e da direita usando variáveis do CSS
        teclaAlvo.style.setProperty('--cor-esq', coresTeclado[statusEsquerda] || coresTeclado['padrao']);
        teclaAlvo.style.setProperty('--cor-dir', coresTeclado[statusDireita] || coresTeclado['padrao']);
    }
};

// 1. FUNÇÃO DE TROCAR DE MODO
// Função para pintar o botão selecionado
// Função para pintar o botão selecionado
window.atualizarBotao = function(botaoClicado) {
    // 1. Pega todos os botões de modo
    const botoes = document.querySelectorAll('.mode-btn');
    
    // 2. Remove a classe 'active' (cor) de todos eles
    botoes.forEach(btn => btn.classList.remove('active'));
    
    // 3. Adiciona a classe 'active' apenas no botão que foi clicado agora
    botaoClicado.classList.add('active');
};


window.changeMode = function (mode) {
    if (currentMode === mode) return;

    currentMode = mode;

    // Atualiza a classe do container para ajustar o CSS
    if (boardElement) boardElement.className = `mode-${mode}`;

    if (mode === 'termo') { numBoards = 1; maxAttempts = 6; }
    else if (mode === 'dueto') { numBoards = 2; maxAttempts = 7; }
    else if (mode === 'quarteto') { numBoards = 4; maxAttempts = 9; }

    atualizarTelaEstatisticas(); // Atualiza o contador de partidas na tela
    verificarEIniciarJogo();     // Verifica se esse novo modo já estourou o limite e desenha o tabuleiro
};

window.changeMode = changeMode;

// Abre um modal específico e escurece o fundo
window.abrirModal = function(idModal) {
    fecharTodosModais(); // Garante que fecha um antes de abrir o outro
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important'); 
    }
};

// Fecha todos os modais para voltar a ver apenas o jogo
window.fecharTodosModais = function() {
    const modais = document.querySelectorAll('.modal-overlay');
    modais.forEach(modal => {
        modal.style.setProperty('display', 'none', 'important');
    });
};


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
    // Limpa teclado e animações
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove("correct", "present", "absent", "tecla-dueto"); // Adicionado "tecla-dueto"
        
        // Remove a memória de cores dos lados esquerdo e direito
        key.removeAttribute("data-b0");
        key.removeAttribute("data-b1");
        key.style.removeProperty('--cor-esq');
        key.style.removeProperty('--cor-dir');
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
    if (jogadasNoModoAtual >= 2) {
        boardElement.style.setProperty('display', 'none', 'important');
        keyboardDiv.style.setProperty('display', 'none', 'important');

        // Mensagem dinâmica avisando o modo que bloqueou
        msgEl.innerText = `Você já jogou suas 2 partidas de ${currentMode.toUpperCase()} hoje! Volte amanhã ou jogue os outros modos.`;
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
            // Atualiza o Teclado
            const keyBtn = document.getElementById(`key-${letter}`);
            if (keyBtn) {
                // Se for Termo ou Quarteto, usa a lógica original por enquanto
                if (currentMode === 'termo' || currentMode === 'quarteto') {
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
                // Se for DUETO, aplica a mágica das cores divididas
                else if (currentMode === 'dueto') {
                    // Traduz o nome da classe em inglês para o nosso dicionário
                    let statusNome = 'padrao';
                    if (colorClass === 'correct') statusNome = 'certa';
                    else if (colorClass === 'present') statusNome = 'lugar-errado';
                    else if (colorClass === 'absent') statusNome = 'errada';

                    // Puxa a cor que já estava guardada para esse tabuleiro na tecla
                    let statusSalvo = keyBtn.getAttribute(`data-b${b}`) || 'padrao';
                    
                    // Só atualiza a memória se a nova cor for "melhor" que a antiga (Verde > Amarelo > Cinza)
                    if (statusNome === 'certa' || 
                       (statusNome === 'lugar-errado' && statusSalvo !== 'certa') || 
                       (statusNome === 'errada' && statusSalvo === 'padrao')) {
                        
                        keyBtn.setAttribute(`data-b${b}`, statusNome);
                    }

                    // Pega a melhor cor de cada lado (0 = Esquerda, 1 = Direita)
                    let statusEsq = keyBtn.getAttribute('data-b0') || 'padrao';
                    let statusDir = keyBtn.getAttribute('data-b1') || 'padrao';

                    // Chama a função que pinta a divisão!
                    window.pintarTeclaDueto(letter, statusEsq, statusDir);
                }
            }}

        // Verifica se ganhou ESTE tabuleiro
        if (guessStr === targetWordClean) {
            boardsCompleted[b] = true;
            deactivateRemainingRows(b, currentAttempt);
            document.getElementById(`board-${b}`).classList.add("win-anim");
        }
        
    }
    

// Verifica estado GLOBAL do jogo (se ganhou todos ou perdeu)
    let acertos = boardsCompleted.filter(acertou => acertou === true).length;

    if (acertos === numBoards) {
        gameOver = true;
        let auraGanha = 0;
        
        // Pontuação de Vitória Perfeita
        if (currentMode === 'termo') auraGanha = 10;
        else if (currentMode === 'dueto') auraGanha = 20;
        else if (currentMode === 'quarteto') auraGanha = 40;

        showMessage(`Incrível! Você venceu! +${auraGanha} Aura`, "#1e90ff");
        finalizarPartida(true, auraGanha);
        
    } else {
        currentAttempt++;
        
        if (currentAttempt >= maxAttempts) {
            gameOver = true;
            let auraGanha = 0;

            // Calcula a pontuação baseada em quantos tabuleiros acertou antes das chances acabarem
            if (currentMode === 'termo') {
                auraGanha = -7; // Acertou 0
            } 
            else if (currentMode === 'dueto') {
                if (acertos === 1) auraGanha = 3;
                else auraGanha = -14; // Acertou 0
            } 
            else if (currentMode === 'quarteto') {
                if (acertos === 3) auraGanha = 23;
                else if (acertos === 2) auraGanha = 6;
                else if (acertos === 1) auraGanha = -11;
                else auraGanha = -28; // Acertou 0
            }

            // Descobre quais palavras faltaram para mostrar ao jogador
            let faltaram = [];
            for (let b = 0; b < numBoards; b++) {
                if (!boardsCompleted[b]) {
                    faltaram.push(targetWords[b]);
                    document.getElementById(`board-${b}`).classList.add("lose-anim");
                }
            }

            // Deixa a mensagem de final de jogo com a cor certa (azul se pontuou positivo, vermelho se ficou negativo)
            let msgCor = auraGanha > 0 ? "#1e90ff" : "red";
            let sinal = auraGanha > 0 ? "+" : ""; // Adiciona o "+" visualmente se for positivo
            
            showMessage(`Fim! Faltou: ${faltaram.join(", ")}. ${sinal}${auraGanha} Aura`, msgCor);
            finalizarPartida(false, auraGanha);
            
        } else {
            // Prepara a próxima linha e reseta as letras digitadas
            currentGuess = ["", "", "", "", ""];
            setActiveColumn(0);
        }
    }
} // Fim da função checkAttempt

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
// --- FINAL DO ARQUIVO CORRIGIDO ---

// Função para apagar as linhas restantes de um tabuleiro concluído
function deactivateRemainingRows(boardIndex, attemptIndex) {
    let board = document.getElementById(`board-${boardIndex}`);
    if (!board) return;

    let rows = board.querySelectorAll('.row');
    for (let i = attemptIndex + 1; i < rows.length; i++) {
        rows[i].classList.add('disabled-row');
        let tiles = rows[i].querySelectorAll('.tile');
        tiles.forEach(tile => tile.classList.remove('selected'));
    }

    for (let row = attemptIndex + 1; row < maxAttempts; row++) {
        for (let col = 0; col < 5; col++) {
            let tile = document.getElementById(`tile-${boardIndex}-${row}-${col}`);
            if (tile) {
                tile.classList.add('disabled-tile');
                tile.classList.remove('selected');
            }
        }
    }
}

// Esta é a função que estava cortada no seu código
window.ativarModo = function(modo, botao) {
    // 1. Muda a cor do botão clicado (UI)
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    if (botao) {
        botao.classList.add('active');
    }

    // 2. Chama a lógica de trocar o modo de jogo
    window.changeMode(modo);
};

// Garante que o jogo comece limpo se o script recarregar
console.log("Script carregado com sucesso!");

window.ativarModo = function(modo, botao) {
    // 1. Muda a cor do botão clicado
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    botao.classList.add('active');

    // 2. Chama a sua função de mudar o jogo
    if (window.changeMode) window.changeMode(modo);

    // 3. Fecha o modal
    if (window.fecharTodosModais) window.fecharTodosModais();
};

window.mostrarNotificacaoRanking = function(mensagem, tipo) {
    let container = document.getElementById('toast-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    const icone = tipo === 'up' ? '📈' : '📉';
    toast.innerHTML = `<span class="toast-icon">${icone}</span> <span>${mensagem}</span>`;

    container.appendChild(toast);

    // Remove a notificação após 4 segundos (AGORA PUXANDO PARA CIMA)
    setTimeout(() => {
        toast.style.animation = 'fadeOutUpToast 0.4s forwards'; // <- MUDOU AQUI
        setTimeout(() => toast.remove(), 400); 
    }, 4000);
};

// =========================
// ATUALIZA DADOS DO FIREBASE
// =========================
async function atualizarDadosUsuario() {
    if (!currentUserDocRef) return;

    try {
        const userSnap = await getDoc(currentUserDocRef);

        if (userSnap.exists()) {
            userData = userSnap.data();
        }
    } catch (e) {
        console.error("Erro ao atualizar dados:", e);
    }
}

// =========================
// MODAIS (ABRIR / FECHAR)
// =========================
window.abrirModal = async function(id) {
    fecharTodosModais();

    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = "flex";
    }

    // 🔥 ATUALIZA PERFIL COM DADOS REAIS
    if (id === 'aba-perfil') {
        await atualizarDadosUsuario();
        atualizarTelaEstatisticas();
    }
};

window.fecharTodosModais = function() {
    const modais = document.querySelectorAll('.modal-overlay');
    modais.forEach(m => m.style.display = 'none');
};