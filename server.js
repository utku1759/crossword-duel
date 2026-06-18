const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// KUSURSUZ ÇENGEL BULMACA (Attığın Görselin Birebir Aynısı)
const puzzleDatabase = [
    {
        id: 1,
        rows: 9,
        cols: 7,
        matrix: [
            // Satır 0 (En Üst İpuçları)
            [{t:'logo', text:'CROSS<br>DUEL'}, {t:'c', text:'KANSERİN<br>YAYILMASI', dir:'down'}, {t:'c', text:'MUTFAK<br>TEKNESİ', dir:'down'}, {t:'c', text:'KÜKÜRT<br>SİMGESİ', dir:'down'}, {t:'c', text:'MOTOSİKLET<br>BAŞLIĞI', dir:'down'}, {t:'c', text:'BİR GÖZ<br>RENGİ', dir:'down'}, {t:'c', text:'BUCAK', dir:'down'}],
            // Satır 1
            [{t:'c', text:'OTURULAN<br>YER', dir:'right'}, {t:'w', ans:'M', words:[1,2]}, {t:'w', ans:'E', words:[1,3]}, {t:'w', ans:'S', words:[1,4]}, {t:'w', ans:'K', words:[1,5]}, {t:'w', ans:'E', words:[1,6]}, {t:'w', ans:'N', words:[1,7]}],
            // Satır 2
            [{t:'c', text:'BARINAK', dir:'right'}, {t:'w', ans:'E', words:[8,2]}, {t:'w', ans:'V', words:[8,3]}, {t:'c', text:'KARIŞIK<br>RENK<br>--<br>DÖRT TIRNAKLI<br>DEMİR', dir:'both'}, {t:'w', ans:'A', words:[9,5]}, {t:'w', ans:'L', words:[9,6]}, {t:'w', ans:'A', words:[9,7]}],
            // Satır 3
            [{t:'c', text:'BÜYÜK<br>SÜRÜNGEN', dir:'right'}, {t:'w', ans:'T', words:[11,2]}, {t:'w', ans:'İ', words:[11,3]}, {t:'w', ans:'M', words:[11,10]}, {t:'w', ans:'S', words:[11,5]}, {t:'w', ans:'A', words:[11,6]}, {t:'w', ans:'H', words:[11,7]}],
            // Satır 4
            [{t:'c', text:'YÜRÜME<br>ORGANI', dir:'right'}, {t:'w', ans:'A', words:[12,2]}, {t:'w', ans:'Y', words:[12,3]}, {t:'w', ans:'A', words:[12,10]}, {t:'w', ans:'K', words:[12,5]}, {t:'c', text:'İNCE BİR<br>ÜNLÜ<br>--<br>SORGUÇLU<br>BALIKÇIL', dir:'both'}, {t:'w', ans:'İ', words:[13,7]}],
            // Satır 5
            [{t:'c', text:'SU<br>TAŞKINI', dir:'right'}, {t:'w', ans:'S', words:[14,2]}, {t:'w', ans:'E', words:[14,3]}, {t:'w', ans:'L', words:[14,10]}, {t:'c', text:'SESLENME<br>ÜNLEMİ<br>--<br>ESKİ AVRUPA<br>PARASI', dir:'both'}, {t:'w', ans:'O', words:[16,15]}, {t:'w', ans:'Y', words:[16,7]}],
            // Satır 6
            [{t:'c', text:'TON<br>KISALTMASI', dir:'right'}, {t:'w', ans:'T', words:[17,2]}, {t:'c', text:'DÜMEN<br>KOLU<br>--<br>İKİNCİ<br>NOTA', dir:'both'}, {t:'w', ans:'Y', words:[18,10]}, {t:'w', ans:'E', words:[18,19]}, {t:'w', ans:'K', words:[18,15]}, {t:'w', ans:'E', words:[18,7]}],
            // Satır 7
            [{t:'c', text:'İRİ TANELİ<br>BEZELYE', dir:'right'}, {t:'w', ans:'A', words:[21,2]}, {t:'w', ans:'R', words:[21,20]}, {t:'w', ans:'A', words:[21,10]}, {t:'w', ans:'K', words:[21,19]}, {t:'w', ans:'A', words:[21,15]}, {t:'c', text:'ÜNLEM<br>SÖZÜ', dir:'down'}],
            // Satır 8
            [{t:'c', text:'ESKİ SEN<br>HİTABI', dir:'right'}, {t:'w', ans:'Z', words:[23,2]}, {t:'w', ans:'E', words:[23,20]}, {t:'c', text:'AZOTLU<br>MADDE', dir:'right'}, {t:'w', ans:'Ü', words:[24,19]}, {t:'w', ans:'R', words:[24,15]}, {t:'w', ans:'E', words:[24,22]}]
        ],
        // Tam 24 adet dinamik kelime! Kesişimler kusursuz hesaplandı.
        words: { 
            1: { length: 6, completed: false }, 2: { length: 8, completed: false }, 3: { length: 5, completed: false },
            4: { length: 1, completed: false }, 5: { length: 4, completed: false }, 6: { length: 3, completed: false },
            7: { length: 6, completed: false }, 8: { length: 2, completed: false }, 9: { length: 3, completed: false },
            10: { length: 5, completed: false }, 11: { length: 6, completed: false }, 12: { length: 4, completed: false },
            13: { length: 1, completed: false }, 14: { length: 3, completed: false }, 15: { length: 4, completed: false },
            16: { length: 2, completed: false }, 17: { length: 1, completed: false }, 18: { length: 4, completed: false },
            19: { length: 3, completed: false }, 20: { length: 2, completed: false }, 21: { length: 5, completed: false },
            22: { length: 1, completed: false }, 23: { length: 2, completed: false }, 24: { length: 3, completed: false }
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