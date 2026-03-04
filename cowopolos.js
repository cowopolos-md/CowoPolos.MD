// ==UserScript==
// @name         Cheat Wayground
// @version      2.0.1
// @description  Auto Answer Wayground dengan AI Grok
// @author       CowoPolos.MD
// @match        https://wayground.com/join/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const GROQ_API_KEYS = window.MY_GROQ_KEYS || ["ISI_API_KEY_GROQ"];
    let currentApiKeyIndex = 0;

    function showCustomAlert(msg, isError = true) {
        const alertBox = document.createElement('div');
        Object.assign(alertBox.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '100000', padding: '20px', width: '280px',
            background: 'linear-gradient(145deg, #050a18 0%, #00122e 100%)',
            border: `2px solid ${isError ? '#ff4d4d' : '#00f2fe'}`, borderRadius: '15px',
            boxShadow: `0 0 30px ${isError ? 'rgba(255, 77, 77, 0.5)' : 'rgba(0, 242, 254, 0.5)'}`,
            textAlign: 'center', color: '#fff', fontFamily: 'sans-serif',
            animation: 'alertPop 0.3s ease-out'
        });

        const title = document.createElement('div');
        title.innerText = isError ? "SYSTEM ERROR" : "NOTIFICATION";
        Object.assign(title.style, { color: isError ? '#ff4d4d' : '#00f2fe', fontWeight: 'bold', marginBottom: '10px', fontSize: '14px', letterSpacing: '2px' });

        const content = document.createElement('div');
        content.innerText = msg;
        Object.assign(content.style, { fontSize: '12px', marginBottom: '15px', lineHeight: '1.4', opacity: '0.9' });

        const btn = document.createElement('button');
        btn.innerText = "OK BOSS";
        Object.assign(btn.style, {
            padding: '8px 20px', background: isError ? '#ff4d4d' : '#00f2fe', border: 'none', borderRadius: '5px',
            color: '#000', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s'
        });
        btn.onclick = () => alertBox.remove();

        alertBox.appendChild(title);
        alertBox.appendChild(content);
        alertBox.appendChild(btn);
        document.body.appendChild(alertBox);

        const style = document.createElement('style');
        style.innerHTML = `@keyframes alertPop { from { transform: translate(-50%, -60%); opacity: 0; } to { transform: translate(-50%, -50%); opacity: 1; } }`;
        document.head.appendChild(style);
        
        setTimeout(() => alertBox.remove(), 4000);
    }

    async function extrairDadosDaQuestao() {
        try {
            const questionTextElement = document.querySelector('#questionText .question-text-color');
            const questionText = questionTextElement ? questionTextElement.innerText.trim() : "No Text";
            const optionElements = document.querySelectorAll('.option.is-selectable');
            if (optionElements.length > 0) {
                const isMultipleChoice = Array.from(optionElements).some(el => el.classList.contains('is-msq'));
                const options = Array.from(optionElements).map(el => ({ 
                    text: el.querySelector('annotation[encoding="application/x-tex"]')?.textContent.trim() || el.querySelector('#optionText')?.innerText.trim() || '', 
                    element: el 
                }));
                return { questionText, questionType: isMultipleChoice ? 'multiple_choice' : 'single_choice', options };
            }
            const openEnded = document.querySelector('textarea[data-cy="open-ended-textarea"]');
            if (openEnded) return { questionText, questionType: 'open_ended', answerElement: openEnded };
            return null;
        } catch (e) { 
            showCustomAlert("GAGAL SAAT MENGEKSTRAK SOAL !");
            return null; 
        }
    }

    async function obterRespostaDaIA(quizData) {
        const currentKey = GROQ_API_KEYS[currentApiKeyIndex];
        const API_URL = "https://api.groq.com/openai/v1/chat/completions";
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentKey}` },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "Jawab HANYA dengan teks jawaban yang benar." },
                        { role: "user", content: `Q: "${quizData.questionText}"\nOptions:\n` + quizData.options.map(opt => `- ${opt.text}`).join('\n') }
                    ],
                    temperature: 0.1
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.error && data.error.code === "rate_limit_exceeded") {
                    showCustomAlert("LIMIT ABIS! GANTI KUNCI...\n\n SEGERA HUBUNGI :\n CowoPolos.MD", false);
                    currentApiKeyIndex = (currentApiKeyIndex + 1) % GROQ_API_KEYS.length;
                    return obterRespostaDaIA(quizData);
                }
                showCustomAlert("GROQ NGADAT: " + (data.error?.message || "\nError Unknown -\n\n Screenshot Errornya Lalu kirim ke Atmin !\n CowoPolos.MD"));
                return null;
            }

            return data.choices[0].message.content.trim();
        } catch (error) { 
            showCustomAlert("KONEKSI MATI, TUAN!");
            return null; 
        }
    }

    async function performAction(aiAnswerText, quizData) {
        if (!aiAnswerText) return;
        const normalize = (str) => str.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (quizData.options) {
            const aiAnswers = aiAnswerText.split('\n').map(normalize);
            quizData.options.forEach(opt => {
                if (aiAnswers.includes(normalize(opt.text))) {
                    opt.element.style.border = '3px solid #00f2fe';
                    opt.element.style.boxShadow = '0 0 10px #00f2fe';
                    opt.element.click();
                }
            });
        }
    }

    async function resolverQuestao() {
        const button = document.getElementById('ai-solver-button');
        button.innerText = "WAIT...";
        try {
            const quizData = await extrairDadosDaQuestao();
            if (quizData) {
                const aiAnswer = await obterRespostaDaIA(quizData);
                if (!aiAnswer) {
                    showCustomAlert("AI GAK JAWAB!");
                } else {
                    await performAction(aiAnswer, quizData);
                }
            } else {
                showCustomAlert("DATA SOAL GAK KETEMU!\n Coba Lagi Kawan !");
            }
        } finally {
            button.innerText = "JAWAB";
        }
    }

    function criarFloatingPanel() {
        if (document.getElementById('Cowopolos-floating-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'Cowopolos-floating-panel';
        Object.assign(panel.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '99999',
            width: '150px', padding: '15px 10px 8px 10px', 
            background: 'linear-gradient(145deg, #050a18 0%, #00122e 100%)',
            border: '1.5px solid #00f2fe', borderRadius: '12px',
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.3)',
            fontFamily: 'sans-serif', textAlign: 'center'
        });

        const btnClose = document.createElement('div');
        btnClose.innerText = 'Ã—';
        Object.assign(btnClose.style, {
            position: 'absolute', top: '2px', right: '8px',
            color: '#ff4d4d', fontSize: '18px', fontWeight: 'bold',
            cursor: 'pointer'
        });
        btnClose.onclick = () => panel.remove();
        panel.appendChild(btnClose);

        const header = document.createElement('div');
        header.innerText = "WAYGROUND AI";
        Object.assign(header.style, {
            fontSize: '8px', color: '#00f2fe', letterSpacing: '2px',
            marginBottom: '8px', fontWeight: 'bold', opacity: '0.7'
        });
        panel.appendChild(header);

        const button = document.createElement('button');
        button.id = 'ai-solver-button';
        button.innerText = 'JAWAB';
        Object.assign(button.style, {
            width: '100%', padding: '8px', background: 'linear-gradient(90deg, #4facfe, #00f2fe)',
            color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '12px', marginBottom: '10px'
        });
        button.onclick = resolverQuestao;
        panel.appendChild(button);

        const footer = document.createElement('div');
        footer.innerText = 'â€” CowoPolos.MD â€”';
        Object.assign(footer.style, {
            fontSize: '8px', color: '#4facfe', fontWeight: 'bold',
            opacity: '0.5', letterSpacing: '1px', borderTop: '0.5px solid rgba(0, 242, 254, 0.2)',
            paddingTop: '5px'
        });
        panel.appendChild(footer);

        document.body.appendChild(panel);
    }

    setTimeout(criarFloatingPanel, 1000);
})();