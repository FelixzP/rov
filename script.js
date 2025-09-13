let heroes = [];
let socket;
fetch('https://peeranat.ddns.net/api/heroes')
    .then(response => response.json())
    .then(data => {
        heroes = data;
        console.log('Heroes loaded:', heroes);
    })
    .catch(err => console.error('Error loading heroes:', err));

 fetch('https://peeranat.ddns.net/api/getTeamNames')
     .then(res => res.json())
     .then(data => {
         updateTeamNameUI('blue', data.blue);
        updateTeamNameUI('red', data.red);
    });
function connectSocket() {
    socket = io('https://peeranat.ddns.net', {
        reconnection: true,
        reconnectionAttempts: 10, // ลองเชื่อมใหม่สูงสุด 10 ครั้ง
        reconnectionDelay: 2000,  // ลองใหม่ทุก 2 วินาที
        transports: ['websocket', 'polling'],
        secure: true,
    });

    socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
        console.warn('⚠️ Socket disconnected.');
    });

    socket.on('connect_error', (err) => {
        console.error('❌ Socket connection error:', err.message);
    });

    socket.on('reconnect_attempt', attempt => {
        console.log(`🔁 Reconnect attempt #${attempt}`);
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ Reconnect failed. You may need to refresh manually.');
    });

    socket.on('nicknameInit', (nicknames) => {
        nicknames.forEach(({ position_id, nickname }) => {
            const input = document.getElementById(`input${position_id}`);
            const output = document.getElementById(`output${position_id}`);
            if (input) input.value = nickname;
            if (output) output.textContent = nickname;
        });
    });
    socket.on('teamNameUpdated', ({ side, name }) => {
  if (side === 'blue') {
    document.querySelector('#teamNameDisplay1').textContent = name;
  } else {
    document.querySelector('#teamNameDisplay2').textContent = name;
  }
});

}
connectSocket();
let timer = null;
let interval;
let tournamentId = null;
let phaseReceived = false;

window.addEventListener('DOMContentLoaded', () => {
    loadTournament();
    socket.on('initData', (data) => {
        console.log('✅ initData:', data);
        // แสดงชื่อทีม ถ้ามี
        if (data.team1) {
            document.getElementById('teamNameDisplay1').innerText = data.team1;
            document.getElementById('team1').value = data.team1; // input ชื่อทีมซ้าย
        }
        if (data.team2) {
            document.getElementById('teamNameDisplay2').innerText = data.team2;
            document.getElementById('team2').value = data.team2; // input ชื่อทีมขวา
        }

        // Phase
        document.getElementById('phase').innerText = data.phase?.type || 'Unknown';

        // Direction arrow
        const arrowImg = document.getElementById('arrow');
        if (arrowImg && data.phase?.direction) {
            arrowImg.src = data.phase.direction + '?t=' + Date.now(); // บังคับ refresh
        } else {
            console.warn('⚠️ No direction or <img id="arrow"> not found');
        }

        // Timer
        document.getElementById('timer').innerText = data.timer;

        // Load hero list
        displayHeroes(data.heroes);

        // Load picks & scores
        socket.emit('getSelectedHeroes');
        socket.emit('scoreUpdated');
    });


});


// ✅ fallback ถ้า initData ไม่มาใน 2 วิ
setTimeout(() => {
    if (!phaseReceived) {
        console.warn('🟡 initData not received in time. Requesting manually...');
        socket.emit('requestInit');
    }
}, 2000);

// รับอัพเดต timer และ phase จาก server
socket.on('timerUpdate', ({ timer, currentPhaseIndex }) => {
    document.getElementById('timer').textContent = timer;
});


socket.on('phaseUpdate', ({ phase, timer: serverTimer, currentPhaseIndex: serverPhaseIndex }) => {
    currentPhaseIndex = serverPhaseIndex; // อัปเดต index ให้ client
    timer = serverTimer;

    updateUI();
});

socket.on('nicknameUpdated', ({ positionId, nickname }) => {
    const input = document.getElementById(`input${positionId}`);
    const output = document.getElementById(`output${positionId}`);
    if (input) input.value = nickname;
    if (output) output.textContent = nickname;
});


