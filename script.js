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

const boardElement = document.getElementById("board");
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
            // Primeiro acesso do usuário
            userData = { displayName: nomeCorreto, aura: 0, lastPlayedDate: today, wordsPlayedToday: 0 };
            await setDoc(currentUserDocRef, userData);
        } else {
            userData = userSnap.data();
            let needsUpdate = false;

            // 2. CONSERTO AUTOMÁTICO DO BANCO DE DADOS
            // Se estiver null ou vazio, ele troca pro nome correto que extraímos do e-mail
            if (!userData.displayName || userData.displayName === "null" || userData.displayName === null) {
                userData.displayName = nomeCorreto;
                needsUpdate = true; // Avisa o sistema que precisa salvar a correção no banco
            }

            // Verifica as tentativas do dia
            if (userData.lastPlayedDate !== today) {
                userData.wordsPlayedToday = 0;
                userData.lastPlayedDate = today;
                needsUpdate = true;
            }

            // Se o nome estava null ou o dia virou, ele atualiza o Firebase silenciosamente
            if (needsUpdate) {
                await updateDoc(currentUserDocRef, {
                    displayName: userData.displayName, // Salva o nome sem o null!
                    wordsPlayedToday: userData.wordsPlayedToday,
                    lastPlayedDate: userData.lastPlayedDate
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
            authMessage.style.color = "#538d4e";
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
    if (dailyCountSpan) dailyCountSpan.innerText = userData.wordsPlayedToday;
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
        btnToggle.style.backgroundColor = "#538d4e"; // Verde do Termo
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
        btnToggle.style.backgroundColor = isHidden ? "#3a3a3c" : "#538d4e"; // Fica cinza quando expande

        const top10 = document.getElementById('topranking');
        top10.innerText = isHidden ? " Top 10 Aura " : " Top 5 Aura ";


    }
}

// ==========================================
// LÓGICA DO JOGO TERMO
// ==========================================

// IMPORTANTE: COLOQUE A SUA LISTA const words = [...] AQUI!!!
// const words = ["SAGAZ", "ÂMAGO", "TERMO", ...];

let targetWord = "";
let targetWordNormalized = "";
let currentAttempt = 0;
let activeCol = 0;
let board = Array.from({ length: 6 }, () => Array(5).fill(""));
let gameOver = false;

const removeAcentos = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "");

for (let r = 0; r < 6; r++) {
    let row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < 5; c++) {
        let tile = document.createElement("div");
        tile.id = `tile-${r}-${c}`;
        tile.className = "tile";
        tile.onclick = () => {
            if (!gameOver && r === currentAttempt) setActiveColumn(c);
        };
        row.appendChild(tile);
    }
    boardElement.appendChild(row);
}

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

function resetarTabuleiro() {
    targetWord = words[Math.floor(Math.random() * words.length)];
    targetWordNormalized = removeAcentos(targetWord);
    currentAttempt = 0;
    activeCol = 0;
    board = Array.from({ length: 6 }, () => Array(5).fill(""));
    gameOver = false;

    document.getElementById("message").innerText = "";
    document.querySelectorAll('.tile').forEach(tile => {
        tile.innerText = "";
        tile.className = "tile";
    });
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove("correct", "present", "absent");
    });

    // Limpa as animações para a próxima rodada
    document.getElementById("board").classList.remove("win-anim", "lose-anim");

    setActiveColumn(0);
}
function verificarEIniciarJogo() {
    const msgEl = document.getElementById("message");

    if (userData.wordsPlayedToday >= 5) {
        boardElement.style.setProperty('display', 'none', 'important');
        keyboardDiv.style.setProperty('display', 'none', 'important');

        msgEl.innerText = "Você já jogou suas 5 palavras hoje! Volte amanhã.";
        msgEl.style.color = "#da385b";

        // =========================================
        // MÁGICA AQUI: Força o espaçamento pelo JS!
        // =========================================
        msgEl.style.display = "block"; // Transforma em bloco para aceitar margem
        msgEl.style.marginTop = "40px"; // Empurra a mensagem pra longe do ranking
        msgEl.style.fontSize = "1.2rem"; // Opcional: deixa a letra um pouco maior

    } else {
        boardElement.style.setProperty('display', 'grid', 'important');
        keyboardDiv.style.setProperty('display', 'flex', 'important');

        // Limpa as margens caso seja um novo dia e ele vá jogar
        msgEl.style.marginTop = "0px";
        msgEl.style.display = "";

        resetarTabuleiro();
    }
}

async function finalizarPartida(ganhou) {
    if (!userData) return;

    userData.aura += ganhou ? 10 : -7;
    userData.wordsPlayedToday += 1;

    atualizarTelaEstatisticas();

    await updateDoc(currentUserDocRef, {
        aura: userData.aura,
        wordsPlayedToday: userData.wordsPlayedToday
    });

    carregarRanking();

    setTimeout(() => {
        verificarEIniciarJogo();
    }, 3000);
}

function setActiveColumn(col) {
    for (let i = 0; i < 5; i++) {
        let tile = document.getElementById(`tile-${currentAttempt}-${i}`);
        if (tile) tile.classList.remove('selected');
    }
    activeCol = col;
    let activeTile = document.getElementById(`tile-${currentAttempt}-${activeCol}`);
    if (activeTile) activeTile.classList.add('selected');
}

