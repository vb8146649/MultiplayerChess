import express from "express";
import http from "http";
import {Server} from "socket.io";
import { Chess } from "chess.js";
import { copyFileSync } from "fs";

const initialChess = new Chess();
const app = express();
const server = http.createServer(app);
let waitingRoom = null;
let currentPlayer = "w";
const io = new Server(server);
// const chess = new Chess();
const games = {}; // Stores all active games

app.set("view engine", "ejs");
// app.use(express.static("./public"));
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("index",{title:"Chess Game"});
}); 

function deleteDuplicateId(socket){
    console.log(games);
    for (const roomId in games) {
        const { players } = games[roomId];
        
        if (players.white === socket.id) {
            delete players.white;
        } else if (players.black === socket.id) {
            delete players.black;
        }
    
        // If the room is empty, delete it
        if (!players.white && !players.black) {
            if(roomId!=waitingRoom){
                delete games[roomId];
            }
        }
        // } else if (players.white || players.black) {
        //     io.to(roomId).emit("online", "offline");
        //     waitingRoom = roomId; // Set back to waiting if one player left
        // }
    }
    for (const roomId in games) {
        const { players } = games[roomId];
        if(roomId!=waitingRoom){
            if ((Boolean(players.white) !== Boolean(players.black)) && (games[roomId].chess.fen() !== initialChess.fen())) {
                io.to(roomId).emit("gameOver",{message:`${players.white?"White":"Black"} Wins : Opponent Disconnected`});
                games[roomId].chess.reset();
            }
            if((Boolean(players.white) != Boolean(players.black))){
                io.to(roomId).emit("online", "offline");
                waitingRoom = roomId; // Set back to waiting if one player left
            }
        }
    }
}
io.on("connection", (socket) => {
    console.log("a user connected");
    socket.on("newGame", () => {
        deleteDuplicateId(socket);
        if (waitingRoom) {
            // If there's a waiting room, join it
            const roomId = waitingRoom;
            console.log(roomId);
            console.log(games[roomId]);
            socket.join(roomId);
            if(!games[roomId].players.white){
                games[roomId].players.white = socket.id;
                socket.emit("playerRole", {room:roomId,role:"w",Id:socket.id});
            }else{
                games[roomId].players.black = socket.id;
                socket.emit("playerRole", {room:roomId,role:"b",Id:socket.id});
            }
            games[roomId].players.black = socket.id; // Assign as Black
            waitingRoom = null; // Room is now full
            io.to(roomId).emit("online", "online");
        } else {
            // No available waiting room, create a new game
            const roomId = `game-${Date.now()}`;
            games[roomId] = {
                chess: new Chess(),
                players: { white: socket.id, black: null }
            };

            socket.join(roomId);
            waitingRoom = roomId; // Store for next player
            socket.emit("playerRole", {room:roomId,role:"w",Id:socket.id});
            console.log(`Player ${socket.id} created room: ${roomId} and is waiting`);
        }
        console.log(games);
    });
    socket.on("joinGame", (roomId) => {
        deleteDuplicateId(socket);
        console.log(games);
        socket.join(roomId);
        if (!games[roomId]) {
            // ✅ Prevent errors if room doesn't exist
            socket.emit("error", { message: "Room does not exist" });
            return;
        }
        if(!games[roomId].players.white){
            games[roomId].players.white= socket.id;
            socket.emit("playerRole",{room:roomId,role:"w",Id:socket.id});
        }else if(!games[roomId].players.black){
            games[roomId].players.black=socket.id;
            socket.emit("playerRole",{room:roomId,role:"b",Id:socket.id});
        }else{
            socket.emit("playerRole",{room:roomId,role:null,Id:socket.id});
        }
    });
    socket.on("disconnect", () => {
        deleteDuplicateId(socket);
    });

    socket.on("move",({roomId,move})=>{
        try {
            if (!games[roomId]) return; // Room must exist
            if(!(games[roomId].players.white && games[roomId].players.black)){
                return;
            }
            const chess = games[roomId].chess;
            if(chess.turn() ==="w" && socket.id!==games[roomId].players.white){
                return;
            }
            if(chess.turn() ==="b" && socket.id!==games[roomId].players.black){
                return;
            }
            const result =chess.move(move);
            if(result){
                currentPlayer=chess.turn();
                io.to(roomId).emit("move",move);
                io.to(roomId).emit("boardState",chess.fen());
                if (chess.isGameOver()) {
                    let resultMessage = "Game Over!";
                    if (chess.isCheckmate()) {
                        resultMessage = `${chess.turn() === "w" ? "Black" : "White"} wins by checkmate!`;
                    } else if (chess.isDraw()) {
                        resultMessage = "Game is a draw!";
                    } else if (chess.isStalemate()) {
                        resultMessage = "Stalemate!";
                    } else if (chess.isInsufficientMaterial()) {
                        resultMessage = "Draw due to insufficient material!";
                    } else if (chess.isThreefoldRepetition()) {
                        resultMessage = "Draw by threefold repetition!";
                    } else if (chess.isSeventyFiveMoves()) {
                        resultMessage = "Draw by 75-move rule!";
                    }
                    games[roomId].chess.reset();
                    io.to(roomId).emit("gameOver", { message: resultMessage });
                }
            }else{
                console.log("Invalid move",move);
                socket.emit("invalidMove",move);
            }
        } catch (err) {
            console.log(err.message);
            socket.emit("invalidMove",move);
        }
    })
})

server.listen(3000,"0.0.0.0", () => {
    console.log("Server is running on port 3000");
});