function updateOutput() {
    for (let i = 1; i <= 10; i++) {
        const input = document.getElementById('input' + i);
        const output = document.getElementById('output' + i);
        const nickname = input.value;

        if (output) output.textContent = ` ${nickname}`;

        // เช็กว่า socket พร้อมไหม
        if (socket && socket.connected) {
            console.log('📤 Sending nickname:', { positionId: i, nickname });

            socket.emit('updateNickname', {
                positionId: i,
                nickname
            });
        } else {
            console.warn('⚠️ Socket not connected when trying to send nickname');
        }
    }
}

function swapTeamsAndNicknames() {
    // --- สลับชื่อทีม ---
    const teamInput1 = document.getElementById('team1');
    const teamInput2 = document.getElementById('team2');

    const tempTeamName = teamInput1.value;
    teamInput1.value = teamInput2.value;
    teamInput2.value = tempTeamName;

    const team1Name = teamInput1.value;
    const team2Name = teamInput2.value;
    // อัปเดตแสดงผลชื่อทีม
    document.getElementById('teamNameDisplay1').textContent = team1Name;
    document.getElementById('teamNameDisplay2').textContent = team2Name;

    // ส่งข้อมูลชื่อทีมไป server ผ่าน socket
    socket.emit('updateTeamName', { teamNumber: 1, teamName: team1Name });
    socket.emit('updateTeamName', { teamNumber: 2, teamName: team2Name });

    sendTeamName('blue', team1Name); // team1 = ฝั่ง blue
    sendTeamName('red', team2Name);  // team2 = ฝั่ง red

    // --- สลับชื่อนักกีฬา ---
    for (let i = 1; i <= 5; i++) {
        const inputA = document.getElementById('input' + i);
        const inputB = document.getElementById('input' + (i + 5));
        const outputA = document.getElementById('output' + i);
        const outputB = document.getElementById('output' + (i + 5));

        // สลับค่าใน input
        const tempNickname = inputA.value;
        inputA.value = inputB.value;
        inputB.value = tempNickname;

        // อัปเดตแสดงผล output
        outputA.textContent = inputA.value ? ` ${inputA.value}` : ' ';
        outputB.textContent = inputB.value ? ` ${inputB.value}` : ' ';

        // ส่งอัปเดต nickname แต่ละตำแหน่งไป server
        socket.emit('updateNickname', { positionId: i, nickname: inputA.value });
        socket.emit('updateNickname', { positionId: i + 5, nickname: inputB.value });
    }
    resetAllDropdowns();
}

// เพิ่ม event listener ให้ปุ่มสลับ
document.getElementById('swapButton').addEventListener('click', swapTeamsAndNicknames);



socket.on('updateSelectedHeroes', ({ updatedHeroes }) => {
    console.log('updateSelectedHeroes received:', updatedHeroes);
    updatedHeroes.forEach(({ positionId, heroId }) => {
        const hero = heroes.find(h => h.id === heroId);
        if (hero) {
            updateHeroImage(hero, positionId);
            document.getElementById(`search-${positionId}`).value = hero.name;
        } else {
            console.warn(`Hero id ${heroId} not found in local heroes list`);
        }
    });
});


// สั่ง start timer
document.getElementById('start').addEventListener('click', () => {
    console.log('Start button clicked');
    socket.emit('startTimer');
});


// ปุ่ม Stop
document.getElementById('stop').addEventListener('click', () => {
    socket.emit('stopTimer');  // ส่ง event ไปที่ server ให้หยุด timer
});

// รับ event อัพเดต timer จาก server เพื่อแสดงผล
socket.on('timerUpdate', ({ timer }) => {
    document.getElementById('timer').innerText = timer;
});


