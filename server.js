const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const puzzleDatabase = [
    {
        id: 1,
        matrix: [
            [{t:'logo', text:'BÖLÜM<br>1'}, {t:'c', text:'ATEŞLİ<br>HASTALIK', dir:'down'}, {t:'blank'}, {t:'c', text:'ACI/TATLI<br>SEBZE', dir:'down'}, {t:'blank'}, {t:'c', text:'YIKIK<br>DÖKÜK', dir:'down'}],
            [{t:'c', text:'GÜNDÜZÜN<br>İLK SAATİ', dir:'right'}, {t:'w', ans:'S', words:[1,4]}, {t:'w', ans:'A', words:[1]}, {t:'w', ans:'B', words:[1,5]}, {t:'w', ans:'A', words:[1]}, {t:'w', ans:'H', words:[1,6]}],
            [{t:'blank'}, {t:'w', ans:'I', words:[4]}, {t:'blank'}, {t:'w', ans:'İ', words:[5]}, {t:'blank'}, {t:'w', ans:'A', words:[6]}],
            [{t:'c', text:'RÜYA<br>YORUMU', dir:'right'}, {t:'w', ans:'T', words:[2,4]}, {t:'w', ans:'A', words:[2]}, {t:'w', ans:'B', words:[2,5]}, {t:'w', ans:'İ', words:[2]}, {t:'w', ans:'R', words:[2,6]}],
            [{t:'blank'}, {t:'w', ans:'M', words:[4]}, {t:'blank'}, {t:'w', ans:'E', words:[5]}, {t:'blank'}, {t:'w', ans:'A', words:[6]}],
            [{t:'c', text:'ZEHİRLİ<br>BÖCEK', dir:'right'}, {t:'w', ans:'A', words:[3,4]}, {t:'w', ans:'K', words:[3]}, {t:'w', ans:'R', words:[3,5]}, {t:'w', ans:'E', words:[3]}, {t:'w', ans:'P', words:[3,6]}]
        ],
        words: { 1: { length: 5, completed: false }, 2: { length: 5, completed: false }, 3: { length: 5, completed: false }, 4: { length: 5, completed: false }, 5: { length: 5, completed: false }, 6: { length: 5, completed: false } }
    },
    {
        id: 2,
        matrix: [
            [{t:'logo', text:'BÖLÜM<br>2'}, {t:'c', text:'KARIN<br>ALTI', dir:'down'}, {t:'blank'}, {t:'c', text:'HAMUR<br>İŞİ', dir:'down'}, {t:'blank'}, {t:'c', text:'UÇAN<br>BÖCEK', dir:'down'}],
            [{t:'c', text:'KÖTÜ<br>RÜYA', dir:'right'}, {t:'w', ans:'K', words:[1,4]}, {t:'w', ans:'A', words:[1]}, {t:'w', ans:'B', words:[1,5]}, {t:'w', ans:'U', words:[1]}, {t:'w', ans:'S', words:[1,6]}],
            [{t:'blank'}, {t:'w', ans:'A', words:[4]}, {t:'blank'}, {t:'w', ans:'Ö', words:[5]}, {t:'blank'}, {t:'w', ans:'İ', words:[6]}],
            [{t:'c', text:'YELKEN<br>DİREĞİ', dir:'right'}, {t:'w', ans:'S', words:[2,4]}, {t:'w', ans:'E', words:[2]}, {t:'w', ans:'R', words:[2,5]}, {t:'w', ans:'E', words:[2]}, {t:'w', ans:'N', words:[2,6]}],
            [{t:'blank'}, {t:'w', ans:'I', words:[4]}, {t:'blank'}, {t:'w', ans:'E', words:[5]}, {t:'blank'}, {t:'w', ans:'E', words:[6]}],
            [{t:'c', text:'KOKULU<br>OT', dir:'right'}, {t:'w', ans:'K', words:[3,4]}, {t:'w', ans:'E', words:[3]}, {t:'w', ans:'K', words:[3,5]}, {t:'w', ans:'İ', words:[3]}, {t:'w', ans:'K', words:[3,6]}]
        ],
        words: { 1: { length: 5, completed: false }, 2: { length: 5, completed: false }, 3: { length: 5, completed: false }, 4: { length: 5, completed: false }, 5: { length: 5, completed: false }, 6: { length: 5, completed: false } }
    }
];

const rooms = {};

io.on('connection', (socket) => {
    console.log('🔌 Bir oyuncu bağlandı! ID:', socket.id);

    socket.on('createRoom', () => {
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
        if(correctPlacements === 6) { room.scores[socket.id] += 6; } 
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
            lastBingoOwner: correctPlacements === 6 ? socket.id : null,
            lastWordBonus: wordBonus > 0 ? { owner: socket.id, points: wordBonus } : null
        });
    });

    // HAYALET OYUNCU TEMİZLEYİCİSİ
    socket.on('disconnect', () => {
        console.log('❌ Bağlantı koptu:', socket.id);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomId).emit('errorMsg', 'Rakibinin bağlantısı koptu. Sayfayı yenileyip yeni oda kurabilirsin.');
                
                if (room.players.length === 0) {
                    delete rooms[roomId]; // Oda boşsa tamamen imha et
                }
            }
        }
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`🚀 Sunucu Hazır: http://localhost:${PORT}`);
});