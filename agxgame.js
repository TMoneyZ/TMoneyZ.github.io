var io;
var gameSocket;

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket){
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
function hostCreateNewGame() {
    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});

    // Join the Room and wait for the players
    this.join(thisGameId.toString());
};

/*
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : gameId
    };
    //console.log("All Players Present. Preparing game...");
    io.sockets.in(data.gameId).emit('beginNewGame', data);
};

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId, players) {
    console.log('Game Started.');
    sendWord(0, gameId, players);
};

/**
 * A player answered correctly. Time for the next word.
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextRound(data, players) {
    console.log(data.round);
    console.log(wordPool.length);

    if(data.round < wordPool.length ){
        // Send a new set of words back to the host and players.
        sendWord(data.round, data.gameId, players);
    } else {
        // If the current round exceeds the number of words, send the 'gameOver' event.
        io.sockets.in(data.gameId).emit('gameOver',data);
    }
}
/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */

/**
 * A player clicked the 'JOIN GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {
    console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.gameId);

        //console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
}

/**
 * A player has tapped a word in the word list.
 * @param data gameId
 */
function playerAnswer(data) {
    console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);
    console.log(data.answer);

    // The player's answer is attached to the data object.  \
    // Emit an event with the answer so it can be checked by the 'Host'
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(data) {
    // console.log('Player: ' + data.playerName + ' ready for new game.');

    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom',data);
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

/**
 * Get a word for the host, and a list of words for the player.
 *
 * @param wordPoolIndex
 * @param gameId The room identifier
 */
function sendWord(wordPoolIndex, gameId, players) {
    players.forEach(element => { 
        console.log(element); 
    });
    console.log(wordPool[0])
    console.log(wordPool[0].theme)
    console.log(wordPool[0].roles)

    // var data = getWordData(wordPoolIndex, players);
    var data = getThemeData(wordPoolIndex, players);
    console.log(data)
    io.sockets.in(gameId).emit('newWordData', data);
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getThemeData(i, players){
    console.log(i)
    console.log(players)
    console.log(wordPool[i])
    console.log(wordPool[i].theme)

    
    var theme = wordPool[i].theme
    var roles = wordPool[i].roles
    
    var bucket = [...Array(roles.length).keys()];
    var order = {}

    for (var j=0;j<players.length;j++) {
        randomIndex = Math.floor(Math.random()*bucket.length);
        // order.push(bucket.splice(randomIndex, 1)[0]);
        order[players[j].playerName] = bucket.splice(randomIndex, 1)[0]
    }

    console.log(theme)
    console.log(bucket)
    console.log(order)

    // Package the words into a single object.
    var wordData = {
        round: i,
        word : theme,   // Displayed Word
        answer : order, // Correct Answer
        list : roles      // Word list for player (decoys and answer)
    };

    return wordData;
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(i, players){
    // Randomize the order of the available words.
    // The first element in the randomized array will be displayed on the host screen.
    // The second element will be hidden in a list of decoys as the correct answer
    var words = shuffle(wordPool[i].words);

    // Randomize the order of the decoy words and choose the first 5
    var decoys = shuffle(wordPool[i].decoys).slice(0,5);

    // Pick a random spot in the decoy list to put the correct answer
    var rnd = Math.floor(Math.random() * 5);
    decoys.splice(rnd, 0, words[1]);

    // Package the words into a single object.
    var wordData = {
        round: i,
        word : words[0],   // Displayed Word
        answer : words[1], // Correct Answer
        list : decoys      // Word list for player (decoys and answer)
    };

    return wordData;
}

/*
 * Javascript implementation of Fisher-Yates shuffle algorithm
 * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 */
function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

/**
 * Each element in the array provides data for a single round in the game.
 *
 * In each round, two random "words" are chosen as the host word and the correct answer.
 * Five random "decoys" are chosen to make up the list displayed to the player.
 * The correct answer is randomly inserted into the list of chosen decoys.
 *
 * @type {Array}
 */

var wordPool = [
    {
        "theme" : "はぁ",
        "roles" : [
            "なんで？の「はぁ」",
            "力をためる「はぁ」",
            "ぼうぜんの「はぁ」",
            "感心の「はぁ」",
            "怒りの「はぁ」",
            "とぼけの「はぁ」",
            "おどろきの「はぁ」",
            "失恋の「はぁ」"
        ]
    },
    {
        "theme" : "えー",
        "roles" : [
            "アルファベットの「えー」",
            "膨大な宿題に「えー」",
            "告白されて「えー」",
            "聞き取れないときの「えー」",
            "スピーチの「えー」",
            "マジで？の「えー」",
            "半ギレの「えー」",
            "パニックの「えー」"
        ]
    },
    {
        "theme" : "うそ",
        "roles" : [
            "突然のプレゼント「うそ」",
            "財布をなくして「うそ」",
            "相手をバカにした「うそ」",
            "恋人にいじわるして「うそ」",
            "衝撃の事実を知って「うそ」",
            "完全に疑っているときの「うそ」",
            "ドッキリのネタばらしの「うそ」",
            "女子高生があいづちに使う「うそ」"
        ]
    },
    {
        "theme" : "はい",
        "roles" : [
            "ノックされたときの「はい」",
            "聞き返すときの「はい」",
            "出欠確認のときの「はい」",
            "やる気のない「はい」",
            "プレゼントをわたすときの「はい」",
            "怒られているときの「はい」",
            "おどろいたときの「はい」",
            "告白OKのときの「はい」"
        ]
    },
    {
        "theme" : "やばい",
        "roles" : [
            "おいしすぎて「やばい」",
            "胸キュンの「やばい」",
            "寝坊したときの「やばい」",
            "面白すぎて「やばい」",
            "宝くじがあたって「やばい」",
            "身の危険を感じて「やばい」",
            "トイレに行きたくて「やばい」",
            "ハイテンションなときの「やばい」"
        ]
    },
    {
        "theme" : "愛してる",
        "roles" : [
            "ぶりっこで「愛してる」",
            "母が子に「愛してる」",
            "子が母に「愛してる」",
            "ロックシンガーが「愛してる」",
            "真剣に「愛してる」",
            "キュートに「愛してる」",
            "全人類に「愛してる」",
            "キザに「愛してる」"
        ]
    },
    {
        "theme" : "すき",
        "roles" : [
            "グッとくる「すき」",
            "いたずらっぽく「すき」",
            "さりげない「すき」",
            "偽りの「すき」",
            "色っぽい「すき」",
            "私のこと本当に「すき」",
            "下心ありの「すき」",
            "気持ち悪い「すき」"
        ]
    },
    {
        "theme" : "大丈夫",
        "roles" : [
            "安心させるときの「大丈夫」",
            "心配して「大丈夫」",
            "そっけない「大丈夫」",
            "私に任せなさい「大丈夫」",
            "キザに「大丈夫」",
            "詐欺師が言う「大丈夫」",
            "ビックリして「大丈夫」",
            "大丈夫じゃないときの「大丈夫」"
        ]
    },
    {
        "theme" : "にゃー",
        "roles" : [
            "捨て猫の「にゃー」",
            "猫に向かって「にゃー」",
            "甘えた「にゃー」",
            "リアル猫の「にゃー」",
            "混乱したときの「にゃー」",
            "威嚇の「にゃー」",
            "ねむいときの「にゃー」",
            "かわいい「にゃー」"
        ]
    },
    {
        "theme" : "そんな",
        "roles" : [
            "値段が高くて「そんな」",
            "裏切られて「そんな」",
            "信じられなくて「そんな」",
            "照れて「そんな」",
            "自動ドアにはさまれて「そんな」",
            "追い詰められて「そんな」",
            "落ちこんで「そんな」",
            "おどろいて「そんな」"
        ]
    },
    {
        "theme" : "がんばれ",
        "roles" : [
            "見下ろして「がんばれ」",
            "軽く「がんばれ」",
            "熱く「がんばれ」",
            "明るく「がんばれ」",
            "遠くに向かって「がんばれ」",
            "怒って「がんばれ」",
            "色っぽく「がんばれ」",
            "つらいけど・・・「がんばれ」"
        ]
    },
    {
        "theme" : "さぁ",
        "roles" : [
            "とぼけた「さぁ」",
            "料理をふるまう「さぁ」",
            "物語を始まりの「さぁ」",
            "お客を集めるときの「さぁ」",
            "冷たく「さぁ」",
            "実況中継の「さぁ」",
            "帰るときの「さぁ」",
            "そよ風の「さぁ」"
        ]
    },
    {
        "theme" : "笑い声",
        "roles" : [
            "大魔王の笑い声",
            "お嬢様の笑い声",
            "赤ちゃんの笑い声",
            "おばあちゃんの笑い声",
            "気持ち悪い笑い声",
            "さわやかな笑い声",
            "人をバカにしてる笑い声",
            "こらえきれなくなった笑い声"
        ]
    },
    {
        "theme" : "いやー",
        "roles" : [
            "ほめられたときの「いやー」",
            "考え事をしながら「いやー」",
            "お願いを断る「いやー」",
            "おばけを見て「いやー」",
            "ごまかす「いやー」",
            "マジでムリ！の「いやー」",
            "持てる？の「いやー」",
            "ハッピーニュ「イヤー」"
        ]
    },
    {
        "theme" : "うわーっ",
        "roles" : [
            "体重計に乗って「うわーっ」",
            "見上げて「うわーっ」",
            "おどろかそうとして「うわーっ」",
            "同情して「うわーっ」",
            "軽蔑して「うわーっ」",
            "ジェットコースターで「うわーっ」",
            "ゴキブリを見つけて「うわーっ」",
            "プレセントを開けて「うわーっ」"
        ]
    },
    {
        "theme" : "なんで",
        "roles" : [
            "手品におどろいて「なんで」",
            "不機嫌に「なんで」",
            "自分を責めて「なんで」",
            "ありえない！の「なんで」",
            "パニックになって「なんで」",
            "わがままの「なんで」",
            "フラれたときの「なんで」",
            "カレー屋の注文で「ナンで」"
        ]
    },
    {
        "theme" : "もう",
        "roles" : [
            "からかわれて「もう」",
            "時間がせまって「もう」",
            "しょうがないなぁ、の「もう」",
            "イライラして「もう」",
            "くすぐられて「もう」",
            "激怒して「もう」",
            "おおらかな乳牛の「もう」",
            "攻撃的な闘牛の「もう」"
        ]
    },
    {
        "theme" : "んー",
        "roles" : [
            "フカフカお布団に入っての「んー」",
            "考えこんで「んー」",
            "納得の「んー」",
            "我慢して「んー」",
            "うんざりして「んー」",
            "ちょっとちがうな、の「んー」",
            "しぶしぶ同意の「んー」",
            "おいしい！の「んー」"
        ]
    },
    {
        "theme" : "自己紹介([　]に自分の名前)",
        "roles" : [
            "ヒーロー風に「[名前]です」",
            "セクシーに「[名前]です」",
            "悪役っぽく「[名前]です」",
            "天才っぽく「[名前]です」",
            "クールに「[名前]です」",
            "怪力男で「[名前]です」",
            "超美型で「[名前]です」",
            "ふつうに「[名前]です」"
        ]
    }
];

var wordPoolTest = [
    {
        "words"  : [ "sale","seal","ales","leas" ],
        "decoys" : [ "lead","lamp","seed","eels","lean","cels","lyse","sloe","tels","self" ]
    },

    {
        "words"  : [ "item","time","mite","emit" ],
        "decoys" : [ "neat","team","omit","tame","mate","idem","mile","lime","tire","exit" ]
    },

    {
        "words"  : [ "spat","past","pats","taps" ],
        "decoys" : [ "pots","laps","step","lets","pint","atop","tapa","rapt","swap","yaps" ]
    },

    {
        "words"  : [ "nest","sent","nets","tens" ],
        "decoys" : [ "tend","went","lent","teen","neat","ante","tone","newt","vent","elan" ]
    },

    {
        "words"  : [ "pale","leap","plea","peal" ],
        "decoys" : [ "sale","pail","play","lips","slip","pile","pleb","pled","help","lope" ]
    },

    {
        "words"  : [ "races","cares","scare","acres" ],
        "decoys" : [ "crass","scary","seeds","score","screw","cager","clear","recap","trace","cadre" ]
    },

    {
        "words"  : [ "bowel","elbow","below","beowl" ],
        "decoys" : [ "bowed","bower","robed","probe","roble","bowls","blows","brawl","bylaw","ebola" ]
    },

    {
        "words"  : [ "dates","stead","sated","adset" ],
        "decoys" : [ "seats","diety","seeds","today","sited","dotes","tides","duets","deist","diets" ]
    },

    {
        "words"  : [ "spear","parse","reaps","pares" ],
        "decoys" : [ "ramps","tarps","strep","spore","repos","peris","strap","perms","ropes","super" ]
    },

    {
        "words"  : [ "stone","tones","steno","onset" ],
        "decoys" : [ "snout","tongs","stent","tense","terns","santo","stony","toons","snort","stint" ]
    }
];