// เมื่อ reset ให้เคลียร์ทุกภาพ
socket.on('resetSelectedHeroes', () => {
    validIds.forEach(i => {
        const imageDisplay = document.getElementById(`image-display-${i}`);
        if (imageDisplay) {
            if (imageDisplay.innerHTML) {
                const img = imageDisplay.querySelector('img');
                if (img) img.classList.add('fly-out');
            }

            setTimeout(() => {
                const searchInput = document.getElementById(`search-${i}`);
                const dropdownItems = document.getElementById(`dropdown-items-${i}`);
                if (searchInput) searchInput.value = '';
                imageDisplay.innerHTML = '';
                if (dropdownItems) dropdownItems.innerHTML = '';
            }, 500);
        }
    });
});

socket.on('heroSelected', (data) => {
    updateHeroImage(data.hero, data.positionId);
});

socket.on('initSelectedHeroes', (heroes) => {
    heroes.forEach(data => {
        updateHeroImage(data, data.position_id); // แสดงภาพในตำแหน่ง

        // ✅ อัปเดตชื่อในช่อง input ให้ตรงกับ hero ที่เลือก
        document.getElementById(`search-${data.position_id}`).value = data.name;
    });
});

// function updateTimer() {
//     if (timer > 0) {
//         document.getElementById('timer').innerText = timer;
//         timer--;
//     } else {
//         clearInterval(interval);
//     }
// }
function submitScore() {
    let blueScore = parseInt(document.getElementById('blueScoreInput').value);
    let redScore = parseInt(document.getElementById('redScoreInput').value);

    // ถ้า parseInt แล้วเป็น NaN ให้แทนด้วย 0
    blueScore = isNaN(blueScore) ? 0 : blueScore;
    redScore = isNaN(redScore) ? 0 : redScore;

    fetch('https://peeranat.ddns.net/api/update-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueScore, redScore })
    }).then(() => {
        console.log('Score submitted. Waiting for socket update...');
        // ไม่ต้อง loadTournament() เพราะ server จะ emit scoreUpdate ให้อยู่แล้ว
    });
}


// ฟังก์ชัน debounce ให้หน่วงเวลา
// debounce ฟังก์ชันส่งชื่อทีมไป server
function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

// ส่งชื่อทีมไป server
function sendTeamName(side, name) {
    fetch('https://peeranat.ddns.net/api/updateTeamName', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, name })
    })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                console.error('Update failed:', data.message);
            }
        })
        .catch(err => {
            console.error('Fetch error:', err);
        });
}

// debounce wrapper
const debouncedSendBlue = debounce(() => {
    const name = document.getElementById('team1').value;
    sendTeamName('blue', name);
}, 500);

const debouncedSendRed = debounce(() => {
    const name = document.getElementById('team2').value;
    sendTeamName('red', name);
}, 500);

document.getElementById('team1').addEventListener('input', debouncedSendBlue);
document.getElementById('team2').addEventListener('input', debouncedSendRed);

function updateTeamName() {
    const team1Name = document.getElementById('team1').value;
    const team2Name = document.getElementById('team2').value;

    // อัปเดตแสดงผลทันที
    document.getElementById('teamNameDisplay1').textContent = team1Name;
    document.getElementById('teamNameDisplay2').textContent = team2Name;

    // ส่งไปยัง server
    socket.emit('updateTeamName', { teamNumber: 1, teamName: team1Name });
    socket.emit('updateTeamName', { teamNumber: 2, teamName: team2Name });
}


function loadTournament() {
    fetch('https://peeranat.ddns.net/api/get-tournament')
        .then(response => response.json())
        .then(data => {
            document.getElementById('tournamentnamemid').value = data.name;
            document.getElementById('tournamentLogo').innerText = data.name;
            document.getElementById('blueTeam').innerText = `${data.blue_score ?? 0}`;
            document.getElementById('redTeam').innerText = `${data.red_score ?? 0}`;
            document.getElementById('blueScoreInput').value = data.blue_score;
            document.getElementById('redScoreInput').value = data.red_score;
        });
}


function updateTournamentName() {
    const tournamentName = document.getElementById('tournamentnamemid').value;

    fetch('https://peeranat.ddns.net/api/update-tournament-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentName })
    });
}