function updateTile(row, col, letter) {
    document.getElementById(`tile-${row}-${col}`).innerText = letter;
}

function showMessage(msg, color = "white") {
    const msgEl = document.getElementById("message");
    msgEl.innerText = msg;
    msgEl.style.color = color;
    if (msg !== "Você já jogou suas 5 palavras hoje! Volte amanhã.") {
        setTimeout(() => { msgEl.innerText = ""; msgEl.style.color = "white"; }, 3000);
    }
}

function handleInput(key) {
    if (gameOver) return;

    if (key === "Enter") {
        let guess = board[currentAttempt].join("");

        let isValidWord = wordsAc.some(w => removeAcentos(w).trim().toUpperCase() === guess.toUpperCase()) || words.some(w => removeAcentos(w).trim().toUpperCase() === guess.toUpperCase());

        if (guess.length === 5 && isValidWord) {
            checkAttempt();
        } else {
            showMessage("Palavra inválida ou incompleta!", "red");
        }
    } else if (key === "Backspace") {
        if (board[currentAttempt][activeCol] !== "") {
            board[currentAttempt][activeCol] = "";
            updateTile(currentAttempt, activeCol, "");
        } else if (activeCol > 0) {
            setActiveColumn(activeCol - 1);
            board[currentAttempt][activeCol] = "";
            updateTile(currentAttempt, activeCol, "");
        }
    } else if (/^[A-Z]$/.test(key)) {
        // Coloca a letra no quadrado atual
        board[currentAttempt][activeCol] = key;
        updateTile(currentAttempt, activeCol, key);

        // NOVA LÓGICA: Varre a linha inteira (do 0 ao 4) procurando o primeiro buraco
        let firstEmptyCol = -1;
        for (let i = 0; i < 5; i++) {
            if (board[currentAttempt][i] === "") {
                firstEmptyCol = i;
                break; // Achou o primeiro vazio? Para de procurar!
            }
        }

        // Se achou algum quadrado vazio na linha, move o cursor para ele
        if (firstEmptyCol !== -1 && activeCol == 4) {
            setActiveColumn(firstEmptyCol);
        }
        else if (firstEmptyCol !== -1) {
            setActiveColumn(activeCol + 1)
        }
        // Se firstEmptyCol continuar sendo -1, significa que a linha está cheia!
        // O cursor simplesmente fica onde está, esperando você apertar Backspace ou Enter.
    }
}

document.addEventListener("keydown", (e) => {
    if (!isUserLoggedIn) return;
    if (e.target.tagName === "INPUT") return; // Evita bugar quando o usuário está digitando o login

    // Movimentação pelas setinhas do teclado
    if (e.key === "ArrowLeft") {
        if (activeCol > 0) {
            setActiveColumn(activeCol - 1);
        }
    } else if (e.key === "ArrowRight") {
        if (activeCol < 4) {
            setActiveColumn(activeCol + 1);
        }
    }
    // Lógica normal de apagar e confirmar
    else if (e.key === "Enter" || e.key === "Backspace") {
        handleInput(e.key);
    }
    // Lógica normal de digitar letras
    else if (/^[a-zA-Z]$/.test(e.key) && e.key.length === 1) {
        handleInput(e.key.toUpperCase());
    }
});

function checkAttempt() {
    let guess = board[currentAttempt].join("");
    let targetArray = targetWordNormalized.split("");
    let guessArray = guess.split("");

    let tileColors = ["absent", "absent", "absent", "absent", "absent"];
    let targetLetterCount = {};

    for (let letter of targetArray) {
        targetLetterCount[letter] = (targetLetterCount[letter] || 0) + 1;
    }

    for (let i = 0; i < 5; i++) {
        if (guessArray[i] === targetArray[i]) {
            tileColors[i] = "correct";
            targetLetterCount[guessArray[i]] -= 1;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (tileColors[i] === "correct") continue;
        if (targetLetterCount[guessArray[i]] > 0) {
            tileColors[i] = "present";
            targetLetterCount[guessArray[i]] -= 1;
        }
    }

    for (let i = 0; i < 5; i++) {
        const letter = guessArray[i];
        const colorClass = tileColors[i];
        const tile = document.getElementById(`tile-${currentAttempt}-${i}`);

        tile.classList.remove('selected');
        tile.classList.add(colorClass);

        if (colorClass === "correct" && targetWord[i] !== letter) {
            updateTile(currentAttempt, i, targetWord[i]);
        }

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

    if (guess === targetWordNormalized) {
        gameOver = true;
        showMessage("Acertou! +10 Aura 🟢", "#538d4e");
        finalizarPartida(true);
        document.getElementById("board").classList.add("win-anim");
    } else {
        currentAttempt++;
        if (currentAttempt === 6) {
            gameOver = true;
            showMessage(`Fim! A palavra era ${targetWord}. -7 Aura 🔴`, "red");
            finalizarPartida(false);
            document.getElementById("board").classList.add("lose-anim");
        } else {
            setActiveColumn(0);
        }
    }
}       
