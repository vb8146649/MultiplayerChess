const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let highlightedSquares=[];
let roomId =null;
let selectedPiece = null;
let sourceSquare = null;
let playerRole =null;
let playerId =null;

const renderBoard=()=>{
    const board=chess.board();
    boardElement.innerHTML = "";
    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square",(rowindex + squareindex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowindex;
            squareElement.dataset.col = squareindex;
            if (highlightedSquares.some(h => h.row === rowindex && h.col === squareindex)) {
                squareElement.classList.add("highlight");
            }
            if(square){
                const pieceElement=document.createElement("div");
                pieceElement.classList.add("piece",square.color==="w"?"white":"black" );
                pieceElement.innerText=getPieceUnicode(square);
                pieceElement.dataset.selectable = playerRole === square.color ? "true" : "false";  
                pieceElement.addEventListener("click", (e) => {
                    e.stopPropagation(); // ✅ Prevents event bubbling
                    if (pieceElement.dataset.selectable === "true") {  // ✅ Explicit check
                        handlePieceSelection(pieceElement, rowindex, squareindex);
                    }else if(pieceElement.dataset.selectable === "false" && selectedPiece){
                        handleMove(sourceSquare,{row:rowindex,col:squareindex});
                    }
                });
                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("click", () => {
                if (selectedPiece) {
                    console.log("cut piece")
                    const destinationSquare = {
                        row: Number(squareElement.dataset.row),
                        col: Number(squareElement.dataset.col),
                    };
                    handleMove(sourceSquare, destinationSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    })

    if(playerRole==='b'){
        boardElement.classList.add("flipped");
    }else{
        boardElement.classList.remove("flipped");
    }
};

const handlePieceSelection = (pieceElement, row, col) => {
    selectedPiece = pieceElement;
    sourceSquare = { row, col };
    highlightMoves(sourceSquare);
};

const handleMove=(source,target)=>{
    const move={
        from:`${String.fromCharCode(97+source.col)}${8-source.row}`,
        to:`${String.fromCharCode(97+target.col)}${8-target.row}`,
        promotion:'q'
    }
    if (((source.row === 1 && target.row === 0) || (source.row === 6 && target.row === 7)) && chess.get(move.from).type==="p") {
        // Ask user for promotion piece
        const promotionChoice = prompt("Promote to (q = Queen, r = Rook, b = Bishop, n = Knight):", "q");
        if (["q", "r", "b", "n"].includes(promotionChoice)) {
            move.promotion = promotionChoice;
        }
    }
    clearHighlights();
    socket.emit("move",{roomId,move});
};

socket.on("playerMove",(playerMove)=>{
    console.log(playerMove);
    if(playerMove===playerRole){
        document.getElementById("playerMove").innerText="Your Move";
        document.getElementById("opponentMove").innerText=" ";
    }else{
        document.getElementById("opponentMove").innerText="Opponent Move";
        document.getElementById("playerMove").innerText=" ";
    }
})

const unicodePieces={
    "k": "♚",  // Black King
    "q": "♛",  // Black Queen
    "r": "♜",  // Black Rook
    "b": "♝",  // Black Bishop
    "n": "♞",  // Black Knight
    "p": "♙",  // White Pawn
};
const getPieceUnicode=(piece)=>{
    return unicodePieces[piece.type]||"";
};

const highlightMoves = (square) => {
    clearHighlights();
    const from = `${String.fromCharCode(97 + square.col)}${8 - square.row}`;
    const moves = chess.moves({ square: from, verbose: true });

    highlightedSquares = moves.map(move => {
        const col = move.to.charCodeAt(0) - 97;
        const row = 8 - parseInt(move.to[1]);
        return { row, col };
    });

    renderBoard();
};

const clearHighlights = () => {
    highlightedSquares = [];
    renderBoard();
};

socket.on("playerRole", ({ room, role, Id }) => {
    playerRole = role;  
    roomId = room;
    playerId = Id;  

    document.getElementById("playerId").innerText = "PlayerID: " + playerId;
    document.getElementById("roomId").innerText = "RoomID: " +roomId;
    renderBoard(); 
});


socket.on("boardState",(fen)=>{
    chess.load(fen);
    renderBoard();
})

socket.on("online",(status)=>{
    document.getElementById("opponentStatus").innerText=status;
})

socket.on("move",(move)=>{
    chess.move(move);
    renderBoard();
})

function newGame(){
    chess.reset();
    renderBoard();
    socket.emit("newGame");
}


document.getElementById("joinGameForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const roomId = document.getElementById("formroomIdJoin").value;
    console.log(roomId);
    socket.emit("joinGame",roomId);
});
// socket.emit("joinGame",roomId);

socket.on("gameOver",({message})=>{
    alert(message);
    chess.reset();
})

renderBoard();