socket.on('tournamentNameUpdated', ({ tournamentName }) => {
    document.getElementById('tournamentLogo').innerText = tournamentName;
    document.getElementById('tournamentnamemid').value = tournamentName; // อัปเดตใน input ด้วย
});

socket.on('scoreUpdate', ({ blueScore, redScore }) => {
    document.getElementById('blueTeam').innerText = `${blueScore}`;
    document.getElementById('redTeam').innerText = `${redScore}`;

    // อัปเดต input ด้วย
    document.getElementById('blueScoreInput').value = blueScore;
    document.getElementById('redScoreInput').value = redScore;
});


function nextPhase() {
    socket.emit('nextPhase');
}

function displayHeroes(heroes) {
    const heroList = document.getElementById('heroList');
    heroList.innerHTML = '';

    heroes.forEach(hero => {
        const img = document.createElement('img');
        img.src = hero.img; // ✅ ต้องใช้ hero.img
        img.alt = hero.name;
        img.width = 100;

        img.onclick = () => {
            const positionId = prompt("Enter position ID (1-10):"); // หรือกำหนด position ตาม UI ของคุณ
            if (positionId) {
                socket.emit('selectHero', { heroId: hero.id, positionId: parseInt(positionId) });
                img.style.opacity = 0.5;
            }
        };

        heroList.appendChild(img);
    });
}






// หลังจากดปุ่มชื่อจะโชว์ตามลิสต์
function filterDropdown(id) {
    const searchInput = document.getElementById(`search-${id}`).value.toLowerCase();
    const dropdownItems = document.getElementById(`dropdown-items-${id}`);
    dropdownItems.innerHTML = ''; // ล้างรายการแบบดรอปดาวน์ก่อนแสดง
    // กรองฮีโร่ด้วยการค้นหา
    heroes
        .filter(hero => hero.name.toLowerCase().includes(searchInput))
        .forEach(hero => {
            const item = document.createElement('div');
            item.classList.add('dropdown-item');
            item.textContent = hero.name;
            item.onclick = () => selectHero(hero, id);
            dropdownItems.appendChild(item);
        });
}

// ทำการเปลื่ยนรูปที่ฟังก์ชั่นนี้
function selectHero(hero, id) {
    // ส่ง heroId และ positionId ไป server
    socket.emit('selectHero', { heroId: hero.id, positionId: id });

    const imageDisplay = document.getElementById(`image-display-${id}`);
    const existingImage = imageDisplay.querySelector('img');

    if (existingImage) {
        existingImage.classList.add('fly-out');
        setTimeout(() => {
            updateHeroImage(hero, id);
        }, 500);
    } else {
        updateHeroImage(hero, id);
    }
}


// ฟังก์ชั่นอัปเดตภาพฮีโร่พร้อมแอนิเมชั่นการบินเข้า
function updateHeroImage(hero, id) {
    const imageDisplay = document.getElementById(`image-display-${id}`);
    imageDisplay.innerHTML = `<img src="${hero.img}" alt="${hero.name}" class="fly-in">`;
    document.getElementById(`search-${id}`).value = hero.name;
    document.getElementById(`dropdown-items-${id}`).innerHTML = ''; // 
}

// รีเซ็ตดรอปดาวน์และอินพุตทั้งหมดด้วยแอนิเมชั่นแบบเลื่อนออก
const validIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19];  // รวม id ที่มีจริงใน DOM

function resetAllDropdowns() {
    validIds.forEach(i => {
        const imageDisplay = document.getElementById(`image-display-${i}`);
        if (imageDisplay) {
            if (imageDisplay.innerHTML) {
                const img = imageDisplay.querySelector('img');
                if (img) img.classList.add('fly-out');
            }

            setTimeout(() => {
                const searchInput = document.getElementById(`search-${i}`);
                const dropdownItems = document.getElementById(`dropdown-items-${i}`);
                if (searchInput) searchInput.value = '';
                imageDisplay.innerHTML = '';
                if (dropdownItems) dropdownItems.innerHTML = '';
            }, 500);
        }
    });
    socket.emit('resetPick');
}


