const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// YENİ NESİL KUSURSUZ "KARE" BULMACA (6x6 - Sıfır Açık Harf!)
const puzzleDatabase = [
    {
        id: 1,
        rows: 6,
        cols: 6,
        matrix: [
            [{t:'logo', text:'CROSS<br>DUEL'}, {t:'logo', text:'PRO<br>V1'}, {t:'c', text:'BENİM KAZAM<br>(Trafik..)', dir:'down'}, {t:'c', text:'ESERLERLE<br>İLGİLİ', dir:'down'}, {t:'c', text:'KISMET /<br>PAY', dir:'down'}, {t:'c', text:'KEMİK<br>İÇİ', dir:'down'}],
            [{t:'logo', text:'BÖLÜM<br>1'}, {t:'c', text:'İKNA OLMUŞ<br>--<br>YEMEK EŞYASI', dir:'both'}, {t:'w', ans:'K', words:[1,7]}, {t:'w', ans:'A', words:[1,8]}, {t:'w', ans:'N', words:[1,9]}, {t:'w', ans:'İ', words:[1,10]}],
            [{t:'c', text:'OLAĞANÜSTÜ<br>ÖYKÜ', dir:'right'}, {t:'w', ans:'M', words:[2,6]}, {t:'w', ans:'A', words:[2,7]}, {t:'w', ans:'S', words:[2,8]}, {t:'w', ans:'A', words:[2,9]}, {t:'w', ans:'L', words:[2,10]}],
            [{t:'c', text:'BİR KURULUN<br>ÜYESİ', dir:'right'}, {t:'w', ans:'A', words:[3,6]}, {t:'w', ans:'Z', words:[3,7]}, {t:'w', ans:'A', words:[3,8]}, {t:'w', ans:'S', words:[3,9]}, {t:'w', ans:'İ', words:[3,10]}],
            [{t:'c', text:'HIRSIZ /<br>ÇALAN', dir:'right'}, {t:'w', ans:'S', words:[4,6]}, {t:'w', ans:'A', words:[4,7]}, {t:'w', ans:'R', words:[4,8]}, {t:'w', ans:'İ', words:[4,9]}, {t:'w', ans:'K', words:[4,10]}],
            [{t:'c', text:'TEK HÜCRELİ<br>CANLI', dir:'right'}, {t:'w', ans:'A', words:[5,6]}, {t:'w', ans:'M', words:[5,7]}, {t:'w', ans:'İ', words:[5,8]}, {t:'w', ans:'P', words:[5,9]}, {t:'logo', text:'CROSS<br>DUEL'}]
        ],
        // Her kelimenin boyutu stratejik olarak 4 ve 5 harflerden oluşur!
        words: { 
            1: { length: 4, completed: false }, // KANİ
            2: { length: 5, completed: false }, // MASAL
            3: { length: 5, completed: false }, // AZASİ
            4: { length: 5, completed: false }, // SARİK
            5: { length: 4, completed: false }, // AMİP
            6: { length: 4, completed: false }, // MASA (Dikey)
            7: { length: 5, completed: false }, // KAZAM (Dikey)
            8: { length: 5, completed: false }, // ASARİ (Dikey)
            9: { length: 5, completed: false }, // NASİP (Dikey)
            10: { length: 4, completed: false } // İLİK (Dikey)
        }
    }
];

const rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', () => {
        for (const r in rooms) { if (rooms[r].players.includes(socket.id)) return; }
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        rooms[roomId] = {
            id: roomId,
            players: [socket.id],
            scores: { [socket.id]: 0 },
            turnIndex: 0, 
            puzzle: JSON.parse(JSON.stringify(puzzleDatabase[0])), 
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
        if(correctPlacements === 4) { room.scores[socket.id] += 4; } 
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
http.listen(PORT, () => { console.log(`🚀 Sunucu Hazır`); });