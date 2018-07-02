import {ooElement} from './oo.js';
import './ttt-board.js';

const templateString = `
<style>
    :host {
        display: flex;
        flex-wrap: nowrap;
        margin: 20px;
    }

    .game-info {
        margin-left: 20px;
    }
</style>
<ttt-board [squares]="this.history[this.stepNumber]" [onsquareclick]="(i) => this.handleSquareClick(i)"></ttt-board>
<div class="game-info">
<div>{{this.statusMsg}}</div>
<ol>
    <li data-rpt="this.history">
        <button [onclick]="(e) => this.jumpTo(context.index)">{{this.moveText(context.index)}}</button>
    </li>
</ol>
</div>
`;

class tttGame extends ooElement {
    constructor() {
        super();

        this.history = [
            Array(9).fill(null)
        ];

        this.stepNumber = 0;
        this.xIsNext =  true;
    }

    connectedCallback() {
        super.connectedCallback();
        this.refresh();
    }

    moveText(index) {
        return index === 0 ? 'Go to game start' : 'Go to move #' + index;
    }

    handleSquareClick(i) {
        const currentSquares = this.history[this.stepNumber];

        if (this.calculateWinner(currentSquares) || currentSquares[i])
            return;

        this.stepNumber++;

        this.history[this.stepNumber] = currentSquares.slice();

        this.history[this.stepNumber][i] = this.xIsNext ? 'X' : 'O';

        if((this.history.length - 1) > this.stepNumber)
            this.history = this.history.slice(0, this.stepNumber + 1);

        this.xIsNext = !this.xIsNext;

        this.refresh();
    }

    jumpTo(step) {
        this.stepNumber = step;
        this.xIsNext = (step % 2) === 0;
        this.refresh();
    }

    get statusMsg() {
        let winner = this.calculateWinner(this.history[this.stepNumber]);

        if (winner)
            return 'Winner: ' + winner;

        return 'Next player: ' + (this.xIsNext ? 'X' : 'O');
    }

    calculateWinner(squares) {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        return null;
    }
}

ooElement.define('ttt-game', tttGame, templateString);