// ฟังก์ชั่นรีเซ็ตค่าอินพุตทั้งหมด
function resetInputs() {
    for (let i = 1; i <= 10; i++) {
        document.getElementById('input' + i).value = '';
        document.getElementById('output' + i).textContent = ` `;
    }
}

// ฟังก์ชั่นแปลงค่า 1-5 เป็น 6-10
function switchInputs() {
    for (let i = 1; i <= 5; i++) {
        const temp = document.getElementById('input' + i).value;
        document.getElementById('input' + i).value = document.getElementById('input' + (i + 5)).value;
        document.getElementById('input' + (i + 5)).value = temp;
    }
    // อัปเดตเอาท์พุตสวิตช์
    updateOutput();
}
function resetScore() {
    fetch('https://peeranat.ddns.net/api/reset-score', {
        method: 'POST'
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log('✅ Score reset successfully');
                // โหลดคะแนนใหม่จาก server
                loadTournament();
            } else {
                console.error('❌ Failed to reset score');
            }
        })
        .catch(err => {
            console.error('❌ Error resetting score:', err);
        });
}

// ฟังก์ชั่นสำหรับแลกเปลี่ยนภาพและชื่อทีม
function swapContent() {
    const img1 = document.getElementById('image1');
    const img2 = document.getElementById('image2');
    const tempSrc = img1.src;
    img1.src = img2.src;
    img2.src = tempSrc;

    const teamDisplay1 = document.getElementById('teamNameDisplay1');
    const teamDisplay2 = document.getElementById('teamNameDisplay2');
    const tempTeamDisplay = teamDisplay1.textContent;
    teamDisplay1.textContent = teamDisplay2.textContent;
    teamDisplay2.textContent = tempTeamDisplay;
}

// ฟังก์ชั่นสำหรับโหลดภาพจากไฟล์ในเครื่อง
function loadImage(event, imgId) {
    const img = document.getElementById(imgId);
    img.src = URL.createObjectURL(event.target.files[0]);
}

// ฟังก์ชั่นอัพเดทชื่อทีมที่แสดง
function updateTeamName() {
    const team1 = document.getElementById('team1').value;
    const team2 = document.getElementById('team2').value;
    document.getElementById('teamNameDisplay1').textContent = team1;
    document.getElementById('teamNameDisplay2').textContent = team2;
}

// ฟังก์ชั่นรีเซ็ตภาพ ชื่อทีม และช่องกาเครื่องหมายให้กลับเป็นเงื่อนไขเริ่มต้น
function resetContent() {
    document.getElementById('team1').value = "Team 1";
    document.getElementById('team2').value = "Team 2";
    updateTeamName();

    document.getElementById('image1').src = "https://via.placeholder.com/300x200?text=Image+1";
    document.getElementById('image2').src = "https://via.placeholder.com/300x200?text=Image+2";

    document.getElementById('file1').value = "";
    document.getElementById('file2').value = "";

    // รีเซ็ตช่องกาเครื่องหมายและรูปภาพเพิ่มเติม
    for (let i = 1; i <= 6; i++) {
        document.getElementById('checkbox' + i).checked = false;
        document.getElementById('extraImage' + i).style.display = "block";
    }
    
}

// ฟังก์ชั่นแสดงหรือซ่อนรูปภาพตามช่องกาเครื่องหมาย
function toggleImage(imageId) {
    const image = document.getElementById(imageId);
    const checkbox = document.getElementById('checkbox' + imageId.slice(-1));
    image.style.display = checkbox.checked ? "block" : "none";
}

