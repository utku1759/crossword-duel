const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// DIŞARIDAN VERİTABANINI OKUMA SİSTEMİ
const puzzleDatabase = require('./puzzles.json');

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', () => {
        for (const r in rooms) { if (rooms[r].players.includes(socket.id)) return; }
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        // HAVUZDAN RASTGELE BULMACA SEÇ!
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