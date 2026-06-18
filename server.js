const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// YENİ NESİL DİNAMİK BULMACA HAVUZU (8x8 Grid ve Farklı Kelime Boyutları)
const puzzleDatabase = [
    {
        id: 1,
        rows: 8,
        cols: 8,
        matrix: [
            [{t:'logo', text:'DUELLER<br>BAŞLASIN'}, {t:'c', text:'İLGEÇ', dir:'down'}, {t:'blank'}, {t:'c', text:'KIRMIZI', dir:'down'}, {t:'blank'}, {t:'c', text:'SARI / KIRMIZI<br>TAKIM', dir:'down'}, {t:'blank'}, {t:'blank'}],
            [{t:'c', text:'YAZI<br>ARACI', dir:'right'}, {t:'w', ans:'K', words:[1,4]}, {t:'w', ans:'A', words:[1]}, {t:'w', ans:'L', words:[1,5]}, {t:'w', ans:'E', words:[1]}, {t:'w', ans:'M', words:[1,6]}, {t:'blank'}, {t:'blank'}],
            [{t:'blank'}, {t:'w', ans:'A', words:[4]}, {t:'blank'}, {t:'w', ans:'A', words:[5]}, {t:'blank'}, {t:'w', ans:'A', words:[6]}, {t:'c', text:'TÜKETMEK', dir:'down'}, {t:'blank'}],
            [{t:'c', text:'BÜYÜK<br>EV', dir:'right'}, {t:'w', ans:'K', words:[2,4]}, {t:'w', ans:'O', words:[2]}, {t:'w', ans:'N', words:[2,5]}, {t:'w', ans:'A', words:[2]}, {t:'w', ans:'K', words:[2,6]}, {t:'w', ans:'S', words:[2,7]}, {t:'blank'}],
            [{t:'blank'}, {t:'w', ans:'D', words:[4]}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'w', ans:'S', words:[6]}, {t:'w', ans:'A', words:[7]}, {t:'blank'}],
            [{t:'c', text:'YÜCE / ULU', dir:'right'}, {t:'w', ans:'A', words:[3,4]}, {t:'w', ans:'Z', words:[3]}, {t:'w', ans:'İ', words:[3]}, {t:'w', ans:'M', words:[3]}, {t:'w', ans:'I', words:[3,6]}, {t:'w', ans:'R', words:[3,7]}, {t:'blank'}],
            [{t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'w', ans:'F', words:[7]}, {t:'blank'}],
            [{t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}, {t:'blank'}]
        ],
        // Kelimelerin kendi gerçek uzunluklarına göre bonus puanları dinamik hesaplanacak
        words: { 
            1: { length: 5, completed: false }, // KALEM (5 Puan)
            2: { length: 6, completed: false }, // KONAKS (6 Puan)
            3: { length: 6, completed: false }, // AZİMİR (6 Puan)
            4: { length: 5, completed: false }, // KADRA (5 Puan)
            5: { length: 3, completed: false }, // LAN (3 Puan) - Çıtır taktiksel kelime
            6: { length: 5, completed: false }, // MAKSİ (5 Puan)
            7: { length: 4, completed: false }  // SARF (4 Puan) - Ortadan başlayan kelime
        }
    }
];

const rooms = {};

io.on('connection', (socket) => {
    console.log('🔌 Oyuncu Bağlantısı Aktif: ', socket.id);

    socket.on('createRoom', () => {
        for (const r in rooms) { if (rooms[r].players.includes(socket.id)) return; }
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const randomIndex = Math.floor(Math.random() * puzzleDatabase.length);
        
        rooms[roomId] = {
            id: roomId,
            players: [socket.id],
            scores: { [socket.id]: 0 },
            turnIndex: 0, 
            puzzle: JSON.parse(JSON.stringify(puzzleDatabase[randomIndex])), 
            letterPool: []
        };
        
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', (roomId) => {
        roomId = roomId.toUpperCase();
        const room = rooms[roomId];

        if (!room) { socket.emit('errorMsg', 'Oda bulunamadı!'); return; }
        if (room.players.includes(socket.id)) return; 
        if (room.players.length >= 2) { socket.emit('errorMsg', 'Oda zaten dolu!'); return; }

        room.players.push(socket.id);
        room.scores[socket.id] = 0;
        socket.join(roomId);

        if (room.players.length === 2) {
            let cells = [];
            room.puzzle.matrix.forEach(row => { row.forEach(cell => { if(cell.t === 'w') cells.push(cell.ans); }); });
            
            // Harf havuzunu karıştır
            room.letterPool = cells.sort(() => Math.random() - 0.5);

            io.to(roomId).emit('gameStarted', {
                roomId: roomId,
                players: room.players,
                puzzle: room.puzzle,
                letterPool: room.letterPool,
                activePlayer: room.players[room.turnIndex]
            });
        }
    });

    socket.on('submitTurn', ({ roomId, turnDelta, correctPlacements, wordBonus, updatedPuzzle, remainingPool }) => {
        const room = rooms[roomId];
        if (!room) return;

        room.scores[socket.id] += turnDelta;
        if(correctPlacements === 4) { room.scores[socket.id] += 4; } // Yeni 4'lü Bingo Bonusu
        if(wordBonus > 0) { room.scores[socket.id] += wordBonus; }   

        room.puzzle = updatedPuzzle;
        room.letterPool = remainingPool;

        room.turnIndex = (room.turnIndex + 1) % 2;
        const nextPlayer = room.players[room.turnIndex];

        io.to(roomId).emit('turnUpdated', {
            players: room.players,
            scores: room.scores,
            puzzle: room.puzzle,
            letterPool: room.letterPool,
            activePlayer: nextPlayer,
            lastBingoOwner: correctPlacements === 4 ? socket.id : null,
            lastWordBonus: wordBonus > 0 ? { owner: socket.id, points: wordBonus } : null
        });
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomId).emit('errorMsg', 'Rakibinin bağlantısı koptu. Sayfayı yenileyip yeni oda kurabilirsin.');
                if (room.players.length === 0) { delete rooms[roomId]; }
            }
        }
    });
});

const PORT = 3000;
http.listen(PORT, () => { console.log(`🚀 Sunucu Hazır: http://localhost:${PORT}`); });