// ฟังก์ชั่นเปลี่ยนแปลงทั้งหมด (ชื่อทีม, ภาพหลัก และสถานะช่องกาเครื่องหมาย 1-3 กับ 4-6)
function switchAll() {
    // เปลี่ยนชื่อทีม
    const team1 = document.getElementById('team1');
    const team2 = document.getElementById('team2');
    const tempName = team1.value;
    team1.value = team2.value;
    team2.value = tempName;
    updateTeamName();

    // เปลี่ยนภาพหลัก
    const img1 = document.getElementById('image1');
    const img2 = document.getElementById('image2');
    const tempSrc = img1.src;
    img1.src = img2.src;
    img2.src = tempSrc;

    // เปลี่ยนสถานะช่องกาเครื่องหมายและการมองเห็นรูปภาพเพิ่มเติม
    for (let i = 1; i <= 3; i++) {
        const checkboxA = document.getElementById('checkbox' + i);
        const checkboxB = document.getElementById('checkbox' + (i + 3));
        const extraImageA = document.getElementById('extraImage' + i);
        const extraImageB = document.getElementById('extraImage' + (i + 3));

        // เปลี่ยนสถานะช่องทำเครื่องหมาย
        const tempChecked = checkboxA.checked;
        checkboxA.checked = checkboxB.checked;
        checkboxB.checked = tempChecked;

        // เปลี่ยนการแสดงภาพตามช่องกาเครื่องหมาย
        extraImageA.style.display = checkboxA.checked ? "block" : "none";
        extraImageB.style.display = checkboxB.checked ? "block" : "none";
    }
}

// Ambil elemen input dan output
// window.onload = function() {
//     const tournamentnameInput = document.getElementById('tournamentnamemid');
//     const tournamentnameOutput = document.getElementById('tournamentnameOutput');

//     tournamentnameInput.addEventListener('input', function() {
//         tournamentnameOutput.textContent = tournamentnameInput.value;
//     });
// };

const phases = [
    // รอบแบน 1
    { type: "Blue Ban Phase", direction: "/Assets/Other/Left.webp" },
    { type: "Red Ban Phase", direction: "/Assets/Other/Right.webp" },
    { type: "Blue Ban Phase", direction: "/Assets/Other/Left.webp" },
    { type: "Red Ban Phase", direction: "/Assets/Other/Right.webp" },

    // รอบเลือกตัว 1
    { type: "Blue Pick Phase", direction: "/Assets/Other/Left.webp" },
    { type: "Red Pick Phase", direction: "/Assets/Other/Right.webp" },
    { type: "Blue Pick Phase", direction: "/Assets/Other/Left.webp" },
    { type: "Red Pick Phase", direction: "/Assets/Other/Right.webp" },

    // รอบแบน 2
    { type: "Red Ban Phase", direction: "/Assets/Other/Right.webp" },
    { type: "Blue Ban Phase", direction: "/Assets/Other/Left.webp" },
    { type: "Red Ban Phase", direction: "/Assets/Other/Right.webp" },
    { type: "Blue Ban Phase", direction: "/Assets/Other/Left.webp" },

    // รอบเลือกตัว 2
    { type: "Red Pick Phase", direction: "/Assets/Other/Right.webp" },
    { type: "Blue Pick Phase", direction: "/Assets/Other/Left.webp" },
    { type: "Red Pick Phase", direction: "/Assets/Other/Right.webp" },
];


let currentPhaseIndex = 0; // Track the current phase
// let timer = 60; // Timer duration in seconds
let timerInterval; // Store the interval for the timer
let timerRunning = false; // Track if the timer is running

const phaseElement = document.getElementById('phase');
const arrowElement = document.getElementById('arrow');
const timerElement = document.getElementById('timer');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const nextPhaseButton = document.getElementById('nextPhase');
const resetButton = document.getElementById('reset');

// Update the UI based on the current phase
function updateUI() {
    if (currentPhaseIndex < phases.length) {
        const currentPhase = phases[currentPhaseIndex];
        phaseElement.textContent = `${currentPhase.type}`;
        arrowElement.src = currentPhase.direction; // Update arrow image
        timerElement.textContent = timer;
        nextPhaseButton.disabled = false; // Enable "Next Phase" button
    } else {
        // When all phases are completed
        phaseElement.textContent = "Finalizing";
        arrowElement.src = "/Assets/Other/Adjustment.webp"; // Remove arrow image
        timerElement.textContent = "VS";
        nextPhaseButton.disabled = true; // Disable the button
    }
}

// Start the timer
// function startTimer() {
//     if (!timerRunning) {
//         timerRunning = true;
//         timerInterval = setInterval(() => {
//             if (timer > 0) {
//                 timer--;
//                 timerElement.textContent = timer;
//             } else {
//                 clearInterval(timerInterval); // Stop timer when it reaches 0
//                 timerRunning = false; // Timer stops running
//                 moveToNextPhase(); // Automatically move to the next phase
//             }
//         }, 1000);
//     }
// }

// Stop the timer
// function stopTimer() {
//     clearInterval(timerInterval); // Stop the timer
//     timerRunning = false;
// }

// Move to the next phase
// function moveToNextPhase() {
//     if (currentPhaseIndex < phases.length) {
//         currentPhaseIndex++;
//         updateUI();
//         if (currentPhaseIndex < phases.length) {
//             timer = 60; // Reset timer
//             startTimer(); // Restart timer
//         }
//     }
// }

// สั่ง reset timer + phase
// document.querySelector('button[onclick="reset()"]').addEventListener('click', () => {
//     socket.emit('reset');
// });

// Reset the entire process
function reset() {
    let confirmReset = confirm("คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ต?");
    if (confirmReset) {
        clearInterval(timerInterval); // Stop the timer
        timerRunning = false;
        socket.emit('reset'); // ส่ง event ไปที่ server
        alert("รีเซ็ตเรียบร้อยแล้ว ✅");
    } else {
        // ถ้าไม่อยากให้เด้งแจ้งเตือนตอนกดยกเลิกก็ลบออกได้
        alert("ยกเลิกการรีเซ็ต ❌");
    }
}
function resetPick() {
    clearInterval(timerInterval); // Stop the timer
    // currentPhaseIndex = 0; // Reset phase index
    // timer = 60; // Reset timer
    timerRunning = false;
    // updateUI(); // Reset UI
    socket.emit('resetPick');
}


// Button event listeners

// stopButton.addEventListener('click', stopTimer);
// nextPhaseButton.addEventListener('click', () => {
//     // stopTimer();
//     moveToNextPhase();
// });
// resetButton.addEventListener('click', reset);



// เริ่มต้น phase แรก
// updateUI();

//ฟังก์ชั่นสลับภาพ
function swapHeroes(id1, id2) {
    const imageDisplay1 = document.getElementById(`image-display-${id1}`);
    const imageDisplay2 = document.getElementById(`image-display-${id2}`);
    const searchInput1 = document.getElementById(`search-${id1}`);
    const searchInput2 = document.getElementById(`search-${id2}`);

    const img1 = imageDisplay1.querySelector('img');
    const img2 = imageDisplay2.querySelector('img');

    // เช็คว่ามีภาพทั้งสองฝั่งไหม
    if (!img1 || !img2) return;

    // ส่งข้อมูลไปอัปเดตใน database ก่อน
    fetch('https://peeranat.ddns.net/api/swap-heroes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId1: id1, positionId2: id2 })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // ถ้า swap ใน database สำเร็จ ค่อยสลับในหน้าเว็บ



                // ใส่ animation fly-out
                img1.classList.add('fly-out');
                img2.classList.add('fly-out');

                setTimeout(() => {
                    // สลับ src และ alt
                    const tempSrc = img1.src;
                    const tempAlt = img1.alt;

                    img1.src = img2.src;
                    img1.alt = img2.alt;

                    img2.src = tempSrc;
                    img2.alt = tempAlt;

                    // ใส่ fly-in
                    img1.classList.remove('fly-out');
                    img1.classList.add('fly-in');

                    img2.classList.remove('fly-out');
                    img2.classList.add('fly-in');

                    // สลับชื่อใน input
                    const tempSearch = searchInput1.value;
                    searchInput1.value = searchInput2.value;
                    searchInput2.value = tempSearch;

                    //ส่งไปยังเซร์ฟเวอร์
                    // socket.emit('selectHero', { heroId: hero.id, positionId: id });
                }, 500); // ระยะเวลา fly-out
            } else {
                alert('เกิดข้อผิดพลาดในการสลับข้อมูลในฐานข้อมูล');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
        });
}


